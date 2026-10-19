import { describe, expect, it } from 'vitest';
import { applyReview, dueDate, effectiveNow, INTERVALS, newProgress } from './srs';
import type { WordProgress } from './types';

const d = (day: number, h = 12) => new Date(2026, 0, day, h, 0, 0);
const days = (iso: string | null, from: Date) => Math.round((Date.parse(iso!) - new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()) / 86_400_000);

function run(p: WordProgress, steps: [('choice' | 'typed'), boolean, Date][]): WordProgress {
  return steps.reduce((acc, [m, ok, t]) => applyReview(acc, m, ok, t).progress, p);
}

describe('spaced repetition', () => {
  it('uses the 1, 3, 7, 14, 30 day ladder', () => {
    expect([...INTERVALS]).toEqual([1, 3, 7, 14, 30]);
  });

  it('NEW -> LEARNING on correct recognition (and never further)', () => {
    const r = applyReview(newProgress('w'), 'choice', true, d(1));
    expect(r.progress.state).toBe('LEARNING');
    expect(r.rewardKind).toBe('choice');
    const again = applyReview(r.progress, 'choice', true, d(1));
    expect(again.progress.state).toBe('LEARNING');
  });

  it('wrong recognition keeps the word NEW and records the miss', () => {
    const r = applyReview(newProgress('w'), 'choice', false, d(1));
    expect(r.progress.state).toBe('NEW');
    expect(r.progress.wrongCount).toBe(1);
    expect(r.rewardKind).toBeNull();
  });

  it('first correct typed answer schedules a review after one day', () => {
    const learning = applyReview(newProgress('w'), 'choice', true, d(1)).progress;
    const r = applyReview(learning, 'typed', true, d(1));
    expect(r.progress.state).toBe('REVIEW');
    expect(days(r.progress.dueAt, d(1))).toBe(1);
    expect(r.rewardKind).toBe('typed');
  });

  it('walks the whole ladder and masters after delayed recall at the 14-day level', () => {
    let p = run(newProgress('w'), [['choice', true, d(1)], ['typed', true, d(1)]]);
    const expectedSteps = [3, 7, 14];
    let now = d(2);
    for (const exp of expectedSteps) {
      const r = applyReview(p, 'typed', true, now);
      expect(r.progress.state).toBe('REVIEW');
      expect(r.progress.intervalDays).toBe(exp);
      expect(r.rewardKind).toBe('delayed');
      p = r.progress;
      now = new Date(Date.parse(p.dueAt!) + 3_600_000);
    }
    const mastered = applyReview(p, 'typed', true, now);
    expect(mastered.progress.state).toBe('MASTERED');
    expect(mastered.progress.intervalDays).toBe(30);
  });

  it('MASTERED words keep repeating about every 30 days', () => {
    const m: WordProgress = { ...newProgress('w'), state: 'MASTERED', step: 4, intervalDays: 30, dueAt: d(1, 0).toISOString() };
    const r = applyReview(m, 'typed', true, d(2));
    expect(r.progress.state).toBe('MASTERED');
    expect(days(r.progress.dueAt, d(2))).toBe(30);
  });

  it('a wrong answer sends REVIEW/MASTERED words to RELEARNING without erasing history', () => {
    const rev: WordProgress = { ...newProgress('w'), state: 'REVIEW', step: 2, intervalDays: 7, dueAt: d(1, 0).toISOString(), correctCount: 4 };
    const r = applyReview(rev, 'typed', false, d(2));
    expect(r.progress.state).toBe('RELEARNING');
    expect(r.progress.lapses).toBe(1);
    expect(r.progress.correctCount).toBe(4);
    expect(r.progress.introducedAt).not.toBeNull();
    expect(r.rewardKind).toBeNull();
  });

  it('successful relearning schedules one day ahead', () => {
    const re: WordProgress = { ...newProgress('w'), state: 'RELEARNING', lapses: 1 };
    const r = applyReview(re, 'typed', true, d(5));
    expect(r.progress.state).toBe('REVIEW');
    expect(days(r.progress.dueAt, d(5))).toBe(1);
  });

  it('answering correctly before it is due does not advance the schedule or reward', () => {
    const rev: WordProgress = { ...newProgress('w'), state: 'REVIEW', step: 1, intervalDays: 3, dueAt: d(10, 0).toISOString() };
    const r = applyReview(rev, 'typed', true, d(5));
    expect(r.progress.step).toBe(1);
    expect(r.progress.dueAt).toBe(rev.dueAt);
    expect(r.advanced).toBe(false);
    expect(r.rewardKind).toBeNull();
  });

  it('a correct multiple-choice answer alone never masters a word', () => {
    const rev: WordProgress = { ...newProgress('w'), state: 'REVIEW', step: 3, intervalDays: 14, dueAt: d(1, 0).toISOString() };
    const r = applyReview(rev, 'choice', true, d(20));
    expect(r.progress.state).toBe('REVIEW');
  });

  it('is deterministic for a given injected time', () => {
    const a = applyReview(newProgress('w'), 'typed', true, d(3));
    const b = applyReview(newProgress('w'), 'typed', true, d(3));
    expect(a).toEqual(b);
  });
});

describe('clock protection', () => {
  it('never lets time run behind the latest seen moment', () => {
    expect(effectiveNow(d(1), d(5).toISOString()).getTime()).toBe(d(5).getTime());
    expect(effectiveNow(d(9), d(5).toISOString()).getTime()).toBe(d(9).getTime());
  });
  it('snaps due dates to local midnight', () => {
    const due = new Date(dueDate(d(1, 18), 1));
    expect(due.getHours()).toBe(0);
    expect(due.getDate()).toBe(2);
  });
});
