import Dexie, { type Table } from 'dexie';
import type {
  GameState, OwnedCreature, ReviewEvent, RewardEvent, Session, Settings, VocabularyList, Word, WordProgress,
} from '../domain/types';

export const DB_NAME = 'wordling';
export const TABLES = [
  'VocabularyLists', 'Words', 'WordProgress', 'ReviewEvents', 'Sessions',
  'OwnedCreatures', 'GameState', 'RewardEvents', 'Settings',
] as const;
export type TableName = (typeof TABLES)[number];

export class WordlingDB extends Dexie {
  lists!: Table<VocabularyList, string>;
  words!: Table<Word, string>;
  progress!: Table<WordProgress, string>;
  reviews!: Table<ReviewEvent, string>;
  sessions!: Table<Session, string>;
  creatures!: Table<OwnedCreature, string>;
  game!: Table<GameState, string>;
  rewards!: Table<RewardEvent, string>;
  settings!: Table<Settings, string>;

  constructor(name = DB_NAME) {
    super(name);

    // v1: first release schema
    this.version(1).stores({
      VocabularyLists: 'id, createdAt',
      Words: 'id, listId',
      WordProgress: 'wordId, state, dueAt',
      ReviewEvents: 'id, wordId, sessionId, at',
      Sessions: 'id, status, startedAt',
      OwnedCreatures: 'id, species',
      GameState: 'key',
      RewardEvents: 'id, sessionId, at',
      Settings: 'key',
    });

    // v2: per-word history index + eggsHatched counter on GameState
    this.version(2)
      .stores({
        ReviewEvents: 'id, wordId, sessionId, at, [wordId+at]',
      })
      .upgrade(async (tx) => {
        const owned = await tx.table('OwnedCreatures').count();
        await tx.table('GameState').toCollection().modify((g: Partial<GameState>) => {
          if (typeof g.eggsHatched !== 'number') g.eggsHatched = owned;
        });
        await tx.table('Settings').toCollection().modify((s: Partial<Settings>) => {
          if (typeof s.listsSinceBackup !== 'number') s.listsSinceBackup = 0;
          if (s.lastBackupAt === undefined) s.lastBackupAt = null;
        });
      });

    this.lists = this.table('VocabularyLists');
    this.words = this.table('Words');
    this.progress = this.table('WordProgress');
    this.reviews = this.table('ReviewEvents');
    this.sessions = this.table('Sessions');
    this.creatures = this.table('OwnedCreatures');
    this.game = this.table('GameState');
    this.rewards = this.table('RewardEvents');
    this.settings = this.table('Settings');
  }
}

export const db = new WordlingDB();
