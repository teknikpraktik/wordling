import { CreatureArt } from './creatures/CreatureArt';
import { SparkIcon, HeartIcon } from './Icons';

/**
 * App icon artwork (used by scripts/make-icons.mjs to render the PWA icons).
 * Deep lavender background for strong contrast, big happy creature with a white outline.
 */
export function AppIcon({ rounded = false }: { rounded?: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
      <defs>
        <radialGradient id="bg" cx="50%" cy="38%" r="80%">
          <stop offset="0" stopColor="#3D2780" />
          <stop offset="1" stopColor="#150B38" />
        </radialGradient>
        <filter id="outline" x="-10%" y="-10%" width="120%" height="120%">
          <feMorphology in="SourceAlpha" operator="dilate" radius="7" result="grow" />
          <feFlood floodColor="#ffffff" result="white" />
          <feComposite in="white" in2="grow" operator="in" result="rim" />
          <feMerge>
            <feMergeNode in="rim" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="512" height="512" rx={rounded ? 112 : 0} fill="url(#bg)" />
      <circle cx="256" cy="262" r="168" fill="#ffffff" opacity="0.13" />
      <circle cx="256" cy="262" r="124" fill="#ffffff" opacity="0.09" />
      <g filter="url(#outline)">
        <svg x="62" y="38" width="388" height="388" viewBox="0 0 200 200" overflow="visible">
          <CreatureArt species="glimmo" stage={2} mood="happy" noShadow label="Wordling" />
        </svg>
      </g>
      <SparkIcon x="84" y="84" width="46" height="46" />
      <SparkIcon x="392" y="132" width="34" height="34" />
      <SparkIcon x="400" y="360" width="40" height="40" />
      <HeartIcon x="72" y="330" width="40" height="40" />
    </svg>
  );
}
