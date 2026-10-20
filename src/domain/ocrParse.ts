import { splitAlternatives } from './importParser';

export interface OcrWord {
  text: string;
  x0: number;
  x1: number;
  confidence: number;
}
export interface OcrLine {
  text: string;
  words: OcrWord[];
  y0: number;
  y1: number;
}

export interface OcrRow {
  sv: string;
  en: string;
  alts: string[];
  /** false = the app could not tell which words belong together; the user must check this row. */
  confident: boolean;
  note?: string;
}

const SEPARATOR = /\s+[-–—=:]\s+|\s*[;\t]\s*/;
const NUMBERING = /^\s*\d{1,3}\s*[.)]\s*/;
const MIN_CONFIDENCE = 60;

function clean(s: string): string {
  return s.replace(NUMBERING, '').replace(/[|_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Splits a line at its widest horizontal gap if that gap is clearly larger than normal word spacing. */
function splitByGap(words: OcrWord[], pageWidth: number): [string, string, number] | null {
  if (words.length < 2) return null;
  const sorted = [...words].sort((a, b) => a.x0 - b.x0);
  const gaps = sorted.slice(1).map((w, i) => w.x0 - sorted[i]!.x1);
  const widest = Math.max(...gaps);
  const idx = gaps.indexOf(widest);
  const others = gaps.filter((_, i) => i !== idx).sort((a, b) => a - b);
  const typical = others.length ? others[Math.floor(others.length / 2)]! : 0;
  const minGap = Math.max(pageWidth * 0.04, typical * 3, 12);
  if (widest < minGap) return null;
  const left = sorted.slice(0, idx + 1).map((w) => w.text).join(' ');
  const right = sorted.slice(idx + 1).map((w) => w.text).join(' ');
  const avgConf = sorted.reduce((s, w) => s + w.confidence, 0) / sorted.length;
  return [left, right, avgConf];
}

/**
 * Turns OCR lines into word pairs (English column first, then Swedish; all lower case). Rows where the pairing is uncertain are returned with
 * `confident: false` and whatever text was read, so the user can fix them – nothing is guessed silently.
 */
export function pairsFromOcr(lines: OcrLine[], pageWidth: number): OcrRow[] {
  const rows: OcrRow[] = [];
  for (const line of lines) {
    const text = clean(line.text);
    if (!text) continue;
    let left: string | null = null;
    let right: string | null = null;
    let conf = line.words.length ? line.words.reduce((s, w) => s + w.confidence, 0) / line.words.length : 0;

    const parts = text.split(SEPARATOR).map((s) => s.trim()).filter(Boolean);
    if (parts.length === 2 && SEPARATOR.test(text)) {
      [left, right] = parts as [string, string];
    } else if (line.words.length) {
      const g = splitByGap(line.words.map((w) => ({ ...w, text: clean(w.text) })).filter((w) => w.text), pageWidth);
      if (g) {
        left = clean(g[0]);
        right = clean(g[1]);
        conf = g[2];
      }
    }

    if (left && right) {
      // Printed vocabulary lists put the English word first, the Swedish second.
      const { main, alts } = splitAlternatives(left);
      const lowConf = conf < MIN_CONFIDENCE;
      rows.push({
        sv: right.toLocaleLowerCase('sv'),
        en: main.toLocaleLowerCase('en'),
        alts: alts.map((a) => a.toLocaleLowerCase('en')),
        confident: !lowConf,
        note: lowConf ? 'Unsure reading – please check' : undefined,
      });
    } else {
      rows.push({ sv: '', en: text.toLocaleLowerCase('en'), alts: [], confident: false, note: 'Could not tell which words belong together' });
    }
  }
  return rows;
}
