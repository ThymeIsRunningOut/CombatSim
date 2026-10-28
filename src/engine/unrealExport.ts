import { WeaponDef, CreatureDef, BuildingDef, BehemothState, CrewSimulationConfig } from '../types/combat';
import {
  METERS_PER_TILE,
  METERS_PER_KNOT,
  BEHEMOTH_LENGTH_METERS,
  BEHEMOTH_BEAM_METERS,
  UNREAL_UNITS_PER_METER,
  UNREAL_UNITS_PER_TILE,
  BEHEMOTH_LENGTH_UNREAL,
  BEHEMOTH_BEAM_UNREAL,
  BASE_NAUTICAL_SPEED_MPS,
  BASE_NAUTICAL_SPEED_UUPS,
  BASE_NAUTICAL_SPEED_KMH,
  normalizeSpeedToKnots,
  knotsSpeedToMps,
  knotsSpeedToKmh,
  knotsSpeedToUnrealUnitsPerSec,
  pxToMeters,
  pxToUnrealUnits,
  CANVAS_BEHEMOTH_WIDTH_PX,
  CANVAS_BEHEMOTH_HEIGHT_PX,
} from './measurements';

export interface UnrealEngineExportPackage {
  meta: {
    format: string;
    version: string;
    targetEngine: string;
    exportedAt: string;
    coordinateSystem: string; // e.g. "Unreal Engine Left-Handed Z-Up: 1 unit = 1 cm"
  };
  worldStandards: {
    tileLengthMeters: number; // 2,700m
    tileLengthKnots: number;  // 1 Knot (base distance unit)
    tileLengthUnrealUnits: number; // 270,000 UU (Game Units)
    tileAreaKm2: number; // 7.29 km²
    baseNauticalSpeedKnotsPerMin: number; // 1.0 Knot/min
    baseNauticalSpeedMps: number; // 33.3333 m/s
    baseNauticalSpeedKmh: number; // 120 km/h
    baseNauticalSpeedUUps: number; // 3,333.33 UU/s
  };
  vessel: {
    name: string;
    lengthMeters: number; // 500m
    beamMeters: number;   // 173m
    lengthKnots: number;  // 0.185 Knots
    beamKnots: number;    // 0.064 Knots
    lengthUnrealUnits: number; // 50,000 UU
    beamUnrealUnits: number;   // 17,333 UU
    maxHullHp: number;
    hullArmor: number;
    totalPowerCapacityKW: number;
    maxTiltSafeDegrees: number;
    turretMountSockets: Array<{
      id: string;
      row: 'port' | 'starboard';
      slotIndex: number;
      defaultFacingYaw: number; // 270 (port) or 90 (starboard)
      rotationCapDegrees: number;
      relativeLocationUU: { x: number; y: number; z: number };
      equippedWeaponId: string | null;
    }>;
    buildingPadSockets: Array<{
      id: string;
      row: 'misc_a' | 'misc_b';
      slotIndex: number;
      relativeLocationUU: { x: number; y: number; z: number };
      equippedBuildingId: string | null;
    }>;
  };
  creatures: Array<{
    id: string;
    name: string;
    description: string;
    stats: {
      hp: number;
      physicalArmor: number;
      armorClass: number;
      energyResistance: number;
      quantity: number;
      attackTarget: string;
    };
    kinematics: {
      movementSpeedKnots: number;
      movementSpeedMps: number;
      movementSpeedKmh: number;
      movementSpeedUUps: number;
      collisionRadiusMeters: number;
      collisionRadiusUU: number;
      aggroRadiusMeters: number;
      aggroRadiusKnots: number;
      aggroRadiusUU: number;
      turningRateDegPerSec: number;
      accelerationUUps2: number;
      decelerationUUps2: number;
    };
    timingsAndCombat: {
      underwaterIntervalSec: number;
      surfaceIntervalSec: number;
      chargeWindupSec: number;
      strikeDurationSec: number;
      strikeCooldownSec: number;
      strikeDamageRate: number;
      strikeStunChance: number;
      strikeStunDurationSec: number;
      strikeRamMassImpulse: number;
      isFlying: boolean;
      locomotionType: string;
    };
  }>;
  weapons: Array<{
    id: string;
    name: string;
    damageType: string;
    ballistics: {
      dpp: number;
      dps: number;
      fireRate: number;
      rangeMeters: number;
      rangeKnots: number;
      rangeUU: number;
      projectileSpeedMps: number;
      projectileSpeedUUps: number;
      aoeRadiusMeters: number;
      aoeRadiusUU: number;
      shootingArcDegrees: number;
      rotationCapDegrees: number;
      turnSpeedDegPerSec: number;
      trajectory: string;
    };
    operational: {
      fireDurationSec: number;
      cooldownDurationSec: number;
      reloadTimeSec: number;
      powerDrawKW: number;
      ammoType: string;
      ammoCapacity: number;
      ammoPerShot: number;
      chargesPerPack?: number;
    };
  }>;
  buildings: Array<{
    id: string;
    name: string;
    category: string;
    maxHealth: number;
    powerBonusKW: number;
    powerDrawKW: number;
    requiredCrew: number;
    maxCrew: number;
  }>;
  behaviorTrees?: Record<string, any>;
}

