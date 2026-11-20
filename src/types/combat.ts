export type DamageType = 'Physical' | 'Energy' | 'Chemical';
export type TrajectoryType = 'Line' | 'Arch';
export type AmmoType = 'Kinetic Shells' | 'Energy Cells' | 'Biochem Fuel';

export interface WeaponDef {
  id: string;
  name: string;
  damageType: DamageType;
  // Combat Stats
  dpp: number;             // Damage per Projectile (Physical)
  dps: number;             // Damage per Second (Energy beam / Chemical cone)
  fireRate: number;        // Shots per second during a burst (Physical)
  fireDuration: number;    // Seconds a burst lasts before cooldown
  cooldownDuration: number;// Seconds of cooldown between bursts
  projectileSpeed: number; // m/s (Energy beams are instant)
  trajectory: TrajectoryType;
  aoe: number;             // Area of Effect radius (m); Chemical: lingering cloud radius
  aoeFalloff?: number;     // 0-1: share of AoE damage lost at the blast edge vs center for single targets (0 = none, default 0)
  // UE turret geometry (metric)
  coneRadius: number;      // Cone radius (m) at 1 m from the muzzle -> traverse half-angle = atan(coneRadius). 0 = fixed forward
  shootingArea: number;    // Barrel / muzzle radius (m): cone width at the muzzle, beam width, spray start width
  distance: number;        // Max projectile / beam / spray travel (m); 0 = infinite
  detectionRange: number;  // Engagement range (m): targets beyond it are ignored
  spreadDeg?: number;      // Uniform aim spread, ± degrees (Physical)
  turnSpeed?: number;      // Turret traverse speed inside the cone (deg/s, default 120)
  duration: number;        // Chemical: lingering cloud duration (s)
  pushback: number;        // Physics impulse applied on hit
  cooldown: number;        // Interval between individual projectile shots (1 / fireRate) or base delay
  // Resource Management
  ammoType: AmmoType;
  ammoCapacity: number;    // Magazine size / maximum charges
  packName?: string;       // Display name of charges pack (e.g. "Explosive Charges (30 charges)")
  chargesPerPack?: number; // Number of charges replenished per pack
  ammoPerShot: number;     // Consumption per projectile (Physical) or per burst (Energy / Chemical)
  reloadTime: number;      // Seconds to replenish ammo magazine
  powerDraw: number;       // kW drawn from Behemoth grid while operational/charging
  color: string;           // Visual beam/projectile color
}

/** Who attacks whom on sight: matrix[attacker][target]. Keys are entity type ids: 'behemoth' or a creature def id. */
export type HateMatrix = Record<string, Record<string, boolean>>;

/** Saved deck weapon arrangement: slot id (port_0..3, starboard_0..3, aft_0..1) -> weapon id or null (empty). */
export interface DeckLoadoutPreset {
  id: string;
  codeName: string;
  target?: string;   // creature / species id the loadout is meant for (optional)
  note?: string;     // how to play it
  slots: Record<string, string | null>;
}

/** Global combat rules shared by every entity. */
export interface CombatConfig {
  underwaterDamageReduction: number; // 0-1: damage reduction for any entity hit while submerged
  overdrivePowerDraw?: number;       // kW the engine draws at full Overdrive (15 kts); scales from 0 at cruise (10 kts). Default 1000
}

/** Behavior state derived from the aggression meter. */
export type AggressionState = 'retreat' | 'neutral' | 'pursue';

export type CreatureStage = 'Underwater' | 'Surfacing' | 'Stalking' | 'Charging' | 'Striking' | 'Retreating';

/** What a dangerous creature's strikes damage on the Behemoth */
export type AttackTarget = 'buildings' | 'hull' | 'crew';

