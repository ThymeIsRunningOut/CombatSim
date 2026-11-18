/**
 * Fleets (Phase 4): groups of ships built from a Species (form, behavior, ship types) and a Faction
 * (numbers per ship type). Ships, boarder boats and fireship craft live in `engine.creatures` with
 * `fleetId` set, so turrets, projectiles, damage rules, underwater reduction and crew PDWs work on them
 * unchanged. This module owns their movement, aggression, targeting and weapons.
 */
import type { SimulationEngine } from './simulation';
import {
  CreatureDef, CreatureRuntimeInstance, DeckEvent, FleetFactionDef, FleetRuntime, FleetShipTypeDef, FleetShot,
  FleetSpeciesDef, FleetWeaponDef, FleetWeaponState, BuildingSlot, WeaponSlot,
} from '../types/combat';
import { distance, angleBetween } from './math';
import { random } from './rng';
import { knotsSpeedToPxPerSec, metersToPx } from './measurements';
import { isPointOverDeck, worldToDeckLocal, deckLocalToWorld, getBuildingSlotWorldPosition } from './navigation';
import {
  BEHEMOTH_ID, hates, hatesIds, aggressionStateFor, AGGRESSION_DEFAULTS, AGGRESSION_PER_DAMAGE_PCT,
  HP_LOSS_AGGRESSION_MUL, OUT_OF_RADIUS_SECONDS, OUT_OF_RADIUS_AGGRESSION_MUL, RETALIATE_SECONDS, RETREAT_HOLD_FRACTION,
} from './relations';

export const DEFAULT_ENGINE_HP = 1500;
/** Speed cap with a destroyed engine (share of normal). Scales linearly with engine HP above that. */
export const ENGINE_MIN_SPEED_FACTOR = 0.35;
const ESCAPE_RADIUS_MULTIPLIER = 2;
const RAM_CHARGE_TIMEOUT = 6;
/** 'random' hit location weights (rest = engine). */
export const RANDOM_HIT_HULL = 0.5;
export const RANDOM_HIT_BUILDING = 0.35;

type Target = { kind: 'behemoth' } | { kind: 'creature'; creature: CreatureRuntimeInstance };

interface BehemothDot { dps: number; timeLeft: number; target: FleetWeaponDef['target']; source: string; }
interface CreatureDot { creatureId: string; dps: number; timeLeft: number; damageType: FleetWeaponDef['damageType']; sourceId: string; }
interface CrewEffect { dps: number; timeLeft: number; sourceId?: string; radiusPx?: number; }
export interface FleetBeamVisual { x1: number; y1: number; x2: number; y2: number; color: string; width: number; }
export interface FleetPulseVisual { x: number; y: number; radius: number; age: number; maxAge: number; color: string; }

/** Species ship type with the faction's numbers applied (weapons merged by id). */
export function resolveShipType(species: FleetSpeciesDef, faction: FleetFactionDef | undefined, shipTypeId: string): FleetShipTypeDef | undefined {
  const base = species.shipTypes.find((s) => s.id === shipTypeId);
  if (!base) return undefined;
  const ov = faction?.overrides?.[shipTypeId];
  if (!ov) return base;
  const { weapons: wOv, ...rest } = ov;
  return {
    ...base,
    ...rest,
    weapons: base.weapons.map((w) => (wOv && wOv[w.id] ? { ...w, ...wOv[w.id] } : w)),
  };
}

/** Distance from the Behemoth centre to its hull rectangle along a world bearing. */
function hullExtentPx(vessel: { width: number; height: number }, headingDeg: number, bearingDeg: number): number {
  const a = vessel.width / 2, b = vessel.height / 2;
  const t = ((bearingDeg - headingDeg) * Math.PI) / 180;
  const c = Math.abs(Math.cos(t)), s = Math.abs(Math.sin(t));
  return Math.min(c > 1e-6 ? a / c : Infinity, s > 1e-6 ? b / s : Infinity);
}

export class FleetSystem {
  engine: SimulationEngine;
  species: Map<string, FleetSpeciesDef> = new Map();
  factions: Map<string, FleetFactionDef> = new Map();
  fleets: FleetRuntime[] = [];
  shots: FleetShot[] = [];
  beams: FleetBeamVisual[] = [];
  pulses: FleetPulseVisual[] = [];
  deckEvents: DeckEvent[] = [];
  behemothDots: BehemothDot[] = [];
  creatureDots: CreatureDot[] = [];
  crewEffects: CrewEffect[] = [];
  /** Resolved ship type per synthesized creature def id. */
  private shipTypeByDef: Map<string, FleetShipTypeDef> = new Map();
  private weaponByDef: Map<string, FleetWeaponDef> = new Map();
  private scatterOffsets: Map<string, { x: number; y: number }> = new Map();

  constructor(engine: SimulationEngine) {
    this.engine = engine;
  }

  setDefinitions(species: FleetSpeciesDef[], factions: FleetFactionDef[]) {
    this.species = new Map((species || []).map((s) => [s.id, s]));
    this.factions = new Map((factions || []).map((f) => [f.id, f]));
    // Refresh live ships' resolved stats (balancing edits apply to running fleets)
    for (const fleet of this.fleets) this.registerDefs(fleet.speciesId, fleet.factionId);
  }

  reset() {
    this.fleets = [];
    this.shots = [];
    this.beams = [];
    this.pulses = [];
    this.deckEvents = [];
    this.behemothDots = [];
    this.creatureDots = [];
    this.crewEffects = [];
    this.scatterOffsets.clear();
  }

  defaultFactionFor(speciesId: string): FleetFactionDef | undefined {
    for (const f of this.factions.values()) if (f.speciesId === speciesId) return f;
    return undefined;
  }

  pushDeckEvent(text: string, kind: DeckEvent['kind']) {
    this.deckEvents.unshift({ id: `de_${this.engine.timeElapsed.toFixed(2)}_${random().toString(36).slice(2, 6)}`, time: this.engine.timeElapsed, text, kind });
    if (this.deckEvents.length > 12) this.deckEvents.length = 12;
    this.engine.addLog(`[DECK] ${text}`, 'danger');
  }

  // --------------------------------------------------------------------------
  // Definitions → synthesized creature defs (shared combat pipeline)
  // --------------------------------------------------------------------------

  private shipDefId(factionId: string, shipTypeId: string) { return `fleet:${factionId}:${shipTypeId}`; }

  private registerDefs(speciesId: string, factionId: string) {
    const species = this.species.get(speciesId);
    if (!species) return;
    const faction = this.factions.get(factionId);
    const color = faction?.color || species.color;
    for (const base of species.shipTypes) {
      const st = resolveShipType(species, faction, base.id)!;
      const defId = this.shipDefId(factionId, st.id);
      this.shipTypeByDef.set(defId, st);
      this.engine.creatureDefs.set(defId, this.makeDef(defId, `${faction?.name ?? species.name} ${st.name}`, st, color));
      for (const w of st.weapons) {
        if (w.kind === 'boarding') {
          const bId = `${defId}:boarder:${w.id}`;
          this.weaponByDef.set(bId, w);
          this.engine.creatureDefs.set(bId, this.makeDef(bId, `${st.name} Boarders`, {
            ...st, hp: w.boarderHp ?? 20, armor: 0, armorClass: 0, energyResistance: 0, radiusM: 10, layer: 'surface',
            speed: w.boarderSpeed ?? 12, weaponMultipliers: undefined,
          }, color, 'buildings'));
        } else if (w.kind === 'fireship') {
          const cId = `${defId}:craft:${w.id}`;
          this.weaponByDef.set(cId, w);
          this.engine.creatureDefs.set(cId, this.makeDef(cId, `${st.name} ${w.name}`, {
            ...st, hp: w.craftHp ?? 60, armor: 0, armorClass: 0, energyResistance: 0, radiusM: w.craftRadiusM ?? 25,
            layer: 'surface', speed: (w.projectileSpeed ?? 600) / 45, weaponMultipliers: undefined,
          }, color));
        }
      }
    }
  }

