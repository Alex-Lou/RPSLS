/**
 * ShopPage — the meta-progression boutique.
 *
 * Routed from the burger menu and the currency badges in every player
 * profile surface (UserHeader, RankedLobby). Two sections for now:
 *  - Pack: spend 50 💎 to roll three cards. Duplicates fold into ✨.
 *  - Forger: pick a locked card and pay ✨ to add it to the collection.
 *
 * The Codex tab (B3) ships in the next wave — leaving room for it here on
 * purpose (the tabs UI is wired even with a single section, so adding a
 * second tab is a one-line change).
 */

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BurstCanvas } from "../fx/LevelUpOverlay";
import { useStore } from "../store/store";
import { useT } from "../i18n";
import { ALL_CARD_IDS, CARDS, RARITY_BG, RARITY_COLOR } from "../ranked/cards";
import { CardImage } from "../ranked/CardImage";
import type { CardId } from "../ranked/rankedTypes";
import { CurrencyBadges } from "../ranked/CurrencyBadges";
import {
  CODEX_TIERS,
  DUST_PER_DUPLICATE,
  MASTERY_MAX_LEVEL,
  PACK_COST,
  type PackResult,
  craftCost,
  masteryLevel,
} from "../engine/economy";
import { hapticTap, hapticMatchWin } from "../haptic";
import { useNoMenuFx } from "../fx/menuFx";

type Tab = "shop" | "codex";

