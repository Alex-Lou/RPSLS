import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "../../store/store";
import { GameMode, MODE_META, REWARDS, type Difficulty } from "../../types";
import { THEMES, gradientFromTheme } from "../../theme/theme";
import {
  todayDailyQuests,
  matchesToday,
  todayDateKey,
  type DailyQuestDef,
} from "../../engine/daily";
import { useT } from "../../i18n";
import {
  FloatingMatchBackButton,
  hapticTick,
  useAndroidBackPrompt,
} from "../../match/sharedMatchUI";

/* ─────────── Mode Select ─────────── */

// "online" + "constellation" are UI-only home cards. Constellation routes to
// a local vs-CPU 3-lanes match; the real GameMode union covers CPU/hotseat
// recorded matches.
type ModeCardId = GameMode | "online" | "constellation" | "ranked_constellation";

// Order: Training, Online (live), Constellation (vs CPU),
// Constellation Ranked (cards+mana), Ranked. (Détendu + Hot-seat removed.)
const ALL_CARDS: ModeCardId[] = [
  "training", "online", "constellation", "ranked_constellation", "ranked",
];

// Hand-drawn icons that replace the emoji on each mode tile. Lives in
// public/MenuIcons (renamed to kebab-case to dodge URL-encoding traps).
const MODE_ICONS: Record<ModeCardId, string> = {
  training:             "/MenuIcons/entrainement.png",
  casual:               "/MenuIcons/detendu.png",
  ranked:               "/MenuIcons/classe.png",
  hotseat:              "/MenuIcons/hot-seat.png",
  online:               "/MenuIcons/en-ligne.png",
  constellation:        "/MenuIcons/constellation.png",
  ranked_constellation: "/MenuIcons/constellation.png", // Phase A: reuse art with a distinct tint.
};

/** Per-mode accent for the two tiles that otherwise fell through to the plain
 *  generic style (Entraînement, Classé) — every menu card now has its own
 *  coloured identity. Fixed hues (not theme tokens) on purpose: each mode must
 *  be recognisable at a glance, like online/constellation already are. */
const TILE_ACCENT: Partial<Record<ModeCardId, string>> = {
  training:
    "border-emerald-400/30 bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-cyan-500/15 " +
    "hover:from-emerald-500/25 hover:via-teal-500/20 hover:to-cyan-500/25 hover:border-emerald-400/60 shadow-lg shadow-emerald-500/10",
  ranked:
    "border-sky-400/30 bg-gradient-to-br from-sky-500/15 via-indigo-500/10 to-blue-500/15 " +
    "hover:from-sky-500/25 hover:via-indigo-500/20 hover:to-blue-500/25 hover:border-sky-400/60 shadow-lg shadow-sky-500/10",
};

/** Renders the mode tile icon — a PNG from /MenuIcons, sized to match the
 *  emoji it replaced (~36px, with breathing margins for the tile). */
function ModeIcon({ mode }: { mode: ModeCardId }) {
  return (
    <img
      src={MODE_ICONS[mode]}
      alt=""
      className="shrink-0 w-12 h-12 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
    />
  );
}

