import { DamageType, Projectile, WeaponDef, CreatureDef } from '../types/combat';

/**
 * Calculates damage dealt to creature physical armor and core health.
 * 
 * Rules (GDD):
 * - Physical: while Armor HP > 0, each hit is reduced by Armor Class (AC) and what is left chips Armor HP
 *   (e.g. AC 4, 5-dmg round -> 1 Armor HP); a hit at or below AC does nothing. HP is untouched while armor is left;
 *   the part of the reduced hit beyond the last Armor HP carries over into HP. Once Armor HP is 0 the armor is torn
 *   down: AC no longer applies and every hit goes to HP in full. `armorDamage` = Armor HP lost, `hpDamage` = to HP.
 *   Every discrete Physical hit deals at least 1 (after the underwater reduction and AC), e.g. a Gatling round on a submerged
 *   AC 4 target still chips 1 Armor HP. Physical hits are discrete (projectiles, shells, PDW shots).
 * - Energy: Bypasses flat ArmorClass and does not wear the armor pool. Damage = RawDamage * (1 - EnergyResistance).
 * - Chemical: Bypasses flat ArmorClass. Ticks damage over duration directly, unaffected by physical armor class.
 */
export function calculateDamageAgainstCreature(
  damageType: DamageType,
  rawDamage: number,
  currentPhysicalArmor: number,
  armorClass: number,
  energyResistance: number,
  discreteHit: boolean = true // false for per-frame ticks (drains, DoT, beams): no minimum-1 rule
): {
  armorDamage: number;
  hpDamage: number;
  totalDamage: number;
  penetrated: boolean;
} {
  let effectiveDamage = 0;

  switch (damageType) {
    case 'Physical': {
      if (rawDamage <= 0) return { armorDamage: 0, hpDamage: 0, totalDamage: 0, penetrated: false };
      const floor = discreteHit ? 1 : 0;
      // Armor torn down: the full hit goes to HP (minimum 1)
      if (currentPhysicalArmor <= 0) {
        const hit = Math.max(floor, rawDamage);
        return { armorDamage: 0, hpDamage: hit, totalDamage: hit, penetrated: true };
      }
      // Armor up: the hit is reduced by AC and the rest chips Armor HP (minimum 1 per hit)
      const reduced = Math.max(floor, rawDamage - armorClass);
      if (reduced <= 0) return { armorDamage: 0, hpDamage: 0, totalDamage: 0, penetrated: false };
      // Only what is left after the last Armor HP reaches HP
      const armorDamage = Math.min(reduced, currentPhysicalArmor);
      const hpDamage = reduced - armorDamage;
      return { armorDamage, hpDamage, totalDamage: reduced, penetrated: hpDamage > 0 };
    }

    case 'Energy': {
      // Energy bypasses flat Armor Class and the armor pool (pool is left untouched),
      // reduced only by percentile Energy Resistance.
      effectiveDamage = rawDamage * Math.max(0, 1 - energyResistance);
      return {
        armorDamage: 0,
        hpDamage: effectiveDamage,
        totalDamage: effectiveDamage,
        penetrated: true,
      };
    }

    case 'Chemical': {
      // Corrosive cloud damage penetrates armor and slowly melts armor HP simultaneously
      effectiveDamage = rawDamage;
      const armorDmg = Math.min(currentPhysicalArmor, effectiveDamage * 0.35);
      return {
        armorDamage: armorDmg,
        hpDamage: effectiveDamage,
        totalDamage: effectiveDamage + armorDmg,
        penetrated: true,
      };
    }
  }
}

/**
 * Ramming & vessel tilt impulse calculation.
 * Computes angular impulse applied to the Behemoth hull based on creature mass and speed vector.
 */
export function calculateRamImpulse(
  ramMass: number,
  creatureSpeed: number,
  impactSide: 'port' | 'starboard'
): number {
  // Base impulse factor (normalizes canonical Knots <= 50 to equivalent px/s momentum)
  const speedNormalized = creatureSpeed <= 50 ? creatureSpeed * 11.55556 : creatureSpeed;
  const impulse = (ramMass * speedNormalized) / 120; // in degrees of tilt
  return impactSide === 'port' ? -impulse : impulse;
}

/**
 * Peak list (deg) the ship reaches from upright after a tilt-velocity impulse of 1 deg/s, with the default
 * buoyancy spring (60 Hz). Used to turn a designer's "tilt per ram" (deg) into the impulse that produces it.
 */
let tiltPeakPerUnit: number | null = null;
export function tiltPeakPerUnitVelocity(): number {
  if (tiltPeakPerUnit !== null) return tiltPeakPerUnit;
  let a = 0, v = 1, peak = 0;
  for (let i = 0; i < 600; i++) {
    const r = updateVesselTilt(a, v, 1 / 60);
    a = r.tiltAngle; v = r.tiltVelocity;
    peak = Math.max(peak, Math.abs(a));
    if (v <= 0) break;
  }
  tiltPeakPerUnit = peak > 0 ? peak : 1;
  return tiltPeakPerUnit;
}

/**
 * Recovers vessel tilt toward 0 degrees using damped restorative buoyancy.
 */
export function updateVesselTilt(
  currentTilt: number,
  tiltVelocity: number,
  deltaTime: number,
  stiffness: number = 8.5,
  damping: number = 4.2
): { tiltAngle: number; tiltVelocity: number; capsized: boolean } {
  // Spring-damper physics
  const springForce = -stiffness * currentTilt;
  const dampingForce = -damping * tiltVelocity;
  const acceleration = springForce + dampingForce;

  let newVelocity = tiltVelocity + acceleration * deltaTime;
  let newAngle = currentTilt + newVelocity * deltaTime;

  // Max clamp
  const capsized = Math.abs(newAngle) >= 35.0; // 35 degrees critical capsizing limit

  return {
    tiltAngle: newAngle,
    tiltVelocity: newVelocity,
    capsized,
  };
}

/**
 * 2D Euclidean Distance
 */
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Angle in degrees between two points
 */
export function angleBetween(x1: number, y1: number, x2: number, y2: number): number {
  const rad = Math.atan2(y2 - y1, x2 - x1);
  return (rad * 180) / Math.PI;
}

/**
 * Checks if target angle is within weapon shooting arc
 */
export function isWithinArc(targetAngle: number, weaponFacingAngle: number, shootingArc: number): boolean {
  let diff = Math.abs(targetAngle - weaponFacingAngle) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff <= shootingArc / 2;
}

/**
 * Clamps an angle to stay within a traverse arc centered at centerAngle.
 * Prevents turrets from rotating into forbidden sectors (e.g. into the ship deck).
 */
export function clampAngleToArc(angle: number, centerAngle: number, arc: number): number {
  if (arc >= 360) return ((angle % 360) + 360) % 360;
  const diff = ((angle - centerAngle + 540) % 360) - 180;
  const maxHalf = arc / 2;
  if (Math.abs(diff) <= maxHalf) {
    return ((angle % 360) + 360) % 360;
  }
  const clampedDiff = diff > 0 ? maxHalf : -maxHalf;
  return ((centerAngle + clampedDiff + 360) % 360);
}
