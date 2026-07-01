/**
 * MatchPrepScreen — pre-match staging for a Constellation Ranked duel.
 *
 * Three jobs, all before the first round:
 *  1. Confirm your deck (mini read-only row + a "Gérer" shortcut).
 *  2. Quick-swap your battle pad on the spot (persists — "au cas où").
 *  3. Decide WHOSE theme + pad dresses the board for this match:
 *     - tap "Céder le terrain" to play on the opponent's arena, or
 *     - flip an animated coin and let fate decide.
 *
 * The winning side's `{ themeId, padId }` is handed back via `onReady` and
 * applied as a MATCH-SCOPED override (never persisted) by the caller.
 *
 * Two modes:
 *  - LOCAL (default, no `online` prop): the user controls the coin entirely.
 *    Tapping "Lancer la pièce" rolls a `Math.random()` and starts the flip
 *    animation. Used in the local tournament against an AI persona.
 *  - ONLINE (`online` prop set): both players must press "Je suis prêt"
 *    first. The counter ticks 0/2 → 1/2 → 2/2 as the server broadcasts
 *    `prep_ready_state`. When both are ready, the server rolls the coin
 *    server-side and sends `start_coin_flip { winner }`; the parent then
 *    sets `online.coinWinner`, which triggers the animation here with the
 *    authoritative result (never `Math.random()` locally — would desync
 *    the two clients). The parent navigates onward when `lanes_round_start`
 *    arrives; this screen never calls `onReady` in online mode.
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { BackgroundId, PadId, ThemeId } from "../../types";
import { THEMES } from "../../theme/theme";
import { useStore } from "../../store/store";
import { hapticTap, hapticMatchStart } from "../../haptic";
import { FloatingMatchBackButton, hapticTick } from "../../match/sharedMatchUI";
import type { Arena, OnlinePrep } from "./types";
import { Coin, FLIP_DURATION_MS } from "./Coin";
import { FighterCard } from "./FighterCard";
import { ReadyDot } from "./ReadyDot";

/** Wall-clock budget the SERVER gives both players to confirm — must stay in
 *  sync with `PREP_DEADLINE` in `crates/rpsls-server/src/lanes_engine.rs`. The
 *  countdown is purely informational (server is authoritative on timeout); a
 *  visible ticker prevents the player from sitting on the screen wondering
 *  if anything is happening. */
const PREP_BUDGET_MS = 30_000;

