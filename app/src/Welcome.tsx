import { useState } from "react";
import { motion } from "motion/react";
import { randomNickname, useStore } from "./store";
import { useT } from "./i18n";
import { LanguagePicker } from "./LanguagePicker";

export function Welcome({ onDone }: { onDone: () => void }) {
  const updateProfile = useStore((s) => s.updateProfile);
  const setOnboarded = useStore((s) => s.setOnboarded);
  const t = useT();

  const [nick, setNick] = useState("");
  const trimmed = nick.trim();
  const isValid = trimmed.length > 0 && trimmed.length <= 20;

  const finish = (name: string) => {
    updateProfile({ nickname: name });
    setOnboarded(true);
    onDone();
  };

  const onContinue = () => {
    if (isValid) finish(trimmed);
  };

  const onSkip = () => {
    finish(randomNickname());
  };

  return (
    <motion.div
      key="welcome"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="h-full w-full flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 0.15, type: "spring", stiffness: 260, damping: 22 }}
        className="relative w-full max-w-md bg-zinc-950/70 backdrop-blur-md border border-white/15 rounded-3xl p-8 shadow-2xl"
      >
        {/* Glow halo */}
        <motion.div
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.4, 0.25] }}
          transition={{ delay: 0.3, duration: 1.8, ease: "easeOut" }}
          className="absolute -inset-10 -z-10 rounded-[3rem] blur-3xl pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 30% 20%, rgba(168,85,247,0.45), transparent 60%), radial-gradient(circle at 80% 80%, rgba(45,212,191,0.4), transparent 60%)",
          }}
        />

        <div className="absolute top-4 right-4 z-10">
          <LanguagePicker />
        </div>

        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="text-3xl font-extrabold tracking-tight text-center text-themed"
        >
          {t("welcome.title")}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="text-zinc-400 text-sm text-center mt-2"
        >
          {t("welcome.subtitle")}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.4 }}
          className="mt-7"
        >
          <label className="block text-[10px] uppercase tracking-widest text-zinc-400 mb-1.5">
            {t("welcome.nick.label")}
          </label>
          <input
            autoFocus
            value={nick}
            maxLength={20}
            onChange={(e) => setNick(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && isValid) onContinue();
            }}
            placeholder={t("welcome.nick.placeholder")}
            className="w-full bg-white/8 border border-white/15 rounded-2xl px-4 py-3 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-violet-400/60 placeholder:text-zinc-500"
          />
          <p className="mt-1.5 text-[10px] text-zinc-500">
            {t("welcome.charcount", { n: trimmed.length })}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.4 }}
          className="mt-6 flex flex-col sm:flex-row gap-3"
        >
          <motion.button
            whileHover={isValid ? { y: -2 } : undefined}
            whileTap={isValid ? { scale: 0.97 } : undefined}
            disabled={!isValid}
            onClick={onContinue}
            className="flex-1 px-5 py-3 rounded-2xl font-semibold text-base bg-themed disabled:opacity-40 disabled:cursor-not-allowed transition shadow-lg shadow-black/30"
          >
            {t("welcome.btn.go")}
          </motion.button>
          <motion.button
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            onClick={onSkip}
            className="flex-1 px-5 py-3 rounded-2xl font-semibold text-base bg-white/5 hover:bg-white/10 border border-white/15 hover:border-white/30 transition"
          >
            {t("welcome.btn.skip")}
          </motion.button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
