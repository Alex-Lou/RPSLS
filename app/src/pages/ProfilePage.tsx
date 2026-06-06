import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { useStore } from "../store/store";
import { THEMES, gradientFromTheme } from "../theme/theme";
import { levelFromXp } from "../engine/leveling";
import { DIFFICULTY_META, PAD_META } from "../types";
import type { BackgroundId, Difficulty, PadId, ThemeId } from "../types";
import { BACKGROUNDS, BG_DEFAULT_THEME } from "../theme/themes";
import { isAvatarImage, avatarImgStyle } from "../theme/avatar";
import { MOVES } from "../engine/game";
import { BattlePad } from "../BattlePad";
import { LazyMount } from "../fx/LazyMount";
import { resizeImageToDataUrl, ResizeImageError } from "../util/resizeImage";
import { TabPicker } from "../ui/TabPicker";
import { PremiumPurchaseModal, type PremiumSet } from "../ui/PremiumPurchaseModal";
import { PremiumBadge } from "../ui/PremiumBadge";
import { QuartzBackdrop } from "../backdrops/QuartzBackdrop";
import { useT } from "../i18n";
import { hapticTap, hapticMatchStart } from "../haptic";
import { useBackdropPeek } from "../backdrops/previewScene";

/** 17 themed PNG avatars under /public/Profile miniatures/.
 *  Mix of 8 dark-fantasy badge sigils and 9 cute kawaii chibis (one per
 *  RPSLS move + 3 gaming staples + 1 frost dragon). Custom uploads still
 *  work alongside. */
const AVATAR_PRESETS: string[] = [
  // Premium "hero" emblems — drop a new hero_*.png in /public/Profile miniatures
  // and add one line here to extend the set (clean, renewable chain).
  "/Profile miniatures/hero_king.png",
  "/Profile miniatures/hero_royal.png",
  "/Profile miniatures/hero_oracle.png",
  "/Profile miniatures/hero_frost.png",
  "/Profile miniatures/hero_zen.png",
  "/Profile miniatures/hero_sage.png",
  "/Profile miniatures/hero_serpent.png",
  "/Profile miniatures/hero_elf.png",
  "/Profile miniatures/hero_jester.png",
  "/Profile miniatures/hero_knight.png",
  "/Profile miniatures/hero_guardian.png",
  "/Profile miniatures/hero_fox.png",
  "/Profile miniatures/hero_shard.png",
  "/Profile miniatures/badge_crown.png",
  "/Profile miniatures/badge_eye.png",
  "/Profile miniatures/badge_shield.png",
  "/Profile miniatures/badge_lightning.png",
  "/Profile miniatures/badge_phoenix.png",
  "/Profile miniatures/badge_galaxy.png",
  "/Profile miniatures/badge_skull.png",
  "/Profile miniatures/badge_wave.png",
  "/Profile miniatures/chibi_rock.png",
  "/Profile miniatures/chibi_paper.png",
  "/Profile miniatures/chibi_scissors.png",
  "/Profile miniatures/chibi_lizard.png",
  "/Profile miniatures/chibi_spock.png",
  "/Profile miniatures/chibi_gamepad.png",
  "/Profile miniatures/chibi_d20.png",
  "/Profile miniatures/chibi_dragon_blue.png",
  "/Profile miniatures/chibi_crown.png",
];


