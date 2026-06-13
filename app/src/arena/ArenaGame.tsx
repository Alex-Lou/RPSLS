/**
 * ArenaGame — top-level orchestrator for Constellation Pro vs CPU.
 *
 * Owns: the BoardState (one source of truth for both heroes, lanes,
 * creatures, mana, turn number) and the PLAYER's pending TurnIntent
 * (spells they've queued, summons they've planned).
 *
 * Turn loop:
 *   planning → lock → CPU decides its intent → resolveTurn fires →
 *   advanceToNextTurn (mana up, draw cards) → planning … until a hero
 *   hits 0 HP, which flips the phase to match-end.
 *
 * The board is the single source of truth — every UI piece reads from
 * it and never mutates anything outside. All transitions go through
 * arenaRules pure functions, so the resolver is unit-testable.
 */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  hapticLock, hapticMatchStart, hapticMatchWin, hapticMatchLoss,
  hapticTap, hapticWin, hapticLoss,
} from "../haptic";
import { useStore } from "../store/store";
import { CARDS } from "../ranked/cards";
import { useT } from "../i18n";
import type { CardId } from "../ranked/rankedTypes";
import type { Move } from "../engine/game";
import {
  FloatingMatchBackButton, useAndroidBackPrompt,
  type MatchBackHandle,
} from "../match/sharedMatchUI";
import { ArenaBoard } from "./ArenaBoard";
import { ArenaDebugOverlay } from "./ArenaDebugOverlay";
import { ArenaMatchEnd } from "./ArenaMatchEnd";
import { ArenaMatchSplash } from "./ArenaMatchSplash";
import { AnimatePresence, motion, useAnimationControls } from "motion/react";
import { ArenaImpactFX } from "./ArenaImpactFX";
import { ArenaCastOnDrawFX, useCastOnDrawQueue } from "./ArenaCastOnDrawFX";
import { ArenaHeistAnim } from "./ArenaHeistAnim";
import { ArenaPlanPhase } from "./ArenaPlanPhase";
import { ArenaSuddenDeath } from "./ArenaSuddenDeath";
import { arenaLogReset, alog } from "./arenaLog";
import { advanceToNextTurn, makeInitialBoard, truncateIntentByCaps, mulliganSwap, mulliganReplaceInPlace } from "./arenaRules";
import { ArenaMulligan } from "./ArenaMulligan";
import { findFusionResult } from "./arenaFusionCards";
import { cpuArenaDecision } from "./arenaAI";
import {
  CPU_PERSONAS,
  HERO_MAX_HP,
  MAX_SPELLS_PER_TURN,
  UTILITY_SPELLS_PER_TURN,
  intentManaGrant,
  type HeroState,
  type ArenaTargeting,
  type BoardState,
  type LaneIndex,
  type PlayedSpell,
  type PlannedSummon,
  type TurnIntent,
} from "./arenaTypes";
import { isFinisherCard } from "./arenaFinishers";
import { setMatchExit } from "../matchExitStore";
import { buildCpuDeckMirroring, buildPlayerDeck, removeSpentCardsDetailed } from "./arenaDecks";
import { arenaSpellCost } from "./arenaSpellHelpers";
import { runResolverFlow, type ResolveStep } from "./arenaResolverFlow";

// Alex feedback 2026-06-09 point #7 : décompte+GO trop rapide. Bumpé de
// 1800 → 2600ms pour laisser le "GO!" durer un peu et faire monter le
// suspense (anim splash interne dure ~1.35s + 0.45s = ~1.8s, on garde
// 800ms de plus sur "GO!" final).
const MATCH_FOUND_SPLASH_MS = 2_600;

/**
 * BoardFillSlot — règle DÉFINITIVEMENT le dimensionnement du pad sur le WebView.
 *
 * Le WebView Android ne résout PAS de façon fiable une chaîne `flex-1` profonde
 * (le pad restait court → lanes coupées / vide en bas) alors que ça marche en
 * preview desktop. MAIS `clientHeight` (mesure post-layout) EST fiable — c'est
 * ce que fait ScaleToFit. Donc : on MESURE la hauteur dispo du slot et on la
 * passe à l'enfant, qui se la pose en hauteur EXPLICITE (px). Une hauteur px
 * explicite résout les `flex-1` enfants de façon 100 % fiable → le pad remplit
 * la place SANS scaler les cartes (≠ ScaleToFit qui, lui, rétrécissait tout, y
 * compris la main). La main reste DEHORS du slot → jamais rétrécie.
 */
function BoardFillSlot({ children }: { children: (h: number) => ReactNode }) {
  const slotRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [availH, setAvailH] = useState(0);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;
    const measure = () => {
      const ah = slot.clientHeight;
      setAvailH(ah);
      // Le board reçoit minHeight=ah → il REMPLIT quand le contenu rentre
      // (espace en trop → centre du pad). S'il dépasse (écran trop court), on
      // réduit UNIQUEMENT à ce moment (jamais de coupe) — sinon scale 1 et les
      // cartes gardent leur taille exacte (cas du tel d'Alex).
      const nh = innerRef.current ? innerRef.current.scrollHeight : 0;
      setScale(ah > 0 && nh > ah + 1 ? Math.max(0.5, ah / nh) : 1);
    };
    measure();
    // rAF re-measure : le board monte derrière le splash, la 1ʳᵉ passe peut
    // précéder le layout final.
    const raf = requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(slot);
    if (innerRef.current) ro.observe(innerRef.current);
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, []);
  return (
    <div ref={slotRef} className="flex-1 min-h-0 w-full flex flex-col items-center justify-center overflow-hidden">
      <div
        ref={innerRef}
        className="w-full flex flex-col items-center"
        style={{ transform: scale !== 1 ? `scale(${scale})` : undefined }}
      >
        {children(availH)}
      </div>
    </div>
  );
}

