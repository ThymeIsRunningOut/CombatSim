import { WeaponDef, CreatureDef, TTKResult, TTKThresholds, CombatConfig, FleetShipTypeDef } from '../types/combat';
import { DEFAULT_COMBAT_CONFIG } from './relations';
import { calculateDamageAgainstCreature } from './math';
import { knotsSpeedToPxPerSec, knotsSpeedToMps, metersToPx, CROWD_DISPERSION_DEFAULT_M, LEGACY_PX_SPEED_RESCALE } from './measurements';
import { traverseArcDeg, isContinuousWeapon, isSprayWeapon, isBeamWeapon } from './weapons';

/**
 * Computes deterministic analytical Time-To-Kill (TTK) across any Weapon vs Creature matchup.
 * Takes into account:
 * - Armor Class flat absorption per projectile
 * - Armor Pool depletion
 * - Energy resistance percentage
 * - Magazine size & reload cycles
 * - Fire rate & cycle delays
 * - Swarm count multiplier (e.g. Veilfangs with 12 entities)
 */
/** Reference engagement range (px) used to convert creature speed into required tracking rate */
export const TRACKING_REFERENCE_RANGE = 300;
/** Default efficiency bands (simulated mode, seconds): Efficient <= 120, Semi-efficient <= 240, else Inefficient. */
export const DEFAULT_TTK_THRESHOLDS: TTKThresholds = { efficient: 120, inefficient: 240 };
/** Ratio bands (per creature column): Efficient <= 1.3x the fastest weapon, Semi <= 3x, else (or no kill) Inefficient. */
export const RATIO_BANDS = { efficient: 1.3, semi: 3.0 };
/** Share of extra pierce targets that are actually lined up behind the first (swarm geometry, estimate). */
export const PIERCE_LINEUP_SHARE = 0.5;
export const DEFAULT_TURN_SPEED = 120;

/**
 * Share of shots that land given weapon turn speed vs the angular speed a circling creature demands.
 * 1.0 means the weapon keeps up; lower values mean misses (still costing fire time, ammo and recharge).
 */
export function calculateTrackingFactor(weapon: WeaponDef, creature: CreatureDef): number {
  if (isSprayWeapon(weapon)) return 1; // sprays fill the cone, no aiming needed
  // Angular demand is measured at the 8.25 m/s knot (LEGACY_PX_SPEED_RESCALE = 1 now). Turrets are
  // boresight-gated (they fire when a target crosses the barrel, they don't have to follow it). Calibrated
  // against seeded headless runs (Nov 2026).
  const speedPx = knotsSpeedToPxPerSec(creature.movementSpeed || 0) / LEGACY_PX_SPEED_RESCALE;
  const required = (speedPx / TRACKING_REFERENCE_RANGE) * (180 / Math.PI);
  if (required <= 0) return 1;
  return Math.min(1, (weapon.turnSpeed ?? DEFAULT_TURN_SPEED) / required);
}

/** Share of shots that still land when the projectile is slower than the target (only hits on approach). */
export const SLOW_PROJECTILE_HIT_FACTOR = 0.3;

/**
 * Intercept feasibility for straight-line projectiles: a bullet slower than a crossing target has no lead
 * solution, so only shots fired while the target approaches land. Energy beams are instant. Arched shells are
 * not limited by speed (they land on a predicted point; their accuracy depends on how predictable the target is
 * over the flight time, which this closed-form model does not capture). Returns 1.0 when interception is possible.
 */
export function calculateInterceptFactor(weapon: WeaponDef, creature: CreatureDef): number {
  if (isContinuousWeapon(weapon)) return 1.0; // beams and sprays are instant
  if (weapon.trajectory === 'Arch') return 1.0; // predicted-point ballistics
  const targetMps = knotsSpeedToMps(creature.movementSpeed || 0);
  if (!weapon.projectileSpeed || weapon.projectileSpeed <= 0) return 1.0;
  return weapon.projectileSpeed > targetMps ? 1.0 : SLOW_PROJECTILE_HIT_FACTOR;
}

/** Share of attempted dodges that actually clear the blast (calibrated vs headless runs: committed attack windows, volleys). */
export const DODGE_SUCCESS_RATE = 0.78;
/** Share of swarm members that clear a lobbed shell's blast when they react (Veilfangs, calibrated vs headless runs). */
export const SWARM_SHELL_EVASION_SUCCESS = 0.84;

