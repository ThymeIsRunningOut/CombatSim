import { WeaponDef, CreatureDef, BuildingDef, CrewSimulationConfig, HateMatrix, CombatConfig, FleetSpeciesDef, FleetFactionDef, DeckLoadoutPreset } from '../types/combat';

export const DEFAULT_CREW_CONFIG: CrewSimulationConfig = {
  "minOnDeckPercent": 20,
  "maxOnDeckPercent": 90,
  "instaKillChance": 0.1,
  "hurtHiddenChance": 0.15,
  "damageFrequency": 1,
  "damageAmount": 20,
  "pdwDamage": 5,
  "pdwRange": 192.3,
  "pdwFireRate": 1.5
};

export const DEFAULT_WEAPONS: WeaponDef[] = [
  {
    "id": "gatling_gun",
    "name": "Gatling Gun",
    "damageType": "Physical",
    "dpp": 5,
    "dps": 30,
    "fireRate": 6.5,
    "fireDuration": 14,
    "cooldownDuration": 3,
    "projectileSpeed": 1000,
    "trajectory": "Line",
    "aoe": 0,
    "coneRadius": 1,
    "turnSpeed": 360,
    "duration": 0.05,
    "pushback": 0,
    "cooldown": 0.1538,
    "ammoType": "Kinetic Shells",
    "ammoCapacity": 300,
    "packName": "Standard Ammunition Pack",
    "chargesPerPack": 300,
    "ammoPerShot": 1,
    "reloadTime": 2.8,
    "powerDraw": 60,
    "color": "#f59e0b",
    "distance": 1200,
    "detectionRange": 1200,
    "spreadDeg": 2,
    "shootingArea": 2
  },
  {
    "id": "photon_gun",
    "name": "Photon Gun",
    "damageType": "Energy",
    "dpp": 250,
    "dps": 100,
    "fireRate": 0.6,
    "fireDuration": 6,
    "cooldownDuration": 8,
    "projectileSpeed": 1000,
    "trajectory": "Line",
    "aoe": 0,
    "coneRadius": 1,
    "turnSpeed": 60,
    "duration": 0.8,
    "pushback": 0,
    "cooldown": 1.67,
    "ammoType": "Energy Cells",
    "ammoCapacity": 72,
    "packName": "Battery Block",
    "chargesPerPack": 72,
    "ammoPerShot": 1,
    "reloadTime": 5,
    "powerDraw": 220,
    "color": "#a855f7",
    "distance": 1200,
    "detectionRange": 1200,
    "spreadDeg": 0,
    "shootingArea": 10,
    "pierceCount": 6
  },
  {
    "id": "grenade_launcher",
    "name": "Grenade Launcher",
    "damageType": "Physical",
    "dpp": 75,
    "dps": 50,
    "fireRate": 1,
    "fireDuration": 5,
    "cooldownDuration": 3,
    "projectileSpeed": 300,
    "trajectory": "Arch",
    "aoe": 60,
    "aoeFalloff": 0.3,
    "coneRadius": 1,
    "turnSpeed": 5.2,
    "duration": 0.6,
    "pushback": 100,
    "cooldown": 1,
    "ammoType": "Kinetic Shells",
    "ammoCapacity": 30,
    "packName": "Explosive Charges",
    "chargesPerPack": 30,
    "ammoPerShot": 1,
    "reloadTime": 3,
    "powerDraw": 85,
    "color": "#ef4444",
    "distance": 1200,
    "detectionRange": 1200,
    "spreadDeg": 2,
    "shootingArea": 2
  }
];

export const DEFAULT_CREATURES: CreatureDef[] = [
  {
    "id": "thunder_leviarch",
    "name": "Thunder Leviarch",
    "description": "Fast hit-and-run predator that hides underwater, breaches to rain spike volleys on the hull and deck buildings, and keel-scrapes the hull with its tail from below.",
    "hp": 900,
    "physicalArmor": 0,
    "armorClass": 0,
    "energyResistance": 0.55,
    "quantity": 1,
    "movementSpeed": 14.5,
    "acceleration": 82,
    "deceleration": 71,
    "turningRate": 36.5,
    "aggroRadiusMeters": 2000,
    "underwaterInterval": 7.5,
    "surfaceInterval": 4.5,
    "chargeWindup": 1,
    "strikeDuration": 1,
    "strikeCooldown": 3.2,
    "strikeDamageRate": 33,
    "strikeStunChance": 0.4,
    "strikeStunDuration": 2,
    "strikeRamMass": 9,
    "canShootDeck": true,
    "spikeCount": 5,
    "spikeDamage": 30,
    "scrapeCausesTilt": false,
    "dodgeChance": 0.95,
    "dodgeReactionTime": 0.15,
    "dodgeSpeedMultiplier": 3,
    "deckAttackRange": 692.3,
    "attackTarget": "hull",
    "spikeHullDamage": 4,
    "attackTargets": [
      "hull",
      "buildings",
      "crew"
    ],
    "iconColor": "#eab308",
    "radius": 46.2,
    "isFlying": true,
    "locomotionType": "flying",
    "emoji": "🦈",
    "barrierCharges": 6,
    "barrierCooldown": 12,
    "crowdDispersion": 32
  },
  {
    "id": "dreadlot",
    "name": "Dreadlot",
    "description": "Armored sea titan. High physical armor class and ramming mass causing devastating hull tilt impulses and capsizing risk.",
    "hp": 1600,
    "physicalArmor": 2000,
    "armorClass": 40,
    "energyResistance": 0.3,
    "quantity": 1,
    "movementSpeed": 11,
    "acceleration": 42,
    "deceleration": 26,
    "turningRate": 26,
    "underwaterInterval": 6,
    "surfaceInterval": 9,
    "chargeWindup": 0.8,
    "strikeDuration": 0.8,
    "strikeCooldown": 5,
    "strikeDamageRate": 60,
    "strikeStunChance": 0.35,
    "strikeStunDuration": 2.2,
    "strikeRamMass": 28,
    "canShootDeck": false,
    "attackTarget": "hull",
    "attackTargets": [
      "hull"
    ],
    "iconColor": "#ef4444",
    "radius": 70,
    "isFlying": false,
    "locomotionType": "non-flying",
    "emoji": "🐋",
    "aggroRadiusMeters": 1000,
    "ramBurstSpeed": 1.35,
    "crowdDispersion": 32
  },
  {
    "id": "veilfangs",
    "name": "Veilfangs",
    "description": "Rapid swarmers weak to fast multi-shot weapons like the Gatling Gun. Individually fragile; single-target beams cannot wipe clusters.",
    "hp": 5,
    "physicalArmor": 0,
    "armorClass": 0,
    "energyResistance": 0.96,
    "quantity": 30,
    "crowdDispersion": 175.5,
    "movementSpeed": 20,
    "acceleration": 68,
    "deceleration": 56,
    "turningRate": 81.9,
    "underwaterInterval": 3.5,
    "surfaceInterval": 12,
    "chargeWindup": 1.2,
    "strikeDuration": 0.5,
    "strikeCooldown": 2,
    "strikeDamageRate": 20,
    "strikeStunChance": 0.05,
    "strikeStunDuration": 0.5,
    "strikeRamMass": 1,
    "canShootDeck": false,
    "attackTarget": "crew",
    "attackTargets": [
      "crew",
      "buildings"
    ],
    "iconColor": "#f97316",
    "radius": 10,
    "isFlying": true,
    "locomotionType": "flying",
    "aggroRadiusMeters": 1000,
    "dodgeChance": 0.8,
    "dodgeReactionTime": 0.1,
    "dodgeSpeedMultiplier": 3.5
  },
  {
    "id": "aetherfin",
    "name": "Aetherfin",
    "description": "Bioluminescent aquatic predator with crystalline energy-deflecting scales (96% energy resistance), low armor class, vulnerable to concussive explosives.",
    "hp": 1000,
    "physicalArmor": 300,
    "armorClass": 3,
    "energyResistance": 0.96,
    "quantity": 1,
    "movementSpeed": 12,
    "acceleration": 56,
    "deceleration": 45,
    "turningRate": 52.1,
    "underwaterInterval": 4,
    "surfaceInterval": 9,
    "chargeWindup": 1.5,
    "strikeDuration": 0.8,
    "strikeCooldown": 3.5,
    "strikeDamageRate": 180,
    "strikeStunChance": 0.2,
    "strikeStunDuration": 1.5,
    "strikeRamMass": 8,
    "canShootDeck": false,
    "attackTarget": "buildings",
    "attackTargets": [
      "buildings"
    ],
    "pursueStyle": "orbit_drain",
    "chargeStageDuration": 18,
    "surfaceDuration": 3,
    "depthsDuration": 3,
    "attackDuration": 7,
    "drainTargetCount": 4,
    "drainRatePct": 4,
    "drainStunChance": 0.1,
    "drainStunDuration": 10,
    "drainStunCount": 1,
    "energyWeightDivisor": 4,
    "iconColor": "#06b6d4",
    "radius": 42.3,
    "isFlying": false,
    "locomotionType": "non-flying",
    "emoji": "🐉",
    "aggroRadiusMeters": 1000,
    "crowdDispersion": 32,
    "retreatDistanceM": 2000
  }
];

