import { useState } from "react";
import { motion } from "motion/react";
import { useStore } from "../../../store/store";
import type { GameMode, Difficulty } from "../../../types";
import { hapticTick, useAndroidBackPrompt } from "../../../match/sharedMatchUI";
import { useT } from "../../../i18n";
import { ModeLobbyShell, LobbySection, LobbyPrimaryButton } from "../../../ui/ModeLobbyShell";
import { ModeIcon, MODE_ICONS } from "./menuShared";
import { SANDBOX_MODES, DIFFS_META, type SandboxMode } from "./sandboxShared";
import { DifficultyPicker, RoundsStepper } from "./lobbyControls";

/* ─────────── Entraînement — solo sandbox (mode + difficulty + format/deck) ─────────── */

export function SandboxView({
  onStart, onGoConstellation, onGoRanked, onBack,
}: {
  onStart: (mode: GameMode, bestOf: number) => void;
  onGoConstellation: (winTo: number) => void;
  onGoRanked: () => void;
  onBack: () => void;
}) {
  const t = useT();
  const difficulty = useStore((s) => s.player.difficulty);
  const updateProfile = useStore((s) => s.updateProfile);
  const [mode, setMode] = useState<SandboxMode>("classic");
  const [winTo, setWinTo] = useState(2); // rounds to win
  useAndroidBackPrompt(onBack);

  function play() {
    hapticTick();
    if (mode === "cards") return onGoRanked();
    if (mode === "lanes") return onGoConstellation(winTo);
    onStart("casual", winTo * 2 - 1);
  }
  function surprise() {
    hapticTick();
    const ms: SandboxMode[] = ["classic", "lanes", "cards"];
    const ds: Difficulty[] = ["easy", "normal", "hard"];
    setMode(ms[Math.floor(Math.random() * ms.length)]);
    updateProfile({ difficulty: ds[Math.floor(Math.random() * ds.length)] });
    setWinTo(1 + Math.floor(Math.random() * 6));
  }

  const cur = SANDBOX_MODES.find((m) => m.id === mode)!;
  const curDiff = DIFFS_META.find((d) => d.id === difficulty) ?? DIFFS_META[1];
  const recap =
    mode === "cards"
      ? t(cur.labelKey) + " · " + t("diff." + curDiff.id) + " · " + t("lobby.recapTournament")
      : t(cur.labelKey) + " · " + t("diff." + curDiff.id) + " · " + t("lobby.firstToShort", { n: winTo });
  const roundsHint =
    t(winTo > 1 ? "lobby.firstToWins" : "lobby.firstToWin", { n: winTo }) +
    (mode !== "lanes" ? " · " + t("lobby.bestOf", { n: winTo * 2 - 1 }) : "");

  const selOn = "linear-gradient(150deg, color-mix(in oklab, var(--theme-primary) 32%, transparent), color-mix(in oklab, var(--theme-secondary) 24%, transparent))";

  return (
    <ModeLobbyShell
      title={t("mode.training")}
      tagline={t("lobby.training.tagline")}
      icon={MODE_ICONS.training}
      accent="#34d399"
      onBack={onBack}
      // 🎲 dans la barre du haut (slot droit) — plus de bouton flottant.
      right={
        <button
          onClick={surprise}
          title={t("lobby.randomTitle")}
          aria-label={t("lobby.randomTitle")}
          className="h-10 [@media(max-height:540px)]:h-9 px-3 rounded-xl bg-black/40 border border-hairline hover:bg-black/60 transition flex items-center gap-1.5 text-ink text-xs font-semibold"
        >
          🎲 <span className="[@media(max-width:380px)]:hidden">{t("lobby.random")}</span>
        </button>
      }
      cta={
        <div className="flex flex-col gap-2">
          <div className="text-center text-[11px] text-ink-muted">
            <span className="px-3 py-1 rounded-full bg-hairline border border-hairline">{recap}</span>
          </div>
          <LobbyPrimaryButton onClick={play}>
            {t(mode === "cards" ? "lobby.openCardsLobby" : "lobby.play")}
          </LobbyPrimaryButton>
        </div>
      }
    >
      {/* Type de jeu — mêmes icônes/noms que le menu principal. */}
      <LobbySection label={t("lobby.gameType")} hint={t(cur.tagKey)}>
        <div className="grid grid-cols-3 gap-2">
          {SANDBOX_MODES.map((m) => {
            const on = mode === m.id;
            return (
              <motion.button
                key={m.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => { hapticTick(); setMode(m.id); }}
                className="rounded-2xl p-2.5 flex flex-col items-center gap-1.5 text-center transition min-h-[88px] justify-center"
                style={{
                  background: on ? selOn : "rgba(255,255,255,0.04)",
                  border: on ? "1px solid color-mix(in oklab, var(--theme-primary) 65%, transparent)" : "1px solid rgba(255,255,255,0.10)",
                }}
              >
                <ModeIcon mode={m.icon} />
                <span className={"text-[11px] font-bold leading-tight " + (on ? "text-white" : "text-ink-muted")}>{t(m.labelKey)}</span>
              </motion.button>
            );
          })}
        </div>
      </LobbySection>

      <DifficultyPicker />

      {mode !== "cards" && (
        <RoundsStepper value={winTo} onChange={setWinTo} hint={roundsHint} />
      )}
    </ModeLobbyShell>
  );
}