  private makeDef(id: string, name: string, st: FleetShipTypeDef, color: string, attackTarget: CreatureDef['attackTarget'] = 'hull'): CreatureDef {
    return {
      id, name, description: '', hp: st.hp, physicalArmor: st.armor, armorClass: st.armorClass, energyResistance: st.energyResistance,
      quantity: 1, movementSpeed: st.speed, acceleration: 1, deceleration: 1, turningRate: st.turnRate ?? 90,
      underwaterInterval: 0, surfaceInterval: 0, chargeWindup: 0, strikeDuration: 0, strikeCooldown: 0, strikeDamageRate: 0,
      strikeStunChance: 0, strikeStunDuration: 0, strikeRamMass: 0, iconColor: color, radius: st.radiusM, emoji: st.emoji,
      isFlying: st.layer === 'aerial', attackTarget, aggressionLocked: true, weaponMultipliers: st.weaponMultipliers,
    } as CreatureDef;
  }

  shipTypeOf(unit: CreatureRuntimeInstance): FleetShipTypeDef | undefined { return this.shipTypeByDef.get(unit.defId); }

  // --------------------------------------------------------------------------
  // Spawning
  // --------------------------------------------------------------------------

  spawnFleet(speciesId: string, factionId?: string, replaceExisting = false, position?: { x: number; y: number }): FleetRuntime | null {
    const e = this.engine;
    const species = this.species.get(speciesId);
    if (!species) return null;
    const faction = (factionId && this.factions.get(factionId)) || this.defaultFactionFor(speciesId);
    const fId = faction?.id ?? `${speciesId}_default`;
    if (replaceExisting) {
      e.creatures = [];
      e.projectiles = [];
      this.reset();
    }
    this.registerDefs(speciesId, fId);

    const ang = random() * Math.PI * 2;
    const cx = position?.x ?? Math.max(60, Math.min(e.worldWidth - 60, e.vesselCenter.x + Math.cos(ang) * 440));
    const cy = position?.y ?? Math.max(60, Math.min(e.worldHeight - 60, e.vesselCenter.y + Math.sin(ang) * 300));
    const bearingFromShip = angleBetween(e.vesselCenter.x, e.vesselCenter.y, cx, cy);
    const start = species.aggressionStart ?? AGGRESSION_DEFAULTS.start;
    const fleet: FleetRuntime = {
      id: `fleet_${e.timeElapsed.toFixed(2)}_${random().toString(36).slice(2, 6)}`,
      speciesId, factionId: fId, name: faction?.name ?? species.name, color: faction?.color ?? species.color,
      aggression: start,
      aggressionState: aggressionStateFor(start, species as any),
      initialShips: 0, hpAggroTriggered: false, outOfAggroTimer: 0, scatterTimer: 0,
      targetKind: null, targetCreatureId: null, formationAngle: bearingFromShip,
    };

    const spacing = metersToPx(species.formationSpacingM);
    let idx = 0;
    const centers: CreatureRuntimeInstance[] = [];
    for (const base of species.shipTypes) {
      const st = resolveShipType(species, faction, base.id)!;
      const n = Math.max(0, Math.round(st.count));
      for (let i = 0; i < n; i++) {
        let x: number, y: number;
        if (st.movement === 'orbit_parent' && centers.length > 0) {
          const parent = centers[i % centers.length];
          const a = (i / n) * Math.PI * 2;
          x = parent.x + Math.cos(a) * metersToPx(st.preferredRangeM);
          y = parent.y + Math.sin(a) * metersToPx(st.preferredRangeM);
        } else {
          const lateral = (idx - 0.5 * (species.shipTypes.reduce((s, t) => s + (t.movement === 'orbit_parent' ? 0 : t.count), 0) - 1)) * spacing;
          const perp = ((bearingFromShip + 90) * Math.PI) / 180;
          x = cx + Math.cos(perp) * lateral;
          y = cy + Math.sin(perp) * lateral;
        }
        const unit = this.createUnit(fleet, st, this.shipDefId(fId, st.id), x, y, 'ship');
        unit.formationIndex = idx;
        if (st.movement === 'orbit_parent' && centers.length > 0) {
          unit.parentUnitId = centers[i % centers.length].id;
          unit.orbitAngle = (i / n) * 360;
        } else {
          idx++;
        }
        if (st.movement === 'stationary' || st.count === 1) centers.push(unit);
        e.creatures.push(unit);
        fleet.initialShips++;
      }
    }
    fleet.lastHpTotal = this.fleetHp(fleet);
    this.fleets.push(fleet);
    e.addLog(`[FLEET] ${fleet.name} (${species.name}, ${fleet.initialShips} ships) entered the area!`, 'warn');
    return fleet;
  }

  private createUnit(fleet: FleetRuntime, st: FleetShipTypeDef, defId: string, x: number, y: number, role: 'ship' | 'boarder' | 'craft'): CreatureRuntimeInstance {
    const e = this.engine;
    const def = e.creatureDefs.get(defId)!;
    const ang = angleBetween(x, y, e.vesselCenter.x, e.vesselCenter.y);
    const submerged = role === 'ship' && (st.layer === 'submerged' || st.layer === 'diving');
    const weaponStates: FleetWeaponState[] = role === 'ship'
      ? st.weapons.map((w) => ({ cooldown: w.cooldown >= 60 ? w.cooldown * (0.05 + 0.2 * random()) : w.cooldown * 0.4 * random(), activeTimer: 0, rammingPhase: null }))
      : [];
    return {
      id: `fu_${role}_${e.timeElapsed.toFixed(2)}_${random().toString(36).slice(2, 7)}`,
      defId, name: def.name, x, y, vx: 0, vy: 0, angle: ang, targetSlotId: null,
      hp: def.hp, maxHp: def.hp, physicalArmor: def.physicalArmor, maxPhysicalArmor: def.physicalArmor,
      armorClass: def.armorClass, energyResistance: def.energyResistance, quantity: 1,
      stage: 'Underwater', stageTimer: 0, aggression: fleet.aggression, aggressionState: fleet.aggressionState,
      underwater: submerged, depthRatio: submerged ? 1 : 0, stunned: false, stunTimer: 0,
      isSwarm: false, swarmEntities: [], color: def.iconColor, radius: metersToPx(def.radius), emoji: def.emoji,
      isFlying: def.isFlying, locomotionType: def.isFlying ? 'flying' : 'non-flying', isAggroed: true,
      hateId: fleet.speciesId, hateFactionId: fleet.factionId, fleetId: fleet.id, fleetRole: role, shipTypeId: st.id, weaponStates,
      invulnerableTimer: 0, barrierCooldown: 0, regenTimer: 0, regenCooldown: 0, homeX: x, homeY: y,
      aggroRadiusMeters: this.species.get(fleet.speciesId)?.aggroRadiusM,
    } as CreatureRuntimeInstance;
  }

  setFleetAggression(fleetId: string, value: number) {
    const f = this.fleets.find((x) => x.id === fleetId);
    const sp = f && this.species.get(f.speciesId);
    if (!f || !sp) return;
    f.aggression = Math.max(0, Math.min(100, value));
    f.aggressionState = aggressionStateFor(f.aggression, sp as any);
  }

  unitsOf(fleet: FleetRuntime, role: 'ship' | 'boarder' | 'craft' | null = 'ship') {
    return this.engine.creatures.filter((c) => c.fleetId === fleet.id && c.hp > 0 && (role === null || c.fleetRole === role));
  }

  private fleetHp(fleet: FleetRuntime) {
    return this.unitsOf(fleet).reduce((s, u) => s + u.hp + u.physicalArmor, 0);
  }

  private centroid(ships: CreatureRuntimeInstance[]) {
    let x = 0, y = 0;
    for (const s of ships) { x += s.x; y += s.y; }
    return { x: x / Math.max(1, ships.length), y: y / Math.max(1, ships.length) };
  }

