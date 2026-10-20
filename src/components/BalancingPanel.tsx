import React, { useState } from 'react';
import { WeaponDef, CreatureDef, BuildingDef, DamageType, TrajectoryType, AmmoType, CrewSimulationConfig } from '../types/combat';
import { Sliders, Plus, X, Edit2, Check, RefreshCw, Save, Shield, Heart, Copy, Users, Swords, Skull, Zap, AlertTriangle } from 'lucide-react';
import { TTKMatrix } from './TTKMatrix';
import { DEFAULT_CREW_CONFIG } from '../data/presets';

interface BalancingPanelProps {
  weapons: WeaponDef[];
  setWeapons: React.Dispatch<React.SetStateAction<WeaponDef[]>>;
  creatures: CreatureDef[];
  setCreatures: React.Dispatch<React.SetStateAction<CreatureDef[]>>;
  buildings?: BuildingDef[];
  setBuildings?: React.Dispatch<React.SetStateAction<BuildingDef[]>>;
  crewConfig?: CrewSimulationConfig;
  setCrewConfig?: React.Dispatch<React.SetStateAction<CrewSimulationConfig>>;
  onResetDefaults: () => void;
  onSavePresetsToStorage?: () => void;
  savedNotification?: string | null;
  onSetAllBuildingsHealth?: (maxHealth: number) => void;
  onCloneCreature?: (creatureId: string) => void;
}

