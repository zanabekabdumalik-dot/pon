import express, { type NextFunction, type Request, type Response } from 'express';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config';
import { api } from './routes';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

// OCR engine files (vendor/…) are served by the Vite plugin in development and are
// part of dist/ in production — see vite.config.ts.

if (config.isProd) {
  const dist = path.join(root, 'dist');
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.use((req, res, next) => (req.method === 'GET' ? res.sendFile(path.join(dist, 'index.html')) : next()));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}

/** Addresses other devices on the same Wi-Fi can use (e.g. a phone): http://192.168.x.x:5173 */
function lanUrls(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => `http://${n!.address}:${config.port}`);
}

const server = app.listen(config.port, config.host, () => {
  console.log(`\n  GeneGuard AI running (${config.isProd ? 'production' : 'development'})`);
  console.log(`  On this computer:      http://localhost:${config.port}`);
  for (const url of lanUrls()) console.log(`  From a phone (same Wi-Fi): ${url}`);
  console.log(`  External AI: ${config.ai.enabled ? `enabled (${config.ai.model})` : 'not configured — built-in explanations and chat'}`);
  console.log(`  Live ClinVar lookup: ${config.clinvar.enabled ? 'enabled (opt-in per analysis)' : 'disabled'}\n`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  Port ${config.port} is already in use. Stop the other program or start with another port, e.g.:  PORT=5174 npm run dev\n`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