/** 'job' abstracts every on-deck work slot (workshops, factories, labs, …). */
export type BuildingCategory = 'job' | 'energy' | 'housing' | 'service';
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
  isDiverted?: boolean; // Powered down: its energy is diverted to Overdrive (job / production buildings)
  hitFlashTimer?: number; // Red blink timer when hit by creature
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
  crowdDispersion?: number;  // Swarm crowd dispersion / separation distance in m (default: 61.5). Controls spread and AOE exposure (e.g. Grenade Launcher).
  
  // Movement & Kinematics
  movementSpeed: number;     // Knots / px per sec
  acceleration: number;
  deceleration: number;
  turningRate: number;       // Deg / sec
  aggroRadiusMeters?: number;// Distance in meters that triggers pursuit/combat (default: 1000m)
  aggroDropDuration?: number;// Consecutive seconds outside aggro radius to drop attack behavior (default: 10s)
  
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
  spikeCount?: number;        // Spike volley: projectiles per deck attack (default 5). Each picks a random target: hull or a building (turrets excluded)
  spikeDamage?: number;       // Spike volley: Physical damage per spike (default 30)
  dodgeChance?: number;       // 0-1: chance to sidestep a lobbed shell (any speed) or a straight shot slower than itself. Default 0
  dodgeReactionTime?: number; // s after launch before it can react (default 0.3)
  dodgeSpeedMultiplier?: number; // sidestep speed as a multiple of movement speed (default 1.0)
  scrapeCausesTilt?: boolean;
  // Aggression meter (0-100): < neutralThreshold = Retreat, < pursueThreshold = Neutral, else Pursue
  aggressionStart?: number;      // default 60
  neutralThreshold?: number;     // default 40
  pursueThreshold?: number;      // default 60
  aggressionLocked?: boolean;    // meter never changes on its own (manual slider still works)
  aggressionPerDamagePct?: number; // aggression gained per 1% of max HP lost (default 0.25)
  retreatMode?: 'leave' | 'stay';  // Retreat: 'leave' = flee and leave the battle (default); 'stay' = back off to the aggro radius edge and hold there
  // Hull/keel scrape applies friction tilt (default true). Leviarch Keel Scrape: false
  weaponMultipliers?: Record<string, number>; // incoming damage multiplier by Behemoth weapon id (fleet ships)
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
  deckAttackRange?: number;   // Ranged deck attack distance (m)
  iconColor: string;
  radius: number;             // Physical collision radius (m)
  emoji?: string;             // Customizable emoji icon for non-swarm creatures (e.g. ⚡, 🦑, 🐉, 🐋, 🦈)
  isFlying?: boolean;         // Flying (renders over boat) vs Non-Flying (renders under water)
  locomotionType?: 'flying' | 'non-flying';
}

/** Weapon mount rows: broadside port/starboard plus two stern (aft) mounts. */
export type WeaponRow = 'port' | 'starboard' | 'aft';

export interface WeaponSlot {
  id: string;
  slotIndex: number;
  row: WeaponRow; // Port (Top) / Starboard (Bottom) / Aft (stern)
  positionX: number;         // Normalized along ship length (0 to 1)
  weapon: WeaponDef | null;
  currentAmmo: number;
  totalChargesUsed?: number; // Cumulative count of projectile charges fired
  totalPacksLoaded?: number; // Cumulative count of packs/blocks loaded
  isReloading: boolean;
  reloadProgress: number;    // 0 to 1
  cooldownRemaining: number;
  currentAimAngle: number;   // In degrees
  rotationCap?: number;      // Optional per-mount traverse limit in degrees (deck protection); the weapon cone applies otherwise
  beamActive?: boolean;      // Energy/Chemical: currently emitting
  burstAmmoPaid?: boolean;   // Energy/Chemical: ammo already consumed for the current burst
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
  hitFlashTimer?: number; // Red blink timer when hit by creature
}

export interface BehemothState {
  maxHullHp: number;
  hullHp: number;
  hullArmor: number;
  engineHp?: number;         // Engine system (Phase 4): damage lowers the speed cap
  maxEngineHp?: number;
  slowTimer?: number;        // fleet slow effect: s left ...
  slowPct?: number;          // ... and max speed reduction %
  pacifyTimer?: number;      // fleet pacify effect: weapons cannot fire while > 0
  hullHitFlash?: number; // Red blink timer when hull is rammed/damaged
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
  crewStance: CrewStance;
  crewConfig: CrewSimulationConfig;
  // Navigation & Movement state
  heading: number;           // Degrees (0 = East / +X bow facing, 90 = South, etc.)
  speed: number;             // Current speed in Knots (0.0 to 15.0 kts, 1 kt = 8.25 m/s = 825 UU/s)
  targetSpeed: number;       // Commanded speed from speed slider/presets (0.0 to 15.0 Knots)
  turnRate: number;          // Max turning rate in deg/s (default: 15°/s)
  gear: 'forward' | 'reverse'; // Navigation gear: forward (default) or reverse
  isReversing: boolean;      // Whether vessel is actively reversing
  waypoints: Array<{ x: number; y: number }>;
  pathPoints: Array<{ x: number; y: number }>;
  isMoving: boolean;
  justArrivedAtFinalWaypoint?: boolean; // Set to true the frame Behemoth completes its route to final waypoint
  allowNoseAngle?: boolean;  // Whether path exits nose as a direct angle (true, avoids forward hook) or forced curve (false)
}

