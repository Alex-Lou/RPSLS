import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "./store";
import { levelFromXp } from "./leveling";
import { useT } from "./i18n";
import { hapticMatchWin } from "./haptic";

/**
 * LevelUpOverlay — modular celebration choreographed from 4 clean PNG
 * elements that Alex regenerated on transparent backgrounds:
 *
 *   /LevelUp/core.png   — glowing solar orb (warm centre flash)
 *   /LevelUp/jets.png   — radial 16-ray red+gold star (the "jets")
 *   /LevelUp/sparks.png — scattered golden sparks (debris field)
 *   /LevelUp/star_gold.png — 5-point golden star (centrepiece)
 *
 * On top of that we still drop a ~60-piece swirl of small confetti / ribbon
 * / crystal sprites flying out radially with a gravity arc, so the burst
 * has both the structured radial burst (jets/core/sparks) AND the loose
 * particles that drift away.
 *
 * Choreography (total ~2.8s):
 *   0.00s  banner card pre-mounts (scale 0.4, opacity 0)
 *   0.00s  core pops in (scale 0 → 1 → 1.5, blend screen)
 *   0.05s  jets emerge behind (scale 0 → 1.15, slow rotate)
 *   0.10s  sparks burst outward (scale 0.4 → 1.4, counter-rotate)
 *   0.15s  star centrepiece spring-bounces in, starts looping spin
 *   0.15s  banner card spring-bounces into position
 *   0.20s  60 confetti/ribbon/crystal particles spray radially
 *   1.60s  core, jets, sparks begin fade
 *   2.40s  particles done
 *   2.80s  banner fades out (handled by AnimatePresence in parent)
 */

type SpriteKind =
  | "confetti_violet" | "confetti_teal"
  | "ribbon"          | "crystal"
  | "sparkle"         | "beam";

interface SpriteDef {
  src: string;
  baseSize: number;
  /** When true, additively blend so dark pixels disappear. */
  screen?: boolean;
  weight: number;
}

const SPRITES: Record<SpriteKind, SpriteDef> = {
  confetti_violet: { src: "/LevelUp/confetti_violet.png", baseSize: 40, weight: 5 },
  confetti_teal:   { src: "/LevelUp/confetti_teal.png",   baseSize: 40, weight: 5 },
  ribbon:          { src: "/LevelUp/ribbon.png",          baseSize: 76, weight: 3 },
  crystal:         { src: "/LevelUp/crystal.png",         baseSize: 56, weight: 2 },
  sparkle:         { src: "/LevelUp/sparkle.png",         baseSize: 64, screen: true, weight: 3 },
  beam:            { src: "/LevelUp/beam.png",            baseSize: 110, screen: true, weight: 1 },
};

const SPRITE_KINDS = Object.keys(SPRITES) as SpriteKind[];
const SPRITE_BAG: SpriteKind[] = SPRITE_KINDS.flatMap(
  (k) => Array.from({ length: SPRITES[k].weight }, () => k),
);

interface Particle {
  id: number;
  kind: SpriteKind;
  vx: number;
  vy: number;
  ay: number;
  rotStart: number;
  rotEnd: number;
  scale: number;
  delay: number;
  duration: number;
}

const PARTICLE_COUNT = 56;
const TOTAL_DURATION_S = 2.8;

/** Mount the celebration whenever the player crosses a level threshold. */
export function LevelUpWatcher() {
  const xp = useStore((s) => s.player.xp);
  const level = levelFromXp(xp).level;
  const prev = useRef(level);
  const [celebrate, setCelebrate] = useState<number | null>(null);

  useEffect(() => {
    if (level > prev.current) {
      setCelebrate(level);
      hapticMatchWin();
      const id = window.setTimeout(() => setCelebrate(null), TOTAL_DURATION_S * 1000 + 200);
      prev.current = level;
      return () => window.clearTimeout(id);
    }
    prev.current = level;
  }, [level]);

  return (
    <AnimatePresence>
      {celebrate !== null && <LevelUpOverlay level={celebrate} />}
    </AnimatePresence>
  );
}

