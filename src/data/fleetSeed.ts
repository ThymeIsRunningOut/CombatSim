import { FleetSpeciesDef, FleetFactionDef } from '../types/combat';

/**
 * Authored fleet defaults (Phase 4). The live, tuned values are saved in saved_presets.json / presets.ts;
 * this seed is used only when those have no fleet data (e.g. an older snapshot).
 */
export const FLEET_SEED_SPECIES: FleetSpeciesDef[] = [
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
        "speed": 9,
        "radiusM": 24,
        "layer": "surface",
        "movement": "standoff",
        "preferredRangeM": 550,
        "turnRate": 70,
        "emoji": "⛵",
        "scatterOnHit": true,
        "weaponMultipliers": {
          "gatling_gun": 1.5
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
            "target": "random"
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
        "hp": 150,
        "armor": 100,
        "armorClass": 0,
        "energyResistance": 0.2,
        "speed": 9,
        "radiusM": 26,
        "layer": "surface",
        "movement": "standoff",
        "preferredRangeM": 650,
        "turnRate": 70,
        "emoji": "🚢",
        "scatterOnHit": true,
        "weaponMultipliers": {
          "gatling_gun": 1.5
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
            "target": "random"
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
        "hp": 1200,
        "armor": 50,
        "armorClass": 6,
        "energyResistance": 0,
        "speed": 6,
        "speedSubmerged": 14,
        "radiusM": 60,
        "layer": "diving",
        "movement": "standoff",
        "preferredRangeM": 450,
        "turnRate": 60,
        "emoji": "🪼",
        "weaponMultipliers": {
          "photon_gun": 1.5,
          "gatling_gun": 0.5
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
            "target": "random"
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
            "target": "hull"
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
            "target": "hull"
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
        "hp": 1000,
        "armor": 400,
        "armorClass": 10,
        "energyResistance": 0,
        "speed": 10,
        "speedSubmerged": 12,
        "radiusM": 45,
        "layer": "diving",
        "movement": "close",
        "preferredRangeM": 40,
        "turnRate": 90,
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
            "damage": 60,
            "rangeM": 90,
            "cooldown": 4.5,
            "target": "hull"
          },
          {
            "id": "board_attack",
            "name": "Board Attack",
            "kind": "melee",
            "damageType": "Physical",
            "damage": 120,
            "rangeM": 60,
            "cooldown": 35,
            "target": "random",
            "tilt": 6
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
            "target": "hull"
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
        "hp": 250,
        "armor": 250,
        "armorClass": 0,
        "energyResistance": 0.75,
        "speed": 11,
        "radiusM": 30,
        "layer": "aerial",
        "movement": "standoff",
        "preferredRangeM": 160,
        "turnRate": 80,
        "emoji": "🎈",
        "weaponMultipliers": {
          "gatling_gun": 1.5,
          "grenade_launcher": 1.5,
          "photon_gun": 0.5
        },
        "barrierDuration": 8,
        "barrierCooldown": 30,
        "weapons": [
          {
            "id": "bolt_emitter",
            "name": "Bolt Emitter",
            "kind": "beam",
            "damageType": "Energy",
            "damage": 10,
            "count": 8,
            "rangeM": 200,
            "cooldown": 20,
            "duration": 10,
            "selfSlowPct": 50,
            "target": "random"
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
        "hp": 500,
        "armor": 500,
        "armorClass": 20,
        "energyResistance": 0.5,
        "speed": 2,
        "radiusM": 70,
        "layer": "surface",
        "movement": "standoff",
        "preferredRangeM": 500,
        "turnRate": 20,
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
            "pacifyDuration": 20
          }
        ]
      },
      {
        "id": "auri_block",
        "name": "Stone Block",
        "count": 8,
        "hp": 50,
        "armor": 300,
        "armorClass": 0,
        "energyResistance": 0,
        "speed": 12,
        "radiusM": 18,
        "layer": "surface",
        "movement": "orbit_parent",
        "preferredRangeM": 130,
        "turnRate": 360,
        "emoji": "🪨",
        "weapons": [
          {
            "id": "block_ram",
            "name": "Hurled Block",
            "kind": "ram",
            "damageType": "Physical",
            "damage": 80,
            "rangeM": 1000,
            "cooldown": 12,
            "projectileSpeed": 900,
            "target": "random"
          }
        ]
      }
    ]
  }
];

export const FLEET_SEED_FACTIONS: FleetFactionDef[] = [
  {
    "id": "nasobi_free_captains",
    "name": "Free Captains",
    "speciesId": "nasobi",
    "color": "#d97706",
    "overrides": {}
  },
  {
    "id": "nasobi_iron_reef",
    "name": "Iron Reef Corsairs",
    "speciesId": "nasobi",
    "color": "#78716c",
    "overrides": {
      "nasobi_galley": {
        "hp": 200,
        "armor": 150,
        "speed": 8,
        "weapons": {
          "cannon_volley": {
            "damage": 40
          }
        }
      },
      "nasobi_tender": {
        "hp": 200,
        "armor": 150,
        "speed": 8,
        "weapons": {
          "cannon_volley": {
            "damage": 40
          }
        }
      }
    }
  },
  {
    "id": "knidaria_deep_bloom",
    "name": "Deep Bloom",
    "speciesId": "knidaria",
    "color": "#a855f7",
    "overrides": {}
  },
  {
    "id": "crabari_shellbound",
    "name": "Shellbound",
    "speciesId": "crabari",
    "color": "#ef4444",
    "overrides": {}
  },
  {
    "id": "aetherids_storm_choir",
    "name": "Storm Choir",
    "speciesId": "aetherids",
    "color": "#38bdf8",
    "overrides": {}
  },
  {
    "id": "auri_temple_guard",
    "name": "Temple Guard",
    "speciesId": "auri",
    "color": "#eab308",
    "overrides": {}
  }
];