export type CrewStance = 'neutral' | 'hide' | 'attack';

export interface CrewSimulationConfig {
  minOnDeckPercent: number; // e.g. 25 (%)
  maxOnDeckPercent: number; // e.g. 65 (%)
  instaKillChance: number;  // 0 to 1 (e.g. 0.20 = 20%)
  hurtHiddenChance: number; // 0 to 1 (e.g. 0.30 = 30%)
  damageFrequency: number;  // attacks per second (e.g. 1.0)
  damageAmount: number;     // damage per strike on crew (e.g. 20)
  pdwDamage: number;        // crew PDW damage per shot (default: 2)
  pdwRange: number;         // crew PDW range in m (default: 125)
  pdwFireRate: number;      // crew PDW shots per second (default: 1.5)
}

export type CrewMemberStatus = 'idle' | 'wandering' | 'fleeing' | 'seeking_shelter' | 'hidden' | 'attacking' | 'snatched';

export interface CrewMemberAgent {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  status: CrewMemberStatus;
  targetSlotId: string | null;
  assignedHousingSlotId: string | null;
  assignedJobSlotId: string | null;
  hiddenInSlotId: string | null;
  snatchedByCreatureId: string | null;
  snatchedEntityIndex?: number;
  hp: number;
  maxHp: number;
  attackCooldown: number;
  targetCreatureId: string | null;
  wanderTimer: number;
}

export interface CrewPdwShot {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  color: string;
  lifetime: number;
  maxLifetime: number;
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
  crowdDispersion?: number; // Swarm crowd separation distance in m (from def)
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
  drainSide?: -1 | 1;           // hull side it latches onto while draining (-1 port, 1 starboard)
  color: string;
  radius: number;
  emoji?: string;               // Customizable emoji icon for non-swarm creatures
  isFlying?: boolean;
  locomotionType?: 'flying' | 'non-flying';
  isBenchmarkTarget?: boolean;
  altitudeRatio?: number;       // 0 (surface) to 1 (aerial jump apex)
  prevAngle?: number;           // For calculating angular turn rate
  turnRate?: number;            // Current turning velocity (deg/sec, signed)
  damagePulseTimer?: number;    // Countdown for attack shockwave pulse VFX
  damagePulseColor?: string;
  splashTimer?: number;         // Countdown for dive/surface splash effect
  splashType?: 'dive' | 'surface';
  lastUnderwater?: boolean;     // Tracks transition to detect dive/surface
  hullScrapeTimer?: number;     // Timer for continuous hull scraping when under vessel
  dodgeVx?: number;             // Active projectile-dodge sidestep velocity (px/s)
  dodgeVy?: number;
  dodgeTimer?: number;          // Remaining sidestep time (s)
  dodgeOffX?: number;           // Current sidestep offset from the behavior path (px)
  dodgeOffY?: number;
  dodgePrevX?: number;          // Previous path position (for measured velocity)
  dodgePrevY?: number;
  isHoveringDeck?: boolean;     // True when airborne over Behemoth deck
  isScrapingHull?: boolean;     // True when submerged under Behemoth hull
  flareTimer?: number;          // Leviarch Option 2: time spent holding / flaring over deck before forced dive
  flareDirection?: number;      // Leviarch Option 2: bank angle for evasive clear
  outOfAggroTimer?: number;     // Consecutive seconds Behemoth has been outside aggro radius
  aggressionState?: AggressionState;
  targetKind?: 'behemoth' | 'creature' | null; // current attack target (from the Hate Matrix)
  targetCreatureId?: string | null;
  retaliateKind?: 'behemoth' | 'creature' | null; // Neutral: fights back against its last attacker
  retaliateId?: string | null;
  retaliateTimer?: number;
  hpAggroTriggered?: boolean;   // the >60% HP-lost reduction already applied
  lastAggroHp?: number;         // HP at the last aggression update (damage taken raises aggression)
  escaped?: boolean;            // fled the battle (removed next tick)
  // Fleet units (Phase 4): ships, boarder boats and fireship craft share the creature runtime
  hateId?: string;              // Hate Matrix id (fleet species id); defaults to defId
  hateFactionId?: string;       // fleet units: faction id (more specific Hate Matrix entry)
  fleetId?: string;
  fleetRole?: 'ship' | 'boarder' | 'craft';
  shipTypeId?: string;
  formationIndex?: number;
  parentUnitId?: string;        // orbit_parent ships orbit this unit; boarders/craft return to / come from it
  weaponStates?: FleetWeaponState[];
  invulnerableTimer?: number;   // barrier
  barrierCooldown?: number;
  regenTimer?: number;
  regenCooldown?: number;
  boarderState?: 'crossing' | 'onboard' | 'returning';
  boarderDealt?: number;
  boarderTargetSlotId?: string | null;
  craftExploded?: boolean;
  orbitAngle?: number;
  homeX?: number;
  homeY?: number;
  isAggroed?: boolean;          // True = actively pursuing/attacking; False = dropped attack behavior
  aggroRadiusMeters?: number;   // Configured aggro radius in meters (default: 1000m)
  aggroDropDuration?: number;   // Duration outside aggro radius to drop attack behavior (default: 10.0s)
}

