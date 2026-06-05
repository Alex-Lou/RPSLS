import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "./store/store";
import { LOCALES, LOCALE_LIST, type Locale } from "./i18n";

interface Props {
  variant?: "sidebar" | "inline";
}

export function LanguagePicker({ variant = "inline" }: Props) {
  const locale = useStore((s) => s.locale);
  const setLocale = useStore((s) => s.setLocale);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const meta = LOCALES[locale];
  const isSidebar = variant === "sidebar";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={
          "flex items-center gap-2 rounded-xl border transition " +
          (isSidebar
            ? "w-full px-3 py-2 bg-hairline hover:bg-hairline border-hairline text-sm"
            : "px-3 py-2 bg-hairline hover:bg-hairline border-hairline text-sm")
        }
      >
        <span className="text-base">{meta.flag}</span>
        <span className="font-semibold">{meta.code}</span>
        <span className="text-ink-muted text-xs hidden sm:inline">{meta.label}</span>
        <span className={"ml-auto text-ink-faint transition " + (open ? "rotate-180" : "")}>▾</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: isSidebar ? 4 : -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: isSidebar ? 4 : -4, scale: 0.96 }}
            transition={{ duration: 0.12 }}
            className={
              "absolute z-50 rounded-xl bg-zinc-900/95 backdrop-blur border border-hairline shadow-2xl overflow-hidden " +
              (isSidebar
                ? "left-0 right-0 bottom-full mb-1.5"
                : "left-0 min-w-[180px] mt-1.5")
            }
          >
            {LOCALE_LIST.map((id) => {
              const m = LOCALES[id];
              const active = id === locale;
              return (
                <li key={id}>
                  <button
                    onClick={() => {
                      setLocale(id as Locale);
                      setOpen(false);
                    }}
                    className={
                      "w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition " +
                      (active ? "bg-violet-500/20 text-white" : "hover:bg-hairline text-ink")
                    }
                  >
                    <span className="text-base">{m.flag}</span>
                    <span className="font-semibold w-7">{m.code}</span>
                    <span className="text-ink-muted flex-1">{m.label}</span>
                    {active && <span className="text-violet-300">✓</span>}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
