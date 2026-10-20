import {
  BehemothState,
  CreatureRuntimeInstance,
  CreatureDef,
  WeaponDef,
  WeaponSlot,
  Projectile,
  BuildingSlot,
  CrewMemberAgent,
  CrewPdwShot,
  CrewStance,
  CrewSimulationConfig,
} from '../types/combat';
import { calculateDamageAgainstCreature, updateVesselTilt, calculateRamImpulse, distance, angleBetween, isWithinArc, clampAngleToArc } from './math';
import { updateCreatureAI } from './creatureAI';
import { DEFAULT_BUILDINGS, DEFAULT_CREW_CONFIG } from '../data/presets';
import { syncCrewAgents, tickCrewSimulation } from './crew';

/** Damage points that kill one crew member */
export const CREW_HP = 20;
export const DEFAULT_CREW = 50;
import { CreatureBehaviorTree, BehaviorRuntimeState } from '../types/behavior';
import { tickCreatureBehavior, createInitialBehaviorRuntimeState } from './behaviorRunner';
import { DEFAULT_BEHAVIOR_TEMPLATES } from '../data/behaviorTemplates';

export interface CombatStatsSummary {
  totalDamageDealtToCreatures: number;
  totalDamageTakenByBehemoth: number;
  totalAmmoConsumed: { [key: string]: number };
  peakPowerDraw: number;
  rammingEventsCount: number;
  criticalTiltsCount: number;
  crewLost: number;
  buildingsDestroyed: number;
  crewSnatched?: number;
  crewSaved?: number;
}

export class SimulationEngine {
  behemoth: BehemothState;
  creatures: CreatureRuntimeInstance[];
  projectiles: Projectile[];
  crewAgents: CrewMemberAgent[] = [];
  pdwShots: CrewPdwShot[] = [];
  weaponDefs: Map<string, WeaponDef>;
  creatureDefs: Map<string, CreatureDef>;
  behaviorTrees: Map<string, CreatureBehaviorTree> = new Map();
  behaviorRuntimeStates: Map<string, BehaviorRuntimeState> = new Map();

  // World bounds and vessel geometry
  worldWidth: number = 1000;
  worldHeight: number = 700;
  vesselCenter: { x: number; y: number; width: number; height: number } = {
    x: 500,
    y: 350,
    width: 260,
    height: 90,
  };

  // Stats tracker
  stats: CombatStatsSummary = {
    totalDamageDealtToCreatures: 0,
    totalDamageTakenByBehemoth: 0,
    totalAmmoConsumed: {},
    peakPowerDraw: 0,
    rammingEventsCount: 0,
    criticalTiltsCount: 0,
    crewLost: 0,
    buildingsDestroyed: 0,
  };

  logMessages: Array<{ id: string; time: number; text: string; type: 'info' | 'warn' | 'danger' | 'success' }> = [];
  timeElapsed: number = 0;

  // Benchmark calibration mode (matches analytical TTK matrix exactly)
  benchmarkMode: boolean = false;
  benchmarkSingleMount: boolean = true;
  benchmarkFirstHitTime: number | null = null;
  benchmarkMeasuredTtk: number | null = null;
  benchmarkIsActive: boolean = false;
  benchmarkTargetDefId: string = 'dreadlot';

  constructor(weapons: WeaponDef[], creatures: CreatureDef[]) {
    this.weaponDefs = new Map(weapons.map((w) => [w.id, w]));
    this.creatureDefs = new Map(creatures.map((c) => [c.id, c]));

    // Initialize Behemoth Slots (2 rows: 4 port, 4 starboard = 8 slots)
    const slots: WeaponSlot[] = [];
    const initialWeapons = [weapons[0], weapons[1], weapons[2], weapons[3]];

    for (let i = 0; i < 4; i++) {
      const w = initialWeapons[i % initialWeapons.length] || null;
      slots.push({
        id: `port_${i}`,
        slotIndex: i,
        row: 'port',
        positionX: (i + 0.6) / 4.8,
        weapon: w ? { ...w } : null,
        currentAmmo: w ? w.ammoCapacity : 0,
        isReloading: false,
        reloadProgress: 0,
        cooldownRemaining: 0,
        currentAimAngle: 270, // Aim up (north)
        rotationCap: w ? (w.rotationCap ?? 225) : 225,
        isFiring: false,
        burstRemaining: 0,
        isCoolingDown: false,
        cooldownDurationRemaining: 0,
        currentFireDuration: 0,
        isStunned: false,
        stunTimer: 0,
        health: 250,
        maxHealth: 250,
        powerDrawActive: true,
      });
    }

    for (let i = 0; i < 4; i++) {
      const w = initialWeapons[(i + 1) % initialWeapons.length] || null;
      slots.push({
        id: `starboard_${i}`,
        slotIndex: i,
        row: 'starboard',
        positionX: (i + 0.6) / 4.8,
        weapon: w ? { ...w } : null,
        currentAmmo: w ? w.ammoCapacity : 0,
        isReloading: false,
        reloadProgress: 0,
        cooldownRemaining: 0,
        currentAimAngle: 90, // Aim down (south)
        rotationCap: w ? (w.rotationCap ?? 225) : 225,
        isFiring: false,
        burstRemaining: 0,
        isCoolingDown: false,
        cooldownDurationRemaining: 0,
        currentFireDuration: 0,
        isStunned: false,
        stunTimer: 0,
        health: 250,
        maxHealth: 250,
        powerDrawActive: true,
      });
    }

    // Two miscellaneous building rows (4 slots each)
    const buildingSlots: BuildingSlot[] = [];
    const defaultLayout = [
      'basic_living_quarters',
      'fuel_generator',
      'medbay',
      'base_material_workshop',
      'biochem_plant',
      'consumer_factory',
      'academy',
      'social_dome'
    ];
    (['misc_a', 'misc_b'] as const).forEach((row, r) => {
      for (let i = 0; i < 4; i++) {
        const def = DEFAULT_BUILDINGS.find((b) => b.id === defaultLayout[r * 4 + i]) || null;
        buildingSlots.push({
          id: `${row}_${i}`,
          slotIndex: i,
          row,
          building: def,
          health: def ? def.maxHealth : 0,
          maxHealth: def ? def.maxHealth : 0,
          isStunned: false,
          stunTimer: 0,
          isOffline: false,
          assignedCrew: def ? (def.requiredCrew ?? 1) : 0,
        });
      }
    });

    this.behemoth = {
      maxHullHp: 8000,
      hullHp: 8000,
      hullArmor: 2500,
      tiltAngle: 0,
      tiltVelocity: 0,
      maxTiltSafe: 35.0,
      isCapsized: false,
      totalPowerCapacity: 1200,
      accumulatorCharge: 100,
      accumulatorOverloaded: false,
      slots,
      buildingSlots,
      crew: DEFAULT_CREW,
      maxCrew: DEFAULT_CREW,
      crewMemberHp: CREW_HP,
      crewStance: 'neutral',
      crewConfig: { ...DEFAULT_CREW_CONFIG },
    };

    // Load default behavior templates for creatures
    for (const [id, tree] of Object.entries(DEFAULT_BEHAVIOR_TEMPLATES)) {
      this.behaviorTrees.set(id, tree);
    }

    this.creatures = [];
    this.projectiles = [];
    this.pdwShots = [];
    this.crewAgents = syncCrewAgents(
      [],
      this.behemoth.crew,
      this.behemoth.crewMemberHp,
      this.vesselCenter,
      this.behemoth.buildingSlots
    );
  }

