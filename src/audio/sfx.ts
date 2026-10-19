/** Tiny synthesised sound effects (no audio files, works offline). */
export type Sfx = 'correct' | 'reward' | 'feed' | 'hatch' | 'evolve' | 'pet' | 'tap';

let ctx: AudioContext | null = null;
let enabled = true;

export function setSfxEnabled(on: boolean) {
  enabled = on;
}

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(c: AudioContext, freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.08) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime + start);
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.05);
}

const RECIPES: Record<Sfx, (c: AudioContext) => void> = {
  tap: (c) => tone(c, 520, 0, 0.06, 'triangle', 0.04),
  correct: (c) => {
    tone(c, 659, 0, 0.12);
    tone(c, 880, 0.1, 0.18);
  },
  reward: (c) => {
    [784, 988, 1175, 1568].forEach((f, i) => tone(c, f, i * 0.07, 0.16, 'sine', 0.06));
  },
  feed: (c) => {
    tone(c, 330, 0, 0.08, 'triangle');
    tone(c, 392, 0.1, 0.08, 'triangle');
    tone(c, 330, 0.2, 0.08, 'triangle');
  },
  hatch: (c) => {
    [392, 440, 523, 659, 784, 1047].forEach((f, i) => tone(c, f, i * 0.09, 0.22, 'sine', 0.07));
  },
  evolve: (c) => {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(c, f, i * 0.11, 0.3, 'triangle', 0.07));
  },
  pet: (c) => {
    tone(c, 880, 0, 0.07, 'sine', 0.05);
    tone(c, 1175, 0.07, 0.1, 'sine', 0.05);
  },
};

export function playSfx(name: Sfx) {
  if (!enabled) return;
  const c = context();
  if (!c) return;
  try {
    RECIPES[name](c);
  } catch {
    /* sound is optional */
  }
}
