import { useEffect, useRef, useState } from 'react';
import { CreatureArt } from './creatures/CreatureArt';
import type { Mood } from './creatures/parts';
import type { OwnedCreature } from '../domain/types';
import { BerryIcon, HeartIcon, SparkIcon } from './Icons';
import { FEED_XP } from '../domain/rewards';

interface Props {
  creature: OwnedCreature;
  mood: Mood;
  /** bumps each time to retrigger one-shot effects */
  fxKey: number;
  onPet?: () => void;
  spontaneous?: boolean;
  label: string;
}

/** The living creature: art + one-shot effects (hearts, crumbs, sparkles) + occasional spontaneous hops. */
export function Creature({ creature, mood, fxKey, onPet, spontaneous = true, label }: Props) {
  const [hop, setHop] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!spontaneous) return;
    const schedule = () => {
      timer.current = window.setTimeout(() => {
        setHop(true);
        window.setTimeout(() => setHop(false), 700);
        schedule();
      }, 6000 + Math.random() * 7000);
    };
    schedule();
    return () => window.clearTimeout(timer.current);
  }, [spontaneous]);

  const art = (
    <CreatureArt
      species={creature.species}
      stage={creature.stage}
      variant={creature.variant}
      mood={mood}
      className={hop && mood === 'idle' ? 'hop' : ''}
      label={label}
    />
  );
  return (
    <div className="stage-wrap">
      {onPet ? (
        <button type="button" className="pet-btn" onClick={onPet} aria-label={`Klappa ${label}`}>
          {art}
        </button>
      ) : (
        art
      )}
      <Effects mood={mood} fxKey={fxKey} />
    </div>
  );
}

function Effects({ mood, fxKey }: { mood: Mood; fxKey: number }) {
  if (mood === 'pet') {
    return (
      <div className="fx" key={`pet-${fxKey}`} style={{ inset: 0 }} aria-hidden="true">
        {[22, 48, 70].map((left, i) => (
          <HeartIcon key={left} className="heart" style={{ left: `${left}%`, top: `${28 + (i % 2) * 8}%`, animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    );
  }
  if (mood === 'sleep') {
    return (
      <div className="fx" style={{ inset: 0 }} aria-hidden="true">
        <span className="zzz">Z</span>
        <span className="zzz z2">z</span>
      </div>
    );
  }
  if (mood === 'eat') {
    return (
      <div className="fx" key={`eat-${fxKey}`} style={{ inset: 0 }} aria-hidden="true">
        <BerryIcon className="crumb" style={{ color: '#d6456b' }} />
        <span className="grow-pop">+{FEED_XP} ★</span>
      </div>
    );
  }
  if (mood === 'play') {
    return (
      <div className="fx" key={`play-${fxKey}`} style={{ inset: 0 }} aria-hidden="true">
        <span className="ball" style={{ left: '40%' }} />
        {[18, 78, 60].map((left, i) => (
          <SparkIcon key={left} className="sparkle" style={{ left: `${left}%`, top: `${20 + i * 14}%`, animationDelay: `${i * 0.25}s` }} />
        ))}
      </div>
    );
  }
  return null;
}
