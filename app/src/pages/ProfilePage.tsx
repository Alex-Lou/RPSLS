import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { useStore } from "../store/store";
import { THEMES } from "../theme/theme";
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
import { OwnedBadgeLongPress } from "../ui/OwnedBadgeLongPress";
import { PlayerBadge } from "../ui/PlayerBadge";
import type { Page } from "../Sidebar";
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


/** Page navigation callback wired by App.tsx — used by the shared PlayerBadge
 *  (currency chips → shop) at the top of the profile. */
export function ProfilePage({ onNavigate }: { onNavigate?: (page: Page) => void } = {}) {
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
  /** Backdrop state snapshot taken BEFORE entering peek. Used to revert when
   *  the user closes the peek without confirming (e.g. tapped a non-premium
   *  thumbnail to "try it on" then changed their mind). Premium-not-owned
   *  peeks also rely on this — they preview the bg without committing it,
   *  and the snapshot lets us roll back if the user doesn't buy. */
  const previousLookRef = useRef<{
    backgroundId?: BackgroundId;
    padId?: PadId;
    themeId?: ThemeId;
  } | null>(null);
  /** Set when the peek is showing a premium scene the player DOESN'T own.
   *  In that mode the bottom-of-screen control bar swaps "Choisir" for
   *  "Acheter" + a price tag, and closing the peek WITHOUT buying reverts
   *  to the previous look. */
  const [peekPremiumPending, setPeekPremiumPending] = useState<string | null>(null);
  const openPeek = () => {
    peekOpenedAt.current = performance.now();
    setPeek(true);
  };
  /** Confirm + close: the bg has already been applied (or is the pre-peek
   *  look if peekPremiumPending), nothing else to do. */
  const confirmPeek = () => {
    previousLookRef.current = null;
    setPeekPremiumPending(null);
    setPeek(false);
  };
  /** Cancel + close: revert to the previous look if we have a snapshot. */
  const closePeek = () => {
    if (previousLookRef.current) {
      updateProfile(previousLookRef.current);
      previousLookRef.current = null;
    }
    setPeekPremiumPending(null);
    setPeek(false);
  };
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

      {/* Player summary — exactly the same badge as the persistent UserHeader
          on the menus, so the player surface looks IDENTICAL everywhere.
          Edit-nickname + stats live in their own row below (kept off the
          shared badge to keep it lean and reusable). */}
      <PlayerBadge onCurrencyTap={onNavigate ? () => onNavigate("shop") : undefined} />

      {/* Editable nickname + at-a-glance stats — section dedicated to the
          profile (the header doesn't need either). */}
      <div className="bg-surface border border-hairline rounded-3xl p-5 flex flex-col gap-4">
        {editingNick ? (
          // Vertical stack on mobile so the input ALWAYS gets the full card
          // width and the action buttons sit cleanly underneath (no more
          // confirm chip falling off the right edge — Alex's "hors champ"
          // complaint). Inline row on >=sm where there's room.
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              autoFocus
              value={nickDraft}
              maxLength={20}
              onChange={(e) => setNickDraft(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveNick();
                if (e.key === "Escape") { setNickDraft(player.nickname); setEditingNick(false); }
              }}
              className="min-w-0 w-full sm:flex-1 bg-hairline rounded-xl px-4 py-2.5 text-base sm:text-lg font-bold focus:outline-none transition"
              style={{
                boxShadow:
                  "inset 0 0 0 1px color-mix(in oklab, var(--theme-primary) 45%, transparent)",
              }}
              placeholder="Pseudo (max 20)"
            />
            <div className="flex items-stretch gap-2 sm:shrink-0">
              <button
                onClick={() => { setNickDraft(player.nickname); setEditingNick(false); }}
                aria-label="Annuler"
                className="flex-1 sm:flex-none sm:w-11 h-11 rounded-xl bg-hairline border border-hairline hover:bg-white/[0.07] text-ink-muted font-bold flex items-center justify-center transition px-3 sm:px-0"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
              <button
                onClick={saveNick}
                aria-label="Enregistrer"
                className="flex-1 sm:flex-none sm:w-auto h-11 px-4 rounded-xl text-white font-bold flex items-center justify-center gap-1.5 transition active:scale-[0.97]"
                style={{
                  background:
                    "linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))",
                  boxShadow:
                    "0 6px 16px -6px color-mix(in oklab, var(--theme-primary) 60%, transparent)",
                  fontFamily: "var(--font-headline)",
                  letterSpacing: "0.05em",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l5 5L20 7" />
                </svg>
                <span className="text-xs sm:text-sm uppercase">Enregistrer</span>
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => { setNickDraft(player.nickname); setEditingNick(true); }}
            className="self-start text-base font-semibold text-ink-muted hover:text-ink transition flex items-center gap-2"
          >
            <span>Modifier le pseudo</span>
            <span className="text-ink-faint text-xs">({player.nickname})</span>
            <span className="text-ink-faint text-sm">✎</span>
          </button>
        )}

        <div className="flex flex-wrap gap-4 text-sm text-ink-muted">
          <Stat label="Level"   value={info.level} accent={theme.primary} />
          <Stat label="XP"      value={player.xp} />
          <Stat label="Rank LP" value={player.rankLp} accent={theme.secondary} />
          <Stat label="Games"   value={totalGames} />
          <Stat label="Win %"   value={`${winRate.toFixed(0)}%`} />
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
                    previousLookRef.current = {
                      backgroundId: player.backgroundId,
                      padId: player.padId,
                      themeId: player.themeId,
                    };
                    updateProfile({ backgroundId: "custom" });
                    openPeek();
                    return;
                  }
                  // Snapshot BEFORE applying so the peek can revert on cancel.
                  previousLookRef.current = {
                    backgroundId: player.backgroundId,
                    padId: player.padId,
                    themeId: player.themeId,
                  };
                  // Premium PREVIEW: when the player doesn't own this set yet,
                  // we STILL apply the bg+pad+theme temporarily so the peek
                  // shows the actual scene at full screen — but mark the peek
                  // as "premium pending" so its button bar swaps "Choisir" for
                  // "Acheter" + a price tag, and closing without buying reverts.
                  const isPremiumLocked =
                    !!bg.premiumSetId &&
                    !(player.ownedPremiumSets ?? []).includes(bg.premiumSetId);
                  hapticMatchStart();
                  const patch: Partial<{ backgroundId: BackgroundId; padId: PadId; themeId: ThemeId }> = { backgroundId: bg.id };
                  if (bg.defaultPadId) patch.padId = bg.defaultPadId;
                  const matchedTheme = BG_DEFAULT_THEME[bg.id];
                  if (matchedTheme) patch.themeId = matchedTheme;
                  updateProfile(patch);
                  if (isPremiumLocked) {
                    setPeekPremiumPending(bg.premiumSetId!);
                  } else {
                    setPeekPremiumPending(null);
                  }
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
                    (player.ownedPremiumSets ?? []).includes(bg.premiumSetId) ? (
                      <OwnedBadgeLongPress setId={bg.premiumSetId} className="top-2 left-2" />
                    ) : (
                      <PremiumBadge variant="ribbon" label="PREMIUM" className="top-2 left-2" />
                    )
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
                  // Premium gate: same flow as the bg picker — tapping a
                  // locked premium pad opens the purchase modal.
                  if (meta.premiumSetId && !(player.ownedPremiumSets ?? []).includes(meta.premiumSetId)) {
                    setPremiumModalSetId(meta.premiumSetId);
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
                  {meta.premiumSetId && (
                    (player.ownedPremiumSets ?? []).includes(meta.premiumSetId) ? (
                      <OwnedBadgeLongPress setId={meta.premiumSetId} className="top-2 left-2" />
                    ) : (
                      <PremiumBadge variant="ribbon" label="PREMIUM" className="top-2 left-2" />
                    )
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

      {/* Premium theme — FX intensity slider. Only shown when the active
          background is a premium scene the player owns. Lets them dial the
          theme's signature FX (rain density for Storm, falling petals for
          Bloom, sparks for Rust, anemone pulses for Coral…) between 0.4×
          and 1.6× so the theme can be tuned to taste. */}
      {currentBg?.premiumSetId &&
       (player.ownedPremiumSets ?? []).includes(currentBg.premiumSetId) && (
        <PremiumIntensitySlider
          setId={currentBg.premiumSetId}
          label={currentBg.label}
          accent={currentBg.accent ?? null}
        />
      )}

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
              // Dimmed backdrop blur — NOT full-black takeover, the preview
              // is a CARD popup, not a fullscreen swap. The user sees the
              // pad at its actual game proportions in a contained frame.
              className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/75 backdrop-blur-md px-4"
              onClick={() => setPreviewPad(null)}
            >
              <motion.div
                initial={{ scale: 0.94, y: 12, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                transition={{ type: "spring", stiffness: 280, damping: 24 }}
                onClick={(e) => e.stopPropagation()}
                // Card with the pad rendered at REAL game proportions (3:2
                // landscape) — bounded by max-w-md so it never explodes to
                // fullscreen. The framed border + corner ticks signal "this
                // is what your table will look like in a match".
                className="w-full max-w-md rounded-3xl overflow-hidden border border-white/15 bg-zinc-950/85 shadow-2xl"
              >
                {/* The pad at its true 3:2 aspect ratio, framed. */}
                <div className="relative w-full aspect-[3/2] bg-black overflow-hidden">
                  <BattlePad padId={previewPad} className="absolute inset-0 w-full h-full" />
                  {/* Subtle corner brackets to telegraph "game table". */}
                  <div className="pointer-events-none absolute inset-3 border border-white/15 rounded-2xl" />
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-white/85 text-[10px] font-bold uppercase tracking-wider">
                    Aperçu tapis
                  </span>
                </div>
                {/* Label + tagline. */}
                <div className="p-4 flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-white">{PAD_META[previewPad]?.label}</span>
                    {PAD_META[previewPad]?.premiumSetId && (
                      <span className="text-[9px] uppercase tracking-wider font-black text-amber-300">✦ Premium</span>
                    )}
                  </div>
                  <span className="text-xs text-ink-muted">{PAD_META[previewPad]?.tagline}</span>
                </div>
                {/* Action buttons. */}
                <div className="px-4 pb-4 flex flex-col gap-2">
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => {
                      hapticMatchStart();
                      updateProfile({ padId: previewPad, padChosen: true });
                      setPreviewPad(null);
                    }}
                    className={
                      "py-2.5 rounded-xl font-black text-sm uppercase tracking-wider shadow-lg transition " +
                      (player.padId === previewPad
                        ? "bg-emerald-500/85 text-white"
                        : "bg-themed text-white")
                    }
                  >
                    {player.padId === previewPad ? "✓ Tapis actif" : "Choisir ce tapis"}
                  </motion.button>
                  <button
                    onClick={() => setPreviewPad(null)}
                    className="py-2 rounded-xl font-bold text-xs uppercase tracking-wider bg-white/10 text-ink hover:bg-white/15 transition"
                  >
                    Fermer
                  </button>
                </div>
              </motion.div>
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
              // pointer-events-none on the container so taps on the backdrop
              // PASS THROUGH to the touch layers (WebGL window-listeners /
              // Quartz active layer) — the player can play with the scene to
              // test the touch FX. Tapping NO LONGER closes/confirms the peek
              // (that was the bug). Only the button column (pointer-events-auto
              // below) commits or closes.
              className="fixed inset-0 z-[9999] flex flex-col items-center justify-end pb-10 pointer-events-none"
            >
              {/* Vertical intensity slider — Alex's ask: "le bouton de réglage
                  d'intensité doit egalement être présent, vertical sur le côté,
                  pres des aperçus, sinon le joueur ne sait pas qu'il peut bénéficier
                  de ça". Only shown when the previewed bg has a premium FX scene
                  AND the player owns it (so dragging actually changes something
                  they can apply). Pointer-events-auto on the slider control only,
                  so taps on the backdrop still reach the touch FX. */}
              {currentBg?.premiumSetId &&
               (player.ownedPremiumSets ?? []).includes(currentBg.premiumSetId) && (
                <PeekIntensitySlider
                  setId={currentBg.premiumSetId}
                  accent={currentBg.accent ?? null}
                />
              )}

              <div className="flex flex-col items-center gap-3 max-w-md w-full px-6 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                {/* Header pill: name + appliqué/aperçu state. */}
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/55 backdrop-blur-md border border-white/15">
                  {peekPremiumPending ? (
                    <>
                      <span className="text-amber-300 text-sm font-black">✦</span>
                      <span className="font-bold text-white text-sm drop-shadow">{currentBg?.label ?? "Fond"}</span>
                      <span className="text-amber-300 text-[11px] font-bold uppercase tracking-wide">aperçu premium</span>
                    </>
                  ) : (
                    <>
                      <span className="text-emerald-400 text-sm font-black">✓</span>
                      <span className="font-bold text-white text-sm drop-shadow">{currentBg?.label ?? "Fond"}</span>
                      <span className="text-cyan-300 text-[11px] font-bold uppercase tracking-wide">appliqué</span>
                    </>
                  )}
                </div>
                {/* Button row — content depends on premium-locked vs applied. */}
                {peekPremiumPending ? (
                  <div className="flex flex-col gap-2 w-full">
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={() => {
                        // Open the purchase modal ON TOP of the peek. After purchase,
                        // CelebrationOverlay fires inside the modal; on close we
                        // confirmPeek() since the player now owns the set.
                        if (peekPremiumPending) setPremiumModalSetId(peekPremiumPending);
                      }}
                      className="w-full py-3 rounded-2xl font-black text-base uppercase tracking-wider shadow-xl bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 text-zinc-900"
                    >
                      ✦ Acheter ce thème
                    </motion.button>
                    <div className="grid grid-cols-2 gap-2">
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={confirmPeek}
                        className="py-2.5 rounded-xl font-bold text-sm bg-white/10 border border-white/20 text-white"
                      >
                        Garder l'aperçu
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={closePeek}
                        className="py-2.5 rounded-xl font-bold text-sm bg-white/5 border border-white/15 text-white/85"
                      >
                        Fermer
                      </motion.button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 w-full">
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={confirmPeek}
                      className="py-3 rounded-2xl font-black text-sm uppercase tracking-wider shadow-xl bg-themed text-white"
                    >
                      ✓ Choisir ce thème
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={closePeek}
                      className="py-3 rounded-2xl font-bold text-sm uppercase tracking-wider bg-white/10 border border-white/20 text-white"
                    >
                      Fermer
                    </motion.button>
                  </div>
                )}
                <span className="text-white/55 text-[11px]">Touche / glisse le fond pour jouer · les boutons valident</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
      <PremiumPurchaseModal
        set={premiumModalSetId ? PREMIUM_SETS[premiumModalSetId] ?? null : null}
        onClose={() => {
          // If the set was just purchased, the peek (still open behind the
          // modal) should drop its "premium pending" mode so its button bar
          // flips from Acheter → Choisir ce thème. The bg+pad+theme are
          // already applied (we applied them on the preview tap), so the
          // player keeps the look they just bought.
          // NB: read ownership from the LIVE store, not the render closure —
          // the modal's setTimeout(onClose, 2200) captured a stale onClose
          // from before the purchase, so `player` here would not yet include
          // the new set. useStore.getState() is always current.
          const justBoughtId = premiumModalSetId;
          setPremiumModalSetId(null);
          const liveOwned = useStore.getState().player.ownedPremiumSets ?? [];
          if (justBoughtId && liveOwned.includes(justBoughtId)) {
            setPeekPremiumPending(null);
            previousLookRef.current = null; // committed — don't revert on close
          }
        }}
      />
    </motion.div>
  );
}

/** Accent palette + emblem for the lightweight purchase-modal preview tile.
 *  Mirrors each set's `accent` in themes.ts. Kept local so the preview never
 *  pulls in a live backdrop. */
const PREVIEW_ACCENTS: Record<string, { from: string; to: string; bg: string; emoji: string }> = {
  eclipse:    { from: "#d4a745", to: "#8b7fcf", bg: "#06050e", emoji: "🌑" },
  phantom:    { from: "#5a7a9a", to: "#8a9bb5", bg: "#0c0e14", emoji: "👻" },
  emberforge: { from: "#ff6a14", to: "#ff9426", bg: "#0a0503", emoji: "🔥" },
  tempus:     { from: "#b8956a", to: "#d4a76a", bg: "#0a0703", emoji: "⏳" },
  storm:      { from: "#4af0ff", to: "#a078ff", bg: "#060a16", emoji: "⚡" },
  quartz:     { from: "#c8aef0", to: "#f6a5b8", bg: "#1a142a", emoji: "💠" },
  // 2026-06-07 lineup
  coral:      { from: "#ff6b6b", to: "#4ecdc4", bg: "#0a1628", emoji: "🪸" },
  rust:       { from: "#d2691e", to: "#8b4513", bg: "#0a0502", emoji: "🏭" },
  void:       { from: "#ffffff", to: "#666666", bg: "#000000", emoji: "◼️" },
  prism:      { from: "#ffffff", to: "#8b5cf6", bg: "#050510", emoji: "💎" },
  ink:        { from: "#1a1a1a", to: "#8c8c8c", bg: "#f5f0e8", emoji: "🖋️" },
  bloom:      { from: "#ff7eb3", to: "#81c784", bg: "#f0f4f0", emoji: "🌸" },
};

/** PremiumPreviewTile — lightweight, ZERO-WebGL preview for the purchase
 *  modal. Two earlier attempts mounted a live <ThemedBackdrop> here, which
 *  spawned a SECOND WebGL context (the first being the full-screen peek the
 *  modal opens over) and crashed mobile GPUs. The player already sees the
 *  real animated backdrop full-screen in the peek; this tile just needs to
 *  evoke the set with its accent gradient + emblem. Pure CSS / motion. */
function PremiumPreviewTile({ setId }: { setId: string }) {
  const a = PREVIEW_ACCENTS[setId] ?? PREVIEW_ACCENTS.eclipse;
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: a.bg }}>
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            `radial-gradient(120% 90% at 18% 12%, ${a.from}cc, transparent 55%),` +
            `radial-gradient(120% 90% at 86% 92%, ${a.to}aa, transparent 55%)`,
        }}
        animate={{ opacity: [0.72, 1, 0.72], scale: [1, 1.06, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Diagonal shimmer sweep — sells "premium sheen". */}
      <motion.div
        className="absolute inset-y-0 w-1/3"
        style={{ background: `linear-gradient(105deg, transparent, ${a.from}40, transparent)` }}
        animate={{ x: ["-160%", "360%"] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 1.0 }}
      />
      {/* Watermark emblem. */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-7xl opacity-25 select-none"
              style={{ filter: `drop-shadow(0 0 26px ${a.from})` }}>
          {a.emoji}
        </span>
      </div>
    </div>
  );
}

/** Premium catalogue — single source of truth for the boutique. Preview is a
 *  lightweight CSS tile (NOT a live backdrop — see PremiumPreviewTile). The
 *  full animated scene is shown in the full-screen peek the player reaches
 *  before this modal. Add a new set: drop an entry here + register the
 *  background id with `premiumSetId: "<id>"` in themes.ts + an accent in
 *  PREVIEW_ACCENTS above. */
const PREMIUM_SETS: Record<string, PremiumSet> = {
  quartz: {
    id: "quartz",
    name: "Quartz",
    tagline: "Éclats cristallins prismatiques, un monde glaciaire et doux.",
    cost: 800,
    previewArt: <PremiumPreviewTile setId="quartz" />,
  },
  eclipse: {
    id: "eclipse",
    name: "Eclipse",
    tagline: "Couronne solaire, anneau de diamant, vide onyx percé d'or.",
    cost: 800,
    previewArt: <PremiumPreviewTile setId="eclipse" />,
  },
  phantom: {
    id: "phantom",
    name: "Phantom Realm",
    tagline: "Brume spectrale, larmes fantômes, volutes argentées.",
    cost: 800,
    previewArt: <PremiumPreviewTile setId="phantom" />,
  },
  emberforge: {
    id: "emberforge",
    name: "Ember Forge",
    tagline: "Forge naine, rivières de braise, cuivre martelé incandescent.",
    cost: 800,
    previewArt: <PremiumPreviewTile setId="emberforge" />,
  },
  tempus: {
    id: "tempus",
    name: "Tempus Aeternum",
    tagline: "Sables du temps, engrenages antiques, sablier sépia éternel.",
    cost: 800,
    previewArt: <PremiumPreviewTile setId="tempus" />,
  },
  storm: {
    id: "storm",
    name: "Tempest Fury",
    tagline: "Foudre déchirante, rideaux de pluie, nuages d'orage grondants.",
    cost: 800,
    previewArt: <PremiumPreviewTile setId="storm" />,
  },
  // ── 2026-06-07 lineup. Prices follow the design doc:
  //    Coral / Rust / Bloom / Prism = 700-800 (rich animation)
  //    Void / Ink = 900 (light-mode UI work on top of the scene) ──
  coral: {
    id: "coral",
    name: "Coral Reef",
    tagline: "Récif bioluminescent, anémones pulsantes, bancs de poissons.",
    cost: 800,
    previewArt: <PremiumPreviewTile setId="coral" />,
  },
  rust: {
    id: "rust",
    name: "Rust",
    tagline: "Déclin industriel, poutres rouillées, étincelles de soudure.",
    cost: 800,
    previewArt: <PremiumPreviewTile setId="rust" />,
  },
  void: {
    id: "void",
    name: "Void",
    tagline: "Géométrie pure, vide absolu, l'anti-spectacle.",
    cost: 900,
    previewArt: <PremiumPreviewTile setId="void" />,
  },
  prism: {
    id: "prism",
    name: "Prism",
    tagline: "Laboratoire de lumière, faisceaux spectraux décomposés.",
    cost: 800,
    previewArt: <PremiumPreviewTile setId="prism" />,
  },
  ink: {
    id: "ink",
    name: "Ink (Sumi-e)",
    tagline: "Calligraphie japonaise, encre noire sur papier de riz.",
    cost: 900,
    previewArt: <PremiumPreviewTile setId="ink" />,
  },
  bloom: {
    id: "bloom",
    name: "Bloom Garden",
    tagline: "Jardin infini, pétales en spirale, lucioles, fleurs qui s'ouvrent.",
    cost: 800,
    previewArt: <PremiumPreviewTile setId="bloom" />,
  },
};

/**
 * PeekIntensitySlider — VERTICAL slider mounted inside the full-screen
 * backdrop peek overlay. Sits on the right edge so the player can dial the
 * FX density LIVE while previewing the theme — they SEE the rain thin
 * out, the petals slow down, the sparks pour as they drag. Alex's ask:
 * "le bouton de réglage d'intensité doit egalement être présent, vertical
 * sur le côté, pres des aperçus, sinon le joueur ne sait pas qu'il peut
 * bénéficier de ça". The slider docks at right-edge, vertical, with a
 * themed track + glassy thumb + live % readout + a tiny rotated label so
 * the affordance is obvious without taking screen real estate.
 *
 * Range matches PremiumIntensitySlider (0.1 – 2.0). Both write the same
 * `player.premiumIntensity[setId]` field so changes here persist + are
 * picked up by every consumer (StormRain, PremiumTouchLayer, the shader
 * uniform).
 */
function PeekIntensitySlider({ setId, accent }: {
  setId: string;
  accent: { from: string; to: string } | null;
}) {
  const intensity = useStore((s) => s.player.premiumIntensity?.[setId] ?? 1.0);
  const updateProfile = useStore((s) => s.updateProfile);
  const MIN = 0.1, MAX = 2.0;
  const setValue = (v: number) => {
    const clamped = Math.max(MIN, Math.min(MAX, v));
    const current = useStore.getState().player.premiumIntensity ?? {};
    updateProfile({ premiumIntensity: { ...current, [setId]: clamped } });
  };
  const fillPct = ((intensity - MIN) / (MAX - MIN)) * 100;
  const accentGrad = accent
    ? `linear-gradient(0deg, ${accent.from}, ${accent.to})`
    : "linear-gradient(0deg, var(--theme-primary), var(--theme-secondary))";

  // Custom pointer handler — the rotated <input type="range"> approach
  // didn't work in the Android WebView (touch coordinates weren't being
  // mapped through the rotation, so dragging did nothing — Alex's "le
  // bouton ne bouge pas"). Here we own the pointer events: read the y
  // coordinate relative to the track, invert it (top = MAX), normalise,
  // and call setValue. setPointerCapture keeps the gesture sticky once
  // the user starts dragging, even if the finger drifts off the track.
  const trackRef = useRef<HTMLDivElement | null>(null);
  const onPointerEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const yFromTop = e.clientY - rect.top;
    // Bottom = MIN, Top = MAX. Invert: yNorm at bottom = 0, at top = 1.
    const yNorm = 1 - Math.max(0, Math.min(1, yFromTop / rect.height));
    setValue(MIN + yNorm * (MAX - MIN));
  };

  return (
    // Floats independently of the bottom button column. Pointer-events-none
    // on the wrapper so the rest of the screen stays interactive; the inner
    // track div has pointer-events-auto.
    <div
      className="
        fixed pointer-events-none flex flex-col items-center gap-1
        right-[max(env(safe-area-inset-right),8px)]
        top-1/2 -translate-y-1/2
        select-none
      "
    >
      <div className="text-[9px] uppercase tracking-[0.22em] font-black text-white/95 px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-md border border-white/15 drop-shadow">
        Intensité
      </div>
      <div
        className="text-[10px] font-black tabular-nums px-2 py-0.5 rounded-full"
        style={{
          background: "color-mix(in oklab, var(--theme-primary) 80%, black 20%)",
          color: "white",
          boxShadow: "0 4px 12px -4px color-mix(in oklab, var(--theme-primary) 60%, transparent)",
        }}
      >
        {Math.round(intensity * 100)}%
      </div>

      {/* The track — owns all pointer events. Larger hit zone (36px wide)
          even though the visible track is 6px, so the touch target meets
          Material's 48dp minimum guideline. */}
      <div
        ref={trackRef}
        role="slider"
        aria-label="Intensité des effets premium"
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        aria-valuenow={intensity}
        className="relative pointer-events-auto touch-none cursor-pointer"
        style={{ width: 36, height: 240 }}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          onPointerEvent(e);
        }}
        onPointerMove={(e) => {
          // Only update while a button is down (avoids hover-induced updates).
          if (e.buttons === 0) return;
          onPointerEvent(e);
        }}
      >
        {/* Track background */}
        <div
          className="absolute left-1/2 -translate-x-1/2 top-0 h-full rounded-full pointer-events-none"
          style={{
            width: 6,
            background: "rgba(0,0,0,0.55)",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.18)",
          }}
        />
        {/* Filled portion */}
        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-0 rounded-full pointer-events-none"
          style={{
            width: 6,
            height: `${fillPct}%`,
            background: accentGrad,
            boxShadow: "0 0 14px color-mix(in oklab, var(--theme-primary) 55%, transparent)",
          }}
        />
        {/* Tick marks */}
        {[25, 50, 75].map((p) => (
          <div
            key={p}
            aria-hidden
            className="absolute left-1/2 -translate-x-1/2 w-3 h-0.5 bg-white/30 rounded-full pointer-events-none"
            style={{ bottom: `calc(${p}% - 1px)` }}
          />
        ))}
        {/* Thumb */}
        <div
          aria-hidden
          className="absolute left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
          style={{
            width: 22,
            height: 22,
            bottom: `calc(${fillPct}% - 11px)`,
            background: "white",
            boxShadow:
              "0 4px 14px -2px color-mix(in oklab, var(--theme-primary) 55%, transparent)," +
              "inset 0 0 0 2px color-mix(in oklab, var(--theme-primary) 35%, white)",
          }}
        />
      </div>

      <div className="absolute right-full mr-2 top-9 text-[9px] uppercase tracking-wider font-bold text-white/70 drop-shadow">
        Max
      </div>
      <div className="absolute right-full mr-2 bottom-1 text-[9px] uppercase tracking-wider font-bold text-white/70 drop-shadow">
        Min
      </div>
    </div>
  );
}

