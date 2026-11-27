/**
 * Headless seeded runs: one Behemoth (stationary, given deck loadout) vs one creature, simulated without
 * rendering. Used by the in-app "Headless runs" table and by offline scripts (same engine, same results).
 */
import { SimulationEngine } from './simulation';
import { knotsSpeedToPxPerSec } from './measurements';
import { WeaponDef, CreatureDef, HateMatrix, CombatConfig } from '../types/combat';
import { CreatureBehaviorTree } from '../types/behavior';

export interface HeadlessSetup {
  weapons: WeaponDef[];
  creatures: CreatureDef[];
  behaviorTrees?: Record<string, CreatureBehaviorTree>;
  hateMatrix?: HateMatrix;
  combatConfig?: CombatConfig;
}

export interface HeadlessRunOptions {
  creatureId: string;
  slots: Record<string, string | null>; // deck loadout (slot id -> weapon id)
  seed: number;
  maxSeconds?: number;      // default 240
  fightToDeath?: boolean;   // lock aggression so the creature never retreats (pure kill time). Default true
  /** Simple stand-in for the player's navigation: the Behemoth holds `speedKts` and turns at `turnDegPerSec`
   *  (+ = clockwise), sailing a wide circle, so creatures don't keep hitting the same spot and every mount gets to
   *  face them. Both 0 / undefined = stationary. */
  turnDegPerSec?: number;
  speedKts?: number;
}

export type HeadlessOutcome = 'killed' | 'escaped' | 'timeout';

export interface HeadlessRunResult {
  creatureId: string;
  seed: number;
  outcome: HeadlessOutcome;
  seconds: number;           // time of kill / escape / cap
  firstHitSeconds: number | null;
  creatureHpLeftPct: number; // 0 when killed
  hullDamage: number;
  buildingDamage: number;    // total damage to the Behemoth minus hull damage
  buildingsDestroyed: number;
  crewLost: number;
  crewSnatched: number;
  ramsTaken: number;
  peakTiltDeg: number;
  peakPowerDraw: number;
  gridTrips: number;
  ammoUsed: number;
}

const DT = 1 / 60;

