/**
 * Cadre de Voie + badges de CreatureSlot (extraits pour le cap <400 lignes) :
 * - VOIE_FRAME           : identité de Voie sur le cadre (statique).
 * - CreatureStatsBar     : mini-barre de PV + badges ATK / PV (bas de case).
 * - CreaturePassiveBadges: badges passifs innés + statuts de sort (haut-droite).
 * Rendus en place, ordre DOM d'origine conservé.
 */

import { motion } from "motion/react";
import type { Creature } from "../arenaTypes";
import { useT } from "../../i18n";

/** Identité de Voie sur le CADRE de la créature (statique, gratuit, derrière le
 *  contenu). 1 entrée par move ayant une Voie thématisée → DRY pour la
 *  réplication (Montagne/Mirage… puis Cosmos/Tranchant/Forêt). Réversible. */
export const VOIE_FRAME: Partial<Record<Creature["move"], { bg: string; shadow: string }>> = {
  // ⛰ Montagne — granite gris-pierre.
  rock: {
    bg: "linear-gradient(150deg, rgba(168,162,158,0.20), rgba(68,64,60,0.10) 55%, transparent)",
    shadow: "inset 0 0 0 1px rgba(214,211,209,0.35), inset 0 0 14px rgba(68,64,60,0.40)",
  },
  // 🎭 Mirage — voile iridescent indigo↔cyan.
  lizard: {
    bg: "linear-gradient(150deg, rgba(129,140,248,0.18), rgba(34,211,238,0.10) 55%, transparent)",
    shadow: "inset 0 0 0 1px rgba(165,180,252,0.35), inset 0 0 14px rgba(99,102,241,0.35)",
  },
  // ⚔️ Tranchant — acier froid + rose-cardinal.
  scissors: {
    bg: "linear-gradient(150deg, rgba(244,63,94,0.16), rgba(148,163,184,0.10) 55%, transparent)",
    shadow: "inset 0 0 0 1px rgba(254,205,211,0.35), inset 0 0 14px rgba(225,29,72,0.30)",
  },
  // 🌲 Forêt — émeraude vivante + sève dorée.
  paper: {
    bg: "linear-gradient(150deg, rgba(52,211,153,0.18), rgba(16,122,87,0.10) 55%, transparent)",
    shadow: "inset 0 0 0 1px rgba(167,243,208,0.35), inset 0 0 14px rgba(5,150,105,0.35)",
  },
  // 🌌 Cosmos — violet du vide + liseré cyan glacé.
  spock: {
    bg: "linear-gradient(150deg, rgba(139,92,246,0.18), rgba(34,211,238,0.08) 55%, transparent)",
    shadow: "inset 0 0 0 1px rgba(196,181,253,0.35), inset 0 0 14px rgba(124,58,237,0.35)",
  },
};

