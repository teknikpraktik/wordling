import { useRef, useState } from 'react';
import { db } from '../db/db';
import { updateSettings } from '../db/actions';
import { backupFileName, exportBackup, parseBackup, restoreBackup, type Validation } from '../db/backup';
import { setSfxEnabled, playSfx } from '../audio/sfx';
import { speak, speechSupported } from '../audio/speech';
import { DownloadIcon, UploadIcon } from './Icons';
import { useSettings, useSpeechOptions } from './hooks';

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const s = useSettings();
  const speech = useSpeechOptions(s);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Validation | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const supported = speechSupported();

  const set = (patch: Parameters<typeof updateSettings>[1]) => void updateSettings(db, patch);

  const doExport = async () => {
    const backup = await exportBackup(db);
    const blob = new Blob([JSON.stringify(backup, null, 1)], { type: 'application/json' });
    const name = backupFileName();
    const file = new File([blob], name, { type: 'application/json' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Wordling-backup' });
      } else {
        throw new Error('no share');
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
    await updateSettings(db, { listsSinceBackup: 0, lastBackupAt: new Date().toISOString() });
    setMsg({ ok: true, text: 'Säkerhetskopian är sparad.' });
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setMsg(null);
    const v = parseBackup(await file.text());
    if (!v.ok) setMsg({ ok: false, text: v.errors[0] ?? 'Ogiltig backup.' });
    else setPending(v);
    if (fileRef.current) fileRef.current.value = '';
  };

  const confirmRestore = async () => {
    if (!pending?.backup) return;
    try {
      await restoreBackup(db, pending.backup);
      setMsg({ ok: true, text: 'Allt är återställt.' });
    } catch (e) {
      setMsg({ ok: false, text: `Återställningen misslyckades – inget ändrades. ${(e as Error).message}` });
    }
    setPending(null);
  };

  const last = s.lastBackupAt ? new Date(s.lastBackupAt).toLocaleDateString('sv-SE') : 'aldrig';

  return (
    <div className="sheet-back" onClick={onClose} role="presentation">
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Inställningar" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <h2 className="h1">Inställningar</h2>
          <button type="button" className="btn btn-soft" onClick={onClose}>Klar</button>
        </div>

        <section className="card mb-3 flex flex-col gap-3" aria-labelledby="set-sound">
          <h3 id="set-sound" className="h2">Ljud</h3>
          <Toggle label="Uttal (engelska ord)" checked={s.speechEnabled} onChange={(v) => set({ speechEnabled: v })} />
          {!supported && <p className="text-sm font-bold muted">Den här enheten saknar talsyntes. Allt annat fungerar ändå.</p>}
          <div role="group" aria-label="Brytning" className="flex gap-2">
            {(['gb', 'us'] as const).map((a) => (
              <button key={a} type="button" className={`btn flex-1 ${s.accent === a ? 'btn-primary' : 'btn-soft'}`} aria-pressed={s.accent === a} onClick={() => set({ accent: a })}>
                {a === 'gb' ? 'Brittisk' : 'Amerikansk'}
              </button>
            ))}
          </div>
          <div>
            <label className="label" htmlFor="rate">Talhastighet</label>
            <div className="flex items-center gap-3">
              <input id="rate" type="range" min="0.6" max="1.1" step="0.05" value={s.speechRate} onChange={(e) => set({ speechRate: Number(e.target.value) })} className="flex-1" style={{ minHeight: 44 }} />
              <button type="button" className="btn btn-soft" onClick={() => speak('butterfly', { ...speech, enabled: true })} disabled={!supported}>Testa</button>
            </div>
          </div>
          <Toggle label="Ljudeffekter" checked={s.sfxEnabled} onChange={(v) => { set({ sfxEnabled: v }); setSfxEnabled(v); if (v) setTimeout(() => playSfx('correct'), 50); }} />
        </section>

        <section className="card mb-3 flex flex-col gap-3" aria-labelledby="set-look">
          <h3 id="set-look" className="h2">Utseende</h3>
          <div role="group" aria-label="Textstorlek" className="flex gap-2">
            {([['normal', 'Vanlig'], ['large', 'Stor'], ['xlarge', 'Störst']] as const).map(([k, label]) => (
              <button key={k} type="button" className={`btn flex-1 ${s.textSize === k ? 'btn-primary' : 'btn-soft'}`} aria-pressed={s.textSize === k} onClick={() => set({ textSize: k })}>{label}</button>
            ))}
          </div>
          <Toggle label="Mindre rörelse" checked={s.reduceMotion} onChange={(v) => set({ reduceMotion: v })} />
        </section>

        <section className="card mb-3 flex flex-col gap-3" aria-labelledby="set-backup">
          <h3 id="set-backup" className="h2">Säkerhetskopia</h3>
          <p className="text-sm font-bold muted">Allt sparas bara i den här telefonen. Spara en kopia ibland, så kan du flytta över allt om du byter telefon. Senaste kopia: {last}.</p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-mint flex-1" onClick={doExport}><DownloadIcon width="22" height="22" /> Spara kopia</button>
            <button type="button" className="btn btn-soft flex-1" onClick={() => fileRef.current?.click()}><UploadIcon width="22" height="22" /> Hämta kopia</button>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-label="Välj backupfil" onChange={(e) => void onFile(e.target.files?.[0])} />
          {msg && <p role="status" className={`feedback ${msg.ok ? 'good' : 'miss'}`}>{msg.text}</p>}
        </section>

        <p className="text-center text-sm font-bold muted">Wordling · Ingen inloggning, ingen spårning. Inget lämnar din telefon.</p>

        {pending?.counts && (
          <div className="sheet-back" style={{ zIndex: 70, alignItems: 'center' }} role="presentation">
            <div className="card m-4 max-w-sm" role="alertdialog" aria-modal="true" aria-label="Bekräfta återställning" onClick={(e) => e.stopPropagation()}>
              <h3 className="h2 mb-2">Ersätta allt?</h3>
              <p className="font-bold mb-3">
                Filen innehåller {pending.counts.lists} listor, {pending.counts.words} glosor och {pending.counts.creatures} figurer. Det som finns i appen nu ersätts.
              </p>
              <div className="flex gap-2">
                <button type="button" className="btn btn-danger flex-1" onClick={confirmRestore}>Ersätt</button>
                <button type="button" className="btn btn-soft flex-1" onClick={() => setPending(null)} autoFocus>Avbryt</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 font-extrabold" style={{ minHeight: 48 }}>
      <span>{label}</span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 52, height: 30, accentColor: 'var(--color-lav-d)' }} />
    </label>
  );
}