export interface Projectile {
  id: string;
  sourceSlotId: string;
  weaponId?: string;        // Behemoth weapon id (per-target weapon multipliers)
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
  maxTravelPx?: number;     // Line projectiles: despawn after this distance (weapon Distance)
  traveledPx?: number;
  aoe: number;
  aoeFalloff?: number;      // 0-1 share of damage lost at blast edge (single targets)
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
  flightDuration?: number;
  isExplosion?: boolean;
  explosionRadius?: number;
  explosionLifetime?: number;
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
  interceptRatio?: number;   // 1 = projectile can intercept; < 1 = projectile slower than target
  behaviorExposureRatio?: number;
  efficiencyRating?: 'EFFICIENT' | 'SEMI_EFFICIENT' | 'INEFFICIENT';
}

export interface TTKThresholds {
  efficient: number;
  inefficient: number;
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
  crewSnatched?: number;
  crewSaved?: number;
  projectilesDodged?: number;
}

// ============================================================================
// Fleets (Phase 4): Species = form + behavior + ship types; Faction = numbers per ship type
// ============================================================================

/** Locomotion layer of a fleet ship type. 'diving' ships cruise submerged and surface to use surface-only weapons. */
export type FleetLayer = 'surface' | 'aerial' | 'submerged' | 'diving';

/**
 * Fleet weapon archetypes:
 * cannon   projectile volley (count × damage) at the target
 * beam     continuous dps for `duration` while the target stays in range
 * dot      instant spray hit that leaves damage-over-time (dps for `duration`) on the target
 * pulse    instant area effect around the ship (damage + effects) on everything hated within range
 * melee    contact strike (range = contact distance)
 * boarding launches `count` boarder boats that cross to the deck and attack buildings and crew
 * fireship launches a shootable suicide craft that explodes on contact
 * ram      the ship itself charges the target, hits, then returns to its position (e.g. Auri blocks)
 */
export type FleetWeaponKind = 'cannon' | 'beam' | 'dot' | 'pulse' | 'melee' | 'boarding' | 'fireship' | 'ram';

/** What a hit on the Behemoth damages. 'random' = hull or a random building. */
export type FleetHitTarget = 'hull' | 'buildings' | 'crew' | 'engine' | 'random';

export interface FleetWeaponDef {
  id: string;
  name: string;
  kind: FleetWeaponKind;
  damageType: DamageType;
  damage: number;            // per projectile / strike / explosion; dps for beam and dot
  count?: number;            // projectiles per volley, boarders per launch (default 1)
  rangeM: number;            // engagement range (m)
  cooldown: number;          // s between uses
  duration?: number;         // s: beam length, DoT length, effect length
  projectileSpeed?: number;  // m/s (cannon, fireship craft, ram charge)
  spreadDeg?: number;        // cannon volley spread (±deg)
  target?: FleetHitTarget;   // default 'hull'
  requiresSurface?: boolean; // diving ships must surface to use it
  // Tier 2 effects on the Behemoth
  slowPct?: number;          // Behemoth max speed reduced by this % ...
  slowDuration?: number;     // ... for this many seconds
  shutdownCount?: number;    // systems (weapon mounts / buildings) shut down ...
  shutdownDuration?: number; // ... for this many seconds
  crewDps?: number;          // damage per second to crew on deck for `duration`
  tilt?: number;             // tilt impulse (deg/s) on hit
  pacifyDuration?: number;   // Behemoth weapons cannot fire for this many seconds
  selfSlowPct?: number;      // the firing ship moves slower while the weapon is active
  // Boarding
  boarderHp?: number;
  boarderDamage?: number;    // damage per second to buildings while on deck
  boarderSpeed?: number;     // kts
  boarderRetreatDamage?: number; // a boarder returns after dealing this much damage
  // Fireship / ram
  craftHp?: number;          // fireship craft HP (shootable)
  craftRadiusM?: number;
  aoeM?: number;             // explosion radius (m)
  /** Damage multiplier vs specific targets: keys are faction, species, creature ids or 'behemoth' (most specific wins). */
  targetMultipliers?: Record<string, number>;
}

