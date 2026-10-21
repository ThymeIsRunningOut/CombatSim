import {
  CreatureBehaviorTree,
  BehaviorNode,
  BehaviorRuntimeState,
  FormationType,
} from '../types/behavior';
import { CreatureRuntimeInstance, CreatureDef, WeaponSlot, AttackTarget, BuildingSlot } from '../types/combat';
import { distance, angleBetween } from './math';

export interface BehaviorRunnerTickResult {
  creature: CreatureRuntimeInstance;
  runtimeState: BehaviorRuntimeState;
  events: Array<{
    type: 'STRIKE_HULL' | 'SHOOT_DECK' | 'SUBMERGED' | 'SURFACED' | 'RAM_IMPACT' | 'SHORT_CIRCUIT_DRAIN' | 'GROUP_STRIKE';
    target?: AttackTarget;
    targetSlotId?: string;
    damage: number;
    stunChance: number;
    stunDuration: number;
    ramMass: number;
    strikeSide?: 'port' | 'starboard';
    isCrewStrike?: boolean;
    groupStrikeLog?: string;
  }>;
}

export function createInitialBehaviorRuntimeState(
  tree: CreatureBehaviorTree
): BehaviorRuntimeState {
  const initial = tree.states.find((s) => s.isInitial) || tree.states[0];
  const initialStateId = initial ? initial.id : 'root';
  const entryNode = initial?.entryNodeId
    ? tree.nodes.find((n) => n.id === initial.entryNodeId)
    : tree.nodes.find((n) => n.stateId === initialStateId) || tree.nodes[0];

  return {
    currentStateId: initialStateId,
    activeNodeId: entryNode ? entryNode.id : null,
    activeNodeStartTime: 0,
    nodeTimer: 0,
    repeatCounters: {},
    dealtDamageCounter: 0,
    receivedDamageCounter: 0,
    onceFlags: {},
    formationIntegrity: 100,
    currentPhase: 1,
    scatterAngles: [],
    scatterPhase: 'idle',
    scatterTimer: 0,
    lastHitPoint: null,
    scatterEpicenter: null,
    regroupWaypoint: null,
    executionLog: ['Behavior initialized: ' + (initial ? initial.name : 'Default State')],
  };
}

/**
 * Calculates target formation offset for a swarmer entity based on formation template
 */
export function getFormationOffset(
  index: number,
  total: number,
  formationType: FormationType,
  spacing: number = 20
): { x: number; y: number } {
  switch (formationType) {
    case 'circle': {
      const radius = Math.max(20, Math.sqrt(total) * spacing * 0.7);
      const angle = (index * (360 / Math.max(1, total))) * (Math.PI / 180);
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    }
    case 'wedge': {
      // V-shaped wedge formation
      const side = index % 2 === 0 ? 1 : -1;
      const rank = Math.floor((index + 1) / 2);
      const angle = (145 * Math.PI) / 180;
      return {
        x: -Math.cos(angle) * (rank * spacing),
        y: side * (rank * spacing * 0.9),
      };
    }
    case 'line': {
      // Perpendicular line abreast
      const side = index % 2 === 0 ? 1 : -1;
      const rank = Math.floor((index + 1) / 2);
      return { x: 0, y: side * rank * spacing };
    }
    case 'grid':
    default: {
      const cols = Math.ceil(Math.sqrt(total));
      const col = index % cols;
      const row = Math.floor(index / cols);
      const offsetX = (col - (cols - 1) / 2) * spacing;
      const offsetY = (row - (Math.ceil(total / cols) - 1) / 2) * spacing;
      return { x: offsetX, y: offsetY };
    }
  }
}

/**
 * Ticks creature AI according to the user-designed Behavior Tree & State Machine
 */
