# CombatSim — AI Agent System Context & Knowledge Base

## 1. Project Purpose
CombatSim is a real-time, browser-based 2D tactical naval combat simulator and closed-form balancing workbench built with React, TypeScript, TailwindCSS, and HTML5 Canvas (Vite bundled).
Its primary purpose is balancing, testing, and visualizing asymmetrical engagements between a player-controlled massive warship (the **Behemoth**) and biological marine apex predators / swarms, while keeping all kinematic units, coordinate scales, and balancing values Unreal-friendly ($1\text{ UU} = 1\text{ cm}$, $1\text{ m} = 100\text{ UU}$).

---

## 2. Architecture & Core Functionality

### 2.1 Simulation Engine (`src/engine/simulation.ts`)
* Fixed-timestep physics and combat loop running at $60\text{ Hz}$ (`dt = 1/60`).
* Behavior motion constants in `behaviorRunner.ts` scale with `MRS` (= 5.45, legacy→45 m/s knot) so authored px geometry (orbits, approaches, swarm ring) holds at real speeds; timers do not scale. Creature `turningRate` values were scaled so turning circles match the original tuning (Leviarch 199°/s, Dreadlot 142, Veilfangs 447, Aetherfin 284).
* Veilfangs swarm ring constants: `SWARM_ORBIT_RADIUS` 300 px, pursue hysteresis 260/340 px, squad abort 380 px.
* All engine randomness goes through the seeded RNG in `src/engine/rng.ts` (`random()`); `reset()` reseeds, so identical inputs replay identically.
* Calculates projectile trajectories (Line, Arc), hit detection, collision, module damage, health pools, penetration, stun, and ship tilt dynamics.
* Manages runtime state: Behemoth, weapon slots, building slots, active creature instances, crew agents, PDW projectiles, and battle logs.

### 2.2 Navigation & Coordinate Systems (`src/engine/measurements.ts`, `src/engine/navigation.ts`)
* **Scale**: Canonical Behemoth length = $500\text{ m}$ ($50,000\text{ UU}$ / Game Units). On canvas = $260\text{ px}$.
  * $1\text{ px} \approx 1.923\text{ m} = 192.3\text{ UU}$. $1\text{ m} \approx 0.520\text{ px}$.
  * $1\text{ Knot (speed)} = 1\text{ tile/min} = 45\text{ m/s} = 4{,}500\text{ UU/s} = 23.4\text{ px/s}$ (unified Nov 2026; legacy 825 UU/s scale removed).
  * Behemoth: 10 kts regular, 15 kts Overdrive.
* **Units (metric-v1)**: all definitions are authored in metric — weapon `range`/`aoe` (m), `projectileSpeed` (m/s); creature `radius`, `crowdDispersion`, `deckAttackRange`, `aggroRadiusMeters` (m); crew `pdwRange` (m); behavior-node distances (m) and `minGlideSpeed` (kts). Speeds stay in knots. The engine runs in canvas px internally and converts with `metersToPx` where definition values enter. `src/data/migrations.ts` converts older px-based presets / imports / stored trees (snapshots tagged `units: 'metric-v1'`).
* **Navigation**: Waypoint-based pure pursuit steering originated from Behemoth forward bow arrow. Supports Forward (`FWD`) and Reverse (`REV`) transmission gears.

### 2.3 Behavior Tree Runtime (`src/engine/behaviorRunner.ts`)
* Executes hierarchical state-machine behavior trees per creature per tick.
* **Node Types**:
  * **Action**: `approach`, `deal_damage`, `retreat`, `run_away`, `hide`, `wait_idle`, `scatter`, `reform`, `boids_flock`, `split_swarm_groups`, `group_approach_building`, `group_strike_target`, `return_to_swarm`, `charge_orbit`, `short_circuit_drain`, `flock_dissipate_regroup`, `barrel_roll`.
  * **Condition**: `until_dealt_damage`, `until_received_damage`, `until_aggression`, `for_seconds`, `once`, `health_threshold`, `distance_check`, `swarm_size`, `formation_integrity`.
  * **Flow**: `repeat`, `branch_switch`, `state_transition`, `parallel_execute`.
  * **Special**: `swarm_coordination`, `phase_trigger`, `event_listener`.
* Supports dynamic runtime overrides: tunable speeds, durations, speed multipliers, and reactive on-hit branching.

### 2.4 UI Workstations (`src/components/`)
* **Mode 1: Tactical Canvas** (`TacticalCanvas.tsx`): 2D top-down canvas, waypoint plotting, real-time telemetry, threat spawner, combat log.
* **Mode 2: Behavior Tree Editor** (`behavior/NodeCanvas.tsx`, `NodePropertiesInspector.tsx`): Visual graph node editor to create, connect, inspect, and tune creature AI trees.
* **Mode 3: TTK Matrix** (`TTKMatrix.tsx`): Analytical Time-To-Kill matrix across all weapon/target combinations.
* **Mode 4: Balancing Panel** (`BalancingPanel.tsx`): Live tweaking of weapon attributes, creature stats, crew parameters, and instant JSON/TS export.

---

## 3. Main Entities & Data Models

