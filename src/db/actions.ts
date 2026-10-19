import { buildChoices } from '../domain/distractors';
import { pickNewSpecies, pendingEggs, stageForXp, VARIANT_COUNT } from '../domain/creatures';
import { allAccepted, gradeAnswer, isSubstantialChange, normalize } from '../domain/normalize';
import { pick, uuid, type Rng } from '../domain/rng';
import { grantReward, rewardKey } from '../domain/rewards';
import { selectExtraPractice, selectForSession, DEFAULT_SIZE } from '../domain/selection';
import { applyReview, effectiveNow, modeFor, newProgress } from '../domain/srs';
import type {
  AnswerResult, GameState, OwnedCreature, Session, SessionItem, SessionSummary, Settings, VocabularyList, Word,
  WordProgress,
} from '../domain/types';
import type { WordlingDB } from './db';

export interface Env {
  now?: Date;
  rng?: Rng;
}
const clock = (env?: Env) => env?.now ?? new Date();
const random = (env?: Env): Rng => env?.rng ?? Math.random;

export const DEFAULT_SETTINGS: Settings = {
  key: 'main',
  speechEnabled: true,
  sfxEnabled: true,
  speechRate: 0.9,
  accent: 'gb',
  textSize: 'normal',
  reduceMotion: false,
  listsSinceBackup: 0,
  lastBackupAt: null,
};

/** Creates GameState/Settings on first run. Safe to call repeatedly. */
export async function ensureInitialized(db: WordlingDB, env?: Env): Promise<void> {
  const now = clock(env).toISOString();
  await db.transaction('rw', db.game, db.settings, async () => {
    if (!(await db.game.get('main'))) {
      await db.game.add({
        key: 'main', totalXp: 0, food: 0, activeCreatureId: null, eggsHatched: 0, lastSeenAt: now, createdAt: now,
      });
    }
    if (!(await db.settings.get('main'))) await db.settings.add({ ...DEFAULT_SETTINGS });
  });
}

export async function getSettings(db: WordlingDB): Promise<Settings> {
  return (await db.settings.get('main')) ?? { ...DEFAULT_SETTINGS };
}
export async function updateSettings(db: WordlingDB, patch: Partial<Settings>): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const cur = (await db.settings.get('main')) ?? { ...DEFAULT_SETTINGS };
    await db.settings.put({ ...cur, ...patch, key: 'main' });
  });
}

/* -------------------------------------------------------------------------- */
/* Vocabulary                                                                 */
/* -------------------------------------------------------------------------- */

export interface WordInput {
  sv: string;
  en: string;
  alts?: string[];
}

function cleanInput(w: WordInput): { sv: string; en: string; alts: string[] } {
  // Upper/lower case is never significant: words are stored in lower case.
  const en = w.en.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
  const seen = new Set([normalize(en)]);
  const alts: string[] = [];
  for (const a of w.alts ?? []) {
    const t = a.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
    if (t && !seen.has(normalize(t))) {
      seen.add(normalize(t));
      alts.push(t);
    }
  }
  return { sv: w.sv.trim().replace(/\s+/g, ' ').toLocaleLowerCase('sv'), en, alts };
}

export interface ListInput {
  name: string;
  weekNumber: number | null;
  date?: string;
}

export async function createList(db: WordlingDB, input: ListInput, words: WordInput[], env?: Env): Promise<VocabularyList> {
  const now = clock(env);
  const list: VocabularyList = {
    id: uuid(),
    name: input.name.trim() || 'Ny lista',
    weekNumber: input.weekNumber,
    date: input.date ?? localDate(now),
    createdAt: now.toISOString(),
  };
  await db.transaction('rw', [db.lists, db.words, db.progress, db.settings], async () => {
    await db.lists.add(list);
    await insertWords(db, list.id, words, 0, now);
    const s = (await db.settings.get('main')) ?? { ...DEFAULT_SETTINGS };
    await db.settings.put({ ...s, listsSinceBackup: s.listsSinceBackup + 1 });
  });
  return list;
}

async function insertWords(db: WordlingDB, listId: string, words: WordInput[], startPos: number, now: Date) {
  const iso = now.toISOString();
  let pos = startPos;
  const rows: Word[] = [];
  for (const w of words) {
    const c = cleanInput(w);
    if (!c.sv || !c.en) continue;
    rows.push({ id: uuid(), listId, sv: c.sv, en: c.en, alts: c.alts, position: pos++, createdAt: iso, updatedAt: iso });
  }
  await db.words.bulkAdd(rows);
  await db.progress.bulkAdd(rows.map((r) => newProgress(r.id)));
  return rows;
}

export async function addWords(db: WordlingDB, listId: string, words: WordInput[], env?: Env): Promise<number> {
  const now = clock(env);
  return db.transaction('rw', [db.words, db.progress], async () => {
    const existing = await db.words.where('listId').equals(listId).count();
    return (await insertWords(db, listId, words, existing, now)).length;
  });
}

