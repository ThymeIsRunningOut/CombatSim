import * as THREE from 'three';
import { Part, mergeParts, box } from './lowpoly';

/**
 * Deck buildings as polyomino (Tetris-like) footprints, after the in-game Building Mode grid.
 * Visual only: the sim still treats each building slot as a point/pad. The shape and its rotation are picked
 * from the building id, so the same building always looks the same.
 *
 * Geometry is authored 1 m tall (scale Y by the building height) and centred on the footprint.
 */

export const CELL_M = 9;

const SHAPES: Array<Array<[number, number]>> = [
  [[0, 0], [1, 0], [2, 0], [3, 0]], // I
  [[0, 0], [1, 0], [0, 1], [1, 1]], // O
  [[0, 0], [1, 0], [2, 0], [1, 1]], // T
  [[0, 0], [1, 0], [2, 0], [2, 1]], // L
  [[0, 0], [1, 0], [2, 0], [0, 1]], // J
  [[1, 0], [2, 0], [0, 1], [1, 1]], // S
  [[0, 0], [1, 0], [1, 1], [2, 1]], // Z
  [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]], // P (pentomino)
  [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2]], // T5
  [[0, 0], [0, 1], [1, 1], [2, 1], [2, 0]], // U
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const cache = new Map<number, THREE.BufferGeometry>();

function shapeGeometry(index: number): THREE.BufferGeometry {
  let g = cache.get(index);
  if (g) return g;
  const cells = SHAPES[index];
  const cx = cells.reduce((a, c) => a + c[0], 0) / cells.length;
  const cz = cells.reduce((a, c) => a + c[1], 0) / cells.length;
  const parts: Part[] = [];
  for (const [i, j] of cells) {
    const x = (i - cx) * CELL_M;
    const z = (j - cz) * CELL_M;
    parts.push({ geo: box([x, 0.5, z], [CELL_M, 1, CELL_M]), color: '#ffffff' }); // tinted by the material colour
    parts.push({ geo: box([x, 1.06, z], [CELL_M * 0.62, 0.12, CELL_M * 0.62]), color: '#c9cdd3' }); // roof unit
  }
  g = mergeParts(parts);
  cache.set(index, g);
  return g;
}

/** Footprint geometry + yaw (radians) for a building id. */
export function buildingShape(buildingId: string): { geo: THREE.BufferGeometry; yaw: number } {
  const h = hash(buildingId);
  return { geo: shapeGeometry(h % SHAPES.length), yaw: ((h >>> 8) % 4) * (Math.PI / 2) };
}
