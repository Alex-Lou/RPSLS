/**
 * TournamentPodium — celebratory end-of-tournament screen.
 *
 * Shows a 2-1-3 podium (medals, crown for the champion, confetti), the XP
 * placement reward for each spot, and the full final standings with the
 * player's own row highlighted. Awards the player's placement bonus once.
 */

import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { useT } from "../i18n";
import { useStore } from "../store/store";
import { avatarImgStyle } from "../theme/avatar";
import { CelebrationBurst, FloatingMatchBackButton } from "../match/sharedMatchUI";
import { tournamentStandings, type Standing, type TournamentState } from "./TournamentBracket";

const isImg = (a: string) => /^(data:|\/|https?:)/.test(a);

function Avatar({ avatar, size }: { avatar: string; size: number }) {
  return (
    <span
      className="rounded-full overflow-hidden flex items-center justify-center bg-surface-2 ring-1 ring-white/15 shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.55 }}
    >
      {isImg(avatar)
        ? <img src={avatar} alt="" className="w-full h-full object-cover" style={avatarImgStyle(avatar)} />
        : <span>{avatar}</span>}
    </span>
  );
}

const PODIUM_STYLE: Record<number, { medal: string; grad: string; bar: string; h: number; av: number; delay: number }> = {
  1: { medal: "🥇", grad: "from-yellow-300 to-amber-500", bar: "from-amber-400/80 to-yellow-600/40", h: 140, av: 84, delay: 0.15 },
  2: { medal: "🥈", grad: "from-zinc-200 to-slate-400",   bar: "from-slate-300/70 to-slate-500/30", h: 96,  av: 68, delay: 0.35 },
  3: { medal: "🥉", grad: "from-amber-600 to-orange-700", bar: "from-orange-500/70 to-amber-700/30", h: 72,  av: 68, delay: 0.5 },
};

function PodiumBlock({ s, you }: { s: Standing; you: boolean }) {
  const st = PODIUM_STYLE[s.place];
  const champ = s.place === 1;
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: st.delay, type: "spring", stiffness: 240, damping: 18 }}
      className="flex flex-col items-center justify-end gap-1.5 flex-1 min-w-0"
    >
      {champ && (
        <motion.div
          initial={{ y: 6, opacity: 0, rotate: -12 }}
          animate={{ y: [0, -4, 0], opacity: 1, rotate: 0 }}
          transition={{ y: { duration: 2.2, repeat: Infinity, ease: "easeInOut" }, opacity: { delay: st.delay + 0.2 }, rotate: { delay: st.delay + 0.2 } }}
          className="text-2xl leading-none"
        >👑</motion.div>
      )}
      <div className="relative">
        {champ && (
          <motion.div
            aria-hidden
            animate={{ opacity: [0.4, 0.8, 0.4], scale: [0.9, 1.15, 0.9] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 rounded-full blur-xl pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(251,191,36,0.8), transparent 70%)" }}
          />
        )}
        <span className="relative block"><Avatar avatar={s.player.avatar} size={st.av} /></span>
      </div>
      <div className="text-xl leading-none">{st.medal}</div>
      <div className={"text-sm sm:text-base font-bold truncate max-w-[10rem] text-center " + (you ? "text-white" : "text-ink")}>
        {s.player.name}{you ? " (toi)" : ""}
      </div>
      <div className="text-xs text-ink-faint">Niv. {s.player.level}</div>
      <div className="text-sm font-black text-emerald-300">+{s.reward} XP</div>
      {/* Pedestal bar — wider + taller per the bumped PODIUM_STYLE heights. */}
      <motion.div
        initial={{ height: 0 }}
        animate={{ height: st.h }}
        transition={{ delay: st.delay + 0.1, type: "spring", stiffness: 160, damping: 20 }}
        className={"w-full max-w-[9rem] rounded-t-xl bg-gradient-to-b border-t border-white/20 flex items-start justify-center pt-1.5 " + st.bar}
      >
        <span className={"text-3xl sm:text-4xl font-black bg-gradient-to-br bg-clip-text text-transparent " + st.grad}>{s.place}</span>
      </motion.div>
    </motion.div>
  );
}

