import { motion } from "motion/react";
import type { ConnStatus } from "./types";

export function ServerStatusBadge({
  mode,
  url,
  status,
  latencyMs,
  onRefresh,
}: {
  mode: "cloud" | "lan";
  url: string;
  status: ConnStatus;
  latencyMs: number | null;
  onRefresh: () => void;
}) {
  const palette: Record<ConnStatus, { dot: string; text: string; bg: string }> = {
    idle:     { dot: "bg-zinc-500",   text: "text-zinc-400",   bg: "bg-white/5 border-white/10" },
    checking: { dot: "bg-sky-400",    text: "text-sky-200",    bg: "bg-sky-500/10 border-sky-500/30" },
    waking:   { dot: "bg-amber-400",  text: "text-amber-200",  bg: "bg-amber-500/10 border-amber-500/30" },
    online:   { dot: "bg-emerald-400",text: "text-emerald-200",bg: "bg-emerald-500/10 border-emerald-500/30" },
    offline:  { dot: "bg-rose-500",   text: "text-rose-200",   bg: "bg-rose-500/10 border-rose-500/30" },
  };
  const p = palette[status];

  const label = (() => {
    switch (status) {
      case "idle":     return "Idle";
      case "checking": return "Pinging…";
      case "waking":   return mode === "cloud"
        ? "Waking up free instance (up to ~90s on first ping)…"
        : "Connecting…";
      case "online":   return latencyMs != null ? `Online · ${latencyMs} ms` : "Online";
      case "offline":  return "Unreachable";
    }
  })();

  const prettyUrl = url.replace(/^wss?:\/\//, "");

  return (
    <div
      className={
        "mb-4 px-3 py-2 rounded-xl border flex items-center gap-2 text-xs " + p.bg
      }
    >
      <motion.span
        className={"w-2 h-2 rounded-full " + p.dot}
        animate={
          status === "checking" || status === "waking"
            ? { opacity: [0.3, 1, 0.3] }
            : { opacity: 1 }
        }
        transition={{ duration: 1, repeat: Infinity }}
      />
      <span className={"font-semibold " + p.text}>
        {mode === "cloud" ? "☁️ Cloud" : "📶 LAN"}
      </span>
      <span className="text-zinc-500">·</span>
      <span className={"truncate flex-1 min-w-0 " + p.text}>{label}</span>
      <span className="hidden sm:inline text-zinc-500 truncate max-w-[40%] font-mono text-[10px]">
        {prettyUrl}
      </span>
      <button
        onClick={onRefresh}
        title="Ping again"
        className="ml-1 px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-zinc-300 text-[10px] transition"
      >
        ↻
      </button>
    </div>
  );
}

export function Waiting({ label, onCancel }: { label: string; onCancel: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center gap-4 py-10"
    >
      <div className="text-sm text-zinc-400">{label}</div>
      <DotPulse />
      <button
        onClick={onCancel}
        className="mt-4 px-5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-sm transition"
      >
        Cancel
      </button>
    </motion.div>
  );
}

export function DotPulse() {
  return (
    <div className="flex gap-1.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-2 h-2 rounded-full bg-violet-400"
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  );
}
