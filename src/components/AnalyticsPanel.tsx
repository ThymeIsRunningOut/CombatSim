import React from 'react';
import { CombatStatsSummary, BehemothState } from '../types/combat';
import { BarChart3, AlertOctagon, Zap, Shield, Flame, Activity } from 'lucide-react';

interface AnalyticsPanelProps {
  stats: CombatStatsSummary;
  behemoth: BehemothState;
  timeElapsed: number;
  logMessages: Array<{ id: string; time: number; text: string; type: 'info' | 'warn' | 'danger' | 'success' }>;
}

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({
  stats,
  behemoth,
  timeElapsed,
  logMessages,
}) => {
  const dpsInflicted = timeElapsed > 0 ? Math.round(stats.totalDamageDealtToCreatures / timeElapsed) : 0;
  const dpsReceived = timeElapsed > 0 ? Math.round(stats.totalDamageTakenByBehemoth / timeElapsed) : 0;

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto bg-[#070e1a]">
      {/* Title */}
      <div className="mb-6">
        <h2 className="text-xl font-bold font-mono text-slate-100 flex items-center gap-2">
          ENCOUNTER ANALYTICS & PROJECTIONS
          <span className="text-xs px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">TELEMETRY & LOGISTICS</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Detailed metrics covering Behemoth hull attrition, ammo depletion curves, power grid draw, and impact telemetry.
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Damage Inflicted */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
            <span>OFFENSIVE OUTPUT</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-400">
            {Math.round(stats.totalDamageDealtToCreatures).toLocaleString()}
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-1">
            Avg Sustained DPS: <span className="text-slate-300 font-semibold">{dpsInflicted} DMG/s</span>
          </div>
        </div>

        {/* Hull Damage Taken */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
            <span>VESSEL ATTRITION</span>
            <Shield className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-400">
            {Math.round(stats.totalDamageTakenByBehemoth).toLocaleString()}
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-1">
            Hull Inflow Rate: <span className="text-slate-300 font-semibold">{dpsReceived} DMG/s</span>
          </div>
        </div>

        {/* Peak Power Draw */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
            <span>GRID PEAK LOAD</span>
            <Zap className="w-4 h-4 text-yellow-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-yellow-400">
            {stats.peakPowerDraw} <span className="text-sm font-normal text-slate-400">kW</span>
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-1">
            Capacity: <span className="text-slate-300 font-semibold">{behemoth.totalPowerCapacity} kW</span>
          </div>
        </div>

        {/* Ram Impacts & Listing */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
            <span>RAM IMPULSES / TILT</span>
            <AlertOctagon className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400">
            {stats.rammingEventsCount} <span className="text-sm font-normal text-slate-400">ram hits</span>
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-1">
            Critical Tilt Alerts (&gt;35°): <span className="text-rose-400 font-bold">{stats.criticalTiltsCount}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
        {/* Ammo Logistics Depletion Tracker */}
        <div className="p-5 rounded-xl bg-slate-950/80 border border-slate-800 shadow-md flex flex-col">
          <h3 className="text-sm font-bold font-mono text-slate-200 mb-4 flex items-center gap-2">
            RESOURCE CONSUMPTION & LOGISTICS
          </h3>

          <div className="flex flex-col gap-4 font-mono text-xs">
            {Object.keys(stats.totalAmmoConsumed).length === 0 ? (
              <div className="text-slate-500 italic py-6 text-center">
                No ammunition expended yet in this combat run.
              </div>
            ) : (
              (Object.entries(stats.totalAmmoConsumed) as [string, number][]).map(([ammoType, count]) => {
                return (
                  <div key={ammoType} className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-slate-300 font-semibold">{ammoType}</span>
                      <span className="text-cyan-400 font-bold">{count} rounds/units</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan-500 rounded-full"
                        style={{ width: `${Math.min(100, (count / 300) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-auto pt-4 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
            Simulated Engagement Duration: <span className="text-slate-200 font-bold">{timeElapsed.toFixed(1)} seconds</span>
          </div>
        </div>

        {/* Combat Telemetry Event Log */}
        <div className="p-5 rounded-xl bg-slate-950/80 border border-slate-800 shadow-md flex flex-col min-h-0">
          <h3 className="text-sm font-bold font-mono text-slate-200 mb-3 flex items-center justify-between">
            <span>COMBAT TELEMETRY LOG</span>
            <span className="text-[10px] text-slate-500 font-normal">{logMessages.length} events logged</span>
          </h3>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2 font-mono text-xs max-h-72">
            {logMessages.length === 0 ? (
              <div className="text-slate-500 italic py-6 text-center">No telemetry recorded.</div>
            ) : (
              logMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-2 rounded border text-[11px] flex items-start gap-2 ${
                    msg.type === 'danger'
                      ? 'bg-rose-950/30 border-rose-800/50 text-rose-300'
                      : msg.type === 'warn'
                      ? 'bg-amber-950/30 border-amber-800/50 text-amber-300'
                      : msg.type === 'success'
                      ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
                      : 'bg-slate-900/50 border-slate-800 text-slate-300'
                  }`}
                >
                  <span className="text-slate-500 text-[10px] font-bold">[{msg.time}s]</span>
                  <span className="flex-1 leading-snug">{msg.text}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