export const DEFAULT_BUILDINGS: BuildingDef[] = [
  {
    "id": "base_material_workshop",
    "name": "Base Material Workshop",
    "description": "Basic manufacturing converting raw marine resources into initial Tier 2 components.",
    "category": "job",
    "subCategory": "Workshops (Tier 1)",
    "tier": "Tier 1",
    "crewRole": "job",
    "maxHealth": 100,
    "powerBonus": 0,
    "powerDraw": 35,
    "color": "#f59e0b",
    "requiredCrew": 1,
    "maxCrew": 3
  },
  {
    "id": "efficiency_workshop",
    "name": "Efficiency Workshop",
    "description": "Specialized fabrication bay optimizing component yields and repair efficiency.",
    "category": "job",
    "subCategory": "Workshops (Tier 1)",
    "tier": "Tier 1",
    "crewRole": "job",
    "maxHealth": 100,
    "powerBonus": 0,
    "powerDraw": 35,
    "color": "#f59e0b",
    "requiredCrew": 1,
    "maxCrew": 3
  },
  {
    "id": "consumer_factory",
    "name": "Consumer Factory",
    "description": "Mid-tier production facility creating intermediate components and consumer goods.",
    "category": "job",
    "subCategory": "Factories (Tier 2)",
    "tier": "Tier 2",
    "crewRole": "job",
    "maxHealth": 120,
    "powerBonus": 0,
    "powerDraw": 55,
    "color": "#fb923c",
    "requiredCrew": 1,
    "maxCrew": 4
  },
  {
    "id": "parts_factory",
    "name": "Parts Factory",
    "description": "Automated stamping and casting facility for vessel replacement hardware.",
    "category": "job",
    "subCategory": "Factories (Tier 2)",
    "tier": "Tier 2",
    "crewRole": "job",
    "maxHealth": 120,
    "powerBonus": 0,
    "powerDraw": 55,
    "color": "#fb923c",
    "requiredCrew": 1,
    "maxCrew": 4
  },
  {
    "id": "machine_shop",
    "name": "Machine Shop",
    "description": "Precision machining facility fabricating structural joints and gearings.",
    "category": "job",
    "subCategory": "Factories (Tier 2)",
    "tier": "Tier 2",
    "crewRole": "job",
    "maxHealth": 120,
    "powerBonus": 0,
    "powerDraw": 60,
    "color": "#fb923c",
    "requiredCrew": 1,
    "maxCrew": 4
  },
  {
    "id": "hardware_facility",
    "name": "Hardware Facility",
    "description": "Industrial installation constructing heavy deck fittings and weapon chassis.",
    "category": "job",
    "subCategory": "Factories (Tier 2)",
    "tier": "Tier 2",
    "crewRole": "job",
    "maxHealth": 130,
    "powerBonus": 0,
    "powerDraw": 60,
    "color": "#fb923c",
    "requiredCrew": 1,
    "maxCrew": 4
  },
  {
    "id": "biochem_plant",
    "name": "Biochem Plant",
    "description": "Heavy chemical synthesis refining creature enzymes and organic polymers.",
    "category": "job",
    "subCategory": "Plants (Tier 3)",
    "tier": "Tier 3",
    "crewRole": "job",
    "maxHealth": 150,
    "powerBonus": 0,
    "powerDraw": 85,
    "color": "#10b981",
    "requiredCrew": 2,
    "maxCrew": 5
  },
  {
    "id": "synthesis_plant",
    "name": "Synthesis Plant",
    "description": "Continuous chemical refining plant producing high-yield energetic composites.",
    "category": "job",
    "subCategory": "Plants (Tier 3)",
    "tier": "Tier 3",
    "crewRole": "job",
    "maxHealth": 150,
    "powerBonus": 0,
    "powerDraw": 85,
    "color": "#10b981",
    "requiredCrew": 2,
    "maxCrew": 5
  },
  {
    "id": "ores_refinery",
    "name": "Ores Refinery",
    "description": "High-heat smelter and magnetic slag separator processing raw mineral dredgings.",
    "category": "job",
    "subCategory": "Plants (Tier 3)",
    "tier": "Tier 3",
    "crewRole": "job",
    "maxHealth": 180,
    "powerBonus": 0,
    "powerDraw": 110,
    "color": "#059669",
    "requiredCrew": 2,
    "maxCrew": 7
  },
  {
    "id": "elements_processing_plant",
    "name": "Elements Processing Plant",
    "description": "Centrifugal isotopic separation plant extracting rare heavy metals and alloys.",
    "category": "job",
    "subCategory": "Plants (Tier 3)",
    "tier": "Tier 3",
    "crewRole": "job",
    "maxHealth": 180,
    "powerBonus": 0,
    "powerDraw": 115,
    "color": "#059669",
    "requiredCrew": 2,
    "maxCrew": 7
  },
  {
    "id": "hightec_assembly_unit",
    "name": "High-Tec Assembly Unit",
    "description": "Micro-gravimetric robotic cleanroom assembling advanced sensor arrays.",
    "category": "job",
    "subCategory": "Advanced Tech (Tier 4 & 5)",
    "tier": "Tier 4",
    "crewRole": "job",
    "maxHealth": 200,
    "powerBonus": 0,
    "powerDraw": 130,
    "color": "#8b5cf6",
    "requiredCrew": 2,
    "maxCrew": 5
  },
  {
    "id": "cyberforge",
    "name": "CyberForge",
    "description": "Direct optical nanolithography foundry printing photonic waveguides.",
    "category": "job",
    "subCategory": "Advanced Tech (Tier 4 & 5)",
    "tier": "Tier 4",
    "crewRole": "job",
    "maxHealth": 200,
    "powerBonus": 0,
    "powerDraw": 140,
    "color": "#8b5cf6",
    "requiredCrew": 2,
    "maxCrew": 5
  },
  {
    "id": "scientific_lab",
    "name": "Scientific Lab",
    "description": "Comprehensive research and development laboratory decoding titan biology.",
    "category": "job",
    "subCategory": "Advanced Tech (Tier 4 & 5)",
    "tier": "Tier 5",
    "crewRole": "job",
    "maxHealth": 220,
    "powerBonus": 0,
    "powerDraw": 150,
    "color": "#a855f7",
    "requiredCrew": 3,
    "maxCrew": 7
  },
  {
    "id": "artifacts_lab",
    "name": "Artifacts Lab",
    "description": "High-containment isolation chamber decoding and retrofitting alien artifacts.",
    "category": "job",
    "subCategory": "Advanced Tech (Tier 4 & 5)",
    "tier": "Tier 5",
    "crewRole": "job",
    "maxHealth": 240,
    "powerBonus": 0,
    "powerDraw": 160,
    "color": "#a855f7",
    "requiredCrew": 3,
    "maxCrew": 7
  },
  {
    "id": "fuel_generator",
    "name": "Fuel Generator",
    "description": "Standard hydrocarbon turbine supplying reliable auxiliary megawatts.",
    "category": "energy",
    "subCategory": "Generators & Reactors",
    "crewRole": "job",
    "maxHealth": 110,
    "powerBonus": 160,
    "powerDraw": 0,
    "color": "#eab308",
    "requiredCrew": 1,
    "maxCrew": 2
  },
  {
    "id": "bio_reactor",
    "name": "Bio Reactor",
    "description": "Algal digestion and bio-gas converter generating power from organic biomass.",
    "category": "energy",
    "subCategory": "Generators & Reactors",
    "crewRole": "job",
    "maxHealth": 120,
    "powerBonus": 180,
    "powerDraw": 0,
    "color": "#eab308",
    "requiredCrew": 1,
    "maxCrew": 2
  },
  {
    "id": "solar_reactor",
    "name": "Solar Reactor",
    "description": "High-efficiency photovoltaic concentrating array capturing maritime radiation.",
    "category": "energy",
    "subCategory": "Generators & Reactors",
    "crewRole": "job",
    "maxHealth": 130,
    "powerBonus": 240,
    "powerDraw": 0,
    "color": "#facc15",
    "requiredCrew": 1,
    "maxCrew": 3
  },
  {
    "id": "fusion_core_unit",
    "name": "Fusion Core Unit",
    "description": "Magnetic pinch tokamak reactor outputting massive baseline grid capacity.",
    "category": "energy",
    "subCategory": "Generators & Reactors",
    "crewRole": "job",
    "maxHealth": 220,
    "powerBonus": 380,
    "powerDraw": 0,
    "color": "#fde047",
    "requiredCrew": 2,
    "maxCrew": 3
  },
  {
    "id": "basic_living_quarters",
    "name": "Basic Living Quarters",
    "description": "Basic non-specialized housing accommodating general crew rest cycles and basic rest needs.",
    "category": "housing",
    "subCategory": "Housing Types",
    "crewRole": "housing",
    "maxHealth": 120,
    "powerBonus": 0,
    "powerDraw": 20,
    "color": "#38bdf8",
    "requiredCrew": 0,
    "maxCrew": 10
  },
  {
    "id": "advanced_living_quarters",
    "name": "Advanced Living Quarters",
    "description": "Advanced housing accommodating general crew rest cycles and enhanced recovery needs.",
    "category": "housing",
    "subCategory": "Housing Types",
    "crewRole": "housing",
    "maxHealth": 180,
    "powerBonus": 0,
    "powerDraw": 35,
    "color": "#0284c7",
    "requiredCrew": 0,
    "maxCrew": 20
  },
  {
    "id": "crew_mess_hall",
    "name": "Crew Mess Hall",
    "description": "Communal dining galley and nourishment distribution maintaining crew morale.",
    "category": "service",
    "subCategory": "Basic Dining & Recreation",
    "crewRole": "service",
    "maxHealth": 100,
    "powerBonus": 0,
    "powerDraw": 20,
    "color": "#34d399",
    "requiredCrew": 1,
    "maxCrew": 3
  },
  {
    "id": "recreation_lounge",
    "name": "Recreation Lounge",
    "description": "Leisure facility providing rest areas and psychological decompression.",
    "category": "service",
    "subCategory": "Basic Dining & Recreation",
    "crewRole": "service",
    "maxHealth": 110,
    "powerBonus": 0,
    "powerDraw": 25,
    "color": "#34d399",
    "requiredCrew": 1,
    "maxCrew": 4
  },
  {
    "id": "medbay",
    "name": "Medbay",
    "description": "Field hospital and triage.",
    "category": "service",
    "subCategory": "Healthcare & Medical Services",
    "crewRole": "service",
    "maxHealth": 100,
    "powerBonus": 0,
    "powerDraw": 40,
    "color": "#4ade80",
    "requiredCrew": 2,
    "maxCrew": 6
  },
  {
    "id": "healthcare_center",
    "name": "Health Care Center",
    "description": "Comprehensive medical center with automated surgery suites and trauma pods.",
    "category": "service",
    "subCategory": "Healthcare & Medical Services",
    "crewRole": "service",
    "maxHealth": 150,
    "powerBonus": 0,
    "powerDraw": 50,
    "color": "#4ade80",
    "requiredCrew": 1,
    "maxCrew": 5
  },
  {
    "id": "academy",
    "name": "Academy",
    "description": "Provides specialization training and skill upgrade services for crew members.",
    "category": "service",
    "subCategory": "Training & Education",
    "crewRole": "service",
    "maxHealth": 140,
    "powerBonus": 0,
    "powerDraw": 40,
    "color": "#60a5fa",
    "requiredCrew": 1,
    "maxCrew": 4
  },
  {
    "id": "combat_training_facility",
    "name": "Combat Training Facility",
    "description": "Tactical combat simulator providing firearms proficiency and anti-air gunnery drills.",
    "category": "service",
    "subCategory": "Training & Education",
    "crewRole": "service",
    "maxHealth": 150,
    "powerBonus": 0,
    "powerDraw": 50,
    "color": "#60a5fa",
    "requiredCrew": 1,
    "maxCrew": 5
  },
  {
    "id": "social_dome",
    "name": "Social Dome",
    "description": "Reinforced bio-dome providing panoramic ocean views and luxury gatherings.",
    "category": "service",
    "subCategory": "High-Tier Social & Entertainment",
    "crewRole": "service",
    "maxHealth": 160,
    "powerBonus": 0,
    "powerDraw": 60,
    "color": "#ec4899",
    "requiredCrew": 2,
    "maxCrew": 5
  },
  {
    "id": "holodeck",
    "name": "Holodeck",
    "description": "Holographic simulation chamber providing synthetic entertainment environments.",
    "category": "service",
    "subCategory": "High-Tier Social & Entertainment",
    "crewRole": "service",
    "maxHealth": 170,
    "powerBonus": 0,
    "powerDraw": 75,
    "color": "#f43f5e",
    "requiredCrew": 2,
    "maxCrew": 5
  },
  {
    "id": "alliance_center",
    "name": "Alliance Center",
    "description": "Diplomatic lounge facilitating faction negotiations and fleet coordination.",
    "category": "service",
    "subCategory": "High-Tier Social & Entertainment",
    "crewRole": "service",
    "maxHealth": 180,
    "powerBonus": 0,
    "powerDraw": 65,
    "color": "#ec4899",
    "requiredCrew": 2,
    "maxCrew": 5
  },
  {
    "id": "crew_quarters",
    "name": "Crew Quarters",
    "description": "Barracks and mess for the ship crew.",
    "maxHealth": 100,
    "powerBonus": 0,
    "powerDraw": 20,
    "color": "#38bdf8",
    "requiredCrew": 1,
    "maxCrew": 10
  },
  {
    "id": "generator",
    "name": "Generator",
    "description": "Auxiliary reactor: adds power capacity while intact.",
    "maxHealth": 100,
    "powerBonus": 200,
    "powerDraw": 0,
    "color": "#facc15",
    "requiredCrew": 2,
    "maxCrew": 6
  },
  {
    "id": "workshop",
    "name": "Workshop",
    "description": "Repair bay and fabrication.",
    "maxHealth": 100,
    "powerBonus": 0,
    "powerDraw": 60,
    "color": "#fb923c",
    "requiredCrew": 2,
    "maxCrew": 6
  },
  {
    "id": "radar_array",
    "name": "Radar Array",
    "description": "Sensor mast and sonar relay.",
    "maxHealth": 100,
    "powerBonus": 0,
    "powerDraw": 50,
    "color": "#a78bfa",
    "requiredCrew": 1,
    "maxCrew": 4
  },
  {
    "id": "armory",
    "name": "Armory",
    "description": "Ammunition storage and small arms.",
    "maxHealth": 100,
    "powerBonus": 0,
    "powerDraw": 10,
    "color": "#f87171",
    "requiredCrew": 1,
    "maxCrew": 4
  }
];

