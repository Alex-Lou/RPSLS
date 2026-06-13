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
import { CREATURE_PASSIVES, CREATURE_STATS, MOVE_DESIGN_NOTES } from "./arenaTypes";
import type { Move } from "../engine/game";

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
        <div className="p-4 sm:p-5 space-y-5 text-[15px] text-zinc-100">
          <Section title="🎯 Objectif" body="Premier joueur à amener le héros adverse à 0 ❤ gagne. Tu commences à 20 ❤." />
          <Section
            title="🔄 Comment se déroule UN TOUR"
            body=""
            sub={[
              "1. Tu reçois +1 max-mana (tour N a N max-mana, jusqu'à 10). Ta mana se REMPLIT.",
              "2. Tu pioches 1 carte (l'opp aussi, en parallèle).",
              "3. Tu PLANIFIES en même temps que l'opp (vous jouez SIMULTANÉMENT — pas chacun son tour).",
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
          <Section
            title="⚔️ Combat — RPSLS-FIRST + POURSUITE + SAUVEGARDES"
            body=""
            sub={[
              "Deux créatures FACE À FACE : la règle RPSLS tranche. Le perdant MEURT INSTANT, le gagnant survit intact. Ciseau vs Pierre → Ciseau mort, Pierre intacte.",
              "POURSUITE : le gagnant ne s'arrête pas. Son ATK CONTINUE vers le HÉROS adverse. Spock 2 ATK bat Ciseau → Ciseau mort + 2 dégâts au héros opp. La défense Provocation Pierre (ailleurs) peut détourner cette poursuite.",
              "MÊME SYMBOLE des deux côtés (Pierre vs Pierre) : pas de winner RPSLS → échange ATK/HP normal (ils s'entre-tapent simultanément, pas de poursuite).",
              "UNE SEULE créature sur la lane (lane opp vide) : elle frappe directement le HÉROS opp pour son ATK… SAUF si la nature passive de l'opp annule (voir ↓).",
              "SAUVEGARDES (ordre priorité) : 1) ESQUIVE Lézard (charge consommée) annule mort + poursuite. 2) AEGIS Bouclier (sort) annule mort + poursuite — SAUF si l'attaquant est Ciseau (Tranchant perce Aegis et tue quand même). 3) Sinon : mort + poursuite normale.",
            ]}
          />
          {/* THE BIG ONE — single source of truth on les 5 passifs RPSLS.
           *  Replaces 3 scattered earlier sections. */}
          <PassiveGrid />
          <Section
            title="🪨 Et la chip 'Attaque détournée' alors ?"
            body="Quand l'attaque d'une créature adverse est annulée par TA Pierre (Provocation), tu vois pop la chip jaune 🪨 ATTAQUE DÉTOURNÉE ! au centre du board. C'est juste la confirmation visuelle que ton héros vient d'être sauvé. La pierre n'encaisse rien, l'attaque part simplement dans le vide. Pour casser cette protection: l'opp doit poser une Feuille (Étouffe) OU détruire ta Pierre en combat / par un sort."
          />
          <Section
            title="🚨 Pourquoi MA Pierre ne défend pas ?"
            body=""
            sub={[
              "Anti-taunt côté opp : si l'opp a une FEUILLE 📄 (Étouffe) ou un SPOCK 🖖 (Logique) vivant n'importe où sur son board, TA Pierre Provocation est CANCELLÉE. Toutes les attaques opp atteignent ton héros directement.",
              "Pierre déjà consommée : chaque Provoc a 2 charges max (1 base + 1 Voie Pierre). Une fois consommées → Pierre devient passive, aucune deflection.",
              "Pierre détruite : si ta Pierre est morte (combat counter ou Curse), pas de deflection (évidemment).",
              "Ta Pierre TOUTES les défend tant que les conditions sont remplies — peu importe ta Voie. Le label 'Voie de la Pierre' sur l'opp signifie juste qu'il a +1 charge initiale.",
            ]}
          />
          <Section
            title="🛡️ Sorts de défense (en plus des passifs)"
            body=""
            sub={[
              "🛡️ Bouclier divin (Aegis, sort): la prochaine attaque sur la cible est ENTIÈREMENT absorbée puis le shield disparaît. ATTENTION: les Ciseaux (Tranchant) percent quand même.",
              "⚓ Ancré (Anchor, sort): la créature ciblée est immunisée aux sorts adverses ce tour seulement (Logique = la version permanente côté Spock).",
              "⚔️ Riposte (sort): si ta créature MEURT en combat, son tueur meurt aussi (dommage de retour).",
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
          <Section
            title="⚗️ LA FORGE — fusionner deux cartes"
            body="La petite case « Forge » au centre-droite du pad est ta table d'alchimie. DÉPOSER (gratuit) : sélectionne une carte de ta main puis tape ta Forge — la carte y reste posée, visible des deux camps, reprenable d'un tap. FUSIONNER : sélectionne son PARTENAIRE en main (badge ⚗ qui devient OR) et tape la Forge → les deux cartes se consument et la carte fusionnée (plus puissante, coût = somme −1) arrive dans ta main. Aucun tour perdu, aucun mana au dépôt."
            sub={[
              "🎯 Précision + Surcharge = FRAPPE PARFAITE (+6 ATK)",
              "🏰 Aegis + Ancre = BASTION (bouclier + ancre + provoc rechargée)",
              "🏔️ Jet de Caillou ×2 = AVALANCHE (3 dégâts à 2 créatures)",
              "⛲ Sève + Second Souffle = SOURCE VITALE (+3 créature ET +3 héros)",
              "👁️ Oracle + Coup d'Œil = OMNISCIENCE (pioche 3 + main adverse révélée 2 tours)",
              "🛡 Toile Gluante + Malédiction = COCON (n'attaque pas + −2 ATK)",
              "☄️ Supernova + Gravité = APOCALYPSE (4 dégâts à toutes + 4 au héros)",
              "🎭 Larcin + Mascarade = IMPOSTEUR (vole 1 carte + lit la main)",
              "Badge ⚗ fuchsia = la carte a une recette · OR pulsant = son partenaire est sur ta Forge, fusion possible MAINTENANT.",
            ]}
          />
          <Section title="✨ Lecture des badges" body="⚔ = ATK · ❤ = HP · les chips +N (vert) ou -N (rouge) en bas-gauche montrent les buffs/debuffs actifs. Les icônes en haut-droit montrent les status. ⚗ = carte fusionnable (Forge)." />
          <Section title="💡 Astuce" body="Le CPU ne peut JAMAIS occuper toutes les lanes (cap à 2 créatures max). Garde un sort de dégât direct (Heist/Supernova) pour finir l'opp quand son board est plein." />
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

/** Per-symbole strategy cheat-sheet — one card per RPSLS symbol with
 *  stats, passif name, BON / MOINS BON / 2 CONTRES (the 2 RPSLS counters).
 *  This is the heart of "Comment ça marche" — single-glance strategy from
 *  turn 1. Reads top-to-bottom on mobile, no horizontal scroll. */
function PassiveGrid() {
  const moves: Move[] = ["rock", "paper", "scissors", "lizard", "spock"];
  const moveLabel: Record<Move, string> = {
    rock: "Pierre",
    paper: "Feuille",
    scissors: "Ciseaux",
    lizard: "Lézard",
    spock: "Spock",
  };
  const toneBg: Record<string, string> = {
    amber:   "bg-amber-400/95 text-black",
    emerald: "bg-emerald-400/95 text-black",
    rose:    "bg-rose-400/95 text-black",
    sky:     "bg-sky-400/95 text-black",
    violet:  "bg-violet-400/95 text-black",
  };
  return (
    <div>
      <h3 className="text-[12px] font-black uppercase tracking-wider text-emerald-200/95 mb-1">
        🎴 LES 5 SYMBOLES — pouvoir, force, faiblesse, contres
      </h3>
      <p className="text-[13.5px] leading-relaxed text-zinc-300 mb-3">
        Chaque symbole RPSLS a une <strong className="text-emerald-200">nature passive</strong> gratuite (badge en haut-droit de la créature) ET ses 2 contres RPSLS qui le tuent en combat de lane. Lis ces 5 cartes une fois — c'est ta strat de tout le match.
      </p>
      <div className="space-y-2.5">
        {moves.map((move) => {
          const p = CREATURE_PASSIVES[move];
          const stats = CREATURE_STATS[move];
          const notes = MOVE_DESIGN_NOTES[move];
          return (
            <div key={move} className="rounded-lg bg-zinc-900/70 border border-zinc-800 p-2.5">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className={"text-[15px] px-1.5 py-0.5 rounded font-black tracking-wider shadow leading-none " + (toneBg[p.tone] ?? "bg-zinc-400 text-black")}>
                  {p.glyph}
                </span>
                <span className="text-[15px] font-black text-zinc-50">{moveLabel[move]}</span>
                <span className="text-[12px] text-zinc-400 tabular-nums ml-auto">⚔ {stats.atk} · ❤ {stats.hp}</span>
                <span className="text-[13px] font-bold text-emerald-300 whitespace-nowrap">{p.name}</span>
              </div>
              <div className="space-y-1 pl-1">
                <p className="text-[13px] leading-snug text-emerald-200/95">
                  <span className="font-black">💪 Bon —</span> {notes.good}
                </p>
                <p className="text-[13px] leading-snug text-rose-200/95">
                  <span className="font-black">🔻 Moins bon —</span> {notes.bad}
                </p>
                <p className="text-[13px] leading-snug text-amber-200/95">
                  <span className="font-black">⚠ 2 contres —</span> {notes.counters}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 rounded-lg bg-emerald-950/60 border border-emerald-800/40 p-2.5">
        <p className="text-[13px] leading-snug text-emerald-100/95">
          <span className="font-black text-emerald-300">🎯 Stratégie d'ouverture —</span> Pose une <strong>Pierre</strong> tôt (1 mana, défense). Si opp pose une Pierre, dégaine <strong>Feuille</strong> (cassure board-wide) ou <strong>Spock</strong> (cassure + immunité). Garde <strong>Ciseaux</strong> pour percer un Aegis adverse. <strong>Lézard</strong> = carte-piège anti-finisher. <strong>Spock</strong> = ancrage anti-sorts ET 2e levier anti-Pierre.
        </p>
      </div>
    </div>
  );
}

function Section({ title, body, sub }: { title: string; body: string; sub?: string[] }) {
  return (
    <div>
      <h3 className="text-[14px] font-black uppercase tracking-wider text-emerald-200/95 mb-1.5">{title}</h3>
      {body && <p className="text-[14.5px] leading-relaxed text-zinc-200">{body}</p>}
      {sub && (
        <ul className="mt-1.5 space-y-1.5">
          {sub.map((line, i) => (
            <li key={i} className="text-[14px] leading-relaxed text-zinc-200 pl-3.5 -indent-2.5">
              • {line}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
