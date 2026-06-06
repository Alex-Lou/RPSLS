/**
 * arena.tsx — match-scoped "arena" override (theme + pad).
 *
 * The pre-match coin flip (MatchPrepScreen) can decide that the OPPONENT's
 * battle pad dresses the board for the duration of a duel. Rather than
 * persist the player's pad (risky) or prop-drill through every sub-phase,
 * we expose the override via a tiny context: the match view wraps its tree
 * in <ArenaPadProvider>, and LanesBoard reads the override, falling back to
 * the player's own pad when there is none (so nothing changes outside a
 * coin-flipped duel).
 *
 * The THEME half of the arena is applied separately by the caller via a
 * CSS-var snapshot/restore (see PlayPage) — it's global by nature.
 */

import { createContext, useContext } from "react";
import type { PadId } from "../types";

/** null = no override → use the player's own pad. */
const ArenaPadContext = createContext<PadId | null>(null);

export const ArenaPadProvider = ArenaPadContext.Provider;

/** Resolve the pad to render: the arena override if any, else the player's. */
export function useArenaPad(playerPad: PadId): PadId {
  const override = useContext(ArenaPadContext);
  return override ?? playerPad;
}