  // --------------------------------------------------------------------------
  // Tick
  // --------------------------------------------------------------------------

  update(dt: number) {
    const e = this.engine;
    this.beams = [];
    for (const p of this.pulses) p.age += dt;
    this.pulses = this.pulses.filter((p) => p.age < p.maxAge);
    this.deckEvents = this.deckEvents.filter((d) => e.timeElapsed - d.time < 6);

    this.updateBehemothEffects(dt);

    for (const fleet of this.fleets) {
      const species = this.species.get(fleet.speciesId);
      const ships = this.unitsOf(fleet);
      if (!species || ships.length === 0) continue;
      const c = this.centroid(ships);
      const aggroPx = metersToPx(species.aggroRadiusM);
      const distB = distance(c.x, c.y, e.vesselCenter.x, e.vesselCenter.y);
      this.updateFleetAggression(fleet, species, ships, distB <= aggroPx, dt);
      fleet.scatterTimer = Math.max(0, fleet.scatterTimer - dt);

      let target: Target | null = null;
      if (fleet.aggressionState === 'pursue') target = this.selectTarget(fleet, c, aggroPx);
      else if (fleet.aggressionState === 'neutral' && (fleet.retaliateTimer ?? 0) > 0) target = this.resolveRetaliation(fleet);
      fleet.targetKind = target ? target.kind : null;
      fleet.targetCreatureId = target && target.kind === 'creature' ? target.creature.id : null;

      // Formation slowly circles its target (broadside pass)
      const standoff = ships.find((s) => this.shipTypeOf(s)?.movement === 'standoff');
      const stS = standoff && this.shipTypeOf(standoff);
      if (stS && target) {
        const rPx = metersToPx(stS.preferredRangeM) + 60;
        fleet.formationAngle += ((knotsSpeedToPxPerSec(stS.speed) * 0.25) / rPx) * (180 / Math.PI) * dt;
      }

      for (const unit of ships) {
        unit.aggression = fleet.aggression;
        unit.aggressionState = fleet.aggressionState;
        unit.targetKind = fleet.targetKind;
        unit.targetCreatureId = fleet.targetCreatureId;
        unit.isAggroed = !!target;
        this.updateShip(fleet, species, unit, ships, target, aggroPx, dt);
      }
    }

    for (const u of e.creatures) {
      if (u.hp <= 0 || !u.fleetId) continue;
      if (u.fleetRole === 'boarder') this.updateBoarder(u, dt);
      else if (u.fleetRole === 'craft') this.updateCraft(u, dt);
    }

    this.updateShots(dt);
    this.updateCreatureDots(dt);

    // Remove fleets with nothing left
    this.fleets = this.fleets.filter((f) => {
      const alive = e.creatures.some((c) => c.fleetId === f.id && c.hp > 0 && !c.escaped);
      if (!alive) e.addLog(`[FLEET] ${f.name} is gone from the battle.`, 'success');
      return alive;
    });
  }

  private updateFleetAggression(fleet: FleetRuntime, species: FleetSpeciesDef, ships: CreatureRuntimeInstance[], behemothInRadius: boolean, dt: number) {
    const e = this.engine;
    // Retaliation: remember the latest attacker of any ship
    for (const s of ships) {
      if ((s.retaliateTimer ?? 0) > 0 && s.retaliateTimer! >= RETALIATE_SECONDS - dt * 1.5) {
        fleet.retaliateKind = s.retaliateKind; fleet.retaliateId = s.retaliateId; fleet.retaliateTimer = RETALIATE_SECONDS;
        if (species.shipTypes.find((t) => t.id === s.shipTypeId)?.scatterOnHit || this.shipTypeOf(s)?.scatterOnHit) {
          if (fleet.scatterTimer <= 0) this.rollScatter(fleet);
          fleet.scatterTimer = species.scatterDuration;
        }
      }
    }
    if (fleet.retaliateTimer) fleet.retaliateTimer = Math.max(0, fleet.retaliateTimer - dt);

    const hpNow = this.fleetHp(fleet);
    const lastHp = fleet.lastHpTotal ?? hpNow;
    fleet.lastHpTotal = hpNow;
    if (!species.aggressionLocked) {
      if (lastHp > hpNow) {
        const maxTotal = Math.max(1, this.maxFleetHp(fleet));
        fleet.aggression = Math.min(100, fleet.aggression + ((lastHp - hpNow) / maxTotal) * 100 * (species.aggressionPerDamagePct ?? AGGRESSION_PER_DAMAGE_PCT));
      }
      const lost = fleet.initialShips - ships.length;
      if (!fleet.hpAggroTriggered && species.routLossFraction > 0 && lost >= Math.ceil(fleet.initialShips * species.routLossFraction)) {
        fleet.hpAggroTriggered = true;
        fleet.aggression *= HP_LOSS_AGGRESSION_MUL;
        e.addLog(`[AGGRESSION] ${fleet.name} lost ${lost}/${fleet.initialShips} ships: rout, aggression -${Math.round((1 - HP_LOSS_AGGRESSION_MUL) * 100)}% (${Math.round(fleet.aggression)}%)`, 'info');
      }
      if (behemothInRadius) fleet.outOfAggroTimer = 0;
      else {
        fleet.outOfAggroTimer += dt;
        if (fleet.outOfAggroTimer >= OUT_OF_RADIUS_SECONDS) {
          fleet.outOfAggroTimer = 0;
          fleet.aggression *= OUT_OF_RADIUS_AGGRESSION_MUL;
          e.addLog(`[AGGRESSION] Behemoth outside ${fleet.name}'s aggro radius for ${OUT_OF_RADIUS_SECONDS}s (${Math.round(fleet.aggression)}%)`, 'info');
        }
      }
    }
    const next = aggressionStateFor(fleet.aggression, species as any);
    if (next !== fleet.aggressionState) {
      e.addLog(`[STATE] ${fleet.name} -> ${next.toUpperCase()} (aggression ${Math.round(fleet.aggression)}%)`, next === 'pursue' ? 'warn' : 'info');
      fleet.aggressionState = next;
    }
  }

  private maxFleetHp(fleet: FleetRuntime) {
    // Initial total = current ships' max + destroyed ships approximated by the average
    const ships = this.unitsOf(fleet);
    const avg = ships.reduce((s, u) => s + u.maxHp + u.maxPhysicalArmor, 0) / Math.max(1, ships.length);
    return avg * fleet.initialShips;
  }

  private rollScatter(fleet: FleetRuntime) {
    const species = this.species.get(fleet.speciesId);
    const r = metersToPx(species?.formationSpacingM ?? 80) * 2.5;
    for (const s of this.unitsOf(fleet)) this.scatterOffsets.set(s.id, { x: (random() * 2 - 1) * r, y: (random() * 2 - 1) * r });
  }

  private selectTarget(fleet: FleetRuntime, c: { x: number; y: number }, aggroPx: number): Target | null {
    const e = this.engine;
    const myIds = [fleet.factionId, fleet.speciesId];
    const hatesB = hatesIds(e.hateMatrix, myIds, [BEHEMOTH_ID]);
    let best: Target | null = null;
    let bestD = Infinity;
    const dB = distance(c.x, c.y, e.vesselCenter.x, e.vesselCenter.y);
    if (hatesB && dB <= aggroPx) { best = { kind: 'behemoth' }; bestD = dB; }
    for (const o of e.creatures) {
      if (o.hp <= 0 || o.fleetId === fleet.id || o.fleetRole === 'boarder' || o.fleetRole === 'craft') continue;
      if (!hatesIds(e.hateMatrix, myIds, e.hateIdsOf(o))) continue;
      let d = distance(c.x, c.y, o.x, o.y);
      if (d > aggroPx) continue;
      if (fleet.targetCreatureId === o.id) d *= 0.6;
      if (d < bestD) { bestD = d; best = { kind: 'creature', creature: o }; }
    }
    if (best) return best;
    return hatesB ? { kind: 'behemoth' } : null;
  }

