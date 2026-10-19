import type { Verdict } from './types';

/** Lowercase, unify apostrophes, trim, collapse whitespace, drop trailing sentence punctuation. */
export function normalize(input: string): string {
  return input
    .normalize('NFC')
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('en')
    .replace(/[.!?]+$/g, '')
    .trim();
}

const LEADING_WORD = /^(to|a|an|the) /;

/** "to run" and "run" are treated as the same answer; spelling still has to be exact. */
export function stripLeading(normalized: string): string {
  return normalized.replace(LEADING_WORD, '');
}

/** Optimal-string-alignment (Damerau) distance: transposition counts as a single edit. */
export function editDistance(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  if (!al) return bl;
  if (!bl) return al;
  const d: number[][] = Array.from({ length: al + 1 }, () => new Array<number>(bl + 1).fill(0));
  for (let i = 0; i <= al; i++) d[i]![0] = i;
  for (let j = 0; j <= bl; j++) d[0]![j] = j;
  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, d[i - 2]![j - 2]! + 1);
      }
      d[i]![j] = v;
    }
  }
  return d[al]![bl]!;
}

/** How many edits still count as "a small typo" for a word of this length. */
export function typoTolerance(length: number): number {
  if (length <= 3) return 0;
  if (length <= 7) return 1;
  return 2;
}

export interface Grade {
  verdict: Verdict;
  /** The accepted answer to show the user (best match; primary if no match). */
  expected: string;
}

/**
 * Grades a typed answer. `accepted[0]` is the primary translation.
 * A near-miss is reported as `typo` and is NOT counted as correct.
 */
export function gradeAnswer(input: string, accepted: string[]): Grade {
  const primary = accepted[0] ?? '';
  const given = normalize(input);
  if (!given) return { verdict: 'empty', expected: primary };
  const givenStripped = stripLeading(given);

  for (const a of accepted) {
    const n = normalize(a);
    if (n === given || stripLeading(n) === givenStripped) return { verdict: 'correct', expected: a };
  }

  let best: { dist: number; answer: string; tol: number } | null = null;
  for (const a of accepted) {
    const n = stripLeading(normalize(a));
    const dist = editDistance(givenStripped, n);
    const tol = typoTolerance(n.length);
    if (dist <= tol && (!best || dist < best.dist)) best = { dist, answer: a, tol };
  }
  if (best) return { verdict: 'typo', expected: best.answer };
  return { verdict: 'wrong', expected: primary };
}

export function allAccepted(word: { en: string; alts: string[] }): string[] {
  return [word.en, ...word.alts].filter((s) => s.trim().length > 0);
}

/**
 * Has the meaning of a translation changed so much that old progress no longer applies?
 * Fixing a typo or casing is not substantial; swapping the word is.
 */
export function isSubstantialChange(oldText: string, newText: string): boolean {
  const a = normalize(oldText);
  const b = normalize(newText);
  if (a === b) return false;
  const dist = editDistance(a, b);
  const longest = Math.max(a.length, b.length);
  return dist > 2 || dist / longest > 0.34;
}
