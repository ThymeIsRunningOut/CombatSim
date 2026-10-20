import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  CreatureBehaviorTree,
  BehaviorNode,
  BehaviorConnection,
  BehaviorState,
  BehaviorRuntimeState,
  NodeCategory,
  BehaviorNodeType,
} from '../../types/behavior';
import { CreatureDef, WeaponDef, CreatureRuntimeInstance } from '../../types/combat';
import { SimulationEngine } from '../../engine/simulation';
import { DEFAULT_BEHAVIOR_TEMPLATES } from '../../data/behaviorTemplates';
import { NodePalette } from './NodePalette';
import { NodeCanvas } from './NodeCanvas';
import { NodePropertiesInspector } from './NodePropertiesInspector';
import { BehaviorLivePreview } from './BehaviorLivePreview';
import { SimulationControlBar } from './SimulationControlBar';
import {
  FolderDown,
  FolderUp,
  RotateCcw,
  Undo2,
  Redo2,
  Plus,
  Layers,
  Sparkles,
  Sliders,
  Activity,
  CheckCircle,
  AlertTriangle,
  Copy,
} from 'lucide-react';

const BEHAVIOR_STORAGE_KEY = 'behemoth_sim_custom_behavior_trees_v7';

interface BehaviorEditorProps {
  engine: SimulationEngine;
  creatures: CreatureDef[];
  weapons: WeaponDef[];
  onSpawnCreature: (creatureId: string) => void;
  onCloneCreature?: (sourceCreatureId: string) => void;
}

