import * as THREE from 'three';
import { Part, V3, mergeParts, spindle, poly, mirrorZ, spike, box } from './lowpoly';

/**
 * Low-poly creature models after the concepts. Each model is in "radius units": it spans roughly x -1..1
 * (nose at +X, up +Y, starboard +Z), so the view scales it by the creature's sim collision radius.
 *
 * Moving parts (tails, wings) are separate geometries hung on pivots so they can sway or flap without skinning.
 * Geometries are built once per kind and shared by every instance.
 */

export type CreatureKind = 'dreadlot' | 'aetherfin' | 'thunder_leviarch' | 'veilfangs';

export interface CreatureModelParts {
  body: THREE.BufferGeometry;
  /** Pivoted parts: geometry is authored relative to `pivot`. */
  limbs: Array<{ name: 'tail' | 'wingL' | 'wingR'; geo: THREE.BufferGeometry; pivot: V3 }>;
}

const C = {
  // Dreadlot: slate-blue whale-shark, beige armoured head, tan barnacle belly (in-game render)
  dreadBody: '#3b5367',
  dreadBelly: '#a08262',
  dreadFin: '#33485a',
  dreadPlate: '#cbbfa6',
  dreadMouth: '#2a1f2a',
  // Aetherfin: slate shovel-nose eel with yellow spines
  aeBody: '#5d6c79',
  aeFin: '#6f7e8b',
  aeYellow: '#e8d417',
  // Leviarch: indigo manta, glowing blue wing stripes, yellow horns
  levBody: '#2b2860',
  levWing: '#3a3a8c',
  levGlow: '#4f9cf0',
  levBelly: '#6cc3c9',
  levHorn: '#f2c21a',
  // Veilfangs: dark spiked body, blue maw, violet bat wings
  veilBody: '#2e3848',
  veilMaw: '#4aa8e0',
  veilWing: '#6b7fe6',
  veilClaw: '#5fb6e6',
};

const shift = (pts: V3[], d: V3): V3[] => pts.map(([x, y, z]) => [x - d[0], y - d[1], z - d[2]] as V3);

function dreadlot(): CreatureModelParts {
  const p: Part[] = [];
  // Body (tail stub at -0.75, the tail piece continues it)
  p.push({ geo: spindle([[-0.78, 0.07], [-0.5, 0.2], [-0.1, 0.31], [0.3, 0.34], [0.6, 0.31], [0.85, 0.22], [1.0, 0.02]], 8, 0.9, 0.85), color: C.dreadBody });
  // Belly band
  p.push({ geo: spindle([[-0.4, 0.1], [0.0, 0.25], [0.45, 0.25], [0.75, 0.12]], 6, 0.5, 0.8).translate(0, -0.15, 0), color: C.dreadBelly });
  // Armoured head plate (sperm-whale dome)
  p.push({ geo: spindle([[0.3, 0.02], [0.42, 0.27], [0.68, 0.35], [0.9, 0.3], [1.04, 0.02]], 8, 0.78, 0.9).translate(0, 0.12, 0), color: C.dreadPlate });
  p.push({ geo: box([0.86, -0.13, 0], [0.24, 0.06, 0.26]), color: C.dreadMouth });
  // Dorsal fins + spine row
  p.push({ geo: poly([[-0.1, 0.27, 0], [0.12, 0.29, 0], [-0.22, 0.66, 0]]), color: C.dreadFin });
  p.push({ geo: poly([[-0.5, 0.17, 0], [-0.34, 0.2, 0], [-0.6, 0.42, 0]]), color: C.dreadFin });
  for (let i = 0; i < 6; i++) {
    const x = 0.3 - i * 0.1;
    p.push({ geo: spike([x, 0.3 - i * 0.012, 0], [-0.4, 1, 0], 0.13 - i * 0.012, 0.03), color: C.dreadFin });
  }
  // Pectoral and pelvic fins
  const pect: V3[] = [[0.38, -0.12, 0.24], [0.16, -0.14, 0.27], [0.02, -0.5, 0.58]];
  const pelv: V3[] = [[0.0, -0.22, 0.18], [-0.14, -0.22, 0.2], [-0.2, -0.5, 0.36]];
  for (const f of [pect, pelv]) {
    p.push({ geo: poly(f), color: C.dreadFin });
    p.push({ geo: poly(mirrorZ(f)), color: C.dreadFin });
  }
  // Tail: shark-like vertical fluke, pivots at the tail stub
  const pivot: V3 = [-0.75, 0, 0];
  const tail: Part[] = [
    { geo: spindle([[-1.05, 0.03], [-0.75, 0.08]], 6, 0.9, 0.7), color: C.dreadBody },
    { geo: poly([[-0.98, 0.02, 0], [-1.32, 0.5, 0], [-1.12, 0.0, 0]]), color: C.dreadFin },
    { geo: poly([[-0.98, -0.02, 0], [-1.28, -0.36, 0], [-1.12, 0.0, 0]]), color: C.dreadFin },
  ];
  tail.forEach((t) => t.geo.translate(-pivot[0], -pivot[1], -pivot[2]));
  return { body: mergeParts(p), limbs: [{ name: 'tail', geo: mergeParts(tail), pivot }] };
}

