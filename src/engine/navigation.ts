import { distance, angleBetween } from './math';
import { CANVAS_PX_PER_KNOT_SPEED, CANVAS_BEHEMOTH_HEIGHT_PX } from './measurements';

export interface Point2D {
  x: number;
  y: number;
}

/**
 * Arrival threshold radius around waypoints (in canvas pixels).
 * Corresponds to 5-10 units in game scale (approx 35 px).
 * When within this radius, the vessel snaps early to the next waypoint.
 */
export const ARRIVAL_THRESHOLD_RADIUS = 35;

/** Final arrival radius for vessel stopping at destination (approx 16 px) */
export const FINAL_ARRIVAL_RADIUS = 16;

/**
 * Calculates world position of the vessel's bow (front).
 */
export function getVesselBowPosition(
  vesselCenter: { x: number; y: number; width: number; height: number },
  headingDegrees: number = 0
): Point2D {
  const rad = (headingDegrees * Math.PI) / 180;
  // Nose tip of Behemoth (deck length / 2 + 15px bow arrow peak)
  const halfL = vesselCenter.width / 2 + 15;
  return {
    x: vesselCenter.x + halfL * Math.cos(rad),
    y: vesselCenter.y + halfL * Math.sin(rad),
  };
}

/**
 * Calculates world position of the vessel's stern (rear).
 */
export function getVesselSternPosition(
  vesselCenter: { x: number; y: number; width: number; height: number },
  headingDegrees: number = 0
): Point2D {
  const rad = (headingDegrees * Math.PI) / 180;
  const halfL = vesselCenter.width / 2;
  return {
    x: vesselCenter.x - halfL * Math.cos(rad),
    y: vesselCenter.y - halfL * Math.sin(rad),
  };
}

/**
 * Generates a smooth navigation path connecting waypoints with rounded fillet curves.
 * Guarantees no sharp corners even with acute angles or close waypoints.
 * If allowNoseAngle is true (default), departs from the vessel nose directly toward the first waypoint at a crisp angle,
 * avoiding the artificial forward "hook" when making sideways waypoints.
 * If allowNoseAngle is false and leadHeading is provided, guides the initial path tangent along the vessel's facing direction.
 */
