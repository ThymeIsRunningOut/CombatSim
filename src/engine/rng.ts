/**
 * Seeded deterministic RNG (mulberry32) for the simulation engine.
 *
 * Every random roll in src/engine/* goes through `random()` so that a run with the same
 * seed, presets and inputs reproduces exactly (needed for repeatable TTK / balancing runs).
 * The engine reseeds on reset(). UI-only randomness may keep using Math.random.
 */

export const DEFAULT_SIM_SEED = 1337;

let state = DEFAULT_SIM_SEED >>> 0;
let currentSeed = DEFAULT_SIM_SEED;

/** Reseeds the generator. Same seed => same sequence. */
export function setSeed(seed: number): void {
  currentSeed = Math.floor(seed) >>> 0;
  state = currentSeed;
}

export function getSeed(): number {
  return currentSeed;
}

/** Uniform float in [0, 1), drop-in replacement for Math.random(). */
export function random(): number {
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Uniform float in [min, max). */
export function randomRange(min: number, max: number): number {
  return min + (max - min) * random();
}

/** Uniform integer in [0, n). */
export function randomInt(n: number): number {
  return Math.floor(random() * n);
}
