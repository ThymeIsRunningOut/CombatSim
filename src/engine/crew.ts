import {
  CrewMemberAgent,
  CrewPdwShot,
  CrewSimulationConfig,
  CrewStance,
  BuildingSlot,
  CreatureRuntimeInstance,
  CreatureDef,
  BehemothState,
} from '../types/combat';
import { distance, angleBetween, calculateDamageAgainstCreature } from './math';

export interface BuildingSlotPos {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Computes deck coordinates for non-combat building slots */
export function getBuildingSlotPosition(
  slot: { id: string; row: 'misc_a' | 'misc_b'; slotIndex: number },
  vesselCenter: { x: number; y: number; width: number; height: number }
): BuildingSlotPos {
  const vX = vesselCenter.x - vesselCenter.width / 2;
  const vY = vesselCenter.y - vesselCenter.height / 2;

  // 4 slots per row with clean, comfortable building pad dimensions and clear corridors
  const slotWidth = 38; // Clean, properly proportioned building pad footprint
  const slotHeight = 15; // Realistic height so structures, roofs, and names fit comfortably
  const startX = vX + 46;
  const colSpacing = 52;
  const posX = startX + slot.slotIndex * colSpacing;

  // Row misc_a: Y = vY + 33 (top vY + 25.5, bottom vY + 40.5)
  // Row misc_b: Y = vY + 57 (top vY + 49.5, bottom vY + 64.5)
  // Central promenade corridor is 9px wide between vY + 40.5 and vY + 49.5 along centerY (vY + 45)
  // Cross-corridors are 14px wide between buildings (52 - 38 = 14)
  const posY = slot.row === 'misc_a' ? vY + 33 : vY + 57;

  return {
    id: slot.id,
    x: posX,
    y: posY,
    width: slotWidth,
    height: slotHeight,
  };
}

/** Creates or updates crew agents to match current Behemoth crew count */
export function syncCrewAgents(
  existingAgents: CrewMemberAgent[],
  totalCrew: number,
  crewHp: number,
  vesselCenter: { x: number; y: number; width: number; height: number },
  buildingSlots: BuildingSlot[]
): CrewMemberAgent[] {
  const vX = vesselCenter.x - vesselCenter.width / 2;
  const vY = vesselCenter.y - vesselCenter.height / 2;
  const vW = vesselCenter.width;
  const vH = vesselCenter.height;

  const agents: CrewMemberAgent[] = [...existingAgents];

  // Trim excess if casualties occurred
  if (agents.length > totalCrew) {
    agents.length = totalCrew;
  }

  // Populate new agents if crew increased or on startup
  while (agents.length < totalCrew) {
    const idx = agents.length;
    // Spawn across the deck corridors
    const spawnX = vX + 16 + Math.random() * (vW - 32);
    const spawnY = vY + 12 + Math.random() * (vH - 24);

    // Pick random initial building assignments
    const housingSlots = buildingSlots.filter((b) => b.building && (b.building.crewRole === 'housing' || b.building.category === 'housing'));
    const jobSlots = buildingSlots.filter((b) => b.building && b.building.crewRole !== 'housing' && b.building.category !== 'housing');

    const assignedHousing = housingSlots.length > 0 ? housingSlots[idx % housingSlots.length].id : null;
    const assignedJob = jobSlots.length > 0 ? jobSlots[idx % jobSlots.length].id : null;

    agents.push({
      id: `crew_${idx}_${Math.random().toString(36).slice(2, 7)}`,
      x: spawnX,
      y: spawnY,
      vx: (Math.random() - 0.5) * 15,
      vy: (Math.random() - 0.5) * 15,
      status: 'wandering',
      targetSlotId: assignedJob || assignedHousing || (buildingSlots[0]?.id ?? null),
      assignedHousingSlotId: assignedHousing,
      assignedJobSlotId: assignedJob,
      hiddenInSlotId: null,
      snatchedByCreatureId: null,
      hp: crewHp,
      maxHp: crewHp,
      attackCooldown: Math.random() * 0.8,
      targetCreatureId: null,
      wanderTimer: 2 + Math.random() * 4,
    });
  }

  return agents;
}

export interface CrewSimulationResult {
  agents: CrewMemberAgent[];
  pdwShots: CrewPdwShot[];
  logs: Array<{ text: string; type: 'info' | 'warn' | 'danger' | 'success' }>;
  casualties: number;
  snatchedCount: number;
  savedCount: number;
}

/** Ticks boids flocking, navigation, stances, PDW attacks, and creature snatch mechanics */
export function tickCrewSimulation(
  agents: CrewMemberAgent[],
  behemoth: BehemothState,
  creatures: CreatureRuntimeInstance[],
  creatureDefs: Map<string, CreatureDef>,
  vesselCenter: { x: number; y: number; width: number; height: number },
  dt: number
): CrewSimulationResult {
  const config = behemoth.crewConfig;
  const stance = behemoth.crewStance;
  const logs: CrewSimulationResult['logs'] = [];
  const pdwShots: CrewPdwShot[] = [];
  let casualties = 0;
  let snatchedCount = 0;
  let savedCount = 0;

  const vX = vesselCenter.x - vesselCenter.width / 2;
  const vY = vesselCenter.y - vesselCenter.height / 2;
  const vW = vesselCenter.width;
  const vH = vesselCenter.height;

  // Deck walking boundaries (inside deck railings)
  const minX = vX + 12;
  const maxX = vX + vW - 12;
  const minY = vY + 8;
  const maxY = vY + vH - 8;

  // Pre-calculate building positions
  const slotPositions = new Map<string, BuildingSlotPos>();
  for (const slot of behemoth.buildingSlots) {
    slotPositions.set(slot.id, getBuildingSlotPosition(slot, vesselCenter));
  }

  // Pre-filter operational housing buildings with available capacity
  const housingBuildings = behemoth.buildingSlots.filter(
    (b) => b.building && (b.building.crewRole === 'housing' || b.building.category === 'housing') && b.health > 0
  );

  // Count current hidden occupants per housing slot
  const housingOccupancy = new Map<string, number>();
  for (const h of housingBuildings) {
    housingOccupancy.set(h.id, 0);
  }
  for (const a of agents) {
    if (a.status === 'hidden' && a.hiddenInSlotId && housingOccupancy.has(a.hiddenInSlotId)) {
      housingOccupancy.set(a.hiddenInSlotId, (housingOccupancy.get(a.hiddenInSlotId) || 0) + 1);
    }
  }

  // Identify active airborne/deck-threatening creatures
  const deckThreats: CreatureRuntimeInstance[] = [];
  for (const c of creatures) {
    if (c.hp <= 0) continue;
    const def = creatureDefs.get(c.defId);
    if (!def) continue;

    // Is creature targeting deck/crew/buildings or within close proximity of the vessel?
    const distToCenter = distance(c.x, c.y, vesselCenter.x, vesselCenter.y);
    const onDeckProximity = distToCenter <= Math.max(vW, vH) * 0.9;
    const isAttackingDeck = def.attackTarget === 'crew' || def.attackTarget === 'buildings' || def.canShootDeck;

    if (onDeckProximity || isAttackingDeck) {
      deckThreats.push(c);
    }
  }

  // Determine target on-deck simulation count
  const minPercent = Math.max(5, Math.min(100, config.minOnDeckPercent));
  const maxPercent = Math.max(minPercent, Math.min(100, config.maxOnDeckPercent));
  const targetOnDeckRatio = (minPercent + maxPercent) / 200;
  const targetSimulatedOnDeck = Math.max(1, Math.round(agents.length * targetOnDeckRatio));

  // Update each crew agent
  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];

