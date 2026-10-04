/**
 * ArenaBoardProps — props du plateau Arena (extraites d'ArenaBoard.tsx pour le
 * cap <400 lignes/fichier). Réexportées depuis ArenaBoard.
 */

import type { ProjectileFX } from "../ArenaProjectileFX";
import type { ArenaTargeting, BoardState, LaneIndex, Side, TurnIntent } from "../arenaTypes";
import type { CardId } from "../../ranked/rankedTypes";

export interface ArenaBoardProps {
  board: BoardState;
  /** Which side is "us" (the player) — always "a" in MVP vs CPU. */
  playerSide: Side;
  /** The player's pending intent — used to render ghost-previews of the
   *  summons/spells that WILL fire on lock. */
  intent: TurnIntent;
  /** OPP intent preview — set during the "Adversaire joue…" window between
   *  lock and resolver. Ghost previews on opp lanes + chip strip of their
   *  spells so the player SEES what's incoming before damage lands. */
  oppPreview?: TurnIntent | null;
  /** Player-side mirror of oppPreview — shows what YOU just committed
   *  (chip strip). Same lifetime as oppPreview. */
  playerPreview?: TurnIntent | null;
  /** Current step in the sequenced resolver — drives the phase banner so
   *  the player always knows what's about to happen / just happened. */
  resolveStep?: "reveal-opp" | "spells" | "summons" | "combat" | "settle" | null;
  /** Which lane is currently animating its combat (0/1/2) or null when no
   *  lane is "live". Drives the per-lane charge anim. */
  combatLane?: LaneIndex | null;
  combatChargers?: ("a" | "b")[];
  /** Hero-hit flash event — set briefly when a creature lands an attack
   *  on a hero. The targeted side's HP bar flashes white→red dramatically. */
  heroHit?: { side: "you" | "opp"; lane: LaneIndex; key: number } | null;
  /** Taunt block flash — set when an undefended attack is DEFLECTED by a
   *  taunt creature on the defender's side. Pops a "🪨 ATTAQUE DÉTOURNÉE !"
   *  chip on the defender's row + glows the actual Pierre that ate the
   *  deflection (rockLane), so the player SEES which rock saved them. */
  tauntBlock?: { defenderSide: "a" | "b"; rockLane: LaneIndex; key: number } | null;
  /** Anti-taunt bypass — set when an attack reached a hero because the
   *  attacker's Étouffe (Feuille) / Logique (Spock) cancelled the defender's
   *  charged Pierre Provocation. Pops a chip on the bypassed Pierre. */
  antiTaunt?: { bypassedSide: "a" | "b"; rockLane: LaneIndex; cause: "paper" | "spock"; key: number } | null;
  /** Riposte d'esquive (Mirage) — set quand un attaquant frappe un Lézard qui
   *  esquive : pop un chip « ✨ Esquive → ⚔ Riposte » sur la lane de l'attaquant,
   *  pour expliquer pourquoi il encaisse/meurt (Alex 2026-06-28 « meurt sans raison »). */
  riposteFX?: { attackerSide: "a" | "b"; lane: LaneIndex; key: number } | null;
  /** Signatures FX plein-board (Genèse, Supernova…) — déclenché au step
   *  SPELLS. null au repos. Cf. ArenaSpellFX. */
  spellFX?: { ids: CardId[]; key: number } | null;
  /** Projectiles « cailloux » lane→lane — Jet de Caillou (1) + Éboulement AOE (N). */
  projectileShots?: ProjectileFX[];
  /** Identité cosmétique CPU (strip adverse) — nom réel + portrait hero_*.png
   *  au lieu de « CPU » + 🤖 (Alex 2026-06-13). */
  oppName?: string;
  oppAvatar?: string;
  /** Active targeting (lifted from ArenaPlanPhase) — when set on a lane
   *  target, the BOARD highlights ONLY the lane slots a spell of that
   *  kind can actually target (my creature for buffs, opp creature for
   *  debuffs, my empty for summons, etc.). */
  targeting?: ArenaTargeting;
  /** Called when the player taps a lane slot while targeting is active.
   *  Receives BOTH the lane AND the side that was tapped, so the parent
   *  can decide what to do (commit to my row, commit to opp row, etc.). */
  onLaneTap?: (lane: LaneIndex, side: Side) => void;
  /** Retire un sort planifié par son index dans intent.spells (Alex 2026-06-11) :
   *  tap sur un sticker lane joueur = annuler le sort. */
  onRemoveSpell?: (idx: number) => void;
  /** Annule une invocation planifiée sur une lane (Alex 2026-06-12 "0 souplesse,
   *  je peux pas retirer une invocation juste posée") — tap sur la croix du ghost. */
  onRemoveSummon?: (lane: LaneIndex) => void;
  /** ⚗️ Forge (2026-06-13) : carte posée sur la forge de chaque camp. */
  forgeYou?: CardId | null;
  forgeOpp?: CardId | null;
  /** Tap sur TA forge : dépôt (carte sélectionnée) / fusion (partenaire) /
   *  reprise (rien de sélectionné). */
  onForgeTap?: () => void;
  /** Bump à chaque fusion réussie — déclenche le flash ⚗️. */
  forgeFlashKey?: number | null;
  /** Bump quand on récupère la carte fusionnée — poussière d'or de rappel. */
  forgeRecoverKey?: number | null;
  /** Étát visuel de TA forge selon la sélection : "deposit" (pulse dépôt),
   *  "fuse" (pulse OR partenaire prêt), null. */
  forgeHighlight?: "deposit" | "fuse" | null;
  /** Hauteur px mesurée du slot (BoardFillSlot). Posée en hauteur EXPLICITE sur
   *  la racine du board → le pad `flex-1` la remplit de façon FIABLE sur le
   *  WebView (≠ flex profond), sans scaler les cartes. 0 = pas encore mesuré. */
  fillHeight?: number;
}