export async function renameList(db: WordlingDB, listId: string, patch: Partial<Pick<VocabularyList, 'name' | 'weekNumber' | 'date'>>) {
  await db.lists.update(listId, patch);
}

/**
 * Edits a word. If the Swedish word or the primary translation changes meaning
 * (not just a spelling fix), the word's learning status starts over.
 */
export async function updateWord(db: WordlingDB, wordId: string, input: WordInput, env?: Env): Promise<{ reset: boolean }> {
  const now = clock(env).toISOString();
  return db.transaction('rw', [db.words, db.progress], async () => {
    const old = await db.words.get(wordId);
    if (!old) throw new Error('Glosan finns inte');
    const c = cleanInput(input);
    if (!c.sv || !c.en) throw new Error('Både svenskt och engelskt ord krävs');
    const reset = isSubstantialChange(old.sv, c.sv) || isSubstantialChange(old.en, c.en);
    await db.words.put({ ...old, ...c, updatedAt: now });
    if (reset) await db.progress.put(newProgress(wordId));
    return { reset };
  });
}

export async function deleteWord(db: WordlingDB, wordId: string) {
  await db.transaction('rw', [db.words, db.progress, db.reviews], async () => {
    await db.words.delete(wordId);
    await db.progress.delete(wordId);
    await db.reviews.where('wordId').equals(wordId).delete();
  });
}

export async function deleteList(db: WordlingDB, listId: string) {
  await db.transaction('rw', [db.lists, db.words, db.progress, db.reviews], async () => {
    const ids = (await db.words.where('listId').equals(listId).primaryKeys()) as string[];
    await db.progress.bulkDelete(ids);
    for (const id of ids) await db.reviews.where('wordId').equals(id).delete();
    await db.words.bulkDelete(ids);
    await db.lists.delete(listId);
  });
}

export function localDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/* -------------------------------------------------------------------------- */
/* Creatures / eggs                                                           */
/* -------------------------------------------------------------------------- */

export interface HatchResult {
  creature: OwnedCreature;
  /** false when the collection was already complete and the egg only added a cosmetic variant. */
  isNew: boolean;
}

/**
 * Hatches one pending egg. The result is stored before this promise resolves,
 * so the animation can never be replayed into a different outcome.
 */
export async function hatchEgg(db: WordlingDB, env?: Env): Promise<HatchResult | null> {
  const now = clock(env).toISOString();
  const rng = random(env);
  return db.transaction('rw', [db.game, db.creatures], async () => {
    const game = await db.game.get('main');
    if (!game || pendingEggs(game.totalXp, game.eggsHatched) <= 0) return null;
    const owned = await db.creatures.toArray();
    const species = pickNewSpecies(owned.map((c) => c.species), rng);
    let result: HatchResult;
    if (species) {
      const creature: OwnedCreature = {
        id: uuid(), species, xp: 0, stage: stageForXp(0), variant: 0, hatchedAt: now,
      };
      await db.creatures.add(creature);
      result = { creature, isNew: true };
    } else {
      const target = pick(owned, rng);
      const creature = { ...target, variant: (target.variant % (VARIANT_COUNT - 1)) + 1 };
      await db.creatures.put(creature);
      result = { creature, isNew: false };
    }
    await db.game.put({
      ...game,
      eggsHatched: game.eggsHatched + 1,
      activeCreatureId: game.activeCreatureId ?? result.creature.id,
    });
    return result;
  });
}

export async function setActiveCreature(db: WordlingDB, creatureId: string) {
  await db.transaction('rw', [db.game, db.creatures], async () => {
    if (!(await db.creatures.get(creatureId))) return;
    await db.game.update('main', { activeCreatureId: creatureId });
  });
}

/** Feeding costs one food and has no downside; it never changes XP or stage. */
export async function feedCreature(db: WordlingDB): Promise<boolean> {
  return db.transaction('rw', db.game, async () => {
    const g = await db.game.get('main');
    if (!g || g.food < 1 || !g.activeCreatureId) return false;
    await db.game.update('main', { food: g.food - 1 });
    return true;
  });
}

/* -------------------------------------------------------------------------- */
/* Sessions                                                                   */
/* -------------------------------------------------------------------------- */

const MAX_RETRIES_PER_WORD = 2;
const MAX_QUEUE = DEFAULT_SIZE + 6;

export async function getActiveSession(db: WordlingDB): Promise<Session | undefined> {
  return db.sessions.where('status').equals('active').first();
}

export async function getEffectiveNow(db: WordlingDB, env?: Env): Promise<Date> {
  const g = await db.game.get('main');
  return effectiveNow(clock(env), g?.lastSeenAt);
}

