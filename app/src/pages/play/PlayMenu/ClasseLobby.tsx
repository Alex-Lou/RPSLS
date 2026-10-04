import { motion } from "motion/react";
import { useStore } from "../../../store/store";
import { hapticTick, useAndroidBackPrompt } from "../../../match/sharedMatchUI";
import { useT } from "../../../i18n";
import { ModeLobbyShell } from "../../../ui/ModeLobbyShell";
import { LobbyRankCard } from "../../../ui/LobbyRankCard";
import { MODE_ICONS } from "./menuShared";

/* ─────────── Classé — classic 1v1 hub (quick match + tournament) ─────────── */

/** Bouton « match rapide » (vs CPU / vs joueur réel) — même gabarit, teinte inversée. */
function QuickMatchButton({ onClick, title, sub, swap }: { onClick: () => void; title: string; sub: string; swap?: boolean }) {
  const a = swap ? "var(--theme-secondary)" : "var(--theme-primary)";
  const b = swap ? "var(--theme-primary)" : "var(--theme-secondary)";
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={() => { hapticTick(); onClick(); }}
      className="rounded-2xl p-3 flex flex-col items-center gap-1 text-center transition hover:brightness-110"
      style={{
        background: `linear-gradient(135deg, color-mix(in oklab, ${a} 55%, rgba(10,12,20,0.85)), color-mix(in oklab, ${b} 38%, rgba(10,12,20,0.85)))`,
        border: `1px solid color-mix(in oklab, ${a} 60%, transparent)`,
        boxShadow: `0 4px 16px -4px color-mix(in oklab, ${a} 40%, transparent)`,
      }}
    >
      <img src="/Icones Tournoi/ConstRankedRapide.png" alt="" className="w-10 h-10 object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]" draggable={false} />
      <div className="font-bold text-sm leading-tight">{title}</div>
      <div className="text-[10px] text-zinc-300/80 leading-tight">{sub}</div>
    </motion.button>
  );
}

export function ClasseLobby({
  onBack, onQuickMatch, onQuickMatchOnline, onViewBracket,
}: {
  onBack: () => void;
  /** Match rapide LOCAL vs CPU (le duel classé actuel). */
  onQuickMatch: () => void;
  /** Match rapide EN LIGNE vs joueur réel (file Render + fallback CPU) — compte
   *  dans classeLp (client) ET rankLp (serveur). */
  onQuickMatchOnline: () => void;
  onViewBracket: () => void;
}) {
  const t = useT();
  useAndroidBackPrompt(onBack);

  // Classé runs its OWN local ladder (classeLp), separate from the online
  // global rankLp — so the mode shows its own rank, record and rewards.
  const classeLp = useStore((s) => s.player.classeLp ?? 1000);
  const cs = useStore((s) => s.player.classeStats) ?? { wins: 0, losses: 0, draws: 0 };

  return (
    <ModeLobbyShell
      title={t("mode.ranked")}
      tagline={t("lobby.classe.tagline")}
      icon={MODE_ICONS.ranked}
      accent="#38bdf8"
      onBack={onBack}
      // Match rapide — DEUX entrées (Alex 2026-07) : vs CPU (local, immédiat) ·
      // vs joueur réel (file en ligne + fallback CPU). Les deux alimentent
      // classeLp ; le vs-réel alimente en plus le rankLp serveur.
      cta={
        <div className="grid grid-cols-2 gap-2.5">
          <QuickMatchButton onClick={onQuickMatch} title={t("lobby.classe.vsCpu")} sub={t("lobby.classe.vsCpuSub")} />
          <QuickMatchButton onClick={onQuickMatchOnline} title={t("lobby.classe.vsHuman")} sub={t("lobby.classe.vsHumanSub")} swap />
        </div>
      }
      secondary={
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => { hapticTick(); onViewBracket(); }}
          className="w-full rounded-2xl px-4 py-2.5 text-left transition bg-surface border border-hairline hover:bg-hairline"
        >
          <div className="flex items-center gap-3">
            <img src="/Icones Tournoi/ConstRankedEpique.png" alt="" className="w-9 h-9 object-contain shrink-0 drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]" draggable={false} />
            <div className="min-w-0">
              <div className="font-bold text-[15px]">{t("lobby.tournament")}</div>
              <div className="text-[11px] text-ink-faint truncate">{t("lobby.classe.tournamentSub")}</div>
            </div>
            <span className="ml-auto text-xl" style={{ color: "var(--theme-primary)" }}>›</span>
          </div>
        </motion.button>
      }
    >
      {/* Rang · bilan du ladder Classé (classeLp / classeStats). */}
      <LobbyRankCard lp={classeLp} unit={t("play.rp")} wins={cs.wins} losses={cs.losses} draws={cs.draws} />
    </ModeLobbyShell>
  );
}
