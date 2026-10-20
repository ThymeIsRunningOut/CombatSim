import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  FastForward,
  AlertTriangle,
  CheckCircle,
  Activity,
  Flame,
  Shield,
  Clock,
  Layers,
} from 'lucide-react';
import { CreatureRuntimeInstance, CreatureDef } from '../../types/combat';
import { BehaviorRuntimeState } from '../../types/behavior';

interface SimulationControlBarProps {
  isRunning: boolean;
  onToggleRunning: () => void;
  onReset: () => void;
  onStep: () => void;
  simSpeed: number;
  onSetSpeed: (speed: number) => void;
  creature: CreatureRuntimeInstance | null;
  creatureDef: CreatureDef | null;
  runtimeState: BehaviorRuntimeState | null;
  validationWarnings: string[];
  avgTTK: number;
  effectiveDps: number;
}

export const SimulationControlBar: React.FC<SimulationControlBarProps> = ({
  isRunning,
  onToggleRunning,
  onReset,
  onStep,
  simSpeed,
  onSetSpeed,
  creature,
  creatureDef,
  runtimeState,
  validationWarnings,
  avgTTK,
  effectiveDps,
}) => {
  const hpPercent = creature
    ? Math.max(0, Math.min(100, Math.round((creature.hp / creature.maxHp) * 100)))
    : 0;

  return (
    <div className="h-14 bg-[#081220] border-t border-slate-800 px-4 flex items-center justify-between font-mono text-xs select-none z-20">
      {/* LEFT: Simulation Transport Controls */}
      <div className="flex items-center gap-3">
        {/* Play/Pause Button */}
        <button
          onClick={onToggleRunning}
          className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all shadow-md ${
            isRunning
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
          }`}
        >
          {isRunning ? (
            <Pause className="w-3.5 h-3.5 fill-current" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current" />
          )}
          <span>{isRunning ? 'PAUSE' : 'PLAY'}</span>
        </button>

        {/* Step Forward Button */}
        <button
          onClick={onStep}
          title="Step Forward (Single Frame 0.1s)"
          className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <SkipForward className="w-4 h-4" />
        </button>

        {/* Reset Button */}
        <button
          onClick={onReset}
          title="Restart Behavior Simulation"
          className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Speed Toggles */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5 ml-1">
          {[0.5, 1, 2, 4].map((spd) => (
            <button
              key={spd}
              onClick={() => onSetSpeed(spd)}
              className={`px-2 py-1 text-[11px] rounded transition-all ${
                simSpeed === spd
                  ? 'bg-cyan-500/20 text-cyan-400 font-bold border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>

      {/* CENTER: Live Combat Telemetry Dashboard */}
      <div className="flex items-center gap-6">
        {/* Threat Health Pool */}
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-rose-400" />
          <div>
            <div className="text-[10px] text-slate-400 leading-none">THREAT HP</div>
            <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5 mt-0.5">
              <span>{creature ? Math.round(creature.hp) : 0}</span>
              <span className="text-[10px] text-slate-400">/ {creature?.maxHp || 0}</span>
              <span className="text-[10px] text-rose-400">({hpPercent}%)</span>
            </div>
          </div>
        </div>

        {/* Projected TTK */}
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-cyan-400" />
          <div>
            <div className="text-[10px] text-slate-400 leading-none">AVG TTK</div>
            <div className="text-xs font-bold text-cyan-300 mt-0.5">
              {avgTTK > 0 ? `${avgTTK.toFixed(1)}s` : 'N/A'}
            </div>
          </div>
        </div>

        {/* Effective DPS */}
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-amber-400" />
          <div>
            <div className="text-[10px] text-slate-400 leading-none">DPS ON TARGET</div>
            <div className="text-xs font-bold text-amber-300 mt-0.5">
              {effectiveDps > 0 ? Math.round(effectiveDps) : 0}
            </div>
          </div>
        </div>

        {/* Formation Integrity */}
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <div>
            <div className="text-[10px] text-slate-400 leading-none">FORMATION</div>
            <div className="text-xs font-bold text-emerald-300 mt-0.5">
              {runtimeState ? Math.round(runtimeState.formationIntegrity) : 100}%
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: Behavior Validation Warnings Indicator */}
      <div className="flex items-center gap-2">
        {validationWarnings.length > 0 ? (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-950/60 border border-amber-800 text-amber-300 text-[11px]"
            title={validationWarnings.join('\n')}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>{validationWarnings.length} Issue{validationWarnings.length > 1 ? 's' : ''}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-[11px]">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>Tree Valid</span>
          </div>
        )}
      </div>
    </div>
  );
};
