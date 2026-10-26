/**
 * Canonical in-game measurements & Unreal Engine conversion standards.
 *
 * DEFINED SIZES & GRIDS:
 * - World Tile: The base length unit is 1 Knot, which equals approximately 1 side of a small world tile (2 kilometers per side = 2,000 meters).
 * - Behemoth: approximately 750 meters in length (0.375 Knots = 3/8 of a World Tile).
 * - Behemoth Beam (width): approximately 260 meters (0.13 Knots).
 *
 * DEFINED BASE NAUTICAL SPEED:
 * - Base Nautical Speed is defined as 1 Knot per minute.
 * - 1 Knot/min = 2,000 meters / 60 seconds = 33.3333 m/s = 120 km/h.
 *
 * UNREAL ENGINE STANDARDS:
 * - 1 Unreal Unit (UU) = 1 centimeter (0.01 m).
 * - 1 Meter = 100 UU.
 * - 1 World Tile (1 Knot) = 200,000 UU.
 * - Behemoth Length = 75,000 UU.
 * - Behemoth Beam = 26,000 UU.
 * - Base Nautical Speed (1 Knot/min) = 3,333.33 UU/s.
 *
 * SIMULATION CANVAS STANDARDS (1000 x 700 px):
 * - Behemoth Hull Length: 260 px (0.375 of a World Tile).
 * - World Tile Side (1 Knot): 260 / 0.375 = 693.333 px.
 * - Scale: 1 px = 2.8846 meters = 288.46 UU.
 * - 1 Meter = 0.3467 px.
 * - 1 Knot of Speed (1 Knot/min) on canvas: 693.333 / 60 = 11.5556 px/s.
 */

// ==========================================
// CANONICAL CONSTANTS
// ==========================================
export const METERS_PER_KNOT = 2000; // 2,000 meters = 2 km (1 side of a small world tile)
export const METERS_PER_TILE = 2000;
export const KM_PER_TILE = 2.0;

export const BEHEMOTH_LENGTH_METERS = 750; // approximately 750 meters
export const BEHEMOTH_BEAM_METERS = 260; // approximately 260 meters beam
export const BEHEMOTH_LENGTH_KNOTS = BEHEMOTH_LENGTH_METERS / METERS_PER_KNOT; // 0.375 Knots
export const BEHEMOTH_BEAM_KNOTS = BEHEMOTH_BEAM_METERS / METERS_PER_KNOT; // 0.13 Knots

// Unreal Engine 5 Units (1 UU = 1 cm)
export const UNREAL_UNITS_PER_METER = 100;
export const UNREAL_UNITS_PER_TILE = METERS_PER_TILE * UNREAL_UNITS_PER_METER; // 200,000 UU
export const BEHEMOTH_LENGTH_UNREAL = BEHEMOTH_LENGTH_METERS * UNREAL_UNITS_PER_METER; // 75,000 UU
export const BEHEMOTH_BEAM_UNREAL = BEHEMOTH_BEAM_METERS * UNREAL_UNITS_PER_METER; // 26,000 UU

/**
 * Game Unit multiplier: 1 Knot = 825 Game Units.
 */
export const KNOTS_TO_GAME_UNITS = 825;

/** Canonical Behemoth speed settings */
export const BEHEMOTH_SPEED_PRESETS = {
  STOP: 0,           // 0 kts = 0 Game Units
  QUARTER: 2,        // 1/4 speed: 2 kts = 1,650 Game Units
  HALF: 5,           // 1/2 speed: 5 kts = 4,125 Game Units
  THREE_QUARTERS: 8, // 3/4 speed: 8 kts = 6,600 Game Units
  REGULAR: 10,       // Regular speed: 10 kts = 8,250 Game Units
  OVERDRIVE: 15,     // Overdrive: 15 kts = 12,375 Game Units
} as const;

// Base Nautical Speed (1 Knot per minute)
export const BASE_NAUTICAL_SPEED_KNOTS_PER_MIN = 1.0;
export const BASE_NAUTICAL_SPEED_MPS = METERS_PER_KNOT / 60; // 33.3333 m/s
export const BASE_NAUTICAL_SPEED_KMH = KM_PER_TILE * 60; // 120 km/h
export const BASE_NAUTICAL_SPEED_UUPS = UNREAL_UNITS_PER_TILE / 60; // 3,333.33 UU/s

// Simulation Canvas Representation
export const CANVAS_BEHEMOTH_WIDTH_PX = 260;
export const CANVAS_BEHEMOTH_HEIGHT_PX = 90;
export const CANVAS_TILE_SIZE_PX = CANVAS_BEHEMOTH_WIDTH_PX / BEHEMOTH_LENGTH_KNOTS; // 693.3333 px
export const CANVAS_METERS_PER_PX = BEHEMOTH_LENGTH_METERS / CANVAS_BEHEMOTH_WIDTH_PX; // 2.884615 m/px
export const CANVAS_PX_PER_METER = CANVAS_BEHEMOTH_WIDTH_PX / BEHEMOTH_LENGTH_METERS; // 0.346667 px/m

// Simulation scale: 75,000 Game Units (Behemoth length) = 260 Canvas Pixels
export const CANVAS_PX_PER_GAME_UNIT = CANVAS_BEHEMOTH_WIDTH_PX / BEHEMOTH_LENGTH_UNREAL; // 260 / 75000 = 0.003466667 px/GU
// Pixels/second per Knot (825 Game Units * px_per_GU = 2.86 px/s per Knot)
export const CANVAS_PX_PER_KNOT_SPEED = KNOTS_TO_GAME_UNITS * CANVAS_PX_PER_GAME_UNIT; // 2.86 px/s per Knot

// ==========================================
// SPEED CONVERSIONS
// ==========================================

/**
 * Normalizes a raw speed value:
 * If value > 50, it is a legacy px/s value (e.g. 90, 105, 150, 405), which is converted to canonical Knots (kts).
 * Otherwise it is already in canonical Knots.
 */
export function normalizeSpeedToKnots(speedVal: number): number {
  if (!speedVal || speedVal <= 0) return 1.0;
  if (speedVal > 50) {
    // Legacy px/s -> Knots
    return Number((speedVal / CANVAS_PX_PER_KNOT_SPEED).toFixed(1));
  }
  return Number(speedVal.toFixed(1));
}

/**
 * Converts speed in Knots to simulation pixels per second using KnotsToGameUnits (825).
 * Automatically accepts legacy px/s if > 50.
 */
export function knotsSpeedToPxPerSec(knots: number): number {
  if (knots > 50) {
    // Legacy value was already in px/s
    return knots;
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
 * Converts speed in Knots to Game Units (1 Knot = 825 Game Units).
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
