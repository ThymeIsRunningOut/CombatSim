import React, { useState } from 'react';
import { WeaponDef, CreatureDef, BuildingDef, BehemothState } from '../types/combat';
import { generateUnrealEnginePackage, UnrealEngineExportPackage } from '../engine/unrealExport';
import {
  METERS_PER_TILE,
  METERS_PER_KNOT,
  BEHEMOTH_LENGTH_METERS,
  BEHEMOTH_BEAM_METERS,
  UNREAL_UNITS_PER_TILE,
  BEHEMOTH_LENGTH_UNREAL,
  BEHEMOTH_BEAM_UNREAL,
  BASE_NAUTICAL_SPEED_MPS,
  BASE_NAUTICAL_SPEED_UUPS,
  BASE_NAUTICAL_SPEED_KMH,
  normalizeSpeedToKnots,
} from '../engine/measurements';
import { X, Copy, Check, Download, Box, Ship, Crosshair, Shield, Activity, Compass, Code, Table } from 'lucide-react';

interface UnrealExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  weapons: WeaponDef[];
  creatures: CreatureDef[];
  buildings: BuildingDef[];
  behemoth?: BehemothState;
  behaviorTrees?: Record<string, any>;
}

export const UnrealExportModal: React.FC<UnrealExportModalProps> = ({
  isOpen,
  onClose,
  weapons,
  creatures,
  buildings,
  behemoth,
  behaviorTrees,
}) => {
  const [activeTab, setActiveTab] = useState<'matrix' | 'json' | 'cpp'>('matrix');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const pkg: UnrealEngineExportPackage = generateUnrealEnginePackage(
    weapons,
    creatures,
    buildings,
    behemoth,
    behaviorTrees
  );

  const jsonString = JSON.stringify(pkg, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `combatsim-unreal-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const cppSnippet = `// Fill out your copyright notice in the Description page of Project Settings.
#pragma once

#include "CoreMinimal.h"
#include "Engine/DataTable.h"
#include "BehemothCombatTypes.generated.h"

/**
 * Standard World & Navigation Dimensions for Behemoth Game
 * 1 World Tile = 2,700 meters = 270,000 Unreal Units / Game Units (cm)
 * Behemoth Length = 750 meters = 75,000 Unreal Units
 * Base Nautical Speed = 1 Knot per minute = 4,500.0 UU/s (45.0 m/s)
 */
USTRUCT(BlueprintType)
struct FWorldMeasurementStandards
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "CombatSim")
    float TileLengthMeters = ${METERS_PER_TILE}.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "CombatSim")
    float TileLengthUU = ${UNREAL_UNITS_PER_TILE}.0f; // 200,000 cm

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "CombatSim")
    float BehemothLengthUU = ${BEHEMOTH_LENGTH_UNREAL}.0f; // 75,000 cm (750m)

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "CombatSim")
    float BehemothBeamUU = ${BEHEMOTH_BEAM_UNREAL}.0f; // 26,000 cm (260m)

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "CombatSim")
    float BaseNauticalSpeedUUps = ${BASE_NAUTICAL_SPEED_UUPS.toFixed(2)}f; // 1 Knot/min
};