/** Creatures with dodgeChance sidestep lobbed shells and straight shots slower than themselves (not beams). Returns the share of hits kept. */
export function calculateDodgeFactor(weapon: WeaponDef, creature: CreatureDef): number {
  const chance = creature.dodgeChance ?? 0;
  if (chance <= 0) return 1.0;
  // Swarms scatter out of the predicted blast of lobbed area shells (calibrated vs headless: 8x grenade vs Veilfangs)
  if (creature.quantity > 1) return weapon.trajectory === 'Arch' && (weapon.aoe ?? 0) > 0 ? 1 - chance * SWARM_SHELL_EVASION_SUCCESS : 1.0;
  if (isContinuousWeapon(weapon)) return 1.0; // beams and sprays can't be sidestepped
  // Lobbed (Arch) shells are always dodgeable; straight shots only when slower than the creature
  if (weapon.trajectory !== 'Arch' && (!weapon.projectileSpeed || weapon.projectileSpeed >= knotsSpeedToMps(creature.movementSpeed || 0))) return 1.0;
  return 1 - chance * DODGE_SUCCESS_RATE;
}

/**
 * Calculates real-world behavior exposure factors:
 * - Submersion / Diving uptime (damage immunity phases)
 * - Firing arc coverage (time spent within turret shooting arc)
 * - Evasive swarm dispersion & scatter
 */
export function calculateBehaviorExposure(weapon: WeaponDef, creature: CreatureDef, combat: CombatConfig = DEFAULT_COMBAT_CONFIG): {
  submersionUptimeRatio: number;
  arcExposureRatio: number;
  scatterEvasionRatio: number;
  behaviorExposureRatio: number;
} {
  // 1. Submersion / Diving uptime
  let submersionUptimeRatio = 1.0;
  if (!creature.isFlying && creature.underwaterInterval && creature.surfaceInterval) {
    if (creature.pursueStyle === 'orbit_drain') {
      const surfaceTime = creature.surfaceDuration ?? 3;
      const depthsTime = creature.depthsDuration ?? 3;
      const chargeStage = creature.chargeStageDuration ?? 18;
      const attackStage = creature.attackDuration ?? 10;
      const cycles = chargeStage / (surfaceTime + depthsTime);
      const totalSurfaced = cycles * surfaceTime;
      const totalCycleTime = chargeStage + attackStage;
      submersionUptimeRatio = Math.max(0.15, totalSurfaced / totalCycleTime);
    } else {
      submersionUptimeRatio = creature.surfaceInterval / (creature.surfaceInterval + creature.underwaterInterval);
    }
  } else if (creature.id === 'thunder_leviarch' && creature.underwaterInterval && creature.surfaceInterval) {
    submersionUptimeRatio = creature.surfaceInterval / (creature.surfaceInterval + creature.underwaterInterval);
  }

  // 2. Turret Arc Exposure: the weapon's traverse cone (UE model). Sprays fill the whole cone.
  const effectiveArc = traverseArcDeg(weapon);
  const arcExposureRatio = effectiveArc >= 360 ? 1.0 : Math.min(1.0, Math.max(0.45, (effectiveArc / 360) * 1.15));

  // 3. Evasive Swarm Scatter & Regroup
  let scatterEvasionRatio = 1.0;
  if (creature.quantity > 1) {
    scatterEvasionRatio = 0.80;
  }

  // Submerged time is no longer immune: it counts at the universal underwater damage reduction
  const underwaterShare = 1 - Math.max(0, Math.min(1, combat.underwaterDamageReduction));
  const damageUptime = submersionUptimeRatio + (1 - submersionUptimeRatio) * underwaterShare;
  const behaviorExposureRatio = Math.max(0.12, damageUptime * arcExposureRatio * scatterEvasionRatio);

  return {
    submersionUptimeRatio: Number(submersionUptimeRatio.toFixed(2)),
    arcExposureRatio: Number(arcExposureRatio.toFixed(2)),
    scatterEvasionRatio: Number(scatterEvasionRatio.toFixed(2)),
    behaviorExposureRatio: Number(behaviorExposureRatio.toFixed(2)),
  };
}

