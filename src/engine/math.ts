import { DamageType, Projectile, WeaponDef, CreatureDef } from '../types/combat';

/**
 * Calculates damage dealt to creature physical armor and core health.
 * 
 * Rules (GDD):
 * - Physical: while Armor HP > 0, each hit is reduced by Armor Class (AC). The armor loses what it absorbed:
 *   AC per pierced hit (a hit at or below AC is fully absorbed and wears the armor by its own size). Once Armor HP
 *   reaches 0 the armor stops reducing damage. `armorDamage` = Armor HP lost (wear), `hpDamage` = damage to HP.
 * - Energy: Bypasses flat ArmorClass and does not wear the armor pool. Damage = RawDamage * (1 - EnergyResistance).
 * - Chemical: Bypasses flat ArmorClass. Ticks damage over duration directly, unaffected by physical armor class.
 */
export function calculateDamageAgainstCreature(
  damageType: DamageType,
  rawDamage: number,
  currentPhysicalArmor: number,
  armorClass: number,
  energyResistance: number
): {
  armorDamage: number;
  hpDamage: number;
  totalDamage: number;
  penetrated: boolean;
} {
  let effectiveDamage = 0;

  switch (damageType) {
    case 'Physical': {
      // Armor absorbs up to AC per hit (never more than the hit or the Armor HP left) and wears by that amount
      const absorbed = currentPhysicalArmor > 0 ? Math.max(0, Math.min(rawDamage, armorClass, currentPhysicalArmor)) : 0;
      const hpDamage = Math.max(0, rawDamage - absorbed);
      return {
        armorDamage: absorbed,
        hpDamage,
        totalDamage: absorbed + hpDamage,
        penetrated: hpDamage > 0,
      };
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
