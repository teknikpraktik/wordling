import { speciesInfo } from '../domain/creatures';
import { Glimmo } from './creatures/species';
import { SparkIcon } from './Icons';

/**
 * App icon artwork (rendered to PNG by scripts/make-icons.mjs).
 * A close-up of Glimmo's face on a deep indigo background: few details, big eyes, readable at tiny sizes.
 */
export function AppIcon({ rounded = false }: { rounded?: boolean }) {
  const pal = speciesInfo('glimmo').palette;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
      <defs>
        <radialGradient id="bg" cx="50%" cy="42%" r="80%">
          <stop offset="0" stopColor="#3D2780" />
          <stop offset="1" stopColor="#150B38" />
        </radialGradient>
        <filter id="outline" x="-10%" y="-10%" width="120%" height="120%">
          <feMorphology in="SourceAlpha" operator="dilate" radius="9" result="grow" />
          <feFlood floodColor="#ffffff" result="white" />
          <feComposite in="white" in2="grow" operator="in" result="rim" />
          <feMerge>
            <feMergeNode in="rim" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="512" height="512" rx={rounded ? 112 : 0} fill="url(#bg)" />
      <circle cx="256" cy="268" r="214" fill="#ffffff" opacity="0.1" />
      <g filter="url(#outline)">
        {/* crop of the creature drawing (200 x 200 units) around the head */}
        <svg x="0" y="0" width="512" height="512" viewBox="33 50 134 134">
          <Glimmo pal={pal} stage={2} mood="idle" />
        </svg>
      </g>
      <SparkIcon x="58" y="70" width="44" height="44" />
      <SparkIcon x="420" y="96" width="32" height="32" />
    </svg>
  );
}