export const DEFAULT_HATE_MATRIX: HateMatrix = {
  "behemoth": {
    "behemoth": false,
    "thunder_leviarch": true,
    "dreadlot": true,
    "veilfangs": true,
    "aetherfin": true
  },
  "thunder_leviarch": {
    "behemoth": true,
    "thunder_leviarch": false,
    "dreadlot": false,
    "veilfangs": false,
    "aetherfin": false
  },
  "dreadlot": {
    "behemoth": true,
    "thunder_leviarch": false,
    "dreadlot": false,
    "veilfangs": false,
    "aetherfin": false
  },
  "veilfangs": {
    "behemoth": true,
    "thunder_leviarch": false,
    "dreadlot": false,
    "veilfangs": false,
    "aetherfin": false
  },
  "aetherfin": {
    "behemoth": true,
    "thunder_leviarch": false,
    "dreadlot": false,
    "veilfangs": false,
    "aetherfin": false
  },
  "nasobi": {
    "auri": true,
    "knidaria": true,
    "aetherids": true,
    "crabari": true
  },
  "auri": {
    "nasobi": true,
    "aetherids": true
  },
  "knidaria": {
    "nasobi": true,
    "crabari": true,
    "aetherids": true
  },
  "crabari": {
    "knidaria": true,
    "aetherids": true,
    "nasobi": true
  },
  "aetherids": {
    "crabari": true,
    "auri": true,
    "nasobi": true,
    "knidaria": true
  },
  "nasobi_faction_mwm6da38": {
    "nasobi_free_captains": true
  },
  "nasobi_free_captains": {
    "nasobi_faction_mwm6da38": true
  },
  "nasobi_faction_mwm6m3kb": {
    "nasobi_iron_reef": true
  },
  "nasobi_iron_reef": {
    "nasobi_faction_mwm6m3kb": true
  },
  "auri_faction_mwm711f2": {
    "auri_temple_guard": true
  },
  "auri_temple_guard": {
    "auri_faction_mwm711f2": true
  },
  "crabari_faction_mwm6zz1l": {
    "crabari_shellbound": true,
    "crabari_faction_mwm6zpma": true
  },
  "crabari_shellbound": {
    "crabari_faction_mwm6zz1l": true,
    "crabari_faction_mwm6zpma": true
  },
  "crabari_faction_mwm6zpma": {
    "crabari_faction_mwm6zz1l": true,
    "crabari_shellbound": true
  }
};