function aetherfin(): CreatureModelParts {
  const p: Part[] = [];
  // Flat, broad shovel-nosed body
  p.push({ geo: spindle([[-0.3, 0.07], [0.0, 0.12], [0.35, 0.15], [0.7, 0.15], [0.92, 0.1], [1.0, 0.02]], 7, 0.55, 1.35), color: C.aeBody });
  // Yellow dorsal spines, large to small going aft
  for (let i = 0; i < 7; i++) {
    const x = 0.62 - i * 0.13;
    p.push({ geo: spike([x, 0.07, 0], [-0.45, 1, 0], 0.22 - i * 0.022, 0.035), color: C.aeYellow });
  }
  for (let i = 0; i < 6; i++) p.push({ geo: spike([0.8 - i * 0.1, 0.06, (i % 2 ? 1 : -1) * 0.05], [0, 1, 0], 0.05, 0.015), color: C.aeYellow });
  // Spiky lateral fins (pectoral wide, second pair smaller)
  const pect: V3[] = [[0.62, 0, 0.17], [0.4, 0, 0.19], [0.3, -0.02, 0.48], [0.38, -0.01, 0.36], [0.5, 0, 0.42]];
  const fin2: V3[] = [[0.05, 0, 0.13], [-0.12, 0, 0.13], [-0.18, -0.02, 0.32]];
  for (const f of [pect, fin2]) {
    p.push({ geo: poly(f), color: C.aeFin });
    p.push({ geo: poly(mirrorZ(f)), color: C.aeFin });
  }
  p.push({ geo: poly([[0.15, 0.07, 0], [0.32, 0.07, 0], [0.12, 0.25, 0]]), color: C.aeFin }); // small grey dorsal
  // Long whip tail with a yellow-striped fin, pivots behind the body
  const pivot: V3 = [-0.3, 0, 0];
  const tail: Part[] = [
    { geo: spindle([[-1.15, 0.01], [-0.8, 0.035], [-0.3, 0.075]], 6, 0.6, 1.0), color: C.aeBody },
    { geo: poly([[-0.85, 0.02, 0], [-1.15, 0.02, 0], [-1.2, 0.15, 0]]), color: C.aeFin },
    { geo: poly([[-0.88, 0.035, 0], [-1.08, 0.03, 0], [-1.12, 0.1, 0]]), color: C.aeYellow },
  ];
  for (let i = 0; i < 4; i++) tail.push({ geo: spike([-0.4 - i * 0.1, 0.05, 0], [-0.5, 1, 0], 0.07, 0.02), color: C.aeYellow });
  tail.forEach((t) => t.geo.translate(-pivot[0], -pivot[1], -pivot[2]));
  return { body: mergeParts(p), limbs: [{ name: 'tail', geo: mergeParts(tail), pivot }] };
}

