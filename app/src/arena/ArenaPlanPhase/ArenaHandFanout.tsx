import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CARDS } from "../../ranked/cards";
import { CardImage } from "../../ranked/CardImage";
import { useT } from "../../i18n";
import type { CardId } from "../../ranked/rankedTypes";
import { arenaSupported } from "../arenaCardEffects";
import { arenaSpellCost } from "../arenaSpellHelpers";
import { isFusible, findFusionResult, fusionPartnersOf } from "../arenaFusionCards";
import { CARD_TARGET_KIND, type ArenaTargeting, type BoardState, type TurnIntent } from "../arenaTypes";
import { CardFanGlyph, FuseGlyph, WarnGlyph } from "../../icons";

/** Hand strip — tap = commit/target, appui 350 ms = aperçu puis fiche, DRAG =
 *  one-gesture commit to a lane. É2 : éventail COURBE (rotate/y par index,
 *  carte active remontée ×1.16) — transform-only, GPU.
 *  h-[96px] (Alex 2026-06-12 #4) : +8px pour l'éventail ET les noms — le pad
 *  se réduit AUTOMATIQUEMENT d'autant via BoardFillSlot (flex), sans bouger de
 *  place. État (activePos/pressedPos) + handlers (startPress/endPress) restent
 *  dans ArenaPlanPhase, passés en props. */
