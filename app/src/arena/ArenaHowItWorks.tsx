/**
 * ArenaHowItWorks — fullscreen modal explaining the Constellation Pro
 * fundamentals so the player doesn't have to guess WHY damage didn't
 * land or WHY a card can't be cast on a given lane.
 *
 * Opened from the "?" button in the plan phase. Closed by the X or
 * tapping the backdrop. Keeps the explanations short, with iconography
 * matching what the game actually shows on the board.
 */

import { createPortal } from "react-dom";
import { motion } from "motion/react";

export function ArenaHowItWorks({ onClose }: { onClose: () => void }) {
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-2xl bg-zinc-950 border border-emerald-700/40 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-base font-black uppercase tracking-wider text-emerald-300">
            🃏 Comment ça marche?
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-bold flex items-center justify-center"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>
        <div className="p-4 space-y-4 text-sm text-zinc-200">
          <Section title="🎯 Objectif" body="Premier joueur à amener le héros adverse à 0 ❤ gagne. Tu commences à 20 ❤." />
          <Section
            title="🔄 Comment se déroule UN TOUR"
            body=""
            sub={[
              "1. Tu reçois +1 max-mana (tour N a N max-mana, jusqu'à 10). Ta mana se REMPLIT.",
              "2. Tu pioches 1 carte (l'opp aussi, en parallèle).",
              "3. Tu PLANIFIES en même temps que l'opp (pas de tour-par-tour Hearthstone — vous jouez SIMULTANÉMENT).",
              "4. Tu peux: tape un coup RPSLS pour invoquer (1 mana, sur ta lane vide), tape une carte pour la jouer (coût variable, vise selon le type).",
              "5. Tape ✓ FIN DE TOUR. L'opp lock aussi.",
              "6. Résolution: SORTS (les 2 côtés) → SUMMONS → COMBAT lane 1 → lane 2 → lane 3.",
              "7. Combat: 2 créatures face à face = elles s'entre-tapent (ATK vs HP, +1 si counter RPSLS). UNE seule créature face à une lane vide opp = elle FRAPPE LE HÉROS OPP direct.",
              "8. Tour suivant. Pas de limite de tour (sauf sudden death au tour 30).",
            ]}
          />
          <Section
            title="💥 Exemple concret"
            body="Tour 3: tu as 3 mana. Tu invoques un Scissors (1m, ATK 4 HP 1) dans la lane 3 + tu joues Surge (1m, +3 ATK ce tour) dessus. Opp ne défend pas la lane 3 → ton Scissors (4+3=7 ATK) tape le héros opp pour -7 HP."
          />
          <Section title="⋙ Mana" body="1 mana au tour 1, +1 chaque tour jusqu'à 10. Tes coups RPSLS coûtent 1 mana, tes sorts ont leur propre coût (1-4 mana)." />
          <Section title="🪨 Créatures qui RESTENT sur les lanes" body="Quand tu invoques un coup RPSLS, la créature PERSISTE sur sa lane d'un tour à l'autre — elle garde ses blessures, ses buffs, son shield. Elle ne disparaît QUE si ses HP tombent à 0 (animation rose qui éclate)." />
          <Section title="⚔️ Combat à chaque fin de tour" body="Si deux créatures sont face à face sur une même lane: elles se frappent simultanément (ATK contre HP). Counter RPSLS = +1 ATK bonus (rock bat scissors, etc.). Si UNE seule créature est sur la lane (l'autre lane libre): elle frappe directement le héros adverse." />
          <Section
            title="🛡️ Pourquoi certains coups passent à TRAVERS"
            body=""
            sub={[
              "🛡️ Bouclier divin (Aegis): la prochaine attaque est ENTIÈREMENT absorbée puis le shield disparaît.",
              "⚓ Ancré (Anchor): la créature est immunisée aux SORTS adverses ce tour (mais pas au combat).",
              "🪨 Provocation (Rock par défaut): force l'opp à frapper TA créature au lieu de ton héros — l'attaque \"undefended\" est déviée.",
            ]}
          />
          <Section
            title="🎴 Cibles des cartes (chip dans le coin)"
            body=""
            sub={[
              "Aegis / Surge / Precision / Anchor / Riposte / Échappée → cible TA CRÉATURE",
              "Curse / Sangsue / Trou Noir → cible une CRÉATURE ADVERSE",
              "Mirror → ta lane VIDE face à une créature adverse (copie l'opp)",
              "Heist / Supernova → frappent directement le HÉROS adverse",
              "Tide / Oracle / Augur → effet GLOBAL, pas de cible à choisir",
            ]}
          />
          <Section title="✨ Lecture des badges" body="⚔ = ATK · ❤ = HP · les chips +N (vert) ou -N (rouge) en bas-gauche montrent les buffs/debuffs actifs. Les icônes en haut-droit montrent les status." />
          <Section title="💡 Astuce" body="Le CPU ne peut JAMAIS occuper toutes les lanes (cap à 2 créatures max). Garde un sort de dégât direct (Heist/Supernova) pour finir l'opp quand son board est plein." />
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

function Section({ title, body, sub }: { title: string; body: string; sub?: string[] }) {
  return (
    <div>
      <h3 className="text-[12px] font-black uppercase tracking-wider text-emerald-200/95 mb-1">{title}</h3>
      {body && <p className="text-[13px] leading-relaxed text-zinc-300">{body}</p>}
      {sub && (
        <ul className="mt-1 space-y-1">
          {sub.map((line, i) => (
            <li key={i} className="text-[12.5px] leading-relaxed text-zinc-300 pl-3 -indent-2">
              • {line}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