    // ---- 1. Handle Snatched Crew ----
    if (agent.status === 'snatched') {
      const kidnapper = creatures.find((c) => c.id === agent.snatchedByCreatureId);

      // Check if kidnapper is neutralized or disappeared
      if (!kidnapper || kidnapper.hp <= 0) {
        // RESCUED! Snatched crewmember dropped back on deck
        agent.status = 'wandering';
        agent.snatchedByCreatureId = null;
        agent.x = Math.max(minX, Math.min(maxX, agent.x));
        agent.y = Math.max(minY, Math.min(maxY, agent.y));
        agent.vx = 0;
        agent.vy = 0;
        savedCount++;
        logs.push({
          text: `RESCUE: Airborne predator neutralized! Crewmember dropped safely back to deck!`,
          type: 'success',
        });
        continue;
      }

      // Track kidnapper location (or specific swarm entity)
      let kidnapperX = kidnapper.x;
      let kidnapperY = kidnapper.y;
      if (kidnapper.isSwarm && kidnapper.swarmEntities && agent.snatchedEntityIndex !== undefined) {
        const ent = kidnapper.swarmEntities[agent.snatchedEntityIndex];
        if (ent && ent.hp > 0) {
          kidnapperX = ent.x;
          kidnapperY = ent.y;
        } else if (ent && ent.hp <= 0) {
          // Specific swarm entity died: rescue!
          agent.status = 'wandering';
          agent.snatchedByCreatureId = null;
          agent.x = Math.max(minX, Math.min(maxX, agent.x));
          agent.y = Math.max(minY, Math.min(maxY, agent.y));
          savedCount++;
          logs.push({
            text: `RESCUE: Swarmer carrying crewmember was shot down! Crewmember saved!`,
            type: 'success',
          });
          continue;
        }
      }

      agent.x = kidnapperX;
      agent.y = kidnapperY;

      // Kidnapper steer outward off the ship
      const angleFromCenter = angleBetween(vesselCenter.x, vesselCenter.y, kidnapperX, kidnapperY);
      const rad = (angleFromCenter * Math.PI) / 180;
      kidnapper.vx += Math.cos(rad) * 45 * dt;
      kidnapper.vy += Math.sin(rad) * 45 * dt;

      // Has the creature crossed off the deck into open water?
      const isOffDeck = kidnapperX < vX - 10 || kidnapperX > vX + vW + 10 || kidnapperY < vY - 10 || kidnapperY > vY + vH + 10;
      if (isOffDeck) {
        // INSTANT KILL: Dropped off deck into the abyss!
        agent.hp = 0;
        casualties++;
        logs.push({
          text: `DECK CASUALTY: ${kidnapper.name} carried a crewmember overboard into the abyss!`,
          type: 'danger',
        });
      }
      continue;
    }

