import { beforeEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { WordlingDB } from './db';
import {
  addWords, advanceSession, createList, deleteList, ensureInitialized, feedCreature, hatchEgg, setActiveCreature,
  startSession, submitAnswer, updateWord, getActiveSession,
} from './actions';
import { exportBackup, restoreBackup, validateBackup } from './backup';
import { seededRng } from '../domain/rng';
import { gradeAnswer } from '../domain/normalize';
import type { Session, Word } from '../domain/types';

let db: WordlingDB;
let n = 0;
const day = (d: number, h = 10) => new Date(2026, 2, d, h);
const PAIRS = [
  ['hund', 'dog'], ['katt', 'cat'], ['fjäril', 'butterfly'], ['häst', 'horse'], ['fågel', 'bird'],
  ['blomma', 'flower'], ['träd', 'tree'], ['hus', 'house'], ['bil', 'car'], ['bok', 'book'],
].map(([sv, en]) => ({ sv: sv!, en: en! }));

beforeEach(async () => {
  db = new WordlingDB(`test-${++n}`);
  await ensureInitialized(db, { now: day(1) });
});

async function answerCurrent(s: Session, env: { now: Date }, mode: 'right' | 'wrong' = 'right') {
  const item = s.queue[s.index]!;
  const word = (await db.words.get(item.wordId))!;
  let answer: string;
  if (mode === 'right') answer = word.en;
  else answer = item.mode === 'choice' ? item.options!.find((o) => o !== word.en)! : 'zzzzzzzz';
  const r = await submitAnswer(db, s.id, item.qid, answer, { ...env, rng: seededRng(5) });
  const next = await advanceSession(db, s.id, item.qid, env);
  return { ...r, next, word };
}

async function runSession(env: { now: Date }, mode: 'right' | 'wrong' = 'right') {
  let s = await startSession(db, { ...env, rng: seededRng(3) });
  if (!s) return null;
  let guard = 0;
  while (s.status === 'active' && guard++ < 40) s = (await answerCurrent(s, env, mode)).next;
  return s;
}

async function hatchFirst() {
  return hatchEgg(db, { now: day(1), rng: seededRng(11) });
}

describe('import -> train -> review', () => {
  it('first run: one egg, hatches to a stored creature before anything else happens', async () => {
    expect((await hatchFirst())!.isNew).toBe(true);
    expect(await db.creatures.count()).toBe(1);
    expect((await db.game.get('main'))!.activeCreatureId).not.toBeNull();
    expect(await hatchEgg(db)).toBeNull(); // no second egg without XP
  });

  it('runs a whole learning journey over several days', async () => {
    await hatchFirst();
    await createList(db, { name: 'Vecka 1', weekNumber: 1 }, PAIRS, { now: day(1) });

    // Day 1, session A: five new words, recognised, then typed follow-ups
    const a = await runSession({ now: day(1) });
    expect(a!.status).toBe('done');
    expect(a!.summary!.correct).toBe(a!.summary!.total);
    expect(a!.queue.filter((q) => q.mode === 'choice')).toHaveLength(5);
    const states1 = (await db.progress.toArray()).map((p) => p.state);
    expect(states1.filter((s) => s === 'REVIEW').length).toBeGreaterThanOrEqual(3);

    // Day 1, session B: the rest of the new words
    const b = await runSession({ now: day(1, 14) });
    expect(b).not.toBeNull();

    // Nothing due later the same day
    expect(await startSession(db, { now: day(1, 20) })).toBeNull();

    // Day 2: the first reviews are due
    const c = await runSession({ now: day(2) });
    expect(c).not.toBeNull();
    const reviewed = await db.progress.where('state').equals('REVIEW').toArray();
    expect(reviewed.some((p) => p.intervalDays === 3)).toBe(true);

    // Weeks later everything has come back and mastery is reachable
    for (const d of [5, 12, 26, 56, 90]) await runSession({ now: day(d) });
    const mastered = await db.progress.where('state').equals('MASTERED').count();
    expect(mastered).toBeGreaterThan(0);
  });

  it('wrong answer -> feedback -> second chance, without penalties', async () => {
    await hatchFirst();
    await createList(db, { name: 'v1', weekNumber: 1 }, PAIRS.slice(0, 5), { now: day(1) });
    const s = (await startSession(db, { now: day(1), rng: seededRng(3) }))!;
    const before = await db.game.get('main');
    const first = await answerCurrent(s, { now: day(1) }, 'wrong');
    expect(first.result.correct).toBe(false);
    expect(first.result.expected).toBe(first.word.en);
    expect(first.result.xp).toBe(0);
    expect(first.result.reasked).toBe(true);
    const after = await db.game.get('main');
    expect(after!.totalXp).toBe(before!.totalXp);
    expect((await db.creatures.toArray())[0]!.xp).toBe(0);
    const wordAgain = first.next.queue.slice(first.next.index).filter((q) => q.wordId === first.word.id);
    expect(wordAgain.length).toBe(1);
    expect(first.next.queue[first.next.index]!.wordId).not.toBe(first.word.id); // never back-to-back
    expect(await db.reviews.where('wordId').equals(first.word.id).count()).toBe(1);
  });

  it('a lapse in a review word keeps history and starts relearning', async () => {
    await hatchFirst();
    await createList(db, { name: 'v1', weekNumber: 1 }, PAIRS.slice(0, 5), { now: day(1) });
    await runSession({ now: day(1) });
    const wid = (await db.progress.where('state').equals('REVIEW').first())!.wordId;
    const events = await db.reviews.where('wordId').equals(wid).count();
    const s = (await startSession(db, { now: day(2), rng: seededRng(1) }))!;
    const idx = s.queue.findIndex((q) => q.wordId === wid);
    let cur: Session = s;
    for (let i = 0; i < idx; i++) cur = (await answerCurrent(cur, { now: day(2) })).next;
    const r = await answerCurrent(cur, { now: day(2) }, 'wrong');
    expect(r.result.stateAfter).toBe('RELEARNING');
    expect(await db.reviews.where('wordId').equals(wid).count()).toBeGreaterThan(events);
    expect((await db.progress.get(wid))!.lapses).toBe(1);
  });
});

describe('rewards are idempotent and tamper-proof', () => {
  it('repeating the same submission (double tap / reload) changes nothing', async () => {
    await hatchFirst();
    await createList(db, { name: 'v1', weekNumber: 1 }, PAIRS, { now: day(1) });
    const s = (await startSession(db, { now: day(1), rng: seededRng(3) }))!;
    const item = s.queue[0]!;
    const word = (await db.words.get(item.wordId))!;
    const r1 = await submitAnswer(db, s.id, item.qid, word.en, { now: day(1) });
    const g1 = await db.game.get('main');
    const r2 = await submitAnswer(db, s.id, item.qid, word.en, { now: day(1) });
    const r3 = await Promise.all([1, 2, 3].map(() => submitAnswer(db, s.id, item.qid, word.en, { now: day(1) })));
    const g2 = await db.game.get('main');
    expect(r1.result.xp).toBe(5);
    expect(r2.result).toEqual(r1.result);
    expect(r3.every((x) => x.result.xp === r1.result.xp)).toBe(true);
    expect(g2!.totalXp).toBe(g1!.totalXp);
    expect(await db.rewards.count()).toBe(1);
    expect(await db.reviews.where('wordId').equals(word.id).count()).toBe(1);
  });

  it('cannot answer a question that is not the current one, nor advance without answering', async () => {
    await hatchFirst();
    await createList(db, { name: 'v1', weekNumber: 1 }, PAIRS, { now: day(1) });
    const s = (await startSession(db, { now: day(1) }))!;
    await expect(submitAnswer(db, s.id, s.queue[2]!.qid, 'x', { now: day(1) })).rejects.toThrow();
    const same = await advanceSession(db, s.id, s.queue[0]!.qid, { now: day(1) });
    expect(same.index).toBe(0);
  });

  it('session bonus is granted once, even if finishing is replayed', async () => {
    await hatchFirst();
    await createList(db, { name: 'v1', weekNumber: 1 }, PAIRS.slice(0, 5), { now: day(1) });
    const done = (await runSession({ now: day(1) }))!;
    const xp = (await db.game.get('main'))!.totalXp;
    await advanceSession(db, done.id, done.queue[done.queue.length - 1]!.qid, { now: day(1) });
    expect((await db.game.get('main'))!.totalXp).toBe(xp);
    expect(await db.rewards.filter((r) => r.kind === 'session').count()).toBe(1);
  });

  it('moving the phone clock backwards cannot make words due earlier', async () => {
    await hatchFirst();
    await createList(db, { name: 'v1', weekNumber: 1 }, PAIRS.slice(0, 5), { now: day(1) });
    await runSession({ now: day(10) });
    // clock set back to day 2: the app still believes it is day 10
    const p = await db.progress.toArray();
    expect(p.every((x) => !x.dueAt || Date.parse(x.dueAt) > day(10, 0).getTime() - 1)).toBe(true);
    expect(await startSession(db, { now: day(2) })).toBeNull();
  });
});

describe('XP -> eggs -> evolution', () => {
  it('earns an egg after 250 XP and hatches a different species', async () => {
    await hatchFirst();
    const first = (await db.creatures.toArray())[0]!;
    await db.game.update('main', { totalXp: 245 });
    await createList(db, { name: 'v1', weekNumber: 1 }, PAIRS.slice(0, 5), { now: day(1) });
    const s = (await runSession({ now: day(1) }))!;
    expect(s.summary!.newEggs).toBe(1);
    const hatched = (await hatchEgg(db, { rng: seededRng(2) }))!;
    expect(hatched.isNew).toBe(true);
    expect(hatched.creature.species).not.toBe(first.species);
    expect(await db.creatures.count()).toBe(2);
    expect(await hatchEgg(db)).toBeNull();
  });

  it('evolves the active creature at 150 XP and keeps all creatures', async () => {
    await hatchFirst();
    const c = (await db.creatures.toArray())[0]!;
    await db.creatures.update(c.id, { xp: 140 });
    await createList(db, { name: 'v1', weekNumber: 1 }, PAIRS.slice(0, 5), { now: day(1) });
    const s = (await runSession({ now: day(1) }))!;
    expect(s.summary!.evolutions.some((e) => e.to === 2)).toBe(true);
    expect((await db.creatures.get(c.id))!.stage).toBe(2);
  });

  it('keeps XP split correctly when the active creature is switched', async () => {
    await hatchFirst();
    await db.game.update('main', { totalXp: 3000 });
    while (await hatchEgg(db, { rng: seededRng(Math.random() * 1e6) })) { /* hatch all */ }
    const all = await db.creatures.toArray();
    expect(new Set(all.map((x) => x.species)).size).toBe(all.length);
    const activeId = (await db.game.get('main'))!.activeCreatureId;
    const other = all.find((x) => x.id !== activeId)!;
    await setActiveCreature(db, other.id);
    await createList(db, { name: 'v1', weekNumber: 1 }, PAIRS.slice(0, 5), { now: day(1) });
    await runSession({ now: day(1) });
    expect((await db.creatures.get(other.id))!.xp).toBeGreaterThan(0);
  });

  it('feeding consumes food but never XP, and fails gracefully without food', async () => {
    await hatchFirst();
    expect(await feedCreature(db)).toBe(false);
    await db.game.update('main', { food: 2 });
    expect(await feedCreature(db)).toBe(true);
    expect((await db.game.get('main'))!.food).toBe(1);
    expect((await db.creatures.toArray())[0]!.xp).toBe(0);
  });
});

describe('editing words', () => {
  it('resets progress when the meaning changes, keeps it for a spelling fix or extra alternative', async () => {
    await hatchFirst();
    const list = await createList(db, { name: 'v1', weekNumber: 1 }, [{ sv: 'hund', en: 'dog' }, { sv: 'katt', en: 'cat' }], { now: day(1) });
    const words = await db.words.where('listId').equals(list.id).toArray();
    const dog = words.find((w) => w.sv === 'hund') as Word;
    await db.progress.update(dog.id, { state: 'REVIEW', step: 2, intervalDays: 7, correctCount: 5 });

    expect((await updateWord(db, dog.id, { sv: 'hund', en: 'dog', alts: ['hound'] })).reset).toBe(false);
    expect((await db.progress.get(dog.id))!.state).toBe('REVIEW');
    expect((await updateWord(db, dog.id, { sv: 'hund', en: 'Dog' })).reset).toBe(false);

    expect((await updateWord(db, dog.id, { sv: 'hund', en: 'wolf' })).reset).toBe(true);
    expect((await db.progress.get(dog.id))!.state).toBe('NEW');
  });

  it('adds words and deletes a list with its words and progress', async () => {
    const list = await createList(db, { name: 'v1', weekNumber: 1 }, PAIRS.slice(0, 2), { now: day(1) });
    expect(await addWords(db, list.id, [{ sv: 'ko', en: 'cow' }, { sv: '', en: 'bad' }])).toBe(1);
    expect(await db.progress.count()).toBe(3);
    await deleteList(db, list.id);
    expect(await db.words.count()).toBe(0);
    expect(await db.progress.count()).toBe(0);
  });

  it('keeps an unfinished session resumable', async () => {
    await hatchFirst();
    await createList(db, { name: 'v1', weekNumber: 1 }, PAIRS, { now: day(1) });
    const s = (await startSession(db, { now: day(1), rng: seededRng(3) }))!;
    await answerCurrent(s, { now: day(1) });
    const again = (await startSession(db, { now: day(1) }))!;
    expect(again.id).toBe(s.id);
    expect(again.index).toBe(1);
    expect((await getActiveSession(db))!.id).toBe(s.id);
  });
});

describe('backup and restore', () => {
  it('round-trips everything', async () => {
    await hatchFirst();
    await createList(db, { name: 'v1', weekNumber: 1 }, PAIRS, { now: day(1) });
    await runSession({ now: day(1) });
    const backup = JSON.parse(JSON.stringify(await exportBackup(db)));
    expect(validateBackup(backup).ok).toBe(true);

    const other = new WordlingDB(`restore-${++n}`);
    await ensureInitialized(other);
    await restoreBackup(other, backup);
    expect(await other.words.count()).toBe(10);
    expect(await other.reviews.count()).toBe(await db.reviews.count());
    expect((await other.game.get('main'))!.totalXp).toBe((await db.game.get('main'))!.totalXp);
    expect(await other.creatures.count()).toBe(1);
  });

  it('rejects invalid backups without touching existing data', async () => {
    await createList(db, { name: 'keep', weekNumber: 1 }, PAIRS.slice(0, 3), { now: day(1) });
    const good = JSON.parse(JSON.stringify(await exportBackup(db)));
    for (const bad of [
      null, 'x', {}, { format: 'wordling-backup', version: 99, data: {} },
      { ...good, data: { ...good.data, Words: [{ id: 1 }] } },
      { ...good, data: { ...good.data, Words: [{ ...good.data.Words[0], listId: 'missing' }] } },
    ]) {
      await expect(restoreBackup(db, bad)).rejects.toThrow();
    }
    expect(await db.words.count()).toBe(3);
    expect(await db.lists.count()).toBe(1);
  });

  it('rolls back completely if the restore fails midway', async () => {
    await createList(db, { name: 'keep', weekNumber: 1 }, PAIRS.slice(0, 3), { now: day(1) });
    const good = JSON.parse(JSON.stringify(await exportBackup(db)));
    // Passes validation per table, but a ReviewEvent with a duplicate key against... force a runtime failure:
    const broken = JSON.parse(JSON.stringify(good));
    broken.data.Words = [{ ...good.data.Words[0] }];
    broken.data.WordProgress = [{ ...good.data.WordProgress[0] }];
    broken.data.RewardEvents = [{ id: 'r', kind: 'typed', xp: 1, food: 1, at: 'x' }];
    const originalBulkAdd = db.table('RewardEvents').bulkAdd.bind(db.table('RewardEvents'));
    db.table('RewardEvents').bulkAdd = (() => Promise.reject(new Error('disk full'))) as unknown as typeof originalBulkAdd;
    await expect(restoreBackup(db, broken)).rejects.toThrow();
    db.table('RewardEvents').bulkAdd = originalBulkAdd;
    expect(await db.words.count()).toBe(3); // old data intact
  });
});

describe('database migration', () => {
  it('upgrades a v1 database and backfills new fields without losing data', async () => {
    const name = `migrate-${++n}`;
    const old = new Dexie(name);
    old.version(1).stores({
      VocabularyLists: 'id, createdAt', Words: 'id, listId', WordProgress: 'wordId, state, dueAt',
      ReviewEvents: 'id, wordId, sessionId, at', Sessions: 'id, status, startedAt', OwnedCreatures: 'id, species',
      GameState: 'key', RewardEvents: 'id, sessionId, at', Settings: 'key',
    });
    await old.table('OwnedCreatures').add({ id: 'c1', species: 'moffi', xp: 10, stage: 1, variant: 0, hatchedAt: 'x' });
    await old.table('GameState').add({ key: 'main', totalXp: 10, food: 3, activeCreatureId: 'c1', lastSeenAt: 'x', createdAt: 'x' });
    await old.table('Settings').add({ key: 'main', speechEnabled: true, sfxEnabled: true, speechRate: 0.9, accent: 'gb', textSize: 'normal', reduceMotion: false });
    await old.table('Words').add({ id: 'w1', listId: 'l1', sv: 'hund', en: 'dog', alts: [], position: 0, createdAt: 'x', updatedAt: 'x' });
    old.close();

    const upgraded = new WordlingDB(name);
    await upgraded.open();
    expect(upgraded.verno).toBe(2);
    expect((await upgraded.game.get('main'))!.eggsHatched).toBe(1);
    expect((await upgraded.game.get('main'))!.food).toBe(3);
    expect((await upgraded.settings.get('main'))!.listsSinceBackup).toBe(0);
    expect((await upgraded.words.get('w1'))!.en).toBe('dog');
  });
});

describe('grading wired to storage', () => {
  it('typo gets helpful feedback but no credit', async () => {
    expect(gradeAnswer('buterfly', ['butterfly']).verdict).toBe('typo');
  });
});
