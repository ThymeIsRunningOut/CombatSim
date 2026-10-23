import React from 'react';
import { BehaviorNode, BehaviorState, FormationType, ComparisonOp } from '../../types/behavior';
import { Trash2, Sliders, Shield, Zap, Flame, Clock, Compass, Users, Layers, Repeat, CornerDownRight } from 'lucide-react';
import { normalizeSpeedToKnots, formatSpeedDisplay } from '../../engine/measurements';

interface NodePropertiesInspectorProps {
  node: BehaviorNode | null;
  states: BehaviorState[];
  onUpdateNode: (updatedNode: BehaviorNode) => void;
  onDeleteNode: (nodeId: string) => void;
}

export const NodePropertiesInspector: React.FC<NodePropertiesInspectorProps> = ({
  node,
  states,
  onUpdateNode,
  onDeleteNode,
}) => {
  if (!node) {
    return (
      <div className="w-72 bg-slate-950 border-l border-slate-800 p-4 flex flex-col items-center justify-center text-center text-slate-500 font-mono text-xs select-none">
        <Sliders className="w-8 h-8 mb-2 opacity-40 text-cyan-400" />
        <div className="font-bold text-slate-400">No Node Selected</div>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
          Click any behavior node on the canvas to inspect and configure its parameters.
        </p>
      </div>
    );
  }

  const updateParam = <K extends keyof BehaviorNode>(key: K, value: BehaviorNode[K]) => {
    onUpdateNode({
      ...node,
      [key]: value,
    });
  };

  const getCategoryColor = () => {
    switch (node.category) {
      case 'action':
        return 'text-blue-400 border-blue-500/40 bg-blue-950/30';
      case 'condition':
        return 'text-amber-400 border-amber-500/40 bg-amber-950/30';
      case 'flow':
        return 'text-emerald-400 border-emerald-500/40 bg-emerald-950/30';
      case 'special':
        return 'text-purple-400 border-purple-500/40 bg-purple-950/30';
    }
  };

  return (
    <div className="w-72 bg-slate-950 border-l border-slate-800 flex flex-col h-full font-mono text-xs select-none">
      {/* Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${getCategoryColor()}`}>
            {node.category}
          </span>
          <span className="text-[10px] text-slate-400">ID: {node.id.slice(-6)}</span>
        </div>
        <button
          onClick={() => onDeleteNode(node.id)}
          className="p-1 rounded hover:bg-rose-950 text-slate-500 hover:text-rose-400 transition-colors"
          title="Delete Node"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Node Form Fields */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
        {/* Node Name */}
        <div>
          <label className="text-[11px] text-slate-400 block mb-1">Node Title</label>
          <input
            type="text"
            value={node.name}
            onChange={(e) => updateParam('name', e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-100 font-bold focus:border-cyan-500 outline-none"
          />
        </div>

        {/* State Assignment */}
        <div>
          <label className="text-[11px] text-slate-400 block mb-1">Belongs to State</label>
          <select
            value={node.stateId}
            onChange={(e) => updateParam('stateId', e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-cyan-300 font-bold focus:border-cyan-500 outline-none"
          >
            {states.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Locomotion Layer Override */}
        <div>
          <label className="text-[11px] text-slate-400 block mb-1">Locomotion Layer</label>
          <select
            value={node.isFlying === undefined ? 'default' : node.isFlying ? 'flying' : 'aquatic'}
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'default') updateParam('isFlying', undefined);
              else if (val === 'flying') updateParam('isFlying', true);
              else updateParam('isFlying', false);
            }}
            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-sky-400 font-bold outline-none"
          >
            <option value="default">Default (Creature Baseline)</option>
            <option value="aquatic">🌊 Aquatic / Water Layer (Submerged / Skim)</option>
            <option value="flying">🦅 Aerial / Flight Layer (Over Deck & Mounts)</option>
          </select>
        </div>

        <div className="border-t border-slate-800 pt-3">
          <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            Parameters
          </div>

          {/* DYNAMIC FIELDS PER NODE TYPE */}
          {/* 1. APPROACH / RETREAT / RUN AWAY */}
          {(node.type === 'approach' || node.type === 'retreat' || node.type === 'run_away') && (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Speed (knots)</span>
                  <span className="text-cyan-400 font-bold">
                    {formatSpeedDisplay(node.speed ?? 12).knots} kts ({formatSpeedDisplay(node.speed ?? 12).mps} m/s)
                  </span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="60"
                  step="0.5"
                  value={normalizeSpeedToKnots(node.speed ?? 12)}
                  onChange={(e) => updateParam('speed', Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>

              {node.type !== 'run_away' && (
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Target Distance (px)</span>
                    <span className="text-cyan-400 font-bold">{node.minDistance ?? 50}px</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="600"
                    step="10"
                    value={node.minDistance ?? 50}
                    onChange={(e) => updateParam('minDistance', Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </div>
              )}
            </div>
          )}

          {/* 2. DEAL DAMAGE */}
          {node.type === 'deal_damage' && (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Strike Damage</span>
                  <span className="text-rose-400 font-bold">{node.damage ?? 120}</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="800"
                  step="10"
                  value={node.damage ?? 120}
                  onChange={(e) => updateParam('damage', Number(e.target.value))}
                  className="w-full accent-rose-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Damage Type</label>
                <select
                  value={node.damageType ?? 'Physical'}
                  onChange={(e) => updateParam('damageType', e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 outline-none"
                >
                  <option value="Physical">Physical (Hull Impact / Ram)</option>
                  <option value="Energy">Energy (Electric / Photonic)</option>
                  <option value="Chemical">Chemical (Acid Spray / Cloud)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Damage Target</label>
                <select
                  value={node.damageTarget ?? ''}
                  onChange={(e) => updateParam('damageTarget', (e.target.value || undefined) as any)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 outline-none"
                >
                  <option value="">Creature default</option>
                  <option value="buildings">Buildings</option>
                  <option value="hull">Hull</option>
                  <option value="crew">Crew</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Cooldown (sec)</span>
                  <span className="text-amber-400 font-bold">{node.cooldown ?? 2.0}s</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="8.0"
                  step="0.5"
                  value={node.cooldown ?? 2.0}
                  onChange={(e) => updateParam('cooldown', Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
              </div>
            </div>
          )}

          {/* 3. HIDE / WAIT_IDLE / FOR_SECONDS */}
          {(node.type === 'hide' || node.type === 'wait_idle' || node.type === 'for_seconds') && (
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-400">Duration (sec)</span>
                <span className="text-blue-400 font-bold">{node.duration ?? 3.0}s</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="15.0"
                step="0.5"
                value={node.duration ?? 3.0}
                onChange={(e) => updateParam('duration', Number(e.target.value))}
                className="w-full accent-blue-400"
              />
            </div>
          )}

          {/* 4. SCATTER */}
          {node.type === 'scatter' && (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Spread Radius (px)</span>
                  <span className="text-cyan-400 font-bold">{node.spreadRadius ?? 120}px</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="300"
                  step="10"
                  value={node.spreadRadius ?? 120}
                  onChange={(e) => updateParam('spreadRadius', Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Scatter Speed</span>
                  <span className="text-cyan-400 font-bold">{node.scatterSpeed ?? 220}</span>
                </div>
                <input
                  type="range"
                  min="80"
                  max="350"
                  step="10"
                  value={node.scatterSpeed ?? 220}
                  onChange={(e) => updateParam('scatterSpeed', Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="randDir"
                  checked={node.randomDirections ?? true}
                  onChange={(e) => updateParam('randomDirections', e.target.checked)}
                  className="accent-cyan-400"
                />
                <label htmlFor="randDir" className="text-[11px] text-slate-300">
                  Randomize Dispersal Angles
                </label>
              </div>
            </div>
          )}

          {/* 5. REFORM / SWARM COORDINATION */}
          {(node.type === 'reform' || node.type === 'swarm_coordination') && (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Formation Type</label>
                <select
                  value={node.formationType ?? 'wedge'}
                  onChange={(e) => updateParam('formationType', e.target.value as FormationType)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-cyan-300 font-bold outline-none"
                >
                  <option value="wedge">Wedge (V-Formation Attack)</option>
                  <option value="circle">Circle (Defensive Perimeter)</option>
                  <option value="grid">Grid (Structured Phalanx)</option>
                  <option value="line">Line (Frontal Sweep)</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Entity Spacing (px)</span>
                  <span className="text-cyan-400 font-bold">{node.spacing ?? 20}px</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="50"
                  step="2"
                  value={node.spacing ?? 20}
                  onChange={(e) => updateParam('spacing', Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>

              {node.type === 'reform' && (
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Reform Speed (knots)</span>
                    <span className="text-cyan-400 font-bold">
                      {formatSpeedDisplay(node.reformSpeed ?? 15).knots} kts ({formatSpeedDisplay(node.reformSpeed ?? 15).mps} m/s)
                    </span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="60"
                    step="0.5"
                    value={normalizeSpeedToKnots(node.reformSpeed ?? 15)}
                    onChange={(e) => updateParam('reformSpeed', Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </div>
              )}
            </div>
          )}

          {/* 6. CONDITIONS: UNTIL DEALT / RECEIVED DAMAGE */}
          {(node.type === 'until_dealt_damage' || node.type === 'until_received_damage') && (
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-400">Target Damage Threshold</span>
                <span className="text-amber-400 font-bold">{node.targetDamage ?? 200} HP</span>
              </div>
              <input
                type="range"
                min="20"
                max="1200"
                step="20"
                value={node.targetDamage ?? 200}
                onChange={(e) => updateParam('targetDamage', Number(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>
          )}

          {/* 7. UNTIL AGGRESSION */}
          {node.type === 'until_aggression' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <select
                  value={node.aggressionOp ?? '>='}
                  onChange={(e) => updateParam('aggressionOp', e.target.value as ComparisonOp)}
                  className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-amber-400 font-bold"
                >
                  <option value=">=">&gt;=</option>
                  <option value="<=">&lt;=</option>
                  <option value="==">==</option>
                </select>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={node.targetAggression ?? 60}
                  onChange={(e) => updateParam('targetAggression', Number(e.target.value))}
                  className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-amber-300 font-bold"
                />
                <span className="text-slate-400">%</span>
              </div>
            </div>
          )}

          {/* 8. HEALTH THRESHOLD */}
          {node.type === 'health_threshold' && (
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-400">HP Threshold (% remaining)</span>
                <span className="text-amber-400 font-bold">{node.healthPercent ?? 50}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="95"
                step="5"
                value={node.healthPercent ?? 50}
                onChange={(e) => updateParam('healthPercent', Number(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>
          )}

          {/* 9. DISTANCE CHECK */}
          {node.type === 'distance_check' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <select
                  value={node.distanceOp ?? '<='}
                  onChange={(e) => updateParam('distanceOp', e.target.value as ComparisonOp)}
                  className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-amber-400 font-bold"
                >
                  <option value="<=">&lt;=</option>
                  <option value=">=">&gt;=</option>
                </select>
                <input
                  type="number"
                  min="20"
                  max="800"
                  step="20"
                  value={node.distanceThreshold ?? 250}
                  onChange={(e) => updateParam('distanceThreshold', Number(e.target.value))}
                  className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-amber-300 font-bold"
                />
                <span className="text-slate-400">px</span>
              </div>
            </div>
          )}

          {/* 10. REPEAT */}
          {node.type === 'repeat' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id="infiniteLoop"
                  checked={node.isInfiniteRepeat ?? true}
                  onChange={(e) => updateParam('isInfiniteRepeat', e.target.checked)}
                  className="accent-emerald-400"
                />
                <label htmlFor="infiniteLoop" className="text-[11px] text-slate-300 font-bold">
                  Infinite Loop
                </label>
              </div>

              {!node.isInfiniteRepeat && (
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Iterations Count</span>
                    <span className="text-emerald-400 font-bold">{node.repeatCount ?? 3}x</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="15"
                    step="1"
                    value={node.repeatCount ?? 3}
                    onChange={(e) => updateParam('repeatCount', Number(e.target.value))}
                    className="w-full accent-emerald-400"
                  />
                </div>
              )}
            </div>
          )}

          {/* 11. STATE TRANSITION */}
          {node.type === 'state_transition' && (
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Jump to State</label>
              <select
                value={node.targetStateName ?? (states[0]?.name || '')}
                onChange={(e) => updateParam('targetStateName', e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-emerald-400 font-bold outline-none"
              >
                {states.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* BRANCH SWITCH (PROBABILITY OR AGGRO) */}
          {node.type === 'branch_switch' && (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">True Branch Chance (Probability)</span>
                  <span className="text-emerald-400 font-bold">{Math.round((node.chance ?? 0.7) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={Math.round((node.chance ?? 0.7) * 100)}
                  onChange={(e) => updateParam('chance', Number(e.target.value) / 100)}
                  className="w-full accent-emerald-400"
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Rolls True branch with {Math.round((node.chance ?? 0.7) * 100)}% probability, False branch with {100 - Math.round((node.chance ?? 0.7) * 100)}%.
                </span>
              </div>
            </div>
          )}

          {/* 12. BOIDS FLOCK */}
          {node.type === 'boids_flock' && (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Flock Speed (knots)</span>
                  <span className="text-cyan-400 font-bold">
                    {formatSpeedDisplay(node.speed ?? 15).knots} kts ({formatSpeedDisplay(node.speed ?? 15).mps} m/s)
                  </span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="60"
                  step="0.5"
                  value={normalizeSpeedToKnots(node.speed ?? 15)}
                  onChange={(e) => updateParam('speed', Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Flock Separation Dist</span>
                  <span className="text-cyan-400 font-bold">{node.flockSeparationDist ?? 24}px</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="80"
                  step="2"
                  value={node.flockSeparationDist ?? 24}
                  onChange={(e) => updateParam('flockSeparationDist', Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Cruise Duration</span>
                  <span className="text-cyan-400 font-bold">{node.duration ?? 3.5}s</span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="15.0"
                  step="0.5"
                  value={node.duration ?? 3.5}
                  onChange={(e) => updateParam('duration', Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>
            </div>
          )}

          {/* FLOCK DISSIPATE & REGROUP */}
          {node.type === 'flock_dissipate_regroup' && (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Panic Scatter Speed</span>
                  <span className="text-cyan-400 font-bold">{node.scatterSpeed ?? 180} kts</span>
                </div>
                <input
                  type="range"
                  min="80"
                  max="350"
                  step="10"
                  value={node.scatterSpeed ?? 180}
                  onChange={(e) => updateParam('scatterSpeed', Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Dissipate Duration</span>
                  <span className="text-cyan-400 font-bold">{node.dissipateDuration ?? 0.8}s</span>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="3.0"
                  step="0.1"
                  value={node.dissipateDuration ?? 0.8}
                  onChange={(e) => updateParam('dissipateDuration', Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Controls burst duration and tether distance (kept within 210px-330px)
                </span>
              </div>

              <div className="pt-2 border-t border-slate-700/60">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={node.formSquadsBeforeRegroup !== false}
                    onChange={(e) => updateParam('formSquadsBeforeRegroup', e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <span className="text-[11px] font-semibold text-slate-200">Form Squads Before Regrouping</span>
                </label>
                <span className="text-[10px] text-slate-500 block mt-0.5 pl-5">
                  Splits scattered bats into squads that assault Behemoth structures before reforming
                </span>
              </div>

              {node.formSquadsBeforeRegroup !== false && (
                <div className="pl-3 border-l-2 border-cyan-500/40 space-y-3">
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-400">Squad Assault Duration</span>
                      <span className="text-cyan-400 font-bold">{node.squadAssaultDuration ?? 2.2}s</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="6.0"
                      step="0.1"
                      value={node.squadAssaultDuration ?? 2.2}
                      onChange={(e) => updateParam('squadAssaultDuration', Number(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-slate-400">Min Squad</span>
                        <span className="text-cyan-400 font-bold">{node.groupMinSize ?? 3}</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="8"
                        step="1"
                        value={node.groupMinSize ?? 3}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          updateParam('groupMinSize', val);
                          if ((node.groupMaxSize ?? 5) < val) {
                            updateParam('groupMaxSize', val);
                          }
                        }}
                        className="w-full accent-cyan-400"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-slate-400">Max Squad</span>
                        <span className="text-cyan-400 font-bold">{node.groupMaxSize ?? 5}</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="12"
                        step="1"
                        value={node.groupMaxSize ?? 5}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          updateParam('groupMaxSize', val);
                          if ((node.groupMinSize ?? 3) > val) {
                            updateParam('groupMinSize', val);
                          }
                        }}
                        className="w-full accent-cyan-400"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-400">Crew Strike Bias</span>
                      <span className="text-cyan-400 font-bold">{Math.round((node.crewAttackChance ?? 0.60) * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={node.crewAttackChance ?? 0.60}
                      onChange={(e) => updateParam('crewAttackChance', Number(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>
                </div>
              )}

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Regroup Duration</span>
                  <span className="text-cyan-400 font-bold">{node.regroupDuration ?? 2.2}s</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="6.0"
                  step="0.1"
                  value={node.regroupDuration ?? 2.2}
                  onChange={(e) => updateParam('regroupDuration', Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Reaction Cooldown</span>
                  <span className="text-amber-400 font-bold">{node.reactionCooldown ?? 2.0}s</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="6.0"
                  step="0.25"
                  value={node.reactionCooldown ?? 2.0}
                  onChange={(e) => updateParam('reactionCooldown', Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Prevents perpetual panic lock against Gatling/Photon rapid fire
                </span>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Regroup Sector Offset</span>
                  <span className="text-cyan-400 font-bold">{node.regroupAngleOffset ?? 150}°</span>
                </div>
                <input
                  type="range"
                  min="90"
                  max="210"
                  step="5"
                  value={node.regroupAngleOffset ?? 150}
                  onChange={(e) => updateParam('regroupAngleOffset', Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Regroups on the opposite side of Behemoth (120°-180° away from turrets)
                </span>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Cruising Speed</span>
                  <span className="text-cyan-400 font-bold">{node.speed ?? 200} kts</span>
                </div>
                <input
                  type="range"
                  min="80"
                  max="350"
                  step="10"
                  value={node.speed ?? 200}
                  onChange={(e) => updateParam('speed', Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>
            </div>
          )}

          {/* BARREL ROLL / EVASIVE JINK */}
          {node.type === 'barrel_roll' && (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Burst Jink Speed</span>
                  <span className="text-cyan-400 font-bold">{node.speed ?? 580} kts</span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="850"
                  step="10"
                  value={node.speed ?? 580}
                  onChange={(e) => updateParam('speed', Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Roll Duration</span>
                  <span className="text-cyan-400 font-bold">{node.duration ?? 0.7}s</span>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="2.5"
                  step="0.1"
                  value={node.duration ?? 0.7}
                  onChange={(e) => updateParam('duration', Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>
            </div>
          )}

          {/* 13. SPLIT SWARM GROUPS */}
          {node.type === 'split_swarm_groups' && (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Min Squad Size</span>
                  <span className="text-orange-400 font-bold">{node.groupMinSize ?? 3}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="12"
                  step="1"
                  value={node.groupMinSize ?? 3}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    updateParam('groupMinSize', val);
                    if ((node.groupMaxSize ?? 5) < val) {
                      updateParam('groupMaxSize', val);
                    }
                  }}
                  className="w-full accent-orange-400"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Max Squad Size</span>
                  <span className="text-orange-400 font-bold">{node.groupMaxSize ?? 5}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="12"
                  step="1"
                  value={node.groupMaxSize ?? 5}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    updateParam('groupMaxSize', val);
                    if ((node.groupMinSize ?? 3) > val) {
                      updateParam('groupMinSize', val);
                    }
                  }}
                  className="w-full accent-orange-400"
                />
              </div>
            </div>
          )}

          {/* 14. GROUP APPROACH BUILDING & RETURN TO SWARM */}
          {(node.type === 'group_approach_building' || node.type === 'return_to_swarm') && (
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-400">Flight Speed (knots)</span>
                <span className="text-cyan-400 font-bold">
                  {formatSpeedDisplay(node.speed ?? 18).knots} kts ({formatSpeedDisplay(node.speed ?? 18).mps} m/s)
                </span>
              </div>
              <input
                type="range"
                min="2"
                max="60"
                step="0.5"
                value={normalizeSpeedToKnots(node.speed ?? 18)}
                onChange={(e) => updateParam('speed', Number(e.target.value))}
                className="w-full accent-cyan-400"
              />
            </div>
          )}

          {/* 15. GROUP STRIKE TARGET */}
          {node.type === 'group_strike_target' && (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Crew Member Attack Bias</span>
                  <span className="text-amber-400 font-bold">{Math.round((node.crewAttackChance ?? 0.6) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={Math.round((node.crewAttackChance ?? 0.6) * 100)}
                  onChange={(e) => updateParam('crewAttackChance', Number(e.target.value) / 100)}
                  className="w-full accent-amber-400"
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Remaining {100 - Math.round((node.crewAttackChance ?? 0.6) * 100)}% targets building structure
                </span>
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Damage Per Entity</span>
                  <span className="text-rose-400 font-bold">{node.damage ?? 15} HP</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="80"
                  step="5"
                  value={node.damage ?? 15}
                  onChange={(e) => updateParam('damage', Number(e.target.value))}
                  className="w-full accent-rose-400"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Harassment Duration</span>
                  <span className="text-cyan-400 font-bold">{node.duration ?? 2.5}s</span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="8.0"
                  step="0.5"
                  value={node.duration ?? 2.5}
                  onChange={(e) => updateParam('duration', Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>
            </div>
          )}

          {/* 16. CHARGE ORBIT */}
          {node.type === 'charge_orbit' && (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Orbit Direction</label>
                <select
                  value={node.orbitDirection ?? 'counter_clockwise'}
                  onChange={(e) => updateParam('orbitDirection', e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-cyan-300 font-bold outline-none"
                >
                  <option value="counter_clockwise">Counter-Clockwise (CCW)</option>
                  <option value="clockwise">Clockwise (CW)</option>
                  <option value="random">Random (CW or CCW per approach)</option>
                </select>
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Total Stage Duration</span>
                  <span className="text-cyan-400 font-bold">{node.stageDuration ?? 18}s</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="45"
                  step="1"
                  value={node.stageDuration ?? 18}
                  onChange={(e) => updateParam('stageDuration', Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Depths Duration (Interval)</span>
                  <span className="text-sky-400 font-bold">{node.depthsInterval ?? 3}s</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={node.depthsInterval ?? 3}
                  onChange={(e) => updateParam('depthsInterval', Number(e.target.value))}
                  className="w-full accent-sky-400"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Surface Duration (Targetable)</span>
                  <span className="text-sky-400 font-bold">{node.surfaceInterval ?? 3}s</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={node.surfaceInterval ?? 3}
                  onChange={(e) => updateParam('surfaceInterval', Number(e.target.value))}
                  className="w-full accent-sky-400"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Orbit Radius (px)</span>
                  <span className="text-cyan-400 font-bold">{node.orbitRadius ?? 260}px</span>
                </div>
                <input
                  type="range"
                  min="150"
                  max="450"
                  step="10"
                  value={node.orbitRadius ?? 260}
                  onChange={(e) => updateParam('orbitRadius', Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>
            </div>
          )}

          {/* 17. SHORT CIRCUIT DRAIN */}
          {node.type === 'short_circuit_drain' && (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Attack Stage Duration</span>
                  <span className="text-purple-400 font-bold">{node.duration ?? 10}s</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="25"
                  step="1"
                  value={node.duration ?? 10}
                  onChange={(e) => updateParam('duration', Number(e.target.value))}
                  className="w-full accent-purple-400"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Simultaneous Target Count</span>
                  <span className="text-purple-400 font-bold">{node.drainTargetCount ?? 4} buildings</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="8"
                  step="1"
                  value={node.drainTargetCount ?? 4}
                  onChange={(e) => updateParam('drainTargetCount', Number(e.target.value))}
                  className="w-full accent-purple-400"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Drain Rate (% HP / sec)</span>
                  <span className="text-purple-400 font-bold">{node.drainRatePct ?? 4}% / s</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="15"
                  step="1"
                  value={node.drainRatePct ?? 4}
                  onChange={(e) => updateParam('drainRatePct', Number(e.target.value))}
                  className="w-full accent-purple-400"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Stun Chance / Second</span>
                  <span className="text-amber-400 font-bold">{Math.round((node.stunChance ?? 0.10) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="5"
                  value={Math.round((node.stunChance ?? 0.10) * 100)}
                  onChange={(e) => updateParam('stunChance', Number(e.target.value) / 100)}
                  className="w-full accent-amber-400"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Stun Duration</span>
                  <span className="text-amber-400 font-bold">{node.stunDuration ?? 10}s</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="20"
                  step="1"
                  value={node.stunDuration ?? 10}
                  onChange={(e) => updateParam('stunDuration', Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Energy Weight Divisor</span>
                  <span className="text-purple-400 font-bold">{node.energyWeightDivisor ?? 4}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={node.energyWeightDivisor ?? 4}
                  onChange={(e) => updateParam('energyWeightDivisor', Number(e.target.value))}
                  className="w-full accent-purple-400"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