    // ---- 2. Stance: HIDE Behavior ----
    if (stance === 'hide') {
      if (agent.status === 'hidden') {
        // Ensure the housing building is still standing
        const slot = behemoth.buildingSlots.find((b) => b.id === agent.hiddenInSlotId);
        if (!slot || slot.health <= 0) {
          // Housing collapsed! Ejected onto deck
          agent.status = 'fleeing';
          agent.hiddenInSlotId = null;
          logs.push({
            text: `Housing module destroyed! Crew forced out onto the deck!`,
            type: 'danger',
          });
        }
        continue;
      }

      // Looking for available housing
      let bestHousing: BuildingSlot | null = null;
      let bestDist = Infinity;
      for (const h of housingBuildings) {
        const capacity = h.building?.maxCrew || 6;
        const currentOcc = housingOccupancy.get(h.id) || 0;
        if (currentOcc < capacity) {
          const pos = slotPositions.get(h.id);
          if (pos) {
            const d = distance(agent.x, agent.y, pos.x, pos.y);
            if (d < bestDist) {
              bestDist = d;
              bestHousing = h;
            }
          }
        }
      }

      if (bestHousing) {
        agent.status = 'seeking_shelter';
        agent.targetSlotId = bestHousing.id;
        const pos = slotPositions.get(bestHousing.id)!;
        const distToShelter = distance(agent.x, agent.y, pos.x, pos.y);

        if (distToShelter <= 14) {
          // Successfully entered housing!
          agent.status = 'hidden';
          agent.hiddenInSlotId = bestHousing.id;
          housingOccupancy.set(bestHousing.id, (housingOccupancy.get(bestHousing.id) || 0) + 1);
          continue;
        } else {
          // Run quickly toward housing shelter
          const angle = angleBetween(agent.x, agent.y, pos.x, pos.y);
          const rad = (angle * Math.PI) / 180;
          agent.vx = Math.cos(rad) * 65;
          agent.vy = Math.sin(rad) * 65;
        }
      } else {
        // No housing available or all housing full: run away!
        agent.status = 'fleeing';
      }
    }