export function tickCreatureBehavior(
  creature: CreatureRuntimeInstance,
  def: CreatureDef,
  tree: CreatureBehaviorTree,
  state: BehaviorRuntimeState,
  behemothCenter: { x: number; y: number; width: number; height: number },
  slots: WeaponSlot[],
  dt: number,
  simTime: number,
  buildingSlots?: BuildingSlot[]
): BehaviorRunnerTickResult {
  const updatedCreature = { ...creature };
  const updatedState: BehaviorRuntimeState = {
    ...state,
    nodeTimer: state.nodeTimer + dt,
    repeatCounters: { ...state.repeatCounters },
    onceFlags: { ...state.onceFlags },
    executionLog: [...state.executionLog],
  };
  const events: BehaviorRunnerTickResult['events'] = [];

  // Check if current active node exists
  let currentNode: BehaviorNode | undefined = tree.nodes.find(
    (n) => n.id === updatedState.activeNodeId
  );

  // If active node is missing or finished, find entry node for current state
  if (!currentNode) {
    const currentState = tree.states.find((s) => s.id === updatedState.currentStateId);
    if (currentState && currentState.entryNodeId) {
      currentNode = tree.nodes.find((n) => n.id === currentState.entryNodeId);
    } else {
      currentNode = tree.nodes.find((n) => n.stateId === updatedState.currentStateId) || tree.nodes[0];
    }
    if (currentNode) {
      updatedState.activeNodeId = currentNode.id;
      updatedState.nodeTimer = 0;
      updatedState.activeNodeStartTime = simTime;
    }
  }

  if (!currentNode) {
    return { creature: updatedCreature, runtimeState: updatedState, events };
  }

  // Locomotion flying state override
  if (currentNode.isFlying !== undefined) {
    updatedCreature.isFlying = currentNode.isFlying;
    updatedCreature.locomotionType = currentNode.isFlying ? 'flying' : 'non-flying';
  }

  // Diving negates all damage, so a creature is only submerged while a Hide node is active
  if (currentNode.type !== 'hide') {
    updatedCreature.underwater = false;
    updatedCreature.depthRatio = Math.max(0, updatedCreature.depthRatio - dt * 1.5);
  }

  // Calculate distance & heading to Behemoth center
  const distToBehemoth = distance(updatedCreature.x, updatedCreature.y, behemothCenter.x, behemothCenter.y);
  const angleToBehemoth = angleBetween(updatedCreature.x, updatedCreature.y, behemothCenter.x, behemothCenter.y);

  // Function to advance to next node
  const advanceTo = (nextNodeId: string | null | undefined, reason?: string) => {
    let targetId = nextNodeId;
    if (!targetId) {
      // Safe fallback if designer rewired or left node unlinked:
      // Return to current state's entry node, or first node of state, or first node of tree
      const currNode = tree.nodes.find((n) => n.id === updatedState.activeNodeId);
      const currState = currNode ? tree.states.find((s) => s.id === currNode.stateId) : null;
      targetId = currState?.entryNodeId || tree.nodes.find((n) => n.stateId === currNode?.stateId && n.id !== currNode?.id)?.id || tree.nodes[0]?.id;
    }
    if (!targetId) return;

    const nextNode = tree.nodes.find((n) => n.id === targetId);
    if (nextNode) {
      updatedState.activeNodeId = nextNode.id;
      updatedState.nodeTimer = 0;
      updatedState.activeNodeStartTime = simTime;
      if (reason) {
        updatedState.executionLog.unshift(`[${simTime.toFixed(1)}s] -> ${nextNode.name} (${reason})`);
        if (updatedState.executionLog.length > 20) updatedState.executionLog.pop();
      }
    }
  };

  // Function to switch state
  const transitionToState = (stateName: string, reason?: string) => {
    const targetState = tree.states.find((s) => s.name.toLowerCase() === stateName.toLowerCase());
    if (targetState) {
      updatedState.currentStateId = targetState.id;
      const entryNode = targetState.entryNodeId
        ? tree.nodes.find((n) => n.id === targetState.entryNodeId)
        : tree.nodes.find((n) => n.stateId === targetState.id);
      if (entryNode) {
        updatedState.activeNodeId = entryNode.id;
        updatedState.nodeTimer = 0;
        updatedState.activeNodeStartTime = simTime;
        updatedState.executionLog.unshift(`[${simTime.toFixed(1)}s] JUMP TO STATE: ${targetState.name} (${reason || 'Rule'})`);
        if (updatedState.executionLog.length > 20) updatedState.executionLog.pop();
      }
    }
  };

  // General reactive on-hit trigger check (e.g. Leviarch barrel roll evasion or panic scatter)
  if (currentNode.onHitNodeId) {
    const isHitRecent = updatedState.lastHitPoint && (simTime - updatedState.lastHitPoint.time <= 0.35);
    const cooldown = currentNode.reactionCooldown ?? 6.0;
    const cooldownPassed = (simTime - (updatedState.lastScatterTime ?? -999)) >= cooldown;
    if (isHitRecent && cooldownPassed) {
      updatedState.lastScatterTime = simTime;
      advanceTo(currentNode.onHitNodeId, `Struck while exposed - triggering reaction (${cooldown}s cooldown)`);
      return { creature: updatedCreature, runtimeState: updatedState, events };
    }
  }

  // EXECUTE CURRENT NODE LOGIC ACCORDING TO TYPE
  switch (currentNode.type) {
    // -------------------------------------------------------------
    // ACTION NODES (BLUE)
    // -------------------------------------------------------------
    case 'approach': {
      const targetSpeed = currentNode.speed || def.movementSpeed;
      const minDistance = currentNode.minDistance || 45;

      if (distToBehemoth > minDistance) {
        // Move towards Behemoth
        const rad = (angleToBehemoth * Math.PI) / 180;
        updatedCreature.vx = Math.cos(rad) * targetSpeed;
        updatedCreature.vy = Math.sin(rad) * targetSpeed;
        updatedCreature.angle = angleToBehemoth;
      } else {
        // Reached target distance
        updatedCreature.vx *= 0.5;
        updatedCreature.vy *= 0.5;
        advanceTo(currentNode.nextNodeId, 'Target distance reached');
      }
      break;
    }

    case 'deal_damage': {
      // Execute attack strike
      const strikeDmg = currentNode.damage || def.strikeDamageRate;
      const strikeCooldown = currentNode.cooldown || 2.0;

      if (updatedState.nodeTimer >= strikeCooldown) {
        events.push({
          type: def.canShootDeck ? 'SHOOT_DECK' : 'RAM_IMPACT',
          target: currentNode.damageTarget || def.attackTarget || 'hull',
          damage: strikeDmg,
          stunChance: def.strikeStunChance,
          stunDuration: def.strikeStunDuration,
          ramMass: def.strikeRamMass,
          strikeSide: updatedCreature.y < behemothCenter.y ? 'port' : 'starboard',
        });
        updatedState.dealtDamageCounter += strikeDmg;
        advanceTo(currentNode.nextNodeId, `Dealt ${strikeDmg} damage`);
      }
      break;
    }

    case 'retreat': {
      const retreatSpeed = currentNode.speed || def.movementSpeed;
      const retreatDist = currentNode.minDistance || 350;

      if (distToBehemoth < retreatDist) {
        // Move away from Behemoth
        const awayAngle = (angleToBehemoth + 180) % 360;
        const rad = (awayAngle * Math.PI) / 180;
        updatedCreature.vx = Math.cos(rad) * retreatSpeed;
        updatedCreature.vy = Math.sin(rad) * retreatSpeed;
        updatedCreature.angle = awayAngle;
      } else {
        updatedCreature.vx *= 0.5;
        updatedCreature.vy *= 0.5;
        advanceTo(currentNode.nextNodeId, 'Safe retreat distance reached');
      }
      break;
    }

    case 'run_away': {
      // Full escape acceleration away
      const escapeSpeed = currentNode.speed || (def.movementSpeed * 1.5);
      const awayAngle = (angleToBehemoth + 180) % 360;
      const rad = (awayAngle * Math.PI) / 180;
      updatedCreature.vx = Math.cos(rad) * escapeSpeed;
      updatedCreature.vy = Math.sin(rad) * escapeSpeed;
      updatedCreature.angle = awayAngle;

      if (distToBehemoth > 750) {
        advanceTo(currentNode.nextNodeId, 'Escaped combat zone');
      }
      break;
    }

    case 'hide': {
      // Submerge underwater (hides hitbox / dampens damage)
      const hideDuration = currentNode.duration || def.underwaterInterval;
      updatedCreature.underwater = true;
      updatedCreature.depthRatio = Math.min(1.0, updatedCreature.depthRatio + dt * 2.0);

      if (updatedState.nodeTimer >= hideDuration) {
        updatedCreature.underwater = false;
        events.push({
          type: 'SURFACED',
          damage: 0,
          stunChance: 0,
          stunDuration: 0,
          ramMass: 0,
        });
        advanceTo(currentNode.nextNodeId, `Surfaced after ${hideDuration}s`);
      }
      break;
    }

    case 'wait_idle': {
      const waitDuration = currentNode.duration || 2.0;
      updatedCreature.vx *= 0.85;
      updatedCreature.vy *= 0.85;

      if (updatedState.nodeTimer >= waitDuration) {
        advanceTo(currentNode.nextNodeId, `Wait ${waitDuration}s complete`);
      }
      break;
    }

    case 'scatter': {
      // Swarm dispersal from center point
      const spreadRadius = currentNode.spreadRadius || 120;
      const scatterSpeed = currentNode.scatterSpeed || (def.movementSpeed * 1.2);
      const duration = currentNode.duration || 2.5;

      // Drop formation integrity
      updatedState.formationIntegrity = Math.max(15, updatedState.formationIntegrity - dt * 45);

      if (updatedCreature.isSwarm && updatedCreature.swarmEntities) {
        if (!updatedState.scatterAngles || updatedState.scatterAngles.length !== updatedCreature.swarmEntities.length) {
          updatedState.scatterAngles = updatedCreature.swarmEntities.map(() => Math.random() * Math.PI * 2);
        }

        for (let i = 0; i < updatedCreature.swarmEntities.length; i++) {
          const ent = updatedCreature.swarmEntities[i];
          if (ent.hp <= 0) continue;
          const baseDir = updatedState.scatterAngles[i] || (i * (Math.PI * 2) / updatedCreature.swarmEntities.length);
          const flutter = Math.sin(simTime * 12 + i * 2.3) * 0.45;
          const dir = baseDir + flutter;
          const speedVariance = 0.75 + ((i * 37) % 50) / 100; // 0.75 to 1.25 variance
          const speed = scatterSpeed * speedVariance;
          ent.vx = Math.cos(dir) * speed;
          ent.vy = Math.sin(dir) * speed;
          ent.x += ent.vx * dt * 0.85;
          ent.y += ent.vy * dt * 0.85;
        }
      }

      if (updatedState.nodeTimer >= duration) {
        advanceTo(currentNode.nextNodeId, `Scatter complete (${spreadRadius}px spread)`);
      }
      break;
    }

    case 'reform': {
      // Return swarm entities to structured formation
      const formation = currentNode.formationType || 'circle';
      const reformSpeed = currentNode.reformSpeed || def.movementSpeed;
      const spacing = currentNode.spacing || 20;

      // Rise formation integrity
      updatedState.formationIntegrity = Math.min(100, updatedState.formationIntegrity + dt * 35);

      if (updatedCreature.isSwarm && updatedCreature.swarmEntities) {
        const total = updatedCreature.swarmEntities.length;
        for (let i = 0; i < total; i++) {
          const ent = updatedCreature.swarmEntities[i];
          if (ent.hp <= 0) continue;
          const targetOffset = getFormationOffset(i, total, formation, spacing);
          const targetX = updatedCreature.x + targetOffset.x;
          const targetY = updatedCreature.y + targetOffset.y;

          // Interpolate towards formation slot
          const step = reformSpeed * dt * 0.6;
          ent.x += (targetX - ent.x) * Math.min(1.0, step * 0.1);
          ent.y += (targetY - ent.y) * Math.min(1.0, step * 0.1);
        }
      }

      if (updatedState.formationIntegrity >= 85 || updatedState.nodeTimer >= 3.5) {
        advanceTo(currentNode.nextNodeId, `Formation reformed (${formation.toUpperCase()} at ${Math.round(updatedState.formationIntegrity)}%)`);
      }
      break;
    }

    // -------------------------------------------------------------
    // SWARM & APEX PREDATOR CUSTOM ACTION NODES
    // -------------------------------------------------------------
    case 'charge_orbit': {
      // Charging or stalking orbit: circles Behemoth in true tangential orbit, alternating submerged (depths) and surface
      const speed = currentNode.speed || def.movementSpeed || 165;
      const radius = currentNode.orbitRadius || 260;
      
      // Determine orbit direction (supports 'random', 'counter_clockwise', or 'clockwise')
      if (updatedState.activeOrbitDirection === undefined || updatedState.nodeTimer <= dt) {
        if (currentNode.orbitDirection === 'random') {
          updatedState.activeOrbitDirection = Math.random() < 0.5 ? 'clockwise' : 'counter_clockwise';
        } else {
          updatedState.activeOrbitDirection = (currentNode.orbitDirection as 'clockwise' | 'counter_clockwise') || 'counter_clockwise';
        }
      }
      const isCCW = updatedState.activeOrbitDirection === 'counter_clockwise';

      const surfaceInt = currentNode.surfaceInterval ?? def.surfaceDuration ?? 3.0;
      const depthsInt = currentNode.depthsInterval ?? def.depthsDuration ?? 3.0;
      const cycleTotal = surfaceInt + depthsInt;
      const stageDuration = currentNode.stageDuration ?? def.chargeStageDuration ?? 18.0;

      updatedCreature.pursuePhase = 'charging';

      if (updatedState.orbitAngle === undefined || updatedState.nodeTimer <= dt) {
        updatedState.orbitAngle = angleBetween(behemothCenter.x, behemothCenter.y, updatedCreature.x, updatedCreature.y);
      }

      // Progress orbit angle smoothly without cutting corners
      const angularSpeed = (speed / radius) * (180 / Math.PI) * dt;
      updatedState.orbitAngle = isCCW
        ? (updatedState.orbitAngle - angularSpeed + 360) % 360
        : (updatedState.orbitAngle + angularSpeed) % 360;

      const orbitRad = (updatedState.orbitAngle * Math.PI) / 180;
      const targetX = behemothCenter.x + Math.cos(orbitRad) * radius;
      const targetY = behemothCenter.y + Math.sin(orbitRad) * radius;

      // Intercept orbit ring smoothly, then lock onto tangent trajectory
      const dToOrbit = distance(updatedCreature.x, updatedCreature.y, targetX, targetY);
      if (dToOrbit > 35) {
        const toOrbitAngle = angleBetween(updatedCreature.x, updatedCreature.y, targetX, targetY);
        const rad = (toOrbitAngle * Math.PI) / 180;
        updatedCreature.vx = Math.cos(rad) * speed;
        updatedCreature.vy = Math.sin(rad) * speed;
        updatedCreature.angle = toOrbitAngle;
      } else {
        // Locked into perfect tangential orbit
        updatedCreature.x = targetX;
        updatedCreature.y = targetY;
        updatedCreature.vx = 0;
        updatedCreature.vy = 0;
        updatedCreature.angle = isCCW
          ? (updatedState.orbitAngle - 90 + 360) % 360
          : (updatedState.orbitAngle + 90) % 360;
      }

      // Alternate between depths (first) and surface with smooth depth transition
      const cyclePos = updatedState.nodeTimer % cycleTotal;
      const inDepths = cyclePos < depthsInt;

      if (inDepths) {
        updatedCreature.underwater = true;
        updatedCreature.depthRatio = Math.min(1.0, updatedCreature.depthRatio + dt * 2.5);
      } else {
        updatedCreature.underwater = false;
        updatedCreature.depthRatio = Math.max(0, updatedCreature.depthRatio - dt * 2.5);
      }

      if (updatedState.nodeTimer >= stageDuration) {
        advanceTo(currentNode.nextNodeId, `Orbit phase complete (${stageDuration}s accumulated)`);
      }
      break;
    }

    case 'short_circuit_drain': {
      // Approach hull contact, slip under the deck (immune), and trigger continuous drain
      const drainSpeed = def.movementSpeed * 0.75;
      const duration = currentNode.duration || def.attackDuration || 10.0;

      updatedCreature.pursuePhase = 'attacking';
      updatedCreature.underwater = true;
      updatedCreature.depthRatio = 1.0;

      // Move directly toward vessel hull center
      if (distToBehemoth > 45) {
        const rad = (angleToBehemoth * Math.PI) / 180;
        updatedCreature.vx = Math.cos(rad) * drainSpeed;
        updatedCreature.vy = Math.sin(rad) * drainSpeed;
        updatedCreature.angle = angleToBehemoth;
      } else {
        // Latched under deck rubbing against hull
        updatedCreature.vx = 0;
        updatedCreature.vy = 0;
        updatedCreature.drainArrived = true;
      }

      // Emit short circuit event for simulation engine
      events.push({
        type: 'SHORT_CIRCUIT_DRAIN',
        damage: 0,
        stunChance: currentNode.stunChance ?? def.drainStunChance ?? 0.10,
        stunDuration: currentNode.stunDuration ?? def.drainStunDuration ?? 10.0,
        ramMass: 0,
      });

      if (updatedState.nodeTimer >= duration) {
        updatedCreature.drainArrived = false;
        advanceTo(currentNode.nextNodeId, `Attack short-circuit stage finished (${duration}s)`);
      }
      break;
    }

    case 'split_swarm_groups': {
      // Partitions swarm entities into groups safely without infinite loop risk
      const rawMin = currentNode.groupMinSize || 3;
      const rawMax = currentNode.groupMaxSize || 5;
      const minSize = Math.max(1, Math.min(rawMin, rawMax));
      const maxSize = Math.max(minSize, Math.max(rawMin, rawMax));

      if (updatedCreature.isSwarm && updatedCreature.swarmEntities) {
        const livingIndices = updatedCreature.swarmEntities
          .map((e, idx) => ({ e, idx }))
          .filter((item) => item.e.hp > 0)
          .map((item) => item.idx);

        const groups: Array<{
          id: string;
          entityIndices: number[];
          targetSlotId: string | null;
          state: 'cruising' | 'approaching' | 'striking' | 'returning';
          timer: number;
        }> = [];

        let i = 0;
        let grpNum = 1;
        while (i < livingIndices.length) {
          const remaining = livingIndices.length - i;
          const range = Math.max(1, maxSize - minSize + 1);
          const randSize = Math.floor(Math.random() * range) + minSize;
          const targetGrpSize = Math.max(1, Math.min(remaining, randSize));
          const chunk = livingIndices.slice(i, i + targetGrpSize);
          groups.push({
            id: `pack_${grpNum++}`,
            entityIndices: chunk,
            targetSlotId: null,
            state: 'approaching',
            timer: 0,
          });
          i += targetGrpSize;
        }

        updatedState.swarmGroups = groups;
      }
      advanceTo(currentNode.nextNodeId, `Swarm partitioned into ${updatedState.swarmGroups?.length || 1} strike squads (${minSize}-${maxSize} entities)`);
      break;
    }

    case 'boids_flock': {
      // Craig Reynolds Boids flocking (Separation, Alignment, Cohesion) with full cruising speed
      const duration = currentNode.duration || 3.5;
      const sepDist = currentNode.flockSeparationDist || 24;
      const speed = currentNode.speed || def.movementSpeed || 200;

      // Reactive scatter check if hit occurred and onHitNodeId or trueNodeId is configured
      const isHitRecent = updatedState.lastHitPoint && (simTime - updatedState.lastHitPoint.time <= 0.35);
      const cooldownPassed = (simTime - (updatedState.lastScatterTime ?? -999)) >= (currentNode.reactionCooldown ?? 2.0);
      if (isHitRecent && cooldownPassed && (currentNode.trueNodeId || currentNode.onHitNodeId)) {
        advanceTo(currentNode.trueNodeId || currentNode.onHitNodeId, 'Flock member hit by weapon fire - triggering reactive scatter');
        break;
      }

      // Roaming orbit anchor around Behemoth center (radius: 300px)
      if (updatedState.orbitAngle === undefined) {
        updatedState.orbitAngle = angleBetween(behemothCenter.x, behemothCenter.y, updatedCreature.x, updatedCreature.y);
      }
      updatedState.orbitAngle = (updatedState.orbitAngle + (speed / 300) * (180 / Math.PI) * dt) % 360;
      const centerRad = (updatedState.orbitAngle * Math.PI) / 180;
      const anchorX = behemothCenter.x + Math.cos(centerRad) * 300;
      const anchorY = behemothCenter.y + Math.sin(centerRad) * 300;

      // Tangential cruising velocity along the orbit path
      const tangentVx = -Math.sin(centerRad) * speed;
      const tangentVy = Math.cos(centerRad) * speed;

      if (updatedCreature.isSwarm && updatedCreature.swarmEntities) {
        const entities = updatedCreature.swarmEntities;
        const total = entities.length;

        for (let i = 0; i < total; i++) {
          const a = entities[i];
          if (a.hp <= 0) continue;

          // Initialize entity velocities if needed
          if (a.vx === undefined || a.vy === undefined || (a.vx === 0 && a.vy === 0)) {
            a.vx = tangentVx + (Math.random() - 0.5) * 40;
            a.vy = tangentVy + (Math.random() - 0.5) * 40;
          }

          let sepX = 0, sepY = 0;
          let alignX = 0, alignY = 0;
          let cohX = 0, cohY = 0;
          let neighborCount = 0;

          for (let j = 0; j < total; j++) {
            if (i === j) continue;
            const b = entities[j];
            if (b.hp <= 0) continue;
            const d = distance(a.x, a.y, b.x, b.y);

            // 1. Separation
            if (d < sepDist && d > 0) {
              const diffX = (a.x - b.x) / d;
              const diffY = (a.y - b.y) / d;
              sepX += diffX * (sepDist - d);
              sepY += diffY * (sepDist - d);
            }

            // 2. Alignment & 3. Cohesion
            if (d < 120) {
              alignX += b.vx || 0;
              alignY += b.vy || 0;
              cohX += b.x;
              cohY += b.y;
              neighborCount++;
            }
          }

          if (neighborCount > 0) {
            alignX /= neighborCount;
            alignY /= neighborCount;
            cohX = (cohX / neighborCount) - a.x;
            cohY = (cohY / neighborCount) - a.y;
          } else {
            alignX = a.vx;
            alignY = a.vy;
          }

          // Anchor pull steering towards roaming orbit path
          const toAnchorX = anchorX - a.x;
          const toAnchorY = anchorY - a.y;

          // Combine flocking + orbit pull + tangent cruise into desired velocity direction
          const steerX = tangentVx * 0.75 + toAnchorX * 0.8 + sepX * 2.5 + alignX * 0.35 + cohX * 0.15;
          const steerY = tangentVy * 0.75 + toAnchorY * 0.8 + sepY * 2.5 + alignY * 0.35 + cohY * 0.15;
          const steerLen = Math.hypot(steerX, steerY) || 1;

          // Desired velocity maintains full cruising speed
          const desiredVx = (steerX / steerLen) * speed;
          const desiredVy = (steerY / steerLen) * speed;

          // Smoothly steer velocity without velocity decay
          const steerFactor = Math.min(1.0, dt * 5.0);
          a.vx = (a.vx || 0) + (desiredVx - (a.vx || 0)) * steerFactor;
          a.vy = (a.vy || 0) + (desiredVy - (a.vy || 0)) * steerFactor;

          // Integrate position
          a.x += a.vx * dt;
          a.y += a.vy * dt;
        }
      }

      if (updatedState.nodeTimer >= duration) {
        advanceTo(currentNode.nextNodeId, `Boids cruising complete (${duration}s)`);
      }
      break;
    }

    case 'group_approach_building': {
      // Directs strike groups towards chosen building slot with smooth flight
      const speed = currentNode.speed || (def.movementSpeed * 1.35);
      const bSlots = buildingSlots || [];

      // Pick building slots that are alive (or fallback to any building slot)
      const validSlots = bSlots.filter((b) => b.building && b.health > 0);
      const pool = validSlots.length > 0 ? validSlots : bSlots;

      if (pool.length === 0) {
        advanceTo(currentNode.nextNodeId, 'No valid building targets available on Behemoth');
        break;
      }

      // Auto-partition into squads if swarmGroups is uninitialized or empty
      if (!updatedState.swarmGroups || updatedState.swarmGroups.length === 0) {
        const livingIndices = updatedCreature.swarmEntities
          ? updatedCreature.swarmEntities.map((e, idx) => ({ e, idx })).filter((item) => item.e.hp > 0).map((item) => item.idx)
          : [];
        const groups: NonNullable<BehaviorRuntimeState['swarmGroups']> = [];
        let i = 0;
        let grpNum = 1;
        while (i < livingIndices.length) {
          const chunk = livingIndices.slice(i, i + 4);
          const chosenSlot = pool[(grpNum - 1) % pool.length];
          groups.push({
            id: `pack_${grpNum++}`,
            entityIndices: chunk,
            targetSlotId: chosenSlot?.id || null,
            state: 'approaching',
            timer: 0,
          });
          i += 4;
        }
        updatedState.swarmGroups = groups;
      }

      // Assign or refresh target building per group if destroyed or unassigned
      if (updatedState.swarmGroups) {
        for (let gIdx = 0; gIdx < updatedState.swarmGroups.length; gIdx++) {
          const grp = updatedState.swarmGroups[gIdx];
          const currSlot = bSlots.find((s) => s.id === grp.targetSlotId);
          const isTargetAlive = currSlot && currSlot.building && currSlot.health > 0;
          if ((!grp.targetSlotId || !isTargetAlive) && pool.length > 0) {
            const manned = pool.filter((s) => s.assignedCrew > 0);
            const targetPool = manned.length > 0 ? manned : pool;
            const chosen = targetPool[gIdx % targetPool.length];
            grp.targetSlotId = chosen?.id || pool[0]?.id || null;
          }
        }
      }

      // Move group entities towards the deck position of target building
      let allReached = true;
      if (updatedCreature.isSwarm && updatedCreature.swarmEntities && updatedState.swarmGroups) {
        for (const grp of updatedState.swarmGroups) {
          const slot = bSlots.find((s) => s.id === grp.targetSlotId);
          let targetX = behemothCenter.x;
          let targetY = behemothCenter.y;
          if (slot) {
            const rowOffset = slot.row === 'misc_a' ? -22 : 22;
            const colOffset = (slot.slotIndex - 1.5) * 35;
            targetX = behemothCenter.x + colOffset;
            targetY = behemothCenter.y + rowOffset;
          }

          for (const eIdx of grp.entityIndices) {
            const ent = updatedCreature.swarmEntities[eIdx];
            if (!ent || ent.hp <= 0) continue;
            const d = distance(ent.x, ent.y, targetX, targetY);

            if (d > 35) {
              allReached = false;
              const angle = angleBetween(ent.x, ent.y, targetX, targetY);
              const rad = (angle * Math.PI) / 180;
              const targetVx = Math.cos(rad) * speed;
              const targetVy = Math.sin(rad) * speed;
              ent.vx = ((ent.vx || 0) + (targetVx - (ent.vx || 0)) * 0.25);
              ent.vy = ((ent.vy || 0) + (targetVy - (ent.vy || 0)) * 0.25);
            } else {
              // Arrived near building
              ent.vx = (ent.vx || 0) * 0.85;
              ent.vy = (ent.vy || 0) * 0.85;
            }
            ent.x += (ent.vx || 0) * dt;
            ent.y += (ent.vy || 0) * dt;
          }
        }
      }

      if (allReached || updatedState.nodeTimer >= 3.5) {
        advanceTo(currentNode.nextNodeId, 'Strike groups reached target buildings');
      }
      break;
    }

    case 'group_strike_target': {
      // Attacks building or assigned crew member (60% crew chance) over sustained duration
      const strikeDuration = currentNode.duration || 2.0;
      const crewChance = currentNode.crewAttackChance ?? 0.60;
      const strikeDmg = currentNode.damage || def.strikeDamageRate || 45;
      const bSlots = buildingSlots || [];

      // Valid alive buildings
      const validSlots = bSlots.filter((b) => b.building && b.health > 0);
      const pool = validSlots.length > 0 ? validSlots : bSlots;

      // Auto-partition into squads if swarmGroups is uninitialized or empty
      if (!updatedState.swarmGroups || updatedState.swarmGroups.length === 0) {
        const livingIndices = updatedCreature.swarmEntities
          ? updatedCreature.swarmEntities.map((e, idx) => ({ e, idx })).filter((item) => item.e.hp > 0).map((item) => item.idx)
          : [];
        const groups: NonNullable<BehaviorRuntimeState['swarmGroups']> = [];
        let i = 0;
        let grpNum = 1;
        while (i < livingIndices.length) {
          const chunk = livingIndices.slice(i, i + 4);
          const chosenSlot = pool[(grpNum - 1) % pool.length];
          groups.push({
            id: `pack_${grpNum++}`,
            entityIndices: chunk,
            targetSlotId: chosenSlot?.id || null,
            state: 'approaching',
            timer: 0,
          });
          i += 4;
        }
        updatedState.swarmGroups = groups;
      }

      if (updatedCreature.isSwarm && updatedCreature.swarmEntities && updatedState.swarmGroups) {
        // Strike tick interval (every ~0.8s)
        const isStrikeTick = updatedState.nodeTimer % 0.8 < dt || updatedState.nodeTimer < dt;

        for (let gIdx = 0; gIdx < updatedState.swarmGroups.length; gIdx++) {
          const grp = updatedState.swarmGroups[gIdx];
          let slot = bSlots.find((s) => s.id === grp.targetSlotId);

          // If target building died mid-assault, retarget to another active building
          if ((!slot || !slot.building || slot.health <= 0) && pool.length > 0) {
            const manned = pool.filter((s) => s.assignedCrew > 0);
            const targetPool = manned.length > 0 ? manned : pool;
            const chosen = targetPool[gIdx % targetPool.length];
            grp.targetSlotId = chosen?.id || pool[0]?.id || null;
            slot = chosen || pool[0];
          }

          const hasCrew = slot && slot.assignedCrew > 0;

          let targetX = behemothCenter.x;
          let targetY = behemothCenter.y;
          if (slot) {
            const rowOffset = slot.row === 'misc_a' ? -22 : 22;
            const colOffset = (slot.slotIndex - 1.5) * 35;
            targetX = behemothCenter.x + colOffset;
            targetY = behemothCenter.y + rowOffset;
          }

          for (const eIdx of grp.entityIndices) {
            const ent = updatedCreature.swarmEntities[eIdx];
            if (!ent || ent.hp <= 0) continue;

            // Frenzied swirling hover motion over targeted building
            const swirlAngle = (updatedState.nodeTimer * 6.0 + eIdx) % (Math.PI * 2);
            ent.vx = Math.cos(swirlAngle) * 60;
            ent.vy = Math.sin(swirlAngle) * 60;
            ent.x += ent.vx * dt;
            ent.y += ent.vy * dt;

            if (isStrikeTick) {
              const targetCrew = hasCrew && Math.random() < crewChance;
              events.push({
                type: 'GROUP_STRIKE',
                target: targetCrew ? 'crew' : 'buildings',
                targetSlotId: grp.targetSlotId || undefined,
                isCrewStrike: targetCrew,
                damage: Math.round(strikeDmg / Math.max(1, grp.entityIndices.length)),
                stunChance: def.strikeStunChance || 0.1,
                stunDuration: def.strikeStunDuration || 1.5,
                ramMass: 0.5,
                groupStrikeLog: targetCrew
                  ? `Veilfangs swarm entity struck assigned crewmember in ${slot?.building?.name || 'Building'}!`
                  : `Veilfangs swarm entity assaulted ${slot?.building?.name || 'Building'} structure!`,
              });
              updatedState.dealtDamageCounter += strikeDmg;
            }
          }
        }
      }

      if (updatedState.nodeTimer >= strikeDuration) {
        advanceTo(currentNode.nextNodeId, `Group strike cycle complete (${Math.round(crewChance * 100)}% crew bias)`);
      }
      break;
    }

    case 'return_to_swarm': {
      // Groups disengage from deck and fly smoothly outward back to cruising orbit
      const returnSpeed = currentNode.speed || (def.movementSpeed * 1.4);
      let allRejoined = true;

      // Cruising staging waypoint outside the ship (distance 300px from vessel center)
      const orbitAng = ((updatedState.orbitAngle ?? 0) * Math.PI) / 180;
      const stagingX = behemothCenter.x + Math.cos(orbitAng) * 300;
      const stagingY = behemothCenter.y + Math.sin(orbitAng) * 300;

      if (updatedCreature.isSwarm && updatedCreature.swarmEntities) {
        const total = updatedCreature.swarmEntities.length;
        for (let i = 0; i < total; i++) {
          const ent = updatedCreature.swarmEntities[i];
          if (ent.hp <= 0) continue;

          // Dispersed ring around staging waypoint
          const offsetAngle = (i * (Math.PI * 2 / Math.max(1, total)));
          const targetX = stagingX + Math.cos(offsetAngle) * 35;
          const targetY = stagingY + Math.sin(offsetAngle) * 35;

          const d = distance(ent.x, ent.y, targetX, targetY);
          if (d > 50) {
            allRejoined = false;
            const angle = angleBetween(ent.x, ent.y, targetX, targetY);
            const rad = (angle * Math.PI) / 180;
            const targetVx = Math.cos(rad) * returnSpeed;
            const targetVy = Math.sin(rad) * returnSpeed;
            ent.vx = ((ent.vx || 0) + (targetVx - (ent.vx || 0)) * 0.25);
            ent.vy = ((ent.vy || 0) + (targetVy - (ent.vy || 0)) * 0.25);
          } else {
            ent.vx = (ent.vx || 0) * 0.95;
            ent.vy = (ent.vy || 0) * 0.95;
          }
          ent.x += (ent.vx || 0) * dt;
          ent.y += (ent.vy || 0) * dt;
        }
      }

      if (allRejoined || updatedState.nodeTimer >= 3.0) {
        if (updatedState.swarmGroups) {
          updatedState.swarmGroups = [];
        }
        advanceTo(currentNode.nextNodeId, 'Disengaged from deck and returned to main flock');
      }
      break;
    }

    case 'flock_dissipate_regroup': {
      // Reactive Swarm Scatter & Regroup:
      // When entered, flock members immediately dissipate away from weapon impact (or current centroid)
      // at high speed, then form separate squads to assault Behemoth buildings/crew,
      // and finally regroup at an orbital sector 120°-180° away.
      const scatterSpeed = currentNode.scatterSpeed || 180;
      const cruiseSpeed = currentNode.speed || def.movementSpeed || 200;
      const dissipateDuration = currentNode.dissipateDuration ?? 0.8;
      const formSquadsBeforeRegroup = currentNode.formSquadsBeforeRegroup !== false;
      const squadAssaultDuration = currentNode.squadAssaultDuration ?? 2.2;
      const regroupDuration = currentNode.regroupDuration ?? 2.2;
      const angleOffset = currentNode.regroupAngleOffset ?? 150;
      const crewChance = currentNode.crewAttackChance ?? 0.60;
      const strikeDmg = currentNode.damage || def.strikeDamageRate || 45;
      const bSlots = buildingSlots || [];

      // If just entered or in idle phase, immediately initialize dissipation!
      if (!updatedState.scatterPhase || updatedState.scatterPhase === 'idle') {
        updatedState.scatterPhase = 'dissipating';
        updatedState.scatterTimer = 0;
        updatedState.lastScatterTime = simTime;
        // Epicenter is recent hit point, or fallback to creature centroid
        const epiX = updatedState.lastHitPoint?.x ?? updatedCreature.x;
        const epiY = updatedState.lastHitPoint?.y ?? updatedCreature.y;
        updatedState.scatterEpicenter = { x: epiX, y: epiY };

        // Clear any old squad allocations so all entities participate
        updatedState.swarmGroups = [];

        if (updatedCreature.isSwarm && updatedCreature.swarmEntities) {
          for (let i = 0; i < updatedCreature.swarmEntities.length; i++) {
            const ent = updatedCreature.swarmEntities[i];
            if (ent.hp <= 0) continue;
            // Wider chaotic dispersal angles (+/- 65 deg with randomized evasion tangents)
            const baseAngle = angleBetween(epiX, epiY, ent.x, ent.y);
            const jitter = (Math.random() - 0.5) * 130;
            const rad = ((baseAngle + jitter) * Math.PI) / 180;
            const speedVar = 0.65 + Math.random() * 0.60;
            ent.vx = Math.cos(rad) * scatterSpeed * speedVar;
            ent.vy = Math.sin(rad) * scatterSpeed * speedVar;
          }
        }
        updatedState.executionLog.push('[SCATTER] Flock member struck! Cruising swarmers dissipating in chaotic spread!');
      }

      if (updatedState.scatterPhase === 'dissipating') {
        updatedState.scatterTimer = (updatedState.scatterTimer || 0) + dt;

        if (updatedCreature.isSwarm && updatedCreature.swarmEntities) {
          for (let i = 0; i < updatedCreature.swarmEntities.length; i++) {
            const ent = updatedCreature.swarmEntities[i];
            if (ent.hp <= 0) continue;

            // Chaotic aerodynamic flutter and lateral jinking per frame
            const flutter = Math.sin(simTime * 14 + i * 2.1) * 75 + Math.cos(simTime * 8 + i * 1.7) * 40;
            const currentSpeed = Math.hypot(ent.vx || 0, ent.vy || 0) || scatterSpeed;
            const currentAngle = Math.atan2(ent.vy || 0, ent.vx || 0);
            const perpAngle = currentAngle + Math.PI / 2;

            // Lateral flutter steering
            ent.vx = (ent.vx || 0) + Math.cos(perpAngle) * flutter * dt;
            ent.vy = (ent.vy || 0) + Math.sin(perpAngle) * flutter * dt;

            // Soft orbit envelope tethering (keeps scattering bats close: 210px - 330px from Behemoth)
            const distToBeh = distance(ent.x, ent.y, behemothCenter.x, behemothCenter.y);
            if (distToBeh > 330) {
              const toCenterAng = angleBetween(ent.x, ent.y, behemothCenter.x, behemothCenter.y);
              const toCenterRad = (toCenterAng * Math.PI) / 180;
              ent.vx += Math.cos(toCenterRad) * 180 * dt;
              ent.vy += Math.sin(toCenterRad) * 180 * dt;
            } else if (distToBeh < 210) {
              const fromCenterAng = angleBetween(behemothCenter.x, behemothCenter.y, ent.x, ent.y);
              const fromCenterRad = (fromCenterAng * Math.PI) / 180;
              ent.vx += Math.cos(fromCenterRad) * 160 * dt;
              ent.vy += Math.sin(fromCenterRad) * 160 * dt;
            }

            // Tether distance from scatter epicenter so they don't blow away endlessly
            if (updatedState.scatterEpicenter) {
              const distFromEpicenter = distance(ent.x, ent.y, updatedState.scatterEpicenter.x, updatedState.scatterEpicenter.y);
              if (distFromEpicenter > 130) {
                const toEpiAng = angleBetween(ent.x, ent.y, updatedState.scatterEpicenter.x, updatedState.scatterEpicenter.y);
                const toEpiRad = (toEpiAng * Math.PI) / 180;
                ent.vx += Math.cos(toEpiRad) * 120 * dt;
                ent.vy += Math.sin(toEpiRad) * 120 * dt;
              }
            }

            // Normalize velocity to maintain organic speed
            const newSpeed = Math.hypot(ent.vx, ent.vy) || 1;
            const boundedSpeed = Math.max(100, Math.min(scatterSpeed * 1.25, currentSpeed));
            ent.vx = (ent.vx / newSpeed) * boundedSpeed;
            ent.vy = (ent.vy / newSpeed) * boundedSpeed;

            ent.x += ent.vx * dt;
            ent.y += ent.vy * dt;
          }
        }

        if (updatedState.scatterTimer >= dissipateDuration) {
          if (formSquadsBeforeRegroup) {
            // Partition all living entities into separate strike squads before regrouping
            updatedState.scatterPhase = 'squad_assault';
            updatedState.scatterTimer = 0;

            const livingIndices: number[] = [];
            if (updatedCreature.isSwarm && updatedCreature.swarmEntities) {
              for (let idx = 0; idx < updatedCreature.swarmEntities.length; idx++) {
                if (updatedCreature.swarmEntities[idx].hp > 0) {
                  livingIndices.push(idx);
                }
              }
            }

            // Shuffle living indices for randomized squad compositions
            for (let s = livingIndices.length - 1; s > 0; s--) {
              const r = Math.floor(Math.random() * (s + 1));
              [livingIndices[s], livingIndices[r]] = [livingIndices[r], livingIndices[s]];
            }

            const minSize = Math.max(1, currentNode.groupMinSize ?? 3);
            const maxSize = Math.max(minSize, currentNode.groupMaxSize ?? 5);
            const groups: NonNullable<BehaviorRuntimeState['swarmGroups']> = [];
            const validSlots = bSlots.filter((b) => b.building && b.health > 0);
            const targetPool = validSlots.length > 0 ? validSlots : bSlots;

            let i = 0;
            let grpNum = 1;
            while (i < livingIndices.length) {
              const remaining = livingIndices.length - i;
              const range = Math.max(1, maxSize - minSize + 1);
              const randSize = Math.floor(Math.random() * range) + minSize;
              const targetGrpSize = Math.max(1, Math.min(remaining, randSize));
              const chunk = livingIndices.slice(i, i + targetGrpSize);

              // Assign building target slot
              const assignedSlot = targetPool.length > 0 ? targetPool[(grpNum - 1) % targetPool.length] : null;

              groups.push({
                id: `scatter_squad_${grpNum++}`,
                entityIndices: chunk,
                targetSlotId: assignedSlot?.id || null,
                state: 'approaching',
                timer: 0,
              });
              i += targetGrpSize;
            }

            // Fallback: if no groups could be created (e.g. 0 living), advance directly to regrouping
            if (groups.length === 0 && livingIndices.length > 0) {
              groups.push({
                id: 'scatter_squad_1',
                entityIndices: livingIndices,
                targetSlotId: targetPool[0]?.id || null,
                state: 'approaching',
                timer: 0,
              });
            }

            updatedState.swarmGroups = groups;
            updatedState.executionLog.push(`[SQUAD ASSAULT] Scattered bats formed ${groups.length} squads targeting Behemoth structures!`);
          } else {
            // Transition directly to regrouping
            updatedState.scatterPhase = 'regrouping';
            updatedState.scatterTimer = 0;

            const currentAngle = angleBetween(behemothCenter.x, behemothCenter.y, updatedCreature.x, updatedCreature.y);
            const newOrbitAngle = (currentAngle + angleOffset) % 360;
            updatedState.orbitAngle = newOrbitAngle;
            const rad = (newOrbitAngle * Math.PI) / 180;
            updatedState.regroupWaypoint = {
              x: behemothCenter.x + Math.cos(rad) * 300,
              y: behemothCenter.y + Math.sin(rad) * 300,
            };
            updatedState.executionLog.push(`[REGROUP] Flock regrouping at opposite orbital sector (${Math.round(newOrbitAngle)}°)!`);
          }
        }
      } else if (updatedState.scatterPhase === 'squad_assault') {
        updatedState.scatterTimer = (updatedState.scatterTimer || 0) + dt;
        const validSlots = bSlots.filter((b) => b.building && b.health > 0);
        const pool = validSlots.length > 0 ? validSlots : bSlots;
        const isStrikeTick = (updatedState.scatterTimer % 0.8 < dt) || (updatedState.scatterTimer < dt);

        // Keep track of which entities are actively moved by a group
        const movedIndices = new Set<number>();

        if (updatedCreature.isSwarm && updatedCreature.swarmEntities && updatedState.swarmGroups && updatedState.swarmGroups.length > 0) {
          for (let gIdx = 0; gIdx < updatedState.swarmGroups.length; gIdx++) {
            const grp = updatedState.swarmGroups[gIdx];
            let slot = bSlots.find((s) => s.id === grp.targetSlotId);

            // If target building destroyed, retarget to another building
            if ((!slot || !slot.building || slot.health <= 0) && pool.length > 0) {
              const manned = pool.filter((s) => s.assignedCrew > 0);
              const candidatePool = manned.length > 0 ? manned : pool;
              const chosen = candidatePool[gIdx % candidatePool.length];
              grp.targetSlotId = chosen?.id || pool[0]?.id || null;
              slot = chosen || pool[0];
            }

            const hasCrew = slot && slot.assignedCrew > 0;
            let targetX = behemothCenter.x;
            let targetY = behemothCenter.y;
            if (slot) {
              const rowOffset = slot.row === 'misc_a' ? -22 : 22;
              const colOffset = (slot.slotIndex - 1.5) * 35;
              targetX = behemothCenter.x + colOffset;
              targetY = behemothCenter.y + rowOffset;
            }

            for (const eIdx of grp.entityIndices) {
              movedIndices.add(eIdx);
              const ent = updatedCreature.swarmEntities[eIdx];
              if (!ent || ent.hp <= 0) continue;

              const dToTarget = distance(ent.x, ent.y, targetX, targetY);
              if (dToTarget > 45) {
                // Fly rapidly towards target building
                const angle = angleBetween(ent.x, ent.y, targetX, targetY);
                const rad = (angle * Math.PI) / 180;
                const targetVx = Math.cos(rad) * (cruiseSpeed * 1.35);
                const targetVy = Math.sin(rad) * (cruiseSpeed * 1.35);
                ent.vx = (ent.vx || 0) + (targetVx - (ent.vx || 0)) * Math.min(1.0, dt * 5.0);
                ent.vy = (ent.vy || 0) + (targetVy - (ent.vy || 0)) * Math.min(1.0, dt * 5.0);
              } else {
                // Swirling strike attack over target building
                const swirlAngle = (updatedState.scatterTimer * 6.0 + eIdx) % (Math.PI * 2);
                ent.vx = Math.cos(swirlAngle) * 60;
                ent.vy = Math.sin(swirlAngle) * 60;
              }

              ent.x += (ent.vx || 0) * dt;
              ent.y += (ent.vy || 0) * dt;

              if (dToTarget <= 70 && isStrikeTick) {
                const targetCrew = hasCrew && Math.random() < crewChance;
                events.push({
                  type: 'GROUP_STRIKE',
                  target: targetCrew ? 'crew' : (slot ? 'buildings' : 'hull'),
                  targetSlotId: grp.targetSlotId || undefined,
                  isCrewStrike: targetCrew,
                  damage: Math.round(strikeDmg / Math.max(1, grp.entityIndices.length)),
                  stunChance: def.strikeStunChance || 0.1,
                  stunDuration: def.strikeStunDuration || 1.5,
                  ramMass: 0.5,
                  groupStrikeLog: targetCrew
                    ? `Veilfangs assault squad struck assigned crewmember in ${slot?.building?.name || 'Building'}!`
                    : slot
                      ? `Veilfangs assault squad assaulted ${slot?.building?.name || 'Building'} structure!`
                      : `Veilfangs assault squad struck Behemoth deck!`,
                });
                updatedState.dealtDamageCounter += strikeDmg;
              }
            }
          }
        }

        // Safe fallback for any living entity not assigned to a group: fly toward Behemoth center
        if (updatedCreature.isSwarm && updatedCreature.swarmEntities) {
          for (let i = 0; i < updatedCreature.swarmEntities.length; i++) {
            if (movedIndices.has(i)) continue;
            const ent = updatedCreature.swarmEntities[i];
            if (ent.hp <= 0) continue;
            const toCenter = angleBetween(ent.x, ent.y, behemothCenter.x, behemothCenter.y);
            const rad = (toCenter * Math.PI) / 180;
            ent.vx = Math.cos(rad) * cruiseSpeed;
            ent.vy = Math.sin(rad) * cruiseSpeed;
            ent.x += ent.vx * dt;
            ent.y += ent.vy * dt;
          }
        }

        // Once squad assault duration finishes (or if no squads existed), disengage and transition to regrouping
        if (updatedState.scatterTimer >= squadAssaultDuration || !updatedState.swarmGroups || updatedState.swarmGroups.length === 0) {
          updatedState.scatterPhase = 'regrouping';
          updatedState.scatterTimer = 0;
          updatedState.swarmGroups = [];

          // Pick opposite orbital sector (120°-180° offset from current angle)
          const currentAngle = angleBetween(behemothCenter.x, behemothCenter.y, updatedCreature.x, updatedCreature.y);
          const newOrbitAngle = (currentAngle + angleOffset) % 360;
          updatedState.orbitAngle = newOrbitAngle;
          const rad = (newOrbitAngle * Math.PI) / 180;
          updatedState.regroupWaypoint = {
            x: behemothCenter.x + Math.cos(rad) * 300,
            y: behemothCenter.y + Math.sin(rad) * 300,
          };
          updatedState.executionLog.push(`[REGROUP] Assault squads disengaging from deck and regrouping at opposite sector (${Math.round(newOrbitAngle)}°)!`);
        }
      } else if (updatedState.scatterPhase === 'regrouping') {
        updatedState.scatterTimer = (updatedState.scatterTimer || 0) + dt;
        const waypoint = updatedState.regroupWaypoint || {
          x: behemothCenter.x + 300,
          y: behemothCenter.y,
        };

        let allRegrouped = true;
        if (updatedCreature.isSwarm && updatedCreature.swarmEntities) {
          const total = updatedCreature.swarmEntities.length;
          for (let i = 0; i < total; i++) {
            const ent = updatedCreature.swarmEntities[i];
            if (ent.hp <= 0) continue;

            const d = distance(ent.x, ent.y, waypoint.x, waypoint.y);
            if (d > 55) {
              allRegrouped = false;
            }

            const offsetAng = (i * (Math.PI * 2 / Math.max(1, total)));
            const targetX = waypoint.x + Math.cos(offsetAng) * 30;
            const targetY = waypoint.y + Math.sin(offsetAng) * 30;

            // Chaotic swirling convergence instead of rigid lines
            const convergeFlutter = Math.sin(simTime * 8 + i * 1.6) * 30;
            const toAngle = angleBetween(ent.x, ent.y, targetX, targetY) + convergeFlutter;
            const rad = (toAngle * Math.PI) / 180;
            const targetVx = Math.cos(rad) * cruiseSpeed;
            const targetVy = Math.sin(rad) * cruiseSpeed;

            ent.vx = (ent.vx || 0) + (targetVx - (ent.vx || 0)) * Math.min(1.0, dt * 4.5);
            ent.vy = (ent.vy || 0) + (targetVy - (ent.vy || 0)) * Math.min(1.0, dt * 4.5);
            ent.x += ent.vx * dt;
            ent.y += ent.vy * dt;
          }
        }

        if (allRegrouped || updatedState.scatterTimer >= regroupDuration) {
          updatedState.scatterPhase = 'idle';
          updatedState.scatterEpicenter = null;
          updatedState.regroupWaypoint = null;
          updatedState.swarmGroups = [];
          advanceTo(currentNode.nextNodeId, `Dissipated away from weapon strike, executed squad building assault, and successfully regrouped at ${Math.round(updatedState.orbitAngle ?? 0)}°`);
        }
      }
      break;
    }

    case 'barrel_roll': {
      // Rapid evasive maneuver: 60-90° vector deviation away from Behemoth with high burst speed
      const rollSpeed = currentNode.speed || (def.movementSpeed * 1.5) || 580;
      const rollDuration = currentNode.duration || 0.7;

      // Calculate tangential/away vector (perpendicular to Behemoth with outward bias)
      const evadeAngle = (angleToBehemoth + 90 + Math.sin(simTime * 8) * 20) % 360;
      const rad = (evadeAngle * Math.PI) / 180;
      updatedCreature.vx = Math.cos(rad) * rollSpeed;
      updatedCreature.vy = Math.sin(rad) * rollSpeed;
      // Visual spinning angle simulating a rapid aerodynamic roll
      updatedCreature.angle = (updatedCreature.angle + 720 * dt) % 360;

      if (updatedState.nodeTimer >= rollDuration) {
        advanceTo(currentNode.nextNodeId, `Completed ${rollDuration}s evasive barrel roll`);
      }
      break;
    }

    // -------------------------------------------------------------
    // CONDITION NODES (YELLOW)
    // -------------------------------------------------------------
    case 'until_dealt_damage': {
      const threshold = currentNode.targetDamage || 300;
      if (updatedState.dealtDamageCounter >= threshold) {
        updatedState.dealtDamageCounter = 0;
        advanceTo(currentNode.trueNodeId || currentNode.nextNodeId, `Dealt ${threshold} threshold reached`);
      } else if (currentNode.falseNodeId && updatedState.nodeTimer > 10.0) {
        advanceTo(currentNode.falseNodeId, 'Damage timeout');
      }
      break;
    }

    case 'until_received_damage': {
      const threshold = currentNode.targetDamage || 150;
      if (updatedState.receivedDamageCounter >= threshold) {
        updatedState.receivedDamageCounter = 0;
        advanceTo(currentNode.trueNodeId || currentNode.nextNodeId, `Took ${threshold} damage counter`);
      } else if (currentNode.falseNodeId && updatedState.nodeTimer > 8.0) {
        advanceTo(currentNode.falseNodeId, 'Received damage check passed');
      }
      break;
    }

    case 'until_aggression': {
      const targetAggro = currentNode.targetAggression || 60;
      const op = currentNode.aggressionOp || '>=';
      let satisfied = false;
      if (op === '>=') satisfied = updatedCreature.aggression >= targetAggro;
      else if (op === '<=') satisfied = updatedCreature.aggression <= targetAggro;
      else if (op === '>') satisfied = updatedCreature.aggression > targetAggro;
      else if (op === '<') satisfied = updatedCreature.aggression < targetAggro;
      else satisfied = Math.abs(updatedCreature.aggression - targetAggro) < 5;

      if (satisfied) {
        advanceTo(currentNode.trueNodeId || currentNode.nextNodeId, `Aggression ${op} ${targetAggro}`);
      } else if (currentNode.falseNodeId) {
        advanceTo(currentNode.falseNodeId, 'Aggression check false');
      }
      break;
    }

    case 'for_seconds': {
      const duration = currentNode.duration || 3.0;
      if (updatedState.nodeTimer >= duration) {
        advanceTo(currentNode.trueNodeId || currentNode.nextNodeId, `Timer elapsed: ${duration}s`);
      }
      break;
    }

    case 'once': {
      const flagKey = currentNode.id;
      if (!updatedState.onceFlags[flagKey]) {
        updatedState.onceFlags[flagKey] = true;
        advanceTo(currentNode.trueNodeId || currentNode.nextNodeId, 'Executed once flag');
      } else if (currentNode.falseNodeId) {
        advanceTo(currentNode.falseNodeId, 'Already executed once');
      }
      break;
    }

    case 'health_threshold': {
      const targetHpPercent = currentNode.healthPercent || 50;
      const op = currentNode.healthOp || '<=';
      const currentHpPercent = (updatedCreature.hp / updatedCreature.maxHp) * 100;
      let satisfied = false;
      if (op === '<=') satisfied = currentHpPercent <= targetHpPercent;
      else if (op === '>=') satisfied = currentHpPercent >= targetHpPercent;
      else if (op === '<') satisfied = currentHpPercent < targetHpPercent;

      if (satisfied) {
        advanceTo(currentNode.trueNodeId || currentNode.nextNodeId, `HP ${op} ${targetHpPercent}%`);
      } else if (currentNode.falseNodeId) {
        advanceTo(currentNode.falseNodeId, `HP above ${targetHpPercent}%`);
      }
      break;
    }

    case 'distance_check': {
      const targetDist = currentNode.distanceThreshold || 250;
      const op = currentNode.distanceOp || '<=';
      let satisfied = false;
      if (op === '<=') satisfied = distToBehemoth <= targetDist;
      else if (op === '>=') satisfied = distToBehemoth >= targetDist;
      else if (op === '<') satisfied = distToBehemoth < targetDist;
      else if (op === '>') satisfied = distToBehemoth > targetDist;

      if (satisfied) {
        advanceTo(currentNode.trueNodeId || currentNode.nextNodeId, `Distance ${op} ${targetDist}px`);
      } else if (currentNode.falseNodeId) {
        advanceTo(currentNode.falseNodeId, `Distance check false`);
      }
      break;
    }

    case 'swarm_size': {
      const aliveCount = updatedCreature.swarmEntities
        ? updatedCreature.swarmEntities.filter((e) => e.hp > 0).length
        : updatedCreature.quantity;
      const targetSize = currentNode.targetSwarmSize || 5;
      const op = currentNode.swarmSizeOp || '<=';
      let satisfied = false;
      if (op === '<=') satisfied = aliveCount <= targetSize;
      else if (op === '>=') satisfied = aliveCount >= targetSize;

      if (satisfied) {
        advanceTo(currentNode.trueNodeId || currentNode.nextNodeId, `Swarm size ${op} ${targetSize}`);
      } else if (currentNode.falseNodeId) {
        advanceTo(currentNode.falseNodeId, 'Swarm size check false');
      }
      break;
    }

    case 'formation_integrity': {
      const targetIntegrity = currentNode.targetFormationIntegrity || 80;
      const op = currentNode.formationIntegrityOp || '>=';
      let satisfied = false;
      if (op === '>=') satisfied = updatedState.formationIntegrity >= targetIntegrity;
      else if (op === '<=') satisfied = updatedState.formationIntegrity <= targetIntegrity;

      if (satisfied) {
        advanceTo(currentNode.trueNodeId || currentNode.nextNodeId, `Integrity ${op} ${targetIntegrity}%`);
      } else if (currentNode.falseNodeId) {
        advanceTo(currentNode.falseNodeId, 'Integrity check false');
      }
      break;
    }

    // -------------------------------------------------------------
    // FLOW CONTROL NODES (GREEN)
    // -------------------------------------------------------------
    case 'repeat': {
      const maxCount = currentNode.repeatCount || 3;
      const isInfinite = currentNode.isInfiniteRepeat || maxCount < 0;
      const counterKey = currentNode.id;
      const currentCount = (updatedState.repeatCounters[counterKey] || 0) + 1;
      updatedState.repeatCounters[counterKey] = currentCount;

      if (isInfinite || currentCount <= maxCount) {
        advanceTo(currentNode.trueNodeId || currentNode.nextNodeId, `Loop iteration ${currentCount}`);
      } else {
        updatedState.repeatCounters[counterKey] = 0;
        advanceTo(currentNode.falseNodeId, 'Loop finished');
      }
      break;
    }

    case 'branch_switch': {
      // Conditional routing based on random probability chance or Aggression
      if (currentNode.chance !== undefined) {
        const roll = Math.random();
        if (roll <= currentNode.chance) {
          advanceTo(currentNode.trueNodeId, `Probability branch (${Math.round(currentNode.chance * 100)}% roll: ${(roll * 100).toFixed(0)}%)`);
        } else {
          advanceTo(currentNode.falseNodeId, `Alternate branch (fell into ${(100 - Math.round(currentNode.chance * 100))}% window)`);
        }
      } else {
        const branchOnAggro = updatedCreature.aggression >= 60;
        if (branchOnAggro) {
          advanceTo(currentNode.trueNodeId, 'High Aggression branch');
        } else {
          advanceTo(currentNode.falseNodeId, 'Low Aggression branch');
        }
      }
      break;
    }

    case 'state_transition': {
      if (currentNode.targetStateName) {
        transitionToState(currentNode.targetStateName, 'State Transition node');
      } else {
        advanceTo(currentNode.nextNodeId);
      }
      break;
    }

    case 'parallel_execute': {
      // Advances to primary branch and records secondary branches
      advanceTo(currentNode.nextNodeId, 'Parallel execute start');
      break;
    }

    // -------------------------------------------------------------
    // SPECIAL NODES (PURPLE)
    // -------------------------------------------------------------
    case 'swarm_coordination': {
      updatedState.formationIntegrity = currentNode.coherence || 95;
      advanceTo(currentNode.nextNodeId, 'Swarm synchronized');
      break;
    }

    case 'phase_trigger': {
      updatedState.currentPhase = (currentNode.targetPhase || updatedState.currentPhase + 1);
      advanceTo(currentNode.nextNodeId, `Triggered Boss Phase ${updatedState.currentPhase}`);
      break;
    }

    case 'event_listener': {
      advanceTo(currentNode.nextNodeId, 'Event listened');
      break;
    }

    default:
      advanceTo(currentNode.nextNodeId);
      break;
  }

  // Update position based on velocity / swarm centroid
  if (updatedCreature.isSwarm && updatedCreature.swarmEntities) {
    let sumX = 0, sumY = 0, aliveCount = 0;
    for (const ent of updatedCreature.swarmEntities) {
      if (ent.hp > 0) {
        if (isNaN(ent.x)) ent.x = updatedCreature.x || (behemothCenter.x + 300);
        if (isNaN(ent.y)) ent.y = updatedCreature.y || behemothCenter.y;
        sumX += ent.x;
        sumY += ent.y;
        aliveCount++;
      }
    }
    if (aliveCount > 0) {
      updatedCreature.x = sumX / aliveCount;
      updatedCreature.y = sumY / aliveCount;
    }
  } else {
    updatedCreature.x += updatedCreature.vx * dt;
    updatedCreature.y += updatedCreature.vy * dt;
  }

  return { creature: updatedCreature, runtimeState: updatedState, events };
}
