/**
 * Canonical in-game measurements & Unreal Engine conversion standards.
 *
 * DEFINED SIZES & GRIDS (design spec, Nov 20 2026):
 * - Default grid (World Tile): 250,000 UU = 2,500 m per side.
 * - Behemoth: 50,500 x 13,000 UU (505 m long, 130 m beam).
 * - Knot: 825 UU/s (8.25 m/s). Behemoth regular speed 10 kts = 8,250 UU/s.
 *
 * UNREAL ENGINE STANDARDS:
 * - 1 Unreal Unit (UU) = 1 centimeter (0.01 m). 1 Meter = 100 UU.
 *
 * SIMULATION CANVAS STANDARDS (1000 x 700 px):
 * - Fixed scale: 1 UU = 0.0052 px (1 px = 192.3 UU = 1.923 m; 1 m = 0.52 px).
 * - Behemoth hull: 50,500 x 13,000 UU = 262.6 x 67.6 px.
 * - World Tile side: 250,000 UU = 1,300 px.
 * - 1 Knot (825 UU/s) = 4.29 px/s.
 */

// ==========================================
// CANONICAL CONSTANTS
// ==========================================
export const METERS_PER_TILE = 2500; // 250,000 UU default grid = 2.5 km
/** Legacy alias (distance unit once named a 'knot'): one world tile side. */
export const METERS_PER_KNOT = METERS_PER_TILE;
export const KM_PER_TILE = METERS_PER_TILE / 1000;

export const BEHEMOTH_LENGTH_METERS = 505; // 50,500 UU
export const BEHEMOTH_BEAM_METERS = 130; // 13,000 UU
export const BEHEMOTH_LENGTH_KNOTS = BEHEMOTH_LENGTH_METERS / METERS_PER_KNOT; // fraction of a tile
export const BEHEMOTH_BEAM_KNOTS = BEHEMOTH_BEAM_METERS / METERS_PER_KNOT; // fraction of a tile

// Unreal Engine 5 Units (1 UU = 1 cm)
export const UNREAL_UNITS_PER_METER = 100;
export const UNREAL_UNITS_PER_TILE = METERS_PER_TILE * UNREAL_UNITS_PER_METER; // 250,000 UU (Game Units)
export const BEHEMOTH_LENGTH_UNREAL = BEHEMOTH_LENGTH_METERS * UNREAL_UNITS_PER_METER; // 50,500 UU
export const BEHEMOTH_BEAM_UNREAL = BEHEMOTH_BEAM_METERS * UNREAL_UNITS_PER_METER; // 13,000 UU

/**
 * Speed unit: 1 Knot = 8.25 m/s = 825 UU/s (the original game speed scale).
 * Nov 17 2026 the knot was unified to 1 tile/min = 45 m/s; Nov 19 2026 it went back to 8.25 m/s so huge
 * creatures and ships move 5.45x slower (design decision). Distances are unchanged.
 * KNOTS_TO_GAME_UNITS is Game Units (UU) per second for 1 kt of speed.
 */
export const METERS_PER_SECOND_PER_KNOT = 8.25;
export const KNOTS_TO_GAME_UNITS = METERS_PER_SECOND_PER_KNOT * 100; // 825 UU/s

/** Speed scale px/s literals were authored at (825 UU/s per kt) — same as the current scale, so no rescale. */
export const LEGACY_KNOTS_TO_GAME_UNITS = 825;
/** Factor from the 45 m/s knot (Nov 17-19 2026) to the current knot: angular rates authored then x this keep their turning circles. */
export const SPEED_SCALE_FROM_45MPS_KNOT = METERS_PER_SECOND_PER_KNOT / 45;

/** Canonical Behemoth speed settings */
export const BEHEMOTH_SPEED_PRESETS = {
  STOP: 0,           // 0 kts = 0 m/s
  QUARTER: 2,        // 1/4 speed: 2 kts = 16.5 m/s
  HALF: 5,           // 1/2 speed: 5 kts = 41 m/s
  THREE_QUARTERS: 8, // 3/4 speed: 8 kts = 66 m/s
  REGULAR: 10,       // Regular speed: 10 kts = 82.5 m/s (8,250 UU/s)
  OVERDRIVE: 15,     // Overdrive: 15 kts = 124 m/s (12,375 UU/s)
} as const;

// Base Nautical Speed (1 Knot per minute)
export const BASE_NAUTICAL_SPEED_KNOTS_PER_MIN = 1.0;
export const BASE_NAUTICAL_SPEED_MPS = METERS_PER_SECOND_PER_KNOT; // 8.25 m/s
export const BASE_NAUTICAL_SPEED_KMH = METERS_PER_SECOND_PER_KNOT * 3.6; // 29.7 km/h
export const BASE_NAUTICAL_SPEED_UUPS = KNOTS_TO_GAME_UNITS; // 825 UU/s

