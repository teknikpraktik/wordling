import { allAccepted, normalize } from './normalize';
import { shuffle, type Rng } from './rng';
import type { Word } from './types';

/** Fallback pool so a tiny vocabulary can still produce four options. */
const FALLBACK = [
  'house', 'tree', 'water', 'book', 'chair', 'table', 'window', 'door', 'apple', 'banana', 'school',
  'friend', 'happy', 'green', 'yellow', 'jump', 'sleep', 'river', 'mountain', 'summer', 'winter',
  'cloud', 'music', 'garden', 'bridge', 'candle', 'pocket', 'rabbit', 'turtle', 'ocean', 'pencil', 'basket',
];

export interface Choices {
  options: string[];
  correct: string;
}

/**
 * Four options with exactly one correct answer. Distractors never equal (after normalisation)
 * any accepted translation of the target, and never repeat each other.
 */
export function buildChoices(target: Word, pool: Word[], rng: Rng, count = 4): Choices {
  const banned = new Set(allAccepted(target).map(normalize));
  const used = new Set<string>(banned);
  const picked: string[] = [];

  const take = (candidates: string[]) => {
    for (const c of shuffle(candidates, rng)) {
      if (picked.length >= count - 1) return;
      const n = normalize(c);
      if (!n || used.has(n)) continue;
      used.add(n);
      picked.push(c.trim());
    }
  };

  const sameList = pool.filter((w) => w.id !== target.id && w.listId === target.listId).map((w) => w.en);
  const others = pool.filter((w) => w.id !== target.id && w.listId !== target.listId).map((w) => w.en);
  take(sameList);
  take(others);
  take(FALLBACK);

  const correct = target.en.trim();
  return { options: shuffle([correct, ...picked], rng), correct };
}
