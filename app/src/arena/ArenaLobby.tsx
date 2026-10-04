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
import { ModeLobbyShell, LobbyChip } from "../ui/ModeLobbyShell";
import { MODE_ICONS } from "../pages/play/PlayMenu/menuShared";
import { MOVE_PALETTE, moveRim } from "../icons";
import type { Move } from "../engine/game";
import { CREATURE_PASSIVES, CREATURE_STATS } from "./arenaTypes";
import { ArenaHowItWorks } from "./ArenaHowItWorks";
import { VOIE_EMBLEM } from "./voieEmblem";
import { TutorialOfferModal } from "./tutorial/TutorialOfferModal";
import { skipArenaTutorial } from "./tutorial/tutorialProgress";
import { useT } from "../i18n";
import { voieTextParams } from "./arenaVoieText";

const VOIES: Move[] = ["rock", "paper", "scissors", "lizard", "spock"];
/** Bonus Voie (texte i18n : arena.voie.<move>.bonus). */
const voieBonusKey = (m: Move): string => `arena.voie.${m}.bonus`;
/** Renommage épique des Voies (Alex 2026-06-11) — chaque nom évoque l'effet
 *  gameplay et l'identité du symbole. */
const voieLabelKey = (m: Move): string => `arena.voie.${m}.label`;
/** Icônes de Voie du lobby = les MÉDAILLONS d'emblème (Alex 2026-06-23). LE MÊME
 *  médaillon est désormais affiché sur la jauge de Voie en match
 *  (ArenaConstellationBar) → fil d'identité « ma Voie = ce médaillon, et il se
 *  remplit ». Remplace les anciennes /MenuIcons/IconConstellationPro/voie-*.png
 *  (réversible : repointer ici suffit). */
const VOIE_ICON: Record<Move, string> = VOIE_EMBLEM;
const PRO_ICON = (name: string): string => `/MenuIcons/IconConstellationPro/${name}.png`;
/** Fiche descriptive d'une Voie (Alex 2026-06-11) — affichée au long-press,
 *  comme pour les cartes. Simple et compréhensible. */
const voieFicheKey = (m: Move, f: "but" | "plus" | "moins" | "perso"): string => `arena.voie.${m}.${f}`;

