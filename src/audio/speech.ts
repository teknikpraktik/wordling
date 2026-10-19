/** English pronunciation through the Web Speech API. Degrades silently when unavailable. */

export interface SpeechOptions {
  enabled: boolean;
  rate: number;
  accent: 'gb' | 'us';
}

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

export function chooseVoice(voices: SpeechSynthesisVoice[], accent: 'gb' | 'us'): SpeechSynthesisVoice | null {
  const english = voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith('en'));
  if (!english.length) return null;
  const order = accent === 'gb' ? ['en-gb', 'en-us'] : ['en-us', 'en-gb'];
  for (const lang of order) {
    const matches = english.filter((v) => v.lang.toLowerCase().replace('_', '-') === lang);
    // Prefer on-device voices and "Daniel"/"Samantha"/"Kate" style natural ones.
    const best = matches.find((v) => v.localService) ?? matches[0];
    if (best) return best;
  }
  return english[0] ?? null;
}

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
    synth.speak(u);
    return true;
  } catch {
    return false;
  }
}
