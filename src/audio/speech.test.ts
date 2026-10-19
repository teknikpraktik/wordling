import { describe, expect, it } from 'vitest';
import { chooseVoice } from './speech';

const v = (name: string, lang: string, localService = true) => ({ name, lang, localService }) as SpeechSynthesisVoice;

describe('chooseVoice', () => {
  const voices = [v('Daniel', 'en-GB'), v('Fred', 'en-US'), v('Samantha', 'en-US'), v('Kate', 'en-GB'), v('Anna', 'sv-SE')];
  it('prefers a female voice in the chosen accent', () => {
    expect(chooseVoice(voices, 'gb')!.name).toBe('Kate');
    expect(chooseVoice(voices, 'us')!.name).toBe('Samantha');
  });
  it('falls back to a female voice in the other accent rather than a man in the right accent', () => {
    expect(chooseVoice([v('Daniel', 'en-GB'), v('Samantha', 'en-US')], 'gb')!.name).toBe('Samantha');
  });
  it('still returns a voice if only male ones exist, and null without English voices', () => {
    expect(chooseVoice([v('Daniel', 'en-GB')], 'gb')!.name).toBe('Daniel');
    expect(chooseVoice([v('Anna', 'sv-SE')], 'gb')).toBeNull();
  });
});
