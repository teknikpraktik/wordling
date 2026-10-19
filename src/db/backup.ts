import { TABLES, type TableName, type WordlingDB } from './db';

export const BACKUP_FORMAT = 'wordling-backup';
export const BACKUP_VERSION = 1;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  data: Record<TableName, Record<string, unknown>[]>;
}

const KEYS: Record<TableName, string> = {
  VocabularyLists: 'id', Words: 'id', WordProgress: 'wordId', ReviewEvents: 'id', Sessions: 'id',
  OwnedCreatures: 'id', GameState: 'key', RewardEvents: 'id', Settings: 'key',
};

type Check = (r: Record<string, unknown>) => boolean;
const str: (k: string) => Check = (k) => (r) => typeof r[k] === 'string';
const num: (k: string) => Check = (k) => (r) => typeof r[k] === 'number' && Number.isFinite(r[k] as number);
const bool: (k: string) => Check = (k) => (r) => typeof r[k] === 'boolean';
const arr: (k: string) => Check = (k) => (r) => Array.isArray(r[k]);
const obj: (k: string) => Check = (k) => (r) => typeof r[k] === 'object' && r[k] !== null;
const oneOf = (k: string, vals: string[]): Check => (r) => vals.includes(r[k] as string);
const strOrNull: (k: string) => Check = (k) => (r) => r[k] === null || typeof r[k] === 'string';

const SCHEMA: Record<TableName, Check[]> = {
  VocabularyLists: [str('id'), str('name'), str('date'), str('createdAt')],
  Words: [str('id'), str('listId'), str('sv'), str('en'), arr('alts'), num('position')],
  WordProgress: [
    str('wordId'), oneOf('state', ['NEW', 'LEARNING', 'REVIEW', 'RELEARNING', 'MASTERED']), num('step'),
    num('intervalDays'), strOrNull('dueAt'), num('lapses'), num('correctCount'), num('wrongCount'),
  ],
  ReviewEvents: [str('id'), str('wordId'), str('sessionId'), str('at'), bool('correct')],
  Sessions: [str('id'), oneOf('status', ['active', 'done']), str('startedAt'), arr('queue'), num('index'), obj('answers')],
  OwnedCreatures: [
    str('id'), oneOf('species', ['moffi', 'tuffa', 'fenna', 'glimmo', 'nuffa', 'lumi']), num('xp'), num('stage'),
  ],
  GameState: [oneOf('key', ['main']), num('totalXp'), num('food'), num('eggsHatched'), str('lastSeenAt')],
  RewardEvents: [str('id'), str('kind'), num('xp'), num('food'), str('at')],
  Settings: [oneOf('key', ['main']), bool('speechEnabled'), bool('sfxEnabled'), num('speechRate')],
};

export async function exportBackup(db: WordlingDB, now = new Date()): Promise<Backup> {
  const data = {} as Backup['data'];
  await db.transaction('r', db.tables, async () => {
    for (const t of TABLES) data[t] = (await db.table(t).toArray()) as Record<string, unknown>[];
  });
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), data };
}

export interface Validation {
  ok: boolean;
  errors: string[];
  backup?: Backup;
  counts?: { lists: number; words: number; creatures: number };
}

/** Strict structural validation. Nothing touches the database until this returns ok. */
export function validateBackup(input: unknown): Validation {
  const errors: string[] = [];
  if (typeof input !== 'object' || input === null) return { ok: false, errors: ['Filen är inte en Wordling-backup.'] };
  const b = input as Partial<Backup>;
  if (b.format !== BACKUP_FORMAT) return { ok: false, errors: ['Filen är inte en Wordling-backup.'] };
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION || b.version < 1) {
    return { ok: false, errors: [`Backupens version (${String(b.version)}) stöds inte av den här appen.`] };
  }
  if (typeof b.data !== 'object' || b.data === null) return { ok: false, errors: ['Backupen saknar data.'] };

  const data = b.data as Record<string, unknown>;
  for (const t of TABLES) {
    const rows = data[t];
    if (!Array.isArray(rows)) {
      errors.push(`Tabellen ${t} saknas.`);
      continue;
    }
    const seen = new Set<unknown>();
    rows.forEach((row, i) => {
      if (typeof row !== 'object' || row === null) return errors.push(`${t}[${i}] är ogiltig.`);
      const r = row as Record<string, unknown>;
      if (!SCHEMA[t].every((check) => check(r))) errors.push(`${t}[${i}] har ogiltiga fält.`);
      const key = r[KEYS[t]];
      if (seen.has(key)) errors.push(`${t}[${i}] har dubblerad nyckel.`);
      seen.add(key);
    });
  }
  if (errors.length) return { ok: false, errors: errors.slice(0, 10) };

  const d = data as Record<TableName, Record<string, unknown>[]>;
  const listIds = new Set(d.VocabularyLists.map((l) => l.id));
  const wordIds = new Set(d.Words.map((w) => w.id));
  d.Words.forEach((w, i) => {
    if (!listIds.has(w.listId)) errors.push(`Words[${i}] hör till en lista som saknas.`);
  });
  d.WordProgress.forEach((p, i) => {
    if (!wordIds.has(p.wordId)) errors.push(`WordProgress[${i}] hör till en glosa som saknas.`);
  });
  if (d.GameState.length > 1 || d.Settings.length > 1) errors.push('För många rader i GameState/Settings.');
  const creatureIds = new Set(d.OwnedCreatures.map((c) => c.id));
  const active = d.GameState[0]?.activeCreatureId;
  if (active != null && !creatureIds.has(active)) errors.push('Aktiv figur finns inte i samlingen.');
  if (errors.length) return { ok: false, errors: errors.slice(0, 10) };

  return {
    ok: true, errors: [], backup: b as Backup,
    counts: { lists: d.VocabularyLists.length, words: d.Words.length, creatures: d.OwnedCreatures.length },
  };
}

export function parseBackup(text: string): Validation {
  try {
    return validateBackup(JSON.parse(text));
  } catch {
    return { ok: false, errors: ['Filen kunde inte läsas som JSON.'] };
  }
}

/**
 * Replaces all data with the backup inside ONE transaction. If anything fails the transaction
 * rolls back and the existing data is untouched.
 */
export async function restoreBackup(db: WordlingDB, backup: unknown): Promise<void> {
  const v = validateBackup(backup);
  if (!v.ok || !v.backup) throw new Error(v.errors[0] ?? 'Ogiltig backup');
  const data = v.backup.data;
  await db.transaction('rw', db.tables, async () => {
    for (const t of TABLES) await db.table(t).clear();
    for (const t of TABLES) await db.table(t).bulkAdd(data[t]);
  });
}

export function backupFileName(now = new Date()): string {
  return `wordling-backup-${now.toISOString().slice(0, 10)}.json`;
}