// Simulation Canvas Representation
// Fixed simulation scale (unchanged when ship sizes change): 1 UU = 0.0052 px
export const CANVAS_PX_PER_GAME_UNIT = 0.0052;
export const CANVAS_PX_PER_METER = CANVAS_PX_PER_GAME_UNIT * UNREAL_UNITS_PER_METER; // 0.52 px/m
export const CANVAS_METERS_PER_PX = 1 / CANVAS_PX_PER_METER; // 1.923 m/px
export const CANVAS_BEHEMOTH_WIDTH_PX = BEHEMOTH_LENGTH_UNREAL * CANVAS_PX_PER_GAME_UNIT; // 262.6 px
export const CANVAS_BEHEMOTH_HEIGHT_PX = BEHEMOTH_BEAM_UNREAL * CANVAS_PX_PER_GAME_UNIT; // 67.6 px
export const CANVAS_TILE_SIZE_PX = UNREAL_UNITS_PER_TILE * CANVAS_PX_PER_GAME_UNIT; // 1,300 px
// Pixels/second per Knot (825 UU/s * px_per_UU = 4.29 px/s per Knot)
export const CANVAS_PX_PER_KNOT_SPEED = KNOTS_TO_GAME_UNITS * CANVAS_PX_PER_GAME_UNIT; // 4.29 px/s per Knot
/** Legacy px/s per Knot (4.29) — px/s literals authored before the 45 m/s unification. */
export const LEGACY_CANVAS_PX_PER_KNOT_SPEED = LEGACY_KNOTS_TO_GAME_UNITS * CANVAS_PX_PER_GAME_UNIT;
/** Multiply a legacy px/s literal by this to keep the same Knot meaning (1.0 now that the knot is 825 UU/s again; 5.45 at 45 m/s). */
export const LEGACY_PX_SPEED_RESCALE = CANVAS_PX_PER_KNOT_SPEED / LEGACY_CANVAS_PX_PER_KNOT_SPEED;

/** Default swarm crowd dispersion (m) — formerly 32 px. Dispersion-scaled behaviors use ratios against this. */
export const CROWD_DISPERSION_DEFAULT_M = 61.5;

// ==========================================
// SPEED CONVERSIONS
// ==========================================

/**
 * Normalizes a raw speed value:
 * If value > 100, it is a legacy px/s value (e.g. 105, 120, 150, 200, 405, 540), which is converted to canonical Knots (kts).
 * Otherwise it is already in canonical Knots.
 */
export function normalizeSpeedToKnots(speedVal: number): number {
  if (!speedVal || speedVal <= 0) return 1.0;
  if (speedVal > 100) {
    // Legacy px/s (authored at 4.29 px/s per kt) -> Knots
    return Number((speedVal / LEGACY_CANVAS_PX_PER_KNOT_SPEED).toFixed(1));
  }
  return Number(speedVal.toFixed(1));
}

/**
 * Converts speed in Knots to simulation pixels per second (1 kt = 8.25 m/s = 4.29 px/s).
 * Automatically accepts legacy px/s if > 100 (rescaled to the unified Knot).
 */
export function knotsSpeedToPxPerSec(knots: number): number {
  if (knots > 100) {
    // Legacy value was in px/s at the old 4.29 px/s per kt scale
    return knots * LEGACY_PX_SPEED_RESCALE;
  }
  return knots * CANVAS_PX_PER_KNOT_SPEED;
}

/**
 * Converts simulation pixels per second to Knots.
 */
export function pxPerSecToKnotsSpeed(pxPerSec: number): number {
  return pxPerSec / CANVAS_PX_PER_KNOT_SPEED;
}

/**
 * Canonical baseline speeds (in Knots) for default creatures.
 * Used for proportional scaling when movementSpeed is modified in the Balancing Panel.
 */
export const DEFAULT_CREATURE_BASELINE_SPEEDS: Record<string, number> = {
  thunder_leviarch: 20.0,
  dreadlot: 5.1,
  veilfangs: 24.0,
  aetherfin: 14.0,
};

/**
 * Gets the canonical baseline speed (in Knots) for a creature type.
 * Handles cloned threats (e.g. thunder_leviarch_clone_...) by matching prefix.
 */
