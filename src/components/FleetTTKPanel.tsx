import React from 'react';
import { FleetSpeciesDef, FleetFactionDef, WeaponDef, CombatConfig } from '../types/combat';
import { resolveShipType } from '../engine/fleets';
import { calculateFleetShipTTK, FleetTTKResult, formatShotsToKill } from '../engine/analytics';

interface FleetTTKPanelProps {
  species: FleetSpeciesDef[];
  factions: FleetFactionDef[];
  weapons: WeaponDef[];
  combatConfig?: CombatConfig;
  /** Species / faction shown in the per-ship-type table ('__base__' = species base values). */
  selection: { speciesId: string; factionId: string };
  onSelectionChange: (sel: { speciesId: string; factionId: string }) => void;
}

const RATING_STYLE: Record<string, string> = {
  EFFICIENT: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60',
  SEMI_EFFICIENT: 'bg-amber-950/50 text-amber-300 border-amber-800/60',
  INEFFICIENT: 'bg-rose-950/50 text-rose-300 border-rose-800/60',
};
const RATING_LABEL: Record<string, string> = { EFFICIENT: 'EFF', SEMI_EFFICIENT: 'SEMI', INEFFICIENT: 'INEF' };
const fmtTtk = (t: number) => (t >= 3600 ? '>1h' : t >= 600 ? `${Math.round(t / 60)}m` : `${Math.round(t)}s`);

/** Fleet total: ships killed one after another by a single turret; rating = count-weighted average of ship ratings. */
function fleetTotal(results: Array<{ count: number; r: FleetTTKResult }>) {
  const time = results.reduce((s, x) => s + x.count * x.r.timeToKillSeconds, 0);
  const n = results.reduce((s, x) => s + x.count, 0);
  const score = n > 0 ? results.reduce((s, x) => s + x.count * (x.r.efficiencyRating === 'EFFICIENT' ? 0 : x.r.efficiencyRating === 'SEMI_EFFICIENT' ? 1 : 2), 0) / n : 1;
  const rating = score < 0.5 ? 'EFFICIENT' : score < 1.5 ? 'SEMI_EFFICIENT' : 'INEFFICIENT';
  return { time, rating };
}

const TtkCell: React.FC<{ r: FleetTTKResult }> = ({ r }) => (
  <td className="p-1">
    <div
      className={`border rounded px-1.5 py-0.5 text-center ${RATING_STYLE[r.efficiencyRating ?? 'SEMI_EFFICIENT']}`}
      title={`Theoretical ${r.theoreticalTtkSeconds}s · exposure ×${r.behaviorExposureRatio} (surfaced ${Math.round((r.submersionUptimeRatio ?? 1) * 100)}%, arc ${r.arcExposureRatio}) · tracking ${r.trackingRatio} · intercept ${r.interceptRatio}` +
        ` · weapon multiplier ×${r.weaponMultiplier}${r.barrierUptime ? ` · barrier ${Math.round(r.barrierUptime * 100)}% of the time` : ''} · ${formatShotsToKill(r)}, ${Number(r.totalAmmoConsumed.toFixed(1))} ammo`}
    >
      <span className="font-bold">{RATING_LABEL[r.efficiencyRating ?? 'SEMI_EFFICIENT']}</span> {fmtTtk(r.timeToKillSeconds)}
    </div>
  </td>
);