    // In neutral or attack stance, if agent was previously hidden without reason, step back out onto deck
    if (stance !== 'hide' && agent.status === 'hidden') {
      agent.status = 'wandering';
      agent.hiddenInSlotId = null;
    }

    // In NEUTRAL stance, manage simulated on-deck crew count vs off-duty crew resting indoors
    // In ATTACK stance, all crew are mobilized on deck in full combat readiness
    if (stance === 'neutral' && deckThreats.length === 0 && i >= targetSimulatedOnDeck) {
      // Off-duty crew remain sheltered inside their assigned buildings/quarters
      const restSlotId = agent.assignedHousingSlotId || agent.assignedJobSlotId || (behemoth.buildingSlots[0]?.id ?? null);
      if (restSlotId) {
        agent.status = 'hidden';
        agent.hiddenInSlotId = restSlotId;
        continue;
      }
    }

    // ---- 3. Stance: ATTACK (Personal Defense Weapons while staying actively mobile) ----
    if (stance === 'attack') {
      agent.status = 'attacking';

      if (deckThreats.length > 0) {
        // Find nearest creature that targets crew or buildings
        let closestThreat: CreatureRuntimeInstance | null = null;
        let closestDist = Infinity;
        for (const threat of deckThreats) {
          const def = creatureDefs.get(threat.defId);
          if (def && (def.attackTarget === 'crew' || def.attackTarget === 'buildings')) {
            const d = distance(agent.x, agent.y, threat.x, threat.y);
            if (d < closestDist) {
              closestDist = d;
              closestThreat = threat;
            }
          }
        }

        if (closestThreat) {
          agent.targetCreatureId = closestThreat.id;
          agent.attackCooldown -= dt;

          if (closestDist <= config.pdwRange && agent.attackCooldown <= 0) {
            agent.attackCooldown = 1 / Math.max(0.5, config.pdwFireRate);

            // Fire PDW shot on the move!
            const def = creatureDefs.get(closestThreat.defId);
            if (def) {
              const dmgResult = calculateDamageAgainstCreature(
                'Physical',
                config.pdwDamage,
                closestThreat.physicalArmor,
                closestThreat.armorClass,
                closestThreat.energyResistance
              );

              if (closestThreat.physicalArmor > 0) {
                closestThreat.physicalArmor = Math.max(0, closestThreat.physicalArmor - dmgResult.armorDamage);
              }
              closestThreat.hp = Math.max(0, closestThreat.hp - dmgResult.hpDamage);

              // Add visual PDW tracer
              pdwShots.push({
                id: `pdw_${Date.now()}_${Math.random()}`,
                sourceX: agent.x,
                sourceY: agent.y,
                targetX: closestThreat.x + (Math.random() - 0.5) * 8,
                targetY: closestThreat.y + (Math.random() - 0.5) * 8,
                color: '#38bdf8',
                lifetime: 0.08,
                maxLifetime: 0.08,
              });
            }
          }

          // If threat gets dangerously close (< 30px), evasively kite away while keeping fire
          if (closestDist < 30) {
            const fleeAngle = angleBetween(closestThreat.x, closestThreat.y, agent.x, agent.y);
            const rad = (fleeAngle * Math.PI) / 180;
            agent.vx += Math.cos(rad) * 45 * dt;
            agent.vy += Math.sin(rad) * 45 * dt;
          }
        }
      }
    }

