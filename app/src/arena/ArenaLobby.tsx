/**
 * ArenaLobby — solo prep hub for Constellation Pro, calqué sur RankedLobby.
 *
 * Reachable from the PlayMenu via the "arena_pro" tile. Sits BETWEEN the
 * menu and the actual ArenaPage (prep + game). Lets the player:
 *   - See their Pro stats (wins/losses/draws)
 *   - Manage their Pro deck (DeckManager filtered by arenaSupported)
 *   - Read the rules (ArenaHowItWorks modal)
 *   - Launch a training match vs CPU
 *   - (Coming soon) Match rapide / Tournoi
 *
 * MVP per Alex 2026-06-09: the lobby is the missing solo-prep flow he
 * flagged repeatedly. Future iterations will wire online matchmaking and
 * tournament bracket on the placeholder buttons.
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "../store/store";
import { levelFromXp } from "../engine/leveling";
import { ModeLobbyShell, LobbyIdentityRow, LobbyChip } from "../ui/ModeLobbyShell";
import { CurrencyBadges } from "../ranked/CurrencyBadges";
import { MOVE_PALETTE, moveRim } from "../icons";
import type { Move } from "../engine/game";
import { CREATURE_PASSIVES, CREATURE_STATS } from "./arenaTypes";
import { ArenaHowItWorks } from "./ArenaHowItWorks";

const VOIES: Move[] = ["rock", "paper", "scissors", "lizard", "spock"];
const VOIE_BONUS: Record<Move, string> = {
  rock:     "Provocation 2 charges (au lieu de 1)",
  paper:    "Fanaison ralentie (−1 ATK tous les 2 tours)",
  scissors: "+1 HP (HP 2 au lieu de 1) — survit à un échange",
  lizard:   "Esquive 2 charges (au lieu de 1)",
  spock:    "+1 ATK (ATK 3 au lieu de 2)",
};
/** Renommage épique des Voies (Alex 2026-06-11) — chaque nom évoque l'effet
 *  gameplay et l'identité du symbole. */
const VOIE_LABEL: Record<Move, string> = {
  rock:     "Voie de la Montagne",
  paper:    "Voie de la Forêt",
  scissors: "Voie du Tranchant",
  lizard:   "Voie du Mirage",
  spock:    "Voie du Cosmos",
};
/** Icônes custom des Voies (Alex 2026-06-13, générées depuis
 *  PROMPTS_ICONES_PRO.md) — identité visuelle du lobby, zéro émoticône.
 *  En match les MoveGlyph restent (cohérence du board). */
const VOIE_ICON: Record<Move, string> = {
  rock:     "/MenuIcons/IconConstellationPro/voie-montagne.png",
  paper:    "/MenuIcons/IconConstellationPro/voie-foret.png",
  scissors: "/MenuIcons/IconConstellationPro/voie-tranchant.png",
  lizard:   "/MenuIcons/IconConstellationPro/voie-mirage.png",
  spock:    "/MenuIcons/IconConstellationPro/voie-cosmos.png",
};
const PRO_ICON = (name: string): string => `/MenuIcons/IconConstellationPro/${name}.png`;
/** Fiche descriptive d'une Voie (Alex 2026-06-11) — affichée au long-press,
 *  comme pour les cartes. Simple et compréhensible. */
