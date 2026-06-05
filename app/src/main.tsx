import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppErrorBoundary } from "./monitoring/ErrorBoundary";
import { initSentry } from "./monitoring/sentry";
import { useStore } from "./store";
import "./App.css";
// Side-effect import: registers @font-face for every theme's font family
// (Inter, Cinzel, Orbitron, …) so they're available regardless of which
// theme is currently selected.
import "./theme/fonts";

// Boot Sentry as early as possible — before React renders — so it catches
// any early errors. It is a NO-OP if the user hasn't opted in OR if no
// DSN was injected at build time (which is the dev/local default).
initSentry(useStore.getState().player.crashReports ?? false);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);
