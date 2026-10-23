import { WeaponDef, CreatureDef, TTKResult, TTKThresholds } from '../types/combat';
import { calculateDamageAgainstCreature } from './math';

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
export const DEFAULT_TURN_SPEED = 120;

/**
 * Share of shots that land given weapon turn speed vs the angular speed a circling creature demands.
 * 1.0 means the weapon keeps up; lower values mean misses (still costing fire time, ammo and recharge).
 */
export function calculateTrackingFactor(weapon: WeaponDef, creature: CreatureDef): number {
  const required = ((creature.movementSpeed || 0) / TRACKING_REFERENCE_RANGE) * (180 / Math.PI);
  if (required <= 0) return 1;
  return Math.min(1, (weapon.turnSpeed ?? DEFAULT_TURN_SPEED) / required);
}

/**
 * Calculates real-world behavior exposure factors:
 * - Submersion / Diving uptime (damage immunity phases)
 * - Firing arc coverage (time spent within turret shooting arc)
 * - Evasive swarm dispersion & scatter
 */
export function calculateBehaviorExposure(weapon: WeaponDef, creature: CreatureDef): {
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

  // 2. Turret Arc Exposure (capped by mount traverse rotation limit)
  const rawArc = weapon.shootingArc ?? 240;
  const rotationCap = weapon.rotationCap ?? 225;
  const effectiveArc = Math.min(rawArc, rotationCap);
  const arcExposureRatio = effectiveArc >= 360 ? 1.0 : Math.min(1.0, Math.max(0.45, (effectiveArc / 360) * 1.15));

  // 3. Evasive Swarm Scatter & Regroup
  let scatterEvasionRatio = 1.0;
  if (creature.quantity > 1) {
    scatterEvasionRatio = 0.80;
  }

  const behaviorExposureRatio = Math.max(0.12, submersionUptimeRatio * arcExposureRatio * scatterEvasionRatio);

  return {
    submersionUptimeRatio: Number(submersionUptimeRatio.toFixed(2)),
    arcExposureRatio: Number(arcExposureRatio.toFixed(2)),
    scatterEvasionRatio: Number(scatterEvasionRatio.toFixed(2)),
    behaviorExposureRatio: Number(behaviorExposureRatio.toFixed(2)),
  };
}