/** Étiquettes d'effets BINAIRES (on/off, non cumulables) par carte — sert au
 *  garde anti-redondance d'addSpell (Alex 2026-06-13). Une carte qui re-pose
 *  un tag déjà couvert par une autre carte planifiée sur la même lane est
 *  refusée (ex. Bastion ⊃ bouclier+ancre → bloque Aegis & Anchor). Les buffs
 *  ADDITIFS (Précision/Surge +ATK) ne sont PAS listés ici : ils s'empilent. */
const BINARY_EFFECT_TAGS: Partial<Record<CardId, string[]>> = {
  aegis:           ["shield"],
  anchor:          ["anchor"],
  riposte:         ["riposte"],
  bastion:         ["shield", "anchor"], // fusion Aegis+Anchor
  "toile-gluante": ["noattack"],
  cocon:           ["noattack"],         // fusion Toile+Curse (le -ATK de Curse, lui, s'empile)
};

export function ArenaGame({
  onQuit, onRematch, oppName, oppAvatar,
}: {
  onQuit: () => void;
  /** Called when the player taps "Rejouer" on the match-end screen.
   *  Bubbled up so ArenaPage can route back to the prep screen (fresh
   *  coin flip → fresh theme/pad for the new match). */
  onRematch?: () => void;
  /** Identité cosmétique CPU (depuis le prep) — affichée sur le strip adverse
   *  en match : nom réel + portrait hero_*.png, plus de « CPU » + 🤖. */
  oppName?: string;
  oppAvatar?: string;
}) {
  const player = useStore((s) => s.player);
  const difficulty = player.difficulty ?? "normal";
  const recordArenaMatch = useStore((s) => s.recordArenaMatch);

  // Player deck — filter out cards we haven't adapted to Arena yet so the
  // hand never contains a no-op card. Falls back to a curated default if
  // the saved deck has too few supported cards. Saved deck is `string[]` in
  // the store; we re-narrow to CardId by filtering against the registry.
  const playerDeck = useRef<CardId[]>(buildPlayerDeck(
    // Deck Pro SÉPARÉ (arenaDeck, 8 cartes) — fallback rankedDeck pour les
    // joueurs sans arenaDeck encore (migration douce). Alex 2026-06-13.
    (player.arenaDeck ?? player.rankedDeck ?? []).filter(
      (id): id is CardId => Object.prototype.hasOwnProperty.call(CARDS, id),
    ),
  ));
  // Constellation Pro v2 Couche 1 — Affinité du joueur passée au moteur.
  // Le CPU prend une Affinité ALÉATOIRE à chaque match pour la symétrie
  // (Constellation 3⭐ s'allume aussi côté opp) — pas d'adaptive selon
  // le joueur pour garder une part d'imprévisibilité.
  const playerAffinity = useRef(player.arenaAffinity);
  const cpuAffinity = useRef<Move>(
    (["rock", "paper", "scissors", "lizard", "spock"] as const)[Math.floor(Math.random() * 5)],
  );
  // Persona CPU random au match start (Alex 2026-06-11). Reste constante tout
  // le match pour que le feeling de l'opp soit cohérent.
  const cpuPersona = useRef(CPU_PERSONAS[Math.floor(Math.random() * CPU_PERSONAS.length)]);

  // Wipe the log buffer at match start so each match has a clean diagnostic
  // history (Alex flag : "tu pers tout finalement"). Called once at mount.
  const logResetRef = useRef(false);
  if (!logResetRef.current) {
    arenaLogReset();
    logResetRef.current = true;
  }

  const t = useT();
  // Nom "vulgarisé" d'une carte pour les logs (Alex 2026-06-12 : "détails
  // vulgarisés pour dire pourquoi xxx ne peut pas faire yyy"). Retombe sur
  // l'id si la clé i18n manque.
  const cardFr = (id: CardId) => t(CARDS[id]?.nameKey ?? "") || id;

  const [board, setBoard] = useState<BoardState>(() =>
    makeInitialBoard(playerDeck.current, buildCpuDeckMirroring(playerDeck.current), playerAffinity.current, cpuAffinity.current, cpuPersona.current),
  );

  // ── MULLIGAN T1 (Alex 2026-06-13 économie expert) ──
  // Une fois par match : remplace jusqu'à 2 cartes de la main de départ.
  // Le CPU mulligan EN MÊME TEMPS (heuristique : il rend ses cartes chères
  // surnuméraires) pour l'équité. "Garder tout" laisse aussi le CPU décider.
  const [mulliganOpen, setMulliganOpen] = useState(true);
  // Échanges restants (départ 2). Modèle IMMÉDIAT : chaque rejet remplace EN
  // PLACE (cf. ArenaMulligan) → plus de sélection multi-index.
  const [mulliganSwapsLeft, setMulliganSwapsLeft] = useState(2);
  function cpuMulliganIndices(h: HeroState): number[] {
    // Garde 1 carte chère max en ouverture ; rend les suivantes (≤2).
    const idx: number[] = [];
    let expensive = 0;
    h.hand.forEach((c, i) => {
      if ((CARDS[c]?.cost ?? 0) >= 3) {
        expensive += 1;
        if (expensive > 1 && idx.length < 2) idx.push(i);
      }
    });
    return idx;
  }
  // ── ⚗️ FORGE (2026-06-13) — dépôt gratuit / fusion / reprise, au TAP de
  // la case Forge (centre-droite du pad). Aucun tour perdu, aucun mana au
  // dépôt : le coût se paie au cast de la carte fusionnée. ──
  const [forgeFlash, setForgeFlash] = useState<number | null>(null);
  // Helper PARTAGÉ (DRY) : dépose `id` sur la forge si vide, OU fusionne avec
  // la carte présente si une recette existe. Retire la carte de la MAIN.
  // Utilisé par le tap forge (carte armée) ET par le bouton ⚗ de la fiche
  // (carte explicite). Une seule source de vérité pour la mécanique.
  function depositOrFuse(id: CardId) {
    const forge = board.forgeA ?? null;
    if (!forge) {
      setBoard((cur) => {
        const i = cur.a.hand.indexOf(id);
        if (i < 0) return cur;
        const hand = [...cur.a.hand.slice(0, i), ...cur.a.hand.slice(i + 1)];
        alog("hand", `a FORGE dépôt : ${id}`);
        return { ...cur, a: { ...cur.a, hand }, forgeA: id };
      });
      hapticTap();
      return;
    }
    const result = findFusionResult(id, forge);
    if (result) {
      // La carte fusionnée RESTE sur la forge (Alex 2026-06-13) — le joueur la
      // RÉCUPÈRE au tap (« ✨ Récupérer »). S'il la laisse, elle reste exposée
      // → une carte « Pillage » adverse peut la voler. Risque/récompense.
      setBoard((cur) => {
        const i = cur.a.hand.indexOf(id);
        if (i < 0) return cur;
        const hand = [...cur.a.hand.slice(0, i), ...cur.a.hand.slice(i + 1)];
        alog("hand", `a FUSION ⚗️ : ${forge} + ${id} = ${result} (reste sur la forge → à récupérer)`);
        return { ...cur, a: { ...cur.a, hand }, forgeA: result };
      });
      setForgeFlash(Date.now());
      hapticTap();
      return;
    }
    alog("hand", `🚫 « ${cardFr(id)} » ne fusionne pas avec « ${cardFr(forge)} » — voir Règles ⚗️.`);
  }

  // Tap sur la forge : dépôt/fusion de la carte ARMÉE, sinon REPRISE.
  function handleForgeTap() {
    if (resolving) return;
    if (targeting?.kind === "spell") {
      depositOrFuse(targeting.id);
      setTargeting(null);
      return;
    }
    const forge = board.forgeA ?? null;
    if (forge) {
      // REPRISE — la carte revient en main (aucune sélection active).
      setBoard((cur) => ({ ...cur, a: { ...cur.a, hand: [...cur.a.hand, forge] }, forgeA: null }));
      alog("hand", `a FORGE reprise : ${forge}`);
      hapticTap();
    }
  }

  // Dépôt/fusion FIABLE d'une carte EXPLICITE (bouton ⚗ de la fiche) — marche
  // pour TOUT ciblage (les utilitaires qui s'auto-jouaient au tap passent
  // désormais par ici). Nettoie aussi un éventuel sort utilitaire déjà
  // planifié avec cette carte (anti double-dépense).
  function handleForgeDeposit(id: CardId) {
    if (resolving) return;
    setIntent((cur) => {
      const i = cur.spells.findIndex((s) => s.id === id && s.kind !== "lane");
      return i < 0 ? cur : { ...cur, spells: [...cur.spells.slice(0, i), ...cur.spells.slice(i + 1)] };
    });
    depositOrFuse(id);
    if (targeting?.kind === "spell" && targeting.id === id) setTargeting(null);
  }

  // Rejet IMMÉDIAT d'une carte → remplacée EN PLACE (le joueur voit la nouvelle
  // arriver). Décrémente les échanges restants.
  function handleMulliganReject(i: number) {
    if (mulliganSwapsLeft <= 0) return;
    setBoard((cur) => ({ ...cur, a: mulliganReplaceInPlace(cur.a, i) }));
    setMulliganSwapsLeft((n) => Math.max(0, n - 1));
    hapticTap();
  }
  // Fermeture (« C'est parti ! ») : le CPU mulligan UNE fois, puis on ferme.
  function handleMulliganClose() {
    setBoard((cur) => ({ ...cur, b: mulliganSwap(cur.b, cpuMulliganIndices(cur.b)) }));
    setMulliganOpen(false);
  }
  const [intent, setIntent] = useState<TurnIntent>({ spells: [], summons: [] });
  const [matchSplash, setMatchSplash] = useState(true);
  const [resolving, setResolving] = useState(false);
  // Signatures FX plein-board (Genèse, Supernova…). Purgé après l'anim par un
  // timer NETTOYÉ → aucune fuite (cf. demande Alex « zéro thread non achevée »).
  const [spellFX, setSpellFX] = useState<{ ids: CardId[]; key: number } | null>(null);
  useEffect(() => {
    if (!spellFX) return;
    const id = window.setTimeout(() => setSpellFX(null), 1500);
    return () => window.clearTimeout(id);
  }, [spellFX?.key]);
  // IMPACT FX plein-écran (coup puissant/fatal) + TREMBLEMENT de l'écran. Purgé
  // par timer nettoyé, shake one-shot via controls → leak-free.
  const [impactFX, setImpactFX] = useState<{ move: Move; power: "strong" | "fatal"; key: number } | null>(null);
  const screenShake = useAnimationControls();
  useEffect(() => {
    if (!impactFX) return;
    const fatal = impactFX.power === "fatal";
    const amp = fatal ? 11 : 6;
    // Secousse one-shot (pas de repeat) — séquence d'amplitude décroissante.
    screenShake.start({
      x: [0, -amp, amp, -amp * 0.7, amp * 0.5, -amp * 0.25, 0],
      y: [0, amp * 0.6, -amp * 0.5, amp * 0.4, -amp * 0.2, amp * 0.1, 0],
      transition: { duration: fatal ? 0.6 : 0.45, ease: "easeOut" },
    });
    const id = window.setTimeout(() => setImpactFX(null), 900);
    return () => window.clearTimeout(id);
  }, [impactFX?.key]);
  // ⚡ Cartes « à la pioche » (Cast When Drawn) — file d'événements lue à chaque
  // changement de tour, jouée une par une (hook co-localisé avec son FX).
  const castDraw = useCastOnDrawQueue(board);
  /** Opp intent preview: set after lock, cleared when the spells step fires.
   *  Drives the "Adversaire joue X / summon Y" banner + ghost previews on
   *  the opp lanes so the player SEES what they committed. */
  const [oppPreview, setOppPreview] = useState<TurnIntent | null>(null);
  /** Player intent preview: mirror of oppPreview for OUR side. Set when the
   *  resolver kicks off so the player can read what they themselves locked
   *  in. Cleared when the player starts a new turn. */
  const [playerPreview, setPlayerPreview] = useState<TurnIntent | null>(null);
  /** Current step in the sequenced resolver. Drives the phase banner. */
  const [resolveStep, setResolveStep] = useState<ResolveStep | null>(null);
  /** Active targeting (lifted from ArenaPlanPhase) — when set, tapping a
   *  lane on the BOARD itself commits the spell/summon. CCG-style
   *  direct manipulation instead of separate "Lane 1/2/3" buttons. */
  const [targeting, setTargeting] = useState<ArenaTargeting>(null);
  /** Which lane is CURRENTLY animating its combat exchange — drives the
   *  per-lane "charge → impact → retreat" animation on its creatures.
   *  Only ONE lane is "live" at a time so the player's eye lands on it. */
  const [combatLane, setCombatLane] = useState<LaneIndex | null>(null);
  /** Hero-hit pulse: set briefly when an undefended-lane attack lands on a
   *  hero. Drives the dramatic HP-bar flash on the hit hero strip. Keyed by
   *  side + lane so consecutive hits on the same hero re-trigger the anim. */
  const [heroHit, setHeroHit] = useState<{ side: "you" | "opp"; lane: LaneIndex; key: number } | null>(null);
  /** Taunt block: set when an undefended-lane attack is DEFLECTED by a
   *  taunt creature elsewhere. `rockLane` identifies the Pierre that ate
   *  the deflection so the UI can pull a dotted line to it. */
  const [tauntBlock, setTauntBlock] = useState<{ defenderSide: "a" | "b"; rockLane: LaneIndex; key: number } | null>(null);
  /** Anti-taunt bypass: set when an attack reaches a hero DESPITE the
   *  defender having a charged Pierre, because the attacker carries Étouffe
   *  (Feuille) or Logique (Spock) — both cancel Provocation. Pops a chip on
   *  the bypassed Pierre so the player SEES why it didn't defend (Alex's
   *  recurring "pourquoi MA Pierre ne défend pas ?"). */
  const [antiTaunt, setAntiTaunt] = useState<{ bypassedSide: "a" | "b"; rockLane: LaneIndex; cause: "paper" | "spock"; key: number } | null>(null);
  /** Anim Larcin (Heist) — pop quand un côté cast heist au step reveal-opp.
   *  Carte volée traverse l'écran en arc avec sillage doré, flip à l'arrivée. */
  const [heistAnim, setHeistAnim] = useState<{ caster: "you" | "opp"; stolen?: CardId; key: number } | null>(null);

  /** Imperative handle on the floating back button — lets the Android
   *  back-gesture trigger the SAME confirmation modal instead of just
   *  silently exiting the match. */
  const backRef = useRef<MatchBackHandle | null>(null);
  // Register le forfeit dans le matchExitStore (Alex 2026-06-11) — le drawer
  // burger l'affiche en TOP au lieu d'avoir 2 boutons HUD séparés. triggerConfirm
  // pop le même modal qu'avant.
  useEffect(() => {
    setMatchExit({
      label: "Quitter Arena",
      onExit: () => backRef.current?.triggerConfirm(),
    });
    return () => { setMatchExit(null); };
  }, []);

  // Match-end guard — also gates handleForfeit so we never double-record.
  // Declared BEFORE handleForfeit so the closure binds the real ref.
  const matchEndedRef = useRef(false);

  /** Forfeit handler: records a LOSS on arenaStats + bounces back out.
   *  Set `matchEndedRef` so the existing match-end useEffect doesn't
   *  also try to record an outcome (would double-count). */
  function handleForfeit() {
    if (matchEndedRef.current) { onQuit(); return; }
    matchEndedRef.current = true;
    hapticMatchLoss();
    recordArenaMatch("loss");
    onQuit();
  }

  /** Android system back: route through the SAME confirm modal so the
   *  player can't accidentally throw the match by swiping. During the
   *  match-end screen (board.phase === "match-end") we never reach this
   *  return path — the Match-End component owns its own back button. */
  useAndroidBackPrompt(() => {
    if (board.phase === "match-end" || matchSplash) { onQuit(); return; }
    backRef.current?.triggerConfirm();
  });

  /** Route a board-lane tap to the active targeting intent. Called by
   *  ArenaBoard when a lane slot is clicked while targeting is non-null.
   *  `side` is the row that was tapped — the board only forwards taps
   *  from rows where the spell's per-side validity is true, so we can
   *  trust it without re-validating here. */
  function handleBoardLaneTap(lane: LaneIndex, _side: "a" | "b") {
    if (!targeting) return;
    if (targeting.kind === "summon") {
      hapticTap();
      setIntent((cur) => ({
        ...cur,
        summons: [...cur.summons.filter((s) => s.lane !== lane), { lane, move: targeting.move }],
      }));
      setTargeting(null);
      return;
    }
    if (targeting.kind === "spell" && targeting.targetKind === "lane") {
      // Route through addSpell so the board lane-tap gets the SAME guards as
      // the hand flow: MAX_SPELLS cap, 1-card=1-cast (usageCount vs handCount),
      // aegis/anchor mutual exclusion, and the aegis 1×/match lock. Tapping a
      // lane used to setIntent directly, bypassing ALL of them — that's why the
      // same card (Aegis, Anchor) could be assigned twice (Alex). addSpell does
      // its own hapticTap and silently no-ops a rejected cast (card stays).
      addSpell({ id: targeting.id, kind: "lane", lane });
      setTargeting(null);
      return;
    }
  }

  useEffect(() => {
    // CRITICAL: run on EVERY matchSplash=true (not just mount) — the
    // rematch button sets matchSplash back to true, but the original
    // effect had [] deps so the timer never fired again → splash stuck.
    if (!matchSplash) return;
    hapticMatchStart();
    const id = window.setTimeout(() => setMatchSplash(false), MATCH_FOUND_SPLASH_MS);
    return () => window.clearTimeout(id);
  }, [matchSplash]);

  // Auto-clear the "🪨 ATTAQUE DÉTOURNÉE !" chip after it's had time to be
  // read. The resolver pops the chip but never clears it, so without this
  // it stays glued on screen forever (and survives across turns / into the
  // next planning phase). Each new pop (key change) restarts the timer,
  // so back-to-back deflects each get their full read window.
  useEffect(() => {
    if (!tauntBlock) return;
    const id = window.setTimeout(() => setTauntBlock(null), 1_600);
    return () => window.clearTimeout(id);
  }, [tauntBlock?.key]);

  // Auto-clear the anti-taunt chip after its read window (same pattern as
  // tauntBlock). Each new pop (key change) restarts the timer.
  useEffect(() => {
    if (!antiTaunt) return;
    const id = window.setTimeout(() => setAntiTaunt(null), 1_700);
    return () => window.clearTimeout(id);
  }, [antiTaunt?.key]);

  // Trigger anim Larcin — pop quand applyHeist a écrit un side-channel
  // (lastHeistStolenA/B). On watch ces fields ; quand ils changent, on
  // déclenche l'anim avec la VRAIE carte volée (sync exact effet ↔ visuel).
  useEffect(() => {
    if (board.lastHeistStolenA) {
      setHeistAnim({ caster: "you", stolen: board.lastHeistStolenA, key: Date.now() });
      const id = window.setTimeout(() => setHeistAnim(null), 2_000);
      return () => window.clearTimeout(id);
    }
  }, [board.lastHeistStolenA]);
  useEffect(() => {
    if (board.lastHeistStolenB) {
      setHeistAnim({ caster: "opp", stolen: board.lastHeistStolenB, key: Date.now() });
      const id = window.setTimeout(() => setHeistAnim(null), 2_000);
      return () => window.clearTimeout(id);
    }
  }, [board.lastHeistStolenB]);

  // Match-end haptic + stat record. Fired once when the phase flips.
  // recordArenaMatch lives in the store and is sync'd to the cloud via the
  // existing playerSync subscriber (fingerprint covers arenaStats now).
  // matchEndedRef is declared above (alongside handleForfeit) so a forfeit
  // can flip the same guard.
  useEffect(() => {
    if (board.phase !== "match-end") return;
    if (matchEndedRef.current) return;
    matchEndedRef.current = true;
    const aDead = board.a.hp <= 0;
    const bDead = board.b.hp <= 0;
    const outcome: "win" | "loss" | "draw" =
      aDead && bDead ? "draw" : bDead ? "win" : "loss";
    if (outcome === "win") hapticMatchWin();
    else if (outcome === "loss") hapticMatchLoss();
    recordArenaMatch(outcome);
  }, [board.phase, board.a.hp, board.b.hp, recordArenaMatch]);

  /* ──────────── Intent builders ──────────── */

  function addSpell(spell: PlayedSpell) {
    // Alex feedback F : limite MAX_SPELLS_PER_TURN sorts par tour pour
    // éviter les tours dump-tout. Si déjà au max, fizzle (haptic neutral).
    // Alex feedback : "pas permettre l'usage de la même carte deux fois
    // sur le même lane" → reject si même id ET même lane déjà dans intent.
    // Pour spells non-lane (self / hero / global), simple check sur id.
    hapticTap();
    setIntent((cur) => {
      // Cap MAX_SPELLS_PER_TURN sur les sorts LANE. Cap utility (hero/self/
      // global) RELEVÉ 1 → 2 (Alex 2026-06-11, watch live) : l'ancien cap 1
      // bloquait Supernova + Second Souffle le même tour (combo légitime, pas
      // du spam) sans aucun feedback en jeu. Le mana + le cap lane limitent
      // déjà le spam. 2 utilities/tour autorisés.
      const UTILITY_CAP = UTILITY_SPELLS_PER_TURN; // source unique partagée engine/UI
      const laneCount = cur.spells.filter((s) => s.kind === "lane").length;
      const utilityCount = cur.spells.filter((s) => s.kind !== "lane").length;
      // Logs de blocage (Alex 2026-06-11) : pour diagnostiquer "carte bloquée"
      // pendant une manche — on dit POURQUOI le cast est refusé.
      if (spell.kind === "lane" && laneCount >= MAX_SPELLS_PER_TURN) {
        alog("hand", `🚫 « ${cardFr(spell.id)} » impossible : déjà ${laneCount} sorts posés sur le terrain ce tour (max ${MAX_SPELLS_PER_TURN}). Retire un sort de lane pour le jouer.`);
        return cur;
      }
      if (spell.kind !== "lane" && utilityCount >= UTILITY_CAP) {
        alog("hand", `🚫 « ${cardFr(spell.id)} » impossible : déjà ${utilityCount} sorts sur toi/ton héros ce tour (max ${UTILITY_CAP}). Retire l'un d'eux pour le jouer.`);
        return cur;
      }
      // Alex feedback 2026-06-09 (round 4) : 1 carte en main = 1 cast max.
      // Avant le check duplicate refusait seulement (même id + même lane),
      // donc une seule copie en main pouvait être cast 2× sur 2 lanes
      // différentes (effet appliqué 2× mais 1 seule copie consommée par
      // removeSpentCards) — bug double-effect. Fix : compter les usages
      // de spell.id dans cur.spells et refuser si dépasse le nombre de
      // copies en main.
      const usageCount = cur.spells.filter((s) => s.id === spell.id).length;
      const handCount = board.a.hand.filter((id) => id === spell.id).length;
      if (usageCount >= handCount) {
        alog("hand", `🚫 « ${cardFr(spell.id)} » impossible : plus de copie dispo (1 carte = 1 usage ; ${usageCount} déjà planifié(s), ${handCount} en main).`);
        return cur;
      }
      // Check "duplicate même cible" LEVÉ (Alex 2026-06-13 CCG expert, "pas
      // de limites quand pas nécessaires") : 2 copies de Précision sur la
      // MÊME créature (+4 ATK) est un play CCG légitime. L'abus réel (caster
      // 2× une copie UNIQUE) est déjà bloqué par usageCount/handCount
      // ci-dessus. Un recast idempotent (2e Aegis sur créature déjà
      // bouclier) gâche le mana du joueur — son choix, pas celui du moteur.
      // Alex feedback 2026-06-11 : la mutual exclusion Aegis/Anchor même lane
      // est LEVÉE — empiler les deux défenses sur la même créature est
      // explicitement autorisé. Le check duplicate (même id + même lane)
      // au-dessus suffit pour bloquer le double cast d'une même carte.
      // Finisher = lock 1×/match (cf hero.finisherUsed). Une fois cast il
      // peut être ré-injecté en main (Juge reshuffle, Genèse, etc.) — le
      // garde ici empêche de le rejouer.
      if (isFinisherCard(spell.id) && board.a.finisherUsed) {
        alog("hand", `🚫 « ${cardFr(spell.id)} » impossible : ton Finisher a déjà été lancé ce match (1 seul par partie).`);
        return cur;
      }
      // REDONDANCE d'effet binaire sur une même lane (Alex 2026-06-13 : "si
      // déjà Bastion, pas pouvoir ajouter Aegis/Anchor — sinon cheaté"). Les
      // effets BINAIRES (bouclier / ancre / ne-peut-pas-attaquer) ne se
      // cumulent pas : une carte qui re-applique un effet déjà couvert par une
      // autre planifiée sur la MÊME lane est refusée. (Les buffs ADDITIFS
      // comme Précision/Surge ne sont PAS concernés — ils s'empilent.)
      if (spell.kind === "lane") {
        const newTags = BINARY_EFFECT_TAGS[spell.id] ?? [];
        if (newTags.length > 0) {
          const conflict = cur.spells.find(
            (s) => s.kind === "lane" && s.lane === spell.lane &&
              (BINARY_EFFECT_TAGS[s.id] ?? []).some((tg) => newTags.includes(tg)),
          );
          if (conflict) {
            alog("hand", `🚫 « ${cardFr(spell.id)} » impossible : « ${cardFr(conflict.id)} » couvre déjà cet effet sur cette lane (redondant).`);
            return cur;
          }
        }
      }
      return { ...cur, spells: [...cur.spells, spell] };
    });
  }

  function removeSpell(idx: number) {
    setIntent((cur) => ({
      ...cur,
      spells: cur.spells.filter((_, i) => i !== idx),
    }));
  }

  function addSummon(summon: PlannedSummon) {
    // Replace any existing summon on the same lane (one summon per lane per
    // turn, by design — see arenaRules.applySummons).
    hapticTap();
    setIntent((cur) => ({
      ...cur,
      summons: [...cur.summons.filter((s) => s.lane !== summon.lane), summon],
    }));
  }

  function removeSummon(lane: LaneIndex) {
    setIntent((cur) => ({ ...cur, summons: cur.summons.filter((s) => s.lane !== lane) }));
  }

  /** Total mana cost of the player's pending intent — used by the plan UI
   *  to grey out cards that would overflow. Coût via arenaSpellCost pour que
   *  le discount du Finisher CALCUL (−1m) soit réellement DÉPENSABLE — avant,
   *  l'UI bloquait au coût plein et le Finisher Spock ne servait à rien. */
  function intentCost(i: TurnIntent): number {
    let total = i.summons.length * 1; // 1m per summon
    for (const s of i.spells) total += arenaSpellCost(board.a, s.id);
    return total;
  }

  /* ──────────── Lock & resolve ──────────── */

  function handleLockTurn() {
    if (resolving) return;
    if (board.phase !== "planning") return;
    if (intentCost(intent) > board.a.mana + intentManaGrant(intent)) return;
    hapticLock();
    setResolving(true);

    const cpuIntent = cpuArenaDecision(board, "b", difficulty);
    // Pre-clean hands so spell cards leave hand BEFORE the spells step shows.
    // Les cartes jouées vont à la DÉFAUSSE (Alex 2026-06-11) → drawCards les
    // reshuffle quand le deck se vide → le deck cycle, plus de pénurie sèche.
    // Tronquer AUX CAPS avant de retirer les cartes (Alex 2026-06-12 :
    // "applications noyées / mélangées"). Bug racine : on retirait de la main
    // TOUTES les cartes de l'intent, mais la résolution tronquait au cap →
    // une carte au-delà du cap quittait la main SANS effet = carte brûlée
    // (vu en live : consumed=[oracle,second-wind] mais "truncated to 1").
    // En tronquant AVANT, on retire EXACTEMENT ce qui sera appliqué :
    // consommé == appliqué, invariant garanti. (cpuIntent est déjà tronqué
    // par l'IA ; re-tronquer est idempotent.)
    const safeIntent = truncateIntentByCaps(intent);
    const safeCpuIntent = truncateIntentByCaps(cpuIntent);
    const aSpent = removeSpentCardsDetailed(board.a.hand, safeIntent);
    const bSpent = removeSpentCardsDetailed(board.b.hand, safeCpuIntent);
    // ÉCONOMIE expert (Alex 2026-06-13) : les LÉGENDAIRES jouées sont EXILÉES
    // (jamais reshufflées → 1 usage/partie, elles redeviennent des MOMENTS).
    // Le reste recycle via la défausse comme avant. L'exil sanctionne le CAST
    // — une légendaire défaussée sans être jouée (Juge) recycle normalement.
    const splitSpent = (spent: CardId[]) => ({
      toDiscard: spent.filter((c) => CARDS[c]?.rarity !== "legendary"),
      toExile: spent.filter((c) => CARDS[c]?.rarity === "legendary"),
    });
    const aSplit = splitSpent(aSpent.spent);
    const bSplit = splitSpent(bSpent.spent);
    if (aSplit.toExile.length > 0) alog("hand", `a EXIL légendaire : [${aSplit.toExile.join(",")}] (1 usage par partie)`);
    if (bSplit.toExile.length > 0) alog("hand", `b EXIL légendaire : [${bSplit.toExile.join(",")}] (1 usage par partie)`);
    const startBoard: BoardState = {
      ...board,
      a: { ...board.a, hand: aSpent.hand, discard: [...board.a.discard, ...aSplit.toDiscard], exiled: [...board.a.exiled, ...aSplit.toExile] },
      b: { ...board.b, hand: bSpent.hand, discard: [...board.b.discard, ...bSplit.toDiscard], exiled: [...board.b.exiled, ...bSplit.toExile] },
    };

    runResolverFlow({
      startBoard,
      playerIntent: safeIntent,
      cpuIntent: safeCpuIntent,
      setBoard,
      setOppPreview,
      setPlayerPreview,
      setResolveStep,
      setCombatLane,
      setHeroHit,
      setTauntBlock,
      setAntiTaunt,
      setSpellFX,
      setImpactFX,
      onSettle: () => setIntent({ spells: [], summons: [] }),
      onAdvanceTurn: () => {
        setResolving(false);
        setBoard((cur) => advanceToNextTurn(cur));
      },
      onMatchEnd: (winnerIsPlayer) => {
        setResolving(false);
        if (winnerIsPlayer) hapticWin(); else hapticLoss();
      },
    });
  }

  /* ──────────── Render ──────────── */

  if (matchSplash) {
    return <ArenaMatchSplash playerName={player.nickname || "Toi"} playerAvatar={player.avatar} cpuName={oppName} cpuAvatar={oppAvatar} />;
  }

  if (board.phase === "sudden-death") {
    // Round 10 VRAI BUT D'OR — Mort subite RPSLS. Le component gère le picker
    // + reveal + counter check. Quand résolu, assigne 1 HP au winner et flip
    // la phase à match-end pour que ArenaMatchEnd affiche le résultat propre.
    return (
      <ArenaSuddenDeath
        onResolved={(winner) => {
          const nextBoard: BoardState = winner === "a"
            ? { ...board, a: { ...board.a, hp: 1 }, b: { ...board.b, hp: 0 }, phase: "match-end" }
            : { ...board, a: { ...board.a, hp: 0 }, b: { ...board.b, hp: 1 }, phase: "match-end" };
          setBoard(nextBoard);
          if (winner === "a") hapticMatchWin(); else hapticMatchLoss();
        }}
      />
    );
  }

  if (board.phase === "match-end") {
    return (
      <ArenaMatchEnd
        board={board}
        onQuit={onQuit}
        onRematch={() => {
          // Bubble up to ArenaPage so a FRESH coin flip + new theme + new
          // CPU persona is picked for the rematch (Alex: "rematch doit refaire
          // le coin pour éventuellement changer de thème"). If no parent
          // handler, fall back to a local soft-reset.
          if (onRematch) { onRematch(); return; }
          matchEndedRef.current = false;
          setMulliganOpen(true);
          setMulliganSwapsLeft(2);
          setBoard(makeInitialBoard(playerDeck.current, buildCpuDeckMirroring(playerDeck.current), playerAffinity.current, cpuAffinity.current, cpuPersona.current));
          setIntent({ spells: [], summons: [] });
          setOppPreview(null);
          setPlayerPreview(null);
          setResolveStep(null);
          setResolving(false);
          setCombatLane(null);
          setHeroHit(null);
          setTargeting(null);
          setMatchSplash(true);
        }}
      />
    );
  }

  return (
    <motion.div animate={screenShake} className="relative flex-1 flex flex-col min-h-0 gap-1">
      {/* 💥 IMPACT FX plein-écran (coup puissant/fatal) — entaille Ciseaux,
       *  ébranlement Pierre… + tremblement de cette racine (Alex 2026-06-13). */}
      <ArenaImpactFX fx={impactFX} />
      {/* ⚡ Cartes « à la pioche » (Cast When Drawn) — éclair + carte + effet,
       *  jouées une par une (Alex 2026-06-13). One-shot, démonte via onDone. */}
      <AnimatePresence>
        {castDraw.head && (
          <ArenaCastOnDrawFX key={castDraw.head.key} event={castDraw.head} onDone={castDraw.shift} />
        )}
      </AnimatePresence>
      {/* Floating back / forfeit — same component every other match surface
       *  uses (Classic, Ranked, Lanes). The confirm modal pops first; on
       *  confirm we record a LOSS on arenaStats and bounce out. Hidden on
       *  match-end (the end screen owns its own back button). */}
      {/* Hidden mode : le bouton standalone n'est PLUS rendu, mais le composant
       *  garde son imperative handle (triggerConfirm) et le confirm modal. Le
       *  drawer burger expose la sortie via matchExitStore (Alex 2026-06-11
       *  "DANS le burger, pas 2 boutons HUD"). */}
      <FloatingMatchBackButton
        ref={backRef}
        onClick={handleForfeit}
        label="Quitter le match"
        hidden
        confirm={{
          title: "Abandonner le match ?",
          body: "C'est compté comme une défaite dans tes stats Constellation Pro. Tu peux toujours rejouer juste après.",
          confirmLabel: "Forfait",
          cancelLabel: "Continuer",
          severity: "danger",
        }}
      />
      {/* Round 16 : DEUX exigences Alex — (1) moves/deck PAS rétrécis → la plan
       *  phase est DEHORS du slot mesuré (jamais scalée). (2) CADRE du pad plus
       *  haut, cartes INCHANGÉES, espace au centre → BoardFillSlot mesure la
       *  hauteur dispo et la pose en px sur le board ; le pad `flex-1` la
       *  remplit (fiable car parent à hauteur EXPLICITE, pas flex profond),
       *  lanes écartées haut/bas (`justify-between`), centre vide (chip queues). */}
      <BoardFillSlot>
        {(slotH) => (
          <ArenaBoard
            fillHeight={slotH}
            board={board}
            playerSide="a"
            intent={intent}
            oppPreview={oppPreview}
            playerPreview={playerPreview}
            resolveStep={resolveStep}
            combatLane={combatLane}
            heroHit={heroHit}
            tauntBlock={tauntBlock}
            antiTaunt={antiTaunt}
            spellFX={spellFX}
            oppName={oppName}
            oppAvatar={oppAvatar}
            targeting={targeting}
            onLaneTap={handleBoardLaneTap}
            onRemoveSpell={removeSpell}
            onRemoveSummon={removeSummon}
            forgeYou={board.forgeA ?? null}
            forgeOpp={board.forgeB ?? null}
            onForgeTap={handleForgeTap}
            forgeFlashKey={forgeFlash}
            forgeHighlight={
              targeting?.kind === "spell"
                ? board.forgeA
                  ? (findFusionResult(targeting.id, board.forgeA) ? "fuse" : null)
                  : "deposit"
                : null
            }
          />
        )}
      </BoardFillSlot>
      <ArenaPlanPhase
        board={board}
        intent={intent}
        intentCost={intentCost(intent)}
        disabled={resolving}
        targeting={targeting}
        onSetTargeting={setTargeting}
        onAddSpell={addSpell}
        onRemoveSpell={removeSpell}
        onAddSummon={addSummon}
        onRemoveSummon={removeSummon}
        onLock={handleLockTurn}
        onForgeTap={handleForgeTap}
        onForgeDeposit={handleForgeDeposit}
        incomingAttackKey={heroHit?.side === "you" ? heroHit.key : null}
        playerName={player.nickname || "Toi"}
        playerAvatar={player.avatar}
      />
      {/* ── MULLIGAN T1 — modale extraite (ArenaMulligan) : empilage des
       *  doublons + remplacement IMMÉDIAT en place (Alex 2026-06-13). ── */}
      <AnimatePresence>
        {mulliganOpen && board.turn === 1 && !resolving && (
          <ArenaMulligan
            hand={board.a.hand}
            swapsLeft={mulliganSwapsLeft}
            onRejectOne={handleMulliganReject}
            onClose={handleMulliganClose}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {heistAnim && (
          <ArenaHeistAnim
            key={heistAnim.key}
            caster={heistAnim.caster}
            stolen={heistAnim.stolen}
            animKey={heistAnim.key}
          />
        )}
      </AnimatePresence>
      {/* FLASH ÉCRAN dégâts héros (Alex 2026-06-11) — vignette bord d'écran qui
       *  pulse quand un héros prend un coup : ROUGE = TOI qui prends, DORÉ = tu
       *  infliges. Très "Hearthstone", rend la perte de PV palpable. Ne fire
       *  que sur dégât réel (heroHit n'est posé que si dmg > 0). */}
      <AnimatePresence>
        {heroHit && (
          <motion.div
            key={`hitflash-${heroHit.key}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: heroHit.side === "you" ? [0, 0.9, 0] : [0, 0.45, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.65, times: [0, 0.18, 1], ease: "easeOut" }}
            className="fixed inset-0 z-[70] pointer-events-none"
            style={{
              background: heroHit.side === "you"
                ? "radial-gradient(ellipse 120% 90% at center, transparent 42%, rgba(244,63,94,0.6) 100%)"
                : "radial-gradient(ellipse 120% 90% at center, transparent 55%, rgba(252,211,77,0.4) 100%)",
            }}
          />
        )}
      </AnimatePresence>
      {/* Debug log overlay — floating 🐛 button + bottom-sheet panel
       *  that shows live arena events. Replaces adb logcat (which
       *  dropped lines under load) with an in-app live feed. */}
      <ArenaDebugOverlay />
    </motion.div>
  );
}

// Deck construction + spent-card cleanup live in arenaDecks.ts now.

// Re-export HERO_MAX_HP for callers that need the win-condition constant.
export { HERO_MAX_HP };
