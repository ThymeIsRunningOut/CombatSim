import React, { useState } from 'react';
import { FleetSpeciesDef, FleetFactionDef, FleetShipTypeDef, FleetWeaponDef, WeaponDef } from '../types/combat';
import { resolveShipType } from '../engine/fleets';
import { AGGRESSION_DEFAULTS } from '../engine/relations';

interface FleetEditorProps {
  species: FleetSpeciesDef[];
  setSpecies?: React.Dispatch<React.SetStateAction<FleetSpeciesDef[]>>;
  factions: FleetFactionDef[];
  setFactions?: React.Dispatch<React.SetStateAction<FleetFactionDef[]>>;
  weapons: WeaponDef[];
}

const SHIP_FIELDS: Array<[keyof FleetShipTypeDef, string, number?]> = [
  ['count', 'Count', 1],
  ['hp', 'HP', 10],
  ['armor', 'Armor pool', 10],
  ['armorClass', 'Armor Class', 1],
  ['energyResistance', 'Energy Res. (0-1)', 0.05],
  ['speed', 'Speed (kts)', 0.5],
  ['speedSubmerged', 'Submerged speed (kts)', 0.5],
  ['radiusM', 'Radius (m)', 1],
  ['preferredRangeM', 'Standoff / orbit (m)', 10],
  ['turnRate', 'Turn rate (°/s)', 5],
  ['barrierDuration', 'Barrier (s)', 1],
  ['barrierCooldown', 'Barrier CD (s)', 1],
  ['regenBelowPct', 'Regen below HP %', 1],
  ['regenPct', 'Regen heal %', 0.5],
  ['regenDuration', 'Regen time (s)', 1],
  ['regenCooldown', 'Regen CD (s)', 10],
];

const WEAPON_FIELDS: Array<[keyof FleetWeaponDef, string, number?]> = [
  ['damage', 'Damage (dps for beam/dot)', 1],
  ['count', 'Count (shots / bolts / boarders)', 1],
  ['rangeM', 'Range (m)', 10],
  ['cooldown', 'Cooldown (s)', 1],
  ['duration', 'Duration (s)', 0.5],
  ['projectileSpeed', 'Projectile speed (m/s)', 25],
  ['spreadDeg', 'Spread (±°)', 0.5],
  ['slowPct', 'Slow %', 1],
  ['slowDuration', 'Slow (s)', 0.5],
  ['shutdownCount', 'Shutdown systems', 1],
  ['shutdownDuration', 'Shutdown (s)', 1],
  ['crewDps', 'Crew dps', 1],
  ['tilt', 'Tilt impulse', 0.5],
  ['pacifyDuration', 'Pacify (s)', 1],
  ['selfSlowPct', 'Self slow %', 5],
  ['boarderHp', 'Boarder HP', 1],
  ['boarderDamage', 'Boarder dps (buildings)', 1],
  ['boarderSpeed', 'Boarder speed (kts)', 0.5],
  ['boarderRetreatDamage', 'Boarder leaves after dmg', 10],
  ['craftHp', 'Craft HP', 5],
  ['craftRadiusM', 'Craft radius (m)', 1],
  ['aoeM', 'Explosion radius (m)', 5],
];

const KIND_LABEL: Record<FleetWeaponDef['kind'], string> = {
  cannon: 'Cannon volley', beam: 'Beam', dot: 'Spray / DoT', pulse: 'Pulse (area effect)', melee: 'Melee strike',
  boarding: 'Boarding launch', fireship: 'Fire-ship launch', ram: 'Ram (ship charges)',
};