export function TournamentPodium({
  tournament, onContinue, onReplay,
}: {
  tournament: TournamentState;
  onContinue: () => void;
  onReplay?: () => void;
}) {
  const t = useT();
  const grantXp = useStore((s) => s.grantXp);
  const standings = useMemo(() => tournamentStandings(tournament), [tournament]);
  const you = standings.find((s) => s.player.isYou);
  const podium = standings.slice(0, 3);
  // Podium display order: 2nd, 1st, 3rd.
  const order = [podium.find((p) => p.place === 2), podium.find((p) => p.place === 1), podium.find((p) => p.place === 3)].filter(Boolean) as Standing[];
  const rest = standings.slice(3);

  // Award the player's placement bonus exactly once.
  const awarded = useRef(false);
  useEffect(() => {
    if (awarded.current || !you) return;
    awarded.current = true;
    grantXp(you.reward);
  }, [you, grantXp]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      // Layout: header + podium are pinned (shrink-0), standings table scrolls
      // within its OWN bounded area. Floating buttons in the top corners carry
      // the actions, so the user never has to scroll to find a CTA.
      className="relative flex flex-col items-center gap-3 sm:gap-4 flex-1 min-h-0 py-4 px-3 sm:px-6 w-full max-w-3xl mx-auto"
    >
      <CelebrationBurst variant="fire" />
      <FloatingMatchBackButton onClick={onContinue} label={t("lanes.backToMenu")} />
      {onReplay && <FloatingNewRunButton onClick={onReplay} />}

      <div className="text-center shrink-0 w-full">
        <div className="text-xs sm:text-sm uppercase tracking-[0.35em] text-ink-faint">Tournoi terminé</div>
        <h1
          className="text-3xl sm:text-4xl md:text-5xl font-black text-themed leading-tight mt-1"
          style={{ fontFamily: "var(--font-headline)" }}
        >
          {you?.place === 1 ? "🏆 Tu es Champion !" : `${tournament.champion?.name ?? "—"} remporte le tournoi`}
        </h1>
      </div>

      {/* Podium 2-1-3 — pinned. */}
      <div className="shrink-0 flex items-end justify-center gap-4 sm:gap-6 w-full px-1 mt-2">
        {order.map((s) => <PodiumBlock key={s.player.id} s={s} you={!!s.player.isYou} />)}
      </div>

      {/* Full standings — scrolls within its own bounded area when long.
          Only THIS section scrolls, the rest is fixed. */}
      {rest.length > 0 && (
        <div className="w-full flex-1 min-h-0 overflow-y-auto rounded-2xl bg-zinc-950/50 border border-hairline divide-y divide-white/5">
          {rest.map((s) => (
            <div
              key={s.player.id}
              className={"flex items-center gap-4 px-4 py-3 " + (s.player.isYou ? "bg-white/[0.07]" : "")}
              style={s.player.isYou ? { boxShadow: "inset 4px 0 0 var(--theme-primary)" } : undefined}
            >
              <span className="w-8 text-center text-base font-bold text-ink-faint tabular-nums">{s.place}</span>
              <Avatar avatar={s.player.avatar} size={36} />
              <span className={"flex-1 min-w-0 truncate text-base " + (s.player.isYou ? "text-white font-semibold" : "text-ink-muted")}>
                {s.player.name}{s.player.isYou ? " (toi)" : ""}
              </span>
              <span className="text-xs text-ink-faint">Niv. {s.player.level}</span>
              <span className="text-sm font-bold text-emerald-300/90">+{s.reward}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

/**
 * FloatingReplayButton — top-right corner counterpart to the existing
 * top-left back button. Themed and labelled with a refresh arrow icon so
 * "Rejouer un tournoi" is one tap away without scrolling past the podium.
 */
/**
 * FloatingNewRunButton — top-right action on the podium. Was a flat
 * "Rejouer" pill on the global violet gradient; Alex flagged it as
 * generic-looking and not living with the active theme. The new button:
 *  - label switched from "Rejouer" to "Nouveau tournoi" (action-oriented,
 *    reads as the celebratory "let's go again", not the gamey "replay")
 *  - glass card with a strong theme-primary inner ring + theme-tinted
 *    backdrop (color-mix of theme-primary over dark glass) so each theme
 *    paints its own personality on the button instead of every one looking
 *    the same violet pill
 *  - theme-secondary leading sparkle + soft theme-coloured glow that
 *    breathes — gives the action a "premium artifact" feel matching the
 *    moment (the player just won/finished a tournament)
 *  - headline font + slight tracking, so the typography also follows the
 *    active palette's identity (cinzel for Eclipse, bebas for Rust,
 *    orbitron for Storm, etc.)
 */
function FloatingNewRunButton({ onClick }: { onClick: () => void }) {
  return createPortal(
    <button
      onClick={onClick}
      aria-label="Lancer un nouveau tournoi"
      title="Lancer un nouveau tournoi"
      className="
        fixed z-30 group
        top-[max(var(--sai-top),32px)]
        right-[max(var(--sai-right),12px)]
        md:top-3
        md:right-3
        h-11 px-4 rounded-2xl
        flex items-center gap-2
        text-white font-black text-sm uppercase
        transition active:scale-95 hover:scale-[1.03]
        overflow-hidden
      "
      style={{
        fontFamily: "var(--font-headline)",
        letterSpacing: "0.08em",
        background:
          "linear-gradient(135deg, " +
          "color-mix(in oklab, var(--theme-primary) 38%, rgba(12,14,22,0.86)) 0%, " +
          "color-mix(in oklab, var(--theme-secondary) 28%, rgba(12,14,22,0.86)) 100%)",
        boxShadow:
          "inset 0 0 0 1px color-mix(in oklab, var(--theme-primary) 65%, transparent)," +
          "inset 0 1px 0 rgba(255,255,255,0.18)," +
          "0 10px 28px -10px color-mix(in oklab, var(--theme-primary) 70%, transparent)",
      }}
    >
      {/* Slow sheen sweep — theme-secondary tinted, gives the button its
          "alive" feel without burning CPU (single linear-gradient + CSS
          keyframe). Sits behind the label so it never washes the text. */}
      <span
        aria-hidden
        className="absolute inset-y-0 -left-1/2 w-1/2 pointer-events-none"
        style={{
          background:
            "linear-gradient(105deg, transparent, color-mix(in oklab, var(--theme-secondary) 45%, transparent), transparent)",
          animation: "fnrb-sheen 3.2s ease-in-out infinite",
        }}
      />
      {/* Leading sparkle — theme-secondary, breathes in opacity */}
      <svg
        width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.2"
        strokeLinecap="round" strokeLinejoin="round"
        className="relative shrink-0"
        style={{
          color: "color-mix(in oklab, var(--theme-secondary) 80%, white)",
          filter: "drop-shadow(0 0 6px color-mix(in oklab, var(--theme-secondary) 55%, transparent))",
          animation: "fnrb-pulse 2.4s ease-in-out infinite",
        }}
      >
        <path d="M12 2l2.39 5.79L20 8.7l-4.5 3.9L17 18.5 12 15.27 7 18.5l1.5-5.9L4 8.7l5.61-.91L12 2z" />
      </svg>
      <span className="relative">Nouveau tournoi</span>
    </button>,
    document.body,
  );
}

// Single keyframe stylesheet for the floating-new-run button. Reused across
// every instance so we don't insert it more than once. Pure CSS, runs on
// the compositor so it never burns a thread.
if (typeof document !== "undefined" && !document.getElementById("fnrb-keyframes")) {
  const style = document.createElement("style");
  style.id = "fnrb-keyframes";
  style.textContent = [
    "@keyframes fnrb-sheen { 0% { transform: translateX(-30%); } 60% { transform: translateX(280%); } 100% { transform: translateX(280%); } }",
    "@keyframes fnrb-pulse { 0%, 100% { opacity: 0.75; transform: rotate(0); } 50% { opacity: 1; transform: rotate(8deg); } }",
  ].join(" ");
  document.head.appendChild(style);
}
