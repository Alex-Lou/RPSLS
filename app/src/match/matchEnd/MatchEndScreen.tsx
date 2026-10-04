/**
 * MatchEndScreen — L'écran de fin de match COMMUN à tous les modes
 * (Classique / Classé / Constellation / Constellation Pro / Arena / en ligne /
 * tutoriel). Chaque mode garde sa logique (enregistrement, gains, revanche,
 * onMatchResult des tournois) dans un petit adaptateur ; ici, que la mise en
 * scène :
 *
 *  - plein écran (portail <body> → échappe aux ancêtres transformés comme
 *    ScaleToFit / motion), marges safe-area (--sai-*) ;
 *  - titre VICTOIRE / DÉFAITE / ÉGALITÉ en IMPACT (zoom + flou → net, onde de
 *    choc, flash), ligne de score avec l'adversaire, raison de fin éventuelle ;
 *  - compteurs de gains animés + barres niveau / palier avec moment fort ;
 *  - boutons au pouce EN BAS (secondaire « Retour » + primaire « Rejouer… ») ;
 *  - jamais de débordement à 360×760 : contenu centré « sûr » (min-h-full),
 *    défilement seulement en dernier recours ; paysage bas → 2 colonnes.
 *
 * Le mouvement réduit est respecté via le MotionConfig global (transforms) et
 * useReduced() pour les compteurs / barres. Pas de vibration ici : chaque mode
 * déclenche déjà la sienne à la fin du match.
 */
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { useT } from "../../i18n";
import { CelebrationBurst } from "../sharedMatchUI/CelebrationBurst";
import { RewardChips, type MatchEndRewards } from "./RewardChips";
import { LevelBar, TierBar } from "./ProgressReveal";
import { claimLevelUps } from "../../fx/levelUpGate";

export type EndOutcome = "win" | "loss" | "draw";
export interface EndAction { label: string; onClick: () => void }
export type { MatchEndRewards };

export interface MatchEndScreenProps {
  outcome: EndOutcome;
  /** Remplace VICTOIRE/DÉFAITE/ÉGALITÉ (ex. tutoriel). */
  title?: string;
  /** Remplace l'emblème 🏆 / 💀 / 🤝. */
  glyph?: string;
  /** Petite pastille « Par forfait ». */
  forfeit?: boolean;
  /** Phrase d'ambiance sous le titre (déjà traduite). */
  subtitle?: string | null;
  /** Raison de fin (ex. « Départage : ❤ en début de tour »), déjà traduite. */
  reason?: string | null;
  /** Ligne de score : valeurs + noms. `caption` = légende (ex. « Tour 12 »). */
  score?: { you: ReactNode; opp: ReactNode; youName: string; oppName: string; caption?: string };
  /** Gains affichés (valeurs lues des mêmes sources que chaque mode). */
  rewards?: MatchEndRewards;
  /** Barre de niveau (XP) — défaut : affichée si rewards.xp > 0. */
  showLevelBar?: boolean;
  /** Barre de palier LP : quel ladder du store suivre. */
  lpLadder?: "classeLp" | "rankLp";
  /** Contenu propre au mode (récap de cartes, leçons du tuto…). */
  extra?: ReactNode;
  primary?: EndAction;
  secondary?: EndAction;
  /** Confettis + burst (défaut : victoire). */
  celebrate?: boolean;
}

const LOOK: Record<EndOutcome, { glyph: string; title: string; text: string; glow: string; ring: string }> = {
  win: {
    glyph: "🏆", title: "end.victory",
    text: "from-emerald-200 via-emerald-300 to-teal-400",
    glow: "rgba(52,211,153,0.55)", ring: "rgba(110,231,183,0.9)",
  },
  loss: {
    glyph: "💀", title: "end.defeat",
    text: "from-rose-200 via-rose-300 to-fuchsia-400",
    glow: "rgba(244,63,94,0.5)", ring: "rgba(253,164,175,0.85)",
  },
  draw: {
    glyph: "🤝", title: "end.draw",
    text: "from-zinc-100 via-zinc-200 to-zinc-400",
    glow: "rgba(161,161,170,0.45)", ring: "rgba(228,228,231,0.8)",
  },
};

