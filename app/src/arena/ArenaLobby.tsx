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

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "../store/store";
import { levelFromXp } from "../engine/leveling";
import { FloatingMatchBackButton } from "../match/sharedMatchUI";
import { CurrencyBadges } from "../ranked/CurrencyBadges";
import { avatarImgStyle } from "../theme/avatar";
import { MoveGlyph, MOVE_PALETTE, moveRim } from "../icons";
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
const VOIE_LABEL: Record<Move, string> = {
  rock: "Voie de la Pierre",
  paper: "Voie de la Feuille",
  scissors: "Voie des Ciseaux",
  lizard: "Voie du Lézard",
  spock: "Voie de Spock",
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-3 sm:gap-5 flex-1 py-2 px-1 max-w-lg mx-auto w-full overflow-y-auto"
    >
      {onBack && <FloatingMatchBackButton onClick={onBack} label="Retour" />}

      {/* Title */}
      <div className="text-center">
        <h1
          className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight bg-gradient-to-br from-fuchsia-300 to-violet-300 bg-clip-text text-transparent"
          style={{ fontFamily: "var(--font-headline)" }}
        >
          Constellation Pro
        </h1>
        <p className="mt-1 text-ink-muted text-xs sm:text-sm">
          3 lanes · Créatures qui restent · Combat RPSLS + Cartes + Mana
        </p>
        <p className="text-[10px] text-ink-faint mt-0.5">
          Mode CCG-style — stats / classements indépendants
        </p>
      </div>

      {/* Profile card */}
      <div className="bg-surface border border-hairline rounded-3xl p-4 sm:p-5 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border border-hairline flex items-center justify-center text-3xl overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg, color-mix(in oklab, var(--theme-primary) 32%, transparent), color-mix(in oklab, var(--theme-secondary) 32%, transparent))",
            }}
          >
            {/^(data:|\/|https?:)/.test(player.avatar) ? (
              <img
                src={player.avatar}
                alt=""
                className="w-full h-full object-cover"
                style={avatarImgStyle(player.avatar)}
              />
            ) : (
              player.avatar
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-lg truncate">{player.nickname}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-fuchsia-500/30 text-fuchsia-100">
                ✦ Arène Pro
              </span>
              <span className="text-xs text-ink-muted">Lv.{lvl.level}</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <StatCell label="Matchs" value={String(total)} color="text-ink" />
          <StatCell label="Winrate" value={`${winrate}%`} color="text-amber-300" />
          <StatCell label="Victoires" value={String(stats.wins)} color="text-emerald-300" />
        </div>
        <div className="flex items-center justify-center pt-1">
          <CurrencyBadges size="full" onClick={onGoShop} />
        </div>
      </div>

      {/* Affinité (Voie) — picker des 5 symboles RPSLS. Constellation Pro
       *  v2 Couche 1 : le symbole choisi donne un bonus passif aux créatures
       *  de ce type ET avance la constellation 3 étoiles vers le Finisher. */}
      <div
        className="bg-surface rounded-2xl px-4 py-3 flex flex-col gap-2"
        style={{ border: "1px solid color-mix(in oklab, var(--theme-primary) 35%, transparent)" }}
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] font-bold text-fuchsia-200">
              ✦ Ma Voie RPSLS
            </div>
            <div className="text-[13px] font-extrabold mt-0.5 text-zinc-100">
              {VOIE_LABEL[affinity]}
            </div>
          </div>
          <div className="text-[9px] uppercase tracking-wider text-ink-faint">
            ⚔ {CREATURE_STATS[affinity].atk} · ❤ {CREATURE_STATS[affinity].hp}
          </div>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {VOIES.map((m) => {
            const pal = MOVE_PALETTE[m];
            const isActive = affinity === m;
            return (
              <button
                key={m}
                onClick={() => setArenaAffinity(m)}
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
                <MoveGlyph move={m} className="w-7 h-7 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]" />
              </button>
            );
          })}
        </div>
        <div className="rounded-lg bg-fuchsia-950/40 border border-fuchsia-700/30 px-2.5 py-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[14px]">{CREATURE_PASSIVES[affinity].glyph}</span>
            <span className="text-[12px] font-black text-fuchsia-100">{CREATURE_PASSIVES[affinity].name}</span>
            <span className="text-[10px] uppercase tracking-wider text-fuchsia-300 ml-auto">Bonus Voie</span>
          </div>
          <p className="text-[11.5px] leading-snug text-fuchsia-100/90 mt-0.5">
            {VOIE_BONUS[affinity]}
          </p>
        </div>
        <p className="text-[10px] text-ink-faint leading-snug italic">
          Ta Voie te donne un bonus passif sur tes créatures de ce symbole. Constellation 3 ⭐ à allumer en cours de partie débloque ton FINISHER (Lot C/D à venir).
        </p>
      </div>

      {/* Deck manager */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={onManageDeck}
        className="bg-surface rounded-2xl px-4 py-3 flex items-center justify-between hover:bg-hairline transition"
        style={{ border: "1px solid color-mix(in oklab, var(--theme-primary) 35%, transparent)" }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-fuchsia-500/40 to-violet-500/40 flex items-center justify-center text-base">🎴</div>
          <div className="text-left">
            <div className="font-bold text-sm text-ink">Gérer mon Deck Pro</div>
            <div className="text-[10px] text-ink-faint">Compose tes 8 cartes (filtre Arena)</div>
          </div>
        </div>
        <span style={{ color: "var(--theme-secondary)" }}>›</span>
      </motion.button>

      {/* Training CTA — main button */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={onTraining}
        className="rounded-2xl px-5 py-4 flex items-center justify-between font-black text-white shadow-2xl"
        style={{
          background: "linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))",
          boxShadow: "0 12px 32px -6px color-mix(in oklab, var(--theme-primary) 55%, transparent), 0 0 24px color-mix(in oklab, var(--theme-secondary) 35%, transparent)",
          fontFamily: "var(--font-headline)",
          letterSpacing: "0.04em",
        }}
      >
        <div className="flex items-center gap-2.5">
          <div className="text-2xl">⚔️</div>
          <div className="text-left">
            <div className="text-sm sm:text-base">ENTRAÎNEMENT vs CPU</div>
            <div className="text-[10px] font-medium opacity-85 normal-case tracking-normal">
              Match vs ordinateur · choix difficulté
            </div>
          </div>
        </div>
        <span className="text-xl">›</span>
      </motion.button>

      {/* Online + Tournoi placeholders */}
      <div className="grid grid-cols-2 gap-2">
        <button
          disabled
          className="bg-surface rounded-2xl px-3 py-3 flex flex-col items-start gap-1 opacity-55 cursor-not-allowed border border-hairline text-left"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-lg">🌐</span>
            <span className="font-bold text-xs">Match rapide</span>
          </div>
          <span className="text-[9px] uppercase tracking-wider text-ink-faint">Bientôt</span>
        </button>
        <button
          disabled
          className="bg-surface rounded-2xl px-3 py-3 flex flex-col items-start gap-1 opacity-55 cursor-not-allowed border border-hairline text-left"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-lg">🏆</span>
            <span className="font-bold text-xs">Tournoi Pro</span>
          </div>
          <span className="text-[9px] uppercase tracking-wider text-ink-faint">Bientôt</span>
        </button>
      </div>

      {/* How it works button */}
      <button
        onClick={() => setHowItWorksOpen(true)}
        className="bg-surface rounded-2xl px-4 py-3 flex items-center justify-between hover:bg-hairline transition border border-hairline"
      >
        <div className="flex items-center gap-2.5">
          <div className="text-xl">📖</div>
          <div className="text-left">
            <div className="font-bold text-sm text-ink">Comment ça marche ?</div>
            <div className="text-[10px] text-ink-faint">Règles + 5 symboles + cartes bonus</div>
          </div>
        </div>
        <span className="text-ink-muted">›</span>
      </button>

      {/* HowItWorks modal */}
      <AnimatePresence>
        {howItWorksOpen && <ArenaHowItWorks onClose={() => setHowItWorksOpen(false)} />}
      </AnimatePresence>
    </motion.div>
  );
}

function StatCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-hairline rounded-xl p-2 text-center">
      <div className="text-[9px] uppercase tracking-wider text-ink-faint font-bold">{label}</div>
      <div className={"text-base font-black mt-0.5 " + color}>{value}</div>
    </div>
  );
}
