/**
 * Gains du match QUI VIENT d'être enregistré, relus depuis le store (entrée
 * history[0] écrite par recordMatch) — pour les modes qui enregistrent AVANT
 * d'afficher la fin (Constellation vs CPU, Classé cartes, en ligne) et dont
 * l'écran n'avait pas (ou mal) l'XP créditée.
 *
 * XP = xpDelta enregistré (déjà mis à l'échelle de la longueur par le store)
 * + bonus de série via le MÊME helper que recordMatch (streakBonusXp, série
 * post-match). Aucun barème recopié.
 */
import { useState } from "react";
import { useStore } from "../../store/store";
import { useT } from "../../i18n";
import { streakBonusXp, streakXpMultiplier } from "../streak";
import { eclatsReward } from "../../engine/economy";
import type { MatchRecord } from "../../types";

/** Fenêtre au-delà de laquelle history[0] n'est plus « ce » match. */
const FRESH_MS = 90_000;

export interface RecordedReward {
  xp: number;
  /** Détail affichable des multiplicateurs (série), déjà traduit — ou null. */
  note: string | null;
  /** LP du ladder en ligne (rankLp) — seulement vs humain (sinon 0). */
  lp: number;
  /** 💎 — miroir de recordMatch (match arbitré par le serveur ou non). */
  eclats: number;
  record: MatchRecord;
}

type T = (key: string, params?: Record<string, string | number>) => string;

function read(outcome: "win" | "loss" | "draw", t: T): RecordedReward | null {
  const s = useStore.getState();
  const rec = s.history[0];
  if (!rec || rec.outcome !== outcome || Date.now() - rec.timestamp > FRESH_MS) return null;
  const streak = s.player.winStreak ?? 0;
  const bonus = rec.outcome === "win" ? streakBonusXp(rec.xpDelta, streak) : 0;
  const xp = Math.max(0, rec.xpDelta + bonus);
  // Mêmes libellés que l'écran Classique (match.bonus.*).
  const note = bonus > 0
    ? `${t("match.bonus.streak", { x: streakXpMultiplier(streak).toFixed(1) })} · ${t("match.bonus.breakdown", { a: rec.xpDelta, b: bonus })}`
    : null;
  const human = rec.opponent.kind === "human" && rec.mode !== "hotseat";
  // recordMatch : lpDelta borné à ±50 ; bot de repli en ligne réclamé en "ranked".
  const lp = human ? Math.max(-50, Math.min(50, rec.lpDelta | 0)) : 0;
  const claimMode = !human && rec.mode === "online" ? "ranked" : rec.mode;
  const eclats = rec.forfeit ? 0 : human ? eclatsReward(rec.mode, rec.outcome) : eclatsReward(claimMode, rec.outcome, rec.bestOf);
  return { xp, note, lp, eclats, record: rec };
}

/** Lu UNE fois au montage (l'écran ne doit pas bouger si l'historique change). */
export function useRecordedReward(outcome: "win" | "loss" | "draw"): RecordedReward | null {
  const t = useT();
  const [r] = useState(() => read(outcome, t));
  return r;
}