export function ArenaLobby({
  onTraining,
  onGoOnline,
  onManageDeck,
  onBack,
  onTutorial,
}: {
  /** Launch a Training match vs CPU (goes to ArenaPrepScreen → ArenaGame). */
  onTraining: () => void;
  /** Match rapide EN LIGNE vs joueur réel (Pro 1v1 lockstep). */
  onGoOnline?: () => void;
  /** Open the deck manager (filtered by arenaSupported). */
  onManageDeck: () => void;
  /** Back to the PlayMenu. */
  onBack?: () => void;
  /** Lance le tutoriel guidé (proposé d'office à la 1re visite). */
  onTutorial?: () => void;
}) {
  const t = useT();
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

  // TEMPLATE ModeLobbyShell commun à tous les lobbies : titre + retour dans la
  // barre du haut, héros (stats Pro), réglages, CTA docké toujours visible.
  return (
    <ModeLobbyShell
      title={t("mode.arena_pro")}
      tagline={t("arena.lobby.tagline")}
      icon={MODE_ICONS.arena_pro}
      accent="#e879f9"
      onBack={onBack}
      /* Fiche Voie dépliée → CTA poussé dans le scroll (vers le bas), le haut
       * (monnaie) ne bouge plus. Replié → CTA redocké, layout normal. */
      dockCta={!voieExpanded}
      // Stats du mode dans le héros (plus de carte joueur ni de monnaies :
      // elles vivent sur l'accueil — doublon relevé à l'audit).
      heroExtra={
        <>
          <LobbyChip tone="accent">✦ Pro</LobbyChip>
          <LobbyChip>Lv.{lvl.level}</LobbyChip>
          <LobbyChip tone="good">{winrate}% WR</LobbyChip>
          <LobbyChip>{t("arena.lobby.matches", { n: total })}</LobbyChip>
        </>
      }
      cta={
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onTraining}
          className="w-full rounded-2xl px-5 py-3 flex items-center justify-between font-black text-white shadow-2xl bg-themed-br"
          style={{
            boxShadow: "0 12px 32px -6px color-mix(in oklab, var(--theme-primary) 55%, transparent), 0 0 24px color-mix(in oklab, var(--theme-secondary) 35%, transparent)",
            fontFamily: "var(--font-headline)",
            letterSpacing: "0.04em",
          }}
        >
          <div className="flex items-center gap-2.5">
            <img src={PRO_ICON("pro-entrainement")} alt="" draggable={false} className="w-9 h-9 object-contain drop-shadow" />
            <div className="text-left">
              <div className="text-sm sm:text-base">{t("arena.lobby.training")}</div>
              <div className="text-[10px] font-medium opacity-85 normal-case tracking-normal">
                {t("arena.lobby.trainingSub")}
              </div>
            </div>
          </div>
          <span className="text-xl">›</span>
        </motion.button>
      }
      secondary={
        <div className={"grid gap-2 " + (onTutorial ? "grid-cols-4" : "grid-cols-3")}>
          <button
            onClick={onGoOnline}
            disabled={!onGoOnline}
            className="bg-surface rounded-2xl px-2 py-2 flex flex-col items-center gap-0.5 border border-hairline hover:bg-hairline transition disabled:opacity-55 disabled:cursor-not-allowed"
          >
            <img src={PRO_ICON("pro-match-rapide")} alt="" draggable={false} className="w-7 h-7 object-contain" />
            <span className="font-bold text-[10px] text-ink">{t("arena.lobby.quickMatch")}</span>
            <span className="text-[8px] uppercase tracking-wider" style={{ color: "var(--theme-secondary)" }}>{t("arena.lobby.online")}</span>
          </button>
          <button
            disabled
            className="bg-surface rounded-2xl px-2 py-2 flex flex-col items-center gap-0.5 opacity-55 cursor-not-allowed border border-hairline"
          >
            <img src={PRO_ICON("pro-tournoi")} alt="" draggable={false} className="w-7 h-7 object-contain" />
            <span className="font-bold text-[10px]">{t("arena.lobby.tournament")}</span>
            <span className="text-[8px] uppercase tracking-wider text-ink-faint">{t("arena.lobby.soon")}</span>
          </button>
          <button
            onClick={() => setHowItWorksOpen(true)}
            className="bg-surface rounded-2xl px-2 py-2 flex flex-col items-center gap-0.5 border border-hairline hover:bg-hairline transition"
          >
            <img src={PRO_ICON("pro-regles")} alt="" draggable={false} className="w-7 h-7 object-contain" />
            <span className="font-bold text-[10px] text-ink">{t("arena.lobby.rules")}</span>
            <span className="text-[8px] uppercase tracking-wider text-ink-faint">{t("arena.lobby.rulesSub")}</span>
          </button>
          {onTutorial && (
            <button
              onClick={onTutorial}
              className="bg-surface rounded-2xl px-2 py-2 flex flex-col items-center gap-0.5 border border-hairline hover:bg-hairline transition"
            >
              <span className="w-7 h-7 flex items-center justify-center text-[22px] leading-none" aria-hidden>🎓</span>
              <span className="font-bold text-[10px] text-ink">{t("tut.lobby.title")}</span>
              <span className="text-[8px] uppercase tracking-wider" style={{ color: player.arenaTutorial === "done" ? "#6ee7b7" : "var(--theme-secondary)" }}>
                {player.arenaTutorial === "done" ? t("tut.lobby.done") : t("tut.lobby.sub")}
              </span>
            </button>
          )}
        </div>
      }
    >

      {/* Affinité (Voie) — picker des 5 symboles RPSLS. Constellation Pro
       *  v2 Couche 1 : le symbole choisi donne un bonus passif aux créatures
       *  de ce type ET avance la constellation 3 étoiles vers le Finisher. */}
      <div
        className="shrink-0 bg-surface rounded-2xl px-4 py-3.5 flex flex-col gap-2.5"
        style={{ border: "1px solid color-mix(in oklab, var(--theme-primary) 35%, transparent)" }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.25em] font-bold text-fuchsia-200">
              {t("arena.lobby.myVoie")}
            </div>
            <div className="text-[15px] font-extrabold mt-0.5 text-zinc-100 truncate">
              {t(voieLabelKey(affinity))}
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
                title={t("arena.lobby.voieHint")}
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
                <img src={VOIE_ICON[m]} alt={t(voieLabelKey(m))} draggable={false} className="w-9 h-9 object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]" />
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
              {t("arena.lobby.voieBonus")}
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
            {t(voieBonusKey(affinity), voieTextParams(affinity))}
          </p>
          {!voieExpanded && (
            <p className="text-[10px] text-fuchsia-300/70 mt-1 italic">{t("arena.lobby.details")}</p>
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
                <FicheRow icon={PRO_ICON("fiche-but")} label={t("arena.lobby.fiche.but")} text={t(voieFicheKey(affinity, "but"), voieTextParams(affinity))} />
                <FicheRow icon={PRO_ICON("fiche-force")} label={t("arena.lobby.fiche.force")} text={t(voieFicheKey(affinity, "plus"), voieTextParams(affinity))} />
                <FicheRow icon={PRO_ICON("fiche-faiblesse")} label={t("arena.lobby.fiche.faiblesse")} text={t(voieFicheKey(affinity, "moins"), voieTextParams(affinity))} />
                <FicheRow icon={PRO_ICON("fiche-particularite")} label={t("arena.lobby.fiche.perso")} text={t(voieFicheKey(affinity, "perso"), voieTextParams(affinity))} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Deck manager */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={onManageDeck}
        className="shrink-0 bg-surface rounded-2xl px-4 py-3 flex items-center justify-between hover:bg-hairline transition"
        style={{ border: "1px solid color-mix(in oklab, var(--theme-primary) 35%, transparent)" }}
      >
        <div className="flex items-center gap-2.5">
          <img src={PRO_ICON("pro-deck")} alt="" draggable={false} className="w-8 h-8 object-contain drop-shadow" />
          <div className="text-left">
            <div className="font-bold text-[15px] text-ink">{t("arena.lobby.deck")}</div>
            <div className="text-[11px] text-ink-faint">{t("arena.lobby.deckSub")}</div>
          </div>
        </div>
        <span style={{ color: "var(--theme-secondary)" }}>›</span>
      </motion.button>

      {/* CTA Entraînement + rangée secondaire (Match rapide / Tournoi /
       *  Règles) : déplacés dans les props cta/secondary du shell — DOCKÉS
       *  en bas, toujours visibles sans scroller. */}

      {/* Tuto proposé à la 1re visite (« Plus tard » = plus jamais d'office). */}
      <AnimatePresence>
        {onTutorial && !player.arenaTutorial && (
          <TutorialOfferModal key="tut-offer" onStart={onTutorial} onLater={skipArenaTutorial} />
        )}
      </AnimatePresence>

      {/* HowItWorks modal */}
      <AnimatePresence>
        {howItWorksOpen && <ArenaHowItWorks onClose={() => setHowItWorksOpen(false)} />}
      </AnimatePresence>

      {/* Fiche Voie (long-press) — overlay plein écran, fermable au tap. */}
      <AnimatePresence>
        {ficheVoie && (() => {
          const pal = MOVE_PALETTE[ficheVoie];
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
                    <div className="text-base font-black text-white">{t(voieLabelKey(ficheVoie))}</div>
                    <div className="text-[10px] uppercase tracking-wider" style={{ color: pal.hex }}>{CREATURE_PASSIVES[ficheVoie].name}</div>
                  </div>
                </div>
                <FicheRow icon={PRO_ICON("fiche-but")} label={t("arena.lobby.fiche.but")} text={t(voieFicheKey(ficheVoie, "but"), voieTextParams(ficheVoie))} />
                <FicheRow icon={PRO_ICON("fiche-force")} label={t("arena.lobby.fiche.force")} text={t(voieFicheKey(ficheVoie, "plus"), voieTextParams(ficheVoie))} />
                <FicheRow icon={PRO_ICON("fiche-faiblesse")} label={t("arena.lobby.fiche.faiblesse")} text={t(voieFicheKey(ficheVoie, "moins"), voieTextParams(ficheVoie))} />
                <FicheRow icon={PRO_ICON("fiche-particularite")} label={t("arena.lobby.fiche.perso")} text={t(voieFicheKey(ficheVoie, "perso"), voieTextParams(ficheVoie))} />
                <button
                  onClick={() => setFicheVoie(null)}
                  className="mt-4 w-full py-2.5 rounded-2xl font-bold text-sm text-white"
                  style={{ background: `linear-gradient(135deg, ${pal.hex}, color-mix(in oklab, ${pal.hex} 60%, #000))` }}
                >
                  {t("arena.lobby.gotIt")}
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
