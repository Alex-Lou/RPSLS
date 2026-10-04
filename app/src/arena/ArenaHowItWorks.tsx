/**
 * ArenaHowItWorks — fullscreen modal explaining the Constellation Pro
 * fundamentals so the player doesn't have to guess WHY damage didn't
 * land or WHY a card can't be cast on a given lane.
 *
 * Opened from the "?" button in the plan phase. Closed by the X or
 * tapping the backdrop. Keeps the explanations short, with iconography
 * matching what the game actually shows on the board.
 */

import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { CREATURE_PASSIVES, CREATURE_STATS, MANA_CAP, MOVE_DESIGN_NOTES, TURN_HARD_CAP } from "./arenaTypes";
import type { Move } from "../engine/game";
import type { ReactNode } from "react";
import { useT } from "../i18n";
import { provocationRuleParams } from "./arenaVoieText";

/** Rend un texte traduit où **gras** devient un <strong> (classe optionnelle). */
export function richText(s: string, strongClass?: string): ReactNode[] {
  return s.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 === 1 ? <strong key={i} className={strongClass}>{part}</strong> : part,
  );
}

export function ArenaHowItWorks({ onClose }: { onClose: () => void }) {
  const t = useT();
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-2xl bg-zinc-950 border border-emerald-700/40 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-base font-black uppercase tracking-wider text-emerald-300">
            {t("arena.how.title")}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-bold flex items-center justify-center"
            aria-label={t("arena.how.close")}
          >
            ✕
          </button>
        </div>
        <div className="p-4 sm:p-5 space-y-5 text-[15px] text-zinc-100">
          <Section title={t("arena.how.goal.title")} body={t("arena.how.goal.body")} />
          <Section
            title={t("arena.how.turn.title")}
            body=""
            sub={[
              t("arena.how.turn.1", { maxMana: MANA_CAP }),
              t("arena.how.turn.2"),
              t("arena.how.turn.3"),
              t("arena.how.turn.4"),
              t("arena.how.turn.5"),
              t("arena.how.turn.6"),
              t("arena.how.turn.7"),
              t("arena.how.turn.8", { cap: TURN_HARD_CAP }),
            ]}
          />
          <Section
            title={t("arena.how.example.title")}
            body={t("arena.how.example.body")}
          />
          <Section title={t("arena.how.mana.title")} body={t("arena.how.mana.body", { maxMana: MANA_CAP })} />
          <Section title={t("arena.how.persist.title")} body={t("arena.how.persist.body")} />
          <Section
            title={t("arena.how.combat.title")}
            body=""
            sub={[
              t("arena.how.combat.1"),
              t("arena.how.combat.2"),
              t("arena.how.combat.3"),
              t("arena.how.combat.4"),
              t("arena.how.combat.5"),
            ]}
          />
          {/* THE BIG ONE — single source of truth on les 5 passifs RPSLS.
           *  Replaces 3 scattered earlier sections. */}
          <PassiveGrid />
          <Section
            title={t("arena.how.deflect.title")}
            body={t("arena.how.deflect.body")}
          />
          <Section
            title={t("arena.how.whyRock.title")}
            body=""
            sub={[
              t("arena.how.whyRock.1"),
              t("arena.how.whyRock.2", provocationRuleParams()),
              t("arena.how.whyRock.3"),
              t("arena.how.whyRock.4", provocationRuleParams()),
            ]}
          />
          <Section
            title={t("arena.how.defense.title")}
            body=""
            sub={[
              t("arena.how.defense.1"),
              t("arena.how.defense.2"),
              t("arena.how.defense.3"),
            ]}
          />
          <Section
            title={t("arena.how.targets.title")}
            body=""
            sub={[
              t("arena.how.targets.1"),
              t("arena.how.targets.2"),
              t("arena.how.targets.3"),
              t("arena.how.targets.4"),
              t("arena.how.targets.5"),
            ]}
          />
          <Section
            title={t("arena.how.forge.title")}
            body={t("arena.how.forge.body")}
            sub={[
              t("arena.how.forge.1"),
              t("arena.how.forge.2"),
              t("arena.how.forge.3"),
              t("arena.how.forge.4"),
              t("arena.how.forge.5"),
              t("arena.how.forge.6"),
            ]}
          />
          <Section title={t("arena.how.badges.title")} body={t("arena.how.badges.body")} />
          <Section title={t("arena.how.tip.title")} body={t("arena.how.tip.body")} />
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

/** Per-symbole strategy cheat-sheet — one card per RPSLS symbol with
 *  stats, passif name, BON / MOINS BON / 2 CONTRES (the 2 RPSLS counters).
 *  This is the heart of "Comment ça marche" — single-glance strategy from
 *  turn 1. Reads top-to-bottom on mobile, no horizontal scroll. */
function PassiveGrid() {
  const t = useT();
  const moves: Move[] = ["rock", "paper", "scissors", "lizard", "spock"];
  const toneBg: Record<string, string> = {
    amber:   "bg-amber-400/95 text-black",
    emerald: "bg-emerald-400/95 text-black",
    rose:    "bg-rose-400/95 text-black",
    sky:     "bg-sky-400/95 text-black",
    violet:  "bg-violet-400/95 text-black",
  };
  return (
    <div>
      <h3 className="text-[12px] font-black uppercase tracking-wider text-emerald-200/95 mb-1">
        {t("arena.how.grid.title")}
      </h3>
      <p className="text-[13.5px] leading-relaxed text-zinc-300 mb-3">
        {richText(t("arena.how.grid.intro"), "text-emerald-200")}
      </p>
      <div className="space-y-2.5">
        {moves.map((move) => {
          const p = CREATURE_PASSIVES[move];
          const stats = CREATURE_STATS[move];
          const notes = MOVE_DESIGN_NOTES[move];
          return (
            <div key={move} className="rounded-lg bg-zinc-900/70 border border-zinc-800 p-2.5">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className={"text-[15px] px-1.5 py-0.5 rounded font-black tracking-wider shadow leading-none " + (toneBg[p.tone] ?? "bg-zinc-400 text-black")}>
                  {p.glyph}
                </span>
                <span className="text-[15px] font-black text-zinc-50">{t(`arena.how.move.${move}`)}</span>
                <span className="text-[12px] text-zinc-400 tabular-nums ml-auto">⚔ {stats.atk} · ❤ {stats.hp}</span>
                <span className="text-[13px] font-bold text-emerald-300 whitespace-nowrap">{p.name}</span>
              </div>
              <div className="space-y-1 pl-1">
                <p className="text-[13px] leading-snug text-emerald-200/95">
                  <span className="font-black">{t("arena.how.good")}</span> {notes.good}
                </p>
                <p className="text-[13px] leading-snug text-rose-200/95">
                  <span className="font-black">{t("arena.how.bad")}</span> {notes.bad}
                </p>
                <p className="text-[13px] leading-snug text-amber-200/95">
                  <span className="font-black">{t("arena.how.counters")}</span> {notes.counters}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 rounded-lg bg-emerald-950/60 border border-emerald-800/40 p-2.5">
        <p className="text-[13px] leading-snug text-emerald-100/95">
          <span className="font-black text-emerald-300">{t("arena.how.opening.title")}</span> {richText(t("arena.how.opening.body"))}
        </p>
      </div>
    </div>
  );
}

function Section({ title, body, sub }: { title: string; body: string; sub?: string[] }) {
  return (
    <div>
      <h3 className="text-[14px] font-black uppercase tracking-wider text-emerald-200/95 mb-1.5">{title}</h3>
      {body && <p className="text-[14.5px] leading-relaxed text-zinc-200">{body}</p>}
      {sub && (
        <ul className="mt-1.5 space-y-1.5">
          {sub.map((line, i) => (
            <li key={i} className="text-[14px] leading-relaxed text-zinc-200 pl-3.5 -indent-2.5">
              • {line}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
