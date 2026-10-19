/** Cosy room backdrop for the home screen (original SVG). */
export function HomeScene() {
  return (
    <svg viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFF3DC" />
          <stop offset="1" stopColor="#FFE6D2" />
        </linearGradient>
        <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F9D7B8" />
          <stop offset="1" stopColor="#F2C29C" />
        </linearGradient>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#CFE3FF" />
          <stop offset="1" stopColor="#E9F4FF" />
        </linearGradient>
      </defs>
      <rect width="400" height="800" fill="url(#wall)" />
      {/* wallpaper dots */}
      <g fill="#FFD9C0" opacity="0.55">
        {Array.from({ length: 9 }).map((_, r) =>
          Array.from({ length: 8 }).map((__, c) => <circle key={`${r}-${c}`} cx={25 + c * 50 + (r % 2) * 25} cy={30 + r * 50} r={3} />),
        )}
      </g>
      {/* window */}
      <g transform="translate(250 120)">
        <rect x="-4" y="-4" width="128" height="148" rx="22" fill="#fff" />
        <rect x="6" y="6" width="108" height="128" rx="16" fill="url(#sky)" />
        <g fill="#fff"><ellipse cx="40" cy="44" rx="22" ry="10" /><ellipse cx="58" cy="38" rx="16" ry="9" /><ellipse cx="86" cy="86" rx="18" ry="8" /></g>
        <path d="M60 6v128M6 70h108" stroke="#fff" strokeWidth="6" />
        <path d="M-14 -10 q14 70 -6 150 h26 q-14 -78 6 -150z" fill="#C9B6F2" opacity="0.85" />
        <path d="M134 -10 q-14 70 6 150 h-26 q14 -78 -6 -150z" fill="#C9B6F2" opacity="0.85" />
      </g>
      {/* frames */}
      <g transform="translate(40 150)">
        <rect width="86" height="104" rx="14" fill="#fff" />
        <rect x="8" y="8" width="70" height="88" rx="9" fill="#D4F5E6" />
        <circle cx="43" cy="44" r="16" fill="#FFE59A" />
        <path d="M8 96 Q30 60 52 80 T78 70 V96z" fill="#A8E6CF" />
      </g>
      <g transform="translate(60 290) rotate(-4)">
        <rect width="56" height="56" rx="12" fill="#fff" />
        <path d="M28 44 C10 32 10 14 22 14 C26 14 28 17 28 20 C28 17 30 14 34 14 C46 14 46 32 28 44z" fill="#FFB7B2" />
      </g>
      {/* floor */}
      <path d="M0 560 Q200 540 400 560 V800 H0z" fill="url(#floor)" />
      <g stroke="#EBB78C" strokeWidth="2" opacity="0.5">
        <path d="M0 620 Q200 600 400 620" fill="none" /><path d="M0 690 Q200 672 400 690" fill="none" /><path d="M0 760 Q200 744 400 760" fill="none" />
      </g>
      {/* rug */}
      <ellipse cx="200" cy="640" rx="170" ry="48" fill="#C9B6F2" opacity="0.55" />
      <ellipse cx="200" cy="640" rx="140" ry="36" fill="#E9E0FB" />
      <ellipse cx="200" cy="640" rx="96" ry="24" fill="#D4F5E6" />
      {/* plant */}
      <g transform="translate(318 470)">
        <path d="M-26 70 h52 l-8 60 h-36z" fill="#FFB7B2" />
        <path d="M0 70 C-30 30 -28 0 -10 -20 C-4 10 0 30 0 70z" fill="#8FD9A8" />
        <path d="M0 70 C30 40 34 10 20 -14 C8 14 2 40 0 70z" fill="#A8E6CF" />
        <path d="M0 70 C-6 30 6 0 4 -30 C16 -6 10 40 0 70z" fill="#6FC9A6" />
      </g>
    </svg>
  );
}