async function loadProgress(db: WordlingDB): Promise<Map<string, WordProgress>> {
  return new Map((await db.progress.toArray()).map((p) => [p.wordId, p]));
}

/** Starts a session, or returns the unfinished one so an interrupted session can be resumed. */
export async function startSession(db: WordlingDB, opts: { extra?: boolean } & Env = {}): Promise<Session | null> {
  const rng = random(opts);
  return db.transaction('rw', [db.sessions, db.words, db.lists, db.progress, db.game], async () => {
    const active = await getActiveSession(db);
    if (active) return active;
    const game = await db.game.get('main');
    const now = effectiveNow(clock(opts), game?.lastSeenAt);
    const words = await db.words.toArray();
    const lists = await db.lists.toArray();
    const progress = await loadProgress(db);
    const input = { words, lists, progress, now, rng };
    const selected = opts.extra ? selectExtraPractice(input) : selectForSession(input);
    if (!selected.length) return null;
    const queue: SessionItem[] = selected.map((s) => {
      const mode = modeFor(progress.get(s.word.id)!.state);
      return makeItem(s.word, mode, words, rng, 0);
    });
    const session: Session = {
      id: uuid(), status: 'active', startedAt: now.toISOString(), finishedAt: null, extra: !!opts.extra,
      queue, index: 0, answers: {}, retries: {}, summary: null,
    };
    await db.sessions.add(session);
    if (game) await db.game.put({ ...game, lastSeenAt: now.toISOString() });
    return session;
  });
}

function makeItem(word: Word, mode: SessionItem['mode'], pool: Word[], rng: Rng, attempt: number): SessionItem {
  const item: SessionItem = { qid: uuid(), wordId: word.id, mode, attempt };
  if (mode === 'choice') item.options = buildChoices(word, pool, rng).options;
  return item;
}

export interface SubmitResult {
  result: AnswerResult;
  session: Session;
}

/**
 * Grades an answer and, in ONE transaction, updates progress, schedule, history, rewards and the queue.
 * Calling it again with the same `qid` (double tap, reload) returns the stored result without side effects.
 */
export async function submitAnswer(
  db: WordlingDB, sessionId: string, qid: string, answer: string, env?: Env,
): Promise<SubmitResult> {
  const rng = random(env);
  return db.transaction(
    'rw',
    [db.sessions, db.words, db.progress, db.reviews, db.rewards, db.game, db.creatures],
    async () => {
      const session = await db.sessions.get(sessionId);
      if (!session || session.status !== 'active') throw new Error('Passet är inte aktivt');
      const stored = session.answers[qid];
      if (stored) return { result: stored, session };
      const item = session.queue[session.index];
      if (!item || item.qid !== qid) throw new Error('Frågan är inte aktuell');

      const word = await db.words.get(item.wordId);
      if (!word) throw new Error('Glosan finns inte längre');
      const game = (await db.game.get('main'))!;
      const now = effectiveNow(clock(env), game.lastSeenAt);
      const prev = (await db.progress.get(word.id)) ?? newProgress(word.id);

      const grade = gradeAnswer(answer, allAccepted(word));
      const verdict = item.mode === 'choice' && grade.verdict === 'typo' ? 'wrong' : grade.verdict;
      const correct = verdict === 'correct';
      const outcome = applyReview(prev, item.mode, correct, now);

      let g: GameState = game;
      let creature = game.activeCreatureId ? (await db.creatures.get(game.activeCreatureId)) ?? null : null;
      let xp = 0;
      let food = 0;
      let evolved: AnswerResult['evolved'] = null;
      if (outcome.rewardKind && !session.extra) {
        const key = rewardKey(outcome.rewardKind, sessionId, word.id);
        const exists = !!(await db.rewards.get(key));
        const grant = grantReward(exists ? new Set([key]) : new Set(), key, outcome.rewardKind, g, creature);
        if (grant.granted) {
          g = grant.game;
          creature = grant.creature;
          xp = grant.xp;
          food = grant.food;
          await db.rewards.add({
            id: key, kind: outcome.rewardKind, sessionId, wordId: word.id, creatureId: creature?.id ?? null,
            xp, food, at: now.toISOString(),
          });
          if (creature) {
            await db.creatures.put(creature);
            if (grant.evolved) evolved = { creatureId: creature.id, ...grant.evolved };
          }
        }
      }

      await db.progress.put(outcome.progress);
      await db.reviews.add({
        id: uuid(), wordId: word.id, sessionId, at: now.toISOString(), mode: item.mode, answer,
        verdict, correct, stateBefore: prev.state, stateAfter: outcome.progress.state,
      });

      // Re-ask (wrong) or follow-up with typing (just recognised) – only when there is room and never back-to-back.
      const queue = session.queue.slice();
      const retries = { ...session.retries };
      let reasked = false;
      const remaining = queue.length - (session.index + 1);
      const pending = queue.slice(session.index + 1).some((q) => q.wordId === word.id);
      const insertAt = Math.min(Math.max(session.index + 4, session.index + 2), queue.length);
      if (!pending && remaining >= 1 && queue.length < MAX_QUEUE) {
        const pool = await db.words.toArray();
        if (!correct && (retries[word.id] ?? 0) < MAX_RETRIES_PER_WORD) {
          retries[word.id] = (retries[word.id] ?? 0) + 1;
          queue.splice(insertAt, 0, makeItem(word, modeFor(outcome.progress.state) === 'choice' ? 'choice' : 'typed', pool, rng, item.attempt + 1));
          reasked = true;
        } else if (correct && item.mode === 'choice' && outcome.progress.state === 'LEARNING' && !session.extra) {
          queue.splice(insertAt, 0, makeItem(word, 'typed', pool, rng, item.attempt + 1));
          reasked = true;
        }
      }

      const result: AnswerResult = {
        qid, wordId: word.id, answer, verdict, correct, expected: grade.expected, xp, food,
        stateAfter: outcome.progress.state, reasked, evolved,
      };
      const next: Session = { ...session, queue, retries, answers: { ...session.answers, [qid]: result } };
      await db.sessions.put(next);
      await db.game.put({ ...g, lastSeenAt: now.toISOString() });
      return { result, session: next };
    },
  );
}

