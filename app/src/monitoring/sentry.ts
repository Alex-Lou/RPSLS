/**
 * Sentry bootstrap — opt-in crash reporting.
 *
 * The DSN is read from a Vite env var (`VITE_SENTRY_DSN`) injected at build
 * time from a local `.env` file. If the var is missing, init() short-circuits
 * and the rest of the app behaves identically to the previous (no-Sentry)
 * version. That means dev/local builds without a DSN don't accidentally
 * blast anyone's account.
 *
 * Even with a DSN present, we honour the player's privacy choice: the user
 * has to flip "Send crash reports" ON in Profile before any event flies.
 * That gate is the `enabled` flag passed in by App.tsx; flipping it false
 * at runtime calls Sentry.close() so the SDK detaches and stops queuing.
 *
 * Keep this file small (< 60 LoC) — heavier orchestration belongs in
 * `monitoring/ErrorBoundary.tsx` and the React-side hook.
 */

import * as Sentry from "@sentry/react";

let _initialized = false;

/** Read the DSN injected at build time. Empty string → Sentry disabled. */
function getDsn(): string {
  return (import.meta.env.VITE_SENTRY_DSN as string | undefined) ?? "";
}

/** Initialise Sentry once. No-op when the DSN is missing or `enabled` is
 *  false. Safe to call multiple times — second+ calls are ignored. */
export function initSentry(enabled: boolean): void {
  if (_initialized || !enabled) return;
  const dsn = getDsn();
  if (!dsn) return;
  Sentry.init({
    dsn,
    // Keep send volume tiny: only the truly unhandled errors. Performance
    // monitoring + replays cost money and bandwidth we don't need yet.
    tracesSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    replaysSessionSampleRate: 0,
    // Tag every event so we know which build it came from. The version
    // string is wired in by Vite from package.json.
    release: (import.meta.env.VITE_APP_VERSION as string | undefined) ?? "dev",
    environment: import.meta.env.MODE,
  });
  _initialized = true;
}

/** Tear down Sentry — used when the user opts out at runtime. */
export function shutdownSentry(): void {
  if (!_initialized) return;
  void Sentry.close();
  _initialized = false;
}

/** Re-export the Sentry boundary so callers don't import the SDK directly. */
export const SentryErrorBoundary = Sentry.ErrorBoundary;