export function ProfilePage() {
  const player = useStore((s) => s.player);
  const updateProfile = useStore((s) => s.updateProfile);
  const resetProfile = useStore((s) => s.resetProfile);
  const t = useT();

  const [editingNick, setEditingNick] = useState(false);
  const [nickDraft, setNickDraft] = useState(player.nickname);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bgFileRef = useRef<HTMLInputElement>(null);
  const padFileRef = useRef<HTMLInputElement>(null);
  // One "Style" card, two tabs: Apparences (a full look — background + HUD
  // colours + fonts + matched pad, applied together) and Pads (override just
  // the playmat). Picking an appearance links the whole look by default.
  const [cosmeticTab, setCosmeticTab] = useState<"appearance" | "pads">("appearance");
  /** When non-null, the premium purchase modal is open for this set id. */
  const [premiumModalSetId, setPremiumModalSetId] = useState<string | null>(null);
  // Inside the Pads tab, three buckets: flashy themed pads / plain illustrative
  // SVG pads / imported images — kept apart because the plain SVGs looked off
  // mixed in with the flashy ones.
  const [padTab, setPadTab] = useState<"styled" | "svg" | "img">("styled");
  const [previewPad, setPreviewPad] = useState<PadId | null>(null);
  const peek = useBackdropPeek((s) => s.peek);
  const setPeek = useBackdropPeek((s) => s.setPeek);
  // Guards the ghost-click: the same tap that opens the peek must not be the
  // one that dismisses it. We ignore dismiss taps for a short window.
  const peekOpenedAt = useRef(0);
  const openPeek = () => { peekOpenedAt.current = performance.now(); setPeek(true); };
  const closePeek = () => { setPeek(false); };
  // Never leave the shell hidden if the page unmounts while peeking.
  useEffect(() => () => setPeek(false), [setPeek]);
  const currentBg = BACKGROUNDS.find((b) => b.id === (player.backgroundId ?? "default"));

  const info = levelFromXp(player.xp);
  const theme = THEMES[player.themeId];
  const totalGames = player.stats.wins + player.stats.losses + player.stats.draws;
  const winRate = totalGames > 0 ? (player.stats.wins / totalGames) * 100 : 0;

  const saveNick = () => {
    const v = nickDraft.trim();
    if (v.length > 0 && v.length <= 20) updateProfile({ nickname: v });
    setEditingNick(false);
  };

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

  /** Personal image library cap. JPEG-encoded at quality 0.82 at MAX×MAX
   *  yields ~150-400 KB each, so 6 images stays well under localStorage's
   *  ~5 MB ceiling alongside the rest of the persisted state. */
  const MAX_CUSTOM_IMAGES = 6;

  /** Upload a personal background: fit within 1080px (portrait-friendly),
   *  JPEG-compress, prepend to the library (deduped, capped), and select
   *  it as the active background. */
  const onUploadBg = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 12 * 1024 * 1024) { alert(t("profile.avatar.tooBig")); return; }
    resizeImageToDataUrl(f, { maxDim: 1080 })
      .then((dataUrl) => {
        const prev = (useStore.getState().player.customBgs ?? []).filter((u) => u !== dataUrl);
        const next = [dataUrl, ...prev].slice(0, MAX_CUSTOM_IMAGES);
        updateProfile({ customBgUrl: dataUrl, customBgs: next, backgroundId: "custom" });
      })
      .catch((err: ResizeImageError) => {
        if (err.kind === "decode") alert(t("profile.avatar.invalid"));
      });
    // Allow re-uploading the same file (browsers ignore identical-value selects).
    e.target.value = "";
  };

  /** Upload a personal battle pad: fit within 1500px (landscape 3:2-friendly),
   *  JPEG-compress, prepend to the library, and select it as the active pad. */
  const onUploadPad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 12 * 1024 * 1024) { alert(t("profile.avatar.tooBig")); return; }
    resizeImageToDataUrl(f, { maxDim: 1500 })
      .then((dataUrl) => {
        const prev = (useStore.getState().player.customPads ?? []).filter((u) => u !== dataUrl);
        const next = [dataUrl, ...prev].slice(0, MAX_CUSTOM_IMAGES);
        updateProfile({ customPadUrl: dataUrl, customPads: next, padId: "custom", padChosen: true });
      })
      .catch((err: ResizeImageError) => {
        if (err.kind === "decode") alert(t("profile.avatar.invalid"));
      });
    e.target.value = "";
  };

  /** Pick an already-imported background — swaps customBgUrl + selects the
   *  custom slot. No new upload needed. */
  const selectStoredBg = (url: string) => {
    updateProfile({ customBgUrl: url, backgroundId: "custom" });
  };
  /** Pick an already-imported pad. */
  const selectStoredPad = (url: string) => {
    updateProfile({ customPadUrl: url, padId: "custom", padChosen: true });
  };
  /** Delete an entry from the bg library. If it was the active background,
   *  fall back to the most-recent remaining entry (or no custom bg). */
  const deleteStoredBg = (url: string) => {
    const list = (player.customBgs ?? []).filter((u) => u !== url);
    const wasActive = player.customBgUrl === url;
    const fallback = list[0];
    updateProfile({
      customBgs: list,
      ...(wasActive
        ? { customBgUrl: fallback, ...(fallback ? {} : { backgroundId: "default" as BackgroundId }) }
        : {}),
    });
  };
  /** Delete an entry from the pad library. */
  const deleteStoredPad = (url: string) => {
    const list = (player.customPads ?? []).filter((u) => u !== url);
    const wasActive = player.customPadUrl === url;
    const fallback = list[0];
    updateProfile({
      customPads: list,
      ...(wasActive
        ? { customPadUrl: fallback, ...(fallback ? {} : { padId: "chalkboard" as PadId }) }
        : {}),
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-3xl mx-auto px-5 pt-2 pb-6 md:p-6 flex flex-col gap-5"
    >
      <h1 className="font-headline text-3xl font-extrabold tracking-tight">{t("nav.profile")}</h1>

      {/* Hero card */}
      <div className="bg-surface border border-hairline rounded-3xl p-6 flex flex-col sm:flex-row gap-6 items-center sm:items-start">
        <div
          className="w-28 h-28 rounded-3xl flex items-center justify-center text-6xl shrink-0 ring-2 shadow-2xl"
          style={{
            background: gradientFromTheme(theme),
          }}
        >
          {isAvatarImage(player.avatar) ? (
            <img
              src={player.avatar}
              alt=""
              className="w-full h-full rounded-3xl object-cover"
              style={avatarImgStyle(player.avatar)}
            />
          ) : (
            <span>{player.avatar}</span>
          )}
        </div>

        <div className="flex-1 w-full">
          {editingNick ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={nickDraft}
                maxLength={20}
                onChange={(e) => setNickDraft(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveNick();
                  if (e.key === "Escape") { setNickDraft(player.nickname); setEditingNick(false); }
                }}
                className="flex-1 bg-hairline rounded-xl px-4 py-2 text-xl font-bold focus:outline-none focus:ring-2 ring-white/30"
              />
              <button
                onClick={saveNick}
                aria-label="Save"
                className="shrink-0 w-10 h-10 rounded-xl bg-emerald-500/40 hover:bg-emerald-500/60 text-white font-bold flex items-center justify-center transition"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l5 5L20 7" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setNickDraft(player.nickname); setEditingNick(true); }}
              className="text-2xl font-bold hover:text-ink-muted transition"
            >
              {player.nickname} <span className="text-ink-faint text-sm font-normal ml-1">✎ edit</span>
            </button>
          )}

          <div className="mt-3 flex flex-wrap gap-4 text-sm text-ink-muted">
            <Stat label="Level"   value={info.level} accent={theme.primary} />
            <Stat label="XP"      value={player.xp} />
            <Stat label="Rank LP" value={player.rankLp} accent={theme.secondary} />
            <Stat label="Games"   value={totalGames} />
            <Stat label="Win %"   value={`${winRate.toFixed(0)}%`} />
          </div>

          <div className="mt-4">
            <div className="h-2 rounded-full bg-hairline overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${info.progress * 100}%`,
                  background: "linear-gradient(90deg, var(--theme-primary), var(--theme-secondary))",
                  boxShadow: "0 0 12px color-mix(in oklab, var(--theme-primary) 50%, transparent)",
                }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-ink-faint">
              <span>{info.xpInLevel} / {info.xpForNext} XP to next level</span>
              <span>Lvl {info.level} → {info.level + 1}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Avatar picker */}
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

      {/* HUD palette moved into the "Apparence" tabs (Background card) below. */}

      {/* CPU difficulty */}
      <section className="bg-surface border border-hairline rounded-3xl p-4 sm:p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted mb-1">
          {t("profile.diff.title")}
        </h2>
        <p className="text-xs text-ink-faint mb-3">
          {t("profile.diff.subtitle")}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          {(Object.keys(DIFFICULTY_META) as Difficulty[]).map((id) => {
            const active = player.difficulty === id;
            return (
              <button
                key={id}
                onClick={() => updateProfile({ difficulty: id })}
                className={
                  "rounded-2xl p-3 border transition flex flex-col items-start gap-1.5 text-left w-full min-w-0 " +
                  (active
                    ? "border-white/40 bg-hairline"
                    : "border-hairline bg-hairline hover:bg-hairline hover:border-white/20")
                }
              >
                <div className="flex items-center gap-2 w-full">
                  <span className="text-xl shrink-0">{DIFFICULTY_META[id].emoji}</span>
                  <span className="font-semibold text-sm flex-1 truncate">{t("diff." + id)}</span>
                  {active && (
                    <span className="text-[9px] uppercase font-bold text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                      {t("profile.diff.active")}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-ink-muted leading-snug">{t("diff." + id + ".desc")}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Haptics — vibration on tap + result */}
      <section className="bg-surface border border-hairline rounded-3xl p-4 sm:p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted mb-1">
          {t("profile.haptic.title")}
        </h2>
        <p className="text-xs text-ink-faint mb-3">
          {t("profile.haptic.subtitle")}
        </p>
        <div className="flex items-center justify-between gap-3 mb-3">
          <span className="text-sm text-ink-muted">{t("profile.haptic.enable")}</span>
          <button
            onClick={() => updateProfile({ hapticEnabled: !(player.hapticEnabled ?? true) })}
            className={
              "w-12 h-7 rounded-full transition relative " +
              ((player.hapticEnabled ?? true)
                ? "bg-emerald-500/70"
                : "bg-zinc-700")
            }
          >
            <span
              className={
                "absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all " +
                ((player.hapticEnabled ?? true) ? "left-[22px]" : "left-0.5")
              }
            />
          </button>
        </div>
        <div className={"grid grid-cols-3 gap-2 " + ((player.hapticEnabled ?? true) ? "" : "opacity-40 pointer-events-none")}>
          {(["low", "med", "high"] as const).map((lvl) => {
            const active = (player.hapticIntensity ?? "med") === lvl;
            return (
              <button
                key={lvl}
                onClick={() => {
                  updateProfile({ hapticIntensity: lvl });
                  // Give a sample buzz at the new level so the player
                  // can actually feel the difference between pills.
                  setTimeout(() => hapticTap(), 60);
                }}
                className={
                  "rounded-xl py-2 text-xs font-semibold border transition " +
                  (active
                    ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-200"
                    : "border-hairline bg-hairline text-ink-muted hover:bg-hairline")
                }
              >
                {t(`profile.haptic.${lvl}`)}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => hapticMatchStart()}
          className={
            "mt-3 w-full py-2 rounded-xl text-xs font-semibold border transition " +
            ((player.hapticEnabled ?? true)
              ? "border-violet-400/40 bg-violet-500/15 text-violet-200 hover:bg-violet-500/25"
              : "opacity-40 pointer-events-none border-hairline bg-hairline text-ink-faint")
          }
        >
          {t("profile.haptic.test")}
        </button>
      </section>

      {/* Style — one card, two tabs. "Apparences" applies a COMPLETE look in a
          single tap (animated background + HUD colours + fonts + matched pad);
          "Pads" only overrides the playmat. Everything is linked by default. */}
      <section className="bg-surface border border-hairline rounded-3xl p-5">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted">Style</h2>
          <TabPicker
            className="ml-auto"
            value={cosmeticTab}
            onChange={setCosmeticTab}
            options={[
              { id: "appearance", label: "Apparences" },
              { id: "pads", label: "Pads" },
            ]}
          />
        </div>

        {cosmeticTab === "appearance" && (
        <>
        <p className="text-xs text-ink-faint mb-3">
          Une apparence applique tout le look d'un coup : fond animé, couleurs du HUD, typo et tapis assorti. Tu pourras changer juste le tapis dans l'onglet Pads. « Mon image » importe la tienne (portrait 9:16, ex. 1080×1920). Jusqu'à {MAX_CUSTOM_IMAGES} en bibliothèque.
        </p>
        <input
          ref={bgFileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={onUploadBg}
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {BACKGROUNDS.map((bg) => {
            const active = (player.backgroundId ?? "default") === bg.id;
            return (
              <button
                key={bg.id}
                onClick={() => {
                  if (bg.custom) {
                    if ((player.customBgs?.length ?? 0) === 0) {
                      bgFileRef.current?.click();
                      return;
                    }
                    updateProfile({ backgroundId: "custom" });
                    openPeek();
                    return;
                  }
                  // Premium gate: if the bg belongs to a premium set the player
                  // doesn't yet own, open the purchase modal instead of applying.
                  if (bg.premiumSetId && !(player.ownedPremiumSets ?? []).includes(bg.premiumSetId)) {
                    setPremiumModalSetId(bg.premiumSetId);
                    return;
                  }
                  // Apply instantly (selection can never fail), then open a
                  // full-screen peek of the now-live animated backdrop. Picking
                  // a background auto-applies its matched pad + HUD palette so
                  // the whole look stays coherent (still overridable after).
                  hapticMatchStart();
                  const patch: Partial<{ backgroundId: BackgroundId; padId: PadId; themeId: ThemeId }> = { backgroundId: bg.id };
                  if (bg.defaultPadId) patch.padId = bg.defaultPadId;
                  const matchedTheme = BG_DEFAULT_THEME[bg.id];
                  if (matchedTheme) patch.themeId = matchedTheme;
                  updateProfile(patch);
                  openPeek();
                }}
                className={
                  "group rounded-2xl border overflow-hidden transition text-left " +
                  (active
                    ? "border-white/40 ring-2 ring-white/20"
                    : "border-hairline hover:border-white/30")
                }
              >
                <div
                  className="aspect-[3/2] w-full relative bg-surface-raised overflow-hidden"
                  style={
                    bg.custom && player.customBgUrl
                      ? { backgroundImage: `url("${player.customBgUrl}")`, backgroundSize: "cover", backgroundPosition: "center" }
                      : bg.src
                      ? { backgroundImage: `url("${bg.src}")`, backgroundSize: "cover", backgroundPosition: "center" }
                      : bg.accent
                      ? {
                          // Coded scene OR accent-only: preview its palette as a
                          // soft two-point glow so the thumbnail telegraphs the
                          // live colours of the procedural backdrop.
                          backgroundImage:
                            `radial-gradient(120% 90% at 15% 0%, ${bg.accent.from}99, transparent 60%), ` +
                            `radial-gradient(120% 90% at 100% 100%, ${bg.accent.to}88, transparent 60%)`,
                        }
                      : {
                          backgroundImage:
                            "radial-gradient(120% 80% at 20% 0%, rgba(124,92,255,0.45), transparent 60%), radial-gradient(120% 80% at 100% 100%, rgba(45,212,191,0.35), transparent 60%)",
                        }
                  }
                >
                  {active && (
                    <div className="absolute top-2 right-2 bg-emerald-500/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      ACTIVE
                    </div>
                  )}
                  {bg.scene && (
                    <div className="absolute top-2 left-2 bg-cyan-500/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      ✦ LIVE
                    </div>
                  )}
                  {bg.premiumSetId && (
                    <PremiumBadge
                      variant="ribbon"
                      label={(player.ownedPremiumSets ?? []).includes(bg.premiumSetId) ? "✓ OWNED" : "PREMIUM"}
                      className="top-2 left-2"
                    />
                  )}
                  {bg.custom && (player.customBgs?.length ?? 0) === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-ink-muted text-xs font-bold">
                      ＋ Importer
                    </div>
                  )}
                  {bg.custom && (player.customBgs?.length ?? 0) > 0 && (
                    <div className="absolute bottom-1.5 right-1.5 bg-black/60 text-ink text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      {player.customBgs?.length} ✦
                    </div>
                  )}
                </div>
                <div className="p-2.5 bg-surface">
                  <div className="flex items-center gap-2">
                    {bg.miniature ? (
                      <img
                        src={bg.miniature}
                        alt=""
                        draggable={false}
                        className="w-7 h-7 shrink-0 object-contain select-none"
                      />
                    ) : null}
                    <span className="text-xs font-semibold truncate">{bg.label}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Personal background library — newest first, "+" tile to add another. */}
        <ImageLibraryRow
          title="Ma bibliothèque d'images"
          items={player.customBgs ?? []}
          activeUrl={player.backgroundId === "custom" ? player.customBgUrl : undefined}
          max={MAX_CUSTOM_IMAGES}
          aspect="aspect-[9/16]"
          onPick={selectStoredBg}
          onDelete={deleteStoredBg}
          onAdd={() => bgFileRef.current?.click()}
        />
        </>
        )}

        {cosmeticTab === "pads" && (
        <>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <p className="text-[11px] text-ink-faint flex-1 min-w-[55%] leading-snug">
            {padTab === "styled"
              ? "Tapis animés et thématiques, assortis à tes apparences."
              : padTab === "svg"
              ? "Tapis sobres et illustrés — un style à part, plus épuré."
              : `Importe ton image (paysage 3:2, ex. 1500×1000). Jusqu'à ${MAX_CUSTOM_IMAGES} en bibliothèque.`}
          </p>
          <TabPicker
            className="ml-auto shrink-0"
            size="sm"
            value={padTab}
            onChange={setPadTab}
            options={[
              { id: "styled", label: "Stylés" },
              { id: "svg", label: "Simples" },
              { id: "img", label: "Images" },
            ]}
          />
        </div>
        <input
          ref={padFileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={onUploadPad}
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(Object.keys(PAD_META) as PadId[]).filter((id) => PAD_META[id].category === padTab).map((id) => {
            const meta = PAD_META[id];
            const active = player.padId === id;
            const isCustom = id === "custom";
            const needsImport = isCustom && (player.customPads?.length ?? 0) === 0;
            return (
              <button
                key={id}
                onClick={() => {
                  if (isCustom) {
                    if ((player.customPads?.length ?? 0) === 0) {
                      padFileRef.current?.click();
                      return;
                    }
                    updateProfile({ padId: "custom", padChosen: true });
                    return;
                  }
                  setPreviewPad(id);
                }}
                className={
                  "group rounded-2xl border overflow-hidden transition text-left " +
                  (active
                    ? "border-white/40 ring-2 ring-white/20"
                    : "border-hairline hover:border-white/30")
                }
              >
                <div className="aspect-[3/2] w-full bg-black/50 relative overflow-hidden"
                  style={{
                    background: `radial-gradient(ellipse 100% 80% at 30% 20%, ${
                      id === "volcanic" ? "#ff450066" :
                      id === "abyss" ? "#00e5c844" :
                      id === "nebula" ? "#9333ea44" :
                      id === "aurora_borealis" ? "#34d39944" :
                      id === "casino_noir" ? "#fbbf2444" :
                      id === "casino" ? "#10b98144" :
                      id === "holy" ? "#fbbf2433" :
                      id === "quantum" ? "#22d3ee44" :
                      id === "galaxy" ? "#a855f744" :
                      id === "neon" ? "#06b6d444" :
                      id === "cyberpunk" ? "#f0abfc44" :
                      id === "cosmos" ? "#6366f144" :
                      id === "aura" ? "var(--theme-primary, #a855f7)44" :
                      "rgba(100,100,120,0.25)"
                    }, transparent 70%), linear-gradient(135deg, rgba(15,15,25,0.95), rgba(25,20,35,0.95))`
                  }}
                >
                  {/* Real pad, frozen on a settled frame — a representative
                      still that entices, with zero animation cost (the full
                      animation plays when the preview is opened). Deferred
                      via LazyMount so opening the Pads tab doesn't synchronously
                      paint all 13 SVG pads at once: they fade in as you scroll. */}
                  {!needsImport && (
                    <LazyMount className="absolute inset-0 w-full h-full">
                      <BattlePad padId={id} frozen compact className="w-full h-full" />
                    </LazyMount>
                  )}
                  {active && (
                    <div className="absolute top-2 right-2 bg-emerald-500/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                      ACTIVE
                    </div>
                  )}
                  {needsImport && (
                    <div className="absolute inset-0 flex items-center justify-center text-ink text-xs font-bold bg-black/45">
                      ＋ Importer
                    </div>
                  )}
                  {isCustom && (player.customPads?.length ?? 0) > 0 && (
                    <div className="absolute bottom-1.5 right-1.5 bg-black/60 text-ink text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      {player.customPads?.length} ✦
                    </div>
                  )}
                </div>
                <div className="p-3 bg-hairline">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{meta.label}</span>
                  </div>
                  <p className="text-[11px] text-ink-muted mt-0.5">{meta.tagline}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Personal pad library — only under the Images tab. */}
        {padTab === "img" && (
          <ImageLibraryRow
            title="Ma bibliothèque de tapis"
            items={player.customPads ?? []}
            activeUrl={player.padId === "custom" ? player.customPadUrl : undefined}
            max={MAX_CUSTOM_IMAGES}
            aspect="aspect-[3/2]"
            onPick={selectStoredPad}
            onDelete={deleteStoredPad}
            onAdd={() => padFileRef.current?.click()}
          />
        )}
        </>
        )}
      </section>

      {/* By-move stats */}
      {totalGames > 0 && (
        <section className="bg-surface border border-hairline rounded-3xl p-4 sm:p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted mb-3">{t("profile.bymove.title")}</h2>
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {MOVES.map((m) => {
              const s = player.stats.byMove[m];
              const wr = s.picked > 0 ? (s.won / s.picked) * 100 : 0;
              return (
                <div key={m} className="bg-hairline rounded-xl p-2 sm:p-3 text-center min-w-0">
                  <div className="text-[10px] sm:text-xs uppercase tracking-wider text-ink-muted truncate">
                    {t("element." + m)}
                  </div>
                  <div className="mt-1 text-base sm:text-lg font-bold">{s.picked}</div>
                  <div className="text-[9px] sm:text-[10px] text-ink-faint">{t("profile.bymove.wonPct", { p: wr.toFixed(0) })}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Accessibility — global text size. Drives --font-scale in App.tsx. */}
      <section className="bg-surface border border-hairline rounded-3xl p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted mb-3">Accessibilité</h2>
        <p className="text-xs text-ink-faint mb-3">Taille du texte dans toute l'application.</p>
        <div className="grid grid-cols-3 gap-2">
          {([
            { label: "Normal", value: 1, demo: "text-sm" },
            { label: "Grand", value: 1.15, demo: "text-base" },
            { label: "Très grand", value: 1.3, demo: "text-lg" },
          ] as const).map((opt) => {
            const active = (player.fontScale ?? 1) === opt.value;
            return (
              <button
                key={opt.label}
                onClick={() => { hapticTap(); updateProfile({ fontScale: opt.value }); }}
                className={
                  "flex flex-col items-center gap-1 py-3 rounded-xl border transition " +
                  (active
                    ? "border-white/40 bg-hairline text-white"
                    : "border-hairline bg-hairline text-ink-muted hover:border-white/25")
                }
              >
                <span className={opt.demo + " font-bold leading-none"}>Aa</span>
                <span className="text-[11px] font-medium">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Privacy — anonymized crash reports + link to the policy. The
          toggle drives Sentry.init / Sentry.close in App.tsx. */}
      <section className="bg-surface border border-hairline rounded-3xl p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted mb-3">Confidentialité</h2>
        <label className="flex items-center justify-between gap-3 mb-3 p-3 rounded-xl bg-surface border border-hairline cursor-pointer hover:border-white/20 transition">
          <span className="flex flex-col">
            <span className="text-sm font-bold text-ink">📡 Envoyer les rapports de crash</span>
            <span className="text-[10px] text-ink-faint leading-snug">
              Trace anonymisée envoyée à Sentry quand l'app plante. Aucune donnée personnelle.
            </span>
          </span>
          <input
            type="checkbox"
            checked={player.crashReports ?? false}
            onChange={(e) => updateProfile({ crashReports: e.target.checked })}
            aria-label="Toggle crash reports"
            className="w-5 h-5 accent-violet-500 cursor-pointer"
          />
        </label>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("rpsls:navigate", { detail: "privacy" }))}
          className="w-full text-left text-xs text-violet-300 hover:text-violet-200 underline underline-offset-2"
        >
          Voir la politique de confidentialité complète →
        </button>
      </section>

      {/* Reset */}
      <section className="bg-rose-950/30 border border-rose-900/40 rounded-3xl p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-rose-300 mb-2">Danger zone</h2>
        <p className="text-xs text-ink-muted mb-3">
          Reset profile wipes nickname, avatar, theme, XP, LP, stats and history. Irreversible.
        </p>
        {!confirmReset ? (
          <button
            onClick={() => setConfirmReset(true)}
            className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-sm font-medium"
          >
            Reset profile
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => { resetProfile(); setConfirmReset(false); }}
              className="px-4 py-2 rounded-xl bg-rose-500/40 hover:bg-rose-500/60 text-white text-sm font-semibold"
            >
              Yes, wipe everything
            </button>
            <button
              onClick={() => setConfirmReset(false)}
              className="px-4 py-2 rounded-xl bg-hairline hover:bg-hairline text-sm"
            >
              Cancel
            </button>
          </div>
        )}
      </section>

      {/* ── Pad preview modal (portal to body so it escapes scroll/stacking) ── */}
      {createPortal(
        <AnimatePresence>
          {previewPad && (
            <motion.div
              key="pad-preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/95"
              onClick={() => setPreviewPad(null)}
            >
              <div className="w-full max-w-2xl aspect-[3/2] relative pointer-events-none" onClick={(e) => e.stopPropagation()}>
                <BattlePad padId={previewPad} className="w-full h-full rounded-2xl overflow-hidden" />
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-ink-faint">
                <span className="font-bold text-white text-sm">{PAD_META[previewPad]?.label}</span>
                <span>—</span>
                <span>{PAD_META[previewPad]?.tagline}</span>
              </div>
              <div className="flex gap-3 mt-4 relative z-10" onClick={(e) => e.stopPropagation()}>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    hapticMatchStart();
                    updateProfile({ padId: previewPad, padChosen: true });
                    setPreviewPad(null);
                  }}
                  className={
                    "px-6 py-2.5 rounded-2xl font-bold text-sm shadow-lg transition " +
                    (player.padId === previewPad
                      ? "bg-emerald-500/80 text-white"
                      : "bg-themed text-white")
                  }
                >
                  {player.padId === previewPad ? "✓ Actif" : "Choisir ce tapis"}
                </motion.button>
                <button
                  onClick={() => setPreviewPad(null)}
                  className="px-5 py-2.5 rounded-2xl font-bold text-sm bg-white/10 text-ink hover:bg-white/15 transition"
                >
                  Fermer
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ── Full-screen backdrop peek (portal to body) ──
          The background is applied for real the instant a tile is tapped, so
          selection can never fail. This overlay just hides the menu shell (via
          App's `peek` flag) so the live animated backdrop fills the screen for
          a true preview. Tap anywhere — or the button — to return. */}
      {createPortal(
        <AnimatePresence>
          {peek && (
            <motion.div
              key="bg-peek"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-[9999] flex flex-col items-center justify-end pb-10"
              onClick={() => {
                // Ignore the opening tap's trailing click (mobile ghost-click).
                if (performance.now() - peekOpenedAt.current < 400) return;
                closePeek();
              }}
            >
              <div className="flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/55 backdrop-blur-md border border-white/15">
                  <span className="text-emerald-400 text-sm font-black">✓</span>
                  <span className="font-bold text-white text-sm drop-shadow">{currentBg?.label ?? "Fond"}</span>
                  <span className="text-cyan-300 text-[11px] font-bold uppercase tracking-wide">appliqué</span>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={closePeek}
                  className="px-8 py-3 rounded-2xl font-bold text-base shadow-xl bg-themed text-white"
                >
                  Fermer l'aperçu
                </motion.button>
                <span className="text-white/55 text-[11px]">Touche l'écran pour revenir</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
      <PremiumPurchaseModal
        set={premiumModalSetId ? PREMIUM_SETS[premiumModalSetId] ?? null : null}
        onClose={() => setPremiumModalSetId(null)}
      />
    </motion.div>
  );
}

/** Premium catalogue — single source of truth for the boutique. Each entry's
 *  preview is a real component (not a static image) so the player sees the
 *  scene live before paying. Add a new set: drop an entry here + register the
 *  background id with `premiumSetId: "<id>"` in themes.ts. */
const PREMIUM_SETS: Record<string, PremiumSet> = {
  quartz: {
    id: "quartz",
    name: "Quartz",
    tagline: "Éclats cristallins prismatiques, un monde glaciaire et doux.",
    cost: 800,
    previewArt: <QuartzBackdrop />,
  },
};

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-ink-faint">{label}</span>
      <span className="text-lg font-bold" style={accent ? { color: accent } : undefined}>
        {value}
      </span>
    </div>
  );
}

/**
 * ImageLibraryRow — horizontal strip of the player's imported data-URL
 * images (backgrounds OR pads). Each tile shows the picture, marks the
 * active pick with a green ring, and exposes a "×" overlay to delete it
 * from the library. A trailing "+" tile triggers `onAdd` until the cap
 * is reached.
 */
function ImageLibraryRow({
  title, items, activeUrl, max, aspect, onPick, onDelete, onAdd,
}: {
  title: string;
  items: string[];
  activeUrl: string | undefined;
  max: number;
  /** Tailwind aspect-ratio class for the tiles, e.g. "aspect-[9/16]" or "aspect-[3/2]". */
  aspect: string;
  onPick: (url: string) => void;
  onDelete: (url: string) => void;
  onAdd: () => void;
}) {
  if (items.length === 0) return null;
  const full = items.length >= max;
  return (
    <div className="mt-4 pt-4 border-t border-white/8">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
          {title}
        </h3>
        <span className="text-[10px] text-ink-faint tabular-nums">{items.length} / {max}</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((url) => {
          const isActive = activeUrl === url;
          return (
            <div key={url} className="relative shrink-0 group">
              <button
                type="button"
                onClick={() => onPick(url)}
                className={
                  "block w-20 " + aspect + " rounded-xl overflow-hidden border-2 transition " +
                  (isActive
                    ? "border-emerald-400/80 ring-2 ring-emerald-400/30 shadow-md shadow-emerald-500/30"
                    : "border-hairline hover:border-white/40")
                }
                style={{
                  backgroundImage: `url("${url}")`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
                aria-label={isActive ? "Image active" : "Sélectionner cette image"}
              />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(url); }}
                aria-label="Supprimer cette image"
                className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-rose-500/90 hover:bg-rose-500 text-white text-xs font-bold flex items-center justify-center shadow-md border border-rose-300/60"
              >
                ×
              </button>
              {isActive && (
                <div className="absolute bottom-1 left-1 bg-emerald-500/90 text-white text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded">
                  Actif
                </div>
              )}
            </div>
          );
        })}
        {!full && (
          <button
            type="button"
            onClick={onAdd}
            className={
              "shrink-0 w-20 " + aspect +
              " rounded-xl border-2 border-dashed border-white/20 hover:border-white/45 hover:bg-hairline transition flex flex-col items-center justify-center gap-1 text-ink-muted"
            }
            aria-label="Ajouter une image"
          >
            <span className="text-xl leading-none">＋</span>
            <span className="text-[10px] font-semibold">Ajouter</span>
          </button>
        )}
      </div>
    </div>
  );
}
