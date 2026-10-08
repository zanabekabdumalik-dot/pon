/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "artifact" for the embedded single-page build, otherwise the normal web build. */
  readonly VITE_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
