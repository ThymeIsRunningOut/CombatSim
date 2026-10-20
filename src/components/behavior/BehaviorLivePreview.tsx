import React, { useRef, useEffect } from 'react';
import {
  CreatureRuntimeInstance,
  CreatureDef,
  WeaponSlot,
} from '../../types/combat';
import {
  BehaviorRuntimeState,
  FormationType,
  CreatureBehaviorTree,
} from '../../types/behavior';
import { getFormationOffset } from '../../engine/behaviorRunner';
import { Shield, Zap, EyeOff, Users, Target, Activity } from 'lucide-react';

interface BehaviorLivePreviewProps {
  creature: CreatureRuntimeInstance | null;
  creatureDef: CreatureDef | null;
  runtimeState: BehaviorRuntimeState | null;
  tree: CreatureBehaviorTree | null;
}

export const BehaviorLivePreview: React.FC<BehaviorLivePreviewProps> = ({
  creature,
  creatureDef,
  runtimeState,
  tree,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const formationIntegrity = runtimeState ? Math.round(runtimeState.formationIntegrity) : 100;
  const isSwarm = creature?.isSwarm ?? false;
  const activeNode = tree?.nodes.find((n) => n.id === runtimeState?.activeNodeId);
  const currentState = tree?.states.find((s) => s.id === runtimeState?.currentStateId);

  // Render mini tactical preview
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = '#060d17';
    ctx.fillRect(0, 0, width, height);

    // Draw sonar radar grid circles
    ctx.strokeStyle = '#0f2942';
    ctx.lineWidth = 1;
    const centerX = width * 0.35;
    const centerY = height * 0.5;

    ctx.beginPath();
    ctx.arc(centerX, centerY, 40, 0, Math.PI * 2);
    ctx.arc(centerX, centerY, 80, 0, Math.PI * 2);
    ctx.arc(centerX, centerY, 120, 0, Math.PI * 2);
    ctx.stroke();

    // Crosshairs
    ctx.strokeStyle = '#0c2136';
    ctx.beginPath();
    ctx.moveTo(centerX - 130, centerY);
    ctx.lineTo(centerX + 130, centerY);
    ctx.moveTo(centerX, centerY - 80);
    ctx.lineTo(centerX, centerY + 80);
    ctx.stroke();

    // Draw Behemoth Vessel anchor at (centerX, centerY)
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    const bw = 50;
    const bh = 18;
    ctx.beginPath();
    ctx.roundRect(centerX - bw / 2, centerY - bh / 2, bw, bh, 3);
    ctx.fill();
    ctx.stroke();

    // Vessel Label
    ctx.fillStyle = '#38bdf8';
    ctx.font = '9px monospace';
    ctx.fillText('BEHEMOTH', centerX - 22, centerY + 3);

    if (!creature) {
      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.fillText('NO THREAT ACTIVE', width * 0.6, height * 0.5);
      return;
    }

    // Creature relative coordinates mapped to mini radar
    // Normalize relative to (centerX, centerY)
    const scale = 0.28;
    const cRelX = (creature.x - 700) * scale;
    const cRelY = (creature.y - 350) * scale;
    const drawX = Math.max(20, Math.min(width - 20, centerX + cRelX));
    const drawY = Math.max(20, Math.min(height - 20, centerY + cRelY));

    // Draw formation guide template overlay if active node is Reform or Swarm
    const formationType: FormationType =
      activeNode?.formationType || 'wedge';

    if (isSwarm && creature.swarmEntities && creature.swarmEntities.length > 0) {
      const total = creature.swarmEntities.length;

      // Draw formation guide ghost points
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
      ctx.setLineDash([2, 2]);
      ctx.beginPath();

      for (let i = 0; i < Math.min(total, 35); i++) {
        const offset = getFormationOffset(i, total, formationType, (activeNode?.spacing || 20) * scale * 1.5);
        const gx = drawX + offset.x;
        const gy = drawY + offset.y;
        ctx.rect(gx - 2, gy - 2, 4, 4);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw actual swarm entities
      for (let i = 0; i < creature.swarmEntities.length; i++) {
        const ent = creature.swarmEntities[i];
        if (ent.hp <= 0) continue;
        const entRelX = (ent.x - 700) * scale;
        const entRelY = (ent.y - 350) * scale;
        const ex = Math.max(10, Math.min(width - 10, centerX + entRelX));
        const ey = Math.max(10, Math.min(height - 10, centerY + entRelY));

        ctx.fillStyle = creature.color || '#38bdf8';
        ctx.beginPath();
        ctx.arc(ex, ey, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Single creature drawing
      ctx.save();
      ctx.translate(drawX, drawY);
      ctx.rotate((creature.angle * Math.PI) / 180);

      // Submerged transparency effect
      ctx.globalAlpha = creature.underwater ? 0.35 : 1.0;

      // Threat body
      ctx.fillStyle = creature.color || '#f43f5e';
      ctx.strokeStyle = '#fca5a5';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, 0, 10, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Heading arrow
      ctx.strokeStyle = '#f43f5e';
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(16, 0);
      ctx.stroke();

      ctx.restore();
    }

    // Trajectory dashed line between Behemoth and threat
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(drawX, drawY);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [creature, activeNode, runtimeState]);

  const getIntegrityColor = (val: number) => {
    if (val >= 80) return 'text-emerald-400 bg-emerald-950 border-emerald-800';
    if (val >= 50) return 'text-amber-400 bg-amber-950 border-amber-800';
    return 'text-rose-400 bg-rose-950 border-rose-800';
  };

  return (
    <div className="w-80 bg-slate-950 border-r border-slate-800 flex flex-col h-full font-mono text-xs select-none">
      {/* Header */}
      <div className="p-2.5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-bold text-slate-200">
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          <span>Live Radar Preview</span>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-bold">
          2D Telemetry
        </span>
      </div>

      {/* Mini Radar Canvas */}
      <div className="relative p-2 flex items-center justify-center bg-[#060d17] border-b border-slate-800">
        <canvas
          ref={canvasRef}
          width={280}
          height={160}
          className="rounded border border-slate-800 shadow-inner"
        />

        {/* Status Pills Overlay */}
        <div className="absolute top-3 left-3 flex flex-col gap-1">
          {creature?.underwater && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-950/80 text-blue-400 border border-blue-700 flex items-center gap-1">
              <EyeOff className="w-3 h-3" /> Submerged
            </span>
          )}
          {isSwarm && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-950/80 text-purple-400 border border-purple-700 flex items-center gap-1">
              <Users className="w-3 h-3" /> Swarm ({creature?.swarmEntities?.filter((e) => e.hp > 0).length || creature?.quantity} units)
            </span>
          )}
        </div>
      </div>

      {/* Swarm Formation & State Dashboard */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {/* Formation Integrity Meter */}
        <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="text-slate-400 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              Formation Integrity
            </span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${getIntegrityColor(
                formationIntegrity
              )}`}
            >
              {formationIntegrity}%
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                formationIntegrity >= 80
                  ? 'bg-emerald-500'
                  : formationIntegrity >= 50
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
              style={{ width: `${formationIntegrity}%` }}
            />
          </div>

          <div className="flex justify-between text-[9px] text-slate-500 mt-1">
            <span>Scatter (Dispersed)</span>
            <span>Locked (Coherent)</span>
          </div>
        </div>

        {/* Aggression Meter */}
        <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="text-slate-400 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Aggression State
            </span>
            <span className="text-amber-400 font-bold">
              {Math.round(creature?.aggression ?? 0)}%
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-300"
              style={{ width: `${Math.round(creature?.aggression ?? 0)}%` }}
            />
          </div>
        </div>

        {/* Active Node & State Info */}
        <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Behavior State Machine
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Current State:</span>
            <span className="font-bold text-cyan-300">
              {currentState?.name || 'Default State'}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Active Node:</span>
            <span className="font-bold text-emerald-400 truncate max-w-[140px]">
              {activeNode?.name || 'Idle'}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Step Elapsed:</span>
            <span className="font-bold text-slate-200">
              {(runtimeState?.nodeTimer ?? 0).toFixed(1)}s
            </span>
          </div>
        </div>

        {/* Live Execution Trace Log */}
        <div className="p-2 rounded-lg bg-slate-900/50 border border-slate-800">
          <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center justify-between">
            <span>Execution Trace</span>
            <span className="text-[9px] text-cyan-400">Live</span>
          </div>
          <div className="space-y-1 max-h-24 overflow-y-auto text-[10px] text-slate-400 custom-scrollbar">
            {(runtimeState?.executionLog || []).slice(0, 5).map((log, idx) => (
              <div key={idx} className="truncate text-slate-300">
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
