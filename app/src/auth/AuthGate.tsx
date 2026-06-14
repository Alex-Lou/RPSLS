/**
 * AuthGate — full-screen startup gate (§9-A).
 *
 * Rendered as a STAGE (like Splash / Welcome), BEFORE the menu, for guests with
 * no linked account: the shell — and its lazy page chunks — never mount until
 * the user picks sign-up, log-in, or "continue as guest". A signed-in user
 * (player.accountEmail set) skips it entirely (App routes splash → shell).
 *
 * Perf (Alex 2026-06-14 "ça galère / pas opti") :
 *  - ZERO backdrop-filter. Compositing a live WebGL/CSS backdrop through a blur
 *    every frame is the main jank source on Android WebView. The gate paints
 *    its OWN opaque cosmic gradient, and App suppresses the heavy ThemedBackdrop
 *    during this stage, so nothing expensive runs underneath.
 *  - A handful of opacity-only twinkles (willChange:opacity), positions computed
 *    once at module load. Static halo. No per-render randomness.
 *  - No network on display: the WS round-trip lives in online/accountAuth and
 *    only fires on submit; the gate renders instantly (no startup latency).
 *  - The success→shell timer is cleared on unmount, and the "guest" exit is
 *    blocked mid-submit, so an in-flight auth can't update an unmounted tree.
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useT } from "../i18n";
import { hapticMatchWin, hapticTap } from "../haptic";
import { authenticate, type AuthMode } from "../online/accountAuth";
import { useStore } from "../store/store";

/** Welcome-gift amounts — MIRROR of `crates/rpsls-server/src/account.rs`
 *  WELCOME_ECLATS / WELCOME_DUST / WELCOME_STARS / WELCOME_CARDS.len(). */
const BONUS = { eclats: 300, dust: 150, stars: 30, cards: 14 } as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Star positions computed ONCE at module load — no per-render rand, no layout
 *  thrash. 6 opacity-only twinkles is plenty of life at near-zero cost. */
const STARS = Array.from({ length: 6 }, (_, i) => ({
  top: (i * 53 + 9) % 100,
  left: (i * 71 + 17) % 100,
  size: 1 + (i % 3),
  delay: (i % 6) * 0.5,
  dur: 2.6 + (i % 4) * 0.6,
}));

type Phase = "form" | "submitting" | "success";

