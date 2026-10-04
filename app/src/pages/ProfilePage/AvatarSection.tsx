import { useRef, useState } from "react";
import { useStore } from "../../store/store";
import { useT } from "../../i18n";
import { isAvatarImage, avatarImgStyle } from "../../theme/avatar";
import { resizeImageToDataUrl, ResizeImageError } from "../../util/resizeImage";
import { AVATAR_PRESETS } from "./avatarPresets";
import { SectionCard } from "./SectionCard";

/** Nombre d'avatars visibles replié (2 rangées de 5 avec la tuile Importer). */
const COLLAPSED = 9;

/** Profil › Avatar. Grille dense (5 colonnes) repliée par défaut sur 2
 *  rangées — l'ancienne grille de 29 avatars faisait ~500 px de haut. */
export function AvatarSection() {
  const avatar = useStore((s) => s.player.avatar);
  const updateProfile = useStore((s) => s.updateProfile);
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(false);

  /** Toute photo acceptée : redimensionnée dans 512×512, compressée, stockée
   *  en data URL sur le joueur (plus de refus à 200 Ko). */
  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    // Garde-fou contre les fichiers absurdes (~10 Mo+) pour ne pas saturer la WebView.
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

  // Replié : les premiers presets, en gardant l'avatar actif visible.
  let visible = AVATAR_PRESETS;
  if (!expanded) {
    visible = AVATAR_PRESETS.slice(0, COLLAPSED);
    if (AVATAR_PRESETS.includes(avatar) && !visible.includes(avatar)) {
      visible = [...visible.slice(0, COLLAPSED - 1), avatar];
    }
  }

  return (
    <SectionCard title={t("profile.avatar.title")}>
      <div className="grid grid-cols-5 gap-2">
        {visible.map((a) => {
          const img = isAvatarImage(a);
          const active = avatar === a;
          return (
            <button
              key={a}
              type="button"
              aria-pressed={active}
              onClick={() => updateProfile({ avatar: a })}
              className={
                "aspect-square w-full overflow-hidden flex items-center justify-center transition " +
                // Stickers PNG recadrés en cercle (au-delà du contour blanc
                // intégré) ; les emojis gardent un cadre carré.
                (img
                  ? "rounded-full " + (active ? "ring-2 ring-white/60" : "hover:ring-1 hover:ring-white/15")
                  : "rounded-2xl border bg-hairline " + (active ? "border-white/40 ring-2 ring-white/20" : "border-hairline"))
              }
            >
              {img ? (
                <img src={a} alt="" className="w-full h-full object-cover" style={avatarImgStyle(a)} draggable={false} loading="lazy" />
              ) : (
                <span className="text-2xl">{a}</span>
              )}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="aspect-square w-full rounded-2xl flex flex-col items-center justify-center gap-0.5 text-[10px] border border-dashed border-white/25 bg-hairline hover:border-white/45 transition"
        >
          <span className="text-base leading-none" aria-hidden>⬆</span>
          <span className="text-ink-muted font-semibold">{t("profile.avatar.upload")}</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={onUpload}
        />
      </div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="mt-3 w-full py-2 rounded-xl text-xs font-semibold text-ink-muted bg-hairline border border-hairline hover:text-ink"
      >
        {expanded ? t("profile.avatar.showLess") : t("profile.avatar.showAll", { n: AVATAR_PRESETS.length })}
      </button>
      <p className="text-[11px] text-ink-faint mt-3 leading-snug">{t("profile.avatar.hint")}</p>
    </SectionCard>
  );
}
