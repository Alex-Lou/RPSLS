/**
 * TournamentPodium — celebratory end-of-tournament screen.
 *
 * Shows a 2-1-3 podium (medals, crown for the champion, confetti), the XP
 * placement reward for each spot, and the full final standings with the
 * player's own row highlighted. Awards the player's placement bonus once.
 */

import { useEffect, useMemo, useRef } from "react";
import { motion } from "motion/react";
import { useT } from "../i18n";
import { useStore } from "../store";
import { avatarImgStyle } from "../avatar";
import { CelebrationBurst } from "../sharedMatchUI";
import { tournamentStandings, type Standing, type TournamentState } from "./TournamentBracket";

const isImg = (a: string) => /^(data:|\/|https?:)/.test(a);

function Avatar({ avatar, size }: { avatar: string; size: number }) {
  return (
    <span
      className="rounded-full overflow-hidden flex items-center justify-center bg-zinc-900/70 ring-1 ring-white/15 shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.55 }}
    >
      {isImg(avatar)
        ? <img src={avatar} alt="" className="w-full h-full object-cover" style={avatarImgStyle(avatar)} />
        : <span>{avatar}</span>}
    </span>
  );
}

const PODIUM_STYLE: Record<number, { medal: string; grad: string; bar: string; h: number; av: number; delay: number }> = {
  1: { medal: "🥇", grad: "from-yellow-300 to-amber-500", bar: "from-amber-400/80 to-yellow-600/40", h: 96, av: 68, delay: 0.15 },
  2: { medal: "🥈", grad: "from-zinc-200 to-slate-400",   bar: "from-slate-300/70 to-slate-500/30", h: 64, av: 54, delay: 0.35 },
  3: { medal: "🥉", grad: "from-amber-600 to-orange-700", bar: "from-orange-500/70 to-amber-700/30", h: 48, av: 54, delay: 0.5 },
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
      <div className="text-base leading-none">{st.medal}</div>
      <div className={"text-xs font-bold truncate max-w-[8rem] text-center " + (you ? "text-white" : "text-zinc-200")}>
        {s.player.name}{you ? " (toi)" : ""}
      </div>
      <div className="text-[10px] text-zinc-500">Niv. {s.player.level}</div>
      <div className="text-[11px] font-black text-emerald-300">+{s.reward} XP</div>
      {/* Pedestal bar */}
      <motion.div
        initial={{ height: 0 }}
        animate={{ height: st.h }}
        transition={{ delay: st.delay + 0.1, type: "spring", stiffness: 160, damping: 20 }}
        className={"w-full max-w-[6.5rem] rounded-t-xl bg-gradient-to-b border-t border-white/20 flex items-start justify-center pt-1 " + st.bar}
      >
        <span className={"text-2xl font-black bg-gradient-to-br bg-clip-text text-transparent " + st.grad}>{s.place}</span>
      </motion.div>
    </motion.div>
  );
}

export function TournamentPodium({
  tournament, onContinue,
}: {
  tournament: TournamentState;
  onContinue: () => void;
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
      className="relative flex flex-col items-center gap-3 flex-1 min-h-0 overflow-y-auto py-3 px-2 w-full max-w-md mx-auto"
    >
      <CelebrationBurst variant="fire" />

      <div className="text-center shrink-0">
        <div className="text-[11px] uppercase tracking-[0.35em] text-zinc-500">Tournoi terminé</div>
        <h1 className="text-2xl sm:text-3xl font-black text-themed leading-tight" style={{ fontFamily: "var(--font-headline)" }}>
          {you?.place === 1 ? "🏆 Tu es Champion !" : `${tournament.champion?.name ?? "—"} remporte le tournoi`}
        </h1>
      </div>

      {/* Podium 2-1-3 */}
      <div className="flex items-end justify-center gap-2 w-full px-1 mt-1">
        {order.map((s) => <PodiumBlock key={s.player.id} s={s} you={!!s.player.isYou} />)}
      </div>

      {/* Full standings */}
      {rest.length > 0 && (
        <div className="w-full mt-1 rounded-2xl bg-zinc-950/50 border border-white/10 divide-y divide-white/5">
          {rest.map((s) => (
            <div
              key={s.player.id}
              className={"flex items-center gap-3 px-3 py-2 " + (s.player.isYou ? "bg-white/[0.07]" : "")}
              style={s.player.isYou ? { boxShadow: "inset 3px 0 0 var(--theme-primary)" } : undefined}
            >
              <span className="w-6 text-center text-sm font-bold text-zinc-500 tabular-nums">{s.place}</span>
              <Avatar avatar={s.player.avatar} size={28} />
              <span className={"flex-1 min-w-0 truncate text-sm " + (s.player.isYou ? "text-white font-semibold" : "text-zinc-300")}>
                {s.player.name}{s.player.isYou ? " (toi)" : ""}
              </span>
              <span className="text-[10px] text-zinc-500">Niv. {s.player.level}</span>
              <span className="text-[11px] font-bold text-emerald-300/90">+{s.reward}</span>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={onContinue}
        className="shrink-0 mt-2 w-full max-w-xs px-7 py-3 rounded-2xl font-bold text-white bg-themed shadow-lg shadow-violet-500/30 transition hover:scale-[1.02]"
        style={{ fontFamily: "var(--font-headline)", letterSpacing: "0.04em" }}
      >
        {t("lanes.backToMenu")}
      </button>
    </motion.div>
  );
}
