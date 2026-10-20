import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  BehaviorNode,
  BehaviorConnection,
  BehaviorRuntimeState,
  NodeCategory,
  BehaviorNodeType,
} from '../../types/behavior';
import {
  Move,
  Flame,
  Compass,
  ArrowRight,
  EyeOff,
  Clock,
  Sparkles,
  Users,
  Target,
  Shield,
  Zap,
  Radio,
  Activity,
  Layers,
  Repeat,
  GitBranch,
  CornerDownRight,
  ChevronDown,
  ChevronRight,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  PlayCircle,
} from 'lucide-react';

interface NodeCanvasProps {
  nodes: BehaviorNode[];
  connections: BehaviorConnection[];
  selectedNodeId: string | null;
  runtimeState: BehaviorRuntimeState | null;
  onSelectNode: (nodeId: string | null) => void;
  onUpdateNodePosition: (nodeId: string, x: number, y: number) => void;
  onAddNode: (type: BehaviorNodeType, category: NodeCategory, name: string, x: number, y: number) => void;
  onConnectNodes: (sourceNodeId: string, sourceHandle: 'next' | 'true' | 'false' | 'parallel', targetNodeId: string) => void;
  onDeleteConnection: (connectionId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onToggleCollapse: (nodeId: string) => void;
}

export const NodeCanvas: React.FC<NodeCanvasProps> = ({
  nodes,
  connections,
  selectedNodeId,
  runtimeState,
  onSelectNode,
  onUpdateNodePosition,
  onAddNode,
  onConnectNodes,
  onDeleteConnection,
  onDeleteNode,
  onToggleCollapse,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Pan & Zoom state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 80, y: 60 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Dragging node state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Connecting wire state
  const [connectingFrom, setConnectingFrom] = useState<{
    sourceNodeId: string;
    sourceHandle: 'next' | 'true' | 'false' | 'parallel';
    startX: number;
    startY: number;
  } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Node dimensions
  const NODE_WIDTH = 220;

  const getNodeIcon = (type: BehaviorNodeType) => {
    switch (type) {
      case 'approach': return <Move className="w-3.5 h-3.5 text-blue-300" />;
      case 'deal_damage': return <Flame className="w-3.5 h-3.5 text-blue-300" />;
      case 'retreat': return <Compass className="w-3.5 h-3.5 text-blue-300" />;
      case 'run_away': return <ArrowRight className="w-3.5 h-3.5 text-blue-300" />;
      case 'hide': return <EyeOff className="w-3.5 h-3.5 text-blue-300" />;
      case 'wait_idle': return <Clock className="w-3.5 h-3.5 text-blue-300" />;
      case 'scatter': return <Sparkles className="w-3.5 h-3.5 text-blue-300" />;
      case 'reform': return <Users className="w-3.5 h-3.5 text-blue-300" />;
      case 'until_dealt_damage': return <Target className="w-3.5 h-3.5 text-amber-300" />;
      case 'until_received_damage': return <Shield className="w-3.5 h-3.5 text-amber-300" />;
      case 'until_aggression': return <Zap className="w-3.5 h-3.5 text-amber-300" />;
      case 'for_seconds': return <Clock className="w-3.5 h-3.5 text-amber-300" />;
      case 'once': return <Radio className="w-3.5 h-3.5 text-amber-300" />;
      case 'health_threshold': return <Activity className="w-3.5 h-3.5 text-amber-300" />;
      case 'distance_check': return <Compass className="w-3.5 h-3.5 text-amber-300" />;
      case 'swarm_size': return <Users className="w-3.5 h-3.5 text-amber-300" />;
      case 'formation_integrity': return <Layers className="w-3.5 h-3.5 text-amber-300" />;
      case 'repeat': return <Repeat className="w-3.5 h-3.5 text-emerald-300" />;
      case 'branch_switch': return <GitBranch className="w-3.5 h-3.5 text-emerald-300" />;
      case 'state_transition': return <CornerDownRight className="w-3.5 h-3.5 text-emerald-300" />;
      case 'parallel_execute': return <Layers className="w-3.5 h-3.5 text-emerald-300" />;
      case 'swarm_coordination': return <Users className="w-3.5 h-3.5 text-purple-300" />;
      case 'phase_trigger': return <Sparkles className="w-3.5 h-3.5 text-purple-300" />;
      case 'event_listener': return <Radio className="w-3.5 h-3.5 text-purple-300" />;
      default: return <PlayCircle className="w-3.5 h-3.5 text-slate-300" />;
    }
  };

  const getNodeColors = (category: NodeCategory, isActive: boolean, isSelected: boolean) => {
    let headerBg = 'bg-blue-600';
    let borderColor = 'border-blue-500/40';
    let glow = '';

    if (category === 'condition') {
      headerBg = 'bg-amber-600';
      borderColor = 'border-amber-500/40';
    } else if (category === 'flow') {
      headerBg = 'bg-emerald-600';
      borderColor = 'border-emerald-500/40';
    } else if (category === 'special') {
      headerBg = 'bg-purple-600';
      borderColor = 'border-purple-500/40';
    }

    if (isActive) {
      borderColor = 'border-cyan-400 ring-2 ring-cyan-400 shadow-lg shadow-cyan-500/30';
      glow = 'animate-pulse';
    } else if (isSelected) {
      borderColor = 'border-cyan-400 ring-1 ring-cyan-500 shadow-md shadow-cyan-500/20';
    }

    return { headerBg, borderColor, glow };
  };

  const getNodeSummary = (node: BehaviorNode): string => {
    switch (node.type) {
      case 'approach':
        return `Speed: ${node.speed || 150} | Dist: ${node.minDistance || 45}px`;
      case 'deal_damage':
        return `${node.damage || 120} ${node.damageType || 'Physical'} dmg (${node.cooldown || 2}s cd)`;
      case 'retreat':
        return `Back to ${node.minDistance || 350}px @ ${node.speed || 150}kn`;
      case 'run_away':
        return `Flee @ ${node.speed || 220}kn`;
      case 'hide':
        return `Submerge for ${node.duration || 3}s`;
      case 'wait_idle':
        return `Idle for ${node.duration || 2}s`;
      case 'scatter':
        return `Scatter ${node.spreadRadius || 120}px @ ${node.scatterSpeed || 220}kn`;
      case 'reform':
        return `Reform ${node.formationType?.toUpperCase() || 'WEDGE'} (${node.spacing || 20}px)`;
      case 'until_dealt_damage':
        return `Until dealt >= ${node.targetDamage || 300} dmg`;
      case 'until_received_damage':
        return `Until took >= ${node.targetDamage || 150} dmg`;
      case 'until_aggression':
        return `Aggro ${node.aggressionOp || '>='} ${node.targetAggression || 60}%`;
      case 'for_seconds':
        return `Hold for ${node.duration || 3}s`;
      case 'once':
        return `Trigger once only`;
      case 'health_threshold':
        return `HP ${node.healthOp || '<='} ${node.healthPercent || 50}%`;
      case 'distance_check':
        return `Dist ${node.distanceOp || '<='} ${node.distanceThreshold || 250}px`;
      case 'swarm_size':
        return `Swarm ${node.swarmSizeOp || '<='} ${node.targetSwarmSize || 5}`;
      case 'formation_integrity':
        return `Integrity ${node.formationIntegrityOp || '>='} ${node.targetFormationIntegrity || 80}%`;
      case 'repeat':
        return node.isInfiniteRepeat ? `Loop: Infinite` : `Loop: ${node.repeatCount || 3}x`;
      case 'branch_switch':
        return `Branch on Aggro >= 60%`;
      case 'state_transition':
        return `Jump -> [${node.targetStateName || 'Next State'}]`;
      case 'parallel_execute':
        return `Parallel Fork`;
      case 'swarm_coordination':
        return `Coherence: ${node.coherence || 95}%`;
      case 'phase_trigger':
        return `Trigger Phase ${node.targetPhase || 2}`;
      case 'event_listener':
        return `Listen: ${node.listenEvent || 'HULL_RAMMED'}`;
      default:
        return '';
    }
  };

  // Canvas Mouse Events (Pan & Connecting wire)
  const handleMouseDownCanvas = (e: React.MouseEvent) => {
    // Only pan on middle button or if clicking directly on the canvas background
    if (e.button === 1 || e.target === containerRef.current || (e.target as HTMLElement).tagName === 'svg') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const currentMouseCanvas = {
      x: (e.clientX - rect.left - pan.x) / zoom,
      y: (e.clientY - rect.top - pan.y) / zoom,
    };
    setMousePos(currentMouseCanvas);

    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    } else if (draggingNodeId) {
      onUpdateNodePosition(
        draggingNodeId,
        Math.round(currentMouseCanvas.x - dragOffset.x),
        Math.round(currentMouseCanvas.y - dragOffset.y)
      );
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
    if (connectingFrom) {
      setConnectingFrom(null);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    setZoom((prev) => Math.min(2.0, Math.max(0.4, prev * zoomFactor)));
  };

  // Node Drag Start
  const handleNodeMouseDown = (e: React.MouseEvent, node: BehaviorNode) => {
    e.stopPropagation();
    if (e.button !== 0) return; // Left click only
    onSelectNode(node.id);

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const canvasMouseX = (e.clientX - rect.left - pan.x) / zoom;
    const canvasMouseY = (e.clientY - rect.top - pan.y) / zoom;

    setDraggingNodeId(node.id);
    setDragOffset({
      x: canvasMouseX - node.x,
      y: canvasMouseY - node.y,
    });
  };

  // HTML5 Drop to add node from palette
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData('application/combat-node-type') as BehaviorNodeType;
    const category = e.dataTransfer.getData('application/combat-node-category') as NodeCategory;
    const name = e.dataTransfer.getData('application/combat-node-name');

    if (nodeType && category && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const dropX = Math.round((e.clientX - rect.left - pan.x) / zoom);
      const dropY = Math.round((e.clientY - rect.top - pan.y) / zoom);
      onAddNode(nodeType, category, name || 'New Node', dropX, dropY);
    }
  };

  // Port connection start
  const handleStartConnection = (
    e: React.MouseEvent,
    sourceNodeId: string,
    sourceHandle: 'next' | 'true' | 'false' | 'parallel',
    handleX: number,
    handleY: number
  ) => {
    e.stopPropagation();
    setConnectingFrom({
      sourceNodeId,
      sourceHandle,
      startX: handleX,
      startY: handleY,
    });
  };

  // Target port mouse up
  const handleEndConnection = (e: React.MouseEvent, targetNodeId: string) => {
    e.stopPropagation();
    if (connectingFrom && connectingFrom.sourceNodeId !== targetNodeId) {
      onConnectNodes(connectingFrom.sourceNodeId, connectingFrom.sourceHandle, targetNodeId);
    }
    setConnectingFrom(null);
  };

  // Port location helpers
  const getNodeInputPos = (node: BehaviorNode) => {
    return { x: node.x + NODE_WIDTH / 2, y: node.y };
  };

  const getNodeOutputPos = (
    node: BehaviorNode,
    handle: 'next' | 'true' | 'false' | 'parallel'
  ) => {
    const isCollapsed = !!node.isCollapsed;
    const nodeHeight = isCollapsed ? 38 : 78;

    if (handle === 'true') {
      return { x: node.x + 50, y: node.y + nodeHeight };
    }
    if (handle === 'false') {
      return { x: node.x + NODE_WIDTH - 50, y: node.y + nodeHeight };
    }
    if (handle === 'parallel') {
      return { x: node.x + NODE_WIDTH, y: node.y + nodeHeight / 2 };
    }
    return { x: node.x + NODE_WIDTH / 2, y: node.y + nodeHeight };
  };

  // Render SVG connection curve
  const renderConnectionWire = (
    sx: number,
    sy: number,
    tx: number,
    ty: number,
    id?: string,
    color: string = '#06b6d4',
    isActive: boolean = false
  ) => {
    const dx = tx - sx;
    const dy = ty - sy;
    const curvature = Math.max(40, Math.abs(dy) * 0.5);

    // Vertical S-curve for node flows
    const path = `M ${sx} ${sy} C ${sx} ${sy + curvature}, ${tx} ${ty - curvature}, ${tx} ${ty}`;

    return (
      <g key={id || `${sx}-${sy}-${tx}-${ty}`} className="group cursor-pointer">
        {/* Glow backdrop on active wire */}
        {isActive && (
          <path
            d={path}
            fill="none"
            stroke="#22d3ee"
            strokeWidth="6"
            strokeOpacity="0.4"
            className="animate-pulse"
          />
        )}
        {/* Thick transparent hit-area */}
        <path
          d={path}
          fill="none"
          stroke="transparent"
          strokeWidth="16"
          onClick={() => id && onDeleteConnection(id)}
        />
        {/* Main wire */}
        <path
          d={path}
          fill="none"
          stroke={isActive ? '#38bdf8' : color}
          strokeWidth={isActive ? '3' : '2'}
          strokeDasharray={isActive ? '6 4' : undefined}
          className={`transition-colors group-hover:stroke-rose-400 ${
            isActive ? 'animate-[dash_1s_linear_infinite]' : ''
          }`}
        />
        {/* Direction marker arrowhead */}
        <circle
          cx={tx}
          cy={ty}
          r="3.5"
          fill={isActive ? '#38bdf8' : color}
          className="group-hover:fill-rose-400"
        />
      </g>
    );
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDownCanvas}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="relative flex-1 h-full overflow-hidden bg-[#070e17] select-none cursor-crosshair"
      style={{
        backgroundImage: `radial-gradient(circle, rgba(30, 41, 59, 0.45) 1px, transparent 1px)`,
        backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
      }}
    >
      {/* Zoom / Pan Controls HUD */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-1.5 p-1.5 rounded-lg bg-slate-900/90 border border-slate-800 shadow-xl backdrop-blur-sm font-mono text-xs text-slate-300">
        <button
          onClick={() => setZoom((z) => Math.min(2.0, z + 0.15))}
          className="p-1 rounded hover:bg-slate-800 hover:text-cyan-400 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <span className="px-1 text-[11px] font-bold text-cyan-400 w-10 text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}
          className="p-1 rounded hover:bg-slate-800 hover:text-cyan-400 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => {
            setZoom(1.0);
            setPan({ x: 80, y: 60 });
          }}
          className="p-1 rounded hover:bg-slate-800 hover:text-cyan-400 transition-colors ml-1 border-l border-slate-800 pl-2"
          title="Reset View"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Canvas World Container */}
      <div
        className="absolute origin-top-left"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          width: '100%',
          height: '100%',
        }}
      >
        {/* SVG CONNECTIONS LAYER */}
        <svg
          className="absolute top-0 left-0 overflow-visible pointer-events-auto"
          style={{ width: '1px', height: '1px' }}
        >
          {/* Render defined connections */}
          {connections.map((conn) => {
            const srcNode = nodes.find((n) => n.id === conn.sourceNodeId);
            const tgtNode = nodes.find((n) => n.id === conn.targetNodeId);
            if (!srcNode || !tgtNode) return null;

            const srcPos = getNodeOutputPos(srcNode, conn.sourceHandle);
            const tgtPos = getNodeInputPos(tgtNode);
            const isActive =
              runtimeState?.activeNodeId === srcNode.id ||
              runtimeState?.activeNodeId === tgtNode.id;

            let wireColor = '#3b82f6';
            if (conn.sourceHandle === 'true') wireColor = '#10b981';
            else if (conn.sourceHandle === 'false') wireColor = '#f43f5e';
            else if (conn.sourceHandle === 'parallel') wireColor = '#a855f7';

            return renderConnectionWire(
              srcPos.x,
              srcPos.y,
              tgtPos.x,
              tgtPos.y,
              conn.id,
              wireColor,
              isActive
            );
          })}

          {/* Render dynamic wire while user is dragging connection */}
          {connectingFrom && (
            renderConnectionWire(
              connectingFrom.startX,
              connectingFrom.startY,
              mousePos.x,
              mousePos.y,
              undefined,
              '#22d3ee',
              true
            )
          )}
        </svg>

        {/* NODES CARDS LAYER */}
        {nodes.map((node) => {
          const isActive = runtimeState?.activeNodeId === node.id;
          const isSelected = selectedNodeId === node.id;
          const { headerBg, borderColor, glow } = getNodeColors(
            node.category,
            isActive,
            isSelected
          );
          const isCollapsed = !!node.isCollapsed;
          const summary = getNodeSummary(node);

          return (
            <div
              key={node.id}
              onMouseDown={(e) => handleNodeMouseDown(e, node)}
              className={`absolute rounded-xl bg-slate-900 border ${borderColor} ${glow} shadow-xl select-none cursor-move transition-all flex flex-col`}
              style={{
                left: `${node.x}px`,
                top: `${node.y}px`,
                width: `${NODE_WIDTH}px`,
                zIndex: isSelected ? 20 : isActive ? 15 : 10,
              }}
            >
              {/* TOP INPUT CONNECTION PORT */}
              <div
                onMouseUp={(e) => handleEndConnection(e, node.id)}
                className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 flex items-center justify-center cursor-pointer group/in z-30"
                title="Connect input port"
              >
                <div className="w-3 h-3 rounded-full bg-slate-950 border-2 border-slate-400 group-hover/in:border-cyan-400 group-hover/in:bg-cyan-500 transition-all shadow-md" />
              </div>

              {/* CARD HEADER (Scratch-like vibrant color banner) */}
              <div
                className={`${headerBg} p-2 rounded-t-xl text-white flex items-center justify-between shadow-sm`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="p-1 rounded bg-black/20 flex-shrink-0">
                    {getNodeIcon(node.type)}
                  </div>
                  <span className="text-xs font-mono font-bold tracking-tight truncate">
                    {node.name}
                  </span>
                </div>

                <div className="flex items-center gap-0.5">
                  {/* Active node live pulse badge */}
                  {isActive && (
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-cyan-400 text-slate-950 font-black animate-bounce mr-1">
                      RUNNING
                    </span>
                  )}

                  {/* Collapse Toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleCollapse(node.id);
                    }}
                    className="p-0.5 rounded hover:bg-black/20 text-white/80 transition-colors"
                    title={isCollapsed ? 'Expand' : 'Collapse'}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* Delete Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteNode(node.id);
                    }}
                    className="p-0.5 rounded hover:bg-rose-950 text-white/60 hover:text-white transition-colors"
                    title="Delete Node"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* CARD BODY */}
              {!isCollapsed && (
                <div className="p-2.5 bg-slate-950/90 rounded-b-xl border-t border-slate-800/80 font-mono">
                  {summary && (
                    <div className="text-[11px] text-slate-300 font-semibold bg-slate-900/90 rounded p-1.5 border border-slate-800 truncate">
                      {summary}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1.5">
                    <span className="uppercase text-[9px] font-bold text-slate-400">
                      {node.category}
                    </span>
                    <span>#{node.id.slice(-4)}</span>
                  </div>
                </div>
              )}

              {/* BOTTOM OUTPUT CONNECTION PORTS */}
              {/* If Condition or Branch node, show True / False branch ports */}
              {node.category === 'condition' || node.type === 'branch_switch' ? (
                <div className="relative w-full h-3 flex items-center justify-between px-6 -bottom-1">
                  {/* True Port (Green) */}
                  <div
                    onMouseDown={(e) => {
                      const pos = getNodeOutputPos(node, 'true');
                      handleStartConnection(e, node.id, 'true', pos.x, pos.y);
                    }}
                    className="w-5 h-5 flex items-center justify-center cursor-pointer group/true z-30"
                    title="True Branch (Condition Met)"
                  >
                    <div className="w-3 h-3 rounded-full bg-slate-950 border-2 border-emerald-400 group-hover/true:bg-emerald-400 shadow-md transition-all flex items-center justify-center">
                      <span className="text-[8px] font-bold text-emerald-400 group-hover/true:text-black">
                        T
                      </span>
                    </div>
                  </div>

                  {/* False Port (Red) */}
                  <div
                    onMouseDown={(e) => {
                      const pos = getNodeOutputPos(node, 'false');
                      handleStartConnection(e, node.id, 'false', pos.x, pos.y);
                    }}
                    className="w-5 h-5 flex items-center justify-center cursor-pointer group/false z-30"
                    title="False Branch (Condition Failed)"
                  >
                    <div className="w-3 h-3 rounded-full bg-slate-950 border-2 border-rose-400 group-hover/false:bg-rose-400 shadow-md transition-all flex items-center justify-center">
                      <span className="text-[8px] font-bold text-rose-400 group-hover/false:text-black">
                        F
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Standard Next Port */
                <div
                  onMouseDown={(e) => {
                    const pos = getNodeOutputPos(node, 'next');
                    handleStartConnection(e, node.id, 'next', pos.x, pos.y);
                  }}
                  className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 flex items-center justify-center cursor-pointer group/out z-30"
                  title="Connect next step"
                >
                  <div className="w-3 h-3 rounded-full bg-slate-950 border-2 border-cyan-400 group-hover/out:bg-cyan-400 shadow-md transition-all" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
