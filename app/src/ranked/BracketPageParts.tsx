import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { type TournamentState, type TournamentSize, TOURNAMENT_SIZES } from "./TournamentBracket";
import { useT } from "../i18n";

/**
 * Sous-composants de BracketPage (overlay de préparation, choix de taille,
 * CTA de combat) + helpers — extraits VERBATIM de BracketPage.tsx.
 */

export const SIZE_META: Record<TournamentSize, { titleKey: string; subKey: string; glyph: string; art: string }> = {
  4:  { titleKey: "bracket.size.4.title",  subKey: "bracket.size.4.sub",  glyph: "⚡",  art: "/Icones Tournoi/ConstRankedRapide.png" },
  8:  { titleKey: "bracket.size.8.title",  subKey: "bracket.size.8.sub",  glyph: "🛡️", art: "/Icones Tournoi/ConstRankedClassique.png" },
  16: { titleKey: "bracket.size.16.title", subKey: "bracket.size.16.sub", glyph: "👑", art: "/Icones Tournoi/ConstRankedEpique.png" },
};

/* ─────────── Tournament preparing overlay ─────────── */

/**
 * TournamentPreparingOverlay — drumroll between "Intégrer" and the bracket
 * actually starting. A 3-2-1 countdown over a darkened backdrop with a
 * pulsing trophy gives the tournament its own start beat.
 */
export function TournamentPreparingOverlay({ size, onDone }: { size: number; onDone: () => void }) {
  const t = useT();
  const [beat, setBeat] = useState(3);
  useEffect(() => {
    if (beat === 0) {
      const id = window.setTimeout(onDone, 480);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => setBeat((b) => b - 1), 850);
    return () => window.clearTimeout(id);
  }, [beat, onDone]);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-5 text-center">
        <motion.div
          animate={{ scale: [1, 1.08, 1], rotate: [0, -3, 3, 0] }}
          transition={{ duration: 1.7, repeat: Infinity }}
          className="text-7xl"
          style={{ filter: "drop-shadow(0 4px 20px color-mix(in oklab, var(--theme-primary) 55%, transparent))" }}
        >
          🏆
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-black bg-clip-text text-transparent"
          style={{
            fontFamily: "var(--font-headline)",
            letterSpacing: "0.05em",
            backgroundImage: "linear-gradient(90deg, var(--theme-primary), var(--theme-secondary))",
          }}
        >
          {t("bracket.preparing.title")}
        </motion.h2>
        <p className="text-[12px] text-ink-faint max-w-xs leading-snug px-6">
          {t("bracket.preparing.sub", { n: size })}
        </p>
        <motion.div
          key={beat}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.4, opacity: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 18 }}
          className="text-6xl font-black tabular-nums"
          style={{
            color: "color-mix(in oklab, var(--theme-secondary) 80%, white)",
            filter: "drop-shadow(0 2px 12px color-mix(in oklab, var(--theme-primary) 60%, transparent))",
          }}
        >
          {beat > 0 ? beat : t("bracket.go")}
        </motion.div>
      </div>
    </motion.div>
  );
}

export function hasPlayerPending(t: TournamentState): boolean {
  for (const round of t.rounds) {
    for (const m of round) {
      if (m.status === "pending" && m.p1 && m.p2 && (m.p1.isYou || m.p2.isYou)) return true;
    }
  }
  return false;
}

/* ──────────── Size picker ──────────── */

export function SizePicker({ onPick }: { onPick: (s: TournamentSize) => void }) {
  const t = useT();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex flex-col gap-3 max-w-sm mx-auto w-full px-2"
    >
      {TOURNAMENT_SIZES.map((size, i) => {
        const meta = SIZE_META[size];
        return (
          <motion.button
            key={size}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.06 * i }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onPick(size)}
            className="group relative w-full overflow-hidden rounded-2xl text-left transition"
            style={{
              background:
                "linear-gradient(135deg, " +
                "color-mix(in oklab, var(--theme-primary) 16%, rgba(10,12,20,0.88)) 0%, " +
                "color-mix(in oklab, var(--theme-secondary) 16%, rgba(10,12,20,0.88)) 100%)",
              border: "1px solid color-mix(in oklab, var(--theme-primary) 45%, transparent)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            <div className="flex items-center gap-4 px-5 py-4">
              {meta.art ? (
                <img
                  src={meta.art}
                  alt=""
                  className="w-14 h-14 object-contain shrink-0 drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]"
                  draggable={false}
                />
              ) : (
                <span className="text-3xl drop-shadow">{meta.glyph}</span>
              )}
              <div className="flex-1">
                <div
                  className="text-lg font-extrabold text-white"
                  style={{ fontFamily: "var(--font-headline)", letterSpacing: "0.04em" }}
                >
                  {t(meta.titleKey)}
                </div>
                <div className="text-[11px] text-zinc-300/80">{t(meta.subKey)}</div>
              </div>
              <span
                className="text-2xl font-black tabular-nums"
                style={{ color: "color-mix(in oklab, var(--theme-primary) 85%, white)" }}
              >
                {size}
              </span>
            </div>
          </motion.button>
        );
      })}
    </motion.div>
  );
}

/* ──────────── Combat CTA ──────────── */

export function CombatButton({ oppName, oppAvatar, onClick }: {
  oppName: string; oppAvatar: string; onClick: () => void;
}) {
  const t = useT();
  const isPhoto = /^(data:|\/|https?:)/.test(oppAvatar);
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
      onClick={onClick}
      aria-label={t("bracket.fightAria", { name: oppName })}
      // Bold, unmistakable primary CTA: a SOLID theme gradient (like the Lock
      // button) so it reads as "the action" while still wearing the active
      // palette. White text + the opponent's avatar give it presence.
      className="group relative w-full max-w-md mx-auto overflow-hidden rounded-2xl transition bg-themed-br"
      style={{
        boxShadow:
          "0 10px 30px -10px color-mix(in oklab, var(--theme-primary) 70%, transparent), " +
          "inset 0 1px 0 rgba(255,255,255,0.20)",
      }}
    >
      {/* Sweeping sheen */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-[-40%] w-[45%] opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)",
          transform: "skewX(-18deg)",
        }}
      />
      <span className="relative flex items-center justify-center gap-3 py-4 px-5">
        <span className="flex items-center justify-center w-9 h-9 rounded-full bg-black/25 overflow-hidden shrink-0 ring-1 ring-white/30">
          {isPhoto ? (
            <img src={oppAvatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-lg">{oppAvatar}</span>
          )}
        </span>
        <span
          className="flex flex-col items-start leading-tight text-white"
          style={{ fontFamily: "var(--font-headline)", textShadow: "0 1px 3px rgba(0,0,0,0.4)" }}
        >
          <span className="text-[10px] uppercase tracking-[0.25em] opacity-80">{t("bracket.fight")}</span>
          <span className="text-lg font-extrabold" style={{ letterSpacing: "0.04em" }}>
            {oppName.toUpperCase()}
          </span>
        </span>
        <span aria-hidden className="ml-1 text-xl text-white/90 group-hover:translate-x-0.5 transition-transform">⚔️</span>
      </span>
    </motion.button>
  );
}