/**
 * Power Barrier (GDD): share of a weapon's landed damage the barrier absorbs. Each cycle the barrier is down for
 * `cooldown` s, then rises and soaks `charges` hits (1 charge = 1 projectile or 1 s of beam). Rapid fire spends the
 * charges fast, so its share is small; slow heavy shells and beams lose much more. One turret, burst duty included.
 */
export function powerBarrierShare(weapon: WeaponDef, charges: number | undefined, cooldown: number, hitFactor: number): number {
  if (!charges || charges <= 0) return 0;
  const duty = (weapon.fireDuration || 3) / Math.max(1e-6, (weapon.fireDuration || 3) + (weapon.cooldownDuration || 0));
  const chargesPerSec = (isContinuousWeapon(weapon) ? 1 : (weapon.fireRate || 1) * Math.max(0.01, hitFactor)) * duty;
  return Math.min(0.95, charges / (chargesPerSec * Math.max(0, cooldown) + charges));
}

export function calculateAnalyticalTTK(
  weapon: WeaponDef,
  creature: CreatureDef,
  mode: 'theoretical' | 'simulated' = 'simulated',
  thresholds?: TTKThresholds,
  combat: CombatConfig = DEFAULT_COMBAT_CONFIG
): TTKResult {
  const isSwarm = creature.quantity > 1;
  const singleEntityHp = creature.hp;
  const singleEntityArmor = creature.physicalArmor;
  const totalHpToKill = isSwarm ? singleEntityHp * creature.quantity : creature.hp;
  const totalArmorToDeplete = isSwarm ? singleEntityArmor * creature.quantity : creature.physicalArmor;

  const tracking = calculateTrackingFactor(weapon, creature);
  const intercept = calculateInterceptFactor(weapon, creature);
  const dodge = calculateDodgeFactor(weapon, creature);
  const hitFactor = tracking * intercept * dodge; // expected share of shots that land

  let currentArmor = totalArmorToDeplete;
  let currentHp = totalHpToKill;

  let shotsFired = 0;
  let totalTime = 0;
  let ammoInMag = weapon.ammoCapacity;
  let totalAmmoConsumed = 0;

  // Simulate discrete shots or continuous beam/cloud ticks
  // Continuous weapons (Energy beam / Chemical spray) are modelled as 0.1 s ticks of dps; ammo is paid per burst
  const continuous = isContinuousWeapon(weapon);
  const CONTINUOUS_TICK = 0.1;
  const timePerShot = continuous ? CONTINUOUS_TICK : (weapon.fireRate > 0 ? 1 / weapon.fireRate : 1.0);
  const damagePerShot = continuous ? weapon.dps * CONTINUOUS_TICK : weapon.dpp;
  const maxIterations = 20000; // Safeguard

  if (weapon.damageType === 'Physical' && weapon.dpp <= creature.armorClass && totalArmorToDeplete > 0) {
    // Weapon deals minimal chip (1 dmg)
    // Check if totally ineffective
  }

  let burstFiredDuration = 0;
  const fireDurationLimit = weapon.fireDuration || 3.0;
  const burstCooldown = weapon.cooldownDuration || 2.0;

  // Swarm dispersion & hit capacity analysis:
  // Unless there is true AOE or explosive fall-off, each hit can only damage a limited number of creatures
  // based on crowd dispersion / packing density (e.g. 1 blast of photon gun cannot destroy half of the swarm).
  let swarmHitCount = 1;
  if (isSwarm) {
    // Definitions are metric; the swarm-packing heuristic below is tuned in canvas px
    const aoe = metersToPx(weapon.aoe || 0);
    const dispersion = metersToPx(creature.crowdDispersion ?? CROWD_DISPERSION_DEFAULT_M);
    const quantity = creature.quantity;

    // True explosive splash / chemical cloud / mortar
    const isAOE = aoe >= 25 || weapon.trajectory === 'Arch' || weapon.damageType === 'Chemical';

    if (!isAOE) {
      // Pinpoint bullet or focused beam: hits 1 creature per hit; a piercing beam catches some members lined up behind
      const pierce = Math.max(1, Math.round(weapon.pierceCount ?? 1));
      swarmHitCount = Math.min(quantity, 1 + (pierce - 1) * PIERCE_LINEUP_SHARE);
    } else {
      // Effective blast radius and blast circle area
      const blastRadius = Math.max(aoe, 25);
      const blastArea = Math.PI * blastRadius * blastRadius;

      // Hexagonal / flock packing area per entity based on mutual crowd dispersion distance
      // Higher dispersion = entities are spread far apart = fewer caught in blast
      const areaPerEntity = Math.max(120, dispersion * dispersion * 0.866);

      // Distance blast fall-off averaging ~75% damage efficiency across the blast circle
      const rawCaught = blastArea / areaPerEntity;
      const expectedCaught = rawCaught * 0.75;
      swarmHitCount = Math.min(quantity, Math.max(1, expectedCaught));
    }
  }

  // One target per burst (beam vs swarm): each burst kills at most one member, then the beam goes to cooldown
  const lockPerBurst = continuous && isSwarm && !!weapon.oneTargetPerBurst;
  let burstTargetHp = singleEntityHp + singleEntityArmor;

  // Energy beams count ammo in seconds of fire (GDD); Chemical sprays pay per burst; projectiles per shot
  const timeAmmo = isBeamWeapon(weapon);
  while (currentHp > 0 && shotsFired < maxIterations) {
    // Check reload
    if (timeAmmo ? ammoInMag < CONTINUOUS_TICK - 1e-9 : (ammoInMag < weapon.ammoPerShot && (!continuous || burstFiredDuration === 0))) {
      totalTime += weapon.reloadTime;
      ammoInMag = weapon.ammoCapacity;
      burstFiredDuration = 0;
      continue;
    }

    // Check burst cooldown duration limit
    if (burstFiredDuration >= fireDurationLimit) {
      totalTime += burstCooldown;
      burstFiredDuration = 0;
      burstTargetHp = singleEntityHp + singleEntityArmor;
      continue;
    }

    // Fire
    shotsFired++;
    if (timeAmmo) {
      ammoInMag -= CONTINUOUS_TICK;
      totalAmmoConsumed += CONTINUOUS_TICK;
    } else if (!continuous || burstFiredDuration === 0) {
      ammoInMag -= weapon.ammoPerShot;
      totalAmmoConsumed += weapon.ammoPerShot;
    }
    burstFiredDuration += timePerShot;

    // Apply damage
    const dmg = calculateDamageAgainstCreature(
      weapon.damageType,
      damagePerShot,
      currentArmor,
      creature.armorClass,
      creature.energyResistance
    );

    // Expected damage after misses from imperfect tracking
    let effectiveHpDamage = dmg.hpDamage * hitFactor;
    let effectiveArmorDamage = dmg.armorDamage * hitFactor;

    // Swarm damage cap: a single hit cannot exceed the total pool of the entities actually caught
    if (isSwarm) {
      const maxHpHitCap = singleEntityHp * swarmHitCount;
      const maxArmorHitCap = singleEntityArmor * swarmHitCount;

      effectiveHpDamage = Math.min(effectiveHpDamage, maxHpHitCap);
      effectiveArmorDamage = Math.min(effectiveArmorDamage, maxArmorHitCap);
    }

    if (lockPerBurst) {
      // Damage only the locked member; once it dies the rest of the burst is wasted
      const total = effectiveHpDamage + effectiveArmorDamage;
      const usable = Math.min(total, burstTargetHp);
      const k = total > 0 ? usable / total : 0;
      effectiveHpDamage *= k;
      effectiveArmorDamage *= k;
      burstTargetHp -= usable;
      if (burstTargetHp <= 1e-9) burstFiredDuration = fireDurationLimit;
    }

    currentArmor = Math.max(0, currentArmor - effectiveArmorDamage);
    currentHp = Math.max(0, currentHp - effectiveHpDamage);

    if (currentHp <= 0) {
      // Finished
      break;
    }

    totalTime += timePerShot;
  }

  // Power Barrier soaks part of the landed hits
  const barrierShare = powerBarrierShare(weapon, creature.barrierCharges, creature.barrierCooldown ?? 15, hitFactor);
  if (barrierShare > 0) totalTime /= (1 - barrierShare);

  const rawDps = continuous ? weapon.dps : weapon.dpp * weapon.fireRate;
  const effectiveDps = totalTime > 0 ? (totalHpToKill + totalArmorToDeplete) / totalTime : 0;
  const penetrationRatio = rawDps > 0 ? Math.min(1.0, effectiveDps / rawDps) : 0;
  // Rating gate: dodged shots are a hit-rate effect (already in the TTK), not poor penetration
  const ratingPenetration = rawDps > 0 ? Math.min(1.0, effectiveDps / (rawDps * Math.max(0.05, dodge))) : 0;

  // Theoretical pure TTK (static benchmark)
  const theoreticalTtk = Number(totalTime.toFixed(1));

  // Behavior Exposure calculation
  const exposure = calculateBehaviorExposure(weapon, creature, combat);
  const behaviorTtk = Number((theoreticalTtk / exposure.behaviorExposureRatio).toFixed(1));

  const displayTtk = mode === 'simulated' ? behaviorTtk : theoreticalTtk;

  // For AOE weapons, the blast radius mitigates tracking error — but only if the projectile can actually
  // intercept the target (a shell slower than its target can't be led onto it).
  const effectiveTracking = ((weapon.aoe && metersToPx(weapon.aoe) >= 40)
    ? (intercept < 1 ? tracking : Math.min(1.0, tracking * 1.6))
    : tracking) * intercept;

  // Determine efficiency rating matching user-specified design:
  // - High-speed flyers: Gatling EFFICIENT, Photon SEMI-EFFICIENT, Grenade INEFFICIENT
  // - Heavy Armor AC 15: Photon EFFICIENT, Grenade SEMI-EFFICIENT, Gatling INEFFICIENT
  // - Swarms: Gatling & Grenade EFFICIENT, Photon INEFFICIENT
  // - Energy Shield: Grenade EFFICIENT, Gatling SEMI-EFFICIENT, Photon INEFFICIENT
  const effCutoff = thresholds ? thresholds.efficient : (mode === 'simulated' ? DEFAULT_TTK_THRESHOLDS.efficient : 40.0);
  const ineffCutoff = thresholds ? thresholds.inefficient : (mode === 'simulated' ? DEFAULT_TTK_THRESHOLDS.inefficient : 90.0);

  let efficiencyRating: 'EFFICIENT' | 'SEMI_EFFICIENT' | 'INEFFICIENT' = 'SEMI_EFFICIENT';

  const isOptimal = displayTtk <= effCutoff &&
    ratingPenetration >= 0.15 &&
    effectiveTracking >= 0.40;

  const isInefficient =
    effectiveTracking <= 0.25 ||
    displayTtk > ineffCutoff ||
    ratingPenetration < 0.08 ||
    shotsFired >= maxIterations;

  if (isInefficient) {
    efficiencyRating = 'INEFFICIENT';
  } else if (isOptimal) {
    efficiencyRating = 'EFFICIENT';
  } else {
    efficiencyRating = 'SEMI_EFFICIENT';
  }

  let status: 'OPTIMAL' | 'EFFECTIVE' | 'INEFFECTIVE' | 'IMMUNE' = 'EFFECTIVE';
  if (shotsFired >= maxIterations || penetrationRatio === 0) {
    status = 'IMMUNE';
  } else if (efficiencyRating === 'EFFICIENT') {
    status = 'OPTIMAL';
  } else if (efficiencyRating === 'INEFFICIENT') {
    status = 'INEFFECTIVE';
  } else {
    status = 'EFFECTIVE';
  }

  return {
    weaponId: weapon.id,
    weaponName: weapon.name,
    creatureId: creature.id,
    creatureName: creature.name,
    damageType: weapon.damageType,
    timeToKillSeconds: displayTtk,
    theoreticalTtkSeconds: theoreticalTtk,
    behaviorTtkSeconds: behaviorTtk,
    submersionUptimeRatio: exposure.submersionUptimeRatio,
    arcExposureRatio: exposure.arcExposureRatio,
    trackingRatio: Number(tracking.toFixed(2)),
    interceptRatio: Number(intercept.toFixed(2)),
    behaviorExposureRatio: exposure.behaviorExposureRatio,
    efficiencyRating,
    shotsToKill: shotsFired,
    totalAmmoConsumed,
    effectiveDps: Math.round(effectiveDps),
    rawDps: Math.round(rawDps),
    penetrationRatio: Number(penetrationRatio.toFixed(2)),
    status,
  };
}

