/**
 * format.ts — shared number formatting, locale-aware.
 *
 * Single source for "print a number for the player". Replaces the
 * `n.toLocaleString("fr-FR")` that was copy-pasted across ~7 components and
 * forced French grouping on EVERY locale (an English player saw "1 234"
 * instead of "1,234"). The app's locale codes (en, fr, es, …) are valid BCP-47
 * language tags, so they pass straight to Intl.
 */

import { useStore } from "../store/store";

/** Active app locale as a tag for Intl. Read non-reactively — callers are
 *  components that already re-render on locale change (via `t()`). */
function activeLocale(): string {
  return useStore.getState().locale || "en";
}

/** Integer with the active locale's thousands grouping (1 234 / 1,234). */
export function formatNumber(n: number): string {
  return n.toLocaleString(activeLocale());
}

/** Show the FULL amount up to 99 999 (with grouping so a balance stays
 *  readable), then compact "100k / 1.2M" once a chip would overflow. Was
 *  inlined in CurrencyBadges (Alex: bare "9k" was unreadable AND cryptic). */
export function formatCompact(n: number): string {
  if (n < 100_000) return n.toLocaleString(activeLocale());
  if (n < 1_000_000) return Math.round(n / 1000) + "k";
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
}
