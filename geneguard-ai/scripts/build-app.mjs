// Builds the web app for the installable apps.
//
//   npm run build:android   → dist-android/, then copies it into the Android project (android/)
//   npm run build:desktop   → dist-desktop/, packaged by desktop/ into the Windows app
//
// Both builds start straight in offline mode with the built-in engine: an app has no
// GeneGuard server behind it, and no API key is ever put into an app.

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2];
if (target !== 'android' && target !== 'desktop') {
  console.error('Usage: node scripts/build-app.mjs <android|desktop>');
  process.exit(1);
}

process.env.VITE_TARGET = target;
await build({ root, logLevel: 'warn' });
console.log(`Web app built for ${target} → dist-${target}/`);

if (target === 'android') {
  const res = spawnSync('npx', ['cap', 'sync', 'android'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (res.status !== 0) process.exit(res.status ?? 1);
}
