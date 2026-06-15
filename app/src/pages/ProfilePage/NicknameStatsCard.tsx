import { useState } from "react";
import { useStore } from "../../store/store";
import { levelFromXp } from "../../engine/leveling";
import { THEMES } from "../../theme/theme";
import { Stat } from "./Stat";

/** Editable nickname + at-a-glance stats — section dedicated to the
 *  profile (the shared header badge doesn't need either). */
export function NicknameStatsCard() {
  const player = useStore((s) => s.player);
  const updateProfile = useStore((s) => s.updateProfile);

  const [editingNick, setEditingNick] = useState(false);
  const [nickDraft, setNickDraft] = useState(player.nickname);

  const info = levelFromXp(player.xp);
  const theme = THEMES[player.themeId];
  const totalGames = player.stats.wins + player.stats.losses + player.stats.draws;
  const winRate = totalGames > 0 ? (player.stats.wins / totalGames) * 100 : 0;

  const saveNick = () => {
    const v = nickDraft.trim();
    if (v.length > 0 && v.length <= 20) updateProfile({ nickname: v });
    setEditingNick(false);
  };

  return (
    <div className="bg-surface border border-hairline rounded-3xl p-5 flex flex-col gap-4">
      {editingNick ? (
        // Vertical stack on mobile so the input ALWAYS gets the full card
        // width and the action buttons sit cleanly underneath (no more
        // confirm chip falling off the right edge — Alex's "hors champ"
        // complaint). Inline row on >=sm where there's room.
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            autoFocus
            value={nickDraft}
            maxLength={20}
            onChange={(e) => setNickDraft(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveNick();
              if (e.key === "Escape") { setNickDraft(player.nickname); setEditingNick(false); }
            }}
            className="min-w-0 w-full sm:flex-1 bg-hairline rounded-xl px-4 py-2.5 text-base sm:text-lg font-bold focus:outline-none transition"
            style={{
              boxShadow:
                "inset 0 0 0 1px color-mix(in oklab, var(--theme-primary) 45%, transparent)",
            }}
            placeholder="Pseudo (max 20)"
          />
          <div className="flex items-stretch gap-2 sm:shrink-0">
            <button
              onClick={() => { setNickDraft(player.nickname); setEditingNick(false); }}
              aria-label="Annuler"
              className="flex-1 sm:flex-none sm:w-11 h-11 rounded-xl bg-hairline border border-hairline hover:bg-white/[0.07] text-ink-muted font-bold flex items-center justify-center transition px-3 sm:px-0"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            <button
              onClick={saveNick}
              aria-label="Enregistrer"
              className="flex-1 sm:flex-none sm:w-auto h-11 px-4 rounded-xl text-white font-bold flex items-center justify-center gap-1.5 transition active:scale-[0.97] bg-themed-br"
              style={{
                boxShadow:
                  "0 6px 16px -6px color-mix(in oklab, var(--theme-primary) 60%, transparent)",
                fontFamily: "var(--font-headline)",
                letterSpacing: "0.05em",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12l5 5L20 7" />
              </svg>
              <span className="text-xs sm:text-sm uppercase">Enregistrer</span>
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => { setNickDraft(player.nickname); setEditingNick(true); }}
          className="self-start text-base font-semibold text-ink-muted hover:text-ink transition flex items-center gap-2"
        >
          <span>Modifier le pseudo</span>
          <span className="text-ink-faint text-xs">({player.nickname})</span>
          <span className="text-ink-faint text-sm">✎</span>
        </button>
      )}

      <div className="flex flex-wrap gap-4 text-sm text-ink-muted">
        <Stat label="Level"   value={info.level} accent={theme.primary} />
        <Stat label="XP"      value={player.xp} />
        <Stat label="Rank LP" value={player.rankLp} accent={theme.secondary} />
        <Stat label="Games"   value={totalGames} />
        <Stat label="Win %"   value={`${winRate.toFixed(0)}%`} />
      </div>
    </div>
  );
}
