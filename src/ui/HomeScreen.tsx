import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { feedCreature } from '../db/actions';
import { speciesInfo, xpToNextStage } from '../domain/creatures';
import { playSfx } from '../audio/sfx';
import { Creature } from './Creature';
import type { Mood } from './creatures/parts';
import { HomeScene } from './HomeScene';
import { BallIcon, BerryIcon, EggIcon, GearIcon, MoonIcon, PawIcon } from './Icons';
import { useActiveCreature, useGame, usePendingEggs, useReadyCount } from './hooks';

const STAGE_LABEL = { 1: 'Bebis', 2: 'Växande', 3: 'Fullt utvecklad' } as const;

interface Props {
  onTrain: () => void;
  onSettings: () => void;
  onHatch: () => void;
  onCollection: () => void;
  backupDue: boolean;
}

export function HomeScreen({ onTrain, onSettings, onHatch, onCollection, backupDue }: Props) {
  const creature = useActiveCreature();
  const game = useGame();
  const ready = useReadyCount();
  const eggs = usePendingEggs();
  const wordCount = useLiveQuery(() => db.words.count(), []) ?? 0;
  const hasActive = useLiveQuery(() => db.sessions.where('status').equals('active').count(), []) ?? 0;
  const [mood, setMood] = useState<Mood>('idle');
  const [fxKey, setFxKey] = useState(0);
  const [announce, setAnnounce] = useState('');
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (!creature || !game) return <div className="home" />;
  const info = speciesInfo(creature.species);
  const next = xpToNextStage(creature.xp);
  const pct = next
    ? Math.min(100, Math.round(((creature.xp - (next.target === 150 ? 0 : 150)) / (next.target - (next.target === 150 ? 0 : 150))) * 100))
    : 100;

  const show = (m: Mood, ms: number, text: string) => {
    window.clearTimeout(timer.current);
    setMood(m);
    setFxKey((k) => k + 1);
    setAnnounce(text);
    timer.current = window.setTimeout(() => setMood('idle'), ms);
  };

  const pet = () => {
    playSfx('pet');
    show('pet', 1000, `${info.name} blir klappad`);
  };
  const feed = async () => {
    if (mood === 'eat') return;
    const ok = await feedCreature(db);
    if (!ok) return;
    playSfx('feed');
    show('eat', 1900, `${info.name} äter`);
  };
  const play = () => {
    playSfx('reward');
    show('play', 1900, `${info.name} leker`);
  };
  const sleepToggle = () => {
    window.clearTimeout(timer.current);
    if (mood === 'sleep') {
      setMood('idle');
      setAnnounce(`${info.name} vaknar`);
    } else {
      setMood('sleep');
      setAnnounce(`${info.name} sover`);
    }
  };

  const status =
    wordCount === 0 ? 'Lägg in veckans glosor för att börja' : ready > 0 ? `${ready} ${ready === 1 ? 'glosa' : 'glosor'} redo` : 'Allt klart för idag';

  return (
    <div className="home">
      <div className="home-scene">
        <HomeScene />
      </div>
      <div className="home-top">
        <span className="chip" aria-label={`Mat: ${game.food}`}>
          <BerryIcon width="22" height="22" style={{ color: '#d6456b' }} />
          <span>{game.food}</span>
        </span>
        <div className="flex gap-2">
          <button type="button" className="icon-btn" onClick={onCollection} aria-label="Mina figurer">
            <PawIcon width="26" height="26" />
          </button>
          <button type="button" className="icon-btn relative" onClick={onSettings} aria-label="Inställningar">
            <GearIcon width="26" height="26" />
            {backupDue && <span className="absolute top-2 right-2 w-3 h-3 rounded-full bg-peach-d" aria-hidden="true" />}
          </button>
        </div>
      </div>

      <div className="home-mid">
        {eggs > 0 && (
          <button type="button" className="chip mb-1" onClick={onHatch} style={{ background: 'var(--color-sun)', minHeight: 44 }}>
            <EggIcon width="20" height="20" /> Nytt ägg! Kläck det
          </button>
        )}
        <Creature creature={creature} mood={mood} fxKey={fxKey} onPet={pet} label={info.name} />
        <div className="name-tag">
          <div className="nm">{info.name}</div>
          <div className="font-extrabold muted text-sm">{STAGE_LABEL[creature.stage]}</div>
          <div className="xpbar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Utveckling">
            <i style={{ width: `${pct}%` }} />
          </div>
        </div>
        <p className="sr-only" aria-live="polite">{announce}</p>
      </div>

      <div className="home-bottom">
        <div className="action-row">
          <button type="button" className="action" onClick={feed} disabled={game.food < 1} aria-label="Mata">
            <BerryIcon style={{ color: '#d6456b' }} />
            Mata
          </button>
          <button type="button" className="action" onClick={play} aria-label="Leka">
            <BallIcon style={{ color: 'var(--color-peach-d)' }} />
            Leka
          </button>
          <button type="button" className="action" onClick={sleepToggle} aria-pressed={mood === 'sleep'} aria-label="Sov">
            <MoonIcon style={{ color: 'var(--color-lav-d)' }} />
            Sov
          </button>
        </div>
        <button type="button" className="btn btn-primary btn-big w-full" onClick={onTrain}>
          {hasActive ? 'FORTSÄTT' : 'TRÄNA'}
        </button>
        <p className="font-extrabold" style={{ color: 'var(--color-ink)' }}>{status}</p>
      </div>
    </div>
  );
}
