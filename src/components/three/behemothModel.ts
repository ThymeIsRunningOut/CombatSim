import * as THREE from 'three';
import { BEHEMOTH_LENGTH_METERS, BEHEMOTH_BEAM_METERS } from '../../engine/measurements';
import { Part, mergeParts } from './lowpoly';

/**
 * Low-poly Behemoth (BHEV-07M) built from primitives, after the top-view concept.
 *
 * Local frame (metres): origin = hull centre at the waterline, +X = bow, +Z = starboard, +Y = up.
 * Matches the engine's deck-local frame (+x bow, +y starboard; engine y -> three z).
 *
 * Concept top view: bow (pointed nose with the two round towers) on the LEFT, stern (unit parking pad / big
 * rectangle, bridge tower) on the RIGHT, starboard on TOP. Image px map onto deck-local coordinates rotated 180°.
 * The model uses the concept's proportions (505 x 184 m). The sim footprint stays 505 x 130 m, so the view
 * stretches deck-local lateral positions (mounts, buildings) by LATERAL_SCALE to land them on the model.
 *
 * Everything static is merged into ONE geometry with vertex colours -> one draw call, a few hundred triangles.
 */

export const PALETTE = {
  hullRed: '#d9554a',
  hullRedDark: '#a93d35',
  cream: '#e6e4e0',
  yellow: '#f2c462',
  blue: '#1e88f0',
  deck: '#3b4656',
  deckBay: '#465262',
  steel: '#b9bec6',
  steelDark: '#7c8592',
};

const L = BEHEMOTH_LENGTH_METERS;
/** Visual beam (concept proportions 2.745:1). */
export const MODEL_BEAM_METERS = 184;
const B = MODEL_BEAM_METERS;
/** Sim deck-local lateral (m) -> model lateral (m). */
export const LATERAL_SCALE = MODEL_BEAM_METERS / BEHEMOTH_BEAM_METERS;

// Concept image frame (top view, bow LEFT, starboard TOP).
const IMG_X0 = 30;
const IMG_X1 = 2525;
const IMG_YC = 482;
const IMG_HALF_BEAM = 455;

/** Concept image px -> local metres { x (bow +), z (starboard +) }. */
function img(ix: number, iy: number): { x: number; z: number } {
  const u = 1 - (ix - IMG_X0) / (IMG_X1 - IMG_X0); // 0 = stern (right), 1 = bow (left)
  return { x: (u - 0.5) * L, z: ((IMG_YC - iy) / IMG_HALF_BEAM) * (B / 2) };
}
const imgLen = (px: number) => (px / (IMG_X1 - IMG_X0)) * L;
const mirrorY = (iy: number) => 2 * IMG_YC - iy;

// Hull outline, starboard half (image top), bow tip -> stern tip (concept image px). Mirrored for port.
const HULL_HALF_OUTLINE: Array<[number, number]> = [
  [35, 405],
  [180, 330],
  [420, 190],
  [560, 135],
  [700, 85],
  [800, 40],
  [1270, 40],
  [1330, 118],
  [1470, 118],
  [1520, 40],
  [1800, 40],
  [1860, 140],
  [2060, 150],
  [2300, 255],
  [2480, 350],
  [2525, 430],
];

/**
 * Weapon mounts in the concept (image px). Keep in sync with SIDE_MOUNT_POSITIONS_X / *_LATERAL_FRAC in
 * engine/navigation.ts (normalised versions of these points): side mounts on the grey sponson bays (2 per bay,
 * bay centre y = 140), aft mounts on the stern tip guns (right end, outer barrel pair).
 */
export const ART_AFT_MOUNTS: Array<[number, number]> = [[2440, 584], [2440, 380]]; // aft_0 port (image bottom), aft_1 starboard
export const ART_SIDE_MOUNTS_X = [925, 1150, 1600, 1715];
export const ART_SIDE_MOUNT_Y = 140;
export const ART_SIDE_GANTRIES_X = [595, 1310, 1480, 1810]; // decorative clamps between the bays
export const ART_SIDE_GANTRY_Y = 190; // port; starboard mirrored
export const ART_STERN_TOWERS: Array<[number, number]> = [[470, 262], [470, 702]]; // bow towers (decorative): starboard, port

const Y_KEEL = -12; // visible draft below the waterline
const Y_HULL_TOP = 18; // main hull top (sponson bays sit here)
const Y_DECK = 23; // raised flight deck
const Y_GANTRY = Y_DECK + 3;
const Y_PAD = Y_DECK + 6; // bow parking pad
const Y_TOWER_PORT = Y_HULL_TOP + 9;
const Y_TOWER_STBD = Y_HULL_TOP + 13;

