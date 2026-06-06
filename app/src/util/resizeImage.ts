/**
 * resizeImage — read a user-uploaded File, downscale it to fit a max edge,
 * and return a data: URL ready to drop into localStorage.
 *
 * Single source of truth for the three upload paths that previously each
 * inlined `FileReader → new Image → canvas → toDataURL`: avatar (512px,
 * PNG/JPEG auto), custom background (1080px, JPEG), custom pad (1500px,
 * JPEG). When the WebView refuses a 2D canvas context, falls back to the
 * untouched original so the upload still works (just bigger).
 */

export interface ResizeImageOptions {
  /** Max edge length of the output, in pixels. Smaller of width/height wins. */
  maxDim: number;
  /** Output format. `"auto"` keeps a small source PNG as PNG, else JPEG —
   *  used by the avatar path so transparent sprites don't get JPEG halos. */
  mime?: "image/jpeg" | "image/png" | "auto";
  /** Quality 0..1 for lossy formats. Defaults to 0.82. */
  quality?: number;
  /** "auto" PNG threshold: source PNGs under this size stay PNG. */
  autoPngMaxBytes?: number;
}

export class ResizeImageError extends Error {
  constructor(public readonly kind: "decode" | "read") {
    super(`resizeImage: ${kind} failed`);
    this.name = "ResizeImageError";
  }
}

export function resizeImageToDataUrl(
  file: File,
  opts: ResizeImageOptions,
): Promise<string> {
  const quality = opts.quality ?? 0.82;
  const autoPngMaxBytes = opts.autoPngMaxBytes ?? 100 * 1024;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new ResizeImageError("read"));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onerror = () => reject(new ResizeImageError("decode"));
      img.onload = () => {
        const ratio = Math.min(1, opts.maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        // No 2D context (very old WebView?) — return the original data URL.
        // The caller decided this file was acceptable size-wise, so this is
        // a soft fallback, not a failure.
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const requested = opts.mime ?? "image/jpeg";
        const mime =
          requested === "auto"
            ? file.type === "image/png" && file.size < autoPngMaxBytes
              ? "image/png"
              : "image/jpeg"
            : requested;
        resolve(canvas.toDataURL(mime, quality));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
