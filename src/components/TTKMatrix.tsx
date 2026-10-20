import React, { useState } from 'react';
import { WeaponDef, CreatureDef, TTKResult } from '../types/combat';
import { generateTTKMatrix } from '../engine/analytics';
import { Shield, Zap, Flame, Clock, Target, AlertCircle, CheckCircle2, XCircle, Sliders } from 'lucide-react';

interface TTKMatrixProps {
  weapons: WeaponDef[];
  creatures: CreatureDef[];
  onSelectWeapon?: (weapon: WeaponDef) => void;
  onSelectCreature?: (creature: CreatureDef) => void;
  isCompact?: boolean;
}

export const TTKMatrix: React.FC<TTKMatrixProps> = ({
  weapons,
  creatures,
  onSelectWeapon,
  onSelectCreature,
  isCompact = false,
}) => {
  const [matrixMode, setMatrixMode] = useState<'simulated' | 'theoretical'>('simulated');
  const [selectedCell, setSelectedCell] = useState<TTKResult | null>(null);

  // Configurable designer threshold sliders for efficiency categorization
  const [efficientThreshold, setEfficientThreshold] = useState<number>(12); // <= 12s is Efficient (Green)
  const [inefficientThreshold, setInefficientThreshold] = useState<number>(25); // > 25s is Inefficient (Red)

  const matrix = generateTTKMatrix(weapons, creatures, matrixMode);

  const getEfficiencyRating = (ttk: number, result: TTKResult): 'EFFICIENT' | 'SEMI_EFFICIENT' | 'INEFFICIENT' => {
    if (result.efficiencyRating) {
      return result.efficiencyRating;
    }
    if (result.status === 'IMMUNE' || result.shotsToKill >= 20000 || ttk > inefficientThreshold) {
      return 'INEFFICIENT';
    }
    if (ttk <= efficientThreshold && result.penetrationRatio >= 0.25) {
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
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                {matrixMode === 'simulated' ? 'SIMULATED' : 'BENCHMARK'}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {matrixMode === 'simulated' ? 'Behavior & Exposure Adjusted' : 'Theoretical Continuous Fire'}
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[9px]">
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
                      <span className="truncate max-w-[70px]">{c.name}</span>
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
                    <div className="text-[9px] text-slate-500">{w.damageType}</div>
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
                        <div className="text-[9px] text-slate-400">
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
                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${s.badge}`}>
                    {s.label}
                  </span>
                );
              })()}
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center mt-1.5">
              <div className="p-1 rounded bg-slate-950 border border-slate-800">
                <div className="text-[8px] text-slate-500">
                  {matrixMode === 'simulated' ? 'SIM TTK' : 'PURE TTK'}
                </div>
                <div className="text-xs font-bold text-cyan-400">{selectedCell.timeToKillSeconds}s</div>
              </div>
              <div className="p-1 rounded bg-slate-950 border border-slate-800">
                <div className="text-[8px] text-slate-500">EXPOSURE</div>
                <div className="text-xs font-bold text-amber-400">
                  {Math.round((selectedCell.behaviorExposureRatio ?? 1) * 100)}%
                </div>
              </div>
              <div className="p-1 rounded bg-slate-950 border border-slate-800">
                <div className="text-[8px] text-slate-500">PEN.</div>
                <div className="text-xs font-bold text-emerald-400">{Math.round(selectedCell.penetrationRatio * 100)}%</div>
              </div>
            </div>
            {matrixMode === 'simulated' && selectedCell.behaviorExposureRatio && selectedCell.behaviorExposureRatio < 1 && (
              <div className="mt-2 text-[9px] text-slate-400 border-t border-slate-800/80 pt-1 flex justify-between">
                <span>Vuln Uptime: {Math.round((selectedCell.submersionUptimeRatio ?? 1) * 100)}%</span>
                <span>Arc: {Math.round((selectedCell.arcExposureRatio ?? 1) * 100)}%</span>
                <span>Track: {Math.round((selectedCell.trackingRatio ?? 1) * 100)}%</span>
              </div>
            )}
          </div>
        )}
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
            </div>
          </div>

          <p className="text-xs text-slate-400 mt-1">
            {matrixMode === 'simulated'
              ? 'Calculates real-world TTK factoring in creature diving cycles, turret tracking limits, and orbit arc exposure.'
              : 'Stationary line-of-sight benchmark assuming uninterrupted firing uptime and zero line-of-sight obstruction.'}
            {' '}Efficiency ratings: <span className="text-emerald-400 font-bold">Green (Efficient)</span>, <span className="text-yellow-400 font-bold">Yellow (Semi-Efficient)</span>, and <span className="text-rose-400 font-bold">Red (Inefficient)</span>.
          </p>
        </div>

        {/* Dynamic Threshold Adjustment & Legend */}
        <div className="flex flex-wrap items-center gap-4 bg-slate-900/90 border border-slate-800 p-2.5 px-4 rounded-xl">
          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              <span className="text-emerald-400 font-bold">Efficient (&le; {efficientThreshold}s)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.8)]" />
              <span className="text-yellow-400 font-bold">Semi-Efficient ({efficientThreshold}-{inefficientThreshold}s)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
              <span className="text-rose-400 font-bold">Inefficient (&gt; {inefficientThreshold}s)</span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-3 border-l border-slate-700/80 pl-4 text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1 text-slate-300">
              <Sliders className="w-3 h-3" /> Cutoffs:
            </span>
            <div className="flex items-center gap-1">
              <span>Eff:</span>
              <input
                type="number"
                min="3"
                max="30"
                value={efficientThreshold}
                onChange={(e) => setEfficientThreshold(Math.max(1, Number(e.target.value)))}
                className="w-10 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-center text-emerald-400 font-bold outline-none"
              />
              <span>s</span>
            </div>
            <div className="flex items-center gap-1">
              <span>Ineff:</span>
              <input
                type="number"
                min="10"
                max="80"
                value={inefficientThreshold}
                onChange={(e) => setInefficientThreshold(Math.max(efficientThreshold + 1, Number(e.target.value)))}
                className="w-10 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-center text-rose-400 font-bold outline-none"
              />
              <span>s</span>
            </div>
          </div>
        </div>
      </div>

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
                    {c.name}
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
                    {w.trajectory} • Range {w.range}px • Arc {w.shootingArc ?? 360}°
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
                          {res.timeToKillSeconds}
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
                        <div className="flex items-center gap-1">
                          <span>{res.shotsToKill} shots</span>
                          <span>•</span>
                          <span>{res.effectiveDps} eff. DPS</span>
                        </div>
                        {matrixMode === 'simulated' && (
                          <div className="text-[9px] text-slate-500">
                            Theo: {res.theoreticalTtkSeconds}s ({Math.round((res.behaviorExposureRatio ?? 1) * 100)}% uptime)
                          </div>
                        )}
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
              Neutralization requires {selectedCell.timeToKillSeconds}s in {matrixMode === 'simulated' ? 'simulated combat' : 'theoretical benchmark'} ({selectedCell.shotsToKill} projectiles, consuming {selectedCell.totalAmmoConsumed} rounds).
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
                <div className="text-[9px] text-slate-500">Theo: {selectedCell.theoreticalTtkSeconds}s</div>
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
    </div>
  );
};
