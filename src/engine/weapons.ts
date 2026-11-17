/**
 * UE-parity turret geometry helpers (Phase 2 weapon model).
 *
 * - Cone: traverse envelope. Half-angle = atan(coneRadius / 1 m). The turret rotates inside it at turnSpeed.
 * - Shooting Area: barrel radius (m) — cone width at the muzzle, beam width, spray start width.
 * - Distance: max travel (m), 0 = infinite. Detection Range: engagement range (m).
 * - Physical: projectiles with uniform ±spreadDeg. Energy: line beam, first target, dps. Chemical: fills the cone, dps,
 *   passes through all targets, leaves lingering clouds.
 */
import { WeaponDef, WeaponSlot } from '../types/combat';
import { metersToPx } from './measurements';

export const DEFAULT_SHOOTING_AREA_M = 2;
export const MAX_CONE_HALF_ANGLE_DEG = 90;

export const isBeamWeapon = (w: WeaponDef) => w.damageType === 'Energy' && w.trajectory === 'Line';
export const isSprayWeapon = (w: WeaponDef) => w.damageType === 'Chemical';
export const isContinuousWeapon = (w: WeaponDef) => isBeamWeapon(w) || isSprayWeapon(w);

/** Traverse half-angle (deg) from the UE cone radius (m at 1 m). */
export function coneHalfAngleDeg(w: WeaponDef): number {
  return Math.min(MAX_CONE_HALF_ANGLE_DEG, (Math.atan(Math.max(0, w.coneRadius || 0)) * 180) / Math.PI);
}

/** Full traverse arc (deg) for a mounted weapon: the cone, optionally narrowed by the mount's deck-protection limit. */
export function traverseArcDeg(w: WeaponDef, slot?: Pick<WeaponSlot, 'rotationCap'>): number {
  const cone = 2 * coneHalfAngleDeg(w);
  return slot?.rotationCap ? Math.min(cone, slot.rotationCap) : cone;
}

/** Max travel in px (Infinity when distance is 0 / unset). */
export function weaponDistancePx(w: WeaponDef): number {
  return w.distance && w.distance > 0 ? metersToPx(w.distance) : Infinity;
}

/** Engagement range in px: detection range, but never beyond what the weapon can reach. */
export function weaponEngageRangePx(w: WeaponDef): number {
  const det = w.detectionRange && w.detectionRange > 0 ? metersToPx(w.detectionRange) : Infinity;
  return Math.min(det, weaponDistancePx(w));
}

export function shootingAreaPx(w: WeaponDef): number {
  return metersToPx(w.shootingArea ?? DEFAULT_SHOOTING_AREA_M);
}

/**
 * Point-in-spray test for the cone trapezoid: forward f along the mount facing, lateral offset l.
 * Inside when 0 <= f <= distance and |l| <= shootingArea + coneRadius * f (all px; coneRadius is a slope).
 */
export function isInsideSprayCone(w: WeaponDef, f: number, l: number, targetRadiusPx = 0): boolean {
  if (f < -targetRadiusPx || f > weaponDistancePx(w) + targetRadiusPx) return false;
  return Math.abs(l) <= shootingAreaPx(w) + Math.max(0, w.coneRadius || 0) * Math.max(0, f) + targetRadiusPx;
}
