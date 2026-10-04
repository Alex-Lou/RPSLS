/**
 * ArenaHeroStrip — portrait + HP bar + mana pips + hand count for one hero.
 *
 * Extracted from ArenaBoard.tsx to keep that file under the project's
 * 400-line ceiling. Used twice per board (opp on top, player on bottom).
 *
 * Visual ownership: BLUE (sky) accents for "you" (moi), RED (rose) for "opp"
 * (Alex 2026-06-13). The portrait
 * pulses + tints red when the hero just took damage (driven by the
 * useEffect that compares prev/next HP), and floats a "-N" damage popup
 * out of the portrait at the same time.
 *
 * Sous-composants (AugurPeekOverlay, HeroHpBar, HeroPortrait) dans
 * ArenaHeroStripParts.tsx.
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useT } from "../i18n";
import type { CardId } from "../ranked/rankedTypes";
import type { BoardState, HeroState, PlayedSpell } from "./arenaTypes";
import { arenaSpellCost } from "./arenaSpellHelpers";
import { ArenaConstellationBar } from "./ArenaConstellationBar";
import { engineGauge } from "./arenaEngines";
import { ArenaSpellQueueChip } from "./ArenaSpellQueueChip";
import { VoieAura } from "./ArenaVoieAura";
import { AugurPeekOverlay, HeroHpBar, HeroPortrait } from "./ArenaHeroStripParts";

export interface ArenaHeroStripProps {
  hero: HeroState;
  /** Board complet — prop héritée (Lot C v2), plus lue par ce composant
   *  (la jauge de Voie est calculée via engineGauge(hero)). Optionnelle. */
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
  /** Long-press sur une carte ADVERSE révélée (Augure) → ouvre sa fiche
   *  (lecture seule). Alex 2026-06-13 : apprendre ce que l'adversaire joue. */
  onInspectCard?: (id: CardId) => void;
  /** Pendant la résolution (calm=true) : gèle l'aura de Voie idle pour rendre le
   *  budget GPU aux anims de combat (Alex 2026-06-17 perf « ça fait planter »). */
  calm?: boolean;
}

