import React, { useRef, useState } from 'react';
import { WeaponDef, CreatureDef, HateMatrix, CombatConfig, DeckLoadoutPreset } from '../types/combat';
import { CreatureBehaviorTree } from '../types/behavior';
import { runHeadless, summarizeRuns, HeadlessRunResult, HeadlessSummary } from '../engine/headless';

interface HeadlessRunsPanelProps {
  weapons: WeaponDef[];
  creatures: CreatureDef[];
  deckPresets: DeckLoadoutPreset[];
  hateMatrix?: HateMatrix;
  combatConfig?: CombatConfig;
  getBehaviorTrees?: () => Record<string, CreatureBehaviorTree>;
  compact?: boolean;
}

type Mode = 'fight_to_death' | 'normal_aggression';
interface Job { creatureId: string; loadout: DeckLoadoutPreset; seed: number; }

const fmt = (v: number | null) => (v === null ? '—' : `${Math.round(v)}s`);

/**
 * Headless runs: seeded engagements (stationary Behemoth, a deck loadout preset vs one creature), run in the
 * browser in small chunks so the UI stays responsive. Results summarize kills, escapes, kill time and damage taken.
 */
export const HeadlessRunsPanel: React.FC<HeadlessRunsPanelProps> = ({ weapons, creatures, deckPresets, hateMatrix, combatConfig, getBehaviorTrees, compact }) => {
  const [mode, setMode] = useState<Mode>('fight_to_death');
  const [seeds, setSeeds] = useState(6);
  const [creatureFilter, setCreatureFilter] = useState<string>('all');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [summaries, setSummaries] = useState<HeadlessSummary[]>([]);
  const [rawRuns, setRawRuns] = useState<Array<HeadlessRunResult & { loadout: string; mode: Mode }>>([]);
  const [ranAt, setRanAt] = useState<string | null>(null);
  const cancelRef = useRef(false);

  const standard = deckPresets.find((p) => p.id === 'standard');
  const loadoutsFor = (cid: string) => {
    const own = deckPresets.filter((p) => p.target === cid);
    return [...(standard ? [standard] : []), ...own];
  };

  const run = () => {
    const targets = creatures.filter((c) => creatureFilter === 'all' || c.id === creatureFilter);
    const jobs: Job[] = [];
    for (const c of targets) for (const lo of loadoutsFor(c.id)) for (let s = 1; s <= seeds; s++) jobs.push({ creatureId: c.id, loadout: lo, seed: s });
    if (!jobs.length) return;
    const setup = { weapons, creatures, behaviorTrees: getBehaviorTrees?.(), hateMatrix, combatConfig };
    const results: Array<HeadlessRunResult & { loadout: string; mode: Mode }> = [];
    cancelRef.current = false;
    setProgress({ done: 0, total: jobs.length });
    let i = 0;
    const step = () => {
      if (cancelRef.current) { setProgress(null); return; }
      const t0 = performance.now();
      while (i < jobs.length && performance.now() - t0 < 40) {
        const j = jobs[i++];
        const r = runHeadless(setup, { creatureId: j.creatureId, slots: j.loadout.slots, seed: j.seed, maxSeconds: 240, fightToDeath: mode === 'fight_to_death' });
        results.push({ ...r, loadout: j.loadout.codeName, mode });
      }
      setProgress({ done: i, total: jobs.length });
      if (i < jobs.length) { setTimeout(step, 0); return; }
      // Summaries per creature x loadout
      const out: HeadlessSummary[] = [];
      for (const c of targets) for (const lo of loadoutsFor(c.id)) {
        const rs = results.filter((r) => r.creatureId === c.id && r.loadout === lo.codeName);
        out.push(summarizeRuns(c.id, lo.id, lo.codeName, rs));
      }
      setSummaries(out);
      setRawRuns(results);
      setRanAt(new Date().toLocaleTimeString());
      setProgress(null);
    };
    setTimeout(step, 0);
  };

  const exportCsv = () => {
    const cols = ['mode', 'creatureId', 'loadout', 'seed', 'outcome', 'seconds', 'firstHitSeconds', 'creatureHpLeftPct', 'hullDamage', 'buildingDamage', 'buildingsDestroyed', 'crewLost', 'crewSnatched', 'peakTiltDeg', 'peakPowerDraw', 'gridTrips', 'ammoUsed'] as const;
    const lines = [cols.join(','), ...rawRuns.map((r) => cols.map((k) => String((r as any)[k] ?? '')).join(','))];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `combatsim-headless-${mode}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const name = (id: string) => creatures.find((c) => c.id === id)?.name ?? id;
  const grouped = creatures.map((c) => ({ c, rows: summaries.filter((s) => s.creatureId === c.id) })).filter((g) => g.rows.length);
  const tc = compact ? 'text-[10px]' : 'text-[11px]';

  return (
    <div className="flex flex-col gap-2 font-mono">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="text-slate-300 font-bold">HEADLESS RUNS</span>
        <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-slate-200" title="Fight to death: aggression locked (pure kill time). Normal: live retreat rules, escapes counted.">
          <option value="fight_to_death">Fight to death</option>
          <option value="normal_aggression">Normal aggression</option>
        </select>
        <select value={creatureFilter} onChange={(e) => setCreatureFilter(e.target.value)} className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-slate-200">
          <option value="all">All creatures</option>
          {creatures.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label className="flex items-center gap-1 text-slate-400">
          seeds
          <input type="number" min={1} max={20} value={seeds} onChange={(e) => setSeeds(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} className="w-12 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-slate-200" />
        </label>
        {progress ? (
          <>
            <span className="text-amber-300">{progress.done}/{progress.total}</span>
            <button type="button" onClick={() => { cancelRef.current = true; }} className="px-2 py-0.5 rounded border border-rose-800 text-rose-300 hover:bg-rose-950">Stop</button>
          </>
        ) : (
          <button type="button" onClick={run} className="px-2 py-0.5 rounded border border-cyan-700 bg-cyan-950/60 text-cyan-200 hover:bg-cyan-900/60">Run</button>
        )}
        {rawRuns.length > 0 && !progress && (
          <button type="button" onClick={exportCsv} className="px-2 py-0.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800">CSV</button>
        )}
      </div>
      <div className="text-[10px] text-slate-500">
        Stationary, unsinkable Behemoth with each creature's loadout presets (+ STANDARD), seeds 1–{seeds}, 240 s cap. Current tuning, behavior trees and Hate Matrix.
        {ranAt ? ` Last run ${ranAt}.` : ' Press Run (about 0.25 s per run).'}
      </div>
      {grouped.length > 0 && (
        <div className="overflow-x-auto">
          <table className={`${tc} border-collapse w-full`}>
            <thead>
              <tr className="text-slate-500 text-left">
                <th className="p-1">loadout</th>
                <th className="p-1" title="kills / escapes / timeouts">K/E/T</th>
                <th className="p-1">TTK mean</th>
                <th className="p-1">min–max</th>
                <th className="p-1">hull dmg</th>
                <th className="p-1">bldg lost</th>
                <th className="p-1">crew lost</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map(({ c, rows }) => {
                const best = Math.min(...rows.map((r) => (r.ttkMean ?? Infinity) + (r.runs - r.kills) * 1000));
                return (
                  <React.Fragment key={c.id}>
                    <tr><td colSpan={7} className="pt-2 pb-0.5 text-slate-200 font-bold">{name(c.id)}</td></tr>
                    {rows.map((r) => {
                      const score = (r.ttkMean ?? Infinity) + (r.runs - r.kills) * 1000;
                      return (
                        <tr key={r.loadoutId} className={`border-t border-slate-800/70 ${score === best && r.kills > 0 ? 'text-emerald-300' : 'text-slate-300'}`}>
                          <td className="p-1 whitespace-nowrap">{r.loadoutName}</td>
                          <td className="p-1 whitespace-nowrap">{r.kills}/{r.escapes}/{r.timeouts}</td>
                          <td className="p-1">{fmt(r.ttkMean)}</td>
                          <td className="p-1 whitespace-nowrap text-slate-500">{r.ttkMin === null ? '—' : `${Math.round(r.ttkMin)}–${Math.round(r.ttkMax ?? 0)}s`}</td>
                          <td className="p-1">{r.hullDamageMean.toLocaleString()}</td>
                          <td className="p-1">{r.buildingsDestroyedMean}</td>
                          <td className="p-1">{r.crewLostMean}</td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          <div className="text-[10px] text-slate-500 mt-1">Green = best loadout for that creature (most kills, then fastest). Escape presets are tested standing still, so their manoeuvre is not part of the result.</div>
        </div>
      )}
    </div>
  );
};
