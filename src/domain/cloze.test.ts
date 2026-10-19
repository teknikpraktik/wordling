import { describe, expect, it } from 'vitest';
import { BLANK, clozeFor, fillBlank, makeCloze, sentenceFor } from './cloze';
import { SENTENCE_BANK } from './sentences';
import type { Word } from './types';

const w = (en: string, alts: string[] = [], example?: string): Word => ({
  id: en, listId: 'l', sv: 'x', en, alts, example, position: 0, createdAt: '', updatedAt: '',
});

describe('cloze', () => {
  it('hides the word in the sentence', () => {
    expect(makeCloze(w('dog'), 'My dog likes to play.')).toBe(`My ${BLANK} likes to play.`);
  });
  it('matches whole words only', () => {
    expect(makeCloze(w('cat'), 'The category is large.')).toBeNull();
    expect(makeCloze(w('cat'), 'Cat food is cheap.')).toBe(`${BLANK} food is cheap.`);
  });
  it('can use an alternative translation', () => {
    expect(makeCloze(w('puppy', ['dog']), 'The dog barks.')).toBe(`The ${BLANK} barks.`);
  });
  it('accepts a sentence that already has a gap', () => {
    expect(makeCloze(w('dog'), 'I walk my ___ every day.')).toBe(`I walk my ${BLANK} every day.`);
  });
  it('returns null when the word is not in the sentence', () => {
    expect(makeCloze(w('horse'), 'The cow gives milk.')).toBeNull();
  });
  it('prefers the sentence typed in on the word over the built-in one', () => {
    expect(sentenceFor(w('dog', [], 'Look at the dog!'))).toBe('Look at the dog!');
    expect(sentenceFor(w('dog'))).toBe(SENTENCE_BANK.dog);
    expect(sentenceFor(w('to run'))).toBe(SENTENCE_BANK.run);
    expect(sentenceFor(w('quokka'))).toBeNull();
  });
  it('fills the blank back in', () => {
    expect(fillBlank(`My ${BLANK} barks.`, 'dog')).toBe('My dog barks.');
  });
  it('every built-in sentence yields a valid blank that does not leak the answer', () => {
    for (const [key, sentence] of Object.entries(SENTENCE_BANK)) {
      const c = clozeFor(w(key));
      expect(c, key).not.toBeNull();
      expect(c!.toLowerCase().includes(` ${key} `), key).toBe(false);
      expect(c!, key).toContain(BLANK);
      expect(sentence.length, key).toBeGreaterThan(10);
    }
  });
});
