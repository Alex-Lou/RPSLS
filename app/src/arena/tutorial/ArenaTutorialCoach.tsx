/**
 * ArenaTutorialCoach — le « projecteur » du tutoriel Arena Pro.
 *
 * Par-dessus la VRAIE partie (ArenaGame en mode tuto) :
 *  - assombrit l'écran sauf un trou arrondi sur l'élément à toucher ;
 *  - bloque tous les touchers hors du trou (la bulle tremble pour le dire) ;
 *  - bulle d'explication + doigt animé + progression du tour ;
 *  - pendant la résolution, se retire et laisse une légende courte en haut.
 *
 * État : les étapes « info » vues (acked) sont locales ; tout le reste est
 * DÉRIVÉ de l'intent / du ciblage de la partie → aucune désynchro possible
 * entre ce que dit le coach et ce qui est posé. Filet : un coup hors script
 * (glisser sur la mauvaise voie…) est retiré via onRepairIntent.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useAnimationControls } from "motion/react";
import { useT } from "../../i18n";
import { hapticTap } from "../../haptic";
import { OPENING_TURNS, type ArenaTargeting, type TurnIntent } from "../arenaTypes";
import { TUTORIAL_LAST_TURN, sanitizeTutorialIntent } from "./tutorialScript";
import { TUTORIAL_RESOLVE_CAPTION, TUTORIAL_STEPS, type TutStep } from "./tutorialSteps";
import { useTargetRect, type Rect } from "./useTargetRect";

const PAD = 6;            // marge du trou autour de la cible
const BUBBLE_MAX_W = 340;
const GUTTER = 16;
const INFO_MIN_MS = 450;  // anti double-tap : une bulle info ne se ferme pas avant
/** Au-dessus de TOUT le plateau (cartes en éventail z-70, strip adverse z-55,
 *  burger) pour que seule la cible soit touchable ; sous la confirmation de
 *  sortie (z-95) et la fiche carte (z-10000), qui restent utilisables. */
const Z = 80;

/** Délai avant l'apparition du coach en début de tour : laisse le plateau se
 *  poser (popups −PV, recap) et, au tour des cartes, la chute de deck. */
function appearDelay(turn: number): number {
  if (turn === 1) return 450;
  if (turn === OPENING_TURNS + 1) return 2500;
  return 1100;
}

/** `**gras**` → segments mis en valeur (seule mise en forme des textes du tuto). */
function RichText({ text }: { text: string }) {
  const parts = text.split("**");
  return (
    <>
      {parts.map((p, i) => (i % 2 === 1
        ? <strong key={i} className="font-black" style={{ color: "#fcd34d" }}>{p}</strong>
        : <span key={i}>{p}</span>))}
    </>
  );
}

