import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SimulationEngine } from '../../engine/simulation';
import { CreatureRuntimeInstance, WeaponSlot, BuildingSlot } from '../../types/combat';
import { weaponSlotLocalPose, buildingSlotLocalPose } from '../../engine/navigation';
import { pxToMeters, METERS_PER_TILE, normalizeSpeedToKnots } from '../../engine/measurements';
import { traverseArcDeg, weaponDistancePx, shootingAreaPx, isSprayWeapon } from '../../engine/weapons';
import { buildBehemothGeometry, deckTopAt, mountBaseY, hullOutline, BEHEMOTH_HULL_TOP_Y, PALETTE, LATERAL_SCALE } from './behemothModel';
import { buildingShape } from './buildingShapes';
import { mergeParts } from './lowpoly';
import { getCreatureModel, isModelledCreature } from './creatureModels';

/**
 * Option A 3D view: a pure renderer over the existing 2D engine. It never ticks or mutates the sim
 * (App.tsx owns the loop) apart from forwarding clicks (selection, waypoints), so every number stays identical.
 *
 * World mapping: engine px (x, y-down) -> metres (x, z); three Y is up.
 * Heights are visual only, from the engine's layer state: altitudeRatio / isFlying / underwater + depthRatio.
 */

// ---- Visual-only height tuning (metres) ---------------------------------------
const FLY_ALT_M = 45; // low aerial layer (Veilfangs)
const BREACH_APEX_M = 140; // altitudeRatio = 1 (Leviarch breach apex)
const MAX_DEPTH_M = 35; // depthRatio = 1
const LINE_SHOT_Y = BEHEMOTH_HULL_TOP_Y + 8;
const ARCH_APEX_M = 90;
const VEILFANG_VISUAL_SCALE = 1.2; // drawn bigger than the sim collision radius for readability

const SKY_COLOR = '#8fcde6'; // slightly more saturated sky blue (also the fog colour)

const M = (px: number) => pxToMeters(px);

/**
 * Seamless anime-style water texture: flat teal cells, crisp white light lines of varying thickness,
 * darker blue "shadow" lines offset beside them, and small white sparkles. Generated once on the CPU
 * (512²), deterministic. Periodic by construction: jittered points on a wrapping grid + integer-frequency warp.
 */
