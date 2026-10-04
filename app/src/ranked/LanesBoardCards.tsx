import { motion } from "motion/react";
import { Hand, MoveGlyph } from "../icons";
import type { Move } from "../engine/game";
import { laneIdentityAt } from "../engine/lanesCombos";
import { CardSlot } from "./CardSlot";
import type { PlayedCard } from "./rankedTypes";
import { useT } from "../i18n";

/**
 * Pièces visuelles des lanes du LanesBoard (cartes face cachée / visible,
 * badges Crépuscule / Boussole, slot de lane) — extraites VERBATIM de LanesBoard.tsx.
 */

export const IDENTITY_KEYS = [
  "lanes.identity.force",
  "lanes.identity.wisdom",
  "lanes.identity.cunning",
];


export function FaceDownCard({ index: _index, pulsing: _pulsing, clickable = false, onClick, compassMarked = false, twilightMarked = false }: {
  index: number; pulsing: boolean; clickable?: boolean; onClick?: () => void;
  /** Boussole peek: opponent's card targets THIS lane → tint the placeholder
   *  cyan so the player's eye lands here before reading the ghost-card badge. */
  compassMarked?: boolean;
  /** Crépuscule: this lane is card-immune this round → amber tint reads "no
   *  card effects apply here, pure RPSLS". */
  twilightMarked?: boolean;
}) {
  // Static, solid card — no opacity pulse (that read as "unstable/random").
  // A clickable Augur target keeps a steady highlight instead of flickering.
  // Compass-marked lane gets a cyan tint that reads as "incoming danger".
  // Twilight gets an amber tint that reads as "sealed / immune".
  const cls =
    "aspect-square w-full rounded-xl border-2 flex items-center justify-center transition " +
    (clickable
      ? "border-violet-400/60 bg-violet-500/25 cursor-pointer hover:bg-violet-500/35 ring-2 ring-violet-400/40"
      : twilightMarked
      ? "border-amber-400/70 bg-amber-500/15 ring-2 ring-amber-300/40"
      : compassMarked
      ? "border-cyan-400/70 bg-cyan-500/20 ring-2 ring-cyan-300/50"
      : "border-dashed border-hairline bg-surface-2");
  const inner = (
    <div className={cls}>
      <span className={
        "text-3xl sm:text-4xl font-black " +
        (clickable ? "text-violet-300"
          : twilightMarked ? "text-amber-200/80"
          : compassMarked ? "text-cyan-200/80"
          : "text-zinc-600")
      }>
        {clickable ? "👁️" : "?"}
      </span>
    </div>
  );
  if (clickable) return <button onClick={onClick} className="w-full">{inner}</button>;
  return inner;
}

/** Crépuscule badge — small amber sun-sigil in the corner of the sealed lane.
 *  Pulses softly so the player feels the lane is "alive but neutral". */
export function TwilightBadge() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
      className="absolute -top-1 -left-1 z-20 pointer-events-none"
      aria-hidden
    >
      <motion.div
        initial={{ opacity: 0.3 }}
        animate={{ opacity: [0.3, 0.7, 0.3] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 rounded-md bg-amber-400/45 blur-md"
      />
      <div className="relative w-6 h-6 rounded-md bg-gradient-to-br from-amber-400/85 to-orange-700/85 border border-amber-300/70 shadow-lg shadow-amber-900/50 flex items-center justify-center">
        <span className="text-[12px] leading-none">🌅</span>
      </div>
    </motion.div>
  );
}

/** Boussole ghost card — a small cyan card silhouette in the top-right corner
 *  of the targeted opp lane. The compass icon + pulsing ring tell the player
 *  "an unknown card will hit THIS lane — react now (anchor/aegis/twilight)". */
export function CompassGhostCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.7 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className="absolute -top-1 -right-1 z-20 pointer-events-none"
      aria-hidden
    >
      {/* Pulsing aura behind the ghost card so it reads as "live, incoming". */}
      <motion.div
        initial={{ opacity: 0.3, scale: 0.9 }}
        animate={{ opacity: [0.3, 0.7, 0.3], scale: [0.9, 1.25, 0.9] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 rounded-md bg-cyan-400/45 blur-md"
      />
      <div className="relative w-7 h-9 sm:w-8 sm:h-10 rounded-md bg-gradient-to-br from-cyan-500/80 to-sky-700/80 border border-cyan-300/70 shadow-lg shadow-cyan-900/50 flex flex-col items-center justify-center gap-0.5">
        <span className="text-sm leading-none">🧭</span>
        <span className="text-[8px] sm:text-[9px] font-black leading-none text-white/95">?</span>
      </div>
    </motion.div>
  );
}

