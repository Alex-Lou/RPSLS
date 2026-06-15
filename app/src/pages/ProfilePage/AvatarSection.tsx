import { useRef } from "react";
import { useStore } from "../../store/store";
import { useT } from "../../i18n";
import { isAvatarImage, avatarImgStyle } from "../../theme/avatar";
import { resizeImageToDataUrl, ResizeImageError } from "../../util/resizeImage";
import { AVATAR_PRESETS } from "./avatarPresets";

export function AvatarSection() {
  const player = useStore((s) => s.player);
  const updateProfile = useStore((s) => s.updateProfile);
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);

  /** Accept any photo: load it, fit it in a 512×512 canvas, JPEG-encode at
   *  ~0.8 quality, and store the resulting data URL on the player. This
   *  replaces the previous hard 200 KB reject — big phone-camera shots
   *  now just get scaled down silently instead of being refused. */
  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    // Hard guard against absurd files (~10 MB+) so we don't OOM the WebView.
    if (f.size > 10 * 1024 * 1024) {
      alert(t("profile.avatar.tooBig"));
      return;
    }
    resizeImageToDataUrl(f, { maxDim: 512, mime: "auto" })
      .then((resized) => updateProfile({ avatar: resized }))
      .catch((err: ResizeImageError) => {
        if (err.kind === "decode") alert(t("profile.avatar.invalid"));
      });
  };

  return (
    <section className="bg-surface border border-hairline rounded-3xl p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted mb-3">Avatar</h2>
      <div className="flex flex-wrap gap-2">
        {AVATAR_PRESETS.map((a) => {
          const img = isAvatarImage(a);
          return (
            <button
              key={a}
              onClick={() => updateProfile({ avatar: a })}
              className={
                "w-14 h-14 overflow-hidden flex items-center justify-center transition " +
                // PNG stickers are circle-cropped and scaled past their
                // baked-in white "sticker outline" so only the artwork
                // shows. Emoji slots keep the squared frame for affordance.
                (img
                  ? "rounded-full bg-transparent " +
                    (player.avatar === a ? "ring-2 ring-white/40" : "hover:ring-1 hover:ring-white/15")
                  : "rounded-2xl border " + (player.avatar === a
                      ? "border-white/40 ring-2 ring-white/20 bg-hairline"
                      : "border-hairline bg-hairline hover:bg-hairline"))
              }
            >
              {img ? (
                <img
                  src={a}
                  alt=""
                  className="w-full h-full object-cover"
                  style={avatarImgStyle(a)}
                  draggable={false}
                />
              ) : (
                <span className="text-2xl">{a}</span>
              )}
            </button>
          );
        })}
        <button
          onClick={() => fileRef.current?.click()}
          className="w-12 h-12 rounded-2xl flex flex-col items-center justify-center text-[10px] border border-dashed border-white/20 bg-hairline hover:bg-hairline hover:border-white/40 transition"
        >
          <span className="text-lg leading-none">⬆</span>
          <span className="text-ink-muted">Upload</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={onUpload}
        />
      </div>
      <p className="text-[11px] text-ink-faint mt-3 leading-snug">
        Upload : image <b className="text-ink-muted">carrée</b> (1:1), PNG ou JPG — <b className="text-ink-muted">512×512</b> recommandé. Elle est recadrée en cercle et compressée automatiquement.
      </p>
    </section>
  );
}
