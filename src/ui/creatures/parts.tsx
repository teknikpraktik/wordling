import type { ReactNode } from 'react';

export type Mood = 'idle' | 'happy' | 'eat' | 'sleep' | 'play' | 'pet';
export const INK = '#4A3B52';
const BLUSH = '#FF9AA2';

export function Eyes({ x, y, gap, r = 6.5, mood }: { x: number; y: number; gap: number; r?: number; mood: Mood }) {
  const xs = [x - gap, x + gap];
  if (mood === 'sleep') {
    return (
      <g stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none">
        {xs.map((ex) => (
          <path key={ex} d={`M${ex - r} ${y} Q${ex} ${y + r * 1.1} ${ex + r} ${y}`} />
        ))}
      </g>
    );
  }
  if (mood === 'pet' || mood === 'eat' || mood === 'play') {
    return (
      <g stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none">
        {xs.map((ex) => (
          <path key={ex} d={`M${ex - r} ${y + 3} Q${ex} ${y - r * 1.2} ${ex + r} ${y + 3}`} />
        ))}
      </g>
    );
  }
  return (
    <g className="eyes">
      {xs.map((ex) => (
        <g key={ex}>
          <ellipse cx={ex} cy={y} rx={r} ry={r * 1.18} fill={INK} />
          <circle cx={ex - r * 0.32} cy={y - r * 0.42} r={r * 0.4} fill="#fff" />
          <circle cx={ex + r * 0.35} cy={y + r * 0.45} r={r * 0.18} fill="#fff" opacity="0.9" />
        </g>
      ))}
    </g>
  );
}

export function Mouth({ x, y, mood, w = 6 }: { x: number; y: number; mood: Mood; w?: number }) {
  if (mood === 'eat') {
    return <ellipse className="chomp" cx={x} cy={y + 2} rx={w * 0.85} ry={w * 0.7} fill="#C95D6B" />;
  }
  if (mood === 'sleep') {
    return <ellipse cx={x} cy={y + 2} rx={2.4} ry={2.8} fill={INK} opacity="0.7" />;
  }
  return (
    <path
      d={`M${x - w} ${y} Q${x} ${y + w * 1.15} ${x + w} ${y}`}
      stroke={INK}
      strokeWidth="2.8"
      strokeLinecap="round"
      fill="none"
    />
  );
}

export function Cheeks({ x, y, gap, rx = 7, ry = 4.5 }: { x: number; y: number; gap: number; rx?: number; ry?: number }) {
  return (
    <g fill={BLUSH} opacity="0.55">
      <ellipse cx={x - gap} cy={y} rx={rx} ry={ry} />
      <ellipse cx={x + gap} cy={y} rx={rx} ry={ry} />
    </g>
  );
}

export function Star({ cx, cy, r, fill }: { cx: number; cy: number; r: number; fill: string }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    return `${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  return <polygon points={pts} fill={fill} stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" />;
}

export function Group({ className, children, origin }: { className: string; children: ReactNode; origin?: string }) {
  return (
    <g className={className} style={origin ? { transformOrigin: origin } : undefined}>
      {children}
    </g>
  );
}
