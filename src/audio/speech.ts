/** English pronunciation through the Web Speech API. Degrades silently when unavailable. */

export interface SpeechOptions {
  enabled: boolean;
  rate: number;
  accent: 'gb' | 'us';
}

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

const MALE_NAMES = /\b(daniel|arthur|oliver|fred|alex|tom|ryan|george|david|mark|guy|rishi|aaron|gordon|james|thomas|male|man)\b/i;
const FEMALE_NAMES =
  /\b(kate|serena|martha|stephanie|samantha|allison|ava|susan|karen|moira|tessa|fiona|zira|hazel|libby|sonia|aria|jenny|catherine|victoria|female|woman)\b/i;

function langOf(v: SpeechSynthesisVoice) {
  return v.lang.toLowerCase().replace('_', '-');
}

/** Higher = better. Prefers a female voice, then the chosen accent, then on-device voices. */
function score(v: SpeechSynthesisVoice, accent: 'gb' | 'us'): number {
  let s = 0;
  if (FEMALE_NAMES.test(v.name)) s += 100;
  if (MALE_NAMES.test(v.name)) s -= 100;
  if (langOf(v) === (accent === 'gb' ? 'en-gb' : 'en-us')) s += 20;
  else if (langOf(v) === 'en-gb' || langOf(v) === 'en-us') s += 10;
  if (v.localService) s += 5;
  return s;
}

/** Picks an English voice, preferring a woman's voice (the app is for a child) in the chosen accent. */
export function chooseVoice(voices: SpeechSynthesisVoice[], accent: 'gb' | 'us'): SpeechSynthesisVoice | null {
  const english = voices.filter((v) => langOf(v).startsWith('en'));
  if (!english.length) return null;
  return [...english].sort((a, b) => score(b, accent) - score(a, accent))[0] ?? null;
}

/** Slightly raised pitch for a friendlier, younger-sounding voice. */
const PITCH = 1.2;

let cachedVoices: SpeechSynthesisVoice[] = [];

function loadVoices(): SpeechSynthesisVoice[] {
  if (!speechSupported()) return [];
  const v = window.speechSynthesis.getVoices();
  if (v.length) cachedVoices = v;
  return cachedVoices;
}

if (speechSupported()) {
  // Voices load asynchronously on most browsers.
  window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
  loadVoices();
}

/** Must be called from a user gesture on iOS. Returns false if nothing could be spoken. */
export function speak(text: string, opts: SpeechOptions): boolean {
  if (!opts.enabled || !speechSupported() || !text.trim()) return false;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voice = chooseVoice(loadVoices(), opts.accent);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    } else {
      u.lang = opts.accent === 'gb' ? 'en-GB' : 'en-US';
    }
    u.rate = opts.rate;
    u.pitch = PITCH;
    synth.speak(u);
    return true;
  } catch {
    return false;
  }
}
