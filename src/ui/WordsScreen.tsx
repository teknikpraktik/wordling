import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { deleteList, deleteWord, renameList, updateWord, updateSettings } from '../db/actions';
import { joinAlternatives, splitAlternatives } from '../domain/importParser';
import { isSubstantialChange } from '../domain/normalize';
import { currentList } from '../domain/selection';
import { isDue } from '../domain/srs';
import type { VocabularyList, Word, WordProgress, WordState } from '../domain/types';
import { BackIcon, PlusIcon, TrashIcon } from './Icons';
import { ImportFlow } from './ImportFlow';
import { useGame, useSettings } from './hooks';
import { effectiveNow } from '../domain/srs';

const STATUS: Record<WordState, string> = {
  NEW: 'Ny', LEARNING: 'Lär mig', REVIEW: 'Repeterar', RELEARNING: 'Tränas igen', MASTERED: 'Kan den!',
};
const COLORS: Record<WordState, string> = {
  NEW: '#FFE59A', LEARNING: '#FFC9A8', REVIEW: '#C9B6F2', RELEARNING: '#FFB48A', MASTERED: '#A8E6CF',
};

type View = { k: 'home' } | { k: 'list'; id: string } | { k: 'import'; listId?: string };

export function WordsScreen({ openImport, onImportHandled }: { openImport: boolean; onImportHandled: () => void }) {
  const [view, setView] = useState<View>(openImport ? { k: 'import' } : { k: 'home' });
  const settings = useSettings();
  const game = useGame();
  const data = useLiveQuery(async () => {
    const [lists, words, progress] = await Promise.all([db.lists.toArray(), db.words.toArray(), db.progress.toArray()]);
    return { lists, words, progress: new Map(progress.map((p) => [p.wordId, p])) };
  }, []);
  // Honour a request from other screens to open the import flow.
  useEffect(() => {
    if (openImport) onImportHandled();
  }, [openImport, onImportHandled]);
  if (!data || !game) return <div className="screen" />;
  const now = effectiveNow(new Date(), game.lastSeenAt);
  const cur = currentList(data.lists);
  const sorted = [...data.lists].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const backupDue = settings.listsSinceBackup >= 4;

  const wordsOf = (id: string) => data.words.filter((w) => w.listId === id);
  const closeImport = () => setView({ k: 'home' });

  return (
    <>
      <div className="screen">
        {view.k === 'list' ? (
          <ListDetail
            list={data.lists.find((l) => l.id === view.id)}
            words={wordsOf(view.id)}
            progress={data.progress}
            now={now}
            onBack={() => setView({ k: 'home' })}
            onAdd={() => setView({ k: 'import', listId: view.id })}
          />
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <h1 className="h1">Glosor</h1>
            </div>
            {backupDue && <BackupNudge />}
            <button type="button" className="btn btn-primary w-full mb-4" onClick={() => setView({ k: 'import' })}>
              <PlusIcon width="24" height="24" /> Lägg in glosor
            </button>
            {sorted.length === 0 && (
              <div className="card text-center">
                <p className="font-extrabold">Inga listor ännu.</p>
                <p className="muted font-bold">Fota eller klistra in veckans glosor så börjar äventyret.</p>
              </div>
            )}
            <ul className="list-none p-0 m-0 flex flex-col gap-3">
              {sorted.map((l) => (
                <li key={l.id}>
                  <ListCard list={l} words={wordsOf(l.id)} progress={data.progress} now={now} current={cur?.id === l.id} onOpen={() => setView({ k: 'list', id: l.id })} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {view.k === 'import' && (
        <ImportFlow
          targetListId={view.listId}
          onClose={closeImport}
          onSaved={(id) => setView({ k: 'list', id })}
        />
      )}
    </>
  );
}

function BackupNudge() {
  return (
    <div className="feedback near mb-3 flex items-center justify-between gap-2">
      <span>Dags att spara en säkerhetskopia? (Inställningar → Säkerhetskopia)</span>
      <button type="button" className="btn btn-soft" style={{ minHeight: 44, padding: '0.3rem 0.9rem' }} onClick={() => void updateSettings(db, { listsSinceBackup: 0 })}>
        Senare
      </button>
    </div>
  );
}

function counts(words: Word[], progress: Map<string, WordProgress>, now: Date) {
  const c: Record<WordState, number> = { NEW: 0, LEARNING: 0, REVIEW: 0, RELEARNING: 0, MASTERED: 0 };
  let due = 0;
  for (const w of words) {
    const p = progress.get(w.id);
    if (!p) continue;
    c[p.state]++;
    if (p.state !== 'NEW' && isDue(p, now)) due++;
  }
  return { c, due };
}

function ListCard({ list, words, progress, now, current, onOpen }: { list: VocabularyList; words: Word[]; progress: Map<string, WordProgress>; now: Date; current: boolean; onOpen: () => void }) {
  const { c, due } = counts(words, progress, now);
  const total = words.length || 1;
  return (
    <button type="button" onClick={onOpen} className="card w-full text-left block border-0" style={{ cursor: 'pointer' }} aria-label={`${list.name}, ${words.length} glosor`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="h2">{list.name}</h2>
          <p className="text-sm font-bold muted">{words.length} glosor · {new Date(list.date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}</p>
        </div>
        {current && <span className="status st-MASTERED">Aktuell</span>}
      </div>
      <div className="segbar mt-3" aria-hidden="true">
        {(['MASTERED', 'REVIEW', 'RELEARNING', 'LEARNING', 'NEW'] as WordState[]).map((s) => (
          <i key={s} style={{ width: `${(c[s] / total) * 100}%`, background: COLORS[s] }} />
        ))}
      </div>
      <p className="text-sm font-extrabold mt-2">
        {c.MASTERED} kan · {c.NEW} nya{due > 0 ? ` · ${due} att repetera` : ''}
      </p>
    </button>
  );
}

function ListDetail({ list, words, progress, now, onBack, onAdd }: { list?: VocabularyList; words: Word[]; progress: Map<string, WordProgress>; now: Date; onBack: () => void; onAdd: () => void }) {
  const [editing, setEditing] = useState<Word | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const sorted = useMemo(() => [...words].sort((a, b) => a.position - b.position), [words]);
  if (!list) {
    return <button type="button" className="btn btn-soft" onClick={onBack}>Tillbaka</button>;
  }
  const { due } = counts(words, progress, now);

  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Tillbaka"><BackIcon width="24" height="24" /></button>
        <h1 className="h1 flex-1">{list.name}</h1>
        <button type="button" className="btn btn-soft" style={{ minHeight: 44, padding: '0.3rem 1rem' }} onClick={() => setRenaming(true)}>Ändra</button>
      </div>
      <p className="font-extrabold muted mb-3">{words.length} glosor{due > 0 ? ` · ${due} att repetera` : ''}</p>
      <ul className="list-none p-0 m-0 flex flex-col gap-2">
        {sorted.map((w) => {
          const st = progress.get(w.id)?.state ?? 'NEW';
          return (
            <li key={w.id}>
              <button type="button" className="card w-full text-left border-0 flex items-center justify-between gap-2" style={{ padding: '0.7rem 1rem', cursor: 'pointer', minHeight: 56 }} onClick={() => setEditing(w)} aria-label={`Redigera ${w.sv} – ${w.en}`}>
                <span>
                  <span className="font-extrabold">{w.sv}</span> <span className="muted">→</span>{' '}
                  <span lang="en" className="font-extrabold" style={{ color: 'var(--color-lav-d)' }}>{joinAlternatives(w.en, w.alts)}</span>
                </span>
                <span className={`status st-${st}`}>{STATUS[st]}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex gap-2 mt-4">
        <button type="button" className="btn btn-primary flex-1" onClick={onAdd}><PlusIcon width="22" height="22" /> Fler glosor</button>
        <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)} aria-label="Ta bort listan"><TrashIcon width="22" height="22" /></button>
      </div>

      {editing && <EditWord word={editing} onClose={() => setEditing(null)} />}
      {renaming && <RenameList list={list} onClose={() => setRenaming(false)} />}
      {confirmDelete && (
        <div className="sheet-back" style={{ alignItems: 'center' }} role="presentation">
          <div className="card m-4 max-w-sm" role="alertdialog" aria-modal="true" aria-label="Ta bort lista">
            <h2 className="h2 mb-2">Ta bort "{list.name}"?</h2>
            <p className="font-bold mb-3">Alla {words.length} glosor i listan och deras träningshistorik tas bort. Dina figurer och poäng behålls.</p>
            <div className="flex gap-2">
              <button type="button" className="btn btn-danger flex-1" onClick={async () => { await deleteList(db, list.id); onBack(); }}>Ta bort</button>
              <button type="button" className="btn btn-soft flex-1" onClick={() => setConfirmDelete(false)} autoFocus>Behåll</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function RenameList({ list, onClose }: { list: VocabularyList; onClose: () => void }) {
  const [name, setName] = useState(list.name);
  const [week, setWeek] = useState(list.weekNumber?.toString() ?? '');
  return (
    <div className="sheet-back" onClick={onClose} role="presentation">
      <form
        className="sheet flex flex-col gap-3"
        role="dialog"
        aria-modal="true"
        aria-label="Ändra lista"
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          await renameList(db, list.id, { name: name.trim() || list.name, weekNumber: week ? Number(week) : null });
          onClose();
        }}
      >
        <h2 className="h1">Ändra lista</h2>
        <div><label className="label" htmlFor="rn">Namn</label><input id="rn" className="field" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className="label" htmlFor="rw">Vecka / nummer</label><input id="rw" className="field" inputMode="numeric" value={week} onChange={(e) => setWeek(e.target.value.replace(/\D/g, '').slice(0, 3))} /></div>
        <div className="flex gap-2"><button type="submit" className="btn btn-primary flex-1">Spara</button><button type="button" className="btn btn-soft" onClick={onClose}>Avbryt</button></div>
      </form>
    </div>
  );
}

function EditWord({ word, onClose }: { word: Word; onClose: () => void }) {
  const [sv, setSv] = useState(word.sv);
  const [en, setEn] = useState(joinAlternatives(word.en, word.alts));
  const [error, setError] = useState<string | null>(null);
  const parsed = splitAlternatives(en);
  const willReset = isSubstantialChange(word.sv, sv) || isSubstantialChange(word.en, parsed.main);

  const save = async () => {
    try {
      await updateWord(db, word.id, { sv, en: parsed.main, alts: parsed.alts });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="sheet-back" onClick={onClose} role="presentation">
      <form className="sheet flex flex-col gap-3" role="dialog" aria-modal="true" aria-label="Redigera glosa" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <h2 className="h1">Redigera glosa</h2>
        <div><label className="label" htmlFor="ew-sv">Svenska</label><input id="ew-sv" className="field" value={sv} onChange={(e) => setSv(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} /></div>
        <div>
          <label className="label" htmlFor="ew-en">Engelska (flera rätta svar: skilj med /)</label>
          <input id="ew-en" lang="en" className="field" value={en} onChange={(e) => setEn(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        </div>
        {willReset && <p className="feedback near text-sm">Ordet får en ny betydelse, så träningen av just den här glosan börjar om.</p>}
        {error && <p role="alert" className="feedback miss">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary flex-1">Spara</button>
          <button type="button" className="btn btn-danger" aria-label="Ta bort glosan" onClick={async () => { await deleteWord(db, word.id); onClose(); }}><TrashIcon width="22" height="22" /></button>
          <button type="button" className="btn btn-soft" onClick={onClose}>Avbryt</button>
        </div>
      </form>
    </div>
  );
}