    // ---- 4. Stance: NEUTRAL (Run away from attacking creatures) ----
    if (stance === 'neutral' || (stance === 'hide' && agent.status === 'fleeing')) {
      let nearestThreat: CreatureRuntimeInstance | null = null;
      let minThreatDist = 130; // Alert detection radius
      for (const threat of deckThreats) {
        const d = distance(agent.x, agent.y, threat.x, threat.y);
        if (d < minThreatDist) {
          minThreatDist = d;
          nearestThreat = threat;
        }
      }

      if (nearestThreat) {
        agent.status = 'fleeing';
        const fleeAngle = angleBetween(nearestThreat.x, nearestThreat.y, agent.x, agent.y);
        const rad = (fleeAngle * Math.PI) / 180;
        agent.vx = Math.cos(rad) * 60;
        agent.vy = Math.sin(rad) * 60;
      } else {
        agent.status = 'wandering';
      }
    }

    // ---- 5. Boids Flocking & Navigation Along Deck Corridors ----
    // Crew continue active mobility even in ATTACK stance
    if (agent.status === 'wandering' || agent.status === 'idle' || agent.status === 'attacking') {
      agent.wanderTimer -= dt;

      // Pick a new destination along corridors occasionally
      if (agent.wanderTimer <= 0 || !agent.targetSlotId) {
        agent.wanderTimer = 2.5 + Math.random() * 4;
        const randomSlot = behemoth.buildingSlots[Math.floor(Math.random() * behemoth.buildingSlots.length)];
        agent.targetSlotId = randomSlot ? randomSlot.id : null;
      }

      // Steer along corridors toward destination (central avenue or cross-aisles)
      if (agent.targetSlotId) {
        const targetPos = slotPositions.get(agent.targetSlotId);
        if (targetPos) {
          // Waypoint sits in the central promenade facing the slot
          const corridorX = targetPos.x;
          const corridorY = targetPos.y < vesselCenter.y
            ? targetPos.y + targetPos.height / 2 + 3.5  // Central promenade entrance for misc_a
            : targetPos.y - targetPos.height / 2 - 3.5; // Central promenade entrance for misc_b
          const dToTarget = distance(agent.x, agent.y, corridorX, corridorY);
          if (dToTarget > 8) {
            const angle = angleBetween(agent.x, agent.y, corridorX, corridorY);
            const rad = (angle * Math.PI) / 180;
            const wanderSpeed = agent.status === 'attacking' ? 32 : 24;
            agent.vx += (Math.cos(rad) * wanderSpeed - agent.vx) * 3 * dt;
            agent.vy += (Math.sin(rad) * wanderSpeed - agent.vy) * 3 * dt;
          } else {
            // Mill in the corridor
            agent.vx += (Math.random() - 0.5) * 16 * dt;
            agent.vy += (Math.random() - 0.5) * 16 * dt;
          }
        }
      }

      // Boids: Separation & Alignment with nearby crew
      let sepX = 0;
      let sepY = 0;
      let alignVx = 0;
      let alignVy = 0;
      let neighborCount = 0;

      for (let j = 0; j < agents.length; j++) {
        if (i === j) continue;
        const other = agents[j];
        if (other.status === 'hidden' || other.status === 'snatched') continue;

        const d = distance(agent.x, agent.y, other.x, other.y);
        if (d > 0 && d < 12) {
          // Separation
          sepX += (agent.x - other.x) / d;
          sepY += (agent.y - other.y) / d;
          alignVx += other.vx;
          alignVy += other.vy;
          neighborCount++;
        }
      }

      if (neighborCount > 0) {
        agent.vx += (sepX / neighborCount) * 30 * dt;
        agent.vy += (sepY / neighborCount) * 30 * dt;
        agent.vx += ((alignVx / neighborCount) - agent.vx) * 0.8 * dt;
        agent.vy += ((alignVy / neighborCount) - agent.vy) * 0.8 * dt;
      }
    }

    // Road-restoring guidance: gently keep crew on the corridor network (avoid drifting off into deck extremes)
    if (agent.y < vY + 22) {
      agent.vy += 26 * dt;
    } else if (agent.y > vY + vH - 22) {
      agent.vy -= 26 * dt;
    }