/**
 * Computes the full cross-matrix of all weapons vs all creatures
 */
export function generateTTKMatrix(
  weapons: WeaponDef[],
  creatures: CreatureDef[],
  mode: 'theoretical' | 'simulated' = 'simulated',
  thresholds?: TTKThresholds,
  combat: CombatConfig = DEFAULT_COMBAT_CONFIG
): TTKResult[][] {
  return weapons.map((w) => creatures.map((c) => (
    { ...calculateAnalyticalTTK(w, c, mode, thresholds, combat), weaponName: w.name, weaponId: w.id }
  )));
}

// ============================================================================
// Fleet TTK (Phase 4): one Behemoth weapon vs one fleet ship type
// ============================================================================

/** Share of combat time a fleet ship spends surfaced / targetable at full damage (heuristic per layer & movement). */
export function fleetSurfaceShare(st: FleetShipTypeDef): number {
  if (st.layer === 'submerged') return 0;
  if (st.layer !== 'diving') return 1;
  if (st.movement === 'close') return 0.8; // surfaces to close in for contact attacks
  const surf = st.weapons.filter((w) => w.requiresSurface);
  if (surf.length === 0) return 0.15;
  return Math.min(1, Math.max(0.15, surf.reduce((s, w) => s + ((w.duration ?? 0) + 2) / Math.max(1, w.cooldown), 0)));
}

