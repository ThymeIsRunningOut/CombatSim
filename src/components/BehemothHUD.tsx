import React, { useState } from 'react';
import { BehemothState, WeaponSlot, WeaponDef, BuildingDef, BuildingSlot } from '../types/combat';
import { Users, Shield, Zap, AlertTriangle, RefreshCw, X, Plus, ChevronDown, Check, Heart } from 'lucide-react';

interface BehemothHUDProps {
  behemoth: BehemothState;
  weapons: WeaponDef[];
  onSelectSlot?: (slot: WeaponSlot) => void;
  selectedSlotId?: string;
  onAssignWeaponToSlot: (slotId: string, weaponId: string | null) => void;
  onClearAllSlots?: () => void;
  onAutoFillSlots?: (weaponId: string) => void;
  buildings?: BuildingDef[];
  onAssignBuildingToSlot?: (slotId: string, buildingId: string | null) => void;
  onSetCrew?: (crew: number) => void;
  onSetCrewMemberHp?: (hp: number) => void;
  onAssignCrewToBuilding?: (slotId: string, delta: number) => void;
  onLoadCharges?: (slotId?: string) => void;
  onUpdateBuildingSlotHealth?: (slotId: string, health: number) => void;
  onSetAllBuildingsHealth?: (maxHealth: number) => void;
  onUpdateSlotRotationCap?: (slotId: string, cap: number) => void;
  onUpdateAllRotationCaps?: (cap: number) => void;
}

