import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "../store";
import { useT } from "../i18n";
import { THEMES, gradientFromTheme } from "../theme/theme";
import {
  PACKS,
  Pack,
  allWins,
  randomMoveInPack,
  resolveInPack,
  verbKeyForPair,
} from "../packs";

type View = { kind: "list" } | { kind: "play"; pack: Pack };

export function PacksPage() {
  const [view, setView] = useState<View>({ kind: "list" });
  const t = useT();
  const themeId = useStore((s) => s.player.themeId);
  const theme = THEMES[themeId];

  return (
    <div className="w-full max-w-5xl mx-auto px-5 pt-2 pb-6 md:p-6">
      <AnimatePresence mode="wait">
        {view.kind === "list" ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-6"
          >
            <div>
              <h1 className="font-headline text-3xl font-extrabold tracking-tight">{t("packs.title")}</h1>
              <p className="text-ink-muted text-sm mt-1 max-w-2xl">{t("packs.subtitle")}</p>
            </div>

            <ul className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PACKS.map((pack, i) => (
                <motion.li
                  key={pack.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.25 }}
                  className="bg-surface border border-hairline rounded-3xl p-5 flex flex-col gap-4"
                >
                  <div>
                    <h2 className="text-xl font-bold">{t("pack." + pack.id)}</h2>
                    <p className="text-xs text-ink-muted mt-0.5">{t("pack." + pack.id + ".tag")}</p>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-ink-faint mb-2 font-semibold">
                      {t("packs.elements.title")}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {pack.elements.map((el) => (
                        <div
                          key={el.id}
                          className="flex items-center gap-1.5 bg-surface border border-hairline rounded-xl px-2.5 py-1.5"
                        >
                          <span className="text-lg">{el.emoji}</span>
                          <span className="text-xs text-ink-muted">{t("element." + el.id)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <PackRules pack={pack} />

                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setView({ kind: "play", pack })}
                    className="mt-auto px-5 py-2.5 rounded-2xl font-semibold text-white shadow-lg text-sm"
                    style={{
                      background: gradientFromTheme(theme),
                    }}
                  >
                    {t("packs.btn.play")}
                  </motion.button>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        ) : (
          <PackMatch
            key={`play-${view.pack.id}`}
            pack={view.pack}
            onQuit={() => setView({ kind: "list" })}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────── Rules preview on each pack card ─────────── */

function PackRules({ pack }: { pack: Pack }) {
  const t = useT();
  const wins = useMemo(() => allWins(pack), [pack]);
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-faint mb-2 font-semibold">
        {t("packs.rules.title")}
      </div>
      <ul className="grid grid-cols-1 gap-1 text-xs">
        {wins.map(([w, l], i) => {
          const wi = pack.elements.find((e) => e.id === w)!;
          const li = pack.elements.find((e) => e.id === l)!;
          return (
            <li key={i} className="flex items-center gap-1.5 leading-tight">
              <span className="text-sm">{wi.emoji}</span>
              <span className="font-semibold text-ink">{t("element." + wi.id)}</span>
              <span className="italic text-ink-muted text-[11px]">
                {t(verbKeyForPair(pack, w, l))}
              </span>
              <span className="text-ink-muted">{t("element." + li.id)}</span>
              <span className="text-sm">{li.emoji}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ─────────── Match vs bot using a pack ─────────── */

function PackMatch({ pack, onQuit }: { pack: Pack; onQuit: () => void }) {
  const t = useT();
  const themeId = useStore((s) => s.player.themeId);
  const theme = THEMES[themeId];

  const BEST_OF = 3;
  const target = Math.ceil(BEST_OF / 2);

  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [phase, setPhase] = useState<"pick" | "reveal" | "end">("pick");
  const [round, setRound] = useState<{
    a: string;
    b: string;
    outcome: "a_wins" | "b_wins" | "draw";
  } | null>(null);

  const matchOver = scoreA >= target || scoreB >= target;

  const onPick = (id: string) => {
    if (phase !== "pick") return;
    const bot = randomMoveInPack(pack);
    const outcome = resolveInPack(pack, id, bot);
    if (outcome === "a_wins") setScoreA((s) => s + 1);
    else if (outcome === "b_wins") setScoreB((s) => s + 1);
    setRound({ a: id, b: bot, outcome });
    setPhase("reveal");
  };

  const next = () => {
    if (matchOver) setPhase("end");
    else {
      setRound(null);
      setPhase("pick");
    }
  };

  const reset = () => {
    setScoreA(0);
    setScoreB(0);
    setRound(null);
    setPhase("pick");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col gap-5"
    >
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onQuit}
          className="text-ink-muted hover:text-white text-sm px-3 py-1.5 rounded-lg border border-hairline hover:border-white/30"
        >
          {t("match.quit")}
        </button>
        <div className="flex flex-col items-center gap-0.5">
          <div className="flex items-center gap-4 bg-surface border border-hairline rounded-2xl px-4 py-2">
            <span className="text-sm font-semibold">
              {t("cmatch.you")} {scoreA}
            </span>
            <span className="text-ink-faint text-xs">{t("history.vs")}</span>
            <span className="text-sm font-semibold">
              {scoreB} {t("cmatch.bot")}
            </span>
          </div>
          <span className="text-[10px] text-ink-faint tracking-wider">
            {t("pack." + pack.id)} · {t("history.bo", { n: BEST_OF })}
          </span>
        </div>
        <div className="w-[60px]" />
      </div>

      <AnimatePresence mode="wait">
        {phase === "pick" && (
          <motion.div
            key="pick"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="bg-surface backdrop-blur-md rounded-3xl border border-hairline p-8 flex flex-col items-center gap-6"
          >
            <h2 className="text-xl font-bold">{t("cmatch.title")}</h2>
            <div className="grid grid-cols-5 gap-3">
              {pack.elements.map((el) => (
                <motion.button
                  key={el.id}
                  onClick={() => onPick(el.id)}
                  whileHover={{ y: -4, scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-hairline hover:bg-hairline border border-hairline hover:border-violet-400/40"
                >
                  <span className="text-4xl">{el.emoji}</span>
                  <span className="text-xs text-ink-muted">{t("element." + el.id)}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {phase === "reveal" && round && (
          <motion.div
            key="reveal"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="bg-surface backdrop-blur-md rounded-3xl border border-hairline p-8 flex flex-col items-center gap-5"
          >
            <div className="grid grid-cols-3 items-center w-full gap-4">
              <RevealNode
                pack={pack}
                label={t("cmatch.you")}
                id={round.a}
                winner={round.outcome === "a_wins"}
                loser={round.outcome === "b_wins"}
              />
              <div className="text-center text-ink-faint uppercase tracking-widest text-xs font-bold">
                {t("history.vs")}
              </div>
              <RevealNode
                pack={pack}
                label={t("cmatch.bot")}
                id={round.b}
                winner={round.outcome === "b_wins"}
                loser={round.outcome === "a_wins"}
              />
            </div>

            <p className="text-lg sm:text-xl font-bold text-center">
              {round.outcome === "draw" ? (
                <span className="text-ink-muted">{t("match.draw")}</span>
              ) : (() => {
                const winId = round.outcome === "a_wins" ? round.a : round.b;
                const loseId = round.outcome === "a_wins" ? round.b : round.a;
                return (
                  <>
                    <span
                      className={
                        round.outcome === "a_wins" ? "text-violet-300" : "text-teal-300"
                      }
                    >
                      {t("element." + winId)}
                    </span>
                    <span className="text-ink-muted font-normal italic mx-2">
                      {t(verbKeyForPair(pack, winId, loseId))}
                    </span>
                    <span className="text-ink">{t("element." + loseId)}</span>
                  </>
                );
              })()}
            </p>

            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={next}
              className="mt-1 px-6 py-3 rounded-2xl font-semibold bg-hairline hover:bg-white/20 border border-hairline"
            >
              {matchOver ? t("match.seeResults") : t("match.next")}
            </motion.button>
          </motion.div>
        )}

        {phase === "end" && (
          <motion.div
            key="end"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="bg-surface backdrop-blur-md rounded-3xl border border-hairline p-10 flex flex-col items-center gap-4 text-center"
          >
            <span className="text-6xl">{scoreA > scoreB ? "🏆" : "🤖"}</span>
            <h2 className="text-2xl font-extrabold">
              {scoreA > scoreB ? t("cmatch.you.win") : t("cmatch.bot.win")}
            </h2>
            <p className="text-ink-muted text-sm">
              {scoreA} — {scoreB} · {t("pack." + pack.id)}
            </p>
            <p className="text-xs text-ink-faint">{t("packs.no.xp")}</p>
            <div className="flex gap-2">
              <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={reset}
                className="px-5 py-3 rounded-2xl font-semibold text-white"
                style={{
                  background: gradientFromTheme(theme),
                }}
              >
                {t("match.playAgain")}
              </motion.button>
              <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={onQuit}
                className="px-5 py-3 rounded-2xl font-semibold bg-hairline hover:bg-hairline border border-hairline"
              >
                {t("match.back")}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function RevealNode({
  pack,
  label,
  id,
  winner,
  loser,
}: {
  pack: Pack;
  label: string;
  id: string;
  winner: boolean;
  loser: boolean;
}) {
  const t = useT();
  const el = pack.elements.find((e) => e.id === id);
  if (!el) return null;
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs uppercase tracking-wider text-ink-muted">{label}</span>
      <motion.div
        initial={{ scale: 0.4, rotate: -10, opacity: 0 }}
        animate={{ scale: winner ? 1.1 : 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 16 }}
        className={
          "w-24 h-24 sm:w-32 sm:h-32 rounded-3xl flex items-center justify-center text-6xl sm:text-7xl border-2 " +
          (winner
            ? "bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 border-violet-400/60 shadow-xl"
            : loser
            ? "bg-hairline border-hairline opacity-50 grayscale"
            : "bg-hairline border-hairline")
        }
      >
        {el.emoji}
      </motion.div>
      <span className="text-sm text-ink font-medium">{t("element." + el.id)}</span>
    </div>
  );
}