export function getCreatureBaselineSpeedKnots(creatureId: string, fallbackSpeed?: number): number {
  if (DEFAULT_CREATURE_BASELINE_SPEEDS[creatureId]) {
    return DEFAULT_CREATURE_BASELINE_SPEEDS[creatureId];
  }
  for (const [key, val] of Object.entries(DEFAULT_CREATURE_BASELINE_SPEEDS)) {
    if (creatureId.startsWith(key)) {
      return val;
    }
  }
  return fallbackSpeed && fallbackSpeed > 0 ? normalizeSpeedToKnots(fallbackSpeed) : 10.0;
}

/**
 * Converts speed in Knots to Game Units per second (1 Knot = 4,500 UU/s).
 */
export function knotsToGameUnits(knots: number): number {
  return knots * KNOTS_TO_GAME_UNITS;
}

/**
 * Converts speed in Game Units to Knots.
 */
export function gameUnitsToKnots(gameUnits: number): number {
  return gameUnits / KNOTS_TO_GAME_UNITS;
}

/**
 * Converts Knots (Knots per minute) to meters per second (m/s).
 */
export function knotsSpeedToMps(knots: number): number {
  const normalizedKts = normalizeSpeedToKnots(knots);
  return normalizedKts * BASE_NAUTICAL_SPEED_MPS;
}

/**
 * Converts Knots (Knots per minute) to km/h.
 */
export function knotsSpeedToKmh(knots: number): number {
  const normalizedKts = normalizeSpeedToKnots(knots);
  return normalizedKts * BASE_NAUTICAL_SPEED_KMH;
}

/**
 * Converts Knots (Knots per minute) to Unreal Engine Units per second (UU/s = cm/s).
 */
export function knotsSpeedToUnrealUnitsPerSec(knots: number): number {
  const normalizedKts = normalizeSpeedToKnots(knots);
  return normalizedKts * BASE_NAUTICAL_SPEED_UUPS;
}

// ==========================================
// DISTANCE & SIZE CONVERSIONS
// ==========================================

/**
 * Converts simulation pixels to meters.
 */
export function pxToMeters(px: number): number {
  return px * CANVAS_METERS_PER_PX;
}

/**
 * Converts meters to simulation pixels.
 */
export function metersToPx(meters: number): number {
  return meters * CANVAS_PX_PER_METER;
}

/**
 * Converts simulation pixels to Knots of distance (1 Knot = 2,000m).
 */
export function pxToKnotsDistance(px: number, tileSizePx: number = CANVAS_TILE_SIZE_PX): number {
  return px / tileSizePx;
}

/**
 * Converts Knots of distance to simulation pixels.
 */
export function knotsDistanceToPx(knots: number, tileSizePx: number = CANVAS_TILE_SIZE_PX): number {
  return knots * tileSizePx;
}

/**
 * Converts simulation pixels to Unreal Units (UU = cm).
 */
export function pxToUnrealUnits(px: number): number {
  return pxToMeters(px) * UNREAL_UNITS_PER_METER;
}

/**
 * Converts Unreal Units (UU = cm) to simulation pixels.
 */
export function unrealUnitsToPx(uu: number): number {
  return metersToPx(uu / UNREAL_UNITS_PER_METER);
}

/**
 * Formats a speed string with Knots, m/s, and Unreal Units (UU/s).
 */
export function formatSpeedDisplay(knotsOrRaw: number): {
  knots: number;
  mps: number;
  kmh: number;
  uups: number;
  label: string;
} {
  const knots = normalizeSpeedToKnots(knotsOrRaw);
  const mps = Math.round(knotsSpeedToMps(knots));
  const kmh = Math.round(knotsSpeedToKmh(knots));
  const uups = Math.round(knotsSpeedToUnrealUnitsPerSec(knots));
  return {
    knots,
    mps,
    kmh,
    uups,
    label: `${knots} kts (${mps} m/s | ${uups.toLocaleString()} UU/s)`,
  };
}

/**
 * Formats a distance or radius with meters, Knots, and Unreal Units.
 */
export function formatDistanceDisplay(px: number): {
  meters: number;
  knots: number;
  uu: number;
  label: string;
} {
  const meters = Math.round(pxToMeters(px));
  const knots = Number(pxToKnotsDistance(px).toFixed(2));
  const uu = Math.round(pxToUnrealUnits(px));
  return {
    meters,
    knots,
    uu,
    label: `${meters}m (${knots} kts | ${uu.toLocaleString()} UU)`,
  };
}

/**
 * Creature acceleration / deceleration stat -> canvas px/s^2. The stat is in 0.1 kt/s units
 * (same convention as the Unreal export: value x 82.5 UU/s^2), e.g. 42 = 4.2 kt/s = 3,465 UU/s^2.
 */
export function creatureAccelToPxPerSec2(value: number): number {
  return value * (KNOTS_TO_GAME_UNITS / 10) * CANVAS_PX_PER_GAME_UNIT;
}
