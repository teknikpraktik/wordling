import { describe, expect, it } from 'vitest';
import { FEED_XP, feedGrowth } from './rewards';
import type { OwnedCreature } from './types';

const c = (xp: number, stage: 1 | 2 | 3): OwnedCreature => ({ id: 'c', species: 'moffi', xp, stage, variant: 0, hatchedAt: '' });

describe('feedGrowth', () => {
  it('adds XP and never removes any', () => {
    expect(feedGrowth(c(10, 1)).creature.xp).toBe(10 + FEED_XP);
  });
  it('reports evolution at the 150 and 500 XP thresholds', () => {
    expect(feedGrowth(c(147, 1)).evolved).toEqual({ from: 1, to: 2 });
    expect(feedGrowth(c(497, 2)).evolved).toEqual({ from: 2, to: 3 });
    expect(feedGrowth(c(20, 1)).evolved).toBeNull();
    expect(feedGrowth(c(600, 3)).evolved).toBeNull();
  });
});
