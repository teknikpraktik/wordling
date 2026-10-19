import { normalize } from './normalize';

export interface ParsedPair {
  sv: string;
  en: string;
  alts: string[];
}

export interface ParseResult {
  pairs: ParsedPair[];
  /** Lines that could not be split into two columns. */
  rejected: string[];
  /** True when the left column looks English and the right looks Swedish. */
  suggestSwap: boolean;
}

const NUMBERING = /^\s*(?:\d{1,3}\s*[.)]|[-•*])\s+/;
const DASH_SEPARATORS = [' - ', ' – ', ' — ', ' = ', ' : ', ' → ', ' -> ', ' > '];

function splitLine(line: string): [string, string] | null {
  if (line.includes('\t')) {
    const cols = line.split('\t').map((c) => c.trim()).filter(Boolean);
    if (cols.length >= 2) return [cols[0]!, cols[1]!];
    return null;
  }
  if (line.includes(';')) {
    const i = line.indexOf(';');
    return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
  }
  for (const sep of DASH_SEPARATORS) {
    const i = line.indexOf(sep);
    if (i > 0) return [line.slice(0, i).trim(), line.slice(i + sep.length).trim()];
  }
  if (/^[^:]+:[^:]+$/.test(line)) {
    const i = line.indexOf(':');
    return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
  }
  return null;
}

/** "dog / hound" -> primary "dog", alternatives ["hound"]. */
export function splitAlternatives(text: string): { main: string; alts: string[] } {
  const parts = text
    .split(/\s*[/|]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  return { main: parts[0] ?? '', alts: parts.slice(1) };
}

export function joinAlternatives(en: string, alts: string[]): string {
  return [en, ...alts].join(' / ');
}

const SV_WORDS = new Set([
  'och', 'att', 'det', 'en', 'ett', 'är', 'jag', 'du', 'vi', 'inte', 'hund', 'katt', 'hus', 'bil', 'vatten',
  'att', 'som', 'på', 'med', 'för', 'av', 'till', 'från', 'hej', 'tack', 'bok', 'skola', 'vän', 'fjäril',
  'röd', 'blå', 'grön', 'gul', 'stor', 'liten', 'springa', 'hoppa', 'äta', 'sova', 'fågel', 'blomma',
]);
const EN_WORDS = new Set([
  'the', 'a', 'an', 'to', 'and', 'is', 'are', 'i', 'you', 'we', 'not', 'dog', 'cat', 'house', 'car', 'water',
  'of', 'in', 'on', 'with', 'for', 'from', 'hello', 'thank', 'book', 'school', 'friend', 'butterfly',
  'red', 'blue', 'green', 'yellow', 'big', 'small', 'run', 'jump', 'eat', 'sleep', 'bird', 'flower',
]);

function languageScore(text: string): number {
  // >0 looks Swedish, <0 looks English
  let score = 0;
  if (/[åäöÅÄÖ]/.test(text)) score += 3;
  for (const w of normalize(text).split(/[\s,]+/)) {
    if (SV_WORDS.has(w)) score += 1;
    if (EN_WORDS.has(w)) score -= 1;
  }
  return score;
}

/** Heuristic: does the first column look English and the second Swedish? */
export function detectSwap(pairs: { sv: string; en: string }[]): boolean {
  let left = 0;
  let right = 0;
  for (const p of pairs) {
    left += languageScore(p.sv);
    right += languageScore(p.en);
  }
  return left < right - 1 && right > 0 && left <= 0;
}

export function parseWordList(text: string): ParseResult {
  const pairs: ParsedPair[] = [];
  const rejected: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(NUMBERING, '').replace(/\s+$/, '');
    if (!line.trim()) continue;
    const cols = splitLine(line);
    if (!cols || !cols[0] || !cols[1]) {
      rejected.push(raw.trim());
      continue;
    }
    const { main, alts } = splitAlternatives(cols[1]);
    pairs.push({
      sv: cols[0].replace(/\s+/g, ' ').toLocaleLowerCase('sv'),
      en: main.replace(/\s+/g, ' ').toLocaleLowerCase('en'),
      alts: alts.map((a) => a.toLocaleLowerCase('en')),
    });
  }
  return { pairs, rejected, suggestSwap: detectSwap(pairs) };
}

export function swapColumns(pairs: ParsedPair[]): ParsedPair[] {
  return pairs.map((p) => {
    const { main, alts } = splitAlternatives(p.sv);
    return { sv: joinAlternatives(p.en, p.alts), en: main, alts };
  });
}

/** Marks pairs that duplicate an earlier row or an existing Swedish word. */
export function findDuplicates(pairs: { sv: string; en: string }[], existingSv: Iterable<string> = []): Set<number> {
  const seen = new Set<string>();
  for (const e of existingSv) seen.add(normalize(e));
  const dup = new Set<number>();
  pairs.forEach((p, i) => {
    const key = normalize(p.sv);
    if (!key) return;
    if (seen.has(key)) dup.add(i);
    else seen.add(key);
  });
  return dup;
}