/** Compact numeric input; highlights faction overrides. */
const NumField: React.FC<{ label: string; value: number | undefined; step?: number; overridden?: boolean; onChange: (v: number | undefined) => void; onClear?: () => void; disabled?: boolean }> = ({ label, value, step = 1, overridden, onChange, onClear, disabled }) => (
  <label className={`flex flex-col gap-0.5 text-[10px] font-mono ${overridden ? 'text-amber-300' : 'text-slate-400'}`}>
    <span className="flex items-center gap-1">
      {label}
      {overridden && onClear && (
        <button type="button" onClick={onClear} className="text-slate-500 hover:text-rose-300" title="Clear faction override (use species value)">×</button>
      )}
    </span>
    <input
      type="number"
      step={step}
      value={value ?? ''}
      placeholder="—"
      disabled={disabled}
      onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      className={`w-full bg-slate-900 border rounded px-1.5 py-0.5 text-slate-100 ${overridden ? 'border-amber-600/70' : 'border-slate-700'}`}
    />
  </label>
);

export const FleetEditor: React.FC<FleetEditorProps> = ({ species, setSpecies, factions, setFactions, weapons }) => {
  const [speciesId, setSpeciesId] = useState<string>(species[0]?.id ?? '');
  const [factionId, setFactionId] = useState<string>('__base__');
  const sp = species.find((s) => s.id === speciesId) ?? species[0];
  if (!sp) return <div className="text-slate-500 font-mono text-xs">No fleet species defined.</div>;
  const spFactions = factions.filter((f) => f.speciesId === sp.id);
  const faction = factionId === '__base__' ? undefined : spFactions.find((f) => f.id === factionId);
  const isBase = !faction;

  const updateSpecies = (patch: Partial<FleetSpeciesDef>) =>
    setSpecies && setSpecies((prev) => prev.map((s) => (s.id === sp.id ? { ...s, ...patch } : s)));

  const updateShipBase = (shipId: string, patch: Partial<FleetShipTypeDef>) =>
    updateSpecies({ shipTypes: sp.shipTypes.map((t) => (t.id === shipId ? { ...t, ...patch } : t)) });

  const updateWeaponBase = (shipId: string, weaponId: string, patch: Partial<FleetWeaponDef>) =>
    updateSpecies({
      shipTypes: sp.shipTypes.map((t) => (t.id === shipId ? { ...t, weapons: t.weapons.map((w) => (w.id === weaponId ? { ...w, ...patch } : w)) } : t)),
    });

  const updateFaction = (fn: (f: FleetFactionDef) => FleetFactionDef) =>
    faction && setFactions && setFactions((prev) => prev.map((f) => (f.id === faction.id ? fn(f) : f)));

  const setShipOverride = (shipId: string, key: string, value: number | undefined) =>
    updateFaction((f) => {
      const ov = { ...(f.overrides[shipId] || {}) } as any;
      if (value === undefined) delete ov[key]; else ov[key] = value;
      return { ...f, overrides: { ...f.overrides, [shipId]: ov } };
    });

  const setWeaponOverride = (shipId: string, weaponId: string, key: string, value: number | undefined) =>
    updateFaction((f) => {
      const ov = { ...(f.overrides[shipId] || {}) } as any;
      const wov = { ...((ov.weapons || {})[weaponId] || {}) };
      if (value === undefined) delete wov[key]; else wov[key] = value;
      ov.weapons = { ...(ov.weapons || {}), [weaponId]: wov };
      return { ...f, overrides: { ...f.overrides, [shipId]: ov } };
    });

  const addFaction = () => {
    if (!setFactions) return;
    const base = faction;
    const id = `${sp.id}_faction_${Date.now().toString(36)}`;
    const nf: FleetFactionDef = {
      id, name: base ? `${base.name} Copy` : `New ${sp.name} Faction`, speciesId: sp.id, color: base?.color ?? sp.color,
      overrides: base ? JSON.parse(JSON.stringify(base.overrides)) : {},
    };
    setFactions((prev) => [...prev, nf]);
    setFactionId(id);
  };

  const deleteFaction = () => {
    if (!faction || !setFactions || spFactions.length <= 1) return;
    setFactions((prev) => prev.filter((f) => f.id !== faction.id));
    setFactionId('__base__');
  };

  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 flex flex-col gap-5 shadow-xl">
      <div>
        <div className="text-sm font-mono font-bold text-slate-200">FLEETS — species (form & behavior) + factions (numbers per ship type)</div>
        <div className="text-[11px] text-slate-500 font-mono mt-1">
          Edit the species base values, or pick a faction to override numbers per ship type (amber = overridden; × clears).
          Spawn fleets from the Tactical view. Saved with the presets (git).
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {species.map((s) => (
          <button
            key={s.id}
            onClick={() => { setSpeciesId(s.id); setFactionId('__base__'); }}
            className={`px-3 py-1.5 rounded text-xs font-mono font-semibold border ${s.id === sp.id ? 'bg-slate-200 text-slate-950 border-slate-200' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}
          >
            <span className="inline-block w-2 h-2 rotate-45 mr-1.5" style={{ backgroundColor: s.color }} />
            {s.name}
          </button>
        ))}
      </div>

      <div className="text-[11px] font-mono text-slate-400">{sp.description}</div>

      <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
        <span className="text-slate-400">Editing:</span>
        <select value={faction ? faction.id : '__base__'} onChange={(e) => setFactionId(e.target.value)} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200">
          <option value="__base__">Species base values</option>
          {spFactions.map((f) => <option key={f.id} value={f.id}>Faction: {f.name}</option>)}
        </select>
        {faction && (
          <>
            <input value={faction.name} onChange={(e) => updateFaction((f) => ({ ...f, name: e.target.value }))} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 w-48" />
            <input type="color" value={faction.color} onChange={(e) => updateFaction((f) => ({ ...f, color: e.target.value }))} className="w-8 h-7 bg-transparent" />
          </>
        )}
        <button onClick={addFaction} className="px-2 py-1 rounded border border-slate-700 text-slate-300 hover:bg-slate-800">{faction ? 'Duplicate faction' : 'New faction'}</button>
        {faction && spFactions.length > 1 && (
          <button onClick={deleteFaction} className="px-2 py-1 rounded border border-rose-800 text-rose-300 hover:bg-rose-950">Delete faction</button>
        )}
      </div>

      {isBase && (
        <div className="border border-slate-800 rounded p-3 grid grid-cols-2 md:grid-cols-5 gap-2">
          <NumField label="Aggro radius (m)" value={sp.aggroRadiusM} step={50} onChange={(v) => updateSpecies({ aggroRadiusM: v ?? 1500 })} />
          <NumField label="Formation spacing (m)" value={sp.formationSpacingM} step={5} onChange={(v) => updateSpecies({ formationSpacingM: v ?? 80 })} />
          <NumField label="Scatter time (s)" value={sp.scatterDuration} step={0.5} onChange={(v) => updateSpecies({ scatterDuration: v ?? 0 })} />
          <NumField label="Rout at ships lost (0-1)" value={sp.routLossFraction} step={0.05} onChange={(v) => updateSpecies({ routLossFraction: v ?? 0 })} />
          <NumField label="Aggr. per 1% HP lost" value={sp.aggressionPerDamagePct ?? 0.25} step={0.05} onChange={(v) => updateSpecies({ aggressionPerDamagePct: v })} />
          <NumField label="Start aggression" value={sp.aggressionStart ?? AGGRESSION_DEFAULTS.start} onChange={(v) => updateSpecies({ aggressionStart: v })} />
          <NumField label="Neutral threshold" value={sp.neutralThreshold ?? AGGRESSION_DEFAULTS.neutral} onChange={(v) => updateSpecies({ neutralThreshold: v })} />
          <NumField label="Pursue threshold" value={sp.pursueThreshold ?? AGGRESSION_DEFAULTS.pursue} onChange={(v) => updateSpecies({ pursueThreshold: v })} />
          <label className="flex items-center gap-2 text-[10px] font-mono text-slate-300">
            <input type="checkbox" checked={!!sp.aggressionLocked} onChange={(e) => updateSpecies({ aggressionLocked: e.target.checked })} className="accent-rose-500" />
            Locked aggression
          </label>
          <label className="flex flex-col gap-0.5 text-[10px] font-mono text-slate-400">
            When retreating
            <select value={sp.retreatMode ?? 'leave'} onChange={(e) => updateSpecies({ retreatMode: e.target.value as 'leave' | 'stay' })} className="bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-slate-200">
              <option value="leave">Leave the battle</option>
              <option value="stay">Stay in the area</option>
            </select>
          </label>
        </div>
      )}

      {sp.shipTypes.map((base) => {
        const eff = resolveShipType(sp, faction, base.id)!;
        const ov = (faction?.overrides?.[base.id] || {}) as any;
        return (
          <div key={base.id} className="border border-slate-800 rounded p-3 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-lg">{base.emoji}</span>
              <span className="text-slate-100 font-bold">{base.name}</span>
              <span className="text-slate-500">{base.layer} · {base.movement}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-8 gap-2">
              {SHIP_FIELDS.filter(([k]) => (base as any)[k] !== undefined || ['count', 'hp', 'armor', 'armorClass', 'energyResistance', 'speed', 'radiusM', 'preferredRangeM'].includes(k as string)).map(([k, label, step]) => (
                <NumField
                  key={k as string}
                  label={label}
                  step={step}
                  value={(eff as any)[k]}
                  overridden={!isBase && ov[k] !== undefined}
                  onClear={() => setShipOverride(base.id, k as string, undefined)}
                  disabled={isBase ? !setSpecies : !setFactions}
                  onChange={(v) => (isBase ? updateShipBase(base.id, { [k]: v } as any) : setShipOverride(base.id, k as string, v))}
                />
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <span className="text-[10px] font-mono text-slate-500">Damage taken from Behemoth weapons ×</span>
              {weapons.map((w) => {
                const mul = eff.weaponMultipliers?.[w.id];
                const overridden = !isBase && ov.weaponMultipliers?.[w.id] !== undefined;
                return (
                  <div key={w.id} className="w-28">
                    <NumField
                      label={w.name}
                      step={0.05}
                      value={mul ?? 1}
                      overridden={overridden}
                      onChange={(v) => {
                        const next = { ...(eff.weaponMultipliers || {}), [w.id]: v ?? 1 };
                        if (isBase) updateShipBase(base.id, { weaponMultipliers: next });
                        else updateFaction((f) => ({ ...f, overrides: { ...f.overrides, [base.id]: { ...(f.overrides[base.id] || {}), weaponMultipliers: next } } }));
                      }}
                    />
                  </div>
                );
              })}
            </div>
            {eff.weapons.map((w) => {
              const wov = (ov.weapons || {})[w.id] || {};
              const baseW = base.weapons.find((x) => x.id === w.id)!;
              return (
                <div key={w.id} className="bg-slate-900/50 border border-slate-800 rounded p-2">
                  <div className="text-[11px] font-mono text-slate-200 font-semibold mb-1.5">
                    {w.name} <span className="text-slate-500 font-normal">· {KIND_LABEL[w.kind]} · {w.damageType}{w.target ? ` · hits ${w.target}` : ''}{w.requiresSurface ? ' · surface only' : ''}</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-8 gap-2">
                    {WEAPON_FIELDS.filter(([k]) => (baseW as any)[k] !== undefined).map(([k, label, step]) => (
                      <NumField
                        key={k as string}
                        label={label}
                        step={step}
                        value={(w as any)[k]}
                        overridden={!isBase && wov[k] !== undefined}
                        onClear={() => setWeaponOverride(base.id, w.id, k as string, undefined)}
                        disabled={isBase ? !setSpecies : !setFactions}
                        onChange={(v) => (isBase ? updateWeaponBase(base.id, w.id, { [k]: v } as any) : setWeaponOverride(base.id, w.id, k as string, v))}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
