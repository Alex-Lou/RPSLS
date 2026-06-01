/**
 * avatar.ts — tiny helpers shared by every surface that renders the
 * player's (or an opponent's) avatar.
 *
 * Stored avatar values can be:
 *  - an emoji string (legacy / fallback)
 *  - a /Profile miniatures/<id>.png path (16 themed presets)
 *  - a data: URL (uploaded photo, JPEG-compressed at upload time)
 *
 * The two helpers below let any consumer pick the right rendering branch
 * AND the right zoom factor without re-implementing the regex / scale
 * heuristic in every file.
 */

/** True when a stored avatar value should be rendered as an <img> rather
 *  than a text node. */
export function isAvatarImage(v: string): boolean {
  return v.startsWith("data:") || v.startsWith("/") || v.startsWith("http");
}

/** Per-PNG zoom factor so the chibi stickers' wide white outline gets
 *  pushed outside the visible crop. */
export function avatarScale(v: string): number {
  if (v.includes("/chibi_")) return 2.0;
  return 1;
}

/** CSS style for an avatar <img>: a hard `clip-path: circle(...)` (vs the
 *  previously-tried mask-image radial-gradient, which isn't reliably
 *  honoured by the Tauri Android WebView on every device), plus the
 *  per-PNG zoom. Hard clip = anything outside the inscribed circle is
 *  alpha-0, no exceptions. The chibi's baked-in white sticker outline
 *  lives outside that circle once we scale-2.0, so it never paints. */
export function avatarImgStyle(v: string): import("react").CSSProperties {
  const s = avatarScale(v);
  return {
    clipPath: "circle(46% at 50% 50%)",
    WebkitClipPath: "circle(46% at 50% 50%)",
    transform: s === 1 ? undefined : `scale(${s})`,
  };
}
