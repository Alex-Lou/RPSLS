import { BG_DEFAULT_THEME, resolveFontFamily, type BackgroundDef } from "../../theme/themes";
import { THEMES } from "../../theme/theme";
import { BattlePad } from "../../BattlePad";
import { LazyMount } from "../../fx/LazyMount";

/** Vignette « réelle » d'une apparence, construite avec les données que le
 *  code possède déjà (aucune capture d'écran n'existe pour les scènes WebGL) :
 *   - fond de base = couleur de fond de la palette HUD assortie ;
 *   - halos = couleurs d'accent de la scène ;
 *   - « Aa » dans la police titre du skin + 2 pastilles = couleurs du HUD ;
 *   - mini-tapis assorti (vrai BattlePad figé, monté paresseusement).
 *  Chaque apparence se distingue donc visuellement (avant : le même dégradé
 *  générique partout). Le parent gère badges et sélection. */
export function AppearanceThumb({ bg, customUrl }: { bg: BackgroundDef; customUrl?: string }) {
  // Image du joueur : on montre simplement l'image.
  if (bg.custom) {
    return customUrl ? (
      <div
        className="absolute inset-0"
        style={{ backgroundImage: `url("${customUrl}")`, backgroundSize: "cover", backgroundPosition: "center" }}
      />
    ) : (
      <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.04)_0_8px,transparent_8px_16px)]" />
    );
  }

  const themeId = BG_DEFAULT_THEME[bg.id];
  const hud = themeId ? THEMES[themeId] : null;
  // « Original » n'a ni accent ni palette imposée : on reprend le dégradé
  // par défaut de l'app (violet / turquoise).
  const from = bg.accent?.from ?? hud?.primary ?? "#7c5cff";
  const to = bg.accent?.to ?? hud?.secondary ?? "#2dd4bf";
  const base = hud?.bg ?? "#0b0d12";
  const primary = hud?.primary ?? from;
  const secondary = hud?.secondary ?? to;
  const lightBase = isLight(base);

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: base }}>
      {/* Halos d'accent de la scène. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            `radial-gradient(90% 75% at 12% 8%, ${from}${lightBase ? "66" : "b3"}, transparent 62%), ` +
            `radial-gradient(85% 80% at 96% 96%, ${to}${lightBase ? "55" : "99"}, transparent 60%)`,
        }}
      />
      {/* Grain d'étoiles léger pour les scènes sombres. */}
      {!lightBase && (
        <div
          aria-hidden
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(1px 1px at 22% 38%, #fff8, transparent), radial-gradient(1px 1px at 64% 22%, #fff6, transparent)," +
              "radial-gradient(1px 1px at 82% 58%, #fff5, transparent), radial-gradient(1px 1px at 40% 70%, #fff4, transparent)",
          }}
        />
      )}
      {/* Typo + couleurs du HUD. */}
      <div className="absolute left-2 bottom-1.5 flex items-end gap-1.5">
        <span
          className="text-[22px] leading-none font-bold"
          style={{
            fontFamily: resolveFontFamily(bg.skin.fontHeadline),
            color: lightBase ? primary : "#fff",
            textShadow: lightBase ? "none" : `0 0 10px ${from}`,
          }}
        >
          Aa
        </span>
        <span className="flex gap-0.5 mb-0.5" aria-hidden>
          <span className="w-2.5 h-2.5 rounded-full ring-1 ring-white/40" style={{ background: primary }} />
          <span className="w-2.5 h-2.5 rounded-full ring-1 ring-white/40" style={{ background: secondary }} />
        </span>
      </div>
      {/* Mini-tapis assorti (figé : zéro animation dans la grille). */}
      {bg.defaultPadId && (
        <div className="absolute right-1.5 bottom-1.5 w-[44%] aspect-[3/2] rounded-md overflow-hidden ring-1 ring-white/25 shadow-lg shadow-black/50 bg-black/40">
          <LazyMount className="absolute inset-0 w-full h-full">
            <BattlePad padId={bg.defaultPadId} frozen compact className="w-full h-full" />
          </LazyMount>
        </div>
      )}
    </div>
  );
}

/** Luminance approximative d'une couleur #rrggbb (fonds clairs : Ink…). */
function isLight(hex: string): boolean {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 150;
}