/** Fond : base du thème + halo teinté par l'issue + rayons lents (victoire). */
function Backdrop({ outcome }: { outcome: EndOutcome }) {
  const look = LOOK[outcome];
  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
      <div className="absolute inset-0" style={{ background: `radial-gradient(120% 70% at 50% 18%, ${look.glow}, transparent 62%)` }} />
      {outcome === "win" && (
        <motion.div
          className="absolute left-1/2 top-[22%] w-[160vmax] h-[160vmax] -translate-x-1/2 -translate-y-1/2 opacity-25"
          style={{ background: `repeating-conic-gradient(from 0deg, ${look.glow} 0deg 6deg, transparent 6deg 18deg)`, maskImage: "radial-gradient(circle, black 0%, transparent 45%)" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        />
      )}
      <div className="absolute inset-0" style={{ background: "radial-gradient(130% 100% at 50% 40%, transparent 55%, rgba(0,0,0,0.65))" }} />
    </div>
  );
}

/** Emblème + titre en impact + onde de choc. */
function Headline({ outcome, title, glyph }: { outcome: EndOutcome; title: string; glyph: string }) {
  const look = LOOK[outcome];
  // Corps du titre = min(vw, vh) → tient aussi en paysage bas. Titre long
  // (tuto…) : corps réduit ; espace insécable avant « ! ? : ; »
  // pour que la ponctuation française ne parte jamais seule à la ligne.
  const long = title.length > 10;
  const [ring, setRing] = useState(true);
  useEffect(() => {
    const id = window.setTimeout(() => setRing(false), 1300);
    return () => window.clearTimeout(id);
  }, []);
  const text = title.replace(/ ([!?:;])/g, "\u00a0$1");
  return (
    <div className="relative flex flex-col items-center">
      <motion.div
        initial={{ scale: 0, rotate: -160 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 13, delay: 0.05 }}
        className="relative mb-1 w-16 h-16 [@media(max-height:700px)]:w-12 [@media(max-height:700px)]:h-12 [@media(max-height:620px)]:hidden rounded-full flex items-center justify-center text-4xl [@media(max-height:700px)]:text-3xl"
        style={{ background: `radial-gradient(circle, ${look.glow}, transparent 70%)`, boxShadow: `0 0 0 2px ${look.ring} inset, 0 0 32px ${look.glow}` }}
      >
        <span className="drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]">{glyph}</span>
      </motion.div>
      {/* Onde de choc à l'impact du titre — démontée une fois jouée (sinon son
          échelle finale élargit la zone défilable). */}
      {ring && <motion.div
        aria-hidden
        className="absolute top-1/2 left-1/2 w-40 h-40 -ml-20 -mt-20 rounded-full pointer-events-none"
        style={{ border: `3px solid ${look.ring}` }}
        initial={{ scale: 0.2, opacity: 0 }}
        animate={{ scale: [0.2, 2.6], opacity: [0.9, 0] }}
        transition={{ delay: 0.32, duration: 0.8, ease: "easeOut" }}
      />}
      {/* drop-shadow sur un wrapper : le h1 anime déjà `filter` (flou → net). */}
      <div className="relative" style={{ filter: `drop-shadow(0 6px 26px ${look.glow})` }}>
        <motion.h1
          id="match-end-title"
          initial={{ scale: 2.6, opacity: 0, filter: "blur(14px)" }}
          animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
          transition={{
            scale: { type: "spring", stiffness: 300, damping: 17, delay: 0.15 },
            opacity: { duration: 0.2, delay: 0.15 },
            filter: { duration: 0.3, delay: 0.15 },
          }}
          className={
            (long
              ? "text-[clamp(1.6rem,min(9vw,6vh),3.5rem)] "
              : "text-[clamp(2.1rem,min(13vw,8.5vh),4.75rem)] ") +
            "relative font-black leading-none tracking-tight pt-[0.12em] pb-[0.04em] text-center bg-gradient-to-b bg-clip-text text-transparent " +
            look.text
          }
          style={{ fontFamily: "var(--font-headline)" }}
        >
          {text}
        </motion.h1>
      </div>
    </div>
  );
}

function ScoreLine({ score, outcome }: { score: NonNullable<MatchEndScreenProps["score"]>; outcome: EndOutcome }) {
  const youTone = outcome === "win" ? "text-emerald-300" : outcome === "loss" ? "text-ink" : "text-zinc-200";
  const oppTone = outcome === "loss" ? "text-rose-300" : outcome === "win" ? "text-ink-muted" : "text-zinc-200";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.55, duration: 0.35 }}
      className="w-full flex flex-col items-center gap-0.5"
    >
      <div className="w-full grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl bg-black/35 ring-1 ring-white/10 px-4 py-2 [@media(max-height:700px)]:py-1.5 backdrop-blur-sm">
        <div className="min-w-0 text-right">
          <div className="text-[10px] uppercase tracking-wider text-ink-muted truncate">{score.youName}</div>
          <div className={"text-3xl [@media(max-height:700px)]:text-2xl font-black tabular-nums leading-tight " + youTone}>{score.you}</div>
        </div>
        <div className="text-ink-faint text-xl font-black">—</div>
        <div className="min-w-0 text-left">
          <div className="text-[10px] uppercase tracking-wider text-ink-muted truncate">{score.oppName}</div>
          <div className={"text-3xl [@media(max-height:700px)]:text-2xl font-black tabular-nums leading-tight " + oppTone}>{score.opp}</div>
        </div>
      </div>
      {score.caption && <div className="text-[10px] uppercase tracking-[0.25em] text-ink-faint">{score.caption}</div>}
    </motion.div>
  );
}