export type FleetMovement = 'standoff' | 'close' | 'stationary' | 'orbit_parent';

export interface FleetShipTypeDef {
  id: string;
  name: string;
  count: number;             // ships of this type per fleet
  hp: number;
  armor: number;             // armor pool
  armorClass: number;
  energyResistance: number;  // 0-1
  speed: number;             // kts (surface / air)
  speedSubmerged?: number;   // kts while submerged (diving ships)
  radiusM: number;           // collision radius (m)
  layer: FleetLayer;
  movement: FleetMovement;
  preferredRangeM: number;   // standoff distance from the target (standoff) / orbit radius (orbit_parent)
  turnRate?: number;         // deg/s (default 90)
  emoji?: string;
  weaponMultipliers?: Record<string, number>; // incoming damage multiplier by Behemoth weapon id (vulnerability > 1, resistance < 1)
  weapons: FleetWeaponDef[];
  // Abilities
  barrierDuration?: number;  // on hit: invulnerable + immobile for this long ...
  barrierCooldown?: number;  // ... at most once per cooldown
  regenBelowPct?: number;    // regenerate when HP drops below this % ...
  regenPct?: number;         // ... healing this % of max HP ...
  regenDuration?: number;    // ... over this many seconds ...
  regenCooldown?: number;    // ... at most once per cooldown
  scatterOnHit?: boolean;    // break formation when hit
}

export interface FleetSpeciesDef {
  id: string;                // also the Hate Matrix id
  name: string;
  description: string;
  color: string;
  shipTypes: FleetShipTypeDef[];
  formationSpacingM: number; // spacing between ships in formation
  scatterDuration: number;   // s ships stay scattered after being hit
  routLossFraction: number;  // share of ships lost that triggers a rout (aggression x0.4); 0 = never
  aggroRadiusM: number;
  aggressionStart?: number;
  neutralThreshold?: number;
  pursueThreshold?: number;
  aggressionLocked?: boolean;
  aggressionPerDamagePct?: number;
  retreatMode?: 'leave' | 'stay';
}

/** Per ship type overrides: replaces the species numbers outright. Weapons are overridden per weapon id. */
export type FleetShipTypeOverride = Partial<Omit<FleetShipTypeDef, 'id' | 'weapons' | 'movement' | 'layer'>> & {
  weapons?: Record<string, Partial<Omit<FleetWeaponDef, 'id' | 'kind'>>>;
};

export interface FleetFactionDef {
  id: string;
  name: string;
  speciesId: string;
  color: string;
  overrides: Record<string, FleetShipTypeOverride>; // keyed by ship type id
}

/** Runtime fleet group (the ships themselves live in engine.creatures with fleetId set). */
export interface FleetRuntime {
  id: string;
  speciesId: string;
  factionId: string;
  name: string;
  color: string;
  aggression: number;
  aggressionState: AggressionState;
  initialShips: number;
  hpAggroTriggered: boolean;  // rout reduction already applied
  outOfAggroTimer: number;
  lastHpTotal?: number;
  scatterTimer: number;
  targetKind: 'behemoth' | 'creature' | null;
  targetCreatureId: string | null;
  retaliateKind?: 'behemoth' | 'creature' | null;
  retaliateId?: string | null;
  retaliateTimer?: number;
  formationAngle: number;     // deg, approach bearing of the formation around its target
}

/** Per-ship weapon runtime state. */
export interface FleetWeaponState {
  cooldown: number;
  activeTimer: number;        // beam / self-slow active time left
  rammingPhase?: 'charge' | 'return' | null;
}

export interface FleetShot {
  id: string;
  fleetId: string;
  sourceUnitId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetKind: 'behemoth' | 'creature';
  targetId: string | null;
  targetX: number;
  targetY: number;
  ttl: number;
  weapon: FleetWeaponDef;
  color: string;
}

export interface DeckEvent {
  id: string;
  time: number;
  text: string;
  kind: 'boarding' | 'impact' | 'system' | 'crew' | 'info';
}
