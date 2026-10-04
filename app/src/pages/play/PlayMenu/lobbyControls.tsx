import { useStore } from "../../../store/store";
import { hapticTick } from "../../../match/sharedMatchUI";
import { useT } from "../../../i18n";
import { LobbySection } from "../../../ui/ModeLobbyShell";
import { DIFFS_META, MAX_WIN_TO } from "./sandboxShared";

/* ─────────── Réglages PARTAGÉS des lobbies solo (Entraînement + Constellation) ─────────── */

const FILL = "linear-gradient(to right, var(--theme-primary), var(--theme-secondary))";

/** Difficulté de l'IA (persistée dans le profil) + aide contextuelle. */
export function DifficultyPicker() {
  const t = useT();
  const difficulty = useStore((s) => s.player.difficulty);
  const updateProfile = useStore((s) => s.updateProfile);
  const cur = DIFFS_META.find((d) => d.id === difficulty) ?? DIFFS_META[1];
  return (
    <LobbySection label={t("lobby.difficulty")} hint={cur.hint}>
      <div className="grid grid-cols-3 gap-2">
        {DIFFS_META.map((d) => {
          const on = difficulty === d.id;
          return (
            <button
              key={d.id}
              onClick={() => { hapticTick(); updateProfile({ difficulty: d.id }); }}
              className={"rounded-xl py-2.5 text-sm font-bold transition " + (on ? "text-white" : "text-ink-muted bg-hairline border border-hairline hover:bg-hairline")}
              style={on ? { background: FILL } : undefined}
            >
              {d.label}
            </button>
          );
        })}
      </div>
    </LobbySection>
  );
}

/** Nombre de manches (ou de couloirs) à gagner — stepper − / + compact. */
export function RoundsStepper({ value, onChange, lanes, hint }: {
  value: number;
  onChange: (n: number) => void;
  /** Constellation : on compte des couloirs gagnés, pas des manches. */
  lanes?: boolean;
  hint: string;
}) {
  const t = useT();
  const btn = "w-11 h-11 rounded-full text-2xl font-black bg-hairline border border-hairline hover:bg-hairline transition disabled:opacity-30 disabled:pointer-events-none";
  return (
    <LobbySection label={t("lobby.rounds")} hint={hint}>
      <div className="flex items-center justify-center gap-5">
        <button
          onClick={() => { hapticTick(); onChange(Math.max(1, value - 1)); }}
          disabled={value <= 1}
          aria-label="−"
          className={btn}
        >−</button>
        <div className="text-center min-w-[6rem]">
          <div className="text-4xl font-black text-themed tabular-nums leading-none">{value}</div>
          <div className="text-[10px] text-ink-faint mt-1">{t(lanes ? "lobby.lanesToWin" : "lobby.roundsToWin")}</div>
        </div>
        <button
          onClick={() => { hapticTick(); onChange(Math.min(MAX_WIN_TO, value + 1)); }}
          disabled={value >= MAX_WIN_TO}
          aria-label="+"
          className={btn}
        >+</button>
      </div>
    </LobbySection>
  );
}