function Buttons({ primary, secondary }: { primary?: EndAction; secondary?: EndAction }) {
  // Un seul bouton → il prend le style primaire (ex. Arena en ligne : Retour).
  const main = primary ?? secondary;
  const side = primary ? secondary : undefined;
  if (!main) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7, type: "spring", stiffness: 260, damping: 22 }}
      className="relative z-40 shrink-0 w-full max-w-xl mx-auto flex gap-3 px-4 pt-2 pb-3 [@media(max-height:540px)]:pb-1.5"
    >
      {side && (
        <button
          type="button"
          onClick={side.onClick}
          className="flex-[2] min-w-0 h-14 [@media(max-height:540px)]:h-11 rounded-2xl font-bold text-sm text-ink bg-white/10 ring-1 ring-white/15 active:scale-[0.97] transition leading-tight px-3"
        >
          {side.label}
        </button>
      )}
      <button
        type="button"
        onClick={main.onClick}
        className="flex-[3] min-w-0 h-14 [@media(max-height:540px)]:h-11 rounded-2xl font-black text-base text-white uppercase tracking-wide active:scale-[0.97] transition leading-tight px-3"
        style={{
          background: "linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))",
          boxShadow: "0 10px 28px -10px color-mix(in oklab, var(--theme-primary) 70%, transparent), inset 0 1px 0 rgba(255,255,255,0.25)",
          fontFamily: "var(--font-headline)",
        }}
      >
        {main.label}
      </button>
    </motion.div>
  );
}

