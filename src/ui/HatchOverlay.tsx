import { useEffect, useRef, useState } from 'react';
import { db } from '../db/db';
import { hatchEgg, type HatchResult } from '../db/actions';
import { speciesInfo } from '../domain/creatures';
import { playSfx } from '../audio/sfx';
import { CreatureArt, EggArt } from './creatures/CreatureArt';
import { useGame, useSettings } from './hooks';

const EGG_COLORS = ['#C9B6F2', '#A8E6CF', '#FFC9A8', '#FFE59A', '#9ADBE8', '#BFD3FF'];
const CONFETTI = ['#C9B6F2', '#A8E6CF', '#FFC9A8', '#FFE59A', '#FF9AA2', '#9ADBE8'];

export function HatchOverlay({ onClose, first }: { onClose: () => void; first?: boolean }) {
  const game = useGame();
  const settings = useSettings();
  const [phase, setPhase] = useState<'egg' | 'shake' | 'reveal'>('egg');
  const [result, setResult] = useState<HatchResult | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    if (phase === 'reveal') playSfx('hatch');
  }, [phase]);

  async function crack() {
    if (busy.current || phase !== 'egg') return;
    busy.current = true;
    setPhase('shake');
    playSfx('tap');
    // The outcome is written to the database BEFORE the animation continues.
    const r = await hatchEgg(db);
    if (!r) {
      onClose();
      return;
    }
    setResult(r);
    window.setTimeout(() => setPhase('reveal'), settings.reduceMotion ? 150 : 1500);
  }

  const color = EGG_COLORS[(game?.eggsHatched ?? 0) % EGG_COLORS.length]!;
  const info = result ? speciesInfo(result.creature.species) : null;

  return (
    <div className="overlay hatch-bg" role="dialog" aria-modal="true" aria-label="Hatch egg">
      <div className="inner items-center justify-center text-center px-6" style={{ paddingTop: 'var(--safe-top)' }}>
        {phase !== 'reveal' && (
          <>
            <h1 className="h1 mb-1">{first ? 'Welcome to Wordling!' : 'A new egg!'}</h1>
            <p className="muted mb-6 font-bold">{phase === 'egg' ? 'Tap the egg to hatch it.' : 'Something is happening…'}</p>
            <button
              type="button"
              onClick={crack}
              disabled={phase !== 'egg'}
              aria-label="Hatch the egg"
              className="block w-64 h-64 bg-transparent border-0 p-0"
            >
              <EggArt color={color} crack={phase === 'shake' ? 2 : 0} className={phase === 'shake' ? 'shake' : ''} />
            </button>
          </>
        )}
        {phase === 'reveal' && result && info && (
          <>
            {!settings.reduceMotion &&
              Array.from({ length: 28 }).map((_, i) => (
                <i
                  key={i}
                  className="confetti"
                  style={{
                    left: `${(i * 37) % 100}%`,
                    background: CONFETTI[i % CONFETTI.length],
                    animationDelay: `${(i % 7) * 0.12}s`,
                  }}
                />
              ))}
            <p className="font-extrabold muted">{result.isNew ? 'You got a new friend!' : 'Your friend got a new colour!'}</p>
            <div className="reveal w-72 h-72">
              <CreatureArt
                species={result.creature.species}
                stage={result.creature.stage}
                variant={result.creature.variant}
                mood="happy"
                label={info.name}
              />
            </div>
            <h1 className="h1">{info.name}</h1>
            <p className="muted font-bold mb-5 max-w-xs">{info.trait}</p>
            <button type="button" className="btn btn-primary btn-big" onClick={onClose} autoFocus>
              Hello, {info.name}!
            </button>
          </>
        )}
      </div>
    </div>
  );
}
