import { describe, expect, it } from 'vitest';
import { grantReward, REWARD_TABLE, rewardKey } from './rewards';
import { eggThreshold, pendingEggs, pickNewSpecies, SPECIES_IDS, stageForXp, unlockedEggs, xpToNextStage } from './creatures';
import { seededRng } from './rng';
import type { GameState, OwnedCreature } from './types';

const game: GameState = { key: 'main', totalXp: 0, food: 0, activeCreatureId: 'c', eggsHatched: 1, lastSeenAt: '', createdAt: '' };
const creature: OwnedCreature = { id: 'c', species: 'moffi', xp: 0, stage: 1, variant: 0, hatchedAt: '' };

describe('rewards', () => {
  it('matches the specified table', () => {
    expect(REWARD_TABLE).toEqual({
      choice: { xp: 5, food: 1 },
      typed: { xp: 10, food: 2 },
      delayed: { xp: 15, food: 2 },
      session: { xp: 10, food: 3 },
    });
  });

  it('grants once per key and never twice', () => {
    const key = rewardKey('typed', 's1', 'w1');
    const first = grantReward(new Set(), key, 'typed', game, creature);
    expect(first.granted).toBe(true);
    expect(first.game.totalXp).toBe(10);
    expect(first.game.food).toBe(2);
    expect(first.creature!.xp).toBe(10);
    const second = grantReward(new Set([key]), key, 'typed', first.game, first.creature);
    expect(second.granted).toBe(false);
    expect(second.game).toBe(first.game);
  });

  it('keys differ by kind, session and word', () => {
    const keys = [rewardKey('choice', 's', 'w'), rewardKey('typed', 's', 'w'), rewardKey('typed', 's2', 'w'), rewardKey('typed', 's', 'w2'), rewardKey('session', 's')];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('reports evolution when a stage threshold is crossed', () => {
    const g = grantReward(new Set(), 'k', 'delayed', game, { ...creature, xp: 140 });
    expect(g.evolved).toEqual({ from: 1, to: 2 });
  });
});

describe('creatures', () => {
  it('derives stages from XP: 0-149 baby, 150-499 growing, 500+ evolved', () => {
    expect([0, 149, 150, 499, 500, 5000].map(stageForXp)).toEqual([1, 1, 2, 2, 3, 3]);
    expect(xpToNextStage(100)).toEqual({ next: 2, remaining: 50, target: 150 });
    expect(xpToNextStage(500)).toBeNull();
  });

  it('unlocks eggs at 0, 250, 650, 1200, 1900, 2800 XP', () => {
    expect([0, 1, 2, 3, 4, 5].map(eggThreshold)).toEqual([0, 250, 650, 1200, 1900, 2800]);
    expect(unlockedEggs(0)).toBe(1);
    expect(unlockedEggs(249)).toBe(1);
    expect(unlockedEggs(250)).toBe(2);
    expect(unlockedEggs(2800)).toBe(6);
    expect(pendingEggs(700, 1)).toBe(2);
    expect(pendingEggs(700, 3)).toBe(0);
  });

  it('draws only species the player does not own, so no duplicates until complete', () => {
    const rng = seededRng(7);
    const owned: typeof SPECIES_IDS = [];
    for (let i = 0; i < 6; i++) {
      const s = pickNewSpecies(owned, rng)!;
      expect(owned).not.toContain(s);
      owned.push(s);
    }
    expect(new Set(owned).size).toBe(6);
    expect(pickNewSpecies(owned, rng)).toBeNull();
  });
});