export function ArenaHandFanout({
  intent, me, board, manaLeft, targeting, inspecting, disabled,
  activePos, setActivePos, pressedPos, setPressedPos, startPress, endPress,
}: {
  intent: TurnIntent;
  me: BoardState["a"];
  board: BoardState;
  manaLeft: number;
  targeting: ArenaTargeting;
  inspecting: CardId | null;
  disabled: boolean;
  activePos: number | null;
  setActivePos: (n: number | null) => void;
  pressedPos: number | null;
  setPressedPos: (n: number | null) => void;
  startPress: (id: CardId, x: number) => void;
  endPress: (id: CardId, fire: boolean) => void;
}) {
  const t = useT();
  // Largeur RÉELLEMENT disponible (mesurée) → le recouvrement s'adapte à l'écran :
  // l'éventail ne déborde jamais sur le bouton FIN ni hors de l'écran.
  // Ref callback (l'éventail est démonté quand toutes les cartes sont jouées,
  // puis remonté) : l'observateur suit toujours le nœud courant.
  const [fit, setFit] = useState<{ avail: number; cardW: number }>({ avail: 0, cardW: 60 });
  const roRef = useRef<ResizeObserver | null>(null);
  const fanRef = useCallback((el: HTMLDivElement | null) => {
    roRef.current?.disconnect();
    roRef.current = null;
    if (!el) return;
    const measure = () => {
      const cardW = (el.querySelector("button") as HTMLElement | null)?.offsetWidth || 60;
      setFit((f) => (f.avail === el.clientWidth && f.cardW === cardW ? f : { avail: el.clientWidth, cardW }));
    };
    measure();
    roRef.current = new ResizeObserver(measure);
    roRef.current.observe(el);
  }, []);
  return (
    <div className="h-[118px] landscape:h-[68px] flex-1 landscape:flex-none min-w-0 flex items-end justify-center relative z-30">
      {(() => {
        // Filtre visuel (Alex 2026-06-11) : les cartes mises dans l'intent
        // sont DIRECTEMENT retirées de la main affichée → sentiment CCG net.
        // On compte combien de copies de chaque id sont déjà queue, et on
        // skip ce nombre depuis le début de la main.
        const queuedById = new Map<CardId, number>();
        for (const sp of intent.spells) {
          queuedById.set(sp.id, (queuedById.get(sp.id) ?? 0) + 1);
        }
        // `key` STABLE = id + n° d'exemplaire (1re, 2e copie…). L'ancienne clé
        // `${id}-${index}` changeait pour toutes les cartes à droite d'une carte
        // jouée → elles étaient REMONTÉES et rejouaient l'anim de pioche au lieu
        // de simplement se resserrer.
        const visibleHand: Array<{ id: CardId; key: string }> = [];
        const skipLeft = new Map(queuedById);
        const seen = new Map<CardId, number>();
        for (let i = 0; i < me.hand.length; i++) {
          const id = me.hand[i];
          const left = skipLeft.get(id) ?? 0;
          if (left > 0) { skipLeft.set(id, left - 1); continue; }
          const copy = seen.get(id) ?? 0;
          seen.set(id, copy + 1);
          visibleHand.push({ id, key: `${id}#${copy}` });
        }
        return visibleHand.length > 0 ? (
        // Alex feedback : "pas dispo le slide" → ajout de touchAction
        // pan-x au wrapper pour permettre le scroll horizontal natif sans
        // que le drag-card intercepte le swipe horizontal.
        // justify-start au lieu de center pour que le scroll soit utile
        // (si center et qu'il manque de place, les cards des extrémités
        // sont coupées sans pouvoir scroller).
        <div
          // justify-CENTER (Alex 2026-06-12 #2) : l'éventail se recentre à
          // chaque ajout/retrait de carte (anim layout).
          // h-full + PAS d'overflow (Alex 2026-06-12 "hauts des cartes
          // cachés") : l'ancien overflow-x-auto créait une boîte de ~62px
          // bottom-alignée qui ROGNAIT tout ce qui montait au-dessus de son
          // bord (carte active +12px, coins inclinés). L'éventail tient en
          // largeur par design (max 8 cartes overlappées ≈ 300px) → pas
          // besoin de scroll ; la carte levée peut déborder librement
          // au-dessus (z-30 > picker, elle passe DEVANT, façon Hearthstone).
          ref={fanRef}
          className="h-full flex items-end justify-center gap-0.5 px-1 pb-0.5 w-full"
        >
          <AnimatePresence>
          {visibleHand.map(({ id, key }, pos) => {
            const card = CARDS[id];
            const supported = arenaSupported(id);
            const cannotAfford = manaLeft < arenaSpellCost(me, id);
            const isTargeting = targeting?.kind === "spell" && targeting.id === id;
            const isInspecting = inspecting === id;
            // FORGE UX (Alex 2026-06-30) : une carte FUSIBLE self/global/hero s'ARME
            // au tap (au lieu d'auto-jouer) → sans cue, le joueur croit la carte
            // « morte ». Quand elle est armée on affiche les DEUX destinations :
            // « retape = jouer » (strip) ET « ⚗ Forge » (dépôt). Les cartes-lane
            // sont exclues (elles tapent une lane = flux familier, jamais « 2 taps »).
            const tk = CARD_TARGET_KIND[id] ?? "global";
            const isFusibleUtilityArmed =
              isTargeting && isFusible(id) && (tk === "self" || tk === "global" || tk === "hero");
            // É2 — géométrie de l'éventail : rotation répartie (max ±12°),
            // creux parabolique vers les bords, carte active redressée +
            // remontée au-dessus des voisines.
            // Courbe ADOUCIE (Alex 2026-06-12 #4) : ±9° max et creux réduit —
            // les noms des cartes extrêmes restent lisibles, plus de coupe.
            const n = visibleHand.length;
            const center = (n - 1) / 2;
            const stepDeg = n > 1 ? Math.min(4, 18 / (n - 1)) : 0;
            const fanAngle = (pos - center) * stepDeg;
            const fanY = Math.pow(Math.abs(pos - center), 2) * (n > 6 ? 0.8 : 1.2);
            const fanActive = (isTargeting || isInspecting) && activePos === pos;
            // Chevauchement DYNAMIQUE (Alex 2026-06-13) : plus il y a de cartes,
            // plus elles se SERRENT → l'éventail ne déborde plus sur le bouton
            // FIN DE TOUR (à droite de la rangée). Le drag des cartes est retiré
            // → tap fiable malgré le chevauchement (cf. bouton nu + pressedPos).
            // Cartes 60 px (Alex 2026-10 « cartes plus grandes ») : recouvrement
            // minimal par nombre de cartes, augmenté si la largeur mesurée ne suffit
            // pas (marge 16 px pour l'inclinaison de l'éventail). Plafonné pour
            // qu'un bout de chaque carte reste touchable.
            const minOverlap = n > 6 ? 12 : n > 4 ? 8 : 5;
            const needed = n > 1 && fit.avail > 0
              ? Math.ceil((n * fit.cardW + 16 - fit.avail) / (n - 1))
              : 0;
            const overlap = Math.min(Math.max(minOverlap, needed), fit.cardW - 16);
            return (
              <motion.div
                key={key}
                layout
                // PIOCHE animée (Alex 2026-06-13) : la carte GLISSE depuis la
                // droite (le deck) avec une rotation, au lieu d'apparaître.
                initial={{ scale: 0.6, opacity: 0, x: 46, rotate: 14 }}
                // É2 — éventail : rotation/creux par index ; carte active
                // redressée, remontée et agrandie AU-DESSUS des voisines.
                animate={{
                  // PRESS ne change PLUS la transform (Alex 2026-06-13 : la carte
                  // se redressait/remontait sous le doigt → l'extrémité « fuyait »
                  // le toucher → sélection partielle/instable). On ne fait que la
                  // passer DEVANT (zIndex). Elle reste EXACTEMENT sous le doigt.
                  scale: fanActive ? 1.1 : 1,
                  opacity: 1,
                  x: 0,
                  rotate: fanActive ? 0 : fanAngle,
                  y: fanActive ? -14 : fanY,
                }}
                exit={{ scale: 0.5, opacity: 0, y: -16 }}
                // Réarrangement QUASI-INSTANTANÉ (Alex 2026-06-11) : layout +
                // exit très courts (~90ms) pour que le joueur enchaîne la
                // carte suivante sans attendre la fin de l'anim.
                transition={{ layout: { duration: 0.09, ease: "easeOut" }, duration: 0.12, ease: "easeOut" }}
                className="shrink-0"
                style={{ marginLeft: pos === 0 ? 0 : -overlap, transformOrigin: "50% 100%", zIndex: pressedPos === pos ? 70 : fanActive ? 60 : pos }}
              >
              {/* DRAG des cartes SUPPRIMÉ (Alex 2026-06-13) : l'enveloppe
               *  motion.div drag (même drag={false}) posait touchAction:none +
               *  un setup pointer framer qui « volait » certains taps (Second
               *  Souffle obligeait à rester appuyé). Bouton NU = tap fiable. */}
              <button
                data-tut={`card-${id}`}
                onPointerDown={(e) => {
                  // 🎯 Pointer CAPTURE (Alex 2026-06-13 « le toucher des cartes aux
                  // EXTRÉMITÉS craint, le milieu ça va ») : aux bords le pouce
                  // s'étire et ROULE de quelques px → sans capture le pointeur
                  // quitte la cible de 44px → pointerleave/cancel ANNULAIT le tap
                  // (« se sélectionne/déselectionne, partiel »). Capturé, la carte
                  // garde le pointeur jusqu'au relâché → tap fiable partout.
                  // touchAction:none empêche en plus le WebView de lire ce micro-
                  // mouvement comme un scroll/zoom (le picker RPSLS fait déjà ça).
                  try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
                  setActivePos(pos); setPressedPos(pos); startPress(id, e.clientX);
                }}
                onPointerUp={() => { setPressedPos(null); endPress(id, true); }}
                onPointerLeave={() => { setPressedPos(null); endPress(id, false); }}
                onPointerCancel={() => { setPressedPos(null); endPress(id, false); }}
                disabled={!supported || cannotAfford || disabled}
                style={{ touchAction: "none" }}
                className={
                  "relative w-[60px] h-[82px] landscape:w-[48px] landscape:h-[66px] rounded-lg overflow-hidden bg-surface-raised transition " +
                  // É2 : plus de scale-110 interne — l'emphase (×1.16 + remontée)
                  // est portée par l'enveloppe éventail.
                  "ring-2 " + (
                    isTargeting ? "ring-amber-300"
                    : isInspecting ? "ring-sky-300"
                    : "ring-white/20"
                  ) +
                  (!supported ? " grayscale opacity-30" : cannotAfford ? " opacity-40" : "")
                }
                title={supported ? undefined : "Carte pas encore disponible en Arena"}
              >
                <CardImage id={id} glyphSize="text-2xl" />

                <div className="absolute top-0.5 left-0.5 z-10 inline-flex items-center justify-center gap-0.5 px-1 py-0.5 rounded-full bg-black/75">
                  {Array.from({ length: card.cost }, (_, k) => (
                    <span key={k} className="w-1.5 h-1.5 landscape:w-1 landscape:h-1 rounded-full bg-sky-300" />
                  ))}
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 py-0.5">
                  {/* NOM de la carte (lisible à 60 px) — remplace le glyphe seul. */}
                  <div className="text-[7.5px] landscape:text-[6.5px] font-bold uppercase text-center text-white/95 truncate px-0.5 leading-tight">
                    {t(card.nameKey)}
                  </div>
                </div>
                {!supported && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-[7px] uppercase tracking-wider text-ink-muted font-bold text-center px-1 leading-tight">
                      Bientôt
                    </span>
                  </div>
                )}
                {/* Badge ⚠ Pleine vie sur Second souffle (Alex 2026-06-11) :
                 *  carte cast à HP max = mana + carte brûlés pour rien. Visuel
                 *  avertit sans bloquer (choix CCG classique). */}
                {/* ⚗ Badge FUSION — n'apparaît QUE quand une fusion est
                 *  possible MAINTENANT (le partenaire de cette carte est sur
                 *  ta Forge). Alex 2026-06-13 : l'ancien badge fuchsia
                 *  TOUJOURS affiché ("points roses") embrouillait — on ne
                 *  montre plus que le signal actionnable (OR pulsant). */}
                {board.forgeA && isFusible(id) && findFusionResult(id, board.forgeA) && (
                  <div
                    className="absolute bottom-5 right-0.5 z-10 w-5 h-5 rounded-full flex items-center justify-center text-[11px] leading-none shadow bg-amber-400 text-zinc-900 animate-pulse ring-1 ring-amber-200"
                    title="Fusion possible — tape la Forge !"
                  >
                    <FuseGlyph className="w-3 h-3" />
                  </div>
                )}
                {/* ⚗ FUSIONNABLE DEPUIS LA MAIN (Alex 2026-06-28) : badge fuchsia
                 *  affiché UNIQUEMENT quand le PARTENAIRE de cette carte est AUSSI
                 *  dans ta main (forge vide) → tu vois quelles 2 marier, sans le
                 *  clutter de l'ancien badge toujours-affiché. */}
                {!board.forgeA && fusionPartnersOf(id).some((r) => {
                  const p = r.a === id ? r.b : r.a;
                  return p === id ? me.hand.filter((h) => h === id).length >= 2 : me.hand.includes(p);
                }) && (
                  <div
                    className="absolute bottom-5 right-0.5 z-10 w-5 h-5 rounded-full flex items-center justify-center text-[11px] leading-none shadow bg-fuchsia-500 text-white ring-1 ring-fuchsia-300"
                    title="Fusionnable : tu as le partenaire en main — dépose une carte sur la Forge puis fusionne"
                  >
                    <FuseGlyph className="w-3 h-3" />
                  </div>
                )}
                {id === "second-wind" && me.hp >= me.maxHp && (
                  <div
                    className="absolute top-0.5 right-0.5 z-10 px-1 py-0.5 rounded-md bg-amber-500/90 text-[8px] font-black text-zinc-900 leading-none shadow"
                    title="Tu es à pleine vie — la carte sera dépensée sans effet"
                  >
                    <WarnGlyph className="w-2.5 h-2.5" />
                  </div>
                )}
              </button>
              {/* DUAL-ACTION HINT (Alex 2026-06-30) — AU-DESSUS d'une carte
               *  FUSIBLE utilitaire ARMÉE : les 2 destinations possibles, pour
               *  que le joueur ne croie plus la carte « morte ». « Retape = jouer »
               *  (strip) + « ⚗ ou Forge » (dépôt — la case Forge s'illumine déjà
               *  « Déposer »). N'apparaît que sur la carte active armée. */}
              {fanActive && isFusibleUtilityArmed && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.12 }}
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50 pointer-events-none flex items-center gap-1 whitespace-nowrap"
                >
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-zinc-900 text-[8px] font-black uppercase tracking-wide shadow-lg flex items-center gap-0.5 animate-pulse">
                    <span className="text-[10px] leading-none">▸</span>Retape = jouer
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full bg-fuchsia-500 text-white text-[8px] font-black uppercase tracking-wide shadow-lg ring-1 ring-fuchsia-300 flex items-center gap-0.5">
                    <FuseGlyph className="w-2.5 h-2.5" />ou Forge
                  </span>
                </motion.div>
              )}
              {/* Pill NOM — SOUS la carte touchée (Alex 2026-06-13 : "le nom
               *  sous elle, pas ailleurs"). Enfant du wrapper éventail → suit
               *  la carte (position + scale), centrée dessous, jamais tronquée. */}
              {fanActive && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.12 }}
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 pointer-events-none"
                >
                  <span className="px-2 py-0.5 rounded-full bg-black/80 border border-amber-300/60 text-amber-100 text-[10px] font-black uppercase tracking-wider whitespace-nowrap shadow-lg">
                    {t(card.nameKey)}
                  </span>
                </motion.div>
              )}
              </motion.div>
            );
          })}
          </AnimatePresence>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1.5 opacity-65">
          <div className="w-[60px] h-[82px] landscape:w-[48px] landscape:h-[66px] rounded-lg border-2 border-dashed border-hairline bg-black/15 flex items-center justify-center">
            <CardFanGlyph className="w-7 h-7 text-ink-faint" />
          </div>
          <span className="text-[10px] text-ink-faint italic">
            {me.hand.length === 0 && me.deck.length + me.discard.length === 0
              ? "Plus de cartes à piocher (deck + défausse vides)"
              : me.hand.length === 0
              ? "Main vide — fin de tour pour piocher"
              : "Toutes les cartes en main sont déjà planifiées"}
          </span>
        </div>
      );
      })()}
      {/* (Pill nom de carte : rendue PAR CARTE, sous la carte active —
       *  cf. wrapper éventail. Alex 2026-06-13 : "le nom SOUS la carte,
       *  pas ailleurs".) */}
    </div>
  );
}
