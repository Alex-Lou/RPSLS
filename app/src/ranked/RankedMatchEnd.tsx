/**
 * Fin de match Constellation Classée (cartes, vs CPU / tournoi) — adaptateur
 * vers l'écran de fin COMMUN (MatchEndScreen), + récap « Cartes utilisées »
 * propre au mode (extrait de RankedMatchView, qui dépassait 600 lignes).
 *
 * Données inchangées : 💎 = end.eclatsGained ; XP = celle réellement créditée
 * par recordMatch (history[0], bonus de série inclus), repli sur end.xpGained.
 * Tournoi (onNext) : un seul bouton « Suivant » → onMatchResult côté parent.
 */
import { useT } from "../i18n";
import { MatchEndScreen, useEndPhrase, useRecordedReward } from "../match/matchEnd";
import { CARDS } from "./cards";
import type { CardId } from "./rankedTypes";
import type { RankedEndData } from "./RankedMatchView";

export function RankedMatchEnd({
  end, youName, oppName, winTo, onNext, onRematch, onLeave,
}: {
  end: RankedEndData; youName: string; oppName: string; winTo: number;
  onNext?: () => void; onRematch?: () => void; onLeave?: () => void;
}) {
  const t = useT();
  const outcome: "win" | "loss" | "draw" =
    end.roundWinsYou > end.roundWinsOpp ? "win" : end.roundWinsYou < end.roundWinsOpp ? "loss" : "draw";
  const recorded = useRecordedReward(outcome);
  const phrase = useEndPhrase({
    youScore: end.roundWinsYou, oppScore: end.roundWinsOpp, bestOf: winTo * 2 - 1,
    forfeit: end.forfeit, forfeitByYou: end.forfeit && end.winner === "b",
  });
  const back = onLeave ? { label: t("end.back"), onClick: onLeave } : undefined;
  return (
    <MatchEndScreen
      outcome={outcome}
      forfeit={end.forfeit}
      subtitle={phrase}
      score={{ you: end.roundWinsYou, opp: end.roundWinsOpp, youName, oppName, caption: t("end.rounds") }}
      rewards={{ xp: recorded?.xp ?? end.xpGained, xpNote: recorded?.note ?? undefined, eclats: end.eclatsGained }}
      extra={<MatchCardsRecap youCards={end.youCardsPlayed ?? []} oppCards={end.oppCardsPlayed ?? []} />}
      primary={onNext
        ? { label: t("end.next"), onClick: onNext }
        : onRematch ? { label: t("end.playAgain"), onClick: onRematch } : undefined}
      secondary={onNext ? undefined : back}
    />
  );
}

/* ──────────── Récap des cartes jouées ──────────── */

/** Cartes uniques jouées par chaque camp, avec nom + effet (1-2 lignes) :
 *  le joueur apprend les cartes en contexte, sans ouvrir de règles. */
function MatchCardsRecap({ youCards, oppCards }: { youCards: CardId[]; oppCards: CardId[] }) {
  const t = useT();
  const youUnique = unique(youCards);
  const oppUnique = unique(oppCards);
  if (youUnique.length === 0 && oppUnique.length === 0) return null;
  return (
    <div className="w-full rounded-2xl bg-black/30 ring-1 ring-white/10 p-2.5">
      <div className="text-[10px] uppercase tracking-[0.25em] font-bold text-ink-faint text-center mb-1.5">
        {t("end.cardsUsed")}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <CardsColumn label={t("end.you")} cards={youUnique} tone="emerald" />
        <CardsColumn label={t("end.oppShort")} cards={oppUnique} tone="rose" />
      </div>
    </div>
  );
}

function CardsColumn({ label, cards, tone }: { label: string; cards: CardId[]; tone: "emerald" | "rose" }) {
  const t = useT();
  const ring = tone === "emerald" ? "ring-emerald-400/30" : "ring-rose-400/30";
  const head = tone === "emerald" ? "text-emerald-300" : "text-rose-300";
  return (
    <div className="min-w-0">
      <div className={"text-[10px] uppercase tracking-wider font-bold mb-1 " + head}>{label}</div>
      {cards.length === 0 ? (
        <p className="text-[11px] text-ink-faint italic">{t("end.noCards")}</p>
      ) : (
        <div className="flex flex-col gap-1">
          {cards.map((id) => {
            const c = CARDS[id];
            return (
              <div key={id} className={"rounded-lg px-2 py-1.5 bg-white/5 ring-1 " + ring}>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{c.glyph}</span>
                  <span className="text-[11px] font-bold text-ink truncate">{t(c.nameKey)}</span>
                </div>
                {/* Effet en 2 lignes (1 sur écran court) : le récap ne pousse pas
                    les boutons hors écran à 360×760. */}
                <p className="text-[10px] text-ink-muted leading-snug line-clamp-2 [@media(max-height:800px)]:line-clamp-1">
                  {t(c.descKey)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Dédoublonne en gardant l'ordre d'apparition. */
function unique<T>(arr: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const x of arr) {
    if (!seen.has(x)) { seen.add(x); out.push(x); }
  }
  return out;
}
