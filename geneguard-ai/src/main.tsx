import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, MemoryRouter } from 'react-router';
import { App } from './App';
import { EMBEDDED } from './lib/env';
import './index.css';

// Hash URLs (…/#/analysis) work on any host and sub-folder without server-side routing.
// The embedded build keeps navigation in memory because it cannot change its own URL.
const Router = EMBEDDED ? MemoryRouter : HashRouter;

// Compared with the raw build variable so other builds drop this code entirely.
if (import.meta.env.VITE_TARGET === 'android') void import('./lib/android').then((m) => m.setupAndroid());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <App />
    </Router>
  </StrictMode>,
);
