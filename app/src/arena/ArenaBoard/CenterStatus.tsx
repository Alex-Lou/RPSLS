/**
 * CenterStatus — unified phase/event bar at the center of the board, between
 * the two lane rows (+ its Chip / IntentChips helpers). Extrait verbatim de
 * ArenaBoard. FIXED HEIGHT : les variations de contenu (1 vs 2 lignes) ne
 * bougent JAMAIS le layout (pad stable).
 */

import { AnimatePresence, motion } from "motion/react";
import { useT } from "../../i18n";
import { CARDS } from "../../ranked/cards";
import { arenaCardDescKey } from "../arenaTypes";
import type { TurnIntent } from "../arenaTypes";
import type { ArenaBoardProps } from "./ArenaBoard";

/** Center status zone — UNIFIED replacement for the old (PhaseBanner +
 *  OppRevealBanner × 2) stack. ONE element at the center between the two
 *  rows. CRITICAL: this container has a FIXED HEIGHT — content variations
 *  (1 line idle vs 2 lines reveal) NEVER change the layout. The chip is
 *  vertically centered; reveal-mode intent chips render as an absolute
 *  overlay below the chip so they don't push the rows around. This is
 *  what makes the pad "stable" like the Ranked LanesBoard. */
export function CenterStatus({
  step, turn, oppPreview, playerPreview,
}: {
  step: ArenaBoardProps["resolveStep"];
  turn: number;
  oppPreview: TurnIntent | null | undefined;
  playerPreview: TurnIntent | null | undefined;
}) {
  // Combat label no longer says "Lane N" — the per-lane halo + charge anim
  // already tells the eye which lane is live. Less text-clutter at center.
  const label =
    step === "reveal-opp" ? "Adversaire dévoile son tour" :
    step === "spells"  ? "✨ Sorts en cours" :
    step === "summons" ? "🌟 Invocations" :
    step === "combat"  ? "⚔️ Combat" :
    step === "settle"  ? "Fin du tour…" :
    // "· Premier à 0 ❤" seulement au 1er tour (Alex 2026-06-11) : rappel une
    // fois suffit, après c'est juste "Tour N".
    (turn <= 1 ? "Tour " + turn + " · Premier à 0 ❤" : "Tour " + turn);
  const tone: ChipTone =
    step === "reveal-opp" ? "rose" :
    step === "spells"  ? "fuchsia" :
    step === "summons" ? "emerald" :
    step === "combat"  ? "amber"   :
    step === "settle"  ? "zinc"    :
    "sky";
  const showOverlayChips = step === "reveal-opp" && (oppPreview || playerPreview);
  // Centrage du bloc central (Alex 2026-06-12) : la bulle de message est
  // centrée dans la zone h-7, mais les chip queues s'affichent SOUS elle
  // (top-full) → le centre de gravité visuel du combo (bulle + queues)
  // tombe trop bas. Quand des queues sont présentes, on remonte TOUT le bloc
  // (~11px) via un transform (pas de reflow → pad stable). Message seul =
  // reste pile au centre.
  return (
    <div
      className="relative h-7 flex items-center justify-center transition-transform duration-300 ease-out"
      style={{ transform: showOverlayChips ? "translateY(-11px)" : "translateY(0)" }}
    >
      <Chip label={label} tone={tone} stepKey={step ?? "planning"} />
      {/* Intent chips overlay during reveal — absolute so the row swap
       *  doesn't change the board's measured height. */}
      <AnimatePresence>
        {showOverlayChips && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="absolute left-0 right-0 top-full mt-0.5 z-20 flex flex-wrap items-center justify-center gap-1.5 pointer-events-none px-2"
          >
            {playerPreview && <IntentChips intent={playerPreview} side="you" />}
            {oppPreview && <IntentChips intent={oppPreview} side="opp" />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type ChipTone = "rose" | "fuchsia" | "emerald" | "amber" | "zinc" | "sky";
function Chip({ label, tone, stepKey }: { label: string; tone: ChipTone; stepKey?: string }) {
  const toneCls =
    tone === "rose"    ? "from-rose-500/30 to-rose-600/20 border-rose-400/50 text-rose-100" :
    tone === "fuchsia" ? "from-fuchsia-500/30 to-violet-600/20 border-fuchsia-400/50 text-fuchsia-100" :
    tone === "emerald" ? "from-emerald-500/30 to-teal-600/20 border-emerald-400/50 text-emerald-100" :
    tone === "amber"   ? "from-amber-500/30 to-orange-600/20 border-amber-400/50 text-amber-100" :
    tone === "zinc"    ? "from-zinc-500/30 to-zinc-700/20 border-zinc-400/50 text-zinc-100" :
                         "from-sky-500/20 to-cyan-600/15 border-sky-400/40 text-sky-100";
  return (
    <motion.div
      key={stepKey ?? label}
      initial={{ opacity: 0, y: -4, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25 }}
      className={"px-3 py-1 rounded-full bg-gradient-to-r border text-[11px] uppercase tracking-[0.18em] font-black shadow " + toneCls}
    >
      {label}
    </motion.div>
  );
}

/** Intent chips — compact list of summons + spells one side committed. */
function IntentChips({ intent, side }: { intent: TurnIntent; side: "you" | "opp" }) {
  const t = useT();
  const summonTone = side === "you"
    ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-100"
    : "bg-rose-500/20 border-rose-400/50 text-rose-100";
  // Summon chips RETIRÉS (Alex 2026-06-11) : redondants — les créatures sont
  // déjà visibles sur les lanes, pas besoin de chips "L1/L2/L3" en plus. On
  // ne garde que les chips de SORTS (info utile : quel sort a été joué).
  void summonTone;
  if (intent.spells.length === 0) return null;
  return (
    <>
      {intent.spells.map((s, i) => {
        const card = CARDS[s.id];
        const laneSuffix = s.kind === "lane" ? ` L${s.lane + 1}` : "";
        return (
          <span
            key={`${side}-sp-${i}`}
            className="inline-flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5 bg-fuchsia-500/20 border border-fuchsia-400/50 text-fuchsia-100"
            title={t(arenaCardDescKey(s.id))}
          >
            <span>{card.glyph}</span>
            <span>{t(card.nameKey)}{laneSuffix}</span>
          </span>
        );
      })}
    </>
  );
}
