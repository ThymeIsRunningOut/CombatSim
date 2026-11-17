/**
 * Preset data migrations.
 *
 * UNITS_VERSION 'metric-v1' (Nov 2026): definitions are authored in metric.
 *   WeaponDef:  range (m), aoe (m), projectileSpeed (m/s)
 *   CreatureDef: radius (m), crowdDispersion (m), deckAttackRange (m), aggroRadiusMeters (m); px `aggroRadius` removed
 *   CrewSimulationConfig: pdwRange (m)
 *   Behavior nodes: minDistance, spreadRadius, maxDistance, spacing, flockSeparationDist, orbitRadius,
 *                   distanceThreshold (m); minGlideSpeed (kts)
 * The engine still runs in canvas px internally and converts at the boundary (metersToPx).
 */
import { CANVAS_METERS_PER_PX } from '../engine/measurements';

export const UNITS_VERSION = 'metric-v2';
const METRIC_V1 = 'metric-v1';
/** Behavior trees have been metric since 'metric-v1' and did not change in v2. */
export const TREE_UNITS_VERSION = METRIC_V1;

/*
 * 'metric-v2' (Nov 2026): UE turret geometry for weapons.
 *   range -> distance (m, 0 = infinite) + detectionRange (m)
 *   shootingArc / rotationCap (deg) -> coneRadius (m at 1 m; half-angle = atan(coneRadius)), max ±85°
 *   old coneRadius (deg spread) -> spreadDeg (± half of it)
 *   shootingArea (barrel radius, m) added, default 2 m
 */

/** Legacy canvas px -> meters (1 px = 1.923 m). Rounded to 0.1 m. */
const pxToM = (px: number) => Math.round(px * CANVAS_METERS_PER_PX * 10) / 10;

/** Legacy px/s literal at the old 4.29 px/s-per-knot scale -> knots. */
const legacyPxSpeedToKnots = (px: number) => Math.round((px / (825 * (260 / 50000))) * 10) / 10;

const NODE_DISTANCE_KEYS = [
  'minDistance', 'spreadRadius', 'maxDistance', 'spacing', 'flockSeparationDist', 'orbitRadius', 'distanceThreshold',
] as const;

export function migrateWeaponToMetric(w: any): any {
  const out = { ...w };
  if (typeof out.range === 'number') out.range = pxToM(out.range);
  if (typeof out.aoe === 'number') out.aoe = pxToM(out.aoe);
  if (typeof out.projectileSpeed === 'number') out.projectileSpeed = pxToM(out.projectileSpeed);
  return out;
}

export function migrateWeaponToV2(w: any): any {
  if (typeof w.distance === 'number' && typeof w.detectionRange === 'number') return w;
  const out = { ...w };
  const range = typeof out.range === 'number' ? out.range : 1000;
  out.distance = range;
  out.detectionRange = range;
  const arc = Math.min(typeof out.shootingArc === 'number' ? out.shootingArc : 240, typeof out.rotationCap === 'number' ? out.rotationCap : 225);
  const half = Math.min(85, Math.max(0, arc / 2));
  const oldSpread = typeof out.coneRadius === 'number' ? out.coneRadius : 0;
  out.coneRadius = Math.round(Math.tan((half * Math.PI) / 180) * 1000) / 1000;
  out.spreadDeg = Math.round((oldSpread / 2) * 10) / 10;
  if (typeof out.shootingArea !== 'number') out.shootingArea = 2;
  delete out.range;
  delete out.shootingArc;
  delete out.rotationCap;
  return out;
}

export function migrateCreatureToMetric(c: any): any {
  const out = { ...c };
  if (typeof out.radius === 'number') out.radius = pxToM(out.radius);
  if (typeof out.crowdDispersion === 'number') out.crowdDispersion = pxToM(out.crowdDispersion);
  if (typeof out.deckAttackRange === 'number') out.deckAttackRange = pxToM(out.deckAttackRange);
  // The simulation always used aggroRadiusMeters (default 1000 m, Leviarch 2000 m); the px field was only read by the
  // legacy AI and the old Balancing slider. Keep the value the simulation actually used.
  if (typeof out.aggroRadiusMeters !== 'number') out.aggroRadiusMeters = out.id === 'thunder_leviarch' ? 2000 : 1000;
  delete out.aggroRadius;
  return out;
}

export function migrateCrewConfigToMetric(cfg: any): any {
  const out = { ...cfg };
  if (typeof out.pdwRange === 'number') out.pdwRange = pxToM(out.pdwRange);
  return out;
}

export function migrateBehaviorTreeToMetric(tree: any): any {
  if (!tree || !Array.isArray(tree.nodes)) return tree;
  return {
    ...tree,
    nodes: tree.nodes.map((n: any) => {
      const out = { ...n };
      for (const k of NODE_DISTANCE_KEYS) if (typeof out[k] === 'number') out[k] = pxToM(out[k]);
      if (typeof out.minGlideSpeed === 'number') out.minGlideSpeed = legacyPxSpeedToKnots(out.minGlideSpeed);
      return out;
    }),
  };
}

/**
 * Migrates a preset snapshot ({ weapons, creatures, crewConfig, behaviorTrees, ... }) to metric if it predates
 * UNITS_VERSION. Snapshots already tagged `units: 'metric-v1'` are returned unchanged.
 */
export function migratePresetSnapshot<T extends Record<string, any>>(data: T): T {
  if (!data || typeof data !== 'object' || data.units === UNITS_VERSION) return data;
  let out: any = { ...data };
  // px era -> metric-v1
  if (out.units !== METRIC_V1) {
    if (Array.isArray(out.weapons)) out.weapons = out.weapons.map(migrateWeaponToMetric);
    if (Array.isArray(out.creatures)) out.creatures = out.creatures.map(migrateCreatureToMetric);
    if (out.crewConfig) out.crewConfig = migrateCrewConfigToMetric(out.crewConfig);
    if (out.behaviorTrees && typeof out.behaviorTrees === 'object') {
      out.behaviorTrees = Object.fromEntries(
        Object.entries(out.behaviorTrees).map(([id, t]) => [id, migrateBehaviorTreeToMetric(t)])
      );
    }
  }
  // metric-v1 -> metric-v2 (weapon geometry)
  if (Array.isArray(out.weapons)) out.weapons = out.weapons.map(migrateWeaponToV2);
  out.units = UNITS_VERSION;
  return out;
}
