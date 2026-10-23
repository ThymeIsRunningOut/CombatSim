import { DamageType, Projectile, WeaponDef, CreatureDef } from '../types/combat';

/**
 * Calculates damage dealt to creature physical armor and core health.
 * 
 * Rules:
 * - Physical: Effective hit = max(1, DPP - ArmorClass). Depletes physical armor pool first, excess penetrates to core HP.
 * - Energy: Bypasses flat ArmorClass. Applies percentile reduction: Damage = RawDamage * (1 - EnergyResistance).
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
      effectiveDamage = Math.max(1, rawDamage - armorClass);
      if (currentPhysicalArmor > 0) {
        if (effectiveDamage <= currentPhysicalArmor) {
          return {
            armorDamage: effectiveDamage,
            hpDamage: 0,
            totalDamage: effectiveDamage,
            penetrated: false,
          };
        } else {
          const armorDmg = currentPhysicalArmor;
          const hpDmg = effectiveDamage - currentPhysicalArmor;
          return {
            armorDamage: armorDmg,
            hpDamage: hpDmg,
            totalDamage: effectiveDamage,
            penetrated: true,
          };
        }
      } else {
        return {
          armorDamage: 0,
          hpDamage: effectiveDamage,
          totalDamage: effectiveDamage,
          penetrated: true,
        };
      }
    }

    case 'Energy': {
      effectiveDamage = rawDamage * Math.max(0, 1 - energyResistance);
      // Energy attacks bypass physical armor to directly damage core HP, but also slightly corrode armor (10%)
      const armorDmg = Math.min(currentPhysicalArmor, effectiveDamage * 0.1);
      const hpDmg = effectiveDamage;
      return {
        armorDamage: armorDmg,
        hpDamage: hpDmg,
        totalDamage: hpDmg + armorDmg,
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
