import { DeckLoadoutPreset } from '../types/combat';

/**
 * Authored deck loadout presets (one per scenario in "CombatSim - Player Encounter Scenarios").
 * Live presets are saved in saved_presets.json / presets.ts; this seed is used only when those have none.
 * Slots: port_0..3 / starboard_0..3 run stern -> bow; aft_0 (port side) and aft_1 (starboard side) face astern.
 */
export const DECK_PRESET_SEED: DeckLoadoutPreset[] = [
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
    "id": "all_gatlings",
    "codeName": "ALL GATLINGS",
    "note": "Single-weapon test: two Gatlings per side (bow and stern mounts) plus one aft (port).",
    "slots": {
      "port_0": "gatling_gun",
      "port_1": null,
      "port_2": null,
      "port_3": "gatling_gun",
      "starboard_0": "gatling_gun",
      "starboard_1": null,
      "starboard_2": null,
      "starboard_3": "gatling_gun",
      "aft_0": "gatling_gun",
      "aft_1": null
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
  }
];