export const BalancingPanel: React.FC<BalancingPanelProps> = ({
  weapons,
  setWeapons,
  creatures,
  setCreatures,
  buildings = [],
  setBuildings,
  crewConfig = DEFAULT_CREW_CONFIG,
  setCrewConfig,
  onResetDefaults,
  onSavePresetsToStorage,
  savedNotification,
  onSetAllBuildingsHealth,
  onCloneCreature,
}) => {
  const [selectedWeaponId, setSelectedWeaponId] = useState<string>(weapons[0]?.id || '');
  const [selectedCreatureId, setSelectedCreatureId] = useState<string>(creatures[0]?.id || '');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>(buildings[0]?.id || '');
  const [tab, setTab] = useState<'weapons' | 'creatures' | 'buildings' | 'crew'>('weapons');

  // Renaming states
  const [isEditingWeaponName, setIsEditingWeaponName] = useState<boolean>(false);
  const [tempWeaponName, setTempWeaponName] = useState<string>('');

  const [isEditingCreatureName, setIsEditingCreatureName] = useState<boolean>(false);
  const [tempCreatureName, setTempCreatureName] = useState<string>('');

  const [isEditingBuildingName, setIsEditingBuildingName] = useState<boolean>(false);
  const [tempBuildingName, setTempBuildingName] = useState<string>('');

  const selectedWeapon = weapons.find((w) => w.id === selectedWeaponId) || weapons[0];
  const selectedCreature = creatures.find((c) => c.id === selectedCreatureId) || creatures[0];
  const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId) || buildings[0];

  const updateWeapon = (key: keyof WeaponDef, value: any) => {
    if (!selectedWeapon) return;
    setWeapons((prev) =>
      prev.map((w) => (w.id === selectedWeapon.id ? { ...w, [key]: value } : w))
    );
  };

  const updateCrewConfig = (key: keyof CrewSimulationConfig, value: number) => {
    if (setCrewConfig) {
      setCrewConfig((prev) => ({
        ...prev,
        [key]: value,
      }));
    }
  };

  const handleAddNewWeapon = () => {
    const id = `weapon_${Date.now()}`;
    const newWeapon: WeaponDef = {
      id,
      name: `Custom Weapon ${weapons.length + 1}`,
      damageType: 'Physical',
      dpp: 120,
      dps: 180,
      fireRate: 1.5,
      fireDuration: 3.0,
      cooldownDuration: 2.0,
      projectileSpeed: 800,
      trajectory: 'Line',
      aoe: 20,
      range: 500,
      coneRadius: 5,
      shootingArc: 240,
      turnSpeed: 90,
      duration: 0.1,
      pushback: 40,
      cooldown: 0.66,
      ammoType: 'Kinetic Shells',
      ammoCapacity: 30,
      ammoPerShot: 1,
      reloadTime: 3.0,
      powerDraw: 100,
      color: '#38bdf8',
    };

    setWeapons((prev) => [...prev, newWeapon]);
    setSelectedWeaponId(id);
  };

  const handleRemoveWeapon = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (weapons.length <= 1) {
      alert("At least one weapon type must remain.");
      return;
    }

    setWeapons((prev) => {
      const filtered = prev.filter((w) => w.id !== id);
      if (selectedWeaponId === id) {
        setSelectedWeaponId(filtered[0]?.id || '');
      }
      return filtered;
    });
  };

  const handleSaveWeaponName = () => {
    if (tempWeaponName.trim()) {
      updateWeapon('name', tempWeaponName.trim());
    }
    setIsEditingWeaponName(false);
  };

  const updateCreature = (key: keyof CreatureDef, value: any) => {
    if (!selectedCreature) return;
    setCreatures((prev) =>
      prev.map((c) => (c.id === selectedCreature.id ? { ...c, [key]: value } : c))
    );
  };

  const handleAddNewCreature = () => {
    const id = `creature_${Date.now()}`;
    const newCreature: CreatureDef = {
      id,
      name: `Custom Creature ${creatures.length + 1}`,
      description: 'Newly discovered aggressive aquatic bio-titan.',
      hp: 2500,
      physicalArmor: 800,
      armorClass: 20,
      energyResistance: 0.25,
      quantity: 1,
      movementSpeed: 150,
      acceleration: 60,
      deceleration: 50,
      turningRate: 60,
      aggroRadius: 450,
      underwaterInterval: 5.0,
      surfaceInterval: 8.0,
      chargeWindup: 2.0,
      strikeDuration: 1.0,
      strikeCooldown: 4.0,
      strikeDamageRate: 350,
      strikeStunChance: 0.25,
      strikeStunDuration: 2.0,
      strikeRamMass: 15.0,
      canShootDeck: false,
      attackTarget: 'hull',
      iconColor: '#06b6d4',
      radius: 28,
    };

    setCreatures((prev) => [...prev, newCreature]);
    setSelectedCreatureId(id);
  };

  const handleRemoveCreature = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (creatures.length <= 1) {
      alert("At least one creature must remain.");
      return;
    }

    setCreatures((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      if (selectedCreatureId === id) {
        setSelectedCreatureId(filtered[0]?.id || '');
      }
      return filtered;
    });
  };

  const handleSaveCreatureName = () => {
    if (tempCreatureName.trim()) {
      updateCreature('name', tempCreatureName.trim());
    }
    setIsEditingCreatureName(false);
  };

  const updateBuilding = (key: keyof BuildingDef, value: any) => {
    if (!selectedBuilding || !setBuildings) return;
    setBuildings((prev) =>
      prev.map((b) => (b.id === selectedBuilding.id ? { ...b, [key]: value } : b))
    );
  };

  const handleAddNewBuilding = () => {
    if (!setBuildings) return;
    const id = `building_${Date.now()}`;
    const newBuilding: BuildingDef = {
      id,
      name: `Custom Module ${(buildings?.length || 0) + 1}`,
      description: 'Shipboard installation module.',
      maxHealth: 100,
      powerBonus: 0,
      powerDraw: 30,
      color: '#38bdf8',
      requiredCrew: 1,
      maxCrew: 6,
    };
    setBuildings((prev) => [...prev, newBuilding]);
    setSelectedBuildingId(id);
  };

  const handleRemoveBuilding = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!setBuildings || (buildings && buildings.length <= 1)) {
      alert("At least one building type must remain.");
      return;
    }
    setBuildings((prev) => {
      const filtered = prev.filter((b) => b.id !== id);
      if (selectedBuildingId === id) {
        setSelectedBuildingId(filtered[0]?.id || '');
      }
      return filtered;
    });
  };

  const handleSaveBuildingName = () => {
    if (tempBuildingName.trim()) {
      updateBuilding('name', tempBuildingName.trim());
    }
    setIsEditingBuildingName(false);
  };

  return (
    <div className="h-full flex flex-col p-4 lg:p-6 overflow-y-auto bg-[#070e1a] max-w-[1750px] mx-auto w-full">
      {/* Header & Tabs */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold font-mono text-slate-100 flex items-center gap-2">
              DESIGNER BALANCING INSPECTOR
              <span className="text-xs px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">REAL-TIME PARAMETERS</span>
            </h2>
            {savedNotification && (
              <span className="text-xs px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono flex items-center gap-1.5 animate-pulse">
                <Check className="w-3.5 h-3.5" /> {savedNotification}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Fine-tune weapon bursts, cooldown intervals, ammo logistics, creature resilience, building durability, and persist custom presets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Preset Save button */}
          {onSavePresetsToStorage && (
            <button
              onClick={onSavePresetsToStorage}
              className="px-3 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/50 text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-md"
              title="Save current weapons & balance configuration to browser storage"
            >
              <Save className="w-4 h-4" />
              <span>SAVE PRESET</span>
            </button>
          )}

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-1 flex items-center">
            <button
              onClick={() => setTab('weapons')}
              className={`px-3 py-1.5 rounded text-xs font-mono font-semibold transition-all ${
                tab === 'weapons' ? 'bg-cyan-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              WEAPONS & SYSTEMS
            </button>
            <button
              onClick={() => setTab('creatures')}
              className={`px-3 py-1.5 rounded text-xs font-mono font-semibold transition-all ${
                tab === 'creatures' ? 'bg-cyan-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              CREATURES & THREATS
            </button>
            <button
              onClick={() => setTab('buildings')}
              className={`px-3 py-1.5 rounded text-xs font-mono font-semibold transition-all ${
                tab === 'buildings' ? 'bg-cyan-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              BUILDINGS & STATIONS
            </button>
            <button
              onClick={() => setTab('crew')}
              className={`px-3 py-1.5 rounded text-xs font-mono font-semibold transition-all ${
                tab === 'crew' ? 'bg-cyan-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              CREW & DECK DEFENSE
            </button>
          </div>

          <button
            onClick={onResetDefaults}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            title="Reset All Parameters to Default Presets"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2-Column Split: Parameter Sliders on Left (7 cols), TTK Matrix Side Panel on Right (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Tuner Controls */}
        <div className="lg:col-span-7 space-y-4 min-w-0">
          {tab === 'weapons' ? (
            /* WEAPONS TUNER */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Weapon Selector List */}
          <div className="lg:col-span-1 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
              <span>SELECT WEAPON SYSTEM</span>
              <button
                onClick={handleAddNewWeapon}
                className="flex items-center gap-1 px-2 py-0.5 bg-cyan-600/30 hover:bg-cyan-500 text-cyan-300 hover:text-slate-950 border border-cyan-500/40 rounded transition-all font-bold"
                title="Add new weapon type"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>NEW</span>
              </button>
            </div>

            {weapons.map((w) => (
              <div
                key={w.id}
                onClick={() => {
                  setSelectedWeaponId(w.id);
                  setIsEditingWeaponName(false);
                }}
                className={`p-3 rounded-lg border text-left font-mono transition-all flex items-center justify-between cursor-pointer group ${
                  w.id === selectedWeapon?.id
                    ? 'border-cyan-400 bg-cyan-950/30 text-white shadow-md'
                    : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex-1 mr-2 min-w-0">
                  <div className="text-xs font-bold truncate">{w.name}</div>
                  <div className="text-[10px] text-slate-400">
                    {w.damageType} | {w.fireDuration || 3}s Fire • {w.cooldownDuration || 2}s CD
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: w.color }} />
                  {weapons.length > 1 && (
                    <button
                      onClick={(e) => handleRemoveWeapon(e, w.id)}
                      className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 opacity-40 group-hover:opacity-100 transition-all"
                      title="Remove weapon type"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Weapon Sliders & Parameters */}
          {selectedWeapon ? (
            <div className="lg:col-span-2 bg-slate-950/80 border border-slate-800 rounded-xl p-5 flex flex-col gap-5 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-4">
                <div className="flex-1">
                  {isEditingWeaponName ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={tempWeaponName}
                        onChange={(e) => setTempWeaponName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveWeaponName();
                          if (e.key === 'Escape') setIsEditingWeaponName(false);
                        }}
                        autoFocus
                        className="bg-slate-900 border border-cyan-500 rounded px-2.5 py-1 text-base font-bold font-mono text-cyan-300 outline-none w-64"
                      />
                      <button
                        onClick={handleSaveWeaponName}
                        className="p-1.5 bg-cyan-500 text-slate-950 rounded hover:bg-cyan-400 transition-all"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setIsEditingWeaponName(false)}
                        className="p-1.5 bg-slate-800 text-slate-400 rounded hover:text-white transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold font-mono text-slate-100">{selectedWeapon.name}</h3>
                      <button
                        onClick={() => {
                          setTempWeaponName(selectedWeapon.name);
                          setIsEditingWeaponName(true);
                        }}
                        className="p-1 text-slate-500 hover:text-cyan-400 transition-colors"
                        title="Rename weapon"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-1.5 font-mono text-xs">
                    {/* Damage Type Dropdown */}
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <span>Type:</span>
                      <select
                        value={selectedWeapon.damageType}
                        onChange={(e) => updateWeapon('damageType', e.target.value as DamageType)}
                        className="bg-slate-900 text-cyan-400 border border-slate-700 rounded px-1.5 py-0.5 outline-none font-bold"
                      >
                        <option value="Physical">Physical (Projectile)</option>
                        <option value="Energy">Energy (Beam)</option>
                        <option value="Chemical">Chemical (Cloud/AOE)</option>
                      </select>
                    </div>

                    {/* Trajectory Dropdown */}
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <span>Trajectory:</span>
                      <select
                        value={selectedWeapon.trajectory}
                        onChange={(e) => updateWeapon('trajectory', e.target.value as TrajectoryType)}
                        className="bg-slate-900 text-cyan-400 border border-slate-700 rounded px-1.5 py-0.5 outline-none font-bold"
                      >
                        <option value="Line">Line</option>
                        <option value="Arch">Arch (Mortar)</option>
                      </select>
                    </div>

                    {/* Ammo Type Dropdown */}
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <span>Ammo:</span>
                      <select
                        value={selectedWeapon.ammoType}
                        onChange={(e) => updateWeapon('ammoType', e.target.value as AmmoType)}
                        className="bg-slate-900 text-cyan-400 border border-slate-700 rounded px-1.5 py-0.5 outline-none font-bold"
                      >
                        <option value="Kinetic Shells">Kinetic Shells</option>
                        <option value="Energy Cells">Energy Cells</option>
                        <option value="Biochem Fuel">Biochem Fuel</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="text-right font-mono text-xs text-slate-400 flex flex-col items-end">
                  <div>
                    Nominal DPS: <span className="text-cyan-400 font-bold text-sm">{(selectedWeapon.dpp * selectedWeapon.fireRate).toFixed(1)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span>Tracer Color:</span>
                    <input
                      type="color"
                      value={selectedWeapon.color}
                      onChange={(e) => updateWeapon('color', e.target.value)}
                      className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Fire Duration */}
                <div className="p-3 bg-cyan-950/20 border border-cyan-800/40 rounded-lg">
                  <div className="flex justify-between text-xs font-mono mb-2">
                    <span className="text-cyan-200 font-semibold">Fire Duration (Active Firing Time)</span>
                    <span className="text-cyan-400 font-bold">{selectedWeapon.fireDuration || 3.0}s</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="15.0"
                    step="0.1"
                    value={selectedWeapon.fireDuration || 3.0}
                    onChange={(e) => updateWeapon('fireDuration', Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                  <div className="text-[10px] text-slate-400 mt-1 font-mono">
                    Weapon fires continuously for this duration before triggering cool down.
                  </div>
                </div>

                {/* Cool Down Duration */}
                <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-lg">
                  <div className="flex justify-between text-xs font-mono mb-2">
                    <span className="text-amber-200 font-semibold">Cool Down Duration (Rest Interval)</span>
                    <span className="text-amber-400 font-bold">{selectedWeapon.cooldownDuration || 2.0}s</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="15.0"
                    step="0.1"
                    value={selectedWeapon.cooldownDuration || 2.0}
                    onChange={(e) => updateWeapon('cooldownDuration', Number(e.target.value))}
                    className="w-full accent-amber-400"
                  />
                  <div className="text-[10px] text-slate-400 mt-1 font-mono">
                    How many seconds weapon must vent heat/cool down before firing again.
                  </div>
                </div>

                {/* Damage Per Projectile (DPP) */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-2">
                    <span className="text-slate-300">Damage Per Projectile (DPP)</span>
                    <span className="text-cyan-400 font-bold">{selectedWeapon.dpp}</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="1200"
                    step="5"
                    value={selectedWeapon.dpp}
                    onChange={(e) => updateWeapon('dpp', Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </div>

                {/* Fire Rate */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-2">
                    <span className="text-slate-300">Fire Rate (shots/sec during burst)</span>
                    <span className="text-cyan-400 font-bold">{selectedWeapon.fireRate}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="25"
                    step="0.1"
                    value={selectedWeapon.fireRate}
                    onChange={(e) => updateWeapon('fireRate', Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </div>

                {/* Range (F) */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-2">
                    <span className="text-slate-300">Target Range (F) [px]</span>
                    <span className="text-cyan-400 font-bold">{selectedWeapon.range}</span>
                  </div>
                  <input
                    type="range"
                    min="150"
                    max="900"
                    step="10"
                    value={selectedWeapon.range}
                    onChange={(e) => updateWeapon('range', Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </div>

                {/* Projectile Speed */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-2">
                    <span className="text-slate-300">Projectile Speed (PS)</span>
                    <span className="text-cyan-400 font-bold">{selectedWeapon.projectileSpeed}</span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="2000"
                    step="50"
                    value={selectedWeapon.projectileSpeed}
                    onChange={(e) => updateWeapon('projectileSpeed', Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </div>

                {/* Area of Effect (AOE) */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-2">
                    <span className="text-slate-300">Area of Effect (AOE) [px]</span>
                    <span className="text-cyan-400 font-bold">{selectedWeapon.aoe}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="180"
                    step="5"
                    value={selectedWeapon.aoe}
                    onChange={(e) => updateWeapon('aoe', Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </div>

                {/* Pushback (P) */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-2">
                    <span className="text-slate-300">Pushback Impulse (P)</span>
                    <span className="text-cyan-400 font-bold">{selectedWeapon.pushback}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="350"
                    step="10"
                    value={selectedWeapon.pushback}
                    onChange={(e) => updateWeapon('pushback', Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </div>

                {/* Ammo Capacity */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-2">
                    <span className="text-slate-300">Ammo Magazine Capacity</span>
                    <span className="text-cyan-400 font-bold">{selectedWeapon.ammoCapacity}</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="400"
                    step="2"
                    value={selectedWeapon.ammoCapacity}
                    onChange={(e) => updateWeapon('ammoCapacity', Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </div>

                {/* Reload Time */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-2">
                    <span className="text-slate-300">Reload Duration (sec)</span>
                    <span className="text-cyan-400 font-bold">{selectedWeapon.reloadTime}s</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="10"
                    step="0.1"
                    value={selectedWeapon.reloadTime}
                    onChange={(e) => updateWeapon('reloadTime', Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </div>

                {/* Power Draw */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-2">
                    <span className="text-slate-300">Power Draw (kW)</span>
                    <span className="text-cyan-400 font-bold">{selectedWeapon.powerDraw} kW</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="400"
                    step="5"
                    value={selectedWeapon.powerDraw}
                    onChange={(e) => updateWeapon('powerDraw', Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </div>

                {/* Turn Speed */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-2">
                    <span className="text-slate-300">Turn Speed [deg/s]</span>
                    <span className="text-cyan-400 font-bold">{selectedWeapon.turnSpeed ?? 120}°/s</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="360"
                    step="5"
                    value={selectedWeapon.turnSpeed ?? 120}
                    onChange={(e) => updateWeapon('turnSpeed', Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                  <div className="text-[10px] text-slate-500 mt-1">
                    Fast creatures out-turn slow weapons and cause misses (a creature at speed 300 needs about 57°/s).
                  </div>
                </div>

                {/* Shooting Arc (SA) */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-2">
                    <span className="text-slate-300">Shooting Arc (SA) [deg]</span>
                    <span className="text-cyan-400 font-bold">{selectedWeapon.shootingArc}°</span>
                  </div>
                  <input
                    type="range"
                    min="60"
                    max="360"
                    step="10"
                    value={selectedWeapon.shootingArc}
                    onChange={(e) => updateWeapon('shootingArc', Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </div>

                {/* Traverse Rotation Cap */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-2">
                    <span className="text-slate-300">Traverse Rotation Cap [deg]</span>
                    <span className="text-cyan-400 font-bold">{selectedWeapon.rotationCap ?? 225}°</span>
                  </div>
                  <input
                    type="range"
                    min="90"
                    max="360"
                    step="5"
                    value={selectedWeapon.rotationCap ?? 225}
                    onChange={(e) => updateWeapon('rotationCap', Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                  <div className="text-[10px] text-slate-500 mt-1">
                    Maximum traverse arc (default 225°). Prevents turret from rotating inward into the ship deck.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-2 p-8 text-center text-slate-500 font-mono">
              No weapon selected. Click + NEW to create one.
            </div>
          )}
        </div>
      ) : (
        /* CREATURES TUNER */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Creature Selector */}
          <div className="lg:col-span-1 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
              <span>SELECT CREATURE THREAT</span>
              <button
                onClick={handleAddNewCreature}
                className="flex items-center gap-1 px-2 py-0.5 bg-rose-600/30 hover:bg-rose-500 text-rose-300 hover:text-slate-950 border border-rose-500/40 rounded transition-all font-bold"
                title="Add new creature threat"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>NEW</span>
              </button>
            </div>

            {creatures.map((c) => (
              <div
                key={c.id}
                onClick={() => {
                  setSelectedCreatureId(c.id);
                  setIsEditingCreatureName(false);
                }}
                className={`p-3 rounded-lg border text-left font-mono transition-all flex items-center justify-between cursor-pointer group ${
                  c.id === selectedCreature?.id
                    ? 'border-cyan-400 bg-cyan-950/30 text-white shadow-md'
                    : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex-1 mr-2 min-w-0">
                  <div className="text-xs font-bold truncate">{c.name}</div>
                  <div className="text-[10px] text-slate-400">
                    {c.quantity > 1 ? `Swarm (${c.quantity}x)` : `${c.hp} HP | AC ${c.armorClass}`}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.iconColor }} />
                  {onCloneCreature && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloneCreature(c.id);
                      }}
                      className="p-1 rounded text-slate-500 hover:text-cyan-300 hover:bg-cyan-950/40 opacity-40 group-hover:opacity-100 transition-all"
                      title="Clone this threat and behavior tree"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {creatures.length > 1 && (
                    <button
                      onClick={(e) => handleRemoveCreature(e, c.id)}
                      className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 opacity-40 group-hover:opacity-100 transition-all"
                      title="Remove creature"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Creature Sliders & State Timing Parameters */}
          {selectedCreature ? (
            <div className="lg:col-span-2 bg-slate-950/80 border border-slate-800 rounded-xl p-5 flex flex-col gap-5 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-4">
                <div className="flex-1">
                  {isEditingCreatureName ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={tempCreatureName}
                        onChange={(e) => setTempCreatureName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveCreatureName();
                          if (e.key === 'Escape') setIsEditingCreatureName(false);
                        }}
                        autoFocus
                        className="bg-slate-900 border border-cyan-500 rounded px-2.5 py-1 text-base font-bold font-mono text-cyan-300 outline-none w-64"
                      />
                      <button
                        onClick={handleSaveCreatureName}
                        className="p-1.5 bg-cyan-500 text-slate-950 rounded hover:bg-cyan-400 transition-all"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setIsEditingCreatureName(false)}
                        className="p-1.5 bg-slate-800 text-slate-400 rounded hover:text-white transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold font-mono text-slate-100">{selectedCreature.name}</h3>
                      <button
                        onClick={() => {
                          setTempCreatureName(selectedCreature.name);
                          setIsEditingCreatureName(true);
                        }}
                        className="p-1 text-slate-500 hover:text-cyan-400 transition-colors"
                        title="Rename creature"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <p className="text-xs text-slate-400 mt-1">{selectedCreature.description}</p>
                </div>

                <div className="flex items-center gap-3">
                  {onCloneCreature && (
                    <button
                      type="button"
                      onClick={() => onCloneCreature(selectedCreature.id)}
                      className="px-2.5 py-1.5 rounded bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-700/60 text-cyan-300 text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-sm"
                      title="Duplicate this creature threat and its complete AI behavior tree"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>CLONE THREAT</span>
                    </button>
                  )}
                  <div className="text-right font-mono text-xs flex flex-col items-end">
                    <div>
                      Total Resilience: <span className="text-rose-400 font-bold text-sm">{(selectedCreature.hp + selectedCreature.physicalArmor) * selectedCreature.quantity} HP</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-slate-400">Threat Color:</span>
                      <input
                        type="color"
                        value={selectedCreature.iconColor}
                        onChange={(e) => updateCreature('iconColor', e.target.value)}
                        className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Base Health (HP) */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-2 items-center">
                    <span className="text-slate-300">Base Health (HP)</span>
                    <input
                      type="number"
                      min="5"
                      max="10000"
                      value={selectedCreature.hp}
                      onChange={(e) => updateCreature('hp', Math.max(5, Number(e.target.value)))}
                      className="w-20 bg-slate-900 border border-slate-700 focus:border-rose-500 rounded px-1.5 py-0.5 text-rose-400 font-bold text-right outline-none text-xs"
                    />
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="10000"
                    step="5"
                    value={selectedCreature.hp}
                    onChange={(e) => updateCreature('hp', Number(e.target.value))}
                    className="w-full accent-rose-500"
                  />
                </div>

                {/* Physical Armor HP Pool */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-2">
                    <span className="text-slate-300">Physical Armor Pool</span>
                    <span className="text-cyan-400 font-bold">{selectedCreature.physicalArmor}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="3500"
                    step="50"
                    value={selectedCreature.physicalArmor}
                    onChange={(e) => updateCreature('physicalArmor', Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </div>

                {/* Armor Class (Flat Damage Absorption) */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-2">
                    <span className="text-slate-300">Armor Class (Absorption / shot)</span>
                    <span className="text-amber-400 font-bold">{selectedCreature.armorClass}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="80"
                    step="1"
                    value={selectedCreature.armorClass}
                    onChange={(e) => updateCreature('armorClass', Number(e.target.value))}
                    className="w-full accent-amber-400"
                  />
                </div>

                {/* Energy Resistance */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-2">
                    <span className="text-slate-300">Energy Resistance (% reduction)</span>
                    <span className="text-purple-400 font-bold">{Math.round(selectedCreature.energyResistance * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1.0"
                    step="0.01"
                    value={selectedCreature.energyResistance}
                    onChange={(e) => updateCreature('energyResistance', Number(e.target.value))}
                    className="w-full accent-purple-500"
                  />
                </div>

                {/* Movement Speed */}
                <div>
                  <div className="flex justify-between items-center text-xs font-mono mb-2">
                    <span className="text-slate-300">Movement Speed (Knots)</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="20"
                        max="1200"
                        step="10"
                        value={selectedCreature.movementSpeed}
                        onChange={(e) => updateCreature('movementSpeed', Math.max(1, Number(e.target.value)))}
                        className="w-20 px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-cyan-400 font-bold text-right outline-none focus:border-cyan-500"
                      />
                      <span className="text-cyan-400 font-bold">kts</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="800"
                    step="10"
                    value={Math.min(800, selectedCreature.movementSpeed)}
                    onChange={(e) => updateCreature('movementSpeed', Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </div>

                {/* Aggro Radius */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-2">
                    <span className="text-slate-300">Aggro Radius (px)</span>
                    <span className="text-rose-400 font-bold">{selectedCreature.aggroRadius}</span>
                  </div>
                  <input
                    type="range"
                    min="200"
                    max="800"
                    step="20"
                    value={selectedCreature.aggroRadius}
                    onChange={(e) => updateCreature('aggroRadius', Number(e.target.value))}
                    className="w-full accent-rose-400"
                  />
                </div>

                {/* Swarm Quantity */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-2 items-center">
                    <span className="text-slate-300">Entity Quantity (1 = Solo, &gt;1 = Swarm)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={selectedCreature.quantity}
                        onChange={(e) => updateCreature('quantity', Math.max(1, Math.min(100, Number(e.target.value))))}
                        className="w-16 bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded px-1.5 py-0.5 text-cyan-400 font-bold text-right outline-none text-xs"
                      />
                      <span className="text-cyan-400 font-bold text-xs">x</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    step="1"
                    value={selectedCreature.quantity}
                    onChange={(e) => updateCreature('quantity', Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </div>

                {/* Underwater Interval */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-2">
                    <span className="text-slate-300">Underwater Submerge Duration (sec)</span>
                    <span className="text-blue-400 font-bold">{selectedCreature.underwaterInterval}s</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="15"
                    step="0.5"
                    value={selectedCreature.underwaterInterval}
                    onChange={(e) => updateCreature('underwaterInterval', Number(e.target.value))}
                    className="w-full accent-blue-400"
                  />
                </div>

                {/* Surface Interval */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-2">
                    <span className="text-slate-300">Surface Attack Window (sec)</span>
                    <span className="text-blue-400 font-bold">{selectedCreature.surfaceInterval}s</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="20"
                    step="0.5"
                    value={selectedCreature.surfaceInterval}
                    onChange={(e) => updateCreature('surfaceInterval', Number(e.target.value))}
                    className="w-full accent-blue-400"
                  />
                </div>

                {/* Strike Damage Rate & Ramming Mass */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-2">
                    <span className="text-slate-300">Strike Damage / Ram Rate</span>
                    <span className="text-red-400 font-bold">{selectedCreature.strikeDamageRate}</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="1000"
                    step="20"
                    value={selectedCreature.strikeDamageRate}
                    onChange={(e) => updateCreature('strikeDamageRate', Number(e.target.value))}
                    className="w-full accent-red-500"
                  />
                </div>

                {/* Attack Target */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-2">
                    <span className="text-slate-300">Attack Target</span>
                    <span className="text-rose-400 font-bold uppercase">{selectedCreature.attackTarget || 'hull'}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {(['buildings', 'hull', 'crew'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => updateCreature('attackTarget', t)}
                        className={`py-1 rounded text-xs font-mono capitalize border transition-colors ${
                          (selectedCreature.attackTarget || 'hull') === t
                            ? 'bg-rose-500/20 border-rose-500 text-rose-300 font-bold'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pursue Behavior Profile */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-2">
                    <span className="text-slate-300">Pursue Behavior</span>
                    <span className="text-cyan-400 font-bold">
                      {selectedCreature.pursueStyle === 'orbit_drain' ? 'Orbit + Drain' : 'Standard Charge'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {([['default', 'Standard Charge'], ['orbit_drain', 'Orbit + Drain']] as const).map(([v, label]) => (
                      <button
                        key={v}
                        onClick={() => updateCreature('pursueStyle', v)}
                        className={`py-1 rounded text-xs font-mono border transition-colors ${
                          (selectedCreature.pursueStyle || 'default') === v
                            ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {selectedCreature.pursueStyle === 'orbit_drain' && (
                    <div className="mt-3 grid grid-cols-2 gap-2 p-2 rounded border border-slate-800 bg-slate-950/60">
                      {([
                        ['chargeStageDuration', 'Stage Duration (s)', 18, 1],
                        ['surfaceDuration', 'Surface Duration (s)', 3, 0.5],
                        ['depthsDuration', 'Depths Duration (s)', 3, 0.5],
                        ['attackDuration', 'Attack Duration (s)', 10, 1],
                        ['drainTargetCount', 'Buildings Drained', 4, 1],
                        ['drainRatePct', 'Drain (% HP / s)', 4, 0.5],
                        ['drainStunChance', 'Stun Chance / s (0-1)', 0.1, 0.01],
                        ['drainStunDuration', 'Stun Duration (s)', 10, 1],
                        ['energyWeightDivisor', 'Energy Weight Divisor', 4, 1],
                      ] as const).map(([key, label, def, step]) => (
                        <label key={key} className="text-[10px] font-mono text-slate-400 flex flex-col gap-1">
                          {label}
                          <input
                            type="number"
                            min={0}
                            step={step}
                            value={(selectedCreature as any)[key] ?? def}
                            onChange={(e) => updateCreature(key as keyof CreatureDef, Math.max(0, Number(e.target.value)))}
                            className="bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-cyan-300 text-xs outline-none"
                          />
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Locomotion & Layering: Flying vs Non-Flying */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-2">
                    <span className="text-slate-300">Locomotion & Layering</span>
                    <span className={`font-bold ${selectedCreature.isFlying ? 'text-amber-400' : 'text-sky-400'}`}>
                      {selectedCreature.isFlying ? '🦅 FLYING (Over Boat)' : '🌊 NON-FLYING (Under Water)'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        updateCreature('isFlying', false);
                        updateCreature('locomotionType', 'non-flying');
                      }}
                      className={`py-1.5 px-2 rounded text-xs font-mono border flex items-center justify-center gap-1 transition-all ${
                        !selectedCreature.isFlying
                          ? 'bg-sky-500/20 border-sky-400 text-sky-200 font-bold'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>🌊 Non-Flying</span>
                      <span className="text-[10px] text-slate-400">(Under water)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        updateCreature('isFlying', true);
                        updateCreature('locomotionType', 'flying');
                      }}
                      className={`py-1.5 px-2 rounded text-xs font-mono border flex items-center justify-center gap-1 transition-all ${
                        selectedCreature.isFlying
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-bold'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>🦅 Flying</span>
                      <span className="text-[10px] text-slate-400">(Over boat)</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Flying renders over deck & turrets; non-flying renders beneath hull under water. Mechanically identical.
                  </p>
                </div>

                {/* Strike Ramming Mass */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-2">
                    <span className="text-slate-300">Ramming Impulse Mass (Tilt factor)</span>
                    <span className="text-amber-400 font-bold">{selectedCreature.strikeRamMass}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="45"
                    step="1"
                    value={selectedCreature.strikeRamMass}
                    onChange={(e) => updateCreature('strikeRamMass', Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-2 p-8 text-center text-slate-500 font-mono">
              No creature selected. Click + NEW to create one.
            </div>
          )}
        </div>
      )}

      {/* BUILDINGS & STATIONS TUNER */}
      {tab === 'buildings' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Building Selector List */}
          <div className="lg:col-span-1 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
              <span>SELECT BUILDING / MODULE</span>
              <button
                onClick={handleAddNewBuilding}
                className="flex items-center gap-1 px-2 py-0.5 bg-emerald-600/30 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/40 rounded transition-all font-bold"
                title="Add new building type"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>NEW</span>
              </button>
            </div>

            {buildings.map((b) => (
              <div
                key={b.id}
                onClick={() => {
                  setSelectedBuildingId(b.id);
                  setIsEditingBuildingName(false);
                }}
                className={`p-3 rounded-lg border text-left font-mono transition-all flex items-center justify-between cursor-pointer group ${
                  b.id === selectedBuilding?.id
                    ? 'border-emerald-400 bg-emerald-950/30 text-white shadow-md'
                    : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex-1 mr-2 min-w-0">
                  <div className="text-xs font-bold truncate">{b.name}</div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-2">
                    <span className="text-emerald-400 font-semibold">{b.maxHealth} HP</span>
                    <span>•</span>
                    <span>{b.powerBonus > 0 ? `+${b.powerBonus}kW` : `-${b.powerDraw}kW`}</span>
                    <span>•</span>
                    <span>Crew {b.requiredCrew ?? 1}-{b.maxCrew ?? 6}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                  {buildings.length > 1 && (
                    <button
                      onClick={(e) => handleRemoveBuilding(e, b.id)}
                      className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 opacity-40 group-hover:opacity-100 transition-all"
                      title="Remove building type"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Quick Bulk Action: Set All 100 HP */}
            <div className="pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  if (onSetAllBuildingsHealth) {
                    onSetAllBuildingsHealth(100);
                  }
                  if (setBuildings) {
                    setBuildings((prev) => prev.map((b) => ({ ...b, maxHealth: 100 })));
                  }
                }}
                className="w-full py-1.5 px-2 rounded bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-600/40 text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all"
                title="Reset all buildings to 100 HP default"
              >
                <Heart className="w-3.5 h-3.5 text-emerald-400" />
                <span>SET ALL BUILDINGS TO 100 HP</span>
              </button>
            </div>
          </div>

          {/* Building Sliders & Parameters */}
          {selectedBuilding ? (
            <div className="lg:col-span-2 bg-slate-950/80 border border-slate-800 rounded-xl p-5 flex flex-col gap-5 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-4">
                <div className="flex-1">
                  {isEditingBuildingName ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={tempBuildingName}
                        onChange={(e) => setTempBuildingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveBuildingName();
                          if (e.key === 'Escape') setIsEditingBuildingName(false);
                        }}
                        autoFocus
                        className="bg-slate-900 border border-emerald-500 text-white px-2 py-1 rounded text-sm font-mono outline-none w-full max-w-sm"
                      />
                      <button
                        onClick={handleSaveBuildingName}
                        className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 rounded"
                        title="Save name"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setIsEditingBuildingName(false)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: selectedBuilding.color }} />
                      <h3 className="text-lg font-bold font-mono text-white">{selectedBuilding.name}</h3>
                      <button
                        onClick={() => {
                          setTempBuildingName(selectedBuilding.name);
                          setIsEditingBuildingName(true);
                        }}
                        className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition-colors"
                        title="Rename building"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-slate-400 mt-1">{selectedBuilding.description}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateBuilding('maxHealth', 100)}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 text-xs font-mono flex items-center gap-1 transition-all"
                    title="Reset this building to 100 HP default"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Default 100 HP</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Max Health (HP) */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-2 items-center">
                    <span className="text-slate-300 flex items-center gap-1.5">
                      <Heart className="w-3.5 h-3.5 text-emerald-400" />
                      Building Health (HP)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="10"
                        max="2000"
                        step="10"
                        value={selectedBuilding.maxHealth}
                        onChange={(e) => updateBuilding('maxHealth', Math.max(1, Number(e.target.value)))}
                        className="w-20 bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded px-1.5 py-0.5 text-emerald-400 font-bold text-right outline-none text-xs"
                      />
                      <span className="text-emerald-400 font-bold text-xs">HP</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="1000"
                    step="10"
                    value={Math.min(1000, selectedBuilding.maxHealth)}
                    onChange={(e) => updateBuilding('maxHealth', Number(e.target.value))}
                    className="w-full accent-emerald-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                    <span>Default: 100 HP</span>
                    <span>Range: 10 - 2,000 HP</span>
                  </div>
                </div>

                {/* Power Bonus (kW) */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-2 items-center">
                    <span className="text-slate-300">Power Capacity Bonus (+kW)</span>
                    <span className="text-yellow-400 font-bold">+{selectedBuilding.powerBonus} kW</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="600"
                    step="25"
                    value={selectedBuilding.powerBonus}
                    onChange={(e) => updateBuilding('powerBonus', Number(e.target.value))}
                    className="w-full accent-yellow-400"
                  />
                </div>

                {/* Power Draw (kW) */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-2 items-center">
                    <span className="text-slate-300">Power Draw (-kW)</span>
                    <span className="text-amber-400 font-bold">-{selectedBuilding.powerDraw} kW</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    step="10"
                    value={selectedBuilding.powerDraw}
                    onChange={(e) => updateBuilding('powerDraw', Number(e.target.value))}
                    className="w-full accent-amber-400"
                  />
                </div>

                {/* Required Crew */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-2 items-center">
                    <span className="text-slate-300">Required Crew to Operate</span>
                    <span className="text-cyan-400 font-bold">{selectedBuilding.requiredCrew ?? 1} crew</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="6"
                    step="1"
                    value={selectedBuilding.requiredCrew ?? 1}
                    onChange={(e) => updateBuilding('requiredCrew', Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </div>

                {/* Max Crew Capacity */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-2 items-center">
                    <span className="text-slate-300">Max Station Crew Capacity</span>
                    <span className="text-cyan-400 font-bold">{selectedBuilding.maxCrew ?? 6} crew</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="25"
                    step="1"
                    value={selectedBuilding.maxCrew ?? 6}
                    onChange={(e) => updateBuilding('maxCrew', Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </div>

                {/* Color Swatch */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-2">
                    <span className="text-slate-300">Color Tag</span>
                    <span className="text-slate-400 font-mono text-[10px]">{selectedBuilding.color}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selectedBuilding.color}
                      onChange={(e) => updateBuilding('color', e.target.value)}
                      className="w-9 h-9 rounded bg-slate-900 border border-slate-700 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={selectedBuilding.description}
                      onChange={(e) => updateBuilding('description', e.target.value)}
                      placeholder="Short description..."
                      className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-slate-300 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-2 p-8 text-center text-slate-500 font-mono">
              No building selected. Click + NEW to create one.
            </div>
          )}
        </div>
      )}

      {/* CREW & DECK DEFENSE TUNER */}
      {tab === 'crew' && (
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 flex flex-col gap-6 shadow-xl">
          {/* Header */}
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-lg font-bold font-mono text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" />
              <span>Deck Crew Simulation & Combat Parameters</span>
            </h3>
            <p className="text-xs font-mono text-slate-400 mt-1">
              Adjust boids flocking population on deck, creature predation lethality (snatches, drops, instant kills), and crew Personal Defense Weapon (PDW) combat stats.
            </p>
          </div>

          {/* Section 1: Simulated On-Deck Population */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm font-mono font-bold text-cyan-300">
              <Users className="w-4 h-4 text-cyan-400" />
              <span>1. ON-DECK CREW ACTIVE POPULATION (BOIDS FLOCKING)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Min On-Deck Percent */}
              <div className="p-3 bg-cyan-950/20 border border-cyan-800/40 rounded-lg">
                <div className="flex justify-between text-xs font-mono mb-2">
                  <span className="text-cyan-200 font-semibold">Min Active Crew on Deck (%)</span>
                  <span className="text-cyan-400 font-bold">{crewConfig.minOnDeckPercent}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="5"
                  value={crewConfig.minOnDeckPercent}
                  onChange={(e) => updateCrewConfig('minOnDeckPercent', Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
                <div className="text-[10px] text-slate-500 font-mono mt-1">
                  Baseline minimum fraction of crew visibly walking between deck stations.
                </div>
              </div>

              {/* Max On-Deck Percent */}
              <div className="p-3 bg-cyan-950/20 border border-cyan-800/40 rounded-lg">
                <div className="flex justify-between text-xs font-mono mb-2">
                  <span className="text-cyan-200 font-semibold">Max Active Crew on Deck (%)</span>
                  <span className="text-cyan-400 font-bold">{crewConfig.maxOnDeckPercent}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="5"
                  value={crewConfig.maxOnDeckPercent}
                  onChange={(e) => updateCrewConfig('maxOnDeckPercent', Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
                <div className="text-[10px] text-slate-500 font-mono mt-1">
                  Upper ceiling for crew milling about the deck corridors during active operations.
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Creature Deck Attack & Lethality */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm font-mono font-bold text-rose-300">
              <Skull className="w-4 h-4 text-rose-400" />
              <span>2. CREATURE PREDATION & DECK LETHALITY (VEILFANGS & FLYING ASSAULTS)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Insta-kill Chance */}
              <div className="p-3 bg-rose-950/20 border border-rose-800/40 rounded-lg">
                <div className="flex justify-between text-xs font-mono mb-2">
                  <span className="text-rose-200 font-semibold flex items-center gap-1">
                    <Skull className="w-3.5 h-3.5 text-rose-400" />
                    Chance to Insta-Kill Crewmember
                  </span>
                  <span className="text-rose-400 font-bold">{(crewConfig.instaKillChance * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={crewConfig.instaKillChance}
                  onChange={(e) => updateCrewConfig('instaKillChance', Number(e.target.value))}
                  className="w-full accent-rose-400 cursor-pointer"
                />
                <div className="text-[10px] text-slate-500 font-mono mt-1">
                  Probability that a direct strike on an exposed crewmember kills them instantly.
                </div>
              </div>

              {/* Hurt Hidden Chance */}
              <div className="p-3 bg-rose-950/20 border border-rose-800/40 rounded-lg">
                <div className="flex justify-between text-xs font-mono mb-2">
                  <span className="text-rose-200 font-semibold flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5 text-amber-400" />
                    Chance to Hurt Hidden Crewmember
                  </span>
                  <span className="text-amber-400 font-bold">{(crewConfig.hurtHiddenChance * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={crewConfig.hurtHiddenChance}
                  onChange={(e) => updateCrewConfig('hurtHiddenChance', Number(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
                <div className="text-[10px] text-slate-500 font-mono mt-1">
                  Probability that assaults on Housing modules breach the interior and injure sheltered crew.
                </div>
              </div>

              {/* Damage Frequency */}
              <div className="p-3 bg-rose-950/20 border border-rose-800/40 rounded-lg">
                <div className="flex justify-between text-xs font-mono mb-2">
                  <span className="text-rose-200 font-semibold">Damage Frequency</span>
                  <span className="text-rose-400 font-bold">{crewConfig.damageFrequency.toFixed(1)} attacks/s</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="4.0"
                  step="0.1"
                  value={crewConfig.damageFrequency}
                  onChange={(e) => updateCrewConfig('damageFrequency', Number(e.target.value))}
                  className="w-full accent-rose-400 cursor-pointer"
                />
                <div className="text-[10px] text-slate-500 font-mono mt-1">
                  How frequently deck-attacking creatures can land strikes or attempt crew snatches.
                </div>
              </div>

              {/* Damage Amount */}
              <div className="p-3 bg-rose-950/20 border border-rose-800/40 rounded-lg">
                <div className="flex justify-between text-xs font-mono mb-2">
                  <span className="text-rose-200 font-semibold">Damage Amount (per strike)</span>
                  <span className="text-rose-400 font-bold">{crewConfig.damageAmount} DMG</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="5"
                  value={crewConfig.damageAmount}
                  onChange={(e) => updateCrewConfig('damageAmount', Number(e.target.value))}
                  className="w-full accent-rose-400 cursor-pointer"
                />
                <div className="text-[10px] text-slate-500 font-mono mt-1">
                  Damage inflicted per strike. Crew HP is 20 HP by default.
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Crew Personal Defense Weapons (PDW) */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm font-mono font-bold text-amber-300">
              <Swords className="w-4 h-4 text-amber-400" />
              <span>3. CREW PERSONAL DEFENSE WEAPONS (PDW - ATTACK STANCE)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* PDW Damage */}
              <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-lg">
                <div className="flex justify-between text-xs font-mono mb-2">
                  <span className="text-amber-200 font-semibold">PDW Damage (per shot)</span>
                  <span className="text-amber-400 font-bold">{crewConfig.pdwDamage} DMG</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="15"
                  step="1"
                  value={crewConfig.pdwDamage}
                  onChange={(e) => updateCrewConfig('pdwDamage', Number(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
                <div className="text-[10px] text-slate-500 font-mono mt-1">
                  Default chip damage dealt by sidearms (1-2 DMG).
                </div>
              </div>

              {/* PDW Range */}
              <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-lg">
                <div className="flex justify-between text-xs font-mono mb-2">
                  <span className="text-amber-200 font-semibold">PDW Range</span>
                  <span className="text-amber-400 font-bold">{crewConfig.pdwRange} px</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="160"
                  step="5"
                  value={crewConfig.pdwRange}
                  onChange={(e) => updateCrewConfig('pdwRange', Number(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
                <div className="text-[10px] text-slate-500 font-mono mt-1">
                  Short defensive firing distance across deck corridors.
                </div>
              </div>

              {/* PDW Fire Rate */}
              <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-lg">
                <div className="flex justify-between text-xs font-mono mb-2">
                  <span className="text-amber-200 font-semibold">PDW Fire Rate</span>
                  <span className="text-amber-400 font-bold">{crewConfig.pdwFireRate.toFixed(1)} shots/s</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="5.0"
                  step="0.25"
                  value={crewConfig.pdwFireRate}
                  onChange={(e) => updateCrewConfig('pdwFireRate', Number(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
                <div className="text-[10px] text-slate-500 font-mono mt-1">
                  Rate of fire per engaging crewmember in ATTACK stance.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
        </div>

        {/* Right Column: Live TTK Matrix Side Panel */}
        <div className="lg:col-span-5 sticky top-2 min-w-0">
          <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-3 shadow-2xl backdrop-blur max-h-[calc(100vh-10rem)] overflow-auto">
            <TTKMatrix
              weapons={weapons}
              creatures={creatures}
              isCompact={true}
              onSelectWeapon={(w) => {
                setTab('weapons');
                setSelectedWeaponId(w.id);
              }}
              onSelectCreature={(c) => {
                setTab('creatures');
                setSelectedCreatureId(c.id);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