### 3.1 The Behemoth (`src/types/combat.ts`)
The centerpiece warship operated by the player/AI.
* **Hull**: `hullHp`, `maxHullHp`, `tilt` (capsizing inclinometer in degrees), `tiltVelocity`, `speed`, `heading`, `gear` (`FWD`/`REV`).
* **Weapon Mounts (`slots: WeaponSlot[]`)**:
  * 2 rows: Port (Row 1) and Starboard (Row 2).
  * Clamped traverse shooting arcs, rotation speeds, ammo capacities, power draw, and reload timers.
* **Building Slots (`buildingSlots: BuildingSlot[]`)**:
  * Modular deck installations categorized as `housing`, `job` (abstracts all on-deck work slots: workshops, factories, …), `service`, or `energy`.
  * Manned by assigned crew; can be damaged, destroyed, or short-circuited/stunned.
* **Crew System (`crewAgents: CrewAgent[]`, `src/engine/crew.ts`)**:
  * Stances: `neutral` (wander deck, scatter if hit), `hide` (shelter inside housing quarters, mitigates direct damage), `attack` (draw Personal Defense Weapons / PDWs to shoot aerial/boarding threats).
  * Crew lethality: Direct strikes, snatch attacks (by aerial predators), and housing shrapnel/penetration.

### 3.2 Damage Rules (`src/engine/math.ts`)
* **Physical**: hit = max(1, DPP − Armor Class); depletes the armor pool first, excess goes to HP.
* **Energy**: bypasses Armor Class and the armor pool (no armor wear); reduced by Energy Resistance %.
* **Chemical**: bypasses Armor Class; wears 35% extra into the armor pool; lingering cloud.

### 3.3 Weapon Definitions (`WeaponDef`)
* **Gatling Gun**: Kinetic Physical, rapid line-fire, low DPP (5), high fire rate (7 Hz), high ammo capacity (120), anti-swarm specialist.
* **Photon Gun**: Energy, slow single-target beam, high DPP (250), heavy power draw, pierces physical armor, long cooldown.
* **Grenade Launcher**: Physical Explosive, arched trajectory, high AoE radius (35), pushback impulse, anti-cluster.

### 3.4 Creature Threats (`CreatureDef`)
Hostile marine and aerial entities with distinct AI trees, locomotion layers, and resistances:
1. **Thunder Leviarch (`thunder_leviarch`)**:
   * *Role*: Solitary apex hit-and-run bio-titan.
   * *Layer*: Hybrid (submerged stalking $\leftrightarrow$ airborne breach).
   * *Speed*: 20 kts (900 m/s).
   * *Behaviors*: Lemniscate (Figure-8) stalking orbit, vulnerable surface venting ($3.2\text{s}$) vs deep untargetable submersion ($1.5\text{s}$), reactive evasive barrel-roll sprint ($2.0\times$ speed, $1.0\text{s}$ duration).
   * *Attacks*: **Spike Volley** — `spikeCount` (5) × `spikeDamage` (30) Physical, each spike picks a random target among hull + deck buildings (turrets excluded). **Keel Scrape** — tail scrape under the hull, Physical hull damage, no tilt (`scrapeCausesTilt: false`).
   * *Special Logic*: Out-of-range Predictive Apex Intercept pursuit (leads vessel bow along vector if $> 2,000\text{ m}$); anti-deck collision failsafe on dive.
2. **Veilfangs (`veilfangs`)**:
   * *Role*: Micro-swarm harasser (30 units, 30 HP each).
   * *Layer*: Low aerial flying.
   * *Behaviors*: 3-factor Craig Reynolds Boids simulation (separation, alignment, cohesion) anchored to orbit; on-hit panic dissipation (bursts radially away from impact), partitions into 3–5 unit squads to dive-bomb deck (60% crew / 40% building bias), then regroups at $+150^\circ$ opposite orbital sector.
3. **Aetherfin (`aetherfin`)**:
   * *Role*: Orbital energy parasite / disabler ($500\text{ HP}$, $14\text{ kts}$).
   * *Layer*: Aquatic submerged.
   * *Behaviors*: 96% Energy damage absorption; alternates between 18s charging orbit and under-keel short-circuit drain targeting 4 modules simultaneously (4% HP/s drain, 10% stun chance).
4. **Dreadlot (`dreadlot`)**:
   * *Role*: Armored submersible siege ram ($800\text{ HP}$, $500$ Armor pool, AC 15).
   * *Layer*: Aquatic / submerged.
   * *Behaviors*: Heavy ramming mass ($28\text{ mass}$), bull-rushes Behemoth hull to deal catastrophic kinetic impact damage and severe listing/capsizing tilt impulses, followed by standoff disengage.

---

## 4. Key Configuration & Data Files
* `src/data/presets.ts`: Default code-level weapon, creature, building, and crew presets.
* `src/data/saved_presets.json`: Persisted project balance presets, loaded automatically by the application.
* `src/data/behaviorTemplates.ts`: Pre-authored Behavior Tree graphs for each creature.
* `src/engine/measurements.ts`: Canonical scales, conversions (Knots, Game Units, Pixels, Meters, UU/s).
* `src/engine/rng.ts`: Seeded deterministic RNG for the engine.
* `src/data/presets.ts` is regenerated from `saved_presets.json` by the app's save endpoint (`vite.config.ts`) — edit both together.
* `src/utils/documentation.ts`: In-app exportable user documentation markdown.
