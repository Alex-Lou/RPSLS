import { motion } from "motion/react";
import { useT } from "../../i18n";
import { LANE_IDENTITIES } from "../../engine/lanesCombos";
import { IDENTITY_KEYS, RPSLS_MOVES_HELP, COMBO_LEXICON } from "./data";

/* ──────────── Help / Lexicon modal ──────────── */

export function HelpModal({ target, onClose }: { target: number; onClose: () => void }) {
  const t = useT();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 6 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[85vh] overflow-y-auto bg-surface-raised border border-hairline rounded-3xl p-6 shadow-2xl"
      >
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-xl font-black tracking-tight text-themed">
            🌌 {t("lanes.help.title")}
          </h2>
        </div>

        <div className="space-y-5 text-sm">
          <Section
            title={t("lanes.help.rules.title")}
            body={t("lanes.help.rules.body", { target })}
            accent="violet"
          />

          {/* Per-move grid — much clearer than a paragraph of "X cuts Y, Y…" */}
          <Section
            title={t("lanes.help.rps.title")}
            body={t("lanes.help.rps.body")}
            accent="cyan"
          >
            <div className="mt-3 grid grid-cols-1 gap-2">
              {RPSLS_MOVES_HELP.map(({ id, glyph, color }) => (
                <div
                  key={id}
                  className="rounded-xl bg-surface border border-hairline p-3 flex items-center gap-3"
                >
                  <div
                    className={
                      "shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br " + color +
                      " flex items-center justify-center text-zinc-900 text-2xl shadow-md"
                    }
                  >
                    {glyph}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <div className="text-base font-black uppercase tracking-wider text-zinc-50">
                      {t(`online.reveal.${id}`)}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm leading-tight">
                      <span className="text-emerald-300 font-semibold">
                        ✓ {t("lanes.help.rps.beats")}
                      </span>
                      <span className="text-ink break-words">
                        {t(`lanes.help.rps.${id}.beats`)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm leading-tight">
                      <span className="text-rose-300 font-semibold">
                        ✗ {t("lanes.help.rps.losesTo")}
                      </span>
                      <span className="text-ink-muted break-words">
                        {t(`lanes.help.rps.${id}.losesTo`)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section
            title={t("lanes.help.identity.title")}
            body={t("lanes.help.identity.body")}
            accent="amber"
          >
            <div className="mt-2 grid grid-cols-3 gap-2">
              {LANE_IDENTITIES.map((id, i) => (
                <div
                  key={i}
                  className="rounded-xl bg-surface border border-hairline p-2 text-center"
                >
                  <div className="text-lg">{id.glyph}</div>
                  <div className={
                    "text-[10px] uppercase tracking-wider font-bold mt-0.5 " +
                    (id.accent === "amber"  ? "text-amber-300"  :
                     id.accent === "sky"    ? "text-sky-300"    :
                                              "text-emerald-300")
                  }>
                    {t(`${IDENTITY_KEYS[i]}.title`)}
                  </div>
                  <div className="text-[10px] text-ink-muted mt-1 leading-tight">
                    {t(`${IDENTITY_KEYS[i]}.hint`)}
                  </div>
                </div>
              ))}
            </div>
          </Section>
          <Section
            title={t("lanes.help.combos.title")}
            body={t("lanes.help.combos.body")}
            accent="fuchsia"
          >
            <div className="mt-3 flex flex-col gap-2">
              {COMBO_LEXICON.map(({ id, glyph }) => (
                <div
                  key={id}
                  className="rounded-xl bg-surface border border-hairline p-3 flex items-center gap-3"
                >
                  <span className="text-2xl shrink-0">{glyph}</span>
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="text-sm font-black uppercase tracking-wider text-zinc-50 leading-tight">
                      {t(`combo.${id}.name`)}
                    </span>
                    <span className="text-xs text-ink-muted leading-snug break-words">
                      {t(`combo.${id}.tag`)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Section>
          <Section
            title={t("lanes.help.timer.title")}
            body={t("lanes.help.timer.body")}
            accent="rose"
          />
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full px-6 py-3 rounded-2xl font-bold text-white bg-themed shadow-lg shadow-themed transition hover:scale-[1.02]"
        >
          {t("lanes.help.close")}
        </button>
      </motion.div>
    </motion.div>
  );
}

function Section({
  title, body, accent, children,
}: {
  title: string; body: string;
  accent: "violet" | "cyan" | "amber" | "fuchsia" | "rose";
  children?: React.ReactNode;
}) {
  const colour = {
    violet:  "text-violet-300",
    cyan:    "text-cyan-300",
    amber:   "text-amber-300",
    fuchsia: "text-fuchsia-300",
    rose:    "text-rose-300",
  }[accent];
  return (
    <div>
      <h3 className={"text-xs uppercase tracking-[0.25em] font-bold mb-1.5 " + colour}>
        {title}
      </h3>
      <p className="text-ink-muted leading-relaxed text-[13px]">{body}</p>
      {children}
    </div>
  );
}
