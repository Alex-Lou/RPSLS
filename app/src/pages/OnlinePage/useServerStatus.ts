import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeServerUrl } from "../../online/online";
import type { ConnStatus } from "./types";

export function useServerStatus(url: string): {
  status: ConnStatus;
  latencyMs: number | null;
  refresh: () => void;
} {
  const [status, setStatus] = useState<ConnStatus>("idle");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  // AbortController of the in-flight probe — `refresh()` is HTTP `GET /health`
  // now, not a WS handshake. The endpoint sits OUT of the governor layer (see
  // main.rs), so probing is cheap and never trips a 429; cold-starting a
  // dormant instance works the same way (any request wakes Render). Replaced
  // the WS probe because that opened a fresh TCP + upgrade + close per call —
  // ~3× the traffic of a plain HTTP probe for the exact same information.
  const probeRef = useRef<AbortController | null>(null);

  const refresh = useCallback(() => {
    // Cancel any in-flight probe.
    try { probeRef.current?.abort(); } catch { /* ignore */ }
    probeRef.current = null;

    if (!url.trim()) {
      setStatus("offline");
      setLatencyMs(null);
      return;
    }
    // /health is served over plain HTTP(S), not WS — turn `ws(s)://host/ws`
    // back into `http(s)://host/health`.
    const normalized = normalizeServerUrl(url).replace(/\/+$/, "");
    const healthUrl = normalized
      .replace(/^wss:\/\//, "https://")
      .replace(/^ws:\/\//, "http://") + "/health";
    setStatus("checking");

    const ac = new AbortController();
    probeRef.current = ac;
    const t0 = performance.now();
    // Flip to "waking" if the request is still pending after 2.5s, so the
    // user sees we know Render is cold-starting.
    const wakingT = setTimeout(() => {
      if (probeRef.current === ac) setStatus("waking");
    }, 2_500);
    // Cold-start budget for Render free tier: up to ~90s.
    const hardT = setTimeout(() => {
      try { ac.abort(); } catch { /* ignore */ }
    }, 90_000);

    // `mode: 'no-cors'` is required: the server keeps `/health` OUTSIDE the
    // CORS layer (so Render's bursty probes don't trip the governor / get a
    // 429). That means CORS preflight fails for a regular fetch, and the
    // request errors as "Failed to fetch" inside the Tauri WebView. With
    // no-cors we get an opaque response (status 0, body unreadable) — but a
    // resolved promise still proves the server answered, which is all we
    // need for the health probe.
    fetch(healthUrl, { signal: ac.signal, cache: "no-store", mode: "no-cors" })
      .then(() => {
        clearTimeout(wakingT);
        clearTimeout(hardT);
        if (probeRef.current !== ac) return;
        setLatencyMs(Math.round(performance.now() - t0));
        setStatus("online");
      })
      .catch(() => {
        clearTimeout(wakingT);
        clearTimeout(hardT);
        if (probeRef.current === ac) setStatus("offline");
      });
  }, [url]);

  useEffect(() => {
    refresh();
    return () => {
      try { probeRef.current?.abort(); } catch { /* ignore */ }
    };
  }, [refresh]);

  // Auto-retry while offline, with jitter so N clients hitting a cold-started
  // server don't all retry at the same instants and synchronise into a herd.
  // Window: 15s ± 5s (range 10–20s).
  useEffect(() => {
    if (status !== "offline") return;
    let cancelled = false;
    let id: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      const delay = 10_000 + Math.floor(Math.random() * 10_000);
      id = setTimeout(() => {
        if (cancelled) return;
        refresh();
        schedule();
      }, delay);
    };
    schedule();
    return () => {
      cancelled = true;
      if (id) clearTimeout(id);
    };
  }, [status, refresh]);

  return { status, latencyMs, refresh };
}
