import type { GameState, OwnedCreature, RewardKind } from './types';
import { stageForXp } from './creatures';

export const REWARD_TABLE: Record<RewardKind, { xp: number; food: number }> = {
  choice: { xp: 5, food: 1 },
  typed: { xp: 10, food: 2 },
  delayed: { xp: 15, food: 2 },
  session: { xp: 10, food: 3 },
};

/** Deterministic key – the primary key of a RewardEvent, so granting twice is impossible. */
export function rewardKey(kind: RewardKind, sessionId: string, wordId?: string): string {
  return kind === 'session' ? `session:${sessionId}` : `${kind}:${sessionId}:${wordId}`;
}

export interface GrantResult {
  granted: boolean;
  game: GameState;
  creature: OwnedCreature | null;
  xp: number;
  food: number;
  evolved: { from: 1 | 2 | 3; to: 1 | 2 | 3 } | null;
}

/**
 * Applies a reward to game state exactly once. `ledger` holds already-granted keys.
 * XP and food only ever increase.
 */
export function grantReward(
  ledger: ReadonlySet<string>,
  key: string,
  kind: RewardKind,
  game: GameState,
  creature: OwnedCreature | null,
): GrantResult {
  if (ledger.has(key)) return { granted: false, game, creature, xp: 0, food: 0, evolved: null };
  const { xp, food } = REWARD_TABLE[kind];
  const nextGame: GameState = { ...game, totalXp: game.totalXp + xp, food: game.food + food };
  let nextCreature = creature;
  let evolved: GrantResult['evolved'] = null;
  if (creature) {
    const newXp = creature.xp + xp;
    const stage = stageForXp(newXp);
    nextCreature = { ...creature, xp: newXp, stage };
    if (stage > creature.stage) evolved = { from: creature.stage, to: stage };
  }
  return { granted: true, game: nextGame, creature: nextCreature, xp, food, evolved };
}

/** Growth the active creature gets from eating one piece of food. */
export const FEED_XP = 4;

export interface FeedResult {
  creature: OwnedCreature;
  xp: number;
  evolved: { from: 1 | 2 | 3; to: 1 | 2 | 3 } | null;
}

/**
 * Feeding makes the creature grow. It adds to the creature's own XP (stage growth) but not to the
 * learning XP that unlocks eggs, so eggs still reflect actual practice. Food is only earned by
 * practising, so this cannot be farmed.
 */
export function feedGrowth(creature: OwnedCreature): FeedResult {
  const xp = creature.xp + FEED_XP;
  const stage = stageForXp(xp);
  return {
    creature: { ...creature, xp, stage },
    xp: FEED_XP,
    evolved: stage > creature.stage ? { from: creature.stage, to: stage } : null,
  };
}
