import React, { useState } from 'react';
import { NodeCategory, BehaviorNodeType } from '../../types/behavior';
import {
  Zap,
  Target,
  Shield,
  Activity,
  ArrowRight,
  Repeat,
  GitBranch,
  Radio,
  EyeOff,
  Clock,
  Compass,
  Users,
  Layers,
  ChevronDown,
  ChevronRight,
  Search,
  Move,
  Flame,
  CornerDownRight,
  Sparkles,
  RotateCcw,
} from 'lucide-react';

interface PaletteItem {
  type: BehaviorNodeType;
  category: NodeCategory;
  name: string;
  description: string;
  icon: React.ReactNode;
}

const PALETTE_ITEMS: PaletteItem[] = [
  // ACTION NODES (BLUE)
  {
    type: 'approach',
    category: 'action',
    name: 'Approach',
    description: 'Move toward Behemoth with speed & distance settings',
    icon: <Move className="w-4 h-4 text-blue-400" />,
  },
  {
    type: 'deal_damage',
    category: 'action',
    name: 'Deal Damage',
    description: 'Execute attack strike with damage, type & cooldown',
    icon: <Flame className="w-4 h-4 text-blue-400" />,
  },
  {
    type: 'retreat',
    category: 'action',
    name: 'Retreat',
    description: 'Tactical backward disengage to safe distance',
    icon: <Compass className="w-4 h-4 text-blue-400" />,
  },
  {
    type: 'run_away',
    category: 'action',
    name: 'Run Away',
    description: 'Full escape acceleration beyond aggro radius',
    icon: <ArrowRight className="w-4 h-4 text-blue-400" />,
  },
  {
    type: 'hide',
    category: 'action',
    name: 'Hide',
    description: 'Submerges underwater; hitbox dampened for duration',
    icon: <EyeOff className="w-4 h-4 text-blue-400" />,
  },
  {
    type: 'wait_idle',
    category: 'action',
    name: 'Wait / Idle',
    description: 'Pause behavior and hold position for time duration',
    icon: <Clock className="w-4 h-4 text-blue-400" />,
  },
  {
    type: 'scatter',
    category: 'action',
    name: 'Scatter',
    description: 'Swarm dispersal into evasive randomized directions',
    icon: <Sparkles className="w-4 h-4 text-blue-400" />,
  },
  {
    type: 'reform',
    category: 'action',
    name: 'Reform',
    description: 'Return swarm to formation (Wedge / Circle / Grid / Line)',
    icon: <Users className="w-4 h-4 text-blue-400" />,
  },
  {
    type: 'boids_flock',
    category: 'action',
    name: 'Boids Flocking',
    description: 'Autonomous flocking with separation, alignment and cohesion',
    icon: <Users className="w-4 h-4 text-blue-400" />,
  },
  {
    type: 'split_swarm_groups',
    category: 'action',
    name: 'Split Swarm Groups',
    description: 'Partition swarm into autonomous attack squads (e.g. 3-5)',
    icon: <Sparkles className="w-4 h-4 text-blue-400" />,
  },
  {
    type: 'group_approach_building',
    category: 'action',
    name: 'Group Approach Building',
    description: 'Squad moves toward targeted Behemoth building slot',
    icon: <Move className="w-4 h-4 text-blue-400" />,
  },
  {
    type: 'group_strike_target',
    category: 'action',
    name: 'Group Strike Target',
    description: 'Attack building structure or assigned crew (configurable crew bias)',
    icon: <Flame className="w-4 h-4 text-blue-400" />,
  },
  {
    type: 'return_to_swarm',
    category: 'action',
    name: 'Return to Swarm',
    description: 'Squad retreats and rejoins the primary swarm flock',
    icon: <Compass className="w-4 h-4 text-blue-400" />,
  },
  {
    type: 'charge_orbit',
    category: 'action',
    name: 'Charge Orbit',
    description: 'Counter-clockwise or clockwise orbit alternating depths & surface',
    icon: <Repeat className="w-4 h-4 text-blue-400" />,
  },
  {
    type: 'short_circuit_drain',
    category: 'action',
    name: 'Short Circuit Drain',
    description: 'Under-deck hull contact draining active buildings & systems with stun',
    icon: <Zap className="w-4 h-4 text-blue-400" />,
  },
  {
    type: 'flock_dissipate_regroup',
    category: 'action',
    name: 'Flock Dissipate & Regroup',
    description: 'Scatters swarm away from weapon impact, then regroups in opposite orbital sector',
    icon: <Sparkles className="w-4 h-4 text-cyan-400" />,
  },
  {
    type: 'barrel_roll',
    category: 'action',
    name: 'Barrel Roll / Evasive Jink',
    description: 'High-speed tangential spin maneuver evading incoming fire with directional deviation',
    icon: <RotateCcw className="w-4 h-4 text-blue-400" />,
  },

  // CONDITION NODES (YELLOW)
  {
    type: 'until_dealt_damage',
    category: 'condition',
    name: 'Until Dealt Damage',
    description: 'Continue until damage threshold dealt to vessel',
    icon: <Target className="w-4 h-4 text-amber-400" />,
  },
  {
    type: 'until_received_damage',
    category: 'condition',
    name: 'Until Received Damage',
    description: 'Continue until threshold taken from weapons',
    icon: <Shield className="w-4 h-4 text-amber-400" />,
  },
  {
    type: 'until_aggression',
    category: 'condition',
    name: 'Until Aggression = X',
    description: 'Check aggression state machine meter (0-100%)',
    icon: <Zap className="w-4 h-4 text-amber-400" />,
  },
  {
    type: 'for_seconds',
    category: 'condition',
    name: 'For [X] Seconds',
    description: 'Time-based duration window condition',
    icon: <Clock className="w-4 h-4 text-amber-400" />,
  },
  {
    type: 'once',
    category: 'condition',
    name: 'Once',
    description: 'Single-execution flag trigger',
    icon: <Radio className="w-4 h-4 text-amber-400" />,
  },
  {
    type: 'health_threshold',
    category: 'condition',
    name: 'Health Threshold',
    description: 'Check creature HP percentage (e.g. <= 50%)',
    icon: <Activity className="w-4 h-4 text-amber-400" />,
  },
  {
    type: 'distance_check',
    category: 'condition',
    name: 'Distance Check',
    description: 'Proximity distance check to Behemoth',
    icon: <Compass className="w-4 h-4 text-amber-400" />,
  },
  {
    type: 'swarm_size',
    category: 'condition',
    name: 'Swarm Size',
    description: 'Check number of surviving swarm entities',
    icon: <Users className="w-4 h-4 text-amber-400" />,
  },
  {
    type: 'formation_integrity',
    category: 'condition',
    name: 'Formation Integrity',
    description: 'Percentage of swarm aligned in formation',
    icon: <Layers className="w-4 h-4 text-amber-400" />,
  },

  // FLOW CONTROL NODES (GREEN)
  {
    type: 'repeat',
    category: 'flow',
    name: 'Repeat Loop',
    description: 'Loop behavior sequence (infinite or fixed count)',
    icon: <Repeat className="w-4 h-4 text-emerald-400" />,
  },
  {
    type: 'branch_switch',
    category: 'flow',
    name: 'Branch / Switch',
    description: 'Conditional routing (Aggression / Range branches)',
    icon: <GitBranch className="w-4 h-4 text-emerald-400" />,
  },
  {
    type: 'state_transition',
    category: 'flow',
    name: 'State Transition',
    description: 'Jump to named behavior state (e.g. Enraged Phase)',
    icon: <CornerDownRight className="w-4 h-4 text-emerald-400" />,
  },
  {
    type: 'parallel_execute',
    category: 'flow',
    name: 'Parallel Execute',
    description: 'Run multiple behaviors simultaneously',
    icon: <Layers className="w-4 h-4 text-emerald-400" />,
  },

  // SPECIAL NODES (PURPLE)
  {
    type: 'swarm_coordination',
    category: 'special',
    name: 'Swarm Coordination',
    description: 'Synchronized group behavior & formation lock',
    icon: <Users className="w-4 h-4 text-purple-400" />,
  },
  {
    type: 'phase_trigger',
    category: 'special',
    name: 'Phase Trigger',
    description: 'Boss-style phase transition trigger',
    icon: <Sparkles className="w-4 h-4 text-purple-400" />,
  },
  {
    type: 'event_listener',
    category: 'special',
    name: 'Event Listener',
    description: 'React to external combat triggers (ram / stun)',
    icon: <Radio className="w-4 h-4 text-purple-400" />,
  },
];