export function AuthGate({ onDone }: { onDone: () => void }) {
  const t = useT();
  const nickname = useStore((s) => s.player.nickname);
  const [mode, setMode] = useState<AuthMode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("form");
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the success→shell timer if the gate unmounts first (no leak).
  useEffect(() => () => { if (doneTimer.current) clearTimeout(doneTimer.current); }, []);

  const switchMode = (next: AuthMode) => {
    if (phase !== "form" || next === mode) return;
    hapticTap();
    setMode(next);
    setError(null);
  };

  const submit = async () => {
    if (phase !== "form") return;
    const mail = email.trim();
    if (!EMAIL_RE.test(mail)) { hapticTap(); setError("invalidEmail"); return; }
    if (mode === "signup" && password.length < 8) { hapticTap(); setError("shortPassword"); return; }
    if (password.length === 0) { hapticTap(); setError("invalid_credentials"); return; }
    setError(null);
    setPhase("submitting");
    const res = await authenticate(mode, mail, password);
    if (res.ok) {
      hapticMatchWin();
      setPhase("success");
      // Hold the celebration long enough to land — longer for the signup bonus
      // reveal, shorter for a returning login.
      doneTimer.current = setTimeout(onDone, mode === "signup" ? 2400 : 1600);
    } else {
      hapticTap();
      // The identity already has an account (re-signup after a wipe) — guide the
      // player to the login tab instead of leaving them stuck on signup.
      if (res.code === "already_linked") setMode("login");
      setError(res.code);
      setPhase("form");
    }
  };

  const errorMsg = error ? t(`auth.err.${error}`) : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="fixed inset-0 z-30 flex items-center justify-center overflow-y-auto px-4 py-6"
      style={{
        background:
          "radial-gradient(135% 95% at 50% -8%, #2c1150 0%, #170b30 40%, #0a0614 74%, #07040f 100%)",
      }}
    >
      {/* Halo + twinkles — no blur, opacity-only animation. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-[12%] h-1/2 w-[130%] -translate-x-1/2"
          style={{ background: "radial-gradient(50% 60% at 50% 0%, rgba(217,70,239,0.20), transparent 70%)" }}
        />
        {STARS.map((s, i) => (
          <motion.span
            key={i}
            className="absolute rounded-full bg-white"
            style={{ top: `${s.top}%`, left: `${s.left}%`, width: s.size, height: s.size, willChange: "opacity" }}
            animate={{ opacity: [0.12, 0.7, 0.12] }}
            transition={{ duration: s.dur, delay: s.delay, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>

      <motion.div
        initial={{ scale: 0.94, y: 14, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
        className="relative my-auto w-full max-w-sm overflow-hidden rounded-3xl border border-fuchsia-400/30"
        style={{
          background: "linear-gradient(180deg, rgba(42,23,70,0.94), rgba(16,10,30,0.97))",
          boxShadow: "0 24px 70px -16px rgba(192,38,211,0.5)",
        }}
      >
        <div className="flex flex-col gap-4 p-6">
          <AnimatePresence mode="wait">
            {phase === "success" ? (
              <SuccessView key="ok" mode={mode} nickname={nickname} t={t} />
            ) : (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-4">
                <header className="text-center">
                  <div className="mx-auto mb-2 text-3xl" style={{ filter: "drop-shadow(0 0 12px rgba(217,70,239,0.6))" }}>✦</div>
                  <h1 className="text-xl font-black leading-tight text-ink">
                    {t(mode === "signup" ? "auth.title.signup" : "auth.title.login")}
                  </h1>
                  <p className="mt-1 text-xs text-ink-muted">
                    {t(mode === "signup" ? "auth.subtitle.signup" : "auth.subtitle.login")}
                  </p>
                </header>

                <div className="grid grid-cols-2 gap-1 rounded-2xl bg-white/5 p-1 ring-1 ring-white/10">
                  <TabButton active={mode === "login"} onClick={() => switchMode("login")}>{t("auth.tab.login")}</TabButton>
                  <TabButton active={mode === "signup"} onClick={() => switchMode("signup")}>{t("auth.tab.signup")}</TabButton>
                </div>

                <AnimatePresence initial={false}>
                  {mode === "signup" && (
                    <motion.div key="bonus" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <BonusBanner t={t} />
                    </motion.div>
                  )}
                </AnimatePresence>

                <form className="flex flex-col gap-3" onSubmit={(ev) => { ev.preventDefault(); void submit(); }}>
                  <Field
                    label={t("auth.email")} type="email" value={email} onChange={setEmail}
                    placeholder={t("auth.emailPlaceholder")} autoComplete="email" disabled={phase === "submitting"}
                  />
                  <Field
                    label={t("auth.password")} type={showPassword ? "text" : "password"} value={password} onChange={setPassword}
                    placeholder={t("auth.passwordPlaceholder")} autoComplete={mode === "signup" ? "new-password" : "current-password"} disabled={phase === "submitting"}
                    trailing={
                      <button type="button" onClick={() => setShowPassword((v) => !v)} className="px-1 text-[11px] font-bold uppercase tracking-wider text-ink-faint transition hover:text-ink">
                        {t(showPassword ? "auth.hide" : "auth.show")}
                      </button>
                    }
                  />

                  {errorMsg && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                      {errorMsg}
                    </motion.p>
                  )}

                  <button
                    type="submit" disabled={phase === "submitting"}
                    className="relative mt-1 rounded-xl py-3 text-sm font-black uppercase tracking-wider text-white shadow-lg transition active:scale-[0.98] disabled:opacity-70"
                    style={{
                      background: "linear-gradient(90deg, var(--theme-primary), var(--theme-secondary))",
                      boxShadow: "0 10px 28px -8px color-mix(in oklab, var(--theme-primary) 60%, transparent)",
                    }}
                  >
                    {phase === "submitting" ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        {t("auth.submitting")}
                      </span>
                    ) : t(mode === "signup" ? "auth.submit.signup" : "auth.submit.login")}
                  </button>
                </form>

                {/* Footer only in the editable form — hidden mid-submit so the
                    "guest" exit can't unmount an in-flight auth. */}
                {phase === "form" && (
                  <div className="flex flex-col items-center gap-2 pt-1">
                    <button onClick={() => switchMode(mode === "signup" ? "login" : "signup")} className="text-xs text-ink-muted transition hover:text-ink">
                      {t(mode === "signup" ? "auth.switch.toLogin" : "auth.switch.toSignup")}
                    </button>
                    <button onClick={() => { hapticTap(); onDone(); }} className="text-[11px] text-ink-faint underline underline-offset-2 transition hover:text-ink-muted">
                      {t("auth.guest")}
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

function BonusBanner({ t }: { t: (k: string) => string }) {
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

function Field({
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

function SuccessView({
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
        className="relative flex h-16 w-16 items-center justify-center rounded-full text-3xl text-white"
        style={{
          background: "linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))",
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
