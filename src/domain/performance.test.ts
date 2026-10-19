import { describe, expect, it } from 'vitest';
import { seededRng } from './rng';
import { selectForSession } from './selection';
import { buildChoices } from './distractors';
import { newProgress } from './srs';
import type { Word, WordProgress } from './types';

describe('performance with a large vocabulary', () => {
  it('selects a session and builds choices for 800 words well under a frame budget', () => {
    const words: Word[] = Array.from({ length: 800 }, (_, i) => ({
      id: `w${i}`, listId: `l${i % 40}`, sv: `sv${i}`, en: `en${i}`, alts: [], position: i, createdAt: '', updatedAt: '',
    }));
    const progress = new Map<string, WordProgress>(
      words.map((w, i) => [w.id, { ...newProgress(w.id), state: i % 3 ? 'REVIEW' : 'NEW', dueAt: new Date(2026, 0, 1).toISOString() }]),
    );
    const lists = Array.from({ length: 40 }, (_, i) => ({ id: `l${i}`, name: `v${i}`, weekNumber: i, date: '', createdAt: `2026-01-${String((i % 28) + 1).padStart(2, '0')}` }));
    const t0 = performance.now();
    const picked = selectForSession({ words, lists, progress, now: new Date(2026, 5, 1), rng: seededRng(1) });
    for (const p of picked) buildChoices(p.word, words, seededRng(2));
    const ms = performance.now() - t0;
    expect(picked).toHaveLength(10);
    expect(ms).toBeLessThan(150);
  });
});
