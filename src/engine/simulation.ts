import { CANVAS_BEHEMOTH_WIDTH_PX, CANVAS_BEHEMOTH_HEIGHT_PX, CANVAS_TILE_SIZE_PX } from './measurements';
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
  HateMatrix,
  CombatConfig,
} from '../types/combat';
import {
  DEFAULT_COMBAT_CONFIG, BEHEMOTH_ID, hates, hatesIds, aggressionStateFor, CRUISE_SPEED_KTS, OVERDRIVE_SPEED_KTS, AGGRESSION_DEFAULTS, HP_LOSS_TRIGGER, HP_LOSS_AGGRESSION_MUL, AGGRESSION_PER_DAMAGE_PCT, RETREAT_HOLD_FRACTION,
  OUT_OF_RADIUS_SECONDS, OUT_OF_RADIUS_AGGRESSION_MUL, RETALIATE_SECONDS,
} from './relations';

/** A retreating creature leaves the battle beyond this multiple of its aggro radius from the Behemoth. */
const ESCAPE_RADIUS_MULTIPLIER = 2;

/** Virtual deck around a creature target (px). Building slot 0 sits exactly on the target centre. */
const VIRTUAL_TARGET_WIDTH = 92;
const VIRTUAL_TARGET_HEIGHT = 66;
const VIRTUAL_TARGET_SLOT: BuildingSlot = {
  id: 'virtual_target', slotIndex: 0, row: 'misc_a',
  building: { id: 'virtual', name: 'Target', description: '', maxHealth: 1, powerBonus: 0, powerDraw: 0, color: '#000000', requiredCrew: 0 },
  health: 1, maxHealth: 1, isStunned: false, stunTimer: 0, isOffline: false, assignedCrew: 0,
};
import { calculateDamageAgainstCreature, updateVesselTilt, calculateRamImpulse, distance, angleBetween, isWithinArc, clampAngleToArc } from './math';
import { random, setSeed, getSeed } from './rng';
import {
  traverseArcDeg, weaponEngageRangePx, weaponDistancePx, shootingAreaPx, isSprayWeapon, isBeamWeapon,
  isContinuousWeapon, isInsideSprayCone,
} from './weapons';

/** Chemical spray: a lingering cloud is dropped at the nearest sprayed target every N seconds. */
const SPRAY_CLOUD_INTERVAL_S = 0.5;
/** Cloud damage per second as a share of the spray's dps. */
const SPRAY_CLOUD_DPS_SHARE = 0.4;
import { knotsSpeedToPxPerSec, metersToPx, pxToMeters, CROWD_DISPERSION_DEFAULT_M } from './measurements';
import { updateCreatureAI } from './creatureAI';
import { DEFAULT_BUILDINGS, DEFAULT_CREW_CONFIG } from '../data/presets';
import { syncCrewAgents, tickCrewSimulation } from './crew';
import {
  generateSmoothPath,
  getWeaponSlotWorldPosition,
  weaponSlotLocalPose,
  isPointOverDeck,
  getVesselBowPosition,
  getVesselSternPosition,
  ARRIVAL_THRESHOLD_RADIUS,
  FINAL_ARRIVAL_RADIUS,
  getBuildingSlotWorldPosition,
  deckLocalToWorld,
} from './navigation';

