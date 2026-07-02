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

const DEVASTATING = ["Coup dévastateur", "Énergie cinétique maximale", "Impact sismique", "Onde de choc", "De la physique appliquée"];
const OFFENSIVE = ["Offensive réussie", "Pression maintenue", "Tu grignotes ses PV", "Momentum en ta faveur", "Avantage net"];
const EXCHANGE = ["Échange musclé", "Collision frontale", "Action = réaction", "Duel d'usure", "Chacun encaisse"];
const HEAVY_TAKEN = ["Tu encaisses fort", "Choc violent", "La note est salée", "Impact majeur subi"];
const TAKEN = ["Sous pression", "Tu prends des coups", "Défense éprouvée", "Ça cogne en face"];
const HEAL = ["Tu te régénères", "Homéostasie rétablie", "Cellules réparées", "Second souffle"];
const NEUTRAL = ["Tour d'observation", "Calme avant l'orage", "Repositionnement tactique", "On jauge l'adversaire", "Statu quo… pour l'instant"];

/** Accroches TEINTÉES PAR VOIE quand la jauge monte (payoff d'identité). */
const VOIE_LINES: Record<Move, string[]> = {
  rock:     ["La Montagne s'élève", "Strate après strate", "Inébranlable"],
  paper:    ["La Forêt s'étend", "Racines profondes", "Ça pousse fort"],
  scissors: ["La lame s'aiguise", "Fil affûté", "Coupe nette"],
  lizard:   ["Le Mirage se densifie", "Maintenant tu me vois…", "Insaisissable"],
  spock:    ["Le Cosmos s'aligne", "Fascinant.", "Logique implacable"],
};
const VOIE_GENERIC = ["La Voie progresse", "L'énergie monte", "Ton archétype s'affirme"];

/** Pick DÉTERMINISTE dans un pool depuis `key` (varie par tour, testable). */
function pick(pool: string[], key: number): string {
  return pool[(Math.imul(key ^ 0x9e3779b9, 2654435761) >>> 0) % pool.length];
}

/** Construit le recap depuis (board AVANT résolution) → (board APRÈS). `mySide` =
 *  perspective du joueur local. Retourne null si le tour clôt le match. */
export function buildTurnRecap(prev: BoardState, next: BoardState, mySide: Side, key: number): TurnRecap | null {
  if (next.phase === "match-end" || next.phase === "sudden-death") return null;
  const oppSide: Side = mySide === "a" ? "b" : "a";

  const dmgDealt = Math.max(0, prev[oppSide].hp - next[oppSide].hp);
  const dmgTaken = Math.max(0, prev[mySide].hp - next[mySide].hp);
  const heal = Math.max(0, next[mySide].hp - prev[mySide].hp);
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
  if (dmgDealt > 0) chips.push({ label: `−${dmgDealt} adv`, tone: "good" });
  if (dmgTaken > 0) chips.push({ label: `−${dmgTaken} toi`, tone: "bad" });
  if (heal > 0)     chips.push({ label: `+${heal} PV`, tone: "good" });
  if (engDelta > 0) chips.push({ label: `Voie +${engDelta} ★`, tone: "engine" });

  return { headline, tone, chips, key };
}