/** Synthesized creature def so fleet ships run through the same TTK model as creatures. */
export function fleetShipAsCreatureDef(st: FleetShipTypeDef): CreatureDef {
  const share = fleetSurfaceShare(st);
  const regenHp = st.regenPct ? st.hp * (st.regenPct / 100) : 0; // one regeneration per fight
  return {
    id: st.id, name: st.name, description: '', hp: st.hp + regenHp, physicalArmor: st.armor, armorClass: st.armorClass,
    energyResistance: st.energyResistance, quantity: 1, movementSpeed: st.speed, acceleration: 1, deceleration: 1,
    turningRate: st.turnRate ?? 90, underwaterInterval: share < 1 ? (1 - share) * 10 : 0, surfaceInterval: share < 1 ? Math.max(0.001, share * 10) : 0,
    chargeWindup: 0, strikeDuration: 0, strikeCooldown: 0, strikeDamageRate: 0, strikeStunChance: 0, strikeStunDuration: 0,
    strikeRamMass: 0, iconColor: '#ffffff', radius: st.radiusM, isFlying: st.layer === 'aerial',
  } as CreatureDef;
}

export interface FleetTTKResult extends TTKResult {
  weaponMultiplier: number;
  barrierUptime: number;   // share of time invulnerable (barrier)
}

