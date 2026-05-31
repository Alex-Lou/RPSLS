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
 *  pushed outside the visible (typically rounded-full) crop. The badge
 *  PNGs are already cleanly framed in their own dark hexagon, so 1 is
 *  enough. Uploaded photos use 1 too. */
export function avatarScale(v: string): number {
  if (v.includes("/chibi_")) return 1.6;
  return 1;
}

/** CSS style object to drop on an `<img>` so the avatar zooms in by the
 *  correct factor. Convenience wrapper around avatarScale(). */
export function avatarImgStyle(v: string): import("react").CSSProperties {
  const s = avatarScale(v);
  return s === 1 ? {} : { transform: `scale(${s})` };
}
