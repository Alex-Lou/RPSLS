import type { ReactNode } from "react";
import { rankProgress } from "../engine/rank";
import { formatNumber } from "../i18n/format";
import { useT } from "../i18n";
import { LpBar } from "../ranked/LpBar";

/**
 * LobbyRankCard — carte « rang du mode » PARTAGÉE par Classé et Constellation
 * Classée : emblème du palier, points, barre de progression, prochain palier,
 * bilan V/D. Volontairement SANS avatar/pseudo ni monnaies : la carte joueur
 * et le portefeuille vivent déjà sur l'accueil (doublon relevé à l'audit).
 */
export function LobbyRankCard({ lp, unit, wins, losses, draws = 0, info }: {
  lp: number;
  /** Unité affichée : « PR » (Classé) ou « LP » (Constellation Classée). */
  unit: string;
  wins: number;
  losses: number;
  draws?: number;
  /** Bulle d'aide optionnelle à côté du palier. */
  info?: ReactNode;
}) {
  const t = useT();
  const { tier, progress, next } = rankProgress(lp);
  const decided = wins + losses;
  const winrate = decided > 0 ? Math.round((wins / decided) * 100) : 0;
  return (
    <div
      className="shrink-0 bg-surface rounded-2xl px-4 py-3 flex flex-col gap-2.5"
      style={{ border: "1px solid color-mix(in oklab, var(--theme-primary) 35%, transparent)" }}
    >
      <div className="flex items-center gap-3">
        <div className={"w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-lg shrink-0 bg-gradient-to-br " + tier.gradient}>
          {tier.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-black text-lg leading-none">{tier.label}</span>
            {info}
            <span className="ml-auto text-[11px] text-ink-muted tabular-nums">
              {formatNumber(lp)}{next ? ` / ${formatNumber(tier.ceil)}` : ""} {unit}
            </span>
          </div>
          <LpBar progress={progress} className="mt-1.5" />
          <div className="mt-1 text-[10px] text-ink-faint">
            {next
              ? t("lobby.rank.toNext", { n: formatNumber(tier.ceil - lp), unit, tier: `${next.label} ${next.emoji}` })
              : t("lobby.rank.max")}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2.5 text-[12px] font-bold tabular-nums">
        <span className="text-emerald-300">{wins} {t("lobby.rank.w")}</span>
        <span className="text-rose-300">{losses} {t("lobby.rank.l")}</span>
        {draws > 0 && <span className="text-ink-muted">{draws} {t("lobby.rank.d")}</span>}
        <span className="text-ink-faint font-normal">· {t("lobby.rank.winrate", { n: winrate })}</span>
      </div>
    </div>
  );
}