export function generateSmoothPath(
  start: Point2D,
  rawWaypoints: Point2D[],
  filletRadius: number = 45,
  leadHeading?: number,
  allowNoseAngle: boolean = true
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
  const pts: Point2D[] = [start];

  // If allowNoseAngle is false and initial heading is provided, add an orientation lead point so the path curves out along heading
  if (!allowNoseAngle && leadHeading !== undefined && cleaned.length > 0) {
    const rad = (leadHeading * Math.PI) / 180;
    const d0 = distance(start.x, start.y, cleaned[0].x, cleaned[0].y);
    const angleToTarget = angleBetween(start.x, start.y, cleaned[0].x, cleaned[0].y);
    const angleDiff = Math.abs(((angleToTarget - leadHeading + 540) % 360) - 180);

    // If turn is noticeable, add a lead tangent anchor ahead of start
    if (angleDiff > 15 && d0 > 30) {
      const leadDist = Math.min(40, d0 * 0.35);
      pts.push({
        x: start.x + Math.cos(rad) * leadDist,
        y: start.y + Math.sin(rad) * leadDist,
      });
    }
  }

  pts.push(...cleaned);

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
 * Mount layout from the Behemoth concept (BHEV-07M top view; bow = pointed nose, stern = parking pad end):
 * side mounts sit on the grey sponson bays ("wings", 2 per bay), aft mounts on the stern tip.
 * Lateral offsets are fractions of the half-beam, so they follow BEHEMOTH_BEAM_METERS.
 * Keep in sync with ART_* in components/three/behemothModel.ts.
 */
export const SIDE_MOUNT_POSITIONS_X = [0.3246, 0.3707, 0.5511, 0.6413]; // normalised along the hull, 0 = stern
export const AFT_MOUNT_POSITION_X = 0.034;
export const SIDE_MOUNT_LATERAL_FRAC = 0.752;
export const AFT_MOUNT_LATERAL_FRAC = 0.224;
/** Side mounts: lateral offset from the centreline in deck px. */
export const SIDE_MOUNT_LATERAL_PX = (SIDE_MOUNT_LATERAL_FRAC * CANVAS_BEHEMOTH_HEIGHT_PX) / 2;
/** Aft (stern) mounts: lateral offset from the centreline in deck px (slot 0 port side, slot 1 starboard side). */
export const AFT_MOUNT_LATERAL_PX = (AFT_MOUNT_LATERAL_FRAC * CANVAS_BEHEMOTH_HEIGHT_PX) / 2;

/**
 * Weapon mount pose in deck-local px (origin = vessel centre, +x = bow) and its default facing in the
 * unrotated deck frame (port 270°, starboard 90°, aft 180°).
 */
export function weaponSlotLocalPose(
  slot: { positionX: number; row: 'port' | 'starboard' | 'aft'; slotIndex?: number },
  vesselWidth: number
): { x: number; y: number; facing: number } {
  const x = -vesselWidth / 2 + slot.positionX * vesselWidth;
  if (slot.row === 'aft') return { x, y: (slot.slotIndex ?? 0) === 0 ? -AFT_MOUNT_LATERAL_PX : AFT_MOUNT_LATERAL_PX, facing: 180 };
  if (slot.row === 'port') return { x, y: -SIDE_MOUNT_LATERAL_PX, facing: 270 };
  return { x, y: SIDE_MOUNT_LATERAL_PX, facing: 90 };
}

/**
 * Calculates world position and aim center for a weapon slot, taking vessel heading into account.
 */
export function getWeaponSlotWorldPosition(
  slot: { positionX: number; row: 'port' | 'starboard' | 'aft'; slotIndex?: number },
  vesselCenter: { x: number; y: number; width: number; height: number },
  headingDegrees: number = 0
): { x: number; y: number; defaultFacing: number } {
  const pose = weaponSlotLocalPose(slot, vesselCenter.width);
  const worldPos = deckLocalToWorld(pose.x, pose.y, vesselCenter, headingDegrees);
  const defaultFacing = (headingDegrees + pose.facing + 360) % 360;
  return {
    x: worldPos.x,
    y: worldPos.y,
    defaultFacing,
  };
}

/**
 * Building slots: all on the flight deck (every building takes crew). 4 columns spread evenly along the deck,
 * misc_a on the port half, misc_b on the starboard half. Deck span from the concept (fractions of hull length
 * from the stern / of the half-beam).
 */
export const FLIGHT_DECK_X0_FRAC = 0.307;
export const FLIGHT_DECK_X1_FRAC = 0.812;
export const BUILDING_ROW_LATERAL_FRAC = 0.3;
export const BUILDING_COLUMNS = 4;
/** Flight deck half-width as a fraction of the half-beam (concept deck incl. edge walkways). */
export const FLIGHT_DECK_LATERAL_FRAC = 0.55;

/** Flight deck rectangle in deck-local px: crew walk only inside it. */
export function flightDeckBoundsLocal(vesselWidth: number, vesselHeight: number, margin = 2) {
  const halfW = FLIGHT_DECK_LATERAL_FRAC * (vesselHeight / 2);
  return {
    minX: -vesselWidth / 2 + FLIGHT_DECK_X0_FRAC * vesselWidth + margin,
    maxX: -vesselWidth / 2 + FLIGHT_DECK_X1_FRAC * vesselWidth - margin,
    minY: -halfW + margin,
    maxY: halfW - margin,
  };
}

/** Building slot centre in deck-local px (origin = vessel centre, +x = bow, +y = starboard). */
export function buildingSlotLocalPose(
  slot: { slotIndex: number; row: 'misc_a' | 'misc_b' },
  vesselWidth: number,
  vesselHeight: number
): Point2D {
  const span = (FLIGHT_DECK_X1_FRAC - FLIGHT_DECK_X0_FRAC) * vesselWidth;
  const x = -vesselWidth / 2 + FLIGHT_DECK_X0_FRAC * vesselWidth + ((slot.slotIndex + 0.5) * span) / BUILDING_COLUMNS;
  const y = (slot.row === 'misc_a' ? -1 : 1) * BUILDING_ROW_LATERAL_FRAC * (vesselHeight / 2);
  return { x, y };
}

/**
 * Calculates world position for a building slot, taking vessel heading into account.
 */
export function getBuildingSlotWorldPosition(
  slot: { slotIndex: number; row: 'misc_a' | 'misc_b' },
  vesselCenter: { x: number; y: number; width: number; height: number },
  headingDegrees: number = 0
): Point2D {
  const local = buildingSlotLocalPose(slot, vesselCenter.width, vesselCenter.height);
  return deckLocalToWorld(local.x, local.y, vesselCenter, headingDegrees);
}
