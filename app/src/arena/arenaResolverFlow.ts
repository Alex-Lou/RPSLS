/**
 * Sequenced resolver flow for Constellation Pro.
 *
 * Drives the animated turn resolution: REVEAL → SPELLS → SUMMONS → COMBAT
 * (lane-by-lane) → SETTLE → advance to next turn. All side effects go
 * through the setter callbacks passed in — this file owns the TIMING but
 * not the React state.
 *
 * Extracted from ArenaGame.tsx so that file stays under the 400-line ceiling.
 */

import {
  applyAllSpells,
  applySummons,
  creatureEffectiveAtk,
  endOfTurnCleanup,
  resolveLaneCombatAt,
} from "./arenaRules";
import { CREATURE_STATS, TURN_HARD_CAP, moveCountersMove, type BoardState, type LaneIndex, type Side, type TurnIntent } from "./arenaTypes";
import type { Move } from "../engine/game";
import type { CardId } from "../ranked/rankedTypes";
import { alog } from "./arenaLog";
import { isDominantSpell } from "./arenaFinishers";
import { spellPriority } from "./arenaCardEffects";
import { SPELLS_WITH_SIGNATURE } from "./ArenaSpellFX";
import type { ProjectileFX } from "./ArenaProjectileFX";
import type { LaneOutcome, LaneResult } from "./arenaTelemetry";
import { BALANCE } from "./arenaBalance";

/** Snapshot helper — log compact d'une lane avec flags. Réutilise le même
 *  format que advanceToNextTurn pour cohérence à travers le pipeline. */
function logBoardSnapshot(b: BoardState, tag: string): void {
  alog("state", `--- ${tag} --- a.hp=${b.a.hp} b.hp=${b.b.hp}`);
  const fmt = (c: BoardState["lanes"][number]["a"]): string => {
    if (!c) return "∅";
    const stats = CREATURE_STATS[c.move];
    const atk = creatureEffectiveAtk(c);
    const flags: string[] = [];
    if (c.divineShield) flags.push("🛡");
    if (c.dodgeCharges > 0) flags.push(c.dodgeCharges > 1 ? `✨${c.dodgeCharges}` : "✨");
    if (c.taunt && c.provocationCharges > 0) flags.push(`P${c.provocationCharges}`);
    if (c.summonedThisTurn && (c.move === "rock" || c.move === "lizard")) flags.push("L");
    if (c.move === "paper" && c.wiltedSteps > 0) flags.push(`F${c.wiltedSteps}`);
    if (c.combatBlunted) flags.push("É");
    return `${c.move}(${c.hp}/${stats.hp},⚔${atk}${flags.length ? "," + flags.join("") : ""})`;
  };
  for (let i = 0; i < 3; i++) {
    alog("state", `${tag} L${i} a:${fmt(b.lanes[i].a)} b:${fmt(b.lanes[i].b)}`);
  }
  // Alex feedback : "ajouter les cartes de chacun dans les logs" → mains
  // visibles côté joueur ET côté CPU pour analyse CCG post-mortem.
  // Format compact : main=[id1,id2,...] deck=N discard=M mana=X/Y.
  alog("hand", `${tag} a hand=[${b.a.hand.join(",")}] deck=${b.a.deck.length} discard=${b.a.discard.length} mana=${b.a.mana}/${b.a.maxMana}`);
  alog("hand", `${tag} b hand=[${b.b.hand.join(",")}] deck=${b.b.deck.length} discard=${b.b.discard.length} mana=${b.b.mana}/${b.b.maxMana}`);
}

/** Resolver step labels — kept in sync with ArenaBoard's banner switch. */
export type ResolveStep =
  | "reveal-opp"   // showing CPU intent before any effect
  | "spells"       // both sides' spells just fired
  | "summons"      // new creatures just landed
  | "combat"       // lane combat just resolved
  | "settle";      // post-combat, before next turn