export function calculateAnalyticalTTK(
  weapon: WeaponDef,
  creature: CreatureDef,
  mode: 'theoretical' | 'simulated' = 'simulated',
  thresholds?: TTKThresholds
): TTKResult {
  const isSwarm = creature.quantity > 1;
  const singleEntityHp = creature.hp;
  const singleEntityArmor = creature.physicalArmor;
  const totalHpToKill = isSwarm ? singleEntityHp * creature.quantity : creature.hp;
  const totalArmorToDeplete = isSwarm ? singleEntityArmor * creature.quantity : creature.physicalArmor;

  const tracking = calculateTrackingFactor(weapon, creature);

  let currentArmor = totalArmorToDeplete;
  let currentHp = totalHpToKill;

  let shotsFired = 0;
  let totalTime = 0;
  let ammoInMag = weapon.ammoCapacity;
  let totalAmmoConsumed = 0;

  // Simulate discrete shots or continuous beam/cloud ticks
  const timePerShot = weapon.fireRate > 0 ? 1 / weapon.fireRate : 1.0;
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
  // based on quantity and dispersion speed (e.g. 1 blast of photon gun cannot destroy half of the swarm).
  let swarmHitCount = 1;
  if (isSwarm) {
    const aoe = weapon.aoe || 0;
    const speed = creature.movementSpeed || 150;
    const quantity = creature.quantity;

    // True explosive splash / chemical cloud / mortar
    const isAOE = aoe >= 40 || weapon.trajectory === 'Arch' || weapon.damageType === 'Chemical';

    if (!isAOE) {
      // Pinpoint bullet or focused beam: hits at most 1 creature per hit/projectile
      swarmHitCount = 1;
    } else {
      // Swarm dispersion radius expands as movement speed increases
      const spreadRadius = 35 + (speed / 100) * 45;
      const coverageRatio = Math.min(1.0, Math.pow(aoe / spreadRadius, 2));
      // Distance blast fall-off averaging 70% efficiency across caught entities
      const falloff = 0.70;
      const expectedCaught = quantity * coverageRatio * falloff;
      swarmHitCount = Math.min(quantity, Math.max(1, expectedCaught));
    }
  }

  while (currentHp > 0 && shotsFired < maxIterations) {
    // Check reload
    if (ammoInMag < weapon.ammoPerShot) {
      totalTime += weapon.reloadTime;
      ammoInMag = weapon.ammoCapacity;
      burstFiredDuration = 0;
      continue;
    }

    // Check burst cooldown duration limit
    if (burstFiredDuration >= fireDurationLimit) {
      totalTime += burstCooldown;
      burstFiredDuration = 0;
      continue;
    }

    // Fire
    shotsFired++;
    ammoInMag -= weapon.ammoPerShot;
    totalAmmoConsumed += weapon.ammoPerShot;
    burstFiredDuration += timePerShot;

    // Apply damage
    const dmg = calculateDamageAgainstCreature(
      weapon.damageType,
      weapon.dpp,
      currentArmor,
      creature.armorClass,
      creature.energyResistance
    );

    // Expected damage after misses from imperfect tracking
    let effectiveHpDamage = dmg.hpDamage * tracking;
    let effectiveArmorDamage = dmg.armorDamage * tracking;

    // Swarm damage cap: a single hit cannot exceed the total pool of the entities actually caught
    if (isSwarm) {
      const maxHpHitCap = singleEntityHp * swarmHitCount;
      const maxArmorHitCap = singleEntityArmor * swarmHitCount;

      effectiveHpDamage = Math.min(effectiveHpDamage, maxHpHitCap);
      effectiveArmorDamage = Math.min(effectiveArmorDamage, maxArmorHitCap);
    }

    currentArmor = Math.max(0, currentArmor - effectiveArmorDamage);
    currentHp = Math.max(0, currentHp - effectiveHpDamage);

    if (currentHp <= 0) {
      // Finished
      break;
    }

    totalTime += timePerShot;
  }

  const rawDps = weapon.dpp * weapon.fireRate;
  const effectiveDps = totalTime > 0 ? (totalHpToKill + totalArmorToDeplete) / totalTime : 0;
  const penetrationRatio = rawDps > 0 ? Math.min(1.0, effectiveDps / rawDps) : 0;

  // Theoretical pure TTK (static benchmark)
  const theoreticalTtk = Number(totalTime.toFixed(1));

  // Behavior Exposure calculation
  const exposure = calculateBehaviorExposure(weapon, creature);
  const behaviorTtk = Number((theoreticalTtk / exposure.behaviorExposureRatio).toFixed(1));

  const displayTtk = mode === 'simulated' ? behaviorTtk : theoreticalTtk;

  // For AOE weapons, tracking penalty is mitigated by the blast radius EXCEPT against ultra-fast agile flyers (speed > 350)
  // where mortar ballistic flight delay prevents leading the target
  const effectiveTracking = (weapon.aoe && weapon.aoe >= 40)
    ? (creature.movementSpeed && creature.movementSpeed > 350 ? tracking : Math.min(1.0, tracking * 1.6))
    : tracking;

  // Determine efficiency rating matching user-specified design:
  // - High-speed flyers: Gatling EFFICIENT, Photon SEMI-EFFICIENT, Grenade INEFFICIENT
  // - Heavy Armor AC 15: Photon EFFICIENT, Grenade SEMI-EFFICIENT, Gatling INEFFICIENT
  // - Swarms: Gatling & Grenade EFFICIENT, Photon INEFFICIENT
  // - Energy Shield: Grenade EFFICIENT, Gatling SEMI-EFFICIENT, Photon INEFFICIENT
  const effCutoff = thresholds ? thresholds.efficient : (mode === 'simulated' ? 60.0 : 20.0);
  const ineffCutoff = thresholds ? thresholds.inefficient : (mode === 'simulated' ? 120.0 : 45.0);

  let efficiencyRating: 'EFFICIENT' | 'SEMI_EFFICIENT' | 'INEFFICIENT' = 'SEMI_EFFICIENT';

  const isOptimal = displayTtk <= effCutoff &&
    penetrationRatio >= 0.15 &&
    effectiveTracking >= 0.40;

  const isInefficient =
    effectiveTracking <= 0.25 ||
    displayTtk > ineffCutoff ||
    penetrationRatio < 0.08 ||
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
  thresholds?: TTKThresholds
): TTKResult[][] {
  return weapons.map((w) => creatures.map((c) => calculateAnalyticalTTK(w, c, mode, thresholds)));
}