/** Runs one seeded headless engagement. Deterministic for identical inputs. */
export function runHeadless(setup: HeadlessSetup, opts: HeadlessRunOptions): HeadlessRunResult {
  const maxSeconds = opts.maxSeconds ?? 240;
  const fightToDeath = opts.fightToDeath ?? true;
  const creatures = setup.creatures.map((c) => (c.id === opts.creatureId && fightToDeath ? { ...c, aggressionLocked: true } : c));
  const e = new SimulationEngine(setup.weapons, creatures);
  if (setup.behaviorTrees) for (const [k, t] of Object.entries(setup.behaviorTrees)) e.behaviorTrees.set(k, t);
  if (setup.hateMatrix) e.setHateMatrix(setup.hateMatrix);
  if (setup.combatConfig) e.setCombatConfig(setup.combatConfig);
  e.setSimulationSeed(opts.seed); // reseeds and resets
  e.applyDeckLoadout(opts.slots, setup.weapons);
  const hull0 = e.behemoth.maxHullHp = 1e9;
  e.behemoth.hullHp = hull0; // never sink: measure damage over the whole engagement
  e.spawnCreature(opts.creatureId, true);
  const target = e.creatures[0];
  const maxHp = target ? target.maxHp + target.maxPhysicalArmor : 1;

  let firstHit: number | null = null;
  let peakTilt = 0;
  let trips = 0;
  let wasTripped = false;
  let outcome: HeadlessOutcome = 'timeout';
  let escapedFlag = false;
  const origLog = e.addLog.bind(e);
  e.addLog = (text, type) => {
    if (text.startsWith('[ESCAPED]')) escapedFlag = true;
    return origLog(text, type);
  };

  const steps = Math.round(maxSeconds / DT);
  let i = 0;
  const turn = opts.turnDegPerSec ?? 0;
  const sailKts = opts.speedKts ?? 0;
  const sailPx = knotsSpeedToPxPerSec(sailKts) * DT;
  for (; i < steps; i++) {
    if (turn !== 0 || sailKts > 0) {
      // No waypoints: the engine's own navigation idles, so the course is applied here
      e.behemoth.heading = (e.behemoth.heading + turn * DT + 360) % 360;
      e.vesselCenter.heading = e.behemoth.heading;
      e.behemoth.speed = sailKts;
      e.vesselCenter.speed = sailKts;
      const h = (e.behemoth.heading * Math.PI) / 180;
      e.vesselCenter.x += Math.cos(h) * sailPx;
      e.vesselCenter.y += Math.sin(h) * sailPx;
    }
    e.tick(DT);
    const c = e.creatures[0];
    if (firstHit === null && c && (c.hp + c.physicalArmor) < maxHp) firstHit = e.timeElapsed;
    peakTilt = Math.max(peakTilt, Math.abs(e.behemoth.tiltAngle));
    if (e.behemoth.accumulatorOverloaded && !wasTripped) trips++;
    wasTripped = e.behemoth.accumulatorOverloaded;
    if (e.creatures.length === 0) {
      outcome = escapedFlag ? 'escaped' : 'killed';
      break;
    }
  }
  const left = e.creatures[0];
  const hullDamage = hull0 - e.behemoth.hullHp;
  const ammo = Object.values(e.stats.totalAmmoConsumed).reduce((a, b) => a + b, 0);
  return {
    creatureId: opts.creatureId,
    seed: opts.seed,
    outcome,
    seconds: Number(e.timeElapsed.toFixed(1)),
    firstHitSeconds: firstHit === null ? null : Number(firstHit.toFixed(1)),
    creatureHpLeftPct: outcome === 'killed' ? 0 : left ? Math.round(((left.hp + left.physicalArmor) / maxHp) * 100) : 0,
    hullDamage: Math.round(hullDamage),
    buildingDamage: Math.round(Math.max(0, e.stats.totalDamageTakenByBehemoth - hullDamage)),
    buildingsDestroyed: e.stats.buildingsDestroyed ?? 0,
    crewLost: e.stats.crewLost ?? 0,
    crewSnatched: e.stats.crewSnatched ?? 0,
    ramsTaken: e.stats.rammingEventsCount,
    peakTiltDeg: Number(peakTilt.toFixed(1)),
    peakPowerDraw: Math.round(e.stats.peakPowerDraw),
    gridTrips: trips,
    ammoUsed: ammo,
  };
}

export interface HeadlessSummary {
  creatureId: string;
  loadoutId: string;
  loadoutName: string;
  runs: number;
  kills: number;
  escapes: number;
  timeouts: number;
  ttkMean: number | null;    // over kills only
  ttkMin: number | null;
  ttkMax: number | null;
  hullDamageMean: number;
  buildingsDestroyedMean: number;
  crewLostMean: number;
  ramsMean: number;
  peakTiltMax: number;
}

export function summarizeRuns(creatureId: string, loadoutId: string, loadoutName: string, runs: HeadlessRunResult[]): HeadlessSummary {
  const kills = runs.filter((r) => r.outcome === 'killed');
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const t = kills.map((r) => r.seconds);
  return {
    creatureId, loadoutId, loadoutName,
    runs: runs.length,
    kills: kills.length,
    escapes: runs.filter((r) => r.outcome === 'escaped').length,
    timeouts: runs.filter((r) => r.outcome === 'timeout').length,
    ttkMean: t.length ? Number(mean(t).toFixed(1)) : null,
    ttkMin: t.length ? Math.min(...t) : null,
    ttkMax: t.length ? Math.max(...t) : null,
    hullDamageMean: Math.round(mean(runs.map((r) => r.hullDamage))),
    buildingsDestroyedMean: Number(mean(runs.map((r) => r.buildingsDestroyed)).toFixed(1)),
    crewLostMean: Number(mean(runs.map((r) => r.crewLost)).toFixed(1)),
    ramsMean: Number(mean(runs.map((r) => r.ramsTaken)).toFixed(1)),
    peakTiltMax: Math.max(0, ...runs.map((r) => r.peakTiltDeg)),
  };
}