export const BehaviorEditor: React.FC<BehaviorEditorProps> = ({
  engine,
  creatures,
  weapons,
  onSpawnCreature,
  onCloneCreature,
}) => {
  // Selected Creature definition
  const [selectedCreatureDefId, setSelectedCreatureDefId] = useState<string>(() => {
    return creatures[0]?.id || 'dreadlot';
  });

  // Load saved behavior trees or fallback to DEFAULT_BEHAVIOR_TEMPLATES
  const [behaviorTrees, setBehaviorTrees] = useState<Record<string, CreatureBehaviorTree>>(() => {
    try {
      const saved = localStorage.getItem(BEHAVIOR_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return { ...DEFAULT_BEHAVIOR_TEMPLATES, ...parsed };
        }
      }
    } catch (e) {
      console.warn('Failed to load saved behavior trees:', e);
    }
    return DEFAULT_BEHAVIOR_TEMPLATES;
  });

  // Undo / Redo history for currently edited creature tree
  const [history, setHistory] = useState<CreatureBehaviorTree[]>([]);
  const [future, setFuture] = useState<CreatureBehaviorTree[]>([]);

  // Selected node ID on canvas
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Active state tab filter
  const [activeStateFilter, setActiveStateFilter] = useState<string | 'all'>('all');

  // Right side panel view mode ('inspector' | 'telemetry')
  const [rightPanelTab, setRightPanelTab] = useState<'inspector' | 'telemetry'>('inspector');

  // Simulation controls state
  const [isSimRunning, setIsSimRunning] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(1.0);
  const [notification, setNotification] = useState<string | null>(null);

  // Current active tree
  const activeTree: CreatureBehaviorTree = useMemo(() => {
    if (behaviorTrees[selectedCreatureDefId]) {
      return behaviorTrees[selectedCreatureDefId];
    }
    // Fallback template or create default
    const def = creatures.find((c) => c.id === selectedCreatureDefId);
    return {
      id: `tree_${selectedCreatureDefId}`,
      creatureDefId: selectedCreatureDefId,
      name: `${def?.name || selectedCreatureDefId} Behavior`,
      description: 'Custom AI behavior pipeline.',
      states: [
        { id: 'state_default', name: 'Primary Combat Phase', isInitial: true, priority: 1, color: '#38bdf8' },
      ],
      nodes: [
        {
          id: `node_entry_${Date.now()}`,
          type: 'approach',
          category: 'action',
          name: 'Approach Vessel',
          x: 120,
          y: 100,
          stateId: 'state_default',
          speed: 150,
          minDistance: 50,
        },
      ],
      connections: [],
    };
  }, [behaviorTrees, selectedCreatureDefId, creatures]);

  // Synchronize engine behavior trees whenever activeTree changes
  useEffect(() => {
    engine.behaviorTrees.set(activeTree.creatureDefId, activeTree);
  }, [activeTree, engine]);

  // Save to localStorage whenever trees change
  const saveTreesToStorage = (updatedTrees: Record<string, CreatureBehaviorTree>) => {
    try {
      localStorage.setItem(BEHAVIOR_STORAGE_KEY, JSON.stringify(updatedTrees));
    } catch (e) {
      console.error('Failed to save behavior trees to localStorage:', e);
    }
  };

  // Helper to commit tree update with undo history
  const updateActiveTree = (newTree: CreatureBehaviorTree) => {
    setHistory((prev) => [...prev.slice(-25), activeTree]);
    setFuture([]);
    const updated = { ...behaviorTrees, [selectedCreatureDefId]: newTree };
    setBehaviorTrees(updated);
    saveTreesToStorage(updated);
  };

  // Undo / Redo
  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory((prev) => prev.slice(0, prev.length - 1));
    setFuture((prev) => [activeTree, ...prev]);
    const updated = { ...behaviorTrees, [selectedCreatureDefId]: previous };
    setBehaviorTrees(updated);
    saveTreesToStorage(updated);
  };

  const handleRedo = () => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((prev) => prev.slice(1));
    setHistory((prev) => [...prev, activeTree]);
    const updated = { ...behaviorTrees, [selectedCreatureDefId]: next };
    setBehaviorTrees(updated);
    saveTreesToStorage(updated);
  };

  // Node operations
  const handleAddNode = (
    type: BehaviorNodeType,
    category: NodeCategory,
    name: string,
    x?: number,
    y?: number
  ) => {
    const currentStateId =
      activeStateFilter !== 'all'
        ? activeStateFilter
        : activeTree.states[0]?.id || 'state_default';

    const newNode: BehaviorNode = {
      id: `node_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type,
      category,
      name,
      x: x !== undefined ? x : 160 + (activeTree.nodes.length % 5) * 40,
      y: y !== undefined ? y : 120 + (activeTree.nodes.length % 5) * 40,
      stateId: currentStateId,
    };

    // Auto-fill sensible default parameters per type
    if (type === 'approach' || type === 'retreat') {
      newNode.speed = 150;
      newNode.minDistance = type === 'approach' ? 50 : 350;
    } else if (type === 'deal_damage') {
      newNode.damage = 120;
      newNode.damageType = 'Physical';
      newNode.cooldown = 2.0;
    } else if (type === 'hide' || type === 'wait_idle' || type === 'for_seconds') {
      newNode.duration = 3.0;
    } else if (type === 'scatter') {
      newNode.spreadRadius = 120;
      newNode.scatterSpeed = 220;
      newNode.randomDirections = true;
    } else if (type === 'reform') {
      newNode.formationType = 'wedge';
      newNode.spacing = 20;
      newNode.reformSpeed = 180;
    } else if (type === 'health_threshold') {
      newNode.healthPercent = 50;
      newNode.healthOp = '<=';
    } else if (type === 'distance_check') {
      newNode.distanceThreshold = 250;
      newNode.distanceOp = '<=';
    } else if (type === 'repeat') {
      newNode.isInfiniteRepeat = true;
      newNode.repeatCount = 3;
    }

    const updatedTree: CreatureBehaviorTree = {
      ...activeTree,
      nodes: [...activeTree.nodes, newNode],
    };

    updateActiveTree(updatedTree);
    setSelectedNodeId(newNode.id);
    setRightPanelTab('inspector');
  };

  const handleUpdateNodePosition = (nodeId: string, x: number, y: number) => {
    const updatedTree: CreatureBehaviorTree = {
      ...activeTree,
      nodes: activeTree.nodes.map((n) => (n.id === nodeId ? { ...n, x, y } : n)),
    };
    const updated = { ...behaviorTrees, [selectedCreatureDefId]: updatedTree };
    setBehaviorTrees(updated);
    saveTreesToStorage(updated);
  };

  const handleUpdateNode = (updatedNode: BehaviorNode) => {
    const updatedTree: CreatureBehaviorTree = {
      ...activeTree,
      nodes: activeTree.nodes.map((n) => (n.id === updatedNode.id ? updatedNode : n)),
    };
    updateActiveTree(updatedTree);
  };

  const handleDeleteNode = (nodeId: string) => {
    const updatedTree: CreatureBehaviorTree = {
      ...activeTree,
      nodes: activeTree.nodes.filter((n) => n.id !== nodeId),
      connections: activeTree.connections.filter(
        (c) => c.sourceNodeId !== nodeId && c.targetNodeId !== nodeId
      ),
    };
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
    updateActiveTree(updatedTree);
  };

  const handleToggleCollapse = (nodeId: string) => {
    const updatedTree: CreatureBehaviorTree = {
      ...activeTree,
      nodes: activeTree.nodes.map((n) =>
        n.id === nodeId ? { ...n, isCollapsed: !n.isCollapsed } : n
      ),
    };
    updateActiveTree(updatedTree);
  };

  // Wire connections
  const handleConnectNodes = (
    sourceNodeId: string,
    sourceHandle: 'next' | 'true' | 'false' | 'parallel',
    targetNodeId: string
  ) => {
    // Avoid self-connecting loop or redundant connection
    if (sourceNodeId === targetNodeId) return;

    const newConnection: BehaviorConnection = {
      id: `conn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sourceNodeId,
      sourceHandle,
      targetNodeId,
    };

    // Remove existing connection on same sourceHandle
    const filteredConns = activeTree.connections.filter(
      (c) => !(c.sourceNodeId === sourceNodeId && c.sourceHandle === sourceHandle)
    );

    // Also update source node's reference fields
    const updatedNodes = activeTree.nodes.map((n) => {
      if (n.id === sourceNodeId) {
        if (sourceHandle === 'next') return { ...n, nextNodeId: targetNodeId };
        if (sourceHandle === 'true') return { ...n, trueNodeId: targetNodeId };
        if (sourceHandle === 'false') return { ...n, falseNodeId: targetNodeId };
      }
      return n;
    });

    const updatedTree: CreatureBehaviorTree = {
      ...activeTree,
      nodes: updatedNodes,
      connections: [...filteredConns, newConnection],
    };

    updateActiveTree(updatedTree);
  };

  const handleDeleteConnection = (connectionId: string) => {
    const conn = activeTree.connections.find((c) => c.id === connectionId);
    if (!conn) return;

    const updatedNodes = activeTree.nodes.map((n) => {
      if (n.id === conn.sourceNodeId) {
        if (conn.sourceHandle === 'next') return { ...n, nextNodeId: null };
        if (conn.sourceHandle === 'true') return { ...n, trueNodeId: null };
        if (conn.sourceHandle === 'false') return { ...n, falseNodeId: null };
      }
      return n;
    });

    const updatedTree: CreatureBehaviorTree = {
      ...activeTree,
      nodes: updatedNodes,
      connections: activeTree.connections.filter((c) => c.id !== connectionId),
    };

    updateActiveTree(updatedTree);
  };

  // State Management (Add / Delete / Set Initial)
  const handleAddState = () => {
    const stateName = prompt('Enter name for new behavior state (e.g. Enraged Berserk Phase):');
    if (!stateName || !stateName.trim()) return;

    const newState: BehaviorState = {
      id: `state_${Date.now()}`,
      name: stateName.trim(),
      priority: activeTree.states.length + 1,
      color: '#ec4899',
    };

    const updatedTree: CreatureBehaviorTree = {
      ...activeTree,
      states: [...activeTree.states, newState],
    };

    updateActiveTree(updatedTree);
    setActiveStateFilter(newState.id);
  };

  // Template Loader
  const handleLoadTemplate = (templateKey: string) => {
    const template = DEFAULT_BEHAVIOR_TEMPLATES[templateKey];
    if (!template) return;

    if (confirm(`Load preset template: "${template.name}"? This will overwrite the current tree.`)) {
      const cloned: CreatureBehaviorTree = JSON.parse(JSON.stringify(template));
      cloned.creatureDefId = selectedCreatureDefId;
      updateActiveTree(cloned);
      setNotification(`Loaded "${template.name}" template`);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  // JSON Export / Import
  const handleExportJSON = () => {
    const jsonStr = JSON.stringify(activeTree, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTree.creatureDefId}_behavior_tree.json`;
    a.click();
    URL.revokeObjectURL(url);
    setNotification('Exported behavior tree JSON');
    setTimeout(() => setNotification(null), 2500);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && Array.isArray(parsed.nodes) && Array.isArray(parsed.states)) {
          parsed.creatureDefId = selectedCreatureDefId;
          updateActiveTree(parsed);
          setNotification('Successfully imported behavior tree');
          setTimeout(() => setNotification(null), 3000);
        } else {
          alert('Invalid behavior tree format: missing nodes or states array.');
        }
      } catch (err) {
        alert('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Behavior Validation Checker
  const validationWarnings = useMemo(() => {
    const warnings: string[] = [];
    const nodeMap = new Map(activeTree.nodes.map((n) => [n.id, n]));

    // Check states have nodes
    for (const st of activeTree.states) {
      const stateNodes = activeTree.nodes.filter((n) => n.stateId === st.id);
      if (stateNodes.length === 0) {
        warnings.push(`State "${st.name}" has no assigned nodes.`);
      }
    }

    // Check condition nodes have both True and False branches
    for (const n of activeTree.nodes) {
      if (n.category === 'condition') {
        const hasTrue = activeTree.connections.some(
          (c) => c.sourceNodeId === n.id && c.sourceHandle === 'true'
        );
        const hasFalse = activeTree.connections.some(
          (c) => c.sourceNodeId === n.id && c.sourceHandle === 'false'
        );
        if (!hasTrue) warnings.push(`Condition node "${n.name}" is missing a True branch.`);
        if (!hasFalse) warnings.push(`Condition node "${n.name}" is missing a False branch.`);
      } else if (n.type !== 'run_away' && n.type !== 'state_transition') {
        // Non-terminal actions should connect somewhere
        const hasNext = activeTree.connections.some((c) => c.sourceNodeId === n.id);
        if (!hasNext) warnings.push(`Node "${n.name}" has no next step connection.`);
      }

      // Check state transitions target valid state
      if (n.type === 'state_transition' && n.targetStateName) {
        const found = activeTree.states.some(
          (s) => s.name.toLowerCase() === n.targetStateName?.toLowerCase()
        );
        if (!found) warnings.push(`Transition in "${n.name}" targets non-existent state "${n.targetStateName}".`);
      }
    }

    return warnings;
  }, [activeTree]);

  // Find active creature instance from engine
  const activeCreature = engine.creatures.find(
    (c) => c.defId === selectedCreatureDefId
  ) || engine.creatures[0] || null;

  const activeDef = creatures.find((c) => c.id === selectedCreatureDefId) || null;

  const runtimeState = activeCreature
    ? engine.behaviorRuntimeStates.get(activeCreature.id) || null
    : null;

  // Selected node object
  const selectedNode = activeTree.nodes.find((n) => n.id === selectedNodeId) || null;

  // Filtered nodes by state if tab selected
  const displayedNodes = useMemo(() => {
    if (activeStateFilter === 'all') return activeTree.nodes;
    return activeTree.nodes.filter((n) => n.stateId === activeStateFilter);
  }, [activeTree.nodes, activeStateFilter]);

  // Projected TTK and DPS calculations
  const avgTTK = useMemo(() => {
    if (!activeCreature || !activeDef) return 0;
    // Calculate aggregate DPS across all equipped weapons
    let totalDps = 0;
    for (const slot of engine.behemoth.slots) {
      if (slot.weapon) {
        totalDps += slot.weapon.dps;
      }
    }
    if (totalDps <= 0) return 0;
    return activeCreature.maxHp / totalDps;
  }, [activeCreature, activeDef, engine.behemoth.slots]);

  const effectiveDps = useMemo(() => {
    let dps = 0;
    for (const slot of engine.behemoth.slots) {
      if (slot.weapon && slot.isFiring) {
        dps += slot.weapon.dps;
      }
    }
    return dps;
  }, [engine.behemoth.slots]);

  return (
    <div className="flex flex-col h-full w-full bg-[#050b14] select-none overflow-hidden font-mono text-xs">
      {/* TOP TOOLBAR */}
      <div className="h-13 bg-[#081220] border-b border-slate-800 px-4 py-2 flex items-center justify-between z-20">
        {/* Threat Selector & State Tabs */}
        <div className="flex items-center gap-3">
          {/* Creature Selector */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg p-1 px-2">
            <span className="text-[11px] text-slate-400">Threat AI:</span>
            <select
              value={selectedCreatureDefId}
              onChange={(e) => {
                const newId = e.target.value;
                setSelectedCreatureDefId(newId);
                onSpawnCreature(newId);
                setSelectedNodeId(null);
              }}
              className="bg-slate-800 text-xs text-cyan-300 font-bold rounded px-2 py-0.5 outline-none border border-slate-700 hover:border-cyan-500 transition-colors"
            >
              {creatures.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.quantity > 1 ? `(Swarm x${c.quantity})` : ''}
                </option>
              ))}
            </select>
            {onCloneCreature && (
              <button
                type="button"
                onClick={() => onCloneCreature(selectedCreatureDefId)}
                className="px-1.5 py-0.5 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-700/60 text-cyan-300 rounded text-[10px] font-bold flex items-center gap-1 transition-all"
                title="Clone this threat and duplicate its behavior tree"
              >
                <Copy className="w-3 h-3" />
                <span>Clone</span>
              </button>
            )}
          </div>

          {/* Behavior State Tabs */}
          <div className="flex items-center gap-1 bg-slate-900/80 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setActiveStateFilter('all')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                activeStateFilter === 'all'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              All States ({activeTree.states.length})
            </button>

            {activeTree.states.map((st) => (
              <button
                key={st.id}
                onClick={() => setActiveStateFilter(st.id)}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                  activeStateFilter === st.id
                    ? 'bg-slate-800 text-cyan-300 border border-cyan-500/50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: st.color || '#38bdf8' }}
                />
                <span>{st.name}</span>
                {st.isInitial && (
                  <span className="text-[9px] px-1 rounded bg-cyan-950 text-cyan-400 font-normal">
                    Initial
                  </span>
                )}
              </button>
            ))}

            <button
              onClick={handleAddState}
              title="Add New State Phase"
              className="p-1 rounded text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Templates & Data Operations */}
        <div className="flex items-center gap-2">
          {/* Template Preset Dropdown */}
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleLoadTemplate(e.target.value);
                  e.target.value = '';
                }
              }}
              defaultValue=""
              className="bg-slate-900 text-xs text-amber-300 rounded px-2 py-1 outline-none border border-slate-800 hover:border-amber-500 font-bold transition-colors"
            >
              <option value="" disabled>
                Load Template...
              </option>
              <option value="dreadlot">Titan Ramming AI (Dreadlot)</option>
              <option value="veilfangs">Swarm Scatter & Reform (Veilfangs)</option>
              <option value="thunder_leviarch">Stealth Ambush (Thunder Leviarch)</option>
              <option value="aetherfin">Orbital Energy Skirmish (Aetherfin)</option>
            </select>
          </div>

          {/* Undo / Redo */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={handleUndo}
              disabled={history.length === 0}
              title="Undo (Ctrl+Z)"
              className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleRedo}
              disabled={future.length === 0}
              title="Redo (Ctrl+Y)"
              className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Export / Import JSON */}
          <button
            onClick={handleExportJSON}
            title="Export Behavior Tree as JSON"
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400 hover:bg-slate-800 transition-colors flex items-center gap-1"
          >
            <FolderDown className="w-3.5 h-3.5" />
            <span className="hidden xl:inline text-[11px]">Export</span>
          </button>

          <label
            title="Import Behavior Tree JSON"
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400 hover:bg-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <FolderUp className="w-3.5 h-3.5" />
            <span className="hidden xl:inline text-[11px]">Import</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportJSON}
              className="hidden"
            />
          </label>

          {/* Notification Banner */}
          {notification && (
            <div className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 text-[10px] animate-fade-in">
              {notification}
            </div>
          )}
        </div>
      </div>

      {activeDef?.pursueStyle === 'orbit_drain' && (
        <div className="px-4 py-1.5 bg-amber-950/40 border-b border-amber-800/60 text-amber-300 text-[11px]">
          {activeDef.name} uses the built-in Orbit + Drain pursue behavior (Charging, then Attacking). This node tree is
          ignored while it is selected; tune it in Stat Sliders &amp; Tuning, or switch Pursue Behavior to Standard Charge.
        </div>
      )}

      {/* MAIN WORKSPACE LAYOUT */}
      <div className="flex-1 flex min-h-0 relative">
        {/* LEFT: Node Palette */}
        <NodePalette onAddNode={handleAddNode} />

        {/* CENTER: Scratch Canvas */}
        <NodeCanvas
          nodes={displayedNodes}
          connections={activeTree.connections}
          selectedNodeId={selectedNodeId}
          runtimeState={runtimeState}
          onSelectNode={(id) => {
            setSelectedNodeId(id);
            if (id) setRightPanelTab('inspector');
          }}
          onUpdateNodePosition={handleUpdateNodePosition}
          onAddNode={handleAddNode}
          onConnectNodes={handleConnectNodes}
          onDeleteConnection={handleDeleteConnection}
          onDeleteNode={handleDeleteNode}
          onToggleCollapse={handleToggleCollapse}
        />

        {/* RIGHT: Tabbed Inspector & Live Telemetry Preview */}
        <div className="w-80 bg-slate-950 border-l border-slate-800 flex flex-col h-full z-10">
          {/* Panel Tab Switcher */}
          <div className="flex items-center p-1 bg-slate-900 border-b border-slate-800">
            <button
              onClick={() => setRightPanelTab('inspector')}
              className={`flex-1 py-1.5 rounded text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                rightPanelTab === 'inspector'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Node Inspector
            </button>
            <button
              onClick={() => setRightPanelTab('telemetry')}
              className={`flex-1 py-1.5 rounded text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                rightPanelTab === 'telemetry'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Live Radar
            </button>
          </div>

          {/* Panel Content */}
          <div className="flex-1 min-h-0">
            {rightPanelTab === 'inspector' ? (
              <NodePropertiesInspector
                node={selectedNode}
                states={activeTree.states}
                onUpdateNode={handleUpdateNode}
                onDeleteNode={handleDeleteNode}
              />
            ) : (
              <BehaviorLivePreview
                creature={activeCreature}
                creatureDef={activeDef}
                runtimeState={runtimeState}
                tree={activeTree}
              />
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM: Simulation Controls & Telemetry Dashboard */}
      <SimulationControlBar
        isRunning={isSimRunning}
        onToggleRunning={() => setIsSimRunning(!isSimRunning)}
        onReset={() => {
          engine.reset();
          onSpawnCreature(selectedCreatureDefId);
        }}
        onStep={() => {
          engine.tick(0.1);
        }}
        simSpeed={simSpeed}
        onSetSpeed={(spd) => setSimSpeed(spd)}
        creature={activeCreature}
        creatureDef={activeDef}
        runtimeState={runtimeState}
        validationWarnings={validationWarnings}
        avgTTK={avgTTK}
        effectiveDps={effectiveDps}
      />
    </div>
  );
};
