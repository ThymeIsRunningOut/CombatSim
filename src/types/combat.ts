export type DamageType = 'Physical' | 'Energy' | 'Chemical';
export type TrajectoryType = 'Line' | 'Arch';
export type AmmoType = 'Kinetic Shells' | 'Energy Cells' | 'Biochem Fuel';

export interface WeaponDef {
  id: string;
  name: string;
  damageType: DamageType;
  // Combat Stats
  dpp: number;             // Damage per Projectile
  dps: number;             // Damage per Second
  fireRate: number;        // Shots per second during fire burst
  fireDuration: number;    // How many seconds weapon fires continuously before entering cooldown
  cooldownDuration: number;// How many seconds weapon cools down before next firing burst
  projectileSpeed: number; // Pixels / sec or knots
  trajectory: TrajectoryType;
  aoe: number;             // Area of Effect radius (px)
  range: number;           // Max distance F (px)
  coneRadius: number;      // Cone spread radius / angle
  shootingArc: number;     // Firing arc coverage (degrees)
  rotationCap?: number;    // Maximum turret traverse rotation cap in degrees (prevents inward rotation into deck, default: 225)
  turnSpeed?: number;      // Aim rotation speed (deg/s). Fast creatures out-run slow-turning weapons (default 120)
  duration: number;        // Beam duration or cloud lingering duration (seconds)
  pushback: number;        // Physics impulse applied on hit
  cooldown: number;        // Interval between individual projectile shots (1 / fireRate) or base delay
  // Resource Management
  ammoType: AmmoType;
  ammoCapacity: number;    // Magazine size / maximum charges
  packName?: string;       // Display name of charges pack (e.g. "Explosive Charges (30 charges)")
  chargesPerPack?: number; // Number of charges replenished per pack
  ammoPerShot: number;     // Consumption per projectile/burst
  reloadTime: number;      // Seconds to replenish ammo magazine
  powerDraw: number;       // kW drawn from Behemoth grid while operational/charging
  color: string;           // Visual beam/projectile color
}

export type CreatureStage = 'Underwater' | 'Surfacing' | 'Stalking' | 'Charging' | 'Striking' | 'Retreating';

/** What a dangerous creature's strikes damage on the Behemoth */
export type AttackTarget = 'buildings' | 'hull' | 'crew';

export type BuildingCategory = 'production' | 'energy' | 'housing' | 'service';
export type CrewAssignmentRole = 'job' | 'housing' | 'service';

export interface BuildingDef {
  id: string;
  name: string;
  description: string;
  category?: BuildingCategory;
  subCategory?: string;
  tier?: string;
  crewRole?: CrewAssignmentRole;
  maxHealth: number;
  powerBonus: number;      // kW added to total power capacity while operational
  powerDraw: number;       // kW consumed while active
  color: string;
  requiredCrew?: number;   // Minimum crew required to operate (default: 1, 0 for housing)
  maxCrew?: number;        // Maximum crew that can be stationed here (default: 6)
}

export interface BuildingSlot {
  id: string;
  slotIndex: number;
  row: 'misc_a' | 'misc_b';
  building: BuildingDef | null;
  health: number;
  maxHealth: number;
  isStunned: boolean;   // Stun mode: inactive and cannot be turned back on
  stunTimer: number;
  isOffline: boolean;   // Off after a stun until crew/power allow it to restart
  assignedCrew: number; // Active crew stationed in this building
}

export interface CreatureDef {
  id: string;
  name: string;
  description: string;
  // Balancing Stats
  hp: number;
  physicalArmor: number;     // Armor HP pool
  armorClass: number;        // Flat damage absorption per projectile
  energyResistance: number;  // 0.0 to 1.0 (percentile reduction)
  quantity: number;          // 1 for single behemoth-class, >1 for swarms
  
  // Movement & Kinematics
  movementSpeed: number;     // Knots / px per sec
  acceleration: number;
  deceleration: number;
  turningRate: number;       // Deg / sec
  aggroRadius: number;       // Distance that triggers pursuit/combat (px)
  
  // Behavior Timings (seconds)
  underwaterInterval: number; // Duration staying submerged
  surfaceInterval: number;    // Duration staying on surface
  chargeWindup: number;       // Windup duration before strike/ram
  strikeDuration: number;     // Exact contact window
  strikeCooldown: number;     // Interval before next charge
  strikeDamageRate: number;   // Damage per strike or % HP loss per second
  strikeStunChance: number;   // 0.0 to 1.0
  strikeStunDuration: number; // Seconds
  strikeRamMass: number;      // Ram impulse factor for Behemoth tilt physics
  canShootDeck?: boolean;     // e.g. Thunder Leviarch ranged deck attacks
  attackTarget?: AttackTarget; // What strikes damage: buildings, hull, or crew (default: hull)
  // 'orbit_drain' = Aetherfin-style Pursue: Charging (orbit, surface/depths cycle) then Attacking (drain buildings)
  pursueStyle?: 'default' | 'orbit_drain';
  chargeStageDuration?: number;   // s, Charging stage length (default 18)
  surfaceDuration?: number;       // s per surface interval while charging (default 3)
  depthsDuration?: number;        // s per depths interval while charging (default 3)
  attackDuration?: number;        // s, Attacking stage length (default 10)
  drainTargetCount?: number;      // buildings drained at once (default 4)
  drainRatePct?: number;          // % of building max HP lost per second (default 4)
  drainStunChance?: number;       // 0-1 chance per second that one drained building is stunned (default 0.10)
  drainStunDuration?: number;     // s a stunned building stays inactive (default 10)
  energyWeightDivisor?: number;   // building energy weight is divided by this and rounded up (default 4)
  deckAttackRange?: number;   // Ranged deck attack distance
  iconColor: string;
  radius: number;             // Physical collision size
  isFlying?: boolean;         // Flying (renders over boat) vs Non-Flying (renders under water)
  locomotionType?: 'flying' | 'non-flying';
}