const VOIE_FICHE: Record<Move, { but: string; plus: string; moins: string; perso: string }> = {
  rock: {
    but: "Aligner 3 Pierres vivantes pour allumer ta Constellation.",
    plus: "Tes Pierres ont 2 charges de Provocation : elles DÉVIENT les attaques sur elles et encaissent (3 PV). Le meilleur mur défensif.",
    moins: "ATK faible : tu gagnes les combats mais infliges peu au héros adverse. Lente : pas de poursuite le tour de pose.",
    perso: "Finisher FORTERESSE : tes Pierres gagnent un bouclier 🛡 + 2 ATK permanents.",
  },
  paper: {
    but: "Aligner 3 Feuilles vivantes.",
    plus: "ÉTOUFFE : tes Feuilles annulent la Provocation des Pierres adverses. Le contre naturel de la Montagne.",
    moins: "Très fragile (1 PV). FANAISON : tes Feuilles perdent de l'ATK au fil des tours.",
    perso: "En Voie, Fanaison ralentie. Finisher VERGER : Fanaison désactivée + tu regagnes 1 PV/tour.",
  },
  scissors: {
    but: "Aligner 3 Ciseaux vivants.",
    plus: "TRANCHANT : tes Ciseaux percent le 1er bouclier (Aegis). Grosse ATK (4) → forte poursuite sur le héros.",
    moins: "Fragiles : meurent vite face à un contre.",
    perso: "En Voie, +1 PV (survit à un échange). Finisher LAME : ton Tranchant perce TOUT (bouclier, Provoc, Esquive).",
  },
  lizard: {
    but: "Aligner 3 Lézards vivants.",
    plus: "ESQUIVE : tes Lézards évitent une attaque (survie garantie une fois). Polyvalent.",
    moins: "Stats moyennes partout, pas de gros pic offensif ni défensif.",
    perso: "En Voie, 2 charges d'Esquive. Finisher MÉTAMORPHOSE : Esquive infinie (rechargée chaque tour).",
  },
  spock: {
    but: "Aligner 3 Spock vivants.",
    plus: "LOGIQUE : tes Spock ignorent les sorts ciblés ET la Provocation adverse. Tanky (3 PV) + ATK élevée.",
    moins: "DÉTACHÉ : tes Spock ignorent aussi TES buffs (Surge, Précision…). Peu d'options offensives.",
    perso: "Finisher CALCUL : tous tes sorts coûtent 1 mana de moins (min 0).",
  },
};

