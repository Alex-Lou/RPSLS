import { motion } from "motion/react";
import { useT } from "./i18n";

interface Section {
  icon: string;
  titleKey: string;
  bodyKey?: string;
  bullets?: string[];
}

const SECTIONS: Section[] = [
  { icon: "🎯", titleKey: "about.howto.title",     bodyKey: "about.howto.body" },
  {
    icon: "🎮",
    titleKey: "about.modes.title",
    bullets: [
      "about.modes.training",
      "about.modes.casual",
      "about.modes.ranked",
      "about.modes.hotseat",
    ],
  },
  { icon: "🤖", titleKey: "about.diff.title",      bodyKey: "about.diff.body" },
  { icon: "🏅", titleKey: "about.quests.title",    bodyKey: "about.quests.body" },
  { icon: "🎴", titleKey: "about.variants.title",  bodyKey: "about.variants.body" },
  { icon: "🎯", titleKey: "about.daily.title",     bodyKey: "about.daily.body" },
];

export function AboutPage() {
  const t = useT();
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-3xl mx-auto p-4 sm:p-6 flex flex-col gap-5"
    >
      <div className="text-center sm:text-left">
        <div className="flex justify-center sm:justify-start mb-3">
          <img
            src="/Logo-RLSPS.png"
            alt="RPSLS"
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl shadow-lg"
          />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-violet-300 via-fuchsia-300 to-teal-300 bg-clip-text text-transparent">
          {t("about.title")}
        </h1>
        <p className="text-zinc-400 text-sm sm:text-base mt-2 leading-relaxed">
          {t("about.intro")}
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {SECTIONS.map((s, i) => (
          <motion.li
            key={s.titleKey}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 * i, duration: 0.25 }}
            className="bg-white/5 border border-white/10 rounded-2xl p-4"
          >
            <div className="flex items-center gap-2.5 mb-2">
              <span className="text-2xl">{s.icon}</span>
              <h2 className="text-base sm:text-lg font-bold">{t(s.titleKey)}</h2>
            </div>
            {s.bodyKey && (
              <p className="text-zinc-300 text-sm leading-relaxed">{t(s.bodyKey)}</p>
            )}
            {s.bullets && (
              <ul className="space-y-1.5 mt-1">
                {s.bullets.map((b) => (
                  <li key={b} className="text-zinc-300 text-sm leading-relaxed flex gap-2">
                    <span className="text-zinc-500 mt-0.5">•</span>
                    <span>{t(b)}</span>
                  </li>
                ))}
              </ul>
            )}
          </motion.li>
        ))}
      </ul>

      <p className="text-center text-[10px] text-zinc-600 mt-2">
        RPSLS · v0.1 · built with Tauri + React
      </p>
    </motion.div>
  );
}
