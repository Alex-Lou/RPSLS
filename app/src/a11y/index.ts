/**
 * a11y helpers — small functions and constants used to give every
 * interactive element a sane label, focus-visible ring, and live-region
 * behaviour without scattering ARIA boilerplate across the codebase.
 *
 * Keep this file < 60 LoC. The actual JSX bits live in `a11y/VisuallyHidden.tsx`.
 */

/**
 * Standard focus-visible classes — apply to any button / link / select.
 * Tailwind-only, no custom CSS. Pairs the violet ring with a soft offset
 * so the ring doesn't visually fight the element's own gradient border.
 */
export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950";

/**
 * Build an accessible name for a move-pick button. Used by PickerBar &
 * deck UI so screen readers say "Pick rock" rather than just announcing
 * "button". The translator passes the localized move noun.
 */
export function moveButtonLabel(localizedMove: string): string {
  return `Pick ${localizedMove}`;
}

/**
 * Build an accessible label for a card play button. The pattern is the
 * one Apple HIG / Material recommend — verb first, object second.
 */
export function cardPlayLabel(cardName: string, cost: number): string {
  return `Play card ${cardName}, costs ${cost} mana`;
}

/**
 * Build a label for an avatar tile in the picker grid. We don't want
 * screen readers to enumerate each PNG's filename, so we describe it
 * by its theme + position.
 */
export function avatarTileLabel(index: number, total: number): string {
  return `Avatar option ${index + 1} of ${total}`;
}

/**
 * Wrap a number in a live-region announcement. Use when a value the
 * player needs to know about (score, LP, mana) changes mid-match — the
 * screen reader can re-read it without re-reading the whole panel.
 */
export function liveAnnouncement(label: string, value: string | number): string {
  return `${label}: ${value}`;
}
