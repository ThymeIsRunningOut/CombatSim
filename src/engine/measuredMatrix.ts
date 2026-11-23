import { WeaponDef, CreatureDef, HateMatrix, CombatConfig } from '../types/combat';
import { CreatureBehaviorTree } from '../types/behavior';
import { runHeadless } from './headless';

/**
 * Measured TTK matrix: each cell is the real simulation run headless (stationary Behemoth) with a
 * single-weapon deck - that weapon on the bow and stern mounts of each side plus the port aft mount
 * (the ALL GATLINGS / GRENADES / PHOTONS presets) - against one creature, over several seeds.
 * TTK is measured from the first hit to the kill.
 */
export const MEASURED_MOUNTS = ['port_0', 'port_3', 'starboard_0', 'starboard_3', 'aft_0'];
export const MEASURED_SEEDS = 4;
export const MEASURED_MAX_SECONDS = 600;

export interface MeasuredCell {
  weaponId: string;
  creatureId: string;
  runs: number;
  kills: number;
  ttkMean: number | null;   // s, first hit -> kill, over killed runs
  ttkMin: number | null;
  ttkMax: number | null;
}

export interface MeasuredMatrix {
  fingerprint: string;
  ranAt: string;
  cells: Record<string, MeasuredCell>; // key: `${weaponId}|${creatureId}`
  /** Formula (behaviour-adjusted) TTK per cell at run time: calibration = measured / formula. */
  formulaAtRun?: Record<string, number>;
  /** Codename of the deck used per weapon (ALL GATLINGS ...), or 'default mounts'. */
  decks?: Record<string, string>;
}

/** Deck for a weapon: the ALL-<weapon> preset when one exists (all filled mounts carry that weapon), else the default mounts. */
export function deckForWeapon(weaponId: string, presets: Array<{ id: string; codeName: string; slots: Record<string, string | null> }> = []) {
  const p = presets.find((x) => x.id.startsWith('all_') && Object.values(x.slots).some((v) => v) && Object.values(x.slots).every((v) => !v || v === weaponId));
  return p ? { slots: p.slots, name: p.codeName } : { slots: singleWeaponSlots(weaponId), name: 'default mounts' };
}

export const cellKey = (weaponId: string, creatureId: string) => `${weaponId}|${creatureId}`;

export function singleWeaponSlots(weaponId: string): Record<string, string | null> {
  const slots: Record<string, string | null> = {};
  for (const id of ['port_0', 'port_1', 'port_2', 'port_3', 'starboard_0', 'starboard_1', 'starboard_2', 'starboard_3', 'aft_0', 'aft_1']) {
    slots[id] = MEASURED_MOUNTS.includes(id) ? weaponId : null;
  }
  return slots;
}

/** Fingerprint of every input that changes the outcome (results go stale when it changes). */
export function measuredFingerprint(input: unknown): string {
  const text = JSON.stringify(input);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

export interface MeasuredSetup {
  weapons: WeaponDef[];
  creatures: CreatureDef[];
  behaviorTrees?: Record<string, CreatureBehaviorTree>;
  hateMatrix?: HateMatrix;
  combatConfig?: CombatConfig;
}

/** Runs the measured matrix in small time slices so the UI stays responsive. Returns a cancel function. */
export function runMeasuredMatrix(
  setup: MeasuredSetup,
  fingerprint: string,
  onProgress: (done: number, total: number) => void,
  onDone: (m: MeasuredMatrix) => void,
  presets: Array<{ id: string; codeName: string; slots: Record<string, string | null> }> = []
): () => void {
  const decks = Object.fromEntries(setup.weapons.map((w) => [w.id, deckForWeapon(w.id, presets)]));
  const jobs: Array<{ w: string; c: string; seed: number }> = [];
  for (const w of setup.weapons) for (const c of setup.creatures) for (let s = 1; s <= MEASURED_SEEDS; s++) jobs.push({ w: w.id, c: c.id, seed: s });
  const acc: Record<string, { ttk: number[]; runs: number }> = {};
  let i = 0;
  let cancelled = false;
  const step = () => {
    if (cancelled) return;
    const t0 = performance.now();
    while (i < jobs.length && performance.now() - t0 < 40) {
      const j = jobs[i++];
      const r = runHeadless(setup, { creatureId: j.c, slots: decks[j.w].slots, seed: j.seed, maxSeconds: MEASURED_MAX_SECONDS, fightToDeath: true });
      const k = cellKey(j.w, j.c);
      const a = (acc[k] ||= { ttk: [], runs: 0 });
      a.runs++;
      if (r.outcome === 'killed') a.ttk.push(r.seconds - (r.firstHitSeconds ?? 0));
    }
    onProgress(i, jobs.length);
    if (i < jobs.length) { setTimeout(step, 0); return; }
    const cells: Record<string, MeasuredCell> = {};
    for (const [k, a] of Object.entries(acc)) {
      const [weaponId, creatureId] = k.split('|');
      const mean = a.ttk.length ? a.ttk.reduce((x, y) => x + y, 0) / a.ttk.length : null;
      cells[k] = {
        weaponId, creatureId, runs: a.runs, kills: a.ttk.length,
        ttkMean: mean === null ? null : Number(mean.toFixed(1)),
        ttkMin: a.ttk.length ? Number(Math.min(...a.ttk).toFixed(1)) : null,
        ttkMax: a.ttk.length ? Number(Math.max(...a.ttk).toFixed(1)) : null,
      };
    }
    onDone({ fingerprint, ranAt: new Date().toLocaleString(), cells, decks: Object.fromEntries(Object.entries(decks).map(([k, d]) => [k, d.name])) });
  };
  setTimeout(step, 0);
  return () => { cancelled = true; };
}