export const BehemothHUD: React.FC<BehemothHUDProps> = ({
  behemoth,
  weapons,
  onSelectSlot,
  selectedSlotId,
  onAssignWeaponToSlot,
  onClearAllSlots,
  onAutoFillSlots,
  buildings = [],
  onAssignBuildingToSlot,
  onSetCrew,
  onSetCrewMemberHp,
  onAssignCrewToBuilding,
  onLoadCharges,
  onUpdateBuildingSlotHealth,
  onSetAllBuildingsHealth,
  onUpdateSlotRotationCap,
  onUpdateAllRotationCaps,
}) => {
  const [activePickerSlotId, setActivePickerSlotId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [globalRotationCap, setGlobalRotationCap] = useState<number>(225);

  const hullPercent = Math.max(0, Math.min(100, (behemoth.hullHp / behemoth.maxHullHp) * 100));
  const tiltAbs = Math.abs(behemoth.tiltAngle);
  const isListingHeavy = tiltAbs > 20;
  const isCapsizing = tiltAbs >= behemoth.maxTiltSafe;

  const portSlots = behemoth.slots.filter((s) => s.row === 'port');
  const starboardSlots = behemoth.slots.filter((s) => s.row === 'starboard');

  const miscA = behemoth.buildingSlots.filter((b) => b.row === 'misc_a');
  const miscB = behemoth.buildingSlots.filter((b) => b.row === 'misc_b');
  const crewPercent = behemoth.maxCrew > 0 ? Math.max(0, Math.min(100, (behemoth.crew / behemoth.maxCrew) * 100)) : 0;

  // 3-Track Crew Allocation: Each crew member can be assigned to 1 Housing, 1 Job, and 1 Service
  const housingAssigned = behemoth.buildingSlots
    .filter((b) => b.building && (b.building.crewRole === 'housing' || b.building.category === 'housing'))
    .reduce((sum, b) => sum + (b.assignedCrew || 0), 0);
  const jobsAssigned = behemoth.buildingSlots
    .filter((b) => b.building && (b.building.crewRole === 'job' || (!b.building.crewRole && b.building.category !== 'housing' && b.building.category !== 'service')))
    .reduce((sum, b) => sum + (b.assignedCrew || 0), 0);
  const serviceAssigned = behemoth.buildingSlots
    .filter((b) => b.building && (b.building.crewRole === 'service' || b.building.category === 'service'))
    .reduce((sum, b) => sum + (b.assignedCrew || 0), 0);

  const unassignedHousing = Math.max(0, behemoth.crew - housingAssigned);
  const unassignedJobs = Math.max(0, behemoth.crew - jobsAssigned);
  const unassignedService = Math.max(0, behemoth.crew - serviceAssigned);

  // Building groupings for organized dropdown selection
  const productionBuildings = buildings.filter((b) => b.category === 'production');
  const energyBuildings = buildings.filter((b) => b.category === 'energy');
  const housingBuildings = buildings.filter((b) => b.category === 'housing');
  const serviceBuildings = buildings.filter((b) => b.category === 'service');
  const otherBuildings = buildings.filter((b) => !b.category || (!['production', 'energy', 'housing', 'service'].includes(b.category)));

  const renderBuildingCard = (slot: BuildingSlot) => {
    const b = slot.building;
    const hpPct = slot.maxHealth > 0 ? (slot.health / slot.maxHealth) * 100 : 0;
    const destroyed = !!b && slot.health <= 0;
    const requiredCrew = b?.requiredCrew ?? (b?.category === 'housing' ? 0 : 1);
    const maxCrew = b?.maxCrew ?? 6;
    const assigned = slot.assignedCrew || 0;
    const isUnmanned = !!b && !destroyed && requiredCrew > 0 && assigned < requiredCrew;
    const role: 'housing' | 'job' | 'service' = b?.crewRole || (b?.category === 'housing' ? 'housing' : b?.category === 'service' ? 'service' : 'job');
    const unassignedInRole = role === 'housing' ? unassignedHousing : role === 'service' ? unassignedService : unassignedJobs;
    const isSelected = selectedSlotId === slot.id;

    const roleBadge = role === 'housing'
      ? { label: 'HOUSING', color: 'bg-sky-500/20 text-sky-300 border-sky-500/30' }
      : role === 'service'
      ? { label: 'SERVICE', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' }
      : { label: 'JOB', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };

    return (
      <div
        key={slot.id}
        onClick={() => {
          if (onSelectSlot) onSelectSlot({ id: slot.id } as any);
        }}
        title={
          b
            ? `[${roleBadge.label}] ${b.name} (${b.subCategory || b.tier || b.category || ''}): ${Math.round(slot.health)}/${slot.maxHealth} HP | Crew: ${assigned}/${maxCrew} (req: ${requiredCrew})${
                destroyed
                  ? ' (DESTROYED)'
                  : slot.isStunned
                  ? ` (STUNNED ${slot.stunTimer.toFixed(1)}s)`
                  : isUnmanned
                  ? ' (UNMANNED - INACTIVE)'
                  : slot.isOffline
                  ? ' (OFFLINE)'
                  : ''
              }`
            : 'Empty building slot'
        }
        className={`px-1.5 py-1 rounded border flex flex-col gap-1 transition-all cursor-pointer relative ${
          isSelected
            ? 'border-cyan-400 bg-cyan-950/60 ring-2 ring-cyan-400/70 shadow-[0_0_15px_rgba(6,182,212,0.4)] scale-[1.01]'
            : b && !destroyed && (slot.isStunned || slot.isOffline)
            ? 'border-amber-500/60 bg-amber-950/20 animate-pulse'
            : isUnmanned
            ? 'border-rose-500/50 bg-rose-950/20'
            : destroyed
            ? 'border-rose-900/60 bg-rose-950/20'
            : b
            ? 'border-slate-800 bg-slate-900/90 hover:border-slate-700'
            : 'border-dashed border-slate-800/80 bg-slate-950/40 hover:border-slate-700'
        }`}
      >
        {/* Slot ID and Badges */}
        <div className="flex items-center justify-between gap-1">
          <span className={`text-[9px] font-mono font-bold ${isSelected ? 'text-cyan-300' : 'text-slate-400'}`}>
            {slot.row === 'misc_a' ? 'A' : 'B'}{slot.slotIndex + 1}
          </span>
          <div className="flex items-center gap-1">
            {b && (
              <span className={`text-[7px] px-1 py-0.2 border rounded font-mono font-bold flex-shrink-0 ${roleBadge.color}`}>
                {roleBadge.label}
              </span>
            )}
            {isUnmanned && (
              <span className="text-[7px] px-1 bg-rose-500/20 text-rose-300 font-bold rounded flex-shrink-0">UNMANNED</span>
            )}
          </div>
        </div>

        {/* Building selector dropdown - full width */}
        <select
          value={b ? b.id : ''}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onAssignBuildingToSlot && onAssignBuildingToSlot(slot.id, e.target.value || null)}
          className={`w-full bg-slate-950/80 border border-slate-800 rounded px-1 py-0.5 text-[9px] font-mono outline-none truncate ${
            destroyed ? 'text-rose-400 line-through' : b ? 'text-slate-200' : 'text-slate-500'
          }`}
        >
          <option value="" className="bg-slate-900 text-slate-400">Empty Slot</option>
          {productionBuildings.length > 0 && (
            <optgroup label="🏭 Production" className="bg-slate-900 text-amber-300 font-bold">
              {productionBuildings.map((bd) => (
                <option key={bd.id} value={bd.id} className="bg-slate-900 text-slate-200 font-normal">
                  {bd.name} ({bd.maxCrew}p)
                </option>
              ))}
            </optgroup>
          )}
          {energyBuildings.length > 0 && (
            <optgroup label="⚡ Energy & Utility" className="bg-slate-900 text-yellow-300 font-bold">
              {energyBuildings.map((bd) => (
                <option key={bd.id} value={bd.id} className="bg-slate-900 text-slate-200 font-normal">
                  {bd.name} ({bd.maxCrew}p)
                </option>
              ))}
            </optgroup>
          )}
          {housingBuildings.length > 0 && (
            <optgroup label="🏠 Housing" className="bg-slate-900 text-sky-300 font-bold">
              {housingBuildings.map((bd) => (
                <option key={bd.id} value={bd.id} className="bg-slate-900 text-slate-200 font-normal">
                  {bd.name} ({bd.maxCrew} cap)
                </option>
              ))}
            </optgroup>
          )}
          {serviceBuildings.length > 0 && (
            <optgroup label="🛎️ Service" className="bg-slate-900 text-emerald-300 font-bold">
              {serviceBuildings.map((bd) => (
                <option key={bd.id} value={bd.id} className="bg-slate-900 text-slate-200 font-normal">
                  {bd.name} ({bd.maxCrew}p)
                </option>
              ))}
            </optgroup>
          )}
          {otherBuildings.length > 0 && (
            <optgroup label="📦 Custom" className="bg-slate-900 text-purple-300 font-bold">
              {otherBuildings.map((bd) => (
                <option key={bd.id} value={bd.id} className="bg-slate-900 text-slate-200 font-normal">
                  {bd.name} ({bd.maxCrew}p)
                </option>
              ))}
            </optgroup>
          )}
        </select>

        <div className="h-0.5 bg-slate-800 rounded-full overflow-hidden">
          {b && <div className="h-full" style={{ width: `${hpPct}%`, backgroundColor: b.color }} />}
        </div>

        {/* Health Display & Quick Assignment */}
        {b && (
          <div className="flex items-center justify-between text-[9px] font-mono text-slate-400">
            <span className="flex items-center gap-0.5">
              <Heart className="w-2.5 h-2.5 text-emerald-400" />
              <span>HP:</span>
            </span>
            {onUpdateBuildingSlotHealth ? (
              <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                <input
                  type="number"
                  min={1}
                  max={2000}
                  value={Math.round(slot.health)}
                  onChange={(e) => onUpdateBuildingSlotHealth(slot.id, Math.max(1, Number(e.target.value) || 1))}
                  className="w-9 bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded px-0.5 py-0 text-emerald-300 font-bold text-right text-[8px] outline-none"
                  title="Assign / edit health for this building slot"
                />
                <span className="text-slate-500 font-bold">/{slot.maxHealth}</span>
              </div>
            ) : (
              <span className="text-emerald-300 font-bold">{Math.round(slot.health)}/{slot.maxHealth}</span>
            )}
          </div>
        )}

        {/* Crew Station Assignment Controls */}
        {b && !destroyed && (
          <div className="flex items-center justify-between text-[9px] font-mono bg-slate-950/60 rounded px-1 py-0.5 border border-slate-800/70">
            <span className="text-slate-400 flex items-center gap-0.5">
              <Users className="w-2.5 h-2.5 text-emerald-400" />
              <span>CREW:</span>
            </span>
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => onAssignCrewToBuilding && onAssignCrewToBuilding(slot.id, -1)}
                disabled={assigned <= 0}
                className="w-4 h-4 flex items-center justify-center rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-200 font-bold"
                title="Remove 1 crew member"
              >
                -
              </button>
              <span className={`font-bold ${isUnmanned ? 'text-rose-400' : 'text-cyan-300'}`}>
                {assigned}/{maxCrew}
              </span>
              <button
                type="button"
                onClick={() => onAssignCrewToBuilding && onAssignCrewToBuilding(slot.id, 1)}
                disabled={unassignedInRole <= 0 || assigned >= maxCrew}
                className="w-4 h-4 flex items-center justify-center rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-200 font-bold"
                title={`Assign 1 crew member (${unassignedInRole} unassigned in ${role.toUpperCase()})`}
              >
                +
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSlotCard = (slot: WeaponSlot, prefix: string, accentColor: string) => {
    const isSelected = selectedSlotId === slot.id;
    const isPickerOpen = activePickerSlotId === slot.id;
    const hasWeapon = slot.weapon !== null;
    const ammoPercent = hasWeapon && slot.weapon!.ammoCapacity > 0
      ? (slot.currentAmmo / slot.weapon!.ammoCapacity) * 100
      : 0;

    return (
      <div
        key={slot.id}
        onClick={() => {
          if (onSelectSlot) onSelectSlot(slot);
        }}
        className={`p-2 rounded-lg border transition-all cursor-pointer relative ${
          isSelected
            ? `${accentColor === 'cyan' ? 'border-cyan-400 bg-cyan-950/40' : 'border-blue-400 bg-blue-950/40'} shadow-lg`
            : slot.isStunned
            ? 'border-amber-500/50 bg-amber-950/20'
            : hasWeapon
            ? 'border-slate-800 bg-slate-900/90 hover:border-slate-700'
            : 'border-dashed border-slate-800/80 bg-slate-950/40 hover:border-slate-700'
        }`}
      >
        {/* Slot Header */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-mono font-bold text-slate-400">
            {prefix}-{slot.slotIndex + 1}
          </span>

          <div className="flex items-center gap-1">
            {slot.isStunned ? (
              <span className="text-[9px] px-1 bg-amber-500/20 text-amber-300 rounded font-mono animate-pulse">STUN</span>
            ) : slot.isCoolingDown ? (
              <span className="text-[9px] px-1 bg-amber-500/20 text-amber-300 rounded font-mono flex items-center gap-0.5">
                CD {slot.cooldownDurationRemaining.toFixed(1)}s
              </span>
            ) : slot.isReloading ? (
              <span className="text-[9px] px-1 bg-cyan-500/20 text-cyan-300 rounded font-mono flex items-center gap-0.5">
                <RefreshCw className="w-2.5 h-2.5 animate-spin" /> RLD
              </span>
            ) : hasWeapon ? (
              <span className={`text-[9px] font-mono ${slot.isFiring ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
                {slot.isFiring ? 'FIRING' : 'READY'}
              </span>
            ) : (
              <span className="text-[9px] font-mono text-slate-600 font-bold">EMPTY</span>
            )}

            {/* Quick Remove Button */}
            {hasWeapon && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAssignWeaponToSlot(slot.id, null);
                }}
                className="p-0.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-all"
                title="Remove weapon from this slot"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Slot Weapon Info / Assign Trigger */}
        <div className="flex items-center justify-between gap-1">
          <div
            onClick={(e) => {
              e.stopPropagation();
              setActivePickerSlotId(isPickerOpen ? null : slot.id);
            }}
            className="flex-1 flex items-center justify-between p-1 rounded bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-colors"
            title="Click to change or equip weapon"
          >
            <div className="text-xs font-semibold truncate text-slate-200 flex items-center gap-1.5">
              {hasWeapon ? (
                <>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: slot.weapon!.color }} />
                  <span className="truncate">{slot.weapon!.name}</span>
                </>
              ) : (
                <span className="text-slate-500 text-[11px] flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Equip Weapon...
                </span>
              )}
            </div>
            <ChevronDown className="w-3 h-3 text-slate-500 flex-shrink-0" />
          </div>
        </div>

        {/* Ammo & Charge Supply Bar */}
        {hasWeapon && (
          <div className="mt-1.5 flex flex-col gap-1">
            <div className="flex justify-between items-center text-[9px] font-mono text-slate-400">
              <span className="truncate">{slot.weapon!.ammoType}</span>
              <span className="text-cyan-300 font-bold">{slot.currentAmmo}/{slot.weapon!.ammoCapacity}</span>
            </div>
            <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${accentColor === 'cyan' ? 'bg-cyan-500' : 'bg-blue-500'}`}
                style={{ width: `${ammoPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[8px] font-mono text-slate-500 pt-0.5">
              <span title={`Total projectile charges consumed by this mount: ${slot.totalChargesUsed ?? 0}`}>
                Used: <span className="text-amber-400/90 font-bold">{slot.totalChargesUsed ?? 0}</span>
              </span>
              {onLoadCharges && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onLoadCharges(slot.id);
                  }}
                  className="px-1 py-0.5 bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-800/60 rounded text-cyan-300 text-[8px] font-bold transition-colors"
                  title={`Load new ${slot.weapon?.packName || 'supply pack'}`}
                >
                  + Pack
                </button>
              )}
            </div>
          </div>
        )}

        {/* Mount Traverse Cap Control */}
        {hasWeapon && onUpdateSlotRotationCap && (
          <div
            className="mt-1 flex items-center justify-between text-[8px] font-mono text-slate-400"
            onClick={(e) => e.stopPropagation()}
          >
            <span title="Traverse rotation cap to avoid inward fire into deck">Traverse:</span>
            <div className="flex items-center gap-1">
              <input
                type="range"
                min="90"
                max="360"
                step="5"
                value={slot.rotationCap ?? slot.weapon?.rotationCap ?? 225}
                onChange={(e) => onUpdateSlotRotationCap(slot.id, Number(e.target.value))}
                className="w-12 h-1 accent-cyan-400 bg-slate-800"
              />
              <span className="text-cyan-300 font-bold w-6 text-right">
                {slot.rotationCap ?? slot.weapon?.rotationCap ?? 225}°
              </span>
            </div>
          </div>
        )}

        {/* Dropdown Weapon Picker Modal/Popup */}
        {isPickerOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute left-0 right-0 bottom-full mb-1 z-50 bg-[#0a1526] border border-cyan-500/60 rounded-xl shadow-2xl p-2 flex flex-col gap-1 max-h-52 overflow-y-auto"
          >
            <div className="text-[10px] font-mono text-cyan-400 font-bold px-1.5 py-0.5 flex items-center justify-between">
              <span>SELECT BUILD WEAPON</span>
              <button
                onClick={() => setActivePickerSlotId(null)}
                className="text-slate-500 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            {/* Unequip Option */}
            <button
              onClick={() => {
                onAssignWeaponToSlot(slot.id, null);
                setActivePickerSlotId(null);
              }}
              className="w-full text-left p-1.5 rounded text-[11px] font-mono text-rose-400 hover:bg-rose-950/40 flex items-center gap-1.5 transition-colors border border-dashed border-rose-900/40"
            >
              <X className="w-3 h-3" />
              <span>Empty Slot (Unequip)</span>
            </button>

            {/* Weapon Options */}
            {weapons.map((w) => {
              const isEquippedHere = slot.weapon?.id === w.id;
              return (
                <button
                  key={w.id}
                  onClick={() => {
                    onAssignWeaponToSlot(slot.id, w.id);
                    setActivePickerSlotId(null);
                  }}
                  className={`w-full text-left p-1.5 rounded text-[11px] font-mono flex items-center justify-between transition-colors ${
                    isEquippedHere
                      ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-700/60 font-bold'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: w.color }} />
                    <span className="truncate">{w.name}</span>
                  </div>
                  <span className="text-[9px] text-slate-500 flex-shrink-0">{w.damageType}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  if (collapsed) {
    return (
      <div className="bg-[#0b1728]/95 border-t border-slate-800 px-4 py-1.5 select-none flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-4 text-slate-300">
          <span>HULL <span className="text-cyan-300">{Math.round(hullPercent)}%</span></span>
          <span>CREW <span className="text-emerald-300">{behemoth.crew}/{behemoth.maxCrew}</span></span>
          <span>LIST <span className="text-slate-200">{behemoth.tiltAngle.toFixed(1)}°</span></span>
        </div>
        <button
          onClick={() => setCollapsed(false)}
          className="px-2 py-0.5 rounded border border-slate-700 text-cyan-300 hover:bg-slate-800"
        >
          Show Deck ▲
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#0b1728]/95 border-t border-slate-800 px-4 py-2 select-none relative">
      <button
        onClick={() => setCollapsed(true)}
        className="absolute right-3 top-1 z-10 px-2 py-0.5 rounded border border-slate-700 text-[10px] font-mono text-slate-400 hover:text-cyan-300 hover:bg-slate-800"
      >
        Hide Deck ▼
      </button>
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-start gap-4">
        
        {/* Vessel Vital Gauges */}
        <div className="w-full lg:w-72 flex-shrink-0 flex flex-col gap-3">
          {/* Hull HP Bar */}
          <div>
            <div className="flex justify-between items-center text-xs font-mono mb-1">
              <span className="flex items-center gap-1.5 text-slate-300 font-semibold">
                <Shield className="w-3.5 h-3.5 text-cyan-400" /> HULL INTEGRITY
              </span>
              <span className={`${hullPercent < 30 ? 'text-rose-400 animate-pulse' : 'text-cyan-300'}`}>
                {Math.round(behemoth.hullHp)} / {behemoth.maxHullHp} ({Math.round(hullPercent)}%)
              </span>
            </div>
            <div className="h-3 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-700/60">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  hullPercent < 25
                    ? 'bg-gradient-to-r from-red-600 to-rose-500'
                    : hullPercent < 55
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                    : 'bg-gradient-to-r from-cyan-600 to-blue-500'
                }`}
                style={{ width: `${hullPercent}%` }}
              />
            </div>
          </div>

          {/* Inclinometer Tilt Gauge */}
          <div className="bg-slate-900/90 rounded-lg p-2.5 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded ${isCapsizing ? 'bg-red-500/20 text-red-400 animate-bounce' : isListingHeavy ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] font-mono text-slate-400">INCLINOMETER / LIST</div>
                <div className="text-xs font-mono font-bold text-slate-200">
                  {behemoth.tiltAngle > 0 ? `STARBOARD +${behemoth.tiltAngle.toFixed(1)}°` : `PORT ${behemoth.tiltAngle.toFixed(1)}°`}
                </div>
              </div>
            </div>

            {/* Graphic Tilt Needle */}
            <div className="relative w-16 h-8 bg-slate-950 rounded border border-slate-800 flex items-center justify-center overflow-hidden">
              <div className="absolute left-1 top-0 bottom-0 w-1 bg-rose-600/60" title="Port 35° threshold" />
              <div className="absolute right-1 top-0 bottom-0 w-1 bg-rose-600/60" title="Starboard 35° threshold" />
              <div
                className="w-12 h-1 bg-cyan-400 rounded transition-transform duration-75 shadow-[0_0_8px_rgba(34,211,238,0.8)]"
                style={{ transform: `rotate(${behemoth.tiltAngle}deg)` }}
              />
            </div>
          </div>

          {/* Crew */}
          <div className="bg-slate-900/80 px-3 py-2 rounded border border-slate-800 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="flex items-center gap-1.5 text-slate-300">
                <Users className="w-3.5 h-3.5 text-emerald-400" /> CREW
              </span>
              <span className="flex items-center gap-1">
                <span className={behemoth.crew <= 0 ? 'text-rose-400 font-bold' : 'text-emerald-300'}>{behemoth.crew}</span>
                <span className="text-slate-500">/</span>
                {onSetCrew ? (
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    value={behemoth.maxCrew}
                    onChange={(e) => onSetCrew(Math.max(0, Math.min(1000, Math.round(Number(e.target.value) || 0))))}
                    title="Starting crew quantity"
                    className="w-14 bg-slate-950 border border-slate-700 rounded px-1 text-emerald-300 text-right outline-none"
                  />
                ) : (
                  <span className="text-slate-300">{behemoth.maxCrew}</span>
                )}
              </span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${crewPercent}%` }} />
            </div>

            {/* Crew Health & Assigned vs Unassigned Subrow */}
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-0.5 border-t border-slate-800/80">
              <div className="flex items-center gap-1" title="Health points per individual crew member">
                <Heart className="w-3 h-3 text-rose-400" />
                <span>HP/CREW:</span>
                {onSetCrewMemberHp ? (
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={behemoth.crewMemberHp || 20}
                    onChange={(e) => onSetCrewMemberHp(Math.max(1, Math.round(Number(e.target.value) || 1)))}
                    className="w-10 bg-slate-950 border border-slate-700 rounded px-1 text-rose-300 text-right font-bold outline-none"
                  />
                ) : (
                  <span className="text-rose-300 font-bold">{behemoth.crewMemberHp || 20}</span>
                )}
              </div>
            </div>

            {/* 3-Track Crew Allocation: 1 Housing, 1 Job, 1 Service per Crew */}
            <div className="pt-1 border-t border-slate-800/80 flex flex-col gap-1 text-[9px] font-mono">
              <div className="flex items-center justify-between text-slate-400">
                <span className="font-semibold text-slate-300">STATION TRACKS (1 Per Crew):</span>
                <span>TOTAL: <span className="text-emerald-300 font-bold">{behemoth.crew}</span></span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <div className="bg-slate-950/80 px-1.5 py-1 rounded border border-slate-800 flex flex-col items-center" title="Housing / Living Quarters Capacity">
                  <span className="text-[8px] text-sky-400 font-bold">HOUSING</span>
                  <span className="text-slate-200 font-bold text-[10px]">{housingAssigned}/{behemoth.crew}</span>
                  <span className="text-[7px] text-slate-500">{unassignedHousing} free</span>
                </div>
                <div className="bg-slate-950/80 px-1.5 py-1 rounded border border-slate-800 flex flex-col items-center" title="Jobs: Production & Energy Personnel">
                  <span className="text-[8px] text-amber-400 font-bold">JOBS</span>
                  <span className="text-slate-200 font-bold text-[10px]">{jobsAssigned}/{behemoth.crew}</span>
                  <span className="text-[7px] text-slate-500">{unassignedJobs} free</span>
                </div>
                <div className="bg-slate-950/80 px-1.5 py-1 rounded border border-slate-800 flex flex-col items-center" title="Services: Healthcare, Training, Dining, Social">
                  <span className="text-[8px] text-emerald-400 font-bold">SERVICES</span>
                  <span className="text-slate-200 font-bold text-[10px]">{serviceAssigned}/{behemoth.crew}</span>
                  <span className="text-[7px] text-slate-500">{unassignedService} free</span>
                </div>
              </div>
            </div>
          </div>

          {/* Power Grid & Accumulator */}
          <div className="flex items-center justify-between text-xs font-mono bg-slate-900/80 px-3 py-1.5 rounded border border-slate-800">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Zap className="w-3.5 h-3.5 text-yellow-400" /> ACCUMULATOR
            </span>
            <span className={behemoth.accumulatorOverloaded ? 'text-red-400 font-bold animate-pulse' : 'text-emerald-400'}>
              {behemoth.accumulatorOverloaded ? 'OVERLOAD TRIP' : `${Math.round(behemoth.accumulatorCharge)}% CHARGE`}
            </span>
          </div>
        </div>

        {/* 2-Row Modular Weapon Deck */}
        <div className="flex-1 w-full bg-slate-950/80 rounded-xl p-3 border border-slate-800 flex flex-col gap-2">
          {/* Deck Toolbar */}
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-1">
            <div className="flex items-center gap-3">
              <span className="text-cyan-400 font-bold">PORT BATTERY (ROW 1)</span>
              <span className="text-slate-600">|</span>
              <span className="text-blue-400 font-bold">STARBOARD BATTERY (ROW 2)</span>
            </div>

            {/* Build Quick Actions */}
            <div className="flex items-center gap-2">
              {onUpdateAllRotationCaps && (
                <div
                  className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-900 rounded border border-slate-700/60 text-[10px] text-slate-300"
                  title="Adjust traverse rotation cap for all deck mounts (limits inward traverse)"
                >
                  <span className="text-slate-400">Traverse Cap:</span>
                  <input
                    type="range"
                    min="90"
                    max="360"
                    step="5"
                    value={globalRotationCap}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setGlobalRotationCap(val);
                      onUpdateAllRotationCaps(val);
                    }}
                    className="w-16 h-1 accent-cyan-400"
                  />
                  <span className="text-cyan-300 font-bold w-7 text-right">{globalRotationCap}°</span>
                </div>
              )}

              {weapons.length > 0 && onAutoFillSlots && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-500">Fill all:</span>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        onAutoFillSlots(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    defaultValue=""
                    className="bg-slate-900 text-[10px] text-cyan-300 font-mono rounded px-1.5 py-0.5 outline-none border border-slate-700"
                  >
                    <option value="" disabled>Equip All Slots...</option>
                    {weapons.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {onLoadCharges && (
                <button
                  type="button"
                  onClick={() => onLoadCharges()}
                  className="px-2 py-0.5 bg-cyan-950/50 hover:bg-cyan-900/60 text-cyan-300 rounded border border-cyan-800/50 text-[10px] font-mono transition-colors flex items-center gap-1"
                  title="Reload supply packs into all equipped weapon slots"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                  Load All Charges
                </button>
              )}

              {onClearAllSlots && (
                <button
                  onClick={onClearAllSlots}
                  className="px-2 py-0.5 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 rounded border border-rose-800/40 text-[10px] font-mono transition-colors"
                  title="Remove weapons from all slots"
                >
                  Clear Deck
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-3 items-start">
            {/* Weapon rows */}
            <div className="flex-1 flex flex-col gap-2 min-w-0">
              <div className="grid grid-cols-4 gap-2">
                {portSlots.map((slot) => renderSlotCard(slot, 'P', 'cyan'))}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {starboardSlots.map((slot) => renderSlotCard(slot, 'S', 'blue'))}
              </div>
            </div>

            {/* Misc buildings: side column (2 rows x 4) with comfortable slot widths */}
            <div className="w-80 sm:w-88 flex-shrink-0 flex flex-col gap-1.5 border-l border-slate-800 pl-3">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-emerald-400 font-bold">MISC BUILDINGS</span>
                {onSetAllBuildingsHealth && (
                  <button
                    type="button"
                    onClick={() => onSetAllBuildingsHealth(100)}
                    className="px-1.5 py-0.5 rounded bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-700/50 text-[9px] font-mono transition-colors"
                    title="Set health of all building slots to default 100 HP"
                  >
                    Set All 100 HP
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {miscA.map((slot) => renderBuildingCard(slot))}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {miscB.map((slot) => renderBuildingCard(slot))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
