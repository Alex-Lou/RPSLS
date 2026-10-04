import { useState } from "react";
import { useStore } from "../../store/store";
import { useT } from "../../i18n";
import { levelFromXp } from "../../engine/leveling";
import { THEMES } from "../../theme/theme";

/** Profil › Identité : pseudo (lecture → édition en place) + statistiques
 *  clés. Remplace l'ancienne carte dont le TITRE était le bouton « Modifier
 *  le pseudo » (cf. audit) : désormais vrai titre de section + ligne
 *  « Pseudo » avec un bouton d'action explicite. */
export function IdentityCard() {
  const player = useStore((s) => s.player);
  const updateProfile = useStore((s) => s.updateProfile);
  const t = useT();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(player.nickname);

  const info = levelFromXp(player.xp);
  const theme = THEMES[player.themeId];
  const totalGames = player.stats.wins + player.stats.losses + player.stats.draws;
  const winRate = totalGames > 0 ? (player.stats.wins / totalGames) * 100 : 0;

  const save = () => {
    const v = draft.trim();
    if (v.length > 0 && v.length <= 20) updateProfile({ nickname: v });
    setEditing(false);
  };
  const cancel = () => { setDraft(player.nickname); setEditing(false); };

  // Ligne 1 : 3 tuiles ; ligne 2 : 2 tuiles plus larges (libellés plus longs).
  const stats: Array<{ key: string; label: string; value: string | number; accent?: string; span: string }> = [
    { key: "lvl", label: t("profile.stat.level"), value: info.level, accent: theme.primary, span: "col-span-2" },
    { key: "xp", label: t("profile.stat.xp"), value: player.xp, span: "col-span-2" },
    { key: "games", label: t("profile.stat.games"), value: totalGames, span: "col-span-2" },
    { key: "lp", label: t("profile.stat.lp"), value: player.rankLp, accent: theme.secondary, span: "col-span-3" },
    { key: "wr", label: t("profile.stat.winrate"), value: `${winRate.toFixed(0)}%`, span: "col-span-3" },
  ];

  return (
    <section className="bg-surface border border-hairline rounded-3xl p-4 sm:p-5 flex flex-col gap-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted">
        {t("profile.identity.title")}
      </h2>

      {/* Pseudo */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="profile-nick" className="text-[11px] uppercase tracking-wider text-ink-faint">
          {t("profile.nick.label")}
        </label>
        {editing ? (
          // Empilé sur mobile : le champ prend toute la largeur, les boutons
          // dessous (plus de bouton « hors champ »). En ligne dès sm.
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              id="profile-nick"
              autoFocus
              value={draft}
              maxLength={20}
              onChange={(e) => setDraft(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") cancel();
              }}
              className="min-w-0 w-full sm:flex-1 bg-hairline rounded-xl px-4 py-2.5 text-base font-bold focus:outline-none"
              style={{ boxShadow: "inset 0 0 0 1px color-mix(in oklab, var(--theme-primary) 45%, transparent)" }}
              placeholder={t("profile.nick.placeholder")}
            />
            <div className="flex items-stretch gap-2 sm:shrink-0">
              <button
                type="button"
                onClick={cancel}
                className="flex-1 sm:flex-none h-11 px-4 rounded-xl bg-hairline border border-hairline text-ink-muted text-xs font-bold uppercase tracking-wide"
              >
                {t("profile.nick.cancel")}
              </button>
              <button
                type="button"
                onClick={save}
                className="flex-1 sm:flex-none h-11 px-4 rounded-xl text-white text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-1.5 active:scale-[0.97] transition bg-themed-br"
                style={{ boxShadow: "0 6px 16px -6px color-mix(in oklab, var(--theme-primary) 60%, transparent)" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12l5 5L20 7" />
                </svg>
                {t("profile.btn.save")}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl bg-hairline border border-hairline pl-4 pr-1.5 py-1.5">
            <span id="profile-nick" className="flex-1 min-w-0 truncate text-base font-bold text-ink">
              {player.nickname}
            </span>
            <button
              type="button"
              onClick={() => { setDraft(player.nickname); setEditing(true); }}
              aria-label={t("profile.nick.editAria")}
              className="shrink-0 h-9 px-3 rounded-lg bg-white/5 border border-white/15 text-xs font-semibold text-ink hover:bg-white/10 flex items-center gap-1.5"
            >
              <span aria-hidden>✎</span>
              {t("profile.nick.edit")}
            </button>
          </div>
        )}
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-6 gap-2">
        {stats.map((s) => (
          <div key={s.key} className={s.span + " rounded-xl bg-hairline px-3 py-2 min-w-0"}>
            <div className="text-[10px] uppercase tracking-wider text-ink-faint leading-tight truncate">{s.label}</div>
            <div className="text-lg font-bold tabular-nums leading-snug" style={s.accent ? { color: s.accent } : undefined}>
              {s.value}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
