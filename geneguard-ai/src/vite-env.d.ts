/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "artifact" (embedded single page), "android" or "desktop" (apps); unset for the normal web build. */
  readonly VITE_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
