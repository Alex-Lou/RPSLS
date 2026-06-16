import React from "react";

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-black/30 border border-white/10 p-4">
      <h3 className="font-bold mb-2">{title}</h3>
      {children}
    </div>
  );
}

export function ModePicker({
  mode,
  onChange,
}: {
  mode: "classic" | "lanes";
  onChange: (m: "classic" | "lanes") => void;
}) {
  return (
    <div className="rounded-2xl bg-black/30 border border-white/10 p-3 flex gap-2">
      <button
        onClick={() => onChange("classic")}
        className={
          "flex-1 py-3 rounded-xl font-semibold transition flex flex-col items-center gap-0.5 " +
          (mode === "classic"
            ? "bg-emerald-500/90 text-white shadow-lg shadow-emerald-500/30"
            : "bg-white/5 hover:bg-white/10 text-zinc-300")
        }
      >
        <span>⚔️ Classic 1v1</span>
        <span className={"text-[10px] font-normal " + (mode === "classic" ? "text-emerald-100/80" : "text-zinc-500")}>
          One move per round
        </span>
      </button>
      <button
        onClick={() => onChange("lanes")}
        className={
          "flex-1 py-3 rounded-xl font-semibold transition flex flex-col items-center gap-0.5 " +
          (mode === "lanes"
            ? "bg-themed text-white shadow-lg shadow-themed"
            : "bg-white/5 hover:bg-white/10 text-zinc-300")
        }
      >
        <span>🌌 Constellation Lanes</span>
        <span className={"text-[10px] font-normal " + (mode === "lanes" ? "text-violet-100/90" : "text-zinc-500")}>
          3 picks per round · NEW
        </span>
      </button>
    </div>
  );
}

export function LanesWinToPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="rounded-2xl bg-black/30 border border-white/10 p-4">
      <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">First to … round-wins</div>
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((n) => {
          const active = n === value;
          return (
            <button
              key={n}
              onClick={() => onChange(n)}
              className={
                "flex-1 py-2 rounded-xl font-semibold transition " +
                (active
                  ? "bg-themed text-white shadow-lg shadow-themed"
                  : "bg-white/5 hover:bg-white/10 text-zinc-300")
              }
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="text-[10px] text-zinc-500 mt-2 text-center">
        Each round = 3 lanes resolved simultaneously
      </div>
    </div>
  );
}

export function BestOfPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="rounded-2xl bg-black/30 border border-white/10 p-4">
      <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Best of</div>
      <div className="flex gap-2">
        {[1, 3, 5, 7].map((n) => {
          const active = n === value;
          return (
            <button
              key={n}
              onClick={() => onChange(n)}
              className={
                "flex-1 py-2 rounded-xl font-semibold transition " +
                (active
                  ? "bg-themed text-white shadow-lg shadow-themed"
                  : "bg-white/5 hover:bg-white/10 text-zinc-300")
              }
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}
