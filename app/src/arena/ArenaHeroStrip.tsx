/**
 * ArenaHeroStrip — portrait + HP bar + mana pips + hand count for one hero.
 *
 * Extracted from ArenaBoard.tsx to keep that file under the project's
 * 400-line ceiling. Used twice per board (opp on top, player on bottom).
 *
 * Visual ownership: emerald accents for "you", rose for "opp". The portrait
 * pulses + tints red when the hero just took damage (driven by the
 * useEffect that compares prev/next HP), and floats a "-N" damage popup
 * out of the portrait at the same time.
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CARDS } from "../ranked/cards";
import { CardImage } from "../ranked/CardImage";
import { useT } from "../i18n";
import type { CardId } from "../ranked/rankedTypes";
import { arenaCardDescKey } from "./arenaTypes";
import type { BoardState, HeroState, PlayedSpell } from "./arenaTypes";
import { arenaSpellCost } from "./arenaSpellHelpers";
import { ArenaConstellationBar } from "./ArenaConstellationBar";
import { ArenaSpellQueueChip } from "./ArenaSpellQueueChip";
import { VoieAura } from "./ArenaVoieAura";

export interface ArenaHeroStripProps {
  hero: HeroState;
  /** Board complet — utilisé pour computer live le count Constellation
   *  (Lot C v2 simultanée) plutôt que de lire hero.constellationCount qui
   *  pourrait être stale après combat. Optionnel (fallback sur le count). */
  board?: BoardState;
  side: "you" | "opp";
  turn: number;
  /** Display name shown next to the portrait — player nickname for "you",
   *  "CPU" / persona name for "opp". */
  name: string;
  /** Avatar — emoji char, preset path, or undefined for the default mask. */
  avatar?: string;
  /** Bumped every time an enemy lane creature attacks THIS hero (undefended
   *  lane attack). Drives a dramatic HP-bar flash: white sweep + shake +
   *  rose ring pulse. The KEY is what triggers the re-render of the
   *  AnimatePresence overlay so consecutive hits all animate. */
  incomingAttackKey?: number | null;
  /** Augur reveal — when the OPPOSING side cast Augur on this hero,
   *  shows the hero's hand (up to 4 cards) as small chips for this turn.
   *  Cleared by `advanceToNextTurn` (arenaRules) so it auto-disappears. */
  augurRevealed?: CardId[];
  /** Sorts utility planifiés sur CE héros (kind ≠ "lane"). Affichés en
   *  rangée mini-cartes sous le portrait — pendant le step de planning pour
   *  "you", pendant le reveal pour "opp". (Alex 2026-06-11) */
  pendingUtility?: PlayedSpell[];
  /** Retire le sort utility à l'index local `localIdx` dans pendingUtility
   *  (seulement côté you, en planning). Si absent, chips read-only. */
  onRemoveUtility?: (localIdx: number) => void;
}

