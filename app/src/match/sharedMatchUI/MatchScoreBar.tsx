import { motion, AnimatePresence } from "motion/react";

/* ──────────── RollingScore ──────────── */

/** Fonte des CHIFFRES de score : mono tabulaire GARANTIE, HARD-CODÉE — PAS
 *  `var(--font-mono)` (Alex 2026-07, 2 rounds de bug « score atroce sur certains
 *  thèmes »). Une scène peut mettre `--font-mono` sur une police display/serif
 *  (Casino→Bebas, Holy→IM Fell) → chiffres condensés/old-style illisibles. Et
 *  la fonte de thème (--font-body serif : Cormorant, IM Fell…) rognait/serrait
 *  les chiffres. On fige donc les chiffres sur des monos réellement bundlées
 *  (@fontsource : JetBrains, Fira, Space Mono) → identiques et NETS sur les 12
 *  palettes ET toutes les scènes. Le score reste « themé » par la COULEUR
 *  (emerald/rose), pas par la fonte des chiffres. */
export const SCORE_DIGIT_FONT = '"JetBrains Mono", "Fira Code", "Space Mono", Consolas, monospace';

/**
 * Score digit. Refonte robustesse (Alex 2026-07 « le score doit être PARFAIT sur
 * TOUS les thèmes ») — priorité CORRECTION > fioriture, après 2 rapports de bug :
 *  - RENDU STATIQUE, sans motion / sans key={value} / sans AnimatePresence : le
 *    nombre est mis à jour EN PLACE par React → il est PHYSIQUEMENT IMPOSSIBLE
 *    d'avoir deux chiffres à l'écran (fin du « 01 » / « 13 » / « 23:2 » vus sur
 *    le WebView Android où l'ancien span animé restait empilé au nouveau).
 *  - Fonte mono tabulaire garantie (SCORE_DIGIT_FONT) → chiffres nets partout.
 *  - Pas de hauteur fixe ni d'overflow → aucun glyphe rogné.
 *  - min-w-[1.2em] : place stable pour 1 chiffre, s'étend seul à 2 (10, 12…).
 */
export function RollingScore({
  value, color, size = "lg",
}: {
  value: number;
  color: "emerald" | "rose" | "violet" | "amber" | "zinc";
  size?: "md" | "lg" | "xl";
}) {
  const palette: Record<typeof color, string> = {
    emerald: "text-emerald-300",
    rose:    "text-rose-300",
    violet:  "text-violet-300",
    amber:   "text-amber-300",
    zinc:    "text-ink-muted",
  };
  const sizeCls = size === "xl" ? "text-4xl sm:text-5xl"
                : size === "lg" ? "text-3xl sm:text-4xl"
                :                 "text-2xl sm:text-3xl";
  return (
    <span
      className={
        "inline-flex items-center justify-center min-w-[1.2em] font-black leading-none " +
        sizeCls + " " + palette[color]
      }
      style={{ fontFamily: SCORE_DIGIT_FONT, fontVariantNumeric: "tabular-nums" }}
    >
      {value}
    </span>
  );
}

/* ──────────── MatchScoreBar ──────────── */

/**
 * The unified top-of-match score bar used by every mode (classic
 * Training/Casual/Ranked/Hot-seat AND Constellation Lanes). One component →
 * one look. Full-width score card with centered names + score; the back/quit
 * button is rendered separately by `FloatingMatchBackButton` so it docks next
 * to the burger and frees the whole row width for the score header.
 */
export function MatchScoreBar({
  youName, oppName, youScore, oppScore, caption,
  youTag, oppTag, youStreak = 0, oppStreak = 0, compact = false,
}: {
  youName: string;
  oppName: string;
  youScore: number;
  oppScore: number;
  caption?: string;
  /** Tiny uppercase label above each name (e.g. "You" / "Opponent"). */
  youTag?: string;
  oppTag?: string;
  youStreak?: number;
  oppStreak?: number;
  /** Opt-in slimmer bar (Alex 2026-07) : padding + chiffres réduits pour rendre
   *  de la hauteur quand une rangée de boutons vit AU-DESSUS (Constellation
   *  Classé). Défaut false → tous les autres modes gardent la taille pleine. */
  compact?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className={
        "flex items-center justify-between rounded-2xl bg-surface border border-hairline min-w-0 px-3 sm:px-4 " +
        (compact ? "py-1.5 sm:py-2" : "py-2.5 sm:py-3")
      }>
        <div className="flex flex-col min-w-0 flex-1">
          {youTag && (
            <span className="text-[12px] sm:text-xs uppercase tracking-wider text-ink-muted font-medium">{youTag}</span>
          )}
          <span className="text-base sm:text-lg font-bold truncate text-emerald-200 flex items-center gap-1.5">
            <span className="truncate">{youName}</span>
            <StreakBadge streak={youStreak} />
          </span>
        </div>
        {/* Groupe score sur la fonte MONO du thème (chiffres + séparateur) :
            lisible et aligné sur les 12 palettes — cf. SCORE_DIGIT_FONT. */}
        <div
          className="shrink-0 px-2 sm:px-3 flex items-center justify-center gap-1 whitespace-nowrap"
          style={{ fontFamily: SCORE_DIGIT_FONT }}
        >
          <RollingScore value={youScore} color="emerald" size={compact ? "md" : "lg"} />
          <span className={"text-ink-muted px-0.5 font-bold " + (compact ? "text-xl" : "text-2xl")}>:</span>
          <RollingScore value={oppScore} color="rose" size={compact ? "md" : "lg"} />
        </div>
        <div className="flex flex-col text-right min-w-0 flex-1">
          {oppTag && (
            <span className="text-[12px] sm:text-xs uppercase tracking-wider text-ink-muted font-medium">{oppTag}</span>
          )}
          <span className="text-base sm:text-lg font-bold truncate text-rose-200 flex items-center gap-1.5 justify-end">
            <StreakBadge streak={oppStreak} />
            <span className="truncate">{oppName}</span>
          </span>
        </div>
      </div>
      {caption && (
        <div className="text-center text-[13px] sm:text-sm uppercase tracking-[0.2em] text-ink-muted font-medium">
          {caption}
        </div>
      )}
    </div>
  );
}

function StreakBadge({ streak }: { streak: number }) {
  return (
    <AnimatePresence>
      {streak >= 2 && (
        <motion.span
          key={streak}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 18 }}
          className={
            "shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full " +
            (streak >= 3
              ? "bg-orange-500/30 text-orange-300 ring-1 ring-orange-400/50"
              : "bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/40")
          }
        >
          🔥 {streak}
        </motion.span>
      )}
    </AnimatePresence>
  );
}
