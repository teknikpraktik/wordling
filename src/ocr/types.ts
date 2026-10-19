import type { OcrLine } from '../domain/ocrParse';

export interface OcrResult {
  lines: OcrLine[];
  width: number;
  height: number;
}

/** Swappable OCR engine. Everything runs on-device; the image never leaves the phone. */
export interface OcrEngine {
  recognize(image: Blob, onProgress?: (fraction: number, status: string) => void): Promise<OcrResult>;
  terminate(): Promise<void>;
}