function makeWaterTexture(): THREE.CanvasTexture {
  const size = 512;
  const cells = 5; // cells per tile edge
  const cellPx = size / cells;
  let seed = 23;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pts: Array<[number, number]> = [];
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) pts.push([(i + 0.15 + rnd() * 0.7) * cellPx, (j + 0.15 + rnd() * 0.7) * cellPx]);
  const TAU = Math.PI * 2;

  /** Distance between the nearest two cell points (0 on cell borders), wrapping across the tile. */
  const edgeAt = (wx: number, wy: number): number => {
    const ci = Math.floor(wx / cellPx), cj = Math.floor(wy / cellPx);
    let f1 = 1e9, f2 = 1e9;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = ci + di, jj = cj + dj;
      const p = pts[(((jj % cells) + cells) % cells) * cells + (((ii % cells) + cells) % cells)];
      const d = Math.hypot(wx - (p[0] + Math.floor(ii / cells) * size), wy - (p[1] + Math.floor(jj / cells) * size));
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
    return f2 - f1;
  };

  const top = new THREE.Color('#5cc6c2');
  const bottom = new THREE.Color('#4cb4b4');
  const shade = new THREE.Color('#3f9ea6');
  const white = new THREE.Color('#d9f6f2');
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d')!;
  const img = g.createImageData(size, size);
  const c = new THREE.Color();
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // periodic domain warp -> rounded, blobby cells
      const wx = x + 14 * Math.sin((TAU * 2 * y) / size + 1.3) + 7 * Math.sin((TAU * 5 * y) / size + 0.4) + 4 * Math.sin((TAU * 9 * y) / size + 2.0);
      const wy = y + 14 * Math.sin((TAU * 3 * x) / size + 2.1) + 7 * Math.sin((TAU * 4 * x) / size + 0.9) + 4 * Math.sin((TAU * 8 * x) / size + 0.3);
      const vary = 0.5 + 0.5 * Math.sin((TAU * 3 * x) / size + (TAU * 2 * y) / size + 0.7) * Math.cos((TAU * 2 * x) / size - (TAU * 3 * y) / size + 1.9);
      const e = edgeAt(wx, wy);
      const es = edgeAt(wx + 7, wy + 9); // offset copy -> shadow line beside each light line
      c.copy(top).lerp(bottom, 0.5 + 0.5 * Math.sin((TAU * (x + y)) / size)); // flat fill, gentle diagonal gradient
      c.lerp(shade, Math.max(0, Math.min(1, 2.5 + 4 * (1 - vary) - es + 0.5)) * 0.45); // hard, 1 px antialiased edges (kept low-contrast)
      c.lerp(white, Math.max(0, Math.min(1, 1.8 + 4.5 * vary - e + 0.5)) * 0.7);
      const k = (y * size + x) * 4;
      img.data[k] = c.r * 255; img.data[k + 1] = c.g * 255; img.data[k + 2] = c.b * 255; img.data[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // white sparkles (wrapped so the tile stays seamless)
  g.fillStyle = '#cdf0ec';
  for (let i = 0; i < 70; i++) {
    const x = rnd() * size, y = rnd() * size, r = 1 + rnd() * 2.2, rx = r * (1 + rnd() * 0.8);
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
      g.beginPath();
      g.ellipse(x + ox, y + oy, rx, r, 0, 0, TAU);
      g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
const WATER_TILE_M = 400; // ~80 m cells
const deg = (d: number) => (d * Math.PI) / 180;

/** Behaviour status chip (what the creature is doing right now). Same rules as the 2D canvas. */
function behaviourChip(engine: SimulationEngine, c: CreatureRuntimeInstance): [string, string] | null {
  const def = engine.creatureDefs.get(c.defId);
  const rs = engine.behaviorRuntimeStates.get(c.id);
  if (c.stunned) return ['STUNNED', '#facc15'];
  if (rs?.activeNodeId === 'node_tl_barrel_roll') return ['BARREL ROLL', '#c4b5fd'];
  if ((c.dodgeTimer ?? 0) > 0) return ['DODGE', '#c4b5fd'];
  if (c.ramPhase === 'windup') return [c.defId === 'dreadlot' ? 'LINING UP' : 'GATHERING', '#fbbf24'];
  if (c.ramPhase === 'charge') return [c.defId === 'dreadlot' ? 'RAM DASH' : 'TAKE-OFF RUN', '#f97316'];
  if (c.isHoveringDeck) return ['OVER DECK', '#e7dcc4'];
  if (c.isFlying && !def?.isFlying) return ['AIRBORNE', '#e7dcc4'];
  if (c.drainArrived || rs?.activeNodeId?.includes('drain')) return ['DRAINING', '#a78bfa'];
  if (c.underwater) return ['SUBMERGED', '#38bdf8'];
  return null;
}

/** Low-poly cumulus: a few flattened, overlapping blobs with a slightly darker underside. One geometry per variant. */
function makeCloudGeometry(seed: number): THREE.BufferGeometry {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const parts = [];
  const blobs = 4 + Math.floor(rnd() * 4);
  for (let i = 0; i < blobs; i++) {
    const r = 60 + rnd() * 70;
    const x = (i - blobs / 2) * 70 + (rnd() - 0.5) * 40;
    const z = (rnd() - 0.5) * 90;
    const top = new THREE.IcosahedronGeometry(r, 1);
    top.scale(1.25, 0.6, 1);
    top.translate(x, r * 0.25, z);
    parts.push({ geo: top, color: '#ffffff' });
    const base = new THREE.IcosahedronGeometry(r * 0.85, 0);
    base.scale(1.3, 0.35, 1);
    base.translate(x, -r * 0.05, z);
    parts.push({ geo: base, color: '#dde8ef' });
  }
  return mergeParts(parts);
}
const CLOUD_FIELD_M = 24000; // clouds wrap around the camera target inside this square (edges are past the fog)

interface Props {
  engine: SimulationEngine;
  selectedCreatureId?: string;
  selectedSlotId?: string | null;
  onSelectCreature?: (c: CreatureRuntimeInstance) => void;
  onSelectSlotId?: (id: string) => void;
  /** Called on a water click while the waypoint key (N) is held. World coords in engine px. */
  onWaterClick?: (worldX: number, worldY: number, shiftKey: boolean) => boolean;
  followShip: boolean;
}

const BUILDING_HEIGHT: Record<string, number> = { housing: 12, job: 16, energy: 20, service: 10 };

export const Tactical3DView: React.FC<Props> = ({ engine, selectedCreatureId, selectedSlotId, onSelectCreature, onSelectSlotId, onWaterClick, followShip }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  // Props read inside the render loop without restarting it
  const live = useRef({ selectedCreatureId, selectedSlotId, onSelectCreature, onSelectSlotId, onWaterClick, followShip });
  live.current = { selectedCreatureId, selectedSlotId, onSelectCreature, onSelectSlotId, onWaterClick, followShip };

  useEffect(() => {
    const host = mountRef.current;
    if (!host) return;

    // ---- Renderer / scene ----------------------------------------------------------
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(host.clientWidth, host.clientHeight);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SKY_COLOR);
    scene.fog = new THREE.Fog(SKY_COLOR, 2500, 9000);

    const camera = new THREE.PerspectiveCamera(45, host.clientWidth / host.clientHeight, 5, 20000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.maxPolarAngle = deg(88);
    controls.minDistance = 120;
    controls.maxDistance = 6000;

    scene.add(new THREE.HemisphereLight('#e4f3ff', '#1b3a40', 1.1));
    const sun = new THREE.DirectionalLight('#ffffff', 1.7);
    sun.position.set(0.6, 1.4, 0.35);
    scene.add(sun);

    // ---- Water + tile grid (follow the camera target, snapped to tiles) ------------------
    const waterTex = makeWaterTexture();
    waterTex.repeat.set(40000 / WATER_TILE_M, 40000 / WATER_TILE_M);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000), new THREE.MeshLambertMaterial({ map: waterTex, transparent: true, opacity: 0.72, depthWrite: false }));
    water.rotation.x = -Math.PI / 2;
    water.renderOrder = -1; // first among transparents: shadow, grid and effects draw over it
    scene.add(water);
    // Deep-water floor seen through the semi-transparent surface (keel band and submerged creatures show through)
    // Clouds: scattered low-poly cumulus at 700–1200 m, drifting slowly with the wind, wrapping around the view
    const cloudMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const cloudGeos = [3, 17, 29, 41, 53].map(makeCloudGeometry);
    const clouds: Array<{ mesh: THREE.Mesh; x: number; z: number }> = [];
    {
      let cs = 97;
      const rnd = () => ((cs = (cs * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 34; i++) {
        const mesh = new THREE.Mesh(cloudGeos[i % cloudGeos.length], cloudMat);
        mesh.scale.setScalar(0.8 + rnd() * 1.4);
        mesh.rotation.y = rnd() * Math.PI * 2;
        mesh.position.y = 700 + rnd() * 500;
        scene.add(mesh);
        clouds.push({ mesh, x: (rnd() - 0.5) * CLOUD_FIELD_M, z: (rnd() - 0.5) * CLOUD_FIELD_M });
      }
    }
    const CLOUD_WIND = new THREE.Vector2(6, 2.5); // m/s

    const seabed = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000), new THREE.MeshBasicMaterial({ color: '#1f6e74' }));
    seabed.rotation.x = -Math.PI / 2;
    seabed.position.y = -80;
    scene.add(seabed);
    const tileM = METERS_PER_TILE;
    const grid = new THREE.GridHelper(tileM * 12, 12, '#7fc3cc', '#7fc3cc');
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.35;
    grid.position.y = 0.5;
    scene.add(grid);

    // ---- Behemoth ----------------------------------------------------------------------
    const lowPolyMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const shipYaw = new THREE.Group(); // position + heading
    const shipRoll = new THREE.Group(); // tilt
    shipYaw.add(shipRoll);
    scene.add(shipYaw);
    const hullGeo = buildBehemothGeometry();
    const hull = new THREE.Mesh(hullGeo, lowPolyMat);
    shipRoll.add(hull);

    // Water shadow: hull outline cast away from the sun, with stepped soft edges, so the ship sits *in* the water
    const shadowShape = new THREE.Shape(hullOutline().map((p) => new THREE.Vector2(p.x, -p.z)));
    const shadowGeo = new THREE.ShapeGeometry(shadowShape);
    shadowGeo.rotateX(-Math.PI / 2);
    const shipShadow = new THREE.Group();
    for (const [scale, opacity] of [[1.0, 0.34], [1.05, 0.17], [1.11, 0.08]] as const) {
      const m = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({
        color: '#05262b', transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4,
      }));
      m.scale.set(scale, 1, scale);
      m.renderOrder = 1;
      shipShadow.add(m);
    }
    scene.add(shipShadow);
    const SHADOW_OFFSET = new THREE.Vector3(-9, 0.6, -5); // away from the sun, metres

    // Shared flat-shaded primitives for dynamic parts (geometry shared, material per instance for tints)
    const geoTurretBase = new THREE.CylinderGeometry(7, 8, 4, 8);
    const geoTurretBody = new THREE.BoxGeometry(12, 6, 10);
    const geoBarrel = new THREE.BoxGeometry(16, 2, 2);
    geoBarrel.translate(8, 0, 0);
    const geoBox = new THREE.BoxGeometry(1, 1, 1);
    geoBox.translate(0, 0.5, 0);

    type MountView = { group: THREE.Group; head: THREE.Group; bodyMat: THREE.MeshLambertMaterial; baseMat: THREE.MeshLambertMaterial; ring: THREE.Mesh };
    const mounts = new Map<string, MountView>();
    const ringGeo = new THREE.RingGeometry(10, 12, 16);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide });

    const ensureMount = (slot: WeaponSlot): MountView => {
      let mv = mounts.get(slot.id);
      if (mv) return mv;
      const group = new THREE.Group();
      const baseMat = new THREE.MeshLambertMaterial({ color: PALETTE.steelDark, flatShading: true });
      const bodyMat = new THREE.MeshLambertMaterial({ color: '#888888', flatShading: true });
      const base = new THREE.Mesh(geoTurretBase, baseMat);
      base.position.y = 2;
      const head = new THREE.Group();
      head.position.y = 7;
      head.add(new THREE.Mesh(geoTurretBody, bodyMat));
      const barrel = new THREE.Mesh(geoBarrel, bodyMat);
      barrel.position.set(4, 1, 0);
      head.add(barrel);
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 0.6;
      group.add(base, head, ring);
      group.userData = { kind: 'slot', id: slot.id };
      base.userData = group.userData;
      head.children.forEach((c) => (c.userData = group.userData));
      shipRoll.add(group);
      mv = { group, head, bodyMat, baseMat, ring };
      mounts.set(slot.id, mv);
      return mv;
    };

    type BuildingView = { mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial };
    const buildingViews = new Map<string, BuildingView>();
    const ensureBuilding = (slot: BuildingSlot): BuildingView => {
      let bv = buildingViews.get(slot.id);
      if (bv) return bv;
      const mat = new THREE.MeshLambertMaterial({ color: '#888888', flatShading: true, vertexColors: true });
      const mesh = new THREE.Mesh(geoBox, mat);
      mesh.userData = { kind: 'building', id: slot.id, shapeOf: '' };
      shipRoll.add(mesh);
      bv = { mesh, mat };
      buildingViews.set(slot.id, bv);
      return bv;
    };

    // ---- Creatures: concept models for the four species, placeholder shape for anything else -------
    const geoBody = new THREE.OctahedronGeometry(1, 0);
    geoBody.scale(1.6, 0.55, 0.8);
    const geoFin = new THREE.ConeGeometry(0.35, 0.9, 4);
    geoFin.rotateZ(-Math.PI / 2);
    geoFin.translate(-1.7, 0, 0);

    type SwarmView = { body: THREE.InstancedMesh; wingL?: THREE.InstancedMesh; wingR?: THREE.InstancedMesh; cap: number };
    type CreatureView = {
      group: THREE.Group;
      mat: THREE.MeshLambertMaterial;
      modelled: boolean;
      limbs: Partial<Record<'tail' | 'wingL' | 'wingR', THREE.Object3D>>;
      swarm?: SwarmView;
      ring: THREE.Mesh;
      aggro?: THREE.Mesh;
      phase: number;
    };
    const creatureViews = new Map<string, CreatureView>();
    const selRingGeo = new THREE.RingGeometry(1.15, 1.3, 24);
    selRingGeo.rotateX(-Math.PI / 2);
    const selRingMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, side: THREE.DoubleSide });

    const ensureCreature = (c: CreatureRuntimeInstance): CreatureView => {
      let cv = creatureViews.get(c.id);
      if (cv) return cv;
      const modelled = isModelledCreature(c.defId);
      const group = new THREE.Group();
      const mat = modelled
        ? new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide })
        : new THREE.MeshLambertMaterial({ color: c.color || '#e05252', flatShading: true });
      const tag = { kind: 'creature', id: c.id };
      group.userData = tag;
      const limbs: CreatureView['limbs'] = {};
      let swarm: SwarmView | undefined;
      if (c.isSwarm) {
        const cap = Math.max(1, c.swarmEntities.length);
        const mk = (geo: THREE.BufferGeometry) => {
          const im = new THREE.InstancedMesh(geo, mat, cap);
          im.frustumCulled = false;
          im.userData = tag;
          scene.add(im); // members live in world space
          return im;
        };
        if (modelled) {
          const m = getCreatureModel(c.defId as 'veilfangs');
          const wl = m.limbs.find((l) => l.name === 'wingL');
          const wr = m.limbs.find((l) => l.name === 'wingR');
          swarm = { body: mk(m.body), wingL: wl && mk(wl.geo), wingR: wr && mk(wr.geo), cap };
        } else {
          swarm = { body: mk(new THREE.TetrahedronGeometry(1, 0).scale(1.6, 0.5, 1)), cap };
        }
      } else if (modelled) {
        const m = getCreatureModel(c.defId as 'dreadlot');
        const body = new THREE.Mesh(m.body, mat);
        body.userData = tag;
        group.add(body);
        for (const limb of m.limbs) {
          const pivot = new THREE.Group();
          pivot.position.set(...limb.pivot);
          const mesh = new THREE.Mesh(limb.geo, mat);
          mesh.userData = tag;
          pivot.add(mesh);
          group.add(pivot);
          limbs[limb.name] = pivot;
        }
      } else {
        const body = new THREE.Mesh(geoBody, mat);
        const fin = new THREE.Mesh(geoFin, mat);
        body.userData = fin.userData = tag;
        group.add(body, fin);
      }
      const ring = new THREE.Mesh(selRingGeo, selRingMat);
      ring.visible = false;
      group.add(ring);
      scene.add(group);
      let aggro: THREE.Mesh | undefined;
      if (!c.fleetId) {
        aggro = new THREE.Mesh(aggroRingGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide }));
        aggro.renderOrder = 2;
        scene.add(aggro);
      }
      cv = { group, mat, modelled, limbs, swarm, ring, aggro, phase: Math.random() * Math.PI * 2 };
      creatureViews.set(c.id, cv);
      return cv;
    };
    // ---- Creature HUD: HTML labels projected above each creature (name, behaviour chip, HP + armor, aggro) --
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;font-family:ui-monospace,monospace;';
    host.appendChild(overlay);
    type Hud = { root: HTMLDivElement; name: HTMLDivElement; chip: HTMLSpanElement; hp: HTMLDivElement; armor: HTMLDivElement; info: HTMLDivElement; cache: Record<string, string> };
    const huds = new Map<string, Hud>();
    const ensureHud = (c: CreatureRuntimeInstance): Hud => {
      let h = huds.get(c.id);
      if (h) return h;
      const root = document.createElement('div');
      root.style.cssText = 'position:absolute;left:0;top:0;display:flex;flex-direction:column;align-items:center;gap:2px;white-space:nowrap;will-change:transform;';
      const head = document.createElement('div');
      head.style.cssText = 'display:flex;align-items:center;gap:4px;';
      const name = document.createElement('div');
      name.style.cssText = 'font-size:10px;font-weight:700;color:#f8fafc;text-shadow:0 1px 2px #000a;';
      const chip = document.createElement('span');
      chip.style.cssText = 'font-size:9px;font-weight:700;padding:0 5px;border-radius:6px;border:1px solid;background:rgba(2,6,23,0.85);line-height:12px;';
      head.append(name, chip);
      const bar = document.createElement('div');
      bar.style.cssText = 'position:relative;width:60px;height:6px;background:#0f172a;border:1px solid #334155;';
      const hp = document.createElement('div');
      hp.style.cssText = 'position:absolute;left:0;top:0;bottom:0;background:#ef4444;';
      const armor = document.createElement('div');
      armor.style.cssText = 'position:absolute;left:0;top:0;height:2px;background:#38bdf8;';
      bar.append(hp, armor);
      const info = document.createElement('div');
      info.style.cssText = 'font-size:9px;text-shadow:0 1px 2px #000a;';
      root.append(head, bar, info);
      overlay.appendChild(root);
      h = { root, name, chip, hp, armor, info, cache: {} };
      huds.set(c.id, h);
      return h;
    };
    const setIf = (h: Hud, key: string, value: string, apply: () => void) => {
      if (h.cache[key] !== value) { h.cache[key] = value; apply(); }
    };
    const tmpV = new THREE.Vector3();

    const disposeCreature = (id: string) => {
      const hud = huds.get(id);
      if (hud) { hud.root.remove(); huds.delete(id); }
      const cv = creatureViews.get(id);
      if (!cv) return;
      scene.remove(cv.group);
      if (cv.swarm) {
        for (const im of [cv.swarm.body, cv.swarm.wingL, cv.swarm.wingR]) if (im) { scene.remove(im); im.dispose(); }
      }
      cv.mat.dispose();
      if (cv.aggro) { scene.remove(cv.aggro); (cv.aggro.material as THREE.Material).dispose(); }
      creatureViews.delete(id);
    };

    // ---- Gizmos: weapon cones, aggro rings, waypoints (same rules as the 2D canvas) -------------------
    const aggroRingGeo = new THREE.RingGeometry(0.99, 1, 128);
    aggroRingGeo.rotateX(-Math.PI / 2);

    type ConeView = { fill: THREE.Mesh; edge: THREE.LineLoop; pos: THREE.BufferAttribute; edgePos: THREE.BufferAttribute };
    const cones = new Map<string, ConeView>();
    const ensureCone = (id: string): ConeView => {
      let cv = cones.get(id);
      if (cv) return cv;
      const pos = new THREE.BufferAttribute(new Float32Array(12), 3);
      const fillGeo = new THREE.BufferGeometry();
      fillGeo.setAttribute('position', pos);
      fillGeo.setIndex([0, 1, 2, 0, 2, 3]);
      const fill = new THREE.Mesh(fillGeo, new THREE.MeshBasicMaterial({ color: '#38bdf8', transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      const edgePos = new THREE.BufferAttribute(new Float32Array(12), 3);
      const edgeGeo = new THREE.BufferGeometry();
      edgeGeo.setAttribute('position', edgePos);
      const edge = new THREE.LineLoop(edgeGeo, new THREE.LineBasicMaterial({ color: '#7dd3fc', transparent: true }));
      fill.frustumCulled = edge.frustumCulled = false;
      fill.renderOrder = edge.renderOrder = 2;
      shipYaw.add(fill, edge); // flat on the water, follows heading but not tilt
      cv = { fill, edge, pos, edgePos };
      cones.set(id, cv);
      return cv;
    };

    const wpPoleGeo = new THREE.CylinderGeometry(1.2, 1.2, 36, 6);
    wpPoleGeo.translate(0, 18, 0);
    const wpRingGeo = new THREE.RingGeometry(9, 13, 20);
    wpRingGeo.rotateX(-Math.PI / 2);
    const wpPool: Array<{ group: THREE.Group; mat: THREE.MeshBasicMaterial }> = [];
    const ensureWaypoint = (i: number) => {
      if (!wpPool[i]) {
        const mat = new THREE.MeshBasicMaterial({ color: '#7dd3fc', transparent: true, opacity: 0.9, side: THREE.DoubleSide });
        const group = new THREE.Group();
        const ring = new THREE.Mesh(wpRingGeo, mat);
        ring.position.y = 1.5;
        group.add(new THREE.Mesh(wpPoleGeo, mat), ring);
        scene.add(group);
        wpPool[i] = { group, mat };
      }
      wpPool[i].group.visible = true;
      return wpPool[i];
    };

    // ---- Crew: tiny specks on the deck (deck-local, like the 2D canvas), colour by status ----------
    let crewCap = 128;
    const crewGeo = new THREE.IcosahedronGeometry(1.6, 0);
    const crewMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const makeCrewMesh = (cap: number) => {
      const im = new THREE.InstancedMesh(crewGeo, crewMat, cap);
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
      im.frustumCulled = false;
      shipRoll.add(im);
      return im;
    };
    let crewMesh = makeCrewMesh(crewCap);
    const CREW_COLORS: Record<string, string> = { attacking: '#fbbf24', fleeing: '#f87171', seeking_shelter: '#34d399' };

    // ---- Projectiles / beams / blasts ---------------------------------------------------------
    const MAX_SHOTS = 1500;
    const shotMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const shots = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.6, 0), shotMat, MAX_SHOTS);
    shots.frustumCulled = false;
    shots.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_SHOTS * 3), 3);
    scene.add(shots);

    const beamGeo = new THREE.BoxGeometry(1, 1, 1);
    beamGeo.translate(0.5, 0, 0);
    const beamPool: THREE.Mesh[] = [];
    const blastGeo = new THREE.IcosahedronGeometry(1, 1);
    const blastPool: THREE.Mesh[] = [];
    const cloudGeo = new THREE.CylinderGeometry(1, 1, 6, 16, 1, true);
    const cloudPool: THREE.Mesh[] = [];
    const pooled = (pool: THREE.Mesh[], i: number, geo: THREE.BufferGeometry, opacity: number) => {
      if (!pool[i]) {
        const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity, depthWrite: false });
        pool[i] = new THREE.Mesh(geo, mat);
        scene.add(pool[i]);
      }
      pool[i].visible = true;
      return pool[i];
    };

    // ---- Route ----------------------------------------------------------------------------
    const routeMat = new THREE.LineDashedMaterial({ color: '#e8fbff', dashSize: 25, gapSize: 18 });
    const routeGeo = new THREE.BufferGeometry();
    const routeLine = new THREE.Line(routeGeo, routeMat);
    routeLine.frustumCulled = false;
    scene.add(routeLine);

    // ---- Camera start: 3/4 view off the starboard quarter -------------------------------------
    const shipWorld = () => new THREE.Vector3(M(engine.vesselCenter.x), 0, M(engine.vesselCenter.y));
    const start = shipWorld();
    controls.target.copy(start);
    camera.position.copy(start).add(new THREE.Vector3(-520, 420, 560));
    let lastShip = start.clone();

    // ---- Picking ----------------------------------------------------------------------------
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let downAt: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => { downAt = { x: e.clientX, y: e.clientY }; };
    const onUp = (e: PointerEvent) => {
      if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5 || e.button !== 0) { downAt = null; return; }
      downAt = null;
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      // Waypoint placement first (N held)
      const waterHit = raycaster.intersectObject(water, false)[0];
      if (waterHit && live.current.onWaterClick) {
        const pxPerM = 1 / M(1);
        if (live.current.onWaterClick(waterHit.point.x * pxPerM, waterHit.point.z * pxPerM, e.shiftKey)) return;
      }
      const pickables: THREE.Object3D[] = [];
      mounts.forEach((m) => pickables.push(m.group));
      creatureViews.forEach((cv) => { pickables.push(cv.group); if (cv.swarm) pickables.push(cv.swarm.body); });
      const hit = raycaster.intersectObjects(pickables, true).find((h) => h.object.userData?.kind);
      if (!hit) return;
      const { kind, id } = hit.object.userData as { kind: string; id: string };
      if (kind === 'slot') live.current.onSelectSlotId?.(id);
      if (kind === 'creature') {
        const c = engine.creatures.find((x) => x.id === id);
        if (c) live.current.onSelectCreature?.(c);
      }
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);

    const ro = new ResizeObserver(() => {
      const w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    ro.observe(host);

    // ---- Per-frame sync -----------------------------------------------------------------------
    const tmpObj = new THREE.Object3D();
    const tmpMat = new THREE.Matrix4();
    const wingMat = new THREE.Matrix4();
    const tmpColor = new THREE.Color();
    const flashRed = new THREE.Color('#ff3b30');
    const stunBlue = new THREE.Color('#5ac8fa');
    const deadGrey = new THREE.Color('#2a2d33');

    const creatureY = (c: CreatureRuntimeInstance): number => {
      if (c.underwater) return -MAX_DEPTH_M * (c.depthRatio ?? 1);
      if ((c.altitudeRatio ?? 0) > 0) return BREACH_APEX_M * (c.altitudeRatio ?? 0);
      if (c.isFlying) return FLY_ALT_M;
      return 0;
    };

    let frame = 0;
    const render = () => {
      frame = requestAnimationFrame(render);
      const vc = engine.vesselCenter;
      const b = engine.behemoth;
      const L = live.current;

      // Ship transform
      const ship = shipWorld();
      shipYaw.position.copy(ship);
      shipYaw.rotation.y = -deg(b.heading);
      shipRoll.rotation.x = deg(b.tiltAngle || 0);
      if (L.followShip) {
        const delta = ship.clone().sub(lastShip);
        controls.target.add(delta);
        camera.position.add(delta);
      }
      lastShip = ship;
      shipShadow.position.copy(ship).add(SHADOW_OFFSET);
      shipShadow.rotation.y = shipYaw.rotation.y;
      const hullFlash = (b.hullHitFlash ?? 0) > 0;
      lowPolyMat.emissive.set(hullFlash ? '#5a0d08' : '#000000');

      // Water/grid follow, snapped so the grid doesn't swim
      // Snap to whole texture tiles / grid tiles so ripples and grid stay fixed in the world (no sliding)
      water.position.set(Math.round(controls.target.x / WATER_TILE_M) * WATER_TILE_M, 0, Math.round(controls.target.z / WATER_TILE_M) * WATER_TILE_M);
      seabed.position.x = water.position.x;
      seabed.position.z = water.position.z;
      // clouds: world-fixed (plus wind drift), each wrapped into the field square around the camera target
      const tNow = performance.now() / 1000;
      const half = CLOUD_FIELD_M / 2;
      const wrap = (v: number) => ((((v + half) % CLOUD_FIELD_M) + CLOUD_FIELD_M) % CLOUD_FIELD_M) - half;
      for (const cl of clouds) {
        const wx = cl.x + CLOUD_WIND.x * tNow, wz = cl.z + CLOUD_WIND.y * tNow;
        cl.mesh.position.x = controls.target.x + wrap(wx - controls.target.x);
        cl.mesh.position.z = controls.target.z + wrap(wz - controls.target.z);
      }
      grid.position.set(Math.round(controls.target.x / tileM) * tileM, 0.5, Math.round(controls.target.z / tileM) * tileM);

      // Weapon mounts
      for (const slot of b.slots) {
        const mv = ensureMount(slot);
        const pose = weaponSlotLocalPose(slot, vc.width);
        mv.group.position.set(M(pose.x), mountBaseY(slot.row, slot.slotIndex), M(pose.y) * LATERAL_SCALE);
        mv.head.visible = !!slot.weapon;
        mv.head.rotation.y = -deg(slot.currentAimAngle - b.heading);
        const dead = slot.health <= 0;
        if (dead) tmpColor.copy(deadGrey);
        else if ((slot.hitFlashTimer ?? 0) > 0) tmpColor.copy(flashRed);
        else if (slot.isStunned) tmpColor.copy(stunBlue);
        else tmpColor.set(slot.weapon?.color || '#888888');
        mv.bodyMat.color.copy(tmpColor);
        mv.ring.visible = L.selectedSlotId === slot.id;

        // Firing cone (UE trapezoid: barrel width at the muzzle, widening to the cone at full Distance)
        const cone = ensureCone(slot.id);
        cone.fill.visible = cone.edge.visible = !!slot.weapon;
        if (slot.weapon) {
          const halfArc = Math.min(89, traverseArcDeg(slot.weapon, slot) / 2);
          const lenPx = Math.min(weaponDistancePx(slot.weapon), 800);
          const muzzlePx = shootingAreaPx(slot.weapon);
          const farPx = Math.min(muzzlePx + Math.tan(deg(halfArc)) * lenPx, lenPx * 3);
          const len = M(lenPx), muzzle = M(muzzlePx), far = M(farPx);
          const fr = deg(pose.facing);
          const fx = Math.cos(fr), fz = Math.sin(fr), lx = -fz, lz = fx;
          const ox = M(pose.x), oz = M(pose.y) * LATERAL_SCALE, y = 2;
          const v = [
            ox + lx * muzzle, y, oz + lz * muzzle,
            ox + fx * len + lx * far, y, oz + fz * len + lz * far,
            ox + fx * len - lx * far, y, oz + fz * len - lz * far,
            ox - lx * muzzle, y, oz - lz * muzzle,
          ];
          (cone.pos.array as Float32Array).set(v);
          (cone.edgePos.array as Float32Array).set(v);
          cone.pos.needsUpdate = cone.edgePos.needsUpdate = true;
          const spraying = isSprayWeapon(slot.weapon) && slot.beamActive;
          const fillMat = cone.fill.material as THREE.MeshBasicMaterial;
          fillMat.color.set(spraying ? '#10b981' : '#38bdf8');
          fillMat.opacity = spraying ? 0.22 : slot.isFiring ? 0.1 : 0.04;
          (cone.edge.material as THREE.LineBasicMaterial).opacity = L.selectedSlotId === slot.id ? 0.9 : 0.3;
        }
      }

      // Buildings: Tetris-shaped footprints on the flight deck (shape picked from the building id)
      for (const slot of b.buildingSlots) {
        const bv = ensureBuilding(slot);
        const local = buildingSlotLocalPose(slot, vc.width, vc.height);
        const x = M(local.x);
        bv.mesh.visible = !!slot.building;
        if (!slot.building) continue;
        if (bv.mesh.userData.shapeOf !== slot.building.id) {
          const shape = buildingShape(slot.building.id);
          bv.mesh.geometry = shape.geo;
          bv.mesh.rotation.y = shape.yaw;
          bv.mesh.userData.shapeOf = slot.building.id;
        }
        const dead = slot.health <= 0;
        const h = dead ? 1.5 : BUILDING_HEIGHT[slot.building.category ?? "job"] ?? 12;
        bv.mesh.position.set(x, deckTopAt(x), M(local.y) * LATERAL_SCALE);
        bv.mesh.scale.set(1, h, 1);
        if (dead) tmpColor.copy(deadGrey);
        else if ((slot.hitFlashTimer ?? 0) > 0) tmpColor.copy(flashRed);
        else if (slot.isStunned) tmpColor.copy(stunBlue);
        else tmpColor.set(slot.building.color || '#888888').multiplyScalar(slot.isOffline || slot.isDiverted ? 0.45 : 1);
        bv.mat.color.copy(tmpColor);
      }

      // Crew specks (hidden crew are inside buildings, snatched ones are carried off)
      if (engine.crewAgents.length > crewCap) {
        shipRoll.remove(crewMesh);
        crewMesh.dispose();
        crewCap = Math.max(engine.crewAgents.length, crewCap * 2);
        crewMesh = makeCrewMesh(crewCap);
      }
      let nc = 0;
      for (const agent of engine.crewAgents) {
        if (agent.status === 'hidden' || agent.status === 'snatched' || agent.hp <= 0) continue;
        const ax = M(agent.x);
        tmpObj.position.set(ax, deckTopAt(ax) + 1.6, M(agent.y) * LATERAL_SCALE);
        tmpObj.rotation.set(0, 0, 0);
        tmpObj.scale.setScalar(agent.status === 'attacking' ? 1.2 : 1);
        tmpObj.updateMatrix();
        crewMesh.setMatrixAt(nc, tmpObj.matrix);
        crewMesh.setColorAt(nc, tmpColor.set(CREW_COLORS[agent.status] ?? '#e2e8f0'));
        nc++;
      }
      crewMesh.count = nc;
      crewMesh.instanceMatrix.needsUpdate = true;
      if (crewMesh.instanceColor) crewMesh.instanceColor.needsUpdate = true;

      // Creatures
      const t = performance.now() / 1000;
      const seen = new Set<string>();
      for (const c of engine.creatures) {
        if (c.escaped) continue;
        seen.add(c.id);
        const cv = ensureCreature(c);
        const y = creatureY(c);
        const rM = Math.max(4, M(c.radius || 10));
        const dead = c.hp <= 0;
        const airborne = !c.underwater && (c.isFlying || (c.altitudeRatio ?? 0) > 0);
        // submerged look comes from the semi-transparent water above them
        if (cv.modelled) cv.mat.color.set(dead ? '#555555' : '#ffffff');
        else cv.mat.color.set(dead ? '#444444' : c.color || '#e05252');
        cv.mat.emissive.set((c.damagePulseTimer ?? 0) > 0 ? '#5a5a5a' : c.stunned ? '#1b4d6b' : '#000000');

        if (cv.swarm) {
          const sw = cv.swarm;
          const n = Math.min(c.swarmEntities.length, sw.cap);
          let k = 0;
          for (let i = 0; i < n; i++) {
            const e = c.swarmEntities[i];
            if (e.hp <= 0) continue;
            const er = Math.max(4, M(e.radius ?? c.radius ?? 5)) * (cv.modelled ? VEILFANG_VISUAL_SCALE : 1);
            tmpObj.position.set(M(e.x), y + Math.sin(t * 3 + i) * 1.5, M(e.y));
            tmpObj.rotation.set(0, -Math.atan2(e.vy ?? 0, e.vx ?? 1), 0);
            tmpObj.scale.setScalar(er);
            tmpObj.updateMatrix();
            sw.body.setMatrixAt(k, tmpObj.matrix);
            if (sw.wingL && sw.wingR) {
              const flap = dead ? 0 : Math.sin(t * 11 + i * 1.7) * 0.55;
              for (const [im, sgn] of [[sw.wingR, -1], [sw.wingL, 1]] as const) {
                wingMat.makeRotationX(sgn * flap);
                wingMat.setPosition(0, 0, -sgn * 0.12);
                tmpMat.multiplyMatrices(tmpObj.matrix, wingMat);
                im.setMatrixAt(k, tmpMat);
              }
            }
            k++;
          }
          for (const im of [sw.body, sw.wingL, sw.wingR]) {
            if (!im) continue;
            im.count = k;
            im.instanceMatrix.needsUpdate = true;
          }
          cv.group.position.set(M(c.x), y, M(c.y));
          cv.ring.scale.setScalar(rM * 3);
        } else {
          cv.group.position.set(M(c.x), y, M(c.y));
          cv.group.rotation.set(0, -deg(c.angle), 0);
          cv.group.scale.setScalar(rM);
          cv.ring.scale.setScalar(1.4);
          const ph = t + cv.phase;
          if (cv.limbs.tail) cv.limbs.tail.rotation.y = dead ? 0 : Math.sin(ph * 1.6) * 0.28;
          if (cv.limbs.wingL && cv.limbs.wingR) {
            // big slow beats in the air, gentle undulation while swimming
            const flap = dead ? 0 : airborne ? Math.sin(ph * 2.4) * 0.45 : Math.sin(ph * 1.2) * 0.12;
            cv.limbs.wingR.rotation.x = -flap;
            cv.limbs.wingL.rotation.x = flap;
          }
        }
        cv.ring.visible = L.selectedCreatureId === c.id;

        // Aggro radius ring (same colour rules as 2D)
        if (cv.aggro) {
          const def = engine.creatureDefs.get(c.defId);
          const aggroM = c.aggroRadiusMeters ?? def?.aggroRadiusMeters ?? 1000;
          const disengaged = c.isAggroed === false;
          const losing = (c.outOfAggroTimer || 0) > 0 && !disengaged;
          const am = cv.aggro.material as THREE.MeshBasicMaterial;
          if (disengaged) { am.color.set('#64748b'); am.opacity = 0.3; }
          else if (losing) { am.color.set('#f59e0b'); am.opacity = 0.55; }
          else if (c.aggression >= 60) { am.color.set('#ef4444'); am.opacity = 0.45; }
          else { am.color.set('#eab308'); am.opacity = 0.3; }
          cv.aggro.position.set(M(c.x), 1.2, M(c.y));
          cv.aggro.scale.setScalar(aggroM);
        }
      }
      creatureViews.forEach((_, id) => { if (!seen.has(id)) disposeCreature(id); });

      // Creature HUD labels
      const rect = renderer.domElement.getBoundingClientRect();
      for (const c of engine.creatures) {
        const cv = creatureViews.get(c.id);
        if (!cv || c.escaped || c.fleetId) continue;
        const h = ensureHud(c);
        const rM = Math.max(4, M(c.radius || 10));
        tmpV.set(M(c.x), creatureY(c) + (c.isSwarm ? 25 : rM * 0.7 + 12), M(c.y)).project(camera);
        const onScreen = tmpV.z < 1 && Math.abs(tmpV.x) < 1.2 && Math.abs(tmpV.y) < 1.2;
        h.root.style.display = onScreen ? 'flex' : 'none';
        if (!onScreen) continue;
        const sx = (tmpV.x * 0.5 + 0.5) * rect.width, sy = (-tmpV.y * 0.5 + 0.5) * rect.height;
        h.root.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -100%)`;

        setIf(h, 'name', c.name, () => { h.name.textContent = `${!c.isSwarm && c.emoji ? c.emoji + ' ' : ''}${c.name.toUpperCase()}`; });
        const chip = behaviourChip(engine, c);
        setIf(h, 'chip', chip ? chip.join('|') : '', () => {
          h.chip.style.display = chip ? 'inline-block' : 'none';
          if (chip) { h.chip.textContent = chip[0]; h.chip.style.color = chip[1]; h.chip.style.borderColor = chip[1]; }
        });
        const hpPct = Math.max(0, c.hp / Math.max(1, c.maxHp));
        const armorPct = c.maxPhysicalArmor > 0 ? Math.max(0, c.physicalArmor / c.maxPhysicalArmor) : 0;
        setIf(h, 'hp', hpPct.toFixed(3), () => { h.hp.style.width = `${hpPct * 100}%`; });
        setIf(h, 'armor', armorPct.toFixed(3), () => { h.armor.style.width = `${armorPct * 100}%`; h.armor.style.display = armorPct > 0 ? 'block' : 'none'; });

        const def = engine.creatureDefs.get(c.defId);
        const disengaged = c.isAggroed === false;
        const losing = (c.outOfAggroTimer || 0) > 0 && !disengaged;
        const typeLabel = c.isFlying ? 'FLYING' : c.underwater ? 'SUBMERGED' : 'AQUATIC';
        const kts = def ? normalizeSpeedToKnots(def.movementSpeed) : 10;
        const distM = Math.round(pxToMeters(Math.hypot(c.x - vc.x, c.y - vc.y)));
        const info = disengaged
          ? `DISENGAGED [${typeLabel}] • ${kts} kts • ${distM}m`
          : losing
          ? `LOSING AGGRO (${(10 - (c.outOfAggroTimer || 0)).toFixed(1)}s) • ${kts} kts • ${distM}m`
          : `AGG ${Math.round(c.aggression)}% [${typeLabel}] • ${kts} kts • ${distM}m`;
        const infoColor = disengaged ? '#94a3b8' : losing ? '#f59e0b' : c.aggression < 40 ? '#38bdf8' : c.aggression < 60 ? '#f59e0b' : '#ef4444';
        setIf(h, 'info', info + infoColor, () => { h.info.textContent = info; h.info.style.color = infoColor; });
      }

      // Projectiles, beams, blasts, clouds
      let s = 0, bi = 0, ei = 0, ci = 0;
      for (const p of engine.projectiles) {
        if (p.isBeam) {
          const m = pooled(beamPool, bi++, beamGeo, 0.9);
          const sx = M(p.sourceX), sz = M(p.sourceY), tx = M(p.targetX), tz = M(p.targetY);
          const len = Math.hypot(tx - sx, tz - sz);
          const w = Math.max(1.5, M(p.aoe || 1) * 2);
          m.position.set(sx, LINE_SHOT_Y, sz);
          m.rotation.set(0, -Math.atan2(tz - sz, tx - sx), 0);
          m.scale.set(len, w, w);
          (m.material as THREE.MeshBasicMaterial).color.set(p.color || '#a855f7');
          continue;
        }
        if (p.isExplosion) {
          const m = pooled(blastPool, ei++, blastGeo, 0.5);
          const life = Math.max(0, (p.explosionLifetime ?? 0.35) / 0.35);
          const r = M(p.explosionRadius ?? 85) * (1.2 - life * 0.4);
          m.position.set(M(p.x), 0, M(p.y));
          m.scale.set(r, r * 0.45, r);
          const mat = m.material as THREE.MeshBasicMaterial;
          mat.color.set('#ffb340');
          mat.opacity = 0.55 * life;
          continue;
        }
        if (p.isCloud) {
          const m = pooled(cloudPool, ci++, cloudGeo, 0.3);
          const r = M(p.cloudRadius ?? 80);
          m.position.set(M(p.x), 3, M(p.y));
          m.scale.set(r, 1, r);
          const mat = m.material as THREE.MeshBasicMaterial;
          mat.color.set('#34d399');
          mat.opacity = 0.3 * Math.max(0.2, 1 - (p.cloudDuration ?? 0) / (p.cloudMaxDuration ?? 4));
          continue;
        }
        if (s >= MAX_SHOTS) continue;
        const y = p.trajectory === 'Arch' ? LINE_SHOT_Y + Math.sin(p.arcProgress * Math.PI) * ARCH_APEX_M : LINE_SHOT_Y;
        tmpObj.position.set(M(p.x), y, M(p.y));
        tmpObj.rotation.set(0, 0, 0);
        tmpObj.scale.setScalar(p.trajectory === 'Arch' ? 2.4 : 1);
        tmpObj.updateMatrix();
        shots.setMatrixAt(s, tmpObj.matrix);
        shots.setColorAt(s, tmpColor.set(p.color || '#ffe08a'));
        s++;
      }
      shots.count = s;
      shots.instanceMatrix.needsUpdate = true;
      if (shots.instanceColor) shots.instanceColor.needsUpdate = true;
      for (let i = bi; i < beamPool.length; i++) beamPool[i].visible = false;
      for (let i = ei; i < blastPool.length; i++) blastPool[i].visible = false;
      for (let i = ci; i < cloudPool.length; i++) cloudPool[i].visible = false;

      // Route (path points if planned, else straight waypoint legs)
      const pts = b.pathPoints?.length ? b.pathPoints : b.waypoints;
      if (pts.length) {
        const arr = new Float32Array((pts.length + 1) * 3);
        arr.set([ship.x, 1.5, ship.z], 0);
        pts.forEach((pt, i) => arr.set([M(pt.x), 1.5, M(pt.y)], (i + 1) * 3));
        routeGeo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
        routeLine.computeLineDistances();
        routeLine.visible = true;
      } else routeLine.visible = false;
      b.waypoints.forEach((wp, i) => {
        const w = ensureWaypoint(i);
        w.group.position.set(M(wp.x), 0, M(wp.y));
        w.mat.color.set(i === b.waypoints.length - 1 ? '#fbbf24' : '#7dd3fc'); // final waypoint amber
      });
      for (let i = b.waypoints.length; i < wpPool.length; i++) wpPool[i].group.visible = false;

      controls.update();
      renderer.render(scene, camera);
    };
    render();

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      controls.dispose();
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      });
      renderer.dispose();
      host.removeChild(renderer.domElement);
      overlay.remove();
    };
  }, [engine]);

  return <div ref={mountRef} className="absolute inset-0" />;
};
