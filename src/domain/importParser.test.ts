import { describe, expect, it } from 'vitest';
import { detectSwap, findDuplicates, parseWordList, swapColumns } from './importParser';
import { pairsFromOcr, type OcrLine } from './ocrParse';

describe('parseWordList', () => {
  it('parses dash separated lists', () => {
    const r = parseWordList('hund - dog\nkatt - cat\nfjäril - butterfly');
    expect(r.pairs.map((p) => [p.sv, p.en])).toEqual([['hund', 'dog'], ['katt', 'cat'], ['fjäril', 'butterfly']]);
    expect(r.rejected).toEqual([]);
    expect(r.suggestSwap).toBe(false);
  });
  it('parses semicolon and tab separated lists', () => {
    expect(parseWordList('hund;dog\nkatt;cat').pairs).toHaveLength(2);
    expect(parseWordList('hund\tdog\nkatt\tcat').pairs.map((p) => p.en)).toEqual(['dog', 'cat']);
  });
  it('handles Windows line endings, blank lines and numbering', () => {
    const r = parseWordList('1. hund - dog\r\n\r\n2) katt - cat\r\n');
    expect(r.pairs.map((p) => p.sv)).toEqual(['hund', 'katt']);
  });
  it('keeps hyphens inside compound words', () => {
    expect(parseWordList('glass - ice-cream').pairs[0]!.en).toBe('ice-cream');
  });
  it('reads alternatives separated by slash', () => {
    const p = parseWordList('hund - dog / hound').pairs[0]!;
    expect(p.en).toBe('dog');
    expect(p.alts).toEqual(['hound']);
  });
  it('reports lines without a separator instead of guessing', () => {
    const r = parseWordList('Vecka 5\nhund - dog');
    expect(r.rejected).toEqual(['Vecka 5']);
    expect(r.pairs).toHaveLength(1);
  });
  it('suggests swapping when English comes first', () => {
    const r = parseWordList('dog - hund\ncat - katt\nthe house - huset\nbutterfly - fjäril');
    expect(r.suggestSwap).toBe(true);
    const swapped = swapColumns(r.pairs);
    expect(swapped[0]).toEqual({ sv: 'hund', en: 'dog', alts: [] });
    expect(detectSwap(swapped)).toBe(false);
  });
});

describe('findDuplicates', () => {
  it('flags repeated rows and words already in the list', () => {
    const d = findDuplicates([{ sv: 'Hund', en: 'dog' }, { sv: 'katt', en: 'cat' }, { sv: ' hund ', en: 'dog' }], ['katt']);
    expect([...d].sort()).toEqual([1, 2]);
  });
});

describe('pairsFromOcr', () => {
  const line = (text: string, ws: [string, number, number][]): OcrLine => ({
    text, y0: 0, y1: 10, words: ws.map(([t, x0, x1]) => ({ text: t, x0, x1, confidence: 90 })),
  });
  it('splits two-column layouts at the widest gap', () => {
    const rows = pairsFromOcr([line('fjäril butterfly', [['fjäril', 10, 80], ['butterfly', 400, 500]])], 600);
    expect(rows[0]).toMatchObject({ sv: 'fjäril', en: 'butterfly', confident: true });
  });
  it('uses explicit separators', () => {
    const rows = pairsFromOcr([line('1. hund - dog', [['1.', 0, 10], ['hund', 20, 60], ['-', 65, 70], ['dog', 75, 100]])], 600);
    expect(rows[0]).toMatchObject({ sv: 'hund', en: 'dog', confident: true });
  });
  it('does not silently guess when pairing is unclear', () => {
    const rows = pairsFromOcr([line('the quick brown', [['the', 0, 30], ['quick', 36, 80], ['brown', 86, 130]])], 600);
    expect(rows[0]).toMatchObject({ en: '', confident: false });
  });
  it('flags low-confidence reads', () => {
    const l = line('hund dog', [['hund', 10, 60], ['dog', 400, 440]]);
    l.words.forEach((w) => (w.confidence = 30));
    expect(pairsFromOcr([l], 600)[0]!.confident).toBe(false);
  });
});
