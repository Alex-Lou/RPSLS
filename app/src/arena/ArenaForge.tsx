/**
 * ArenaForge — la case de FUSION (« ⚗️ Forge ») d'un camp + son éclat de
 * fusion. Extrait de ArenaBoard (2026-06-13, « au fil de l'eau » : on dégraisse
 * le fichier qu'on touche sous 400 lignes). Purement présentationnel : toute la
 * mécanique dépôt/fusion/reprise vit dans ArenaGame (depositOrFuse).
 *
 * RÈGLE DE LISIBILITÉ (Alex « forge pas claire ») : l'étiquette ANNONCE
 * l'action — Déposer / Fusion ✦ / Reprendre ↩ / Forge. Dépôt, fusion ET reprise
 * d'un simple dépôt GRATUITS ; seule la RÉCUP d'une carte FUSIONNÉE coûte
 * FORGE_RECOVER_COST mana (Alex 2026-06-13, option B : empêchement + fenêtre de
 * vol Razzia), affiché dans l'étiquette ; le coût de la carte fusionnée se paie
 * en plus à sa pose.
 */

import { AnimatePresence, motion } from "motion/react";
import { CardImage } from "../ranked/CardImage";
import { FORGE_RECOVER_COST } from "./arenaTypes";
import type { CardId } from "../ranked/rankedTypes";

/** ⚗️ FORGE SLOT — la 4e case de chaque joueur (bande centrale du pad).
 *  Vide : alambic en pointillés (pulse ambre quand un dépôt est possible).
 *  Occupée : mini-carte visible des DEUX camps ; côté joueur, pulse OR
 *  quand la carte sélectionnée en main est un partenaire de fusion.
 *  Flash blanc→ambre à la fusion (flashKey). Transform/opacity only. */