  private resolveRetaliation(fleet: FleetRuntime): Target | null {
    if (fleet.retaliateKind === 'behemoth') return { kind: 'behemoth' };
    if (fleet.retaliateKind === 'creature') {
      const t = this.engine.creatures.find((c) => c.id === fleet.retaliateId && c.hp > 0);
      if (t) return { kind: 'creature', creature: t };
    }
    return null;
  }

  // --------------------------------------------------------------------------
  // Ships
  // --------------------------------------------------------------------------

  /** Distance from a point to the target's outline (Behemoth hull rectangle or creature circle), px. */
  private gapTo(x: number, y: number, target: Target): number {
    const e = this.engine;
    if (target.kind === 'behemoth') {
      const l = worldToDeckLocal(x, y, e.vesselCenter, e.behemoth.heading);
      const dx = Math.max(0, Math.abs(l.x) - e.vesselCenter.width / 2);
      const dy = Math.max(0, Math.abs(l.y) - e.vesselCenter.height / 2);
      return Math.hypot(dx, dy);
    }
    return Math.max(0, distance(x, y, target.creature.x, target.creature.y) - target.creature.radius);
  }

  private targetPos(target: Target) {
    const e = this.engine;
    return target.kind === 'behemoth' ? { x: e.vesselCenter.x, y: e.vesselCenter.y } : { x: target.creature.x, y: target.creature.y };
  }

  private targetVel(target: Target) {
    const e = this.engine;
    if (target.kind === 'creature') return { vx: target.creature.vx || 0, vy: target.creature.vy || 0 };
    const sp = knotsSpeedToPxPerSec(e.behemoth.speed) * (e.behemoth.isReversing ? -1 : 1);
    const h = (e.behemoth.heading * Math.PI) / 180;
    return { vx: Math.cos(h) * sp, vy: Math.sin(h) * sp };
  }

  private standoffPoint(target: Target, bearingDeg: number, rangePx: number) {
    const e = this.engine;
    const p = this.targetPos(target);
    const extent = target.kind === 'behemoth' ? hullExtentPx(e.vesselCenter, e.behemoth.heading, bearingDeg) : target.creature.radius;
    const r = ((bearingDeg * Math.PI) / 180);
    return { x: p.x + Math.cos(r) * (extent + rangePx), y: p.y + Math.sin(r) * (extent + rangePx) };
  }

  private steer(unit: CreatureRuntimeInstance, st: FleetShipTypeDef, gx: number, gy: number, maxSpeedPx: number, dt: number) {
    const dx = gx - unit.x, dy = gy - unit.y;
    const d = Math.hypot(dx, dy);
    const desiredSpeed = d < 1 ? 0 : Math.min(maxSpeedPx, (d / 0.8));
    const desiredAng = d < 1 ? unit.angle : (Math.atan2(dy, dx) * 180) / Math.PI;
    const diff = ((desiredAng - unit.angle + 540) % 360) - 180;
    const maxTurn = (st.turnRate ?? 90) * dt;
    unit.angle = (unit.angle + Math.max(-maxTurn, Math.min(maxTurn, diff)) + 360) % 360;
    const align = Math.max(0.25, Math.cos((Math.min(90, Math.abs(diff)) * Math.PI) / 180));
    const rad = (unit.angle * Math.PI) / 180;
    const spd = desiredSpeed * align;
    const blend = Math.min(1, 4 * dt);
    unit.vx = (unit.vx || 0) * (1 - blend) + Math.cos(rad) * spd * blend;
    unit.vy = (unit.vy || 0) * (1 - blend) + Math.sin(rad) * spd * blend;
    unit.x += unit.vx * dt;
    unit.y += unit.vy * dt;
  }

  private updateShip(fleet: FleetRuntime, species: FleetSpeciesDef, unit: CreatureRuntimeInstance, ships: CreatureRuntimeInstance[], target: Target | null, aggroPx: number, dt: number) {
    const e = this.engine;
    const st = this.shipTypeOf(unit);
    if (!st) return;
    if (unit.damagePulseTimer) unit.damagePulseTimer = Math.max(0, unit.damagePulseTimer - dt);

    // Abilities: barrier (on hit) and regeneration
    unit.invulnerableTimer = Math.max(0, (unit.invulnerableTimer ?? 0) - dt);
    unit.barrierCooldown = Math.max(0, (unit.barrierCooldown ?? 0) - dt);
    if (st.barrierDuration && (unit.retaliateTimer ?? 0) >= RETALIATE_SECONDS - dt * 1.5 && unit.barrierCooldown <= 0) {
      unit.invulnerableTimer = st.barrierDuration;
      unit.barrierCooldown = st.barrierCooldown ?? 30;
      e.addLog(`[BARRIER] ${unit.name} raised a power barrier (${st.barrierDuration}s, immobile)`, 'warn');
    }
    unit.regenCooldown = Math.max(0, (unit.regenCooldown ?? 0) - dt);
    if (st.regenBelowPct && st.regenPct && unit.regenCooldown <= 0 && (unit.regenTimer ?? 0) <= 0 && unit.hp < unit.maxHp * (st.regenBelowPct / 100)) {
      unit.regenTimer = st.regenDuration ?? 10;
      unit.regenCooldown = st.regenCooldown ?? 300;
      e.addLog(`[REGEN] ${unit.name} is regenerating (+${st.regenPct}% HP over ${unit.regenTimer}s)`, 'warn');
    }
    if ((unit.regenTimer ?? 0) > 0) {
      const dur = st.regenDuration ?? 10;
      unit.hp = Math.min(unit.maxHp, unit.hp + (unit.maxHp * (st.regenPct ?? 0) / 100 / dur) * dt);
      unit.regenTimer = Math.max(0, unit.regenTimer! - dt);
    }

    const immobile = (unit.invulnerableTimer ?? 0) > 0;
    const selfSlow = st.weapons.reduce((m, w, i) => ((unit.weaponStates?.[i]?.activeTimer ?? 0) > 0 && w.selfSlowPct ? Math.max(m, w.selfSlowPct) : m), 0);

    // Diving ships surface to use surface-only weapons (or to close in for contact attacks)
    if (st.layer === 'diving') {
      let wantSurface = false;
      if (target) {
        const gap = this.gapTo(unit.x, unit.y, target);
        st.weapons.forEach((w, i) => {
          const ws = unit.weaponStates![i];
          if (w.requiresSurface && (ws.activeTimer > 0 || (ws.cooldown <= 0.5 && gap <= metersToPx(w.rangeM) * 1.1))) wantSurface = true;
        });
        if (st.movement === 'close' && gap <= metersToPx(st.preferredRangeM + 150)) wantSurface = true;
      }
      if (unit.underwater === wantSurface) {
        unit.underwater = !wantSurface;
        unit.depthRatio = unit.underwater ? 1 : 0;
        unit.splashTimer = 0.8;
        unit.splashType = unit.underwater ? 'dive' : 'surface';
      }
    }
    if (unit.splashTimer) unit.splashTimer = Math.max(0, unit.splashTimer - dt);

    const baseKts = unit.underwater && st.speedSubmerged ? st.speedSubmerged : st.speed;
    const maxSpeed = immobile ? 0 : knotsSpeedToPxPerSec(baseKts) * (1 - selfSlow / 100);

    // Ram weapons override movement while charging / returning
    const ramIdx = st.weapons.findIndex((w, i) => w.kind === 'ram' && unit.weaponStates![i].rammingPhase);
    if (ramIdx >= 0 && !immobile) {
      this.updateRam(fleet, unit, st, ramIdx, target, dt);
      this.updateWeapons(fleet, unit, st, target, dt, true);
      return;
    }

    if (fleet.aggressionState === 'retreat') {
      this.retreatShip(unit, st, fleet, species, aggroPx, maxSpeed, dt);
      return;
    }

    if (!target) {
      // Neutral and nothing to fight back against: hold position, drift
      this.steer(unit, st, unit.x + (unit.vx || 0) * 0.2, unit.y + (unit.vy || 0) * 0.2, maxSpeed * 0.3, dt);
      return;
    }

    let goal: { x: number; y: number };
    const scatter = fleet.scatterTimer > 0 ? this.scatterOffsets.get(unit.id) : undefined;
    const nonOrbit = ships.filter((s) => this.shipTypeOf(s)?.movement !== 'orbit_parent');
    const n = Math.max(1, nonOrbit.length);
    const k = Math.max(0, nonOrbit.indexOf(unit));
    switch (st.movement) {
      case 'stationary':
        goal = { x: unit.x, y: unit.y };
        unit.angle = (unit.angle + 10 * dt) % 360;
        break;
      case 'orbit_parent': {
        const parent = e.creatures.find((c) => c.id === unit.parentUnitId && c.hp > 0);
        const orbitR = metersToPx(st.preferredRangeM);
        unit.orbitAngle = ((unit.orbitAngle ?? 0) + (knotsSpeedToPxPerSec(st.speed) * 0.15 / Math.max(20, orbitR)) * (180 / Math.PI) * dt) % 360;
        const p = parent ?? unit;
        const r = ((unit.orbitAngle ?? 0) * Math.PI) / 180;
        goal = { x: p.x + Math.cos(r) * orbitR, y: p.y + Math.sin(r) * orbitR };
        unit.homeX = goal.x; unit.homeY = goal.y;
        break;
      }
      case 'close': {
        // Each ship attacks from its own bearing; the bearing shifts after every contact strike (see fire)
        if (unit.orbitAngle === undefined) unit.orbitAngle = (k * 360) / n + (n > 1 ? 25 : 0);
        let bearing = fleet.formationAngle + unit.orbitAngle;
        const far = this.gapTo(unit.x, unit.y, target) > metersToPx(st.preferredRangeM + 200);
        if (!far) {
          // Walk around the hull instead of cutting across it: step at most 40° of bearing at a time
          const tp0 = this.targetPos(target);
          const cur = angleBetween(tp0.x, tp0.y, unit.x, unit.y);
          const diff = ((bearing - cur + 540) % 360) - 180;
          if (Math.abs(diff) > 40) bearing = cur + Math.sign(diff) * 40;
        }
        goal = this.standoffPoint(target, bearing, metersToPx(far ? st.preferredRangeM + 120 : st.preferredRangeM * 0.5));
        break;
      }
      default: {
        const rangePx = metersToPx(st.preferredRangeM);
        const spacingDeg = (metersToPx(species.formationSpacingM) / Math.max(40, rangePx + 60)) * (180 / Math.PI);
        const bearing = fleet.formationAngle + (k - (n - 1) / 2) * spacingDeg;
        goal = this.standoffPoint(target, bearing, rangePx);
      }
    }
    if (scatter) goal = { x: goal.x + scatter.x, y: goal.y + scatter.y };
    // Lead a moving target a little so ships keep station
    const tv = this.targetVel(target);
    goal.x += tv.vx * 0.5; goal.y += tv.vy * 0.5;
    goal.x = Math.max(20, Math.min(e.worldWidth - 20, goal.x));
    goal.y = Math.max(20, Math.min(e.worldHeight - 20, goal.y));
    if (st.movement !== 'stationary') this.steer(unit, st, goal.x, goal.y, maxSpeed * (scatter ? 1.15 : 1), dt);
    else { unit.vx = 0; unit.vy = 0; }

    this.updateWeapons(fleet, unit, st, target, dt, false);
  }

