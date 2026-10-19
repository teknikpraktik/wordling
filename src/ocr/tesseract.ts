import type { OcrEngine, OcrResult } from './types';
import type { OcrLine } from '../domain/ocrParse';

/**
 * Tesseract.js engine. The engine runs in a Web Worker and all files (worker, WASM core,
 * Swedish + English models) are served from /ocr on our own origin, so it works offline once cached.
 */
export function createTesseractEngine(): OcrEngine {
  let workerPromise: Promise<import('tesseract.js').Worker> | null = null;
  let progressCb: ((f: number, s: string) => void) | undefined;

  const getWorker = () => {
    workerPromise ??= import('tesseract.js').then(({ createWorker, OEM }) =>
      createWorker(['swe', 'eng'], OEM.LSTM_ONLY, {
        workerPath: '/ocr/worker.min.js',
        corePath: '/ocr/core',
        langPath: '/ocr/lang',
        gzip: true,
        workerBlobURL: false,
        logger: (m) => progressCb?.(m.progress ?? 0, m.status ?? ''),
      }),
    );
    return workerPromise;
  };

  return {
    async recognize(image, onProgress): Promise<OcrResult> {
      progressCb = onProgress;
      const bitmap = await downscale(image);
      const worker = await getWorker();
      const { data } = await worker.recognize(bitmap.blob, {}, { blocks: true });
      const lines: OcrLine[] = [];
      for (const block of data.blocks ?? []) {
        for (const para of block.paragraphs) {
          for (const line of para.lines) {
            lines.push({
              text: line.text.trim(),
              y0: line.bbox.y0,
              y1: line.bbox.y1,
              words: line.words.map((w) => ({
                text: w.text, x0: w.bbox.x0, x1: w.bbox.x1, confidence: w.confidence,
              })),
            });
          }
        }
      }
      lines.sort((a, b) => a.y0 - b.y0);
      return { lines, width: bitmap.width, height: bitmap.height };
    },
    async terminate() {
      if (!workerPromise) return;
      const w = await workerPromise;
      workerPromise = null;
      await w.terminate();
    },
  };
}

/** Phone photos are huge; shrink them so OCR is quick and memory-friendly. */
async function downscale(blob: Blob, maxSide = 2000): Promise<{ blob: Blob; width: number; height: number }> {
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const out = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('canvas'))), 'image/png'));
  return { blob: out, width: w, height: h };
}
