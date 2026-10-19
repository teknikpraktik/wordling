import { SENTENCE_BANK } from './sentences';
import { normalize, stripLeading } from './normalize';
import type { Word } from './types';

export const BLANK = '_____';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The example sentence for a word: the one typed in on the word, otherwise the built-in one. */
export function sentenceFor(word: Pick<Word, 'en' | 'example'>): string | null {
  const own = word.example?.trim();
  if (own) return own;
  return SENTENCE_BANK[stripLeading(normalize(word.en))] ?? null;
}

/**
 * Turns a sentence into a fill-in-the-blank prompt by hiding the word (or one of its accepted
 * alternatives). Returns null when the word does not appear, so no broken question is ever asked.
 * A sentence that already contains ___ is used as it is.
 */
export function makeCloze(word: Pick<Word, 'en' | 'alts'>, sentence: string): string | null {
  if (/_{3,}/.test(sentence)) return sentence.replace(/_{3,}/, BLANK);
  const forms = [word.en, ...word.alts].map((f) => stripLeading(normalize(f))).filter(Boolean);
  for (const form of forms) {
    const re = new RegExp(`(^|[^A-Za-z])${escapeRe(form)}(?![A-Za-z])`, 'i');
    if (re.test(sentence)) return sentence.replace(re, `$1${BLANK}`);
  }
  return null;
}

export function clozeFor(word: Word): string | null {
  const s = sentenceFor(word);
  return s ? makeCloze(word, s) : null;
}

/** Fills the blank with the answer (shown after answering). */
export function fillBlank(prompt: string, answer: string): string {
  return prompt.replace(BLANK, answer);
}
