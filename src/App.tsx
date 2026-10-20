import React, { useState, useEffect, useRef } from 'react';
import { SimulationEngine } from './engine/simulation';
import { DEFAULT_WEAPONS, DEFAULT_CREATURES, DEFAULT_BUILDINGS, DEFAULT_CREW_CONFIG } from './data/presets';
import { DEFAULT_BEHAVIOR_TEMPLATES } from './data/behaviorTemplates';
import { WeaponDef, CreatureDef, BuildingDef, WeaponSlot, CreatureRuntimeInstance, CrewSimulationConfig, CrewStance } from './types/combat';
import { CreatureBehaviorTree } from './types/behavior';
import { Navbar } from './components/Navbar';
import { TacticalCanvas } from './components/TacticalCanvas';
import { BehemothHUD } from './components/BehemothHUD';
import { TTKMatrix } from './components/TTKMatrix';
import { BalancingPanel } from './components/BalancingPanel';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { BehaviorEditor } from './components/behavior/BehaviorEditor';

const WEAPONS_STORAGE_KEY = 'behemoth_sim_custom_weapons_v7';
const CREATURES_STORAGE_KEY = 'behemoth_sim_custom_creatures_v7';
const BUILDINGS_STORAGE_KEY = 'behemoth_sim_custom_buildings_v7';
const BEHAVIOR_STORAGE_KEY = 'behemoth_sim_custom_behavior_trees_v7';
const CREW_CONFIG_STORAGE_KEY = 'behemoth_sim_custom_crew_v7';