  private retreatShip(unit: CreatureRuntimeInstance, st: FleetShipTypeDef, fleet: FleetRuntime, species: FleetSpeciesDef, aggroPx: number, maxSpeed: number, dt: number) {
    const e = this.engine;
    let fx = e.vesselCenter.x, fy = e.vesselCenter.y;
    let nearest = distance(unit.x, unit.y, fx, fy);
    for (const o of e.creatures) {
      if (o.hp <= 0 || o.fleetId === fleet.id) continue;
      if (!hatesIds(e.hateMatrix, e.hateIdsOf(o), [fleet.factionId, fleet.speciesId])) continue;
      const d = distance(unit.x, unit.y, o.x, o.y);
      if (d < nearest) { nearest = d; fx = o.x; fy = o.y; }
    }
    const stay = species.retreatMode === 'stay';
    let ang = Math.atan2(unit.y - fy, unit.x - fx);
    const dB = distance(unit.x, unit.y, e.vesselCenter.x, e.vesselCenter.y);
    let speed = maxSpeed;
    if (stay && dB >= aggroPx * RETREAT_HOLD_FRACTION) {
      ang = Math.atan2(unit.y - e.vesselCenter.y, unit.x - e.vesselCenter.x) + Math.PI * 0.75;
      speed *= 0.4;
    }
    this.steer(unit, st, unit.x + Math.cos(ang) * 400, unit.y + Math.sin(ang) * 400, speed, dt);
    unit.stage = 'Retreating';
    if (!stay && dB > aggroPx * ESCAPE_RADIUS_MULTIPLIER) unit.escaped = true;
    // Clamp-free: ships may leave the canvas while fleeing; escape removes them
  }

  // --------------------------------------------------------------------------
  // Weapons
  // --------------------------------------------------------------------------

  private updateWeapons(fleet: FleetRuntime, unit: CreatureRuntimeInstance, st: FleetShipTypeDef, target: Target | null, dt: number, ramming: boolean) {
    const states = unit.weaponStates!;
    st.weapons.forEach((w, i) => {
      const ws = states[i];
      if (!ws) return;
      ws.cooldown = Math.max(0, ws.cooldown - dt);
      if (ws.activeTimer > 0) {
        ws.activeTimer = Math.max(0, ws.activeTimer - dt);
        if (w.kind === 'beam' && target) this.tickBeam(fleet, unit, w, target, dt);
      }
      if (ramming || !target || ws.cooldown > 0 || ws.activeTimer > 0) return;
      if ((unit.invulnerableTimer ?? 0) > 0 && w.kind !== 'pulse') return; // barrier: no attacks except pulses
      if (w.requiresSurface && unit.underwater) return;
      if (!this.canReach(w, target)) return; // melee / ram cannot reach aerial targets
      const gap = this.gapTo(unit.x, unit.y, target);
      if (gap > metersToPx(w.rangeM)) return;
      this.fire(fleet, unit, st, w, ws, target);
    });
  }

