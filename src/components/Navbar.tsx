import React from 'react';
import { Play, Pause, RotateCcw, FastForward, Activity, ShieldAlert, Cpu, BarChart3, Crosshair, Download, Upload, Save, Check } from 'lucide-react';

interface NavbarProps {
  currentMode: 'tactical' | 'behavior' | 'ttk' | 'analytics' | 'balancing';
  setMode: (mode: 'tactical' | 'behavior' | 'ttk' | 'analytics' | 'balancing') => void;
  isRunning: boolean;
  setIsRunning: (running: boolean) => void;
  simSpeed: number;
  setSimSpeed: (speed: number) => void;
  onReset: () => void;
  onSpawnCreature: (id: string) => void;
  creatureOptions: Array<{ id: string; name: string }>;
  onSaveToProjectFile?: () => void;
  onExportConfigFile?: () => void;
  onImportConfigFile?: (file: File) => void;
  savedNotification?: string | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentMode,
  setMode,
  isRunning,
  setIsRunning,
  simSpeed,
  setSimSpeed,
  onReset,
  onSpawnCreature,
  creatureOptions,
  onSaveToProjectFile,
  onExportConfigFile,
  onImportConfigFile,
  savedNotification,
}) => {
  return (
    <header className="h-16 bg-[#081220]/90 backdrop-blur-md border-b border-slate-800 px-6 flex items-center justify-between z-30 select-none">
      {/* Brand & Vessel Status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center font-bold text-white shadow-lg shadow-cyan-500/20">
            B
          </div>
          <div>
            <div className="text-base font-black tracking-wider text-slate-100 flex items-center gap-2 font-mono">
              BEHEMOTH <span className="text-xs px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">SIM V2.4</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono tracking-wide">COMBAT SIMULATION & BALANCING ENGINE</div>
          </div>
        </div>

        {/* View Switchers */}
        <div className="hidden lg:flex items-center gap-1 ml-6 p-1 bg-slate-900/80 border border-slate-800 rounded-lg">
          <button
            onClick={() => setMode('tactical')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
              currentMode === 'tactical'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            2D Tactical Radar
          </button>

          <button
            onClick={() => setMode('behavior')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
              currentMode === 'behavior'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Behavior Editor
          </button>

          <button
            onClick={() => setMode('balancing')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
              currentMode === 'balancing'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            Stat Sliders & Tuning
          </button>

          <button
            onClick={() => setMode('analytics')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
              currentMode === 'analytics'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Balancing Dashboard
          </button>
        </div>
      </div>

      {/* Simulation Controls & Spawn Spawner */}
      <div className="flex items-center gap-4">
        {/* Spawn Quick Select */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg p-1 px-2">
          <span className="text-[11px] font-mono text-slate-400">Spawn Threat:</span>
          <select
            onChange={(e) => {
              if (e.target.value) {
                onSpawnCreature(e.target.value);
                e.target.value = '';
              }
            }}
            defaultValue=""
            className="bg-slate-800 text-xs text-cyan-300 font-mono rounded px-2 py-1 outline-none border border-slate-700 hover:border-cyan-600 transition-colors"
          >
            <option value="" disabled>Select Target...</option>
            {creatureOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Speed Toggles */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
          {[0.5, 1, 2, 4].map((spd) => (
            <button
              key={spd}
              onClick={() => setSimSpeed(spd)}
              className={`px-2 py-1 text-xs font-mono rounded transition-all ${
                simSpeed === spd
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>

        {/* Preset File Export / Import & Project Save */}
        <div className="flex items-center gap-1.5 border-r border-slate-800 pr-3">
          {savedNotification && (
            <span className="hidden xl:flex text-[11px] px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono items-center gap-1 animate-pulse">
              <Check className="w-3.5 h-3.5" /> {savedNotification}
            </span>
          )}

          {onSaveToProjectFile && (
            <button
              onClick={onSaveToProjectFile}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/50 text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-md"
              title="Save changes directly into project files (src/data/saved_presets.json)"
            >
              <Save className="w-3.5 h-3.5" />
              <span className="hidden md:inline">SAVE FILE</span>
            </button>
          )}

          {onExportConfigFile && (
            <button
              onClick={onExportConfigFile}
              className="px-2.5 py-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-500 text-cyan-300 hover:text-slate-950 border border-cyan-500/50 text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-md"
              title="Export all current settings to a downloadable JSON file"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden md:inline">EXPORT</span>
            </button>
          )}

          {onImportConfigFile && (
            <label
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Import configuration from a previously exported JSON file"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden md:inline">IMPORT</span>
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    onImportConfigFile(e.target.files[0]);
                    e.target.value = '';
                  }
                }}
              />
            </label>
          )}
        </div>

        {/* Play/Pause & Reset */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
              isRunning
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
            }`}
          >
            {isRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            {isRunning ? 'PAUSE' : 'SIMULATE'}
          </button>

          <button
            onClick={onReset}
            title="Reset Simulation State"
            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-all border border-slate-700"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