export function ModeSelect({
  onStart,
  onGoOnline,
  onGoConstellation,
  onGoConstellationMenu,
  onGoRanked,
  onGoSandbox,
  onGoClasse,
}: {
  onStart: (mode: GameMode, bestOf: number, questCtx?: { title: string; reward: number }) => void;
  onGoOnline?: () => void;
  onGoConstellation?: (winTo: number) => void;
  onGoConstellationMenu?: () => void;
  onGoRanked?: () => void;
  onGoSandbox?: () => void;
  onGoClasse?: () => void;
}) {
  const [mode, setMode] = useState<GameMode>("casual");
  const [bestOf, setBestOf] = useState(3);
  const [pendingMode, setPendingMode] = useState<GameMode | null>(null);
  const t = useT();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-3 sm:gap-5 flex-1 justify-center py-1"
    >
      <div className="text-center">
        <h1
          // Refined title: lighter weight (semibold instead of black), slight
          // tracking spread, dropped one size step so the title doesn't
          // dominate the page anymore. The colours stay theme-driven so the
          // header still belongs to whichever background is active.
          className="text-3xl sm:text-5xl font-semibold bg-clip-text text-transparent leading-[1.1]"
          style={{
            backgroundImage:
              "linear-gradient(135deg, color-mix(in oklab, var(--theme-primary) 85%, #fff) 0%, color-mix(in oklab, var(--theme-secondary) 85%, #fff) 100%)",
            fontFamily: "var(--font-headline)",
            letterSpacing: "0.01em",
            // drop-shadow (not text-shadow) works on bg-clip-text gradients —
            // keeps the title readable over bright/flashy backdrops.
            filter: "drop-shadow(0 2px 10px rgba(0,0,0,0.6))",
          }}
        >
          {t("play.title")}
        </h1>
        <p
          className="mt-1.5 sm:mt-2.5 text-ink text-xs sm:text-sm leading-snug tracking-[0.18em] uppercase"
          style={{ fontFamily: "var(--font-body)", textShadow: "0 1px 6px rgba(0,0,0,0.7)" }}
        >
          {t("splash.tagline")}
        </p>
      </div>

      <DailyChallengesPanel onStart={onStart} onGoOnline={onGoOnline} onGoConstellation={onGoConstellation} />

      {/* Mode tiles — 2 columns even on mobile so the 6 tiles fit one viewport. */}
      <div className="grid grid-cols-2 gap-3">
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
                  "text-left p-2.5 sm:p-4 rounded-2xl border transition flex flex-col items-start gap-1.5 relative overflow-hidden min-h-[124px] " +
                  "border-violet-400/30 bg-gradient-to-br from-violet-500/15 via-fuchsia-500/10 to-cyan-500/15 " +
                  "hover:from-violet-500/25 hover:via-fuchsia-500/20 hover:to-cyan-500/25 hover:border-violet-400/60 " +
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
                  "text-left p-2.5 sm:p-4 rounded-2xl border transition flex flex-col items-start gap-1.5 relative overflow-hidden min-h-[124px] " +
                  "border-fuchsia-400/30 bg-gradient-to-br from-fuchsia-500/15 via-violet-500/10 to-amber-500/15 " +
                  "hover:from-fuchsia-500/25 hover:via-violet-500/20 hover:to-amber-500/25 hover:border-fuchsia-400/60 " +
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
                    3 lanes en parallèle vs IA
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
                  "text-left p-2.5 sm:p-4 rounded-2xl border transition flex flex-col items-start gap-1.5 relative overflow-hidden min-h-[124px] " +
                  "border-amber-400/40 bg-gradient-to-br from-amber-500/15 via-rose-500/10 to-fuchsia-500/15 " +
                  "hover:from-amber-500/25 hover:via-rose-500/20 hover:to-fuchsia-500/25 hover:border-amber-400/70 " +
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
                "p-2.5 sm:p-4 rounded-2xl border transition flex flex-col gap-1.5 min-h-[124px] " +
                (TILE_ACCENT[m] ?? "border-hairline bg-hairline hover:border-white/20") + " " +
                // Wide tile (hot-seat) spans both columns, so left-aligning
                // its content leaves an ugly empty right half. Center it.
                (wide ? "col-span-2 items-center text-center justify-center" : "text-left items-start")
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

/* ─────────── Entraînement — solo sandbox (mode + difficulty + format/deck) ─────────── */

type SandboxMode = "classic" | "lanes" | "cards";

// Same icons + names as the main menu tiles, so the sandbox feels consistent.
const SANDBOX_MODES: { id: SandboxMode; icon: ModeCardId; label: string; tag: string }[] = [
  { id: "classic", icon: "ranked",               label: "Classique",            tag: "Duel 1 v 1 — premier à la majorité des manches." },
  { id: "lanes",   icon: "constellation",        label: "Constellation",        tag: "3 couloirs joués en parallèle contre l'IA." },
  { id: "cards",   icon: "ranked_constellation", label: "Constellation Ranked", tag: "Mana, deck & cartes bonus. Ouvre le lobby + tournoi." },
];

const DIFFS_META: { id: Difficulty; label: string; hint: string }[] = [
  { id: "easy",   label: "Facile",    hint: "L'IA joue souvent dans ton jeu — pour s'échauffer." },
  { id: "normal", label: "Normal",    hint: "Aléatoire pondéré selon l'humeur — combat équitable." },
  { id: "hard",   label: "Difficile", hint: "L'IA lit tes derniers coups et contre tes habitudes." },
];

const MAX_WIN_TO = 9;

export function SandboxView({
  onStart, onGoConstellation, onGoRanked, onBack,
}: {
  onStart: (mode: GameMode, bestOf: number) => void;
  onGoConstellation: (winTo: number) => void;
  onGoRanked: () => void;
  onBack: () => void;
}) {
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
      ? cur.label + " · " + curDiff.label + " · tournoi"
      : cur.label + " · " + curDiff.label + " · premier à " + winTo;

  const selOn = "linear-gradient(150deg, color-mix(in oklab, var(--theme-primary) 32%, transparent), color-mix(in oklab, var(--theme-secondary) 24%, transparent))";
  const fill = "linear-gradient(to right, var(--theme-primary), var(--theme-secondary))";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-3 sm:gap-4 flex-1 py-2 px-1 max-w-lg mx-auto w-full overflow-y-auto"
    >
      <FloatingMatchBackButton onClick={onBack} label="Retour" />

      {/* 🎲 docked top-right, at the same height as the burger + back arrow, so
          the whole config fits on one screen without scrolling to a bottom row. */}
      <button
        onClick={surprise}
        title="Config aléatoire"
        aria-label="Config aléatoire"
        className="fixed z-30 top-[max(env(safe-area-inset-top),32px)] right-[max(env(safe-area-inset-right),12px)] [@media(max-height:540px)]:top-1 h-11 [@media(max-height:540px)]:h-8 px-3 rounded-2xl bg-black/55 backdrop-blur border border-hairline hover:bg-black/70 transition flex items-center gap-1.5 text-ink text-xs font-semibold shadow-lg"
      >
        🎲 <span className="[@media(max-width:360px)]:hidden">Aléatoire</span>
      </button>

      <div className="text-center">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-themed leading-tight" style={{ fontFamily: "var(--font-headline)" }}>
          Entraînement
        </h1>
        <p className="text-[11px] text-ink-faint mt-1">Solo vs IA — règle ta partie comme tu veux</p>
      </div>

      {/* Mode — same icons/names as the home menu */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted font-bold mb-2">Type de jeu</div>
        <div className="grid grid-cols-3 gap-2">
          {SANDBOX_MODES.map((m) => {
            const on = mode === m.id;
            return (
              <motion.button
                key={m.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => { hapticTick(); setMode(m.id); }}
                className="rounded-2xl p-3 flex flex-col items-center gap-1.5 text-center transition min-h-[104px] justify-center"
                style={{
                  background: on ? selOn : "rgba(255,255,255,0.04)",
                  border: on ? "1px solid color-mix(in oklab, var(--theme-primary) 65%, transparent)" : "1px solid rgba(255,255,255,0.10)",
                }}
              >
                <ModeIcon mode={m.icon} />
                <span className={"text-[11px] font-bold leading-tight " + (on ? "text-white" : "text-ink-muted")}>{m.label}</span>
              </motion.button>
            );
          })}
        </div>
        <p className="text-[11px] text-ink-muted mt-2 text-center leading-snug min-h-[2.2em]">{cur.tag}</p>
      </div>

      {/* Difficulty + live hint */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted font-bold mb-2">Difficulté</div>
        <div className="grid grid-cols-3 gap-2">
          {DIFFS_META.map((d) => {
            const on = difficulty === d.id;
            return (
              <button
                key={d.id}
                onClick={() => { hapticTick(); updateProfile({ difficulty: d.id }); }}
                className={"rounded-xl py-2.5 text-sm font-bold transition " + (on ? "text-white" : "text-ink-muted bg-hairline border border-hairline hover:bg-hairline")}
                style={on ? { background: fill } : undefined}
              >
                {d.label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-ink-muted mt-2 text-center leading-snug min-h-[2.2em]">{curDiff.hint}</p>
      </div>

      {/* Rounds — pick as many as you want (stepper) */}
      {mode !== "cards" && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted font-bold mb-2">Manches</div>
          <div className="flex items-center justify-center gap-5">
            <button
              onClick={() => { hapticTick(); setWinTo((w) => Math.max(1, w - 1)); }}
              disabled={winTo <= 1}
              className="w-12 h-12 rounded-full text-2xl font-black bg-hairline border border-hairline hover:bg-hairline transition disabled:opacity-30 disabled:pointer-events-none"
            >−</button>
            <div className="text-center min-w-[6rem]">
              <div className="text-4xl font-black text-themed tabular-nums leading-none">{winTo}</div>
              <div className="text-[10px] text-ink-faint mt-1">{mode === "lanes" ? "couloirs à gagner" : "manches à gagner"}</div>
            </div>
            <button
              onClick={() => { hapticTick(); setWinTo((w) => Math.min(MAX_WIN_TO, w + 1)); }}
              disabled={winTo >= MAX_WIN_TO}
              className="w-12 h-12 rounded-full text-2xl font-black bg-hairline border border-hairline hover:bg-hairline transition disabled:opacity-30 disabled:pointer-events-none"
            >+</button>
          </div>
          <p className="text-[11px] text-ink-muted text-center mt-2">
            Premier à <b className="text-ink">{winTo}</b> {winTo > 1 ? "victoires" : "victoire"} l'emporte
            {mode !== "lanes" ? " · Best of " + (winTo * 2 - 1) : ""}
          </p>
        </div>
      )}

      {/* Recap + Play */}
      <div className="mt-auto pt-1">
        <div className="text-center text-[11px] text-ink-muted mb-4">
          <span className="px-3 py-1 rounded-full bg-hairline border border-hairline">{recap}</span>
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={play}
          className="w-full px-7 py-3.5 rounded-2xl font-bold text-white bg-themed shadow-lg shadow-violet-500/30 transition hover:scale-[1.01]"
          style={{ fontFamily: "var(--font-headline)", letterSpacing: "0.04em" }}
        >
          {mode === "cards" ? "Ouvrir le lobby Cartes →" : "Jouer →"}
        </motion.button>
      </div>
    </motion.div>
  );
}

/* ─────────── Constellation — prep menu before a lanes match ─────────── */

export function ConstellationLobby({
  onBack, onPlay,
}: {
  onBack: () => void;
  onPlay: (winTo: number) => void;
}) {
  const difficulty = useStore((s) => s.player.difficulty);
  const updateProfile = useStore((s) => s.updateProfile);
  const [winTo, setWinTo] = useState(2);
  useAndroidBackPrompt(onBack);

  const curDiff = DIFFS_META.find((d) => d.id === difficulty) ?? DIFFS_META[1];
  const fill = "linear-gradient(to right, var(--theme-primary), var(--theme-secondary))";

  const LANES = [
    { glyph: "⚔️", title: "FORCE",   fav: "Pierre & Ciseaux", accent: "text-amber-300" },
    { glyph: "🧠", title: "SAGESSE", fav: "Feuille & Spock",  accent: "text-sky-300" },
    { glyph: "🦎", title: "RUSE",    fav: "Lézard",           accent: "text-emerald-300" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-3 sm:gap-4 flex-1 py-2 px-1 max-w-lg mx-auto w-full overflow-y-auto"
    >
      <FloatingMatchBackButton onClick={onBack} label="Retour" />

      <div className="text-center">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-themed leading-tight" style={{ fontFamily: "var(--font-headline)" }}>
          Constellation
        </h1>
        <p className="text-[11px] text-ink-faint mt-1">3 couloirs joués en parallèle — gagne la majorité</p>
      </div>

      {/* The 3 lanes — what each one favours */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted font-bold mb-2">Les 3 couloirs</div>
        <div className="grid grid-cols-3 gap-2">
          {LANES.map((l) => (
            <div key={l.title} className="rounded-2xl p-3 bg-surface border border-hairline flex flex-col items-center gap-1 text-center">
              <span className="text-2xl">{l.glyph}</span>
              <span className={"text-[11px] font-black tracking-wide " + l.accent}>{l.title}</span>
              <span className="text-[9px] text-ink-muted leading-tight">{l.fav}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-ink-muted mt-2 text-center leading-snug">
          <b className="text-ink">Astuce :</b> gagne un couloir en y jouant l'un de ses coups favoris (listés ci-dessus) → <b className="text-emerald-300">+1 point bonus</b>. Ex : Pierre ou Ciseaux dans FORCE.
        </p>
      </div>

      {/* Difficulty + live hint */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted font-bold mb-2">Difficulté</div>
        <div className="grid grid-cols-3 gap-2">
          {DIFFS_META.map((d) => {
            const on = difficulty === d.id;
            return (
              <button
                key={d.id}
                onClick={() => { hapticTick(); updateProfile({ difficulty: d.id }); }}
                className={"rounded-xl py-2.5 text-sm font-bold transition " + (on ? "text-white" : "text-ink-muted bg-hairline border border-hairline hover:bg-hairline")}
                style={on ? { background: fill } : undefined}
              >
                {d.label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-ink-muted mt-2 text-center leading-snug min-h-[2.2em]">{curDiff.hint}</p>
      </div>

      {/* Rounds stepper */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted font-bold mb-2">Manches</div>
        <div className="flex items-center justify-center gap-5">
          <button
            onClick={() => { hapticTick(); setWinTo((w) => Math.max(1, w - 1)); }}
            disabled={winTo <= 1}
            className="w-12 h-12 rounded-full text-2xl font-black bg-hairline border border-hairline hover:bg-hairline transition disabled:opacity-30 disabled:pointer-events-none"
          >−</button>
          <div className="text-center min-w-[6rem]">
            <div className="text-4xl font-black text-themed tabular-nums leading-none">{winTo}</div>
            <div className="text-[10px] text-ink-faint mt-1">couloirs à gagner</div>
          </div>
          <button
            onClick={() => { hapticTick(); setWinTo((w) => Math.min(MAX_WIN_TO, w + 1)); }}
            disabled={winTo >= MAX_WIN_TO}
            className="w-12 h-12 rounded-full text-2xl font-black bg-hairline border border-hairline hover:bg-hairline transition disabled:opacity-30 disabled:pointer-events-none"
          >+</button>
        </div>
        <p className="text-[11px] text-ink-muted text-center mt-2">
          Premier à <b className="text-ink">{winTo}</b> {winTo > 1 ? "couloirs gagnés" : "couloir gagné"} l'emporte
        </p>
      </div>

      {/* Play */}
      <div className="mt-auto pt-1">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => { hapticTick(); onPlay(winTo); }}
          className="w-full px-7 py-3.5 rounded-2xl font-bold text-white bg-themed shadow-lg shadow-violet-500/30 transition hover:scale-[1.01]"
          style={{ fontFamily: "var(--font-headline)", letterSpacing: "0.04em" }}
        >
          Jouer →
        </motion.button>
      </div>
    </motion.div>
  );
}

/* ─────────── Classé — classic 1v1 hub (quick match + tournament) ─────────── */

export function ClasseLobby({
  onBack, onQuickMatch, onViewBracket,
}: {
  onBack: () => void;
  onQuickMatch: () => void;
  onViewBracket: () => void;
}) {
  useAndroidBackPrompt(onBack);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-5 flex-1 py-2 px-1 max-w-lg mx-auto w-full overflow-y-auto"
    >
      <FloatingMatchBackButton onClick={onBack} label="Retour" />

      <div className="text-center mt-8">
        <div className="text-5xl mb-1">🏆</div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-themed leading-tight" style={{ fontFamily: "var(--font-headline)" }}>
          Classé
        </h1>
        <p className="text-[11px] text-ink-faint mt-1">Duel 1 v 1 classique vs IA · gagne de l'XP</p>
      </div>

      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => { hapticTick(); onQuickMatch(); }}
        className="rounded-2xl p-4 text-left transition hover:brightness-110"
        style={{
          background: "linear-gradient(150deg, color-mix(in oklab, var(--theme-primary) 24%, transparent), color-mix(in oklab, var(--theme-secondary) 16%, transparent))",
          border: "1px solid color-mix(in oklab, var(--theme-primary) 42%, transparent)",
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl">⚔️</span>
          <div className="min-w-0">
            <div className="font-bold text-base">Match rapide</div>
            <div className="text-[11px] text-zinc-300/80">Un duel immédiat contre l'IA (Best of 5).</div>
          </div>
          <span className="ml-auto text-xl text-ink-muted">→</span>
        </div>
      </motion.button>

      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => { hapticTick(); onViewBracket(); }}
        className="rounded-2xl p-4 text-left transition hover:brightness-110"
        style={{
          background: "linear-gradient(150deg, color-mix(in oklab, var(--theme-secondary) 24%, transparent), color-mix(in oklab, var(--theme-primary) 16%, transparent))",
          border: "1px solid color-mix(in oklab, var(--theme-secondary) 42%, transparent)",
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl">🗂️</span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-base">Tournoi</span>
              <span className="text-[9px] uppercase tracking-wider px-1 rounded-full" style={{ color: "var(--theme-secondary)", background: "color-mix(in oklab, var(--theme-primary) 25%, transparent)" }}>Bracket</span>
            </div>
            <div className="text-[11px] text-zinc-300/80">Gravis un tableau d'adversaires IA jusqu'au podium.</div>
          </div>
          <span className="ml-auto text-xl text-ink-muted">→</span>
        </div>
      </motion.button>
    </motion.div>
  );
}

/* ─────────── Mode confirmation modal ─────────── */

function ModeConfirmModal({
  mode, bestOf, onBestOfChange, onCancel, onConfirm,
}: {
  mode: GameMode;
  bestOf: number;
  onBestOfChange: (n: number) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useT();
  const themeId = useStore((s) => s.player.themeId);
  const theme = THEMES[themeId];
  const r = REWARDS[mode];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 5 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-surface-raised border border-hairline rounded-3xl p-6 shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-3">
          <span className="text-4xl">{MODE_META[mode].emoji}</span>
          <div>
            <h2 className="text-xl font-bold">{t("mode." + mode)}</h2>
            <p className="text-xs text-ink-muted">{t("mode." + mode + ".tag")}</p>
          </div>
        </div>

        <div className="my-5">
          <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-2">
            {t("play.bestOf")}
          </div>
          <div className="flex gap-2">
            {[1, 3, 5, 7].map((n) => (
              <button
                key={n}
                onClick={() => onBestOfChange(n)}
                className={
                  "flex-1 px-3 py-2 rounded-xl border text-sm font-semibold transition " +
                  (bestOf === n
                    ? "bg-hairline border-white/40 text-white"
                    : "bg-hairline border-hairline hover:border-white/30")
                }
                style={
                  bestOf === n
                    ? { borderColor: theme.primary, color: theme.primary, background: `${theme.primary}20` }
                    : undefined
                }
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {(r.xpWin > 0 || r.lpWin !== 0) && (
          <p className="text-xs text-ink-faint mb-5">
            {r.xpWin > 0 && t("play.win.xp", { n: r.xpWin })}
            {r.lpWin > 0 && ` · ${t("play.win.lp", { n: r.lpWin })}`}
            {r.lpLoss < 0 && ` · ${t("play.loss.lp", { n: r.lpLoss })}`}
          </p>
        )}

        <div className="flex gap-2">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onCancel}
            className="flex-1 px-4 py-3 rounded-2xl font-semibold bg-hairline hover:bg-hairline border border-hairline"
          >
            {t("lab.btn.cancel")}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onConfirm}
            className="flex-1 px-4 py-3 rounded-2xl font-semibold text-white shadow-lg"
            style={{
              background: gradientFromTheme(theme),
            }}
          >
            {t("play.start")}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─────────── Daily Banner ─────────── */

/**
 * Daily challenges (#17) — a button showing today's claim count that opens a
 * modal listing the 3 daily objectives. Each one shows live progress (read from
 * today's recorded matches), a "Claim" button once complete (XP lands in the
 * header bar) and a "Play" button that routes to the right mode / matchmaking.
 */
function DailyChallengesPanel({
  onStart, onGoOnline, onGoConstellation,
}: {
  onStart: (mode: GameMode, bestOf: number, questCtx?: { title: string; reward: number }) => void;
  onGoOnline?: () => void;
  onGoConstellation?: (winTo: number) => void;
}) {
  const t = useT();
  const history = useStore((s) => s.history);
  const player = useStore((s) => s.player);
  const claimDailyQuest = useStore((s) => s.claimDailyQuest);
  const [open, setOpen] = useState(false);

  const quests = useMemo(() => todayDailyQuests(), []);
  const today = useMemo(() => matchesToday(history), [history]);
  const todayKey = todayDateKey();
  const claimedIds =
    player.dailyClaims && player.dailyClaims.date === todayKey ? player.dailyClaims.ids : [];

  const states = quests.map((q) => {
    const raw = q.progress(today, player);
    return {
      q,
      value: Math.min(raw, q.target),
      complete: raw >= q.target,
      claimed: claimedIds.includes(q.id),
    };
  });
  const claimable = states.filter((s) => s.complete && !s.claimed).length;
  const claimedCount = states.filter((s) => s.claimed).length;

  function play(q: DailyQuestDef) {
    setOpen(false);
    const r = q.route;
    if (r.kind === "mode") onStart(r.mode, r.bestOf, { title: t(`daily.${q.id}.title`), reward: q.xpReward });
    else if (r.kind === "constellation") onGoConstellation?.(2);
    else onGoOnline?.();
  }

  return (
    <>
      <motion.button
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => setOpen(true)}
        className="rounded-xl p-2.5 sm:p-4 border flex items-center gap-3 text-left bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-transparent border-amber-400/50 shadow-md shadow-amber-900/20"
      >
        <div className="text-xl sm:text-3xl shrink-0">🎯</div>
        <div className="flex-1 min-w-0">
          <div className="text-[9px] sm:text-[10px] uppercase tracking-widest font-bold text-amber-300 leading-tight">
            {t("play.daily.title")}
          </div>
          <div className="text-[12px] sm:text-base font-bold leading-tight">
            {claimedCount}/{quests.length} ✓
          </div>
        </div>
        {claimable > 0 ? (
          <span className="shrink-0 px-2 py-1 rounded-full bg-amber-400 text-zinc-900 text-[10px] sm:text-xs font-black">
            {t("quests.toClaim", { n: claimable })}
          </span>
        ) : (
          <span className="shrink-0 text-amber-300 text-lg">›</span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.92, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 6 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md max-h-[85vh] overflow-y-auto bg-surface-raised border border-hairline rounded-3xl p-5 shadow-2xl flex flex-col gap-3"
            >
              <div className="flex items-baseline justify-between">
                <h2 className="text-xl font-black tracking-tight bg-gradient-to-br from-amber-300 to-orange-400 bg-clip-text text-transparent">
                  🎯 {t("play.daily.title")}
                </h2>
                <button onClick={() => setOpen(false)} className="text-ink-muted hover:text-white text-xl leading-none px-1">✕</button>
              </div>

              {states.map(({ q, value, complete, claimed }) => {
                const pct = (value / q.target) * 100;
                return (
                  <div
                    key={q.id}
                    className={
                      "rounded-2xl border p-3 flex items-center gap-3 " +
                      (claimed
                        ? "bg-white/[0.02] border-hairline opacity-60"
                        : complete
                        ? "bg-amber-500/10 border-amber-400/40"
                        : "bg-hairline border-hairline")
                    }
                  >
                    <div className="text-2xl shrink-0">{q.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-sm">{t(`daily.${q.id}.title`)}</span>
                        <span className="text-[10px] text-emerald-300 bg-emerald-500/15 px-1.5 py-0.5 rounded-full font-bold">
                          +{q.xpReward} XP
                        </span>
                        {q.scope === "online" && (
                          <span className="text-[9px] text-cyan-300 bg-cyan-500/15 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            online
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-ink-muted mt-0.5">{t(`daily.${q.id}.desc`)}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-hairline overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-ink-muted tabular-nums whitespace-nowrap">
                          {value}/{q.target}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {claimed ? (
                        <span className="text-emerald-400 text-xl">✓</span>
                      ) : complete ? (
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => claimDailyQuest(q.id, q.xpReward)}
                          className="px-3 py-2 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-zinc-900 font-bold text-xs shadow-lg shadow-amber-900/40"
                        >
                          {t("quests.btn.claim")}
                        </motion.button>
                      ) : (
                        <button
                          onClick={() => play(q)}
                          className="px-3 py-2 rounded-xl bg-hairline hover:bg-hairline border border-hairline text-white font-bold text-xs transition"
                        >
                          {t("play.daily.start")}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

