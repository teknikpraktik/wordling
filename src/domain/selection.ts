import { isDue } from './srs';
import { shuffle, type Rng } from './rng';
import type { VocabularyList, Word, WordProgress } from './types';

export interface SelectInput {
  words: Word[];
  lists: VocabularyList[];
  progress: Map<string, WordProgress>;
  now: Date;
  rng: Rng;
  size?: number;
  maxNew?: number;
  /** Currently practised list; defaults to the newest list. */
  currentListId?: string | null;
}

export interface Selected {
  word: Word;
  reason: 'relearning' | 'due' | 'new';
}

export const DEFAULT_SIZE = 10;
export const DEFAULT_MAX_NEW = 5;
const CURRENT_SHARE = 0.6;
const RESERVED_NEW = 2;

export function currentList(lists: VocabularyList[]): VocabularyList | null {
  if (!lists.length) return null;
  return [...lists].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))[0]!;
}

/**
 * Chooses the words for a normal session (never padded with words that are not due).
 *
 * Priority: relearning > overdue reviews > current-week words > older words > brand-new words.
 * About 60 % of the slots are aimed at the current list and 40 % at older/difficult words, but the
 * quota is soft: whichever side runs short is filled from the other. Up to RESERVED_NEW slots are held
 * for new words so fresh vocabulary is never starved by a review backlog.
 */
export function selectForSession(input: SelectInput): Selected[] {
  const size = input.size ?? DEFAULT_SIZE;
  const maxNew = input.maxNew ?? DEFAULT_MAX_NEW;
  const cur = input.currentListId ?? currentList(input.lists)?.id ?? null;

  const withProgress = input.words
    .map((word) => ({ word, p: input.progress.get(word.id) }))
    .filter((x): x is { word: Word; p: WordProgress } => !!x.p);

  const relearning = withProgress.filter((x) => x.p.state === 'RELEARNING');
  const dueNow = withProgress.filter(
    (x) => (x.p.state === 'LEARNING' || x.p.state === 'REVIEW' || x.p.state === 'MASTERED') && isDue(x.p, input.now),
  );
  const fresh = withProgress
    .filter((x) => x.p.state === 'NEW')
    .sort((a, b) => {
      const ac = a.word.listId === cur ? 0 : 1;
      const bc = b.word.listId === cur ? 0 : 1;
      return ac - bc || a.word.position - b.word.position;
    });

  // Most overdue and most troublesome first.
  const urgency = (x: { p: WordProgress }) =>
    (x.p.dueAt ? Date.parse(x.p.dueAt) : 0) - x.p.lapses * 86_400_000;
  const byUrgency = (a: { p: WordProgress }, b: { p: WordProgress }) => urgency(a) - urgency(b);

  const chosen: Selected[] = [];
  const reservedNew = Math.min(RESERVED_NEW, fresh.length, maxNew);

  for (const x of [...relearning].sort(byUrgency)) {
    if (chosen.length >= size - reservedNew) break;
    chosen.push({ word: x.word, reason: 'relearning' });
  }

  const capacity = size - reservedNew - chosen.length;
  if (capacity > 0) {
    const currentDue = dueNow.filter((x) => x.word.listId === cur).sort(byUrgency);
    const olderDue = dueNow.filter((x) => x.word.listId !== cur).sort(byUrgency);
    const currentQuota = Math.round(size * CURRENT_SHARE);
    const takeCur = Math.min(currentDue.length, Math.max(currentQuota - chosen.length, 0), capacity);
    const takeOld = Math.min(olderDue.length, capacity - takeCur);
    let left = capacity - takeCur - takeOld;
    const curPicked = currentDue.slice(0, takeCur);
    const oldPicked = olderDue.slice(0, takeOld);
    // Fill with whichever side still has words.
    const curRest = currentDue.slice(takeCur);
    const oldRest = olderDue.slice(takeOld);
    while (left > 0 && (curRest.length || oldRest.length)) {
      const next = curRest.length ? curRest.shift()! : oldRest.shift()!;
      (next.word.listId === cur ? curPicked : oldPicked).push(next);
      left--;
    }
    for (const x of [...curPicked, ...oldPicked]) chosen.push({ word: x.word, reason: 'due' });
  }

  const newSlots = Math.min(maxNew, fresh.length, size - chosen.length);
  for (const x of fresh.slice(0, newSlots)) chosen.push({ word: x.word, reason: 'new' });

  return shuffle(chosen, input.rng);
}

/** Words that are due or new right now (used for the "ready" badge on the home screen). */
export function countReady(words: Word[], progress: Map<string, WordProgress>, now: Date): number {
  let n = 0;
  for (const w of words) {
    const p = progress.get(w.id);
    if (p && (p.state === 'RELEARNING' || p.state === 'NEW' || isDue(p, now))) n++;
  }
  return n;
}

/** For extra practice: words that are NOT due, hardest and oldest-reviewed first. */
export function selectExtraPractice(input: SelectInput): Selected[] {
  const size = input.size ?? DEFAULT_SIZE;
  const pool = input.words
    .map((word) => ({ word, p: input.progress.get(word.id) }))
    .filter((x): x is { word: Word; p: WordProgress } => !!x.p && x.p.state !== 'NEW');
  pool.sort((a, b) => b.p.lapses - a.p.lapses || (a.p.lastReviewedAt ?? '').localeCompare(b.p.lastReviewedAt ?? ''));
  return shuffle(pool.slice(0, size).map((x) => ({ word: x.word, reason: 'due' as const })), input.rng);
}
