/**
 * Behemoth Combat Simulator - System Documentation Generator
 * 
 * Provides automated export of comprehensive documentation for behavior nodes,
 * tactical canvas controls, creature behaviors, and measurement specifications.
 */

export function generateDocumentationMarkdown(): string {
  return `# Behemoth Combat Simulator — Technical & Operational Documentation

Welcome to the comprehensive reference guide for the **Behemoth Combat Simulator**. This document covers all behavior tree nodes, tactical canvas controls, creature behavioral patterns, aggression leash mechanics, and operational standards.

---

## Table of Contents
1. [Tactical Canvas Controls & Navigation](#1-tactical-canvas-controls--navigation)
2. [World Scale & Measurement Specifications](#2-world-scale--measurement-specifications)
3. [Aggression System & Leash Mechanics](#3-aggression-system--leash-mechanics)
4. [Creature Compendium](#4-creature-compendium)
5. [Behavior Tree Node Encyclopedia](#5-behavior-tree-node-encyclopedia)
   - [Action Nodes](#action-nodes-blue)
   - [Condition Nodes](#condition-nodes-yellow)
   - [Flow Control Nodes](#flow-control-nodes-green)
   - [Special Nodes](#special-nodes-purple)
6. [Crew Stances & Operational Directives](#6-crew-stances--operational-directives)
7. [Defense Batteries & Ballistics](#7-defense-batteries--ballistics)
8. [Hotkeys & Quick Reference Cheat Sheet](#8-hotkeys--quick-reference-cheat-sheet)

---

## 1. Tactical Canvas Controls & Navigation

The **Tactical Canvas** provides a real-time, 2D top-down view of the Behemoth vessel, its defensive batteries, and hostile biomolecular threats across an infinite procedural ocean grid.

### 1.1 Navigation & Waypoint System
- **Bow Navigation Origin**: All course lines and pure pursuit steering vectors originate directly from the Behemoth's forward bow arrow point (\`vesselCenter.width / 2 + 15\`), providing accurate nautical steering tracking.
- **Add Waypoints (Hold \`N\` + Left Click)**:
  - While holding the \`N\` key, left-clicking on the canvas appends a new waypoint to the Behemoth's active route.
  - The helmsman steering engine uses pure pursuit path tracking to smoothly steer towards each waypoint in sequence.
- **Rebuild Route (Hold \`Shift + N\` + Left Click)**:
  - While holding both \`Shift\` and \`N\`, left-clicking anywhere on the tactical map clears all existing waypoints and immediately creates a brand new course starting from the click point.
  - **Automatic Gear Reset**: Rebuilding a route automatically resets the vessel's transmission back to forward gear (\`FWD\`), unless the first waypoint is placed directly astern of the vessel (\`diffFromHeading >= 140°\`), in which case reverse gear (\`REV\`) is maintained.
- **Gear Selector (FWD / REV)**:
  - Located on the left helmsman panel.
  - Toggle between **Forward** (\`FWD\`) and **Reverse** (\`REV\`).
  - In Reverse gear, the Behemoth backs down along its heading vector at reduced stern thruster speed.
- **Vessel Speed Control**:
  - Speed slider allows fine throttling up to **Flank Speed** (3.0 kt/min).
  - Quick-preset buttons: **Dead Slow** (0.25 kt), **Slow** (0.5 kt), **Half** (1.0 kt), **Full** (2.0 kt), **Flank** (3.0 kt).
- **Full Stop (\`F\` Key)**:
  - Instantly drops vessel throttle to 0 knots and locks rudder commands.
- **Recenter Camera (\`R\` Key)**:
  - Instantly snaps the tactical viewport back onto the Behemoth's current GPS position.

### 1.2 Camera Panning & Decoupled Observation
- **Right Mouse Button (RMB) Drag**:
  - Holding RMB and dragging moves the camera freely across the ocean grid without moving the Behemoth or interfering with waypoint creation.
- **Decoupled Viewport Policy**:
  - The tactical camera **will not snap back** to the Behemoth while the user is actively inspecting other sectors or panning.
  - The camera only smoothly recenters automatically when the Behemoth **fully completes its final waypoint** on an active route, or when the user manually presses the **\`R\`** hotkey.
- **Zoom**:
  - Mouse wheel scrolls smoothly zoom between **0.25x** (wide theater view) and **2.50x** (deck-level tactical inspection).

### 1.3 Threat Spawning Bar
- Located prominently along the top bar of the Tactical Canvas.
- Offers instant deployment buttons for all configured creature types:
  - **+ Leviarch**: Spawns an apex Thunder Leviarch at a random orbital sector.
  - **+ Dreadlot**: Spawns an armored Dreadlot submersible beast.
  - **+ Veilfangs**: Deploys a full micro-swarm with Boids flocking coordination.
  - **+ Aetherfin**: Deploys a phase-shifting serpentine energy predator.
- **Clear Threats**: Despawns all active hostile entities and clears combat targeting locks.
- **Threat Selector**: Clicking any creature card in the bar focuses tactical telemetry and links live behavior-tree state execution.

### 1.4 Benchmark Mode
- Located in the left helmsman column directly underneath the vessel speed controls.
- Runs high-speed deterministic combat simulation ticks to benchmark frame rendering rates, computational throughput, and weapon Time-To-Kill (TTK) performance.

### 1.5 Tactical Combat Log
- Located directly underneath the Threat Spawner Bar.
- Features a **Fold / Unfold** toggle button with chevron indicator.
- Records all timestamped combat events: weapon discharges, projectile impacts, module component damage, crew injuries, creature state transitions, aggro leash status, and waypoint completions.

---

## 2. World Scale & Measurement Specifications

The simulator adheres strictly to standardized in-game and Unreal Engine conversion metrics:

| Metric | In-Game Scale | Unreal Units (UU / Game Units) | Canvas Representation |
| :--- | :--- | :--- | :--- |
| **World Grid Tile** | 2,700 meters (2.7 km) | 270,000 UU | 936 px |
| **Sub-Grid Sector** | 900 meters (0.9 km) | 90,000 UU | 312 px (3x3 per tile) |
| **Behemoth Length** | 750 meters | 75,000 UU | 260 px |
| **Behemoth Beam (Width)** | 260 meters | 26,000 UU | 90 px |
| **Base Nautical Speed** | 1 Knot (1.0 kt/min) | 3,333.33 UU/s (33.33 m/s) | ~11.55 px/s |
| **Standard Range Rings**| 500m / 1km / 1.5km / 2km / 2.5km / 3km | 50,000 to 300,000 UU | Concentric rings around vessel |

*Note: 1 Unreal Unit (UU) = 1 centimeter (0.01 meters). 1 Meter = 100 UU.*

---

## 3. Aggression System & Leash Mechanics

The Behemoth simulator features an integrated behavioral leash and aggression decay system:

- **Aggro Leash Radius (Default: 1,000 meters / 100,000 UU)**:
  - Defines the operational engagement territory of the creature.
  - While the Behemoth is within 1,000 meters of the creature, the creature maintains aggressive attack stances (approaching, striking modules, executing charge orbits).
- **Disengagement Duration (10 Consecutive Seconds)**:
  - If the Behemoth maneuvers outside the 1,000m leash radius, an internal disengagement timer begins counting.
  - If the Behemoth remains outside the aggro radius for **10 uninterrupted consecutive seconds**, the creature drops its aggressive attack stance.
  - Upon leash break, the creature enters passive/idle retreat behavior or returns to its initial spawn territory.
  - Re-entering the 1,000m radius before the 10 seconds elapse immediately resets the disengage counter and re-engages maximum aggression.

---

## 4. Creature Compendium

### 4.1 Thunder Leviarch
- **Classification**: Apex Flying Bio-Titan.
- **Flight Layer**: Aerial (cruises above the deck, immune to depth charges).
- **Core Strategy**: High-altitude dive-bombs and high-speed strafing runs.
- **Attacks**: Discharges concentrated lightning breath arcs dealing heavy Energy damage to deck superstructure and crew.
- **Defensive Profile**: Heavy chitinous exoskeleton resistant to Kinetic fire; susceptible to EMP and concentrated flak batteries.

### 4.2 Dreadlot
- **Classification**: Armored Submersible Siege Behemoth.
- **Flight Layer**: Submerged / Aquatic (operates beneath the hull).
- **Core Strategy**: Deep-sea ambushes and devastating blunt-force hull collisions.
- **Attacks**: Surfaces abruptly from beneath the vessel to ram the keel, dealing catastrophic Kinetic and Explosive structural damage to hull plating.
- **Defensive Profile**: Massive HP pool, thick submerged blubber plate; weak against underwater harpoons, depth ordnance, and armor-piercing kinetic rounds.

### 4.3 Veilfangs Swarm
- **Classification**: Aerial Micro-Swarm.
- **Flight Layer**: Low Aerial (swarms across the open deck).
- **Core Strategy**: Boids flocking dynamics (separation, alignment, cohesion) that splits into autonomous strike squads (3–5 entities per squad).
- **Attacks**: Concentrated bio-acid bites and corrosive spit targeting production modules and exposed crew members.
- **Defensive Profile**: Low individual health, but high collective evasion. Uses reactive dispersal (\`flock_dissipate_regroup\`) to scatter away from explosive impacts and regroup in opposite orbital sectors.

### 4.4 Aetherfin
- **Classification**: Orbital Phase Hunter.
- **Flight Layer**: Hybrid (alternates between surface cruising and deep submersion).
- **Core Strategy**: Continuous circular or figure-8 charging orbits around the Behemoth.
- **Attacks**: Glides directly beneath the keel to trigger \`short_circuit_drain\`, siphoning electrical energy from active ship systems and applying module stuns.
- **Defensive Profile**: High evasion and rapid acceleration; vulnerable during surface intervals when high-angle deck guns have clear line-of-sight.

---

## 5. Behavior Tree Node Encyclopedia

Every creature's artificial intelligence is governed by an extensible, state-machine driven Behavior Tree composed of four distinct node categories.

\`\`\`
Behavior Tree Structure:
[States] -> [Nodes: Action | Condition | Flow | Special] -> [Outputs: Next | True | False | Parallel]
\`\`\`

### Action Nodes (Blue)

| Node | Name | Parameters | Operational Description |
| :--- | :--- | :--- | :--- |
| \`approach\` | **Approach** | \`speed\`, \`minDistance\`, \`isFlying\`, \`underwater\`, \`acceleration\` | Directs the creature to steer directly toward the Behemoth until reaching \`minDistance\`. Supports aerial glide or submerged approach angles. |
| \`deal_damage\` | **Deal Damage** | \`damage\`, \`damageType\`, \`damageTarget\`, \`cooldown\` | Executes an offensive strike against the Behemoth's hull, buildings, or crew with specified damage type (Kinetic, Energy, Explosive, EMP, Acid, Piercing, Fire). |
| \`retreat\` | **Retreat** | \`speed\`, \`minDistance\` | Backwards tactical disengage. Moves the creature away from the Behemoth's batteries to a safer standoff range. |
| \`run_away\` | **Run Away** | \`speed\` | Full emergency flee acceleration directly away from the Behemoth, seeking to break the 1,000m aggro leash. |
| \`hide\` | **Hide** | \`duration\`, \`underwater\` | Submerges deep underwater or camouflages; dampens hitboxes and prevents weapons from acquiring target lock for the set duration. |
| \`wait_idle\` | **Wait / Idle** | \`duration\`, \`decayRate\`, \`minGlideSpeed\` | Pauses active thrust and holds position or glides with aerodynamic drag decay for the designated seconds. |
| \`scatter\` | **Scatter** | \`spreadRadius\`, \`scatterSpeed\`, \`maxDistance\`, \`randomDirections\` | Swarm dispersal command that scatters flock entities in radial evasive directions away from incoming fire. |
| \`reform\` | **Reform** | \`formationType\`, \`reformSpeed\`, \`spacing\`, \`centerPoint\` | Gathers scattered swarm entities back into a cohesive military formation (Wedge, Circle, Grid, or Line) anchored to a leader or target. |
| \`boids_flock\` | **Boids Flocking** | \`flockSeparationDist\`, \`speed\` | Runs Craig Reynolds' flocking algorithm: separation (avoid crowding neighbors), alignment (steer towards average heading), and cohesion (steer towards center of mass). |
| \`split_swarm_groups\` | **Split Swarm Groups** | \`groupMinSize\`, \`groupMaxSize\` | Partitions a large flock into smaller autonomous assault squads (e.g. 3 to 5 units each) that independently select targets. |
| \`group_approach_building\` | **Group Approach Building**| \`speed\`, \`targetBuildingSlotId\` | Directs an assault squad to fly directly toward a specific building or module slot on the Behemoth's deck. |
| \`group_strike_target\` | **Group Strike Target** | \`damage\`, \`crewAttackChance\` | Executes coordinated squad attack on a target building structure, with configurable probability of attacking exposed crew instead. |
| \`return_to_swarm\` | **Return to Swarm** | \`speed\` | Instructs an assault squad to disengage from its target and fly back to merge with the primary flock. |
| \`charge_orbit\` | **Charge Orbit** | \`orbitRadius\`, \`orbitDirection\`, \`orbitPattern\`, \`surfaceInterval\`, \`depthsInterval\` | Puts the creature into a high-speed orbit (clockwise, counter-clockwise, or figure-8) around the Behemoth, alternating between surface and subsurface layers. |
| \`short_circuit_drain\` | **Short Circuit Drain** | \`drainRatePct\`, \`stunChance\`, \`stunDuration\`, \`drainTargetCount\` | Clings to the Behemoth's underside, draining electrical grid reserves and disabling active weapon batteries with temporary stuns. |
| \`flock_dissipate_regroup\` | **Flock Dissipate & Regroup** | \`dissipateDuration\`, \`squadAssaultDuration\`, \`regroupDuration\`, \`regroupAngleOffset\` | Evasive reaction triggered by weapon impacts: immediately dissipates the flock, optional squad counter-attacks, then regroups in an opposite sector. |
| \`barrel_roll\` | **Barrel Roll / Evasive Jink** | \`speed\`, \`duration\` | High-speed lateral corkscrew maneuver that sharply alters trajectory to throw off lead-calculating ballistic batteries. |

---

### Condition Nodes (Yellow)

| Node | Name | Evaluated Metric | Description |
| :--- | :--- | :--- | :--- |
| \`until_dealt_damage\` | **Until Dealt Damage** | Cumulative damage dealt to vessel | Evaluates to TRUE once the creature has inflicted \`targetDamage\` HP to the Behemoth. |
| \`until_received_damage\`| **Until Received Damage** | Cumulative damage taken from batteries | Evaluates to TRUE once the creature has absorbed \`targetDamage\` HP from player fire. |
| \`until_aggression\` | **Until Aggression** | Aggression meter (0–100%) | Compares current creature rage/aggression against threshold using operators (\`<=\`, \`>=\`, \`==\`, \`<\`, \`>\`). |
| \`for_seconds\` | **For [X] Seconds** | Time elapsed | Maintains state for \`duration\` seconds, then transitions execution along the TRUE branch. |
| \`once\` | **Once** | Execution flag | Passes execution once, then permanently routes down the secondary branch on subsequent ticks. |
| \`health_threshold\` | **Health Threshold** | Current HP percentage | Triggers when creature HP falls below or exceeds a percentage (e.g. \`HP <= 50%\`). Used for enrage transitions. |
| \`distance_check\` | **Distance Check** | Distance to Behemoth in meters | Evaluates proximity to the vessel (e.g. \`Distance < 400m\`). |
| \`swarm_size\` | **Swarm Size** | Active surviving entities count | Triggers when swarm unit count drops below a threshold (e.g. \`Count <= 5\`). |
| \`formation_integrity\` | **Formation Integrity** | Swarm coherence (0–100%) | Triggers when the percentage of entities properly aligned in formation meets criteria. |

---

### Flow Control Nodes (Green)

| Node | Name | Description |
| :--- | :--- | :--- |
| \`repeat\` | **Repeat Loop** | Repeats its child sequence either infinitely or for a fixed counter \`repeatCount\`. |
| \`branch_switch\` | **Branch / Switch** | Evaluates a probabilistic chance (e.g. 70% branch A / 30% branch B) or conditional parameter to direct execution. |
| \`state_transition\` | **State Transition** | Transfers execution directly to a named state machine state (e.g. \`Enraged_Phase\`, \`Submerged_Stalk\`). |
| \`parallel_execute\` | **Parallel Execute** | Dispatches multiple execution threads simultaneously (e.g. running an approach vector while charging weapons). |

---

### Special Nodes (Purple)

| Node | Name | Description |
| :--- | :--- | :--- |
| \`swarm_coordination\` | **Swarm Coordination** | Synchronizes entity behaviors across the swarm, enforcing cohesion percentages and stagger delays between individual strikes. |
| \`phase_trigger\` | **Phase Trigger** | Initiates multi-phase boss transitions (e.g. Phase 1 -> Phase 2), altering creature appearance, stats, and abilities. |
| \`event_listener\` | **Event Listener** | Reacts asynchronously to combat events: \`HULL_RAMMED\`, \`STUNNED\`, \`MODULE_DESTROYED\`, \`UNDER_ATTACK\`, \`HP_LOW\`. |

---

## 6. Crew Stances & Operational Directives

The crew's alert stance governs damage mitigation, repair priorities, and battery rate-of-fire:

1. **Neutral Stance**:
   - Standard balanced battle stations.
   - Batteries fire at baseline reload cycles. Damage control teams patch damaged modules at normal speed.
2. **Hide Stance (Brace for Impact)**:
   - Crew retreats into reinforced armored bunkers beneath the deck.
   - **+65% Crew Casualty Mitigation**: Protects crew numbers from high-explosive shrapnel, bio-acid, and lightning arcs.
   - **Trade-off**: Battery reload times are slowed by 40% due to minimal topside gun crews.
3. **Attack Stance (All Guns Active)**:
   - All crew members are assigned to ammunition handling and manual turret tracking.
   - **+25% Battery Fire Rate**: Maximizes projectile output against fast-moving targets.
   - **Trade-off**: Crew remains fully exposed to bio-weapon splash damage on deck.

---

## 7. Defense Batteries & Ballistics

The Behemoth's dorsal decks and broadsides feature modular weapon sockets:
- **Port & Starboard Heavy Broadsides**: High-caliber naval rifles firing Armor-Piercing Kinetic shells.
- **Dorsal High-Angle Batteries**: Anti-air flak cannons delivering proximity-fused Explosive fragmentation against aerial bio-titans.
- **Point Defense Gatlings (PDC)**: High-rate-of-fire rotary cannons designed to intercept fast-moving micro-swarms and bio-projectiles.
- **Harpoon Launchers**: Fires tethered kinetic harpoons to pin submersibles and prevent diving.
- **EMP Pulse Projectors**: Fires localized electrical disruptions that drain kinetic barriers and stun bio-energy organs.

---

## 8. Hotkeys & Quick Reference Cheat Sheet

| Input | Action |
| :--- | :--- |
| **\`N\` + Left Click** | Add new waypoint to active navigation path |
| **\`Shift + N\` + Left Click** | Rebuild entire route from click position (auto-resets gear to FWD unless clicking astern) |
| **Right Mouse Button Drag** | Pan tactical camera freely without moving vessel |
| **Mouse Wheel** | Zoom camera in / out (0.25x – 2.50x) |
| **\`R\` Key** | Recenter camera on the Behemoth |
| **\`F\` Key** | Full Stop (set vessel throttle to 0 knots immediately) |
| **\`Spacebar\`** | Pause / Resume simulation |
| **\`Cmd + S\` / \`Ctrl + S\`** | Save current creature parameters & balance configuration to project files |
| **DOCS Button** | Download this full markdown documentation package |

---
*Generated by Behemoth Combat Simulator Engine.*
`;
}

/**
 * Initiates a browser download of the complete Markdown documentation file.
 */
export function downloadDocumentation(): void {
  try {
    const markdownContent = generateDocumentationMarkdown();
    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `combatsim-documentation-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to download simulator documentation:', error);
  }
}
