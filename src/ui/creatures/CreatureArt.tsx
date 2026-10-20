import { speciesInfo } from '../../domain/creatures';
import type { SpeciesId, Stage } from '../../domain/types';
import type { Mood } from './parts';
import { SPECIES_ART } from './species';

const VARIANT_FILTERS = ['none', 'hue-rotate(38deg) saturate(1.05)', 'hue-rotate(-48deg)', 'hue-rotate(110deg) saturate(0.95)'];

interface Props {
  species: SpeciesId;
  stage: Stage;
  mood?: Mood;
  variant?: number;
  className?: string;
  /** Hide the ground shadow (e.g. inside cards). */
  noShadow?: boolean;
  label?: string;
}

const SCALE: Record<Stage, number> = { 1: 0.8, 2: 0.92, 3: 1 };

export function CreatureArt({ species, stage, mood = 'idle', variant = 0, className = '', noShadow, label }: Props) {
  const info = speciesInfo(species);
  const Art = SPECIES_ART[species];
  const s = SCALE[stage];
  return (
    <svg
      viewBox="0 0 200 200"
      role="img"
      aria-label={label ?? `${info.stageNames[stage - 1]}`}
      className={`creature mood-${mood} sp-${species} st-${stage} ${className}`}
      style={{ filter: VARIANT_FILTERS[variant % VARIANT_FILTERS.length] }}
    >
      {!noShadow && <ellipse className="c-shadow" cx={100} cy={182} rx={50 * s} ry={7} fill="#6B5B7B" opacity="0.14" />}
      <g className="c-bob">
        <g transform={`translate(100 182) scale(${s}) translate(-100 -182)`}>
          <Art pal={info.palette} stage={stage} mood={mood} />
        </g>
      </g>
    </svg>
  );
}

/** Silhouette used for species the player has not found yet. */
export function SilhouetteArt({ species, stage = 2, className = '' }: { species: SpeciesId; stage?: Stage; className?: string }) {
  const info = speciesInfo(species);
  const Art = SPECIES_ART[species];
  return (
    <svg viewBox="0 0 200 200" role="img" aria-label="Unknown creature" className={`creature silhouette ${className}`}>
      <g style={{ filter: 'brightness(0) opacity(0.16)' }}>
        <g transform={`translate(100 182) scale(${SCALE[stage]}) translate(-100 -182)`}>
          <Art pal={info.palette} stage={stage} mood="idle" />
        </g>
      </g>
    </svg>
  );
}

export function EggArt({ className = '', color = '#C9B6F2', crack = 0 }: { className?: string; color?: string; crack?: 0 | 1 | 2 }) {
  return (
    <svg viewBox="0 0 200 200" role="img" aria-label="Egg" className={`egg ${className}`}>
      <ellipse cx={100} cy={184} rx={44} ry={7} fill="#6B5B7B" opacity="0.14" />
      <g className="egg-body">
        <path d="M100 26 C146 26 168 90 168 128 C168 160 138 182 100 182 C62 182 32 160 32 128 C32 90 54 26 100 26 Z" fill={color} />
        <path d="M100 26 C146 26 168 90 168 128 C168 160 138 182 100 182 C62 182 32 160 32 128 C32 90 54 26 100 26 Z" fill="url(#eggshine)" opacity="0.55" />
        <defs>
          <radialGradient id="eggshine" cx="35%" cy="28%" r="60%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g fill="#fff" opacity="0.75">
          <circle cx={78} cy={104} r={9} />
          <circle cx={124} cy={92} r={6.5} />
          <circle cx={116} cy={138} r={11} />
          <circle cx={72} cy={150} r={5.5} />
        </g>
        {crack >= 1 && <path d="M92 40 L102 62 L90 76 L104 96" stroke={INKC} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />}
        {crack >= 2 && <path d="M130 70 L118 90 L132 106 L120 124 M70 86 L84 104 L70 122" stroke={INKC} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />}
      </g>
    </svg>
  );
}
const INKC = '#4A3B52';
