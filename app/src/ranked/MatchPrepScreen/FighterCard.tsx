import { motion } from "motion/react";
import { isAvatarImage, avatarImgStyle } from "../../theme/avatar";

/* ─────────── Fighter card ─────────── */

export function FighterCard({
  name, avatar, theme, tag, highlight,
}: {
  name: string;
  avatar: string;
  theme: { primary: string; secondary: string };
  tag: string;
  highlight: boolean;
}) {
  return (
    <motion.div
      animate={highlight ? { scale: [1, 1.05, 1] } : { scale: 1 }}
      transition={{ duration: 0.5 }}
      className={
        "flex-1 rounded-2xl p-3 flex flex-col items-center gap-1.5 border transition " +
        (highlight ? "border-white/50 shadow-lg" : "border-hairline")
      }
      style={{
        background: `linear-gradient(150deg, color-mix(in oklab, ${theme.primary} 22%, transparent), color-mix(in oklab, ${theme.secondary} 14%, transparent))`,
      }}
    >
      <div
        className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl overflow-hidden ring-1 ring-white/20"
        style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}
      >
        {isAvatarImage(avatar) ? (
          <img src={avatar} alt="" className="w-full h-full object-cover" style={avatarImgStyle(avatar)} />
        ) : (
          <span>{avatar}</span>
        )}
      </div>
      <div className="text-[11px] font-bold truncate max-w-full">{name}</div>
      <div className="flex items-center gap-1">
        <span className="w-3 h-3 rounded-full" style={{ background: theme.primary }} />
        <span className="w-3 h-3 rounded-full" style={{ background: theme.secondary }} />
      </div>
      <span className="text-[8px] uppercase tracking-wider text-ink-faint font-bold">{tag}</span>
    </motion.div>
  );
}