export function ArenaHeroStrip({
  hero, side, turn, name, avatar, incomingAttackKey, augurRevealed, pendingUtility, onRemoveUtility,
}: ArenaHeroStripProps) {
  const t = useT();
  const accent = side === "you" ? "text-emerald-300" : "text-rose-300";
  const ringColor = side === "you" ? "ring-emerald-400/70" : "ring-rose-400/70";
  const hpPct = Math.max(0, Math.min(100, (hero.hp / hero.maxHp) * 100));
  const lowHp = hero.hp <= 5;
  // Track previous HP pour spawn popup damage/heal au-dessus du portrait.
  // Alex feedback 2026-06-09 point #3 : ajout popup vert "+N" sur HEAL,
  // sinon le joueur voit la HP monter sans feedback explicite (Second Wind,
  // Sangsue, etc.) → confusion "vie qui monte/descend mystère".
  const prevHpRef = useRef(hero.hp);
  const [dmgPop, setDmgPop] = useState<{ n: number; key: number } | null>(null);
  const [healPop, setHealPop] = useState<{ n: number; key: number } | null>(null);
  useEffect(() => {
    const prev = prevHpRef.current;
    if (hero.hp < prev) {
      setDmgPop({ n: prev - hero.hp, key: Date.now() });
      const id = window.setTimeout(() => setDmgPop(null), 1100);
      prevHpRef.current = hero.hp;
      return () => window.clearTimeout(id);
    }
    if (hero.hp > prev) {
      setHealPop({ n: hero.hp - prev, key: Date.now() });
      const id = window.setTimeout(() => setHealPop(null), 1100);
      prevHpRef.current = hero.hp;
      return () => window.clearTimeout(id);
    }
    prevHpRef.current = hero.hp;
  }, [hero.hp]);
  return (
    <div className={"relative flex items-center gap-1 " + (side === "you" ? "pl-0 pr-1" : "px-1")}>
      {/* 🎨 Identité visuelle PERSO de la Voie — calque animé derrière le HUD,
       *  UNIQUEMENT côté joueur (jamais l'adversaire). z-0 ; le contenu passe
       *  en relative z-10 pour rester au-dessus. (Alex 2026-06-12) */}
      {side === "you" && hero.affinity && <VoieAura affinity={hero.affinity} />}
      {/* Augur peek — overlay FULL WIDTH du strip outer (Alex 2026-06-11) :
       *  le rendu était dans le portrait div w-16 → cartes invisibles car
       *  l'overlay débordait. Ici on a tout l'espace du strip. */}
      {augurRevealed && augurRevealed.length > 0 && side === "opp" && (
        <motion.div
          key={"augur-" + augurRevealed.join("|")}
          initial={{ opacity: 0, y: -6, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 22 }}
          className="absolute left-2 right-2 -bottom-3 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-400/65 z-40 pointer-events-none"
          style={{ boxShadow: "0 0 14px -2px rgba(252,211,77,0.6), inset 0 1px 0 rgba(252,211,77,0.22)" }}
        >
          <motion.span
            animate={{ opacity: [0.85, 1, 0.85] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            className="text-[10px] uppercase tracking-wider font-black text-amber-200 drop-shadow shrink-0"
          >
            👁
          </motion.span>
          <div className="flex items-center gap-1 flex-wrap">
            {augurRevealed.map((id, i) => {
              const card = CARDS[id];
              if (!card) return null;
              return (
                <motion.div
                  key={`${id}-${i}`}
                  initial={{ opacity: 0, scale: 0.6, y: -6, rotate: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
                  transition={{ delay: 0.05 + i * 0.08, type: "spring", stiffness: 280, damping: 20 }}
                  className="relative w-9 h-12 sm:w-10 sm:h-[3.4rem] rounded-md overflow-hidden ring-2 ring-amber-300/75 shadow-md shadow-amber-500/30"
                  title={t(card.nameKey) + " — " + t(arenaCardDescKey(id))}
                >
                  <CardImage id={id} glyphSize="text-base" />
                  <div className="absolute top-0.5 left-0.5 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-black/80 text-sky-200 text-[8px] font-black tabular-nums">
                    {card.cost}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}
      {/* Portrait — avatar + name in a circle so each side has a face.
       *  Floating damage popup pops out of the portrait on HP loss. Opp =
       *  scale-95 (-5%). w-14 (au lieu de w-16) pour rapprocher les infos. */}
      <div className={"flex flex-col items-center shrink-0 w-14 relative z-10 " + (side === "opp" ? "scale-95 origin-top" : "")}>
        <HeroPortrait avatar={avatar} ringColor={ringColor} divineShield={hero.divineShield} damaged={!!dmgPop} />
        <span className={"text-[9px] uppercase tracking-wider font-black truncate max-w-[64px] mt-0.5 " + accent}>
          {name}
        </span>
        {/* (chip queue utility est positionné au niveau du strip parent, plus haut) */}
        <AnimatePresence>
          {dmgPop && (
            <motion.div
              key={dmgPop.key}
              initial={{ opacity: 0, y: 0, scale: 0.7 }}
              animate={{ opacity: 1, y: -32, scale: 1.2 }}
              exit={{ opacity: 0, y: -48 }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="absolute top-0 left-0 right-0 flex items-center justify-center pointer-events-none text-2xl font-black text-rose-300"
              style={{ textShadow: "0 2px 8px rgba(244,63,94,0.85), 0 0 2px black" }}
            >
              −{dmgPop.n}
            </motion.div>
          )}
          {healPop && (
            <motion.div
              key={"heal-" + healPop.key}
              initial={{ opacity: 0, y: 0, scale: 0.7 }}
              animate={{ opacity: 1, y: -32, scale: 1.2 }}
              exit={{ opacity: 0, y: -48 }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="absolute top-0 left-0 right-0 flex items-center justify-center pointer-events-none text-2xl font-black text-emerald-300"
              style={{ textShadow: "0 2px 8px rgba(52,211,153,0.85), 0 0 2px black" }}
            >
              +{healPop.n}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* HP + mana — largeur naturelle, collée à l'avatar (Alex 2026-06-11) :
       *  shrink-0 (plus flex-1) pour ne PAS s'étirer → l'espace à droite est
       *  libéré pour le slot des cartes utility lancées. */}
      <div className="relative z-10 shrink-0 flex flex-col justify-center gap-0.5 min-h-[3.4rem]">
        {/* Ligne 1 — VOIE / constellation AU-DESSUS (Alex 2026-06-12) : passée
         *  sur sa propre ligne. Les 3 lignes (voie / vie / mana) sont
         *  distribuées sur la hauteur de l'avatar via justify-center +
         *  gap serré, SANS agrandir le strip (sinon la main se fait expulser
         *  hors écran). */}
        {hero.affinity && (
          <ArenaConstellationBar
            count={hero.constellationCount ?? 0}
            affinity={hero.affinity}
            side={side}
            finisherUnlocked={hero.finisherUnlocked}
          />
        )}
        {/* Ligne 2 — barre de vie. */}
        {/* HP bar — taller, segmented every 5 HP, glow on the filled portion,
         *  pulse at low HP. Wrapped in a motion.div that SHAKES + flashes
         *  ring rose each time an attack lands on this hero. */}
        <motion.div
          key={incomingAttackKey ?? "hp-idle"}
          initial={incomingAttackKey ? { x: 0 } : undefined}
          animate={incomingAttackKey ? { x: [0, -6, 7, -5, 3, 0] } : undefined}
          transition={incomingAttackKey ? { duration: 0.55, ease: "easeOut" } : undefined}
          className="flex items-center gap-1.5"
        >
          <motion.span
            key={hero.hp}
            initial={{ scale: 1.35, color: "#fda4af" }}
            animate={{ scale: 1, color: lowHp ? "#fb7185" : "#ffffff" }}
            transition={{ duration: 0.3 }}
            className="text-[13px] font-black tabular-nums shrink-0"
          >
            ❤ {hero.hp}/{hero.maxHp}
          </motion.span>
          <div
            className={
              "relative w-28 sm:w-32 h-3 rounded-full bg-zinc-900/80 overflow-hidden ring-1 ring-black/50 " +
              (lowHp ? "animate-pulse" : "")
            }
          >
            <motion.div
              className={
                "h-full transition-colors " +
                (hpPct > 50 ? "bg-gradient-to-r from-emerald-500 to-emerald-300 shadow-[inset_0_0_8px_rgba(110,231,183,0.6)]" :
                 hpPct > 25 ? "bg-gradient-to-r from-amber-500 to-amber-300 shadow-[inset_0_0_8px_rgba(252,211,77,0.6)]" :
                 "bg-gradient-to-r from-rose-600 to-rose-400 shadow-[inset_0_0_8px_rgba(251,113,133,0.6)]")
              }
              animate={{ width: `${hpPct}%` }}
              transition={{ duration: 0.45 }}
            />
            {/* Per-5-HP tick marks. */}
            <div className="absolute inset-0 flex pointer-events-none">
              {Array.from({ length: Math.max(1, Math.floor(hero.maxHp / 5)) - 1 }, (_, i) => (
                <div
                  key={i}
                  className="border-r border-black/40"
                  style={{ width: `${100 / Math.max(1, Math.floor(hero.maxHp / 5))}%` }}
                />
              ))}
            </div>
            {/* White IMPACT sweep — when an attack lands on THIS hero, a bright
             *  white-to-rose flash sweeps across the HP bar, then fades. */}
            <AnimatePresence>
              {incomingAttackKey && (
                <motion.div
                  key={incomingAttackKey}
                  initial={{ opacity: 0.95, x: "-100%" }}
                  animate={{ opacity: [0.95, 0.8, 0], x: ["-100%", "0%", "100%"] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.55, ease: "easeOut", times: [0, 0.45, 1] }}
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.85) 35%, rgba(244,63,94,0.7) 55%, transparent 100%)",
                    mixBlendMode: "screen",
                  }}
                />
              )}
            </AnimatePresence>
            {/* Outer ring pulse — rose halo when hit. */}
            <AnimatePresence>
              {incomingAttackKey && (
                <motion.div
                  key={`ring-${incomingAttackKey}`}
                  initial={{ opacity: 0.9, scale: 1 }}
                  animate={{ opacity: 0, scale: 1.5 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="absolute -inset-1 rounded-full pointer-events-none"
                  style={{
                    boxShadow:
                      "0 0 12px 3px rgba(244,63,94,0.85), inset 0 0 8px rgba(244,63,94,0.6)",
                  }}
                />
              )}
            </AnimatePresence>
          </div>
        </motion.div>
        {/* Ligne 3 — mana + main + tour (constellation déplacée en ligne 1). */}
        <div className="flex items-center gap-2 text-[11px]">
          <div className="flex items-center gap-1 shrink-0">
            <span className="font-bold text-sky-300 tabular-nums shrink-0">⋙ {hero.mana}/{hero.maxMana}</span>
            <div className="flex items-center gap-0.5">
              {Array.from({ length: hero.maxMana }, (_, i) => (
                <span
                  key={i}
                  className={
                    "w-1.5 h-1.5 rounded-full ring-1 ring-black/40 " +
                    (i < hero.mana ? "bg-sky-300 shadow-[0_0_4px_rgba(125,211,252,0.7)]" : "bg-zinc-700")
                  }
                />
              ))}
            </div>
            <span className="font-bold text-ink-muted">🂠 {hero.hand.length}</span>
            {side === "you" && <span className="font-bold text-themed">T{turn}</span>}
          </div>
        </div>
        {/* La rangée pendingUtility est maintenant en overlay absolute sur
         *  le portrait (cf. plus haut) — hors du flow pour ne pas modifier
         *  la hauteur du strip et garder le pad stable. */}
        {/* Augur peek — déplacé HORS du portrait div (Alex 2026-06-11 : ne
         *  s'affichait plus parce que le portrait div fait w-16=64px de
         *  large, insuffisant pour 4 mini-cartes). Maintenant rendu dans le
         *  strip outer plus bas → full width disponible. */}
        {/* Indicator chip — when MY hand has been peeked at by opp Augur,
         *  show a discrete pulsing 👁 chip next to the portrait so I know
         *  without my strip getting reshuffled. */}
        {augurRevealed && augurRevealed.length > 0 && side === "you" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: [0.7, 1, 0.7], scale: 1 }}
            transition={{ opacity: { duration: 1.4, repeat: Infinity, ease: "easeInOut" }, scale: { type: "spring", stiffness: 320, damping: 22 } }}
            className="absolute top-1 right-1 z-20 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/30 border border-amber-300/70 text-amber-100 text-[9px] font-black uppercase tracking-wider shadow"
            title="Opp regarde ta main (Augur)"
          >
            👁 Lue
          </motion.div>
        )}
      </div>
      {/* Slot cartes UTILITY lancées (hero/self/global) — dans le flow, à DROITE,
       *  dans l'espace libéré par les infos collées à gauche (Alex 2026-06-11).
       *  flex-1 prend tout le reste. Les sorts LANE-target ne viennent PAS ici
       *  (ils sont en éventail coin sup-gauche de leur lane). Tappables = retire. */}
      {pendingUtility && pendingUtility.length > 0 && (
        <div
          className={
            // overflow-visible (Alex 2026-06-11) : la croix ✕ déborde du chip,
            // overflow-auto la clippait. pl-1 pr-2 pour que la 1re carte et la
            // croix de la dernière ne touchent pas les bords. Éventail overlap.
            "relative z-10 flex-1 flex items-center min-w-0 overflow-visible justify-start pl-1 pr-2 " +
            (onRemoveUtility ? "" : "pointer-events-none")
          }
          aria-label="Sorts utility planifiés"
        >
          <AnimatePresence>
            {pendingUtility.map((s, idx) => (
              <ArenaSpellQueueChip
                key={`util-${side}-${idx}-${s.id}`}
                id={s.id}
                cost={arenaSpellCost(hero, s.id)}
                side={side}
                compact
                fanIndex={idx}
                onRemove={onRemoveUtility ? () => onRemoveUtility(idx) : undefined}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

/** Hero portrait — a small circular badge with the avatar inside. Falls
 *  back to a generic CPU mask glyph when no avatar is provided.
 *  `damaged` flips on for ~500ms when the hero just took damage — the ring
 *  pulses red so the player FEELS the hit beyond the floating −N number. */
function HeroPortrait({ avatar, ringColor, divineShield, damaged }: {
  avatar?: string;
  ringColor: string;
  divineShield: boolean;
  damaged?: boolean;
}) {
  const isImage = avatar && (avatar.startsWith("/") || avatar.startsWith("http") || avatar.startsWith("data:"));
  return (
    <motion.div
      animate={damaged ? { scale: [1, 1.08, 0.96, 1], x: [0, -2, 2, -1, 1, 0] } : { scale: 1, x: 0 }}
      transition={damaged ? { duration: 0.5 } : { duration: 0.2 }}
      className={
        "relative w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden ring-2 " +
        (damaged ? "ring-rose-400 shadow-[0_0_18px_-1px_rgba(244,63,94,0.95)]" : ringColor) +
        " bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center " +
        (divineShield && !damaged ? "shadow-[0_0_12px_-1px_rgba(252,211,77,0.85)]" : "")
      }
    >
      {isImage ? (
        <img src={avatar} alt="" className="w-full h-full object-cover" draggable={false} />
      ) : avatar ? (
        <span className="text-3xl">{avatar}</span>
      ) : (
        <span className="text-3xl">🤖</span>
      )}
      {damaged && (
        <span className="absolute inset-0 bg-rose-500/35 pointer-events-none" aria-hidden />
      )}
      {divineShield && (
        <span className="absolute -bottom-0.5 -right-0.5 text-[10px]" title="Bouclier divin">🛡️</span>
      )}
    </motion.div>
  );
}