/** Mini-barre de PV + rangée ATK / PV en bas de la case. */
export function CreatureStatsBar({ creature, stats, atk, atkReduced, lowHp }: {
  creature: Creature;
  stats: { hp: number };
  atk: number;
  atkReduced: boolean;
  lowHp: boolean;
}) {
  const t = useT();
  return (
    <>
      {/* ATK and HP corner badges + a MINI HP BAR at the very bottom edge
       *  of the slot that animates fill width on damage/heal — Alex
       *  feedback : "je vois pas les pv de chaque move descendre",
       *  the chip alone wasn't read as a status indicator. */}
      <div className="absolute bottom-0 left-0 right-0 flex flex-col gap-0">
        {/* HP bar — sits above the badges. Fills + colour changes by
         *  threshold (green > 50%, amber > 25%, rose otherwise). The
         *  width animates so a hit is OBVIOUS, not just a number flip. */}
        <div className="mx-1 mb-0.5 h-1.5 rounded-full bg-black/65 overflow-hidden ring-1 ring-black/40 shadow-inner">
          <motion.div
            className={
              "h-full rounded-full " +
              (creature.hp / stats.hp > 0.5
                ? "bg-gradient-to-r from-emerald-500 to-emerald-300"
                : creature.hp / stats.hp > 0.25
                ? "bg-gradient-to-r from-amber-500 to-amber-300"
                : "bg-gradient-to-r from-rose-600 to-rose-400")
            }
            initial={false}
            animate={{ width: `${Math.max(0, Math.min(100, (creature.hp / stats.hp) * 100))}%` }}
            transition={{ type: "spring", stiffness: 220, damping: 24 }}
          />
        </div>
        {/* Bottom row : ATK left + HP chip right. */}
        <div className="flex items-end justify-between px-1 pb-0.5">
          <span
            className={
              "inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-black leading-none tabular-nums shadow " +
              (atkReduced
                ? "bg-rose-600/90 text-rose-50"
                : "bg-amber-500/85 text-amber-50")
            }
            title={atkReduced ? t("arena.slot.atkReduced") : undefined}
          >
            ⚔ {atk}
            {atkReduced && <span className="text-[8px] opacity-95">↓</span>}
            {!atkReduced && creature.atkBuff > 0 && <span className="text-[7px] opacity-90">+{creature.atkBuff}</span>}
          </span>
          <motion.span
            key={creature.hp}
            initial={{ scale: 1.3, color: "#fda4af" }}
            animate={{ scale: 1, color: lowHp ? "#fb7185" : "#fee2e2" }}
            transition={{ duration: 0.3 }}
            className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-rose-600/85 text-[10px] font-black leading-none tabular-nums shadow"
          >
            ❤ {creature.hp}/{stats.hp}
          </motion.span>
        </div>
      </div>
    </>
  );
}

/** Badges passifs innés (Provoc, Étouffe, Tranchant, Esquive, Logique) + statuts. */
export function CreaturePassiveBadges({ creature, passiveSuppressed }: {
  creature: Creature;
  passiveSuppressed: boolean;
}) {
  const t = useT();
  return (
    <>
      {/* INNATE PASSIVE BADGE top-right — one per move, RPSLS identity.
       *  Pierre's Provocation can be suppressed by opp Étouffe (Feuille)
       *  in which case neither the badge nor the gold halo show, so the
       *  UI never lies about the live state of the passive. */}
      <div className="absolute top-1 right-1 flex items-center gap-0.5">
        {creature.taunt && !passiveSuppressed && creature.provocationCharges > 0 && (
          <span
            className="text-[9px] px-1 py-0.5 rounded bg-amber-400/95 text-black font-black tracking-wider shadow leading-none inline-flex items-center gap-0.5"
            title={t("arena.slot.taunt", { n: creature.provocationCharges })}
          >
            🛡{creature.provocationCharges > 1 ? <span className="text-[7px]">×{creature.provocationCharges}</span> : null}
          </span>
        )}
        {creature.move === "paper" && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-400/95 text-black font-black tracking-wider shadow leading-none" title={t("arena.slot.stifle")}>
            🌿
          </span>
        )}
        {creature.pierces && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-rose-400/95 text-black font-black tracking-wider shadow leading-none" title={t("arena.slot.pierce")}>
            ⚔
          </span>
        )}
        {creature.dodgeCharges > 0 && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-sky-400/95 text-black font-black tracking-wider shadow leading-none" title={t("arena.slot.dodge")}>
            ✨
          </span>
        )}
        {creature.spellImmune && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-violet-400/95 text-black font-black tracking-wider shadow leading-none" title={t("arena.slot.spellImmune")}>
            🧬
          </span>
        )}
        {/* Spell-granted statuses — secondary row of small emojis */}
        {creature.divineShield && <span className="text-[10px]" title={t("arena.slot.divineShield")}>🛡️</span>}
        {creature.anchored && <span className="text-[10px]" title={t("arena.slot.anchored")}>⚓</span>}
        {creature.ripostePrimed && <span className="text-[10px]" title={t("arena.slot.riposte")}>⚔️</span>}
      </div>
    </>
  );
}