export interface WeaponSlot {
  id: string;
  slotIndex: number;
  row: 'port' | 'starboard'; // Port (Top) / Starboard (Bottom)
  positionX: number;         // Normalized along ship length (0 to 1)
  weapon: WeaponDef | null;
  currentAmmo: number;
  totalChargesUsed?: number; // Cumulative count of projectile charges fired
  totalPacksLoaded?: number; // Cumulative count of packs/blocks loaded
  isReloading: boolean;
  reloadProgress: number;    // 0 to 1
  cooldownRemaining: number;
  currentAimAngle: number;   // In degrees
  rotationCap?: number;      // Turret traverse rotation cap override in degrees (default: 225)
  isFiring: boolean;
  burstRemaining: number;
  // Fire duration & Cooldown duration state
  isCoolingDown: boolean;
  cooldownDurationRemaining: number; // Timer for weapon cooling down
  currentFireDuration: number;       // How long currently fired in active burst
  isStunned: boolean;
  stunTimer: number;
  health: number;
  maxHealth: number;
  powerDrawActive: boolean;
}

export interface BehemothState {
  maxHullHp: number;
  hullHp: number;
  hullArmor: number;
  tiltAngle: number;         // Degrees (-45 to +45)
  tiltVelocity: number;      // Angular velocity
  maxTiltSafe: number;       // 35 degrees -> capsizing warning threshold
  isCapsized: boolean;
  totalPowerCapacity: number;// Max kW
  accumulatorCharge: number; // 0 to 100%
  accumulatorOverloaded: boolean;
  slots: WeaponSlot[];
  buildingSlots: BuildingSlot[];
  crew: number;              // Current living crew
  maxCrew: number;           // Starting crew quantity
  crewMemberHp: number;      // Amount of health per crew member (default: 20 HP)
}

export interface CreatureRuntimeInstance {
  id: string;
  defId: string;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  targetSlotId: string | null;
  hp: number;
  maxHp: number;
  physicalArmor: number;
  maxPhysicalArmor: number;
  armorClass: number;
  energyResistance: number;
  quantity: number;
  stage: CreatureStage;
  stageTimer: number;
  aggression: number;       // 0 to 100%
  underwater: boolean;      // True = submerged
  depthRatio: number;       // 0 (surface) to 1 (deep)
  stunned: boolean;
  stunTimer: number;
  isSwarm: boolean;
  swarmEntities: Array<{ x: number; y: number; hp: number; maxHp: number; vx?: number; vy?: number; radius?: number }>;
  // Orbit-drain pursue state (Aetherfin-style)
  pursuePhase?: 'charging' | 'attacking';
  chargeTimer?: number;
  phaseTimer?: number;          // time in current surface/depths interval
  drainTargets?: string[];      // ids of buildings / weapon mounts being drained
  drainSystemCount?: number;    // Behemoth systems drained to cover missing buildings
  drainStunAcc?: number;
  attackTimer?: number;
  drainArrived?: boolean;       // reached the hull; draining has begun
  color: string;
  radius: number;
  isFlying?: boolean;
  locomotionType?: 'flying' | 'non-flying';
  isBenchmarkTarget?: boolean;
}

export interface Projectile {
  id: string;
  sourceSlotId: string;
  sourceX: number;
  sourceY: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  damageType: DamageType;
  dpp: number;
  pushback: number;
  aoe: number;
  trajectory: TrajectoryType;
  arcProgress: number;      // For Arch trajectory (0 to 1)
  arcHeight: number;
  color: string;
  createdTime: number;
  duration: number;         // For continuous beams or cloud ticks
  isBeam?: boolean;
  beamLifetime?: number;
  isCloud?: boolean;
  cloudRadius?: number;
  cloudDuration?: number;
  cloudMaxDuration?: number;
}

export interface TTKResult {
  weaponId: string;
  weaponName: string;
  creatureId: string;
  creatureName: string;
  damageType: DamageType;
  timeToKillSeconds: number;
  shotsToKill: number;
  totalAmmoConsumed: number;
  effectiveDps: number;
  rawDps: number;
  penetrationRatio: number;
  status: 'OPTIMAL' | 'EFFECTIVE' | 'INEFFECTIVE' | 'IMMUNE';

  // Behavior & simulation adjustments
  theoreticalTtkSeconds?: number;
  behaviorTtkSeconds?: number;
  submersionUptimeRatio?: number;
  arcExposureRatio?: number;
  trackingRatio?: number;
  behaviorExposureRatio?: number;
  efficiencyRating?: 'EFFICIENT' | 'SEMI_EFFICIENT' | 'INEFFICIENT';
}

export interface CombatStatsSummary {
  totalDamageDealtToCreatures: number;
  totalDamageTakenByBehemoth: number;
  totalAmmoConsumed: Record<string, number>;
  peakPowerDraw: number;
  rammingEventsCount: number;
  criticalTiltsCount: number;
  crewLost?: number;
  buildingsDestroyed?: number;
}