function leviarch(): CreatureModelParts {
  const p: Part[] = [];
  // Central body: manta torso
  p.push({ geo: spindle([[-0.45, 0.02], [-0.25, 0.12], [0.1, 0.18], [0.45, 0.15], [0.68, 0.02]], 8, 0.7, 1.15), color: C.levBody });
  p.push({ geo: spindle([[-0.2, 0.05], [0.1, 0.14], [0.4, 0.1]], 6, 0.4, 1.1).translate(0, -0.08, 0), color: C.levBelly });
  // Cephalic horns (yellow), crest spikes, belly spines
  for (const s of [1, -1]) {
    p.push({ geo: spike([0.55, -0.02, 0.12 * s], [1, -0.25, 0.25 * s], 0.22, 0.035), color: C.levHorn });
    p.push({ geo: spike([0.42, 0.06, 0.1 * s], [0.4, 1, 0.4 * s], 0.16, 0.03), color: C.levBody });
  }
  for (let i = 0; i < 5; i++) {
    const x = 0.2 - i * 0.13;
    p.push({ geo: spike([x, 0.1, 0], [-0.7, 1, 0], 0.24 - i * 0.03, 0.035), color: i % 2 ? C.levHorn : C.levBody });
  }
  for (let i = 0; i < 4; i++) p.push({ geo: spike([0.25 - i * 0.12, -0.1, (i % 2 ? 1 : -1) * 0.07], [0, -1, 0], 0.12, 0.02), color: C.levBelly });
  // Long thin tail with a small fork
  p.push({ geo: spindle([[-1.3, 0.004], [-0.45, 0.035]], 4, 0.7, 0.7), color: C.levBody });
  p.push({ geo: poly([[-1.0, 0, 0], [-1.25, 0.12, 0], [-1.15, 0, 0]]), color: C.levHorn });

  // Wings, pivoting at the shoulders (left = port = -Z)
  const wingR: V3[] = [[0.42, 0, 0.1], [0.05, 0.03, 0.55], [-0.15, 0.08, 1.05], [-0.2, 0, 0.6], [-0.42, 0, 0.1]];
  const glowR: V3[] = [[0.25, 0.012, 0.15], [-0.05, 0.05, 0.85], [-0.12, 0.012, 0.2]];
  const pivotR: V3 = [0, 0, 0.12];
  const wR = mergeParts([
    { geo: poly(shift(wingR, pivotR)), color: C.levWing },
    { geo: poly(shift(glowR, pivotR)), color: C.levGlow },
  ]);
  const pivotL: V3 = [0, 0, -0.12];
  const wL = mergeParts([
    { geo: poly(shift(mirrorZ(wingR), pivotL)), color: C.levWing },
    { geo: poly(shift(mirrorZ(glowR), pivotL)), color: C.levGlow },
  ]);
  return {
    body: mergeParts(p),
    limbs: [
      { name: 'wingR', geo: wR, pivot: pivotR },
      { name: 'wingL', geo: wL, pivot: pivotL },
    ],
  };
}

function veilfang(): CreatureModelParts {
  const p: Part[] = [];
  p.push({ geo: new THREE.IcosahedronGeometry(0.2, 0), color: C.veilBody });
  // Round toothed maw facing forward
  p.push({ geo: new THREE.CylinderGeometry(0.12, 0.12, 0.05, 8).rotateZ(Math.PI / 2).translate(0.18, 0, 0), color: C.veilMaw });
  p.push({ geo: spike([0, 0.15, 0], [-0.4, 1, 0], 0.22, 0.05), color: C.veilBody }); // crest horn
  for (const s of [1, -1]) p.push({ geo: spike([0.05, -0.15, 0.08 * s], [0.5, -1, 0.15 * s], 0.32, 0.03), color: C.veilClaw }); // claws
  // Bat wings (finger tips scalloped)
  const wingR: V3[] = [[0.08, 0, 0.12], [-0.02, 0.1, 0.6], [0.02, 0.12, 1.0], [-0.22, 0, 0.82], [-0.18, 0, 0.55], [-0.25, 0, 0.32], [-0.1, 0, 0.12]];
  const pivotR: V3 = [0, 0, 0.12];
  const pivotL: V3 = [0, 0, -0.12];
  return {
    body: mergeParts(p),
    limbs: [
      { name: 'wingR', geo: mergeParts([{ geo: poly(shift(wingR, pivotR)), color: C.veilWing }]), pivot: pivotR },
      { name: 'wingL', geo: mergeParts([{ geo: poly(shift(mirrorZ(wingR), pivotL)), color: C.veilWing }]), pivot: pivotL },
    ],
  };
}

const BUILDERS: Record<CreatureKind, () => CreatureModelParts> = {
  dreadlot,
  aetherfin,
  thunder_leviarch: leviarch,
  veilfangs: veilfang,
};
const cache = new Map<CreatureKind, CreatureModelParts>();

export function isModelledCreature(defId: string): defId is CreatureKind {
  return defId in BUILDERS;
}

export function getCreatureModel(kind: CreatureKind): CreatureModelParts {
  let m = cache.get(kind);
  if (!m) {
    m = BUILDERS[kind]();
    cache.set(kind, m);
  }
  return m;
}
