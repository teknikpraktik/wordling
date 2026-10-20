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
        await navigator.share({ files: [file], title: 'Wordling backup' });
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
    setMsg({ ok: true, text: 'The backup has been saved.' });
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setMsg(null);
    const v = parseBackup(await file.text());
    if (!v.ok) setMsg({ ok: false, text: v.errors[0] ?? 'Invalid backup.' });
    else setPending(v);
    if (fileRef.current) fileRef.current.value = '';
  };

  const confirmRestore = async () => {
    if (!pending?.backup) return;
    try {
      await restoreBackup(db, pending.backup);
      setMsg({ ok: true, text: 'Everything has been restored.' });
    } catch (e) {
      setMsg({ ok: false, text: `Restore failed – nothing was changed. ${(e as Error).message}` });
    }
    setPending(null);
  };

  const last = s.lastBackupAt ? new Date(s.lastBackupAt).toLocaleDateString('en-GB') : 'never';

  return (
    <div className="sheet-back" onClick={onClose} role="presentation">
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <h2 className="h1">Settings</h2>
          <button type="button" className="btn btn-soft" onClick={onClose}>Done</button>
        </div>

        <section className="card mb-3 flex flex-col gap-3" aria-labelledby="set-sound">
          <h3 id="set-sound" className="h2">Sound</h3>
          <Toggle label="Pronunciation (English words)" checked={s.speechEnabled} onChange={(v) => set({ speechEnabled: v })} />
          {!supported && <p className="text-sm font-bold muted">This device has no speech synthesis. Everything else still works.</p>}
          <div role="group" aria-label="Accent" className="flex gap-2">
            {(['gb', 'us'] as const).map((a) => (
              <button key={a} type="button" className={`btn flex-1 ${s.accent === a ? 'btn-primary' : 'btn-soft'}`} aria-pressed={s.accent === a} onClick={() => set({ accent: a })}>
                {a === 'gb' ? 'British' : 'American'}
              </button>
            ))}
          </div>
          <div>
            <label className="label" htmlFor="rate">Speech speed</label>
            <div className="flex items-center gap-3">
              <input id="rate" type="range" min="0.6" max="1.1" step="0.05" value={s.speechRate} onChange={(e) => set({ speechRate: Number(e.target.value) })} className="flex-1" style={{ minHeight: 44 }} />
              <button type="button" className="btn btn-soft" onClick={() => speak('butterfly', { ...speech, enabled: true })} disabled={!supported}>Test</button>
            </div>
          </div>
          <Toggle label="Sound effects" checked={s.sfxEnabled} onChange={(v) => { set({ sfxEnabled: v }); setSfxEnabled(v); if (v) setTimeout(() => playSfx('correct'), 50); }} />
        </section>

        <section className="card mb-3 flex flex-col gap-3" aria-labelledby="set-look">
          <h3 id="set-look" className="h2">Appearance</h3>
          <div role="group" aria-label="Text size" className="flex gap-2">
            {([['normal', 'Normal'], ['large', 'Large'], ['xlarge', 'Largest']] as const).map(([k, label]) => (
              <button key={k} type="button" className={`btn flex-1 ${s.textSize === k ? 'btn-primary' : 'btn-soft'}`} aria-pressed={s.textSize === k} onClick={() => set({ textSize: k })}>{label}</button>
            ))}
          </div>
          <Toggle label="Reduce motion" checked={s.reduceMotion} onChange={(v) => set({ reduceMotion: v })} />
        </section>

        <section className="card mb-3 flex flex-col gap-3" aria-labelledby="set-backup">
          <h3 id="set-backup" className="h2">Backup</h3>
          <p className="text-sm font-bold muted">Everything is stored only on this phone. Save a copy now and then, so you can move everything over if you change phone. Last backup: {last}.</p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-mint flex-1" onClick={doExport}><DownloadIcon width="22" height="22" /> Save backup</button>
            <button type="button" className="btn btn-soft flex-1" onClick={() => fileRef.current?.click()}><UploadIcon width="22" height="22" /> Restore backup</button>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-label="Choose backup file" onChange={(e) => void onFile(e.target.files?.[0])} />
          {msg && <p role="status" className={`feedback ${msg.ok ? 'good' : 'miss'}`}>{msg.text}</p>}
        </section>

        <p className="text-center text-sm font-bold muted">Wordling · No login, no tracking. Nothing leaves your phone.</p>

        {pending?.counts && (
          <div className="sheet-back" style={{ zIndex: 70, alignItems: 'center' }} role="presentation">
            <div className="card m-4 max-w-sm" role="alertdialog" aria-modal="true" aria-label="Confirm restore" onClick={(e) => e.stopPropagation()}>
              <h3 className="h2 mb-2">Replace everything?</h3>
              <p className="font-bold mb-3">
                The file contains {pending.counts.lists} lists, {pending.counts.words} words and {pending.counts.creatures} creatures. What is in the app now will be replaced.
              </p>
              <div className="flex gap-2">
                <button type="button" className="btn btn-danger flex-1" onClick={confirmRestore}>Replace</button>
                <button type="button" className="btn btn-soft flex-1" onClick={() => setPending(null)} autoFocus>Cancel</button>
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
