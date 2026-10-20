import { CreatureBehaviorTree } from '../types/behavior';

export const DEFAULT_BEHAVIOR_TEMPLATES: Record<string, CreatureBehaviorTree> = {
  dreadlot: {
    id: 'tree_dreadlot',
    creatureDefId: 'dreadlot',
    name: 'Dreadlot: Titan Ramming & Hull Breach',
    description: 'Relentless forward momentum: charges Behemoth hull to deliver devastating ram impulses, followed by tactical disengage and repeated bull-rush cycles.',
    states: [
      { id: 'state_ram', name: 'Aggressive Ram Phase', isInitial: true, priority: 1, color: '#ef4444', entryNodeId: 'node_d1' },
      { id: 'state_enraged', name: 'Enraged Bull-Rush Phase', isInitial: false, priority: 5, color: '#b91c1c', entryNodeId: 'node_d6' }
    ],
    nodes: [
      {
        id: 'node_d1',
        type: 'approach',
        category: 'action',
        name: 'Approach Behemoth',
        x: 120,
        y: 100,
        stateId: 'state_ram',
        speed: 130,
        minDistance: 45,
        nextNodeId: 'node_d2'
      },
      {
        id: 'node_d2',
        type: 'distance_check',
        category: 'condition',
        name: 'Close Proximity Check',
        x: 120,
        y: 220,
        stateId: 'state_ram',
        distanceThreshold: 55,
        distanceOp: '<=',
        trueNodeId: 'node_d3',
        falseNodeId: 'node_d1'
      },
      {
        id: 'node_d3',
        type: 'deal_damage',
        category: 'action',
        name: 'Hull Ram Impact',
        x: 120,
        y: 340,
        stateId: 'state_ram',
        damage: 480,
        damageType: 'Physical',
        cooldown: 4.0,
        nextNodeId: 'node_d4'
      },
      {
        id: 'node_d4',
        type: 'retreat',
        category: 'action',
        name: 'Tactical Disengage',
        x: 120,
        y: 460,
        stateId: 'state_ram',
        speed: 85,
        minDistance: 360,
        nextNodeId: 'node_d5'
      },
      {
        id: 'node_d5',
        type: 'wait_idle',
        category: 'action',
        name: 'Cool Down & Realignment',
        x: 120,
        y: 580,
        stateId: 'state_ram',
        duration: 3.5,
        nextNodeId: 'node_d1'
      },
      // Enraged phase nodes
      {
        id: 'node_d6',
        type: 'approach',
        category: 'action',
        name: 'Enraged High-Speed Ram',
        x: 480,
        y: 100,
        stateId: 'state_enraged',
        speed: 190,
        minDistance: 40,
        nextNodeId: 'node_d7'
      },
      {
        id: 'node_d7',
        type: 'deal_damage',
        category: 'action',
        name: 'Devastating Heavy Ram',
        x: 480,
        y: 220,
        stateId: 'state_enraged',
        damage: 650,
        damageType: 'Physical',
        cooldown: 2.5,
        nextNodeId: 'node_d8'
      },
      {
        id: 'node_d8',
        type: 'retreat',
        category: 'action',
        name: 'Short Burst Disengage',
        x: 480,
        y: 340,
        stateId: 'state_enraged',
        speed: 110,
        minDistance: 240,
        nextNodeId: 'node_d6'
      }
    ],
    connections: [
      { id: 'c_d1_d2', sourceNodeId: 'node_d1', sourceHandle: 'next', targetNodeId: 'node_d2' },
      { id: 'c_d2_d3', sourceNodeId: 'node_d2', sourceHandle: 'true', targetNodeId: 'node_d3' },
      { id: 'c_d2_d1', sourceNodeId: 'node_d2', sourceHandle: 'false', targetNodeId: 'node_d1' },
      { id: 'c_d3_d4', sourceNodeId: 'node_d3', sourceHandle: 'next', targetNodeId: 'node_d4' },
      { id: 'c_d4_d5', sourceNodeId: 'node_d4', sourceHandle: 'next', targetNodeId: 'node_d5' },
      { id: 'c_d5_d1', sourceNodeId: 'node_d5', sourceHandle: 'next', targetNodeId: 'node_d1' },
      { id: 'c_d6_d7', sourceNodeId: 'node_d6', sourceHandle: 'next', targetNodeId: 'node_d7' },
      { id: 'c_d7_d8', sourceNodeId: 'node_d7', sourceHandle: 'next', targetNodeId: 'node_d8' },
      { id: 'c_d8_d6', sourceNodeId: 'node_d8', sourceHandle: 'next', targetNodeId: 'node_d6' }
    ]
  },

  veilfangs: {
    id: 'tree_veilfangs',
    creatureDefId: 'veilfangs',
    name: 'Veilfangs: Boids Flocking & Group Harassment',
    description: 'Enters combat in Boids flocking formation, dissipates into strike groups of 3-5, approaches Behemoth buildings to strike modules or assigned crew (60% crew bias), and disengages back into the flock.',
    states: [
      { id: 'state_boids_cruise', name: 'Cruising Swarm', isInitial: true, priority: 1, color: '#f97316', entryNodeId: 'node_v1' },
      { id: 'state_group_assault', name: 'Group Building Assault', isInitial: false, priority: 3, color: '#ef4444', entryNodeId: 'node_v4' }
    ],
    nodes: [
      {
        id: 'node_v1',
        type: 'boids_flock',
        category: 'action',
        name: 'Boids Flocking Cruise',
        x: 100,
        y: 80,
        stateId: 'state_boids_cruise',
        duration: 3.5,
        speed: 200,
        flockSeparationDist: 24,
        reactionCooldown: 2.0,
        trueNodeId: 'node_v_scatter',
        nextNodeId: 'node_v2'
      },
      {
        id: 'node_v_scatter',
        type: 'flock_dissipate_regroup',
        category: 'action',
        name: 'Panic Scatter & Regroup',
        x: 290,
        y: 80,
        stateId: 'state_boids_cruise',
        scatterSpeed: 180,
        dissipateDuration: 0.8,
        formSquadsBeforeRegroup: true,
        squadAssaultDuration: 2.2,
        groupMinSize: 3,
        groupMaxSize: 5,
        crewAttackChance: 0.60,
        regroupDuration: 2.2,
        reactionCooldown: 2.0,
        regroupAngleOffset: 150,
        nextNodeId: 'node_v1'
      },
      {
        id: 'node_v2',
        type: 'split_swarm_groups',
        category: 'action',
        name: 'Dissipate into Groups of 3-5',
        x: 100,
        y: 200,
        stateId: 'state_boids_cruise',
        groupMinSize: 3,
        groupMaxSize: 5,
        nextNodeId: 'node_v3'
      },
      {
        id: 'node_v3',
        type: 'state_transition',
        category: 'flow',
        name: 'Deploy Attack Packs',
        x: 100,
        y: 320,
        stateId: 'state_boids_cruise',
        targetStateName: 'Group Building Assault',
        priority: 1,
        nextNodeId: 'node_v4'
      },
      // State 2: Group Building Assault
      {
        id: 'node_v4',
        type: 'group_approach_building',
        category: 'action',
        name: 'Approach Target Building',
        x: 480,
        y: 80,
        stateId: 'state_group_assault',
        speed: 230,
        nextNodeId: 'node_v5'
      },
      {
        id: 'node_v5',
        type: 'group_strike_target',
        category: 'action',
        name: 'Strike Building / Crew (60% Crew)',
        x: 480,
        y: 200,
        stateId: 'state_group_assault',
        crewAttackChance: 0.60,
        damage: 45,
        nextNodeId: 'node_v6'
      },
      {
        id: 'node_v6',
        type: 'return_to_swarm',
        category: 'action',
        name: 'Return to Main Swarm',
        x: 480,
        y: 320,
        stateId: 'state_group_assault',
        speed: 250,
        nextNodeId: 'node_v7'
      },
      {
        id: 'node_v7',
        type: 'state_transition',
        category: 'flow',
        name: 'Rejoin Boids Flocking',
        x: 480,
        y: 440,
        stateId: 'state_group_assault',
        targetStateName: 'Cruising Swarm',
        priority: 1,
        nextNodeId: 'node_v1'
      }
    ],
    connections: [
      { id: 'c_v1_v2', sourceNodeId: 'node_v1', sourceHandle: 'next', targetNodeId: 'node_v2' },
      { id: 'c_v1_vscatter', sourceNodeId: 'node_v1', sourceHandle: 'true', targetNodeId: 'node_v_scatter' },
      { id: 'c_vscatter_v1', sourceNodeId: 'node_v_scatter', sourceHandle: 'next', targetNodeId: 'node_v1' },
      { id: 'c_v2_v3', sourceNodeId: 'node_v2', sourceHandle: 'next', targetNodeId: 'node_v3' },
      { id: 'c_v3_v4', sourceNodeId: 'node_v3', sourceHandle: 'next', targetNodeId: 'node_v4' },
      { id: 'c_v4_v5', sourceNodeId: 'node_v4', sourceHandle: 'next', targetNodeId: 'node_v5' },
      { id: 'c_v5_v6', sourceNodeId: 'node_v5', sourceHandle: 'next', targetNodeId: 'node_v6' },
      { id: 'c_v6_v7', sourceNodeId: 'node_v6', sourceHandle: 'next', targetNodeId: 'node_v7' },
      { id: 'c_v7_v1', sourceNodeId: 'node_v7', sourceHandle: 'next', targetNodeId: 'node_v1' }
    ]
  },

  thunder_leviarch: {
    id: 'tree_thunder_leviarch',
    creatureDefId: 'thunder_leviarch',
    name: 'Thunder Leviarch: Stealth Ambush',
    description: 'Submerges deep underwater to avoid turret lines, maneuvers stealthily into long-range position, surfaces abruptly to bombard the deck with electric discharge.',
    states: [
      { id: 'state_submerged', name: 'Deep Submerged Stalk', isInitial: true, priority: 1, color: '#0ea5e9', entryNodeId: 'node_t1' },
      { id: 'state_deck_strike', name: 'Surfaced Deck Barrage', isInitial: false, priority: 3, color: '#eab308', entryNodeId: 'node_t4' }
    ],
    nodes: [
      {
        id: 'node_t1',
        type: 'hide',
        category: 'action',
        name: 'Dive Underwater (Stealth)',
        x: 100,
        y: 90,
        stateId: 'state_submerged',
        duration: 5.5,
        nextNodeId: 'node_t2'
      },
      {
        id: 'node_t2',
        type: 'approach',
        category: 'action',
        name: 'Submerged Flank Maneuver',
        x: 100,
        y: 210,
        stateId: 'state_submerged',
        speed: 210,
        minDistance: 320,
        nextNodeId: 'node_t3'
      },
      {
        id: 'node_t3',
        type: 'distance_check',
        category: 'condition',
        name: 'Check Deck Attack Range',
        x: 100,
        y: 330,
        stateId: 'state_submerged',
        distanceThreshold: 380,
        distanceOp: '<=',
        trueNodeId: 'node_t4',
        falseNodeId: 'node_t2'
      },
      {
        id: 'node_t4',
        type: 'deal_damage',
        category: 'action',
        name: 'Surfaced Lightning Strike',
        x: 480,
        y: 90,
        stateId: 'state_deck_strike',
        damage: 260,
        damageType: 'Energy',
        cooldown: 2.5,
        nextNodeId: 'node_t5'
      },
      {
        id: 'node_t5',
        type: 'retreat',
        category: 'action',
        name: 'Disengage Sprint',
        x: 480,
        y: 210,
        stateId: 'state_deck_strike',
        speed: 230,
        minDistance: 480,
        nextNodeId: 'node_t6'
      },
      {
        id: 'node_t6',
        type: 'for_seconds',
        category: 'condition',
        name: 'Recharge Window (3.0s)',
        x: 480,
        y: 330,
        stateId: 'state_deck_strike',
        duration: 3.0,
        trueNodeId: 'node_t1'
      }
    ],
    connections: [
      { id: 'c_t1_t2', sourceNodeId: 'node_t1', sourceHandle: 'next', targetNodeId: 'node_t2' },
      { id: 'c_t2_t3', sourceNodeId: 'node_t2', sourceHandle: 'next', targetNodeId: 'node_t3' },
      { id: 'c_t3_t4', sourceNodeId: 'node_t3', sourceHandle: 'true', targetNodeId: 'node_t4' },
      { id: 'c_t3_t2', sourceNodeId: 'node_t3', sourceHandle: 'false', targetNodeId: 'node_t2' },
      { id: 'c_t4_t5', sourceNodeId: 'node_t4', sourceHandle: 'next', targetNodeId: 'node_t5' },
      { id: 'c_t5_t6', sourceNodeId: 'node_t5', sourceHandle: 'next', targetNodeId: 'node_t6' },
      { id: 'c_t6_t1', sourceNodeId: 'node_t6', sourceHandle: 'true', targetNodeId: 'node_t1' }
    ]
  },

  aetherfin: {
    id: 'tree_aetherfin',
    creatureDefId: 'aetherfin',
    name: 'Aetherfin: Orbital Energy Harassment & Short-Circuit',
    description: 'Pursue behavior consisting of two alternating stages: Counter-Clockwise Charging Orbit in depths/surface (accumulating energy for 18s), followed by under-deck Attacking short-circuiting 4 active buildings/systems at 4% HP/s with a 10% stun chance.',
    states: [
      { id: 'state_charging', name: 'Charging Stage', isInitial: true, priority: 1, color: '#06b6d4', entryNodeId: 'node_a_charge' },
      { id: 'state_attacking', name: 'Attacking Stage (Short Circuit)', isInitial: false, priority: 3, color: '#a855f7', entryNodeId: 'node_a_attack' }
    ],
    nodes: [
      {
        id: 'node_a_charge',
        type: 'charge_orbit',
        category: 'action',
        name: 'Counter-Clockwise Orbit & Charge (18s)',
        x: 120,
        y: 120,
        stateId: 'state_charging',
        orbitDirection: 'counter_clockwise',
        orbitRadius: 260,
        speed: 165,
        stageDuration: 18,
        surfaceInterval: 3,
        depthsInterval: 3,
        nextNodeId: 'node_a_to_attack'
      },
      {
        id: 'node_a_to_attack',
        type: 'state_transition',
        category: 'flow',
        name: 'Trigger Attack Stage',
        x: 120,
        y: 280,
        stateId: 'state_charging',
        targetStateName: 'Attacking Stage (Short Circuit)',
        priority: 1,
        nextNodeId: 'node_a_attack'
      },
      {
        id: 'node_a_attack',
        type: 'short_circuit_drain',
        category: 'action',
        name: 'Under-Deck Hull Short-Circuit (10s)',
        x: 520,
        y: 120,
        stateId: 'state_attacking',
        duration: 10,
        drainTargetCount: 4,
        drainRatePct: 4,
        stunChance: 0.10,
        stunDuration: 10,
        energyWeightDivisor: 4,
        nextNodeId: 'node_a_to_charge'
      },
      {
        id: 'node_a_to_charge',
        type: 'state_transition',
        category: 'flow',
        name: 'Return to Charging Stage',
        x: 520,
        y: 280,
        stateId: 'state_attacking',
        targetStateName: 'Charging Stage',
        priority: 1,
        nextNodeId: 'node_a_charge'
      }
    ],
    connections: [
      { id: 'c_a_charge_to_trans', sourceNodeId: 'node_a_charge', sourceHandle: 'next', targetNodeId: 'node_a_to_attack' },
      { id: 'c_a_trans_to_attack', sourceNodeId: 'node_a_to_attack', sourceHandle: 'next', targetNodeId: 'node_a_attack' },
      { id: 'c_a_attack_to_trans', sourceNodeId: 'node_a_attack', sourceHandle: 'next', targetNodeId: 'node_a_to_charge' },
      { id: 'c_a_trans_to_charge', sourceNodeId: 'node_a_to_charge', sourceHandle: 'next', targetNodeId: 'node_a_charge' }
    ]
  }
};