export const DEFAULT_COMBAT_CONFIG: CombatConfig = {
  "underwaterDamageReduction": 0.65,
  "overdrivePowerDraw": 1000,
  "aoeHullSafety": true
};

export const DEFAULT_FLEET_SPECIES: FleetSpeciesDef[] = [
  {
    "id": "nasobi",
    "name": "Nasobi",
    "description": "Pirate galley flotilla: cannon volleys from standoff range, boarding parties and fire-ships. Scatters under fire, routs after a third of the ships are lost.",
    "color": "#d97706",
    "formationSpacingM": 90,
    "scatterDuration": 6,
    "routLossFraction": 0.34,
    "aggroRadiusM": 1500,
    "retreatMode": "leave",
    "shipTypes": [
      {
        "id": "nasobi_galley",
        "name": "Galley",
        "count": 4,
        "hp": 150,
        "armor": 100,
        "armorClass": 0,
        "energyResistance": 0.2,
        "speed": 10,
        "radiusM": 24,
        "layer": "surface",
        "movement": "standoff",
        "preferredRangeM": 550,
        "turnRate": 12.8,
        "emoji": "⛵",
        "scatterOnHit": true,
        "weaponMultipliers": {
          "gatling_gun": 1.5,
          "photon_gun": 0.4,
          "grenade_launcher": 1
        },
        "weapons": [
          {
            "id": "cannon_volley",
            "name": "Cannon Volley",
            "kind": "cannon",
            "damageType": "Physical",
            "damage": 30,
            "count": 3,
            "rangeM": 800,
            "cooldown": 30,
            "projectileSpeed": 900,
            "spreadDeg": 4,
            "target": "random",
            "targetMultipliers": {
              "knidaria": 2.5,
              "aetherids": 2.5
            }
          },
          {
            "id": "boarding",
            "name": "Boarding Party",
            "kind": "boarding",
            "damageType": "Physical",
            "damage": 0,
            "count": 4,
            "rangeM": 450,
            "cooldown": 300,
            "target": "buildings",
            "boarderHp": 20,
            "boarderDamage": 10,
            "boarderSpeed": 12,
            "boarderRetreatDamage": 150
          }
        ]
      },
      {
        "id": "nasobi_tender",
        "name": "Brander Tender",
        "count": 1,
        "hp": 200,
        "armor": 100,
        "armorClass": 0,
        "energyResistance": 0.2,
        "speed": 10,
        "radiusM": 26,
        "layer": "surface",
        "movement": "standoff",
        "preferredRangeM": 650,
        "turnRate": 12.8,
        "emoji": "🚢",
        "scatterOnHit": true,
        "weaponMultipliers": {
          "gatling_gun": 1.5,
          "photon_gun": 0.4,
          "grenade_launcher": 1
        },
        "weapons": [
          {
            "id": "cannon_volley",
            "name": "Cannon Volley",
            "kind": "cannon",
            "damageType": "Physical",
            "damage": 30,
            "count": 3,
            "rangeM": 800,
            "cooldown": 30,
            "projectileSpeed": 900,
            "spreadDeg": 4,
            "target": "random",
            "targetMultipliers": {
              "knidaria": 2.5,
              "aetherids": 2.5
            }
          },
          {
            "id": "brander",
            "name": "Brander Fire-Ship",
            "kind": "fireship",
            "damageType": "Physical",
            "damage": 250,
            "rangeM": 900,
            "cooldown": 300,
            "projectileSpeed": 675,
            "target": "random",
            "craftHp": 60,
            "craftRadiusM": 25,
            "aoeM": 60
          }
        ]
      }
    ]
  },
  {
    "id": "knidaria",
    "name": "Knidaria",
    "description": "Leviathan that stalks submerged and surfaces to fire its photon beam. Acid spray, sonic slows and regeneration below 25% HP.",
    "color": "#a855f7",
    "formationSpacingM": 200,
    "scatterDuration": 0,
    "routLossFraction": 0,
    "aggroRadiusM": 1600,
    "retreatMode": "leave",
    "shipTypes": [
      {
        "id": "knidaria_leviathan",
        "name": "Leviathan",
        "count": 1,
        "hp": 900,
        "armor": 50,
        "armorClass": 6,
        "energyResistance": 0,
        "speed": 8,
        "speedSubmerged": 13,
        "radiusM": 60,
        "layer": "diving",
        "movement": "standoff",
        "preferredRangeM": 450,
        "turnRate": 11,
        "emoji": "🪼",
        "weaponMultipliers": {
          "photon_gun": 1.5,
          "gatling_gun": 0.5,
          "grenade_launcher": 0.8
        },
        "regenBelowPct": 25,
        "regenPct": 12.5,
        "regenDuration": 10,
        "regenCooldown": 300,
        "weapons": [
          {
            "id": "photon_beam",
            "name": "Photon Beam",
            "kind": "beam",
            "damageType": "Energy",
            "damage": 60,
            "rangeM": 700,
            "cooldown": 30,
            "duration": 3,
            "requiresSurface": true,
            "target": "random",
            "targetMultipliers": {
              "crabari": 2.5,
              "aetherids": 3,
              "nasobi": 0.5
            }
          },
          {
            "id": "acid_spray",
            "name": "Acid Spray",
            "kind": "dot",
            "damageType": "Chemical",
            "damage": 10,
            "rangeM": 400,
            "cooldown": 15,
            "duration": 10,
            "target": "hull",
            "targetMultipliers": {
              "crabari": 2.5,
              "aetherids": 3,
              "nasobi": 0.5
            }
          },
          {
            "id": "sonic_slow",
            "name": "Sonic Pulse",
            "kind": "pulse",
            "damageType": "Physical",
            "damage": 0,
            "rangeM": 600,
            "cooldown": 4,
            "slowPct": 25,
            "slowDuration": 2.5
          },
          {
            "id": "deep_sonic",
            "name": "Underwater Sonic Attack",
            "kind": "dot",
            "damageType": "Physical",
            "damage": 8,
            "rangeM": 600,
            "cooldown": 300,
            "duration": 60,
            "target": "hull",
            "targetMultipliers": {
              "crabari": 2.5,
              "aetherids": 3,
              "nasobi": 0.5
            }
          }
        ]
      }
    ]
  },
  {
    "id": "crabari",
    "name": "Crabari",
    "description": "Armored crab titans that close in from independent angles: tail strikes, deck-boarding attacks that tilt the ship, and dive attacks that slow it.",
    "color": "#ef4444",
    "formationSpacingM": 150,
    "scatterDuration": 0,
    "routLossFraction": 0.5,
    "aggroRadiusM": 1400,
    "retreatMode": "leave",
    "shipTypes": [
      {
        "id": "crabari_creature",
        "name": "Crabari",
        "count": 2,
        "hp": 700,
        "armor": 300,
        "armorClass": 10,
        "energyResistance": 0,
        "speed": 10,
        "speedSubmerged": 12,
        "radiusM": 45,
        "layer": "diving",
        "movement": "close",
        "preferredRangeM": 40,
        "turnRate": 16.5,
        "emoji": "🦀",
        "weaponMultipliers": {
          "grenade_launcher": 1.5,
          "photon_gun": 1.5,
          "gatling_gun": 0.5
        },
        "weapons": [
          {
            "id": "tail_strike",
            "name": "Tail Strike",
            "kind": "melee",
            "damageType": "Physical",
            "damage": 50,
            "rangeM": 90,
            "cooldown": 4.5,
            "target": "hull",
            "targetMultipliers": {
              "knidaria": 0.6
            }
          },
          {
            "id": "board_attack",
            "name": "Board Attack",
            "kind": "melee",
            "damageType": "Physical",
            "damage": 100,
            "rangeM": 60,
            "cooldown": 35,
            "target": "random",
            "tilt": 6,
            "targetMultipliers": {
              "knidaria": 0.6
            }
          },
          {
            "id": "dive_attack",
            "name": "Dive Attack",
            "kind": "melee",
            "damageType": "Physical",
            "damage": 50,
            "rangeM": 120,
            "cooldown": 20,
            "slowPct": 50,
            "slowDuration": 10,
            "target": "hull",
            "targetMultipliers": {
              "knidaria": 0.6
            }
          }
        ]
      }
    ]
  },
  {
    "id": "aetherids",
    "name": "Aetherids",
    "description": "Airship squadron: closes to 200 m for Bolt Emitter barrages, Static Field crew sweeps and EM pulses that shut systems down. Raises a power barrier when hit.",
    "color": "#38bdf8",
    "formationSpacingM": 110,
    "scatterDuration": 0,
    "routLossFraction": 0.5,
    "aggroRadiusM": 1500,
    "retreatMode": "leave",
    "shipTypes": [
      {
        "id": "aetherid_airship",
        "name": "Airship",
        "count": 3,
        "hp": 450,
        "armor": 300,
        "armorClass": 0,
        "energyResistance": 0.75,
        "speed": 12,
        "radiusM": 30,
        "layer": "aerial",
        "movement": "standoff",
        "preferredRangeM": 160,
        "turnRate": 14.7,
        "emoji": "🎈",
        "weaponMultipliers": {
          "gatling_gun": 1.5,
          "grenade_launcher": 0.7,
          "photon_gun": 0.5
        },
        "barrierCharges": 8,
        "barrierDuration": 8,
        "barrierCooldown": 30,
        "weapons": [
          {
            "id": "bolt_emitter",
            "name": "Bolt Emitter",
            "kind": "beam",
            "damageType": "Energy",
            "damage": 12,
            "count": 8,
            "rangeM": 200,
            "cooldown": 20,
            "duration": 10,
            "selfSlowPct": 50,
            "target": "random",
            "targetMultipliers": {
              "nasobi": 0.4,
              "knidaria": 0.4
            }
          },
          {
            "id": "static_field",
            "name": "Static Field",
            "kind": "pulse",
            "damageType": "Energy",
            "damage": 0,
            "rangeM": 200,
            "cooldown": 30,
            "crewDps": 10,
            "duration": 4
          },
          {
            "id": "em_pulse",
            "name": "EM Pulse",
            "kind": "pulse",
            "damageType": "Energy",
            "damage": 0,
            "rangeM": 300,
            "cooldown": 30,
            "shutdownCount": 2,
            "shutdownDuration": 10
          }
        ]
      }
    ]
  },
  {
    "id": "auri",
    "name": "Auri",
    "description": "Temple-Fortress boss: a slow core ringed by stone blocks it hurls at the Behemoth. Pacifying waves silence the Behemoth weapons. Only grenades crack the core.",
    "color": "#eab308",
    "formationSpacingM": 200,
    "scatterDuration": 0,
    "routLossFraction": 0,
    "aggroRadiusM": 1800,
    "retreatMode": "stay",
    "aggressionLocked": true,
    "shipTypes": [
      {
        "id": "auri_core",
        "name": "Temple Core",
        "count": 1,
        "hp": 900,
        "armor": 700,
        "armorClass": 20,
        "energyResistance": 0.9,
        "speed": 2,
        "radiusM": 70,
        "layer": "surface",
        "movement": "standoff",
        "preferredRangeM": 500,
        "turnRate": 3.7,
        "emoji": "🛕",
        "weaponMultipliers": {
          "grenade_launcher": 1.5
        },
        "weapons": [
          {
            "id": "pacifying_wave",
            "name": "Pacifying Wave",
            "kind": "pulse",
            "damageType": "Energy",
            "damage": 0,
            "rangeM": 900,
            "cooldown": 50,
            "pacifyDuration": 15
          }
        ]
      },
      {
        "id": "auri_block",
        "name": "Stone Block",
        "count": 12,
        "hp": 60,
        "armor": 200,
        "armorClass": 0,
        "energyResistance": 0,
        "speed": 12,
        "radiusM": 18,
        "layer": "surface",
        "movement": "orbit_parent",
        "preferredRangeM": 130,
        "turnRate": 66,
        "emoji": "🪨",
        "weapons": [
          {
            "id": "block_ram",
            "name": "Hurled Block",
            "kind": "ram",
            "damageType": "Physical",
            "damage": 70,
            "rangeM": 1000,
            "cooldown": 10,
            "projectileSpeed": 900,
            "target": "random",
            "targetMultipliers": {
              "nasobi": 2
            }
          }
        ]
      }
    ]
  }
];

