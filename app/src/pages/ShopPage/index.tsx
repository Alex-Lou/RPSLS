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

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { formatNumber } from "../../i18n/format";
import { useStore } from "../../store/store";
import { useT } from "../../i18n";
import { ALL_CARD_IDS, CARDS, RARITY_BG, RARITY_COLOR } from "../../ranked/cards";
import { CardImage } from "../../ranked/CardImage";
import type { CardId } from "../../ranked/rankedTypes";
import { CurrencyBadges } from "../../ranked/CurrencyBadges";
import { PACK_COST, type PackResult, craftCost } from "../../engine/economy";
import { hapticTap, hapticMatchWin } from "../../haptic";
import { useNoMenuFx } from "../../fx/menuFx";
import { ShopTabButton } from "./ShopTabButton";
import { CodexView } from "./CodexView";
import { CraftSparkles } from "./CraftSparkles";
import { PackOpeningModal } from "./PackOpeningModal";

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
              : `Il manque ${formatNumber(PACK_COST - eclats)} 💎`}
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