    // Clamp maximum speed
    const currentSpeed = Math.hypot(agent.vx, agent.vy);
    const maxSpeed = agent.status === 'fleeing' ? 49 : 32;
    if (currentSpeed > maxSpeed) {
      agent.vx = (agent.vx / currentSpeed) * maxSpeed;
      agent.vy = (agent.vy / currentSpeed) * maxSpeed;
    }

    // Apply Velocity
    agent.x += agent.vx * dt;
    agent.y += agent.vy * dt;

    // Building Obstacle Avoidance & Corridor Wall Collision:
    // Prevent crew from running over buildings (unless entering shelter in 'hide' mode)
    if (agent.status !== 'hidden') {
      const isEnteringShelter = agent.status === 'seeking_shelter' && agent.targetSlotId;

      for (const [sId, bPos] of slotPositions) {
        if (isEnteringShelter && sId === agent.targetSlotId) continue;

        const bMargin = 1.0;
        const bLeft = bPos.x - bPos.width / 2 - bMargin;
        const bRight = bPos.x + bPos.width / 2 + bMargin;
        const bTop = bPos.y - bPos.height / 2 - bMargin;
        const bBottom = bPos.y + bPos.height / 2 + bMargin;

        if (agent.x >= bLeft && agent.x <= bRight && agent.y >= bTop && agent.y <= bBottom) {
          // Inside building footprint: deflect into nearest corridor
          const dLeft = agent.x - bLeft;
          const dRight = bRight - agent.x;
          const dTop = agent.y - bTop;
          const dBottom = bBottom - agent.y;
          const minD = Math.min(dLeft, dRight, dTop, dBottom);

          if (minD === dTop) {
            agent.y = bTop - 0.5;
            agent.vy = -Math.abs(agent.vy) * 0.5 - 5; // push toward port corridor
          } else if (minD === dBottom) {
            agent.y = bBottom + 0.5;
            agent.vy = Math.abs(agent.vy) * 0.5 + 5; // push toward central promenade
          } else if (minD === dLeft) {
            agent.x = bLeft - 0.5;
            agent.vx = -Math.abs(agent.vx) * 0.5 - 5; // push toward cross-corridor
          } else {
            agent.x = bRight + 0.5;
            agent.vx = Math.abs(agent.vx) * 0.5 + 5; // push toward cross-corridor
          }
        }
      }

      // Weapon Station Obstacle Deflection: prevent crew from getting stuck at turret mounts
      for (const wSlot of behemoth.slots) {
        const wX = vX + wSlot.positionX * vW;
        const wY = wSlot.row === 'port' ? vY + 18 : vY + vH - 18;
        const wHalf = 12;
        if (
          agent.x >= wX - wHalf &&
          agent.x <= wX + wHalf &&
          agent.y >= wY - wHalf &&
          agent.y <= wY + wHalf
        ) {
          if (wSlot.row === 'port') {
            agent.y = wY + wHalf + 0.5;
            agent.vy = Math.abs(agent.vy) * 0.5 + 12;
          } else {
            agent.y = wY - wHalf - 0.5;
            agent.vy = -Math.abs(agent.vy) * 0.5 - 12;
          }
        }
      }
    }

    // Hard Boundary Clamp to Deck
    if (agent.x < minX) {
      agent.x = minX;
      agent.vx = Math.abs(agent.vx) * 0.5;
    } else if (agent.x > maxX) {
      agent.x = maxX;
      agent.vx = -Math.abs(agent.vx) * 0.5;
    }