export interface ResolverFlowArgs {
  /** Board AFTER hand-cleanup (spells removed from hand) but BEFORE spell effects fire. */
  startBoard: BoardState;
  playerIntent: TurnIntent;
  cpuIntent: TurnIntent;
  setBoard: (b: BoardState) => void;
  setOppPreview: (i: TurnIntent | null) => void;
  setPlayerPreview: (i: TurnIntent | null) => void;
  setResolveStep: (s: ResolveStep | null) => void;
  setCombatLane: (l: LaneIndex | null) => void;
  /** Camps qui CHARGENT sur la lane en combat (anti-mush, Alex 2026-06-17) :
   *  seul l'attaquant fonce ; le défenseur garde sa réaction au dégât.
   *  Optionnel (tests/headless). */
  setCombatChargers?: (sides: ("a" | "b")[]) => void;
  setHeroHit: (h: { side: "you" | "opp"; lane: LaneIndex; key: number } | null) => void;
  /** Set when an undefended-lane attack is DEFLECTED by a taunt creature.
   *  `defenderSide` owns the taunt. `rockLane` is the lane of the Pierre
   *  that ate the deflection — used by the UI to pull a dotted line from
   *  the attacker's lane to the Pierre + decrement its charge badge. */
  setTauntBlock: (b: { defenderSide: "a" | "b"; rockLane: LaneIndex; key: number } | null) => void;
  /** Anti-taunt bypass — set when an attack reaches a hero despite a charged
   *  Pierre, because the attacker carries Étouffe (Paper) / Logique (Spock)
   *  which cancel Provocation. `bypassedSide` owns the bypassed Pierre. */
  setAntiTaunt: (b: { bypassedSide: "a" | "b"; rockLane: LaneIndex; cause: "paper" | "spock"; key: number } | null) => void;
  /** Riposte d'esquive (Mirage) — set quand un Lézard va esquiver un counter et
   *  contre-attaquer : pop un chip sur la lane de l'ATTAQUANT (« meurt sans raison »
   *  → enfin expliqué, Alex 2026-06-28). Optionnel (tests/headless). */
  setRiposteFX?: (b: { attackerSide: "a" | "b"; lane: LaneIndex; key: number } | null) => void;
  /** Signature FX plein-board (Genèse, Supernova…) — déclenché au step SPELLS
   *  avec les ids de TOUS les sorts joués ce tour. ArenaSpellFX ne joue que
   *  ceux qui ont une signature ; le reste s'appuie sur les réactions
   *  par-créature (ArenaLaneSlot). Optionnel (tests/headless). */
  setSpellFX?: (fx: { ids: CardId[]; key: number } | null) => void;
  /** IMPACT FX plein-écran (Alex 2026-06-13) — déclenché sur un coup PUISSANT
   *  ou FATAL au héros, typé par le MOVE de l'attaquant (Ciseaux → entaille,
   *  Pierre → ébranlement…). Cf. ArenaImpactFX. */
  setImpactFX?: (fx: { move: Move; power: "strong" | "fatal"; key: number } | null) => void;
  /** Projectiles « cailloux » lane→lane — Jet de Caillou (1) + Éboulement AOE (N).
   *  Liste de tirs posée d'un coup (Alex 2026-06-24/25). Optionnel (tests/headless). */
  setProjectileFX?: (shots: ProjectileFX[]) => void;
  /** Called BEFORE the resolver advances to the next turn — clears the
   *  player's pending intent and stops the "resolving" lock. */
  onSettle: (finalBoard: BoardState) => void;
  /** Called AFTER the resolver's settle pause — advances board to next turn. */
  onAdvanceTurn: () => void;
  /** Match-end haptics — fired once if either hero hit 0 HP. */
  onMatchEnd?: (winnerIsPlayer: boolean) => void;
  /** Télémétrie Watcher (observationnel, fail-soft) — appelé 1× par lane APRÈS
   *  résolution du combat, avec l'issue DÉJÀ calculée par le résolveur (aucune
   *  logique de combat dupliquée). Optionnel (tests/headless). ZÉRO effet gameplay. */
  onLaneResolved?: (outcome: LaneOutcome) => void;
}

/** Pacing constants — RALENTIES (Alex 2026-06-23 « tout va vite, je m'y perds »).
 *  Chaque beat doit LANDER avant le suivant. Un tour ≈ 10-11s : on privilégie la
 *  LISIBILITÉ au tempo (re-tune live en jouant, option 2). */