  private fire(fleet: FleetRuntime, unit: CreatureRuntimeInstance, st: FleetShipTypeDef, w: FleetWeaponDef, ws: FleetWeaponState, target: Target) {
    const e = this.engine;
    ws.cooldown = w.cooldown;
    const tp = this.targetPos(target);
    switch (w.kind) {
      case 'cannon': {
        const speedPx = metersToPx(w.projectileSpeed ?? 900);
        const tv = this.targetVel(target);
        const t = distance(unit.x, unit.y, tp.x, tp.y) / Math.max(1, speedPx);
        const aimX = tp.x + tv.vx * t, aimY = tp.y + tv.vy * t;
        const base = Math.atan2(aimY - unit.y, aimX - unit.x);
        const n = Math.max(1, Math.round(w.count ?? 1));
        for (let i = 0; i < n; i++) {
          const a = base + (((random() * 2 - 1) * (w.spreadDeg ?? 3)) * Math.PI) / 180;
          this.shots.push({
            id: `fs_${random().toString(36).slice(2, 9)}`, fleetId: fleet.id, sourceUnitId: unit.id,
            x: unit.x, y: unit.y, vx: Math.cos(a) * speedPx, vy: Math.sin(a) * speedPx,
            targetKind: target.kind, targetId: target.kind === 'creature' ? target.creature.id : null,
            targetX: aimX, targetY: aimY, ttl: (metersToPx(w.rangeM) * 1.6) / speedPx + 0.3, weapon: w, color: fleet.color,
          });
        }
        e.addLog(`[FLEET] ${unit.name}: ${w.name} (${n} × ${w.damage})`, 'warn');
        break;
      }
      case 'beam':
        ws.activeTimer = w.duration ?? 3;
        e.addLog(`[FLEET] ${unit.name}: ${w.name} (${(w.damage * (w.count ?? 1)).toFixed(0)} dps, ${ws.activeTimer}s)`, 'warn');
        break;
      case 'dot':
        if (w.selfSlowPct) ws.activeTimer = w.duration ?? 0;
        this.applyHit(fleet, unit, w, target, 0, { dot: true });
        this.beams.push({ x1: unit.x, y1: unit.y, x2: tp.x, y2: tp.y, color: '#a3e635', width: 3 });
        break;
      case 'pulse': {
        this.pulses.push({ x: unit.x, y: unit.y, radius: metersToPx(w.rangeM), age: 0, maxAge: 0.6, color: fleet.color });
        this.applyHit(fleet, unit, w, target, w.damage, {});
        break;
      }
      case 'melee':
        if (st.movement === 'close') unit.orbitAngle = (unit.orbitAngle ?? 0) + (random() < 0.5 ? -1 : 1) * (30 + 50 * random());
        unit.damagePulseTimer = 0.5;
        unit.damagePulseColor = '#ef4444';
        this.applyHit(fleet, unit, w, target, w.damage, {});
        break;
      case 'boarding':
        this.launchBoarders(fleet, unit, st, w);
        break;
      case 'fireship':
        this.launchCraft(fleet, unit, st, w);
        break;
      case 'ram':
        ws.rammingPhase = 'charge';
        ws.activeTimer = RAM_CHARGE_TIMEOUT;
        break;
    }
  }

  /** Contact weapons (melee, ram) cannot hit aerial targets. */
  canReach(w: FleetWeaponDef, target: Target): boolean {
    if (w.kind !== 'melee' && w.kind !== 'ram') return true;
    return !(target.kind === 'creature' && target.creature.isFlying);
  }

  /** Per-target damage multiplier of a fleet weapon (faction > species > creature id > 'behemoth'). */
  targetMultiplier(w: FleetWeaponDef, target: Target): number {
    const m = w.targetMultipliers;
    if (!m) return 1;
    const ids = target.kind === 'behemoth' ? [BEHEMOTH_ID] : this.engine.hateIdsOf(target.creature);
    for (const id of ids) if (typeof m[id] === 'number') return m[id];
    return 1;
  }

  private tickBeam(fleet: FleetRuntime, unit: CreatureRuntimeInstance, w: FleetWeaponDef, target: Target, dt: number) {
    if (w.requiresSurface && unit.underwater) return;
    if (this.gapTo(unit.x, unit.y, target) > metersToPx(w.rangeM) * 1.1) return;
    const tp = this.targetPos(target);
    const bolts = Math.max(1, Math.round(w.count ?? 1));
    this.applyHit(fleet, unit, w, target, w.damage * bolts * dt, { continuous: true });
    for (let i = 0; i < Math.min(bolts, 4); i++) {
      const j = bolts > 1 ? (random() - 0.5) * 30 : 0;
      this.beams.push({ x1: unit.x, y1: unit.y, x2: tp.x + j, y2: tp.y + j, color: w.damageType === 'Energy' ? '#e0f2fe' : '#a3e635', width: bolts > 1 ? 1 : 3 });
    }
  }

  private updateRam(fleet: FleetRuntime, unit: CreatureRuntimeInstance, st: FleetShipTypeDef, idx: number, target: Target | null, dt: number) {
    const w = st.weapons[idx];
    const ws = unit.weaponStates![idx];
    const speed = metersToPx(w.projectileSpeed ?? 900);
    if (ws.rammingPhase === 'charge') {
      ws.activeTimer -= dt;
      if (!target || ws.activeTimer <= 0) { ws.rammingPhase = 'return'; return; }
      const tp = this.targetPos(target);
      this.steer(unit, { ...st, turnRate: 720 }, tp.x, tp.y, speed, dt);
      if (this.gapTo(unit.x, unit.y, target) <= unit.radius) {
        this.applyHit(fleet, unit, w, target, w.damage, {});
        this.engine.projectiles.push(this.explosionVisual(unit.x, unit.y, unit.radius * 2, fleet.color));
        ws.rammingPhase = 'return';
      }
    } else {
      const parent = this.engine.creatures.find((c) => c.id === unit.parentUnitId && c.hp > 0);
      const orbitR = metersToPx(st.preferredRangeM);
      const r = ((unit.orbitAngle ?? 0) * Math.PI) / 180;
      const hx = parent ? parent.x + Math.cos(r) * orbitR : unit.homeX ?? unit.x;
      const hy = parent ? parent.y + Math.sin(r) * orbitR : unit.homeY ?? unit.y;
      this.steer(unit, { ...st, turnRate: 720 }, hx, hy, speed * 0.6, dt);
      if (distance(unit.x, unit.y, hx, hy) < 12) { ws.rammingPhase = null; ws.cooldown = w.cooldown; }
    }
  }

  private explosionVisual(x: number, y: number, radius: number, color: string) {
    return {
      id: `fexp_${random().toString(36).slice(2, 9)}`, sourceSlotId: 'fleet', sourceX: x, sourceY: y, x, y, targetX: x, targetY: y,
      vx: 0, vy: 0, damageType: 'Physical' as const, dpp: 0, pushback: 0, aoe: radius, trajectory: 'Arch' as const, arcProgress: 1, arcHeight: 0,
      color, createdTime: this.engine.timeElapsed, duration: 0.35, isExplosion: true, explosionRadius: radius, explosionLifetime: 0.35,
    };
  }

  // --------------------------------------------------------------------------
  // Hits & effects
  // --------------------------------------------------------------------------

  /** Applies a fleet weapon hit (damage + Tier 2 effects) to the Behemoth or a creature / fleet unit. */
  applyHit(fleet: FleetRuntime | undefined, unit: CreatureRuntimeInstance | null, w: FleetWeaponDef, target: Target, damage: number, opts: { dot?: boolean; continuous?: boolean }) {
    const e = this.engine;
    const who = unit?.name ?? fleet?.name ?? 'Fleet';
    const mul = this.targetMultiplier(w, target);
    damage *= mul;
    if (target.kind === 'creature') {
      if (opts.dot) {
        this.creatureDots.push({ creatureId: target.creature.id, dps: w.damage * mul, timeLeft: w.duration ?? 5, damageType: w.damageType, sourceId: unit?.id ?? '' });
        return;
      }
      if (damage > 0) e.withDamageSource({ kind: 'creature', id: unit?.id ?? null }, () => e.applyDamageToCreature(target.creature, w.damageType, damage, 0, target.creature.x, target.creature.y, 0, false));
      return;
    }

    const b = e.behemoth;
    if (opts.dot) {
      this.behemothDots.push({ dps: w.damage * mul, timeLeft: w.duration ?? 5, target: w.target ?? 'hull', source: who });
      e.addLog(`[FLEET] ${who}: ${w.name} — ${w.damage} ${w.damageType} dps for ${w.duration ?? 5}s`, 'danger');
    } else if (damage > 0) {
      this.damageBehemoth(damage, w.target ?? 'hull', who, w.name, !opts.continuous);
    }
    if (opts.continuous) return; // effects only on discrete hits / beam start

    if (w.slowPct && w.slowDuration) {
      b.slowPct = Math.max(b.slowTimer && b.slowTimer > 0 ? b.slowPct ?? 0 : 0, w.slowPct);
      b.slowTimer = Math.max(b.slowTimer ?? 0, w.slowDuration);
    }
    if (w.shutdownCount && w.shutdownDuration) {
      const pool: Array<{ kind: 'w'; s: WeaponSlot } | { kind: 'b'; s: BuildingSlot }> = [];
      for (const s of b.slots) if (s.weapon && s.health > 0 && !s.isStunned) pool.push({ kind: 'w', s });
      for (const s of b.buildingSlots) if (s.building && s.health > 0 && !s.isStunned) pool.push({ kind: 'b', s });
      const names: string[] = [];
      for (let i = 0; i < w.shutdownCount && pool.length > 0; i++) {
        const pick = pool.splice(Math.floor(random() * pool.length), 1)[0];
        pick.s.isStunned = true;
        pick.s.stunTimer = Math.max(pick.s.stunTimer || 0, w.shutdownDuration);
        pick.s.hitFlashTimer = 0.6;
        names.push(pick.kind === 'w' ? `Mount ${pick.s.id.toUpperCase()}` : pick.s.building!.name);
      }
      if (names.length) this.pushDeckEvent(`${w.name}: ${names.join(', ')} shut down for ${w.shutdownDuration}s`, 'system');
    }
    if (w.crewDps && w.duration) {
      this.crewEffects.push({ dps: w.crewDps, timeLeft: w.duration, sourceId: unit?.id, radiusPx: metersToPx(w.rangeM) });
      this.pushDeckEvent(`${w.name} sweeps the deck (${w.crewDps} dps to crew within ${w.rangeM} m, ${w.duration}s)`, 'crew');
    }
    if (w.tilt) {
      const side = unit && unit.y < e.vesselCenter.y ? -1 : 1;
      b.tiltVelocity += side * w.tilt;
    }
    if (w.pacifyDuration) {
      b.pacifyTimer = Math.max(b.pacifyTimer ?? 0, w.pacifyDuration);
      this.pushDeckEvent(`${w.name}: Behemoth weapons pacified for ${w.pacifyDuration}s`, 'system');
    }
    if (w.kind === 'melee' && w.tilt) this.pushDeckEvent(`${who} boards the hull: ${w.name}!`, 'impact');
  }