export function FaceUpOppCard({ move, verdict, revealed, preReveal }: {
  move: Move; verdict: "win" | "loss" | "draw" | null; revealed: boolean; preReveal: boolean;
}) {
  const ring =
    verdict === "win"  ? "ring-emerald-400/60" :
    verdict === "loss" ? "ring-rose-400/50"    :
    verdict === "draw" ? "ring-zinc-500/30"    :
    "ring-violet-400/70";
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7, rotateY: 90 }}
      animate={revealed ? { opacity: 1, scale: 1, rotateY: 0 } : { opacity: 0.3, scale: 0.85, rotateY: 90 }}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
      className={"aspect-square w-full rounded-xl ring-2 flex items-center justify-center " + ring + " " + (preReveal ? "bg-violet-500/20" : "bg-surface-2")}
      style={{ transformPerspective: 800 }}
    >
      <Hand move={move} size="md" emphasis={verdict === "win" ? "winner" : verdict === "loss" ? "loser" : "default"} />
    </motion.div>
  );
}

export function LaneSlot({ index, pick, favoured, verdict, cardHere, twilightMarked = false, onClick, disabled, targeting = false }: {
  index: number; pick: Move | null; favoured: boolean;
  verdict: "win" | "loss" | "draw" | null; cardHere: PlayedCard | null;
  /** Crépuscule: amber tint on this lane on the player's row. */
  twilightMarked?: boolean;
  onClick: () => void; disabled: boolean;
  /** Carte-lane sélectionnée → cette case peut l'accueillir : surlignage thème. */
  targeting?: boolean;
}) {
  const t = useT();
  const identity = laneIdentityAt(index);
  const idKey = IDENTITY_KEYS[identity.index];
  const title = t(`${idKey}.title`);
  const accent = identity.accent;
  const ringIdle = accent === "amber" ? "ring-amber-400/30" : accent === "sky" ? "ring-sky-400/30" : "ring-emerald-400/30";
  const ringFav = accent === "amber" ? "ring-amber-400/80" : accent === "sky" ? "ring-sky-400/80" : "ring-emerald-400/80";
  const accentText = accent === "amber" ? "text-amber-300" : accent === "sky" ? "text-sky-300" : "text-emerald-300";
  const verdictRing =
    verdict === "win" ? "ring-emerald-400/70" : verdict === "loss" ? "ring-rose-400/60" : verdict === "draw" ? "ring-zinc-500/40" : null;
  // Twilight overrides identity rings — the amber tint reads "card-immune zone".
  const twilightRing = twilightMarked ? "ring-amber-400/80" : null;
  const twilightSurface = twilightMarked ? "border-amber-400/60 bg-amber-500/15" : null;

  return (
    <div className={"flex flex-col items-center gap-1 " + (twilightMarked ? "relative" : "")}>
      <div className={"flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold " + accentText}>
        <span>{identity.glyph}</span>
        <span>{title}</span>
      </div>
      {/* Permanent hint: the moves this lane favours. Win the lane with one of
          them → +1 bonus. Shown as small glyphs so the rule is readable at a
          glance, no memorising needed. */}
      <div className="flex items-center gap-0.5 -mt-0.5 mb-0.5 opacity-60" aria-hidden title={t("ranked.lane.favouredMoves")}>
        {identity.favours.map((mv) => (
          <MoveGlyph key={mv} move={mv} className="w-3 h-3" />
        ))}
      </div>
      <button
        onClick={onClick}
        disabled={disabled}
        className={
          "aspect-square w-full rounded-xl border-2 transition flex items-center justify-center relative ring-2 " +
          (targeting
            ? "cursor-pointer border-transparent ring-transparent"
            : (verdictRing ?? twilightRing ?? (favoured ? ringFav : ringIdle)) + " " +
              (pick
                ? (twilightSurface ?? "border-emerald-400/50 bg-emerald-600/25")
                : (twilightSurface ?? "border-dashed border-hairline bg-surface-2")))
        }
        // Surlignage THÈME (Alex 2026-07) : case pouvant accueillir la carte-lane
        // sélectionnée. L'inline boxShadow remplace l'anneau Tailwind → glow thémé.
        style={targeting ? {
          borderColor: "color-mix(in oklab, var(--theme-primary) 75%, transparent)",
          background: "color-mix(in oklab, var(--theme-primary) 18%, rgba(10,12,20,0.5))",
          boxShadow: "0 0 0 2px color-mix(in oklab, var(--theme-primary) 60%, transparent), 0 0 20px -5px var(--theme-primary)",
        } : undefined}
      >
        {pick ? (
          <Hand move={pick} size="md" emphasis={verdict === "win" ? "winner" : verdict === "loss" ? "loser" : "default"} />
        ) : (
          <span className="text-3xl sm:text-4xl text-zinc-700 font-black">?</span>
        )}
        {cardHere && <CardSlot id={cardHere.id} position="br" />}
        {favoured && pick && !verdictRing && (
          <span className={
            "absolute -top-1.5 -right-1.5 px-1 py-0.5 rounded-full text-[8px] font-black text-zinc-900 shadow " +
            (accent === "amber" ? "bg-amber-300" : accent === "sky" ? "bg-sky-300" : "bg-emerald-300")
          }>✨</span>
        )}
        {twilightMarked && <TwilightBadge />}
      </button>
    </div>
  );
}

// BigCardReveal moved to its own file (ranked/BigCardReveal.tsx) so the
// Arena (Constellation Pro) can import and reuse the same animation.