    if (agent.y < minY) {
      agent.y = minY;
      agent.vy = Math.abs(agent.vy) * 0.5;
    } else if (agent.y > maxY) {
      agent.y = maxY;
      agent.vy = -Math.abs(agent.vy) * 0.5;
    }
  }

  // ---- 6. Creature Deck Attack & Snatch Processing ----
  for (const creature of deckThreats) {
    const def = creatureDefs.get(creature.defId);
    if (!def) continue;

    // Check if creature targets crew or deck buildings
    if (def.attackTarget !== 'crew' && def.attackTarget !== 'buildings' && !def.canShootDeck) {
      continue;
    }

    // Creature must be in striking / hovering distance of deck
    const distToBehemothCenter = distance(creature.x, creature.y, vesselCenter.x, vesselCenter.y);
    const onDeck = creature.x >= vX - 15 && creature.x <= vX + vW + 15 && creature.y >= vY - 15 && creature.y <= vY + vH + 15;

    if (!onDeck && distToBehemothCenter > (def.deckAttackRange || 180)) {
      continue;
    }

    // Find available visible crew on deck
    const visibleCrew = agents.filter(
      (a) => a.hp > 0 && a.status !== 'hidden' && a.status !== 'snatched'
    );

    // Also check hidden crew if attacking a housing building
    const hiddenCrew = agents.filter((a) => a.hp > 0 && a.status === 'hidden');

    // Attack cooldown/frequency check (driven by damageFrequency)
    // We attach an attack timer to the creature
    const timerKey = '_crewAttackTimer';
    (creature as any)[timerKey] = ((creature as any)[timerKey] || 0) + dt;

    const attackInterval = 1 / Math.max(0.1, config.damageFrequency);
    if ((creature as any)[timerKey] >= attackInterval) {
      (creature as any)[timerKey] = 0;

      // Check if creature can snatch or strike visible crew
      if (visibleCrew.length > 0) {
        // Find nearest visible crew
        let nearestTarget = visibleCrew[0];
        let minDist = Infinity;
        for (const c of visibleCrew) {
          const d = distance(creature.x, creature.y, c.x, c.y);
          if (d < minDist) {
            minDist = d;
            nearestTarget = c;
          }
        }

        // If predator is flying (e.g. Veilfangs), roll for Snatch vs Strike
        const canSnatch = def.isFlying && def.attackTarget === 'crew';
        const isSnatch = canSnatch && Math.random() < 0.40;

        if (isSnatch) {
          // SNATCH ATTACK!
          nearestTarget.status = 'snatched';
          nearestTarget.snatchedByCreatureId = creature.id;
          snatchedCount++;
          logs.push({
            text: `SNATCH: ${creature.name} swooped in and snatched a crewmember from the deck!`,
            type: 'danger',
          });
        } else {
          // DIRECT STRIKE
          const isInstaKill = Math.random() < config.instaKillChance;
          const dmg = isInstaKill ? nearestTarget.hp : config.damageAmount;
          nearestTarget.hp -= dmg;

          if (isInstaKill || nearestTarget.hp <= 0) {
            nearestTarget.hp = 0;
            casualties++;
            logs.push({
              text: `FATAL STRIKE: ${creature.name} struck and killed a crewmember on deck!`,
              type: 'danger',
            });
          } else {
            logs.push({
              text: `${creature.name} injured a crewmember on deck (${nearestTarget.hp}/${nearestTarget.maxHp} HP).`,
              type: 'warn',
            });
          }
        }
      } else if (hiddenCrew.length > 0 && Math.random() < config.hurtHiddenChance) {
        // Chance to hurt hidden crewmember inside housing
        const victim = hiddenCrew[Math.floor(Math.random() * hiddenCrew.length)];
        victim.hp -= config.damageAmount;

        if (victim.hp <= 0) {
          victim.hp = 0;
          casualties++;
          logs.push({
            text: `INTRUSION CASUALTY: ${creature.name} breached housing quarters, killing a sheltering crewmember!`,
            type: 'danger',
          });
        } else {
          logs.push({
            text: `Shrapnel struck housing quarters: sheltered crewmember injured (${victim.hp}/${victim.maxHp} HP)!`,
            type: 'warn',
          });
        }
      }
    }
  }

  // Remove deceased crew
  const livingAgents = agents.filter((a) => a.hp > 0);

  return {
    agents: livingAgents,
    pdwShots,
    logs,
    casualties,
    snatchedCount,
    savedCount,
  };
}
