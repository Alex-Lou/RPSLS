import { type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, type Transition } from "motion/react";

/**
 * ModalShell — the shared backdrop overlay for the app's dialogs.
 *
 * Every modal repeated the same outer layer: a full-screen fixed overlay that
 * fades in, dims + blurs the page, and closes on a backdrop click. This factors
 * that out — plus the optional Esc-to-close, a portal-to-<body> escape from
 * parent stacking contexts, and dialog a11y — so each modal only writes its own
 * panel. The visual knobs (z / padding / backdrop tint) are props so each caller
 * keeps its EXACT look: this is a behaviour-preserving extraction, not a restyle.
 *
 * The PANEL (the card itself, with its spring + bespoke styling) stays in each
 * modal as `children`; they differ too much to share (a gold premium card vs a
 * plain surface dialog). `ModalShell` is also the natural future home for a
 * focus-trap, which today none of the modals have.
 */
export function ModalShell({
  onClose,
  children,
  z = "z-[90]",
  padding = "p-6",
  backdrop = "bg-black/70",
  overlayTransition,
  portal = false,
  closeOnEscape = false,
  dialog = false,
  aside,
}: {
  /** Fired on backdrop click and (when `closeOnEscape`) on Escape. */
  onClose: () => void;
  /** The modal panel (the card). */
  children: ReactNode;
  /** Stacking order (Tailwind z class). */
  z?: string;
  /** Padding around the panel (Tailwind). */
  padding?: string;
  /** Backdrop tint (Tailwind bg). `backdrop-blur-sm` is always applied. */
  backdrop?: string;
  /** Optional framer transition for the backdrop fade (default = spring). */
  overlayTransition?: Transition;
  /** Render into a portal at <body> — escapes parent stacking contexts. */
  portal?: boolean;
  /** Close when Escape is pressed. */
  closeOnEscape?: boolean;
  /** Tag the overlay as an accessible modal dialog (role + aria-modal). */
  dialog?: boolean;
  /** Extra node rendered inside the overlay BEFORE the panel — e.g. a
   *  full-screen celebration layer that must sit above the page yet as a
   *  sibling of the card (so it isn't clipped to the card). */
  aside?: ReactNode;
}) {
  useEffect(() => {
    if (!closeOnEscape) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeOnEscape, onClose]);

  const overlay = (
    <motion.div
      role={dialog ? "dialog" : undefined}
      aria-modal={dialog || undefined}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={overlayTransition}
      onClick={onClose}
      className={`fixed inset-0 ${z} flex items-center justify-center ${padding} ${backdrop} backdrop-blur-sm`}
    >
      {aside}
      {children}
    </motion.div>
  );

  return portal ? createPortal(overlay, document.body) : overlay;
}
