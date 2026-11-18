/**
 * Relations: Hate Matrix + aggression rules (Phase 3).
 *
 * Hate Matrix: matrix[attacker][target] = attacks on sight. Type ids are 'behemoth' or creature def ids.
 * Missing entries fall back to the pre-Phase-3 behavior: the Behemoth and every creature hate each other,
 * creatures leave each other alone. So new creature types work without editing the matrix.
 *
 * Aggression meter (0-100), per creature instance:
 *   < neutralThreshold (40)  -> Retreat (flees)
 *   < pursueThreshold (60)   -> Neutral (passive; fights back against its last attacker)
 *   >= pursueThreshold       -> Pursue (attacks hated targets in aggro radius)
 * Reductions are multiplicative: >60% HP lost -> x0.4 (once); Behemoth outside aggro radius for 15 s -> x0.5
 * (every 15 s). Taking damage raises it (+0.25 per 1% max HP lost). `aggressionLocked` creatures never change on their own (manual slider still works).
 */
import { AggressionState, CombatConfig, CreatureDef, HateMatrix } from '../types/combat';

export const BEHEMOTH_ID = 'behemoth';

export const DEFAULT_COMBAT_CONFIG: CombatConfig = { underwaterDamageReduction: 0.65 };

export const AGGRESSION_DEFAULTS = { start: 60, neutral: 40, pursue: 60 };
export const HP_LOSS_TRIGGER = 0.6;        // fraction of max HP lost that triggers the reduction
export const HP_LOSS_AGGRESSION_MUL = 0.4; // -60%
export const OUT_OF_RADIUS_SECONDS = 15;
export const OUT_OF_RADIUS_AGGRESSION_MUL = 0.5; // -50%
export const RETALIATE_SECONDS = 10;
export const AGGRESSION_PER_DAMAGE_PCT = 0.25; // +0.25 aggression per 1% of max HP lost
export const RETREAT_HOLD_FRACTION = 0.9;    // 'stay' retreat: hold at 90% of the aggro radius

export function hates(matrix: HateMatrix | undefined, attacker: string, target: string): boolean {
  const v = matrix?.[attacker]?.[target];
  if (typeof v === 'boolean') return v;
  if (attacker === target) return false;
  return attacker === BEHEMOTH_ID || target === BEHEMOTH_ID;
}

/**
 * Hierarchical Hate Matrix lookup. Each side is a list of ids from most to least specific:
 * fleet units [factionId, speciesId], creatures [defId], the Behemoth ['behemoth'].
 * The first explicit entry wins, checked in the order (faction→faction, faction→species,
 * species→faction, species→species). So a species checkbox covers all its factions unless a
 * faction cell overrides it. Without any entry: the base default of `hates` on the least specific ids.
 */
export function hatesIds(matrix: HateMatrix | undefined, attackerIds: string[], targetIds: string[]): boolean {
  for (const a of attackerIds) {
    for (const t of targetIds) {
      const v = matrix?.[a]?.[t];
      if (typeof v === 'boolean') return v;
    }
  }
  return hates(matrix, attackerIds[attackerIds.length - 1], targetIds[targetIds.length - 1]);
}

/** Explicit (non-inherited) entry, or undefined when the cell inherits. */
export function explicitHate(matrix: HateMatrix | undefined, attacker: string, target: string): boolean | undefined {
  const v = matrix?.[attacker]?.[target];
  return typeof v === 'boolean' ? v : undefined;
}

export function aggressionStateFor(value: number, def: CreatureDef): AggressionState {
  const neutral = def.neutralThreshold ?? AGGRESSION_DEFAULTS.neutral;
  const pursue = def.pursueThreshold ?? AGGRESSION_DEFAULTS.pursue;
  if (value < neutral) return 'retreat';
  if (value < pursue) return 'neutral';
  return 'pursue';
}
