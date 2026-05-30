import { useRef, useState } from "react";
import { motion } from "motion/react";
import { useStore } from "./store";
import { THEMES } from "./theme";
import { levelFromXp } from "./leveling";
import { DIFFICULTY_META, PAD_META } from "./types";
import type { Difficulty, PadId, ThemeId } from "./types";
import { MOVES } from "./game";
import { BattlePad } from "./BattlePad";
import { useT } from "./i18n";

const AVATAR_PRESETS = [
  "🎮", "👾", "🦊", "🐉", "🦄", "🥷", "🧙", "🤖",
  "🦁", "🐺", "🐯", "🦅", "👻", "💀", "⚔️", "🎯",
];

export function ProfilePage() {
  const player = useStore((s) => s.player);
  const updateProfile = useStore((s) => s.updateProfile);
  const resetProfile = useStore((s) => s.resetProfile);
  const t = useT();

  const [editingNick, setEditingNick] = useState(false);
  const [nickDraft, setNickDraft] = useState(player.nickname);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const info = levelFromXp(player.xp);
  const theme = THEMES[player.themeId];
  const totalGames = player.stats.wins + player.stats.losses + player.stats.draws;
  const winRate = totalGames > 0 ? (player.stats.wins / totalGames) * 100 : 0;

  const saveNick = () => {
    const v = nickDraft.trim();
    if (v.length > 0 && v.length <= 20) updateProfile({ nickname: v });
    setEditingNick(false);
  };

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 200 * 1024) {
      alert("Image must be smaller than 200KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      updateProfile({ avatar: result });
    };
    reader.readAsDataURL(f);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-3xl mx-auto px-5 pt-2 pb-6 md:p-6 flex flex-col gap-5"
    >
      <h1 className="text-3xl font-extrabold tracking-tight">Profile</h1>

      {/* Hero card */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col sm:flex-row gap-6 items-center sm:items-start">
        <div
          className="w-28 h-28 rounded-3xl flex items-center justify-center text-6xl shrink-0 ring-2 shadow-2xl"
          style={{
            background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
          }}
        >
          {player.avatar.startsWith("data:") ? (
            <img src={player.avatar} alt="" className="w-full h-full rounded-3xl object-cover" />
          ) : (
            <span>{player.avatar}</span>
          )}
        </div>

        <div className="flex-1 w-full">
          {editingNick ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={nickDraft}
                maxLength={20}
                onChange={(e) => setNickDraft(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveNick();
                  if (e.key === "Escape") { setNickDraft(player.nickname); setEditingNick(false); }
                }}
                className="flex-1 bg-white/10 rounded-xl px-4 py-2 text-xl font-bold focus:outline-none focus:ring-2 ring-white/30"
              />
              <button
                onClick={saveNick}
                className="px-4 py-2 rounded-xl bg-emerald-500/30 hover:bg-emerald-500/50 text-emerald-200 font-semibold"
              >
                Save
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setNickDraft(player.nickname); setEditingNick(true); }}
              className="text-2xl font-bold hover:text-zinc-300 transition"
            >
              {player.nickname} <span className="text-zinc-500 text-sm font-normal ml-1">✎ edit</span>
            </button>
          )}

          <div className="mt-3 flex flex-wrap gap-4 text-sm text-zinc-400">
            <Stat label="Level"   value={info.level} accent={theme.primary} />
            <Stat label="XP"      value={player.xp} />
            <Stat label="Rank LP" value={player.rankLp} accent={theme.secondary} />
            <Stat label="Games"   value={totalGames} />
            <Stat label="Win %"   value={`${winRate.toFixed(0)}%`} />
          </div>

          <div className="mt-4">
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${info.progress * 100}%`,
                  background: `linear-gradient(90deg, ${theme.primary}, ${theme.secondary})`,
                  boxShadow: `0 0 12px ${theme.primary}80`,
                }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-zinc-500">
              <span>{info.xpInLevel} / {info.xpForNext} XP to next level</span>
              <span>Lvl {info.level} → {info.level + 1}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Avatar picker */}
      <section className="bg-white/5 border border-white/10 rounded-3xl p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300 mb-3">Avatar</h2>
        <div className="flex flex-wrap gap-2">
          {AVATAR_PRESETS.map((a) => (
            <button
              key={a}
              onClick={() => updateProfile({ avatar: a })}
              className={
                "w-12 h-12 rounded-2xl flex items-center justify-center text-2xl transition border " +
                (player.avatar === a
                  ? "border-white/40 bg-white/10"
                  : "border-white/10 bg-white/5 hover:bg-white/10")
              }
            >
              {a}
            </button>
          ))}
          <button
            onClick={() => fileRef.current?.click()}
            className="w-12 h-12 rounded-2xl flex flex-col items-center justify-center text-[10px] border border-dashed border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/40 transition"
          >
            <span className="text-lg leading-none">⬆</span>
            <span className="text-zinc-400">Upload</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={onUpload}
          />
        </div>
      </section>

      {/* Theme picker */}
      <section className="bg-white/5 border border-white/10 rounded-3xl p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300 mb-3">HUD Theme</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {(Object.keys(THEMES) as ThemeId[]).map((id) => {
            const t = THEMES[id];
            const active = player.themeId === id;
            return (
              <button
                key={id}
                onClick={() => updateProfile({ themeId: id })}
                className={
                  "rounded-2xl p-3 border transition flex flex-col items-center gap-2 " +
                  (active
                    ? "border-white/40 bg-white/10"
                    : "border-white/10 bg-white/5 hover:bg-white/10")
                }
              >
                <div
                  className="w-full h-12 rounded-xl"
                  style={{ background: `linear-gradient(135deg, ${t.primary}, ${t.secondary})` }}
                />
                <span className="text-xs">
                  {t.emoji} {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* CPU difficulty */}
      <section className="bg-white/5 border border-white/10 rounded-3xl p-4 sm:p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300 mb-1">
          {t("profile.diff.title")}
        </h2>
        <p className="text-xs text-zinc-500 mb-3">
          {t("profile.diff.subtitle")}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          {(Object.keys(DIFFICULTY_META) as Difficulty[]).map((id) => {
            const active = player.difficulty === id;
            return (
              <button
                key={id}
                onClick={() => updateProfile({ difficulty: id })}
                className={
                  "rounded-2xl p-3 border transition flex flex-col items-start gap-1.5 text-left w-full min-w-0 " +
                  (active
                    ? "border-white/40 bg-white/10"
                    : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20")
                }
              >
                <div className="flex items-center gap-2 w-full">
                  <span className="text-xl shrink-0">{DIFFICULTY_META[id].emoji}</span>
                  <span className="font-semibold text-sm flex-1 truncate">{t("diff." + id)}</span>
                  {active && (
                    <span className="text-[9px] uppercase font-bold text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                      {t("profile.diff.active")}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-400 leading-snug">{t("diff." + id + ".desc")}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Battle pad picker */}
      <section className="bg-white/5 border border-white/10 rounded-3xl p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300 mb-3">Battle pad</h2>
        <p className="text-xs text-zinc-500 mb-3">
          The mat shown behind matches. Inspired by lab boards, vintage salons and deep space.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(Object.keys(PAD_META) as PadId[]).map((id) => {
            const meta = PAD_META[id];
            const active = player.padId === id;
            return (
              <button
                key={id}
                onClick={() => updateProfile({ padId: id })}
                className={
                  "group rounded-2xl border overflow-hidden transition text-left " +
                  (active
                    ? "border-white/40 ring-2 ring-white/20"
                    : "border-white/10 hover:border-white/30")
                }
              >
                <div className="aspect-[3/2] w-full bg-black/50 relative">
                  <BattlePad padId={id} className="w-full h-full" />
                  {active && (
                    <div className="absolute top-2 right-2 bg-emerald-500/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      ACTIVE
                    </div>
                  )}
                </div>
                <div className="p-3 bg-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{meta.emoji}</span>
                    <span className="text-sm font-semibold">{meta.label}</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">{meta.tagline}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* By-move stats */}
      {totalGames > 0 && (
        <section className="bg-white/5 border border-white/10 rounded-3xl p-4 sm:p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300 mb-3">{t("profile.bymove.title")}</h2>
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {MOVES.map((m) => {
              const s = player.stats.byMove[m];
              const wr = s.picked > 0 ? (s.won / s.picked) * 100 : 0;
              return (
                <div key={m} className="bg-white/5 rounded-xl p-2 sm:p-3 text-center min-w-0">
                  <div className="text-[10px] sm:text-xs uppercase tracking-wider text-zinc-400 truncate">
                    {t("element." + m)}
                  </div>
                  <div className="mt-1 text-base sm:text-lg font-bold">{s.picked}</div>
                  <div className="text-[9px] sm:text-[10px] text-zinc-500">{t("profile.bymove.wonPct", { p: wr.toFixed(0) })}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Reset */}
      <section className="bg-rose-950/30 border border-rose-900/40 rounded-3xl p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-rose-300 mb-2">Danger zone</h2>
        <p className="text-xs text-zinc-400 mb-3">
          Reset profile wipes nickname, avatar, theme, XP, LP, stats and history. Irreversible.
        </p>
        {!confirmReset ? (
          <button
            onClick={() => setConfirmReset(true)}
            className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-sm font-medium"
          >
            Reset profile
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => { resetProfile(); setConfirmReset(false); }}
              className="px-4 py-2 rounded-xl bg-rose-500/40 hover:bg-rose-500/60 text-white text-sm font-semibold"
            >
              Yes, wipe everything
            </button>
            <button
              onClick={() => setConfirmReset(false)}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm"
            >
              Cancel
            </button>
          </div>
        )}
      </section>
    </motion.div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
      <span className="text-lg font-bold" style={accent ? { color: accent } : undefined}>
        {value}
      </span>
    </div>
  );
}
