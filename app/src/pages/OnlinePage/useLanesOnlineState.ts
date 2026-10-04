/**
 * État Constellation Lanes de la page En ligne (match, round, résultat, fin,
 * préparation). Extrait verbatim d'OnlinePage — mêmes useState, même ordre.
 */
import { useState } from "react";
import type {
  LanesMatchInfo,
  LanesRoundData,
  LanesRoundResultData,
  LanesEndData,
} from "../../match/LanesMatchView";

export function useLanesOnlineState() {
  // Constellation Lanes state — all messages land here so LanesMatchView
  // is a pure view and never races with a late mount.
  const [lanesMatch, setLanesMatch] = useState<LanesMatchInfo | null>(null);
  const [lanesRound, setLanesRound] = useState<LanesRoundData | null>(null);
  const [lanesLastResult, setLanesLastResult] = useState<LanesRoundResultData | null>(null);
  const [lanesEnd, setLanesEnd] = useState<LanesEndData | null>(null);
  const [lanesSubmitted, setLanesSubmitted] = useState(false);

  // Pre-match prep — drives MatchPrepScreen in lanes_prep phase. `coinWinner`
  // is the side (from THIS client's POV) the server flipped to; null until
  // `start_coin_flip` arrives. The arena (theme + pad + backdrop) is derived
  // on render from `coinWinner` + the opponent persona, no extra state needed.
  // Reset every time a fresh `lanes_match_found` lands so a rematch starts
  // clean.
  const [prepReadyState, setPrepReadyState] = useState<{ you: boolean; opp: boolean }>({ you: false, opp: false });
  const [prepCoinWinner, setPrepCoinWinner] = useState<"you" | "opp" | null>(null);

  return {
    lanesMatch, setLanesMatch,
    lanesRound, setLanesRound,
    lanesLastResult, setLanesLastResult,
    lanesEnd, setLanesEnd,
    lanesSubmitted, setLanesSubmitted,
    prepReadyState, setPrepReadyState,
    prepCoinWinner, setPrepCoinWinner,
  };
}