function prism(points: Array<{ x: number; z: number }>, y0: number, y1: number): THREE.BufferGeometry {
  // Shape lives in XY and extrudes along +Z; rotating -90° about X maps shape y -> world -z, so feed -z.
  const shape = new THREE.Shape(points.map((p) => new THREE.Vector2(p.x, -p.z)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false, curveSegments: 1 });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y0, 0);
  return geo;
}

function imgBox(ix0: number, iy0: number, ix1: number, iy1: number, y0: number, y1: number): THREE.BufferGeometry {
  const a = img(ix0, iy0);
  const b = img(ix1, iy1);
  const geo = new THREE.BoxGeometry(Math.abs(b.x - a.x), y1 - y0, Math.abs(b.z - a.z));
  geo.translate((a.x + b.x) / 2, (y0 + y1) / 2, (a.z + b.z) / 2);
  return geo;
}

function cylinder(ix: number, iy: number, rPx: number, y0: number, y1: number, segments = 10, rTopScale = 1): THREE.BufferGeometry {
  const p = img(ix, iy);
  const r = imgLen(rPx);
  const geo = new THREE.CylinderGeometry(r * rTopScale, r, y1 - y0, segments, 1);
  geo.translate(p.x, (y0 + y1) / 2, p.z);
  return geo;
}

function dome(ix: number, iy: number, rPx: number, yBase: number, segments = 8): THREE.BufferGeometry {
  const p = img(ix, iy);
  const geo = new THREE.SphereGeometry(imgLen(rPx), segments, 3, 0, Math.PI * 2, 0, Math.PI / 2);
  geo.translate(p.x, yBase, p.z);
  return geo;
}