export function MatchPrepScreen({
  youName, youAvatar, youThemeId, youBackgroundId,
  oppName, oppAvatar, oppThemeId, oppPadId, oppBackgroundId,
  onReady, onBack, online,
}: {
  youName: string;
  youAvatar: string;
  youThemeId: ThemeId;
  /** Player's CURRENT backdrop — kept on screen when their side wins. */
  youBackgroundId: BackgroundId;
  oppName: string;
  oppAvatar: string;
  oppThemeId: ThemeId;
  oppPadId: PadId;
  /** Opponent's persona backdrop — applied to the whole duel when "opp" wins. */
  oppBackgroundId: BackgroundId;
  onReady: (arena: Arena) => void;
  onBack: () => void;
  /** When supplied, switches the screen into double-confirm + server-driven
   *  coin-flip mode. Omit for the local AI-tournament flow. */
  online?: OnlinePrep;
}) {
  // Deck is prepared earlier (in the ranked lobby), so this screen is just
  // the coin flip for the arena — no deck management here.
  const youPadId = useStore((s) => s.player.padId);

  // Coin state: idle → flipping → landed. `winner` is the resolved side.
  const [phase, setPhase] = useState<"idle" | "flipping" | "landed">("idle");
  const [winner, setWinner] = useState<"you" | "opp" | null>(null);

  const youTheme = THEMES[youThemeId];
  const oppTheme = THEMES[oppThemeId];

  const isOnline = !!online;
  const readyCount = isOnline ? (online!.youReady ? 1 : 0) + (online!.oppReady ? 1 : 0) : 0;

  // Visible 30s prep countdown — wakes the player up before the server
  // timeout kicks in. Starts at component mount (= when lanes_match_found
  // landed) and stops once the coin is flipping/landed (timeout no longer
  // applicable). Server timestamp would be more accurate, but adding it
  // to the wire just to drive a UI ticker is overkill — a tiny start-time
  // skew is invisible at 1-second resolution.
  const prepStartRef = useRef<number>(0);
  if (prepStartRef.current === 0) prepStartRef.current = Date.now();
  const [prepRemainingMs, setPrepRemainingMs] = useState<number>(PREP_BUDGET_MS);
  useEffect(() => {
    if (!isOnline) return;
    if (phase !== "idle") return;
    const tick = () => {
      const elapsed = Date.now() - prepStartRef.current;
      setPrepRemainingMs(Math.max(0, PREP_BUDGET_MS - elapsed));
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [isOnline, phase]);
  const prepSecondsLeft = Math.ceil(prepRemainingMs / 1000);
  const prepUrgent = prepSecondsLeft <= 10;

  // Track the in-flight timers so they get cancelled on unmount and on a
  // fresh flip(). The previous version returned a cleanup function from
  // flip() — but flip() is a click handler, not a useEffect, so React threw
  // it away. Timers kept firing after unmount, leaking haptics + setState
  // warnings into the next screen.
  const flipTimersRef = useRef<number[]>([]);
  const clearFlipTimers = () => {
    for (const id of flipTimersRef.current) window.clearTimeout(id);
    flipTimersRef.current = [];
  };
  useEffect(() => () => clearFlipTimers(), []);

  /** Shared animation driver. Local mode rolls the result; online mode is
   *  handed an authoritative result from the server. */
  function startFlip(result: "you" | "opp") {
    clearFlipTimers();
    hapticTick();
    setWinner(result);
    setPhase("flipping");
    // Snappier toss — 1.6s feels punchy without dragging. One mid-toss tick
    // is enough; the previous two-tick rhythm at 2.6s read as filler.
    const t1 = window.setTimeout(() => hapticTick(), 600);
    const t2 = window.setTimeout(() => {
      hapticMatchStart();
      setPhase("landed");
    }, FLIP_DURATION_MS);
    flipTimersRef.current = [t1, t2];
  }

  function flip() {
    if (phase === "flipping") return;
    startFlip(Math.random() < 0.5 ? "you" : "opp");
  }

  function concede() {
    hapticTick();
    setWinner("opp");
    setPhase("landed");
  }

  // Online mode: kick off the local animation when the server tells us who
  // won. Guard on `phase === "idle"` so a late re-render with the same coin
  // result doesn't restart the animation mid-flight.
  useEffect(() => {
    if (!isOnline) return;
    const w = online!.coinWinner;
    if (w && phase === "idle") startFlip(w);
  }, [isOnline, online?.coinWinner, phase]);

  function start() {
    hapticTap();
    const side = winner ?? "you";
    onReady(
      side === "you"
        ? { side: "you", themeId: youThemeId, padId: youPadId, backgroundId: youBackgroundId }
        : { side: "opp", themeId: oppThemeId, padId: oppPadId, backgroundId: oppBackgroundId },
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-3 landscape:gap-2 flex-1 min-h-0 py-2 px-3 max-w-md landscape:max-w-2xl mx-auto w-full justify-center"
    >
      <FloatingMatchBackButton onClick={onBack} label="Retour" />

      <div className="text-center shrink-0">
        <h1
          className="text-xl sm:text-2xl landscape:text-lg font-extrabold text-themed leading-tight"
          style={{ fontFamily: "var(--font-headline)" }}
        >
          Préparation du duel
        </h1>
      </div>

      {/* VS — you vs opponent, each with avatar + theme swatch. */}
      <div className="flex items-stretch gap-2">
        <FighterCard name={youName} avatar={youAvatar} theme={youTheme} tag="Toi" highlight={winner === "you"} />
        <div className="shrink-0 flex items-center text-lg font-black text-ink-faint">VS</div>
        <FighterCard name={oppName} avatar={oppAvatar} theme={oppTheme} tag="Adv." highlight={winner === "opp"} />
      </div>

      {/* Coin flip — the centrepiece. En paysage : padding/gap resserrés pour
       *  que la colonne (titre + VS + pièce + actions) rentre sans déborder. */}
      <div className="rounded-2xl bg-surface-raised border border-hairline p-3 landscape:py-2 flex flex-col items-center gap-2.5 landscape:gap-1.5">
        <div className="text-[10px] uppercase tracking-[0.25em] font-bold text-ink-muted text-center">
          À qui le terrain ?
        </div>

        {/* Pièce TAPPABLE comme en Constellation Pro (Alex 2026-07) : en local on
         *  touche la pièce pour lancer (fini le bouton « Lancer la pièce »). En
         *  online la pièce reste pilotée par le serveur → non tappable. */}
        {isOnline ? (
          <Coin phase={phase} winner={winner} youTheme={youTheme} oppTheme={oppTheme} />
        ) : (
          <button
            onClick={flip}
            disabled={phase !== "idle"}
            aria-label="Lancer la pièce"
            className="shrink-0 bg-transparent border-0 p-0 disabled:cursor-default"
          >
            <Coin phase={phase} winner={winner} youTheme={youTheme} oppTheme={oppTheme} />
          </button>
        )}

        <AnimatePresence mode="wait">
          {phase === "landed" && winner ? (
            <motion.div
              key="verdict"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="text-sm font-black" style={{ color: winner === "you" ? "var(--theme-primary)" : oppTheme.primary }}>
                {winner === "you" ? "Ton terrain l'emporte" : `Terrain de ${oppName}`}
              </div>
              <div className="text-[11px] text-ink-faint mt-0.5">
                {winner === "you"
                  ? "Tes couleurs et ton pad habillent le duel."
                  : "Tu joues sur le terrain adverse — adapte-toi."}
              </div>
              {/* Local mode: the "AI" is implicitly ready; online mode: we
                  already know the opponent confirmed (otherwise the coin
                  wouldn't have flipped). Either way, a discreet ✓ line. */}
              <div className="text-[10px] text-emerald-300 font-bold mt-1">✓ {oppName} est prêt</div>
            </motion.div>
          ) : isOnline ? (
            // Online prep idle/flipping hint: explain the gate to the user
            // ("waiting on the other side") rather than the abstract coin.
            <div key="online-hint" className="text-center">
              <p className="text-[11px] text-ink-faint max-w-xs">
                {phase === "flipping"
                  ? "La pièce tourne…"
                  : !online!.connectionAlive
                    ? "Connexion perdue — reprise en cours…"
                    : online!.youReady && !online!.oppReady
                      ? `En attente de ${oppName}…`
                      : online!.oppReady && !online!.youReady
                        ? `${oppName} est prêt — confirme pour lancer la pièce.`
                        : "Confirmez tous les deux pour lancer la pièce du terrain."}
              </p>
              {/* 0/2 → 1/2 → 2/2 — the actual "double confirm" UI. */}
              <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/30 border border-white/10">
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-ink-muted">Prêts</span>
                <span
                  className="text-[12px] font-black tabular-nums"
                  style={{ color: readyCount === 2 ? "var(--theme-primary)" : undefined }}
                >
                  {readyCount}/2
                </span>
                <span className="flex items-center gap-1 ml-0.5">
                  <ReadyDot on={online!.youReady} label="Toi" />
                  <ReadyDot on={online!.oppReady} label={oppName} />
                </span>
              </div>
              {/* 30s budget ticker — purely informational; the server is
                  authoritative on the actual timeout. Becomes urgent (rose)
                  in the last 10s so the player can react before forfeit. */}
              {phase === "idle" && (
                <div
                  className={
                    "mt-1.5 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] font-bold tabular-nums " +
                    (prepUrgent ? "text-rose-300" : "text-ink-faint")
                  }
                >
                  <span>⏱</span>
                  <span>{prepSecondsLeft}s</span>
                </div>
              )}
            </div>
          ) : (
            <p key="hint" className="text-[11px] text-ink-faint text-center max-w-xs">
              {phase === "flipping"
                ? "La pièce tourne…"
                : "🪙 Touche la pièce — elle décide quel thème + pad habille le plateau."}
            </p>
          )}
        </AnimatePresence>

        {isOnline ? (
          phase !== "landed" ? (
            // Online mode: one button only — "Je suis prêt". The coin is
            // server-driven, so no local trigger. Tap is idempotent on the
            // server; we disable the button locally for UX clarity AND when
            // the WebSocket is reconnecting, so the user sees the connection
            // state instead of a silent enqueue into the offline buffer.
            <div className="flex flex-col items-center gap-2 w-full">
              <motion.button
                whileTap={{ scale: online!.youReady || !online!.connectionAlive ? 1 : 0.96 }}
                onClick={() => {
                  if (online!.youReady || phase === "flipping" || !online!.connectionAlive) return;
                  hapticTap();
                  online!.onReady();
                }}
                disabled={online!.youReady || phase === "flipping" || !online!.connectionAlive}
                className="w-full max-w-xs py-3 rounded-2xl font-bold text-white bg-themed shadow-lg disabled:opacity-60"
                style={{ fontFamily: "var(--font-headline)", letterSpacing: "0.04em" }}
              >
                {phase === "flipping"
                  ? "La pièce tourne…"
                  : !online!.connectionAlive
                    ? "⏳ Reconnexion…"
                    : online!.youReady
                      ? "✓ Prêt — en attente de l'adversaire"
                      : "Je suis prêt"}
              </motion.button>
            </div>
          ) : (
            // Online mode after the coin lands: parent navigates onward when
            // `lanes_round_start` arrives. Show a holding hint so the user
            // understands the wait is intentional (~3s, matches server pause).
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[11px] font-bold text-ink-muted text-center"
            >
              Le duel commence…
            </motion.div>
          )
        ) : (
          // LOCAL — calqué sur le Pré-match Constellation Pro (Alex 2026-07) :
          // UN SEUL bouton COMMENCER, grisé (désactivé) tant que la pièce n'a pas
          // atterri, puis dégradé thémé + activable — TAILLE STRICTEMENT CONSTANTE
          // (px-4 py-2, jamais de changement d'échelle). Fini les 2 boutons
          // « Lancer la pièce » (py-3) → « Commencer le duel » (py-3.5) qui
          // changeaient de taille. « Céder le terrain » reste en lien discret tant
          // qu'on n'a pas encore décidé (idle).
          <div className="flex flex-col items-center gap-2 w-full">
            <button
              onClick={start}
              disabled={phase !== "landed"}
              className={
                "shrink-0 px-4 py-2 rounded-xl font-black text-white text-sm whitespace-nowrap transition " +
                (phase === "landed" ? "shadow-lg" : "bg-zinc-800 text-zinc-500 cursor-not-allowed")
              }
              // TAILLE STRICTEMENT CONSTANTE (Alex 2026-07) : le GRIS est la « bonne
              // taille » de référence. On NE change QUE fond + ombre au « landed ».
              // fontFamily/letterSpacing RETIRÉS (ils n'étaient au landed que → texte
              // élargi → bouton auto-width grandi). Le bleu = taille EXACTE du gris.
              style={phase === "landed" ? {
                background: "linear-gradient(to right, var(--theme-primary), var(--theme-secondary))",
                boxShadow: "0 4px 18px -4px color-mix(in oklab, var(--theme-primary) 60%, transparent)",
              } : undefined}
            >
              ✓ COMMENCER LE MATCH
            </button>
            {phase === "idle" && (
              <button
                onClick={concede}
                className="text-[11px] font-bold text-ink-muted hover:text-white transition"
              >
                Céder le terrain à l'adversaire
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