export function ShopPage() {
  useNoMenuFx();
  const t = useT();
  const player = useStore((s) => s.player);
  const openPack = useStore((s) => s.openPack);
  const craftCardAction = useStore((s) => s.craftCard);
  const claimCodexTier = useStore((s) => s.claimCodexTier);
  const eclats = player.eclats ?? 0;
  const dust = player.dust ?? 0;
  const collection = player.cardCollection ?? [];
  const codexClaimed = player.codexClaimed ?? [];
  const [tab, setTab] = useState<Tab>("shop");
  const [packResult, setPackResult] = useState<PackResult | null>(null);
  const [justCrafted, setJustCrafted] = useState<CardId | null>(null);

  const lockedCards = ALL_CARD_IDS.filter((id) => !collection.includes(id));
  const canBuyPack = eclats >= PACK_COST;

  function handleOpenPack() {
    hapticTap();
    const r = openPack();
    if (!r) return;
    hapticMatchWin();
    setPackResult(r);
  }

  function handleCraft(id: CardId) {
    hapticTap();
    const ok = craftCardAction(id);
    if (!ok) return;
    hapticMatchWin();
    setJustCrafted(id);
    window.setTimeout(() => setJustCrafted((cur) => (cur === id ? null : cur)), 1800);
  }

  function handleClaimTier(threshold: number) {
    hapticTap();
    const ok = claimCodexTier(threshold);
    if (ok) hapticMatchWin();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className="flex-1 flex flex-col min-h-0 overflow-y-auto"
    >
      <article className="max-w-2xl mx-auto w-full px-5 py-6 flex flex-col gap-5">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-headline text-3xl sm:text-4xl font-extrabold tracking-tight text-themed">
              🎁 Boutique
            </h1>
            <p className="text-[11px] text-ink-faint mt-1">
              Gagne des éclats à chaque match · ouvre des packs · forge les cartes qui te manquent.
            </p>
          </div>
        </header>

        {/* Currency overview — bigger card-shaped pills since this is the page
            whose entire purpose is spending these resources. */}
        <div className="flex items-center justify-center">
          <CurrencyBadges size="full" inert />
        </div>

        {/* Tab switcher — keeps the boutique and the collection codex side
            by side so toggling between "spend" and "track" is one tap. */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-surface border border-hairline">
          <ShopTabButton on={tab === "shop"} onClick={() => setTab("shop")}>Boutique</ShopTabButton>
          <ShopTabButton on={tab === "codex"} onClick={() => setTab("codex")}>Codex</ShopTabButton>
        </div>

        {tab === "shop" && <>
        {/* Pack section */}
        <section className="rounded-2xl p-4 bg-surface-raised border border-hairline flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎁</span>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-base">Pack à 3 cartes</h2>
              <p className="text-[11px] text-ink-muted leading-snug">
                Tirage aléatoire (60 % commune · 30 % rare · 9 % épique · 1 % légendaire).
                Les doublons sont convertis en poussière.
              </p>
            </div>
          </div>
          <motion.button
            whileTap={canBuyPack ? { scale: 0.97 } : undefined}
            onClick={canBuyPack ? handleOpenPack : undefined}
            disabled={!canBuyPack}
            className={
              "w-full py-3 rounded-2xl font-bold text-white shadow-lg transition " +
              (canBuyPack ? "bg-themed hover:scale-[1.01]" : "bg-hairline text-ink-faint cursor-not-allowed")
            }
          >
            {canBuyPack
              ? `Ouvrir un pack · ${PACK_COST} 💎`
              : `Il manque ${(PACK_COST - eclats).toLocaleString("fr-FR")} 💎`}
          </motion.button>
        </section>

        {/* Craft section */}
        <section className="rounded-2xl p-4 bg-surface-raised border border-hairline flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⚒️</span>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-base">Forger une carte</h2>
              <p className="text-[11px] text-ink-muted leading-snug">
                Paie en poussière pour ajouter une carte verrouillée précise à ta collection.
              </p>
            </div>
          </div>

          {lockedCards.length === 0 ? (
            <p className="text-sm text-ink-muted text-center py-6">
              🎉 Toutes les cartes sont déjà dans ta collection.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {lockedCards.map((id) => {
                const card = CARDS[id];
                const cost = craftCost(id);
                const canCraft = dust >= cost;
                const wasJustCrafted = justCrafted === id;
                return (
                  <motion.div
                    key={id}
                    animate={wasJustCrafted ? { scale: [1, 1.04, 1] } : undefined}
                    transition={{ duration: 0.5 }}
                    className={
                      "relative overflow-hidden flex items-center gap-3 rounded-xl p-2 border transition " +
                      (canCraft
                        ? "border-violet-400/40 bg-violet-500/10"
                        : "border-hairline bg-hairline")
                    }
                  >
                    {wasJustCrafted && <CraftSparkles />}
                    <div
                      className={
                        "relative w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center bg-gradient-to-br " +
                        RARITY_BG[card.rarity]
                      }
                    >
                      <CardImage id={id} glyphSize="text-2xl" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate">{t(card.nameKey)}</div>
                      <div className={"text-[10px] uppercase tracking-wider font-bold " + RARITY_COLOR[card.rarity]}>
                        {card.rarity} · {card.cost} mana
                      </div>
                    </div>
                    <motion.button
                      whileTap={canCraft ? { scale: 0.94 } : undefined}
                      onClick={canCraft ? () => handleCraft(id) : undefined}
                      disabled={!canCraft}
                      className={
                        "px-3 py-2 rounded-xl font-bold text-xs whitespace-nowrap transition " +
                        (canCraft
                          ? "bg-violet-500/30 text-violet-100 border border-violet-400/50 hover:bg-violet-500/45"
                          : "bg-hairline text-ink-faint border border-hairline cursor-not-allowed")
                      }
                    >
                      {cost} ✨
                    </motion.button>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        </>}

        {tab === "codex" && (
          <CodexView
            collection={collection}
            codexClaimed={codexClaimed}
            cardMastery={player.cardMastery ?? {}}
            onClaim={handleClaimTier}
          />
        )}

        {/* Justified-craft notice — a brief floating badge confirms the action
            on the freshly-forged tile (alongside the scale pulse above). */}
        <AnimatePresence>
          {justCrafted && (
            <motion.div
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 8, opacity: 0 }}
              className="fixed left-1/2 -translate-x-1/2 bottom-6 z-40 px-4 py-2 rounded-full bg-violet-500/95 text-white shadow-xl shadow-violet-900/40 text-sm font-bold"
            >
              ⚒️ {t(CARDS[justCrafted].nameKey)} forgée
            </motion.div>
          )}
        </AnimatePresence>
      </article>

      <AnimatePresence>
        {packResult && (
          <PackOpeningModal
            result={packResult}
            onClose={() => setPackResult(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─────────── Tab pill ─────────── */

function ShopTabButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        "py-2 rounded-xl text-sm font-bold transition " +
        (on ? "bg-themed text-white shadow" : "text-ink-muted hover:text-white")
      }
    >
      {children}
    </button>
  );
}

/* ─────────── Codex view (B3) ─────────── */

function CodexView({
  collection, codexClaimed, cardMastery, onClaim,
}: {
  collection: string[];
  codexClaimed: number[];
  cardMastery: Record<string, number>;
  onClaim: (threshold: number) => void;
}) {
  const t = useT();
  const ownedSet = new Set(collection);
  const ownedCount = ownedSet.size;
  const total = ALL_CARD_IDS.length;
  const progress = total > 0 ? ownedCount / total : 0;
  const masteredCount = ALL_CARD_IDS.filter(
    (id) => ownedSet.has(id) && masteryLevel(cardMastery[id] ?? 0) === MASTERY_MAX_LEVEL,
  ).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Progress card */}
      <section className="rounded-2xl p-4 bg-surface-raised border border-hairline">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-ink-muted">
            Collection
          </span>
          <span className="font-black tabular-nums text-ink">
            {ownedCount} / {total}
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-hairline overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(progress * 100).toFixed(1)}%` }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="h-full rounded-full bg-themed"
          />
        </div>
        <p className="text-[11px] text-ink-muted mt-2 leading-snug">
          Débloque toutes les cartes pour empocher les paliers de complétion.
          {masteredCount > 0 && (
            <>
              {" "}<span className="text-amber-300 font-bold">⭐ {masteredCount}</span> carte
              {masteredCount > 1 ? "s" : ""} maîtrisée{masteredCount > 1 ? "s" : ""}.
            </>
          )}
        </p>
      </section>

      {/* Tier rewards */}
      <section className="flex flex-col gap-2">
        <h3 className="text-[10px] uppercase tracking-[0.25em] font-bold text-ink-muted px-1">
          Paliers de complétion
        </h3>
        {CODEX_TIERS.map((tier) => {
          const claimed = codexClaimed.includes(tier.threshold);
          const ready = ownedCount >= tier.threshold && !claimed;
          return (
            <div
              key={tier.threshold}
              className={
                "rounded-xl p-3 flex items-center gap-3 border transition " +
                (claimed
                  ? "border-emerald-400/30 bg-emerald-500/5 opacity-70"
                  : ready
                  ? "border-amber-400/50 bg-amber-500/10 shadow-md shadow-amber-900/20"
                  : "border-hairline bg-hairline")
              }
            >
              <span className="text-2xl">
                {claimed ? "✅" : ready ? "🎁" : "🔒"}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm">
                  {tier.threshold} / {total} cartes
                </div>
                <div className="text-[11px] text-ink-muted">
                  +{tier.eclats} 💎{tier.dust > 0 ? ` · +${tier.dust} ✨` : ""}
                </div>
              </div>
              <motion.button
                whileTap={ready ? { scale: 0.94 } : undefined}
                onClick={ready ? () => onClaim(tier.threshold) : undefined}
                disabled={!ready}
                className={
                  "px-3 py-2 rounded-xl font-bold text-xs whitespace-nowrap transition " +
                  (claimed
                    ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/40"
                    : ready
                    ? "bg-gradient-to-br from-amber-400 to-orange-500 text-zinc-900 shadow-lg shadow-amber-900/40"
                    : "bg-hairline text-ink-faint border border-hairline cursor-not-allowed")
                }
              >
                {claimed ? "Récupéré" : ready ? "Récupérer" : `−${tier.threshold - ownedCount}`}
              </motion.button>
            </div>
          );
        })}
      </section>

      {/* Grid of all cards — owned vs locked at a glance. */}
      <section>
        <h3 className="text-[10px] uppercase tracking-[0.25em] font-bold text-ink-muted px-1 mb-2">
          Toutes les cartes
        </h3>
        <div className="grid grid-cols-5 gap-2">
          {ALL_CARD_IDS.map((id) => {
            const card = CARDS[id];
            const owned = ownedSet.has(id);
            const lvl = owned ? masteryLevel(cardMastery[id] ?? 0) : 1;
            const mastered = lvl === MASTERY_MAX_LEVEL;
            return (
              <div
                key={id}
                className={
                  "relative rounded-xl overflow-hidden aspect-[3/4] flex flex-col items-center justify-center text-center " +
                  (mastered
                    ? "ring-2 ring-amber-400/70 shadow-md shadow-amber-500/30"
                    : owned
                    ? "ring-1 ring-white/15"
                    : "ring-1 ring-white/5 grayscale opacity-30")
                }
                title={t(card.nameKey) + (owned && lvl > 1 ? ` · Niv ${lvl}` : "")}
              >
                <CardImage id={id} glyphSize="text-lg" />
                <div className="relative z-10 flex flex-col items-center p-0.5">
                  <span className="text-lg">{card.glyph}</span>
                  <span className={"text-[7px] font-bold uppercase " + RARITY_COLOR[card.rarity]}>
                    {card.rarity}
                  </span>
                </div>
                {!owned && (
                  <div className="absolute inset-0 bg-black/55 flex items-center justify-center z-20">
                    <span className="text-base">🔒</span>
                  </div>
                )}
                {owned && lvl > 1 && (
                  <span
                    className={
                      "absolute top-0.5 right-0.5 z-30 px-1 rounded-full text-[8px] font-black tabular-nums " +
                      (mastered
                        ? "bg-amber-400 text-zinc-900 shadow-md shadow-amber-900/40"
                        : "bg-white/15 text-white border border-white/20")
                    }
                  >
                    {mastered ? "⭐" : `Niv${lvl}`}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ─────────── Craft sparkles ─────────── */

/**
 * CraftSparkles — short burst of violet motes that converge into the row
 * the moment a card is forged. Pure decoration; lives ~1.8s in sync with
 * the parent's `justCrafted` window.
 */
function CraftSparkles() {
  const DOTS = 14;
  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none z-30">
      {/* Soft violet wash so the row reads "just lit up" before the dust
          arrives — primes the eye for the sparkle layer. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.55, 0] }}
        transition={{ duration: 1.6 }}
        className="absolute inset-0 rounded-xl bg-gradient-to-r from-violet-400/30 via-fuchsia-400/20 to-transparent"
      />
      {Array.from({ length: DOTS }).map((_, i) => {
        // Particles start at random positions across the row and travel
        // toward the icon on the left (the freshly-forged card thumbnail).
        const startX = 30 + (i * 7) % 70;
        const startY = -20 + (i * 11) % 60;
        const endX = -10 + (i * 3) % 14;
        const endY = 18 + (i * 5) % 12;
        const delay = (i % 5) * 0.05;
        const size = 3 + (i % 3);
        return (
          <motion.div
            key={i}
            initial={{ x: `${startX}%`, y: startY, opacity: 0, scale: 0.4 }}
            animate={{ x: `${endX}%`, y: endY, opacity: [0, 1, 0], scale: [0.4, 1.1, 0.2] }}
            transition={{ duration: 1.4, delay, ease: [0.22, 1, 0.36, 1] }}
            className="absolute rounded-full"
            style={{
              width: size,
              height: size,
              background: i % 2 ? "#c4b5fd" : "#f0abfc",
              boxShadow: i % 2
                ? "0 0 8px rgba(196,181,253,0.9)"
                : "0 0 8px rgba(240,171,252,0.9)",
            }}
          />
        );
      })}
    </div>
  );
}

/* ─────────── Pack opening modal ─────────── */

function PackOpeningModal({
  result, onClose,
}: {
  result: PackResult;
  onClose: () => void;
}) {
  const t = useT();
  // Cards start face-down — the player taps to flip each one. Letting the
  // user pace the reveal is what makes a pack opening *feel* like an event
  // instead of an automatic stagger.
  const [revealed, setRevealed] = useState<boolean[]>(() => result.cards.map(() => false));
  const allRevealed = revealed.every(Boolean);
  // Highest rarity in the pack drives the celebratory burst behind the
  // grid (epic/legendary get a warm fire palette, rare gets the cool one,
  // commons-only is calm — no burst). The intensity tracks how lucky the
  // pull was so the moment really lands.
  const maxRarity = useMemo(() => {
    const order = { common: 0, rare: 1, epic: 2, legendary: 3 } as const;
    return result.cards.reduce<keyof typeof order>(
      (acc, id) => (order[CARDS[id].rarity] > order[acc] ? CARDS[id].rarity : acc),
      "common",
    );
  }, [result.cards]);
  const showBurst = allRevealed && maxRarity !== "common";

  function reveal(idx: number) {
    if (revealed[idx]) return;
    hapticTap();
    const r = CARDS[result.cards[idx]].rarity;
    // A juicier buzz on the rare pulls so the player physically feels luck.
    if (r === "legendary") hapticMatchWin();
    else if (r === "epic") hapticMatchWin();
    setRevealed((cur) => {
      const next = cur.slice();
      next[idx] = true;
      return next;
    });
  }
  function revealAll() {
    if (allRevealed) return;
    hapticMatchWin();
    setRevealed(result.cards.map(() => true));
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
      onClick={allRevealed ? onClose : undefined}
    >
      {/* Celebratory backdrop — the level-up burst reused at a calmer
          intensity. Only fires once the last card has flipped so it stays
          a reward, not noise. */}
      {showBurst && (
        <div className="fixed inset-0 z-40 pointer-events-none">
          <BurstCanvas
            warm={maxRarity === "epic" || maxRarity === "legendary"}
            intensity={maxRarity === "legendary" ? 1.1 : maxRarity === "epic" ? 0.85 : 0.6}
          />
        </div>
      )}

      <motion.div
        initial={{ scale: 0.92, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 5 }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="relative z-50 w-full max-w-md bg-surface-raised border border-hairline rounded-3xl p-5 shadow-2xl flex flex-col gap-4"
      >
        <div className="text-center">
          <div className="text-3xl mb-1">🎉</div>
          <h2 className="text-lg font-black bg-gradient-to-br from-amber-300 to-orange-400 bg-clip-text text-transparent">
            Pack ouvert
          </h2>
          <p className="text-[11px] text-ink-muted mt-1">
            {allRevealed
              ? result.dustGained > 0
                ? <>Doublons → <span className="text-violet-300 font-bold">+{result.dustGained} ✨</span></>
                : "Tu as ouvert ton pack."
              : "Touche chaque carte pour la révéler"}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {result.cards.map((id, i) => (
            <PackCardFlip
              key={i}
              cardId={id}
              isNew={result.isNew[i]}
              revealed={revealed[i]}
              onReveal={() => reveal(i)}
              t={t}
            />
          ))}
        </div>

        {/* Bouton bascule "Tout révéler" → "Terminer" — un seul slot, deux
            comportements selon l'état du flip. */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={allRevealed ? onClose : revealAll}
          className={
            "w-full py-3 rounded-2xl font-bold text-white shadow-lg transition " +
            (allRevealed ? "bg-themed" : "bg-violet-500/40 hover:bg-violet-500/60 border border-violet-400/50")
          }
        >
          {allRevealed ? "Terminer" : "Tout révéler"}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

/* ─────────── Pack card flip ─────────── */

function PackCardFlip({
  cardId, isNew, revealed, onReveal, t,
}: {
  cardId: CardId;
  isNew: boolean;
  revealed: boolean;
  onReveal: () => void;
  t: (k: string) => string;
}) {
  const card = CARDS[cardId];
  const dust = DUST_PER_DUPLICATE[card.rarity] ?? 0;
  const rarityRing =
    card.rarity === "legendary" ? "ring-amber-400 shadow-amber-500/40" :
    card.rarity === "epic"      ? "ring-violet-400 shadow-violet-500/40" :
    card.rarity === "rare"      ? "ring-sky-400 shadow-sky-500/40" :
                                  "ring-white/15";
  const rarityHex =
    card.rarity === "legendary" ? "#fbbf24" :
    card.rarity === "epic"      ? "#a78bfa" :
    card.rarity === "rare"      ? "#38bdf8" :
                                  "#cbd5e1";
  const isRarePlus = card.rarity !== "common";

  return (
    <motion.button
      onClick={onReveal}
      whileTap={!revealed ? { scale: 0.95 } : undefined}
      animate={revealed ? { rotateY: 0 } : { rotateY: 180 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      style={{ transformStyle: "preserve-3d", perspective: 800 }}
      className={
        "relative rounded-xl overflow-hidden aspect-[3/4] flex flex-col items-center justify-center transition shadow-lg " +
        (revealed
          ? ((isNew ? "ring-2 ring-emerald-400 shadow-emerald-400/40 " : "ring-2 ") + rarityRing)
          : "ring-1 ring-violet-400/30 bg-gradient-to-br from-indigo-900 to-violet-900 cursor-pointer hover:brightness-110")
      }
    >
      {/* Back face (hidden once flipped) */}
      <div
        className={"absolute inset-0 flex items-center justify-center " + (revealed ? "invisible" : "")}
        style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-fuchsia-700 to-indigo-800" />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 12, ease: "linear", repeat: Infinity }}
          className="absolute inset-2 rounded-lg border-2 border-fuchsia-300/40"
        />
        <span className="relative text-3xl drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">🎴</span>
      </div>

      {/* Front face */}
      <div
        className={"absolute inset-0 " + (revealed ? "" : "invisible")}
        style={{ backfaceVisibility: "hidden" }}
      >
        <CardImage id={cardId} glyphSize="text-2xl" />

        {/* ── Reveal FX — play ONCE when the card flips face-up ── */}
        {revealed && (
          <>
            {/* Holographic sheen sweep across the freshly-revealed art. */}
            <motion.div
              aria-hidden
              initial={{ x: "-130%", opacity: 0 }}
              animate={{ x: "130%", opacity: [0, 0.9, 0] }}
              transition={{ duration: 0.7, delay: 0.18, ease: "easeOut" }}
              className="absolute inset-y-0 w-2/3 -skew-x-12 z-10 pointer-events-none"
              style={{ background: `linear-gradient(90deg, transparent, ${rarityHex}, transparent)` }}
            />
            {/* Rarity shockwave ring (rare and up) — a quick burst of "value". */}
            {isRarePlus && (
              <motion.div
                aria-hidden
                initial={{ opacity: 0.85, scale: 0.4 }}
                animate={{ opacity: 0, scale: 1.8 }}
                transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
                className="absolute inset-0 m-auto w-3/4 h-3/4 rounded-full z-10 pointer-events-none"
                style={{ border: `2px solid ${rarityHex}`, boxShadow: `0 0 16px ${rarityHex}` }}
              />
            )}
            {/* Epic/legendary sparkle motes converging outward. */}
            {(card.rarity === "epic" || card.rarity === "legendary") &&
              Array.from({ length: 8 }).map((_, i) => {
                const ang = (i / 8) * Math.PI * 2;
                return (
                  <motion.span
                    key={i}
                    aria-hidden
                    initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                    animate={{ opacity: 0, x: Math.cos(ang) * 42, y: Math.sin(ang) * 42, scale: 0.2 }}
                    transition={{ duration: 0.7, delay: 0.25, ease: "easeOut" }}
                    className="absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-full z-10 pointer-events-none"
                    style={{ background: rarityHex, boxShadow: `0 0 8px ${rarityHex}` }}
                  />
                );
              })}
          </>
        )}
        <div className="relative z-10 flex flex-col items-center gap-0.5 p-1 mt-auto">
          <span className="text-2xl">{card.glyph}</span>
          <span className="text-[8px] font-bold uppercase text-white/90 text-center leading-tight">
            {t(card.nameKey)}
          </span>
          <span className={"text-[8px] font-bold " + RARITY_COLOR[card.rarity]}>
            {card.rarity}
          </span>
        </div>
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="absolute top-1 right-1 z-20"
        >
          {isNew ? (
            <span className="text-[8px] font-black uppercase tracking-wider bg-emerald-400 text-zinc-900 px-1.5 py-0.5 rounded-full">
              NEW
            </span>
          ) : (
            <span className="text-[8px] font-black uppercase tracking-wider bg-violet-400/90 text-zinc-900 px-1.5 py-0.5 rounded-full">
              +{dust} ✨
            </span>
          )}
        </motion.div>
      </div>
    </motion.button>
  );
}