USTRUCT(BlueprintType)
struct FCreatureCombatAttributes : public FTableRowBase
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Stats")
    FString CreatureId;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Stats")
    float MaxHP;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Stats")
    float MovementSpeedKnots; // In Knots per minute

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Stats")
    float MovementSpeedUUps; // In cm/s for CharacterMovementComponent

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Stats")
    float CollisionRadiusUU; // In cm

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Stats")
    float AggroRadiusUU; // In cm
};`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-slate-900 border border-cyan-500/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-200 font-sans">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-950/70 border border-cyan-500/40 text-cyan-400">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100 tracking-wide">
                  Unreal Engine Telemetry & Measurements Bridge
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded">
                  UE5 (1 UU = 1 cm)
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Calibrated in-game measurements: 1 World Tile = 2.7 km (270,000 GU) • Behemoth = 750m (75,000 GU)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Defined Measurements KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-6 bg-slate-950/40 border-b border-slate-800/80">
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 font-mono">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              World Tile (Grid)
            </div>
            <div className="text-base font-bold text-cyan-400">2.7 km</div>
            <div className="text-[11px] text-slate-400">270,000 Game Units (cm)</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 font-mono">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Ship className="w-3.5 h-3.5 text-amber-400" />
              Behemoth Fortress
            </div>
            <div className="text-base font-bold text-amber-400">750m (0.375 kts)</div>
            <div className="text-[11px] text-slate-400">75,000 UU • Beam: 260m (26,000 UU)</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 font-mono">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              Base Nautical Speed
            </div>
            <div className="text-base font-bold text-emerald-400">1 Knot / min</div>
            <div className="text-[11px] text-slate-400">33.33 m/s • 3,333 UU/s • 120 km/h</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 font-mono">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Crosshair className="w-3.5 h-3.5 text-purple-400" />
              Combat Locus
            </div>
            <div className="text-base font-bold text-purple-400">4.0 km² Area</div>
            <div className="text-[11px] text-slate-400">Tile [0, 0] centered on hull</div>
          </div>
        </div>

        {/* Tab Controls & Actions */}
        <div className="px-6 py-2.5 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('matrix')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-colors ${
                activeTab === 'matrix'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              MEASUREMENTS MATRIX
            </button>
            <button
              onClick={() => setActiveTab('json')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-colors ${
                activeTab === 'json'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              UNREAL JSON PAYLOAD
            </button>
            <button
              onClick={() => setActiveTab('cpp')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-colors ${
                activeTab === 'cpp'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              C++ / USTRUCT DEFINITION
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition-colors border border-slate-700"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'COPIED TO CLIPBOARD' : 'COPY JSON'}
            </button>
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1.5 transition-colors shadow-lg shadow-cyan-900/30"
            >
              <Download className="w-3.5 h-3.5" />
              DOWNLOAD UNREAL CONFIG
            </button>
          </div>
        </div>

        {/* Tab Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 font-mono text-xs">
          {activeTab === 'matrix' && (
            <div className="space-y-6">
              {/* Creatures Telemetry */}
              <div>
                <h3 className="text-sm font-bold text-cyan-400 mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  PREDATOR THREATS: CALIBRATED SPEEDS & SIZES
                </h3>
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/50">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400">
                        <th className="p-2.5">Creature</th>
                        <th className="p-2.5">Speed (Knots)</th>
                        <th className="p-2.5">Speed (m/s)</th>
                        <th className="p-2.5">Unreal (UU/s)</th>
                        <th className="p-2.5">Speed (km/h)</th>
                        <th className="p-2.5">Radius (m / UU)</th>
                        <th className="p-2.5">Aggro (m / Knots)</th>
                        <th className="p-2.5">Quantity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {pkg.creatures.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-2.5 font-bold text-slate-100 flex items-center gap-2">
                            <span>{c.name}</span>
                            <span className="text-[10px] text-slate-500">({c.id})</span>
                          </td>
                          <td className="p-2.5 text-cyan-400 font-bold">{c.kinematics.movementSpeedKnots} kts</td>
                          <td className="p-2.5 text-emerald-400">{c.kinematics.movementSpeedMps} m/s</td>
                          <td className="p-2.5 text-purple-400">{c.kinematics.movementSpeedUUps.toLocaleString()} UU/s</td>
                          <td className="p-2.5 text-slate-400">{c.kinematics.movementSpeedKmh} km/h</td>
                          <td className="p-2.5">{c.kinematics.collisionRadiusMeters}m ({c.kinematics.collisionRadiusUU.toLocaleString()} UU)</td>
                          <td className="p-2.5">{c.kinematics.aggroRadiusMeters}m ({c.kinematics.aggroRadiusKnots} kts)</td>
                          <td className="p-2.5 text-amber-400 font-bold">{c.stats.quantity}x</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Weapons Telemetry */}
              <div>
                <h3 className="text-sm font-bold text-cyan-400 mb-3 flex items-center gap-2">
                  <Crosshair className="w-4 h-4" />
                  DEFENSE BATTERY BALLISTICS (UNREAL SCALED)
                </h3>
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/50">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400">
                        <th className="p-2.5">Weapon</th>
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5">Max Range (m)</th>
                        <th className="p-2.5">Range (Knots)</th>
                        <th className="p-2.5">Range (UU)</th>
                        <th className="p-2.5">Projectile (m/s)</th>
                        <th className="p-2.5">Projectile (UU/s)</th>
                        <th className="p-2.5">Traverse Cap</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {pkg.weapons.map((w) => (
                        <tr key={w.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-2.5 font-bold text-slate-100">{w.name}</td>
                          <td className="p-2.5">
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 border border-slate-700 text-slate-300">
                              {w.damageType}
                            </span>
                          </td>
                          <td className="p-2.5 text-cyan-400 font-bold">{w.ballistics.rangeMeters} m</td>
                          <td className="p-2.5 text-slate-400">{w.ballistics.rangeKnots} kts</td>
                          <td className="p-2.5 text-purple-400">{w.ballistics.rangeUU.toLocaleString()} UU</td>
                          <td className="p-2.5 text-emerald-400">{w.ballistics.projectileSpeedMps} m/s</td>
                          <td className="p-2.5 text-emerald-300">{w.ballistics.projectileSpeedUUps.toLocaleString()} UU/s</td>
                          <td className="p-2.5 text-amber-400 font-bold">{w.ballistics.rotationCapDegrees}°</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Vessel Sockets */}
              <div>
                <h3 className="text-sm font-bold text-cyan-400 mb-3 flex items-center gap-2">
                  <Ship className="w-4 h-4" />
                  BEHEMOTH COMPONENT SOCKETS (75,000 UU x 26,000 UU)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800">
                    <div className="font-bold text-slate-200 mb-2">Turret Mount Sockets (8 Mounts)</div>
                    <div className="space-y-1.5 text-[11px] text-slate-400">
                      {pkg.vessel.turretMountSockets.map((s) => (
                        <div key={s.id} className="flex justify-between items-center py-1 border-b border-slate-800/40">
                          <span className="font-bold text-slate-300">{s.id.toUpperCase()}</span>
                          <span className="text-cyan-400">X: {s.relativeLocationUU.x.toLocaleString()} cm, Y: {s.relativeLocationUU.y.toLocaleString()} cm</span>
                          <span className="text-amber-400">Facing: {s.defaultFacingYaw}° (Cap: {s.rotationCapDegrees}°)</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800">
                    <div className="font-bold text-slate-200 mb-2">Building Pad Sockets (8 Pads)</div>
                    <div className="space-y-1.5 text-[11px] text-slate-400">
                      {pkg.vessel.buildingPadSockets.map((s) => (
                        <div key={s.id} className="flex justify-between items-center py-1 border-b border-slate-800/40">
                          <span className="font-bold text-slate-300">{s.id.toUpperCase()}</span>
                          <span className="text-cyan-400">X: {s.relativeLocationUU.x.toLocaleString()} cm, Y: {s.relativeLocationUU.y.toLocaleString()} cm</span>
                          <span className="text-purple-400">{s.equippedBuildingId || 'Empty Pad'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'json' && (
            <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-cyan-400/90 leading-relaxed overflow-x-auto selection:bg-cyan-500/30">
              {jsonString}
            </pre>
          )}

          {activeTab === 'cpp' && (
            <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-emerald-400/90 leading-relaxed overflow-x-auto selection:bg-emerald-500/30">
              {cppSnippet}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};
