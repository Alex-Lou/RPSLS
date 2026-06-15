import type { BackgroundId, PadId, ThemeId } from "../../types";

export interface Arena {
  side: "you" | "opp";
  themeId: ThemeId;
  padId: PadId;
  /** Backdrop scene used during the duel. The winning side's WHOLE LOOK
   *  dresses the board — bg + theme + pad — so when the coin gives the
   *  duel to the opponent the player sees the opponent's universe, not
   *  just their pad. */
  backgroundId: BackgroundId;
}

/** Wiring for online double-confirmation mode. When supplied, the screen
 *  hides the local coin trigger and instead drives the flip from server
 *  events. */
export interface OnlinePrep {
  /** True once THIS player has sent `prep_ready`. */
  youReady: boolean;
  /** True once the opponent has sent `prep_ready`. */
  oppReady: boolean;
  /** Side that won the coin (translated from the server's `start_coin_flip`
   *  PlayerSlot into this client's perspective). `null` until the server
   *  has sent it — animation stays idle. */
  coinWinner: "you" | "opp" | null;
  /** Send `prep_ready` to the server. Called when the user taps the ready
   *  button; idempotent on the server side, so the screen doesn't enforce
   *  one-shot behaviour. */
  onReady: () => void;
  /** False when the underlying WebSocket is reconnecting / dropped. Gates
   *  the ready button so the user sees the connection state instead of a
   *  silent queue into OnlineClient's offline buffer. */
  connectionAlive: boolean;
}
