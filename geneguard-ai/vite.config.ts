import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, createReadStream, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const require = createRequire(import.meta.url);
const pkgDir = (name: string) => path.dirname(require.resolve(`${name}/package.json`));

/**
 * OCR engine files (Tesseract.js worker, WebAssembly core, English language model)
 * served from /vendor in development and copied into the build, so OCR works on
 * any static host and offline — without a CDN and without the GeneGuard server.
 */
function ocrVendorFiles(): Plugin {
  const files: Record<string, string> = {
    'vendor/tesseract/worker.min.js': path.join(pkgDir('tesseract.js'), 'dist', 'worker.min.js'),
    'vendor/tesseract-core/tesseract-core-simd-lstm.wasm.js': path.join(pkgDir('tesseract.js-core'), 'tesseract-core-simd-lstm.wasm.js'),
    'vendor/tesseract-core/tesseract-core-lstm.wasm.js': path.join(pkgDir('tesseract.js-core'), 'tesseract-core-lstm.wasm.js'),
    'vendor/tessdata/eng.traineddata.gz': path.join(pkgDir('@tesseract.js-data/eng'), '4.0.0_best_int', 'eng.traineddata.gz'),
  };
  let outDir = 'dist';
  let isBuild = false;
  return {
    name: 'geneguard-ocr-vendor',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
      isBuild = config.command === 'build' && !process.env.VITEST; // vitest also runs closeBundle
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const key = decodeURIComponent((req.url ?? '').split('?')[0]).replace(/^\/+/, '');
        const file = files[key];
        if (!file) return next();
        res.setHeader('Content-Type', key.endsWith('.js') ? 'text/javascript' : 'application/octet-stream');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        createReadStream(file).pipe(res);
      });
    },
    closeBundle() {
      if (!isBuild) return;
      for (const [rel, src] of Object.entries(files)) {
        if (!existsSync(src)) throw new Error(`OCR vendor file missing: ${src} — run npm install`);
        const dest = path.join(outDir, rel);
        mkdirSync(path.dirname(dest), { recursive: true });
        copyFileSync(src, dest);
      }
    },
  };
}

export default defineConfig({
  // Relative asset paths: the build works from any folder, sub-path or static host.
  base: './',
  plugins: [react(), tailwindcss(), ocrVendorFiles()],
  // Pre-bundle lazily imported libraries so the first dev visit doesn't reload mid-analysis.
  optimizeDeps: {
    include: ['react', 'react-dom/client', 'react-router', 'lucide-react', 'tesseract.js', 'pdfjs-dist/legacy/build/pdf.mjs'],
  },
  build: {
    outDir: process.env.VITE_TARGET === 'artifact' ? 'dist-artifact' : 'dist',
    chunkSizeWarningLimit: 1500,
  },
});