export const DEFAULT_FLEET_FACTIONS: FleetFactionDef[] = [
  {
    "id": "nasobi_free_captains",
    "name": "East-West TC",
    "speciesId": "nasobi",
    "color": "#06c2db",
    "overrides": {
      "nasobi_galley": {
        "count": 4,
        "hp": 350,
        "armor": 250,
        "energyResistance": 0.5,
        "speed": 9,
        "weapons": {
          "cannon_volley": {
            "damage": 45,
            "count": 4,
            "cooldown": 25
          }
        }
      },
      "nasobi_tender": {
        "hp": 450,
        "armor": 250,
        "energyResistance": 0.5,
        "speed": 9,
        "weapons": {
          "cannon_volley": {
            "damage": 45,
            "count": 4,
            "cooldown": 25
          },
          "brander": {
            "damage": 400,
            "cooldown": 240
          }
        }
      }
    }
  },
  {
    "id": "nasobi_iron_reef",
    "name": "Tidal Moon TC",
    "speciesId": "nasobi",
    "color": "#78716c",
    "overrides": {
      "nasobi_galley": {
        "count": 3,
        "hp": 500,
        "armor": 400,
        "energyResistance": 0.55,
        "speed": 8,
        "weapons": {
          "cannon_volley": {
            "damage": 50,
            "count": 5,
            "cooldown": 30,
            "rangeM": 1000
          }
        }
      },
      "nasobi_tender": {
        "hp": 600,
        "armor": 400,
        "energyResistance": 0.55,
        "speed": 8,
        "weapons": {
          "cannon_volley": {
            "damage": 50,
            "count": 5,
            "cooldown": 30,
            "rangeM": 1000
          },
          "brander": {
            "damage": 400
          }
        }
      }
    }
  },
  {
    "id": "knidaria_deep_bloom",
    "name": "The Collective",
    "speciesId": "knidaria",
    "color": "#a855f7",
    "overrides": {
      "knidaria_leviathan": {
        "count": 2,
        "hp": 1100,
        "armor": 100,
        "speed": 9,
        "speedSubmerged": 14,
        "weapons": {
          "photon_beam": {
            "damage": 70
          },
          "acid_spray": {
            "damage": 12
          }
        }
      }
    }
  },
  {
    "id": "crabari_shellbound",
    "name": "Blood Waters Clan",
    "speciesId": "crabari",
    "color": "#ef4444",
    "overrides": {
      "crabari_creature": {
        "count": 3,
        "hp": 1300,
        "armor": 500,
        "armorClass": 12,
        "speed": 12,
        "speedSubmerged": 14,
        "weapons": {
          "tail_strike": {
            "damage": 90
          },
          "board_attack": {
            "damage": 180
          },
          "dive_attack": {
            "damage": 70
          }
        }
      }
    }
  },
  {
    "id": "aetherids_storm_choir",
    "name": "Warrior Faction",
    "speciesId": "aetherids",
    "color": "#38bdf8",
    "overrides": {}
  },
  {
    "id": "auri_temple_guard",
    "name": "The Spiteful",
    "speciesId": "auri",
    "color": "#eab308",
    "overrides": {
      "auri_core": {
        "hp": 1200,
        "armor": 900,
        "weapons": {
          "pacifying_wave": {
            "pacifyDuration": 25,
            "cooldown": 45
          }
        }
      },
      "auri_block": {
        "count": 6,
        "hp": 120,
        "armor": 400,
        "weapons": {
          "block_ram": {
            "damage": 130,
            "cooldown": 14
          }
        }
      }
    }
  },
  {
    "id": "nasobi_faction_mwm6da38",
    "name": "Nasobi Pirates",
    "speciesId": "nasobi",
    "color": "#d97706",
    "overrides": {}
  },
  {
    "id": "nasobi_faction_mwm6m3kb",
    "name": "Nasobi Rebels",
    "speciesId": "nasobi",
    "color": "#b76406",
    "overrides": {
      "nasobi_galley": {
        "count": 6,
        "hp": 250,
        "armor": 150,
        "energyResistance": 0.4,
        "speed": 12,
        "weapons": {
          "cannon_volley": {
            "damage": 40,
            "count": 3,
            "cooldown": 20
          },
          "boarding": {
            "count": 6,
            "cooldown": 180
          }
        }
      },
      "nasobi_tender": {
        "hp": 300,
        "armor": 150,
        "energyResistance": 0.4,
        "speed": 12,
        "weapons": {
          "cannon_volley": {
            "damage": 40,
            "count": 3,
            "cooldown": 20
          }
        }
      }
    }
  },
  {
    "id": "knidaria_faction_mwm6mz69",
    "name": "Exiles",
    "speciesId": "knidaria",
    "color": "#661daa",
    "overrides": {
      "knidaria_leviathan": {
        "hp": 1800,
        "armor": 150,
        "armorClass": 8,
        "weapons": {
          "photon_beam": {
            "damage": 90
          },
          "acid_spray": {
            "damage": 15
          },
          "deep_sonic": {
            "damage": 12
          }
        }
      }
    }
  },
  {
    "id": "knidaria_faction_mwm6nazp",
    "name": "Outcasts",
    "speciesId": "knidaria",
    "color": "#ca48db",
    "overrides": {}
  },
  {
    "id": "crabari_faction_mwm6zpma",
    "name": "Truth Thrice Woven Clan",
    "speciesId": "crabari",
    "color": "#ef4444",
    "overrides": {
      "crabari_creature": {
        "count": 2,
        "hp": 2400,
        "armor": 900,
        "armorClass": 15,
        "energyResistance": 0.2,
        "speed": 9,
        "speedSubmerged": 11,
        "weapons": {
          "tail_strike": {
            "damage": 70
          },
          "board_attack": {
            "damage": 150,
            "tilt": 9
          }
        }
      }
    }
  },
  {
    "id": "crabari_faction_mwm6zz1l",
    "name": "Raiders",
    "speciesId": "crabari",
    "color": "#ef4444",
    "overrides": {}
  },
  {
    "id": "auri_faction_mwm711f2",
    "name": "The Deceived",
    "speciesId": "auri",
    "color": "#eab308",
    "overrides": {}
  },
  {
    "id": "auri_faction_mwm716ti",
    "name": "The Unified",
    "speciesId": "auri",
    "color": "#eab308",
    "overrides": {
      "auri_core": {
        "hp": 1000,
        "armor": 800,
        "weapons": {
          "pacifying_wave": {
            "pacifyDuration": 20
          }
        }
      },
      "auri_block": {
        "count": 9,
        "hp": 90,
        "armor": 300,
        "weapons": {
          "block_ram": {
            "damage": 100,
            "cooldown": 12
          }
        }
      }
    }
  }
];

