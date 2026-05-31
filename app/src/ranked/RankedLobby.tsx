/**
 * RankedLobby — home screen of Constellation Ranked.
 */

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useStore } from "../store";
import { rankFromLp } from "../rank";
import { levelFromXp } from "../leveling";
import { ALL_CARD_IDS, CARDS, RARITY_COLOR } from "./cards";
import { CardImage } from "./CardImage";
import { useT } from "../i18n";
import { InfoBubble } from "../flavor/InfoBubble";
// Tournament state now lives in PlayPage

export function RankedLobby({ onViewBracket, onManageDeck }: { onViewBracket: () => void; onManageDeck: () => void }) {
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
      {/* Title */}
      <div className="text-center">
        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-amber-300 via-rose-400 to-fuchsia-400 bg-clip-text text-transparent leading-tight">
          Constellation Ranked
        </h1>
        <p className="mt-1 text-zinc-400 text-xs sm:text-sm">3 lanes · Best of 5 · Mana & Cartes</p>
      </div>

      {/* Profile card */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-4 sm:p-5 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 border border-white/15 flex items-center justify-center text-3xl overflow-hidden">
            {/^(data:|\/|https?:)/.test(player.avatar) ? (
              <img src={player.avatar} alt="" className="w-full h-full object-cover" />
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
              <span className="text-xs text-zinc-400">Lv.{lvl.level}</span>
            </div>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
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
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(lpProgress * 100).toFixed(1)}%` }}
              transition={{ duration: 0.8, type: "spring", stiffness: 120, damping: 20 }}
              className={"h-full rounded-full bg-gradient-to-r " + tier.gradient}
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <StatCell label={t("profile.stat.games")} value={String(totalGames)} color="text-zinc-200" />
          <StatCell label={t("profile.stat.winrate")} value={`${winrate}%`} color="text-amber-300" />
          <StatCell label={t("profile.stat.lp")} value={String(player.rankLp)} color="text-violet-300" />
        </div>
      </div>

      {/* Tournament — real countdown */}
      {/* Deck manager */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={onManageDeck}
        className="bg-white/5 border border-violet-400/30 rounded-2xl px-4 py-3 flex items-center justify-between hover:bg-violet-500/10 transition"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🃏</span>
          <div className="text-left">
            <div className="font-bold text-sm text-zinc-200">Gérer mon Deck</div>
            <div className="text-[10px] text-zinc-500">3 main + 3 réserve</div>
          </div>
        </div>
        <span className="text-violet-300">›</span>
      </motion.button>

      {/* Main CTA — go to tournament bracket */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={onViewBracket}
        className="w-full bg-gradient-to-r from-amber-500/20 to-rose-500/20 border border-amber-400/30 rounded-2xl px-4 py-4 flex items-center justify-between hover:from-amber-500/30 hover:to-rose-500/30 transition"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏆</span>
          <div className="text-left">
            <div className="font-bold text-base text-zinc-100">Voir le Tournoi</div>
            <div className="text-[10px] text-zinc-400">8 joueurs · Prochain dans {countdown}</div>
          </div>
        </div>
        <span className="text-amber-300 text-lg">›</span>
      </motion.button>

      {/* How to play — simple toggle, no AnimatePresence */}
      <button
        onClick={() => setRulesOpen((o) => !o)}
        className="bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 flex items-center justify-between text-left hover:bg-white/[0.07] transition"
      >
        <span className="text-sm flex items-center gap-2">
          <span>💡</span>
          <span className="font-semibold text-zinc-300">Comment ça marche ?</span>
        </span>
        <span className={"text-zinc-500 text-sm transition-transform duration-200 " + (rulesOpen ? "rotate-180" : "")}>▾</span>
      </button>
      {rulesOpen && (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-4 sm:p-5 -mt-1">
          <div className="flex flex-col gap-2.5 text-[12px] text-zinc-300 leading-relaxed">
            <RuleBlock emoji="🎯" title="Le principe"
              text="Pose 3 coups sur 3 lanes (FORCE / SAGESSE / RUSE). Révélation. Le plus de lanes gagnées = round gagné. Premier à 3 rounds." />
            <RuleBlock emoji="💜" title="Mana"
              text="1 mana au round 1, +1 par round (max 4). Sert à jouer des cartes." />
            <RuleBlock emoji="🃏" title="Cartes"
              text="Main de 3 cartes. Tu pioches si tu GAGNES un round. Tu perds 1 carte si tu PERDS. 0 ou 1 carte par round." />

            <div className="text-[10px] uppercase tracking-wider font-bold text-zinc-500 mt-1">⚪ Communes (1 mana)</div>
            <CardRule id="aegis" />
            <CardRule id="precision" />
            <CardRule id="anchor" />
            <CardRule id="second-wind" />

            <div className="text-[10px] uppercase tracking-wider font-bold text-blue-400 mt-1">🔵 Rares (2 mana)</div>
            <CardRule id="surge" />
            <CardRule id="augur" />
            <CardRule id="echo" />
            <CardRule id="curse" />

            <div className="text-[10px] uppercase tracking-wider font-bold text-violet-400 mt-1">🟣 Épiques (3 mana)</div>
            <CardRule id="heist" />
            <CardRule id="tide" />
            <CardRule id="oracle" />
            <CardRule id="vortex" />

            <div className="text-[10px] uppercase tracking-wider font-bold text-amber-400 mt-1">🟡 Légendaire (4 mana)</div>
            <CardRule id="supernova" />

            <RuleBlock emoji="✨" title="Bonus"
              text="Lane favorisée = +1 pt. Combo (3× même coup) = +1. Sweep (3-0) = +2." />
          </div>
        </div>
      )}

      {/* Cards overview — all 13 */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-4 sm:p-5">
        <h2 className="text-xs uppercase tracking-[0.25em] font-bold text-zinc-400 mb-3">
          Toutes les cartes
        </h2>
        <div className="flex flex-col gap-2">
          {ALL_CARD_IDS.map((id) => {
            const card = CARDS[id];
            return (
              <div key={id} className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/5 p-2">
                <div className="relative shrink-0 w-10 h-14 rounded-lg overflow-hidden bg-zinc-950">
                  <CardImage id={id} glyphSize="text-xl" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-sm">{t(card.nameKey)}</span>
                    <span className={"text-[8px] font-bold uppercase " + RARITY_COLOR[card.rarity]}>{card.rarity}</span>
                    <span className="text-[9px] text-zinc-500 bg-white/5 px-1 py-0.5 rounded-full">{card.cost}m</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-0.5 leading-snug">{t(card.descKey)}</p>
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

function CardRule({ id }: { id: string }) {
  const t = useT();
  const card = CARDS[id as keyof typeof CARDS];
  if (!card) return null;
  return (
    <div className="flex items-start gap-2">
      <span className="text-base shrink-0 mt-0.5">{card.glyph}</span>
      <div>
        <span className="font-bold text-zinc-200">{t(card.nameKey)}</span>
        <span className="text-zinc-500 ml-1">({card.cost}m)</span>
        <span className="text-zinc-400"> — {t(card.descKey)}</span>
      </div>
    </div>
  );
}

function StatCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white/5 border border-white/5 rounded-xl p-2 text-center">
      <div className={"text-lg font-bold tabular-nums " + color}>{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-zinc-500 mt-0.5">{label}</div>
    </div>
  );
}

function RuleBlock({ emoji, title, text }: { emoji: string; title: string; text: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-base shrink-0 mt-0.5">{emoji}</span>
      <div>
        <span className="font-bold text-zinc-200">{title}</span>
        <span className="text-zinc-400"> — {text}</span>
      </div>
    </div>
  );
}
