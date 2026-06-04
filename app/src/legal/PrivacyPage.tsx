import { motion } from "motion/react";
import { useStore } from "../store";
import { getPrivacyContent } from "./privacy";

/**
 * PrivacyPage — full-screen reader for the privacy policy.
 *
 * Renders the structured privacy content for the active locale. Linked
 * from About + from the Reset confirmation + from the email auto-text we
 * tell users to copy when contacting us. Also the surface whose URL we
 * hand to the Play Console listing once we publish a public mirror.
 */
export function PrivacyPage({ onClose }: { onClose?: () => void }) {
  const locale = useStore((s) => s.locale);
  const c = getPrivacyContent(locale);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className="flex-1 flex flex-col min-h-0 overflow-y-auto"
    >
      <article className="max-w-2xl mx-auto w-full px-5 py-6 flex flex-col gap-5">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-themed">
              {c.title}
            </h1>
            <p className="text-[11px] text-zinc-500 mt-1">{c.lastUpdated}</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-zinc-400 hover:text-white px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition text-sm"
            >
              ✕
            </button>
          )}
        </header>

        <p className="text-sm text-zinc-300 leading-relaxed">{c.intro}</p>

        <div className="flex flex-col gap-4">
          {c.sections.map((s) => (
            <section
              key={s.title}
              className="rounded-2xl bg-white/5 border border-white/10 p-4"
            >
              <h2 className="text-sm font-bold text-zinc-100 mb-1.5">{s.title}</h2>
              <p className="text-[13px] text-zinc-300 leading-relaxed">{s.body}</p>
            </section>
          ))}
        </div>

        <a
          href={`mailto:${c.contactEmail}`}
          className="self-center mt-3 px-5 py-2.5 rounded-xl text-sm font-bold bg-themed text-white shadow-lg shadow-violet-500/30 hover:scale-[1.02] transition"
        >
          {c.contactEmail}
        </a>
      </article>
    </motion.div>
  );
}
