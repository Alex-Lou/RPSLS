/**
 * arenaRecap — recap de FIN DE TOUR (Pro, vs-CPU ET online).
 *
 * Alex 2026-07 : garder l'« esprit » du feedback entre les manches — de petites
 * phrases de résultat + des micro-stats affichées quelques instants en bas du
 * pad avant le tour suivant, avec de la VARIÉTÉ (touche physique / scientifique /
 * drôle / sérieuse selon le contexte). Partie PURE : on lit le delta board AVANT
 * → APRÈS résolution (du point de vue du joueur local, `mySide`) et on en tire
 * une catégorie → une accroche piochée dans un pool + quelques chips.
 *
 * PUR (aucun React, aucun aléa) : le pick d'accroche est DÉTERMINISTE (hash de
 * `key`) → varie de tour en tour mais reste testable. Ne s'affiche PAS au coup
 * fatal (match-end/mort subite gèrent leur propre écran).
 */
import { engineGauge } from "./arenaEngines";
import { tNow } from "../i18n/core";
import type { Move } from "../engine/game";
import type { BoardState, Side } from "./arenaTypes";

export type RecapTone = "good" | "bad" | "neutral";

export interface RecapChip {
  label: string;
  tone: "good" | "bad" | "engine";
}

export interface TurnRecap {
  headline: string;
  tone: RecapTone;
  chips: RecapChip[];
  key: number;
}

/* ── Pools d'accroches (mix physique/scientifique/drôle/sérieux) ── */

const keys = (prefix: string, n: number): string[] => Array.from({ length: n }, (_, i) => `arena.recap.${prefix}.${i}`);
const DEVASTATING = keys("devastating", 5);
const OFFENSIVE = keys("offensive", 5);
const EXCHANGE = keys("exchange", 5);
const HEAVY_TAKEN = keys("heavyTaken", 4);
const TAKEN = keys("taken", 4);
const HEAL = keys("heal", 4);
const NEUTRAL = keys("neutral", 5);

/** Accroches TEINTÉES PAR VOIE quand la jauge monte (payoff d'identité). */
const VOIE_LINES: Record<Move, string[]> = {
  rock:     keys("voie.rock", 3),
  paper:    keys("voie.paper", 3),
  scissors: keys("voie.scissors", 3),
  lizard:   keys("voie.lizard", 3),
  spock:    keys("voie.spock", 3),
};
const VOIE_GENERIC = keys("voie.generic", 3);

/** Pick DÉTERMINISTE dans un pool depuis `key` (varie par tour, testable). */
function pick(pool: string[], key: number): string {
  return tNow(pool[(Math.imul(key ^ 0x9e3779b9, 2654435761) >>> 0) % pool.length]);
}

/** Construit le recap depuis (board AVANT résolution) → (board APRÈS). `mySide` =
 *  perspective du joueur local. Retourne null si le tour clôt le match. */
export function buildTurnRecap(prev: BoardState, next: BoardState, mySide: Side, key: number): TurnRecap | null {
  if (next.phase === "match-end" || next.phase === "sudden-death") return null;
  const oppSide: Side = mySide === "a" ? "b" : "a";

  const dmgDealt = Math.max(0, prev[oppSide].hp - next[oppSide].hp);
  const dmgTaken = Math.max(0, prev[mySide].hp - next[mySide].hp);
  const heal = Math.max(0, next[mySide].hp - prev[mySide].hp);
  // ENTROPIE (Cosmos) : PV de soin rognés ce tour, de mon côté et côté adverse.
  const cut = (s: Side): number => Math.max(0, (next[s].entropyHealCut ?? 0) - (prev[s].entropyHealCut ?? 0));
  const myCut = cut(mySide), oppCut = cut(oppSide);
  const engDelta = (engineGauge(next[mySide])?.value ?? 0) - (engineGauge(prev[mySide])?.value ?? 0);

  let headline: string;
  let tone: RecapTone;
  if (dmgDealt >= 6 && dmgDealt > dmgTaken) { headline = pick(DEVASTATING, key); tone = "good"; }
  else if (dmgDealt > 0 && dmgTaken > 0)    { headline = pick(EXCHANGE, key);    tone = "neutral"; }
  else if (dmgDealt > 0)                    { headline = pick(OFFENSIVE, key);   tone = "good"; }
  else if (dmgTaken >= 6)                   { headline = pick(HEAVY_TAKEN, key); tone = "bad"; }
  else if (dmgTaken > 0)                    { headline = pick(TAKEN, key);       tone = "bad"; }
  else if (heal > 0)                        { headline = pick(HEAL, key);        tone = "good"; }
  else if (engDelta > 0) {
    const aff = next[mySide].affinity;
    headline = pick(aff ? VOIE_LINES[aff] : VOIE_GENERIC, key);
    tone = "good";
  }
  else                                      { headline = pick(NEUTRAL, key);     tone = "neutral"; }

  const chips: RecapChip[] = [];
  if (dmgDealt > 0) chips.push({ label: tNow("arena.recap.chip.dealt", { n: dmgDealt }), tone: "good" });
  if (dmgTaken > 0) chips.push({ label: tNow("arena.recap.chip.taken", { n: dmgTaken }), tone: "bad" });
  if (heal > 0)     chips.push({ label: myCut > 0 ? tNow("arena.recap.chip.healEntropy", { n: heal, k: myCut }) : tNow("arena.recap.chip.heal", { n: heal }), tone: "good" });
  if (oppCut > 0)   chips.push({ label: tNow("arena.recap.chip.entropyOpp", { k: oppCut }), tone: "engine" });
  if (engDelta > 0) chips.push({ label: tNow("arena.recap.chip.engine", { n: engDelta }), tone: "engine" });

  return { headline, tone, chips, key };
}