export function MatchEndScreen(props: MatchEndScreenProps) {
  const t = useT();
  const { outcome, rewards, extra, score } = props;
  const look = LOOK[outcome];
  const celebrate = props.celebrate ?? outcome === "win";
  const xp = rewards?.xp ?? 0;
  const showLevel = props.showLevelBar ?? xp > 0;
  const hasProgress = showLevel || (!!props.lpLadder && !!rewards?.lp);
  // Tant que la barre de niveau est affichée, c'est elle (et non l'overlay
  // global LevelUpWatcher) qui célèbre un éventuel passage de niveau.
  useEffect(() => (showLevel ? claimLevelUps() : undefined), [showLevel]);

  const screen = (
    <motion.div
      role="dialog"
      aria-modal
      aria-labelledby="match-end-title"
      data-match-end={outcome}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[58] flex flex-col overflow-hidden text-ink"
      style={{
        background: "var(--theme-bg, #07070c)",
        paddingTop: "var(--sai-top)", paddingBottom: "var(--sai-bottom)",
        paddingLeft: "var(--sai-left)", paddingRight: "var(--sai-right)",
      }}
    >
      <Backdrop outcome={outcome} />
      {celebrate && <CelebrationBurst />}
      {/* Flash d'impact (très bref) au moment où le titre « tombe ». */}
      <motion.div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ background: look.glow }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.35, 0] }}
        transition={{ delay: 0.28, duration: 0.45 }}
      />

      <div className="relative z-40 flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain">
        <div className="min-h-full w-full max-w-xl mx-auto flex flex-col items-center justify-center gap-3 [@media(max-height:700px)]:gap-2 px-4 py-3 [@media(orientation:landscape)_and_(max-height:540px)]:max-w-4xl [@media(orientation:landscape)_and_(max-height:540px)]:flex-row [@media(orientation:landscape)_and_(max-height:540px)]:gap-6 [@media(orientation:landscape)_and_(max-height:540px)]:py-1">
          {/* Colonne A : titre, ambiance, raison, score. */}
          <section className="w-full flex flex-col items-center gap-2 [@media(max-height:700px)]:gap-1.5 [@media(orientation:landscape)_and_(max-height:540px)]:flex-1">
            <Headline outcome={outcome} title={props.title ?? t(look.title)} glyph={props.glyph ?? look.glyph} />
            {props.forfeit && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                className="px-2.5 py-0.5 rounded-full bg-amber-400/15 ring-1 ring-amber-300/40 text-[10px] font-bold uppercase tracking-[0.25em] text-amber-200"
              >
                {t("end.forfeit")}
              </motion.div>
            )}
            {props.subtitle && (
              <motion.p
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.35 }}
                className="text-center text-sm sm:text-base [@media(max-height:700px)]:text-[13px] text-ink-muted leading-snug max-w-md"
              >
                {props.subtitle}
              </motion.p>
            )}
            {props.reason && (
              <motion.p
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                className="text-center text-[11px] font-semibold text-sky-200/90 px-2.5 py-0.5 rounded-full bg-sky-400/10 ring-1 ring-sky-300/25"
              >
                {props.reason}
              </motion.p>
            )}
            {score && <ScoreLine score={score} outcome={outcome} />}
          </section>

          {/* Colonne B : gains, progression, contenu du mode. */}
          {(rewards || hasProgress || extra) && (
            <section className="w-full flex flex-col items-center gap-2.5 [@media(max-height:700px)]:gap-2 [@media(orientation:landscape)_and_(max-height:540px)]:flex-1">
              {rewards && <RewardChips rewards={rewards} delay={0.85} />}
              {hasProgress && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0 }}
                  className="w-full flex flex-col gap-2 rounded-2xl bg-black/30 ring-1 ring-white/10 px-3.5 py-2.5 [@media(max-height:700px)]:py-2"
                >
                  {showLevel && <LevelBar xpGained={xp} delay={1.3} />}
                  {props.lpLadder && !!rewards?.lp && <TierBar ladder={props.lpLadder} lpDelta={rewards.lp} delay={1.5} />}
                </motion.div>
              )}
              {extra && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.15 }}
                  className="w-full"
                >
                  {extra}
                </motion.div>
              )}
            </section>
          )}
        </div>
      </div>

      <Buttons primary={props.primary} secondary={props.secondary} />
    </motion.div>
  );

  return createPortal(screen, document.body);
}
