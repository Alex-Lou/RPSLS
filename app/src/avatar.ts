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

/** Whitelist of allowed data: MIME types for avatars. Any data: URL whose
 *  prefix doesn't match one of these is rejected — prevents a tampered
 *  localStorage from smuggling a `data:image/svg+xml,<svg onload=...>`
 *  payload (self-XSS only, but cheap to close). */
const SAFE_DATA_PREFIXES = [
  "data:image/png;base64,",
  "data:image/jpeg;base64,",
  "data:image/webp;base64,",
];

/** True when a stored avatar value should be rendered as an <img> rather
 *  than a text node. data: URLs are only accepted for the three raster
 *  MIME types we ourselves produce via canvas.toDataURL. /assets and http(s)
 *  URLs are passed through as-is. */
export function isAvatarImage(v: string): boolean {
  if (v.startsWith("data:")) {
    return SAFE_DATA_PREFIXES.some((p) => v.startsWith(p));
  }
  return v.startsWith("/") || v.startsWith("http");
}

/** Per-PNG zoom factor. The new chibis ship without white sticker outlines
 *  (clean transparent PNGs) so we no longer need the 2.0 zoom-and-crop hack
 *  that used to push the halo off-screen — everything renders at native
 *  scale now, full body visible. */
export function avatarScale(_v: string): number {
  return 1;
}

/** CSS style for an avatar <img>: a soft `clip-path: circle(...)` (vs the
 *  previously-tried mask-image radial-gradient, which isn't reliably
 *  honoured by the Tauri Android WebView on every device). At 50% the
 *  circle is inscribed in the square — full chibi body visible, just the
 *  four square corners shaved off. */
export function avatarImgStyle(_v: string): import("react").CSSProperties {
  return {
    clipPath: "circle(50% at 50% 50%)",
    WebkitClipPath: "circle(50% at 50% 50%)",
  };
}
