import { DamageType, AttackTarget } from './combat';

export type NodeCategory = 'action' | 'condition' | 'flow' | 'special';

export type ActionNodeType = 
  | 'approach' 
  | 'deal_damage' 
  | 'retreat' 
  | 'run_away' 
  | 'hide' 
  | 'wait_idle' 
  | 'scatter' 
  | 'reform'
  | 'boids_flock'
  | 'split_swarm_groups'
  | 'group_approach_building'
  | 'group_strike_target'
  | 'return_to_swarm'
  | 'charge_orbit'
  | 'short_circuit_drain'
  | 'flock_dissipate_regroup'
  | 'barrel_roll';

export type ConditionNodeType =
  | 'until_dealt_damage'
  | 'until_received_damage'
  | 'until_aggression'
  | 'for_seconds'
  | 'once'
  | 'health_threshold'
  | 'distance_check'
  | 'swarm_size'
  | 'formation_integrity';

export type FlowNodeType =
  | 'repeat'
  | 'branch_switch'
  | 'state_transition'
  | 'parallel_execute';

export type SpecialNodeType =
  | 'swarm_coordination'
  | 'phase_trigger'
  | 'event_listener';

export type BehaviorNodeType = ActionNodeType | ConditionNodeType | FlowNodeType | SpecialNodeType;

export type FormationType = 'grid' | 'circle' | 'wedge' | 'line';
export type ReformCenterPoint = 'leader' | 'target' | 'anchor';
export type ComparisonOp = '<=' | '>=' | '==' | '<' | '>';

export interface BehaviorNode {
  id: string;
  type: BehaviorNodeType;
  category: NodeCategory;
  name: string;
  x: number;
  y: number;
  stateId: string; // Belongs to a named state
  isCollapsed?: boolean;
  
  // Action Params
  speed?: number;             // Knots (Approach, Retreat, Run Away, Scatter, Reform, Barrel Roll)
  isFlying?: boolean;         // true = aerial layer (over deck), false = aquatic/water layer
  chance?: number;            // 0-1 (e.g. 0.70 for 70% true branch on branch_switch)
  minDistance?: number;       // px (Approach, Retreat)
  damage?: number;            // HP (Deal Damage)
  damageType?: DamageType;    // (Deal Damage)
  damageTarget?: AttackTarget; // buildings / hull / crew (Deal Damage); falls back to creature default
  cooldown?: number;          // sec (Deal Damage)
  duration?: number;          // sec (Hide, Wait/Idle, For Seconds)
  decayRate?: number;         // aerodynamic drag decay rate for wait_idle / apex glide
  minGlideSpeed?: number;     // px/s minimum glide speed maintained during aerial apex hover
  acceleration?: number;      // px/s^2 custom steering acceleration rate
  spreadRadius?: number;      // px (Scatter)
  randomDirections?: boolean; // (Scatter)
  scatterSpeed?: number;      // knots (Scatter)
  maxDistance?: number;       // px (Scatter)
  formationType?: FormationType; // (Reform, Swarm Coordination)
  reformSpeed?: number;       // knots (Reform)
  spacing?: number;           // px (Reform, Swarm Coordination)
  centerPoint?: ReformCenterPoint; // (Reform)

  // Swarm Groups & Boids Params
  groupMinSize?: number;      // Entities per group (default: 3)
  groupMaxSize?: number;      // Entities per group (default: 5)
  crewAttackChance?: number;  // 0-1 (e.g. 0.60 for 60% crew bias)
  flockSeparationDist?: number; // px
  targetBuildingSlotId?: string;

  // Reactive Scatter & Regroup Params
  dissipateDuration?: number; // sec (default: 0.8)
  formSquadsBeforeRegroup?: boolean; // Form squads to assault buildings before regrouping (default: true)
  squadAssaultDuration?: number; // sec (default: 2.2)
  regroupDuration?: number;   // sec (default: 2.2)
  reactionCooldown?: number;  // sec (default: 2.0)
  regroupAngleOffset?: number; // deg (default: 150)
  onHitNodeId?: string | null; // optional node branch when struck by weapon fire

