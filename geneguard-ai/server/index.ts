import express, { type NextFunction, type Request, type Response } from 'express';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config';
import { api } from './routes';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const pkgDir = (name: string) => path.dirname(require.resolve(`${name}/package.json`));

const app = express();
app.disable('x-powered-by');

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

// Minimal access log: method, path, status and duration only — never request bodies or genetic data.
app.use((req, res, next) => {
  const start = Date.now();
  const route = req.originalUrl.split('?')[0];
  res.on('finish', () => {
    if (route.startsWith('/api')) console.log(`${req.method} ${route} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use('/api/ocr', express.json({ limit: '15mb' }));
app.use('/api', express.json({ limit: '4mb' }));
app.use('/api', api);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
app.use('/api', (err: Error & { status?: number; type?: string }, _req: Request, res: Response, _next: NextFunction) => {
  const tooLarge = err.type === 'entity.too.large';
  res.status(tooLarge ? 413 : (err.status ?? 500)).json({ error: tooLarge ? 'The data is too large.' : 'Server error.' });
});

// OCR engine files are served locally so text recognition works offline and
// images never have to leave the browser.
const long = { maxAge: '30d', immutable: true };
app.use('/vendor/tesseract', express.static(path.join(pkgDir('tesseract.js'), 'dist'), long));
app.use('/vendor/tesseract-core', express.static(pkgDir('tesseract.js-core'), long));
app.use('/vendor/tessdata', express.static(path.join(pkgDir('@tesseract.js-data/eng'), '4.0.0_best_int'), long));

if (config.isProd) {
  const dist = path.join(root, 'dist');
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.use((req, res, next) => (req.method === 'GET' ? res.sendFile(path.join(dist, 'index.html')) : next()));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}

app.listen(config.port, config.host, () => {
  console.log(`\n  GeneGuard AI running at http://localhost:${config.port} (${config.isProd ? 'production' : 'development'})`);
  console.log(`  External AI: ${config.ai.enabled ? `enabled (${config.ai.model})` : 'not configured — built-in explanations and chat'}`);
  console.log(`  Live ClinVar lookup: ${config.clinvar.enabled ? 'enabled (opt-in per analysis)' : 'disabled'}\n`);
});
