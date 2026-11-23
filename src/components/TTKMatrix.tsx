import React, { useEffect, useRef, useState } from 'react';
import { coneHalfAngleDeg } from '../engine/weapons';
import { CombatConfig, WeaponDef, CreatureDef, TTKResult, TTKThresholds, HateMatrix, DeckLoadoutPreset } from '../types/combat';
import { CreatureBehaviorTree } from '../types/behavior';
import { MeasuredMatrix, runMeasuredMatrix, measuredFingerprint, cellKey, MEASURED_SEEDS, MEASURED_MAX_SECONDS } from '../engine/measuredMatrix';
import { generateTTKMatrix, DEFAULT_TTK_THRESHOLDS, RATIO_BANDS } from '../engine/analytics';
import { Shield, Zap, Flame, Clock, Target, AlertCircle, CheckCircle2, XCircle, Sliders, RotateCcw } from 'lucide-react';

interface TTKMatrixProps {
  weapons: WeaponDef[];
  creatures: CreatureDef[];
  onSelectWeapon?: (weapon: WeaponDef) => void;
  onSelectCreature?: (creature: CreatureDef) => void;
  isCompact?: boolean;
  /** Rendered under the matrix (e.g. headless run statistics). */
  footer?: React.ReactNode;
  combatConfig?: CombatConfig;
  hateMatrix?: HateMatrix;
  getBehaviorTrees?: () => Record<string, CreatureBehaviorTree>;
  deckPresets?: DeckLoadoutPreset[];
}

const MEASURED_STORAGE_KEY = 'combatsim_measured_ttk_v1';
const MEASURED_MOUNTS_LABEL = '5 mounts of one weapon (bow + stern on each side, port aft)';

// v2: defaults moved to 120 s / 240 s (Nov 2026); old saved 60/120 values are ignored
const STORAGE_KEY_EFF = 'combatsim_ttk_efficient_threshold_v2';
const STORAGE_KEY_INEFF = 'combatsim_ttk_inefficient_threshold_v2';