export function ForgeSlot({
  card, mine, onTap, highlight = null, flashKey = null, forged = false,
}: {
  card: CardId | null;
  mine: boolean;
  onTap?: () => void;
  highlight?: "deposit" | "fuse" | null;
  flashKey?: number | null;
  /** La carte présente est une FUSION terminée (à récupérer) → halo or +
   *  libellé « ✨ Récupérer ». Statique (aucune boucle infinie). */
  forged?: boolean;
}) {
  const Tag = mine && onTap ? "button" : "div";
  return (
    <Tag
      {...(mine && onTap ? { onClick: onTap, type: "button" as const } : {})}
      {...(mine ? { "data-arena-forge": "you" } : {})}
      className="relative shrink-0 w-9 h-12 rounded-md overflow-visible"
      aria-label={mine ? "Forge (dépôt / fusion / reprise)" : "Forge adverse"}
    >
      {/* Halo OR statique d'une carte FORGÉE à récupérer (pas de pulse infini). */}
      {mine && forged && !highlight && (
        <div
          className="absolute -inset-1 rounded-lg pointer-events-none"
          style={{ boxShadow: "0 0 12px 2px rgba(252,211,77,0.55)", border: "1px solid rgba(252,211,77,0.7)" }}
        />
      )}
      {/* Halo de zone de drop (TA forge) : grandit quand un partenaire de fusion
       *  est sélectionné/glissé → cible plus facile à viser (Alex 2026-06-13). */}
      {mine && highlight && (
        <motion.div
          className="absolute -inset-2 rounded-lg pointer-events-none"
          initial={false}
          animate={{ opacity: highlight === "fuse" ? [0.25, 0.6, 0.25] : [0.15, 0.4, 0.15] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
          style={{ border: `1.5px dashed ${highlight === "fuse" ? "rgba(252,211,77,0.9)" : "rgba(232,121,249,0.7)"}` }}
        />
      )}
      <motion.div
        animate={
          highlight === "fuse"
            ? { scale: [1, 1.12, 1], boxShadow: ["0 0 0px rgba(252,211,77,0)", "0 0 16px rgba(252,211,77,0.95)", "0 0 0px rgba(252,211,77,0)"] }
            : highlight === "deposit"
            ? { scale: [1, 1.06, 1], boxShadow: ["0 0 0px rgba(232,121,249,0)", "0 0 10px rgba(232,121,249,0.7)", "0 0 0px rgba(232,121,249,0)"] }
            : { scale: 1, boxShadow: "0 0 0px transparent" }
        }
        transition={highlight ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
        className={
          "w-full h-full rounded-md overflow-hidden flex items-center justify-center " +
          (card
            ? "ring-2 " + (mine ? (forged ? "ring-amber-300" : "ring-fuchsia-300/80") : "ring-rose-300/60")
            : "border-2 border-dashed " + (mine ? "border-fuchsia-400/50" : "border-zinc-600/50"))
        }
        style={{ background: card ? "rgba(10,12,20,0.9)" : "rgba(10,12,20,0.45)" }}
      >
        {card ? (
          // Pop de DÉPÔT : la carte « atterrit » sur la forge (spring scale/rotate).
          <motion.div
            key={`forge-card-${card}`}
            initial={{ scale: 0.45, rotate: -14, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 460, damping: 22 }}
            className="w-full h-full"
          >
            <CardImage id={card} glyphSize="text-sm" />
          </motion.div>
        ) : (
          <span className={"text-[13px] " + (mine ? "opacity-70" : "opacity-30")} aria-hidden>⚗️</span>
        )}
      </motion.div>
      {/* Burst de FUSION — multi-couches (cœur + onde + étincelles + glyphe). */}
      <AnimatePresence>
        {flashKey && <FusionBurst key={`forge-burst-${flashKey}`} />}
      </AnimatePresence>
      {/* Étiquette DYNAMIQUE (Alex 2026-06-13) — la forge « pas claire du
       *  tout » devient lisible sans tuto : elle ANNONCE l'action possible.
       *   • partenaire sélectionné  → « Fusion ✦ »
       *   • carte sélectionnée, forge vide → « Déposer »
       *   • carte posée, rien en main → « Reprendre ↩ » (le dépôt EST
       *     repreneable — tape la forge à vide pour récupérer ta carte)
       *   • sinon → « Forge ». Dépôt GRATUIT (0 mana) ; seul le coût de la
       *     carte fusionnée se paie à sa pose. */}
      {(() => {
        // SEULE la carte FUSIONNÉE coûte à la récup (option B, Alex 2026-06-13) :
        // le coût est ANNONCÉ dans l'étiquette « ✨ Récupérer ·1◆ ». Reprendre un
        // simple dépôt reste gratuit → pas de coût affiché.
        const recover = ` ·${FORGE_RECOVER_COST}◆`;
        const label = !mine ? "Forge" : highlight === "fuse" ? "Fusion ✦" : highlight === "deposit" ? "Déposer" : forged ? `✨ Récupérer${recover}` : card ? "↩ Reprendre" : "Forge";
        // « Reprendre / Récupérer » : petit ENCADRÉ-bouton juste sous la carte
        // (Alex 2026-06-13) → on voit que la forge est tappable pour récupérer.
        const isReprise = mine && !!card && !highlight;
        return isReprise ? (
          <span className={"absolute -bottom-4 left-1/2 -translate-x-1/2 px-1.5 py-[1px] rounded border text-[7px] uppercase tracking-wider font-black whitespace-nowrap shadow-sm " + (forged ? "bg-amber-500/30 border-amber-300/80 text-amber-50" : "bg-emerald-500/25 border-emerald-300/70 text-emerald-50")}>
            {label}
          </span>
        ) : (
          <span className={"absolute -bottom-3 left-1/2 -translate-x-1/2 text-[7px] uppercase tracking-wider font-black whitespace-nowrap " + (!mine ? "text-zinc-500" : highlight === "fuse" ? "text-amber-300" : highlight === "deposit" ? "text-fuchsia-200" : "text-fuchsia-300/80")}>
            {label}
          </span>
        );
      })()}
    </Tag>
  );
}

/** ⚗️ FUSION BURST — séquence en 4 temps (Alex 2026-06-13 « DE LA VRAIE ANIM,
 *  une IMPLOSION colorée, du vent, du mouvement, BOUM, puis lumière, puis la
 *  nouvelle carte avec paillettes très petites mais présentes ») :
 *    1. IMPLOSION — 14 particules colorées ASPIRÉES vers le centre + tourbillon
 *       (vent) conique qui se CONTRACTE ;
 *    2. BOUM — flash de collision au point de convergence (~0.45) ;
 *    3. LUMIÈRE — bloom blanc bref + 2 ondes de choc ;
 *    4. PAILLETTES — 22 micro-étincelles qui radient + scintillent + glyphe ✦.
 *  100% transform/opacity + screen → fluide WebView. ONE-SHOT (aucun
 *  repeat:Infinity, AnimatePresence démonte) → zéro coût en idle. */
function FusionBurst() {
  const IMPLODE = Array.from({ length: 14 }, (_, i) => i);
  const SPARKLES = Array.from({ length: 22 }, (_, i) => i);
  const ang = (i: number, n: number) => ((360 / n) * i + (i % 2) * 13) * (Math.PI / 180);
  return (
    <div className="absolute -inset-4 pointer-events-none" aria-hidden>
      {/* ── 1. IMPLOSION — particules colorées ASPIRÉES vers le centre ── */}
      {IMPLODE.map((i) => {
        const a = ang(i, 14);
        const r = 38 + (i % 3) * 6;
        const fuchsia = i % 2 === 0;
        return (
          <motion.span
            key={`im${i}`}
            initial={{ opacity: 0, x: Math.cos(a) * r, y: Math.sin(a) * r, scale: 1.3 }}
            animate={{ opacity: [0, 1, 1, 0], x: [Math.cos(a) * r, 0, 0], y: [Math.sin(a) * r, 0, 0], scale: [1.3, 0.4, 0] }}
            transition={{ duration: 0.5, ease: "easeIn", times: [0, 0.25, 0.45, 0.5], delay: (i % 4) * 0.015 }}
            className="absolute left-1/2 top-1/2 w-1.5 h-1.5 -ml-[3px] -mt-[3px] rounded-full"
            style={{ background: fuchsia ? "#f0abfc" : "#fcd34d", boxShadow: fuchsia ? "0 0 7px #e879f9" : "0 0 7px #fbbf24" }}
          />
        );
      })}
      {/* VENT — tourbillon conique qui se CONTRACTE vers le centre */}
      <motion.div
        initial={{ opacity: 0, rotate: 0, scale: 2 }}
        animate={{ opacity: [0, 0.8, 0.9, 0], rotate: 230, scale: [2, 0.7, 0.2] }}
        transition={{ duration: 0.5, ease: "easeIn", times: [0, 0.3, 0.45, 1] }}
        className="absolute inset-0 rounded-full"
        style={{ background: "conic-gradient(from 0deg, transparent, rgba(232,121,249,0.85), transparent, rgba(252,211,77,0.85), transparent)", mixBlendMode: "screen" }}
      />
      {/* ── 2. BOUM — flash de collision (au point de convergence ~0.45) ── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.1 }}
        animate={{ opacity: [0, 0, 1, 0], scale: [0.1, 0.1, 2.6, 3.4] }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.9, ease: "easeOut", times: [0, 0.45, 0.58, 1] }}
        className="absolute -inset-2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.98) 0%, rgba(252,211,77,0.75) 38%, transparent 70%)", mixBlendMode: "screen" }}
      />
      {/* ── 3. LUMIÈRE — bloom blanc bref + 2 ondes de choc ── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.2 }}
        animate={{ opacity: [0, 0, 0.95, 0], scale: [0.2, 0.2, 1.4, 2] }}
        transition={{ duration: 0.85, ease: "easeOut", times: [0, 0.45, 0.55, 1] }}
        className="absolute inset-0 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.95), transparent 60%)", mixBlendMode: "screen" }}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.3 }}
        animate={{ opacity: [0, 0, 0.9, 0], scale: [0.3, 0.3, 2.9, 3.6] }}
        transition={{ duration: 0.9, ease: "easeOut", times: [0, 0.45, 0.6, 1] }}
        className="absolute inset-0 rounded-full border-2 border-amber-200/90"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.3 }}
        animate={{ opacity: [0, 0, 0.75, 0], scale: [0.3, 0.3, 2.2, 2.9] }}
        transition={{ duration: 0.95, ease: "easeOut", times: [0, 0.5, 0.68, 1] }}
        className="absolute inset-0 rounded-full border border-fuchsia-200/80"
      />
      {/* ── 4. PAILLETTES — 22 micro-étincelles qui radient + scintillent ── */}
      {SPARKLES.map((i) => {
        const a = ang(i, 22);
        const r = 30 + (i % 4) * 12;
        return (
          <motion.span
            key={`sp${i}`}
            initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
            animate={{ opacity: [0, 0, 1, 0], x: [0, 0, Math.cos(a) * r], y: [0, 0, Math.sin(a) * r], scale: [0, 0, 1, 0.2] }}
            transition={{ duration: 0.75, ease: "easeOut", times: [0, 0.45, 0.62, 1], delay: (i % 5) * 0.015 }}
            className="absolute left-1/2 top-1/2 w-[3px] h-[3px] -ml-[1.5px] -mt-[1.5px] rounded-full bg-amber-50"
            style={{ boxShadow: "0 0 4px rgba(252,211,77,0.95)" }}
          />
        );
      })}
      {/* Glyphe ✦ qui jaillit du cœur */}
      <motion.span
        initial={{ opacity: 0, scale: 0.2, rotate: -40 }}
        animate={{ opacity: [0, 0, 1, 0], scale: [0.2, 0.2, 1.7, 2.4], rotate: [-40, -40, 0, 12] }}
        transition={{ duration: 0.95, ease: "easeOut", times: [0, 0.48, 0.72, 1] }}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-amber-50 text-lg font-black"
        style={{ textShadow: "0 0 10px rgba(252,211,77,0.95)" }}
      >
        ✦
      </motion.span>
    </div>
  );
}