export const REVEAL_MS = 1_700;
export const SPELLS_MS = 1_500;
export const SUMMONS_MS = 1_300;
// COMBAT_MS = délai avant le SETTLE, compté depuis le DÉBUT du combat. DOIT être
// ≥ l'instant du dernier event visuel des 3 lanes (= 2*(CHARGE+PAUSE+50) + CHARGE
// + PAUSE ≈ 4060ms avec 720/600) sinon le SETTLE coupe la 3e lane. 3600→4400.
export const COMBAT_MS = 4_400;
export const SETTLE_MS = 1_500;
// Spell-spotlight séquencé (Alex 2026-06-23 « carte à l'avant → anim → dissolution
// → suivante »). Fenêtre par carte à signature ; un climax (Légendaire/Finisher)
// dure plus longtemps. ArenaGame.spellFX hold doit être ≥ ces valeurs (1900/2900).
const CARD_MS = 1_700;
const DOMINANT_CARD_MS = 2_700;
// Rythme de combat (Alex 2026-06-23 ralenti + focus). Le beat d'une lane DOIT être
// ≥ la durée de la charge (CreatureSlot) sinon le slam est coupé. 560→720 (l'apex
// du slam ≈308ms a le temps de finir) ; pause inter-lane 480→600 pour que la
// traîne (dmgPop/hitShake) retombe AVANT que la suivante charge. + la lane active
// est SPOTLIGHT (les 2 autres s'éteignent, cf LaneRow) → un seul échange lisible.
const LANE_CHARGE_MS = 720;
const LANE_PAUSE_MS = 600;
// Alex 2026-06-12 : pause sur le board final (coup fatal + HP à 0 visibles)
// AVANT d'afficher l'écran victoire/défaite — sinon la bascule est trop brusque
// juste après le combat de la 3e lane.
const VICTORY_REVEAL_MS = 1_600;

/** Run the sequenced resolver. Schedules a chain of setTimeouts that drive
 *  the visual flow. Returns nothing — the caller's React state is the only
 *  observable side-effect. */