export function ArenaLobby({
  onTraining,
  onManageDeck,
  onGoShop,
  onBack,
}: {
  /** Launch a Training match vs CPU (goes to ArenaPrepScreen → ArenaGame). */
  onTraining: () => void;
  /** Open the deck manager (filtered by arenaSupported). */
  onManageDeck: () => void;
  /** Jump to the boutique (eclats / packs / craft). */
  onGoShop?: () => void;
  /** Back to the PlayMenu. */
  onBack?: () => void;
}) {
  const player = useStore((s) => s.player);
  const setArenaAffinity = useStore((s) => s.setArenaAffinity);
  const affinity: Move = player.arenaAffinity ?? "rock";
  // BUG fix 2026-06-09 : le ?? "rock" était un fallback display SEULEMENT,
  // le store gardait undefined si le joueur ne tapait pas explicitement.
  // ArenaGame lisait alors undefined → "affinity=∅" en match (pas de
  // bonus Voie, pas de Constellation). Solution KISS : persister le
  // défaut immédiatement au mount du lobby. Le joueur peut toujours
  // changer en tapant une autre Voie.
  useEffect(() => {
    if (!player.arenaAffinity) setArenaAffinity("rock");
  }, [player.arenaAffinity, setArenaAffinity]);
  const stats = player.arenaStats ?? { wins: 0, losses: 0, draws: 0 };
  const total = stats.wins + stats.losses + stats.draws;
  const winrate = stats.wins + stats.losses > 0
    ? Math.round((stats.wins / (stats.wins + stats.losses)) * 100)
    : 0;
  const lvl = levelFromXp(player.xp);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  // Fiche Voie DÉPLIABLE inline (Alex 2026-06-13) — en plus du long-press :
  // une flèche dans le cadre déroule la description complète de la Voie
  // choisie. Plus intuitif/découvrable que le maintien du doigt.
  const [voieExpanded, setVoieExpanded] = useState(false);
  // Fiche Voie au long-press (Alex 2026-06-11) — même UX que l'inspect carte.
  const [ficheVoie, setFicheVoie] = useState<Move | null>(null);
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const startPressVoie = (m: Move) => {
    longPressed.current = false;
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      setFicheVoie(m);
    }, 380);
  };
  const endPressVoie = (m: Move, commit: boolean) => {
    if (pressTimer.current) { window.clearTimeout(pressTimer.current); pressTimer.current = null; }
    if (commit && !longPressed.current) setArenaAffinity(m);
  };

  // Refonte 2026-06-12 : cadrage via le TEMPLATE ModeLobbyShell (header
  // burger+titre+retour symétrique, identité 1 ligne, CTA docké toujours
  // visible). Même template à déployer sur Classé / Constellation / En ligne.
  return (
    <ModeLobbyShell
      title="Constellation Pro"
      tagline="3 lanes · Créatures persistantes · RPSLS + Cartes + Mana"
      titleGradient="from-fuchsia-300 to-violet-300"
      onBack={onBack}
      /* Fiche Voie dépliée → CTA poussé dans le scroll (vers le bas), le haut
       * (monnaie) ne bouge plus. Replié → CTA redocké, layout normal. */
      dockCta={!voieExpanded}
      identity={
        <LobbyIdentityRow
          avatar={player.avatar}
          name={player.nickname}
          chips={
            <>
              <LobbyChip tone="accent">✦ Pro</LobbyChip>
              <LobbyChip>Lv.{lvl.level}</LobbyChip>
              <LobbyChip tone="good">{winrate}% WR</LobbyChip>
              <LobbyChip>{total} matchs</LobbyChip>
            </>
          }
        />
      }
      cta={
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onTraining}
          className="w-full rounded-2xl px-5 py-3 flex items-center justify-between font-black text-white shadow-2xl"
          style={{
            background: "linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))",
            boxShadow: "0 12px 32px -6px color-mix(in oklab, var(--theme-primary) 55%, transparent), 0 0 24px color-mix(in oklab, var(--theme-secondary) 35%, transparent)",
            fontFamily: "var(--font-headline)",
            letterSpacing: "0.04em",
          }}
        >
          <div className="flex items-center gap-2.5">
            <img src={PRO_ICON("pro-entrainement")} alt="" draggable={false} className="w-9 h-9 object-contain drop-shadow" />
            <div className="text-left">
              <div className="text-sm sm:text-base">ENTRAÎNEMENT vs CPU</div>
              <div className="text-[10px] font-medium opacity-85 normal-case tracking-normal">
                Match vs ordinateur · choix difficulté
              </div>
            </div>
          </div>
          <span className="text-xl">›</span>
        </motion.button>
      }
      secondary={
        <div className="grid grid-cols-3 gap-2">
          <button
            disabled
            className="bg-surface rounded-2xl px-2 py-2 flex flex-col items-center gap-0.5 opacity-55 cursor-not-allowed border border-hairline"
          >
            <img src={PRO_ICON("pro-match-rapide")} alt="" draggable={false} className="w-7 h-7 object-contain" />
            <span className="font-bold text-[10px]">Match rapide</span>
            <span className="text-[8px] uppercase tracking-wider text-ink-faint">Bientôt</span>
          </button>
          <button
            disabled
            className="bg-surface rounded-2xl px-2 py-2 flex flex-col items-center gap-0.5 opacity-55 cursor-not-allowed border border-hairline"
          >
            <img src={PRO_ICON("pro-tournoi")} alt="" draggable={false} className="w-7 h-7 object-contain" />
            <span className="font-bold text-[10px]">Tournoi Pro</span>
            <span className="text-[8px] uppercase tracking-wider text-ink-faint">Bientôt</span>
          </button>
          <button
            onClick={() => setHowItWorksOpen(true)}
            className="bg-surface rounded-2xl px-2 py-2 flex flex-col items-center gap-0.5 border border-hairline hover:bg-hairline transition"
          >
            <img src={PRO_ICON("pro-regles")} alt="" draggable={false} className="w-7 h-7 object-contain" />
            <span className="font-bold text-[10px] text-ink">Règles</span>
            <span className="text-[8px] uppercase tracking-wider text-ink-faint">+ symboles</span>
          </button>
        </div>
      }
    >

      {/* Monnaies — ligne compacte. my-auto sur CHAQUE bloc (Alex 2026-06-12
       *  "trous, espace mal occupé") : l'espace libre de la zone contenu se
       *  répartit automatiquement entre les blocs — et si un petit écran
       *  déborde, les marges auto retombent à 0 → scroll normal, rien de
       *  clippé (piège du justify-evenly + overflow évité). */}
      <div className={"shrink-0 flex items-center justify-center " + (voieExpanded ? "" : "my-auto")}>
        <CurrencyBadges size="full" onClick={onGoShop} />
      </div>

      {/* Affinité (Voie) — picker des 5 symboles RPSLS. Constellation Pro
       *  v2 Couche 1 : le symbole choisi donne un bonus passif aux créatures
       *  de ce type ET avance la constellation 3 étoiles vers le Finisher. */}
      <div
        className={"bg-surface rounded-2xl px-4 py-3.5 flex flex-col gap-2.5 " + (voieExpanded ? "" : "my-auto")}
        style={{ border: "1px solid color-mix(in oklab, var(--theme-primary) 35%, transparent)" }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.25em] font-bold text-fuchsia-200">
              ✦ Ma Voie RPSLS
            </div>
            <div className="text-[15px] font-extrabold mt-0.5 text-zinc-100 truncate">
              {VOIE_LABEL[affinity]}
            </div>
          </div>
          <span className="shrink-0 text-[11px] uppercase tracking-wider text-ink-muted whitespace-nowrap">
            ⚔ {CREATURE_STATS[affinity].atk} · ❤ {CREATURE_STATS[affinity].hp}
          </span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {VOIES.map((m) => {
            const pal = MOVE_PALETTE[m];
            const isActive = affinity === m;
            return (
              <button
                key={m}
                onPointerDown={() => startPressVoie(m)}
                onPointerUp={() => endPressVoie(m, true)}
                onPointerLeave={() => endPressVoie(m, false)}
                onPointerCancel={() => endPressVoie(m, false)}
                title="Tape pour choisir · maintiens pour la fiche"
                className={
                  "relative h-12 rounded-lg flex items-center justify-center transition active:scale-95 " +
                  (isActive ? "scale-110 z-10" : "opacity-65")
                }
                style={{
                  background: isActive
                    ? `linear-gradient(160deg, color-mix(in oklab, ${pal.hex} 36%, rgba(20,22,32,0.95)) 0%, color-mix(in oklab, ${pal.hex} 15%, rgba(10,12,20,0.95)) 100%)`
                    : "linear-gradient(160deg, rgba(20,22,32,0.92) 0%, rgba(10,12,20,0.92) 100%)",
                  border: `2px solid ${isActive ? "rgba(252, 211, 77, 0.9)" : moveRim(pal.hex)}`,
                  boxShadow: isActive
                    ? `0 0 18px -2px rgba(252, 211, 77, 0.7), inset 0 0 12px color-mix(in oklab, ${pal.hex} 40%, transparent)`
                    : "inset 0 1px 0 rgba(255,255,255,0.08)",
                }}
              >
                <img src={VOIE_ICON[m]} alt={VOIE_LABEL[m]} draggable={false} className="w-9 h-9 object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]" />
              </button>
            );
          })}
        </div>
        {/* Cadre BONUS VOIE = bouton dépliable (Alex 2026-06-13) : la flèche
         *  vit ICI, collée à « Bonus Voie » → plus visible/clair que dans
         *  l'en-tête. Tape n'importe où dans le cadre pour déplier la fiche. */}
        <button
          onClick={() => setVoieExpanded((v) => !v)}
          aria-expanded={voieExpanded}
          className="w-full text-left rounded-lg bg-fuchsia-950/40 border border-fuchsia-700/30 px-3 py-2.5 hover:bg-fuchsia-950/55 transition"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-[16px]">{CREATURE_PASSIVES[affinity].glyph}</span>
            <span className="text-[13.5px] font-black text-fuchsia-100">{CREATURE_PASSIVES[affinity].name}</span>
            <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-fuchsia-300 ml-auto">
              <img src={PRO_ICON("pro-bonus-voie")} alt="" draggable={false} className="w-4 h-4 object-contain" />
              Bonus Voie
              <motion.span
                animate={{ rotate: voieExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="shrink-0 w-5 h-5 rounded-full bg-fuchsia-500/25 border border-fuchsia-400/45 text-fuchsia-100 text-[11px] flex items-center justify-center"
                aria-hidden
              >
                ▾
              </motion.span>
            </span>
          </div>
          <p className="text-[12.5px] leading-snug text-fuchsia-100/90 mt-1">
            {VOIE_BONUS[affinity]}
          </p>
          {!voieExpanded && (
            <p className="text-[10px] text-fuchsia-300/70 mt-1 italic">Détails complets ▾</p>
          )}
        </button>
        {/* Fiche complète DÉPLIABLE (flèche du cadre Bonus Voie) — même
         *  contenu que le long-press, mais découvrable. Collapse animé. */}
        <AnimatePresence initial={false}>
          {voieExpanded && (
            <motion.div
              key="voie-fiche-inline"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="rounded-lg bg-black/30 border border-fuchsia-700/25 px-3 pt-2.5 pb-1 mt-0.5">
                <FicheRow icon={PRO_ICON("fiche-but")} label="But" text={VOIE_FICHE[affinity].but} />
                <FicheRow icon={PRO_ICON("fiche-force")} label="Force" text={VOIE_FICHE[affinity].plus} />
                <FicheRow icon={PRO_ICON("fiche-faiblesse")} label="Faiblesse" text={VOIE_FICHE[affinity].moins} />
                <FicheRow icon={PRO_ICON("fiche-particularite")} label="Particularité" text={VOIE_FICHE[affinity].perso} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Deck manager */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={onManageDeck}
        className={"bg-surface rounded-2xl px-4 py-3 flex items-center justify-between hover:bg-hairline transition " + (voieExpanded ? "" : "my-auto")}
        style={{ border: "1px solid color-mix(in oklab, var(--theme-primary) 35%, transparent)" }}
      >
        <div className="flex items-center gap-2.5">
          <img src={PRO_ICON("pro-deck")} alt="" draggable={false} className="w-8 h-8 object-contain drop-shadow" />
          <div className="text-left">
            <div className="font-bold text-[15px] text-ink">Gérer mon Deck Pro</div>
            <div className="text-[11px] text-ink-faint">Compose tes 8 cartes (filtre Arena)</div>
          </div>
        </div>
        <span style={{ color: "var(--theme-secondary)" }}>›</span>
      </motion.button>

      {/* CTA Entraînement + rangée secondaire (Match rapide / Tournoi /
       *  Règles) : déplacés dans les props cta/secondary du shell — DOCKÉS
       *  en bas, toujours visibles sans scroller. */}

      {/* HowItWorks modal */}
      <AnimatePresence>
        {howItWorksOpen && <ArenaHowItWorks onClose={() => setHowItWorksOpen(false)} />}
      </AnimatePresence>

      {/* Fiche Voie (long-press) — overlay plein écran, fermable au tap. */}
      <AnimatePresence>
        {ficheVoie && (() => {
          const pal = MOVE_PALETTE[ficheVoie];
          const f = VOIE_FICHE[ficheVoie];
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setFicheVoie(null)}
              className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 backdrop-blur-sm p-5"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 14 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: "spring", stiffness: 280, damping: 22 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm rounded-3xl p-5 shadow-2xl border-2"
                style={{
                  background: `linear-gradient(160deg, color-mix(in oklab, ${pal.hex} 22%, rgba(12,14,22,0.97)), rgba(8,10,16,0.98))`,
                  borderColor: `color-mix(in oklab, ${pal.hex} 60%, transparent)`,
                }}
              >
                <div className="flex items-center gap-2.5 mb-3">
                  <img src={VOIE_ICON[ficheVoie]} alt="" draggable={false} className="w-10 h-10 object-contain drop-shadow" />
                  <div>
                    <div className="text-base font-black text-white">{VOIE_LABEL[ficheVoie]}</div>
                    <div className="text-[10px] uppercase tracking-wider" style={{ color: pal.hex }}>{CREATURE_PASSIVES[ficheVoie].name}</div>
                  </div>
                </div>
                <FicheRow icon={PRO_ICON("fiche-but")} label="But" text={f.but} />
                <FicheRow icon={PRO_ICON("fiche-force")} label="Force" text={f.plus} />
                <FicheRow icon={PRO_ICON("fiche-faiblesse")} label="Faiblesse" text={f.moins} />
                <FicheRow icon={PRO_ICON("fiche-particularite")} label="Particularité" text={f.perso} />
                <button
                  onClick={() => setFicheVoie(null)}
                  className="mt-4 w-full py-2.5 rounded-2xl font-bold text-sm text-white"
                  style={{ background: `linear-gradient(135deg, ${pal.hex}, color-mix(in oklab, ${pal.hex} 60%, #000))` }}
                >
                  Compris
                </button>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </ModeLobbyShell>
  );
}

function FicheRow({ icon, label, text }: { icon: string; label: string; text: string }) {
  // icon = chemin PNG (/MenuIcons/…) → <img> ; sinon emoji legacy (fallback).
  const isImg = icon.startsWith("/");
  return (
    <div className="flex gap-2 mb-2.5 items-start">
      {isImg ? (
        <img src={icon} alt="" draggable={false} className="w-5 h-5 shrink-0 object-contain mt-0.5" />
      ) : (
        <span className="text-sm shrink-0">{icon}</span>
      )}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-ink-faint font-bold">{label}</div>
        <p className="text-[12px] leading-snug text-ink">{text}</p>
      </div>
    </div>
  );
}
