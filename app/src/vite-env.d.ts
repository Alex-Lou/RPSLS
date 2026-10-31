/// <reference types="vite/client" />

/** Outils de test in-app — voir `define` dans vite.config.ts (fail-closed). */
declare const __DEV_TOOLS__: boolean;

interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_WATCHER_URL?: string;
  readonly VITE_WATCHER_INGEST_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
