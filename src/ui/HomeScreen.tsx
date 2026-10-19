import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { feedCreature } from '../db/actions';
import { speciesInfo } from '../domain/creatures';
import { playSfx } from '../audio/sfx';
import { Creature } from './Creature';
import type { Mood } from './creatures/parts';
import { GrowthTrack } from './GrowthTrack';
import { HomeScene } from './HomeScene';
import { BallIcon, BerryIcon, EggIcon, GearIcon, MoonIcon, PawIcon } from './Icons';
import { useActiveCreature, useGame, usePendingEggs, useReadyCount } from './hooks';

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
  const [evolved, setEvolved] = useState(false);
  const [drops, setDrops] = useState<{ id: number; dx: number }[]>([]);
  const pendingFeeds = useRef(0);
  const dropId = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (!creature || !game) return <div className="home" />;
  const info = speciesInfo(creature.species);
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
  /**
   * Feeding is instant: every tap spawns its own falling berry straight away and the animations simply
   * overlap, so many can be fed quickly in a row. The database call per tap runs in the background.
   */
  const feed = async () => {
    if (game.food - pendingFeeds.current < 1) return;
    pendingFeeds.current++;
    const id = ++dropId.current;
    setDrops((d) => [...d, { id, dx: Math.round(Math.random() * 44 - 22) }]);
    window.setTimeout(() => setDrops((d) => d.filter((x) => x.id !== id)), 1500);
    window.clearTimeout(timer.current);
    setMood('eat');
    setAnnounce(`${info.name} äter och växer`);
    timer.current = window.setTimeout(() => setMood('idle'), 1200);
    playSfx('feed');
    try {
      const fed = await feedCreature(db);
      if (!fed) {
        setDrops((d) => d.filter((x) => x.id !== id));
      } else if (fed.evolved) {
        window.setTimeout(() => {
          playSfx('evolve');
          show('play', 2200, `${info.name} har utvecklats!`);
          setEvolved(true);
          window.setTimeout(() => setEvolved(false), 3500);
        }, 700);
      }
    } finally {
      pendingFeeds.current--;
    }
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
        {eggs > 0 && (
          <button type="button" className="chip egg-chip" onClick={onHatch} aria-label="Nytt ägg! Kläck det">
            <EggIcon width="20" height="20" /> Nytt ägg!
          </button>
        )}
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
        <Creature creature={creature} mood={mood} fxKey={fxKey} onPet={pet} label={info.name} drops={drops} />
        <div className="name-tag">
          <div className="nm">{info.name}</div>
        </div>
        <div className="w-full px-3" style={{ maxWidth: '22rem' }}>
          <GrowthTrack creature={creature} compact />
        </div>
        {evolved && (
          <p className="chip" style={{ background: 'var(--color-mint)', color: '#0f4d38' }} role="status">
            {info.name} har utvecklats!
          </p>
        )}
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
        <button type="button" className="btn btn-primary btn-big w-full train-btn" onClick={onTrain}>
          <span>{hasActive ? 'FORTSÄTT' : 'TRÄNA'}</span>
          <small>{status}</small>
        </button>
      </div>
    </div>
  );
}