export const TTKMatrix: React.FC<TTKMatrixProps> = ({
  weapons,
  creatures,
  onSelectWeapon,
  onSelectCreature,
  isCompact = false,
  footer,
  combatConfig,
  hateMatrix,
  getBehaviorTrees,
  deckPresets = [],
}) => {
  const [matrixMode, setMatrixMode] = useState<'simulated' | 'theoretical' | 'measured'>('simulated');

  // ---- Measured (headless) matrix: ground truth from the real simulation ----
  const trees = getBehaviorTrees?.();
  const allDecks = deckPresets.filter((p) => p.id.startsWith('all_'));
  const fingerprint = measuredFingerprint([weapons, creatures, trees, combatConfig, hateMatrix, allDecks]);
  const [bandMode, setBandMode] = useState<'ratio' | 'fixed'>(() => { try { return (localStorage.getItem('combatsim_ttk_band_mode') as 'ratio' | 'fixed') || 'ratio'; } catch { return 'ratio'; } });
  const setBand = (m: 'ratio' | 'fixed') => { setBandMode(m); try { localStorage.setItem('combatsim_ttk_band_mode', m); } catch {} };
  const [calibrate, setCalibrate] = useState<boolean>(() => { try { return localStorage.getItem('combatsim_ttk_calibrate') !== '0'; } catch { return true; } });
  const [measured, setMeasured] = useState<MeasuredMatrix | null>(() => {
    try { const raw = localStorage.getItem(MEASURED_STORAGE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
  });
  const [measureProgress, setMeasureProgress] = useState<{ done: number; total: number } | null>(null);
  const cancelMeasureRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cancelMeasureRef.current?.(), []);
  const measuredFresh = !!measured && measured.fingerprint === fingerprint;
  const startMeasure = () => {
    cancelMeasureRef.current?.();
    // Formula values at run time: the calibration factor for each cell is measured / formula
    const formulaAtRun: Record<string, number> = {};
    generateTTKMatrix(weapons, creatures, 'simulated', thresholds, combatConfig).forEach((row) =>
      row.forEach((r) => { formulaAtRun[cellKey(r.weaponId, r.creatureId)] = r.timeToKillSeconds; }));
    setMeasureProgress({ done: 0, total: weapons.length * creatures.length * MEASURED_SEEDS });
    cancelMeasureRef.current = runMeasuredMatrix(
      { weapons, creatures, behaviorTrees: trees, hateMatrix, combatConfig },
      fingerprint,
      (done, total) => setMeasureProgress({ done, total }),
      (m0) => {
        const m = { ...m0, formulaAtRun };
        setMeasured(m);
        setMeasureProgress(null);
        cancelMeasureRef.current = null;
        try { localStorage.setItem(MEASURED_STORAGE_KEY, JSON.stringify(m)); } catch {}
      },
      allDecks
    );
  };
  const cancelMeasure = () => { cancelMeasureRef.current?.(); cancelMeasureRef.current = null; setMeasureProgress(null); };
  const [selectedCell, setSelectedCell] = useState<TTKResult | null>(null);

  // Configurable designer threshold inputs for efficiency categorization
  // Defaults: <= 120s is Efficient (Green), 120-240s is Semi-Efficient (Yellow), > 240s is Inefficient (Red)
  const [efficientThreshold, setEfficientThreshold] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_EFF);
      if (saved !== null) {
        const val = Number(saved);
        if (!isNaN(val) && val > 0) return val;
      }
    } catch {}
    return DEFAULT_TTK_THRESHOLDS.efficient;
  });

  const [inefficientThreshold, setInefficientThreshold] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_INEFF);
      if (saved !== null) {
        const val = Number(saved);
        if (!isNaN(val) && val > 0) return val;
      }
    } catch {}
    return DEFAULT_TTK_THRESHOLDS.inefficient;
  });

  const handleUpdateEfficient = (val: number) => {
    const validEff = Math.max(1, val);
    setEfficientThreshold(validEff);
    try {
      localStorage.setItem(STORAGE_KEY_EFF, String(validEff));
    } catch {}
    if (validEff >= inefficientThreshold) {
      const newIneff = validEff + 1;
      setInefficientThreshold(newIneff);
      try {
        localStorage.setItem(STORAGE_KEY_INEFF, String(newIneff));
      } catch {}
    }
  };

  const handleUpdateInefficient = (val: number) => {
    const validIneff = Math.max(efficientThreshold + 1, val);
    setInefficientThreshold(validIneff);
    try {
      localStorage.setItem(STORAGE_KEY_INEFF, String(validIneff));
    } catch {}
  };

  const handleResetThresholds = () => {
    setEfficientThreshold(DEFAULT_TTK_THRESHOLDS.efficient);
    setInefficientThreshold(DEFAULT_TTK_THRESHOLDS.inefficient);
    try {
      localStorage.setItem(STORAGE_KEY_EFF, String(DEFAULT_TTK_THRESHOLDS.efficient));
      localStorage.setItem(STORAGE_KEY_INEFF, String(DEFAULT_TTK_THRESHOLDS.inefficient));
    } catch {}
  };

  const thresholds: TTKThresholds = {
    efficient: efficientThreshold,
    inefficient: inefficientThreshold,
  };

  const analytic = generateTTKMatrix(weapons, creatures, matrixMode === 'theoretical' ? 'theoretical' : 'simulated', thresholds, combatConfig);
  /** Measured result shaped like an analytic cell (TTK = mean first-hit-to-kill; any timed-out run = inefficient). */
  const measuredResult = (base: TTKResult): TTKResult | null => {
    const m = measured?.cells[cellKey(base.weaponId, base.creatureId)];
    if (!m) return null;
    return {
      ...base,
      timeToKillSeconds: m.ttkMean ?? MEASURED_MAX_SECONDS,
      status: m.kills === 0 ? 'IMMUNE' : m.kills < m.runs ? 'INEFFECTIVE' : 'EFFECTIVE',
      penetrationRatio: 1,
      shotsToKill: 0,
    };
  };
  /** Sim (estimate) calibrated to the measured runs: formula now x (measured / formula at run time). */
  const calibratedResult = (r: TTKResult): TTKResult => {
    const k = cellKey(r.weaponId, r.creatureId);
    const m = measured?.cells[k];
    const f0 = measured?.formulaAtRun?.[k];
    if (!m || !f0) return r;
    if (m.kills === 0) return { ...r, timeToKillSeconds: MEASURED_MAX_SECONDS, status: 'IMMUNE' };
    const t = Number((r.timeToKillSeconds * ((m.ttkMean ?? f0) / f0)).toFixed(1));
    return { ...r, timeToKillSeconds: t, penetrationRatio: Math.max(r.penetrationRatio, 0.15),
      status: m.kills < m.runs ? 'INEFFECTIVE' : r.status === 'IMMUNE' ? 'EFFECTIVE' : r.status, shotsToKill: m.kills < m.runs ? 0 : r.shotsToKill,
      ...(m.kills < m.runs ? { penetrationRatio: 1 } : {}) };
  };
  const isCalibrated = matrixMode === 'simulated' && calibrate && !!measured?.formulaAtRun;
  const matrix: TTKResult[][] = matrixMode === 'measured' && measured
    ? analytic.map((row) => row.map((r) => measuredResult(r) ?? r))
    : isCalibrated
    ? analytic.map((row) => row.map((r) => calibratedResult(r)))
    : analytic;
  const measuredCellInfo = (r: TTKResult) => measured?.cells[cellKey(r.weaponId, r.creatureId)];

  // Ratio bands: each creature column is judged against its fastest weapon (stable when decks / HP change)
  const isNoKill = (r: TTKResult) => r.status === 'IMMUNE' || r.shotsToKill >= 20000 ||
    (r.status === 'INEFFECTIVE' && r.penetrationRatio === 1 && r.shotsToKill === 0);
  const colBest: Record<string, number> = {};
  for (const row of matrix) for (const r of row) {
    if (isNoKill(r)) continue;
    colBest[r.creatureId] = Math.min(colBest[r.creatureId] ?? Infinity, r.timeToKillSeconds);
  }
  const getEfficiencyRating = (ttk: number, result: TTKResult): 'EFFICIENT' | 'SEMI_EFFICIENT' | 'INEFFICIENT' => {
    if (bandMode === 'ratio') {
      const best = colBest[result.creatureId];
      if (isNoKill(result) || !best) return 'INEFFICIENT';
      const ratio = ttk / best;
      return ratio <= RATIO_BANDS.efficient ? 'EFFICIENT' : ratio <= RATIO_BANDS.semi ? 'SEMI_EFFICIENT' : 'INEFFICIENT';
    }
    if (result.status === 'IMMUNE' || result.shotsToKill >= 20000 || ttk > inefficientThreshold ||
      (result.status === 'INEFFECTIVE' && result.penetrationRatio === 1 && result.shotsToKill === 0)) {
      return 'INEFFICIENT';
    }
    if (ttk <= efficientThreshold && result.penetrationRatio >= 0.15) {
      return 'EFFICIENT';
    }
    return 'SEMI_EFFICIENT';
  };

  const getCellStyling = (rating: 'EFFICIENT' | 'SEMI_EFFICIENT' | 'INEFFICIENT') => {
    switch (rating) {
      case 'EFFICIENT':
        return {
          bg: 'bg-emerald-950/40 border-emerald-600/60 hover:bg-emerald-900/50',
          text: 'text-emerald-300',
          glow: 'shadow-[0_0_15px_rgba(16,185,129,0.15)]',
          badge: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40',
          label: 'EFFICIENT',
          icon: <CheckCircle2 className="w-3 h-3 text-emerald-400" />,
        };
      case 'SEMI_EFFICIENT':
        return {
          bg: 'bg-yellow-950/40 border-yellow-600/60 hover:bg-yellow-900/50',
          text: 'text-yellow-300',
          glow: 'shadow-[0_0_15px_rgba(234,179,8,0.15)]',
          badge: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40',
          label: 'SEMI-EFFICIENT',
          icon: <AlertCircle className="w-3 h-3 text-yellow-400" />,
        };
      case 'INEFFICIENT':
        return {
          bg: 'bg-rose-950/40 border-rose-600/60 hover:bg-rose-900/50',
          text: 'text-rose-300',
          glow: 'shadow-[0_0_15px_rgba(244,63,94,0.15)]',
          badge: 'bg-rose-500/20 text-rose-400 border border-rose-500/40',
          label: 'INEFFICIENT',
          icon: <XCircle className="w-3 h-3 text-rose-400" />,
        };
    }
  };

  if (isCompact) {
    // Compact Side-Panel Layout
    return (
      <div className="h-full flex flex-col p-3 overflow-y-auto bg-[#070e1a] text-slate-100 font-mono select-none">
        {/* Header */}
        <div className="mb-2 flex items-center justify-between pb-2 border-b border-slate-800">
          <div>
            <div className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
              <span>LIVE TTK MATRIX</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                {matrixMode === 'simulated' ? 'SIMULATED' : 'BENCHMARK'}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {matrixMode === 'simulated' ? 'Behavior & Exposure Adjusted' : 'Theoretical Continuous Fire'}
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px]">
            <button
              type="button"
              onClick={() => setMatrixMode('simulated')}
              className={`px-1.5 py-0.5 rounded font-bold transition-all ${
                matrixMode === 'simulated'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Includes diving, orbit arcs, and swarm evasion"
            >
              Sim
            </button>
            <button
              type="button"
              onClick={() => setMatrixMode('theoretical')}
              className={`px-1.5 py-0.5 rounded font-bold transition-all ${
                matrixMode === 'theoretical'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Stationary pure DPS benchmark"
            >
              Pure
            </button>
          </div>
        </div>

        {/* Compact Threshold Configuration */}
        <div className="mb-2 p-1.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-1 text-[10px]">
          <div className="flex items-center gap-1">
            <Sliders className="w-3 h-3 text-cyan-400 flex-shrink-0" />
            <span className="text-emerald-400 font-bold">&le;</span>
            <input
              type="number"
              min="1"
              max="999"
              value={efficientThreshold}
              onChange={(e) => handleUpdateEfficient(Number(e.target.value))}
              className="w-12 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-center text-emerald-400 font-bold outline-none focus:border-cyan-400"
              title="Efficient cutoff in seconds (<= s is Green)"
            />
            <span className="text-slate-500">s</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-yellow-400 font-bold">&le;</span>
            <input
              type="number"
              min="2"
              max="999"
              value={inefficientThreshold}
              onChange={(e) => handleUpdateInefficient(Number(e.target.value))}
              className="w-12 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-center text-yellow-400 font-bold outline-none focus:border-cyan-400"
              title="Semi-Efficient cutoff in seconds (<= s is Yellow, > s is Red)"
            />
            <span className="text-slate-500">s</span>
          </div>
          <button
            type="button"
            onClick={handleResetThresholds}
            className="text-[10px] text-slate-400 hover:text-cyan-300 px-1.5 py-0.5 rounded bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition-colors flex items-center gap-1"
            title="Reset thresholds to default (120s / 240s)"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            <span>120/240</span>
          </button>
        </div>

        {/* Matrix Grid */}
        <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/90 shadow-xl">
          <table className="w-full text-left border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 text-[10px]">
                <th className="p-2 font-bold text-slate-200">WEAPON</th>
                {creatures.map((c) => (
                  <th
                    key={c.id}
                    onClick={() => onSelectCreature && onSelectCreature(c)}
                    className="p-2 text-center border-l border-slate-800 cursor-pointer hover:text-cyan-400"
                  >
                    <div className="flex items-center justify-center gap-1 font-bold text-slate-200">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.iconColor }} />
                      <span className="truncate max-w-[85px]">{c.quantity <= 1 && c.emoji ? `${c.emoji} ` : ''}{c.name}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-[11px]">
              {weapons.map((w, wIdx) => (
                <tr key={w.id} className="hover:bg-slate-900/40 transition-colors">
                  <td
                    onClick={() => onSelectWeapon && onSelectWeapon(w)}
                    className="p-2 font-semibold text-slate-200 cursor-pointer hover:text-cyan-400"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: w.color }} />
                      <span className="truncate max-w-[85px]">{w.name}</span>
                    </div>
                    <div className="text-[10px] text-slate-500">{w.damageType}</div>
                  </td>

                  {creatures.map((c, cIdx) => {
                    const res = matrix[wIdx][cIdx];
                    const rating = getEfficiencyRating(res.timeToKillSeconds, res);
                    const style = getCellStyling(rating);
                    const isSelected = selectedCell === res;

                    return (
                      <td
                        key={c.id}
                        onClick={() => setSelectedCell(res)}
                        className={`p-2 text-center border-l border-slate-800/80 cursor-pointer transition-all border ${
                          style.bg
                        } ${isSelected ? 'ring-1 ring-cyan-400' : ''}`}
                      >
                        <div className={`text-xs font-black ${style.text}`}>
                          {res.timeToKillSeconds}s
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {matrixMode === 'simulated' ? `theo: ${res.theoreticalTtkSeconds}s` : `${res.shotsToKill} hits`}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Selected Cell Inspector (Compact) */}
        {selectedCell && (
          <div className="mt-3 p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-[10px]">
            <div className="flex items-center justify-between text-cyan-400 font-bold mb-1">
              <span className="truncate">{selectedCell.weaponName} vs {selectedCell.creatureName}</span>
              {(() => {
                const rating = getEfficiencyRating(selectedCell.timeToKillSeconds, selectedCell);
                const s = getCellStyling(rating);
                return (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${s.badge}`}>
                    {s.label}
                  </span>
                );
              })()}
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center mt-1.5">
              <div className="p-1 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-500">
                  {matrixMode === 'simulated' ? 'SIM TTK' : 'PURE TTK'}
                </div>
                <div className="text-xs font-bold text-cyan-400">{selectedCell.timeToKillSeconds}s</div>
              </div>
              <div className="p-1 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-500">EXPOSURE</div>
                <div className="text-xs font-bold text-amber-400">
                  {Math.round((selectedCell.behaviorExposureRatio ?? 1) * 100)}%
                </div>
              </div>
              <div className="p-1 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-500">PEN.</div>
                <div className="text-xs font-bold text-emerald-400">{Math.round(selectedCell.penetrationRatio * 100)}%</div>
              </div>
            </div>
            {matrixMode === 'simulated' && selectedCell.behaviorExposureRatio && selectedCell.behaviorExposureRatio < 1 && (
              <div className="mt-2 text-[10px] text-slate-400 border-t border-slate-800/80 pt-1 flex justify-between">
                <span>Vuln Uptime: {Math.round((selectedCell.submersionUptimeRatio ?? 1) * 100)}%</span>
                <span>Arc: {Math.round((selectedCell.arcExposureRatio ?? 1) * 100)}%</span>
                <span>Track: {Math.round((selectedCell.trackingRatio ?? 1) * 100)}%</span>
                <span>Intercept: {Math.round((selectedCell.interceptRatio ?? 1) * 100)}%</span>
              </div>
            )}
          </div>
        )}
        {footer && <div className="mt-3 pt-3 border-t border-slate-800">{footer}</div>}
      </div>
    );
  }

  // Full-View TTK Matrix Layout
  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto bg-[#070e1a]">
      {/* Header & Efficiency Controls */}
      <div className="mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold font-mono text-slate-100 flex items-center gap-2">
              WEAPON EFFICIENCY & TTK MATRIX
              <span className="text-xs px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                BALANCING MAP
              </span>
            </h2>

            {/* Mode Switcher */}
            <div className="flex bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs font-mono">
              <button
                type="button"
                onClick={() => setMatrixMode('simulated')}
                className={`px-3 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                  matrixMode === 'simulated'
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Includes creature diving cycles, turret blind arcs, and evasive scatter"
              >
                <span>🤖 AI Behaviors & Exposure</span>
              </button>
              <button
                type="button"
                onClick={() => setMatrixMode('theoretical')}
                className={`px-3 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                  matrixMode === 'theoretical'
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Pure theoretical continuous fire benchmark"
              >
                <span>📐 Pure Benchmark</span>
              </button>
              <button
                type="button"
                onClick={() => setMatrixMode('measured')}
                className={`px-3 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                  matrixMode === 'measured'
                    ? 'bg-violet-500 text-slate-950 shadow-md shadow-violet-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Ground truth: the real simulation run headless with a single-weapon deck per cell"
              >
                <span>🧪 Measured</span>
                {measured && !measuredFresh && <span className="text-[10px] text-amber-300">stale</span>}
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-400 mt-1">
            {matrixMode === 'simulated'
              ? 'Estimate: one turret, average arc coverage and behaviour factors. Fast to update; check it against Measured.'
              : matrixMode === 'measured'
              ? `Measured in the real simulation: the ALL GATLINGS / ALL GRENADES / ALL PHOTONS decks vs one creature, ${MEASURED_SEEDS} seeds, stationary Behemoth, TTK from first hit to kill (max ${MEASURED_MAX_SECONDS} s).`
              : 'Stationary line-of-sight benchmark assuming uninterrupted firing uptime and zero line-of-sight obstruction.'}
            {' '}Efficiency ratings: <span className="text-emerald-400 font-bold">Green (Efficient)</span>, <span className="text-yellow-400 font-bold">Yellow (Semi-Efficient)</span>, and <span className="text-rose-400 font-bold">Red (Inefficient)</span>.
          </p>
        </div>

        {/* Dynamic Threshold Adjustment & Legend */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-3 px-4 rounded-xl">
          <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
            <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
              {(['ratio', 'fixed'] as const).map((m) => (
                <button key={m} type="button" onClick={() => setBand(m)}
                  className={`px-2 py-0.5 rounded font-bold ${bandMode === m ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
                  title={m === 'ratio' ? 'Judge each creature column against its fastest weapon' : 'Fixed seconds (cutoffs on the right)'}>
                  {m === 'ratio' ? 'Ratio bands' : 'Fixed bands'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              <span className="text-emerald-400 font-bold">Efficient ({bandMode === 'ratio' ? `≤ ${RATIO_BANDS.efficient}× fastest` : `≤ ${efficientThreshold}s`})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.8)]" />
              <span className="text-yellow-400 font-bold">Semi-Efficient ({bandMode === 'ratio' ? `≤ ${RATIO_BANDS.semi}× fastest` : `${efficientThreshold}-${inefficientThreshold}s`})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
              <span className="text-rose-400 font-bold">Inefficient ({bandMode === 'ratio' ? `> ${RATIO_BANDS.semi}× or no kill` : `> ${inefficientThreshold}s`})</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-400 border-t sm:border-t-0 sm:border-l border-slate-700/80 pt-2 sm:pt-0 sm:pl-4">
            <span className="flex items-center gap-1.5 text-slate-200 font-semibold">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" /> Efficiency Cutoffs:
            </span>
            <div className="flex items-center gap-1.5 bg-slate-950/90 px-2 py-1 rounded-lg border border-slate-800">
              <span className="text-emerald-400 font-medium">Efficient &le;</span>
              <input
                type="number"
                min="1"
                max="999"
                value={efficientThreshold}
                onChange={(e) => handleUpdateEfficient(Number(e.target.value))}
                className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-center text-emerald-400 font-bold outline-none focus:border-cyan-400"
                title="Efficient cutoff in seconds (<= s is Green)"
              />
              <span>s</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-950/90 px-2 py-1 rounded-lg border border-slate-800">
              <span className="text-yellow-400 font-medium">Semi-Eff &le;</span>
              <input
                type="number"
                min="2"
                max="999"
                value={inefficientThreshold}
                onChange={(e) => handleUpdateInefficient(Number(e.target.value))}
                className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-center text-yellow-400 font-bold outline-none focus:border-cyan-400"
                title="Semi-Efficient cutoff in seconds (<= s is Yellow, > s is Red)"
              />
              <span>s</span>
            </div>
            <button
              type="button"
              onClick={handleResetThresholds}
              className="text-[11px] text-slate-400 hover:text-cyan-300 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition-colors flex items-center gap-1"
              title="Reset thresholds to default (120s / 240s)"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset (120s / 240s)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Measured matrix controls */}
      {(matrixMode === 'measured' || measured) && (
        <div className="mb-3 flex flex-wrap items-center gap-3 text-xs font-mono bg-violet-950/20 border border-violet-900/50 rounded-xl px-4 py-2">
          <span className="text-violet-300 font-bold">🧪 MEASURED MATRIX</span>
          {measureProgress ? (
            <>
              <div className="w-48 h-1.5 bg-slate-800 rounded overflow-hidden">
                <div className="h-full bg-violet-400" style={{ width: `${(measureProgress.done / Math.max(1, measureProgress.total)) * 100}%` }} />
              </div>
              <span className="text-slate-400">{measureProgress.done}/{measureProgress.total} runs</span>
              <button type="button" onClick={cancelMeasure} className="px-2 py-0.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800">Cancel</button>
            </>
          ) : (
            <button type="button" onClick={startMeasure} className="px-2.5 py-1 rounded-lg bg-violet-500 hover:bg-violet-400 text-slate-950 font-bold">
              {measured ? 'Re-run' : 'Run'} ({weapons.length * creatures.length * MEASURED_SEEDS} fights)
            </button>
          )}
          {measured && (
            <span className={measuredFresh ? 'text-slate-400' : 'text-amber-300'}>
              {measuredFresh ? `Up to date · ${measured.ranAt}` : `Stale: settings changed since ${measured.ranAt}. Re-run to refresh.`}
            </span>
          )}
          {!measured && !measureProgress && <span className="text-slate-500">Not run yet. Takes about a minute; the page stays usable.</span>}
          {matrixMode === 'simulated' && measured?.formulaAtRun && (
            <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
              <input type="checkbox" className="accent-violet-400" checked={calibrate}
                onChange={(e) => { setCalibrate(e.target.checked); try { localStorage.setItem('combatsim_ttk_calibrate', e.target.checked ? '1' : '0'); } catch {} }} />
              Calibrate Sim to Measured
              <span className="text-slate-500">(formula × measured/formula per cell; follows your edits until you re-run)</span>
            </label>
          )}
          {matrixMode === 'simulated' && measured && !isCalibrated && (
            <span className="text-slate-500">Cells marked <span className="text-violet-300 font-bold">≠</span> disagree with the measured band.</span>
          )}
          {measured?.decks && (
            <span className="text-slate-500">Decks: {Object.values(measured.decks).join(' · ')}</span>
          )}
        </div>
      )}

      {/* The Efficiency Matrix Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80 shadow-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/95 text-xs font-mono text-slate-400">
              <th className="p-4 font-bold text-slate-200">WEAPON SYSTEM</th>
              <th className="p-4">DAMAGE & AMMO</th>
              <th className="p-4">RAW SPECS</th>
              {creatures.map((c) => (
                <th
                  key={c.id}
                  onClick={() => onSelectCreature && onSelectCreature(c)}
                  className="p-4 text-center cursor-pointer hover:text-cyan-400 transition-colors border-l border-slate-800/80"
                >
                  <div className="font-bold text-slate-100 flex items-center justify-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.iconColor }} />
                    {c.quantity <= 1 && c.emoji ? `${c.emoji} ` : ''}{c.name}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 font-normal">
                    {c.quantity > 1 ? `Swarm (${c.quantity}x)` : `${c.hp} HP | AC ${c.armorClass}`}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
            {weapons.map((w, wIdx) => (
              <tr key={w.id} className="hover:bg-slate-900/30 transition-colors">
                <td
                  onClick={() => onSelectWeapon && onSelectWeapon(w)}
                  className="p-4 font-semibold text-slate-200 cursor-pointer hover:text-cyan-400 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: w.color }} />
                    <span className="font-bold text-slate-100 text-sm">{w.name}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    {w.trajectory} • Distance {w.distance ? `${Math.round(w.distance)} m` : '∞'} • Cone ±{Math.round(coneHalfAngleDeg(w))}°
                  </div>
                </td>

                <td className="p-4">
                  <div className="flex flex-col gap-1">
                    <span
                      className={`inline-flex items-center w-fit px-2 py-0.5 rounded text-[10px] font-bold ${
                        w.damageType === 'Physical'
                          ? 'bg-amber-950/50 text-amber-300 border border-amber-800/60'
                          : w.damageType === 'Energy'
                          ? 'bg-cyan-950/50 text-cyan-300 border border-cyan-800/60'
                          : 'bg-emerald-950/50 text-emerald-300 border border-emerald-800/60'
                      }`}
                    >
                      {w.damageType}
                    </span>
                    <span className="text-[10px] text-slate-400">{w.ammoType}</span>
                  </div>
                </td>

                <td className="p-4 text-[11px] text-slate-400">
                  <div>DPP: <span className="text-slate-200 font-bold">{w.dpp}</span> | FR: <span className="text-slate-200 font-bold">{w.fireRate}/s</span></div>
                  <div>MAG: <span className="text-slate-200">{w.ammoCapacity}</span> | RLD: <span className="text-slate-200">{w.reloadTime}s</span></div>
                </td>

                {creatures.map((c, cIdx) => {
                  const res = matrix[wIdx][cIdx];
                  const rating = getEfficiencyRating(res.timeToKillSeconds, res);
                  const style = getCellStyling(rating);
                  const isSelected = selectedCell === res;

                  return (
                    <td
                      key={c.id}
                      onClick={() => setSelectedCell(res)}
                      className={`p-4 text-center border-l border-slate-800/80 cursor-pointer transition-all border ${
                        style.bg
                      } ${style.glow} ${isSelected ? 'ring-2 ring-cyan-400 z-10' : ''}`}
                    >
                      <div className="flex items-baseline justify-center gap-1">
                        <span className={`text-xl font-black ${style.text}`}>
                          {matrixMode === 'measured' && measuredCellInfo(res)?.kills === 0 ? `>${MEASURED_MAX_SECONDS}` : Math.round(res.timeToKillSeconds * 10) / 10}
                        </span>
                        <span className="text-xs text-slate-400 font-normal">sec</span>
                      </div>

                      <div className="mt-2 flex justify-center">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold ${style.badge}`}
                        >
                          {style.icon}
                          {style.label}
                        </span>
                      </div>

                      <div className="text-[10px] text-slate-400 mt-2 flex flex-col items-center justify-center gap-0.5">
                        {matrixMode === 'measured' ? (() => {
                          const m = measuredCellInfo(res);
                          if (!m) return <span className="text-slate-500">not measured (estimate shown)</span>;
                          return (
                            <>
                              <span>{m.kills}/{m.runs} kills{m.kills < m.runs ? ` · ${m.runs - m.kills} survived ${MEASURED_MAX_SECONDS}s` : ''}</span>
                              {m.ttkMin !== null && <span className="text-[10px] text-slate-500">range {Math.round(m.ttkMin)}–{Math.round(m.ttkMax ?? m.ttkMin)}s</span>}
                            </>
                          );
                        })() : (
                          <div className="flex items-center gap-1">
                            <span>{res.shotsToKill} shots</span>
                            <span>•</span>
                            <span>{res.effectiveDps} eff. DPS</span>
                          </div>
                        )}
                        {matrixMode === 'simulated' && (
                          <div className="text-[10px] text-slate-500">
                            Theo: {res.theoreticalTtkSeconds}s ({Math.round((res.behaviorExposureRatio ?? 1) * 100)}% uptime)
                          </div>
                        )}
                        {isCalibrated && measured?.formulaAtRun?.[cellKey(res.weaponId, res.creatureId)] && (
                          <div className="text-[10px] text-violet-300" title="Calibrated: formula × (measured ÷ formula at the last measured run)">
                            calibrated · formula {Math.round(analytic[wIdx][cIdx].timeToKillSeconds)}s
                          </div>
                        )}
                        {matrixMode === 'simulated' && !isCalibrated && measuredFresh && (() => {
                          const mr = measuredResult(res);
                          if (!mr) return null;
                          const mRating = getEfficiencyRating(mr.timeToKillSeconds, mr);
                          const differs = mRating !== rating;
                          const ms = getCellStyling(mRating);
                          const m = measuredCellInfo(res)!;
                          return (
                            <div className={`text-[10px] ${differs ? 'text-violet-300 font-bold' : 'text-slate-500'}`} title={`Measured in the simulation: ${ms.label}`}>
                              {differs ? '≠ ' : ''}measured {m.kills === 0 ? `>${MEASURED_MAX_SECONDS}` : Math.round(mr.timeToKillSeconds)}s
                            </div>
                          );
                        })()}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedCell && (
        <div className="mt-6 p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-cyan-400 font-bold">
                EFFICIENCY AUDIT: {selectedCell.weaponName.toUpperCase()} VS {selectedCell.creatureName.toUpperCase()}
              </span>
              {(() => {
                const rating = getEfficiencyRating(selectedCell.timeToKillSeconds, selectedCell);
                const s = getCellStyling(rating);
                return (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${s.badge}`}>
                    {s.label}
                  </span>
                );
              })()}
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-mono">
              Neutralization requires {selectedCell.timeToKillSeconds}s in {matrixMode === 'simulated' ? 'the estimate' : matrixMode === 'measured' ? 'measured simulation runs' : 'theoretical benchmark'} ({selectedCell.shotsToKill} projectiles, consuming {selectedCell.totalAmmoConsumed} rounds).
              Armor penetration efficiency is {Math.round(selectedCell.penetrationRatio * 100)}% with sustained throughput of {selectedCell.effectiveDps} DPS.
            </p>
            {matrixMode === 'simulated' && selectedCell.behaviorExposureRatio && selectedCell.behaviorExposureRatio < 1 && (
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-mono">
                <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-sky-400">
                  🌊 Submersion Uptime: {Math.round((selectedCell.submersionUptimeRatio ?? 1) * 100)}%
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-amber-400">
                  🎯 Arc Window: {Math.round((selectedCell.arcExposureRatio ?? 1) * 100)}%
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-violet-400">
                  ⚡ Lead Tracking: {Math.round((selectedCell.trackingRatio ?? 1) * 100)}%
                </span>
                <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-bold">
                  ⏱️ Net Exposure Factor: {Math.round((selectedCell.behaviorExposureRatio ?? 1) * 100)}%
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 font-mono text-xs">
            <div className="text-center p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-[10px] text-slate-500">
                {matrixMode === 'simulated' ? 'SIM TTK' : 'PURE TTK'}
              </div>
              <div className="text-xl font-bold text-cyan-400">{selectedCell.timeToKillSeconds}s</div>
              {matrixMode === 'simulated' && (
                <div className="text-[10px] text-slate-500">Theo: {selectedCell.theoreticalTtkSeconds}s</div>
              )}
            </div>
            <div className="text-center p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-[10px] text-slate-500">AMMO REQUIRED</div>
              <div className="text-xl font-bold text-amber-400">{selectedCell.totalAmmoConsumed}</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-[10px] text-slate-500">PENETRATION</div>
              <div className="text-xl font-bold text-emerald-400">{Math.round(selectedCell.penetrationRatio * 100)}%</div>
            </div>
          </div>
        </div>
      )}
      {footer && <div className="mt-6">{footer}</div>}
    </div>
  );
};