/** Moves to the next question after feedback; finishes the session (with bonus + summary) after the last one. */
export async function advanceSession(db: WordlingDB, sessionId: string, qid: string, env?: Env): Promise<Session> {
  return db.transaction(
    'rw',
    [db.sessions, db.words, db.rewards, db.game, db.creatures],
    async () => {
      const session = await db.sessions.get(sessionId);
      if (!session) throw new Error('Passet finns inte');
      if (session.status === 'done') return session;
      const cur = session.queue[session.index];
      if (!cur || cur.qid !== qid || !session.answers[qid]) return session; // already advanced or not answered
      const index = session.index + 1;
      if (index < session.queue.length) {
        const next = { ...session, index };
        await db.sessions.put(next);
        return next;
      }
      return finishSession(db, { ...session, index }, env);
    },
  );
}

async function finishSession(db: WordlingDB, session: Session, env?: Env): Promise<Session> {
  const game = (await db.game.get('main'))!;
  const now = effectiveNow(clock(env), game.lastSeenAt);
  const results = Object.values(session.answers);
  const earned = results.filter((r) => r.xp > 0).length;

  let g = game;
  let creature = g.activeCreatureId ? (await db.creatures.get(g.activeCreatureId)) ?? null : null;
  let bonusXp = 0;
  let bonusFood = 0;
  let evolved: AnswerResult['evolved'] = null;
  if (!session.extra && earned > 0) {
    const key = rewardKey('session', session.id);
    const exists = !!(await db.rewards.get(key));
    const grant = grantReward(exists ? new Set([key]) : new Set(), key, 'session', g, creature);
    if (grant.granted) {
      g = grant.game;
      creature = grant.creature;
      bonusXp = grant.xp;
      bonusFood = grant.food;
      await db.rewards.add({
        id: key, kind: 'session', sessionId: session.id, wordId: null, creatureId: creature?.id ?? null,
        xp: bonusXp, food: bonusFood, at: now.toISOString(),
      });
      if (creature) {
        await db.creatures.put(creature);
        if (grant.evolved) evolved = { creatureId: creature.id, ...grant.evolved };
      }
    }
  }

  const wrongWordIds = [...new Set(results.filter((r) => !r.correct).map((r) => r.wordId))];
  const words = await db.words.bulkGet(wrongWordIds);
  const evolutions = [...results.map((r) => r.evolved), evolved].filter((e): e is NonNullable<typeof e> => !!e);
  const summary: SessionSummary = {
    total: results.length,
    correct: results.filter((r) => r.correct).length,
    needsPractice: words.filter((w): w is Word => !!w).map((w) => ({ wordId: w.id, sv: w.sv, en: w.en })),
    xp: results.reduce((s, r) => s + r.xp, 0) + bonusXp,
    food: results.reduce((s, r) => s + r.food, 0) + bonusFood,
    sessionBonusXp: bonusXp,
    evolutions,
    newEggs: pendingEggs(g.totalXp, g.eggsHatched),
  };
  const done: Session = { ...session, status: 'done', finishedAt: now.toISOString(), summary };
  await db.sessions.put(done);
  await db.game.put({ ...g, lastSeenAt: now.toISOString() });
  return done;
}

/** Abandons an unfinished session so a fresh one can be built (e.g. after the word list changed a lot). */
export async function discardSession(db: WordlingDB, sessionId: string) {
  await db.sessions.delete(sessionId);
}