export function LevelUpOverlay({ level }: { level: number }) {
  const t = useT();

  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const kind = SPRITE_BAG[Math.floor(Math.random() * SPRITE_BAG.length)];
      // Full 360° spread biased slightly upward.
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.6;
      const speed = 180 + Math.random() * 360;
      return {
        id: i,
        kind,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        ay: 260 + Math.random() * 140,
        rotStart: Math.random() * 360,
        rotEnd: Math.random() * 720 - 360 + Math.random() * 360,
        scale: 0.7 + Math.random() * 0.8,
        delay: 0.18 + Math.random() * 0.22,
        duration: 2.0 + Math.random() * 0.6,
      };
    });
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none overflow-hidden"
    >
      {/* LAYER 1 — CORE: glowing solar orb, screen-blended, scales up then
          expands into a soft halo. This is the "flash" of the explosion. */}
      <motion.img
        src="/LevelUp/core.png"
        alt=""
        draggable={false}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.0, 1.5, 1.7], opacity: [0, 1, 0.7, 0] }}
        transition={{
          duration: 2.0,
          ease: [0.16, 1, 0.3, 1],
          times: [0, 0.18, 0.6, 1],
        }}
        style={{
          position: "absolute",
          width: "min(70vw, 460px)",
          height: "min(70vw, 460px)",
          mixBlendMode: "screen",
          pointerEvents: "none",
          willChange: "transform, opacity",
        }}
      />

      {/* LAYER 2 — JETS: 16 radial red rays. Screen-blend over core. Slight
          slow rotation so the rays feel alive, not frozen. */}
      <motion.img
        src="/LevelUp/jets.png"
        alt=""
        draggable={false}
        initial={{ scale: 0, opacity: 0, rotate: 0 }}
        animate={{
          scale: [0, 1.15, 1.05, 1.25],
          opacity: [0, 1, 1, 0],
          rotate: [0, 18],
        }}
        transition={{
          duration: 2.4,
          delay: 0.05,
          ease: [0.16, 1, 0.3, 1],
          scale:   { times: [0, 0.2, 0.5, 1] },
          opacity: { times: [0, 0.15, 0.65, 1] },
          rotate:  { duration: 2.4, ease: "linear" },
        }}
        style={{
          position: "absolute",
          width: "min(88vw, 600px)",
          height: "min(88vw, 600px)",
          mixBlendMode: "screen",
          pointerEvents: "none",
          willChange: "transform, opacity",
          filter: "drop-shadow(0 0 24px rgba(255, 88, 88, 0.4))",
        }}
      />

      {/* LAYER 3 — SPARKS: scattered golden debris. Burst outward with a
          counter-rotation to add depth — eye reads it as separate from the
          jets even though it occupies the same radial space. */}
      <motion.img
        src="/LevelUp/sparks.png"
        alt=""
        draggable={false}
        initial={{ scale: 0.4, opacity: 0, rotate: 0 }}
        animate={{
          scale: [0.4, 1.0, 1.4],
          opacity: [0, 1, 0],
          rotate: [0, -12],
        }}
        transition={{
          duration: 2.4,
          delay: 0.10,
          ease: [0.22, 0.9, 0.4, 1],
          scale:   { times: [0, 0.35, 1] },
          opacity: { times: [0, 0.25, 1] },
        }}
        style={{
          position: "absolute",
          width: "min(95vw, 660px)",
          height: "min(95vw, 660px)",
          mixBlendMode: "screen",
          pointerEvents: "none",
          willChange: "transform, opacity",
        }}
      />

      {/* LAYER 4 — particle field: small confetti / ribbon / crystal flying
          out radially with gravity arc. These are the "loose" debris. */}
      {particles.map((p) => {
        const def = SPRITES[p.kind];
        const t = p.duration;
        const finalX = p.vx * t;
        const finalY = p.vy * t + 0.5 * p.ay * t * t;
        return (
          <motion.img
            key={p.id}
            src={def.src}
            alt=""
            draggable={false}
            initial={{ x: 0, y: 0, rotate: p.rotStart, opacity: 0, scale: 0 }}
            animate={{
              x: finalX,
              y: finalY,
              rotate: p.rotEnd,
              opacity: [0, 1, 1, 0],
              scale: [0, p.scale, p.scale, p.scale * 0.6],
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              ease: [0.25, 0.6, 0.4, 1],
              opacity: { times: [0, 0.06, 0.75, 1] },
              scale:   { times: [0, 0.12, 0.75, 1] },
            }}
            style={{
              position: "absolute",
              width: def.baseSize,
              height: def.baseSize,
              left: "50%",
              top: "50%",
              marginLeft: -def.baseSize / 2,
              marginTop: -def.baseSize / 2,
              mixBlendMode: def.screen ? "screen" : "normal",
              willChange: "transform, opacity",
              pointerEvents: "none",
            }}
          />
        );
      })}

      {/* LAYER 5 — banner card with the gold-star centrepiece. Springs in
          slightly after the burst so the eye reads "explosion → REVEAL". */}
      <motion.div
        initial={{ scale: 0.4, opacity: 0, y: 14 }}
        animate={{ scale: [0.4, 1.15, 1], opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{
          delay: 0.15,
          type: "spring",
          stiffness: 260,
          damping: 16,
        }}
        className="relative flex flex-col items-center gap-2 px-9 py-6 rounded-3xl bg-zinc-950/85 backdrop-blur-md border border-amber-400/40 shadow-2xl shadow-amber-900/40"
      >
        {/* Star sprite — looping slow spin, with warm drop-shadow halo. */}
        <motion.img
          src="/LevelUp/star_gold.png"
          alt=""
          draggable={false}
          animate={{ rotate: 360 }}
          transition={{ rotate: { duration: 4, ease: "linear", repeat: Infinity } }}
          style={{
            width: 84,
            height: 84,
            filter:
              "drop-shadow(0 0 18px rgba(251, 191, 36, 0.85)) " +
              "drop-shadow(0 0 32px rgba(244, 114, 182, 0.45))",
          }}
        />
        <div className="text-2xl font-black tracking-[0.18em] bg-gradient-to-br from-amber-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
          {t("levelup.title")}
        </div>
        <div className="text-sm font-bold text-zinc-200">{t("levelup.reached", { n: level })}</div>
      </motion.div>
    </motion.div>
  );
}
