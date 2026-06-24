import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { setBurgerHidden } from "../../../Sidebar";
import { useT } from "../../../i18n";
import { GameMode, REWARDS } from "../../../types";
import { ALL_CARDS, TILE_ACCENT, TILE_BASE, MENU_SCROLL_LOCKED, ModeIcon } from "./menuShared";
import { ModeConfirmModal } from "./ModeConfirmModal";
import { DailyChallengesPanel } from "./DailyChallengesPanel";

export function ModeSelect({
  onStart,
  onGoOnline,
  onGoConstellation,
  onGoConstellationMenu,
  onGoRanked,
  onGoArenaPro,
  onGoSandbox,
  onGoClasse,
}: {
  onStart: (mode: GameMode, bestOf: number, questCtx?: { title: string; reward: number }) => void;
  onGoOnline?: () => void;
  onGoConstellation?: (winTo: number) => void;
  onGoConstellationMenu?: () => void;
  onGoRanked?: () => void;
  onGoArenaPro?: () => void;
  onGoSandbox?: () => void;
  onGoClasse?: () => void;
}) {
  const [mode, setMode] = useState<GameMode>("casual");
  const [bestOf, setBestOf] = useState(3);
  const [pendingMode, setPendingMode] = useState<GameMode | null>(null);
  const t = useT();

  // Burger flottant MASQUÉ sur cet écran (Alex 2026-06-12 "le burger fout
  // tout en l'air") : le menu principal rend son propre burger themed INLINE
  // à gauche du Défi du jour → la carte joueur reprend toute la largeur en
  // haut. Restauré au unmount (autres pages / match gardent le flottant).
  // + SCROLL LOCK (Alex 2026-06-12 #2) : le menu doit tenir sur une page,
  // scroll bloqué. Repasser MENU_SCROLL_LOCKED à false si on doit ré-autoriser.
  // SCROLL LOCK = PORTRAIT-ONLY (tablette paysage 2026-06-21) : en portrait
  // téléphone le menu tient sur une page → on bloque le scroll. En PAYSAGE
  // (tablette, courte en hauteur) la grille s'étale en 2×3 mais on garde le
  // scroll comme filet de sécurité. On (ré)applique à chaque rotation.
  useEffect(() => {
    setBurgerHidden(true);
    const main = MENU_SCROLL_LOCKED ? document.querySelector("main") : null;
    const prevOverflow = main?.style.overflowY ?? "";
    const applyLock = () => {
      if (!main) return;
      const portrait = window.matchMedia("(orientation:portrait)").matches;
      main.style.overflowY = portrait ? "hidden" : "";
    };
    applyLock();
    window.addEventListener("orientationchange", applyLock);
    window.addEventListener("resize", applyLock);
    return () => {
      setBurgerHidden(false);
      window.removeEventListener("orientationchange", applyLock);
      window.removeEventListener("resize", applyLock);
      if (main) main.style.overflowY = prevOverflow;
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-2 sm:gap-4 flex-1 justify-start py-1"
    >
      <div className="text-center">
        {/* Respiration TRÈS douce du titre (Alex 2026-06-12 #4) : scale-only
         *  → composité GPU (aucun repaint), coût perf ≈ nul. On n'anime
         *  JAMAIS filter/box-shadow en continu (repaint chaque frame). */}
        <motion.h1
          animate={{ scale: [1, 1.014, 1] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          // AAA title treatment — heavy weight + uppercase + theme tracking, a
          // punchy 3-stop theme gradient, and a theme-COLOURED glow halo so the
          // title belongs to the active bundle (default theme = violet until the
          // user picks one). Font stays --font-headline (per-theme, with the
          // default baked into THEMES); bespoke per-theme title fonts land in
          // the theme-bundle pass.
          className="text-3xl sm:text-5xl font-black uppercase bg-clip-text text-transparent leading-[1.04]"
          style={{
            backgroundImage:
              "linear-gradient(135deg, color-mix(in oklab, var(--theme-primary) 70%, #fff) 0%, #ffffff 48%, color-mix(in oklab, var(--theme-secondary) 70%, #fff) 100%)",
            fontFamily: "var(--font-headline)",
            // Per-theme tracking (premium sets override --typo-headline-spacing);
            // sensible default for everyone else.
            letterSpacing: "var(--typo-headline-spacing, 0.05em)",
            // drop-shadow (not text-shadow) works on bg-clip-text gradients:
            // dark shadow for legibility over flash + a theme-tinted aura.
            filter:
              "drop-shadow(0 2px 10px rgba(0,0,0,0.6)) drop-shadow(0 0 16px color-mix(in oklab, var(--theme-primary) 45%, transparent))",
          }}
        >
          {t("play.title")}
        </motion.h1>
        {/* Flottement léger du sous-titre, déphasé du titre — transform-only. */}
        <motion.p
          animate={{ y: [0, -2, 0], opacity: [0.92, 1, 0.92] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
          className="mt-1 sm:mt-2.5 text-ink text-xs sm:text-sm leading-snug tracking-[0.18em] uppercase"
          style={{ fontFamily: "var(--font-body)", textShadow: "0 1px 6px rgba(0,0,0,0.7)" }}
        >
          {t("splash.tagline")}
        </motion.p>
      </div>

      <DailyChallengesPanel onStart={onStart} onGoOnline={onGoOnline} onGoConstellation={onGoConstellation} />

      {/* Mode tiles — 2 columns even on mobile so the 6 tiles fit one viewport.
       *  Compacté (Alex 2026-06-12) : tout le menu doit tenir SANS scroll. */}
      <div className="grid grid-cols-2 landscape:grid-cols-3 gap-2 sm:gap-3 flex-1 min-h-0 grid-rows-3 landscape:grid-rows-2 auto-rows-fr max-h-[46vh] landscape:max-h-none content-start">
        {ALL_CARDS.map((m, i) => {
          if (m === "online") {
            return (
              <motion.button
                key="online"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i, duration: 0.25 }}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onGoOnline?.()}
                disabled={!onGoOnline}
                className={
                  "text-left p-2 sm:p-4 rounded-2xl border transition flex flex-col items-start justify-center gap-1 relative overflow-hidden min-h-[100px] landscape:min-h-[88px] " +
                  TILE_BASE + " border-violet-400/30 from-violet-500/22 via-fuchsia-500/14 to-cyan-500/22 " +
                  "hover:from-violet-500/32 hover:via-fuchsia-500/26 hover:to-cyan-500/32 hover:border-violet-400/60 " +
                  "shadow-lg shadow-violet-500/10"
                }
              >
                <ModeIcon mode="online" />
                <div className="min-w-0 w-full">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-sm sm:text-base">{t("mode.online")}</span>
                    <span className="text-[9px] uppercase tracking-wider text-violet-200 bg-violet-500/25 px-1 rounded-full">
                      LIVE
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-ink-muted mt-0.5 line-clamp-2">{t("mode.online.tag")}</p>
                </div>
              </motion.button>
            );
          }
          if (m === "constellation") {
            return (
              <motion.button
                key="constellation"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i, duration: 0.25 }}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onGoConstellationMenu?.()}
                disabled={!onGoConstellationMenu}
                className={
                  "text-left p-2 sm:p-4 rounded-2xl border transition flex flex-col items-start justify-center gap-1 relative overflow-hidden min-h-[100px] landscape:min-h-[88px] " +
                  TILE_BASE + " border-fuchsia-400/30 from-fuchsia-500/22 via-violet-500/14 to-amber-500/22 " +
                  "hover:from-fuchsia-500/32 hover:via-violet-500/26 hover:to-amber-500/32 hover:border-fuchsia-400/60 " +
                  "shadow-lg shadow-fuchsia-500/10"
                }
              >
                <ModeIcon mode="constellation" />
                <div className="min-w-0 w-full">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-sm sm:text-base">Constellation</span>
                    <span className="text-[9px] uppercase tracking-wider text-fuchsia-200 bg-fuchsia-500/25 px-1 rounded-full">
                      NEW
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-ink-muted mt-0.5 line-clamp-2">
                    RPSLS pur · 3 lanes vs IA · sans cartes
                  </p>
                </div>
              </motion.button>
            );
          }
          if (m === "ranked_constellation") {
            return (
              <motion.button
                key="ranked_constellation"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i, duration: 0.25 }}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onGoRanked?.()}
                disabled={!onGoRanked}
                className={
                  "text-left p-2 sm:p-4 rounded-2xl border transition flex flex-col items-start justify-center gap-1 relative overflow-hidden min-h-[100px] landscape:min-h-[88px] " +
                  TILE_BASE + " border-amber-400/40 from-amber-500/22 via-rose-500/14 to-fuchsia-500/22 " +
                  "hover:from-amber-500/32 hover:via-rose-500/26 hover:to-fuchsia-500/32 hover:border-amber-400/70 " +
                  "shadow-lg shadow-amber-500/10"
                }
              >
                <ModeIcon mode="ranked_constellation" />
                <div className="min-w-0 w-full">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-sm sm:text-base">{t("mode.ranked_constellation")}</span>
                    <span className="text-[9px] uppercase tracking-wider text-amber-200 bg-amber-500/30 px-1 rounded-full">
                      NEW · CARDS
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-ink-muted mt-0.5 line-clamp-2">
                    {t("mode.ranked_constellation.tag")}
                  </p>
                </div>
              </motion.button>
            );
          }
          if (m === "arena_pro") {
            return (
              <motion.button
                key="arena_pro"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i, duration: 0.25 }}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onGoArenaPro?.()}
                disabled={!onGoArenaPro}
                className={
                  "text-left p-2 sm:p-4 rounded-2xl border transition flex flex-col items-start justify-center gap-1 relative overflow-hidden min-h-[100px] landscape:min-h-[88px] " +
                  TILE_BASE + " border-fuchsia-400/40 from-fuchsia-500/22 via-violet-500/14 to-indigo-500/22 " +
                  "hover:from-fuchsia-500/32 hover:via-violet-500/26 hover:to-indigo-500/32 hover:border-fuchsia-400/70 " +
                  "shadow-lg shadow-fuchsia-500/10"
                }
              >
                <ModeIcon mode="arena_pro" />
                <div className="min-w-0 w-full">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-xs sm:text-sm">{t("mode.arena_pro")}</span>
                    <span className="text-[9px] uppercase tracking-wider text-fuchsia-200 bg-fuchsia-500/30 px-1 rounded-full">
                      BETA
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-ink-muted mt-0.5 line-clamp-2">
                    {t("mode.arena_pro.tag")}
                  </p>
                </div>
              </motion.button>
            );
          }
          const rewards = REWARDS[m];
          // An odd last tile would sit alone in a 2-col grid — span it across
          // both columns so the menu stays balanced.
          const wide = i === ALL_CARDS.length - 1 && ALL_CARDS.length % 2 === 1;
          return (
            <motion.button
              key={m}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i, duration: 0.25 }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                // Entraînement → solo sandbox; Classé → its own lobby/tournament
                // hub; everything else goes straight to the best-of confirm.
                if (m === "training") { onGoSandbox?.(); return; }
                if (m === "ranked") { onGoClasse?.(); return; }
                setMode(m); setPendingMode(m);
              }}
              className={
                "p-2.5 sm:p-4 rounded-2xl border transition flex flex-col gap-1.5 min-h-[124px] landscape:min-h-[88px] " +
                (TILE_ACCENT[m]
                  ? TILE_BASE + " " + TILE_ACCENT[m]
                  : "border-hairline bg-surface hover:border-white/20") + " " +
                // Wide tile (hot-seat) spans both columns, so left-aligning
                // its content leaves an ugly empty right half. Center it.
                (wide ? "col-span-2 landscape:col-span-1 items-center landscape:items-start text-center landscape:text-left justify-center" : "text-left items-start justify-center")
              }
            >
              <ModeIcon mode={m} />
              <div className={"min-w-0 w-full" + (wide ? " flex flex-col items-center" : "")}>
                <div className={"flex items-center gap-1.5 flex-wrap" + (wide ? " justify-center" : "")}>
                  <span className="font-semibold text-sm sm:text-base">{t("mode." + m)}</span>
                  {rewards.lpWin > 0 && (
                    <span className="text-[9px] uppercase tracking-wider text-rose-300 bg-rose-500/15 px-1 rounded-full">
                      LP
                    </span>
                  )}
                  {rewards.xpWin > 0 && (
                    <span className="text-[9px] uppercase tracking-wider text-emerald-300 bg-emerald-500/15 px-1 rounded-full">
                      XP
                    </span>
                  )}
                </div>
                <p className="text-[10px] sm:text-xs text-ink-muted mt-0.5 line-clamp-2">{t("mode." + m + ".tag")}</p>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Mode confirmation modal */}
      <AnimatePresence>
        {pendingMode && (
          <ModeConfirmModal
            mode={pendingMode}
            bestOf={bestOf}
            onBestOfChange={setBestOf}
            onCancel={() => setPendingMode(null)}
            onConfirm={() => { setPendingMode(null); onStart(mode, bestOf); }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
