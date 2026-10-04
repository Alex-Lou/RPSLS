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
import { authenticate, signInWithGoogle, isGoogleAvailable, type AuthMode } from "../online/accountAuth";
import { useStore } from "../store/store";
import { SparkleGlyph } from "../icons";
import { TabButton, GoogleGlyph, BonusBanner, Field, SuccessView } from "./AuthGateParts";

// Montants du cadeau de bienvenue — SOURCE UNIQUE dans economy.ts
// (`WELCOME_BONUS`), lue aussi par le serveur via economy_meta.json. AuthGate ne
// fait que les afficher (plus de littéral dupliqué côté client).
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

  const googleSignIn = async () => {
    if (phase !== "form") return;
    setError(null);
    setPhase("submitting");
    const res = await signInWithGoogle();
    if (res.ok) {
      hapticMatchWin();
      setPhase("success");
      doneTimer.current = setTimeout(onDone, mode === "signup" ? 2400 : 1600);
    } else {
      hapticTap();
      // "cancelled" = the user backed out of the Google sheet — not an error.
      if (res.code !== "cancelled") setError(res.code);
      setPhase("form");
    }
  };

  // Code serveur inattendu → texte générique plutôt que la clé brute.
  const errorText = error ? t(`auth.err.${error}`) : null;
  const errorMsg = errorText && errorText.startsWith("auth.err.") ? t("auth.err.unknown") : errorText;

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
                  <div className="mx-auto mb-2 text-fuchsia-300" style={{ filter: "drop-shadow(0 0 12px rgba(217,70,239,0.6))" }}><SparkleGlyph className="w-8 h-8 mx-auto" /></div>
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

                {/* Sign in with Google — shown once a token provider is wired
                    (generic web-OAuth now; Play Games later = swap the provider).
                    Hidden until then, so never a dead button. */}
                {phase === "form" && isGoogleAvailable() && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                      <span className="h-px flex-1 bg-white/10" />
                      {t("auth.or")}
                      <span className="h-px flex-1 bg-white/10" />
                    </div>
                    <button
                      type="button"
                      onClick={() => void googleSignIn()}
                      className="flex items-center justify-center gap-2.5 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-bold text-ink transition hover:bg-white/10 active:scale-[0.98]"
                    >
                      <GoogleGlyph />
                      {t("auth.google")}
                    </button>
                  </div>
                )}

                {/* Footer only in the editable form — hidden mid-submit so the
                    "guest" exit can't unmount an in-flight auth. */}
                {phase === "form" && (
                  <div className="flex flex-col items-center gap-2 pt-1">
                    <button onClick={() => switchMode(mode === "signup" ? "login" : "signup")} className="text-xs text-ink-muted transition hover:text-ink">
                      {t(mode === "signup" ? "auth.switch.toLogin" : "auth.switch.toSignup")}
                    </button>
                    {/* Cible tactile ≥ 44 px (avant : lien 11 px quasi intouchable). */}
                    <button onClick={() => { hapticTap(); onDone(); }} className="min-h-[44px] px-4 inline-flex items-center text-xs text-ink-muted underline underline-offset-2 transition hover:text-ink">
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
