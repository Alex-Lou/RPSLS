import { Component, type ErrorInfo, type ReactNode } from "react";
import { useStore } from "../store/store";
import { tFor } from "../i18n";

/**
 * AppErrorBoundary — last-resort React error trap.
 *
 * Catches anything Sentry would have grabbed but also displays a friendly
 * recovery UI instead of a blank screen. Wraps the whole app inside
 * main.tsx. Composes nicely with Sentry: if Sentry is initialised, the
 * SDK's own boundary inside `monitoring/sentry.ts` will report; here we
 * only handle the *user-visible* recovery.
 *
 * Keep this file pure-React with no SDK dependencies — that way it works
 * even if Sentry itself fails to load.
 */
interface State {
  error: Error | null;
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // We log to console even in prod — Android logcat captures it which is
    // the lowest-friction way to grab a stack when a tester reports a bug.
    // Sentry already gets the structured event via its own boundary.
    // eslint-disable-next-line no-console
    console.error("[RPSLS] Unhandled render error", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return <CrashScreen error={this.state.error} onReset={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}

function CrashScreen({ error, onReset }: { error: Error; onReset: () => void }) {
  // Pull the locale via getState (not useStore) so this works inside a
  // class-error-boundary subtree where hooks would crash on render. The
  // crash screen is the LAST place where we want a re-mount loop.
  const locale = useStore.getState().locale;
  const T = (key: string) => tFor(locale, key);
  return (
    <div
      role="alert"
      className="h-full w-full flex flex-col items-center justify-center gap-4 px-6 text-center bg-surface-raised text-ink"
    >
      <div className="text-5xl" aria-hidden>💥</div>
      <h1 className="text-2xl font-black tracking-tight bg-gradient-to-br from-amber-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
        {T("crash.title")}
      </h1>
      <p className="text-sm text-ink-muted max-w-sm leading-relaxed">
        {T("crash.body")}
      </p>
      <details className="text-[11px] text-ink-faint max-w-sm">
        <summary className="cursor-pointer mb-1">{T("crash.details")}</summary>
        <pre className="whitespace-pre-wrap text-left bg-hairline p-2 rounded-md font-mono">
          {error.message}
        </pre>
      </details>
      <button
        onClick={onReset}
        className="mt-2 px-6 py-2.5 rounded-xl font-bold text-white bg-themed shadow-lg shadow-themed hover:scale-[1.02] transition"
      >
        {T("crash.retry")}
      </button>
    </div>
  );
}
