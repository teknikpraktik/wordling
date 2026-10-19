// Renders the PWA icons from the real creature artwork (src/ui/IconArt.tsx).
import { createServer } from 'vite';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = (n) => resolve(root, 'public', n);

const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', configFile: false,
  plugins: [(await import('@vitejs/plugin-react')).default()] });
try {
  const { AppIcon } = await server.ssrLoadModule('/src/ui/IconArt.tsx');
  const full = renderToStaticMarkup(createElement(AppIcon, { rounded: false }));
  const rounded = renderToStaticMarkup(createElement(AppIcon, { rounded: true }));
  writeFileSync(out('favicon.svg'), rounded);

  const png = (svg, size) => sharp(Buffer.from(svg), { density: 300 }).resize(size, size).png();
  await png(full, 192).toFile(out('icon-192.png'));
  await png(full, 512).toFile(out('icon-512.png'));
  await png(full, 180).toFile(out('apple-touch-icon.png'));
  // Maskable: the artwork is already centred inside the 80 % safe zone on a full-bleed background.
  await png(full, 512).toFile(out('icon-maskable-512.png'));
  console.log('icons written');
} finally {
  await server.close();
}
