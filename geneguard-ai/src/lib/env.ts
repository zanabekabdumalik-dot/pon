// Build target and URL helpers. All URLs are relative to the page, so the same
// build works on the GeneGuard server, on any static host, in a sub-folder or embedded.

/**
 * Which build this is (VITE_TARGET): unset for the normal web build (GeneGuard server or any
 * static host), "artifact" for the embedded single page, "android" / "desktop" for the apps.
 * Compared with literals so the build can drop code meant for other targets.
 */
const TARGET = import.meta.env.VITE_TARGET;

/** True for the embedded build (no printing, no file downloads, no browser URL changes). */
export const EMBEDDED = TARGET === 'artifact';

/** The installable Android and Windows apps. */
export const NATIVE_APP = TARGET === 'android' || TARGET === 'desktop';

/** No GeneGuard server behind this copy: everything runs on this device with the built-in engine. */
export const STANDALONE = EMBEDDED || NATIVE_APP;

/** Printing and file downloads work (not in the embedded page or the Android app's WebView). */
export const CAN_SAVE_FILES = !EMBEDDED && TARGET !== 'android';

/** Where files are processed, for user-facing text. */
export const ON_DEVICE = NATIVE_APP ? 'on this device' : 'in your browser';

/** Path of a file shipped with the app ("samples/x.png" → "./samples/x.png"). */
export const asset = (p: string) => `${import.meta.env.BASE_URL}${p.replace(/^\/+/, '')}`;

/** Absolute URL of a shipped file (needed by Web Workers, which resolve paths differently). */
export const absoluteUrl = (p: string) => new URL(asset(p), document.baseURI).href;
