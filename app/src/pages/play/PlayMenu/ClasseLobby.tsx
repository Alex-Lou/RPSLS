import { motion } from "motion/react";
import { useStore } from "../../../store/store";
import { formatNumber } from "../../../i18n/format";
import { rankProgress } from "../../../engine/rank";
import { LpBar } from "../../../ranked/LpBar";
import { CurrencyBadges } from "../../../ranked/CurrencyBadges";
import { FloatingMatchBackButton, hapticTick, useAndroidBackPrompt } from "../../../match/sharedMatchUI";

/* ─────────── Classé — classic 1v1 hub (quick match + tournament) ─────────── */

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
  useAndroidBackPrompt(onBack);

  // Classé runs its OWN local ladder (classeLp), separate from the online
  // global rankLp — so the mode shows its own rank, record and rewards.
  const classeLp = useStore((s) => s.player.classeLp ?? 1000);
  const cs = useStore((s) => s.player.classeStats) ?? { wins: 0, losses: 0, draws: 0 };
  const { tier, progress: lpProgress, next: nextTier } = rankProgress(classeLp);
  const decided = cs.wins + cs.losses;
  const winrate = decided > 0 ? Math.round((cs.wins / decided) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-4 flex-1 py-2 px-1 max-w-lg mx-auto w-full overflow-y-auto"
    >
      <FloatingMatchBackButton onClick={onBack} label="Retour" />

      <div className="text-center mt-6">
        <div className="text-5xl mb-1">🏆</div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-themed leading-tight" style={{ fontFamily: "var(--font-headline)" }}>
          Classé
        </h1>
        <p className="text-[11px] text-ink-faint mt-1">Duel 1 v 1 classé · grimpe au classement &amp; gagne des récompenses</p>
      </div>

      {/* Rank · record · rewards card — its own classement (classeLp), its own
          win/loss record (classeStats) and the éclats/poussière it pays out. */}
      <div className="bg-surface border border-hairline rounded-3xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div
            className={"w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-lg shrink-0 bg-gradient-to-br " + tier.gradient}
          >
            {tier.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-black text-lg leading-none">{tier.label}</span>
              <span className="text-[11px] text-ink-muted tabular-nums">{formatNumber(classeLp)} PR</span>
            </div>
            <LpBar progress={lpProgress} className="mt-1.5" />
            <div className="mt-1 text-[10px] text-ink-faint">
              {nextTier
                ? `${formatNumber(tier.ceil - classeLp)} PR avant ${nextTier.label} ${nextTier.emoji}`
                : "Palier maximum atteint"}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5 text-[12px] font-bold tabular-nums">
            <span className="text-emerald-300">{cs.wins} V</span>
            <span className="text-rose-300">{cs.losses} D</span>
            {cs.draws > 0 && <span className="text-ink-muted">{cs.draws} N</span>}
            <span className="text-ink-faint font-normal">· {winrate}% de victoires</span>
          </div>
          <CurrencyBadges inert />
        </div>
      </div>

      {/* Match rapide — DEUX entrées côte à côte (Alex 2026-07) : vs CPU (local,
          immédiat) · vs joueur réel (file en ligne Render + fallback CPU 10s). Les
          deux alimentent le classement Classé (classeLp) ; le vs-réel alimente en
          plus le rang global rankLp côté serveur (« compter dans les deux »). */}
      <div className="grid grid-cols-2 gap-2.5">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => { hapticTick(); onQuickMatch(); }}
          className="rounded-2xl p-3 flex flex-col items-center gap-1 text-center transition hover:brightness-110"
          style={{
            background: "linear-gradient(135deg, color-mix(in oklab, var(--theme-primary) 55%, rgba(10,12,20,0.85)), color-mix(in oklab, var(--theme-secondary) 38%, rgba(10,12,20,0.85)))",
            border: "1px solid color-mix(in oklab, var(--theme-primary) 60%, transparent)",
            boxShadow: "0 4px 16px -4px color-mix(in oklab, var(--theme-primary) 40%, transparent)",
          }}
        >
          <img src="/Icones Tournoi/ConstRankedRapide.png" alt="" className="w-11 h-11 object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]" draggable={false} />
          <div className="font-bold text-sm leading-tight">🤖 vs CPU</div>
          <div className="text-[10px] text-zinc-300/80 leading-tight">Duel immédiat · Best of 5</div>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => { hapticTick(); onQuickMatchOnline(); }}
          className="rounded-2xl p-3 flex flex-col items-center gap-1 text-center transition hover:brightness-110"
          style={{
            background: "linear-gradient(135deg, color-mix(in oklab, var(--theme-secondary) 55%, rgba(10,12,20,0.85)), color-mix(in oklab, var(--theme-primary) 38%, rgba(10,12,20,0.85)))",
            border: "1px solid color-mix(in oklab, var(--theme-secondary) 60%, transparent)",
            boxShadow: "0 4px 16px -4px color-mix(in oklab, var(--theme-secondary) 40%, transparent)",
          }}
        >
          <img src="/Icones Tournoi/ConstRankedRapide.png" alt="" className="w-11 h-11 object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]" draggable={false} />
          <div className="font-bold text-sm leading-tight">🌐 vs Joueur réel</div>
          <div className="text-[10px] text-zinc-300/80 leading-tight">En ligne · vrai adversaire</div>
        </motion.button>
      </div>

      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => { hapticTick(); onViewBracket(); }}
        className="rounded-2xl p-4 text-left transition hover:brightness-110"
        style={{
          background: "linear-gradient(135deg, color-mix(in oklab, var(--theme-secondary) 55%, rgba(10,12,20,0.85)), color-mix(in oklab, var(--theme-primary) 40%, rgba(10,12,20,0.85)))",
          border: "1px solid color-mix(in oklab, var(--theme-secondary) 60%, transparent)",
          boxShadow: "0 4px 16px -4px color-mix(in oklab, var(--theme-secondary) 40%, transparent)",
        }}
      >
        <div className="flex items-center gap-3">
          <img src="/Icones Tournoi/ConstRankedEpique.png" alt="" className="w-12 h-12 object-contain shrink-0 drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]" draggable={false} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-base">Tournoi</span>
              <span className="text-[9px] uppercase tracking-wider px-1 rounded-full" style={{ color: "var(--theme-secondary)", background: "color-mix(in oklab, var(--theme-primary) 35%, transparent)" }}>Bracket</span>
            </div>
            <div className="text-[11px] text-zinc-300/80">Gravis un tableau d'adversaires jusqu'au podium.</div>
          </div>
          <span className="ml-auto text-xl" style={{ color: "var(--theme-primary)" }}>→</span>
        </div>
      </motion.button>
    </motion.div>
  );
}