export function buildBehemothGeometry(): THREE.BufferGeometry {
  const parts: Part[] = [];
  const add = (geo: THREE.BufferGeometry, color: string) => parts.push({ geo, color });

  // --- Hull ---------------------------------------------------------------
  const port = HULL_HALF_OUTLINE.map(([x, y]) => img(x, y));
  const starboard = HULL_HALF_OUTLINE.slice().reverse().map(([x, y]) => img(x, mirrorY(y)));
  const outline = [...port, ...starboard];
  add(prism(outline, Y_KEEL, 2), PALETTE.hullRedDark); // waterline band
  add(prism(outline, 2, Y_HULL_TOP), PALETTE.hullRed);

  // --- Raised central flight deck + edge walkways ---------------------------
  add(imgBox(500, 255, 1760, 710, Y_HULL_TOP, Y_DECK), PALETTE.deck);
  add(imgBox(620, 228, 1780, 255, Y_HULL_TOP, Y_DECK + 1.5), PALETTE.steel);
  add(imgBox(620, mirrorY(228), 1780, mirrorY(255), Y_HULL_TOP, Y_DECK + 1.5), PALETTE.steel);

  // --- Sponson bays (lower side decks) --------------------------------------
  for (const [x0, x1] of [[810, 1265], [1525, 1790]]) {
    add(imgBox(x0, 75, x1, 205, Y_HULL_TOP, Y_HULL_TOP + 0.8), PALETTE.deckBay);
    add(imgBox(x0, mirrorY(75), x1, mirrorY(205), Y_HULL_TOP, Y_HULL_TOP + 0.8), PALETTE.deckBay);
  }
  // Gantries (decorative clamps on the deck edge)
  for (const gx of ART_SIDE_GANTRIES_X) {
    add(imgBox(gx - 38, 130, gx + 38, 250, Y_HULL_TOP, Y_GANTRY), PALETTE.steel);
    add(imgBox(gx - 38, mirrorY(130), gx + 38, mirrorY(250), Y_HULL_TOP, Y_GANTRY), PALETTE.steel);
  }

  // --- Bow (pointed nose) -------------------------------------------------
  add(prism([img(170, 410), img(480, 320), img(480, mirrorY(320)), img(170, mirrorY(410))], Y_HULL_TOP, Y_HULL_TOP + 1.2), PALETTE.cream);
  add(imgBox(290, 440, 465, mirrorY(440), Y_HULL_TOP, Y_HULL_TOP + 4), PALETTE.steelDark); // hangar hatch
  add(imgBox(465, 455, 490, mirrorY(455), Y_HULL_TOP, Y_HULL_TOP + 4.5), PALETTE.blue);
  // bow towers: red/cream with radar dome (starboard), blue (port)
  const [tp, ts] = ART_STERN_TOWERS;
  add(cylinder(tp[0], tp[1], 70, Y_HULL_TOP, Y_HULL_TOP + 6, 10), PALETTE.hullRed);
  add(cylinder(tp[0], tp[1], 42, Y_HULL_TOP + 6, Y_TOWER_PORT, 10), PALETTE.cream);
  add(dome(tp[0], tp[1], 26, Y_TOWER_PORT), PALETTE.cream);
  add(cylinder(ts[0], ts[1], 72, Y_HULL_TOP, Y_HULL_TOP + 7, 10), PALETTE.blue);
  add(cylinder(ts[0], ts[1], 46, Y_HULL_TOP + 7, Y_TOWER_STBD, 10, 0.8), PALETTE.cream);
  for (const iy of [455, mirrorY(455)]) add(imgBox(35, iy - 8, 90, iy + 8, Y_HULL_TOP - 4, Y_HULL_TOP - 1), PALETTE.steel); // antenna prongs

  // --- Centre reactor dome ----------------------------------------------------
  add(cylinder(1215, 480, 60, Y_DECK, Y_DECK + 4, 8), PALETTE.steelDark);
  add(dome(1215, 480, 38, Y_DECK + 4, 8), PALETTE.cream);

  // --- Stern: unit parking pad, aft deck, bridge tower -------------------------
  add(imgBox(1760, 335, 2150, mirrorY(335), Y_HULL_TOP, Y_PAD - 1), PALETTE.hullRed);
  add(imgBox(1780, 352, 2135, mirrorY(352), Y_PAD - 1, Y_PAD), PALETTE.deck); // parking pad
  add(imgBox(2170, 400, 2330, mirrorY(400), Y_HULL_TOP, Y_DECK + 2), PALETTE.deck);
  add(imgBox(2330, 390, 2440, mirrorY(390), Y_HULL_TOP, Y_DECK + 1), PALETTE.cream);
  const t = img(2040, 245); // bridge tower, starboard side
  const tower: Array<[number, number, number, number, string]> = [
    [34, 22, Y_HULL_TOP, Y_DECK + 14, PALETTE.hullRed],
    [28, 18, Y_DECK + 14, Y_DECK + 22, PALETTE.cream],
    [24, 16, Y_DECK + 22, Y_DECK + 30, PALETTE.hullRed],
    [18, 12, Y_DECK + 30, Y_DECK + 34, PALETTE.steel],
  ];
  for (const [w, d, y0, y1, c] of tower) {
    const g = new THREE.BoxGeometry(w, y1 - y0, d);
    g.translate(t.x, (y0 + y1) / 2, t.z);
    add(g, c);
  }
  const mast = new THREE.BoxGeometry(1.5, 12, 1.5);
  mast.translate(t.x, Y_DECK + 40, t.z);
  add(mast, PALETTE.steelDark);
  add(cylinder(1890, 700, 32, Y_HULL_TOP, Y_HULL_TOP + 4, 8), PALETTE.hullRedDark); // intakes, port
  add(cylinder(1975, 700, 32, Y_HULL_TOP, Y_HULL_TOP + 4, 8), PALETTE.hullRedDark);

  // --- Yellow hazard accents on the flight deck corners ---------------------------
  for (const [ix, iy] of [[640, 280], [1730, 280], [640, mirrorY(280)], [1730, mirrorY(280)]]) {
    add(imgBox(ix - 15, iy - 6, ix + 15, iy + 6, Y_DECK, Y_DECK + 0.3), PALETTE.yellow);
  }

  const merged = mergeParts(parts);
  parts.forEach((p) => p.geo.dispose());
  return merged;
}

const span = (a: number, b: number) => { const x0 = img(a, 0).x, x1 = img(b, 0).x; return [Math.min(x0, x1), Math.max(x0, x1)]; };
const PAD = span(1760, 2150);
const DECK = span(500, 1760);

/** Top surface height (m) at a deck-local x along the centreline, for placing buildings. */
export function deckTopAt(xLocal: number): number {
  if (xLocal >= PAD[0] && xLocal <= PAD[1]) return Y_PAD;
  if (xLocal >= DECK[0] && xLocal <= DECK[1]) return Y_DECK;
  return Y_HULL_TOP + 1.2;
}

/** Height (m) of a weapon mount's base: gantry tops on the sides, tower tops astern. */
export function mountBaseY(row: 'port' | 'starboard' | 'aft', slotIndex: number): number {
  if (row !== 'aft') return Y_HULL_TOP + 0.8; // on the sponson bay floor
  void slotIndex;
  return Y_HULL_TOP; // stern tip guns
}

/** Hull outline at the waterline (local metres), for the water shadow. */
export function hullOutline(): Array<{ x: number; z: number }> {
  const port = HULL_HALF_OUTLINE.map(([x, y]) => img(x, y));
  const starboard = HULL_HALF_OUTLINE.slice().reverse().map(([x, y]) => img(x, mirrorY(y)));
  return [...port, ...starboard];
}

export const BEHEMOTH_HULL_TOP_Y = Y_HULL_TOP;
