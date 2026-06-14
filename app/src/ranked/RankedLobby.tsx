/**
 * RankedLobby — home screen of Constellation Ranked.
 */

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { useStore } from "../store/store";
import { rankProgress } from "../engine/rank";
import { LpBar } from "./LpBar";
import { levelFromXp } from "../engine/leveling";
import { ALL_CARD_IDS, CARDS, RARITY_COLOR, RARITY_ORDER } from "./cards";
import { CRAFT_COST } from "../engine/economy";
import { CardImage } from "./CardImage";
import { useT } from "../i18n";
import { InfoBubble } from "../flavor/InfoBubble";
import { CurrencyBadges } from "./CurrencyBadges";
import { avatarImgStyle } from "../theme/avatar";
import { ModeLobbyShell, LobbyChip } from "../ui/ModeLobbyShell";
// Tournament state now lives in PlayPage

/** Custom illustrated icons for the "Comment ça marche ?" section (replace
 *  the base emojis). Dropped under public/IconesMenu CommentCaMarche/. */
const HIW_ICONS = {
  how:      "/IconesMenu CommentCaMarche/Comment Ca Marche Icone.png",
  principe: "/IconesMenu CommentCaMarche/Principe Icone.png",
  mana:     "/IconesMenu CommentCaMarche/Mana Icone.png",
  cartes:   "/IconesMenu CommentCaMarche/Cartes icone.png",
};