export function App() {
  const [currentMode, setMode] = useState<'tactical' | 'behavior' | 'ttk' | 'analytics' | 'balancing'>('tactical');
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(1.0);
  const [savedNotification, setSavedNotification] = useState<string | null>(null);

  // Editable presets state with LocalStorage recovery
  const [weapons, setWeapons] = useState<WeaponDef[]>(() => {
    try {
      const saved = localStorage.getItem(WEAPONS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Back-fill newly added fields (e.g. turnSpeed, rotationCap) from the matching preset
          return parsed.map((w: WeaponDef) => {
            const base = DEFAULT_WEAPONS.find((d) => d.id === w.id);
            return base
              ? {
                  ...base,
                  ...w,
                  turnSpeed: w.turnSpeed ?? base.turnSpeed,
                  rotationCap: w.rotationCap ?? base.rotationCap ?? 225,
                }
              : { ...w, rotationCap: w.rotationCap ?? 225 };
          });
        }
      }
    } catch (e) {
      console.warn('Failed to load saved weapons from localStorage:', e);
    }
    return DEFAULT_WEAPONS;
  });

  const [creatures, setCreatures] = useState<CreatureDef[]>(() => {
    try {
      const saved = localStorage.getItem(CREATURES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Preserve saved modifications on base creatures while keeping cloned and custom threats
          const loaded = parsed.map((c: CreatureDef) => {
            const base = DEFAULT_CREATURES.find((d) => d.id === c.id);
            return base
              ? {
                  ...base,
                  ...c,
                  isFlying: c.isFlying ?? base.isFlying ?? false,
                  locomotionType: c.locomotionType ?? base.locomotionType ?? 'non-flying',
                }
              : c;
          });
          // Ensure all default creatures are present if newly introduced
          for (const def of DEFAULT_CREATURES) {
            if (!loaded.some((item) => item.id === def.id)) {
              loaded.push(def);
            }
          }
          return loaded;
        }
      }
    } catch (e) {
      console.warn('Failed to load saved creatures from localStorage:', e);
    }
    return DEFAULT_CREATURES;
  });

  const [buildings, setBuildings] = useState<BuildingDef[]>(() => {
    try {
      const saved = localStorage.getItem(BUILDINGS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge with DEFAULT_BUILDINGS so all production, energy, housing, and service types exist
          const merged = DEFAULT_BUILDINGS.map((base) => {
            const userB = parsed.find((b: BuildingDef) => b.id === base.id);
            return userB ? { ...base, ...userB, maxHealth: userB.maxHealth ?? base.maxHealth } : base;
          });
          // Keep custom buildings created by the designer
          const custom = parsed.filter((b: BuildingDef) => !DEFAULT_BUILDINGS.some((d) => d.id === b.id));
          return [...merged, ...custom];
        }
      }
    } catch (e) {
      console.warn('Failed to load saved buildings from localStorage:', e);
    }
    return DEFAULT_BUILDINGS;
  });

  // Selected entities for inspect
  const [selectedSlotId, setSelectedSlotId] = useState<string | undefined>(undefined);
  const [selectedCreatureId, setSelectedCreatureId] = useState<string | undefined>(undefined);

  // Engine ref
  const engineRef = useRef<SimulationEngine>(new SimulationEngine(weapons, creatures));
  const [, setTickCounter] = useState(0);

  // Auto-save creature parameters, weapons, and buildings to localStorage whenever modified
  useEffect(() => {
    try {
      localStorage.setItem(CREATURES_STORAGE_KEY, JSON.stringify(creatures));
    } catch (e) {
      console.warn('Failed to auto-save creatures to localStorage:', e);
    }
  }, [creatures]);

  useEffect(() => {
    try {
      localStorage.setItem(WEAPONS_STORAGE_KEY, JSON.stringify(weapons));
    } catch (e) {
      console.warn('Failed to auto-save weapons to localStorage:', e);
    }
  }, [weapons]);

  useEffect(() => {
    try {
      localStorage.setItem(BUILDINGS_STORAGE_KEY, JSON.stringify(buildings));
    } catch (e) {
      console.warn('Failed to auto-save buildings to localStorage:', e);
    }
  }, [buildings]);

  const [crewConfig, setCrewConfig] = useState<CrewSimulationConfig>(() => {
    try {
      const saved = localStorage.getItem(CREW_CONFIG_STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_CREW_CONFIG, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Failed to load saved crew config from localStorage:', e);
    }
    return DEFAULT_CREW_CONFIG;
  });

  useEffect(() => {
    try {
      localStorage.setItem(CREW_CONFIG_STORAGE_KEY, JSON.stringify(crewConfig));
    } catch (e) {
      console.warn('Failed to auto-save crew config to localStorage:', e);
    }
    engineRef.current.updateCrewConfig(crewConfig);
  }, [crewConfig]);

  const handleSetCrewStance = (stance: CrewStance) => {
    engineRef.current.setCrewStance(stance);
    setTickCounter((prev) => prev + 1);
  };

  // Clone Creature & Duplicate Behavior Tree
  const handleCloneCreature = (sourceId: string) => {
    const source = creatures.find((c) => c.id === sourceId);
    if (!source) return;

    const cloneId = `${source.id}_clone_${Date.now()}`;
    const clonedDef: CreatureDef = {
      ...JSON.parse(JSON.stringify(source)),
      id: cloneId,
      name: `${source.name} (Clone)`,
    };

    // Deep clone behavior tree if present
    try {
      const savedTrees = localStorage.getItem(BEHAVIOR_STORAGE_KEY);
      let treeMap: Record<string, CreatureBehaviorTree> = { ...DEFAULT_BEHAVIOR_TEMPLATES };
      if (savedTrees) {
        const parsed = JSON.parse(savedTrees);
        if (parsed && typeof parsed === 'object') {
          treeMap = { ...treeMap, ...parsed };
        }
      }
      const sourceTree = treeMap[source.id] || DEFAULT_BEHAVIOR_TEMPLATES[source.id];
      if (sourceTree) {
        const clonedTree: CreatureBehaviorTree = {
          ...JSON.parse(JSON.stringify(sourceTree)),
          id: `tree_${cloneId}`,
          creatureDefId: cloneId,
          name: `${clonedDef.name} AI Tree`,
        };
        treeMap[cloneId] = clonedTree;
        localStorage.setItem(BEHAVIOR_STORAGE_KEY, JSON.stringify(treeMap));
        engineRef.current.behaviorTrees.set(cloneId, clonedTree);
      }
    } catch (e) {
      console.warn('Failed to clone behavior tree for creature:', e);
    }

    setCreatures((prev) => [...prev, clonedDef]);
    setSelectedCreatureId(cloneId);
    setTickCounter((prev) => prev + 1);
    setSavedNotification(`Cloned ${source.name}! Swarm behavior & tree duplicated.`);
    setTimeout(() => setSavedNotification(null), 3000);
  };

  // Check if a saved_presets.json exists on the local server file system and load it on mount
  useEffect(() => {
    fetch('/api/load-presets')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data === 'object') {
          if (Array.isArray(data.weapons) && data.weapons.length > 0) setWeapons(data.weapons);
          if (Array.isArray(data.creatures) && data.creatures.length > 0) setCreatures(data.creatures);
          if (Array.isArray(data.buildings) && data.buildings.length > 0) setBuildings(data.buildings);
          if (data.crewConfig) setCrewConfig(data.crewConfig);
          if (data.behaviorTrees && typeof data.behaviorTrees === 'object') {
            for (const [id, tree] of Object.entries(data.behaviorTrees)) {
              engineRef.current.behaviorTrees.set(id, tree as any);
            }
          }
          console.log('[CombatSim] Loaded saved project presets from src/data/saved_presets.json');
        }
      })
      .catch(() => {});
  }, []);

  const buildConfigSnapshot = () => ({
    version: '1.0',
    timestamp: new Date().toISOString(),
    weapons,
    creatures,
    buildings,
    crewConfig,
    behaviorTrees: Object.fromEntries(engineRef.current.behaviorTrees.entries()),
  });

  // Save directly to project files (src/data/saved_presets.json)
  const handleSaveToProjectFile = async () => {
    const snapshot = buildConfigSnapshot();
    try {
      const res = await fetch('/api/save-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot, null, 2),
      });
      if (res.ok) {
        setSavedNotification('Saved directly to project file (src/data/saved_presets.json)!');
        setTimeout(() => setSavedNotification(null), 3500);
      } else {
        throw new Error('Save endpoint responded with ' + res.status);
      }
    } catch (e) {
      console.warn('Direct file save failed, triggering download:', e);
      handleExportConfigFile();
    }
  };

  // Export full configuration snapshot to a downloadable JSON file
  const handleExportConfigFile = () => {
    const snapshot = buildConfigSnapshot();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    a.download = `combatsim-presets-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSavedNotification('Exported combatsim-presets.json file!');
    setTimeout(() => setSavedNotification(null), 3500);
  };

  // Import configuration snapshot from a user-uploaded JSON file
  const handleImportConfigFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text);
        if (data && typeof data === 'object') {
          if (Array.isArray(data.weapons) && data.weapons.length > 0) setWeapons(data.weapons);
          if (Array.isArray(data.creatures) && data.creatures.length > 0) setCreatures(data.creatures);
          if (Array.isArray(data.buildings) && data.buildings.length > 0) setBuildings(data.buildings);
          if (data.crewConfig) setCrewConfig(data.crewConfig);
          if (data.behaviorTrees && typeof data.behaviorTrees === 'object') {
            for (const [id, tree] of Object.entries(data.behaviorTrees)) {
              engineRef.current.behaviorTrees.set(id, tree as any);
            }
          }
          // Also persist directly to server file
          fetch('/api/save-presets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data, null, 2),
          }).catch(() => {});

          setSavedNotification(`Imported ${file.name} successfully!`);
          setTimeout(() => setSavedNotification(null), 3500);
        } else {
          alert('Invalid file format: JSON root must be an object.');
        }
      } catch (err: any) {
        console.error('Failed to import config file:', err);
        alert('Failed to parse JSON configuration file: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  // Save presets to browser LocalStorage (Manual trigger button)
  const handleSavePresetsToStorage = () => {
    try {
      localStorage.setItem(WEAPONS_STORAGE_KEY, JSON.stringify(weapons));
      localStorage.setItem(CREATURES_STORAGE_KEY, JSON.stringify(creatures));
      localStorage.setItem(BUILDINGS_STORAGE_KEY, JSON.stringify(buildings));
      localStorage.setItem(CREW_CONFIG_STORAGE_KEY, JSON.stringify(crewConfig));
      setSavedNotification('Presets saved to browser!');
      setTimeout(() => setSavedNotification(null), 3000);
    } catch (e) {
      console.error('Failed to save presets:', e);
      alert('Failed to save presets to local storage.');
    }
  };

  // Sync weapons, creatures & buildings when edited in Balancing Panel
  useEffect(() => {
    const engine = engineRef.current;
    engine.weaponDefs = new Map(weapons.map((w) => [w.id, w]));
    engine.creatureDefs = new Map(creatures.map((c) => [c.id, c]));

    // Update active slot weapon definitions
    for (const slot of engine.behemoth.slots) {
      if (slot.weapon) {
        const updatedW = engine.weaponDefs.get(slot.weapon.id);
        if (updatedW) {
          slot.weapon = { ...updatedW };
        } else if (weapons.length > 0) {
          // Weapon was deleted: fallback to first available weapon
          slot.weapon = { ...weapons[0] };
          slot.currentAmmo = weapons[0].ammoCapacity;
        } else {
          slot.weapon = null;
        }
      }
    }

    // Update active building slots if definition changed
    for (const slot of engine.behemoth.buildingSlots) {
      if (slot.building) {
        const updatedB = buildings.find((b) => b.id === slot.building!.id);
        if (updatedB) {
          slot.building = { ...updatedB };
          slot.maxHealth = updatedB.maxHealth;
          slot.health = Math.min(slot.health, slot.maxHealth);
        }
      }
    }
  }, [weapons, creatures, buildings]);

  // Initial spawn on load
  useEffect(() => {
    engineRef.current.spawnCreature('dreadlot', true);
  }, []);

  // Main simulation tick loop
  useEffect(() => {
    let lastTime = performance.now();
    let frameId: number;

    const loop = (currentTime: number) => {
      const deltaSec = Math.min(0.1, (currentTime - lastTime) / 1000);
      lastTime = currentTime;

      if (isRunning) {
        const effectiveDt = deltaSec * simSpeed;
        engineRef.current.tick(effectiveDt);
        // Force React component re-render for UI telemetry
        setTickCounter((prev) => prev + 1);
      }

      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [isRunning, simSpeed]);

  const handleReset = () => {
    engineRef.current.reset();
    engineRef.current.spawnCreature('dreadlot', true);
    setTickCounter((prev) => prev + 1);
  };

  const handleSpawnCreature = (creatureId: string) => {
    engineRef.current.spawnCreature(creatureId, true);
    setTickCounter((prev) => prev + 1);
  };

  const handleResetDefaults = () => {
    localStorage.removeItem(WEAPONS_STORAGE_KEY);
    localStorage.removeItem(CREATURES_STORAGE_KEY);
    localStorage.removeItem(BUILDINGS_STORAGE_KEY);
    localStorage.removeItem(CREW_CONFIG_STORAGE_KEY);
    setWeapons(DEFAULT_WEAPONS);
    setCreatures(DEFAULT_CREATURES);
    setBuildings(DEFAULT_BUILDINGS);
    setCrewConfig(DEFAULT_CREW_CONFIG);
    engineRef.current.setAllBuildingSlotsMaxHealth(100);
    handleReset();
    setSavedNotification('Reset to defaults');
    setTimeout(() => setSavedNotification(null), 2500);
  };

  const handleToggleCreatureFlying = (creatureId: string) => {
    setCreatures((prev) =>
      prev.map((c) => {
        if (c.id === creatureId) {
          const nextIsFlying = !c.isFlying;
          engineRef.current.setCreatureFlying(creatureId, nextIsFlying);
          return {
            ...c,
            isFlying: nextIsFlying,
            locomotionType: nextIsFlying ? 'flying' : 'non-flying',
          };
        }
        return c;
      })
    );
    setTickCounter((prev) => prev + 1);
  };

  const handleUpdateBuildingSlotHealth = (slotId: string, health: number) => {
    engineRef.current.setBuildingSlotMaxHealth(slotId, health);
    setTickCounter((prev) => prev + 1);
  };

  const handleSetAllBuildingsHealth = (maxHp: number = 100) => {
    setBuildings((prev) => prev.map((b) => ({ ...b, maxHealth: maxHp })));
    engineRef.current.setAllBuildingSlotsMaxHealth(maxHp);
    setTickCounter((prev) => prev + 1);
  };

  const handleUpdateSlotRotationCap = (slotId: string, cap: number) => {
    engineRef.current.setSlotRotationCap(slotId, cap);
    setTickCounter((prev) => prev + 1);
  };

  const handleUpdateAllRotationCaps = (cap: number) => {
    engineRef.current.setAllSlotsRotationCap(cap);
    setTickCounter((prev) => prev + 1);
  };

  const handleAssignWeaponToSlot = (slotId: string, weaponId: string | null) => {
    const slot = engineRef.current.behemoth.slots.find((s) => s.id === slotId);
    if (!slot) return;

    if (weaponId === null) {
      slot.weapon = null;
      slot.currentAmmo = 0;
      slot.isFiring = false;
      slot.isReloading = false;
      slot.isCoolingDown = false;
      slot.cooldownDurationRemaining = 0;
      slot.currentFireDuration = 0;
    } else {
      const selectedW = weapons.find((w) => w.id === weaponId);
      if (selectedW) {
        slot.weapon = { ...selectedW };
        slot.currentAmmo = selectedW.ammoCapacity;
        slot.isReloading = false;
        slot.reloadProgress = 0;
        slot.cooldownRemaining = 0;
        slot.isFiring = false;
        slot.isCoolingDown = false;
        slot.cooldownDurationRemaining = 0;
        slot.currentFireDuration = 0;
      }
    }
    setTickCounter((prev) => prev + 1);
  };

  const handleClearAllSlots = () => {
    for (const slot of engineRef.current.behemoth.slots) {
      slot.weapon = null;
      slot.currentAmmo = 0;
      slot.isFiring = false;
      slot.isReloading = false;
      slot.isCoolingDown = false;
      slot.cooldownDurationRemaining = 0;
      slot.currentFireDuration = 0;
    }
    setTickCounter((prev) => prev + 1);
  };

  const handleAutoFillSlots = (weaponId: string) => {
    const selectedW = weapons.find((w) => w.id === weaponId);
    if (!selectedW) return;

    for (const slot of engineRef.current.behemoth.slots) {
      slot.weapon = { ...selectedW };
      slot.currentAmmo = selectedW.ammoCapacity;
      slot.isReloading = false;
      slot.reloadProgress = 0;
      slot.cooldownRemaining = 0;
      slot.isFiring = false;
      slot.isCoolingDown = false;
      slot.cooldownDurationRemaining = 0;
      slot.currentFireDuration = 0;
    }
    setTickCounter((prev) => prev + 1);
  };

  const handleAssignBuildingToSlot = (slotId: string, buildingId: string | null) => {
    const slot = engineRef.current.behemoth.buildingSlots.find((s) => s.id === slotId);
    if (!slot) return;
    const def = buildingId ? buildings.find((b) => b.id === buildingId) || null : null;
    slot.building = def ? { ...def } : null;
    slot.maxHealth = def ? def.maxHealth : 0;
    slot.health = def ? def.maxHealth : 0;
    slot.isStunned = false;
    slot.stunTimer = 0;
    slot.isOffline = false;
    slot.assignedCrew = def ? Math.min(def.requiredCrew || 1, engineRef.current.behemoth.crew) : 0;
    engineRef.current.enforceCrewCap();
    setTickCounter((prev) => prev + 1);
  };

  const handleSetCrew = (crew: number) => {
    engineRef.current.behemoth.maxCrew = crew;
    engineRef.current.behemoth.crew = crew;
    engineRef.current.enforceCrewCap();
    setTickCounter((prev) => prev + 1);
  };

  const handleSetCrewMemberHp = (hp: number) => {
    engineRef.current.behemoth.crewMemberHp = Math.max(1, hp);
    setTickCounter((prev) => prev + 1);
  };

  const handleAssignCrewToBuilding = (slotId: string, delta: number) => {
    engineRef.current.assignCrewToBuilding(slotId, delta);
    setTickCounter((prev) => prev + 1);
  };

  const handleLoadCharges = (slotId?: string) => {
    engineRef.current.loadCharges(slotId);
    setTickCounter((prev) => prev + 1);
  };

  const creatureOptions = creatures.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#050b14] text-slate-100">
      {/* Top Navigation & Controls */}
      <Navbar
        currentMode={currentMode}
        setMode={setMode}
        isRunning={isRunning}
        setIsRunning={setIsRunning}
        simSpeed={simSpeed}
        setSimSpeed={setSimSpeed}
        onReset={handleReset}
        onSpawnCreature={handleSpawnCreature}
        creatureOptions={creatureOptions}
        onSaveToProjectFile={handleSaveToProjectFile}
        onExportConfigFile={handleExportConfigFile}
        onImportConfigFile={handleImportConfigFile}
        savedNotification={savedNotification}
      />

      {/* Main View Area */}
      <main className="flex-1 min-h-0 relative">
        {currentMode === 'tactical' && (
          <TacticalCanvas
            engine={engineRef.current}
            selectedCreatureId={selectedCreatureId}
            onSelectCreature={(c) => setSelectedCreatureId(c.id)}
            onSelectSlot={(s) => setSelectedSlotId(s.id)}
            onSelectSlotId={(id) => setSelectedSlotId(id)}
            selectedSlotId={selectedSlotId}
            creatures={creatures}
            onSpawnCreature={handleSpawnCreature}
            onToggleCreatureFlying={handleToggleCreatureFlying}
            onSetCrewStance={handleSetCrewStance}
          />
        )}

        {currentMode === 'behavior' && (
          <BehaviorEditor
            engine={engineRef.current}
            creatures={creatures}
            weapons={weapons}
            onSpawnCreature={handleSpawnCreature}
            onCloneCreature={handleCloneCreature}
          />
        )}

        {currentMode === 'ttk' && (
          <TTKMatrix
            weapons={weapons}
            creatures={creatures}
            onSelectWeapon={(w) => {
              setMode('balancing');
            }}
            onSelectCreature={(c) => {
              setMode('balancing');
            }}
          />
        )}

        {currentMode === 'balancing' && (
          <BalancingPanel
            weapons={weapons}
            setWeapons={setWeapons}
            creatures={creatures}
            setCreatures={setCreatures}
            buildings={buildings}
            setBuildings={setBuildings}
            crewConfig={crewConfig}
            setCrewConfig={setCrewConfig}
            onResetDefaults={handleResetDefaults}
            onSavePresetsToStorage={handleSavePresetsToStorage}
            onSaveToProjectFile={handleSaveToProjectFile}
            onExportConfigFile={handleExportConfigFile}
            onImportConfigFile={handleImportConfigFile}
            savedNotification={savedNotification}
            onSetAllBuildingsHealth={handleSetAllBuildingsHealth}
            onCloneCreature={handleCloneCreature}
          />
        )}

        {currentMode === 'analytics' && (
          <AnalyticsPanel
            stats={engineRef.current.stats}
            behemoth={engineRef.current.behemoth}
            timeElapsed={engineRef.current.timeElapsed}
            logMessages={engineRef.current.logMessages}
          />
        )}
      </main>

      {/* Behemoth Deck & Inclinometer HUD (Radar tab only) */}
      {currentMode === 'tactical' && (
        <BehemothHUD
          behemoth={engineRef.current.behemoth}
          weapons={weapons}
          selectedSlotId={selectedSlotId}
          onSelectSlot={(slot) => setSelectedSlotId(slot.id)}
          onAssignWeaponToSlot={handleAssignWeaponToSlot}
          onClearAllSlots={handleClearAllSlots}
          onAutoFillSlots={handleAutoFillSlots}
          buildings={buildings}
          onAssignBuildingToSlot={handleAssignBuildingToSlot}
          onSetCrew={handleSetCrew}
          onSetCrewMemberHp={handleSetCrewMemberHp}
          onAssignCrewToBuilding={handleAssignCrewToBuilding}
          onLoadCharges={handleLoadCharges}
          onUpdateBuildingSlotHealth={handleUpdateBuildingSlotHealth}
          onSetAllBuildingsHealth={handleSetAllBuildingsHealth}
          onUpdateSlotRotationCap={handleUpdateSlotRotationCap}
          onUpdateAllRotationCaps={handleUpdateAllRotationCaps}
        />
      )}
    </div>
  );
}