  /** Fleet damage to the Behemoth: hull, a random building, the engine, crew, or random (hull / building). */
  damageBehemoth(amount: number, target: FleetWeaponDef['target'], who: string, what: string, log: boolean) {
    const e = this.engine;
    const b = e.behemoth;
    let t = target ?? 'hull';
    if (t === 'random') {
      // Random hit location: 50% hull, 35% a building, 15% engine
      const r = random();
      t = r < RANDOM_HIT_HULL ? 'hull' : r < RANDOM_HIT_HULL + RANDOM_HIT_BUILDING ? 'buildings' : 'engine';
    }
    if (t === 'engine' && (b.maxEngineHp ?? 0) > 0) {
      const before = b.engineHp ?? 0;
      b.engineHp = Math.max(0, before - amount);
      e.stats.totalDamageTakenByBehemoth += amount;
      b.hullHitFlash = 0.3;
      if (log) e.addLog(`[FLEET] ${who}: ${what} hit the ENGINE for ${Math.round(amount)} (${Math.round(b.engineHp)}/${b.maxEngineHp})`, 'danger');
      if (before > 0 && b.engineHp <= 0) this.pushDeckEvent('Engine destroyed: speed severely reduced', 'system');
      return;
    }
    if (t === 'buildings') {
      const live = b.buildingSlots.filter((s) => s.building && s.health > 0);
      if (live.length > 0) {
        const slot = live[Math.floor(random() * live.length)];
        const destroyed = e.damageBuildingSlot(slot, amount);
        if (log) e.addLog(`[FLEET] ${who}: ${what} hit ${slot.building!.name} for ${Math.round(amount)}`, 'danger');
        if (destroyed) e.addLog(`${slot.building!.name} was DESTROYED by ${who}!`, 'danger');
        return;
      }
      t = 'hull';
    }
    if (t === 'crew') {
      this.crewEffects.push({ dps: amount, timeLeft: 1 });
      return;
    }
    b.hullHp = Math.max(0, b.hullHp - amount);
    b.hullHitFlash = 0.4;
    e.stats.totalDamageTakenByBehemoth += amount;
    if (log) e.addLog(`[FLEET] ${who}: ${what} hit the hull for ${Math.round(amount)}`, 'danger');
  }

  private updateBehemothEffects(dt: number) {
    const e = this.engine;
    const b = e.behemoth;
    if (b.slowTimer && b.slowTimer > 0) { b.slowTimer = Math.max(0, b.slowTimer - dt); if (b.slowTimer === 0) b.slowPct = 0; }
    if (b.pacifyTimer && b.pacifyTimer > 0) b.pacifyTimer = Math.max(0, b.pacifyTimer - dt);
    for (const d of this.behemothDots) {
      this.damageBehemoth(d.dps * dt, d.target === 'random' ? 'hull' : d.target, d.source, 'DoT', false);
      d.timeLeft -= dt;
    }
    this.behemothDots = this.behemothDots.filter((d) => d.timeLeft > 0);
    if (this.crewEffects.length) {
      const fx = this.crewEffects.map((c) => ({ c, src: c.sourceId ? e.creatures.find((u) => u.id === c.sourceId && u.hp > 0) : undefined }));
      for (const c of this.crewEffects) c.timeLeft -= dt;
      this.crewEffects = this.crewEffects.filter((c) => c.timeLeft > 0);
      let dead = 0;
      for (const a of e.crewAgents) {
        if (a.hp <= 0 || a.status === 'hidden' || a.status === 'snatched') continue;
        const wp = deckLocalToWorld(a.x, a.y, e.vesselCenter, e.behemoth.heading);
        let dps = 0;
        for (const { c, src } of fx) {
          if (c.radiusPx !== undefined) {
            if (!src || distance(wp.x, wp.y, src.x, src.y) > c.radiusPx) continue; // area effect around the caster
          }
          dps += c.dps;
        }
        if (dps <= 0) continue;
        a.hp -= dps * dt;
        if (a.hp <= 0) { a.hp = 0; dead++; }
      }
      if (dead > 0) {
        e.crewAgents = e.crewAgents.filter((a) => a.hp > 0 || a.status === 'snatched');
        b.crew = Math.max(0, b.crew - dead);
        e.stats.crewLost = (e.stats.crewLost || 0) + dead;
        e.enforceCrewCap();
        e.addLog(`[FLEET] ${dead} crew killed on deck`, 'danger');
      }
    }
  }

  /** Speed cap multiplier from fleet slows and engine damage. */
  speedMultiplier(): number {
    const b = this.engine.behemoth;
    const slow = b.slowTimer && b.slowTimer > 0 ? 1 - Math.min(90, b.slowPct ?? 0) / 100 : 1;
    const max = b.maxEngineHp ?? 0;
    const eng = max > 0 ? ENGINE_MIN_SPEED_FACTOR + (1 - ENGINE_MIN_SPEED_FACTOR) * Math.max(0, (b.engineHp ?? max) / max) : 1;
    return slow * eng;
  }

  private updateCreatureDots(dt: number) {
    const e = this.engine;
    for (const d of this.creatureDots) {
      const c = e.creatures.find((x) => x.id === d.creatureId && x.hp > 0);
      if (c) e.withDamageSource({ kind: 'creature', id: d.sourceId }, () => e.applyDamageToCreature(c, d.damageType, d.dps * dt, 0, c.x, c.y, 0, false));
      d.timeLeft = c ? d.timeLeft - dt : 0;
    }
    this.creatureDots = this.creatureDots.filter((d) => d.timeLeft > 0);
  }

