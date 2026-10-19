import { describe, expect, it } from 'vitest';
import { seededRng } from './rng';
import { selectForSession, countReady, selectExtraPractice } from './selection';
import { newProgress } from './srs';
import type { VocabularyList, Word, WordProgress } from './types';

const now = new Date(2026, 1, 10, 12);
const past = new Date(2026, 1, 1).toISOString();
const future = new Date(2026, 2, 1).toISOString();

function mk(listId: string, n: number, prefix: string): Word[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefix}${i}`, listId, sv: `sv${prefix}${i}`, en: `en${prefix}${i}`, alts: [], position: i,
    createdAt: past, updatedAt: past,
  }));
}
const lists: VocabularyList[] = [
  { id: 'old', name: 'Vecka 1', weekNumber: 1, date: '2026-01-01', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'cur', name: 'Vecka 2', weekNumber: 2, date: '2026-02-01', createdAt: '2026-02-01T00:00:00Z' },
];
function prog(words: Word[], patch: Partial<WordProgress>): [string, WordProgress][] {
  return words.map((w) => [w.id, { ...newProgress(w.id), ...patch }]);
}
const sel = (words: Word[], entries: [string, WordProgress][], extra = {}) =>
  selectForSession({ words, lists, progress: new Map(entries), now, rng: seededRng(1), ...extra });

describe('session selection', () => {
  it('caps brand-new words at five and the session at ten', () => {
    const w = mk('cur', 10, 'c');
    const r = sel(w, prog(w, {}));
    expect(r.length).toBe(5);
    expect(r.every((x) => x.reason === 'new')).toBe(true);
  });

  it('prioritises relearning and overdue words over new ones, but reserves room for new', () => {
    const rel = mk('old', 12, 'r');
    const fresh = mk('cur', 6, 'n');
    const entries = [...prog(rel, { state: 'RELEARNING', dueAt: past }), ...prog(fresh, {})];
    const r = sel([...rel, ...fresh], entries);
    expect(r.length).toBe(10);
    expect(r.filter((x) => x.reason === 'relearning').length).toBe(8);
    expect(r.filter((x) => x.reason === 'new').length).toBe(2);
  });

  it('mixes ~60% current and ~40% older due words, softly', () => {
    const cur = mk('cur', 10, 'c');
    const old = mk('old', 10, 'o');
    const entries = [...prog(cur, { state: 'REVIEW', dueAt: past, step: 1 }), ...prog(old, { state: 'REVIEW', dueAt: past, step: 1 })];
    const r = sel([...cur, ...old], entries);
    expect(r.length).toBe(10);
    expect(r.filter((x) => x.word.listId === 'cur').length).toBe(6);
    expect(r.filter((x) => x.word.listId === 'old').length).toBe(4);
  });

  it('fills from the other side when one side runs short', () => {
    const cur = mk('cur', 2, 'c');
    const old = mk('old', 12, 'o');
    const entries = [...prog(cur, { state: 'REVIEW', dueAt: past }), ...prog(old, { state: 'REVIEW', dueAt: past })];
    const r = sel([...cur, ...old], entries);
    expect(r.length).toBe(10);
    expect(r.filter((x) => x.word.listId === 'cur').length).toBe(2);
  });

  it('skips words that are not yet due and may produce a short session', () => {
    const w = mk('cur', 4, 'c');
    const r = sel(w, prog(w, { state: 'REVIEW', dueAt: future }));
    expect(r).toEqual([]);
  });

  it('never selects the same word twice', () => {
    const w = mk('cur', 30, 'c');
    const r = sel(w, prog(w, { state: 'REVIEW', dueAt: past }));
    expect(new Set(r.map((x) => x.word.id)).size).toBe(r.length);
  });

  it('counts ready words for the home screen', () => {
    const w = mk('cur', 3, 'c');
    const entries = [...prog([w[0]!], {}), ...prog([w[1]!], { state: 'REVIEW', dueAt: future }), ...prog([w[2]!], { state: 'REVIEW', dueAt: past })];
    expect(countReady(w, new Map(entries), now)).toBe(2);
  });

  it('extra practice picks only started words, hardest first', () => {
    const w = mk('cur', 3, 'c');
    const entries: [string, WordProgress][] = [
      ['c0', { ...newProgress('c0'), state: 'REVIEW', dueAt: future, lapses: 0 }],
      ['c1', { ...newProgress('c1'), state: 'REVIEW', dueAt: future, lapses: 3 }],
      ['c2', newProgress('c2')],
    ];
    const r = selectExtraPractice({ words: w, lists, progress: new Map(entries), now, rng: seededRng(2) });
    expect(r.map((x) => x.word.id).sort()).toEqual(['c0', 'c1']);
  });
});
