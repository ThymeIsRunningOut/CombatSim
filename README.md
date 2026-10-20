# Behemoth Combat Simulator (CombatSim)

An advanced real-time tactical naval combat simulator and closed-form analytical balancing workbench. Designed for combat designers and game engineers, this environment models asymmetrical engagements between the **Behemoth**—a massive armored warship featuring modular defense turrets, crew stations, and critical utility installations—and diverse marine apex predators and aerial swarms.

---

## Table of Contents
1. [Quick Start (Folder & Terminal Launch)](#quick-start-folder--terminal-launch)
2. [Simulator Architecture & Core Modes](#simulator-architecture--core-modes)
   - [Mode 1: Tactical Combat Radar](#mode-1-tactical-combat-radar)
   - [Mode 2: Behavior Tree & AI State Machine Editor](#mode-2-behavior-tree--ai-state-machine-editor)
   - [Mode 3: Live Time-To-Kill (TTK) Matrix](#mode-3-live-time-to-kill-ttk-matrix)
   - [Mode 4: Designer Balancing Inspector](#mode-4-designer-balancing-inspector)
   - [Mode 5: Battle Telemetry & Analytics Dashboard](#mode-5-battle-telemetry--analytics-dashboard)
3. [Vessel Systems & Crew Management](#vessel-systems--crew-management)
   - [The 3-Track Crew Allocation Rule](#the-3-track-crew-allocation-rule)
   - [Building Categories & Personnel Capacity](#building-categories--personnel-capacity)
4. [Predator Threats & Swarm Intelligence](#predator-threats--swarm-intelligence)
   - [Veilfangs (Autonomous Aerial Swarm)](#veilfangs-autonomous-aerial-swarm)
   - [Aetherfin (Apex Energy Predator)](#aetherfin-apex-energy-predator)
   - [Cloning Creatures & Behavior Reusability](#cloning-creatures--behavior-reusability)
5. [Weapon Traverse & Firing Arc Clamping](#weapon-traverse--firing-arc-clamping)
6. [Exporting & Unreal Engine Implementation](#exporting--unreal-engine-implementation)

---

## Quick Start (Folder & Terminal Launch)

### Option A: Launch Directly from Folder (No Terminal Required)
You can launch the simulator directly from macOS Finder without typing any terminal commands:
1. Open the **`CombatSim`** folder in Finder.
2. Double-click **`Start-Simulator.command`** (or **`Launch CombatSim.command`**).
3. The launcher will automatically start the background server and open your default web browser to **`http://localhost:5173/`**.

> **Note**: If macOS displays an initial security prompt regarding opening a script from an unidentified developer, right-click (or Control-click) `Start-Simulator.command` and choose **Open**, then confirm.

### Option B: Terminal Command
```bash
# Navigate to project directory
cd /path/to/CombatSim

# Install dependencies (if not already installed)
npm install

# Start Vite development server
npm run dev
```
Open **`http://localhost:5173/`** in any modern web browser.

---

## Simulator Architecture & Core Modes

CombatSim is organized into 5 specialized designer workstations accessible via the top navigation bar:

### Mode 1: Tactical Combat Radar
The real-time top-down combat canvas rendering the 2D physics, vessel navigation, and real-time projectile trajectories.
- **Vessel Geometry**: Displays the Behemoth hull with **Port (Row 1)** and **Starboard (Row 2)** turret mounts.
- **Turret Firing Arcs**: Visualized with semi-transparent cones clamped to their physical outward traverse boundaries.
- **Modular Deck HUD**: Expandable bottom panel managing weapon slots, supply packs, tilt inclinometer, hull HP, accumulator charge, and station crew assignments.
- **Flight Layers**: Flying swarms (*Veilfangs*) render directly above the ship deck with shadow projections, while aquatic beasts (*Aetherfin*) submerge beneath surface water.

### Mode 2: Behavior Tree & AI State Machine Editor
A node-based visual intelligence editor supporting **32 distinct behavior nodes** across 4 categories:
- **Action Nodes (Blue)**: Kinematics (`approach`, `retreat`, `charge_orbit`), offensive strikes (`deal_damage`, `group_strike_target`), evasive maneuvers (`hide`, `scatter`, `reform`), and swarm coordination (`boids_flock`, `split_swarm_groups`, `flock_dissipate_regroup`).
- **Condition Nodes (Yellow)**: Decision gates (`health_threshold`, `distance_check`, `until_received_damage`, `swarm_size`, `formation_integrity`).
- **Flow Nodes (Green)**: Iterative loops (`repeat`), multi-branch routers (`branch_switch`), and HSM state jumps (`state_transition`).
- **Special Nodes (Purple)**: Boss phase transitions (`phase_trigger`) and combat listeners (`event_listener`).

### Mode 3: Live Time-To-Kill (TTK) Matrix
A dual-mode matrix evaluating neutralization times across all Weapon vs Creature matchups:
- **Simulated Mode**: Factors in real-time behavioral exposure—diving damage immunity, turret arc tracking limits, evasive swarm scattering, and reload cycles.
- **Benchmark Mode**: Theoretical continuous fire benchmark providing clean baseline DPS comparisons.
- **Categorization**: Color-coded into **Efficient** (Green $\le 12\text{s}$), **Semi-Efficient** (Yellow $12-25\text{s}$), and **Inefficient** (Red $> 25\text{s}$).

### Mode 4: Designer Balancing Inspector
A parameter workbench providing real-time sliders for weapon ballistics, threat kinematics, and building durability.
- **Auto-Persistence**: Any modification to weapons, creature stats, or building layouts is **automatically persisted to browser LocalStorage**. Your custom tunings are preserved across browser refreshes and system reboots.
- **Threat Cloning**: One-click duplication of creature definitions and their complete behavior trees.

### Mode 5: Battle Telemetry & Analytics Dashboard
Real-time telemetry measuring sustained DPS, projectile hit rates, ammo pack expenditures, building damage logs, and list/tilt stability.

---

## Vessel Systems & Crew Management

### The 3-Track Crew Allocation Rule
The Behemoth crew is governed by a **3-track allocation architecture**:
> **Every crew member can simultaneously hold:**
> 1. **One Housing slot** (Living Quarters Capacity)
> 2. **One Job slot** (Production or Energy/Utility facility)
> 3. **One Service slot** (Medical, Dining, Training, or Social facility)

The HUD top bar tracks these three allocations independently against current living crew (`behemoth.crew`). For example, with 50 living crew members, you can assign up to 50 crew in Housing, 50 in Jobs, and 50 in Services.

---

### Building Categories & Personnel Capacity

The Behemoth's modular deck supports 4 distinct building categories:

#### 1. Production Buildings (Job Role)
Manufacturing and refining structures that convert marine and synthetic resources:
- **Workshops (Tier 1) — 3 Personnel Slots**: Basic manufacturing structures converting raw resources into initial Tier 2 components.
  - *Base Material Workshop* (3 slots, 100 HP, 35 kW draw)
  - *Efficiency Workshop* (3 slots, 100 HP, 35 kW draw)
- **Factories (Tier 2) — 4 Personnel Slots**: Mid-tier production facilities creating intermediate components and consumer goods.
  - *Consumer Factory* (4 slots, 120 HP, 55 kW draw)
  - *Parts Factory* (4 slots, 120 HP, 55 kW draw)
  - *Machine Shop* (4 slots, 120 HP, 60 kW draw)
  - *Hardware Facility* (4 slots, 130 HP, 60 kW draw)
- **Plants (Tier 3) — 5 to 7 Personnel Slots**: Heavy industrial processing facilities and refineries.
  - *Biochem Plant* (5 slots, 150 HP, 85 kW draw)
  - *Synthesis Plant* (5 slots, 150 HP, 85 kW draw)
  - *Ores Refinery* (7 slots, 180 HP, 110 kW draw)
  - *Elements Processing Plant* (7 slots, 180 HP, 115 kW draw)
- **Advanced Tech (Tier 4 & 5) — 5 to 7 Personnel Slots**: Complex, high-tech manufacturing and research installations.
  - *High-Tec Assembly Unit* (5 slots, 200 HP, 130 kW draw)
  - *CyberForge* (5 slots, 200 HP, 140 kW draw)
  - *Scientific Lab* (7 slots, 220 HP, 150 kW draw)
  - *Artifacts Lab* (7 slots, 240 HP, 160 kW draw)

#### 2. Energy & Utility Buildings (Job Role)
Generators and reactors supplying baseline megawatt capacity to the vessel power grid:
- **Generators & Reactors — 2 to 3 Personnel Slots**:
  - *Fuel Generator* (2 slots, 110 HP, +160 kW bonus)
  - *Bio Reactor* (2 slots, 120 HP, +180 kW bonus)
  - *Solar Reactor* (3 slots, 130 HP, +240 kW bonus)
  - *Fusion Core Unit* (3 slots, 220 HP, +380 kW bonus)

#### 3. Housing Types (Housing Role)
Living quarters accommodating general crew rest cycles and crew capacity:
- *Basic Living Quarters* (**10 Slots Capacity**, 120 HP, 20 kW draw): Basic non-specialized housing accommodating general crew rest cycles.
- *Advanced Living Quarters* (**20 Slots Capacity**, 180 HP, 35 kW draw): Advanced housing accommodating general crew rest cycles and enhanced recovery needs.

#### 4. Service Buildings (Service Role)
Facilities supporting crew welfare, training, and operational readiness:
- **Basic Dining & Recreation — 3 to 4 Personnel Slots**:
  - *Crew Mess Hall* (3 slots, 100 HP, 20 kW draw)
  - *Recreation Lounge* (4 slots, 110 HP, 25 kW draw)
- **Healthcare & Medical Services — 5 Personnel Slots**: Handles Healing, Awakening (hibernation capsule opening), and treatment cycles.
  - *Medbay* (5 slots, 130 HP, 45 kW draw)
  - *Health Care Center* (5 slots, 150 HP, 50 kW draw)
- **Training & Education — 4 to 5 Personnel Slots**: Provides specialization training and skill upgrades.
  - *Academy* (4 slots, 140 HP, 40 kW draw)
  - *Combat Training Facility* (5 slots, 150 HP, 50 kW draw)
- **High-Tier Social & Entertainment — 5 Personnel Slots**:
  - *Social Dome* (5 slots, 160 HP, 60 kW draw)
  - *Holodeck* (5 slots, 170 HP, 75 kW draw)
  - *Alliance Center* (5 slots, 180 HP, 65 kW draw)

---

## Predator Threats & Swarm Intelligence

### Veilfangs (Autonomous Aerial Swarm)
- **Structure**: Swarm of 14 agile flying entities with membranous wings.
- **Flight Mechanics**:
  - **Stage 1 (Cruising Flocking)**: Autonomous Reynolds Boids algorithm (Separation, Alignment, Cohesion) orbiting the Behemoth at 45 knots.
  - **Stage 2 (Reactive Scatter & Squad Assault)**:
    - *Chaotic Dissipation (0.8s)*: Struck by turret fire, entities scatter radially with aerodynamic flutter within a soft tether envelope.
    - *Squad Assault (2.2s)*: Entities form 3–5 member squads, dive onto the deck, and assault operational buildings. Each strike tick features a **60% probability of directly targeting assigned crew members**.
    - *Opposite-Sector Regroup (2.2s)*: Squads disengage from the deck and re-converge at an orbital waypoint $150^\circ$ on the opposite side of the ship.

### Aetherfin (Apex Energy Predator)
- **Structure**: Giant translucent electric leviathan.
- **Tactics**:
  - **Charging Stage (18s)**: Circles Behemoth counter-clockwise at $165\text{ kts}$, alternating between submerged depths (damage immune) and surface water (targetable).
  - **Attacking Stage (10s)**: Slides beneath the keel, rubbing against the hull to cause short-circuit power drain against 4 energy installations simultaneously, rolling a 10% stun chance per second.

### Cloning Creatures & Behavior Reusability
You can easily duplicate any dangerous predator or swarm:
1. Open the **Balancing** tab or the **Threat AI** tab.
2. Select any threat (e.g. *Veilfangs*).
3. Click the **CLONE THREAT** (or **Clone**) button.
4. The system will:
   - Create a new creature definition with a unique ID and `(Clone)` suffix.
   - **Deep-clone its entire Behavior Tree** (including all Boids flocking nodes, reactive scatter parameters, states, and transitions).
   - Automatically persist the new clone to LocalStorage.
   - Switch active editing directly to the new clone.

---

## Weapon Traverse & Firing Arc Clamping

To prevent defense turrets from firing inward through the ship's own deck and superstructure, all weapon mounts incorporate strict **Traverse Rotation Caps**:
- **Port Battery (Row 1)**: Mount faces outward at **270°** (upward / port). With a 225° cap ($\pm 112.5^\circ$), traverse is restricted between $157.5^\circ$ and $22.5^\circ$, completely blocking the $135^\circ$ inward deck arc facing starboard.
- **Starboard Battery (Row 2)**: Mount faces outward at **90°** (downward / starboard). With a 225° cap ($\pm 112.5^\circ$), traverse is restricted between $337.5^\circ$ and $202.5^\circ$, completely blocking the $135^\circ$ inward deck arc facing port.
- **In-App Adjustment**:
  - **Global Deck Toolbar**: Use the **Traverse Cap** slider in the HUD toolbar to adjust all mounts simultaneously.
  - **Individual Mount Cards**: Adjust individual turret traverse limits on each mount's HUD card.
  - **Weapon Balancing Inspector**: Set default rotation caps per weapon preset under the Balancing tab.

---

## Exporting & Unreal Engine Implementation

The simulator is built to export directly into modern 3D game engines:
1. **Behavior Trees**: Export active AI behavior pipelines as JSON via the **Export JSON** button in the Behavior Editor.
2. **Balancing Constants**: All kinematic speeds, turn rates, DPPS, cooldowns, and armor classes align with the project's Unreal Engine gameplay attribute sets.
3. **Architecture Documentation**: See [`behavior_node_system_documentation.md`](file:///Users/maya/.gemini/antigravity/brain/52abee41-605e-44ca-a1ec-8334142825e6/behavior_node_system_documentation.md) for full mathematical breakdowns of each node.

---
*Behemoth Combat Simulator — Built with React, TypeScript, TailwindCSS, and HTML5 Canvas.*
