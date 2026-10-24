import { distance, angleBetween } from './math';
import { CANVAS_PX_PER_KNOT_SPEED } from './measurements';

export interface Point2D {
  x: number;
  y: number;
}

/**
 * Generates a smooth navigation path connecting waypoints with rounded fillet curves.
 * Guarantees no sharp corners even with acute angles or close waypoints.
 */
export function generateSmoothPath(
  start: Point2D,
  rawWaypoints: Point2D[],
  filletRadius: number = 45
): Point2D[] {
  if (!rawWaypoints || rawWaypoints.length === 0) return [];

  // 1. Filter out waypoints placed extremely close together (< 15 px)
  const cleaned: Point2D[] = [];
  let prev = start;
  for (const wp of rawWaypoints) {
    if (distance(prev.x, prev.y, wp.x, wp.y) >= 15) {
      cleaned.push(wp);
      prev = wp;
    }
  }

  if (cleaned.length === 0) {
    // If all were too close to start, at least keep the last clicked point
    cleaned.push(rawWaypoints[rawWaypoints.length - 1]);
  }

  // Points list starting from current vessel position
  const pts: Point2D[] = [start, ...cleaned];

  // If only 1 waypoint, straight line with dense interpolation
  if (pts.length === 2) {
    const p0 = pts[0];
    const p1 = pts[1];
    const d = distance(p0.x, p0.y, p1.x, p1.y);
    const steps = Math.max(4, Math.floor(d / 6));
    const result: Point2D[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      result.push({
        x: p0.x + (p1.x - p0.x) * t,
        y: p0.y + (p1.y - p0.y) * t,
      });
    }
    return result;
  }

  // Multi-point path with rounded corners (fillet curves)
  const path: Point2D[] = [];
  let currentPos = pts[0];
  path.push({ ...currentPos });

  for (let i = 1; i < pts.length - 1; i++) {
    const pPrev = pts[i - 1];
    const pCurr = pts[i];
    const pNext = pts[i + 1];

    const dIn = distance(pPrev.x, pPrev.y, pCurr.x, pCurr.y);
    const dOut = distance(pCurr.x, pCurr.y, pNext.x, pNext.y);

    if (dIn < 1 || dOut < 1) continue;

    // Corner fillet radius clamped to at most 45% of incoming and outgoing segment length
    const fRadius = Math.min(filletRadius, dIn * 0.45, dOut * 0.45);

    // Tangent start point on incoming segment
    const tIn: Point2D = {
      x: pCurr.x + ((pPrev.x - pCurr.x) / dIn) * fRadius,
      y: pCurr.y + ((pPrev.y - pCurr.y) / dIn) * fRadius,
    };

    // Tangent end point on outgoing segment
    const tOut: Point2D = {
      x: pCurr.x + ((pNext.x - pCurr.x) / dOut) * fRadius,
      y: pCurr.y + ((pNext.y - pCurr.y) / dOut) * fRadius,
    };

    // Interpolate straight line from currentPos to tIn
    const straightDist = distance(currentPos.x, currentPos.y, tIn.x, tIn.y);
    const straightSteps = Math.max(2, Math.floor(straightDist / 8));
    for (let s = 1; s <= straightSteps; s++) {
      const t = s / straightSteps;
      path.push({
        x: currentPos.x + (tIn.x - currentPos.x) * t,
        y: currentPos.y + (tIn.y - currentPos.y) * t,
      });
    }

    // Sample quadratic Bezier curve around the corner
    const curveSteps = Math.max(5, Math.floor((fRadius * 2) / 6));
    for (let c = 1; c <= curveSteps; c++) {
      const t = c / curveSteps;
      const oneMinusT = 1 - t;
      const bx = oneMinusT * oneMinusT * tIn.x + 2 * oneMinusT * t * pCurr.x + t * t * tOut.x;
      const by = oneMinusT * oneMinusT * tIn.y + 2 * oneMinusT * t * pCurr.y + t * t * tOut.y;
      path.push({ x: bx, y: by });
    }

    currentPos = tOut;
  }

  // Final segment to last point
  const lastPoint = pts[pts.length - 1];
  const finalDist = distance(currentPos.x, currentPos.y, lastPoint.x, lastPoint.y);
  const finalSteps = Math.max(2, Math.floor(finalDist / 8));
  for (let s = 1; s <= finalSteps; s++) {
    const t = s / finalSteps;
    path.push({
      x: currentPos.x + (lastPoint.x - currentPos.x) * t,
      y: currentPos.y + (lastPoint.y - currentPos.y) * t,
    });
  }

  return path;
}

/**
 * Transforms local vessel coordinate (relative to vessel center, 0° = bow facing East)
 * to 2D world space rotated by vessel heading.
 */
export function deckLocalToWorld(
  localX: number,
  localY: number,
  vesselCenter: Point2D,
  headingDegrees: number = 0
): Point2D {
  const rad = (headingDegrees * Math.PI) / 180;
  return {
    x: vesselCenter.x + localX * Math.cos(rad) - localY * Math.sin(rad),
    y: vesselCenter.y + localX * Math.sin(rad) + localY * Math.cos(rad),
  };
}

/**
 * Transforms world coordinates to local deck coordinates relative to vessel center.
 */
export function worldToDeckLocal(
  worldX: number,
  worldY: number,
  vesselCenter: Point2D,
  headingDegrees: number = 0
): Point2D {
  const dx = worldX - vesselCenter.x;
  const dy = worldY - vesselCenter.y;
  const rad = -(headingDegrees * Math.PI) / 180;
  return {
    x: dx * Math.cos(rad) - dy * Math.sin(rad),
    y: dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}

/**
 * Checks whether a 2D world point lies on top of Behemoth's deck bounds.
 */
export function isPointOverDeck(
  worldX: number,
  worldY: number,
  vesselCenter: { x: number; y: number; width: number; height: number },
  headingDegrees: number = 0,
  margin: number = 15
): boolean {
  const local = worldToDeckLocal(worldX, worldY, vesselCenter, headingDegrees);
  return (
    Math.abs(local.x) <= vesselCenter.width / 2 + margin &&
    Math.abs(local.y) <= vesselCenter.height / 2 + margin
  );
}

/**
 * Calculates world position and aim center for a weapon slot, taking vessel heading into account.
 */
export function getWeaponSlotWorldPosition(
  slot: { positionX: number; row: 'port' | 'starboard' },
  vesselCenter: { x: number; y: number; width: number; height: number },
  headingDegrees: number = 0
): { x: number; y: number; defaultFacing: number } {
  const localX = -vesselCenter.width / 2 + slot.positionX * vesselCenter.width;
  const localY = slot.row === 'port' ? -27 : 27;
  const worldPos = deckLocalToWorld(localX, localY, vesselCenter, headingDegrees);
  const defaultFacing = slot.row === 'port' ? (headingDegrees - 90 + 360) % 360 : (headingDegrees + 90) % 360;
  return {
    x: worldPos.x,
    y: worldPos.y,
    defaultFacing,
  };
}

/**
 * Calculates world position for a building slot, taking vessel heading into account.
 */
export function getBuildingSlotWorldPosition(
  slot: { slotIndex: number; row: 'misc_a' | 'misc_b' },
  vesselCenter: { x: number; y: number; width: number; height: number },
  headingDegrees: number = 0
): Point2D {
  const localX = -vesselCenter.width / 2 + 46 + slot.slotIndex * 52;
  const localY = slot.row === 'misc_a' ? -12 : 12;
  return deckLocalToWorld(localX, localY, vesselCenter, headingDegrees);
}