/** Fleet TTK side panel: per-ship-type table for one species/faction + whole-fleet overview of every fleet. */
export const FleetTTKPanel: React.FC<FleetTTKPanelProps> = ({ species, factions, weapons, combatConfig, selection, onSelectionChange }) => {
  const sp = species.find((s) => s.id === selection.speciesId) ?? species[0];
  if (!sp) return null;
  const spFactions = factions.filter((f) => f.speciesId === sp.id);
  const faction = selection.factionId === '__base__' ? undefined : spFactions.find((f) => f.id === selection.factionId);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
        <span className="text-slate-300 font-bold">FLEET TTK</span>
        <select value={sp.id} onChange={(e) => onSelectionChange({ speciesId: e.target.value, factionId: '__base__' })} className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-slate-200">
          {species.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={faction ? faction.id : '__base__'} onChange={(e) => onSelectionChange({ speciesId: sp.id, factionId: e.target.value })} className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-slate-200">
          <option value="__base__">Species base</option>
          {spFactions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>
      {/* TTK: selected species (base or faction view) */}
      <div className="flex flex-col gap-2">
        <div className="text-xs font-mono font-bold text-slate-200">
          TTK — one Behemoth turret vs {faction ? faction.name : `${sp.name} (base values)`}
          <span className="text-slate-500 font-normal"> · simulated (behavior exposure, weapon multipliers, barrier, regen) · hover a cell for details</span>
        </div>
        <div className="overflow-auto">
          <table className="text-[11px] font-mono border-collapse">
            <thead>
              <tr>
                <th className="p-1 text-left text-slate-500">ship type</th>
                {weapons.map((w) => <th key={w.id} className="p-1 text-slate-300 font-semibold whitespace-nowrap">{w.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {(() => {
                const rows = sp.shipTypes.map((b) => {
                  const st = resolveShipType(sp, faction, b.id)!;
                  return { st, res: weapons.map((w) => calculateFleetShipTTK(w, st, 'simulated', undefined, combatConfig)) };
                });
                return (
                  <>
                    {rows.map(({ st, res }) => (
                      <tr key={st.id} className="border-t border-slate-800/70">
                        <td className="p-1 text-slate-200 whitespace-nowrap">{st.emoji} {st.name} <span className="text-slate-500">×{st.count}</span></td>
                        {res.map((r) => <TtkCell key={r.weaponId} r={r} />)}
                      </tr>
                    ))}
                    <tr className="border-t border-slate-700">
                      <td className="p-1 text-slate-300 font-semibold whitespace-nowrap">Whole fleet</td>
                      {weapons.map((w, wi) => {
                        const tot = fleetTotal(rows.map(({ st, res }) => ({ count: Math.max(0, Math.round(st.count)), r: res[wi] })));
                        return (
                          <td key={w.id} className="p-1">
                            <div className={`border rounded px-1.5 py-0.5 text-center ${RATING_STYLE[tot.rating]}`} title="Every ship killed one after another by a single turret">
                              <span className="font-bold">{RATING_LABEL[tot.rating]}</span> {fmtTtk(tot.time)}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Overview: every species × faction, whole-fleet TTK */}
      <div className="flex flex-col gap-2 border-t border-slate-800 pt-3">
        <div className="text-xs font-mono font-bold text-slate-200">
          ALL FLEETS — whole-fleet TTK, one turret <span className="text-slate-500 font-normal">· ships killed one after another · rating = average of the ships</span>
        </div>
        <div className="overflow-auto">
          <table className="text-[11px] font-mono border-collapse">
            <thead>
              <tr>
                <th className="p-1 text-left text-slate-500">fleet</th>
                {weapons.map((w) => <th key={w.id} className="p-1 text-slate-300 font-semibold whitespace-nowrap">{w.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {species.flatMap((s2) => {
                const facs = factions.filter((f) => f.speciesId === s2.id);
                return (facs.length ? facs : [undefined]).map((f) => (
                  <tr key={`${s2.id}_${f?.id ?? 'base'}`} className="border-t border-slate-800/70">
                    <td className="p-1 text-slate-200 whitespace-nowrap">
                      <span className="inline-block w-2 h-2 rotate-45 mr-1.5" style={{ backgroundColor: f?.color ?? s2.color }} />
                      {s2.name}{f ? <span className="text-slate-500"> · {f.name}</span> : null}
                    </td>
                    {weapons.map((w) => {
                      const tot = fleetTotal(s2.shipTypes.map((b) => {
                        const st = resolveShipType(s2, f, b.id)!;
                        return { count: Math.max(0, Math.round(st.count)), r: calculateFleetShipTTK(w, st, 'simulated', undefined, combatConfig) };
                      }));
                      return (
                        <td key={w.id} className="p-1">
                          <div className={`border rounded px-1.5 py-0.5 text-center ${RATING_STYLE[tot.rating]}`}>
                            <span className="font-bold">{RATING_LABEL[tot.rating]}</span> {fmtTtk(tot.time)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