/**
 * PremiumIntensitySlider — discreet "thermometer" slider that adjusts the
 * signature FX density of the active premium theme. Reads / writes
 * `player.premiumIntensity[setId]`; the active backdrop reads the live
 * value via `usePremiumIntensity(setId)` (see store/store.ts selector) so
 * any drag pulses through to canvas in real time.
 *
 * Range 0.1 – 2.0 with step 0.05. 1.0 = the shipping look; below pours
 * fewer raindrops / fewer petals / fewer sparks; above floods the scene.
 */
function PremiumIntensitySlider({ setId, label, accent }: {
  setId: string;
  label: string;
  accent: { from: string; to: string } | null;
}) {
  const intensity = useStore((s) => s.player.premiumIntensity?.[setId] ?? 1.0);
  const updateProfile = useStore((s) => s.updateProfile);
  // Range widened to [0.1, 2.0] — Alex flagged that at the previous min
  // (0.4) the rain was still pouring. 0.1 = barely-there sprinkle, 2.0 =
  // a downpour you can't look away from. 1.0 stays the "shipping look".
  const MIN = 0.1, MAX = 2.0;
  const setValue = (v: number) => {
    const clamped = Math.max(MIN, Math.min(MAX, v));
    const current = useStore.getState().player.premiumIntensity ?? {};
    updateProfile({ premiumIntensity: { ...current, [setId]: clamped } });
  };
  // Map [MIN, MAX] -> [0, 100] for the visual fill.
  const fillPct = ((intensity - MIN) / (MAX - MIN)) * 100;
  const accentGrad = accent
    ? `linear-gradient(90deg, ${accent.from}, ${accent.to})`
    : "linear-gradient(90deg, var(--theme-primary), var(--theme-secondary))";
  return (
    <section className="bg-surface border border-hairline rounded-3xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted">
          Intensité — {label}
        </h2>
        <span
          className="text-xs font-black tabular-nums px-2 py-0.5 rounded-full"
          style={{
            background: "color-mix(in oklab, var(--theme-primary) 18%, transparent)",
            color: "var(--ink)",
          }}
        >
          {Math.round(intensity * 100)}%
        </span>
      </div>
      <p className="text-[11px] text-ink-faint mb-3 leading-snug">
        Règle la densité des effets signature : pluie, pétales, étincelles, motes…
      </p>
      <div className="relative h-9 flex items-center">
        {/* Track */}
        <div
          className="absolute inset-x-0 h-2 rounded-full"
          style={{ background: "color-mix(in oklab, black 35%, transparent)" }}
        />
        {/* Filled portion (accent gradient) */}
        <div
          className="absolute left-0 h-2 rounded-full pointer-events-none"
          style={{
            width: `${fillPct}%`,
            background: accentGrad,
            boxShadow: "0 0 12px color-mix(in oklab, var(--theme-primary) 55%, transparent)",
          }}
        />
        {/* Tick marks at 50% / 100% / 150% */}
        {[0, 50, 100].map((p) => (
          <div
            key={p}
            aria-hidden
            className="absolute h-3 w-0.5 bg-white/25 rounded-full"
            style={{ left: `calc(${p}% - 1px)` }}
          />
        ))}
        {/* Native input — invisible, drives the value. Custom thumb via CSS. */}
        <input
          type="range"
          min={MIN}
          max={MAX}
          step={0.05}
          value={intensity}
          onChange={(e) => setValue(parseFloat(e.currentTarget.value))}
          className="relative w-full appearance-none bg-transparent z-10 cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none
                     [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6
                     [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:bg-white
                     [&::-webkit-slider-thumb]:shadow-lg
                     [&::-webkit-slider-thumb]:border-2
                     [&::-webkit-slider-thumb]:border-white/80
                     [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:h-6
                     [&::-moz-range-thumb]:rounded-full
                     [&::-moz-range-thumb]:bg-white
                     [&::-moz-range-thumb]:border-0"
          aria-label="Intensité des effets premium"
        />
      </div>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-ink-faint mt-1.5">
        <span>Discret</span>
        <span>Standard</span>
        <span>Intense</span>
      </div>
    </section>
  );
}

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
