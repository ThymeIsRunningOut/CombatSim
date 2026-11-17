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

export const UNITS_VERSION = 'metric-v1';

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
  const out: any = { ...data, units: UNITS_VERSION };
  if (Array.isArray(out.weapons)) out.weapons = out.weapons.map(migrateWeaponToMetric);
  if (Array.isArray(out.creatures)) out.creatures = out.creatures.map(migrateCreatureToMetric);
  if (out.crewConfig) out.crewConfig = migrateCrewConfigToMetric(out.crewConfig);
  if (out.behaviorTrees && typeof out.behaviorTrees === 'object') {
    out.behaviorTrees = Object.fromEntries(
      Object.entries(out.behaviorTrees).map(([id, t]) => [id, migrateBehaviorTreeToMetric(t)])
    );
  }
  return out;
}
