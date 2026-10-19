// Copies the self-hosted OCR engine + Swedish/English models into public/ocr
// so that no image or request ever leaves the device and OCR works offline.
import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'public/ocr');
mkdirSync(resolve(out, 'core'), { recursive: true });
mkdirSync(resolve(out, 'lang'), { recursive: true });
const nm = resolve(root, 'node_modules');
const copy = (from, to) => {
  if (!existsSync(from)) throw new Error('Missing ' + from + ' – run npm install');
  cpSync(from, to);
};
copy(resolve(nm, 'tesseract.js/dist/worker.min.js'), resolve(out, 'worker.min.js'));
for (const f of [
  'tesseract-core-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-relaxedsimd-lstm.wasm.js',
]) copy(resolve(nm, 'tesseract.js-core', f), resolve(out, 'core', f));
for (const l of ['swe', 'eng'])
  copy(resolve(nm, `@tesseract.js-data/${l}/4.0.0/${l}.traineddata.gz`), resolve(out, 'lang', `${l}.traineddata.gz`));
console.log('OCR assets copied to public/ocr');
