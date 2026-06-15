import { useEffect, useRef, useState } from "react";
import { useStore } from "../../store/store";
import { useT } from "../../i18n";
import { BACKGROUNDS, BG_DEFAULT_THEME } from "../../theme/themes";
import type { BackgroundId, PadId, ThemeId } from "../../types";
import { PAD_META } from "../../types";
import { TabPicker } from "../../ui/TabPicker";
import { PremiumPurchaseModal } from "../../ui/PremiumPurchaseModal";
import { resizeImageToDataUrl, ResizeImageError } from "../../util/resizeImage";
import { hapticMatchStart } from "../../haptic";
import { useBackdropPeek } from "../../backdrops/previewScene";
import { ImageLibraryRow } from "./ImageLibraryRow";
import { PremiumIntensitySlider } from "./PremiumIntensitySlider";
import { PREMIUM_SETS } from "./premiumCatalog";
import { BackgroundGrid } from "./BackgroundGrid";
import { PadGrid } from "./PadGrid";
import { PadPreviewModal } from "./PadPreviewModal";
import { BackdropPeekOverlay } from "./BackdropPeekOverlay";

/** Personal image library cap. JPEG-encoded at quality 0.82 at MAX×MAX
 *  yields ~150-400 KB each, so 6 images stays well under localStorage's
 *  ~5 MB ceiling alongside the rest of the persisted state. */
const MAX_CUSTOM_IMAGES = 6;

/** Style — one card, two tabs. "Apparences" applies a COMPLETE look in a
 *  single tap (animated background + HUD colours + fonts + matched pad);
 *  "Pads" only overrides the playmat. Everything is linked by default.
 *  Owns the peek / premium-pending / previous-look state shared between the
 *  background grid, the full-screen peek overlay and the purchase modal. */
export function StyleSection() {
  const player = useStore((s) => s.player);
  const updateProfile = useStore((s) => s.updateProfile);
  const t = useT();

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
  const bgFileRef = useRef<HTMLInputElement>(null);
  const padFileRef = useRef<HTMLInputElement>(null);

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

  /** Tap a background tile: snapshot the current look, apply the new look
   *  (bg + matched pad + theme), open the peek. Premium-locked scenes still
   *  apply temporarily but mark the peek "premium pending". */
  const onSelectBackground = (bg: (typeof BACKGROUNDS)[number]) => {
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
  };

  /** Tap a pad tile: custom → import or select; premium-locked → purchase
   *  modal; otherwise open the pad preview. */
  const onSelectPad = (id: PadId) => {
    const meta = PAD_META[id];
    const isCustom = id === "custom";
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
  };

  return (
    <>
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
        <BackgroundGrid onSelect={onSelectBackground} />

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
        <PadGrid padTab={padTab} onSelect={onSelectPad} />

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
          background is a premium scene the player owns. */}
      {currentBg?.premiumSetId &&
       (player.ownedPremiumSets ?? []).includes(currentBg.premiumSetId) && (
        <PremiumIntensitySlider
          setId={currentBg.premiumSetId}
          label={currentBg.label}
          accent={currentBg.accent ?? null}
        />
      )}

      <PadPreviewModal previewPad={previewPad} onClose={() => setPreviewPad(null)} />

      <BackdropPeekOverlay
        peek={peek}
        peekPremiumPending={peekPremiumPending}
        currentBg={currentBg}
        onConfirm={confirmPeek}
        onClose={closePeek}
        onBuy={(setId) => setPremiumModalSetId(setId)}
      />

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
    </>
  );
}