export const DEFAULT_DECK_PRESETS: DeckLoadoutPreset[] = [
  {
    "id": "standard",
    "codeName": "STANDARD",
    "note": "Default mixed loadout: every weapon on both sides, aft mounts empty.",
    "slots": {
      "port_0": "gatling_gun",
      "port_1": "photon_gun",
      "port_2": "grenade_launcher",
      "port_3": "gatling_gun",
      "starboard_0": "photon_gun",
      "starboard_1": "grenade_launcher",
      "starboard_2": "gatling_gun",
      "starboard_3": "photon_gun",
      "aft_0": null,
      "aft_1": null
    }
  },
  {
    "id": "lev_flak_wall",
    "codeName": "FLAK-WALL",
    "target": "thunder_leviarch",
    "note": "Leviarch · Flak wall: 6 Gatlings catch it whenever it surfaces; hold 10 kts and a straight course, crew Hide during breaches.",
    "slots": {
      "port_0": "gatling_gun",
      "port_1": "gatling_gun",
      "port_2": "gatling_gun",
      "port_3": "grenade_launcher",
      "starboard_0": "gatling_gun",
      "starboard_1": "gatling_gun",
      "starboard_2": "gatling_gun",
      "starboard_3": "grenade_launcher",
      "aft_0": null,
      "aft_1": null
    }
  },
  {
    "id": "lev_breach_burst",
    "codeName": "BREACH-BURST",
    "target": "thunder_leviarch",
    "note": "Leviarch · Burst on the breach: fire the 2 Photons only as it breaches; Gatlings cover the rest.",
    "slots": {
      "port_0": "gatling_gun",
      "port_1": "photon_gun",
      "port_2": "gatling_gun",
      "port_3": "gatling_gun",
      "starboard_0": "gatling_gun",
      "starboard_1": "photon_gun",
      "starboard_2": "gatling_gun",
      "starboard_3": "gatling_gun",
      "aft_0": null,
      "aft_1": null
    }
  },
  {
    "id": "lev_stretch_breach",
    "codeName": "STRETCH-BREACH",
    "target": "thunder_leviarch",
    "note": "Leviarch · Escape: steady heading so the breach is long, Gatlings astern catch the splashdown, then Overdrive away.",
    "slots": {
      "port_0": "gatling_gun",
      "port_1": "photon_gun",
      "port_2": "grenade_launcher",
      "port_3": "gatling_gun",
      "starboard_0": "gatling_gun",
      "starboard_1": "photon_gun",
      "starboard_2": "grenade_launcher",
      "starboard_3": "gatling_gun",
      "aft_0": "gatling_gun",
      "aft_1": "gatling_gun"
    }
  },
  {
    "id": "dread_beam_run",
    "codeName": "BEAM-RUN",
    "target": "dreadlot",
    "note": "Dreadlot · Beam it on the run-in: 4 Photons on the broadsides, keep it off the bow and stern.",
    "slots": {
      "port_0": "grenade_launcher",
      "port_1": "photon_gun",
      "port_2": "photon_gun",
      "port_3": "grenade_launcher",
      "starboard_0": "grenade_launcher",
      "starboard_1": "photon_gun",
      "starboard_2": "photon_gun",
      "starboard_3": "grenade_launcher",
      "aft_0": null,
      "aft_1": null
    }
  },
  {
    "id": "dread_mortar_retreat",
    "codeName": "MORTAR-RETREAT",
    "target": "dreadlot",
    "note": "Dreadlot · Mortar the retreat: take one ram, shell it while it disengages in a straight line, Photons finish it.",
    "slots": {
      "port_0": "grenade_launcher",
      "port_1": "grenade_launcher",
      "port_2": "photon_gun",
      "port_3": "grenade_launcher",
      "starboard_0": "grenade_launcher",
      "starboard_1": "grenade_launcher",
      "starboard_2": "photon_gun",
      "starboard_3": "grenade_launcher",
      "aft_0": null,
      "aft_1": null
    }
  },
  {
    "id": "dread_corrida",
    "codeName": "CORRIDA",
    "target": "dreadlot",
    "note": "Dreadlot · Escape: Overdrive and swing the stern toward its charge; it chases in your wake into the aft Photons.",
    "slots": {
      "port_0": "grenade_launcher",
      "port_1": "photon_gun",
      "port_2": "grenade_launcher",
      "port_3": "grenade_launcher",
      "starboard_0": "grenade_launcher",
      "starboard_1": "photon_gun",
      "starboard_2": "grenade_launcher",
      "starboard_3": "grenade_launcher",
      "aft_0": "photon_gun",
      "aft_1": "photon_gun"
    }
  },
  {
    "id": "veil_point_defense",
    "codeName": "POINT-DEFENSE",
    "target": "veilfangs",
    "note": "Veilfangs · Point defense: 8 Gatlings, crew Hide so squads find nobody to snatch.",
    "slots": {
      "port_0": "gatling_gun",
      "port_1": "gatling_gun",
      "port_2": "gatling_gun",
      "port_3": "gatling_gun",
      "starboard_0": "gatling_gun",
      "starboard_1": "gatling_gun",
      "starboard_2": "gatling_gun",
      "starboard_3": "gatling_gun",
      "aft_0": null,
      "aft_1": null
    }
  },
  {
    "id": "veil_crew_fight",
    "codeName": "CREW-FIGHT",
    "target": "veilfangs",
    "note": "Veilfangs · Crew fights back: crew Attack, PDWs shoot diving squads while turrets thin the swarm.",
    "slots": {
      "port_0": "gatling_gun",
      "port_1": "grenade_launcher",
      "port_2": "gatling_gun",
      "port_3": "grenade_launcher",
      "starboard_0": "gatling_gun",
      "starboard_1": "grenade_launcher",
      "starboard_2": "gatling_gun",
      "starboard_3": "grenade_launcher",
      "aft_0": null,
      "aft_1": null
    }
  },
  {
    "id": "veil_break_formation",
    "codeName": "BREAK-FORMATION",
    "target": "veilfangs",
    "note": "Veilfangs · Break the formation: shell the orbit ring while the swarm is grouped.",
    "slots": {
      "port_0": "grenade_launcher",
      "port_1": "grenade_launcher",
      "port_2": "gatling_gun",
      "port_3": "grenade_launcher",
      "starboard_0": "grenade_launcher",
      "starboard_1": "grenade_launcher",
      "starboard_2": "gatling_gun",
      "starboard_3": "grenade_launcher",
      "aft_0": null,
      "aft_1": null
    }
  },
  {
    "id": "veil_keep_scattered",
    "codeName": "KEEP-SCATTERED",
    "target": "veilfangs",
    "note": "Veilfangs · Escape: Overdrive on a straight leg, aft Grenades break every regroup, crew Hide.",
    "slots": {
      "port_0": "gatling_gun",
      "port_1": "gatling_gun",
      "port_2": "gatling_gun",
      "port_3": "gatling_gun",
      "starboard_0": "gatling_gun",
      "starboard_1": "gatling_gun",
      "starboard_2": "gatling_gun",
      "starboard_3": "gatling_gun",
      "aft_0": "grenade_launcher",
      "aft_1": "grenade_launcher"
    }
  },
  {
    "id": "aeth_depth_charge",
    "codeName": "DEPTH-CHARGE",
    "target": "aetherfin",
    "note": "Aetherfin · Depth-charge it: shell it during the charging orbit, before it reaches the keel.",
    "slots": {
      "port_0": "grenade_launcher",
      "port_1": "gatling_gun",
      "port_2": "grenade_launcher",
      "port_3": "grenade_launcher",
      "starboard_0": "grenade_launcher",
      "starboard_1": "gatling_gun",
      "starboard_2": "grenade_launcher",
      "starboard_3": "grenade_launcher",
      "aft_0": null,
      "aft_1": null
    }
  },
  {
    "id": "aeth_kinetic_chip",
    "codeName": "KINETIC-CHIP",
    "target": "aetherfin",
    "note": "Aetherfin · Kinetic chip: Gatlings and Grenades ignore its energy absorption; keep it on the broadside.",
    "slots": {
      "port_0": "gatling_gun",
      "port_1": "grenade_launcher",
      "port_2": "gatling_gun",
      "port_3": "grenade_launcher",
      "starboard_0": "gatling_gun",
      "starboard_1": "grenade_launcher",
      "starboard_2": "gatling_gun",
      "starboard_3": "grenade_launcher",
      "aft_0": null,
      "aft_1": null
    }
  },
  {
    "id": "aeth_starve_drain",
    "codeName": "STARVE-DRAIN",
    "target": "aetherfin",
    "note": "Aetherfin · Starve the drain: one Photon a side (idle beams draw no power), Overdrive away while it charges.",
    "slots": {
      "port_0": "gatling_gun",
      "port_1": "photon_gun",
      "port_2": "grenade_launcher",
      "port_3": "gatling_gun",
      "starboard_0": "gatling_gun",
      "starboard_1": "photon_gun",
      "starboard_2": "grenade_launcher",
      "starboard_3": "gatling_gun",
      "aft_0": null,
      "aft_1": null
    }
  },
  {
    "id": "aeth_never_settle",
    "codeName": "NEVER-SETTLE",
    "target": "aetherfin",
    "note": "Aetherfin · Escape: Overdrive with gentle turns so it never reaches the keel; aft Grenades shell it as it chases.",
    "slots": {
      "port_0": "gatling_gun",
      "port_1": "grenade_launcher",
      "port_2": "gatling_gun",
      "port_3": "grenade_launcher",
      "starboard_0": "gatling_gun",
      "starboard_1": "grenade_launcher",
      "starboard_2": "gatling_gun",
      "starboard_3": "grenade_launcher",
      "aft_0": "grenade_launcher",
      "aft_1": "grenade_launcher"
    }
  },
  {
    "id": "all_grenades",
    "codeName": "ALL GRENADES",
    "note": "Single-weapon test: two Grenade Launchers per side (bow and stern mounts) plus one aft (port).",
    "slots": {
      "port_0": "grenade_launcher",
      "port_1": null,
      "port_2": null,
      "port_3": "grenade_launcher",
      "starboard_0": "grenade_launcher",
      "starboard_1": null,
      "starboard_2": null,
      "starboard_3": "grenade_launcher",
      "aft_0": "grenade_launcher",
      "aft_1": null
    }
  },
  {
    "id": "all_photons",
    "codeName": "ALL PHOTONS",
    "note": "Single-weapon test: two Photon Guns per side (bow and stern mounts) plus one aft (port).",
    "slots": {
      "port_0": "photon_gun",
      "port_1": null,
      "port_2": null,
      "port_3": "photon_gun",
      "starboard_0": "photon_gun",
      "starboard_1": null,
      "starboard_2": null,
      "starboard_3": "photon_gun",
      "aft_0": "photon_gun",
      "aft_1": null
    }
  },
  {
    "id": "deck_all_gatling_mww87zk6",
    "codeName": "ALL GATLING",
    "slots": {
      "port_0": "gatling_gun",
      "port_1": null,
      "port_2": null,
      "port_3": "gatling_gun",
      "starboard_0": "gatling_gun",
      "starboard_1": null,
      "starboard_2": null,
      "starboard_3": "gatling_gun",
      "aft_0": null,
      "aft_1": "gatling_gun"
    }
  }
];
