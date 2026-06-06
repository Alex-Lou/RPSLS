/**
 * RankedLobby — home screen of Constellation Ranked.
 */

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useStore } from "../store/store";
import { rankFromLp } from "../engine/rank";
import { levelFromXp } from "../engine/leveling";
import { ALL_CARD_IDS, CARDS, RARITY_COLOR, RARITY_ORDER } from "./cards";
import { CRAFT_COST } from "../engine/economy";
import { CardImage } from "./CardImage";
import { useT } from "../i18n";
import { InfoBubble } from "../flavor/InfoBubble";
import { avatarImgStyle } from "../theme/avatar";
import { FloatingMatchBackButton } from "../match/sharedMatchUI";
import { CurrencyBadges } from "./CurrencyBadges";
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
  const tier = rankFromLp(player.rankLp);
  const lvl = levelFromXp(player.xp);
  const totalGames = player.stats.wins + player.stats.losses + player.stats.draws;
  const winrate = player.stats.wins + player.stats.losses > 0
    ? Math.round((player.stats.wins / (player.stats.wins + player.stats.losses)) * 100)
    : 0;
  const lpProgress = tier.ceil === Infinity
    ? 1
    : (player.rankLp - tier.floor) / (tier.ceil - tier.floor);

  const [rulesOpen, setRulesOpen] = useState(false);
  const countdown = useCountdown(30);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-3 sm:gap-5 flex-1 py-2 px-1 max-w-lg mx-auto w-full overflow-y-auto"
    >
      {/* Back to the main menu — docked next to the burger so the player never
          has to rely on the Android back button (which could minimise the app). */}
      {onBack && <FloatingMatchBackButton onClick={onBack} label={t("nav.backToPlay")} />}

      {/* Title */}
      <div className="text-center">
        <h1
          className="text-2xl sm:text-4xl font-extrabold tracking-tight text-themed leading-tight"
          style={{ fontFamily: "var(--font-headline)" }}
        >
          Constellation Ranked
        </h1>
        <p className="mt-1 text-ink-muted text-xs sm:text-sm">3 lanes · Best of 5 · Mana & Cartes</p>
      </div>

      {/* Profile card */}
      <div className="bg-surface border border-hairline rounded-3xl p-4 sm:p-5 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border border-hairline flex items-center justify-center text-3xl overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg, color-mix(in oklab, var(--theme-primary) 32%, transparent), color-mix(in oklab, var(--theme-secondary) 32%, transparent))",
            }}
          >
            {/^(data:|\/|https?:)/.test(player.avatar) ? (
              <img
                src={player.avatar}
                alt=""
                className="w-full h-full object-cover"
                style={avatarImgStyle(player.avatar)}
              />
            ) : (
              player.avatar
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-lg truncate">{player.nickname}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={
                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r " +
                tier.gradient + " text-zinc-900"
              }>
                {tier.emoji} {tier.label}
              </span>
              <span className="text-xs text-ink-muted">Lv.{lvl.level}</span>
            </div>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-[10px] text-ink-muted mb-1">
            <div className="flex items-center gap-1.5">
              <span className="uppercase tracking-wider font-semibold">LP</span>
              <InfoBubble
                size="sm"
                title="LP — League Points"
                body={
                  <>
                    Points de rang. Tu en gagnes quand tu gagnes des matchs Classés / Constellation Classés et tu en perds quand tu perds.
                    Les paliers : <b>Bronze</b> (0+), <b>Silver</b> (1100+), <b>Gold</b> (1300+), <b>Platinum</b> (1500+), <b>Diamond</b> (1750+).
                    Chaque palier débloque une carte ou un cosmétique.
                  </>
                }
              />
            </div>
            <span className="tabular-nums">{player.rankLp} {tier.ceil !== Infinity && `/ ${tier.ceil}`}</span>
          </div>
          <div className="h-2 rounded-full bg-hairline overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(lpProgress * 100).toFixed(1)}%` }}
              transition={{ duration: 0.8, type: "spring", stiffness: 120, damping: 20 }}
              className="h-full rounded-full bg-themed"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <StatCell label={t("profile.stat.games")} value={String(totalGames)} color="text-ink" />
          <StatCell label={t("profile.stat.winrate")} value={`${winrate}%`} color="text-amber-300" />
          <StatCell label={t("profile.stat.lp")} value={String(player.rankLp)} color="text-violet-300" />
        </div>
        {/* Wallet — clickable, jumps straight to the boutique so the player
            can spend match earnings in one tap instead of unwinding back to
            the home menu. */}
        <div className="flex items-center justify-center pt-1">
          <CurrencyBadges size="full" onClick={onGoShop} />
        </div>
      </div>

      {/* Tournament — real countdown */}
      {/* Deck manager */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={onManageDeck}
        className="bg-surface rounded-2xl px-4 py-3 flex items-center justify-between hover:bg-hairline transition"
        style={{ border: "1px solid color-mix(in oklab, var(--theme-primary) 35%, transparent)" }}
      >
        <div className="flex items-center gap-2.5">
          <img src="/MenuIcons/DeckGestionIcone.png" alt="" className="w-7 h-7 object-contain drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]" draggable={false} />
          <div className="text-left">
            <div className="font-bold text-sm text-ink">Gérer mon Deck</div>
            <div className="text-[10px] text-ink-faint">3 main + 3 réserve</div>
          </div>
        </div>
        <span className="text-violet-300">›</span>
      </motion.button>

      {/* Main CTA — go to tournament bracket */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={onViewBracket}
        className="w-full rounded-2xl px-4 py-4 flex items-center justify-between transition hover:brightness-110"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in oklab, var(--theme-primary) 22%, transparent), color-mix(in oklab, var(--theme-secondary) 22%, transparent))",
          border: "1px solid color-mix(in oklab, var(--theme-primary) 40%, transparent)",
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏆</span>
          <div className="text-left">
            <div className="font-bold text-base text-ink">Voir le Tournoi</div>
            <div className="text-[10px] text-ink-muted">8 adversaires CPU · Prochain dans {countdown}</div>
          </div>
        </div>
        <span className="text-lg" style={{ color: "var(--theme-secondary)" }}>›</span>
      </motion.button>

      {/* How to play — simple toggle, no AnimatePresence */}
      <button
        onClick={() => setRulesOpen((o) => !o)}
        className="bg-surface border border-hairline rounded-2xl px-4 py-2.5 flex items-center justify-between text-left hover:bg-white/[0.07] transition"
      >
        <span className="text-sm flex items-center gap-2">
          <img src={HIW_ICONS.how} alt="" className="w-6 h-6 object-contain" draggable={false} />
          <span className="font-semibold text-ink-muted">Comment ça marche ?</span>
        </span>
        <span className={"text-ink-faint text-sm transition-transform duration-200 " + (rulesOpen ? "rotate-180" : "")}>▾</span>
      </button>
      {rulesOpen && (
        <div className="bg-surface border border-hairline rounded-3xl p-4 sm:p-5 -mt-1">
          <div className="flex flex-col gap-2.5 text-[12px] text-ink-muted leading-relaxed">
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
        </div>
      )}

      {/* Full card list — names + descriptions + type symbols per card. The
          general type legend lives in "Comment ça marche" above; here is the
          detailed per-card reference (no duplication of the legend). */}
      <div className="bg-surface border border-hairline rounded-3xl p-4 sm:p-5">
        <h2 className="text-xs uppercase tracking-[0.25em] font-bold text-ink-muted mb-3">
          Toutes les cartes
        </h2>
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
                    {/* The card art preview on the left already carries the
                        glyph fallback when no PNG ships, so duplicating the
                        emoji next to the title reads as redundant — title +
                        rarity dot are enough. */}
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
      </div>

      {/* spacer */}
      <div className="h-2" />
    </motion.div>
  );
}

/* ──────────── Small components ──────────── */

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

function StatCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-hairline border border-hairline rounded-xl p-2 text-center">
      <div className={"text-lg font-bold tabular-nums " + color}>{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-ink-faint mt-0.5">{label}</div>
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