export function runResolverFlow(args: ResolverFlowArgs): () => void {
  const {
    startBoard, playerIntent, cpuIntent,
    setBoard, setOppPreview, setPlayerPreview, setResolveStep,
    setCombatLane, setCombatChargers, setHeroHit, setTauntBlock, setAntiTaunt, setRiposteFX, setSpellFX, setImpactFX, setProjectileFX,
    onSettle, onAdvanceTurn, onMatchEnd, onLaneResolved,
  } = args;

  // Annulation (Audit anim Build A — fuite mémoire). Le résolveur programme une
  // chaîne de setTimeout sur ~9s ; si le joueur forfait/quitte/rematch ou que le
  // composant se démonte PENDANT, la chaîne continuait (setState post-unmount +
  // onAdvanceTurn/onMatchEnd pouvait RELANCER une partie quittée). Flag `aborted`
  // vérifié en tête de CHAQUE callback → la chaîne s'arrête net. runResolverFlow
  // renvoie un cancel() que ArenaGame appelle au unmount / forfait.
  let aborted = false;

  // Le « moment » Légendaire/Finisher est géré PAR CARTE dans la file de
  // spell-spotlight (Step 1) — plus besoin d'un flag global de tour.

  // ─── Step 0: REVEAL ───
  setOppPreview(cpuIntent);
  setPlayerPreview(playerIntent);
  setResolveStep("reveal-opp");

  // ─── Step 1: SPELLS ─── (fairness fix #1: intercalate sides by priority)
  window.setTimeout(() => {
    if (aborted) return;
    let b = startBoard;
    // INVOCATIONS AVANT SORTS (Alex 2026-06-29) : on POSE + commit les créatures
    // fraîches AVANT de résoudre les sorts → Éboulement & co agissent sur les
    // voisines tout juste invoquées (fini « le sort frappe le ghost, la créature se
    // forme après »). postSummonBoard = état lu par les projectiles (cibles réelles).
    b = applySummons(b, playerIntent, "a");
    b = applySummons(b, cpuIntent, "b");
    const postSummonBoard = b;
    setBoard(b);
    setOppPreview(null);
    setPlayerPreview(null);
    b = applyAllSpells(b, playerIntent, cpuIntent);
    setResolveStep("spells");
    // COMMIT du board (mort/dégâts/héros) — emballé pour pouvoir être DIFFÉRÉ à
    // l'impact du caillou (cf. plus bas). Flash de strip sur le héros qui ENCAISSE
    // un sort de dégât direct (Supernova, Trou Noir, Heist…) : on compare les PV
    // avant/après ; le perdant de PV voit son strip flasher (Alex 2026-06-17). Le
    // heal (diff positive) ne déclenche rien. lane=0 = placeholder (non lu).
    const commitSpellBoard = () => {
      if (aborted) return;
      setBoard(b);
      if (b.a.hp < startBoard.a.hp) setHeroHit({ side: "you", lane: 0, key: Date.now() });
      if (b.b.hp < startBoard.b.hp) setHeroHit({ side: "opp", lane: 0, key: Date.now() + 1 });
    };
    // SPELL-SPOTLIGHT séquencé (Alex 2026-06-23 « carte à l'avant → anim →
    // dissolution → suivante, sinon ça se mélange »). Le board est déjà appliqué
    // d'un coup ci-dessus (correctness inchangée) ; ici on rejoue les SIGNATURES
    // UNE CARTE À LA FOIS, dans l'ordre de RÉSOLUTION (priorité) → ce que le joueur
    // voit colle à l'ordre où les effets se sont appliqués. spellsPhaseMs = durée
    // totale de la file → la phase SORTS dure exactement ce qu'il faut (dynamique).
    const sigQueue = [...playerIntent.spells, ...cpuIntent.spells]
      .map((s) => s.id)
      .filter((cardId) => SPELLS_WITH_SIGNATURE.includes(cardId))
      .sort((x, y) => spellPriority(x) - spellPriority(y));
    let spellAcc = 0;
    const fxBaseKey = Date.now();
    if (setSpellFX) {
      sigQueue.forEach((cardId, k) => {
        const at = spellAcc;
        spellAcc += isDominantSpell(cardId) ? DOMINANT_CARD_MS : CARD_MS;
        window.setTimeout(() => {
          if (aborted) return;
          setSpellFX({ ids: [cardId], key: fxBaseKey + k });
        }, at);
      });
    }
    // Projectile « Jet de Caillou » (Alex 2026-06-24) : cue lane→lane indépendant
    // des signatures plein-board. Pour chaque jet-caillou joué QUI A TOUCHÉ (garde
    // de applyJetCaillou sur startBoard : cible présente, non ancrée, non immunisée),
    // on lance un caillou (léger décalage si plusieurs). La mort éventuelle reste
    // gérée par DeathShatter (diff de board) ; ici purement cosmétique.
    let projectileFired = false;
    if (setProjectileFX) {
      const shots: ProjectileFX[] = [];
      let k = 0;
      const oppOnLane = (side: Side, l: LaneIndex) => (side === "a" ? postSummonBoard.lanes[l].b : postSummonBoard.lanes[l].a);
      const hits = (side: Side, l: LaneIndex): boolean => {
        const o = oppOnLane(side, l);
        return !!o && !o.anchored && !o.spellImmune; // garde de applyJetCaillou (cible réelle)
      };
      const collect = (intent: TurnIntent, side: Side) => {
        const toSide: Side = side === "a" ? "b" : "a";
        for (const sp of intent.spells) {
          if (sp.kind !== "lane") continue;
          if (sp.id === "jet-caillou") {
            // Tir unique : seulement s'il touche une vraie cible (sinon un impact
            // sur une case vide mentirait).
            if (hits(side, sp.lane)) shots.push({ fromSide: side, toSide, lane: sp.lane, key: fxBaseKey + 7000 + k++ });
          } else if (sp.id === "eboulement") {
            // AOE COSMÉTIQUE : on montre TOUJOURS la roche tomber sur la lane
            // ciblée + les 2 voisines (in-board), même case vide/ancrée — Alex
            // « je vois l'effet central mais pas l'impact des 2 côtés ». La roche
            // est purement visuelle (mort/dégâts = board diff + DeathShatter), donc
            // un impact d'éboulement sur une lane vide ne ment pas (ça s'éboule).
            for (const l of [sp.lane, sp.lane - 1, sp.lane + 1] as LaneIndex[]) {
              if (l < 0 || l > 2) continue;
              shots.push({ fromSide: side, toSide, lane: l, key: fxBaseKey + 7000 + k++ });
            }
          }
        }
      };
      collect(playerIntent, "a");
      collect(cpuIntent, "b");
      if (shots.length > 0) { setProjectileFX(shots); projectileFired = true; }
    }
    // COMMIT : si des cailloux volent, on RETARDE le commit du board jusqu'à leur
    // IMPACT (~780ms = TRAVEL_MS 0.95s × 0.82 dans ArenaProjectileFX) → la créature
    // touchée disparaît PILE au slam de la roche, pas à la pose (Alex 2026-06-26).
    // Sinon (aucun tir), commit immédiat — comportement inchangé.
    const PROJECTILE_IMPACT_MS = 780;
    if (projectileFired) window.setTimeout(commitSpellBoard, PROJECTILE_IMPACT_MS);
    else commitSpellBoard();
    // Durée de la phase SORTS = file complète, OU une base mini (SPELLS_MS), ET au
    // moins l'impact du caillou si tir (sinon SUMMONS pré-committerait le board et
    // ferait disparaître la créature avant l'arrivée de la roche).
    const spellsPhaseMs = Math.max(SPELLS_MS, spellAcc + 150, projectileFired ? PROJECTILE_IMPACT_MS + 250 : 0);
    logBoardSnapshot(b, "post-spells");

    // ─── Step 2: invocations DÉJÀ posées en tête (Alex 2026-06-29) — ce beat
    //     espace juste le combat après la phase SORTS. ───
    window.setTimeout(() => {
      if (aborted) return;
      setResolveStep("summons");
      logBoardSnapshot(b, "pre-combat");

      // ─── Step 3: COMBAT — lane by lane ───
      window.setTimeout(() => {
        if (aborted) return;
        setResolveStep("combat");
        const runLane = (laneIdx: 0 | 1 | 2) => {
          if (aborted) return;
          const lane = b.lanes[laneIdx];
          const aHitsB = !!lane.a && !lane.b;
          const bHitsA = !!lane.b && !lane.a;
          // RPSLS counter follow-through (2026-06-09): if both creatures
          // are present and one counters the other, the loser dies AND the
          // winner pursues its ATK onto the opp hero (unless dodge or a
          // charged Pierre deflects). Treat that as a hero hit for the
          // anim layer too.
          const bothPresent = !!lane.a && !!lane.b;
          const counterAB = bothPresent && moveCountersMove(lane.a!.move, lane.b!.move);
          const counterBA = bothPresent && moveCountersMove(lane.b!.move, lane.a!.move);
          // Sync avec arenaCombat : la poursuite n'a PAS lieu si le perdant est
          // sauvé par Esquive OU par Aegis (sauf attaquant Tranchant/LAME qui
          // percent le bouclier ; LAME perce aussi l'Esquive). Sans ces termes
          // l'anim flashait le héros alors que l'engine ne frappait pas.
          const aLame = !!lane.a && b.a.lameActive && lane.a.move === "scissors";
          const bLame = !!lane.b && b.b.lameActive && lane.b.move === "scissors";
          const aFollowsThroughOnB = bothPresent && counterAB && !counterBA
            && (lane.b!.dodgeCharges === 0 || aLame)
            && (!lane.b!.divineShield || lane.a!.pierces || aLame);
          const bFollowsThroughOnA = bothPresent && counterBA && !counterAB
            && (lane.a!.dodgeCharges === 0 || bLame)
            && (!lane.a!.divineShield || lane.b!.pierces || bLame);
          // TAUNT DEFLECTION DETECTION — keep in sync with rules.findDeflector:
          //   first ALIVE+CHARGED Pierre on defender's side, EXCEPT if
          //   attacker has Paper/Spock anti-taunt active. Returns the
          //   Pierre's lane so the chip can point a dotted line at it.
          const isAntiTaunt = (c: { move: string } | null | undefined): boolean =>
            !!c && (c.move === "paper" || c.move === "spock");
          const findDeflectorLane = (defenderSide: "a" | "b"): LaneIndex | null => {
            const attackerSide: "a" | "b" = defenderSide === "a" ? "b" : "a";
            // LAME Finisher : l'attaquant Ciseau LAME perce la Provoc — pas de
            // chip "détourné" (sync avec le skip deflect d'arenaCombat).
            const attackerLame = attackerSide === "a" ? aLame : bLame;
            if (attackerLame) return null;
            const attackerHasAntiTaunt = b.lanes.some((l) =>
              isAntiTaunt(attackerSide === "a" ? l.a : l.b),
            );
            if (attackerHasAntiTaunt) return null;
            for (let i = 0; i < 3; i++) {
              const c = defenderSide === "a" ? b.lanes[i].a : b.lanes[i].b;
              if (c && c.taunt && c.provocationCharges > 0) return i as LaneIndex;
            }
            return null;
          };
          // ANTI-TAUNT BYPASS — when an attack reaches the hero AND the
          // defender HAS a charged Pierre but the attacker carries Étouffe
          // (Paper) / Logique (Spock), the Provocation is cancelled. Surface
          // WHICH passive bypassed the rock so the player understands why it
          // didn't defend (keep the move check in sync with isAntiTaunt above).
          const findAntiTauntBypass = (defenderSide: "a" | "b"): { rockLane: LaneIndex; cause: "paper" | "spock" } | null => {
            const attackerSide: "a" | "b" = defenderSide === "a" ? "b" : "a";
            let cause: "paper" | "spock" | null = null;
            for (let i = 0; i < 3; i++) {
              const c = attackerSide === "a" ? b.lanes[i].a : b.lanes[i].b;
              if (c && (c.move === "paper" || c.move === "spock")) { cause = c.move; break; }
            }
            if (!cause) return null;
            for (let i = 0; i < 3; i++) {
              const c = defenderSide === "a" ? b.lanes[i].a : b.lanes[i].b;
              if (c && c.taunt && c.provocationCharges > 0) return { rockLane: i as LaneIndex, cause };
            }
            return null;
          };
          // a hits b's hero when either undefended attack or RPSLS follow-through.
          // Splash damage (Alex 2026-06-11) : la poursuite après counter-kill
          // est réduite à max(0, ATK − HP cible). Si splash = 0 → le hero ne
          // prend RIEN, pas d'anim flash sur sa HP bar (sinon induit en erreur).
          const atkA = lane.a ? creatureEffectiveAtk(lane.a) : 0;
          const atkB = lane.b ? creatureEffectiveAtk(lane.b) : 0;
          const splashAtoB = aFollowsThroughOnB && lane.b ? Math.max(0, atkA - lane.b.hp) : 0;
          const splashBtoA = bFollowsThroughOnA && lane.a ? Math.max(0, atkB - lane.a.hp) : 0;
          const aReachesHeroB = aHitsB || aFollowsThroughOnB;
          const bReachesHeroA = bHitsA || bFollowsThroughOnA;
          // damage RÉEL qui va toucher le hero (filtre les follow-through à 0)
          const aHitsHeroBForReal = (aHitsB && atkA > 0) || splashAtoB > 0;
          const bHitsHeroAForReal = (bHitsA && atkB > 0) || splashBtoA > 0;
          const bDeflectorLane = aReachesHeroB ? findDeflectorLane("b") : null;
          const aDeflectorLane = bReachesHeroA ? findDeflectorLane("a") : null;
          // Anti-mush (Alex 2026-06-17) : seul l'ATTAQUANT charge — le défenseur
          // garde sa réaction hitShake au moment du dégât → séquence lisible
          // « fonce → encaisse ». Vainqueur du counter, ou créature seule ; trade
          // sans counter (même symbole / pas de relation) = les 2 (vrai clash).
          const chargers: ("a" | "b")[] = bothPresent
            ? (counterAB && !counterBA ? ["a"] : counterBA && !counterAB ? ["b"] : ["a", "b"])
            : lane.a ? ["a"] : lane.b ? ["b"] : [];
          setCombatChargers?.(chargers);
          setCombatLane(laneIdx);
          // Mid-charge: flash the targeted hero BEFORE damage is committed,
          // OR pop the taunt block if the attack will be deflected.
          window.setTimeout(() => {
            if (aborted) return;
            if (bDeflectorLane !== null) {
              setTauntBlock({ defenderSide: "b", rockLane: bDeflectorLane, key: Date.now() });
            } else if (aHitsHeroBForReal) {
              // Anti-taunt bypass chip seulement si dmg réellement infligé.
              const bypass = findAntiTauntBypass("b");
              if (bypass) setAntiTaunt({ bypassedSide: "b", rockLane: bypass.rockLane, cause: bypass.cause, key: Date.now() });
              setHeroHit({ side: "opp", lane: laneIdx, key: Date.now() });
              // IMPACT FX plein-écran RÉSERVÉ au coup FATAL (Audit anim Build A).
              // Avant : ≥4 dégâts le déclenchait → 1-3 entailles plein-écran +
              // screenShake cumulé au padShake PAR TOUR = « mush/instable ». Le
              // feedback normal passe par la signature par-move (cue de lane).
              const dmgB = splashAtoB > 0 ? splashAtoB : atkA;
              const powB = b.b.hp - dmgB <= 0 ? "fatal" : null;
              if (powB && lane.a && setImpactFX) setImpactFX({ move: lane.a.move, power: powB, key: Date.now() });
            }
            if (aDeflectorLane !== null) {
              setTauntBlock({ defenderSide: "a", rockLane: aDeflectorLane, key: Date.now() + 1 });
            } else if (bHitsHeroAForReal) {
              const bypass = findAntiTauntBypass("a");
              if (bypass) setAntiTaunt({ bypassedSide: "a", rockLane: bypass.rockLane, cause: bypass.cause, key: Date.now() + 1 });
              setHeroHit({ side: "you", lane: laneIdx, key: Date.now() + 1 });
              const dmgA = splashBtoA > 0 ? splashBtoA : atkB;
              const powA = b.a.hp - dmgA <= 0 ? "fatal" : null; // plein-écran fatal-only (Audit anim Build A)
              if (powA && lane.b && setImpactFX) setImpactFX({ move: lane.b.move, power: powA, key: Date.now() + 1 });
            }
            // RIPOSTE D'ESQUIVE (Mirage) — cue « pourquoi l'attaquant tombe » : un
            // Lézard qui va esquiver le counter contre-attaque (cf. dodgeSave + riposte
            // arenaCombat). On pop le chip sur la lane de l'ATTAQUANT (miroir exact des
            // conditions de save d'arenaCombat).
            if (setRiposteFX && BALANCE.mirage.dodgeRiposte > 0 && bothPresent) {
              const bRiposte = counterAB && !counterBA && lane.b!.move === "lizard" && lane.b!.dodgeCharges > 0 && !aLame;
              const aRiposte = counterBA && !counterAB && lane.a!.move === "lizard" && lane.a!.dodgeCharges > 0 && !bLame;
              if (bRiposte) setRiposteFX({ attackerSide: "a", lane: laneIdx, key: Date.now() + 2 });
              else if (aRiposte) setRiposteFX({ attackerSide: "b", lane: laneIdx, key: Date.now() + 3 });
            }
          }, LANE_CHARGE_MS * 0.55);
          window.setTimeout(() => {
            if (aborted) return;
            const prevB = b;
            // Wrap resolveLaneCombatAt in try-catch. Si le combat throw
            // silencieusement (ce qu'on suspecte pour le bug L2 rock vs
            // scissors qui stop à step=updatedBoardBuilt), on l'attrape et
            // on log l'erreur AU LIEU de laisser l'exception unwind le
            // setTimeout (qui sinon empêchait le kill d'être appliqué).
            try {
              b = resolveLaneCombatAt(b, laneIdx);
            } catch (e) {
              const msg = e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e);
              alog("combat", `L${laneIdx} EXCEPTION: ${msg}`);
              b = prevB;
            }
            if (!b) {
              alog("combat", `L${laneIdx} POST-RESOLVE BUG : board=null !`);
              b = prevB;
            } else if (b === prevB) {
              alog("combat", `L${laneIdx} POST-RESOLVE same-ref (pas de mutation)`);
            }
            setBoard(b);
            // Télémétrie Watcher (Tier B) — issue de la lane, à partir des valeurs
            // DÉJÀ calculées ci-dessus + le diff de board (prevB → b). Fail-soft,
            // observationnel : ne touche jamais au gameplay.
            if (onLaneResolved) {
              try {
                const selfMove = lane.a?.move ?? null;
                const oppMove = lane.b?.move ?? null;
                const result: LaneResult =
                  lane.a && lane.b
                    ? counterAB ? "counterWinSelf" : counterBA ? "counterWinOpp" : "mirror"
                    : lane.a ? "emptySelf" : lane.b ? "emptyOpp" : "none";
                onLaneResolved({
                  lane: laneIdx,
                  selfMove,
                  oppMove,
                  result,
                  killSelf: !!prevB.lanes[laneIdx].a && !b.lanes[laneIdx].a,
                  killOpp: !!prevB.lanes[laneIdx].b && !b.lanes[laneIdx].b,
                  saved:
                    (counterAB && !counterBA && !!prevB.lanes[laneIdx].b && !!b.lanes[laneIdx].b) ||
                    (counterBA && !counterAB && !!prevB.lanes[laneIdx].a && !!b.lanes[laneIdx].a),
                  splashToOpp: bDeflectorLane === null ? splashAtoB : 0,
                  splashToSelf: aDeflectorLane === null ? splashBtoA : 0,
                  directToOpp: aHitsB && bDeflectorLane === null ? atkA : 0,
                  directToSelf: bHitsA && aDeflectorLane === null ? atkB : 0,
                });
              } catch {
                /* télémétrie fail-soft — jamais bloquer la résolution */
              }
            }
            // Alex feedback 2026-06-09 "résolution complète des 3 lanes" : NE
            // PLUS early-exit sur match-end interim. On résout les 3 lanes
            // pour permettre l'égalité (a≤0 ET b≤0). Verdict final calculé
            // après les 3 lanes (endOfTurnCleanup + draw check ci-dessous).
            // NOTE : le VRAI "but d'or" = mort subite RPSLS quand égalité
            // absolue (HP+ATK identiques) — Lot H futur, pas implémenté ici.
            if (laneIdx < 2) {
              window.setTimeout(() => {
                setCombatLane(null);
                window.setTimeout(() => runLane((laneIdx + 1) as 0 | 1 | 2), 50);
              }, LANE_PAUSE_MS);
            } else {
              window.setTimeout(() => setCombatLane(null), LANE_PAUSE_MS);
            }
          }, LANE_CHARGE_MS);
        };
        runLane(0);

        // After all 3 lanes — cleanup + HP check + draw detection.
        const TOTAL_COMBAT_MS = LANE_CHARGE_MS * 3 + LANE_PAUSE_MS * 2 + 200;
        window.setTimeout(() => {
          if (aborted) return;
          b = endOfTurnCleanup(b);
          const prePhase = b.phase; // phase de jeu AVANT tout flip match-end (pour l'écran d'attente du coup fatal)
          if (b.a.hp <= 0 && b.b.hp <= 0) {
            // Round 10 VRAI BUT D'OR : égalité parfaite → phase sudden-death
            // (Mort subite RPSLS) au lieu de match-end direct. ArenaGame
            // détecte cette phase et affiche le component ArenaSuddenDeath.
            alog("turn", `MATCH END — ÉGALITÉ (a.hp=${b.a.hp}, b.hp=${b.b.hp}) → 🌟 BUT D'OR / Mort subite RPSLS`);
            b = { ...b, phase: "sudden-death" };
            setBoard(b);
            // Pas de onMatchEnd ici — le sudden-death component va le triggerer
            // après résolution. Délai 1.6s pour laisser respirer la transition.
            return;
          }
          if (b.a.hp <= 0 || b.b.hp <= 0) {
            b = { ...b, phase: "match-end" };
          } else if (b.turn >= TURN_HARD_CAP) {
            // Fail-safe documenté (arenaTypes.TURN_HARD_CAP) mais jamais câblé
            // jusqu'ici : un match trop défensif doit FINIR. Au tour 30 résolu,
            // le héros au HP le plus bas perd (HP forcé à 0 pour que MatchEnd
            // et recordArenaMatch lisent le verdict normalement). HP égaux →
            // BUT D'OR, même chemin que l'égalité parfaite.
            if (b.a.hp === b.b.hp) {
              alog("turn", `HARD CAP T${b.turn} — HP égaux (${b.a.hp}) → 🌟 BUT D'OR / Mort subite RPSLS`);
              b = { ...b, phase: "sudden-death" };
              setBoard(b);
              return;
            }
            const aLoses = b.a.hp < b.b.hp;
            alog("turn", `HARD CAP T${b.turn} — ${aLoses ? "a" : "b"} perd (HP ${b.a.hp} vs ${b.b.hp})`);
            b = aLoses
              ? { ...b, a: { ...b.a, hp: 0 }, phase: "match-end" }
              : { ...b, b: { ...b.b, hp: 0 }, phase: "match-end" };
          }
          const aDead = b.a.hp <= 0;
          const bDead = b.b.hp <= 0;
          if ((aDead || bDead) && onMatchEnd) {
            // Alex 2026-06-12 "trop brusque" : on AFFICHE D'ABORD le board final
            // (coup fatal + HP à 0) pendant VICTORY_REVEAL_MS — écran de fin
            // SUSPENDU (on rend le board avec sa phase de jeu, pas match-end) —
            // PUIS on bascule l'écran victoire/défaite. La closure `b` a déjà
            // phase="match-end" → les gardes settle/onAdvanceTurn bloquent bien
            // (pas de reprise de partie). resolving reste true (onMatchEnd
            // différé) → pas de picker pendant la révélation.
            setBoard({ ...b, phase: prePhase });
            window.setTimeout(() => {
              if (aborted) return;
              setBoard(b); // phase match-end → ArenaMatchEnd s'affiche enfin
              const playerWon = bDead && !aDead;
              onMatchEnd(playerWon);
            }, VICTORY_REVEAL_MS);
          } else {
            setBoard(b);
          }
        }, TOTAL_COMBAT_MS);

        // ─── Step 4: SETTLE ───
        window.setTimeout(() => {
          if (aborted) return;
          setResolveStep("settle");
          onSettle(b);
          window.setTimeout(() => {
            if (aborted) return;
            setResolveStep(null);
            // 🔴 Le garde DOIT couvrir sudden-death : sans ça, onAdvanceTurn
            // repassait le board en "planning" ~3s après le déclenchement du
            // BUT D'OR (les timers settle continuent de courir) → la mort
            // subite était ANNULÉE et le match reprenait comme si de rien.
            if (b.phase === "match-end" || b.phase === "sudden-death") return;
            onAdvanceTurn();
          }, SETTLE_MS);
        }, COMBAT_MS);
      }, SUMMONS_MS);
    }, spellsPhaseMs);
  }, REVEAL_MS);

  return () => { aborted = true; };
}
