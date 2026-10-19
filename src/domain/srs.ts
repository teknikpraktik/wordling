import type { QuestionMode, RewardKind, WordProgress, WordState } from './types';

/** Review intervals in days: 1, 3, 7, 14, 30. */
export const INTERVALS = [1, 3, 7, 14, 30] as const;
/** Index of the 14-day level; a correct delayed recall here graduates the word to MASTERED. */
export const MASTER_STEP = 3;

export function newProgress(wordId: string): WordProgress {
  return {
    wordId,
    state: 'NEW',
    step: 0,
    intervalDays: 0,
    dueAt: null,
    lapses: 0,
    correctCount: 0,
    wrongCount: 0,
    introducedAt: null,
    lastReviewedAt: null,
  };
}

/** Start of the local calendar day `days` days after `now`. Due dates snap to day boundaries so "1 day" means "tomorrow". */
export function dueDate(now: Date, days: number): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Protects against the phone clock being moved backwards: time never runs behind the
 * latest moment the app has already seen.
 */
export function effectiveNow(real: Date, lastSeen: string | null | undefined): Date {
  if (!lastSeen) return real;
  const seen = Date.parse(lastSeen);
  return Number.isFinite(seen) && seen > real.getTime() ? new Date(seen) : real;
}

export function isDue(p: WordProgress, now: Date): boolean {
  if (p.state === 'NEW') return true;
  return p.dueAt === null || Date.parse(p.dueAt) <= now.getTime();
}

export interface ReviewOutcome {
  progress: WordProgress;
  /** Reward tier earned by a correct answer, or null when the answer is not rewarded. */
  rewardKind: RewardKind | null;
  /** True if the schedule moved forward. */
  advanced: boolean;
  wasDue: boolean;
}

/**
 * Pure scheduler. Never deletes history and never takes anything away from the player;
 * a wrong answer only moves the word to a state where it is practised again.
 */
export function applyReview(prev: WordProgress, mode: QuestionMode, correct: boolean, now: Date): ReviewOutcome {
  const wasDue = isDue(prev, now);
  const nowIso = now.toISOString();
  const p: WordProgress = {
    ...prev,
    introducedAt: prev.introducedAt ?? nowIso,
    lastReviewedAt: nowIso,
    correctCount: prev.correctCount + (correct ? 1 : 0),
    wrongCount: prev.wrongCount + (correct ? 0 : 1),
  };
  const set = (state: WordState, step: number, interval: number, dueAt: string | null) => {
    p.state = state;
    p.step = step;
    p.intervalDays = interval;
    p.dueAt = dueAt;
  };

  if (!correct) {
    switch (prev.state) {
      case 'REVIEW':
      case 'MASTERED':
        p.lapses = prev.lapses + 1;
        set('RELEARNING', 0, 0, nowIso);
        break;
      case 'RELEARNING':
        set('RELEARNING', 0, 0, nowIso);
        break;
      case 'LEARNING':
        set('LEARNING', 0, 0, dueDate(now, 1));
        break;
      case 'NEW':
        p.state = 'NEW';
        break;
    }
    return { progress: p, rewardKind: null, advanced: false, wasDue };
  }

  // Correct answers
  if (mode === 'choice') {
    // Recognition only introduces a word; it can never graduate it.
    if (prev.state === 'NEW') {
      // Typed recall follows later in the same session if there is room, otherwise tomorrow.
      set('LEARNING', 0, 0, dueDate(now, 1));
      return { progress: p, rewardKind: 'choice', advanced: true, wasDue };
    }
    return { progress: p, rewardKind: wasDue ? 'choice' : null, advanced: false, wasDue };
  }

  switch (prev.state) {
    case 'NEW':
    case 'LEARNING':
    case 'RELEARNING':
      set('REVIEW', 0, INTERVALS[0], dueDate(now, INTERVALS[0]));
      return { progress: p, rewardKind: 'typed', advanced: true, wasDue };
    case 'REVIEW': {
      if (!wasDue) return { progress: p, rewardKind: null, advanced: false, wasDue };
      if (prev.step >= MASTER_STEP) {
        set('MASTERED', INTERVALS.length - 1, INTERVALS[4], dueDate(now, INTERVALS[4]));
      } else {
        const step = prev.step + 1;
        set('REVIEW', step, INTERVALS[step]!, dueDate(now, INTERVALS[step]!));
      }
      return { progress: p, rewardKind: 'delayed', advanced: true, wasDue };
    }
    case 'MASTERED':
      if (!wasDue) return { progress: p, rewardKind: null, advanced: false, wasDue };
      set('MASTERED', INTERVALS.length - 1, INTERVALS[4], dueDate(now, INTERVALS[4]));
      return { progress: p, rewardKind: 'delayed', advanced: true, wasDue };
  }
}

/** Which question type a word should get next. */
export function modeFor(state: WordState): QuestionMode {
  return state === 'NEW' ? 'choice' : 'typed';
}
