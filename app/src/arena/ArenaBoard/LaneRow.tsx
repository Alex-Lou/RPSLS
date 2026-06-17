/**
 * LaneRow — one row of 3 lane slots (opp row or player row) on the board.
 * Combat halo + ArenaLaneSlot + card-sticker fan-out. Extrait verbatim de
 * ArenaBoard ; rendu présentationnel piloté par props.
 */

import { AnimatePresence, motion } from "motion/react";
import { ArenaLaneSlot } from "../ArenaLaneSlot";
import { MoveAttackCue } from "../ArenaCreatureFX";
import { CardSlot } from "../../ranked/CardSlot";
import type { BoardState, LaneIndex, Side, TurnIntent } from "../arenaTypes";

export function LaneRow({
  lanes, renderSide, intent, isPlayer, combatLane = null, combatChargers = [],
  validLanes = [false, false, false], targetLabel = "", onLaneTap,
  stickers = [], summoningMove = false,
  deflectingRockLane = null,
  deflectKey = null,
  onRemoveSticker,
  onRemoveSummon,
}: {
  lanes: BoardState["lanes"];
  renderSide: Side;
  intent: TurnIntent | null;
  isPlayer: boolean;
  combatLane?: LaneIndex | null;
  /** Camps qui chargent sur la lane en combat (attaquant-seul, Alex 2026-06-17). */
  combatChargers?: ("a" | "b")[];
  validLanes?: boolean[];
  targetLabel?: string;
  onLaneTap?: (lane: LaneIndex) => void;
  /** Card stickers to render in the corner of the targeted slot — same
   *  pattern as Ranked's CardSlot. Computed in the parent so both rows
   *  stay in sync. idx = position dans intent.spells (pour suppression). */
  stickers?: Array<{ lane: LaneIndex; id: import("../../ranked/rankedTypes").CardId; owner: "you" | "opp"; position: "tl" | "tr" | "bl" | "br"; idx: number; name: string }>;
  /** Retire un sort planifié par index (tap sur un sticker joueur). */
  onRemoveSticker?: (idx: number) => void;
  /** Annule l'invocation planifiée sur la lane (croix du ghost, joueur only). */
  onRemoveSummon?: (lane: LaneIndex) => void;
  /** Lane of the Pierre that just absorbed a deflection on THIS row, if
   *  any. The targeted slot pulses extra-bright for ~1.4s. */
  deflectingRockLane?: LaneIndex | null;
  /** Key that changes each deflection — drives the re-mount of the pulse
   *  anim so consecutive deflects on the same rock re-fire. */
  deflectKey?: number | null;
  /** True when the active targeting is a summon (i.e. RPSLS picker active).
   *  Drives the "↻ Remplacer" label override on occupied lanes. */
  summoningMove?: boolean;
}) {
  // Pierre's Provocation (taunt) is suppressed while opp has ANY of the
  // two RPSLS counters of Rock alive — Paper (Étouffe) OR Spock (Logique
  // anti-taunt). Pre-compute once per row so each slot renders the right
  // visual state (no halo + no badge when suppressed).
  const oppSideKey: Side = renderSide === "a" ? "b" : "a";
  const oppHasStifle = lanes.some((l) => {
    const c = l[oppSideKey];
    return !!c && (c.move === "paper" || c.move === "spock");
  });
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3 max-w-md mx-auto w-full [@media(max-height:560px)]:gap-1.5">
      {/* Cases lanes : taille INCHANGÉE (Alex 2026-06-11 "agrandir SEULEMENT le
       *  pad qui les contient, pas les cases mêmes"). max-w-md=448px ignoré
       *  sur mobile 380px → cases prennent ce qui est dispo, comme au build
       *  d'avant. */}
      {[0, 1, 2].map((i) => {
        const lane = i as LaneIndex;
        const c = lanes[lane][renderSide];
        const plannedSummon = intent?.summons.find((s) => s.lane === lane) ?? null;
        const inCombat = combatLane === lane;
        // chargeAttack = seul l'ATTAQUANT du camp charge (anti-mush). Le halo de
        // lane + le padShake gardent `inCombat` (toute la lane s'allume).
        const charges = inCombat && combatChargers.includes(renderSide);
        // Cue d'attaque PAR MOVE rendu sur la lane ATTAQUÉE (Alex 2026-06-17) :
        // si la créature ADVERSE de cette lane charge, son cue (relatif à son
        // move) s'affiche sur CE slot (la cible) — pas sur l'attaquant.
        const incomingAttacker = lanes[lane][oppSideKey];
        const incomingAttack = inCombat && combatChargers.includes(oppSideKey) && !!incomingAttacker;
        const valid = validLanes[i] ?? false;
        const laneStickers = stickers.filter((s) => s.lane === lane);
        // Only Pierre cares about suppression today (Étouffe). Other innate
        // passives (Tranchant, Esquive, Logique, Étouffe itself) have no
        // counter-effect — they always render their badge.
        const suppressed = !!c && c.taunt && oppHasStifle;
        return (
          <div
            key={i}
            className="relative"
            data-arena-lane={lane}
            data-arena-side={renderSide}
          >
            {/* COMBAT HALO — golden pulsing ring around the lane slot during
             *  its combat tick. Plays in sync with the per-creature charge
             *  anim so the eye instantly locks on which lane is alive. */}
            <AnimatePresence>
              {inCombat && (
                <motion.div
                  key={"halo-" + i}
                  aria-hidden
                  initial={{ opacity: 0, scale: 1 }}
                  animate={{
                    opacity: [0, 0.85, 0.6, 0.85, 0],
                    boxShadow: [
                      "0 0 0 0 rgba(252,211,77,0)",
                      "0 0 22px 5px rgba(252,211,77,0.7), inset 0 0 0 2px rgba(252,211,77,0.55)",
                      "0 0 16px 4px rgba(252,211,77,0.5), inset 0 0 0 2px rgba(252,211,77,0.4)",
                      "0 0 28px 8px rgba(252,211,77,0.85), inset 0 0 0 3px rgba(252,211,77,0.7)",
                      "0 0 0 0 rgba(252,211,77,0)",
                    ],
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.1, ease: "easeInOut" }}
                  className="absolute -inset-1 rounded-xl pointer-events-none z-[3]"
                />
              )}
            </AnimatePresence>
            <ArenaLaneSlot
              lane={lane}
              creature={c}
              plannedSummon={plannedSummon}
              isPlayer={isPlayer}
              showPlanned={!!intent}
              chargeAttack={charges}
              clickable={valid}
              clickableLabel={
                // "↻ Remplacer" si on est en mode summon ET le slot a déjà
                // une de mes créatures (replace au lieu d'invoquer ici).
                (summoningMove && !!c && isPlayer) ? "↻ Remplacer" : targetLabel
              }
              onClick={valid && onLaneTap ? () => onLaneTap(lane) : undefined}
              onRemoveSummon={isPlayer && onRemoveSummon && plannedSummon ? () => onRemoveSummon(lane) : undefined}
              passiveSuppressed={suppressed}
              deflectingPulse={deflectingRockLane === lane ? deflectKey ?? 0 : null}
            />
            {/* Cue d'attaque (par move) sur la lane ATTAQUÉE (la cible). */}
            <AnimatePresence>
              {incomingAttack && incomingAttacker && <MoveAttackCue key={`atk-${i}`} move={incomingAttacker.move} />}
            </AnimatePresence>
            {/* Nom de la carte/effet jouée sur la lane — AU-DESSUS de MA lane,
             *  EN-DESSOUS de la lane adverse (Alex 2026-06-17) : suivre les
             *  effets des 2 camps, compact, sans encombrer le centre du pad. */}
            {laneStickers.length > 0 && (
              <div className={"absolute left-0 right-0 flex flex-col items-center gap-px px-0.5 pointer-events-none z-30 " + (isPlayer ? "bottom-full mb-0.5" : "top-full mt-0.5")}>
                {laneStickers.map((s) => (
                  <span
                    key={`name-${s.id}-${s.idx}`}
                    className={"max-w-full truncate px-1 py-px rounded text-[8px] font-bold uppercase tracking-wide leading-tight shadow " + (s.owner === "you" ? "bg-emerald-600/90 text-emerald-50" : "bg-rose-600/90 text-rose-50")}
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            )}
            {/* Card stickers — small CardSlot badges showing which spells
             *  hit this lane this turn (mirrors Ranked LanesBoard pattern).
             *  Owner "you" gets a swoop-from-hand entry anim so the player
             *  sees the cast land on the lane in real time.
             *
             *  Round 11 Alex fix #3 : éventail multi-cartes par lane. Si plus
             *  d'un sticker même position, fan-out rotation + offset X pour
             *  qu'ils ne se cachent pas les uns sur les autres. */}
            {(() => {
              const byPos = new Map<string, typeof laneStickers>();
              for (const s of laneStickers) {
                if (!byPos.has(s.position)) byPos.set(s.position, []);
                byPos.get(s.position)!.push(s);
              }
              const out: React.ReactNode[] = [];
              byPos.forEach((group) => {
                group.forEach((s, idx) => {
                  const count = group.length;
                  // Plus écarté (Alex : éventail dur à distinguer) — angle +
                  // décalage X augmentés pour que chaque carte assignée se lise.
                  // La suppression se fait via les chips lane-labellisés sous la main.
                  // Stickers RÉDUITS (Alex 2026-06-11) : scale 0.72 + éventail
                  // resserré (angle/offset réduits) pour qu'à 2-3 cartes ça ne
                  // prenne pas tout l'œil.
                  const fanAngle = count > 1 ? (idx - (count - 1) / 2) * 12 : 0;
                  const fanShiftX = count > 1 ? (idx - (count - 1) / 2) * 11 : 0;
                  // ANTI-REJOUE (Alex 2026-06-13) : une CARTE-SORT posée est
                  // DÉFINITIVE — pas de retour en main. Sinon : poser, voir
                  // l'aperçu fantôme, retirer = scout gratuit + carte « jamais
                  // jouée » qui repart au deck = gros breach. Les INVOCATIONS
                  // (moves RPSLS) restent retirables via onRemoveSummon : ce ne
                  // sont pas des cartes, elles ne viennent/repartent pas du deck.
                  // onRemoveSticker conservé câblé pour une future RELOCALISATION
                  // (déplacer vers une autre lane sans repasser par la main).
                  // Retirable AVANT « Fin de tour » (Alex 2026-06-13 : « la
                  // petite croix tant que pas locké »). Post-lock c'est
                  // combatLane/resolving qui bloquent côté plan phase. Le breach
                  // « voir l'effet PUIS retirer » est post-lock — déjà interdit.
                  // `&& !valid` (Alex 2026-06-17) : si cette lane est une CIBLE
                  // valide du ciblage en cours, le sticker (overlay z-22 plein
                  // cadre, pointer-events-auto) NE DOIT PAS capter le tap — sinon
                  // il bloque SILENCIEUSEMENT la pose d'un 2e sort sur une lane
                  // qui en a déjà un (ex. Aegis + Frappe parfaite sur la même
                  // créature). Hors ciblage (valid=false), il reste retirable au tap.
                  const removable = s.owner === "you" && !!onRemoveSticker && combatLane === null && !valid;
                  out.push(
                    <div
                      key={`${s.id}-${idx}-${s.position}`}
                      className={"absolute inset-0 " + (removable ? "pointer-events-auto cursor-pointer active:scale-95" : "pointer-events-none")}
                      style={{
                        transform: `rotate(${fanAngle}deg) translateX(${fanShiftX}px) scale(0.72)`,
                        transformOrigin: s.position.includes("b") ? "bottom center" : "top center",
                        // z AU-DESSUS du fantôme d'invocation planifiée (z-20 dans
                        // ArenaLaneSlot) — Alex 2026-06-13 « sur L3 le sticker passe
                        // DERRIÈRE la carte jouée » : quand on invoque ET on lance un
                        // sort sur la MÊME lane, le ghost masquait le sticker. 22+idx
                        // le repasse devant ; < charge (30) pour ne pas couvrir l'attaque.
                        zIndex: 22 + idx,
                      }}
                      onClick={removable ? (e) => { e.stopPropagation(); onRemoveSticker!(s.idx); } : undefined}
                    >
                      <CardSlot id={s.id} position={s.position} flyFromHand={s.owner === "you"} />
                      {removable && (
                        <span className="absolute -top-1 -left-1 w-3 h-3 rounded-full bg-rose-500 text-white text-[8px] font-black flex items-center justify-center shadow ring-[1px] ring-rose-950/80 leading-none pointer-events-none">✕</span>
                      )}
                    </div>,
                  );
                });
              });
              return out;
            })()}
          </div>
        );
      })}
    </div>
  );
}
