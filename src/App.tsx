import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { db } from './db/db';
import { ensureInitialized } from './db/actions';
import { setSfxEnabled } from './audio/sfx';
import { CreaturesScreen } from './ui/CreaturesScreen';
import { HatchOverlay } from './ui/HatchOverlay';
import { HomeScreen } from './ui/HomeScreen';
import { BookIcon, HomeIcon, PawIcon, TrainIcon } from './ui/Icons';
import { SettingsSheet } from './ui/SettingsSheet';
import { TrainScreen } from './ui/TrainScreen';
import { WordsScreen } from './ui/WordsScreen';
import { useActiveCreature, useGame, useSettings, useSettingsEffects, usePendingEggs } from './ui/hooks';

type Tab = 'home' | 'train' | 'creatures' | 'words';

const TABS: { id: Tab; label: string; Icon: typeof HomeIcon }[] = [
  { id: 'home', label: 'Hem', Icon: HomeIcon },
  { id: 'train', label: 'Träna', Icon: TrainIcon },
  { id: 'creatures', label: 'Figurer', Icon: PawIcon },
  { id: 'words', label: 'Glosor', Icon: BookIcon },
];

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureInitialized(db)
      .then(() => setReady(true))
      .catch((e: Error) => setError(e.message));
    void navigator.storage?.persist?.();
  }, []);

  if (error) {
    return (
      <div className="app items-center justify-center text-center p-6" role="alert">
        <h1 className="h1 mb-2">Något gick fel</h1>
        <p className="font-bold muted">Wordling kunde inte öppna sin lagring i den här webbläsaren. ({error})</p>
        <p className="font-bold muted mt-2">Stäng privat surfning och försök igen.</p>
      </div>
    );
  }
  if (!ready) return <div className="app" aria-busy="true" />;
  return <Shell />;
}

function Shell() {
  const [tab, setTab] = useState<Tab>('home');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hatching, setHatching] = useState(false);
  const [wordsImport, setWordsImport] = useState(false);
  const settings = useSettings();
  const game = useGame();
  const creature = useActiveCreature();
  const eggs = usePendingEggs();
  useSettingsEffects(settings);
  useEffect(() => setSfxEnabled(settings.sfxEnabled), [settings.sfxEnabled]);

  const { needRefresh: [needRefresh, setNeedRefresh], offlineReady: [offlineReady, setOfflineReady], updateServiceWorker } = useRegisterSW();

  // First run: the very first egg hatches right away.
  const firstRun = !!game && creature === null && eggs > 0;
  const [firstHatch, setFirstHatch] = useState(false);
  useEffect(() => {
    if (firstRun) {
      setHatching(true);
      setFirstHatch(true);
    }
  }, [firstRun]);
  const showHatch = hatching;
  useEffect(() => {
    if (!offlineReady) return;
    const t = window.setTimeout(() => setOfflineReady(false), 5000);
    return () => window.clearTimeout(t);
  }, [offlineReady, setOfflineReady]);
  const training = tab === 'train';

  const goTab = (t: Tab) => setTab(t);

  return (
    <div className="app">
      <main className="flex-1 min-h-0 flex flex-col" id="main">
        {tab === 'home' && (
          <HomeScreen
            onTrain={() => goTab('train')}
            onSettings={() => setSettingsOpen(true)}
            onHatch={() => setHatching(true)}
            onCollection={() => goTab('creatures')}
            backupDue={settings.listsSinceBackup >= 4}
          />
        )}
        {tab === 'train' && (
          <TrainScreen
            onExit={() => goTab('home')}
            onHatch={() => setHatching(true)}
            onImport={() => {
              setWordsImport(true);
              goTab('words');
            }}
          />
        )}
        {tab === 'creatures' && <CreaturesScreen onHatch={() => setHatching(true)} />}
        {tab === 'words' && <WordsScreen openImport={wordsImport} onImportHandled={() => setWordsImport(false)} />}
      </main>

      {!training && (
        <nav className="tabbar" aria-label="Huvudmeny">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} type="button" className="tab" aria-current={tab === id ? 'page' : undefined} onClick={() => goTab(id)}>
              <Icon />
              {label}
            </button>
          ))}
        </nav>
      )}

      {(needRefresh || offlineReady) && (
        <div className="toast" role="status">
          <span className="font-bold">{needRefresh ? 'En ny version finns.' : 'Klart! Wordling fungerar nu utan nätet.'}</span>
          {needRefresh ? (
            <button type="button" className="btn btn-mint" style={{ minHeight: 44 }} onClick={() => void updateServiceWorker(true)}>Uppdatera</button>
          ) : (
            <button type="button" className="btn btn-mint" style={{ minHeight: 44 }} onClick={() => { setOfflineReady(false); setNeedRefresh(false); }}>OK</button>
          )}
        </div>
      )}

      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
      {showHatch && <HatchOverlay first={firstHatch} onClose={() => { setHatching(false); setFirstHatch(false); }} />}
    </div>
  );
}
