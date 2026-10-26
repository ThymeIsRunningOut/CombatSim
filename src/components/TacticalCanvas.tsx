import React, { useRef, useEffect, useState } from 'react';
import { SimulationEngine } from '../engine/simulation';
import { CreatureRuntimeInstance, WeaponSlot, CreatureDef, WeaponDef, BuildingDef, CrewStance } from '../types/combat';
import { Target, Radio, Crosshair, RotateCcw, Timer, Gauge, Users, Shield, Swords, Heart, Box, Grid, Compass, Navigation } from 'lucide-react';
import { calculateAnalyticalTTK } from '../engine/analytics';
import { getBuildingSlotPosition } from '../engine/crew';
import { worldToDeckLocal, deckLocalToWorld, ARRIVAL_THRESHOLD_RADIUS } from '../engine/navigation';
import {
  CANVAS_TILE_SIZE_PX,
  metersToPx,
  pxToMeters,
  pxToUnrealUnits,
  METERS_PER_TILE,
  METERS_PER_KNOT,
  BEHEMOTH_LENGTH_METERS,
  BEHEMOTH_BEAM_METERS,
  BASE_NAUTICAL_SPEED_MPS,
  BASE_NAUTICAL_SPEED_UUPS,
  BASE_NAUTICAL_SPEED_KMH,
  normalizeSpeedToKnots,
  knotsSpeedToUnrealUnitsPerSec,
} from '../engine/measurements';
import { UnrealExportModal } from './UnrealExportModal';

interface TacticalCanvasProps {
  engine: SimulationEngine;
  onSelectCreature?: (creature: CreatureRuntimeInstance) => void;
  selectedCreatureId?: string;
  onSelectSlot?: (slot: WeaponSlot) => void;
  onSelectSlotId?: (slotId: string) => void;
  selectedSlotId?: string | null;
  creatures?: CreatureDef[];
  weapons?: WeaponDef[];
  buildings?: BuildingDef[];
  onSpawnCreature?: (creatureId: string) => void;
  onToggleCreatureFlying?: (creatureId: string) => void;
  onSetCrewStance?: (stance: CrewStance) => void;
}

