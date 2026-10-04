/**
 * Sous-composants présentationnels d'AuthGate (onglets, champ, logo Google,
 * bannière du bonus de bienvenue, écran de succès). Extraits verbatim.
 */

import { motion } from "motion/react";
import type { AuthMode } from "../online/accountAuth";
import { WELCOME_BONUS as BONUS } from "../engine/economy";

export function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={"rounded-xl py-2 text-xs font-black uppercase tracking-wider transition " + (active ? "text-white shadow" : "text-ink-faint hover:text-ink-muted")}
      style={active ? { background: "linear-gradient(90deg, var(--theme-primary), var(--theme-secondary))" } : undefined}
    >
      {children}
    </button>
  );
}

/** Official Google "G" mark (brand glyph, not an emoji — required on Google
 *  sign-in buttons). */
export function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export function BonusBanner({ t }: { t: (k: string) => string }) {
  const chip = "flex min-w-[3rem] flex-col items-center gap-0.5";
  const num = "text-sm font-black tabular-nums text-ink";
  return (
    <div className="rounded-2xl border border-fuchsia-300/25 bg-gradient-to-br from-fuchsia-500/10 to-violet-500/5 px-3 py-3">
      <div className="mb-2 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-fuchsia-200/80">
        {t("auth.bonus.title")}
      </div>
      <div className="flex items-stretch justify-center gap-2">
        <div className={chip}>
          <img src="/MenuIcons/IconConstellationPro/monnaie-eclats.png" alt="" className="h-7 w-7 object-contain" draggable={false} />
          <span className={num}>{BONUS.eclats}</span>
        </div>
        <div className={chip}>
          <img src="/MenuIcons/IconConstellationPro/monnaie-poussiere.png" alt="" className="h-7 w-7 object-contain" draggable={false} />
          <span className={num}>{BONUS.dust}</span>
        </div>
        <div className={chip}>
          <img src="/MenuIcons/IconConstellationPro/monnaie-etoiles.png" alt="" className="h-7 w-7 object-contain" draggable={false} />
          <span className={num}>{BONUS.stars}</span>
        </div>
        <div className={chip}>
          <img src="/IconesMenu CommentCaMarche/Cartes icone.png" alt="" className="h-7 w-7 object-contain" draggable={false} />
          <span className={num}>
            {BONUS.cards} <span className="text-[9px] font-bold uppercase text-ink-faint">{t("auth.bonus.cards")}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export function Field({
  label, type, value, onChange, placeholder, autoComplete, disabled, trailing,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">{label}</span>
      <div className="flex items-center rounded-xl bg-white/5 px-3 ring-1 ring-white/10 transition focus-within:ring-2 focus-within:ring-fuchsia-400/60">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          disabled={disabled}
          className="flex-1 bg-transparent py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint/60 disabled:opacity-60"
        />
        {trailing}
      </div>
    </label>
  );
}

export function SuccessView({
  mode, nickname, t,
}: {
  mode: AuthMode;
  nickname: string;
  t: (k: string, p?: Record<string, string | number>) => string;
}) {
  const isSignup = mode === "signup";
  const bonusItems = [
    { src: "/MenuIcons/IconConstellationPro/monnaie-eclats.png", n: BONUS.eclats },
    { src: "/MenuIcons/IconConstellationPro/monnaie-poussiere.png", n: BONUS.dust },
    { src: "/MenuIcons/IconConstellationPro/monnaie-etoiles.png", n: BONUS.stars },
    { src: "/IconesMenu CommentCaMarche/Cartes icone.png", n: BONUS.cards },
  ];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative flex flex-col items-center gap-3 py-6 text-center">
      {/* Burst rings + sparkles radiating from the emblem. */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-12 -translate-x-1/2">
        {[0, 0.12, 0.24].map((delay, i) => (
          <motion.span
            key={"r" + i}
            className="absolute rounded-full"
            style={{ width: 16, height: 16, marginLeft: -8, marginTop: -8, border: "2px solid color-mix(in oklab, var(--theme-secondary) 70%, transparent)" }}
            initial={{ scale: 0, opacity: 0.9 }}
            animate={{ scale: [0, 9], opacity: [0.9, 0] }}
            transition={{ duration: 1.2, delay, ease: "easeOut" }}
          />
        ))}
        {Array.from({ length: 10 }).map((_, i) => {
          const a = (i / 10) * Math.PI * 2;
          const d = 64 + (i % 3) * 18;
          return (
            <motion.span
              key={"s" + i}
              className="absolute h-1.5 w-1.5 rounded-full"
              style={{ marginLeft: -3, marginTop: -3, background: i % 2 ? "var(--theme-secondary)" : "var(--theme-primary)", boxShadow: "0 0 8px color-mix(in oklab, var(--theme-primary) 70%, transparent)" }}
              initial={{ x: 0, y: 0, opacity: 0, scale: 0.5 }}
              animate={{ x: Math.cos(a) * d, y: Math.sin(a) * d, opacity: [0, 1, 0], scale: [0.5, 1.1, 0.4] }}
              transition={{ duration: 1.1, delay: 0.05 + i * 0.02, ease: [0.22, 1, 0.36, 1] }}
            />
          );
        })}
      </div>

      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: [0, 1.25, 1], rotate: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex h-16 w-16 items-center justify-center rounded-full text-3xl text-white bg-themed-br"
        style={{
          boxShadow: "0 0 34px color-mix(in oklab, var(--theme-secondary) 75%, transparent)",
        }}
      >
        ✓
      </motion.div>

      <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }} className="text-xl font-black text-ink">
        {t(isSignup ? "auth.welcome.signup" : "auth.welcome.login", { name: nickname || "" })}
      </motion.h1>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.34 }} className="max-w-[16rem] text-xs text-ink-muted">
        {t("auth.success.sub")}
      </motion.p>

      {isSignup && (
        <div className="mt-1 flex items-stretch justify-center gap-3">
          {bonusItems.map((it, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.1, type: "spring", stiffness: 360, damping: 18 }}
              className="flex flex-col items-center gap-0.5"
            >
              <img src={it.src} alt="" className="h-7 w-7 object-contain" draggable={false} />
              <span className="text-sm font-black tabular-nums text-ink">+{it.n}</span>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