interface NodePaletteProps {
  onAddNode: (type: BehaviorNodeType, category: NodeCategory, name: string) => void;
}

export const NodePalette: React.FC<NodePaletteProps> = ({ onAddNode }) => {
  const [search, setSearch] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<NodeCategory, boolean>>({
    action: false,
    condition: false,
    flow: false,
    special: false,
  });

  const toggleCategory = (cat: NodeCategory) => {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const categories: Array<{ id: NodeCategory; name: string; color: string; badge: string }> = [
    { id: 'action', name: 'Action Nodes', color: 'border-blue-500/50 text-blue-400', badge: 'bg-blue-950/60 text-blue-300' },
    { id: 'condition', name: 'Condition Nodes', color: 'border-amber-500/50 text-amber-400', badge: 'bg-amber-950/60 text-amber-300' },
    { id: 'flow', name: 'Flow Control', color: 'border-emerald-500/50 text-emerald-400', badge: 'bg-emerald-950/60 text-emerald-300' },
    { id: 'special', name: 'Special Nodes', color: 'border-purple-500/50 text-purple-400', badge: 'bg-purple-950/60 text-purple-300' },
  ];

  const filteredItems = PALETTE_ITEMS.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col h-full select-none">
      {/* Header */}
      <div className="p-3 border-b border-slate-800">
        <div className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider mb-2 flex items-center justify-between">
          <span>Node Palette</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
            Scratch AI
          </span>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search nodes..."
            className="w-full bg-slate-900 border border-slate-800 rounded-md pl-8 pr-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-cyan-500 font-mono"
          />
        </div>
      </div>

      {/* Nodes List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar">
        {categories.map((cat) => {
          const items = filteredItems.filter((i) => i.category === cat.id);
          if (items.length === 0) return null;
          const isCollapsed = collapsedCategories[cat.id];

          return (
            <div key={cat.id} className="rounded-lg border border-slate-800/80 bg-slate-900/40 overflow-hidden">
              <button
                onClick={() => toggleCategory(cat.id)}
                className="w-full px-2.5 py-2 flex items-center justify-between bg-slate-900/80 hover:bg-slate-800/60 text-xs font-mono font-bold transition-colors"
              >
                <span className={`flex items-center gap-1.5 ${cat.color}`}>
                  {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {cat.name}
                </span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${cat.badge}`}>
                  {items.length}
                </span>
              </button>

              {!isCollapsed && (
                <div className="p-1.5 space-y-1.5">
                  {items.map((item) => (
                    <div
                      key={item.type}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/combat-node-type', item.type);
                        e.dataTransfer.setData('application/combat-node-category', item.category);
                        e.dataTransfer.setData('application/combat-node-name', item.name);
                      }}
                      onClick={() => onAddNode(item.type, item.category, item.name)}
                      className={`p-2 rounded-md border bg-slate-950/80 hover:bg-slate-800/80 cursor-pointer transition-all flex items-start gap-2 shadow-sm group ${
                        item.category === 'action'
                          ? 'border-blue-900/60 hover:border-blue-500 hover:shadow-blue-500/10'
                          : item.category === 'condition'
                          ? 'border-amber-900/60 hover:border-amber-500 hover:shadow-amber-500/10'
                          : item.category === 'flow'
                          ? 'border-emerald-900/60 hover:border-emerald-500 hover:shadow-emerald-500/10'
                          : 'border-purple-900/60 hover:border-purple-500 hover:shadow-purple-500/10'
                      }`}
                      title="Click or drag onto canvas to spawn"
                    >
                      <div className="p-1 rounded bg-slate-900 flex-shrink-0 mt-0.5">{item.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold font-mono text-slate-200 group-hover:text-cyan-300 truncate">
                          {item.name}
                        </div>
                        <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5 leading-tight">
                          {item.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tip footer */}
      <div className="p-2 border-t border-slate-800 text-[10px] text-slate-400 font-mono text-center bg-slate-950/90">
        💡 Click or drag nodes to canvas
      </div>
    </div>
  );
};