  spawnCreature(defId: string, replaceExisting: boolean = true, customPosition?: { x: number; y: number }) {
    const def = this.creatureDefs.get(defId);
    if (!def) return;

    if (replaceExisting) {
      this.creatures = [];
      this.projectiles = [];
    }

    // Spawn around outer perimeter
    const spawnAngle = Math.random() * Math.PI * 2;
    const spawnDist = 420 + Math.random() * 80;
    const spawnX = customPosition ? customPosition.x : this.vesselCenter.x + Math.cos(spawnAngle) * spawnDist;
    const spawnY = customPosition ? customPosition.y : this.vesselCenter.y + Math.sin(spawnAngle) * spawnDist;

    const isSwarm = def.quantity > 1;
    const swarmEntities = [];
    if (isSwarm) {
      const ringSpacing = Math.min(10, 85 / Math.sqrt(Math.max(1, def.quantity)));
      const goldenAngle = 2.39996;
      for (let i = 0; i < def.quantity; i++) {
        const radius = 12 + Math.sqrt(i) * ringSpacing;
        const subAngle = i * goldenAngle;
        swarmEntities.push({
          x: spawnX + Math.cos(subAngle) * radius,
          y: spawnY + Math.sin(subAngle) * radius,
          hp: def.hp,
          maxHp: def.hp,
        });
      }
    }

    const isFlying = def.isFlying ?? (def.locomotionType === 'flying') ?? false;

    const instance: CreatureRuntimeInstance = {
      id: `creature_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      defId: def.id,
      name: def.name,
      x: spawnX,
      y: spawnY,
      vx: 0,
      vy: 0,
      angle: (angleBetween(spawnX, spawnY, this.vesselCenter.x, this.vesselCenter.y) + 180) % 360,
      targetSlotId: null,
      hp: isSwarm ? def.hp * def.quantity : def.hp,
      maxHp: isSwarm ? def.hp * def.quantity : def.hp,
      physicalArmor: isSwarm ? def.physicalArmor * def.quantity : def.physicalArmor,
      maxPhysicalArmor: isSwarm ? def.physicalArmor * def.quantity : def.physicalArmor,
      armorClass: def.armorClass,
      energyResistance: def.energyResistance,
      quantity: def.quantity,
      stage: 'Underwater',
      stageTimer: 0,
      aggression: 80,
      underwater: isFlying ? false : true,
      depthRatio: isFlying ? 0.0 : 1.0,
      stunned: false,
      stunTimer: 0,
      isSwarm,
      swarmEntities,
      color: def.iconColor,
      radius: def.radius,
      isFlying,
      locomotionType: isFlying ? 'flying' : 'non-flying',
    };

    this.creatures.push(instance);
    const tree = this.behaviorTrees.get(def.id);
    if (tree) {
      this.behaviorRuntimeStates.set(instance.id, createInitialBehaviorRuntimeState(tree));
    }
    this.addLog(`Creature detected: ${def.name} approached sonar field!`, 'info');
  }

  addLog(text: string, type: 'info' | 'warn' | 'danger' | 'success' = 'info') {
    this.logMessages.unshift({
      id: Math.random().toString(36),
      time: Number(this.timeElapsed.toFixed(1)),
      text,
      type,
    });
    if (this.logMessages.length > 50) this.logMessages.pop();
  }

  setBenchmarkMode(enabled: boolean) {
    this.benchmarkMode = enabled;
    this.benchmarkFirstHitTime = null;
    this.benchmarkMeasuredTtk = null;
    this.benchmarkIsActive = false;
    if (enabled) {
      this.resetBenchmarkTarget();
    }
  }

  setBenchmarkSingleMount(singleMount: boolean) {
    this.benchmarkSingleMount = singleMount;
    this.benchmarkFirstHitTime = null;
    this.benchmarkMeasuredTtk = null;
    this.benchmarkIsActive = false;
  }

  setBenchmarkTarget(defId: string) {
    this.benchmarkTargetDefId = defId;
    this.resetBenchmarkTarget();
  }

  getBenchmarkTargetPosition(): { x: number; y: number } {
    if (this.benchmarkSingleMount) {
      const activeSlot = this.behemoth.slots.find((s) => s.weapon && s.weapon.id) || this.behemoth.slots[0];
      const slotWorldX = this.vesselCenter.x - this.vesselCenter.width / 2 + activeSlot.positionX * this.vesselCenter.width;
      const slotWorldY = activeSlot.row === 'port' ? this.vesselCenter.y - this.vesselCenter.height / 2 : this.vesselCenter.y + this.vesselCenter.height / 2;
      const defaultFacing = activeSlot.row === 'port' ? 270 : 90;
      const rad = (defaultFacing * Math.PI) / 180;
      return {
        x: slotWorldX + Math.cos(rad) * 300,
        y: slotWorldY + Math.sin(rad) * 300,
      };
    }
    return {
      x: this.vesselCenter.x + 300,
      y: this.vesselCenter.y,
    };
  }

  resetBenchmarkTarget() {
    this.benchmarkFirstHitTime = null;
    this.benchmarkMeasuredTtk = null;
    this.benchmarkIsActive = false;
    const defId = this.benchmarkTargetDefId || (this.creatures[0]?.defId ?? 'dreadlot');
    const pos = this.getBenchmarkTargetPosition();
    this.spawnCreature(defId, true, pos);
    if (this.creatures[0]) {
      this.creatures[0].underwater = false;
      this.creatures[0].depthRatio = 0.0;
    }
    for (const slot of this.behemoth.slots) {
      if (slot.weapon) {
        slot.currentAmmo = slot.weapon.ammoCapacity;
        slot.isReloading = false;
        slot.cooldownRemaining = 0;
        slot.isCoolingDown = false;
        slot.currentFireDuration = 0;
      }
    }
    this.addLog(`[BENCHMARK] Target reset at 300px calibration point. Standing by for first hit!`, 'info');
  }

  setSlotRotationCap(slotId: string, cap: number) {
    const slot = this.behemoth.slots.find((s) => s.id === slotId);
    if (slot) {
      slot.rotationCap = Math.max(30, Math.min(360, cap));
      const defaultFacing = slot.row === 'port' ? 270 : 90;
      slot.currentAimAngle = clampAngleToArc(slot.currentAimAngle, defaultFacing, slot.rotationCap);
    }
  }

  setAllSlotsRotationCap(cap: number) {
    const clamped = Math.max(30, Math.min(360, cap));
    for (const slot of this.behemoth.slots) {
      slot.rotationCap = clamped;
      if (slot.weapon) {
        slot.weapon.rotationCap = clamped;
      }
      const defaultFacing = slot.row === 'port' ? 270 : 90;
      slot.currentAimAngle = clampAngleToArc(slot.currentAimAngle, defaultFacing, clamped);
    }
  }

  tick(dt: number) {
    this.timeElapsed += dt;

    // 1. Vessel Tilt physics recovery
    const tiltUpdate = updateVesselTilt(this.behemoth.tiltAngle, this.behemoth.tiltVelocity, dt);
    this.behemoth.tiltAngle = tiltUpdate.tiltAngle;
    this.behemoth.tiltVelocity = tiltUpdate.tiltVelocity;
    this.behemoth.isCapsized = tiltUpdate.capsized;

    if (this.behemoth.isCapsized) {
      this.stats.criticalTiltsCount++;
      this.addLog(`CRITICAL ALARM: Behemoth listing past 35° (${this.behemoth.tiltAngle.toFixed(1)}°)! Capsizing risk!`, 'danger');
    }

    // 2. Track power grid draw
    let currentPowerDraw = 0;
    for (const slot of this.behemoth.slots) {
      if (slot.weapon && slot.health > 0 && slot.powerDrawActive && !slot.isStunned) {
        currentPowerDraw += slot.weapon.powerDraw;
      }
    }
    if (currentPowerDraw > this.stats.peakPowerDraw) {
      this.stats.peakPowerDraw = currentPowerDraw;
    }

    // Enforce assigned crew cap does not exceed total living crew
    this.enforceCrewCap();

    // Misc buildings: stun countdown, restart conditions, and power draw
    for (const b of this.behemoth.buildingSlots) {
      if (!b.building || b.health <= 0) continue;
      const isUnmanned = (b.building.requiredCrew ?? 1) > (b.assignedCrew || 0);

      if (b.isStunned) {
        b.stunTimer -= dt;
        if (b.stunTimer <= 0) {
          b.isStunned = false;
          b.stunTimer = 0;
          b.isOffline = true; // must try to turn back on
        }
      }
      if (!b.isStunned && b.isOffline) {
        // Restart needs assigned crew and available energy for consumers
        const needsPower = b.building.powerDraw > 0;
        if (!isUnmanned && (!needsPower || !this.behemoth.accumulatorOverloaded)) {
          b.isOffline = false;
        }
      }
      if (!b.isStunned && !b.isOffline && !isUnmanned) currentPowerDraw += b.building.powerDraw;
    }

    // Accumulator recharge or drain (intact generators add capacity if manned)
    const powerCapacity = this.behemoth.totalPowerCapacity + this.behemoth.buildingSlots.reduce(
      (sum, b) => {
        const isUnmanned = !!b.building && (b.building.requiredCrew ?? 1) > (b.assignedCrew || 0);
        return sum + (b.building && b.health > 0 && !b.isStunned && !b.isOffline && !isUnmanned ? b.building.powerBonus : 0);
      }, 0);
    if (currentPowerDraw > powerCapacity) {
      this.behemoth.accumulatorCharge = Math.max(0, this.behemoth.accumulatorCharge - dt * 5);
      if (this.behemoth.accumulatorCharge <= 0) {
        this.behemoth.accumulatorOverloaded = true;
      }
    } else {
      this.behemoth.accumulatorCharge = Math.min(100, this.behemoth.accumulatorCharge + dt * 2.5);
      if (this.behemoth.accumulatorCharge >= 40) {
        this.behemoth.accumulatorOverloaded = false;
      }
    }

    // 3. Update Weapons, Reload, Cooldowns, and Firing Loop
    for (const slot of this.behemoth.slots) {
      if (!slot.weapon || slot.health <= 0) continue;

      // Handle Stun
      if (slot.isStunned) {
        slot.stunTimer -= dt;
        if (slot.stunTimer <= 0) {
          slot.isStunned = false;
        }
        continue;
      }

      // Handle Reload
      if (slot.isReloading) {
        slot.reloadProgress += dt / slot.weapon.reloadTime;
        if (slot.reloadProgress >= 1.0) {
          slot.currentAmmo = slot.weapon.ammoCapacity;
          slot.isReloading = false;
          slot.reloadProgress = 0;
          slot.totalPacksLoaded = (slot.totalPacksLoaded || 0) + 1;
          this.addLog(`[RECHARGE] Mount ${slot.id.toUpperCase()} (${slot.weapon.name}): Loaded ${slot.weapon.packName || `${slot.weapon.ammoCapacity} charges`}. Ready to fire!`, 'info');
        }
        continue;
      }

      // Handle Cooldown Duration (Burst Cooldown)
      if (slot.isCoolingDown) {
        slot.cooldownDurationRemaining -= dt;
        if (slot.cooldownDurationRemaining <= 0) {
          slot.isCoolingDown = false;
          slot.cooldownDurationRemaining = 0;
          slot.currentFireDuration = 0;
          this.addLog(`[READY] Mount ${slot.id.toUpperCase()} (${slot.weapon.name}): Heat vented & cooldown complete. Ready to fire!`, 'info');
        } else {
          slot.isFiring = false;
          continue;
        }
      }

      // Handle individual projectile interval delay
      if (slot.cooldownRemaining > 0) {
        slot.cooldownRemaining -= dt;
      }

      // If in benchmark mode and single mount is active, only the primary active mount fires
      if (this.benchmarkMode && this.benchmarkSingleMount) {
        const activeSlot = this.behemoth.slots.find((s) => s.weapon && s.weapon.id) || this.behemoth.slots[0];
        if (slot.id !== activeSlot.id) {
          slot.isFiring = false;
          continue;
        }
      }

      // Find best target for this slot
      const slotWorldX = this.vesselCenter.x - this.vesselCenter.width / 2 + slot.positionX * this.vesselCenter.width;
      const slotWorldY = slot.row === 'port' ? this.vesselCenter.y - this.vesselCenter.height / 2 : this.vesselCenter.y + this.vesselCenter.height / 2;
      const defaultFacing = slot.row === 'port' ? 270 : 90;
      const rotationCap = slot.rotationCap ?? slot.weapon.rotationCap ?? 225;
      const effectiveArc = Math.min(slot.weapon.shootingArc, rotationCap);

      let closestTarget: CreatureRuntimeInstance | null = null;
      let minDistance = Infinity;

      for (const creature of this.creatures) {
        if (creature.hp <= 0 || creature.underwater) continue; // submerged = untargetable
        const d = distance(slotWorldX, slotWorldY, creature.x, creature.y);
        const ang = angleBetween(slotWorldX, slotWorldY, creature.x, creature.y);

        // Check weapon range & shooting arc (capped by rotationCap to protect deck)
        if (d <= slot.weapon.range && isWithinArc(ang, defaultFacing, effectiveArc)) {
          if (d < minDistance) {
            minDistance = d;
            closestTarget = creature;
          }
        }
      }

      if (closestTarget) {
        let aimTargetX = closestTarget.x;
        let aimTargetY = closestTarget.y;
        let targetVx = closestTarget.vx || 0;
        let targetVy = closestTarget.vy || 0;

        if (closestTarget.isSwarm && closestTarget.swarmEntities) {
          // Point defense weapons track the closest active living swarm entity
          let bestEntDist = Infinity;
          for (const ent of closestTarget.swarmEntities) {
            if (ent.hp <= 0) continue;
            const ed = distance(slotWorldX, slotWorldY, ent.x, ent.y);
            if (ed < bestEntDist) {
              bestEntDist = ed;
              aimTargetX = ent.x;
              aimTargetY = ent.y;
              targetVx = ent.vx || 0;
              targetVy = ent.vy || 0;
            }
          }
        }

        // Linear Lead Interception: calculate projectile flight time and lead the moving target
        const distToTarget = distance(slotWorldX, slotWorldY, aimTargetX, aimTargetY);
        let flightTime = 0;
        if (slot.weapon.trajectory === 'Arch') {
          const pSpeed = slot.weapon.projectileSpeed > 0 ? slot.weapon.projectileSpeed : 420;
          flightTime = Math.max(0.35, distToTarget / pSpeed);
        } else if (slot.weapon.projectileSpeed > 0 && slot.weapon.damageType !== 'Energy') {
          flightTime = distToTarget / slot.weapon.projectileSpeed;
        }

        // Apply calculated lead position
        const leadTargetX = aimTargetX + targetVx * flightTime;
        const leadTargetY = aimTargetY + targetVy * flightTime;

        // Rotate toward the predicted lead target, clamped strictly within rotationCap to protect the deck
        const rawAimAngle = angleBetween(slotWorldX, slotWorldY, leadTargetX, leadTargetY);
        const clampedAimTarget = clampAngleToArc(rawAimAngle, defaultFacing, rotationCap);
        let aimDiff = ((clampedAimTarget - slot.currentAimAngle + 540) % 360) - 180;
        const maxTurn = (slot.weapon.turnSpeed ?? 120) * dt;
        const turnStep = Math.max(-maxTurn, Math.min(maxTurn, aimDiff));
        slot.currentAimAngle = clampAngleToArc(slot.currentAimAngle + turnStep, defaultFacing, rotationCap);

        // Turret Boresight Gate: only fire when weapon barrel is on target within tolerance,
        // and lead target is within the allowable rotation arc
        const remainingAngleError = Math.abs(((rawAimAngle - slot.currentAimAngle + 540) % 360) - 180);
        const isTargetInArc = isWithinArc(rawAimAngle, defaultFacing, effectiveArc);
        const boresightTolerance = Math.max(8, (slot.weapon.coneRadius || 12) * 0.85);
        const isOnTarget = isTargetInArc && remainingAngleError <= boresightTolerance;

        // Fire if on-target, cooldown ready, not cooling down from burst, and has ammo
        if (isOnTarget && slot.cooldownRemaining <= 0 && slot.currentAmmo >= slot.weapon.ammoPerShot && !this.behemoth.accumulatorOverloaded) {
          // If creature is submerged, only chemical clouds or energy penetration deals full impact; physical has penalty
          this.fireWeapon(slot, slotWorldX, slotWorldY, closestTarget, leadTargetX, leadTargetY);
          slot.currentAmmo -= slot.weapon.ammoPerShot;
          slot.totalChargesUsed = (slot.totalChargesUsed || 0) + slot.weapon.ammoPerShot;
          slot.cooldownRemaining = slot.weapon.fireRate > 0 ? 1 / slot.weapon.fireRate : slot.weapon.cooldown;
          slot.isFiring = true;

          // Track fire duration progress
          const shotInterval = slot.weapon.fireRate > 0 ? 1 / slot.weapon.fireRate : 0.1;
          slot.currentFireDuration += shotInterval;

          // Check if weapon has reached fireDuration limit
          const maxFireDuration = slot.weapon.fireDuration || 3.0;
          if (slot.currentFireDuration >= maxFireDuration) {
            slot.isCoolingDown = true;
            slot.cooldownDurationRemaining = slot.weapon.cooldownDuration || 2.0;
            slot.currentFireDuration = 0;
            slot.isFiring = false;
            this.addLog(`[COOLDOWN] Mount ${slot.id.toUpperCase()} (${slot.weapon.name}): Burst ceiling reached -> Cooling down (${slot.weapon.cooldownDuration}s recharge)`, 'warn');
          }

          // Track ammo consumption stats
          const ammoType = slot.weapon.ammoType;
          this.stats.totalAmmoConsumed[ammoType] = (this.stats.totalAmmoConsumed[ammoType] || 0) + slot.weapon.ammoPerShot;

          if (slot.currentAmmo < slot.weapon.ammoPerShot) {
            slot.isReloading = true;
            slot.reloadProgress = 0;
            this.addLog(`[RECHARGE] Mount ${slot.id.toUpperCase()} (${slot.weapon.name}): Charges depleted -> Recharging / Loading ${slot.weapon.packName || slot.weapon.ammoType} (${slot.weapon.reloadTime}s)`, 'warn');
          }
        } else {
          slot.isFiring = false;
        }
      } else {
        slot.isFiring = false;
        // Keep idle turrets clamped to their outward traverse sector
        slot.currentAimAngle = clampAngleToArc(slot.currentAimAngle, defaultFacing, rotationCap);
      }
    }

    // 4. Update Projectiles & Trajectories
    const activeProjectiles: Projectile[] = [];

    for (const p of this.projectiles) {
      if (p.isBeam) {
        // Continuous beam
        p.beamLifetime = (p.beamLifetime || 0) + dt;
        if (p.beamLifetime < p.duration) {
          activeProjectiles.push(p);
          // Apply tick damage to nearby creatures
          for (const creature of this.creatures) {
            if (creature.hp <= 0 || creature.underwater) continue;
            let hit = false;
            let hitX = p.targetX;
            let hitY = p.targetY;

            if (creature.isSwarm && creature.swarmEntities) {
              for (const ent of creature.swarmEntities) {
                if (ent.hp <= 0) continue;
                const d = distance(p.targetX, p.targetY, ent.x, ent.y);
                if (d <= p.aoe + (ent.radius || 12)) {
                  hit = true;
                  hitX = ent.x;
                  hitY = ent.y;
                  break;
                }
              }
            } else {
              const d = distance(p.targetX, p.targetY, creature.x, creature.y);
              if (d <= p.aoe + creature.radius) {
                hit = true;
                hitX = creature.x;
                hitY = creature.y;
              }
            }

            if (hit) {
              const tickDamage = (p.dpp * dt * 3.5);
              this.applyDamageToCreature(creature, p.damageType, tickDamage, p.pushback * dt * 0.1, hitX, hitY, p.aoe, p.aoe >= 40);
            }
          }
        }
        continue;
      }

      if (p.isExplosion) {
        p.explosionLifetime = (p.explosionLifetime || 0.35) - dt;
        if (p.explosionLifetime > 0) {
          activeProjectiles.push(p);
        }
        continue;
      }

      if (p.isCloud) {
        // Chemical Lingering Cloud
        p.cloudDuration = (p.cloudDuration || 0) + dt;
        if (p.cloudDuration < (p.cloudMaxDuration || 4.0)) {
          activeProjectiles.push(p);
          // Acid cloud ticks
          for (const creature of this.creatures) {
            if (creature.hp <= 0 || creature.underwater) continue;
            const cloudRad = p.cloudRadius || 80;
            let hit = false;
            let hitX = p.x;
            let hitY = p.y;

            if (creature.isSwarm && creature.swarmEntities) {
              for (const ent of creature.swarmEntities) {
                if (ent.hp <= 0) continue;
                const d = distance(p.x, p.y, ent.x, ent.y);
                if (d <= cloudRad + (ent.radius || 12)) {
                  hit = true;
                  hitX = ent.x;
                  hitY = ent.y;
                  break;
                }
              }
            } else {
              const d = distance(p.x, p.y, creature.x, creature.y);
              if (d <= cloudRad + creature.radius) {
                hit = true;
                hitX = creature.x;
                hitY = creature.y;
              }
            }

            if (hit) {
              const cloudDmg = p.dpp * dt * 1.8;
              this.applyDamageToCreature(creature, 'Chemical', cloudDmg, 0, hitX, hitY, cloudRad, true);
            }
          }
        }
        continue;
      }

      // Standard Ballistic / Line projectile flight
      if (p.trajectory === 'Line') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        let hit = false;
        for (const creature of this.creatures) {
          if (creature.hp <= 0 || creature.underwater) continue;

          if (creature.isSwarm && creature.swarmEntities) {
            // Check collision against each active individual swarm bat
            for (const ent of creature.swarmEntities) {
              if (ent.hp <= 0) continue;
              const d = distance(p.x, p.y, ent.x, ent.y);
              const hitRadius = Math.max(14, (ent.radius || 8) + p.aoe / 2);
              if (d <= hitRadius) {
                hit = true;
                this.applyDamageToCreature(creature, p.damageType, p.dpp, p.pushback, ent.x, ent.y, p.aoe, p.aoe >= 40);
                break;
              }
            }
            if (hit) break;
          } else {
            // Monolithic creature
            const d = distance(p.x, p.y, creature.x, creature.y);
            if (d <= creature.radius + p.aoe / 2) {
              hit = true;
              this.applyDamageToCreature(creature, p.damageType, p.dpp, p.pushback, p.x, p.y, p.aoe, p.aoe >= 40);
              break;
            }
          }
        }

        // Out of world bounds
        if (!hit && p.x >= 0 && p.x <= this.worldWidth && p.y >= 0 && p.y <= this.worldHeight) {
          activeProjectiles.push(p);
        }
      } else if (p.trajectory === 'Arch') {
        const flightDuration = Math.max(0.25, p.flightDuration || 0.8);
        p.arcProgress += dt / flightDuration;
        p.x = p.sourceX + (p.targetX - p.sourceX) * p.arcProgress;
        p.y = p.sourceY + (p.targetY - p.sourceY) * p.arcProgress;

        if (p.arcProgress >= 1.0) {
          // Mortar shell impact & detonation!
          // 1. Direct high-explosive concussive blast within AoE radius
          const blastRadius = p.aoe || 85;
          for (const creature of this.creatures) {
            if (creature.hp <= 0) continue;
            if (creature.isSwarm && creature.swarmEntities) {
              for (const ent of creature.swarmEntities) {
                if (ent.hp <= 0) continue;
                const d = distance(p.targetX, p.targetY, ent.x, ent.y);
                if (d <= (ent.radius || 6) + blastRadius) {
                  this.applyDamageToCreature(creature, p.damageType, p.dpp, p.pushback, p.targetX, p.targetY, p.aoe, true);
                  break;
                }
              }
            } else {
              const d = distance(p.targetX, p.targetY, creature.x, creature.y);
              // Concussive shockwave reaches targets within blast radius (including submerged targets like Aetherfin!)
              if (d <= creature.radius + blastRadius) {
                this.applyDamageToCreature(creature, p.damageType, p.dpp, p.pushback, p.targetX, p.targetY, p.aoe, true);
                this.addLog(`CONCUSSIVE BLAST: Mortar shell struck ${creature.name} for ${Math.round(p.dpp)} DMG!`, 'danger');
              }
            }
          }

          // Visual explosion shockwave
          activeProjectiles.push({
            id: `exp_${Date.now()}_${Math.random()}`,
            sourceSlotId: p.sourceSlotId,
            sourceX: p.targetX,
            sourceY: p.targetY,
            x: p.targetX,
            y: p.targetY,
            targetX: p.targetX,
            targetY: p.targetY,
            vx: 0,
            vy: 0,
            damageType: p.damageType,
            dpp: 0,
            pushback: 0,
            aoe: p.aoe,
            trajectory: 'Arch',
            arcProgress: 1,
            arcHeight: 0,
            color: p.color || '#ef4444',
            createdTime: this.timeElapsed,
            duration: 0.35,
            isExplosion: true,
            explosionRadius: p.aoe,
            explosionLifetime: 0.35,
          });

          // If Chemical damage type, also spawn lingering acid cloud
          if (p.damageType === 'Chemical') {
            activeProjectiles.push({
              id: `cloud_${Date.now()}_${Math.random()}`,
              sourceSlotId: p.sourceSlotId,
              sourceX: p.targetX,
              sourceY: p.targetY,
              x: p.targetX,
              y: p.targetY,
              targetX: p.targetX,
              targetY: p.targetY,
              vx: 0,
              vy: 0,
              damageType: 'Chemical',
              dpp: p.dpp,
              pushback: 0,
              aoe: p.aoe,
              trajectory: 'Arch',
              arcProgress: 1,
              arcHeight: 0,
              color: '#10b981',
              createdTime: this.timeElapsed,
              duration: p.duration,
              isCloud: true,
              cloudRadius: p.aoe,
              cloudDuration: 0,
              cloudMaxDuration: p.duration,
            });
          }
        } else {
          activeProjectiles.push(p);
        }
      }
    }

    this.projectiles = activeProjectiles;

    // 5. Update Creatures AI & Physics
    for (const creature of this.creatures) {
      if (creature.hp <= 0) continue;
      const def = this.creatureDefs.get(creature.defId);
      if (!def) continue;

      let updated: CreatureRuntimeInstance;
      let events: any[] = [];

      // Run through behavior tree
      const tree = this.behaviorTrees.get(creature.defId);
      if (tree) {
        let runtimeState = this.behaviorRuntimeStates.get(creature.id);
        if (!runtimeState) {
          runtimeState = createInitialBehaviorRuntimeState(tree);
        }
        const prevNodeId = runtimeState.activeNodeId;
        const res = tickCreatureBehavior(
          creature,
          def,
          tree,
          runtimeState,
          this.vesselCenter,
          this.behemoth.slots,
          dt,
          this.timeElapsed,
          this.behemoth.buildingSlots
        );
        updated = res.creature;
        events = res.events;
        this.behaviorRuntimeStates.set(creature.id, res.runtimeState);

        // Action transition log
        if (res.runtimeState.activeNodeId !== prevNodeId) {
          const activeNode = tree.nodes.find((n) => n.id === res.runtimeState.activeNodeId);
          if (activeNode) {
            this.addLog(`[ACTION] ${creature.name}: ${activeNode.name}`, 'info');
          }
        }
      } else {
        const res = updateCreatureAI(creature, def, this.vesselCenter, this.behemoth.slots, dt);
        updated = res.creature;
        events = res.events;
      }

      Object.assign(creature, updated);

      if (this.benchmarkMode) {
        const pos = this.getBenchmarkTargetPosition();
        creature.x = pos.x;
        creature.y = pos.y;
        creature.vx = 0;
        creature.vy = 0;
        creature.underwater = false;
        creature.depthRatio = 0.0;
        if (creature.isSwarm && creature.swarmEntities) {
          for (let i = 0; i < creature.swarmEntities.length; i++) {
            const ent = creature.swarmEntities[i];
            const col = (i % 4) - 1.5;
            const row = Math.floor(i / 4) - 1.5;
            ent.x = creature.x + col * 16;
            ent.y = creature.y + row * 16;
            ent.vx = 0;
            ent.vy = 0;
          }
        }
      }

      if (def.pursueStyle === 'orbit_drain' && creature.pursuePhase === 'attacking' && creature.drainArrived) {
        this.applyDrain(creature, def, dt);
      }

      for (const ev of events) {
        if (ev.type === 'SHORT_CIRCUIT_DRAIN') {
          this.applyDrain(creature, def, dt);
        } else if (ev.type === 'GROUP_STRIKE') {
          this.applyGroupStrike(creature, def, ev);
        } else if (ev.type === 'RAM_IMPACT' || ev.type === 'SHOOT_DECK') {
          this.applyStrike(creature, def, ev);
        }
      }
    }

    // Cleanup dead creatures
    this.creatures = this.creatures.filter((c) => {
      if (c.hp <= 0) {
        if (this.benchmarkMode && this.benchmarkFirstHitTime !== null && this.benchmarkMeasuredTtk === null) {
          this.benchmarkMeasuredTtk = Number((this.timeElapsed - this.benchmarkFirstHitTime).toFixed(1));
          this.benchmarkIsActive = false;
          this.addLog(`[BENCHMARK] Target neutralized! Live Measured TTK: ${this.benchmarkMeasuredTtk}s`, 'success');
        }
        this.addLog(`VICTORY: ${c.name} neutralized and sank into the abyss!`, 'success');
        return false;
      }
      return true;
    });

    // Tick and decay PDW shot tracers
    this.pdwShots = this.pdwShots.filter((shot) => {
      shot.lifetime -= dt;
      return shot.lifetime > 0;
    });

    // Synchronize crew agents with current living Behemoth crew count
    if (this.crewAgents.length !== this.behemoth.crew) {
      this.crewAgents = syncCrewAgents(
        this.crewAgents,
        this.behemoth.crew,
        this.behemoth.crewMemberHp || CREW_HP,
        this.vesselCenter,
        this.behemoth.buildingSlots
      );
    }

    // Tick Boids Flocking, Navigation, Alert Stance, and Creature Snatching
    const crewResult = tickCrewSimulation(
      this.crewAgents,
      this.behemoth,
      this.creatures,
      this.creatureDefs,
      this.vesselCenter,
      dt
    );

    this.crewAgents = crewResult.agents;
    if (crewResult.pdwShots.length > 0) {
      this.pdwShots.push(...crewResult.pdwShots);
    }

    if (crewResult.casualties > 0) {
      this.behemoth.crew = Math.max(0, this.behemoth.crew - crewResult.casualties);
      this.stats.crewLost = (this.stats.crewLost || 0) + crewResult.casualties;
      this.enforceCrewCap();
    }

    if (crewResult.snatchedCount > 0) {
      this.stats.crewSnatched = (this.stats.crewSnatched || 0) + crewResult.snatchedCount;
    }

    if (crewResult.savedCount > 0) {
      this.stats.crewSaved = (this.stats.crewSaved || 0) + crewResult.savedCount;
    }

    for (const log of crewResult.logs) {
      this.addLog(log.text, log.type);
    }
  }

  setCrewStance(stance: CrewStance) {
    this.behemoth.crewStance = stance;
    this.addLog(
      `[CREW ALERT] Stance updated: ${stance.toUpperCase()}`,
      stance === 'attack' ? 'warn' : stance === 'hide' ? 'info' : 'info'
    );
  }

  updateCrewConfig(partial: Partial<CrewSimulationConfig>) {
    this.behemoth.crewConfig = {
      ...this.behemoth.crewConfig,
      ...partial,
    };
  }

  /**
   * Aetherfin-style short circuit: drains N active buildings (weighted by energy) at X% max HP / s.
   * Buildings that become inactive are replaced; missing buildings are covered by Behemoth systems
   * (never the power unit). Each second one drained building may be stunned.
   */
  applyDrain(creature: CreatureRuntimeInstance, def: CreatureDef, dt: number) {
    const count = def.drainTargetCount ?? 4;
    const ratePct = (def.drainRatePct ?? 4) / 100;
    const divisor = Math.max(1, def.energyWeightDivisor ?? 4);

    type Target = { id: string; name: string; weight: number; isMisc: boolean };
    const resolve = (id: string) => {
      const misc = this.behemoth.buildingSlots.find((b) => b.id === id);
      if (misc) return { misc, weapon: undefined as WeaponSlot | undefined };
      return { misc: undefined, weapon: this.behemoth.slots.find((w) => w.id === id) };
    };
    const isActive = (id: string) => {
      const r = resolve(id);
      if (r.misc) return !!r.misc.building && r.misc.health > 0 && !r.misc.isStunned && !r.misc.isOffline;
      if (r.weapon) return !!r.weapon.weapon && r.weapon.health > 0 && !r.weapon.isStunned;
      return false;
    };

    let targets = (creature.drainTargets || []).filter(isActive);
    const previousCount = (creature.drainTargets || []).length;

    // Candidate pool: all currently active buildings not already selected
    const pool: Target[] = [];
    for (const b of this.behemoth.buildingSlots) {
      if (!b.building || !isActive(b.id) || targets.includes(b.id)) continue;
      const energy = Math.max(b.building.powerDraw, b.building.powerBonus);
      pool.push({ id: b.id, name: b.building.name, weight: Math.ceil(energy / divisor), isMisc: true });
    }
    for (const w of this.behemoth.slots) {
      if (!w.weapon || !isActive(w.id) || targets.includes(w.id)) continue;
      pool.push({ id: w.id, name: w.weapon.name, weight: Math.ceil(w.weapon.powerDraw / divisor), isMisc: false });
    }

    // Weighted random fill of missing slots
    while (targets.length < count) {
      const total = pool.reduce((s, t) => s + t.weight, 0);
      if (pool.length === 0 || total <= 0) break;
      let roll = Math.random() * total;
      let idx = 0;
      for (; idx < pool.length; idx++) {
        roll -= pool[idx].weight;
        if (roll <= 0) break;
      }
      const picked = pool.splice(Math.min(idx, pool.length - 1), 1)[0];
      targets.push(picked.id);
      this.addLog(`${creature.name} latches onto ${picked.name}.`, 'warn');
    }
    creature.drainTargets = targets;

    // Missing buildings are covered by Behemoth systems (Power Unit is never targetable)
    const systemCount = Math.max(0, count - targets.length);
    if (systemCount !== (creature.drainSystemCount ?? 0) && (systemCount > 0 || previousCount !== targets.length)) {
      if (systemCount > 0) this.addLog(`${creature.name} short-circuits ${systemCount} Behemoth system(s) (not enough active buildings).`, 'danger');
    }
    creature.drainSystemCount = systemCount;

    // Integrity drain
    for (const id of targets) {
      const r = resolve(id);
      if (r.misc) {
        r.misc.health = Math.max(0, r.misc.health - r.misc.maxHealth * ratePct * dt);
        this.stats.totalDamageTakenByBehemoth += r.misc.maxHealth * ratePct * dt;
        if (r.misc.health <= 0) {
          this.stats.buildingsDestroyed++;
          this.addLog(`${r.misc.building!.name} burned out from the short circuit!`, 'danger');
        }
      } else if (r.weapon) {
        r.weapon.health = Math.max(0, r.weapon.health - r.weapon.maxHealth * ratePct * dt);
        this.stats.totalDamageTakenByBehemoth += r.weapon.maxHealth * ratePct * dt;
        if (r.weapon.health <= 0) {
          this.stats.buildingsDestroyed++;
          this.addLog(`Weapon mount ${r.weapon.id.toUpperCase()} burned out from the short circuit!`, 'danger');
        }
      }
    }
    if (systemCount > 0) {
      const SYSTEM_HP = 250; // nominal integrity of one Behemoth system
      const sysDmg = systemCount * SYSTEM_HP * ratePct * dt;
      this.behemoth.hullHp = Math.max(0, this.behemoth.hullHp - sysDmg);
      this.stats.totalDamageTakenByBehemoth += sysDmg;
    }

    // Once per second, one drained building has a chance to go into Stun mode
    creature.drainStunAcc = (creature.drainStunAcc ?? 0) + dt;
    while (creature.drainStunAcc >= 1) {
      creature.drainStunAcc -= 1;
      if (targets.length > 0 && Math.random() < (def.drainStunChance ?? 0.10)) {
        const id = targets[Math.floor(Math.random() * targets.length)];
        const dur = def.drainStunDuration ?? 10;
        const r = resolve(id);
        if (r.misc) {
          r.misc.isStunned = true;
          r.misc.stunTimer = dur;
          this.addLog(`${r.misc.building!.name} STUNNED for ${dur}s!`, 'warn');
        } else if (r.weapon) {
          r.weapon.isStunned = true;
          r.weapon.stunTimer = dur;
          this.addLog(`Weapon mount ${r.weapon.id.toUpperCase()} STUNNED for ${dur}s!`, 'warn');
        }
      }
    }
  }

  /** Applies a creature strike to hull, buildings (misc + weapon mounts), or crew */
  applyStrike(
    creature: CreatureRuntimeInstance,
    def: CreatureDef,
    ev: { type: string; damage: number; target?: 'buildings' | 'hull' | 'crew'; targetSlotId?: string; stunChance: number; stunDuration: number; ramMass: number; strikeSide?: 'port' | 'starboard' }
  ) {
    const target = ev.target || def.attackTarget || 'hull';
    const isRam = ev.type === 'RAM_IMPACT';
    if (isRam) this.stats.rammingEventsCount++;

    if (target === 'hull') {
      this.behemoth.hullHp = Math.max(0, this.behemoth.hullHp - ev.damage);
      this.stats.totalDamageTakenByBehemoth += ev.damage;
      if (isRam) {
        const impulse = calculateRamImpulse(ev.ramMass, def.movementSpeed, ev.strikeSide || 'port');
        this.behemoth.tiltVelocity += impulse;
        this.addLog(`CRITICAL IMPACT: ${creature.name} rammed the hull! Dealt ${Math.round(ev.damage)} DMG! Listing by ${Math.abs(impulse).toFixed(1)}°!`, 'danger');
      } else {
        this.addLog(`${creature.name} bombarded the hull for ${Math.round(ev.damage)} DMG.`, 'danger');
      }
      return;
    }

    if (target === 'crew') {
      const crewHp = this.behemoth.crewMemberHp || CREW_HP;
      const killed = Math.min(this.behemoth.crew, Math.max(1, Math.round(ev.damage / crewHp)));
      this.behemoth.crew -= killed;
      this.stats.crewLost += killed;
      this.enforceCrewCap();
      this.addLog(`${creature.name} struck the crew: ${killed} lost (${this.behemoth.crew}/${this.behemoth.maxCrew} remain).`, 'danger');
      return;
    }

    // Buildings: misc buildings and weapon mounts share the pool of valid targets
    const candidates: Array<{ kind: 'misc'; slot: BuildingSlot } | { kind: 'weapon'; slot: WeaponSlot }> = [];
    for (const b of this.behemoth.buildingSlots) if (b.building && b.health > 0) candidates.push({ kind: 'misc', slot: b });
    for (const w of this.behemoth.slots) if (w.weapon && w.health > 0) candidates.push({ kind: 'weapon', slot: w });
    if (candidates.length === 0) {
      this.addLog(`${creature.name} found no buildings to strike.`, 'info');
      return;
    }
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    this.stats.totalDamageTakenByBehemoth += ev.damage;
    if (pick.kind === 'misc') {
      pick.slot.health = Math.max(0, pick.slot.health - ev.damage);
      // If crew are assigned inside this building, they suffer casualties based on damage
      const crewHp = this.behemoth.crewMemberHp || CREW_HP;
      if (pick.slot.assignedCrew > 0) {
        const crewCasualties = Math.min(
          pick.slot.assignedCrew,
          Math.max(pick.slot.health <= 0 ? 1 : 0, Math.floor(ev.damage / (crewHp * 2)))
        );
        if (crewCasualties > 0) {
          pick.slot.assignedCrew -= crewCasualties;
          this.behemoth.crew = Math.max(0, this.behemoth.crew - crewCasualties);
          this.stats.crewLost += crewCasualties;
          this.addLog(`${crewCasualties} crew casualties inside ${pick.slot.building!.name}!`, 'danger');
        }
      }
      if (pick.slot.health <= 0) {
        this.stats.buildingsDestroyed++;
        this.addLog(`${pick.slot.building!.name} was DESTROYED by ${creature.name}!`, 'danger');
      } else {
        this.addLog(`${creature.name} damaged ${pick.slot.building!.name} (${Math.round(pick.slot.health)}/${pick.slot.maxHealth}).`, 'warn');
      }
    } else {
      pick.slot.health = Math.max(0, pick.slot.health - ev.damage);
      if (pick.slot.health <= 0) {
        this.stats.buildingsDestroyed++;
        this.addLog(`Weapon mount ${pick.slot.id.toUpperCase()} was DESTROYED by ${creature.name}!`, 'danger');
      } else if (Math.random() < ev.stunChance) {
        pick.slot.isStunned = true;
        pick.slot.stunTimer = ev.stunDuration;
        this.addLog(`Weapon mount ${pick.slot.id.toUpperCase()} hit & stunned for ${ev.stunDuration}s!`, 'warn');
      }
    }
  }

  /** Ensures assigned crew in buildings never exceeds living crew per role (housing, job, service) */
  enforceCrewCap() {
    const roles: Array<'housing' | 'job' | 'service'> = ['housing', 'job', 'service'];
    for (const role of roles) {
      const slotsInRole = this.behemoth.buildingSlots.filter(
        (b) => b.building && (b.building.crewRole || (b.building.category === 'housing' ? 'housing' : b.building.category === 'service' ? 'service' : 'job')) === role
      );
      let totalAssigned = slotsInRole.reduce((sum, b) => sum + (b.assignedCrew || 0), 0);
      if (totalAssigned > this.behemoth.crew) {
        let excess = totalAssigned - this.behemoth.crew;
        for (const b of slotsInRole) {
          if (excess <= 0) break;
          if (b.assignedCrew > 0) {
            const deduct = Math.min(b.assignedCrew, excess);
            b.assignedCrew -= deduct;
            excess -= deduct;
          }
        }
      }
    }
  }

  /** Assigns or removes crew from a specified building slot adhering to the 1 housing, 1 job, 1 service rule */
  assignCrewToBuilding(slotId: string, countOrDelta: number, isAbsolute: boolean = false) {
    const slot = this.behemoth.buildingSlots.find((s) => s.id === slotId);
    if (!slot || !slot.building) return;

    const role = slot.building.crewRole || (slot.building.category === 'housing' ? 'housing' : slot.building.category === 'service' ? 'service' : 'job');
    const currentAssigned = slot.assignedCrew || 0;
    const maxCrew = slot.building.maxCrew ?? 6;

    const totalAssignedOtherInRole = this.behemoth.buildingSlots
      .filter((s) => s.id !== slotId && s.building && (s.building.crewRole || (s.building.category === 'housing' ? 'housing' : s.building.category === 'service' ? 'service' : 'job')) === role)
      .reduce((sum, s) => sum + (s.assignedCrew || 0), 0);

    const availableForThisRole = Math.max(0, this.behemoth.crew - totalAssignedOtherInRole);
    const maxPossibleForThisSlot = Math.min(maxCrew, availableForThisRole);

    let targetCount = isAbsolute ? countOrDelta : currentAssigned + countOrDelta;
    targetCount = Math.max(0, Math.min(maxPossibleForThisSlot, targetCount));

    slot.assignedCrew = targetCount;
  }

  /** Handles swarmer group strike targeting building vs assigned crewmember */
  applyGroupStrike(
    creature: CreatureRuntimeInstance,
    def: CreatureDef,
    ev: { target?: 'buildings' | 'hull' | 'crew'; targetSlotId?: string; damage: number; isCrewStrike?: boolean; groupStrikeLog?: string }
  ) {
    if (ev.groupStrikeLog) {
      this.addLog(ev.groupStrikeLog, ev.isCrewStrike ? 'danger' : 'warn');
    }
    this.stats.totalDamageTakenByBehemoth += ev.damage;

    if (ev.target === 'crew') {
      const crewHp = this.behemoth.crewMemberHp || CREW_HP;
      const killed = Math.min(this.behemoth.crew, Math.max(1, Math.round(ev.damage / crewHp)));
      this.behemoth.crew -= killed;
      this.stats.crewLost += killed;

      // If targeted to a specific building slot, deduct from that building's assigned crew first
      if (ev.targetSlotId) {
        const bSlot = this.behemoth.buildingSlots.find((b) => b.id === ev.targetSlotId);
        if (bSlot && bSlot.assignedCrew > 0) {
          bSlot.assignedCrew = Math.max(0, bSlot.assignedCrew - killed);
        }
      }
      this.enforceCrewCap();
      return;
    }

    // Target is building structure
    if (ev.targetSlotId) {
      const bSlot = this.behemoth.buildingSlots.find((b) => b.id === ev.targetSlotId);
      if (bSlot && bSlot.building) {
        bSlot.health = Math.max(0, bSlot.health - ev.damage);
        if (bSlot.health <= 0) {
          this.stats.buildingsDestroyed++;
          this.addLog(`${bSlot.building.name} was destroyed by swarm assault!`, 'danger');
        }
        return;
      }
    }

    // Fallback: apply regular building strike
    this.applyStrike(creature, def, {
      type: 'RAM_IMPACT',
      damage: ev.damage,
      target: 'buildings',
      stunChance: 0.1,
      stunDuration: 1.5,
      ramMass: 1.0,
    });
  }

  /** Replenishes projectile charges for a specific slot or all slots */
  loadCharges(slotId?: string) {
    if (slotId) {
      const slot = this.behemoth.slots.find((s) => s.id === slotId);
      if (slot && slot.weapon) {
        slot.isReloading = true;
        slot.reloadProgress = 0;
        slot.currentAmmo = slot.weapon.ammoCapacity;
        slot.totalPacksLoaded = (slot.totalPacksLoaded || 0) + 1;
        this.addLog(`[SUPPLY] Loading charges pack: ${slot.weapon.packName || slot.weapon.name} into Mount ${slot.id.toUpperCase()}`, 'info');
      }
    } else {
      let count = 0;
      for (const slot of this.behemoth.slots) {
        if (slot.weapon) {
          slot.currentAmmo = slot.weapon.ammoCapacity;
          slot.isReloading = false;
          slot.reloadProgress = 0;
          slot.totalPacksLoaded = (slot.totalPacksLoaded || 0) + 1;
          count++;
        }
      }
      this.addLog(`[SUPPLY] Resupplied and loaded full projectile charges into all ${count} weapon mounts.`, 'info');
    }
  }

  setBuildingSlotMaxHealth(slotId: string, maxHp: number) {
    const slot = this.behemoth.buildingSlots.find((s) => s.id === slotId);
    if (slot) {
      const oldMax = slot.maxHealth || 100;
      slot.maxHealth = Math.max(1, maxHp);
      slot.health = Math.min(slot.maxHealth, Math.max(1, Math.round((slot.health / oldMax) * slot.maxHealth)));
      this.addLog(`Assigned ${slot.maxHealth} HP to ${slot.building?.name || slot.id}.`, 'info');
    }
  }

  setAllBuildingSlotsMaxHealth(maxHp: number) {
    for (const slot of this.behemoth.buildingSlots) {
      if (slot.building) {
        slot.maxHealth = Math.max(1, maxHp);
        slot.health = slot.maxHealth;
      }
    }
    this.addLog(`Assigned ${maxHp} HP to all active buildings.`, 'info');
  }

  setCreatureFlying(defId: string, isFlying: boolean) {
    const def = this.creatureDefs.get(defId);
    if (def) {
      def.isFlying = isFlying;
      def.locomotionType = isFlying ? 'flying' : 'non-flying';
    }
    for (const c of this.creatures) {
      if (c.defId === defId) {
        c.isFlying = isFlying;
        c.locomotionType = isFlying ? 'flying' : 'non-flying';
      }
    }
    this.addLog(`${def?.name || 'Creature'} set to ${isFlying ? 'FLYING (aerial over boat)' : 'NON-FLYING (aquatic under water)'}.`, 'info');
  }

  fireWeapon(slot: WeaponSlot, fromX: number, fromY: number, target: CreatureRuntimeInstance, leadX?: number, leadY?: number) {
    if (!slot.weapon) return;
    const w = slot.weapon;

    // Use lead target coordinates if provided, else current target coordinates
    const targetAimX = leadX !== undefined ? leadX : target.x;
    const targetAimY = leadY !== undefined ? leadY : target.y;

    // Shots land where the weapon is actually pointing, not where the target was
    const aimDist = distance(fromX, fromY, targetAimX, targetAimY);
    const aimRadNow = (slot.currentAimAngle * Math.PI) / 180;
    const aimedX = fromX + Math.cos(aimRadNow) * aimDist;
    const aimedY = fromY + Math.sin(aimRadNow) * aimDist;

    if (w.damageType === 'Energy' && w.trajectory === 'Line') {
      // Beam weapon
      this.projectiles.push({
        id: `beam_${Date.now()}_${Math.random()}`,
        sourceSlotId: slot.id,
        sourceX: fromX,
        sourceY: fromY,
        x: fromX,
        y: fromY,
        targetX: aimedX,
        targetY: aimedY,
        vx: 0,
        vy: 0,
        damageType: 'Energy',
        dpp: w.dpp,
        pushback: w.pushback,
        aoe: w.aoe,
        trajectory: 'Line',
        arcProgress: 0,
        arcHeight: 0,
        color: w.color,
        createdTime: this.timeElapsed,
        duration: w.duration,
        isBeam: true,
        beamLifetime: 0,
      });
      return;
    }

    if (w.trajectory === 'Arch') {
      // Ballistic Arch Mortar
      const pSpeed = w.projectileSpeed > 0 ? w.projectileSpeed : 420;
      const fDuration = Math.max(0.35, distance(fromX, fromY, aimedX, aimedY) / pSpeed);
      this.projectiles.push({
        id: `mortar_${Date.now()}_${Math.random()}`,
        sourceSlotId: slot.id,
        sourceX: fromX,
        sourceY: fromY,
        x: fromX,
        y: fromY,
        targetX: aimedX + (Math.random() - 0.5) * w.coneRadius,
        targetY: aimedY + (Math.random() - 0.5) * w.coneRadius,
        vx: 0,
        vy: 0,
        damageType: w.damageType,
        dpp: w.dpp,
        pushback: w.pushback,
        aoe: w.aoe,
        trajectory: 'Arch',
        arcProgress: 0,
        arcHeight: 120,
        color: w.color,
        createdTime: this.timeElapsed,
        duration: w.duration,
        flightDuration: fDuration,
      });
      return;
    }

    // Standard Line kinetic projectile
    const aimRad = (slot.currentAimAngle * Math.PI) / 180;
    // Add cone spread
    const spreadRad = ((Math.random() - 0.5) * w.coneRadius * Math.PI) / 180;
    const finalRad = aimRad + spreadRad;

    const vx = Math.cos(finalRad) * w.projectileSpeed;
    const vy = Math.sin(finalRad) * w.projectileSpeed;

    this.projectiles.push({
      id: `proj_${Date.now()}_${Math.random()}`,
      sourceSlotId: slot.id,
      sourceX: fromX,
      sourceY: fromY,
      x: fromX,
      y: fromY,
      targetX: target.x,
      targetY: target.y,
      vx,
      vy,
      damageType: w.damageType,
      dpp: w.dpp,
      pushback: w.pushback,
      aoe: w.aoe,
      trajectory: 'Line',
      arcProgress: 0,
      arcHeight: 0,
      color: w.color,
      createdTime: this.timeElapsed,
      duration: 0.1,
    });
  }

  applyDamageToCreature(
    creature: CreatureRuntimeInstance,
    damageType: WeaponDef['damageType'],
    rawAmount: number,
    pushback: number,
    hitX?: number,
    hitY?: number,
    aoeRadius: number = 0,
    isAOEWeapon: boolean = false
  ) {
    // Diving fully negates all incoming damage
    if (creature.underwater) return;
    const effectiveRaw = rawAmount;

    if (this.benchmarkMode && this.benchmarkFirstHitTime === null && rawAmount > 0) {
      this.benchmarkFirstHitTime = this.timeElapsed;
      this.benchmarkIsActive = true;
      this.benchmarkMeasuredTtk = null;
      this.addLog(`[BENCHMARK] First impact registered at ${this.timeElapsed.toFixed(1)}s! Stopwatch started!`, 'info');
    }

    if (creature.isSwarm && creature.swarmEntities && creature.swarmEntities.length > 0) {
      const def = this.creatureDefs.get(creature.defId);
      const singleHp = def ? def.hp : (creature.hp / creature.quantity);
      const singleArmor = def ? def.physicalArmor : (creature.physicalArmor / creature.quantity);

      if (!isAOEWeapon) {
        // Focused single-target hit (e.g. Photon Gun beam or Gatling bullet)
        // Damages ONLY the single closest alive entity. Overkill does NOT bleed into the rest of the swarm.
        let closestEnt: any = null;
        let closestDist = Infinity;
        for (const ent of creature.swarmEntities) {
          if (ent.hp <= 0) continue;
          const d = (hitX !== undefined && hitY !== undefined)
            ? distance(hitX, hitY, ent.x, ent.y)
            : 0;
          if (d < closestDist) {
            closestDist = d;
            closestEnt = ent;
          }
        }

        if (closestEnt) {
          const res = calculateDamageAgainstCreature(
            damageType,
            effectiveRaw,
            singleArmor,
            creature.armorClass,
            creature.energyResistance
          );

          // Entity absorbs up to its remaining HP
          const actualHpLost = Math.min(closestEnt.hp, res.hpDamage);
          closestEnt.hp = Math.max(0, closestEnt.hp - actualHpLost);
          creature.hp = Math.max(0, creature.hp - actualHpLost);
          creature.physicalArmor = Math.max(0, creature.physicalArmor - res.armorDamage);
          this.stats.totalDamageDealtToCreatures += actualHpLost;

          // Record hit position on runtime state for reactive flock scatter
          const runtimeState = this.behaviorRuntimeStates.get(creature.id);
          if (runtimeState) {
            runtimeState.lastHitPoint = {
              x: closestEnt.x,
              y: closestEnt.y,
              time: this.timeElapsed,
            };
            runtimeState.receivedDamageCounter = (runtimeState.receivedDamageCounter || 0) + actualHpLost;
          }
        }
      } else {
        // AOE Splash / Explosion / Cloud
        // Damages entities in blast radius with distance fall-off
        const blastCenter = (hitX !== undefined && hitY !== undefined) ? { x: hitX, y: hitY } : { x: creature.x, y: creature.y };
        const effectiveRadius = Math.max(aoeRadius, 40);

        let totalHpLost = 0;
        let totalArmorLost = 0;

        for (const ent of creature.swarmEntities) {
          if (ent.hp <= 0) continue;
          const d = distance(blastCenter.x, blastCenter.y, ent.x, ent.y);
          if (d <= effectiveRadius + 15) {
            // Distance fall-off: center = 100%, edge = 35%
            const falloff = Math.max(0.35, 1 - (d / (effectiveRadius + 15)) * 0.65);
            const res = calculateDamageAgainstCreature(
              damageType,
              effectiveRaw * falloff,
              singleArmor,
              creature.armorClass,
              creature.energyResistance
            );

            const hpLoss = Math.min(ent.hp, res.hpDamage);
            ent.hp = Math.max(0, ent.hp - hpLoss);
            totalHpLost += hpLoss;
            totalArmorLost += res.armorDamage;
          }
        }

        creature.hp = Math.max(0, creature.hp - totalHpLost);
        creature.physicalArmor = Math.max(0, creature.physicalArmor - totalArmorLost);
        this.stats.totalDamageDealtToCreatures += totalHpLost;

        if (totalHpLost > 0) {
          const runtimeState = this.behaviorRuntimeStates.get(creature.id);
          if (runtimeState) {
            runtimeState.lastHitPoint = {
              x: blastCenter.x,
              y: blastCenter.y,
              time: this.timeElapsed,
            };
            runtimeState.receivedDamageCounter = (runtimeState.receivedDamageCounter || 0) + totalHpLost;
          }
        }
      }

      // If all swarm entities perished, wipe creature
      if (creature.swarmEntities.every(e => e.hp <= 0)) {
        creature.hp = 0;
      }
    } else {
      // Standard monolithic creature
      const res = calculateDamageAgainstCreature(
        damageType,
        effectiveRaw,
        creature.physicalArmor,
        creature.armorClass,
        creature.energyResistance
      );

      creature.physicalArmor = Math.max(0, creature.physicalArmor - res.armorDamage);
      creature.hp = Math.max(0, creature.hp - res.hpDamage);
      this.stats.totalDamageDealtToCreatures += res.totalDamage;

      if (res.totalDamage > 0) {
        const runtimeState = this.behaviorRuntimeStates.get(creature.id);
        if (runtimeState) {
          runtimeState.lastHitPoint = {
            x: hitX !== undefined ? hitX : creature.x,
            y: hitY !== undefined ? hitY : creature.y,
            time: this.timeElapsed,
          };
          runtimeState.receivedDamageCounter = (runtimeState.receivedDamageCounter || 0) + res.totalDamage;
        }
      }
    }

    // Apply pushback impulse
    if (pushback > 0) {
      const pushRad = (creature.angle * Math.PI) / 180;
      creature.x -= Math.cos(pushRad) * pushback * 0.15;
      creature.y -= Math.sin(pushRad) * pushback * 0.15;
    }
  }

  reset() {
    this.behemoth.hullHp = this.behemoth.maxHullHp;
    this.behemoth.tiltAngle = 0;
    this.behemoth.tiltVelocity = 0;
    this.behemoth.isCapsized = false;
    this.behemoth.accumulatorCharge = 100;
    this.behemoth.accumulatorOverloaded = false;
    this.benchmarkFirstHitTime = null;
    this.benchmarkMeasuredTtk = null;
    this.benchmarkIsActive = false;

    for (const slot of this.behemoth.slots) {
      if (slot.weapon) {
        slot.currentAmmo = slot.weapon.ammoCapacity;
      }
      slot.isReloading = false;
      slot.reloadProgress = 0;
      slot.cooldownRemaining = 0;
      slot.isCoolingDown = false;
      slot.cooldownDurationRemaining = 0;
      slot.currentFireDuration = 0;
      slot.isStunned = false;
      slot.stunTimer = 0;
      slot.health = slot.maxHealth;
    }
    for (const b of this.behemoth.buildingSlots) {
      b.health = b.maxHealth;
      b.isStunned = false;
      b.stunTimer = 0;
      b.isOffline = false;
      b.assignedCrew = b.building ? (b.building.requiredCrew || 1) : 0;
    }
    this.behemoth.crew = this.behemoth.maxCrew;

    this.creatures = [];
    this.projectiles = [];
    this.timeElapsed = 0;
    this.stats = {
      totalDamageDealtToCreatures: 0,
      totalDamageTakenByBehemoth: 0,
      totalAmmoConsumed: {},
      peakPowerDraw: 0,
      rammingEventsCount: 0,
      criticalTiltsCount: 0,
      crewLost: 0,
      buildingsDestroyed: 0,
    };
    this.logMessages = [];
    this.addLog('Simulation reset to baseline.', 'info');
  }
}
