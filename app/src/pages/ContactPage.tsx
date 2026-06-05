import { useState } from "react";
import { motion } from "motion/react";
import { useT } from "../i18n";
import { useStore } from "../store/store";
import { THEMES, gradientFromTheme } from "../theme/theme";

const RECIPIENT = "alex.guennad@gmail.com";

export function ContactPage() {
  const t = useT();
  const themeId = useStore((s) => s.player.themeId);
  const nickname = useStore((s) => s.player.nickname);
  const theme = THEMES[themeId];

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const onSend = () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    const subj = subject.trim() || "RPSLS — feedback";
    const body = `${trimmed}\n\n—\nFrom: ${nickname}`;
    const url = `mailto:${RECIPIENT}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
    setSent(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-2xl mx-auto p-4 sm:p-6 flex flex-col gap-5"
    >
      <div>
        <h1 className="font-headline text-3xl sm:text-4xl font-extrabold tracking-tight text-themed">{t("contact.title")}</h1>
        <p className="text-ink-muted text-sm mt-2 leading-relaxed max-w-prose">
          {t("contact.intro")}
        </p>
      </div>

      <div className="bg-surface border border-hairline rounded-3xl p-5 sm:p-6 flex flex-col gap-4">
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-ink-muted mb-1.5 font-semibold">
            {t("contact.subject.label")}
          </label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.currentTarget.value)}
            placeholder={t("contact.subject.placeholder")}
            maxLength={80}
            className="w-full bg-hairline border border-hairline rounded-2xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-violet-400/50 placeholder:text-ink-faint"
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-widest text-ink-muted mb-1.5 font-semibold">
            {t("contact.message.label")}
          </label>
          <textarea
            value={message}
            onChange={(e) => { setMessage(e.currentTarget.value); setSent(false); }}
            placeholder={t("contact.message.placeholder")}
            rows={7}
            maxLength={2000}
            className="w-full bg-hairline border border-hairline rounded-2xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-violet-400/50 placeholder:text-ink-faint resize-y min-h-[140px]"
          />
          <div className="text-[10px] text-ink-faint mt-1 text-right">{message.length} / 2000</div>
        </div>

        <motion.button
          whileHover={message.trim() ? { y: -2 } : undefined}
          whileTap={message.trim() ? { scale: 0.97 } : undefined}
          disabled={!message.trim()}
          onClick={onSend}
          className="w-full px-5 py-3.5 rounded-2xl font-semibold text-white shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition"
          style={{
            background: message.trim()
              ? gradientFromTheme(theme)
              : "#3f3f46",
          }}
        >
          {t("contact.btn.send")} ✉️
        </motion.button>

        {!message.trim() && (
          <p className="text-xs text-ink-faint text-center -mt-1">{t("contact.empty")}</p>
        )}

        {sent && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs text-emerald-300 text-center"
          >
            ✓ Email client opened. Send when you're ready.
          </motion.p>
        )}
      </div>

    </motion.div>
  );
}