export function ArenaHeroStrip({
  hero, side, turn, name, avatar, incomingAttackKey, augurRevealed, pendingUtility, onRemoveUtility, onInspectCard, calm = false,
}: ArenaHeroStripProps) {
  const t = useT();
  // Long-press sur une carte adverse révélée (Augure) → fiche lecture seule.
  const inspectTimer = useRef<number | null>(null);
  const startInspect = (id: CardId) => {
    if (!onInspectCard) return;
    if (inspectTimer.current) window.clearTimeout(inspectTimer.current);
    inspectTimer.current = window.setTimeout(() => onInspectCard(id), 420);
  };
  const cancelInspect = () => {
    if (inspectTimer.current) { window.clearTimeout(inspectTimer.current); inspectTimer.current = null; }
  };
  // Identité couleur par camp (Alex 2026-06-13) : MOI = BLEU (sky), ADVERSAIRE
  // = ROUGE (rose). Avant le joueur était emerald (vert).
  const accent = side === "you" ? "text-sky-300" : "text-rose-300";
  const ringColor = side === "you" ? "ring-sky-400/70" : "ring-rose-400/70";
  const hpPct = Math.max(0, Math.min(100, (hero.hp / hero.maxHp) * 100));
  const lowHp = hero.hp <= 5;
  // Track previous HP pour spawn popup damage/heal au-dessus du portrait.
  // Alex feedback 2026-06-09 point #3 : ajout popup vert "+N" sur HEAL,
  // sinon le joueur voit la HP monter sans feedback explicite (Second Wind,
  // Sangsue, etc.) → confusion "vie qui monte/descend mystère".
  const prevHpRef = useRef(hero.hp);
  const [dmgPop, setDmgPop] = useState<{ n: number; key: number } | null>(null);
  // `cut` = PV rognés par l'ENTROPIE (Cosmos adverse) sur ce soin → « Entropie −k ».
  const [healPop, setHealPop] = useState<{ n: number; cut: number; key: number } | null>(null);
  const prevCutRef = useRef(hero.entropyHealCut ?? 0);
  // Goutte de sang sous la barre de vie quand le héros est BAS (≤5 PV) et vient
  // de prendre un coup (Alex 2026-06-13). One-shot, timer nettoyé → leak-free.
  const [bloodDrip, setBloodDrip] = useState<{ key: number } | null>(null);
  useEffect(() => {
    if (!bloodDrip) return;
    const id = window.setTimeout(() => setBloodDrip(null), 1500);
    return () => window.clearTimeout(id);
  }, [bloodDrip?.key]);
  // Auto-effacement INDÉPENDANT des popups −N / +N (Alex 2026-06-24, bug « le
  // dégât reste coincé visible ») : chaque popup porte SON timer, keyé sur sa
  // propre clé. Avant, le timer d'effacement vivait DANS l'effet hero.hp et son
  // cleanup l'annulait dès que les PV rechangeaient → un coup SUIVI d'un soin
  // (régén Sève/Verger/fin de tour) dans la même seconde partait dans la branche
  // heal sans jamais remettre dmgPop à null → le « −N » restait figé (et flottait
  // dans la barre de statut Android). Découplé ici → un soin n'annule plus le dégât.
  useEffect(() => {
    if (!dmgPop) return;
    const id = window.setTimeout(() => setDmgPop(null), 1100);
    return () => window.clearTimeout(id);
  }, [dmgPop?.key]);
  useEffect(() => {
    if (!healPop) return;
    const id = window.setTimeout(() => setHealPop(null), 1100);
    return () => window.clearTimeout(id);
  }, [healPop?.key]);
  // Révélation PROGRESSIVE de la Voie ADVERSE (Alex 2026-06-17 rethink Phase 0).
  // COLLANT : dès que l'opp a fait monter sa jauge de Voie (engineVal ≥ 1
  // = « vu »), sa Voie reste révélée même si la créature meurt ensuite. Côté
  // joueur : toujours visible (c'est ta Voie). Reset au remount (rematch).
  const [voieSeen, setVoieSeen] = useState(false);
  // Valeur de la jauge d'ENGINE de la Voie (0-3) — désormais l'UNIQUE progression
  // affichée (refonte clarté Alex). null/0 = Montagne sans rocher posé / pas d'affinité.
  const engineVal = engineGauge(hero)?.value ?? 0;
  useEffect(() => {
    if (engineVal >= 1) setVoieSeen(true);
  }, [engineVal]);
  useEffect(() => {
    const prev = prevHpRef.current;
    if (hero.hp < prev) {
      setDmgPop({ n: prev - hero.hp, key: Date.now() });
      if (hero.hp > 0 && hero.hp <= 5) setBloodDrip({ key: Date.now() });
    } else if (hero.hp > prev) {
      setHealPop({ n: hero.hp - prev, cut: Math.max(0, (hero.entropyHealCut ?? 0) - prevCutRef.current), key: Date.now() });
    }
    prevHpRef.current = hero.hp;
    prevCutRef.current = hero.entropyHealCut ?? 0;
  }, [hero.hp]);
  // Opp avant sa 1ʳᵉ étoile → Voie cachée (couleur neutre, pas de glyphe/nom, pas
  // de motif d'aura). `< 1` couvre le frame courant, `!voieSeen` la persistance.
  const voieConcealed = side === "opp" && !voieSeen && engineVal < 1;
  return (
    <div data-tut={`hero-${side}`} className={"relative flex items-center gap-1 " + (side === "you" ? "pl-0 pr-1" : "px-1")}>
      {/* 🎨 Identité visuelle PERSO de la Voie — calque animé derrière le HUD,
       *  UNIQUEMENT côté joueur (jamais l'adversaire). z-0 ; le contenu passe
       *  en relative z-10 pour rester au-dessus. (Alex 2026-06-12) */}
      {/* Aura de Voie pour LES DEUX camps (Alex 2026-06-13 : « le strip de
       *  chacun doit être robuste et vivant ») — chacun dans SON univers (sa
       *  propre affinité). L'adversaire n'est plus « à poil ». */}
      {hero.affinity && <VoieAura affinity={hero.affinity} side={side} calm={calm} concealed={voieConcealed} />}
      {/* Augur peek — overlay FULL WIDTH du strip outer (Alex 2026-06-11) :
       *  le rendu était dans le portrait div w-16 → cartes invisibles car
       *  l'overlay débordait. Ici on a tout l'espace du strip. */}
      {augurRevealed && augurRevealed.length > 0 && side === "opp" && (
        <AugurPeekOverlay
          augurRevealed={augurRevealed}
          onInspectCard={onInspectCard}
          startInspect={startInspect}
          cancelInspect={cancelInspect}
        />
      )}
      {/* Portrait — avatar + name in a circle so each side has a face.
       *  Floating damage popup pops out of the portrait on HP loss. Opp =
       *  scale-95 (-5%). w-14 (au lieu de w-16) pour rapprocher les infos. */}
      <div className={"flex flex-col items-center shrink-0 w-14 landscape:w-[76px] relative z-10 " + (side === "opp" ? "scale-95 origin-top" : "")}>
        <HeroPortrait avatar={avatar} ringColor={ringColor} divineShield={hero.divineShield} damaged={!!dmgPop} />
        <span className={"text-[9px] landscape:text-[11px] uppercase tracking-wider font-black truncate max-w-[64px] landscape:max-w-[76px] mt-0.5 " + accent}>
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
              {healPop.cut > 0 && (
                <span className="absolute top-full mt-[-2px] text-[10px] font-black uppercase tracking-wide text-violet-300 whitespace-nowrap">
                  {t("arena.strip.entropyCut", { k: healPop.cut })}
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* HP + mana — largeur naturelle, collée à l'avatar (Alex 2026-06-11) :
       *  shrink-0 (plus flex-1) pour ne PAS s'étirer → l'espace à droite est
       *  libéré pour le slot des cartes utility lancées. */}
      <div className="relative z-10 shrink-0 landscape:flex-1 flex flex-col justify-center gap-0.5 min-h-[3.4rem]">
        {/* Ligne 1 — VOIE / constellation AU-DESSUS (Alex 2026-06-12) : passée
         *  sur sa propre ligne. Les 3 lignes (voie / vie / mana) sont
         *  distribuées sur la hauteur de l'avatar via justify-center +
         *  gap serré, SANS agrandir le strip (sinon la main se fait expulser
         *  hors écran). */}
        {/* UNE seule jauge de Voie (refonte clarté Alex 2026-06-23) : la barre
         *  affiche le NOM de la Voie + les pips de l'ENGINE (0-3) + ✦ quand le
         *  Finisher est prêt. Plus de double-jauge qui embrouillait. */}
        {hero.affinity && (
          <ArenaConstellationBar
            count={engineVal}
            affinity={hero.affinity}
            side={side}
            finisherUnlocked={hero.finisherUnlocked}
            calm={calm}
            concealed={voieConcealed}
          />
        )}
        {/* Ligne 2 — barre de vie. */}
        {/* HP bar — taller, segmented every 5 HP, glow on the filled portion,
         *  pulse at low HP. Wrapped in a motion.div that SHAKES + flashes
         *  ring rose each time an attack lands on this hero. */}
        <HeroHpBar hero={hero} incomingAttackKey={incomingAttackKey} hpPct={hpPct} lowHp={lowHp} bloodDrip={bloodDrip} />
        {/* Ligne 3 — mana + main + tour (constellation déplacée en ligne 1). */}
        <div className="flex items-center gap-2 text-[11px]">
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Mana : ◆ propre + gros chiffre (au lieu du ⋙ austère). */}
            <span className="flex items-baseline gap-0.5 shrink-0 leading-none" style={{ fontFamily: "var(--font-headline)" }}>
              <span className="text-sky-400 text-[12px] mr-0.5">◆</span>
              <span className="text-[15px] font-black text-sky-200">{hero.mana}</span>
              <span className="text-[10px] font-bold text-sky-200/45">/{hero.maxMana}</span>
            </span>
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
            {/* Compteur de main MASQUÉ quand la main est vide (Alex 2026-06-17) :
             *  pendant l'OUVERTURE (T1-3, 0 carte) on n'affiche aucune info de
             *  pioche/main → on garde la SURPRISE du déblocage des cartes. */}
            {hero.hand.length > 0 && <span className="font-bold text-ink-muted">🂠 {hero.hand.length}</span>}
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
            title={t("arena.strip.augurWatching")}
          >
            {t("arena.strip.augurRead")}
          </motion.div>
        )}
      </div>
      {/* Slot cartes UTILITY lancées (hero/self/global) — dans le flow, à DROITE,
       *  dans l'espace libéré par les infos collées à gauche (Alex 2026-06-11).
       *  flex-1 prend tout le reste. Les sorts LANE-target ne viennent PAS ici
       *  (ils sont en éventail coin sup-gauche de leur lane). Tappables = retire. */}
      {/* ⚠ AnimatePresence TOUJOURS monté tant que pendingUtility est un tableau
       *  (≥0 chips) — Alex 2026-06-13 « les miniatures consommées ne se
       *  désintègrent pas ». Le guard `length > 0` démontait l'AnimatePresence
       *  AVEC son dernier enfant à la consommation (intent vidé → 0 chip) → exit
       *  JAMAIS jouée (elles « disparaissaient » sec). Mounted en continu → la
       *  désintégration dorée du chip consommé joue enfin. */}
      {pendingUtility && (
        <div
          className={
            // overflow-visible (Alex 2026-06-11) : la croix ✕ déborde du chip,
            // overflow-auto la clippait. pl-1 pr-2 pour que la 1re carte et la
            // croix de la dernière ne touchent pas les bords. Éventail overlap.
            "relative z-10 flex-1 landscape:flex-none flex items-center min-w-0 overflow-visible justify-start pl-1 pr-2 " +
            (onRemoveUtility ? "" : "pointer-events-none")
          }
          aria-label={t("arena.strip.plannedUtility")}
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