export function ArenaTutorialCoach({
  turn, planning, resolving, intent, targeting, onRepairIntent, onSkip,
}: {
  turn: number;
  /** board.phase === "planning" (faux en fin de match / mort subite). */
  planning: boolean;
  resolving: boolean;
  intent: TurnIntent;
  targeting: ArenaTargeting;
  onRepairIntent: (next: TurnIntent) => void;
  onSkip: () => void;
}) {
  const t = useT();
  const [acked, setAcked] = useState<ReadonlySet<string>>(() => new Set());
  const [readyTurn, setReadyTurn] = useState<number | null>(null);
  const shake = useAnimationControls();

  const idle = planning && !resolving;
  useEffect(() => {
    if (!idle) { setReadyTurn(null); return; }
    const id = window.setTimeout(() => setReadyTurn(turn), appearDelay(turn));
    return () => window.clearTimeout(id);
  }, [idle, turn]);
  const visible = idle && readyTurn === turn;

  const step: TutStep | null = useMemo(() => {
    if (!visible) return null;
    const ctx = { intent, targeting };
    return (TUTORIAL_STEPS[turn] ?? []).find((s) =>
      s.kind === "info" ? !acked.has(s.id) : !s.done?.(ctx)) ?? null;
  }, [visible, turn, intent, targeting, acked]);

  const rect = useTargetRect(step?.target ?? null);

  function nudge() {
    hapticTap();
    void shake.start({ x: [0, -9, 9, -6, 6, 0], transition: { duration: 0.35 } });
  }

  // Filet hors script : on retire le coup parasite et on le signale.
  useEffect(() => {
    if (!idle) return;
    const fixed = sanitizeTutorialIntent(turn, intent);
    if (fixed) { onRepairIntent(fixed); nudge(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent, turn, idle]);

  const shownAt = useRef(0);
  useEffect(() => { shownAt.current = Date.now(); }, [step?.id]);
  function ack() {
    if (!step || step.kind !== "info") return;
    if (Date.now() - shownAt.current < INFO_MIN_MS) return;
    hapticTap();
    setAcked((s) => new Set(s).add(step.id));
  }

  const caption = resolving ? TUTORIAL_RESOLVE_CAPTION[turn] : undefined;

  return createPortal(
    <>
      <AnimatePresence>
        {caption && (
          <motion.div
            key={`cap-${turn}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            // En BAS (zone joueur, inerte pendant la résolution) : en haut elle
            // masquait les PV du Mentor, qu'on regarde justement tomber.
            className="fixed inset-x-0 mx-auto w-fit pointer-events-none px-4 py-2 rounded-2xl bg-zinc-950/90 border border-amber-300/40 shadow-xl text-[13px] font-bold text-amber-100 text-center"
            style={{ zIndex: Z + 1, bottom: "calc(var(--sai-bottom) + 10px)", maxWidth: `min(${BUBBLE_MAX_W}px, calc(100vw - ${GUTTER * 2}px))` }}
          >
            <RichText text={t(caption)} />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {step && (
          <motion.div
            key="coach"
            // Conteneur transparent aux touchers : seuls le voile/les bandes et la
            // bulle captent — le TROU laisse passer vers le jeu.
            className="fixed inset-0 pointer-events-none"
            style={{ zIndex: Z }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <Spotlight
              rect={step.target ? rect : null}
              blockHole={step.kind === "info"}
              onBlockedTap={step.kind === "info" ? ack : nudge}
            />
            {step.kind === "action" && rect && <Finger rect={rect} />}
            <Bubble
              step={step}
              rect={step.target ? rect : null}
              turn={turn}
              shake={shake}
              onContinue={ack}
              onSkip={onSkip}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body,
  );
}

/** Voile sombre percé d'un trou arrondi + 4 bandes qui captent les touchers
 *  HORS du trou (le trou lui-même laisse passer vers le jeu). */
function Spotlight({ rect, blockHole, onBlockedTap }: { rect: Rect | null; blockHole: boolean; onBlockedTap: () => void }) {
  const spring = { type: "spring" as const, stiffness: 260, damping: 30 };
  if (!rect) {
    return <div className="absolute inset-0 pointer-events-auto bg-[rgba(3,6,20,0.72)]" onPointerDown={onBlockedTap} />;
  }
  const x = rect.x - PAD, y = rect.y - PAD, w = rect.w + PAD * 2, h = rect.h + PAD * 2;
  const band = "absolute bg-transparent pointer-events-auto";
  return (
    <>
      <motion.div
        aria-hidden
        className="absolute rounded-2xl pointer-events-none"
        initial={false}
        animate={{ left: x, top: y, width: w, height: h }}
        transition={spring}
        style={{ boxShadow: "0 0 0 200vmax rgba(3,6,20,0.7)" }}
      >
        <motion.div
          className="absolute inset-0 rounded-2xl"
          style={{ border: "2px solid rgba(252,211,77,0.95)", boxShadow: "0 0 22px 2px rgba(252,211,77,0.55)" }}
          animate={{ opacity: [0.55, 1, 0.55], scale: [1, 1.05, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>
      <div className={band} style={{ left: 0, top: 0, right: 0, height: Math.max(0, y) }} onPointerDown={onBlockedTap} />
      <div className={band} style={{ left: 0, top: y + h, right: 0, bottom: 0 }} onPointerDown={onBlockedTap} />
      <div className={band} style={{ left: 0, top: y, width: Math.max(0, x), height: h }} onPointerDown={onBlockedTap} />
      <div className={band} style={{ left: x + w, top: y, right: 0, height: h }} onPointerDown={onBlockedTap} />
      {/* Étape « info » : la cible est montrée, pas touchable. */}
      {blockHole && <div className={band} style={{ left: x, top: y, width: w, height: h }} onPointerDown={onBlockedTap} />}
    </>
  );
}

/** Doigt qui tapote la cible (au-dessus si la cible est en bas de l'écran). */
function Finger({ rect }: { rect: Rect }) {
  const below = rect.y + rect.h / 2 < window.innerHeight * 0.5;
  const cx = rect.x + rect.w / 2;
  const top = below ? rect.y + rect.h + 2 : rect.y - 40;
  return (
    <motion.div
      aria-hidden
      className="absolute pointer-events-none text-[32px] leading-none drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]"
      initial={false}
      animate={{ left: cx - 14, top, y: below ? [0, -8, 0] : [0, 8, 0] }}
      transition={{ left: { type: "spring", stiffness: 260, damping: 30 }, top: { type: "spring", stiffness: 260, damping: 30 }, y: { duration: 0.9, repeat: Infinity, ease: "easeInOut" } }}
    >
      {below ? "👆" : "👇"}
    </motion.div>
  );
}

function Bubble({
  step, rect, turn, shake, onContinue, onSkip,
}: {
  step: TutStep;
  rect: Rect | null;
  turn: number;
  shake: ReturnType<typeof useAnimationControls>;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const t = useT();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(BUBBLE_MAX_W, vw - GUTTER * 2);
  // Placement : centrée sans cible ; sinon du côté où il y a le plus de place,
  // à l'écart du doigt (40 px) pour ne jamais masquer la cible.
  let pos: React.CSSProperties = { left: (vw - w) / 2, top: vh * 0.3 };
  let arrowLeft: number | null = null;
  let arrowUp = false;
  if (rect) {
    const cx = rect.x + rect.w / 2;
    const left = Math.min(Math.max(cx - w / 2, GUTTER), vw - w - GUTTER);
    arrowLeft = Math.min(Math.max(cx - left - 8, 18), w - 34);
    if (rect.y + rect.h / 2 < vh * 0.5) {
      pos = { left, top: rect.y + rect.h + PAD + (step.kind === "action" ? 44 : 14) };
      arrowUp = true;
    } else {
      pos = { left, bottom: vh - rect.y + PAD + (step.kind === "action" ? 44 : 14) };
    }
  }
  const steps = TUTORIAL_STEPS[turn] ?? [];
  const idx = steps.findIndex((s) => s.id === step.id);
  return (
    <motion.div className="absolute pointer-events-auto" style={{ ...pos, width: w }} animate={shake}>
      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          initial={{ opacity: 0, y: arrowUp ? -8 : 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="relative rounded-2xl bg-zinc-950/95 border border-amber-300/50 shadow-2xl px-4 pt-3 pb-3"
          style={{ boxShadow: "0 18px 40px -12px rgba(0,0,0,0.8), 0 0 24px -6px rgba(252,211,77,0.35)" }}
        >
          {arrowLeft !== null && (
            <span
              aria-hidden
              className="absolute w-4 h-4 rotate-45 bg-zinc-950 border-amber-300/50"
              style={{
                left: arrowLeft,
                ...(arrowUp
                  ? { top: -8, borderTopWidth: 1, borderLeftWidth: 1 }
                  : { bottom: -8, borderBottomWidth: 1, borderRightWidth: 1 }),
              }}
            />
          )}
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
                {t("tut.turn", { n: turn, total: TUTORIAL_LAST_TURN })}
              </span>
              <span className="flex gap-1" aria-hidden>
                {steps.map((s, i) => (
                  <span
                    key={s.id}
                    className="w-1.5 h-1.5 rounded-full transition-colors"
                    style={{ background: i < idx ? "rgba(252,211,77,0.9)" : i === idx ? "#fff" : "rgba(255,255,255,0.2)" }}
                  />
                ))}
              </span>
            </div>
            <button
              type="button"
              onClick={onSkip}
              className="text-[11px] font-bold text-zinc-400 px-2 py-1 -mr-2 rounded-lg active:bg-white/10"
            >
              {t("tut.skip")}
            </button>
          </div>
          <p className="text-[15px] leading-snug text-zinc-50">
            <RichText text={t(step.textKey)} />
          </p>
          {step.kind === "info" && (
            <div className="flex justify-end mt-2.5">
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={onContinue}
                className="px-4 py-2 rounded-xl text-sm font-black text-zinc-900"
                style={{ background: "linear-gradient(140deg, #fde68a 0%, #f59e0b 60%, #d97706 100%)" }}
              >
                {t("tut.continue")} ›
              </motion.button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
