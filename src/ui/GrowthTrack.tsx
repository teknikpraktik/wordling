import { STAGE_EVOLVED_XP, STAGE_GROWING_XP, speciesInfo, xpToNextStage } from '../domain/creatures';
import type { OwnedCreature, Stage } from '../domain/types';
import { CreatureArt, SilhouetteArt } from './creatures/CreatureArt';

const NAMES: Record<Stage, string> = { 1: 'Baby', 2: 'Growing', 3: 'Grown-up' };
const AT: Record<Stage, number> = { 1: 0, 2: (STAGE_GROWING_XP / STAGE_EVOLVED_XP) * 100, 3: 100 };
// Art gets bigger with every stage, so the size of the creature can be read off the track.
const SIZE = { compact: { 1: 30, 2: 40, 3: 52 }, full: { 1: 64, 2: 84, 3: 108 } } as const;

/**
 * The creature's life as a track: where it is now, how far it has come and how big it can become.
 * Stages the creature has not reached yet are shown as silhouettes.
 */
export function GrowthTrack({ creature, compact = false }: { creature: OwnedCreature; compact?: boolean }) {
  const info = speciesInfo(creature.species);
  const pct = Math.min(100, (creature.xp / STAGE_EVOLVED_XP) * 100);
  const next = xpToNextStage(creature.xp);
  const sizes = SIZE[compact ? 'compact' : 'full'];
  const stages: Stage[] = [1, 2, 3];
  const text = next
    ? `${creature.xp} XP · ${next.remaining} to go until ${NAMES[next.next]}`
    : `${creature.xp} XP · Fully grown!`;

  return (
    <div
      className={`growth ${compact ? 'compact' : ''}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={STAGE_EVOLVED_XP}
      aria-valuenow={Math.min(creature.xp, STAGE_EVOLVED_XP)}
      aria-valuetext={`${creature.xp} of ${STAGE_EVOLVED_XP} XP. Now: ${NAMES[creature.stage]}`}
      aria-label={`How much ${info.name} has grown`}
    >
      <div className="growth-art" style={{ height: sizes[3] + 4 }}>
        {stages.map((st) => {
          const reached = creature.stage >= st;
          return (
            <div
              key={st}
              className={`growth-stage ${creature.stage === st ? 'now' : ''}`}
              style={{ left: `${AT[st]}%`, width: sizes[st], height: sizes[st] }}
              aria-hidden="true"
            >
              {reached ? (
                <CreatureArt species={creature.species} stage={st} variant={creature.variant} noShadow mood="idle" label="" />
              ) : (
                <SilhouetteArt species={creature.species} stage={st} />
              )}
            </div>
          );
        })}
      </div>
      <div className="growth-bar" aria-hidden="true">
        <i style={{ width: `${pct}%` }} />
        {stages.map((st) => (
          <b key={st} className={creature.stage >= st ? 'on' : ''} style={{ left: `${AT[st]}%` }} />
        ))}
        <span className="growth-you" style={{ left: `${pct}%` }} />
      </div>
      <div className="growth-labels" aria-hidden="true">
        {stages.map((st) => (
          <span key={st} className={creature.stage === st ? 'now' : ''} style={{ left: `${AT[st]}%` }}>
            {NAMES[st]}
            {!compact && <small>{st === 1 ? '0' : st === 2 ? STAGE_GROWING_XP : STAGE_EVOLVED_XP} XP</small>}
          </span>
        ))}
      </div>
      <p className={`growth-text ${compact ? 'text-xs' : 'text-sm'}`}>{text}</p>
    </div>
  );
}