export const TacticalCanvas: React.FC<TacticalCanvasProps> = ({
  engine,
  onSelectCreature,
  selectedCreatureId,
  onSelectSlot,
  onSelectSlotId,
  selectedSlotId,
  creatures,
  weapons,
  buildings,
  onSpawnCreature,
  onToggleCreatureFlying,
  onSetCrewStance,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // In-Game Measurements & Tiles display state
  const [showWorldTiles, setShowWorldTiles] = useState(true);
  const [showSubGrid, setShowSubGrid] = useState(true);
  const [showRangeRings, setShowRangeRings] = useState(true);
  const [showUnrealUnits, setShowUnrealUnits] = useState(false);
  const [isUnrealModalOpen, setIsUnrealModalOpen] = useState(false);

  const showWorldTilesRef = useRef(showWorldTiles);
  showWorldTilesRef.current = showWorldTiles;
  const showSubGridRef = useRef(showSubGrid);
  showSubGridRef.current = showSubGrid;
  const showRangeRingsRef = useRef(showRangeRings);
  showRangeRingsRef.current = showRangeRings;
  const showUnrealUnitsRef = useRef(showUnrealUnits);
  showUnrealUnitsRef.current = showUnrealUnits;

  // Camera Pan & Tracking State
  const cameraRef = useRef<{ x: number; y: number }>({
    x: engine.vesselCenter.x,
    y: engine.vesselCenter.y,
  });
  const isDraggingCameraRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const cameraStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // N-Key waypoint route creation & F-Key full stop
  const isHoldingNRef = useRef<boolean>(false);
  const isShiftPressedRef = useRef<boolean>(false);
  const hasOverriddenInThisHoldRef = useRef<boolean>(false);
  const [isHoldingNUI, setIsHoldingNUI] = useState<boolean>(false);
  const [isShiftActiveUI, setIsShiftActiveUI] = useState<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target?.tagName?.toLowerCase();
      // Only block hotkeys if typing in text input/textarea (NOT range sliders or buttons)
      const isTextInput =
        (tag === 'input' && !['range', 'checkbox', 'radio', 'button', 'color'].includes((target as HTMLInputElement).type)) ||
        tag === 'textarea' ||
        target?.isContentEditable;

      const isFKey = e.code === 'KeyF' || e.key === 'f' || e.key === 'F';
      const isNKey = e.code === 'KeyN' || e.key === 'n' || e.key === 'N';
      const isWKey = e.code === 'KeyW' || e.key === 'w' || e.key === 'W'; // Graceful fallback
      const isShiftKey = e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight';

      // Full Stop (F key): Behemoth stops moving, all waypoints vanish
      if (isFKey && !isTextInput && !e.repeat) {
        engine.fullStop();
        return;
      }

      if (isShiftKey) {
        isShiftPressedRef.current = true;
        setIsShiftActiveUI(true);
      }
      if ((isNKey || isWKey) && !isTextInput && !isHoldingNRef.current) {
        isHoldingNRef.current = true;
        isShiftPressedRef.current = e.shiftKey;
        hasOverriddenInThisHoldRef.current = false;
        setIsHoldingNUI(true);
        setIsShiftActiveUI(e.shiftKey);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const isShiftKey = e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight';
      const isNKey = e.code === 'KeyN' || e.key === 'n' || e.key === 'N';
      const isWKey = e.code === 'KeyW' || e.key === 'w' || e.key === 'W';

      if (isShiftKey) {
        isShiftPressedRef.current = false;
        setIsShiftActiveUI(false);
      }
      if (isNKey || isWKey) {
        isHoldingNRef.current = false;
        hasOverriddenInThisHoldRef.current = false;
        setIsHoldingNUI(false);
      }
    };

    const handleWindowBlur = () => {
      isHoldingNRef.current = false;
      isShiftPressedRef.current = false;
      hasOverriddenInThisHoldRef.current = false;
      setIsHoldingNUI(false);
      setIsShiftActiveUI(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [engine]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // 1. Clear background & oceanic radar grid
      ctx.fillStyle = '#040914';
      ctx.fillRect(0, 0, width, height);

      // Camera Lerp & Tracking
      const bX = engine.vesselCenter.x;
      const bY = engine.vesselCenter.y;

      if (!isDraggingCameraRef.current) {
        if (!engine.behemoth.isMoving) {
          // When stopped: smoothly lerp camera to Behemoth position
          cameraRef.current.x += (bX - cameraRef.current.x) * 0.08;
          cameraRef.current.y += (bY - cameraRef.current.y) * 0.08;
        } else {
          // While moving: camera stays free for player to pan,
          // but smoothly lerps to Behemoth once it starts moving away from canvas boundaries
          const screenBx = bX - cameraRef.current.x + width / 2;
          const screenBy = bY - cameraRef.current.y + height / 2;
          const marginX = 160;
          const marginY = 130;

          if (screenBx < marginX) {
            cameraRef.current.x += (bX - (marginX - width / 2) - cameraRef.current.x) * 0.08;
          } else if (screenBx > width - marginX) {
            cameraRef.current.x += (bX - (width - marginX - width / 2) - cameraRef.current.x) * 0.08;
          }

          if (screenBy < marginY) {
            cameraRef.current.y += (bY - (marginY - height / 2) - cameraRef.current.y) * 0.08;
          } else if (screenBy > height - marginY) {
            cameraRef.current.y += (bY - (height - marginY - height / 2) - cameraRef.current.y) * 0.08;
          }
        }
      }

      ctx.save();
      ctx.translate(width / 2 - cameraRef.current.x, height / 2 - cameraRef.current.y);

      const centerX = engine.vesselCenter.x;
      const centerY = engine.vesselCenter.y;
      const tileSize = CANVAS_TILE_SIZE_PX; // 693.3333 px = 1 Knot = 2.0 km = 200,000 UU

      // A. Render World Tiles Grid (1 World Tile = 1 Knot x 1 Knot = 2 km x 2 km)
      if (showWorldTilesRef.current) {
        ctx.save();
        const halfTile = tileSize / 2;
        const originX = 500 - halfTile;
        const originY = 310 - halfTile;

        // Render visible grid tiles based on camera view
        const minGx = Math.floor((cameraRef.current.x - width / 2 - originX) / tileSize) - 1;
        const maxGx = Math.ceil((cameraRef.current.x + width / 2 - originX) / tileSize) + 1;
        const minGy = Math.floor((cameraRef.current.y - height / 2 - originY) / tileSize) - 1;
        const maxGy = Math.ceil((cameraRef.current.y + height / 2 - originY) / tileSize) + 1;

        for (let gx = minGx; gx <= maxGx; gx++) {
          for (let gy = minGy; gy <= maxGy; gy++) {
            const tileLeft = originX + gx * tileSize;
            const tileTop = originY + gy * tileSize;
            const isCenterTile = gx === 0 && gy === 0;

            // Combat locus background subtle oceanic tint
            if (isCenterTile) {
              ctx.fillStyle = 'rgba(6, 182, 212, 0.035)';
              ctx.fillRect(tileLeft, tileTop, tileSize, tileSize);
            }

            // Sub-grid quadrants (500m = 0.25 Knots = 50,000 UU)
            if (showSubGridRef.current) {
              const subDivs = 4;
              const subStep = tileSize / subDivs;
              ctx.strokeStyle = isCenterTile ? 'rgba(6, 182, 212, 0.14)' : 'rgba(15, 23, 42, 0.55)';
              ctx.lineWidth = 0.8;
              ctx.setLineDash([2, 4]);

              for (let s = 1; s < subDivs; s++) {
                // Vertical sub-lines
                ctx.beginPath();
                ctx.moveTo(tileLeft + s * subStep, tileTop);
                ctx.lineTo(tileLeft + s * subStep, tileTop + tileSize);
                ctx.stroke();

                // Horizontal sub-lines
                ctx.beginPath();
                ctx.moveTo(tileLeft, tileTop + s * subStep);
                ctx.lineTo(tileLeft + tileSize, tileTop + s * subStep);
                ctx.stroke();
              }
              ctx.setLineDash([]);
            }

            // World Tile Outer Border (Dashed high-tech boundary)
            ctx.strokeStyle = isCenterTile ? 'rgba(6, 182, 212, 0.6)' : 'rgba(30, 58, 95, 0.45)';
            ctx.lineWidth = isCenterTile ? 1.5 : 1;
            ctx.setLineDash(isCenterTile ? [8, 6] : [4, 6]);
            ctx.strokeRect(tileLeft, tileTop, tileSize, tileSize);
            ctx.setLineDash([]);

            // High-tech corner L-brackets
            const bracketLen = 14;
            ctx.strokeStyle = isCenterTile ? '#38bdf8' : 'rgba(56, 189, 248, 0.35)';
            ctx.lineWidth = 1.8;

            // Top-left
            ctx.beginPath();
            ctx.moveTo(tileLeft, tileTop + bracketLen);
            ctx.lineTo(tileLeft, tileTop);
            ctx.lineTo(tileLeft + bracketLen, tileTop);
            ctx.stroke();

            // Top-right
            ctx.beginPath();
            ctx.moveTo(tileLeft + tileSize - bracketLen, tileTop);
            ctx.lineTo(tileLeft + tileSize, tileTop);
            ctx.lineTo(tileLeft + tileSize, tileTop + bracketLen);
            ctx.stroke();

            // Bottom-left
            ctx.beginPath();
            ctx.moveTo(tileLeft, tileTop + tileSize - bracketLen);
            ctx.lineTo(tileLeft, tileTop + tileSize);
            ctx.lineTo(tileLeft + bracketLen, tileTop + tileSize);
            ctx.stroke();

            // Bottom-right
            ctx.beginPath();
            ctx.moveTo(tileLeft + tileSize - bracketLen, tileTop + tileSize);
            ctx.lineTo(tileLeft + tileSize, tileTop + tileSize);
            ctx.lineTo(tileLeft + tileSize, tileTop + tileSize - bracketLen);
            ctx.stroke();

            // Tile Coordinate Header Badge
            ctx.font = 'bold 9px monospace';
            ctx.fillStyle = isCenterTile ? '#38bdf8' : 'rgba(148, 163, 184, 0.45)';
            const tileLabel = isCenterTile
              ? 'TILE [0, 0] • COMBAT SECTOR • 2.0 km x 2.0 km (1 KNOT²)'
              : `TILE [${gx > 0 ? '+' + gx : gx}, ${gy > 0 ? '+' + gy : gy}]`;
            ctx.fillText(tileLabel, tileLeft + 8, tileTop + 16);

            if (isCenterTile) {
              ctx.font = '8px monospace';
              ctx.fillStyle = 'rgba(56, 189, 248, 0.75)';
              if (showUnrealUnitsRef.current) {
                ctx.fillText('UNREAL: 200,000 x 200,000 UU • BEHEMOTH: 75,000 UU (750m)', tileLeft + 8, tileTop + 27);
                ctx.fillText('BASE NAUTICAL SPEED: 3,333 UU/s (1 KNOT/MIN)', tileLeft + 8, tileTop + tileSize - 10);
              } else {
                ctx.fillText('BEHEMOTH: 750m (0.375 KNOTS) • BASE SPEED: 1 KNOT/MIN (33.3 m/s)', tileLeft + 8, tileTop + 27);
                ctx.fillText('CANONICAL WORLD SCALE: 1 KNOT = 2.0 km (2,000m)', tileLeft + 8, tileTop + tileSize - 10);
              }
            }
          }
        }
        ctx.restore();
      }

      // B. Calibrated Range Rings (250m, 500m, 750m Behemoth length, 1.0km, 1.5km)
      if (showRangeRingsRef.current) {
        ctx.save();
        const rings = [
          { m: 250, label: '250m (0.125kt)', uu: '25,000 UU', color: '#0f2744', dash: [2, 4] },
          { m: 500, label: '500m (0.250kt)', uu: '50,000 UU', color: '#0f385c', dash: [] },
          { m: 750, label: '750m [BEHEMOTH HULL REF]', uu: '75,000 UU', color: 'rgba(245, 158, 11, 0.45)', dash: [6, 4] },
          { m: 1000, label: '1.0km (0.500kt / Half-Tile)', uu: '100,000 UU', color: '#0e7490', dash: [] },
          { m: 1500, label: '1.5km (0.750kt)', uu: '150,000 UU', color: '#0f2744', dash: [4, 4] },
        ];

        rings.forEach(({ m, label, uu, color, dash }) => {
          const r = metersToPx(m);
          ctx.beginPath();
          ctx.strokeStyle = color;
          ctx.lineWidth = m === 750 ? 1.5 : 1;
          ctx.setLineDash(dash);
          ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
          ctx.stroke();

          // Range Label
          ctx.font = '8px monospace';
          ctx.fillStyle = m === 750 ? '#f59e0b' : 'rgba(56, 189, 248, 0.65)';
          const text = showUnrealUnitsRef.current ? `${m}m (${uu})` : label;
          ctx.fillText(text, centerX + 6, centerY - r + 11);
        });
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Crosshairs
      ctx.strokeStyle = '#133257';
      ctx.beginPath();
      ctx.moveTo(centerX - 600, centerY);
      ctx.lineTo(centerX + 600, centerY);
      ctx.moveTo(centerX, centerY - 450);
      ctx.lineTo(centerX, centerY + 450);
      ctx.stroke();

      // Rotating Sonar Sweep Line
      const sweepAngle = (engine.timeElapsed * 1.5) % (Math.PI * 2);
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, 580, sweepAngle, sweepAngle + 0.25);
      ctx.closePath();
      const sweepGrad = ctx.createRadialGradient(centerX, centerY, 50, centerX, centerY, 580);
      sweepGrad.addColorStop(0, 'rgba(6, 182, 212, 0.08)');
      sweepGrad.addColorStop(1, 'rgba(6, 182, 212, 0.0)');
      ctx.fillStyle = sweepGrad;
      ctx.fill();

      // 2. Render Projectiles, Beams & Lingering Chemical Clouds
      for (const p of engine.projectiles) {
        if (p.isBeam) {
          // Continuous energy beam
          ctx.strokeStyle = p.color || '#a855f7';
          ctx.lineWidth = 4;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.moveTo(p.sourceX, p.sourceY);
          ctx.lineTo(p.targetX, p.targetY);
          ctx.stroke();
          ctx.shadowBlur = 0;
          continue;
        }

        if (p.isCloud) {
          // Acid cloud
          const rad = p.cloudRadius || 80;
          const alpha = Math.max(0.1, 1 - (p.cloudDuration || 0) / (p.cloudMaxDuration || 4.0));
          ctx.save();
          ctx.beginPath();
          ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(16, 185, 129, ${alpha * 0.35})`;
          ctx.fill();
          ctx.strokeStyle = `rgba(52, 211, 153, ${alpha * 0.6})`;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.restore();
          continue;
        }

        if (p.isExplosion) {
          // Detonation blast shockwave
          ctx.save();
          const lifetimeRatio = Math.max(0, (p.explosionLifetime || 0.35) / 0.35);
          const currentRadius = (p.explosionRadius || 85) * (1.2 - lifetimeRatio * 0.4);

          // Outer shockwave ring
          ctx.beginPath();
          ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(239, 68, 68, ${lifetimeRatio * 0.35})`;
          ctx.fill();
          ctx.strokeStyle = `rgba(251, 191, 36, ${lifetimeRatio * 0.85})`;
          ctx.lineWidth = 2.5 * lifetimeRatio;
          ctx.stroke();

          // Core flash
          ctx.beginPath();
          ctx.arc(p.x, p.y, currentRadius * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(254, 240, 138, ${lifetimeRatio * 0.5})`;
          ctx.fill();
          ctx.restore();
          continue;
        }

        if (p.trajectory === 'Arch') {
          // Ballistic mortar shell with arc shadow
          ctx.save();
          ctx.fillStyle = p.color || '#ef4444';
          ctx.beginPath();
          ctx.arc(p.x, p.y - Math.sin(p.arcProgress * Math.PI) * 45, 5, 0, Math.PI * 2);
          ctx.fill();

          // Ground/water shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          // Standard kinetic line projectile
          ctx.fillStyle = p.color || '#38bdf8';
          ctx.shadowColor = p.color || '#38bdf8';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // Helper function to render a creature (either non-flying under water or flying over boat)
      const renderCreature = (creature: CreatureRuntimeInstance, isFlyingLayer: boolean) => {
        const isSelected = selectedCreatureId === creature.id;

        // Render Aggro Radius ring
        ctx.save();
        ctx.strokeStyle = creature.aggression >= 60 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(234, 179, 8, 0.15)';
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        const def = engine.creatureDefs.get(creature.defId);
        const aggro = def ? def.aggroRadius : 400;
        ctx.arc(creature.x, creature.y, aggro, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Submerged transparency / water depth visual (for non-flying)
        const isUnderwater = !isFlyingLayer && creature.underwater;
        const opacity = isFlyingLayer ? 1.0 : (isUnderwater ? 0.55 : 0.9);

        // 3D Depth Scaling: 10% smaller when submerged in depth (0.90), 10% bigger when airborne/jumping over (1.10)
        const depthRatio = creature.depthRatio ?? (isUnderwater ? 1.0 : 0.0);
        const altitudeRatio = creature.altitudeRatio ?? (isFlyingLayer ? 1.0 : 0.0);
        const depthScale = isUnderwater
          ? 1.0 - 0.10 * depthRatio
          : (isFlyingLayer || altitudeRatio > 0)
          ? 1.0 + 0.10 * altitudeRatio
          : 1.0;

        // If flying / jumping over: draw an aerial drop-shadow on the water beneath it (scale & offset with altitude)
        if (isFlyingLayer || altitudeRatio > 0) {
          ctx.save();
          const altOffset = 10 + altitudeRatio * 16;
          ctx.fillStyle = `rgba(0, 0, 0, ${0.28 + altitudeRatio * 0.14})`;
          ctx.beginPath();
          if (creature.isSwarm && creature.swarmEntities) {
            for (const ent of creature.swarmEntities) {
              if (ent.hp <= 0) continue;
              ctx.ellipse(ent.x + altOffset * 0.4, ent.y + altOffset * 0.6, 4 * depthScale, 2.5 * depthScale, 0, 0, Math.PI * 2);
            }
          } else {
            ctx.ellipse(
              creature.x + altOffset * 0.6,
              creature.y + altOffset * 0.8,
              creature.radius * 0.85 * (1.0 - altitudeRatio * 0.1),
              creature.radius * 0.45 * (1.0 - altitudeRatio * 0.1),
              0,
              0,
              Math.PI * 2
            );
          }
          ctx.fill();
          ctx.restore();
        }

        // Submerged Sonar Depth Ripples & Dark Water Vignette (Continuous)
        if (isUnderwater) {
          ctx.save();
          // Animated concentric depth sonar ripples
          for (let ring = 0; ring < 3; ring++) {
            const wave = ((engine.timeElapsed * 24 + ring * 18) % 55);
            const waveAlpha = Math.max(0, 1 - wave / 55) * 0.65;
            ctx.strokeStyle = `rgba(56, 189, 248, ${waveAlpha})`;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.arc(creature.x, creature.y, (creature.radius + 6 + wave) * depthScale, 0, Math.PI * 2);
            ctx.stroke();
          }

          // Murky oceanic depth shadow vignette under the submerged creature
          const radGrad = ctx.createRadialGradient(creature.x, creature.y, 4, creature.x, creature.y, (creature.radius + 24) * depthScale);
          radGrad.addColorStop(0, 'rgba(8, 47, 73, 0.7)');
          radGrad.addColorStop(0.6, 'rgba(12, 74, 110, 0.35)');
          radGrad.addColorStop(1, 'rgba(2, 132, 199, 0)');
          ctx.fillStyle = radGrad;
          ctx.beginPath();
          ctx.arc(creature.x, creature.y, (creature.radius + 24) * depthScale, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Surface / Dive Splash Event VFX (Frothing foam burst & splash droplets)
        if (creature.splashTimer && creature.splashTimer > 0) {
          const s = 1.0 - creature.splashTimer / 0.8; // 0 -> 1
          const splashRadius = (creature.radius * 1.1) + s * 40;
          const splashAlpha = (1 - s) * 0.95;
          const isDive = creature.splashType === 'dive';

          ctx.save();
          // Primary expanding frothing shockwave
          ctx.strokeStyle = isDive ? `rgba(56, 189, 248, ${splashAlpha})` : `rgba(255, 255, 255, ${splashAlpha})`;
          ctx.lineWidth = 3.5 * (1 - s);
          ctx.shadowColor = isDive ? '#38bdf8' : '#ffffff';
          ctx.shadowBlur = 10 * (1 - s);
          ctx.beginPath();
          ctx.arc(creature.x, creature.y, splashRadius, 0, Math.PI * 2);
          ctx.stroke();

          // Secondary inner foam ripple
          ctx.strokeStyle = isDive ? `rgba(186, 230, 253, ${splashAlpha * 0.75})` : `rgba(147, 197, 253, ${splashAlpha * 0.75})`;
          ctx.lineWidth = 2 * (1 - s);
          ctx.beginPath();
          ctx.arc(creature.x, creature.y, splashRadius * 0.65, 0, Math.PI * 2);
          ctx.stroke();

          // Splash droplets bursting radially outward
          for (let i = 0; i < 8; i++) {
            const ang = (i * Math.PI) / 4 + s * 0.35;
            const px = creature.x + Math.cos(ang) * splashRadius;
            const py = creature.y + Math.sin(ang) * splashRadius;
            ctx.fillStyle = isDive ? `rgba(186, 230, 253, ${splashAlpha})` : `rgba(255, 255, 255, ${splashAlpha})`;
            ctx.beginPath();
            ctx.arc(px, py, 2.8 * (1 - s), 0, Math.PI * 2);
            ctx.fill();
          }

          // Floating splash banner
          ctx.font = 'bold 9px monospace';
          ctx.fillStyle = isDive ? '#38bdf8' : '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText(isDive ? '🌊 DIVE' : '⚡ BREACH / SURFACE', creature.x, creature.y - creature.radius - 26 - s * 14);
          ctx.restore();
        }

        // Damage Shockwave Pulse (Radiating out from creature when dealing damage)
        if (creature.damagePulseTimer && creature.damagePulseTimer > 0) {
          const p = 1.0 - creature.damagePulseTimer / 0.55; // 0 -> 1
          const pulseRadius = creature.radius + p * 65;
          const pulseAlpha = (1 - p) * 0.9;
          const pulseColor = creature.damagePulseColor || '#ef4444';

          ctx.save();
          // Concentric kinetic shockwave
          ctx.strokeStyle = pulseColor;
          ctx.globalAlpha = pulseAlpha;
          ctx.lineWidth = 3.5 * (1 - p * 0.5);
          ctx.shadowColor = pulseColor;
          ctx.shadowBlur = 14 * (1 - p);
          ctx.beginPath();
          ctx.arc(creature.x, creature.y, pulseRadius, 0, Math.PI * 2);
          ctx.stroke();

          // Inner energy flash wash
          ctx.fillStyle = pulseColor;
          ctx.globalAlpha = pulseAlpha * 0.22;
          ctx.beginPath();
          ctx.arc(creature.x, creature.y, pulseRadius, 0, Math.PI * 2);
          ctx.fill();

          // Secondary inner ripple
          ctx.strokeStyle = '#f59e0b';
          ctx.globalAlpha = pulseAlpha * 0.65;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(creature.x, creature.y, pulseRadius * 0.6, 0, Math.PI * 2);
          ctx.stroke();

          // Impact starburst spikes
          for (let i = 0; i < 6; i++) {
            const spikeAng = (i * Math.PI) / 3 + p * 0.8;
            const sx1 = creature.x + Math.cos(spikeAng) * (pulseRadius - 8);
            const sy1 = creature.y + Math.sin(spikeAng) * (pulseRadius - 8);
            const sx2 = creature.x + Math.cos(spikeAng) * (pulseRadius + 12);
            const sy2 = creature.y + Math.sin(spikeAng) * (pulseRadius + 12);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2 * (1 - p);
            ctx.beginPath();
            ctx.moveTo(sx1, sy1);
            ctx.lineTo(sx2, sy2);
            ctx.stroke();
          }
          ctx.restore();
        }

        ctx.save();
        ctx.globalAlpha = opacity;

        if (creature.isSwarm && creature.swarmEntities) {
          // Draw Swarmers (scaled by depth)
          const swarmerRadius = (creature.swarmEntities.length > 50 ? 3.5 : creature.swarmEntities.length > 25 ? 4.5 : 6) * depthScale;
          for (let i = 0; i < creature.swarmEntities.length; i++) {
            const ent = creature.swarmEntities[i];
            if (ent.hp <= 0) continue;
            ctx.fillStyle = creature.color;
            ctx.beginPath();
            ctx.arc(ent.x, ent.y, swarmerRadius, 0, Math.PI * 2);
            ctx.fill();

            // Wing flutter outline for flying swarmers
            if (isFlyingLayer) {
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.arc(ent.x, ent.y, swarmerRadius + 1.5, 0, Math.PI);
              ctx.stroke();
            }

            // Individual creature heading indicator based on entity velocity vector
            const entHeading = (ent.vx !== undefined && ent.vy !== undefined && (ent.vx !== 0 || ent.vy !== 0))
              ? Math.atan2(ent.vy, ent.vx)
              : (creature.angle * Math.PI) / 180;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(ent.x, ent.y);
            ctx.lineTo(ent.x + Math.cos(entHeading) * (swarmerRadius + 4), ent.y + Math.sin(entHeading) * (swarmerRadius + 4));
            ctx.stroke();
          }
        } else {
          // Draw Large Creature body (with 3D depth scale and turning dynamics)
          ctx.save();
          ctx.translate(creature.x, creature.y);
          ctx.rotate((creature.angle * Math.PI) / 180);
          ctx.scale(depthScale, depthScale);

          // Calculate turning factor (-1 to +1) based on real-time angular velocity
          const turnFactor = Math.max(-1, Math.min(1, (creature.turnRate || 0) / 75));
          const isTurning = Math.abs(turnFactor) > 0.12;
          const tailBend = turnFactor * creature.radius * 0.45;

          // Titan Body with dynamic spine/tail flex into turn
          ctx.fillStyle = creature.color;
          ctx.beginPath();
          ctx.moveTo(creature.radius * 1.3, 0); // Nose/head
          ctx.lineTo(-creature.radius * 0.9, -creature.radius * 0.8 + tailBend * 0.3);
          ctx.lineTo(-creature.radius * 0.4, tailBend * 0.6);
          ctx.lineTo(-creature.radius * 0.9, creature.radius * 0.8 + tailBend * 0.3);
          ctx.closePath();
          ctx.fill();

          // Flight wings / pectoral hydrofoils with dynamic banking tilt
          if (isFlyingLayer || creature.defId === 'thunder_leviarch') {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
            // Left wing (banks up/extends if turning right, banks down if turning left)
            const leftWingSpan = creature.radius * (1.3 + (turnFactor > 0 ? 0.35 : -0.25) * Math.abs(turnFactor));
            ctx.beginPath();
            ctx.moveTo(0, -creature.radius * 0.6);
            ctx.lineTo(-creature.radius * 0.4, -leftWingSpan);
            ctx.lineTo(-creature.radius * 0.7, -creature.radius * 0.6);
            ctx.closePath();
            ctx.fill();

            // Right wing (banks down if turning right, banks up/extends if turning left)
            const rightWingSpan = creature.radius * (1.3 + (turnFactor < 0 ? 0.35 : -0.25) * Math.abs(turnFactor));
            ctx.beginPath();
            ctx.moveTo(0, creature.radius * 0.6);
            ctx.lineTo(-creature.radius * 0.4, rightWingSpan);
            ctx.lineTo(-creature.radius * 0.7, creature.radius * 0.6);
            ctx.closePath();
            ctx.fill();
          }

          // Hydrodynamic / Aerodynamic Turn Trails (Electric cyan cavitation vortex arcs)
          if (isTurning) {
            ctx.save();
            const vortexAlpha = Math.min(1.0, Math.abs(turnFactor) * 0.95);
            ctx.strokeStyle = `rgba(56, 189, 248, ${vortexAlpha})`;
            ctx.lineWidth = 2.5;
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 10;

            // Wingtip vortex curving into turn direction
            const outerWingY = turnFactor > 0 ? -creature.radius * 1.5 : creature.radius * 1.5;
            ctx.beginPath();
            ctx.moveTo(-creature.radius * 0.4, outerWingY);
            ctx.quadraticCurveTo(
              -creature.radius * 1.5,
              outerWingY + turnFactor * 12,
              -creature.radius * 2.2,
              outerWingY + turnFactor * 28
            );
            ctx.stroke();

            // Tail rudder wake
            ctx.beginPath();
            ctx.moveTo(-creature.radius * 0.9, tailBend);
            ctx.quadraticCurveTo(
              -creature.radius * 1.6,
              tailBend * 1.6,
              -creature.radius * 2.4,
              tailBend * 2.4
            );
            ctx.stroke();
            ctx.restore();
          }

          ctx.strokeStyle = isSelected ? '#ffffff' : (isFlyingLayer ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.4)');
          ctx.lineWidth = isSelected ? 2.5 : 1.2;
          ctx.stroke();

          // Non-Swarm Custom Marker Emoji (drawn on creature center, oriented upright)
          if (creature.emoji) {
            ctx.save();
            ctx.rotate(-((creature.angle * Math.PI) / 180));
            const emojiSize = Math.max(14, Math.round(creature.radius * 0.95));
            ctx.font = `${emojiSize}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(creature.emoji, 0, 0);
            ctx.restore();
          }

          ctx.restore();
        }

        // Submerged ripple / surfacing warning ring (for non-flying aquatic)
        if (isUnderwater) {
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(creature.x, creature.y, creature.radius + 10, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Leviarch Over-Deck Hover & Building Bombard VFX
        const inHullX = Math.abs(creature.x - engine.vesselCenter.x) <= engine.vesselCenter.width / 2 + 25;
        const inHullY = Math.abs(creature.y - engine.vesselCenter.y) <= engine.vesselCenter.height / 2 + 25;
        const isHoveringDeck = creature.isHoveringDeck ?? (creature.isFlying && inHullX && inHullY);
        const isScrapingHull = creature.isScrapingHull ?? ((creature.underwater || !creature.isFlying) && inHullX && inHullY);

        if (creature.defId === 'thunder_leviarch' && isFlyingLayer && isHoveringDeck) {
          ctx.save();
          // Plasma ground illumination ring on deck
          ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
          ctx.beginPath();
          ctx.ellipse(creature.x, creature.y + 10, creature.radius * 1.5, creature.radius * 0.9, 0, 0, Math.PI * 2);
          ctx.fill();

          // Jagged lightning arcs leaping from Leviarch belly down to deck modules
          const time = Date.now() / 140;
          for (let arc = 0; arc < 2; arc++) {
            ctx.strokeStyle = arc === 0 ? '#38bdf8' : '#facc15';
            ctx.lineWidth = 1.8;
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(creature.x, creature.y);
            const targetDeckY = creature.y + creature.radius * 1.4;
            const midX1 = creature.x + Math.sin(time + arc * 2) * 16;
            const midY1 = creature.y + (targetDeckY - creature.y) * 0.35;
            const midX2 = creature.x + Math.cos(time * 1.5 + arc) * 20;
            const midY2 = creature.y + (targetDeckY - creature.y) * 0.7;
            const endX = creature.x + Math.sin(time * 2.2 + arc) * 24;
            ctx.lineTo(midX1, midY1);
            ctx.lineTo(midX2, midY2);
            ctx.lineTo(endX, targetDeckY);
            ctx.stroke();
          }

          // Hover status badge
          ctx.font = 'bold 8px monospace';
          ctx.fillStyle = '#facc15';
          ctx.textAlign = 'center';
          ctx.fillText('⚡ HOVERING OVER DECK [TARGETING BUILDINGS]', creature.x, creature.y - creature.radius - 34);
          ctx.restore();
        }

        // Leviarch Under-Hull Keel Scrape VFX
        if (creature.defId === 'thunder_leviarch' && !isFlyingLayer && isScrapingHull) {
          ctx.save();
          const time = Date.now() / 70;
          // Grinding friction heat glow along keel
          ctx.fillStyle = 'rgba(249, 115, 22, 0.28)';
          ctx.beginPath();
          ctx.arc(creature.x, creature.y, creature.radius * 1.4, 0, Math.PI * 2);
          ctx.fill();

          // High-velocity friction sparks spraying backwards from hull contact
          for (let i = 0; i < 7; i++) {
            const sparkAng = (creature.angle * Math.PI) / 180 + Math.PI + (Math.sin(time + i) * 0.6);
            const sparkDist = creature.radius * 0.8 + ((time * 15 + i * 9) % 35);
            const sx = creature.x + Math.cos(sparkAng) * sparkDist;
            const sy = creature.y + Math.sin(sparkAng) * sparkDist;
            ctx.fillStyle = i % 2 === 0 ? '#f59e0b' : '#ef4444';
            ctx.beginPath();
            ctx.arc(sx, sy, 2.2 - (i % 2) * 0.8, 0, Math.PI * 2);
            ctx.fill();
          }

          // Scrape status badge
          ctx.font = 'bold 8px monospace';
          ctx.fillStyle = '#f97316';
          ctx.textAlign = 'center';
          ctx.fillText('🔥 SCRAPING HULL KEEL', creature.x, creature.y + creature.radius + 24);
          ctx.restore();
        }

        // Target Link Line (if aiming at a slot)
        if (creature.targetSlotId && creature.aggression >= 60) {
          const slot = engine.behemoth.slots.find((s) => s.id === creature.targetSlotId);
          if (slot) {
            const slotWorldX = engine.vesselCenter.x - engine.vesselCenter.width / 2 + slot.positionX * engine.vesselCenter.width;
            const slotWorldY = slot.row === 'port' ? engine.vesselCenter.y - engine.vesselCenter.height / 2 : engine.vesselCenter.y + engine.vesselCenter.height / 2;
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 4]);
            ctx.beginPath();
            ctx.moveTo(creature.x, creature.y);
            ctx.lineTo(slotWorldX, slotWorldY);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }

        // Floating Creature Status HUD (HP & Aggression Meter)
        const hudY = creature.y - creature.radius - 22;
        const totalMax = creature.maxHp + creature.maxPhysicalArmor;
        const currentTotal = creature.hp + creature.physicalArmor;
        const hpPercent = Math.max(0, currentTotal / totalMax);

        // Armor + HP bar
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(creature.x - 30, hudY, 60, 6);
        ctx.fillStyle = creature.physicalArmor > 0 ? '#38bdf8' : '#ef4444';
        ctx.fillRect(creature.x - 30, hudY, 60 * hpPercent, 6);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.strokeRect(creature.x - 30, hudY, 60, 6);

        // Aggression Meter Badge
        const aggroColor = creature.aggression < 40 ? '#38bdf8' : creature.aggression < 60 ? '#f59e0b' : '#ef4444';
        const typeLabel = isFlyingLayer ? 'FLYING' : (creature.underwater ? 'SUBMERGED' : 'AQUATIC');

        // Threat Label & Marker Emoji Badge
        if (!creature.isSwarm && creature.emoji) {
          ctx.font = 'bold 10px monospace';
          ctx.fillStyle = '#f8fafc';
          ctx.textAlign = 'center';
          ctx.fillText(`${creature.emoji} ${creature.name.toUpperCase()}`, creature.x, hudY - 14);
        }

        const kts = def ? normalizeSpeedToKnots(def.movementSpeed) : 10;
        const distM = Math.round(pxToMeters(Math.hypot(creature.x - centerX, creature.y - centerY)));
        const speedText = showUnrealUnitsRef.current
          ? `${Math.round(knotsSpeedToUnrealUnitsPerSec(kts)).toLocaleString()} UU/s`
          : `${kts} kts`;

        ctx.font = '9px monospace';
        ctx.fillStyle = aggroColor;
        ctx.textAlign = 'left';
        ctx.fillText(`AGG ${Math.round(creature.aggression)}% [${typeLabel}] • ${speedText} • ${distM}m`, creature.x - 45, hudY - 4);

        // Benchmark Target Calibration Reticle
        if (engine.benchmarkMode && creature.isBenchmarkTarget) {
          ctx.save();
          ctx.strokeStyle = '#22d3ee';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(creature.x, creature.y, creature.radius + 15, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.beginPath();
          ctx.moveTo(creature.x - creature.radius - 22, creature.y);
          ctx.lineTo(creature.x + creature.radius + 22, creature.y);
          ctx.moveTo(creature.x, creature.y - creature.radius - 22);
          ctx.lineTo(creature.x, creature.y + creature.radius + 22);
          ctx.stroke();

          ctx.font = 'bold 9px monospace';
          ctx.fillStyle = '#22d3ee';
          ctx.fillText('CALIBRATION TARGET [LOCKED]', creature.x - 70, creature.y + creature.radius + 28);
          ctx.restore();
        }

        ctx.restore();
      };

      // 3. Render Non-Flying Creatures (Aquatic: renders UNDER water & beneath boat)
      for (const creature of engine.creatures) {
        if (!creature.isFlying) {
          renderCreature(creature, false);
        }
      }

      // 4. Render The Behemoth Vessel (Rectangular Grid)
      ctx.save();
      ctx.translate(engine.vesselCenter.x, engine.vesselCenter.y);
      ctx.rotate(((engine.behemoth.heading || 0) * Math.PI) / 180);
      const vW = engine.vesselCenter.width;
      const vH = engine.vesselCenter.height;
      const vX = -vW / 2;
      const vY = -vH / 2;
      const deckCenterY = 0;

      // Vessel Shadow & Hull
      ctx.fillStyle = '#091526';
      ctx.fillRect(vX - 4, vY - 4, vW + 8, vH + 8);

      // Main Deck Armor Plate
      const hullGrad = ctx.createLinearGradient(vX, vY, vX, vY + vH);
      hullGrad.addColorStop(0, '#1e293b');
      hullGrad.addColorStop(0.5, '#334155');
      hullGrad.addColorStop(1, '#1e293b');
      ctx.fillStyle = hullGrad;
      ctx.fillRect(vX, vY, vW, vH);

      // Hull Damage Red Blink / Flash when struck by creature
      const isHullHit = (engine.behemoth.hullHitFlash || 0) > 0;
      if (isHullHit) {
        const hFlashAlpha = Math.min(1.0, (engine.behemoth.hullHitFlash || 0) / 0.35);
        ctx.fillStyle = `rgba(239, 68, 68, ${0.45 * hFlashAlpha})`;
        ctx.fillRect(vX, vY, vW, vH);
        ctx.strokeStyle = '#ef4444';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 16;
        ctx.lineWidth = 3;
        ctx.strokeRect(vX, vY, vW, vH);
        ctx.shadowBlur = 0;
      } else {
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 2;
        ctx.strokeRect(vX, vY, vW, vH);
      }

      // Walkway Corridors (Central Promenade & Cross-Aisles)
      ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
      ctx.fillRect(vX + 20, deckCenterY - 4.5, vW - 40, 9);

      // Vertical Cross-Corridors between building columns
      const crossAisleXs = [vX + 72, vX + 124, vX + 176];
      for (const aisleX of crossAisleXs) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
        ctx.fillRect(aisleX - 6, vY + 22, 12, vH - 44);

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.strokeRect(aisleX - 6, vY + 22, 12, vH - 44);
        ctx.setLineDash([]);
      }

      // Deck Centerline (divider inside central promenade)
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(vX + 20, deckCenterY);
      ctx.lineTo(vX + vW - 20, deckCenterY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Vessel Bow / Stern Arrow
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(vX + vW + 15, deckCenterY);
      ctx.lineTo(vX + vW, deckCenterY - 25);
      ctx.lineTo(vX + vW, deckCenterY + 25);
      ctx.closePath();
      ctx.fill();

      // Render Defense Slots & Firing Arc Gizmos
      for (const slot of engine.behemoth.slots) {
        const slotX = vX + slot.positionX * vW;
        const slotY = slot.row === 'port' ? vY + 18 : vY + vH - 18;
        const isWeaponSelected = selectedSlotId === slot.id;

        // Firing Arc Gizmo (if weapon exists)
        if (slot.weapon) {
          ctx.save();
          const defaultFacing = slot.row === 'port' ? 270 : 90;
          const rotationCap = slot.rotationCap ?? slot.weapon.rotationCap ?? 225;
          const effectiveArc = Math.min(slot.weapon.shootingArc, rotationCap);
          const halfArcRad = ((effectiveArc / 2) * Math.PI) / 180;
          const facingRad = (defaultFacing * Math.PI) / 180;

          ctx.beginPath();
          ctx.moveTo(slotX, slotY);
          ctx.arc(slotX, slotY, slot.weapon.range * 0.45, facingRad - halfArcRad, facingRad + halfArcRad);
          ctx.closePath();
          ctx.fillStyle = slot.isFiring ? 'rgba(56, 189, 248, 0.08)' : 'rgba(56, 189, 248, 0.02)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.restore();
        }

        // Slot Pad
        const isHitFlashing = (slot.hitFlashTimer || 0) > 0;
        ctx.fillStyle = isHitFlashing
          ? '#dc2626'
          : slot.isStunned
          ? '#78350f'
          : slot.weapon
          ? '#0369a1'
          : '#0f172a';
        ctx.fillRect(slotX - 10, slotY - 10, 20, 20);

        ctx.strokeStyle = isHitFlashing
          ? '#ef4444'
          : isWeaponSelected
          ? '#22d3ee'
          : slot.isFiring
          ? '#38bdf8'
          : '#0284c7';
        ctx.lineWidth = isHitFlashing ? 3 : isWeaponSelected ? 2.5 : slot.isFiring ? 2 : 1;
        if (isHitFlashing) {
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 12;
        } else if (isWeaponSelected) {
          ctx.shadowColor = '#22d3ee';
          ctx.shadowBlur = 8;
        }
        ctx.strokeRect(slotX - 10, slotY - 10, 20, 20);
        ctx.shadowBlur = 0;

        // Turret Barrel (pointing at current aim angle)
        if (slot.weapon) {
          ctx.save();
          ctx.translate(slotX, slotY);
          const localAimAngle = slot.currentAimAngle - (engine.behemoth.heading || 0);
          ctx.rotate((localAimAngle * Math.PI) / 180);
          ctx.fillStyle = slot.weapon.color;
          ctx.fillRect(0, -3, 14, 6);
          ctx.restore();
        }
      }

      // Render 2 Rows of Non-Combat Buildings on Deck (between weapon mounts)
      for (const slot of engine.behemoth.buildingSlots) {
        const bPos = getBuildingSlotPosition(slot, { x: 0, y: 0, width: vW, height: vH });
        const b = slot.building;
        const isDestroyed = slot.health <= 0;
        const isStunned = slot.isStunned;
        const isSelected = selectedSlotId === slot.id;

        ctx.save();
        const padX = bPos.x - bPos.width / 2;
        const padY = bPos.y - bPos.height / 2;

        // Base foundation pad
        const isHitFlashing = (slot.hitFlashTimer || 0) > 0;
        ctx.fillStyle = isHitFlashing
          ? 'rgba(220, 38, 38, 0.95)'
          : isDestroyed
          ? 'rgba(69, 10, 10, 0.9)'
          : isStunned
          ? 'rgba(120, 53, 15, 0.9)'
          : b
          ? 'rgba(15, 23, 42, 0.95)'
          : 'rgba(15, 23, 42, 0.55)';
        ctx.fillRect(padX, padY, bPos.width, bPos.height);

        // Border color based on category / role
        const catColor = b
          ? b.category === 'housing'
            ? '#10b981'
            : b.category === 'energy'
            ? '#f59e0b'
            : b.category === 'production'
            ? '#38bdf8'
            : '#ec4899'
          : '#334155';
        ctx.strokeStyle = isHitFlashing ? '#ef4444' : isDestroyed ? '#ef4444' : isStunned ? '#f59e0b' : catColor;
        ctx.lineWidth = isHitFlashing ? 2.5 : 1;
        if (isHitFlashing) {
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 12;
        }
        ctx.strokeRect(padX, padY, bPos.width, bPos.height);
        ctx.shadowBlur = 0;

        // Interior roof & building structure detailing
        if (b && !isDestroyed) {
          ctx.fillStyle = isStunned ? 'rgba(245, 158, 11, 0.12)' : 'rgba(56, 189, 248, 0.08)';
          ctx.fillRect(padX + 2, padY + 2, bPos.width - 4, bPos.height - 4);

          // Roof decorative line
          ctx.fillStyle = catColor;
          ctx.fillRect(padX + 2, padY + 2, bPos.width - 4, 1.5);

          // Health mini-bar along bottom edge
          const hpRatio = Math.max(0, Math.min(1, slot.health / slot.maxHealth));
          ctx.fillStyle = hpRatio > 0.5 ? '#10b981' : hpRatio > 0.25 ? '#f59e0b' : '#ef4444';
          ctx.fillRect(
            padX + 2,
            padY + bPos.height - 3,
            (bPos.width - 4) * hpRatio,
            1.5
          );
        }

        // Building short name label - formatted cleanly to fit slot
        ctx.font = 'bold 7px monospace';
        ctx.fillStyle = isDestroyed ? '#ef4444' : isStunned ? '#f59e0b' : '#cbd5e1';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = b
          ? b.name.length > 6 ? b.name.slice(0, 6).toUpperCase() : b.name.toUpperCase()
          : `SLOT ${slot.slotIndex + 1}`;
        ctx.fillText(label, bPos.x, bPos.y - (b ? 0.5 : 0));

        // Crew occupancy indicator
        const shelteredHere = engine.crewAgents.filter(
          (a) => a.status === 'hidden' && a.hiddenInSlotId === slot.id
        ).length;
        const totalHere = slot.assignedCrew + shelteredHere;
        if (totalHere > 0) {
          ctx.fillStyle = shelteredHere > 0 ? '#10b981' : '#38bdf8';
          ctx.beginPath();
          ctx.arc(padX + bPos.width - 4, padY + 4, 2, 0, Math.PI * 2);
          ctx.fill();
        }

        // Selection highlight ring when clicked or selected in HUD
        if (isSelected) {
          ctx.strokeStyle = '#22d3ee';
          ctx.lineWidth = 2;
          ctx.shadowColor = '#22d3ee';
          ctx.shadowBlur = 8;
          ctx.strokeRect(padX - 2, padY - 2, bPos.width + 4, bPos.height + 4);
        }

        ctx.restore();
      }

      // Render Crew Members on Deck (Parented to Ship: translated & rotated with Behemoth)
      for (const agent of engine.crewAgents) {
        // Hidden crew are inside buildings, snatched are carried away off-deck
        if (agent.status === 'hidden' || agent.status === 'snatched') continue;

        ctx.save();
        let speckColor = '#e2e8f0'; // Default slate-white speck
        let speckRadius = 1.2;

        if (agent.status === 'attacking') {
          speckColor = '#fbbf24'; // Attacking with PDW (gold)
          speckRadius = 1.4;
        } else if (agent.status === 'fleeing') {
          speckColor = '#f87171'; // Fleeing from threat (red alert)
          speckRadius = 1.3;
        } else if (agent.status === 'seeking_shelter') {
          speckColor = '#34d399'; // Running toward housing shelter (emerald)
          speckRadius = 1.3;
        }

        ctx.fillStyle = speckColor;
        ctx.beginPath();
        ctx.arc(agent.x, agent.y, speckRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      ctx.restore(); // End Behemoth Vessel Deck Rotation

      // Render Snatched Crew Members carried away by flying predators (in world space)
      for (const agent of engine.crewAgents) {
        if (agent.status !== 'snatched') continue;

        const worldPos = deckLocalToWorld(agent.x, agent.y, engine.vesselCenter, engine.behemoth.heading || 0);
        ctx.save();
        // Struggle aura
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(worldPos.x, worldPos.y, 4, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#f43f5e'; // Snatched (bright rose)
        ctx.beginPath();
        ctx.arc(worldPos.x, worldPos.y, 2.0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      // Render Crew PDW Shots / Tracers
      for (const shot of engine.pdwShots) {
        ctx.save();
        ctx.strokeStyle = shot.color || '#38bdf8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(shot.sourceX, shot.sourceY);
        ctx.lineTo(shot.targetX, shot.targetY);
        ctx.stroke();

        // Small muzzle spark
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(shot.sourceX, shot.sourceY, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 4.5. Render Flying Creatures & Aerial Swarms (OVER THE BOAT)
      for (const creature of engine.creatures) {
        if (creature.isFlying) {
          renderCreature(creature, true);
        }
      }

      // 4.6. Render Navigation Route & Waypoints (World Overlay)
      const wps = engine.behemoth.waypoints;
      const pts = engine.behemoth.pathPoints;
      const isReversing = engine.behemoth.isReversing;

      if (wps.length > 0 || pts.length > 0) {
        // Draw smoothed path curve with rounded corners
        if (pts.length > 1) {
          ctx.save();
          ctx.beginPath();
          // Connect path start from vessel's active pivot (bow for forward, stern for reverse)
          const startPt = isReversing ? engine.getSternPosition() : engine.getBowPosition();
          ctx.moveTo(startPt.x, startPt.y);
          for (let i = 0; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
          }
          // Glowing path effect
          ctx.strokeStyle = isReversing ? 'rgba(245, 158, 11, 0.25)' : 'rgba(6, 182, 212, 0.25)';
          ctx.lineWidth = 6;
          ctx.stroke();

          ctx.strokeStyle = isReversing ? '#f59e0b' : '#38bdf8';
          ctx.lineWidth = 2;
          ctx.setLineDash(isReversing ? [4, 4] : [6, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }

        // Draw Waypoint Markers
        ctx.save();
        wps.forEach((wp, idx) => {
          const isFinal = idx === wps.length - 1;
          const isCurrentTarget = idx === 0;

          // Arrival Threshold Radius zone (5-10 units / 35px)
          ctx.beginPath();
          ctx.arc(wp.x, wp.y, ARRIVAL_THRESHOLD_RADIUS, 0, Math.PI * 2);
          ctx.fillStyle = isCurrentTarget
            ? isReversing ? 'rgba(245, 158, 11, 0.08)' : 'rgba(56, 189, 248, 0.08)'
            : 'rgba(100, 116, 139, 0.04)';
          ctx.fill();
          ctx.strokeStyle = isCurrentTarget
            ? isReversing ? 'rgba(245, 158, 11, 0.45)' : 'rgba(56, 189, 248, 0.45)'
            : 'rgba(100, 116, 139, 0.25)';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 4]);
          ctx.stroke();
          ctx.setLineDash([]);

          // Outer beacon ring
          ctx.beginPath();
          ctx.arc(wp.x, wp.y, isFinal ? 10 : 7, 0, Math.PI * 2);
          ctx.fillStyle = isFinal ? 'rgba(245, 158, 11, 0.25)' : 'rgba(56, 189, 248, 0.2)';
          ctx.fill();
          ctx.strokeStyle = isFinal ? '#f59e0b' : '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Center diamond
          ctx.beginPath();
          const r = isFinal ? 5 : 3.5;
          ctx.moveTo(wp.x, wp.y - r);
          ctx.lineTo(wp.x + r, wp.y);
          ctx.lineTo(wp.x, wp.y + r);
          ctx.lineTo(wp.x - r, wp.y);
          ctx.closePath();
          ctx.fillStyle = isFinal ? '#fbbf24' : '#0284c7';
          ctx.fill();

          // WP badge label
          ctx.font = 'bold 9px monospace';
          ctx.fillStyle = isFinal ? '#fef08a' : '#bae6fd';
          const wpLabel = isFinal ? `WP ${idx + 1} (END)` : `WP ${idx + 1}`;
          ctx.fillText(wpLabel, wp.x + 9, wp.y - 5);
        });
        ctx.restore();
      }

      ctx.restore(); // End Camera Transform

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [engine, selectedCreatureId, selectedSlotId]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // Convert screen click to world coordinates
    const clickWorldX = clickX - canvas.width / 2 + cameraRef.current.x;
    const clickWorldY = clickY - canvas.height / 2 + cameraRef.current.y;

    // A. If holding N (or W fallback): place waypoint along route
    if (isHoldingNRef.current) {
      // Each new N-hold replaces the previous route on its first click.
      // Subsequent clicks within the same N-hold extend that route.
      const shouldOverride = !hasOverriddenInThisHoldRef.current;
      hasOverriddenInThisHoldRef.current = true;
      engine.addWaypoint({ x: clickWorldX, y: clickWorldY }, shouldOverride);
      return;
    }

    // Convert clickWorld to vessel local coordinates for accurate deck selection
    const vW = engine.vesselCenter.width;
    const vH = engine.vesselCenter.height;
    const local = worldToDeckLocal(clickWorldX, clickWorldY, engine.vesselCenter, engine.behemoth.heading);

    // 1. Check click on weapon mount slots on deck (and their firing gizmos) FIRST
    // Prevents flying/swimming creatures near the hull from hijacking weapon slot selection
    for (const slot of engine.behemoth.slots) {
      const slotX = -vW / 2 + slot.positionX * vW;
      const slotY = slot.row === 'port' ? -27 : 27;
      if (Math.abs(local.x - slotX) <= 14 && Math.abs(local.y - slotY) <= 14) {
        if (onSelectSlotId) onSelectSlotId(slot.id);
        if (onSelectSlot) onSelectSlot(slot);
        return;
      }
    }

    // 2. Check click on non-combat building slots on deck
    for (const slot of engine.behemoth.buildingSlots) {
      const bPos = getBuildingSlotPosition(slot, { x: 0, y: 0, width: vW, height: vH });
      const halfW = bPos.width / 2 + 4;
      const halfH = bPos.height / 2 + 4;
      if (
        local.x >= bPos.x - halfW &&
        local.x <= bPos.x + halfW &&
        local.y >= bPos.y - halfH &&
        local.y <= bPos.y + halfH
      ) {
        if (onSelectSlotId) onSelectSlotId(slot.id);
        if (onSelectSlot) onSelectSlot({ id: slot.id } as any);
        return;
      }
    }

    // 3. Check click on creatures (flying or aquatic)
    for (const c of engine.creatures) {
      const d = Math.hypot(c.x - clickWorldX, c.y - clickWorldY);
      if (d <= c.radius + 15) {
        if (onSelectCreature) onSelectCreature(c);
        return;
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Release focus from any input/slider/button so tactical shortcuts remain responsive
    if (document.activeElement && (document.activeElement as HTMLElement).blur) {
      (document.activeElement as HTMLElement).blur();
    }
    if (e.button === 2) {
      // RMB drag camera pan
      isDraggingCameraRef.current = true;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      cameraStartRef.current = { ...cameraRef.current };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingCameraRef.current) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const dx = (e.clientX - dragStartRef.current.x) * scaleX;
      const dy = (e.clientY - dragStartRef.current.y) * scaleY;
      cameraRef.current.x = cameraStartRef.current.x - dx;
      cameraRef.current.y = cameraStartRef.current.y - dy;
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 2) {
      isDraggingCameraRef.current = false;
    }
  };

  const activeThreatDefId = engine.creatures.length > 0 ? engine.creatures[0].defId : null;
  const primarySlot = engine.behemoth.slots.find((s) => s.weapon !== null);
  const primaryWeapon = primarySlot?.weapon;

  const activeBenchmarkDefId = engine.benchmarkTargetDefId || activeThreatDefId || (creatures && creatures.length > 0 ? creatures[0].id : null);
  const activeCreatureDef = creatures?.find((c) => c.id === activeBenchmarkDefId);
  let benchmarkTheoTtk: number | null = null;
  if (primaryWeapon && activeCreatureDef) {
    const ana = calculateAnalyticalTTK(primaryWeapon, activeCreatureDef, 'theoretical');
    benchmarkTheoTtk = ana.timeToKillSeconds;
  }

  // Live Crew Status & Average Health calculations
  const totalCrew = engine.behemoth.crew;
  const maxCrew = engine.behemoth.maxCrew;
  const shelteredCrew = engine.crewAgents.filter((a) => a.status === 'hidden').length;
  const activeDeckCrew = engine.crewAgents.filter((a) => a.status !== 'hidden' && a.status !== 'snatched').length;
  const snatchedCrew = engine.crewAgents.filter((a) => a.status === 'snatched').length;

  const livingAgents = engine.crewAgents.filter((a) => a.hp > 0);
  const maxCrewMemberHp = engine.behemoth.crewMemberHp || 10;
  const avgCrewHp = livingAgents.length > 0
    ? livingAgents.reduce((sum, a) => sum + a.hp, 0) / livingAgents.length
    : maxCrewMemberHp;
  const avgCrewHpPercent = Math.max(0, Math.min(100, (avgCrewHp / maxCrewMemberHp) * 100));

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-[#030712] overflow-hidden">
      {/* Top Controls Stack: Tiles & Measurements (Above), Attacking Threat Creature Selection (Below) */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center gap-1.5 max-w-[calc(100vw-32px)]">
        {/* Row 1: World Tiles Toolbar + In-Game Measurements Bar side-by-side */}
        <div className="flex items-center gap-2 max-w-full overflow-x-auto scrollbar-none pointer-events-auto">
          {/* World Tiles Toolbar */}
          <div className="flex items-center gap-1.5 bg-slate-950/90 border border-slate-800/80 backdrop-blur-md px-3 py-1 rounded-xl shadow-2xl font-mono text-[10px] whitespace-nowrap">
            <span className="text-slate-400 font-bold flex items-center gap-1 mr-1">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">TILES:</span>
            </span>

            <button
              type="button"
              onClick={() => setShowWorldTiles(!showWorldTiles)}
              className={`px-2 py-0.5 rounded border transition-all ${
                showWorldTiles
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-bold shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                  : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
              title="Toggle World Tiles 2km Grid (1 Knot per side)"
            >
              # Tiles (2km)
            </button>

            <button
              type="button"
              onClick={() => setShowSubGrid(!showSubGrid)}
              className={`px-2 py-0.5 rounded border transition-all ${
                showSubGrid
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-bold'
                  : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
              title="Toggle Sub-Grid Quadrants (500m / 0.25 Knots)"
            >
              + Sub (500m)
            </button>

            <button
              type="button"
              onClick={() => setShowRangeRings(!showRangeRings)}
              className={`px-2 py-0.5 rounded border transition-all ${
                showRangeRings
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-bold'
                  : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
              title="Toggle Calibrated Range Rings (250m, 500m, 750m Behemoth, 1.0km, 1.5km)"
            >
              ◎ Rings
            </button>

            <button
              type="button"
              onClick={() => setShowUnrealUnits(!showUnrealUnits)}
              className={`px-2 py-0.5 rounded border transition-all ${
                showUnrealUnits
                  ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 font-bold'
                  : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
              title="Toggle Unreal Engine Units Display (1 UU = 1 cm)"
            >
              UE (cm)
            </button>

            <button
              type="button"
              onClick={() => setIsUnrealModalOpen(true)}
              className="px-2.5 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-all flex items-center gap-1 shadow-md shadow-cyan-900/40 ml-1"
              title="Open Unreal Engine Telemetry & Measurements Export Bridge"
            >
              <Box className="w-3 h-3" />
              <span>UNREAL BRIDGE</span>
            </button>
          </div>

          {/* In-Game Measurements Bar (Right next to tiles toolbar) */}
          <div className="flex items-center gap-2.5 bg-slate-950/90 border border-slate-800/80 backdrop-blur-md px-3 py-1 rounded-xl shadow-2xl font-mono text-[9px] text-slate-300 whitespace-nowrap">
            <span className="text-[10px] text-cyan-400 font-bold flex items-center gap-1">
              <Compass className="w-3 h-3 text-cyan-400" />
              <span>MEASUREMENTS:</span>
            </span>
            <div className="flex items-center gap-2 text-slate-400 border-l border-slate-800/80 pl-2">
              <span>Tile: <strong className="text-slate-200">2.0 km (1 kt)</strong></span>
              <span>Behemoth: <strong className="text-amber-300">750m</strong></span>
              <span>Base Speed: <strong className="text-emerald-300">1 kt/min</strong></span>
            </div>
            {/* Visual scale ruler */}
            <div className="hidden xl:flex items-center gap-2.5 border-l border-slate-800/80 pl-2">
              <div className="flex flex-col items-center">
                <div className="w-[50px] h-1 bg-cyan-500/60 rounded border border-cyan-400/80 relative">
                  <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-cyan-300 h-2 -translate-y-0.5" />
                  <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-cyan-300 h-2 -translate-y-0.5" />
                </div>
                <span className="text-[7.5px] text-cyan-400 mt-0.5 leading-none">250m</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-[90px] h-1 bg-cyan-500/40 rounded border border-cyan-400/60 relative">
                  <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-cyan-300 h-2 -translate-y-0.5" />
                  <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-cyan-300 h-2 -translate-y-0.5" />
                </div>
                <span className="text-[7.5px] text-cyan-400 mt-0.5 leading-none">500m (50k UU)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Attacking Threat Creature Selection Bar (Positioned directly under Tiles) */}
        {creatures && creatures.length > 0 && onSpawnCreature && (
          <div className="pointer-events-auto flex items-center gap-2 bg-slate-950/90 border border-slate-800/80 backdrop-blur-md px-4 py-1.5 rounded-xl shadow-2xl max-w-full overflow-x-auto scrollbar-none">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap">
              <Target className="w-3.5 h-3.5 text-rose-400" />
              ATTACKING THREAT:
            </span>
            <div className="flex items-center gap-1.5">
              {creatures.map((c) => {
                const isCurrentActive = activeThreatDefId === c.id;
                return (
                  <div key={c.id} className="flex items-center gap-0.5 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                    <button
                      onClick={() => onSpawnCreature(c.id)}
                      className={`px-2 py-1 rounded text-xs font-mono font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                        isCurrentActive
                          ? 'bg-rose-500 text-slate-950 shadow-md shadow-rose-500/30'
                          : 'hover:bg-slate-800 text-slate-300'
                      }`}
                      title={`Spawn single ${c.name} to attack the Behemoth`}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.iconColor }} />
                      <span>{c.name}</span>
                    </button>
                    {onToggleCreatureFlying && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleCreatureFlying(c.id);
                        }}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border transition-all whitespace-nowrap ${
                          c.isFlying
                            ? 'bg-amber-950/80 border-amber-500/60 text-amber-300 hover:bg-amber-900/80'
                            : 'bg-sky-950/80 border-sky-500/60 text-sky-300 hover:bg-sky-900/80'
                        }`}
                        title={`Click to switch locomotion: Currently ${c.isFlying ? 'FLYING (Renders over boat)' : 'NON-FLYING (Renders under water)'}`}
                      >
                        {c.isFlying ? '🦅 Fly' : '🌊 Water'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>



      {/* 2. LEFT COLUMN: Crew Actions, Amount, and Average Health */}
      <div className="absolute top-14 left-4 z-20 pointer-events-auto flex flex-col gap-2.5 w-56 sm:w-60 md:w-64 max-h-[calc(100%-75px)] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 bg-slate-950/90 border border-slate-800/80 backdrop-blur-md p-3 rounded-xl shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
          <span className="text-[10px] font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            CREW ACTIONS
          </span>
          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase border ${
            engine.behemoth.crewStance === 'neutral'
              ? 'text-sky-400 bg-sky-950/60 border-sky-800/50'
              : engine.behemoth.crewStance === 'hide'
              ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/50'
              : 'text-amber-400 bg-amber-950/60 border-amber-800/50'
          }`}>
            {engine.behemoth.crewStance}
          </span>
        </div>

        {/* Crew Stance Action Buttons (Column) */}
        <div className="flex flex-col gap-1.5 font-mono text-xs">
          <button
            type="button"
            onClick={() => (onSetCrewStance ? onSetCrewStance('neutral') : engine.setCrewStance('neutral'))}
            className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center justify-between transition-all ${
              engine.behemoth.crewStance === 'neutral'
                ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/30'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800/80'
            }`}
            title="Neutral: Crew wander deck normally and scatter/run away when attacked"
          >
            <span className="flex items-center gap-1.5">
              <span>🏃</span>
              <span>NEUTRAL</span>
            </span>
            <span className="text-[10px] opacity-75">Scatter</span>
          </button>

          <button
            type="button"
            onClick={() => (onSetCrewStance ? onSetCrewStance('hide') : engine.setCrewStance('hide'))}
            className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center justify-between transition-all ${
              engine.behemoth.crewStance === 'hide'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800/80'
            }`}
            title="Hide: Crew seek housing quarters and shelter inside (capped by building capacity)"
          >
            <span className="flex items-center gap-1.5">
              <span>🛡️</span>
              <span>HIDE</span>
            </span>
            <span className="text-[10px] opacity-75">Shelter</span>
          </button>

          <button
            type="button"
            onClick={() => (onSetCrewStance ? onSetCrewStance('attack') : engine.setCrewStance('attack'))}
            className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center justify-between transition-all ${
              engine.behemoth.crewStance === 'attack'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800/80'
            }`}
            title="Attack: Crew draw Personal Defense Weapons (PDWs) and engage creatures targeting crew/buildings"
          >
            <span className="flex items-center gap-1.5">
              <span>⚔️</span>
              <span>ATTACK</span>
            </span>
            <span className="text-[10px] opacity-75">PDW Auto</span>
          </button>
        </div>

        {/* Crew Amount and Average Health (Moved below actions) */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-2 font-mono text-[11px]">
          {/* Crew Amount */}
          <div className="flex flex-col gap-1 bg-slate-900/60 p-2 rounded-lg border border-slate-800/50">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-semibold text-[10px] uppercase">Crew Amount:</span>
              <span className="text-cyan-300 font-bold">
                {totalCrew} <span className="text-slate-500 font-normal">/ {maxCrew}</span>
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
              <span>Deck: <strong className="text-sky-300">{activeDeckCrew}</strong></span>
              <span>Sheltered: <strong className="text-emerald-300">{shelteredCrew}</strong></span>
              {snatchedCrew > 0 && (
                <span>Snatched: <strong className="text-rose-400">{snatchedCrew}</strong></span>
              )}
            </div>
          </div>

          {/* Average Crew Health */}
          <div className="flex flex-col gap-1 bg-slate-900/60 p-2 rounded-lg border border-slate-800/50">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-semibold text-[10px] uppercase flex items-center gap-1">
                <Heart className="w-3 h-3 text-rose-400 fill-rose-400/30" />
                Avg Health:
              </span>
              <span className={`font-bold ${
                avgCrewHpPercent > 66 ? 'text-emerald-400' : avgCrewHpPercent > 33 ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {avgCrewHp.toFixed(1)} / {maxCrewMemberHp} HP
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  avgCrewHpPercent > 66 ? 'bg-emerald-500' : avgCrewHpPercent > 33 ? 'bg-amber-500' : 'bg-rose-500'
                }`}
                style={{ width: `${avgCrewHpPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* 3. Behemoth Navigation Speed & Gear Controls */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-1.5 font-mono text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-amber-400" />
              VESSEL SPEED
            </span>
            <div className="flex items-center gap-1.5">
              {/* Full Stop button */}
              <button
                type="button"
                onClick={() => engine.fullStop()}
                className="px-1.5 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/50 text-rose-300 font-bold text-[8.5px] transition-all"
                title="Full Stop (Hotkey: F) - Stop all engines and clear route"
              >
                STOP [F]
              </button>

              {/* Gear Selector: Forward / Reverse Mode */}
              <div className="flex items-center rounded bg-slate-900 border border-slate-700/80 p-0.5 text-[9px] font-bold">
                <button
                  type="button"
                  onClick={() => engine.setGear('forward')}
                  className={`px-1.5 py-0.5 rounded transition-all ${
                    engine.behemoth.gear !== 'reverse'
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Forward Gear (Bow routes, normal turning)"
                >
                  FWD
                </button>
                <button
                  type="button"
                  onClick={() => engine.setGear('reverse')}
                  className={`px-1.5 py-0.5 rounded transition-all ${
                    engine.behemoth.gear === 'reverse'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Reverse Gear (Stern routes, max 2.0 kts)"
                >
                  REV
                </button>
              </div>
            </div>
          </div>

          {/* Speed Readout in Knots & Game Units */}
          <div className="flex items-center justify-between text-[10px] bg-slate-900/60 px-2 py-1 rounded border border-slate-800/50">
            <span className="text-slate-400">Engine Output:</span>
            <div className="flex items-center gap-1.5 font-bold">
              <span className={engine.behemoth.isReversing ? 'text-amber-400' : 'text-cyan-400'}>
                {engine.behemoth.isReversing ? 'REV ' : ''}{engine.behemoth.speed.toFixed(1)} / {engine.behemoth.targetSpeed.toFixed(1)} kts
              </span>
              <span className="text-[9px] text-slate-500 font-normal">
                ({Math.round(engine.behemoth.speed * 825)} GU)
              </span>
            </div>
          </div>

          {/* Speed Preset Telegraph Notches */}
          <div className="grid grid-cols-6 gap-1 text-[8.5px] font-bold text-center">
            <button
              type="button"
              onClick={() => engine.setBehemothSpeed(0)}
              className={`py-0.5 rounded border transition-all ${
                engine.behemoth.targetSpeed === 0
                  ? 'bg-slate-700 text-white border-slate-500'
                  : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
              title="Full Stop (0 kts = 0 Game Units)"
            >
              STOP
            </button>
            <button
              type="button"
              onClick={() => engine.setBehemothSpeed(2)}
              className={`py-0.5 rounded border transition-all ${
                engine.behemoth.targetSpeed === 2
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                  : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
              title="1/4 Speed (2 kts = 1,650 Game Units)"
            >
              1/4 (2k)
            </button>
            <button
              type="button"
              onClick={() => engine.setBehemothSpeed(5)}
              className={`py-0.5 rounded border transition-all ${
                engine.behemoth.targetSpeed === 5
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                  : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
              title="1/2 Speed (5 kts = 4,125 Game Units)"
            >
              1/2 (5k)
            </button>
            <button
              type="button"
              onClick={() => engine.setBehemothSpeed(8)}
              className={`py-0.5 rounded border transition-all ${
                engine.behemoth.targetSpeed === 8
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                  : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
              title="3/4 Speed (8 kts = 6,600 Game Units)"
            >
              3/4 (8k)
            </button>
            <button
              type="button"
              onClick={() => engine.setBehemothSpeed(10)}
              className={`py-0.5 rounded border transition-all ${
                engine.behemoth.targetSpeed === 10
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                  : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
              title="Regular Speed (10 kts = 8,250 Game Units)"
            >
              REG (10k)
            </button>
            <button
              type="button"
              onClick={() => engine.setBehemothSpeed(15)}
              className={`py-0.5 rounded border transition-all ${
                engine.behemoth.targetSpeed === 15
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
              title="Overdrive (15 kts = 12,375 Game Units)"
            >
              OVD (15k)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="15.0"
              step="0.5"
              value={engine.behemoth.targetSpeed}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                engine.setBehemothSpeed(val);
              }}
              onPointerUp={(e) => (e.target as HTMLElement)?.blur?.()}
              onKeyUp={(e) => (e.target as HTMLElement)?.blur?.()}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>
          <div className="flex justify-between text-[8px] text-slate-500">
            <span>0k (STOP)</span>
            <span>2k (1/4)</span>
            <span>5k (1/2)</span>
            <span>8k (3/4)</span>
            <span>10k (REG)</span>
            <span>15k (OVD)</span>
          </div>

          {/* Navigation Controls Key Guide */}
          <div className="text-[8px] text-slate-500 border-t border-slate-800/50 pt-1 flex justify-between">
            <span>Hold <strong className="text-cyan-400">N</strong>: Add WP</span>
            <span><strong className="text-amber-400">Shift+N</strong>: Override</span>
            <span><strong className="text-rose-400">F</strong>: Full Stop</span>
          </div>
          {(engine.behemoth.isMoving || engine.behemoth.waypoints.length > 0) && (
            <div className="flex items-center justify-between text-[9px] text-cyan-400 pt-0.5 border-t border-slate-800/50 mt-0.5">
              <span>Heading: <strong>{Math.round(engine.behemoth.heading)}°</strong></span>
              <div className="flex items-center gap-1.5">
                <span>Route: <strong>{engine.behemoth.waypoints.length} WPs</strong></span>
                {engine.behemoth.isReversing && (
                  <span className="bg-amber-950/80 border border-amber-500/60 text-amber-300 px-1 py-0.5 rounded text-[8px] font-bold">
                    REVERSING
                  </span>
                )}
                {engine.behemoth.waypoints.length > 0 && (
                  <button
                    type="button"
                    onClick={() => engine.setWaypoints([])}
                    className="text-slate-400 hover:text-rose-400 text-[8px] underline ml-0.5"
                    title="Cancel active route"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. RIGHT COLUMN: Tactical Action & Cooldown Log - Slim, scrollable up/down, fits text */}
      <div className="absolute top-14 right-4 z-20 pointer-events-auto flex flex-col w-56 sm:w-64 md:w-72 max-h-[calc(100%-75px)] bg-slate-950/90 border border-slate-800/80 backdrop-blur-md rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800/80 px-2.5 py-1.5 bg-slate-900/50">
          <span className="flex items-center gap-1.5 text-slate-300">
            <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
            TACTICAL LOG
          </span>
          <span className="text-[8px] text-slate-500 font-normal">
            {engine.logMessages.length} ev &bull; {engine.timeElapsed.toFixed(1)}s
          </span>
        </div>

        {/* Scrollable message feed where text wraps cleanly without truncation */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-1.5 flex flex-col gap-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900/50">
          {engine.logMessages.map((log) => {
            const isAction = log.text.startsWith('[ACTION]');
            const isCooldown = log.text.startsWith('[COOLDOWN]');
            const isRecharge = log.text.startsWith('[RECHARGE]');
            const isSupply = log.text.startsWith('[SUPPLY]');
            const isDanger = log.type === 'danger' || log.type === 'warn';

            return (
              <div
                key={log.id}
                className={`w-full text-[9px] sm:text-[10px] font-mono leading-snug p-1.5 rounded border break-words whitespace-normal select-text ${
                  isAction
                    ? 'text-amber-300 bg-amber-950/40 border-amber-800/50'
                    : isCooldown
                    ? 'text-rose-300 bg-rose-950/40 border-rose-800/50'
                    : isRecharge
                    ? 'text-cyan-300 bg-cyan-950/40 border-cyan-800/50'
                    : isSupply
                    ? 'text-emerald-300 bg-emerald-950/40 border-emerald-800/50'
                    : isDanger
                    ? 'text-rose-300 bg-rose-950/30 border-rose-900/40'
                    : 'text-slate-300 bg-slate-900/60 border-slate-800/50'
                }`}
              >
                <span className="text-slate-500 font-bold mr-1 select-none">[{log.time}s]</span>
                <span>{log.text}</span>
              </div>
            );
          })}
          {engine.logMessages.length === 0 && (
            <div className="text-[10px] font-mono text-slate-500 italic py-3 text-center">
              Tactical telemetry standing by...
            </div>
          )}
        </div>
      </div>

      {/* N-Key Hold Banner */}
      {isHoldingNUI && (
        <div className="absolute top-[84px] left-1/2 -translate-x-1/2 z-30 pointer-events-none border backdrop-blur-md px-4 py-1.5 rounded-full shadow-2xl flex items-center gap-2 font-mono text-xs animate-pulse bg-sky-950/90 border-sky-400/50 text-sky-200">
          <Navigation className="w-3.5 h-3.5 text-cyan-400" />
          <span>
            {`N-HOLD ACTIVE: CLICK TO PLOT ROUTE (${engine.behemoth.waypoints.length} WAYPOINT${engine.behemoth.waypoints.length === 1 ? '' : 'S'} PLOTTED)`}
          </span>
        </div>
      )}

      <canvas
        ref={canvasRef}
        tabIndex={0}
        width={1000}
        height={700}
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={(e) => e.preventDefault()}
        className={`max-w-full max-h-full border border-slate-800 rounded-xl shadow-2xl focus:outline-none ${
          isHoldingNUI ? 'cursor-crosshair' : 'cursor-default'
        }`}
      />

      {/* Benchmark Calibration Bar */}
      <div className="absolute bottom-3 left-4 right-4 z-20 max-w-4xl mx-auto bg-slate-950/90 border border-slate-800/90 backdrop-blur-md px-4 py-2 rounded-xl shadow-2xl flex flex-wrap items-center justify-between gap-3 font-mono">
        {/* Left: Benchmark Mode Switch & Mount Selector */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              const nextMode = !engine.benchmarkMode;
              engine.setBenchmarkMode(nextMode);
              if (nextMode && creatures && creatures.length > 0) {
                const targetId = activeThreatDefId || creatures[0].id;
                engine.setBenchmarkTarget(targetId);
              }
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all ${
              engine.benchmarkMode
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>BENCHMARK MODE: {engine.benchmarkMode ? 'ON' : 'OFF'}</span>
          </button>

          {engine.benchmarkMode && (
            <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-[10px]">
              <button
                type="button"
                onClick={() => engine.setBenchmarkSingleMount(true)}
                className={`px-2 py-1 rounded font-bold transition-all ${
                  engine.benchmarkSingleMount
                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Single Mount (1-on-1): only Slot 1 fires at target for pure weapon vs creature calibration"
              >
                1x Mount (1-on-1)
              </button>
              <button
                type="button"
                onClick={() => engine.setBenchmarkSingleMount(false)}
                className={`px-2 py-1 rounded font-bold transition-all ${
                  !engine.benchmarkSingleMount
                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Full Battery: all active weapons fire simultaneously"
              >
                Full Battery
              </button>
            </div>
          )}
        </div>

        {/* Center / Right: Live Stopwatch & Calibration Readout */}
        {engine.benchmarkMode ? (
          <div className="flex items-center gap-3 text-xs">
            {/* Quick target lock buttons */}
            <div className="hidden sm:flex items-center gap-1">
              <span className="text-[10px] text-slate-500 mr-1">Lock:</span>
              {creatures?.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => engine.setBenchmarkTarget(c.id)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                    engine.benchmarkTargetDefId === c.id
                      ? 'bg-cyan-950 text-cyan-300 border-cyan-700 shadow-sm'
                      : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {/* Live Stopwatch reading */}
            <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-3 py-1 rounded-lg">
              <Timer className="w-3.5 h-3.5 text-cyan-400" />
              {engine.benchmarkMeasuredTtk !== null ? (
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">
                    Measured: {engine.benchmarkMeasuredTtk.toFixed(1)}s
                  </span>
                  {benchmarkTheoTtk !== null && (
                    <span className="text-[10px] text-slate-400">
                      (Matrix: {benchmarkTheoTtk}s, &Delta; {Math.abs(engine.benchmarkMeasuredTtk - benchmarkTheoTtk).toFixed(1)}s)
                    </span>
                  )}
                </div>
              ) : engine.benchmarkFirstHitTime !== null ? (
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 font-bold animate-pulse">
                    {(engine.timeElapsed - engine.benchmarkFirstHitTime).toFixed(1)}s
                  </span>
                  <span className="text-[10px] text-slate-400">
                    (Target: {benchmarkTheoTtk ? `${benchmarkTheoTtk}s` : 'measuring...'})
                  </span>
                </div>
              ) : (
                <span className="text-[11px] text-cyan-300">
                  Locked & Ready (Awaiting 1st shot...)
                </span>
              )}
            </div>

            {/* Restart button */}
            <button
              type="button"
              onClick={() => engine.resetBenchmarkTarget()}
              className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-[10px] font-bold text-slate-300 flex items-center gap-1"
              title="Reset target HP and restart stopwatch"
            >
              <RotateCcw className="w-3 h-3 text-cyan-400" />
              <span>Restart</span>
            </button>
          </div>
        ) : (
          <div className="text-[11px] text-slate-500 hidden md:block">
            Enable Benchmark Mode to lock targets in stationary line-of-sight and verify live TTK against the theoretical matrix.
          </div>
        )}
      </div>

      {/* Unreal Engine Export & Measurements Modal */}
      <UnrealExportModal
        isOpen={isUnrealModalOpen}
        onClose={() => setIsUnrealModalOpen(false)}
        weapons={weapons || Array.from(engine.weaponDefs.values())}
        creatures={creatures || Array.from(engine.creatureDefs.values())}
        buildings={buildings || []}
        behemoth={engine.behemoth}
        behaviorTrees={Object.fromEntries(engine.behaviorTrees.entries())}
      />
    </div>
  );
};
