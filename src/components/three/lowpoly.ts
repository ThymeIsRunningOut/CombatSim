import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Tiny toolkit for flat-shaded, vertex-coloured low-poly models.
 * Every model part is merged into one geometry with a `color` attribute, so a model is one draw call
 * and needs one MeshLambertMaterial({ vertexColors: true, flatShading: true }).
 */

export type Part = { geo: THREE.BufferGeometry; color: string };
export type V3 = [number, number, number];

export function colorize(geo: THREE.BufferGeometry, color: string): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g.getAttribute('uv')) g.deleteAttribute('uv');
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  const c = new THREE.Color(color);
  const n = g.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

export function mergeParts(parts: Part[]): THREE.BufferGeometry {
  const merged = mergeGeometries(parts.map((p) => colorize(p.geo, p.color)), false);
  if (!merged) throw new Error('low-poly merge failed');
  merged.computeBoundingSphere();
  return merged;
}

/**
 * Body of revolution along +X (tail at low x, nose at high x).
 * profile: [x, radius] pairs from tail to nose. sy / sz squash height / width.
 */
export function spindle(profile: Array<[number, number]>, segments = 7, sy = 1, sz = 1): THREE.BufferGeometry {
  const pts = profile.map(([x, r]) => new THREE.Vector2(Math.max(r, 0.0001), x));
  const geo = new THREE.LatheGeometry(pts, segments);
  geo.rotateZ(-Math.PI / 2); // lathe axis Y -> X
  geo.scale(1, sy, sz);
  return geo;
}

/** Flat polygon (triangle fan from the first point), for fins, wings and membranes. Render double-sided. */
export function poly(points: V3[]): THREE.BufferGeometry {
  const pos: number[] = [];
  for (let i = 1; i < points.length - 1; i++) pos.push(...points[0], ...points[i], ...points[i + 1]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

/** Same polygon mirrored across the XY plane (z -> -z), for the other side. */
export const mirrorZ = (points: V3[]): V3[] => points.map(([x, y, z]) => [x, y, -z] as V3);

/** 4-sided spike with its base at `at`, pointing along `dir` (normalised internally). */
export function spike(at: V3, dir: V3, length: number, radius: number, sides = 4): THREE.BufferGeometry {
  const geo = new THREE.ConeGeometry(radius, length, sides, 1);
  geo.translate(0, length / 2, 0); // base at origin, tip at +Y
  const d = new THREE.Vector3(...dir).normalize();
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d));
  geo.translate(...at);
  return geo;
}

export function box(center: V3, size: V3): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(...size);
  geo.translate(...center);
  return geo;
}
