import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { addWords, createList } from '../db/actions';
import { findDuplicates, joinAlternatives, parseWordList, splitAlternatives, swapColumns, detectSwap } from '../domain/importParser';
import { pairsFromOcr } from '../domain/ocrParse';
import { createTesseractEngine } from '../ocr/tesseract';
import type { OcrEngine } from '../ocr/types';
import { BackIcon, CameraIcon, PlusIcon, SwapIcon, TrashIcon } from './Icons';
import { isoWeek } from './hooks';
import type { Word } from '../domain/types';

interface Row {
  id: number;
  sv: string;
  en: string;
  note?: string;
  skip: boolean;
  /** Optional third column from pasted text (English example sentence). */
  example?: string;
}

interface Props {
  /** Add to an existing list instead of creating a new one. */
  targetListId?: string;
  onClose: () => void;
  onSaved: (listId: string) => void;
}

let rowId = 1;
const mkRow = (sv: string, en: string, note?: string, skip = false, example?: string): Row => ({ id: rowId++, sv, en, note, skip, example });

export function ImportFlow({ targetListId, onClose, onSaved }: Props) {
  const [step, setStep] = useState<'choose' | 'ocr' | 'preview'>('choose');
  const [paste, setPaste] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [ocrState, setOcrState] = useState({ progress: 0, status: 'Getting ready…' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const engine = useRef<OcrEngine | null>(null);

  const lists = useLiveQuery(() => db.lists.toArray(), []);
  const existing = useLiveQuery(
    async (): Promise<Word[]> => (targetListId ? db.words.where('listId').equals(targetListId).toArray() : []),
    [targetListId],
  );
  const target = lists?.find((l) => l.id === targetListId);
  const [name, setName] = useState('');
  const [week, setWeek] = useState(String(isoWeek(new Date())));
  useEffect(() => {
    if (!targetListId) setName((n) => n || `Week ${week}`);
  }, [week, targetListId]);

  useEffect(
    () => () => {
      void engine.current?.terminate();
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const dups = useMemo(
    () => findDuplicates(rows.map((r) => ({ sv: r.sv, en: r.en })), (existing ?? []).map((w) => w.sv)),
    [rows, existing],
  );
  const incomplete = rows.filter((r) => !r.skip && (!r.sv.trim() || !r.en.trim()));
  const toSave = rows.filter((r) => !r.skip && r.sv.trim() && r.en.trim());
  const swapSuggested = useMemo(() => detectSwap(rows.map((r) => ({ sv: r.sv, en: r.en }))), [rows]);

  const startRows = (list: Row[]) => {
    const flagged = findDuplicates(list.map((r) => ({ sv: r.sv, en: r.en })), (existing ?? []).map((w) => w.sv));
    setRows(list.map((r, i) => ({ ...r, skip: r.skip || flagged.has(i) })));
    setStep('preview');
  };

  const fromPaste = () => {
    const res = parseWordList(paste);
    let list = res.pairs.map((p) => mkRow(p.sv, joinAlternatives(p.en, p.alts), undefined, false, p.example));
    if (res.suggestSwap) {
      list = swapColumns(res.pairs).map((p, i) => mkRow(p.sv, joinAlternatives(p.en, p.alts), undefined, false, res.pairs[i]?.example));
    }
    const bad = res.rejected.map((l) => mkRow(l, '', 'No separator found (e.g. -). Fill it in or remove it.'));
    if (!list.length && !bad.length) {
      setError('There was nothing to read. Type or paste words, one pair per line.');
      return;
    }
    setError(res.suggestSwap ? 'It looked like the English came first, so I swapped the columns. Please check!' : null);
    startRows([...list, ...bad]);
  };

  const fromImage = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setStep('ocr');
    setOcrState({ progress: 0, status: 'Getting ready…' });
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    try {
      engine.current ??= createTesseractEngine();
      const res = await engine.current.recognize(file, (progress, status) => setOcrState({ progress, status }));
      const parsed = pairsFromOcr(res.lines, res.width);
      if (!parsed.length) {
        setError('Found no text in the picture. Try again with better light, or paste the words.');
        setStep('choose');
        return;
      }
      let list = parsed.map((p) => mkRow(p.sv, joinAlternatives(p.en, p.alts), p.confident ? undefined : p.note));
      // Lists are read as English first, Swedish second. If it is clearly the other way round, flip it.
      if (detectSwap(list.map((r) => ({ sv: r.sv, en: r.en })))) {
        list = list.map((r) => mkRow(r.en, r.sv, r.note));
        setError('The Swedish seemed to come first, so I swapped the columns. Please check!');
      }
      list = list.filter((r) => r.sv || r.en);
      startRows(list);
    } catch (e) {
      setError(`Could not read the picture (${(e as Error).message}). You can paste the words instead.`);
      setStep('choose');
    }
  };

  const update = (id: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch, note: patch.sv !== undefined || patch.en !== undefined ? undefined : r.note } : r)));
  const swap = () => setRows((rs) => rs.map((r) => ({ ...r, sv: r.en, en: r.sv })));

  const save = async () => {
    if (!toSave.length || incomplete.length) return;
    setSaving(true);
    try {
      const words = toSave.map((r) => {
        const { main, alts } = splitAlternatives(r.en);
        return { sv: r.sv, en: main, alts, example: r.example };
      });
      if (targetListId) {
        await addWords(db, targetListId, words);
        onSaved(targetListId);
      } else {
        const list = await createList(db, { name, weekNumber: Number(week) || null }, words);
        onSaved(list.id);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Add words">
      <div className="inner">
        <div className="flex items-center gap-2 px-4" style={{ paddingTop: 'calc(var(--safe-top) + 0.6rem)' }}>
          <button type="button" className="icon-btn" onClick={step === 'preview' ? () => setStep('choose') : onClose} aria-label="Back"><BackIcon width="24" height="24" /></button>
          <h1 className="h1">{target ? `More words for ${target.name}` : 'New words'}</h1>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
          {error && <p role="alert" className="feedback near mb-3">{error}</p>}

          {step === 'choose' && (
            <div className="flex flex-col gap-4">
              <div className="card flex flex-col gap-3">
                <h2 className="h2">Photograph the list</h2>
                <p className="muted font-bold text-sm">English word first, Swedish in the next column. The picture is read on the phone and never sent anywhere.</p>
                <label className="btn btn-primary w-full cursor-pointer" style={{ position: 'relative' }}>
                  <CameraIcon width="24" height="24" /> Take photo
                  <input type="file" accept="image/*" capture="environment" className="absolute inset-0 opacity-0 cursor-pointer" aria-label="Take a photo of the word list" onChange={(e) => { void fromImage(e.target.files?.[0]); e.target.value = ''; }} data-testid="photo-camera" />
                </label>
                <label className="btn btn-soft w-full cursor-pointer" style={{ position: 'relative' }}>
                  Choose picture
                  <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" aria-label="Choose a picture of a word list" onChange={(e) => { void fromImage(e.target.files?.[0]); e.target.value = ''; }} data-testid="photo-file" />
                </label>
              </div>
              <div className="card flex flex-col gap-3">
                <h2 className="h2">Paste or type</h2>
                <label htmlFor="paste" className="label">One word pair per line, e.g. <i>hund - dog</i></label>
                <textarea id="paste" className="field" rows={8} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'hund - dog\nkatt - cat\nfjäril - butterfly'} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
                <button type="button" className="btn btn-primary w-full" onClick={fromPaste} disabled={!paste.trim()}>Preview</button>
              </div>
            </div>
          )}

          {step === 'ocr' && (
            <div className="card flex flex-col gap-4 items-center text-center" role="status" aria-live="polite">
              {preview && <img src={preview} alt="Your photo" className="max-h-48 rounded-xl" />}
              <h2 className="h2">Reading the list…</h2>
              <div className="progress w-full" aria-label="Reading the picture"><i style={{ width: `${Math.round(ocrState.progress * 100)}%` }} /></div>
              <p className="muted font-bold text-sm">The first time, language files are downloaded to the phone. It can take a moment.</p>
            </div>
          )}

          {step === 'preview' && (
            <div className="flex flex-col gap-3">
              {!targetListId && (
                <div className="card grid gap-3" style={{ gridTemplateColumns: '1fr 6.5rem' }}>
                  <div>
                    <label htmlFor="lname" className="label">List name</label>
                    <input id="lname" className="field" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="lweek" className="label">Week</label>
                    <input id="lweek" className="field" inputMode="numeric" value={week} onChange={(e) => setWeek(e.target.value.replace(/\D/g, '').slice(0, 3))} />
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <p className="font-extrabold">{toSave.length} words to save</p>
                <button type="button" className={`btn ${swapSuggested ? 'btn-peach' : 'btn-soft'}`} onClick={swap} style={{ minHeight: 44, padding: '0.4rem 0.9rem' }}>
                  <SwapIcon width="20" height="20" /> Swap columns
                </button>
              </div>
              <div className="flex text-xs font-extrabold muted px-1"><span className="flex-1">Swedish</span><span className="flex-1">English</span><span style={{ width: 48 }} /></div>
              <table className="words" aria-label="Words to review">
                <tbody>
                  {rows.map((r, i) => {
                    const dup = dups.has(i);
                    const bad = !r.skip && (!r.sv.trim() || !r.en.trim());
                    return (
                      <tr key={r.id} className={`${r.note || bad ? 'row-warn' : ''} ${dup ? 'row-dup' : ''}`} style={{ borderRadius: 16, opacity: r.skip ? 0.5 : 1 }}>
                        <td style={{ padding: '0.4rem' }}>
                          <div className="flex gap-2 items-center">
                            <input className="field flex-1" style={{ minWidth: 0 }} aria-label={`Swedish, row ${i + 1}`} value={r.sv} onChange={(e) => update(r.id, { sv: e.target.value })} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
                            <input className="field flex-1" style={{ minWidth: 0 }} lang="en" aria-label={`English, row ${i + 1}`} value={r.en} onChange={(e) => update(r.id, { en: e.target.value })} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
                            <button type="button" className="icon-btn" style={{ boxShadow: 'none', background: 'transparent' }} aria-label={`Remove row ${i + 1}`} onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}><TrashIcon width="22" height="22" /></button>
                          </div>
                          {(r.note || dup || bad) && (
                            <p className="text-xs font-extrabold mt-1 px-1" style={{ color: 'var(--color-peach-d)' }}>
                              {r.note ?? (dup ? 'Already exists.' : 'Fill in both words.')}
                              {dup && (
                                <button type="button" className="underline ml-2" style={{ minHeight: 32 }} onClick={() => update(r.id, { skip: !r.skip })} aria-pressed={r.skip}>
                                  {r.skip ? 'Save anyway' : 'Skip'}
                                </button>
                              )}
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <button type="button" className="btn btn-soft self-start" onClick={() => setRows((rs) => [...rs, mkRow('', '')])}><PlusIcon width="20" height="20" /> Add row</button>
            </div>
          )}
        </div>

        {step === 'preview' && (
          <div className="px-4 pt-2" style={{ paddingBottom: 'calc(var(--safe-bottom) + 0.8rem)' }}>
            {incomplete.length > 0 && <p className="text-sm font-extrabold mb-2" role="status">{incomplete.length} {incomplete.length === 1 ? 'row needs' : 'rows need'} to be completed or removed.</p>}
            <button type="button" className="btn btn-primary btn-big w-full" style={{ fontSize: '1.2rem', letterSpacing: 0 }} disabled={saving || !toSave.length || incomplete.length > 0 || (!targetListId && !name.trim())} onClick={save}>
              Save {toSave.length} words
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
