import { CreatureRuntimeInstance, CreatureDef, WeaponSlot, CreatureStage, AttackTarget } from '../types/combat';
import { distance, angleBetween } from './math';
import { knotsSpeedToPxPerSec } from './measurements';

export interface CreatureAIUpdateResult {
  creature: CreatureRuntimeInstance;
  events: Array<{
    type: 'STRIKE_HULL' | 'SHOOT_DECK' | 'SUBMERGED' | 'SURFACED' | 'RAM_IMPACT' | 'HULL_SCRAPE';
    targetSlotId?: string;
    target?: AttackTarget;
    damage: number;
    stunChance: number;
    stunDuration: number;
    ramMass: number;
    strikeSide?: 'port' | 'starboard';
  }>;
}

/**
 * Updates creature state machine:
 * - Aggression Meter (0-100%):
 *    0 - 39%: Retreat (swims away / dives)
 *   40 - 59%: Neutral (patrols outside direct range, stalks)
 *   60 - 100%: Pursue (locks onto Behemoth / charges in)
 * - Behavior timings (underwaterInterval vs surfaceInterval, chargeWindup, strikeDuration)
 * - Target selection: prioritizes active slots with highest power draw and operational status
 */
export function updateCreatureAI(
  creature: CreatureRuntimeInstance,
  def: CreatureDef,
  behemothCenter: { x: number; y: number; width: number; height: number },
  slots: WeaponSlot[],
  dt: number
): CreatureAIUpdateResult {
  const events: CreatureAIUpdateResult['events'] = [];
  const updated = { ...creature };

  // Handle Stun
  if (updated.stunned) {
    updated.stunTimer -= dt;
    if (updated.stunTimer <= 0) {
      updated.stunned = false;
    } else {
      return { creature: updated, events };
    }
  }

  // Calculate distance to Behemoth center
  const distToBehemoth = distance(updated.x, updated.y, behemothCenter.x, behemothCenter.y);

  // Aggression logic based on HP loss:
  // >30% HP loss drops aggression by 20; >60% drops by 40
  const hpPercent = (updated.hp + updated.physicalArmor) / (updated.maxHp + updated.maxPhysicalArmor);
  let baseAggression = 75; // Baseline high pursue

  if (hpPercent < 0.40) {
    baseAggression = 30; // Retreat zone
  } else if (hpPercent < 0.70) {
    baseAggression = 50; // Neutral zone
  } else {
    baseAggression = 80; // Pursue zone
  }

  // Check aggro radius trigger
  if (distToBehemoth <= def.aggroRadius) {
    baseAggression = Math.max(baseAggression, 65);
  }

  // Smooth aggression transition
  updated.aggression = updated.aggression * (1 - dt * 2.0) + baseAggression * (dt * 2.0);

  // Stage timer progress
  updated.stageTimer += dt;

  // Orbit-drain creatures (Aetherfin-style) manage their own surface/depths cycle while pursuing
  const orbitDrainPursuing = def.pursueStyle === 'orbit_drain' && updated.aggression >= 60;
  if (!orbitDrainPursuing && updated.pursuePhase) {
    updated.pursuePhase = 'charging';
    updated.chargeTimer = 0;
    updated.phaseTimer = 0;
    updated.drainTargets = [];
    updated.drainArrived = false;
  }

  // Submerged vs Surface cycle
  if (orbitDrainPursuing) {
    // handled in the pursue branch below
  } else if (updated.underwater) {
    updated.depthRatio = Math.min(1.0, updated.depthRatio + dt * 1.5);
    if (updated.stageTimer >= def.underwaterInterval) {
      // Surface!
      updated.underwater = false;
      updated.stageTimer = 0;
      updated.stage = 'Surfacing';
      events.push({
        type: 'SURFACED',
        damage: 0,
        stunChance: 0,
        stunDuration: 0,
        ramMass: 0,
      });
    }
  } else {
    updated.depthRatio = Math.max(0.0, updated.depthRatio - dt * 1.5);
  }

  // Select target slot based on power draw and proximity
  if (!updated.targetSlotId || Math.random() < 0.02) {
    let bestSlot: WeaponSlot | null = null;
    let highestWeight = -1;

    for (const slot of slots) {
      if (!slot.weapon) continue;
      // Weighting formula: powerDraw * 2 + (isFiring ? 50 : 0) - distance
      const slotWorldX = behemothCenter.x - behemothCenter.width / 2 + slot.positionX * behemothCenter.width;
      const slotWorldY = slot.row === 'port' ? behemothCenter.y - behemothCenter.height / 2 : behemothCenter.y + behemothCenter.height / 2;
      const d = distance(updated.x, updated.y, slotWorldX, slotWorldY);
      const weight = (slot.weapon.powerDraw * 1.5) + (slot.isFiring ? 80 : 0) + (1000 - d * 0.5);

      if (weight > highestWeight) {
        highestWeight = weight;
        bestSlot = slot;
      }
    }
    updated.targetSlotId = bestSlot ? bestSlot.id : null;
  }

  // Determine State Loop according to Aggression Meter
  // 0 - 39% Retreat: Swim away
  // 40 - 59% Neutral: Circular patrol
  // 60 - 100% Pursue: Close in and attack
  const isRetreat = updated.aggression < 40;
  const isNeutral = updated.aggression >= 40 && updated.aggression < 60;
  const isPursue = updated.aggression >= 60;

  let targetX = behemothCenter.x;
  let targetY = behemothCenter.y;
  const baseMovementSpeedPx = knotsSpeedToPxPerSec(def.movementSpeed);
  let targetSpeed = baseMovementSpeedPx;

  if (isRetreat) {
    updated.stage = 'Retreating';
    // Move away from behemoth
    const awayAngle = angleBetween(behemothCenter.x, behemothCenter.y, updated.x, updated.y);
    targetX = updated.x + Math.cos((awayAngle * Math.PI) / 180) * 400;
    targetY = updated.y + Math.sin((awayAngle * Math.PI) / 180) * 400;

    // Submerge when retreating if timer permits
    if (!updated.underwater && updated.stageTimer > 3.0) {
      updated.underwater = true;
      updated.stageTimer = 0;
      events.push({
        type: 'SUBMERGED',
        damage: 0,
        stunChance: 0,
        stunDuration: 0,
        ramMass: 0,
      });
    }
  } else if (isNeutral) {
    updated.stage = 'Stalking';
    // Circular orbit around Behemoth at distance ~380px
    const currentAngle = angleBetween(behemothCenter.x, behemothCenter.y, updated.x, updated.y);
    const orbitAngle = currentAngle + 35 * dt; // Clockwise orbit
    const orbitRadius = Math.max(340, def.aggroRadius * 0.85);
    targetX = behemothCenter.x + Math.cos((orbitAngle * Math.PI) / 180) * orbitRadius;
    targetY = behemothCenter.y + Math.sin((orbitAngle * Math.PI) / 180) * orbitRadius;
    targetSpeed = baseMovementSpeedPx * 0.75;
  } else if (isPursue) {
    if (def.pursueStyle === 'orbit_drain') {
      // ---- Orbit-drain Pursue: Charging -> Attacking ----
      const hullContact = behemothCenter.height / 2 + updated.radius + 15;
      if (updated.pursuePhase !== 'attacking') {
        // CHARGING: orbit counter-clockwise, alternating depths / surface. Only targetable at the surface.
        updated.pursuePhase = 'charging';
        updated.stage = 'Charging';
        updated.chargeTimer = (updated.chargeTimer ?? 0) + dt;
        updated.phaseTimer = (updated.phaseTimer ?? 0) + dt;

        if (updated.underwater && updated.phaseTimer >= (def.depthsDuration ?? 3)) {
          updated.underwater = false;
          updated.phaseTimer = 0;
          events.push({ type: 'SURFACED', damage: 0, stunChance: 0, stunDuration: 0, ramMass: 0 });
        } else if (!updated.underwater && updated.phaseTimer >= (def.surfaceDuration ?? 3)) {
          updated.underwater = true;
          updated.phaseTimer = 0;
          events.push({ type: 'SUBMERGED', damage: 0, stunChance: 0, stunDuration: 0, ramMass: 0 });
        }
        updated.depthRatio = updated.underwater
          ? Math.min(1.0, updated.depthRatio + dt * 1.5)
          : Math.max(0.0, updated.depthRatio - dt * 1.5);

        const cur = angleBetween(behemothCenter.x, behemothCenter.y, updated.x, updated.y);
        const orbitAngle = cur - 25; // counter-clockwise (opposite of the neutral orbit)
        const orbitRadius = Math.max(300, Math.min(360, def.aggroRadius * 0.65));
        targetX = behemothCenter.x + Math.cos((orbitAngle * Math.PI) / 180) * orbitRadius;
        targetY = behemothCenter.y + Math.sin((orbitAngle * Math.PI) / 180) * orbitRadius;

        if (updated.chargeTimer >= (def.chargeStageDuration ?? 18)) {
          updated.pursuePhase = 'attacking';
          updated.attackTimer = 0;
          updated.phaseTimer = 0;
          updated.drainTargets = [];
          updated.drainStunAcc = 0;
          updated.drainArrived = false;
          updated.underwater = true; // attacks from under the deck: immune to weapons
        }
      } else {
        // ATTACKING: slip under the hull and stay there, draining buildings
        updated.stage = 'Striking';
        updated.underwater = true;
        updated.depthRatio = Math.min(1.0, updated.depthRatio + dt * 1.5);
        updated.phaseTimer = (updated.phaseTimer ?? 0) + dt;
        targetX = behemothCenter.x;
        targetY = behemothCenter.y;

        if (!updated.drainArrived && (distToBehemoth <= hullContact || updated.phaseTimer > 8)) {
          updated.drainArrived = true;
        }
        if (updated.drainArrived) {
          targetSpeed = baseMovementSpeedPx * 0.2; // rubbing against the hull
          updated.attackTimer = (updated.attackTimer ?? 0) + dt;
          if (updated.attackTimer >= (def.attackDuration ?? 10)) {
            updated.pursuePhase = 'charging';
            updated.chargeTimer = 0;
            updated.phaseTimer = 0;
            updated.drainTargets = [];
            updated.drainArrived = false;
          }
        }
      }
    } else if (updated.stage === 'Surfacing') {
      if (updated.stageTimer >= 1.0) {
        updated.stage = 'Charging';
        updated.stageTimer = 0;
      }
    } else if (updated.stage === 'Charging') {
      targetSpeed = baseMovementSpeedPx * 1.45; // Rush in!
      targetX = behemothCenter.x;
      targetY = behemothCenter.y;

      // Special check: Thunder Leviarch hits buildings when hovering over deck
      if (def.canShootDeck && distToBehemoth <= (def.deckAttackRange || 300) && updated.stageTimer >= def.chargeWindup) {
        events.push({
          type: 'SHOOT_DECK',
          targetSlotId: updated.targetSlotId || undefined,
          target: 'buildings',
          damage: def.strikeDamageRate * 0.45,
          stunChance: def.strikeStunChance,
          stunDuration: def.strikeStunDuration,
          ramMass: 1.0,
        });
        updated.stage = 'Retreating';
        updated.stageTimer = 0;
      } else if (distToBehemoth <= behemothCenter.height / 2 + updated.radius + 15) {
        // Impact or Hull Scrape on Behemoth!
        updated.stage = 'Striking';
        updated.stageTimer = 0;

        const impactSide = updated.y < behemothCenter.y ? 'port' : 'starboard';
        const isHoveringDeck = updated.isFlying;
        const isUnderHull = updated.underwater || !updated.isFlying;
        const targetType = isHoveringDeck ? 'buildings' : (isUnderHull ? 'hull' : (def.attackTarget || 'hull'));

        events.push({
          type: isUnderHull ? 'HULL_SCRAPE' : (isHoveringDeck ? 'SHOOT_DECK' : 'RAM_IMPACT'),
          targetSlotId: updated.targetSlotId || undefined,
          target: targetType,
          damage: def.strikeDamageRate,
          stunChance: def.strikeStunChance,
          stunDuration: def.strikeStunDuration,
          ramMass: def.strikeRamMass,
          strikeSide: impactSide,
        });
      }
    } else if (updated.stage === 'Striking') {
      if (updated.stageTimer >= def.strikeDuration) {
        // Dive or retreat after strike
        updated.underwater = true;
        updated.stageTimer = 0;
        updated.stage = 'Underwater';
        events.push({
          type: 'SUBMERGED',
          damage: 0,
          stunChance: 0,
          stunDuration: 0,
          ramMass: 0,
        });
      }
    } else {
      updated.stage = 'Charging';
    }
  }

  // Kinematic movement toward target (steering & acceleration)
  const desiredAngle = angleBetween(updated.x, updated.y, targetX, targetY);
  
  // Smooth aquatic rotation with turning circle
  let angleDiff = (desiredAngle - updated.angle) % 360;
  if (angleDiff > 180) angleDiff -= 360;
  if (angleDiff < -180) angleDiff += 360;

  // Turnaround disambiguation to perform a consistent, smooth circular loop
  let turnDir = Math.sign(angleDiff);
  if (Math.abs(angleDiff) >= 170) {
    const curRad = (updated.angle * Math.PI) / 180;
    const forwardX = Math.cos(curRad);
    const forwardY = Math.sin(curRad);
    const toBehX = behemothCenter.x - updated.x;
    const toBehY = behemothCenter.y - updated.y;
    const cross = forwardX * toBehY - forwardY * toBehX;
    turnDir = cross >= 0 ? -1 : 1;
  }
  
  const baseRate = def.turningRate || 85;
  const turnRate = Math.abs(angleDiff) > 45 ? Math.max(baseRate * 1.8, 140) : baseRate;
  const maxTurn = turnRate * dt;
  const turnAmount = (turnDir || 1) * Math.min(maxTurn, Math.abs(angleDiff));
  updated.angle = (updated.angle + turnAmount + 360) % 360;

  // Forward velocity vector with curve braking to form a tight circular arc
  const turnBrake = Math.abs(angleDiff) > 30 ? (0.7 + 0.3 * Math.max(0, Math.cos((angleDiff * Math.PI) / 180))) : 1.0;
  const currentSpeed = targetSpeed * turnBrake;
  const rad = (updated.angle * Math.PI) / 180;
  const desiredVx = Math.cos(rad) * currentSpeed;
  const desiredVy = Math.sin(rad) * currentSpeed;

  const blend = Math.min(1.0, 9.0 * dt);
  updated.vx = updated.vx * (1 - blend) + desiredVx * blend;
  updated.vy = updated.vy * (1 - blend) + desiredVy * blend;

  updated.x += updated.vx * dt;
  updated.y += updated.vy * dt;

  // Swarm sub-entity offset jitter update (supports up to 100 entities in an organic flock cloud)
  if (updated.isSwarm && updated.swarmEntities) {
    const totalCount = updated.swarmEntities.length;
    const dispersionScale = (def.crowdDispersion ?? updated.crowdDispersion ?? 32) / 32;
    const ringSpacing = Math.min(24, (85 / Math.sqrt(Math.max(1, totalCount))) * dispersionScale);
    const goldenAngle = 2.39996; // ~137.5 deg in radians

    for (let i = 0; i < totalCount; i++) {
      const radius = (12 + Math.sqrt(i) * ringSpacing) * dispersionScale;
      const subAngle = (i * goldenAngle) + (updated.stageTimer * 0.8) + (i % 5) * 0.15;
      updated.swarmEntities[i].x = updated.x + Math.cos(subAngle) * radius;
      updated.swarmEntities[i].y = updated.y + Math.sin(subAngle) * radius;
    }
  }

  return { creature: updated, events };
}
