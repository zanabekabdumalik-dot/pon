// Build target and URL helpers. All URLs are relative to the page, so the same
// build works on the GeneGuard server, on any static host, in a sub-folder or embedded.

/** True for the embedded build (no printing, no file downloads, no browser URL changes). */
export const EMBEDDED = import.meta.env.VITE_TARGET === 'artifact';

/** Path of a file shipped with the app ("samples/x.png" → "./samples/x.png"). */
export const asset = (p: string) => `${import.meta.env.BASE_URL}${p.replace(/^\/+/, '')}`;

/** Absolute URL of a shipped file (needed by Web Workers, which resolve paths differently). */
export const absoluteUrl = (p: string) => new URL(asset(p), document.baseURI).href;
