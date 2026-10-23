import React from 'react';
import { Play, Pause, RotateCcw, FastForward, Activity, ShieldAlert, Cpu, BarChart3, Crosshair, Download, Upload, Save, Check, Box } from 'lucide-react';

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
  onOpenUnrealModal?: () => void;
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
  onOpenUnrealModal,
  savedNotification,
}) => {
  return (
    <header className="h-14 sm:h-16 bg-[#081220]/95 backdrop-blur-md border-b border-slate-800 px-2 sm:px-4 md:px-6 flex items-center justify-between z-30 select-none min-w-0 max-w-full gap-1.5 sm:gap-3 overflow-hidden">
      {/* Brand & Vessel Status & View Switchers */}
      <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0 flex-shrink">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center font-bold text-white shadow-lg shadow-cyan-500/20 text-xs sm:text-sm">
            B
          </div>
          <div>
            <div className="text-xs sm:text-sm md:text-base font-black tracking-wider text-slate-100 flex items-center gap-1 font-mono">
              <span>BEHEMOTH</span>
              <span className="hidden md:inline text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                V2.4
              </span>
            </div>
            <div className="hidden 2xl:block text-[9px] text-slate-400 font-mono tracking-wide">
              COMBAT SIMULATION & BALANCING ENGINE
            </div>
          </div>
        </div>

        {/* View Switchers */}
        <div className="flex items-center gap-0.5 sm:gap-1 p-0.5 sm:p-1 bg-slate-900/80 border border-slate-800 rounded-lg min-w-0 flex-shrink overflow-x-auto">
          <button
            onClick={() => setMode('tactical')}
            title="2D Tactical Radar"
            className={`px-2 sm:px-2.5 md:px-3 py-1 sm:py-1.5 rounded-md text-[11px] sm:text-xs font-semibold flex items-center gap-1 sm:gap-1.5 transition-all flex-shrink-0 ${
              currentMode === 'tactical'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="hidden xl:inline">Tactical Radar</span>
            <span className="hidden sm:inline xl:hidden">Radar</span>
          </button>

          <button
            onClick={() => setMode('behavior')}
            title="Behavior AI Editor"
            className={`px-2 sm:px-2.5 md:px-3 py-1 sm:py-1.5 rounded-md text-[11px] sm:text-xs font-semibold flex items-center gap-1 sm:gap-1.5 transition-all flex-shrink-0 ${
              currentMode === 'behavior'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Activity className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="hidden xl:inline">Behavior Editor</span>
            <span className="hidden sm:inline xl:hidden">AI Tree</span>
          </button>

          <button
            onClick={() => setMode('balancing')}
            title="Stat Sliders & Tuning"
            className={`px-2 sm:px-2.5 md:px-3 py-1 sm:py-1.5 rounded-md text-[11px] sm:text-xs font-semibold flex items-center gap-1 sm:gap-1.5 transition-all flex-shrink-0 ${
              currentMode === 'balancing'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="hidden xl:inline">Stat Tuning</span>
            <span className="hidden sm:inline xl:hidden">Tuning</span>
          </button>

          <button
            onClick={() => setMode('ttk')}
            title="Time-To-Kill (TTK) Matrix"
            className={`px-2 sm:px-2.5 md:px-3 py-1 sm:py-1.5 rounded-md text-[11px] sm:text-xs font-semibold flex items-center gap-1 sm:gap-1.5 transition-all flex-shrink-0 ${
              currentMode === 'ttk'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="hidden xl:inline">TTK Matrix</span>
            <span className="hidden sm:inline xl:hidden">TTK</span>
          </button>

          <button
            onClick={() => setMode('analytics')}
            title="Combat Analytics & Telemetry"
            className={`px-2 sm:px-2.5 md:px-3 py-1 sm:py-1.5 rounded-md text-[11px] sm:text-xs font-semibold flex items-center gap-1 sm:gap-1.5 transition-all flex-shrink-0 ${
              currentMode === 'analytics'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="hidden xl:inline">Analytics</span>
            <span className="hidden sm:inline xl:hidden">Stats</span>
          </button>
        </div>
      </div>

      {/* Simulation Controls, Threat Spawner, Files & Reset */}
      <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 flex-shrink-0">
        {/* Spawn Quick Select */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5 sm:p-1 px-1.5 sm:px-2">
          <span className="hidden xl:inline text-[11px] font-mono text-slate-400">Spawn:</span>
          <select
            onChange={(e) => {
              if (e.target.value) {
                onSpawnCreature(e.target.value);
                e.target.value = '';
              }
            }}
            defaultValue=""
            className="bg-slate-800 text-[10px] sm:text-xs text-cyan-300 font-mono rounded px-1.5 py-0.5 sm:py-1 outline-none border border-slate-700 hover:border-cyan-600 transition-colors max-w-[85px] sm:max-w-[120px] md:max-w-[140px] truncate"
          >
            <option value="" disabled>Spawn Threat...</option>
            {creatureOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Speed Toggles */}
        <div className="hidden sm:flex items-center gap-0.5 bg-slate-900 border border-slate-800 rounded-lg p-0.5 sm:p-1">
          {[0.5, 1, 2, 4].map((spd) => (
            <button
              key={spd}
              onClick={() => setSimSpeed(spd)}
              className={`px-1 sm:px-1.5 md:px-2 py-0.5 text-[10px] sm:text-xs font-mono rounded transition-all ${
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
        <div className="flex items-center gap-1 border-r border-slate-800/80 pr-1.5 sm:pr-2.5">
          {savedNotification && (
            <span className="hidden 2xl:flex text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono items-center gap-1 animate-pulse">
              <Check className="w-3 h-3" /> {savedNotification}
            </span>
          )}

          {onSaveToProjectFile && (
            <button
              onClick={onSaveToProjectFile}
              className="px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/50 text-[11px] sm:text-xs font-mono font-bold flex items-center gap-1 transition-all shadow-sm"
              title="Save changes directly into project files (Shortcut: Cmd+S / Ctrl+S)"
            >
              <Save className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">SAVE</span>
            </button>
          )}

          {onExportConfigFile && (
            <button
              onClick={onExportConfigFile}
              className="hidden md:flex px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-500 text-cyan-300 hover:text-slate-950 border border-cyan-500/50 text-[11px] sm:text-xs font-mono font-bold items-center gap-1 transition-all shadow-sm"
              title="Export all current settings to a downloadable JSON file"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">EXPORT</span>
            </button>
          )}

          {onImportConfigFile && (
            <label
              className="hidden md:flex px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] sm:text-xs font-mono font-bold items-center gap-1 transition-all cursor-pointer"
              title="Import configuration from a previously exported JSON file"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">IMPORT</span>
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

          {onOpenUnrealModal && (
            <button
              onClick={onOpenUnrealModal}
              className="px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg bg-purple-600/30 hover:bg-purple-500 text-purple-300 hover:text-slate-950 border border-purple-500/50 text-[11px] sm:text-xs font-mono font-bold flex items-center gap-1 transition-all shadow-sm"
              title="Open Unreal Engine Telemetry & Measurements Export Bridge (World Tile 2km, Behemoth 750m, Speed 1 kt/min)"
            >
              <Box className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">UNREAL</span>
            </button>
          )}
        </div>

        {/* Play/Pause & Reset - Always Visible & Protected from Overflow */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <button
            onClick={() => setIsRunning(!isRunning)}
            title={isRunning ? 'Pause Simulation' : 'Start Simulation'}
            className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 sm:gap-1.5 transition-all shadow-md flex-shrink-0 ${
              isRunning
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
            }`}
          >
            {isRunning ? (
              <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
            )}
            <span className="hidden sm:inline">{isRunning ? 'PAUSE' : 'SIMULATE'}</span>
          </button>

          <button
            onClick={onReset}
            title="Reset Simulation State (Restart fight & reload presets)"
            className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900/80 text-rose-300 hover:text-white border border-rose-800/80 hover:border-rose-600 transition-all flex items-center gap-1 font-mono font-bold text-xs shadow-sm hover:shadow-[0_0_10px_rgba(244,63,94,0.3)] flex-shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400 flex-shrink-0" />
            <span className="hidden xs:inline sm:inline">RESET</span>
          </button>
        </div>
      </div>
    </header>
  );
};
