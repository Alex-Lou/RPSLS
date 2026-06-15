import { useState } from "react";
import { useStore } from "../../store/store";

export function ResetSection() {
  const resetProfile = useStore((s) => s.resetProfile);
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <section className="bg-rose-950/30 border border-rose-900/40 rounded-3xl p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-rose-300 mb-2">Danger zone</h2>
      <p className="text-xs text-ink-muted mb-3">
        Reset profile wipes nickname, avatar, theme, XP, LP, stats and history. Irreversible.
      </p>
      {!confirmReset ? (
        <button
          onClick={() => setConfirmReset(true)}
          className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-sm font-medium"
        >
          Reset profile
        </button>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => { resetProfile(); setConfirmReset(false); }}
            className="px-4 py-2 rounded-xl bg-rose-500/40 hover:bg-rose-500/60 text-white text-sm font-semibold"
          >
            Yes, wipe everything
          </button>
          <button
            onClick={() => setConfirmReset(false)}
            className="px-4 py-2 rounded-xl bg-hairline hover:bg-hairline text-sm"
          >
            Cancel
          </button>
        </div>
      )}
    </section>
  );
}