/**
 * Builds a complete, standardized Unreal Engine export package matching the in-game measurement specifications.
 */
export function generateUnrealEnginePackage(
  weapons: WeaponDef[],
  creatures: CreatureDef[],
  buildings: BuildingDef[],
  behemoth?: BehemothState,
  behaviorTrees?: Record<string, any>
): UnrealEngineExportPackage {
  // Convert turret sockets to Unreal Units
  const turretSockets = (behemoth?.slots || []).map((slot) => {
    // Relative to vessel center in cm:
    // X axis: length (-25,000 cm to +25,000 cm)
    // Y axis: beam (-8,667 cm port to +8,667 cm starboard)
    const relXUU = (slot.positionX - 0.5) * BEHEMOTH_LENGTH_UNREAL;
    const relYUU = slot.row === 'port' ? -BEHEMOTH_BEAM_UNREAL / 2 : BEHEMOTH_BEAM_UNREAL / 2;
    return {
      id: slot.id,
      row: slot.row,
      slotIndex: slot.slotIndex,
      defaultFacingYaw: slot.row === 'port' ? 270 : 90,
      rotationCapDegrees: slot.rotationCap ?? 225,
      relativeLocationUU: { x: Math.round(relXUU), y: Math.round(relYUU), z: 350 }, // deck height
      equippedWeaponId: slot.weapon ? slot.weapon.id : null,
    };
  });

  // Convert building sockets to Unreal Units
  const buildingSockets = (behemoth?.buildingSlots || []).map((slot) => {
    // 4 slots per row, normalized along deck length
    const normX = (slot.slotIndex + 0.5) / 4.0;
    const relXUU = (normX - 0.5) * (BEHEMOTH_LENGTH_UNREAL * 0.75);
    const relYUU = slot.row === 'misc_a' ? -BEHEMOTH_BEAM_UNREAL * 0.22 : BEHEMOTH_BEAM_UNREAL * 0.22;
    return {
      id: slot.id,
      row: slot.row,
      slotIndex: slot.slotIndex,
      relativeLocationUU: { x: Math.round(relXUU), y: Math.round(relYUU), z: 200 },
      equippedBuildingId: slot.building ? slot.building.id : null,
    };
  });

  return {
    meta: {
      format: 'UnrealEngine-CombatSim-Bridge',
      version: '2.0',
      targetEngine: 'Unreal Engine 5 (UE5.4+)',
      exportedAt: new Date().toISOString(),
      coordinateSystem: 'Unreal Engine Standard: 1 unit = 1 cm (Left-Handed Z-Up)',
    },
    worldStandards: {
      tileLengthMeters: METERS_PER_TILE,
      tileLengthKnots: 1.0,
      tileLengthUnrealUnits: UNREAL_UNITS_PER_TILE,
      tileAreaKm2: (METERS_PER_TILE * METERS_PER_TILE) / 1000000,
      baseNauticalSpeedKnotsPerMin: 1.0,
      baseNauticalSpeedMps: BASE_NAUTICAL_SPEED_MPS,
      baseNauticalSpeedKmh: BASE_NAUTICAL_SPEED_KMH,
      baseNauticalSpeedUUps: BASE_NAUTICAL_SPEED_UUPS,
    },
    vessel: {
      name: 'Behemoth Class Mobile Fortress',
      lengthMeters: BEHEMOTH_LENGTH_METERS,
      beamMeters: BEHEMOTH_BEAM_METERS,
      lengthKnots: BEHEMOTH_LENGTH_METERS / METERS_PER_KNOT,
      beamKnots: BEHEMOTH_BEAM_METERS / METERS_PER_KNOT,
      lengthUnrealUnits: BEHEMOTH_LENGTH_UNREAL,
      beamUnrealUnits: BEHEMOTH_BEAM_UNREAL,
      maxHullHp: behemoth?.maxHullHp || 8000,
      hullArmor: behemoth?.hullArmor || 2500,
      totalPowerCapacityKW: behemoth?.totalPowerCapacity || 1200,
      maxTiltSafeDegrees: behemoth?.maxTiltSafe || 35.0,
      turretMountSockets: turretSockets,
      buildingPadSockets: buildingSockets,
    },
    creatures: creatures.map((c) => {
      const knots = normalizeSpeedToKnots(c.movementSpeed);
      const mps = knotsSpeedToMps(knots);
      const kmh = knotsSpeedToKmh(knots);
      const uups = knotsSpeedToUnrealUnitsPerSec(knots);
      const radiusMeters = pxToMeters(c.radius);
      const radiusUU = radiusMeters * UNREAL_UNITS_PER_METER;
      const aggroMeters = pxToMeters(c.aggroRadius);
      const aggroKnots = aggroMeters / METERS_PER_KNOT;
      const aggroUU = aggroMeters * UNREAL_UNITS_PER_METER;

      return {
        id: c.id,
        name: c.name,
        description: c.description,
        stats: {
          hp: c.hp,
          physicalArmor: c.physicalArmor,
          armorClass: c.armorClass,
          energyResistance: c.energyResistance,
          quantity: c.quantity,
          attackTarget: c.attackTarget || 'hull',
        },
        kinematics: {
          movementSpeedKnots: knots,
          movementSpeedMps: Math.round(mps),
          movementSpeedKmh: Math.round(kmh),
          movementSpeedUUps: Math.round(uups),
          collisionRadiusMeters: Math.round(radiusMeters),
          collisionRadiusUU: Math.round(radiusUU),
          aggroRadiusMeters: Math.round(aggroMeters),
          aggroRadiusKnots: Number(aggroKnots.toFixed(2)),
          aggroRadiusUU: Math.round(aggroUU),
          turningRateDegPerSec: c.turningRate || 64,
          accelerationUUps2: Math.round((c.acceleration || 50) * (BASE_NAUTICAL_SPEED_UUPS / 10)),
          decelerationUUps2: Math.round((c.deceleration || 40) * (BASE_NAUTICAL_SPEED_UUPS / 10)),
        },
        timingsAndCombat: {
          underwaterIntervalSec: c.underwaterInterval,
          surfaceIntervalSec: c.surfaceInterval,
          chargeWindupSec: c.chargeWindup,
          strikeDurationSec: c.strikeDuration,
          strikeCooldownSec: c.strikeCooldown,
          strikeDamageRate: c.strikeDamageRate,
          strikeStunChance: c.strikeStunChance,
          strikeStunDurationSec: c.strikeStunDuration,
          strikeRamMassImpulse: c.strikeRamMass,
          isFlying: !!c.isFlying,
          locomotionType: c.locomotionType || (c.isFlying ? 'flying' : 'non-flying'),
        },
      };
    }),
    weapons: weapons.map((w) => {
      const rangeMeters = pxToMeters(w.range);
      const rangeKnots = rangeMeters / METERS_PER_KNOT;
      const rangeUU = rangeMeters * UNREAL_UNITS_PER_METER;
      const aoeMeters = pxToMeters(w.aoe);
      const aoeUU = aoeMeters * UNREAL_UNITS_PER_METER;
      const projSpeedMps = pxToMeters(w.projectileSpeed);
      const projSpeedUUps = projSpeedMps * UNREAL_UNITS_PER_METER;

      return {
        id: w.id,
        name: w.name,
        damageType: w.damageType,
        ballistics: {
          dpp: w.dpp,
          dps: w.dps,
          fireRate: w.fireRate,
          rangeMeters: Math.round(rangeMeters),
          rangeKnots: Number(rangeKnots.toFixed(2)),
          rangeUU: Math.round(rangeUU),
          projectileSpeedMps: Math.round(projSpeedMps),
          projectileSpeedUUps: Math.round(projSpeedUUps),
          aoeRadiusMeters: Math.round(aoeMeters),
          aoeRadiusUU: Math.round(aoeUU),
          shootingArcDegrees: w.shootingArc,
          rotationCapDegrees: w.rotationCap ?? 225,
          turnSpeedDegPerSec: w.turnSpeed || 120,
          trajectory: w.trajectory,
        },
        operational: {
          fireDurationSec: w.fireDuration,
          cooldownDurationSec: w.cooldownDuration,
          reloadTimeSec: w.reloadTime,
          powerDrawKW: w.powerDraw,
          ammoType: w.ammoType,
          ammoCapacity: w.ammoCapacity,
          ammoPerShot: w.ammoPerShot,
          chargesPerPack: w.chargesPerPack,
        },
      };
    }),
    buildings: buildings.map((b) => ({
      id: b.id,
      name: b.name,
      category: b.category || 'production',
      maxHealth: b.maxHealth,
      powerBonusKW: b.powerBonus,
      powerDrawKW: b.powerDraw,
      requiredCrew: b.requiredCrew || 1,
      maxCrew: b.maxCrew || 4,
    })),
    behaviorTrees,
  };
}
