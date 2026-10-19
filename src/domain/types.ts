export type WordState = 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING' | 'MASTERED';
export type QuestionMode = 'choice' | 'typed' | 'cloze';
export type Verdict = 'correct' | 'typo' | 'wrong' | 'empty';
export type RewardKind = 'choice' | 'typed' | 'delayed' | 'session';
export type Stage = 1 | 2 | 3;
export type SpeciesId = 'moffi' | 'tuffa' | 'fenna' | 'glimmo' | 'nuffa' | 'lumi';

/** All timestamps are ISO-8601 UTC strings. All ids are UUIDs unless stated otherwise. */
export interface VocabularyList {
  id: string;
  name: string;
  /** Week number or ordinal chosen by the user. */
  weekNumber: number | null;
  /** Calendar date of the list (yyyy-mm-dd). */
  date: string;
  createdAt: string;
}

export interface Word {
  id: string;
  listId: string;
  sv: string;
  en: string;
  alts: string[];
  /** Optional example sentence (English) used for fill-in-the-blank questions. */
  example?: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface WordProgress {
  /** Primary key: same as Word.id */
  wordId: string;
  state: WordState;
  /** Index into INTERVALS for REVIEW words. */
  step: number;
  intervalDays: number;
  dueAt: string | null;
  lapses: number;
  correctCount: number;
  wrongCount: number;
  introducedAt: string | null;
  lastReviewedAt: string | null;
}

export interface ReviewEvent {
  id: string;
  wordId: string;
  sessionId: string;
  at: string;
  mode: QuestionMode;
  answer: string;
  verdict: Verdict;
  correct: boolean;
  stateBefore: WordState;
  stateAfter: WordState;
}

export interface SessionItem {
  qid: string;
  wordId: string;
  mode: QuestionMode;
  /** Persisted so a reload shows the same options. */
  options?: string[];
  /** Fill-in-the-blank sentence with the blank already in place (cloze questions). */
  prompt?: string;
  /** 0 = first ask in this session; >0 = re-ask / follow-up. */
  attempt: number;
}

export interface AnswerResult {
  qid: string;
  wordId: string;
  answer: string;
  verdict: Verdict;
  correct: boolean;
  expected: string;
  xp: number;
  food: number;
  stateAfter: WordState;
  reasked: boolean;
  evolved: { creatureId: string; from: Stage; to: Stage } | null;
}

export interface SessionSummary {
  total: number;
  correct: number;
  needsPractice: { wordId: string; sv: string; en: string }[];
  xp: number;
  food: number;
  sessionBonusXp: number;
  evolutions: { creatureId: string; from: Stage; to: Stage }[];
  newEggs: number;
}

export interface Session {
  id: string;
  status: 'active' | 'done';
  startedAt: string;
  finishedAt: string | null;
  extra: boolean;
  queue: SessionItem[];
  index: number;
  answers: Record<string, AnswerResult>;
  /** Number of re-asks per word in this session. */
  retries: Record<string, number>;
  summary: SessionSummary | null;
}

export interface OwnedCreature {
  id: string;
  species: SpeciesId;
  xp: number;
  stage: Stage;
  variant: number;
  hatchedAt: string;
}

export interface GameState {
  key: 'main';
  totalXp: number;
  food: number;
  activeCreatureId: string | null;
  /** Eggs hatched so far (new species or cosmetic variants). */
  eggsHatched: number;
  /** Latest time ever observed – protects against moving the phone clock backwards. */
  lastSeenAt: string;
  createdAt: string;
}

export interface RewardEvent {
  /** Deterministic idempotency key, e.g. `choice:<session>:<word>`. */
  id: string;
  kind: RewardKind;
  sessionId: string;
  wordId: string | null;
  creatureId: string | null;
  xp: number;
  food: number;
  at: string;
}

export interface Settings {
  key: 'main';
  speechEnabled: boolean;
  sfxEnabled: boolean;
  speechRate: number;
  accent: 'gb' | 'us';
  textSize: 'normal' | 'large' | 'xlarge';
  reduceMotion: boolean;
  listsSinceBackup: number;
  lastBackupAt: string | null;
}