  // Aetherfin Orbit & Drain Params
  orbitDirection?: 'counter_clockwise' | 'clockwise' | 'random';
  orbitRadius?: number;       // px
  surfaceInterval?: number;   // sec
  depthsInterval?: number;    // sec
  stageDuration?: number;     // sec
  drainTargetCount?: number;  // default 4
  drainRatePct?: number;      // default 4% / sec
  stunChance?: number;        // default 0.10 / sec
  stunDuration?: number;      // default 10s
  energyWeightDivisor?: number; // default 4

  // Condition Params
  targetDamage?: number;      // (Until Dealt Damage, Until Received Damage)
  targetAggression?: number;  // 0-100 (Until Aggression)
  aggressionOp?: ComparisonOp;
  executedOnce?: boolean;     // (Once)
  healthPercent?: number;     // 0-100 (Health Threshold)
  healthOp?: ComparisonOp;
  distanceThreshold?: number; // px (Distance Check)
  distanceOp?: ComparisonOp;
  targetSwarmSize?: number;   // (Swarm Size)
  swarmSizeOp?: ComparisonOp;
  targetFormationIntegrity?: number; // 0-100% (Formation Integrity)
  formationIntegrityOp?: ComparisonOp;

  // Flow Params
  repeatCount?: number;       // (Repeat: -1 for infinite, or N)
  isInfiniteRepeat?: boolean;
  targetStateName?: string;   // (State Transition)
  priority?: number;          // State transition priority

  // Special Params
  coherence?: number;         // 0-100% (Swarm Coordination)
  staggerDelay?: number;      // sec (Swarm Coordination)
  targetPhase?: number;       // (Phase Trigger)
  listenEvent?: 'HULL_RAMMED' | 'STUNNED' | 'MODULE_DESTROYED' | 'UNDER_ATTACK' | 'HP_LOW';

  // Connections
  nextNodeId?: string | null;
  trueNodeId?: string | null;
  falseNodeId?: string | null;
  parallelNodeIds?: string[];
}

export interface BehaviorConnection {
  id: string;
  sourceNodeId: string;
  sourceHandle: 'next' | 'true' | 'false' | 'parallel';
  targetNodeId: string;
}

export interface BehaviorState {
  id: string;
  name: string;
  isInitial?: boolean;
  priority: number;
  entryNodeId?: string | null;
  color?: string;
}

export interface CreatureBehaviorTree {
  id: string;
  creatureDefId: string;
  name: string;
  description: string;
  states: BehaviorState[];
  nodes: BehaviorNode[];
  connections: BehaviorConnection[];
}

export interface BehaviorRuntimeState {
  currentStateId: string;
  activeNodeId: string | null;
  activeNodeStartTime: number;
  nodeTimer: number;
  repeatCounters: Record<string, number>;
  dealtDamageCounter: number;
  receivedDamageCounter: number;
  onceFlags: Record<string, boolean>;
  formationIntegrity: number; // 0 - 100%
  currentPhase: number;
  scatterAngles?: number[];
  parallelActiveNodeIds?: string[];
  executionLog: string[];

  // Swarm Groups & Boids state
  swarmGroups?: Array<{
    id: string;
    entityIndices: number[];
    targetSlotId: string | null;
    targetX?: number;
    targetY?: number;
    state: 'cruising' | 'approaching' | 'striking' | 'returning';
    timer: number;
  }>;
  boidsVelocities?: Array<{ vx: number; vy: number }>;

  // Aetherfin Orbit & Drain state
  orbitAngle?: number;
  orbitSubTimer?: number;
  orbitIsSurfaced?: boolean;
  activeOrbitDirection?: 'counter_clockwise' | 'clockwise';
  drainTimer?: number;
  drainActiveTargets?: string[];
  lastLoggedAction?: string;

  // Reactive Scatter & Regroup state
  lastHitPoint?: { x: number; y: number; time: number } | null;
  lastScatterTime?: number;
  scatterPhase?: 'idle' | 'dissipating' | 'squad_assault' | 'regrouping';
  scatterTimer?: number;
  scatterEpicenter?: { x: number; y: number } | null;
  regroupWaypoint?: { x: number; y: number } | null;
}