export function RankedLobby({ onViewBracket, onManageDeck, onBack, onGoShop }: { onViewBracket: () => void; onManageDeck: () => void; onBack?: () => void; onGoShop?: () => void }) {
  const t = useT();
  const player = useStore((s) => s.player);
  const { tier, progress: lpProgress } = rankProgress(player.rankLp);
  const lvl = levelFromXp(player.xp);
  const totalGames = player.stats.wins + player.stats.losses + player.stats.draws;
  const winrate = player.stats.wins + player.stats.losses > 0
    ? Math.round((player.stats.wins / (player.stats.wins + player.stats.losses)) * 100)
    : 0;
  const [rulesOpen, setRulesOpen] = useState(false);
  const [cardsOpen, setCardsOpen] = useState(false);
  const countdown = useCountdown(30);

  return (
    <ModeLobbyShell
      title="Constellation Classée"
      tagline="3 lanes · Best of 5 · Mana & Cartes · LP & récompenses"
      titleGradient="from-amber-300 to-violet-300"
      onBack={onBack}
      cta={
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onViewBracket}
          className="w-full rounded-2xl px-5 py-3 flex items-center justify-between font-black text-white shadow-2xl bg-themed-br"
          style={{
            boxShadow: "0 12px 32px -6px color-mix(in oklab, var(--theme-primary) 55%, transparent), 0 0 24px color-mix(in oklab, var(--theme-secondary) 35%, transparent)",
            fontFamily: "var(--font-headline)",
            letterSpacing: "0.04em",
          }}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🏆</span>
            <div className="text-left">
              <div className="text-sm sm:text-base">VOIR LE TOURNOI</div>
              <div className="text-[10px] font-medium opacity-85 normal-case tracking-normal">
                8 adversaires CPU · prochain dans {countdown}
              </div>
            </div>
          </div>
          <span className="text-xl">›</span>
        </motion.button>
      }
      secondary={
        // Rangée secondaire — MÊME pattern que le Pro ([Match rapide][Tournoi]
        // [Règles]) : ici Règles + Cartes ouvrent des MODALES (plus de
        // scroll-wall). Comprehension + dispatch (Alex 2026-06-13).
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setRulesOpen(true)}
            className="bg-surface rounded-2xl px-2 py-2.5 flex items-center justify-center gap-1.5 border border-hairline hover:bg-hairline transition"
          >
            <img src={HIW_ICONS.how} alt="" className="w-6 h-6 object-contain" draggable={false} />
            <span className="font-bold text-[12px] text-ink">Comment ça marche</span>
          </button>
          <button
            onClick={() => setCardsOpen(true)}
            className="bg-surface rounded-2xl px-2 py-2.5 flex items-center justify-center gap-1.5 border border-hairline hover:bg-hairline transition"
          >
            <span className="text-base leading-none">🎴</span>
            <span className="font-bold text-[12px] text-ink">Toutes les cartes</span>
          </button>
        </div>
      }
    >
      {/* PROFIL = UN SEUL BLOC (Alex 2026-06-13 "faut pas déstructurer ce qui
       *  est de base ensemble") : avatar + nom + chips + barre LP + monnaies
       *  dans la MÊME carte. Le bouton Deck suit, le groupe est centré
       *  (my-auto) comme le [Ma Voie] + [Deck] du Pro. */}
      <div className="my-auto flex flex-col gap-2.5">
        <div
          className="bg-surface rounded-2xl px-4 py-3.5 flex flex-col gap-3"
          style={{ border: "1px solid color-mix(in oklab, var(--theme-primary) 35%, transparent)" }}
        >
          {/* Avatar + nom + chips */}
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center text-2xl shrink-0 ring-1 ring-white/15"
              style={{
                background:
                  "linear-gradient(135deg, color-mix(in oklab, var(--theme-primary) 32%, transparent), color-mix(in oklab, var(--theme-secondary) 32%, transparent))",
              }}
            >
              {/^(data:|\/|https?:)/.test(player.avatar) ? (
                <img src={player.avatar} alt="" className="w-full h-full object-cover" style={avatarImgStyle(player.avatar)} draggable={false} />
              ) : (
                player.avatar
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-base truncate">{player.nickname}</div>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <LobbyChip tone="accent">{tier.emoji} {tier.label}</LobbyChip>
                <LobbyChip>Lv.{lvl.level}</LobbyChip>
                <LobbyChip tone="good">{winrate}% WR</LobbyChip>
              </div>
            </div>
          </div>
          {/* Barre LP */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-amber-200">Rang · {tier.label}</span>
                <InfoBubble
                  size="sm"
                  title="LP — League Points"
                  body={
                    <>
                      Points de rang. Gagnés en gagnant des matchs Classés / Constellation Classés, perdus en perdant.
                      Paliers : <b>Bronze</b> (0+), <b>Silver</b> (1100+), <b>Gold</b> (1300+), <b>Platinum</b> (1500+), <b>Diamond</b> (1750+).
                      Chaque palier débloque une carte ou un cosmétique.
                    </>
                  }
                />
              </div>
              <span className="text-[10px] tabular-nums text-ink-muted">
                {player.rankLp} {tier.ceil !== Infinity && `/ ${tier.ceil}`} LP
              </span>
            </div>
            <LpBar progress={lpProgress} />
            <div className="text-[10px] text-ink-faint mt-1">{totalGames} matchs · {winrate}% de victoires</div>
          </div>
          {/* Monnaies — dans la MÊME carte, séparées par un filet. */}
          <div className="pt-2.5 border-t border-hairline flex items-center justify-center">
            <CurrencyBadges size="full" onClick={onGoShop} />
          </div>
        </div>

        {/* Deck — bouton IDENTIQUE au Pro (Alex 2026-06-13 : "mêmes boutons"). */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onManageDeck}
          className="bg-surface rounded-2xl px-4 py-3 flex items-center justify-between hover:bg-hairline transition"
          style={{ border: "1px solid color-mix(in oklab, var(--theme-primary) 35%, transparent)" }}
        >
          <div className="flex items-center gap-2.5">
            <img src="/MenuIcons/DeckGestionIcone.png" alt="" className="w-8 h-8 object-contain drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]" draggable={false} />
            <div className="text-left">
              <div className="font-bold text-[15px] text-ink">Gérer mon Deck</div>
              <div className="text-[11px] text-ink-faint">Compose tes 6 cartes</div>
            </div>
          </div>
          <span style={{ color: "var(--theme-secondary)" }}>›</span>
        </motion.button>
      </div>

      {/* ── MODALES (overlays) — fini le scroll-wall : Règles + Cartes ── */}
      <AnimatePresence>
        {rulesOpen && (
          <ModalOverlay title="Comment ça marche" onClose={() => setRulesOpen(false)}>
            <div className="flex flex-col gap-2.5 text-[12.5px] text-ink-muted leading-relaxed">
              <RuleBlock emoji="🎯" iconSrc={HIW_ICONS.principe} title="Le principe"
                text="Pose 3 coups sur 3 lanes (FORCE / SAGESSE / RUSE). Révélation. Le plus de lanes gagnées = round gagné. Premier à 3 rounds." />
              <RuleBlock emoji="💜" iconSrc={HIW_ICONS.mana} title="Mana"
                text="1 mana au round 1, +1 par round (max 4). Sert à jouer des cartes." />
              <RuleBlock emoji="🃏" iconSrc={HIW_ICONS.cartes} title="Cartes"
                text="Main de 3 cartes. Tu pioches si tu GAGNES un round. Tu perds 1 carte si tu PERDS. 0 ou 1 carte par round." />
              <RuleBlock emoji="✨" title="Bonus"
                text="Lane favorisée = +1 pt. Combo (3× même coup) = +1. Sweep (3-0) = +2." />
            </div>
            <CardOverviewTable />
          </ModalOverlay>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {cardsOpen && (
          <ModalOverlay title="Toutes les cartes" onClose={() => setCardsOpen(false)}>
            <div className="flex flex-col gap-2">
              {ALL_CARD_IDS.map((id) => {
                const card = CARDS[id];
                const usage = USAGE_LABEL[card.rarity];
                const oneShot = card.rarity === "epic" || card.rarity === "legendary";
                return (
                  <div key={id} className="flex items-center gap-3 rounded-xl bg-hairline border border-hairline p-2.5">
                    <div className="relative shrink-0 w-11 h-14 rounded-lg overflow-hidden bg-surface-raised">
                      <CardImage id={id} glyphSize="text-xl" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm">{t(card.nameKey)}</span>
                        <span className={"inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide " + RARITY_COLOR[card.rarity]}>
                          <span className={"w-2 h-2 rounded-full " + RARITY_DOT[card.rarity]} />
                          {RARITY_LABEL_FR[card.rarity]}
                        </span>
                        <span className="text-[9px] text-ink-faint bg-black/25 px-1.5 py-0.5 rounded-full font-semibold">{card.cost} mana</span>
                        <span className={"text-[9px] font-bold px-1.5 py-0.5 rounded-full " + (oneShot ? "bg-rose-500/15 text-rose-300" : "bg-emerald-500/15 text-emerald-300")}>
                          {usage.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-ink-muted mt-1 leading-snug">{t(card.descKey)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ModalOverlay>
        )}
      </AnimatePresence>
    </ModeLobbyShell>
  );
}

/* ──────────── Small components ──────────── */

/** Modale plein écran réutilisable (Règles / Toutes les cartes) — portal,
 *  corps scrollable, en-tête + croix. Remplace les listes inline qui
 *  faisaient du lobby un mur de scroll (Alex 2026-06-13). */
function ModalOverlay({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
      className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3"
    >
      <motion.div
        initial={{ scale: 0.95, y: 24, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[84vh] flex flex-col rounded-3xl border border-hairline bg-zinc-950/97 shadow-2xl overflow-hidden"
      >
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-hairline">
          <h2 className="text-sm font-black uppercase tracking-wider text-themed">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="w-8 h-8 rounded-full bg-hairline text-ink-muted hover:text-white text-base flex items-center justify-center transition"
          >✕</button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4">{children}</div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

function useCountdown(intervalMinutes: number) {
  const [remaining, setRemaining] = useState(() => {
    const now = Date.now();
    const ms = intervalMinutes * 60 * 1000;
    return ms - (now % ms);
  });
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const ms = intervalMinutes * 60 * 1000;
      setRemaining(ms - (now % ms));
    }, 1000);
    return () => clearInterval(id);
  }, [intervalMinutes]);
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

const USAGE_LABEL: Record<string, { label: string; color: string }> = {
  common: { label: "Permanent", color: "text-emerald-400" },
  rare: { label: "Permanent", color: "text-emerald-400" },
  epic: { label: "Usage unique", color: "text-rose-400" },
  legendary: { label: "Usage unique", color: "text-rose-400" },
};

const RARITY_LABEL_FR: Record<string, string> = {
  common: "Commune",
  rare: "Rare",
  epic: "Épique",
  legendary: "Légendaire",
};

const RARITY_DOT: Record<string, string> = {
  common: "bg-zinc-400",
  rare: "bg-blue-400",
  epic: "bg-violet-400",
  legendary: "bg-amber-400",
};

/** GENERAL legend of card TYPES — one row per rarity, NOT per card. Explains
 *  what each tier means (how many exist, forge price, reusable vs one-shot) so
 *  the player understands the system; the full card list with names +
 *  descriptions + glyphs lives in "Toutes les cartes" just below — no
 *  duplication. Bigger, readable type since there are only 4 rows. */
function CardOverviewTable() {
  const tiers = RARITY_ORDER.map((rarity) => ({
    rarity,
    count: ALL_CARD_IDS.filter((id) => CARDS[id].rarity === rarity).length,
    usage: USAGE_LABEL[rarity],
    forge: CRAFT_COST[rarity],
  }));

  return (
    <div className="mt-4">
      <div
        className="rounded-2xl overflow-hidden border"
        style={{ borderColor: "color-mix(in oklab, var(--theme-primary) 28%, transparent)" }}
      >
        <table className="w-full text-[13px] sm:text-sm border-separate border-spacing-0">
          <thead>
            <tr
              className="text-left uppercase tracking-wider text-[11px]"
              style={{
                background: "color-mix(in oklab, var(--theme-primary) 16%, transparent)",
                color: "color-mix(in oklab, var(--theme-primary) 82%, white)",
              }}
            >
              <th className="text-left py-2.5 pl-3 pr-1 font-bold">Rareté</th>
              <th className="text-center py-2.5 px-1 font-bold">Cartes</th>
              <th className="text-center py-2.5 px-1 font-bold">Forge</th>
              <th className="text-right py-2.5 px-1 pr-3 font-bold">Usage</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map(({ rarity, count, usage, forge }, i) => (
              <tr key={rarity} style={{ background: i % 2 ? "rgba(255,255,255,0.025)" : "transparent" }}>
                <td className="py-2.5 pl-3 pr-1 border-t border-white/[0.06]">
                  <span className="flex items-center gap-2">
                    <span className={"w-2.5 h-2.5 rounded-full shrink-0 " + RARITY_DOT[rarity]} />
                    <span className={"font-bold " + RARITY_COLOR[rarity]}>{RARITY_LABEL_FR[rarity]}</span>
                  </span>
                </td>
                <td className="text-center py-2.5 px-1 border-t border-white/[0.06] text-ink font-bold tabular-nums">{count}</td>
                <td className="text-center py-2.5 px-1 border-t border-white/[0.06] text-ink-muted whitespace-nowrap font-semibold">{forge} ✨</td>
                <td className="text-right py-2.5 px-1 pr-3 border-t border-white/[0.06]">
                  <span className={"font-bold whitespace-nowrap " + usage.color}>{usage.label}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] sm:text-xs text-ink-faint mt-2 leading-relaxed">
        <span className="text-emerald-400 font-semibold">Permanent</span> : la carte revient dans ta pioche, rejouable toute la partie.{" "}
        <span className="text-rose-400 font-semibold">Usage unique</span> : consommée définitivement après l'avoir jouée.{" "}
        <span className="text-ink-muted">Forge</span> = coût en ✨ pour la fabriquer.
      </p>
    </div>
  );
}

function RuleBlock({ emoji, title, text, iconSrc }: { emoji: string; title: string; text: string; iconSrc?: string }) {
  return (
    <div className="flex items-start gap-2">
      {iconSrc ? (
        <img src={iconSrc} alt="" className="w-6 h-6 shrink-0 mt-0.5 object-contain drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]" draggable={false} />
      ) : (
        <span className="text-base shrink-0 mt-0.5">{emoji}</span>
      )}
      <div>
        <span className="font-bold text-ink">{title}</span>
        <span className="text-ink-muted"> — {text}</span>
      </div>
    </div>
  );
}