export function calculateFleetShipTTK(
  weapon: WeaponDef,
  st: FleetShipTypeDef,
  mode: 'theoretical' | 'simulated' = 'simulated',
  thresholds?: TTKThresholds,
  combat: CombatConfig = DEFAULT_COMBAT_CONFIG
): FleetTTKResult {
  const mul = st.weaponMultipliers?.[weapon.id] ?? 1;
  const w: WeaponDef = { ...weapon, dpp: weapon.dpp * mul, dps: weapon.dps * mul };
  const base = calculateAnalyticalTTK(w, fleetShipAsCreatureDef(st), mode, thresholds, combat);
  // Power barrier: up once per barrierCooldown while under fire, until its charges are spent or barrierDuration ends
  const timeShare = st.barrierDuration && st.barrierCooldown ? Math.min(0.9, st.barrierDuration / st.barrierCooldown) : 0;
  const barrierUptime = st.barrierCharges && st.barrierCooldown
    ? Math.min(timeShare || 0.9, powerBarrierShare(w, st.barrierCharges, st.barrierCooldown, 1))
    : timeShare;
  if (barrierUptime > 0 && mode === 'simulated') {
    const ttk = Number((base.timeToKillSeconds / (1 - barrierUptime)).toFixed(1));
    const effCutoff = thresholds ? thresholds.efficient : DEFAULT_TTK_THRESHOLDS.efficient;
    const ineffCutoff = thresholds ? thresholds.inefficient : DEFAULT_TTK_THRESHOLDS.inefficient;
    let rating = base.efficiencyRating;
    if (ttk > ineffCutoff) rating = 'INEFFICIENT';
    else if (rating === 'EFFICIENT' && ttk > effCutoff) rating = 'SEMI_EFFICIENT';
    return { ...base, weaponName: weapon.name, timeToKillSeconds: ttk, behaviorTtkSeconds: ttk, efficiencyRating: rating, weaponMultiplier: mul, barrierUptime };
  }
  return { ...base, weaponName: weapon.name, weaponMultiplier: mul, barrierUptime };
}
