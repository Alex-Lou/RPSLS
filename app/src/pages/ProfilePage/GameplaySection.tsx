import { useStore } from "../../store/store";
import { useT } from "../../i18n";
import { DIFFICULTY_META } from "../../types";
import type { Difficulty } from "../../types";
import { hapticTap } from "../../haptic";
import { SectionCard, SubHeading } from "./SectionCard";
import { ChoiceGrid, ToggleRow } from "./Toggle";

/** Réglages › Partie : difficulté de l'IA + combat rapide. Mêmes champs
 *  et même action (`updateProfile`) qu'avant — seule la mise en page change :
 *  3 pastilles compactes + la description du niveau choisi en dessous. */
export function GameplaySection() {
  const difficulty = useStore((s) => s.player.difficulty);
  const fastCombat = useStore((s) => !!s.player.fastCombat);
  const updateProfile = useStore((s) => s.updateProfile);
  const t = useT();
  const ids = Object.keys(DIFFICULTY_META) as Difficulty[];

  return (
    <SectionCard title={t("profile.game.title")}>
      <SubHeading>{t("profile.diff.title")}</SubHeading>
      <p className="text-[11px] text-ink-faint leading-snug mb-2.5">{t("profile.diff.subtitle")}</p>
      <ChoiceGrid
        options={ids.map((id) => ({
          key: id,
          value: id,
          label: (
            <>
              <span aria-hidden className="text-base leading-none">{DIFFICULTY_META[id].emoji}</span>
              <span className="text-xs font-semibold">{t("diff." + id)}</span>
            </>
          ),
        }))}
        value={difficulty}
        onPick={(id) => { hapticTap(); updateProfile({ difficulty: id }); }}
      />
      <p className="mt-2 text-[11px] text-ink-muted leading-snug min-h-[2.5em]" aria-live="polite">
        {t("diff." + difficulty + ".desc")}
      </p>

      <div className="mt-3">
        <ToggleRow
          icon="⚡"
          title={t("settings.fastCombat")}
          hint={t("settings.fastCombatHint")}
          checked={fastCombat}
          onChange={(v) => updateProfile({ fastCombat: v })}
        />
      </div>
    </SectionCard>
  );
}