/** Damage points that kill one crew member */
export const CREW_HP = 20;
export const DEFAULT_CREW = 50;
import { CreatureBehaviorTree, BehaviorRuntimeState } from '../types/behavior';
import { tickCreatureBehavior, createInitialBehaviorRuntimeState } from './behaviorRunner';
import { DEFAULT_BEHAVIOR_TEMPLATES } from '../data/behaviorTemplates';
import { FleetSystem, DEFAULT_ENGINE_HP } from './fleets';
import { FleetSpeciesDef, FleetFactionDef } from '../types/combat';

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
  projectilesDodged?: number;
  creaturesEscaped?: number;
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
  vesselCenter: { x: number; y: number; width: number; height: number; heading?: number; speed?: number } = {
    x: 500,
    y: 310,
    width: CANVAS_BEHEMOTH_WIDTH_PX,
    height: CANVAS_BEHEMOTH_HEIGHT_PX,
    heading: 0,
    speed: 0,
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
        rotationCap: undefined, // optional per-mount limit; the weapon cone applies otherwise
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
        rotationCap: undefined, // optional per-mount limit; the weapon cone applies otherwise
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

    // Two aft (stern) mounts, empty by default
    for (let i = 0; i < 2; i++) {
      slots.push({
        id: `aft_${i}`,
        slotIndex: i,
        row: 'aft',
        positionX: 0.045,
        weapon: null,
        currentAmmo: 0,
        isReloading: false,
        reloadProgress: 0,
        cooldownRemaining: 0,
        currentAimAngle: 180,
        rotationCap: undefined,
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
      engineHp: DEFAULT_ENGINE_HP,
      maxEngineHp: DEFAULT_ENGINE_HP,
      slowTimer: 0,
      slowPct: 0,
      pacifyTimer: 0,
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
      heading: 0,
      speed: 0,
      targetSpeed: 10.0,
      turnRate: 15,
      gear: 'forward',
      isReversing: false,
      waypoints: [],
      pathPoints: [],
      isMoving: false,
      allowNoseAngle: true,
    };

    // Load default behavior templates for creatures
    for (const [id, tree] of Object.entries(DEFAULT_BEHAVIOR_TEMPLATES)) {
      this.behaviorTrees.set(id, tree);
    }

    this.creatures = [];
    this.projectiles = [];
    this.pdwShots = [];
    this.fleets = new FleetSystem(this);
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
      this.fleets.reset();
    }

    // Spawn along perimeter of visible radar canvas (1000x700 viewport)
    const spawnAngle = random() * Math.PI * 2;
    // Scale distance ellipse to fit comfortably within 1000x700 canvas margins
    const maxRadiusX = 460;
    const maxRadiusY = 320;
    const spawnScale = 0.90 + random() * 0.08;
    const defaultSpawnX = this.vesselCenter.x + Math.cos(spawnAngle) * maxRadiusX * spawnScale;
    const defaultSpawnY = this.vesselCenter.y + Math.sin(spawnAngle) * maxRadiusY * spawnScale;
    // Spawn ring follows the Behemoth (the radar camera can be zoomed out and the ship may have sailed away)
    const spawnX = customPosition ? customPosition.x : defaultSpawnX;
    const spawnY = customPosition ? customPosition.y : defaultSpawnY;

    const initialAngle = (angleBetween(spawnX, spawnY, this.vesselCenter.x, this.vesselCenter.y) + 360) % 360;
    const initialSpeed = knotsSpeedToPxPerSec(def.movementSpeed);
    const initialRad = (initialAngle * Math.PI) / 180;
    const initialVx = Math.cos(initialRad) * initialSpeed;
    const initialVy = Math.sin(initialRad) * initialSpeed;

    const isSwarm = def.quantity > 1;
    const swarmEntities = [];
    if (isSwarm) {
      const dispersionScale = (def.crowdDispersion ?? CROWD_DISPERSION_DEFAULT_M) / CROWD_DISPERSION_DEFAULT_M;
      const ringSpacing = Math.min(24, (85 / Math.sqrt(Math.max(1, def.quantity))) * dispersionScale);
      const goldenAngle = 2.39996;
      for (let i = 0; i < def.quantity; i++) {
        const radius = (12 + Math.sqrt(i) * ringSpacing) * dispersionScale;
        const subAngle = i * goldenAngle;
        swarmEntities.push({
          x: spawnX + Math.cos(subAngle) * radius,
          y: spawnY + Math.sin(subAngle) * radius,
          vx: initialVx,
          vy: initialVy,
          hp: def.hp,
          maxHp: def.hp,
        });
      }
    }

    const isFlying = def.isFlying ?? (def.locomotionType === 'flying') ?? false;

    const instance: CreatureRuntimeInstance = {
      id: `creature_${Date.now()}_${random().toString(36).substring(2, 6)}`,
      defId: def.id,
      name: def.name,
      x: spawnX,
      y: spawnY,
      vx: initialVx,
      vy: initialVy,
      angle: initialAngle,
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
      aggression: def.aggressionStart ?? AGGRESSION_DEFAULTS.start,
      aggressionState: aggressionStateFor(def.aggressionStart ?? AGGRESSION_DEFAULTS.start, def),
      hpAggroTriggered: false,
      retaliateTimer: 0,
      targetKind: null,
      targetCreatureId: null,
      underwater: isFlying ? false : true,
      depthRatio: isFlying ? 0.0 : 1.0,
      stunned: false,
      stunTimer: 0,
      isSwarm,
      crowdDispersion: def.crowdDispersion ?? CROWD_DISPERSION_DEFAULT_M, // meters
      swarmEntities,
      color: def.iconColor,
      radius: metersToPx(def.radius), // def in meters, runtime in canvas px
      // The four core creatures are drawn as vector shapes; others fall back to an emoji marker
      emoji: def.emoji || (!isSwarm && !['thunder_leviarch', 'dreadlot', 'aetherfin', 'veilfangs'].includes(def.id) ? '👾' : undefined),
      isFlying,
      locomotionType: isFlying ? 'flying' : 'non-flying',
      isAggroed: true,
      outOfAggroTimer: 0,
      aggroRadiusMeters: def.aggroRadiusMeters || (def.id === 'thunder_leviarch' ? 2000 : 1000),
      aggroDropDuration: def.aggroDropDuration || 10.0,
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
      id: random().toString(36),
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
      const slotPos = getWeaponSlotWorldPosition(activeSlot, this.vesselCenter, this.behemoth.heading);
      const rad = (slotPos.defaultFacing * Math.PI) / 180;
      return {
        x: slotPos.x + Math.cos(rad) * 300,
        y: slotPos.y + Math.sin(rad) * 300,
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

  /** Relations: who attacks whom on sight (Phase 3). */
  hateMatrix: HateMatrix = {};
  fleets!: FleetSystem;
  /** Behemoth weapon currently dealing damage (for per-target weapon multipliers). */
  activeWeaponId: string | null = null;

  setFleetDefinitions(species: FleetSpeciesDef[], factions: FleetFactionDef[]) {
    this.fleets.setDefinitions(species, factions);
  }

  spawnFleet(speciesId: string, factionId?: string, addAlongside = false) {
    return this.fleets.spawnFleet(speciesId, factionId, !addAlongside);
  }

  setFleetAggression(fleetId: string, value: number) {
    this.fleets.setFleetAggression(fleetId, value);
  }

  /** Hate Matrix id of a runtime entity (fleet species id for fleet units). */
  hateIdOf(c: CreatureRuntimeInstance): string {
    return c.hateId ?? c.defId;
  }

  /** Hate Matrix ids, most specific first: fleet units [factionId, speciesId], creatures [defId]. */
  hateIdsOf(c: CreatureRuntimeInstance): string[] {
    return c.hateFactionId ? [c.hateFactionId, c.hateId ?? c.defId] : [c.hateId ?? c.defId];
  }

  /** Runs fn with the given damage source (Neutral retaliation bookkeeping). */
  withDamageSource(src: { kind: 'behemoth' | 'creature'; id: string | null }, fn: () => void) {
    const prev = this.damageSource;
    this.damageSource = src;
    try { fn(); } finally { this.damageSource = prev; }
  }
  /** Global combat rules (Phase 3). */
  combatConfig: CombatConfig = { ...DEFAULT_COMBAT_CONFIG };

  setHateMatrix(matrix: HateMatrix) {
    this.hateMatrix = matrix || {};
  }

  setCombatConfig(config: CombatConfig) {
    this.combatConfig = { ...DEFAULT_COMBAT_CONFIG, ...(config || {}) };
  }

  setSlotRotationCap(slotId: string, cap: number) {
    const slot = this.behemoth.slots.find((s) => s.id === slotId);
    if (slot) {
      slot.rotationCap = Math.max(30, Math.min(360, cap));
      const defaultFacing = weaponSlotLocalPose(slot, this.vesselCenter.width).facing;
      slot.currentAimAngle = clampAngleToArc(slot.currentAimAngle, defaultFacing, slot.rotationCap);
    }
  }

  setAllSlotsRotationCap(cap: number) {
    const clamped = Math.max(30, Math.min(360, cap));
    for (const slot of this.behemoth.slots) {
      slot.rotationCap = clamped;
      const defaultFacing = weaponSlotLocalPose(slot, this.vesselCenter.width).facing;
      slot.currentAimAngle = clampAngleToArc(slot.currentAimAngle, defaultFacing, clamped);
    }
  }

  getBowPosition() {
    return getVesselBowPosition(this.vesselCenter, this.behemoth.heading);
  }

  getSternPosition() {
    return getVesselSternPosition(this.vesselCenter, this.behemoth.heading);
  }

  setGear(gear: 'forward' | 'reverse') {
    if (this.behemoth.gear === gear) return;
    this.behemoth.gear = gear;
    this.behemoth.isReversing = gear === 'reverse';
    this.addLog(`Navigation Gear shifted: ${gear.toUpperCase()}`, 'info');
    if (this.behemoth.waypoints.length > 0) {
      this.rebuildPathFromCurrentState();
    }
  }

  toggleGear() {
    this.setGear(this.behemoth.gear === 'reverse' ? 'forward' : 'reverse');
  }

  setNoseDepartureMode(allowAngle: boolean) {
    this.behemoth.allowNoseAngle = allowAngle;
    this.addLog(`Nose Departure Mode: ${allowAngle ? 'Direct Angle' : 'Heading Curve'}`, 'info');
    if (this.behemoth.waypoints.length > 0) {
      this.rebuildPathFromCurrentState();
    }
  }

  toggleNoseDepartureMode() {
    this.setNoseDepartureMode(!(this.behemoth.allowNoseAngle ?? true));
  }

  rebuildPathFromCurrentState() {
    if (this.behemoth.waypoints.length === 0) {
      this.behemoth.pathPoints = [];
      this.behemoth.isMoving = false;
      return;
    }

    const isRev = this.behemoth.isReversing;
    const startPoint = isRev ? this.getSternPosition() : this.getBowPosition();
    const leadHeading = isRev ? (this.behemoth.heading + 180) % 360 : this.behemoth.heading;

    const smooth = generateSmoothPath(
      startPoint,
      this.behemoth.waypoints,
      45,
      leadHeading,
      this.behemoth.allowNoseAngle ?? true
    );
    this.behemoth.pathPoints = smooth;
    this.behemoth.isMoving = this.behemoth.targetSpeed > 0;
  }

  setWaypoints(waypoints: Array<{ x: number; y: number }>, fromAutoNav: boolean = false) {
    if (!fromAutoNav && this.autoNavMode !== 'off') {
      this.autoNavMode = 'off';
      this.addLog('[AUTO NAV] Manual route plotted: automatic mode off.', 'info');
    }
    if (fromAutoNav) {
      // Automatic mode: always forward gear, keep the user's speed setting (0 = hold position)
      this.behemoth.waypoints = waypoints;
      this.behemoth.gear = 'forward';
      this.behemoth.isReversing = false;
      this.rebuildPathFromCurrentState();
      return;
    }
    this.behemoth.waypoints = waypoints;
    if (waypoints.length === 0) {
      this.behemoth.pathPoints = [];
      this.behemoth.isMoving = false;
      this.behemoth.isReversing = false;
      this.behemoth.gear = 'forward';
      return;
    }

    // Ensure engine targetSpeed is active (restore cruise speed 10.0 kts if idling/halted)
    if (this.behemoth.targetSpeed <= 0) {
      this.behemoth.targetSpeed = 10.0;
    }

    // Route Planning & Reverse Gear logic:
    // Forward-First Preference: Routes are always built from the bow, moving forward in almost all situations.
    // Manual Reverse Condition: Only permitted if gear was explicitly set to reverse OR if the player explicitly
    // draws a waypoint directly backwards (astern quadrant: angle difference >= 140° from bow).
    const firstWp = waypoints[0];
    const angleToWp = angleBetween(this.vesselCenter.x, this.vesselCenter.y, firstWp.x, firstWp.y);
    const diffFromHeading = Math.abs(((angleToWp - this.behemoth.heading + 540) % 360) - 180);

    if (diffFromHeading >= 140) {
      this.behemoth.gear = 'reverse';
      this.behemoth.isReversing = true;
      this.addLog(`Manual Reverse Condition met (plotted ${Math.round(diffFromHeading)}° astern). Engaging Reverse Gear.`, 'info');
    } else {
      // Forward-First Preference: revert back to regular forward gear on route rebuild/setting
      this.behemoth.gear = 'forward';
      this.behemoth.isReversing = false;
    }

    this.rebuildPathFromCurrentState();
    this.addLog(
      `Navigation route set: ${waypoints.length} waypoint(s) [${this.behemoth.gear.toUpperCase()} GEAR]. Commencing course.`,
      'info'
    );
  }

  addWaypoint(wp: { x: number; y: number }, override: boolean = false) {
    if (this.autoNavMode !== 'off') {
      this.autoNavMode = 'off';
      this.addLog('[AUTO NAV] Manual waypoint: automatic mode off.', 'info');
    }
    if (this.behemoth.targetSpeed <= 0) {
      this.behemoth.targetSpeed = 10.0;
    }
    if (override || this.behemoth.waypoints.length === 0) {
      this.setWaypoints([wp]);
      return;
    }

    // Append to existing waypoints
    this.behemoth.waypoints.push(wp);
    this.rebuildPathFromCurrentState();
    this.addLog(`Added WP ${this.behemoth.waypoints.length} to active route.`, 'info');
  }

  /** Installs a deck loadout: every listed slot gets that weapon (full ammo, idle) or is emptied. */
  applyDeckLoadout(slots: Record<string, string | null>, weapons: WeaponDef[]) {
    const byId = new Map(weapons.map((w) => [w.id, w]));
    for (const slot of this.behemoth.slots) {
      const wid = slots[slot.id] ?? null;
      const w = wid ? byId.get(wid) : undefined;
      slot.weapon = w ? { ...w } : null;
      slot.currentAmmo = w ? w.ammoCapacity : 0;
      slot.isReloading = false;
      slot.reloadProgress = 0;
      slot.cooldownRemaining = 0;
      slot.isFiring = false;
      slot.beamActive = false;
      slot.burstAmmoPaid = false;
      slot.isCoolingDown = false;
      slot.cooldownDurationRemaining = 0;
      slot.currentFireDuration = 0;
    }
  }

  /** Current deck arrangement (slot id -> weapon id). */
  currentDeckLoadout(): Record<string, string | null> {
    return Object.fromEntries(this.behemoth.slots.map((s) => [s.id, s.weapon ? s.weapon.id : null]));
  }

  /** Extra engine draw (kW) at the current speed: 0 at cruise (10 kts), overdrivePowerDraw at 15 kts. */
  overdrivePowerDrawNow(): number {
    const over = (this.behemoth.speed - CRUISE_SPEED_KTS) / (OVERDRIVE_SPEED_KTS - CRUISE_SPEED_KTS);
    if (over <= 0) return 0;
    return Math.min(1, over) * (this.combatConfig.overdrivePowerDraw ?? 1000);
  }

  /** Building-seconds of production lost to Overdrive diversion this run. */
  productionDivertedSeconds = 0;
  divertedBuildings = 0;

  setBehemothSpeed(knots: number) {
    const clamped = Math.max(0, Math.min(20.0, knots));
    this.behemoth.targetSpeed = Number(clamped.toFixed(1));
    if (this.behemoth.targetSpeed === 0) {
      this.addLog('All engines full stop (0.0 kts). Vessel idling.', 'info');
    } else if (this.behemoth.pathPoints.length > 0) {
      this.behemoth.isMoving = true;
    }
  }

  /**
   * Full Stop order (triggered by Key F):
   * - Behemoth stops moving immediately
   * - All waypoints and path points vanish
   */
  fullStop() {
    this.autoNavMode = 'off';
    this.behemoth.waypoints = [];
    this.behemoth.pathPoints = [];
    this.behemoth.speed = 0;
    this.behemoth.targetSpeed = 0;
    this.behemoth.isMoving = false;
    this.behemoth.isReversing = false;
    this.behemoth.gear = 'forward';
    this.addLog('[NAV] Full Stop order executed (Key F). All engines cut, route cleared.', 'warn');
  }

  // ==========================================
  // AUTOMATIC NAVIGATION (observation aid)
  // ==========================================
  autoNavMode: 'off' | 'circle' | 'escape' = 'off';
  private autoNavTimer = 0;
  private autoNavCircle: { cx: number; cy: number; r: number; dir: 1 | -1; angle: number } | null = null;
  static readonly AUTO_ESCAPE_REFRESH_S = 10;

  /** Circle: laps a circle one world tile across. Escape: re-plots a route away from hostile creatures every 10 s. Speed = the Vessel Speed setting. */
  setAutoNavMode(mode: 'off' | 'circle' | 'escape') {
    this.autoNavMode = mode;
    this.autoNavTimer = 0;
    this.autoNavCircle = null;
    if (mode === 'off') {
      this.behemoth.waypoints = [];
      this.behemoth.pathPoints = [];
      this.addLog('[AUTO NAV] Automatic mode off. Route cleared.', 'info');
      return;
    }
    if (mode === 'circle') {
      // Start on the circle: centre off the starboard beam, sweep clockwise (ahead of the bow first)
      const r = CANVAS_TILE_SIZE_PX / 2;
      const h = (this.behemoth.heading * Math.PI) / 180;
      const cx = this.vesselCenter.x + Math.cos(h + Math.PI / 2) * r;
      const cy = this.vesselCenter.y + Math.sin(h + Math.PI / 2) * r;
      const angle = Math.atan2(this.vesselCenter.y - cy, this.vesselCenter.x - cx);
      this.autoNavCircle = { cx, cy, r, dir: 1, angle };
      this.behemoth.waypoints = [];
      this.topUpCircleRoute();
      this.addLog('[AUTO NAV] Circle: lapping a 1-tile circle at the Vessel Speed setting.', 'info');
    } else {
      this.planEscapeRoute();
      this.addLog(`[AUTO NAV] Escape: re-plotting a route away from creatures every ${SimulationEngine.AUTO_ESCAPE_REFRESH_S} s.`, 'info');
    }
  }

  private topUpCircleRoute() {
    const c = this.autoNavCircle;
    if (!c) return;
    const STEP = Math.PI / 6; // 12 waypoints per lap
    const wps = [...this.behemoth.waypoints];
    let changed = false;
    while (wps.length < 6) {
      c.angle += STEP * c.dir;
      wps.push({ x: c.cx + Math.cos(c.angle) * c.r, y: c.cy + Math.sin(c.angle) * c.r });
      changed = true;
    }
    if (changed) this.setWaypoints(wps, true);
  }

  private planEscapeRoute() {
    const hostiles = this.creatures.filter((c) => c.hp > 0 && (c.targetKind === 'behemoth' || hatesIds(this.hateMatrix, [BEHEMOTH_ID], this.hateIdsOf(c))));
    const h = (this.behemoth.heading * Math.PI) / 180;
    let ax = Math.cos(h), ay = Math.sin(h); // no threat: keep going straight
    if (hostiles.length > 0) {
      // Threat vector: away from every hostile, weighted by 1/distance (closest matters most)
      let tx = 0, ty = 0;
      for (const c of hostiles) {
        const dx = this.vesselCenter.x - c.x, dy = this.vesselCenter.y - c.y;
        const d = Math.max(30, Math.hypot(dx, dy));
        tx += dx / (d * d); ty += dy / (d * d);
      }
      const n = Math.hypot(tx, ty);
      if (n > 1e-9) { ax = tx / n; ay = ty / n; }
    }
    // Two legs: a 1-tile run away from the threat (beyond reach before the next refresh)
    const L = CANVAS_TILE_SIZE_PX;
    const wp1 = { x: this.vesselCenter.x + ax * L * 0.5, y: this.vesselCenter.y + ay * L * 0.5 };
    const wp2 = { x: this.vesselCenter.x + ax * L, y: this.vesselCenter.y + ay * L };
    this.setWaypoints([wp1, wp2], true);
  }

  private tickAutoNav(dt: number) {
    if (this.autoNavMode === 'off') return;
    if (this.autoNavMode === 'circle') {
      if (!this.autoNavCircle) this.setAutoNavMode('circle');
      else this.topUpCircleRoute();
      return;
    }
    this.autoNavTimer += dt;
    if (this.autoNavTimer >= SimulationEngine.AUTO_ESCAPE_REFRESH_S || this.behemoth.waypoints.length === 0) {
      this.autoNavTimer = 0;
      this.planEscapeRoute();
    }
  }

  /**
   * Reset Behemoth: restores hull, engine, every turret and building to full health, clears all stuns,
   * slows and tilt, and restores the default crew count and building assignments. Position, route,
   * ammo, creatures and the loadout are kept.
   */
  resetBehemoth() {
    const b = this.behemoth;
    b.hullHp = b.maxHullHp;
    b.engineHp = b.maxEngineHp ?? DEFAULT_ENGINE_HP;
    b.tiltAngle = 0;
    b.tiltVelocity = 0;
    b.isCapsized = false;
    b.hullHitFlash = 0;
    b.slowTimer = 0;
    b.slowPct = 0;
    b.pacifyTimer = 0;
    b.accumulatorOverloaded = false;
    for (const slot of b.slots) {
      slot.health = slot.maxHealth;
      slot.isStunned = false;
      slot.stunTimer = 0;
    }
    for (const bs of b.buildingSlots) {
      bs.health = bs.maxHealth;
      bs.isStunned = false;
      bs.stunTimer = 0;
      bs.isOffline = false;
      bs.assignedCrew = bs.building ? (bs.building.requiredCrew || 1) : 0;
    }
    b.crew = b.maxCrew;
    this.crewAgents = syncCrewAgents([], b.crew, b.crewMemberHp || CREW_HP, this.vesselCenter, b.buildingSlots);
    this.addLog('[RESET] Behemoth restored: full health, stuns cleared, default crew and assignments.', 'info');
  }

  updateBehemothMovement(dt: number) {
    this.tickAutoNav(dt);
    if (this.behemoth.waypoints.length === 0 && this.behemoth.pathPoints.length === 0) {
      if (this.behemoth.speed > 0) {
        this.behemoth.speed = Math.max(0, this.behemoth.speed - 0.8 * dt);
        if (this.behemoth.speed <= 0.01) {
          this.behemoth.speed = 0;
          this.behemoth.isMoving = false;
        }
      }
      return;
    }

    // 1. Waypoint Arrival & Early Snapping Check (Prevents Looping)
    const activeWp = this.behemoth.waypoints[0];
    if (activeWp) {
      const distToCenter = distance(this.vesselCenter.x, this.vesselCenter.y, activeWp.x, activeWp.y);
      const refPos = this.behemoth.isReversing ? this.getSternPosition() : this.getBowPosition();
      const distToRef = distance(refPos.x, refPos.y, activeWp.x, activeWp.y);
      const minDistance = Math.min(distToCenter, distToRef);
      const hasNextWp = this.behemoth.waypoints.length > 1;

      if (hasNextWp) {
        // Intermediate Waypoint: Early Snapping & Turning
        // As soon as vessel enters the arrival threshold radius (5-10 units / ~35 px):
        // Snap the path to the next waypoint and begin turning early.
        if (minDistance <= ARRIVAL_THRESHOLD_RADIUS) {
          this.behemoth.waypoints.shift();
          this.rebuildPathFromCurrentState();
          this.addLog(
            `Waypoint reached within threshold (${Math.round(minDistance)}px). Snapping course to WP 1 (${this.behemoth.waypoints.length} remaining). Beginning early turn.`,
            'info'
          );
        }
      } else {
        // Final Waypoint: Arrival & Deceleration to full stop
        if (
          distToCenter <= FINAL_ARRIVAL_RADIUS ||
          (minDistance <= ARRIVAL_THRESHOLD_RADIUS && this.behemoth.speed <= 0.20)
        ) {
          this.behemoth.pathPoints = [];
          this.behemoth.waypoints = [];
          this.behemoth.speed = 0;
          this.behemoth.isMoving = false;
          this.behemoth.isReversing = false;
          this.behemoth.gear = 'forward';
          this.behemoth.justArrivedAtFinalWaypoint = true;
          this.addLog('Behemoth arrived at final waypoint. All engines stop.', 'info');
          return;
        }
      }
    }

    // 2. Pure pursuit along smoothed pathPoints
    // Advance path points already reached by vessel
    const leadPos = this.behemoth.isReversing ? this.getSternPosition() : this.getBowPosition();
    while (this.behemoth.pathPoints.length > 1) {
      const p0 = this.behemoth.pathPoints[0];
      const d = distance(leadPos.x, leadPos.y, p0.x, p0.y);
      if (d < 22) {
        this.behemoth.pathPoints.shift();
      } else {
        break;
      }
    }

    // Pick lookahead point on path
    const lookaheadIdx = Math.min(
      this.behemoth.pathPoints.length - 1,
      Math.max(1, Math.floor(40 / 6))
    );
    const targetPoint = this.behemoth.pathPoints[lookaheadIdx] || this.behemoth.pathPoints[0] || activeWp;
    if (!targetPoint) return;

    // 3. Calculate Target Steering Angle
    const targetAngle = angleBetween(
      leadPos.x,
      leadPos.y,
      targetPoint.x,
      targetPoint.y
    );

    let angleDiff = 0;
    if (this.behemoth.isReversing) {
      // In reverse mode, stern steers towards the target point
      const desiredHeading = (targetAngle + 180) % 360;
      angleDiff = ((desiredHeading - this.behemoth.heading + 540) % 360) - 180;
    } else {
      // Forward mode: bow steers towards target point
      angleDiff = ((targetAngle - this.behemoth.heading + 540) % 360) - 180;
    }

    const absAngleDiff = Math.abs(angleDiff);

    // 4. Dynamic Speed Reduction:
    // Coupling the arrival radius with reduced turning speed prevents the vessel from overshooting or circling.
    let baseTargetSpeed = this.behemoth.pathPoints.length > 0 ? this.behemoth.targetSpeed : 0;
    if (this.behemoth.isReversing) {
      // Reverse speed capped to 2.0 kts (1/4 speed)
      baseTargetSpeed = Math.min(2.0, baseTargetSpeed);
    }

    // Hard turn rudder brake: vessel sheds speed during sharp course changes so turning radius shrinks
    const turnSharpnessFactor = Math.max(0.40, Math.cos((absAngleDiff * Math.PI) / 360));

    // Arrival proximity deceleration
    let proximityFactor = 1.0;
    if (activeWp) {
      const distToActive = distance(this.vesselCenter.x, this.vesselCenter.y, activeWp.x, activeWp.y);
      if (this.behemoth.waypoints.length === 1 && distToActive < 80) {
        // Glide smoothly to final stop
        proximityFactor = Math.max(0.15, distToActive / 80);
      } else if (distToActive < ARRIVAL_THRESHOLD_RADIUS + 30 && absAngleDiff > 25) {
        // Slow down dynamically inside arrival zone during turns
        proximityFactor = Math.max(0.45, distToActive / (ARRIVAL_THRESHOLD_RADIUS + 30));
      }
    }

    // A tripped power grid can't feed Overdrive: speed falls back to cruise
    if (this.behemoth.accumulatorOverloaded) baseTargetSpeed = Math.min(baseTargetSpeed, CRUISE_SPEED_KTS);
    const effectiveTargetSpeed = baseTargetSpeed * turnSharpnessFactor * proximityFactor * this.fleets.speedMultiplier();

    // Smooth engine acceleration / deceleration
    const accelRate = 2.6; // kts/s (+30% responsive acceleration)
    if (this.behemoth.speed < effectiveTargetSpeed) {
      this.behemoth.speed = Math.min(effectiveTargetSpeed, this.behemoth.speed + accelRate * dt);
    } else if (this.behemoth.speed > effectiveTargetSpeed) {
      this.behemoth.speed = Math.max(effectiveTargetSpeed, this.behemoth.speed - accelRate * dt);
    }

    if (this.behemoth.speed <= 0.01) {
      this.behemoth.speed = 0;
      if (effectiveTargetSpeed === 0) {
        this.behemoth.isMoving = false;
      }
    } else {
      this.behemoth.isMoving = true;
    }

    // 5. Rudder Steering with smooth damping (prevents angular overshoot)
    const maxTurn = this.behemoth.turnRate * dt; // 15 deg/s
    const steerDamp = Math.min(1.0, absAngleDiff / 10);
    const turnAmount = Math.sign(angleDiff) * Math.min(maxTurn * steerDamp, absAngleDiff);
    this.behemoth.heading = (this.behemoth.heading + turnAmount + 360) % 360;
    this.vesselCenter.heading = this.behemoth.heading;
    this.vesselCenter.speed = this.behemoth.speed;

    // 6. Vessel Movement Translation
    const speedPx = knotsSpeedToPxPerSec(this.behemoth.speed);
    const moveDist = speedPx * dt;
    const headingRad = (this.behemoth.heading * Math.PI) / 180;

    let deltaX = 0;
    let deltaY = 0;
    if (this.behemoth.isReversing) {
      // Negative translation along heading (moving backwards)
      deltaX = -Math.cos(headingRad) * moveDist;
      deltaY = -Math.sin(headingRad) * moveDist;
    } else {
      deltaX = Math.cos(headingRad) * moveDist;
      deltaY = Math.sin(headingRad) * moveDist;
    }

    const prevCenterX = this.vesselCenter.x;
    const prevCenterY = this.vesselCenter.y;
    this.vesselCenter.x += deltaX;
    this.vesselCenter.y += deltaY;
  }

  tick(dt: number) {
    this.timeElapsed += dt;

    // 0. Vessel Navigation & Movement
    this.updateBehemothMovement(dt);

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
        // Continuous weapons (beams, sprays) draw power only while emitting
        if (isContinuousWeapon(slot.weapon) && !slot.beamActive) continue;
        currentPowerDraw += slot.weapon.powerDraw;
      }
    }
    if (currentPowerDraw > this.stats.peakPowerDraw) {
      this.stats.peakPowerDraw = currentPowerDraw;
    }

    // Enforce assigned crew cap does not exceed total living crew
    this.enforceCrewCap();

    // Overdrive: the engine takes its power first; production (job) buildings are powered down to feed it
    const overdriveDraw = this.overdrivePowerDrawNow();
    currentPowerDraw += overdriveDraw;
    const capacityEstimate = this.behemoth.totalPowerCapacity + this.behemoth.buildingSlots.reduce((sum, b) => {
      const unmanned = !!b.building && (b.building.requiredCrew ?? 1) > (b.assignedCrew || 0);
      return sum + (b.building && b.health > 0 && !b.isStunned && !b.isOffline && !unmanned ? b.building.powerBonus : 0);
    }, 0);
    const jobsWanting: BuildingSlot[] = [];

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
      if (!b.isStunned && !b.isOffline && !isUnmanned) {
        if (b.building.category === 'job' && b.building.powerDraw > 0) jobsWanting.push(b); // decided below
        else currentPowerDraw += b.building.powerDraw;
      } else {
        b.isDiverted = false;
      }
    }
    // Production buildings run only on what Overdrive leaves; without Overdrive they always run
    let diverted = 0;
    for (const b of jobsWanting) {
      const draw = b.building!.powerDraw;
      if (overdriveDraw > 0 && currentPowerDraw + draw > capacityEstimate) {
        b.isDiverted = true;
        diverted++;
      } else {
        b.isDiverted = false;
        currentPowerDraw += draw;
      }
    }
    if (diverted !== this.divertedBuildings) {
      if (diverted > 0) this.addLog(`[OVERDRIVE] Engine draws ${Math.round(overdriveDraw)} kW: ${diverted} production building${diverted > 1 ? 's' : ''} powered down`, 'warn');
      else if (this.divertedBuildings > 0) this.addLog('[OVERDRIVE] Power restored to production', 'info');
      this.divertedBuildings = diverted;
    }
    this.productionDivertedSeconds += diverted * dt;

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

      // Fleet pacify effect: no weapon may fire
      if ((this.behemoth.pacifyTimer ?? 0) > 0) {
        slot.isFiring = false;
        slot.beamActive = false;
        continue;
      }

      // If in benchmark mode and single mount is active, only the primary active mount fires
      if (this.benchmarkMode && this.benchmarkSingleMount) {
        const activeSlot = this.behemoth.slots.find((s) => s.weapon && s.weapon.id) || this.behemoth.slots[0];
        if (slot.id !== activeSlot.id) {
          slot.isFiring = false;
          continue;
        }
      }

      // Find best target for this slot (UE cone model: traverse envelope + detection range)
      const slotPos = getWeaponSlotWorldPosition(slot, this.vesselCenter, this.behemoth.heading);
      const slotWorldX = slotPos.x;
      const slotWorldY = slotPos.y;
      const defaultFacing = slotPos.defaultFacing;
      const w = slot.weapon;
      const traverseArc = traverseArcDeg(w, slot);
      const engageRange = weaponEngageRangePx(w);
      const spray = isSprayWeapon(w);
      const continuous = isContinuousWeapon(w);

      let closestTarget: CreatureRuntimeInstance | null = null;
      let minDistance = Infinity;

      for (const creature of this.creatures) {
        if (creature.hp <= 0) continue; // submerged targets are shootable (universal underwater damage reduction)
        if (!hatesIds(this.hateMatrix, [BEHEMOTH_ID], this.hateIdsOf(creature))) continue; // Behemoth targeting filter (Hate Matrix row)
        const d = distance(slotWorldX, slotWorldY, creature.x, creature.y);
        if (d > engageRange + creature.radius) continue;
        const ang = angleBetween(slotWorldX, slotWorldY, creature.x, creature.y);
        const inEnvelope = spray
          ? this.isInMountSpray(w, slotWorldX, slotWorldY, defaultFacing, creature.x, creature.y, creature.radius)
          : isWithinArc(ang, defaultFacing, traverseArc);
        if (inEnvelope && d < minDistance) {
          minDistance = d;
          closestTarget = creature;
        }
      }

      if (!closestTarget) {
        slot.isFiring = false;
        slot.beamActive = false;
        // Keep idle turrets clamped to their traverse envelope
        slot.currentAimAngle = clampAngleToArc(slot.currentAimAngle, defaultFacing, traverseArc);
        continue;
      }

      let aimTargetX = closestTarget.x;
      let aimTargetY = closestTarget.y;
      let targetVx = closestTarget.vx || 0;
      let targetVy = closestTarget.vy || 0;
      let targetRadius = closestTarget.radius;

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
            targetRadius = ent.radius || 12;
          }
        }
      }

      // Linear lead: projectile flight time (beams and sprays are instant)
      const distToTarget = distance(slotWorldX, slotWorldY, aimTargetX, aimTargetY);
      let flightTime = 0;
      if (!continuous) {
        const pSpeed = metersToPx(w.projectileSpeed > 0 ? w.projectileSpeed : 750); // m/s -> px/s
        flightTime = w.trajectory === 'Arch' ? Math.max(0.35, distToTarget / pSpeed) : distToTarget / pSpeed;
      }
      const leadTargetX = aimTargetX + targetVx * flightTime;
      const leadTargetY = aimTargetY + targetVy * flightTime;

      // Rotate toward the lead point inside the traverse envelope (sprays fill the cone and don't need to aim)
      const rawAimAngle = spray ? defaultFacing : angleBetween(slotWorldX, slotWorldY, leadTargetX, leadTargetY);
      const clampedAimTarget = clampAngleToArc(rawAimAngle, defaultFacing, traverseArc);
      const aimDiff = ((clampedAimTarget - slot.currentAimAngle + 540) % 360) - 180;
      const maxTurn = (w.turnSpeed ?? 120) * dt;
      const turnStep = Math.max(-maxTurn, Math.min(maxTurn, aimDiff));
      slot.currentAimAngle = clampAngleToArc(slot.currentAimAngle + turnStep, defaultFacing, traverseArc);

      // Boresight gate: the barrel must point within the target's angular size (+ spread / beam width)
      const remainingAngleError = Math.abs(((rawAimAngle - slot.currentAimAngle + 540) % 360) - 180);
      const isTargetInArc = spray || isWithinArc(rawAimAngle, defaultFacing, traverseArc);
      const reachPx = targetRadius + (continuous ? shootingAreaPx(w) : metersToPx(w.aoe || 0));
      const angularSizeDeg = (Math.atan2(reachPx, Math.max(1, distToTarget)) * 180) / Math.PI;
      const boresightTolerance = Math.max(1, angularSizeDeg + (continuous ? 0 : (w.spreadDeg ?? 0)));
      const isOnTarget = isTargetInArc && (spray || remainingAngleError <= boresightTolerance);

      if (continuous) {
        this.updateContinuousWeapon(slot, w, slotWorldX, slotWorldY, defaultFacing, isOnTarget, dt);
        continue;
      }

      // Physical: fire if on-target, cooldown ready, not cooling down from burst, and has ammo
      if (isOnTarget && slot.cooldownRemaining <= 0 && slot.currentAmmo >= w.ammoPerShot && !this.behemoth.accumulatorOverloaded) {
        this.fireWeapon(slot, slotWorldX, slotWorldY, closestTarget, leadTargetX, leadTargetY);
        slot.currentAmmo -= w.ammoPerShot;
        slot.totalChargesUsed = (slot.totalChargesUsed || 0) + w.ammoPerShot;
        slot.cooldownRemaining = w.fireRate > 0 ? 1 / w.fireRate : w.cooldown;
        slot.isFiring = true;

        // Track fire duration progress
        const shotInterval = w.fireRate > 0 ? 1 / w.fireRate : 0.1;
        slot.currentFireDuration += shotInterval;

        // Check if weapon has reached fireDuration limit
        const maxFireDuration = w.fireDuration || 3.0;
        if (slot.currentFireDuration >= maxFireDuration) {
          slot.isCoolingDown = true;
          slot.cooldownDurationRemaining = w.cooldownDuration || 2.0;
          slot.currentFireDuration = 0;
          slot.isFiring = false;
          this.addLog(`[COOLDOWN] Mount ${slot.id.toUpperCase()} (${w.name}): Burst ceiling reached -> Cooling down (${w.cooldownDuration}s recharge)`, 'warn');
        }

        // Track ammo consumption stats
        this.stats.totalAmmoConsumed[w.ammoType] = (this.stats.totalAmmoConsumed[w.ammoType] || 0) + w.ammoPerShot;

        if (slot.currentAmmo < w.ammoPerShot) {
          slot.isReloading = true;
          slot.reloadProgress = 0;
          this.addLog(`[RECHARGE] Mount ${slot.id.toUpperCase()} (${w.name}): Charges depleted -> Recharging / Loading ${w.packName || w.ammoType} (${w.reloadTime}s)`, 'warn');
        }
      } else {
        slot.isFiring = false;
      }
    }

    // 4. Update Projectiles & Trajectories
    const activeProjectiles: Projectile[] = [];

    for (const p of this.projectiles) {
      this.activeWeaponId = p.weaponId ?? null;
      if (p.isBeam) {
        // Visual-only beam segment: damage is applied by the turret update (applyBeamTick); drawn for one frame
        p.beamLifetime = (p.beamLifetime || 0) + dt;
        if (p.beamLifetime <= p.duration) activeProjectiles.push(p);
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
            if (creature.hp <= 0) continue;
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
        p.traveledPx = (p.traveledPx || 0) + Math.hypot(p.vx, p.vy) * dt;
        if (p.maxTravelPx !== undefined && p.traveledPx > p.maxTravelPx) continue; // reached max Distance

        let hit = false;
        for (const creature of this.creatures) {
          if (creature.hp <= 0) continue;

          if (creature.isSwarm && creature.swarmEntities) {
            // Check collision against each active individual swarm bat
            for (const ent of creature.swarmEntities) {
              if (ent.hp <= 0) continue;
              const d = distance(p.x, p.y, ent.x, ent.y);
              const hitRadius = Math.max(14, (ent.radius || 8) + p.aoe / 2);
              if (d <= hitRadius) {
                hit = true;
                this.applyDamageToCreature(creature, p.damageType, p.dpp, p.pushback, ent.x, ent.y, p.aoe, p.aoe >= 25);
                break;
              }
            }
            if (hit) break;
          } else {
            // Monolithic creature
            const d = distance(p.x, p.y, creature.x, creature.y);
            if (d <= creature.radius + p.aoe / 2) {
              hit = true;
              this.applyDamageToCreature(creature, p.damageType, p.dpp, p.pushback, p.x, p.y, p.aoe, p.aoe >= 25);
              break;
            }
          }
        }

        // Out of world bounds
        if (!hit && Math.abs(p.x - this.vesselCenter.x) <= 2500 && Math.abs(p.y - this.vesselCenter.y) <= 2500) {
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
                  this.applyDamageToCreature(creature, p.damageType, p.dpp, p.pushback, p.targetX, p.targetY, p.aoe, true, p.aoeFalloff);
                  break;
                }
              }
            } else {
              const d = distance(p.targetX, p.targetY, creature.x, creature.y);
              // Concussive shockwave reaches targets within blast radius (including submerged targets like Aetherfin!)
              if (d <= creature.radius + blastRadius) {
                // Light falloff: full damage at the center, (1 - aoeFalloff) at the blast edge
                const edgeDist = Math.max(0, d - creature.radius);
                const falloffMul = 1 - (p.aoeFalloff ?? 0) * Math.min(1, edgeDist / Math.max(1e-6, blastRadius));
                const blastDmg = p.dpp * falloffMul;
                this.applyDamageToCreature(creature, p.damageType, blastDmg, p.pushback, p.targetX, p.targetY, p.aoe, true);
                this.addLog(`CONCUSSIVE BLAST: Mortar shell struck ${creature.name} for ${Math.round(blastDmg)} DMG!`, 'danger');
              }
            }
          }

          // Visual explosion shockwave
          activeProjectiles.push({
            id: `exp_${Date.now()}_${random()}`,
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
              id: `cloud_${Date.now()}_${random()}`,
              sourceSlotId: p.sourceSlotId,
              weaponId: p.weaponId,
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
    this.activeWeaponId = null;

    // 5. Update Creatures AI & Physics
    for (const creature of this.creatures) {
      if (creature.hp <= 0) continue;
      if (creature.fleetId) continue; // fleet units are driven by the FleetSystem
      const def = this.creatureDefs.get(creature.defId);
      if (!def) continue;

      // Aggro radius (m): engagement range for hated targets; the Behemoth staying outside it erodes aggression
      const aggroRadiusM = creature.aggroRadiusMeters ?? def.aggroRadiusMeters ?? (def.id === 'thunder_leviarch' ? 2000 : 1000);
      const aggroRadiusPx = metersToPx(aggroRadiusM);
      const distToBehemothPx = distance(creature.x, creature.y, this.vesselCenter.x, this.vesselCenter.y);

      if (!this.benchmarkMode) this.updateAggression(creature, def, distToBehemothPx <= aggroRadiusPx, dt);
      const aggroState = this.benchmarkMode ? 'pursue' : (creature.aggressionState ?? 'pursue');

      // Target: Pursue -> nearest hated entity in radius; Neutral -> only its last attacker (retaliation)
      let target: { kind: 'behemoth' } | { kind: 'creature'; creature: CreatureRuntimeInstance } | null = null;
      if (this.benchmarkMode) target = { kind: 'behemoth' };
      else if (aggroState === 'pursue') target = this.selectTarget(creature, def, aggroRadiusPx, distToBehemothPx);
      else if (aggroState === 'neutral' && (creature.retaliateTimer ?? 0) > 0) target = this.resolveRetaliation(creature);
      creature.targetKind = target ? target.kind : null;
      creature.targetCreatureId = target && target.kind === 'creature' ? target.creature.id : null;
      creature.isAggroed = !!target;

      if (aggroState === 'retreat' && !this.benchmarkMode) {
        const stay = def.retreatMode === 'stay';
        this.applyRetreat(creature, def, dt, stay ? aggroRadiusPx * RETREAT_HOLD_FRACTION : undefined);
        // Fled far enough: leaves the battle ('stay' creatures hold at the aggro radius edge instead)
        if (!stay && distance(creature.x, creature.y, this.vesselCenter.x, this.vesselCenter.y) > aggroRadiusPx * ESCAPE_RADIUS_MULTIPLIER) {
          creature.escaped = true;
        }
        continue;
      }

      if (!target) {
        // No target (Neutral, or nothing hated in range): passive drift
        const drag = Math.exp(-2.0 * dt);
        creature.vx = (creature.vx || 0) * drag;
        creature.vy = (creature.vy || 0) * drag;
        const driftAngle = (this.timeElapsed * 15 + creature.x * 0.1) * (Math.PI / 180);
        creature.vx += Math.cos(driftAngle) * 8 * dt;
        creature.vy += Math.sin(driftAngle) * 8 * dt;
        creature.x += creature.vx * dt;
        creature.y += creature.vy * dt;
        creature.stage = 'Underwater';
        continue;
      }

      // Behavior trees steer toward a "target frame": the Behemoth, or a virtual deck centred on another creature
      const targetCreature = target.kind === 'creature' ? target.creature : null;
      const targetFrame = targetCreature ? this.virtualTargetFrame(targetCreature) : this.vesselCenter;
      const targetWeaponSlots = targetCreature ? [] : this.behemoth.slots;
      const targetBuildingSlots = targetCreature ? [VIRTUAL_TARGET_SLOT] : this.behemoth.buildingSlots;

      // Remove the dodge offset so behavior logic steers the true path position (re-applied after the update)
      if (creature.dodgeOffX || creature.dodgeOffY) {
        creature.x -= creature.dodgeOffX ?? 0;
        creature.y -= creature.dodgeOffY ?? 0;
      }

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
          targetFrame,
          targetWeaponSlots,
          dt,
          this.timeElapsed,
          targetBuildingSlots
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
        const res = updateCreatureAI(creature, def, targetFrame, targetWeaponSlots, dt);
        updated = res.creature;
        events = res.events;
      }

      Object.assign(creature, updated);

      if (!this.benchmarkMode) { this.applyProjectileDodge(creature, def, dt); this.applySwarmShellEvasion(creature, def, dt); }

      if (this.benchmarkMode) {
        const pos = this.getBenchmarkTargetPosition();
        creature.x = pos.x;
        creature.y = pos.y;
        creature.vx = 0;
        creature.vy = 0;
        creature.underwater = false;
        creature.depthRatio = 0.0;
        if (creature.isSwarm && creature.swarmEntities) {
          const dispersionScale = (def.crowdDispersion ?? creature.crowdDispersion ?? CROWD_DISPERSION_DEFAULT_M) / CROWD_DISPERSION_DEFAULT_M;
          const spacing = 16 * dispersionScale;
          for (let i = 0; i < creature.swarmEntities.length; i++) {
            const ent = creature.swarmEntities[i];
            const col = (i % 4) - 1.5;
            const row = Math.floor(i / 4) - 1.5;
            ent.x = creature.x + col * spacing;
            ent.y = creature.y + row * spacing;
            ent.vx = 0;
            ent.vy = 0;
          }
        }
      }

      if (targetCreature) {
        // Creature vs creature: every attack event damages the target creature
        if (def.pursueStyle === 'orbit_drain' && creature.pursuePhase === 'attacking' && creature.drainArrived) {
          this.applyCreatureAttack(creature, def, targetCreature, { type: 'SHORT_CIRCUIT_DRAIN', damage: 0 }, dt);
        }
        for (const ev of events) this.applyCreatureAttack(creature, def, targetCreature, ev, dt);
      }

      if (!targetCreature && def.pursueStyle === 'orbit_drain' && creature.pursuePhase === 'attacking' && creature.drainArrived) {
        this.applyDrain(creature, def, dt);
      }

      for (const ev of (targetCreature ? [] : events)) {
        if (ev.type === 'SHORT_CIRCUIT_DRAIN') {
          this.applyDrain(creature, def, dt);
        } else if (ev.type === 'GROUP_STRIKE') {
          this.applyGroupStrike(creature, def, ev);
        } else if (ev.type === 'RAM_IMPACT' || ev.type === 'SHOOT_DECK' || ev.type === 'HULL_SCRAPE') {
          this.applyStrike(creature, def, ev);
        }
      }

      // Update spatial hover / scrape state for Thunder Leviarch (Behemoth target only)
      if (creature.defId === 'thunder_leviarch' && !targetCreature) {
        const overDeck = isPointOverDeck(creature.x, creature.y, this.vesselCenter, this.behemoth.heading, 15);
        const runtimeState = this.behaviorRuntimeStates.get(creature.id);
        const isExecutingTailScrape = runtimeState && (runtimeState.currentStateId === 'state_tail_scrape' || runtimeState.activeNodeId === 'node_tl_tail_scrape');

        creature.isHoveringDeck = overDeck && (creature.isFlying || (creature.altitudeRatio !== undefined && creature.altitudeRatio > 0.35));
        creature.isScrapingHull = overDeck && (creature.underwater || !creature.isFlying) && !!isExecutingTailScrape;

        // When swimming directly under the vessel hull, apply continuous keel friction scraping!
        if (creature.isScrapingHull) {
          creature.hullScrapeTimer = (creature.hullScrapeTimer ?? 0) + dt;
          if (creature.hullScrapeTimer >= 0.22) {
            creature.hullScrapeTimer = 0;
            const scrapeDmg = Math.round((def.strikeDamageRate || 260) * 0.12);
            this.behemoth.hullHp = Math.max(0, this.behemoth.hullHp - scrapeDmg);
            this.behemoth.hullHitFlash = 0.35;
            creature.damagePulseTimer = 0.3;
            creature.damagePulseColor = '#f97316';
            this.stats.totalDamageTakenByBehemoth += scrapeDmg;
            if (def.scrapeCausesTilt !== false) {
              const scrapeSide = creature.y < this.vesselCenter.y ? 'port' : 'starboard';
              this.behemoth.tiltVelocity += (scrapeSide === 'port' ? -0.85 : 0.85);
            }
            this.addLog(`[KEEL SCRAPE] ${creature.name} scraped under the keel! -${scrapeDmg} Hull HP (Physical)`, 'danger');
          }
        }
      }

      // Calculate real-time turn rate (deg/s) and altitude ratio for 3D depth scaling
      if (creature.prevAngle !== undefined) {
        let diff = (creature.angle - creature.prevAngle) % 360;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        creature.turnRate = diff / Math.max(0.001, dt);
      }
      creature.prevAngle = creature.angle;

      // Update aerial altitude ratio (smooth jump/breach interpolation)
      if (creature.isFlying || creature.locomotionType === 'flying') {
        creature.altitudeRatio = Math.min(1.0, (creature.altitudeRatio ?? 0) + dt * 2.5);
      } else {
        creature.altitudeRatio = Math.max(0.0, (creature.altitudeRatio ?? 0) - dt * 2.5);
      }

      // Detect diving vs surfacing transitions to trigger splash VFX
      if (creature.lastUnderwater === undefined) {
        creature.lastUnderwater = creature.underwater;
      } else if (creature.lastUnderwater !== creature.underwater) {
        creature.splashTimer = 0.8;
        creature.splashType = creature.underwater ? 'dive' : 'surface';
        creature.lastUnderwater = creature.underwater;
      }

      // Decay creature VFX timers
      if (creature.splashTimer && creature.splashTimer > 0) {
        creature.splashTimer = Math.max(0, creature.splashTimer - dt);
      }
      if (creature.damagePulseTimer && creature.damagePulseTimer > 0) {
        creature.damagePulseTimer = Math.max(0, creature.damagePulseTimer - dt);
      }
    }

    // 5b. Fleets: movement, aggression, weapons, boarders, fireships, Behemoth status effects
    if (!this.benchmarkMode) this.fleets.update(dt);

    // Decay Behemoth module hit-flash timers (for red damage blinks)
    if (this.behemoth.hullHitFlash && this.behemoth.hullHitFlash > 0) {
      this.behemoth.hullHitFlash = Math.max(0, this.behemoth.hullHitFlash - dt);
    }
    for (const slot of this.behemoth.slots) {
      if (slot.hitFlashTimer && slot.hitFlashTimer > 0) {
        slot.hitFlashTimer = Math.max(0, slot.hitFlashTimer - dt);
      }
    }
    for (const bSlot of this.behemoth.buildingSlots) {
      if (bSlot.hitFlashTimer && bSlot.hitFlashTimer > 0) {
        bSlot.hitFlashTimer = Math.max(0, bSlot.hitFlashTimer - dt);
      }
    }

    // Cleanup dead creatures
    this.creatures = this.creatures.filter((c) => {
      if (c.fleetId) {
        if (c.hp <= 0) { this.fleets.onUnitRemoved(c); return false; }
        if (c.escaped) {
          if (c.fleetRole === 'ship') {
            this.stats.creaturesEscaped = (this.stats.creaturesEscaped ?? 0) + 1;
            this.addLog(`[ESCAPED] ${c.name} fled the battle.`, 'info');
          }
          return false;
        }
        return true;
      }
      if (c.hp <= 0) {
        if (this.benchmarkMode && this.benchmarkFirstHitTime !== null && this.benchmarkMeasuredTtk === null) {
          this.benchmarkMeasuredTtk = Number((this.timeElapsed - this.benchmarkFirstHitTime).toFixed(1));
          this.benchmarkIsActive = false;
          this.addLog(`[BENCHMARK] Target neutralized! Live Measured TTK: ${this.benchmarkMeasuredTtk}s`, 'success');
        }
        this.addLog(`VICTORY: ${c.name} neutralized and sank into the abyss!`, 'success');
        return false;
      }
      if (c.escaped) {
        this.stats.creaturesEscaped = (this.stats.creaturesEscaped ?? 0) + 1;
        this.addLog(`[ESCAPED] ${c.name} fled the battle (${Math.round(c.hp)}/${Math.round(c.maxHp)} HP left).`, 'info');
        return false;
      }
      return true;
    });

    // Spike volley visuals: fly 0.35 s, impact burst until 0.65 s
    for (const v of this.spikeVisuals) v.age += dt;
    this.spikeVisuals = this.spikeVisuals.filter((v) => v.age - v.delay < 0.65);

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
    // Crew only engage (and are only attacked by) creatures hostile to the ship
    const shipHostiles = this.creatures.filter(
      (c) => c.targetKind === 'behemoth' || hatesIds(this.hateMatrix, [BEHEMOTH_ID], this.hateIdsOf(c))
    );
    const crewResult = tickCrewSimulation(
      this.crewAgents,
      this.behemoth,
      shipHostiles,
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
      let roll = random() * total;
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
        r.misc.hitFlashTimer = 0.4;
        this.stats.totalDamageTakenByBehemoth += r.misc.maxHealth * ratePct * dt;
        if (r.misc.health <= 0) {
          this.stats.buildingsDestroyed++;
          this.addLog(`${r.misc.building!.name} burned out from the short circuit!`, 'danger');
        }
      } else if (r.weapon) {
        r.weapon.health = Math.max(0, r.weapon.health - r.weapon.maxHealth * ratePct * dt);
        r.weapon.hitFlashTimer = 0.4;
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
      this.behemoth.hullHitFlash = 0.4;
      this.stats.totalDamageTakenByBehemoth += sysDmg;
    }
    creature.damagePulseTimer = 0.35;
    creature.damagePulseColor = '#a855f7';

    // Once per second, one drained building has a chance to go into Stun mode
    creature.drainStunAcc = (creature.drainStunAcc ?? 0) + dt;
    while (creature.drainStunAcc >= 1) {
      creature.drainStunAcc -= 1;
      if (targets.length > 0 && random() < (def.drainStunChance ?? 0.10)) {
        const id = targets[Math.floor(random() * targets.length)];
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
    ev: { type: string; damage: number; target?: 'buildings' | 'hull' | 'crew'; targetSlotId?: string; stunChance: number; stunDuration: number; ramMass: number; strikeSide?: 'port' | 'starboard'; spikeCount?: number; spikeDamage?: number }
  ) {
    // Spike volley (Thunder Leviarch): each spike picks a random target among hull + buildings (turrets excluded)
    if (ev.type === 'SHOOT_DECK' && def.canShootDeck) {
      this.applySpikeVolley(
        creature,
        Math.max(1, Math.round(ev.spikeCount ?? def.spikeCount ?? 5)),
        ev.spikeDamage ?? def.spikeDamage ?? 30
      );
      return;
    }

    const isOverDeck =
      (creature.isFlying || creature.isHoveringDeck || (creature.altitudeRatio !== undefined && creature.altitudeRatio > 0.35)) &&
      isPointOverDeck(creature.x, creature.y, this.vesselCenter, this.behemoth.heading, 45);

    const isUnderVessel =
      (creature.underwater || !creature.isFlying || creature.isScrapingHull) &&
      isPointOverDeck(creature.x, creature.y, this.vesselCenter, this.behemoth.heading, 35);

    let target = ev.target || def.attackTarget || 'hull';
    if (creature.defId === 'thunder_leviarch') {
      if (isOverDeck || creature.isFlying) {
        target = 'buildings';
      } else if (isUnderVessel || creature.underwater) {
        target = 'hull';
      }
    }

    const isRam = ev.type === 'RAM_IMPACT';
    if (isRam) this.stats.rammingEventsCount++;

    // Trigger visual damage shockwave pulse radiating outward from the attacking creature
    creature.damagePulseTimer = 0.55;
    creature.damagePulseColor = isOverDeck ? '#38bdf8' : (isUnderVessel ? '#f97316' : '#ef4444');

    if (target === 'hull') {
      this.behemoth.hullHp = Math.max(0, this.behemoth.hullHp - ev.damage);
      this.behemoth.hullHitFlash = 0.5;
      this.stats.totalDamageTakenByBehemoth += ev.damage;
      if (isUnderVessel || ev.type === 'HULL_SCRAPE' || creature.defId === 'thunder_leviarch') {
        if (def.scrapeCausesTilt !== false) {
          const scrapeSide = ev.strikeSide || (creature.y < this.vesselCenter.y ? 'port' : 'starboard');
          const frictionTilt = (scrapeSide === 'port' ? -1 : 1) * Math.min(3.5, (ev.ramMass || 6) * 0.35);
          this.behemoth.tiltVelocity += frictionTilt;
          this.addLog(`[HULL SCRAPE] ${creature.name} scraped along the submerged hull/keel for ${Math.round(ev.damage)} DMG!`, 'danger');
        } else {
          this.addLog(`[KEEL SCRAPE] ${creature.name} scraped the keel with its tail for ${Math.round(ev.damage)} Physical DMG.`, 'danger');
        }
      } else if (isRam) {
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
      this.behemoth.hullHitFlash = 0.4;
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
    const pick = candidates[Math.floor(random() * candidates.length)];
    this.stats.totalDamageTakenByBehemoth += ev.damage;
    pick.slot.hitFlashTimer = 0.6; // Trigger emergency red blink on damaged module
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
        if (isOverDeck || creature.defId === 'thunder_leviarch') {
          this.addLog(`[AERIAL DECK STRIKE] ${creature.name} hovering over deck hit ${pick.slot.building!.name} for ${Math.round(ev.damage)} DMG!`, 'danger');
        } else {
          this.addLog(`${creature.name} damaged ${pick.slot.building!.name} (${Math.round(pick.slot.health)}/${pick.slot.maxHealth}).`, 'warn');
        }
      }
    } else {
      pick.slot.health = Math.max(0, pick.slot.health - ev.damage);
      if (pick.slot.health <= 0) {
        this.stats.buildingsDestroyed++;
        this.addLog(`Weapon mount ${pick.slot.id.toUpperCase()} was DESTROYED by ${creature.name}!`, 'danger');
      } else {
        if (isOverDeck || creature.defId === 'thunder_leviarch') {
          this.addLog(`[AERIAL DECK STRIKE] ${creature.name} hovering over deck hit weapon mount ${pick.slot.id.toUpperCase()} for ${Math.round(ev.damage)} DMG!`, 'danger');
        } else {
          this.addLog(`${creature.name} damaged weapon mount ${pick.slot.id.toUpperCase()} (${Math.round(pick.slot.health)}/${pick.slot.maxHealth}).`, 'warn');
        }
        if (random() < ev.stunChance) {
          pick.slot.isStunned = true;
          pick.slot.stunTimer = ev.stunDuration;
          this.addLog(`Weapon mount ${pick.slot.id.toUpperCase()} hit & stunned for ${ev.stunDuration}s!`, 'warn');
        }
      }
    }
  }

  /** Per-creature, per-projectile dodge decisions (rolled once per projectile). */
  private dodgeRolls: Map<string, Map<string, 'skip' | 'dodge' | 'planned'>> = new Map();

  /**
   * Projectile dodging: creatures with dodgeChance sidestep incoming projectiles that are slower than themselves
   * (they can see and outrun them — e.g. grenades vs the Leviarch). Fast rounds (Gatling 1000 m/s vs 900 m/s)
   * are never dodged. No dodging while submerged, hovering over the deck (committed attack) or stunned.
   */
  applyProjectileDodge(creature: CreatureRuntimeInstance, def: CreatureDef, dt: number) {
    const chance = def.dodgeChance ?? 0;
    if (chance <= 0 || creature.isSwarm) return;

    // The sidestep is an offset from the behavior path: it grows during a dodge, then eases back (~0.5 s)
    if ((creature.dodgeTimer ?? 0) > 0) {
      creature.dodgeOffX = (creature.dodgeOffX ?? 0) + (creature.dodgeVx ?? 0) * dt;
      creature.dodgeOffY = (creature.dodgeOffY ?? 0) + (creature.dodgeVy ?? 0) * dt;
      creature.dodgeTimer = Math.max(0, (creature.dodgeTimer ?? 0) - dt);
    } else if (creature.dodgeOffX || creature.dodgeOffY) {
      const k = Math.exp(-2.0 * dt);
      creature.dodgeOffX = (creature.dodgeOffX ?? 0) * k;
      creature.dodgeOffY = (creature.dodgeOffY ?? 0) * k;
      if (Math.hypot(creature.dodgeOffX, creature.dodgeOffY) < 0.5) { creature.dodgeOffX = 0; creature.dodgeOffY = 0; }
    }
    // Measured path velocity (some nodes move the creature by position, so vx/vy can be stale)
    const mvx = creature.dodgePrevX !== undefined ? (creature.x - creature.dodgePrevX) / Math.max(1e-6, dt) : creature.vx;
    const mvy = creature.dodgePrevY !== undefined ? (creature.y - creature.dodgePrevY) / Math.max(1e-6, dt) : creature.vy;
    creature.dodgePrevX = creature.x;
    creature.dodgePrevY = creature.y;
    this.planProjectileDodge(creature, def, chance, mvx, mvy);
    creature.x += creature.dodgeOffX ?? 0;
    creature.y += creature.dodgeOffY ?? 0;
  }

  /**
   * Swarm shell evasion: members of a swarm (e.g. Veilfangs) inside the predicted blast of a lobbed shell break
   * away from the impact point once they notice it (reaction time), each with dodgeChance, at
   * move speed x dodgeSpeedMultiplier. Makes grenades weaker against swarms that see the shell coming.
   */
  applySwarmShellEvasion(creature: CreatureRuntimeInstance, def: CreatureDef, dt: number) {
    const chance = def.dodgeChance ?? 0;
    if (chance <= 0 || !creature.isSwarm || !creature.swarmEntities || creature.underwater) return;
    const reaction = def.dodgeReactionTime ?? 0.3;
    const fleeSpeed = knotsSpeedToPxPerSec(def.movementSpeed) * (def.dodgeSpeedMultiplier ?? 1.0);
    const roll = (key: string): number => {
      let h = 2166136261;
      for (let k = 0; k < key.length; k++) { h ^= key.charCodeAt(k); h = Math.imul(h, 16777619); }
      return ((h >>> 0) % 10000) / 10000;
    };
    for (const p of this.projectiles) {
      if (p.trajectory !== 'Arch' || p.isBeam || p.isExplosion || p.isCloud || !(p.aoe > 0)) continue;
      const fd = Math.max(0.25, p.flightDuration || 0.8);
      const age = p.arcProgress * fd, tRem = (1 - p.arcProgress) * fd;
      if (age < reaction || tRem <= 0.01) continue;
      const R = p.aoe + 15 + 4;
      creature.swarmEntities.forEach((ent, i) => {
        if (ent.hp <= 0) return;
        const dx = ent.x - p.targetX, dy = ent.y - p.targetY;
        const d = Math.hypot(dx, dy);
        if (d > R) return;
        if (roll(`${p.id}|${creature.id}|${i}`) >= chance) return;
        let ux = dx / Math.max(1e-6, d), uy = dy / Math.max(1e-6, d);
        if (d < 1) { const a = roll(`${p.id}|a|${i}`) * Math.PI * 2; ux = Math.cos(a); uy = Math.sin(a); }
        const step = Math.min(fleeSpeed * dt, R - d + 2);
        ent.x += ux * step; ent.y += uy * step;
        ent.vx = ux * fleeSpeed; ent.vy = uy * fleeSpeed;
      });
    }
  }

  private planProjectileDodge(creature: CreatureRuntimeInstance, def: CreatureDef, chance: number, vx: number, vy: number) {
    if (creature.underwater || creature.isHoveringDeck || creature.stunned) return;
    // Evaluate threats from the displayed position (path + current offset)
    const offX = creature.dodgeOffX ?? 0, offY = creature.dodgeOffY ?? 0;
    const cx = creature.x + offX, cy = creature.y + offY;

    const ownSpeedPx = knotsSpeedToPxPerSec(def.movementSpeed);
    const reaction = def.dodgeReactionTime ?? 0.3;
    let rolls = this.dodgeRolls.get(creature.id);
    if (!rolls) { rolls = new Map(); this.dodgeRolls.set(creature.id, rolls); }
    const live = new Set<string>();

    for (const p of this.projectiles) {
      if (p.isBeam || p.isExplosion || p.isCloud) continue;
      live.add(p.id);
      let speedPx: number, impactX: number, impactY: number, tRem: number, age: number;
      if (p.trajectory === 'Arch') {
        const fd = Math.max(0.25, p.flightDuration || 0.8);
        speedPx = distance(p.sourceX, p.sourceY, p.targetX, p.targetY) / fd;
        impactX = p.targetX; impactY = p.targetY;
        tRem = (1 - p.arcProgress) * fd; age = p.arcProgress * fd;
      } else {
        speedPx = Math.hypot(p.vx, p.vy);
        if (speedPx <= 0) continue;
        const t = Math.max(0, ((cx - p.x) * p.vx + (cy - p.y) * p.vy) / (speedPx * speedPx));
        impactX = p.x + p.vx * t; impactY = p.y + p.vy * t;
        tRem = t; age = this.timeElapsed - p.createdTime;
      }
      // Lobbed (Arch) shells are telegraphed and always dodgeable; straight shots only when slower than the creature
      if (p.trajectory !== 'Arch' && speedPx >= ownSpeedPx) continue;
      if (age < reaction || tRem <= 0.02) continue;

      // Is the impact near my projected path (straight or along my current turn) at any time before landing?
      const turnRad = ((creature.turnRate ?? 0) * Math.PI) / 180;
      const threatRadius = creature.radius + (p.aoe || 0) + 5;
      let miss = distance(impactX, impactY, cx, cy);
      {
        let ax = cx, ay = cy, avx = vx, avy = vy;
        const steps = 8, h = tRem / steps;
        for (let k = 1; k <= steps; k++) {
          const c = Math.cos(turnRad * h), sn = Math.sin(turnRad * h);
          const nvx = avx * c - avy * sn; avy = avx * sn + avy * c; avx = nvx;
          ax += avx * h; ay += avy * h;
          const lx = cx + vx * h * k, ly = cy + vy * h * k;
          miss = Math.min(miss, distance(impactX, impactY, ax, ay), distance(impactX, impactY, lx, ly));
        }
      }
      if (miss > threatRadius) continue;

      let decision = rolls.get(p.id);
      if (decision === undefined) { decision = random() < chance ? 'dodge' : 'skip'; rolls.set(p.id, decision); }
      if (decision !== 'dodge') continue; // skipped roll, or this shell's dodge is already planned

      // Sidestep perpendicular to heading, toward the side away from the impact point, at full sidestep speed
      const sp = Math.hypot(vx, vy);
      let px = sp > 1e-3 ? -vy / sp : 1, py = sp > 1e-3 ? vx / sp : 0;
      if ((impactX - cx) * px + (impactY - cy) * py > 0) { px = -px; py = -py; }
      const lateral = Math.abs((impactX - cx) * px + (impactY - cy) * py);
      const needed = Math.max(0, threatRadius - lateral) + 10;
      const dodgeSpeed = ownSpeedPx * (def.dodgeSpeedMultiplier ?? 1.0);
      creature.dodgeVx = px * dodgeSpeed;
      creature.dodgeVy = py * dodgeSpeed;
      creature.dodgeTimer = Math.min(tRem, needed / Math.max(1e-3, dodgeSpeed));
      rolls.set(p.id, 'planned');
      this.stats.projectilesDodged = (this.stats.projectilesDodged ?? 0) + 1;
      break;
    }
    for (const id of rolls.keys()) if (!live.has(id)) rolls.delete(id);
  }

  /** Damages a deck building slot, applying crew casualties inside it. Returns true if the building was destroyed. */
  damageBuildingSlot(slot: BuildingSlot, damage: number): boolean {
    slot.health = Math.max(0, slot.health - damage);
    slot.hitFlashTimer = 0.6;
    this.stats.totalDamageTakenByBehemoth += damage;
    const crewHp = this.behemoth.crewMemberHp || CREW_HP;
    if (slot.assignedCrew > 0) {
      const crewCasualties = Math.min(
        slot.assignedCrew,
        Math.max(slot.health <= 0 ? 1 : 0, Math.floor(damage / (crewHp * 2)))
      );
      if (crewCasualties > 0) {
        slot.assignedCrew -= crewCasualties;
        this.behemoth.crew = Math.max(0, this.behemoth.crew - crewCasualties);
        this.stats.crewLost += crewCasualties;
        this.addLog(`${crewCasualties} crew casualties inside ${slot.building!.name}!`, 'danger');
      }
    }
    if (slot.health <= 0) {
      this.stats.buildingsDestroyed++;
      return true;
    }
    return false;
  }

  /** Spike volley: `count` Physical spikes, each hitting a random target among the hull and living deck buildings. */
  /** Visual-only spike flights (Leviarch Spike Volley): from the creature to each hit point. */
  spikeVisuals: Array<{ x1: number; y1: number; x2: number; y2: number; age: number; delay: number }> = [];

  /** World point a spike lands on: a random spot on the hull, or the building it hit. */
  private spikeImpactPoint(slot?: BuildingSlot): { x: number; y: number } {
    if (slot) return getBuildingSlotWorldPosition(slot, this.vesselCenter, this.behemoth.heading);
    const lx = (random() - 0.5) * this.vesselCenter.width * 0.85;
    const ly = (random() - 0.5) * this.vesselCenter.height * 0.8;
    return deckLocalToWorld(lx, ly, this.vesselCenter, this.behemoth.heading);
  }

  applySpikeVolley(creature: CreatureRuntimeInstance, count: number, damagePerSpike: number) {
    creature.damagePulseTimer = 0.55;
    creature.damagePulseColor = '#e7dcc4';
    let hullHits = 0;
    const buildingHits: string[] = [];
    for (let i = 0; i < count; i++) {
      const liveBuildings = this.behemoth.buildingSlots.filter((b) => b.building && b.health > 0);
      const pickIndex = Math.floor(random() * (liveBuildings.length + 1)); // index == length -> hull
      const hitSlot = pickIndex >= liveBuildings.length ? undefined : liveBuildings[pickIndex];
      const impact = this.spikeImpactPoint(hitSlot);
      this.spikeVisuals.push({ x1: creature.x, y1: creature.y, x2: impact.x, y2: impact.y, age: 0, delay: i * 0.06 });
      if (pickIndex >= liveBuildings.length) {
        this.behemoth.hullHp = Math.max(0, this.behemoth.hullHp - damagePerSpike);
        this.behemoth.hullHitFlash = 0.5;
        this.stats.totalDamageTakenByBehemoth += damagePerSpike;
        hullHits++;
      } else {
        const slot = liveBuildings[pickIndex];
        const destroyed = this.damageBuildingSlot(slot, damagePerSpike);
        buildingHits.push(slot.building!.name);
        if (destroyed) this.addLog(`${slot.building!.name} was DESTROYED by ${creature.name}'s spikes!`, 'danger');
      }
    }
    const parts: string[] = [];
    if (hullHits > 0) parts.push(`hull ×${hullHits}`);
    if (buildingHits.length > 0) parts.push(buildingHits.join(', '));
    this.addLog(
      `[SPIKE VOLLEY] ${creature.name} fired ${count} spikes (${damagePerSpike} Physical each): ${parts.join(' | ')}`,
      'danger'
    );
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

    // Trigger visual swarm assault pulse
    creature.damagePulseTimer = 0.45;
    creature.damagePulseColor = '#f97316';

    if (ev.target === 'crew') {
      const crewHp = this.behemoth.crewMemberHp || CREW_HP;
      const killed = Math.min(this.behemoth.crew, Math.max(1, Math.round(ev.damage / crewHp)));
      this.behemoth.crew -= killed;
      this.stats.crewLost += killed;
      this.behemoth.hullHitFlash = 0.35;

      // If targeted to a specific building slot, deduct from that building's assigned crew first
      if (ev.targetSlotId) {
        const bSlot = this.behemoth.buildingSlots.find((b) => b.id === ev.targetSlotId);
        if (bSlot) {
          bSlot.hitFlashTimer = 0.6;
          if (bSlot.assignedCrew > 0) {
            bSlot.assignedCrew = Math.max(0, bSlot.assignedCrew - killed);
          }
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
        bSlot.hitFlashTimer = 0.6;
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

  updateCreatureDefs(creatures: CreatureDef[]) {
    this.creatureDefs = new Map(creatures.map((c) => [c.id, c]));
    for (const c of this.creatures) {
      const def = this.creatureDefs.get(c.defId);
      if (def) {
        c.emoji = def.emoji;
        c.name = def.name;
        c.color = def.iconColor;
        c.crowdDispersion = def.crowdDispersion;
        c.radius = metersToPx(def.radius); // live collision radius updates from the Balancing panel
      }
    }
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
    // Uniform aim spread: ±spreadDeg
    const spreadRad = (((random() * 2 - 1) * (w.spreadDeg ?? 0)) * Math.PI) / 180;

    if (w.trajectory === 'Arch') {
      // Ballistic Arch Mortar
      const pSpeed = metersToPx(w.projectileSpeed > 0 ? w.projectileSpeed : 750); // m/s -> px/s
      const fDuration = Math.max(0.35, distance(fromX, fromY, aimedX, aimedY) / pSpeed);
      this.projectiles.push({
        id: `mortar_${Date.now()}_${random()}`,
        sourceSlotId: slot.id, weaponId: slot.weapon?.id,
        sourceX: fromX,
        sourceY: fromY,
        x: fromX,
        y: fromY,
        targetX: fromX + Math.cos(aimRadNow + spreadRad) * aimDist,
        targetY: fromY + Math.sin(aimRadNow + spreadRad) * aimDist,
        vx: 0,
        vy: 0,
        damageType: w.damageType,
        dpp: w.dpp,
        pushback: w.pushback,
        aoe: metersToPx(w.aoe), // def m -> runtime px
        aoeFalloff: w.aoeFalloff ?? 0,
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

    // Standard Line kinetic projectile: uniform ±spread, launched from a random point across the barrel width
    const finalRad = aimRadNow + spreadRad;
    const muzzleOffset = (random() * 2 - 1) * shootingAreaPx(w);
    const startX = fromX - Math.sin(aimRadNow) * muzzleOffset;
    const startY = fromY + Math.cos(aimRadNow) * muzzleOffset;

    const projSpeedPx = metersToPx(w.projectileSpeed); // m/s -> px/s
    const vx = Math.cos(finalRad) * projSpeedPx;
    const vy = Math.sin(finalRad) * projSpeedPx;

    this.projectiles.push({
      id: `proj_${Date.now()}_${random()}`,
      sourceSlotId: slot.id, weaponId: slot.weapon?.id,
      sourceX: startX,
      sourceY: startY,
      x: startX,
      y: startY,
      targetX: target.x,
      targetY: target.y,
      vx,
      vy,
      maxTravelPx: weaponDistancePx(w),
      traveledPx: 0,
      damageType: w.damageType,
      dpp: w.dpp,
      pushback: w.pushback,
      aoe: metersToPx(w.aoe), // def m -> runtime px
      trajectory: 'Line',
      arcProgress: 0,
      arcHeight: 0,
      color: w.color,
      createdTime: this.timeElapsed,
      duration: 0.1,
    });
  }

  /** Who is dealing the damage currently being applied (for Neutral retaliation). Turrets/crew = Behemoth. */
  damageSource: { kind: 'behemoth' | 'creature'; id: string | null } = { kind: 'behemoth', id: null };

  /** Sets a creature's aggression meter (manual slider) and updates its state immediately. */
  setCreatureAggression(creatureId: string, value: number) {
    const c = this.creatures.find((x) => x.id === creatureId);
    const def = c ? this.creatureDefs.get(c.defId) : undefined;
    if (!c || !def) return;
    c.aggression = Math.max(0, Math.min(100, value));
    c.aggressionState = aggressionStateFor(c.aggression, def);
  }

  /** Aggression meter: multiplicative reductions (unless locked) and the derived Retreat / Neutral / Pursue state. */
  updateAggression(creature: CreatureRuntimeInstance, def: CreatureDef, behemothInRadius: boolean, dt: number) {
    if (creature.retaliateTimer) creature.retaliateTimer = Math.max(0, creature.retaliateTimer - dt);
    const lastHp = creature.lastAggroHp ?? creature.hp;
    creature.lastAggroHp = creature.hp;
    if (!def.aggressionLocked) {
      // Taking damage raises aggression
      if (lastHp > creature.hp && creature.maxHp > 0) {
        const lostPct = ((lastHp - creature.hp) / creature.maxHp) * 100;
        creature.aggression = Math.min(100, creature.aggression + lostPct * (def.aggressionPerDamagePct ?? AGGRESSION_PER_DAMAGE_PCT));
      }
      if (!creature.hpAggroTriggered && creature.maxHp > 0 && creature.hp <= creature.maxHp * (1 - HP_LOSS_TRIGGER)) {
        creature.hpAggroTriggered = true;
        creature.aggression *= HP_LOSS_AGGRESSION_MUL;
        this.addLog(`[AGGRESSION] ${creature.name} lost over ${Math.round(HP_LOSS_TRIGGER * 100)}% HP: aggression -${Math.round((1 - HP_LOSS_AGGRESSION_MUL) * 100)}% (${Math.round(creature.aggression)}%)`, 'info');
      }
      if (behemothInRadius) {
        creature.outOfAggroTimer = 0;
      } else {
        creature.outOfAggroTimer = (creature.outOfAggroTimer || 0) + dt;
        if (creature.outOfAggroTimer >= OUT_OF_RADIUS_SECONDS) {
          creature.outOfAggroTimer = 0;
          creature.aggression *= OUT_OF_RADIUS_AGGRESSION_MUL;
          this.addLog(`[AGGRESSION] Behemoth outside ${creature.name}'s aggro radius for ${OUT_OF_RADIUS_SECONDS}s: aggression -${Math.round((1 - OUT_OF_RADIUS_AGGRESSION_MUL) * 100)}% (${Math.round(creature.aggression)}%)`, 'info');
        }
      }
    }
    const next = aggressionStateFor(creature.aggression, def);
    if (next !== creature.aggressionState) {
      if (creature.aggressionState) {
        const label = next === 'pursue' ? 'PURSUE' : next === 'neutral' ? 'NEUTRAL' : 'RETREAT';
        this.addLog(`[STATE] ${creature.name} -> ${label} (aggression ${Math.round(creature.aggression)}%)`, next === 'pursue' ? 'warn' : 'info');
      }
      creature.aggressionState = next;
    }
  }

  /** Pursue target: nearest hated entity within aggro radius (sticky). The Behemoth stays a target while hated. */
  selectTarget(
    creature: CreatureRuntimeInstance, def: CreatureDef, aggroRadiusPx: number, distToBehemothPx: number
  ): { kind: 'behemoth' } | { kind: 'creature'; creature: CreatureRuntimeInstance } | null {
    const hatesBehemoth = hates(this.hateMatrix, def.id, BEHEMOTH_ID);
    let best: { kind: 'behemoth' } | { kind: 'creature'; creature: CreatureRuntimeInstance } | null = null;
    let bestDist = Infinity;
    if (hatesBehemoth && distToBehemothPx <= aggroRadiusPx) { best = { kind: 'behemoth' }; bestDist = distToBehemothPx; }
    for (const other of this.creatures) {
      if (other === creature || other.hp <= 0 || other.fleetRole === 'craft' || !hatesIds(this.hateMatrix, [def.id], this.hateIdsOf(other))) continue;
      let d = distance(creature.x, creature.y, other.x, other.y);
      if (d > aggroRadiusPx) continue;
      if (creature.targetCreatureId === other.id) d *= 0.6; // stickiness: keep the current target unless another is much closer
      if (d < bestDist) { bestDist = d; best = { kind: 'creature', creature: other }; }
    }
    if (best) return best;
    // Nothing hated in radius: keep hunting the Behemoth if hated (aggression erodes while it stays away)
    return hatesBehemoth ? { kind: 'behemoth' } : null;
  }

  /** Neutral retaliation: fight back against the last attacker while the retaliation timer runs. */
  resolveRetaliation(creature: CreatureRuntimeInstance): { kind: 'behemoth' } | { kind: 'creature'; creature: CreatureRuntimeInstance } | null {
    if (creature.retaliateKind === 'behemoth') return { kind: 'behemoth' };
    if (creature.retaliateKind === 'creature' && creature.retaliateId) {
      const attacker = this.creatures.find((c) => c.id === creature.retaliateId && c.hp > 0);
      if (attacker && attacker !== creature) return { kind: 'creature', creature: attacker };
    }
    return null;
  }

  /** Retreat: flee from the nearest threat (Behemoth or hated / attacking creature) at full speed. */
  applyRetreat(creature: CreatureRuntimeInstance, def: CreatureDef, dt: number, holdRadiusPx?: number) {
    let fx = this.vesselCenter.x, fy = this.vesselCenter.y;
    let nearest = distance(creature.x, creature.y, fx, fy);
    for (const other of this.creatures) {
      if (other === creature || other.hp <= 0) continue;
      const threat = hatesIds(this.hateMatrix, this.hateIdsOf(other), [def.id]) || (creature.retaliateKind === 'creature' && creature.retaliateId === other.id);
      if (!threat) continue;
      const d = distance(creature.x, creature.y, other.x, other.y);
      if (d < nearest) { nearest = d; fx = other.x; fy = other.y; }
    }
    let away = Math.atan2(creature.y - fy, creature.x - fx);
    let speed = knotsSpeedToPxPerSec(def.movementSpeed);
    if (holdRadiusPx !== undefined) {
      // 'stay' retreat: keep away from the Behemoth but hold near the aggro radius edge (circle it slowly)
      const dB = distance(creature.x, creature.y, this.vesselCenter.x, this.vesselCenter.y);
      if (dB >= holdRadiusPx) {
        const fromShip = Math.atan2(creature.y - this.vesselCenter.y, creature.x - this.vesselCenter.x);
        const pull = Math.min(1, (dB - holdRadiusPx) / Math.max(1, holdRadiusPx * 0.1));
        away = fromShip + Math.PI / 2 + pull * (Math.PI / 4); // tangent, leaning inward when drifting out
        speed *= 0.4;
      }
    }
    const blend = Math.min(1, 3 * dt);
    creature.vx = (creature.vx || 0) * (1 - blend) + Math.cos(away) * speed * blend;
    creature.vy = (creature.vy || 0) * (1 - blend) + Math.sin(away) * speed * blend;
    creature.x += creature.vx * dt;
    creature.y += creature.vy * dt;
    creature.angle = (away * 180) / Math.PI;
    creature.stage = 'Retreating';
    if (creature.isSwarm && creature.swarmEntities) {
      for (const ent of creature.swarmEntities) {
        if (ent.hp <= 0) continue;
        ent.x += (creature.vx || 0) * dt;
        ent.y += (creature.vy || 0) * dt;
        ent.vx = creature.vx; ent.vy = creature.vy;
      }
    }
  }

  /** A small virtual "deck" centred on a target creature, so behavior trees can attack it like the Behemoth. */
  virtualTargetFrame(t: CreatureRuntimeInstance) {
    const sp = Math.hypot(t.vx || 0, t.vy || 0);
    return {
      x: t.x, y: t.y,
      width: VIRTUAL_TARGET_WIDTH, height: VIRTUAL_TARGET_HEIGHT,
      heading: t.angle || 0,
      speed: sp / knotsSpeedToPxPerSec(1),
    };
  }

  /** Creature vs creature: map an attack event to damage on the target creature (Physical; drains use % of max HP). */
  applyCreatureAttack(attacker: CreatureRuntimeInstance, def: CreatureDef, target: CreatureRuntimeInstance, ev: any, dt: number) {
    let dmg = 0;
    if (ev.type === 'SHORT_CIRCUIT_DRAIN') dmg = target.maxHp * ((def.drainRatePct ?? 4) / 100) * dt;
    else if (ev.type === 'SHOOT_DECK' && def.canShootDeck) dmg = Math.max(1, Math.round(ev.spikeCount ?? def.spikeCount ?? 5)) * (ev.spikeDamage ?? def.spikeDamage ?? 30);
    else if (typeof ev.damage === 'number' && ev.damage > 0) dmg = ev.damage;
    if (dmg <= 0 || target.hp <= 0) return;
    const prev = this.damageSource;
    this.damageSource = { kind: 'creature', id: attacker.id };
    this.applyDamageToCreature(target, 'Physical', dmg, 0, target.x, target.y, 0, false);
    this.damageSource = prev;
    attacker.damagePulseTimer = 0.4;
    attacker.damagePulseColor = '#f472b6';
    if (ev.type !== 'SHORT_CIRCUIT_DRAIN') this.addLog(`[INFIGHT] ${attacker.name} hit ${target.name} for ${Math.round(dmg)} DMG`, 'warn');
  }

  /** Is a world point inside a mount's chemical spray cone (trapezoid around the mount facing)? */
  isInMountSpray(w: WeaponDef, mx: number, my: number, facingDeg: number, x: number, y: number, radiusPx = 0): boolean {
    const rad = (facingDeg * Math.PI) / 180;
    const dx = x - mx, dy = y - my;
    const f = dx * Math.cos(rad) + dy * Math.sin(rad);
    const l = -dx * Math.sin(rad) + dy * Math.cos(rad);
    return isInsideSprayCone(w, f, l, radiusPx);
  }

  /**
   * Energy beams and Chemical sprays: continuous damage per second during a burst (fireDuration), one ammo unit
   * (ammoPerShot) per burst, then cooldownDuration. The burst timer only runs while emitting.
   */
  updateContinuousWeapon(slot: WeaponSlot, w: WeaponDef, mx: number, my: number, facingDeg: number, isOnTarget: boolean, dt: number) {
    if (!isOnTarget || this.behemoth.accumulatorOverloaded) {
      slot.isFiring = false;
      slot.beamActive = false;
      return;
    }
    if (!slot.burstAmmoPaid) {
      if (slot.currentAmmo < w.ammoPerShot) {
        slot.isReloading = true;
        slot.reloadProgress = 0;
        slot.isFiring = false;
        slot.beamActive = false;
        return;
      }
      slot.currentAmmo -= w.ammoPerShot;
      slot.totalChargesUsed = (slot.totalChargesUsed || 0) + w.ammoPerShot;
      this.stats.totalAmmoConsumed[w.ammoType] = (this.stats.totalAmmoConsumed[w.ammoType] || 0) + w.ammoPerShot;
      slot.burstAmmoPaid = true;
    }

    slot.isFiring = true;
    slot.beamActive = true;
    this.activeWeaponId = w.id;
    if (isBeamWeapon(w)) this.applyBeamTick(slot, w, mx, my, dt);
    else this.applySprayTick(slot, w, mx, my, facingDeg, dt);
    this.activeWeaponId = null;

    slot.currentFireDuration += dt;
    if (slot.currentFireDuration >= (w.fireDuration || 3.0)) {
      slot.isCoolingDown = true;
      slot.cooldownDurationRemaining = w.cooldownDuration || 2.0;
      slot.currentFireDuration = 0;
      slot.isFiring = false;
      slot.beamActive = false;
      slot.burstAmmoPaid = false;
      if (slot.currentAmmo < w.ammoPerShot) {
        slot.isReloading = true;
        slot.reloadProgress = 0;
        this.addLog(`[RECHARGE] Mount ${slot.id.toUpperCase()} (${w.name}): Charges depleted -> Recharging / Loading ${w.packName || w.ammoType} (${w.reloadTime}s)`, 'warn');
      }
    }
  }

  /** Energy beam: a line as wide as the barrel along the turret aim; damages only the first target it touches. */
  applyBeamTick(slot: WeaponSlot, w: WeaponDef, mx: number, my: number, dt: number) {
    const rad = (slot.currentAimAngle * Math.PI) / 180;
    const ux = Math.cos(rad), uy = Math.sin(rad);
    const maxLen = Math.min(weaponDistancePx(w), 6000);
    const halfWidth = shootingAreaPx(w);
    let best: { creature: CreatureRuntimeInstance; t: number; x: number; y: number } | null = null;
    const consider = (creature: CreatureRuntimeInstance, x: number, y: number, r: number) => {
      const dx = x - mx, dy = y - my;
      const t = dx * ux + dy * uy;
      if (t < 0 || t > maxLen + r) return;
      const lateral = Math.abs(-dx * uy + dy * ux);
      if (lateral > halfWidth + r) return;
      if (!best || t < best.t) best = { creature, t, x, y };
    };
    for (const creature of this.creatures) {
      if (creature.hp <= 0) continue;
      if (creature.isSwarm && creature.swarmEntities) {
        for (const ent of creature.swarmEntities) if (ent.hp > 0) consider(creature, ent.x, ent.y, ent.radius || 12);
      } else {
        consider(creature, creature.x, creature.y, creature.radius);
      }
    }
    const hit = best as { creature: CreatureRuntimeInstance; t: number; x: number; y: number } | null;
    const len = hit ? hit.t : maxLen;
    if (hit) this.applyDamageToCreature(hit.creature, w.damageType, w.dps * dt, w.pushback * dt, hit.x, hit.y, 0, false);
    // Visual-only beam segment (lives one frame)
    this.projectiles.push({
      id: `beam_${slot.id}_${this.timeElapsed.toFixed(3)}`,
      sourceSlotId: slot.id, weaponId: slot.weapon?.id, sourceX: mx, sourceY: my, x: mx, y: my,
      targetX: mx + ux * len, targetY: my + uy * len, vx: 0, vy: 0,
      damageType: w.damageType, dpp: 0, pushback: 0, aoe: halfWidth, trajectory: 'Line',
      arcProgress: 0, arcHeight: 0, color: w.color, createdTime: this.timeElapsed,
      duration: dt * 1.5, isBeam: true, beamLifetime: 0, // survives this frame's projectile pass, replaced next frame
    });
  }

  /** Chemical spray: fills the mount's cone; every target inside takes dps (passes through). Leaves lingering clouds. */
  applySprayTick(slot: WeaponSlot, w: WeaponDef, mx: number, my: number, facingDeg: number, dt: number) {
    let firstHit: { x: number; y: number } | null = null;
    let nearest = Infinity;
    for (const creature of this.creatures) {
      if (creature.hp <= 0) continue;
      if (creature.isSwarm && creature.swarmEntities) {
        for (const ent of creature.swarmEntities) {
          if (ent.hp <= 0 || !this.isInMountSpray(w, mx, my, facingDeg, ent.x, ent.y, ent.radius || 12)) continue;
          this.applyDamageToCreature(creature, w.damageType, w.dps * dt, 0, ent.x, ent.y, 0, false);
          const d = distance(mx, my, ent.x, ent.y);
          if (d < nearest) { nearest = d; firstHit = { x: ent.x, y: ent.y }; }
        }
      } else if (this.isInMountSpray(w, mx, my, facingDeg, creature.x, creature.y, creature.radius)) {
        this.applyDamageToCreature(creature, w.damageType, w.dps * dt, w.pushback * dt, creature.x, creature.y, 0, false);
        const d = distance(mx, my, creature.x, creature.y);
        if (d < nearest) { nearest = d; firstHit = { x: creature.x, y: creature.y }; }
      }
    }
    // Lingering cloud at the nearest target every CLOUD_INTERVAL seconds of spraying
    slot.burstRemaining = (slot.burstRemaining || 0) - dt;
    if (firstHit && slot.burstRemaining <= 0 && (w.duration || 0) > 0) {
      slot.burstRemaining = SPRAY_CLOUD_INTERVAL_S;
      const hitPoint = firstHit as { x: number; y: number };
      this.projectiles.push({
        id: `cloud_${slot.id}_${this.timeElapsed.toFixed(3)}`,
        sourceSlotId: slot.id, weaponId: slot.weapon?.id, sourceX: hitPoint.x, sourceY: hitPoint.y, x: hitPoint.x, y: hitPoint.y,
        targetX: hitPoint.x, targetY: hitPoint.y, vx: 0, vy: 0,
        damageType: 'Chemical',
        dpp: (w.dps * SPRAY_CLOUD_DPS_SHARE) / 1.8, // cloud tick applies dpp * dt * 1.8
        pushback: 0, aoe: metersToPx(w.aoe || 30), trajectory: 'Line', arcProgress: 0, arcHeight: 0,
        color: w.color, createdTime: this.timeElapsed, duration: w.duration,
        isCloud: true, cloudRadius: metersToPx(w.aoe || 30), cloudDuration: 0, cloudMaxDuration: w.duration,
      });
    }
  }

  applyDamageToCreature(
    creature: CreatureRuntimeInstance,
    damageType: WeaponDef['damageType'],
    rawAmount: number,
    pushback: number,
    hitX?: number,
    hitY?: number,
    aoeRadius: number = 0,
    isAOEWeapon: boolean = false,
    aoeFalloff?: number
  ) {
    // Fleet power barrier: invulnerable
    if ((creature.invulnerableTimer ?? 0) > 0) return;
    // Per-target weapon multipliers (fleet vulnerabilities / resistances) for Behemoth weapons
    const tdef = this.activeWeaponId && this.damageSource.kind === 'behemoth' ? this.creatureDefs.get(creature.defId) : undefined;
    const weaponMul = tdef?.weaponMultipliers?.[this.activeWeaponId!] ?? 1;
    // Submerged targets take reduced damage (universal CombatConfig.underwaterDamageReduction)
    const effectiveRaw = (creature.underwater
      ? rawAmount * (1 - Math.max(0, Math.min(1, this.combatConfig.underwaterDamageReduction)))
      : rawAmount) * weaponMul;
    if (rawAmount > 0) {
      // Remember the attacker so Neutral creatures can fight back
      creature.retaliateKind = this.damageSource.kind;
      creature.retaliateId = this.damageSource.id;
      creature.retaliateTimer = RETALIATE_SECONDS;
    }

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
        const effectiveRadius = aoeRadius > 0 ? aoeRadius : 35;

        let totalHpLost = 0;
        let totalArmorLost = 0;

        for (const ent of creature.swarmEntities) {
          if (ent.hp <= 0) continue;
          const d = distance(blastCenter.x, blastCenter.y, ent.x, ent.y);
          if (d <= effectiveRadius + 15) {
            // Distance fall-off: centre = 100%, edge = (1 - weapon falloff); default edge 35%
            const f = Math.max(0, Math.min(1, aoeFalloff ?? 0.65));
            const falloff = Math.max(0, 1 - Math.min(1, d / (effectiveRadius + 15)) * f);
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

  /** Sets the deterministic RNG seed and resets the simulation so the run reproduces exactly. */
  setSimulationSeed(seed: number) {
    setSeed(seed);
    this.reset();
  }

  reset() {
    // Reseed so every reset replays the same random sequence for identical inputs
    setSeed(getSeed());
    this.vesselCenter.x = 500;
    this.vesselCenter.y = 310;
    this.vesselCenter.heading = 0;
    this.behemoth.heading = 0;
    this.behemoth.speed = 0;
    this.behemoth.targetSpeed = 10.0;
    this.behemoth.waypoints = [];
    this.behemoth.pathPoints = [];
    this.behemoth.isMoving = false;
    this.autoNavMode = 'off';
    this.autoNavCircle = null;
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
    this.behemoth.engineHp = this.behemoth.maxEngineHp ?? DEFAULT_ENGINE_HP;
    this.behemoth.slowTimer = 0;
    this.behemoth.slowPct = 0;
    this.behemoth.pacifyTimer = 0;

    this.creatures = [];
    this.projectiles = [];
    this.spikeVisuals = [];
    this.fleets.reset();
    this.productionDivertedSeconds = 0;
    this.divertedBuildings = 0;
    for (const b of this.behemoth.buildingSlots) b.isDiverted = false;
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