  private updateShots(dt: number) {
    const e = this.engine;
    const keep: FleetShot[] = [];
    for (const s of this.shots) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.ttl -= dt;
      const fleet = this.fleets.find((f) => f.id === s.fleetId);
      let hit = false;
      if (s.targetKind === 'behemoth') {
        if (isPointOverDeck(s.x, s.y, e.vesselCenter, e.behemoth.heading, 4)) {
          hit = true;
          const src = e.creatures.find((c) => c.id === s.sourceUnitId);
          this.applyHit(fleet, src ?? null, s.weapon, { kind: 'behemoth' }, s.weapon.damage, {});
        }
      } else {
        const t = e.creatures.find((c) => c.id === s.targetId && c.hp > 0);
        if (t && distance(s.x, s.y, t.x, t.y) <= t.radius + 3) {
          hit = true;
          const src = e.creatures.find((c) => c.id === s.sourceUnitId);
          this.applyHit(fleet, src ?? null, s.weapon, { kind: 'creature', creature: t }, s.weapon.damage, {});
        }
      }
      if (!hit && s.ttl > 0) keep.push(s);
    }
    this.shots = keep;
  }

  // --------------------------------------------------------------------------
  // Boarders and fireship craft
  // --------------------------------------------------------------------------

  private launchBoarders(fleet: FleetRuntime, unit: CreatureRuntimeInstance, st: FleetShipTypeDef, w: FleetWeaponDef) {
    const e = this.engine;
    const defId = `${unit.defId}:boarder:${w.id}`;
    if (!e.creatureDefs.has(defId)) return;
    const n = Math.max(1, Math.round(w.count ?? 1));
    for (let i = 0; i < n; i++) {
      const b = this.createUnit(fleet, { ...st, weapons: [] }, defId, unit.x + (random() - 0.5) * 12, unit.y + (random() - 0.5) * 12, 'boarder');
      b.parentUnitId = unit.id;
      b.boarderState = 'crossing';
      b.boarderDealt = 0;
      b.underwater = false; b.depthRatio = 0;
      b.isFlying = false; b.locomotionType = 'non-flying';
      e.creatures.push(b);
    }
    e.addLog(`[FLEET] ${unit.name} launched ${n} boarding boats!`, 'danger');
  }

  private pickBoardTarget(): BuildingSlot | null {
    const live = this.engine.behemoth.buildingSlots.filter((s) => s.building && s.health > 0);
    return live.length ? live[Math.floor(random() * live.length)] : null;
  }

  private updateBoarder(u: CreatureRuntimeInstance, dt: number) {
    const e = this.engine;
    const w = this.weaponByDef.get(u.defId);
    if (!w) return;
    const speed = knotsSpeedToPxPerSec(w.boarderSpeed ?? 12);
    if (u.boarderState === 'crossing' || u.boarderState === 'onboard') {
      let slot = e.behemoth.buildingSlots.find((s) => s.id === u.boarderTargetSlotId && s.building && s.health > 0) ?? null;
      if (!slot) { slot = this.pickBoardTarget(); u.boarderTargetSlotId = slot?.id ?? null; }
      if (!slot) { u.boarderState = 'returning'; return; }
      const p = getBuildingSlotWorldPosition(slot, e.vesselCenter, e.behemoth.heading);
      if (u.boarderState === 'crossing') {
        const d = distance(u.x, u.y, p.x, p.y);
        const step = Math.min(d, speed * dt);
        u.vx = ((p.x - u.x) / Math.max(1, d)) * speed; u.vy = ((p.y - u.y) / Math.max(1, d)) * speed;
        u.x += ((p.x - u.x) / Math.max(1, d)) * step; u.y += ((p.y - u.y) / Math.max(1, d)) * step;
        u.angle = angleBetween(u.x, u.y, p.x, p.y);
        if (isPointOverDeck(u.x, u.y, e.vesselCenter, e.behemoth.heading, 0)) {
          u.boarderState = 'onboard';
          u.isFlying = true; u.locomotionType = 'flying'; // draw on top of the deck
          if (!e.creatures.some((o) => o !== u && o.fleetId === u.fleetId && o.fleetRole === 'boarder' && o.boarderState === 'onboard')) {
            this.pushDeckEvent(`Boarders landed on deck (${u.name})`, 'boarding');
          }
        }
      } else {
        // On deck: ride with the ship next to the target building and wreck it
        const jitter = ((parseInt(u.id.slice(-3), 36) % 7) - 3) * 3;
        u.x = p.x + jitter; u.y = p.y - jitter; u.vx = 0; u.vy = 0;
        const dmg = (w.boarderDamage ?? 10) * dt;
        const destroyed = e.damageBuildingSlot(slot, dmg);
        u.boarderDealt = (u.boarderDealt ?? 0) + dmg;
        if (destroyed) { e.addLog(`${slot.building!.name} was DESTROYED by boarders!`, 'danger'); u.boarderTargetSlotId = null; }
        if (u.boarderDealt >= (w.boarderRetreatDamage ?? 150)) {
          u.boarderState = 'returning';
          u.isFlying = false; u.locomotionType = 'non-flying';
          e.addLog(`[FLEET] Boarders head back to their ship with the loot`, 'info');
        }
      }
      return;
    }
    // Returning to the mother ship (or away if it sank)
    const parent = e.creatures.find((c) => c.id === u.parentUnitId && c.hp > 0);
    const gx = parent ? parent.x : u.x + (u.x - e.vesselCenter.x);
    const gy = parent ? parent.y : u.y + (u.y - e.vesselCenter.y);
    const d = distance(u.x, u.y, gx, gy);
    const step = Math.min(d, speed * dt);
    u.x += ((gx - u.x) / Math.max(1, d)) * step; u.y += ((gy - u.y) / Math.max(1, d)) * step;
    if ((parent && d < parent.radius + 4) || u.x < -40 || u.y < -40 || u.x > e.worldWidth + 40 || u.y > e.worldHeight + 40) u.escaped = true;
  }

  private launchCraft(fleet: FleetRuntime, unit: CreatureRuntimeInstance, st: FleetShipTypeDef, w: FleetWeaponDef) {
    const e = this.engine;
    const defId = `${unit.defId}:craft:${w.id}`;
    if (!e.creatureDefs.has(defId)) return;
    const c = this.createUnit(fleet, { ...st, weapons: [] }, defId, unit.x, unit.y, 'craft');
    c.parentUnitId = unit.id;
    c.underwater = false; c.depthRatio = 0;
    e.creatures.push(c);
    this.pushDeckEvent(`${unit.name} launched a ${w.name}!`, 'impact');
  }

  private updateCraft(u: CreatureRuntimeInstance, dt: number) {
    const e = this.engine;
    const w = this.weaponByDef.get(u.defId);
    if (!w) return;
    const speed = metersToPx(w.projectileSpeed ?? 600);
    const tv = this.targetVel({ kind: 'behemoth' });
    const t = distance(u.x, u.y, e.vesselCenter.x, e.vesselCenter.y) / Math.max(1, speed);
    const gx = e.vesselCenter.x + tv.vx * t, gy = e.vesselCenter.y + tv.vy * t;
    const st = { ...(this.shipTypeOf(u) ?? ({} as FleetShipTypeDef)), turnRate: 120 } as FleetShipTypeDef;
    this.steer(u, st, gx, gy, speed, dt);
    if (isPointOverDeck(u.x, u.y, e.vesselCenter, e.behemoth.heading, u.radius * 0.5)) {
      const fleet = this.fleets.find((f) => f.id === u.fleetId);
      this.applyHit(fleet, u, w, { kind: 'behemoth' }, w.damage, {});
      e.projectiles.push(this.explosionVisual(u.x, u.y, metersToPx(w.aoeM ?? 60), '#f97316'));
      this.pushDeckEvent(`${u.name} exploded against the hull (${w.damage} dmg)!`, 'impact');
      u.craftExploded = true;
      u.hp = 0;
    }
  }

  /** Called by the engine before dead units are removed (craft shot down explode harmlessly). */
  onUnitRemoved(u: CreatureRuntimeInstance) {
    if (u.fleetRole === 'craft' && !u.craftExploded && u.hp <= 0) {
      this.engine.projectiles.push(this.explosionVisual(u.x, u.y, u.radius * 2, '#f97316'));
      this.engine.addLog(`${u.name} was destroyed before reaching the hull!`, 'success');
    } else if (u.fleetRole === 'ship' && u.hp <= 0) {
      this.engine.addLog(`[FLEET] ${u.name} sunk!`, 'success');
    }
  }
}
