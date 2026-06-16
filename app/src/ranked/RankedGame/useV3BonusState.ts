import { useRef, useState } from "react";
import type { Move } from "../../engine/game";
import type { CardId } from "../rankedTypes";

/**
 * useV3BonusState — DÉCLARATIONS d'état pur des cartes bonus V3 (+ Mascarade),
 * extraites VERBATIM de RankedGame (lignes 237-325). Uniquement des
 * useRef/useState + leurs setters combinés ref↔state (jamais contournés →
 * préserve l'invariant anti-drift). AUCUNE logique de match / timing ici.
 *
 * L'orchestrateur destructure TOUT le retour avec les MÊMES noms → le cœur de
 * match (startNextRound/resolveAndAdvance/rematch) reste byte-identique (il
 * référence braiseStacksRef/setBraiseStacks/gaiaChargedRef/… comme avant). Le
 * SÉQUENÇAGE des resets (bloc Genèse, rematch) reste piloté dans l'orchestrateur.
 */
export function useV3BonusState() {
  /** Mascarade (Bluff): when set, the NEXT round's CPU decision is computed
   *  from an empty history so the hard AI can't read the player's habits —
   *  the player's disinformation lands one round later (consumed at draw). */
  const mascaradePoisonRef = useRef(false);
  const [mascaradePoison, setMascaradePoisonState] = useState(false);
  const setMascaradePoison = (b: boolean) => {
    mascaradePoisonRef.current = b;
    setMascaradePoisonState(b);
  };

  /* ──────────── V3 bonus-card state ──────────── */
  /** Braise (Ember): once played, each subsequent ROUND LOST shaves 1 mana off
   *  the cost of your next card (cumulative, min cost = 1). The discount is
   *  reset to 0 every time a card is actually played. Ref + state mirror —
   *  the ref lives across renders for synchronous logic; the state drives the
   *  CardHand pip/playable display so the player SEES the discount. */
  const braiseActiveRef = useRef(false);
  const braiseStacksRef = useRef(0);
  const [braiseStacks, setBraiseStacksState] = useState(0);
  // Helper so the ref and the state never drift.
  const setBraiseStacks = (n: number) => {
    braiseStacksRef.current = n;
    setBraiseStacksState(n);
  };
  /** Extra mana granted at the start of the NEXT round only — fed by Offre
   *  (+2), Sablier (+1). Consumed in startNextRound. Ref + state mirror so
   *  the UI can show "+N mana prochain round" as a chip. */
  const bonusManaNextRoundRef = useRef(0);
  const [bonusManaNext, setBonusManaNextState] = useState(0);
  const setBonusManaNext = (n: number) => {
    bonusManaNextRoundRef.current = n;
    setBonusManaNextState(n);
  };
  /** Permanent mana-cap boost from Marchand d'Âmes (+3, repeatable). */
  const manaMaxBoostRef = useRef(0);
  /** Cascade armed this round: after resolve, fill hand to 3 on win / dump
   *  hand on loss. Ref + state mirror for the chip. */
  const cascadeArmedRef = useRef(false);
  const [cascadeArmed, setCascadeArmedState] = useState(false);
  const setCascadeArmed = (b: boolean) => {
    cascadeArmedRef.current = b;
    setCascadeArmedState(b);
  };
  /** Cascade just paid off: next round's draws are free (mana-discounted).
   *  Implemented by clearing the cost of the first card played next round. */
  const cascadeFreeNextRoundRef = useRef(false);
  /** Écho temporel: if armed and the round ends in YOUR loss, the result is
   *  rewritten as a draw — your card is refunded, no discard penalty. The
   *  CPU isn't actually rewound (their cards are kept) — it's a "stop-loss". */
  const echoActiveRef = useRef(false);
  const [echoActive, setEchoActiveState] = useState(false);
  const setEchoActive = (b: boolean) => {
    echoActiveRef.current = b;
    setEchoActiveState(b);
  };
  /** Ancre temporelle snapshot: state to restore if you lose the next 2 rounds.
   *  Cleared if you win any of them. */
  const anchorSnapshotRef = useRef<{
    winsA: number; winsB: number;
    hand: CardId[]; deck: CardId[]; discard: CardId[]; usedOneShotCards: CardId[];
  } | null>(null);
  /** Rounds left on the anchor watch (2 → 1 → 0). */
  const anchorRoundsLeftRef = useRef(0);
  const [anchorRoundsLeft, setAnchorRoundsLeftState] = useState(0);
  const setAnchorRoundsLeft = (n: number) => {
    anchorRoundsLeftRef.current = n;
    setAnchorRoundsLeftState(n);
  };
  /** Anchor loss-streak counter — increments per loss while watching, restores at 2. */
  const anchorLossStreakRef = useRef(0);
  /** Gaïa (Bouclier de Gaïa): passive, charged at match start if equipped.
   *  Consumed once per match the first time the round would be a loss. */
  const gaiaChargedRef = useRef(false);
  const [gaiaCharged, setGaiaChargedState] = useState(false);
  const setGaiaCharged = (b: boolean) => {
    gaiaChargedRef.current = b;
    setGaiaChargedState(b);
  };
  /** Once-per-match limiter for Paradoxe Temporel. */
  const paradoxeUsedRef = useRef(false);
  /** Once-per-match limiter for Genèse. */
  const genesisUsedRef = useRef(false);
  /** Fardeau (Burden): force the CPU to play this card NEXT round (consumed). */
  const fardeauNextCpuRef = useRef<CardId | null>(null);
  /** Previous round's CPU picks — used by Rémanence to summon the ghost of the
   *  opponent's last move on a chosen lane. */
  const prevOppPicksRef = useRef<Move[] | null>(null);
  /** Oracle Inverse (Mind Reader): the 3 random CPU-hand cards revealed this
   *  round. Shown as a soft chip strip during pick phase. Cleared at next round. */
  const [oppHandRevealed, setOppHandRevealed] = useState<CardId[] | null>(null);
  /** Genèse pending reset — applied at the start of next round. */
  const genesisPendingRef = useRef(false);

  return {
    mascaradePoisonRef, mascaradePoison, setMascaradePoison,
    braiseActiveRef, braiseStacksRef, braiseStacks, setBraiseStacks,
    bonusManaNextRoundRef, bonusManaNext, setBonusManaNext,
    manaMaxBoostRef,
    cascadeArmedRef, cascadeArmed, setCascadeArmed,
    cascadeFreeNextRoundRef,
    echoActiveRef, echoActive, setEchoActive,
    anchorSnapshotRef, anchorRoundsLeftRef, anchorRoundsLeft, setAnchorRoundsLeft,
    anchorLossStreakRef,
    gaiaChargedRef, gaiaCharged, setGaiaCharged,
    paradoxeUsedRef, genesisUsedRef, fardeauNextCpuRef, prevOppPicksRef,
    oppHandRevealed, setOppHandRevealed,
    genesisPendingRef,
  };
}
