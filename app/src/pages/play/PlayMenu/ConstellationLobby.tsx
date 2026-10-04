import { useState } from "react";
import { hapticTick, useAndroidBackPrompt } from "../../../match/sharedMatchUI";
import { useT } from "../../../i18n";
import { ModeLobbyShell, LobbySection, LobbyPrimaryButton } from "../../../ui/ModeLobbyShell";
import { MODE_ICONS } from "./menuShared";
import { DifficultyPicker, RoundsStepper } from "./lobbyControls";

/* ─────────── Constellation — prep menu before a lanes match ─────────── */

const LANES = [
  { glyph: "⚔️", id: "force",   fav: ["rock", "scissors"], accent: "text-amber-300" },
  { glyph: "🧠", id: "wisdom",  fav: ["paper", "spock"],   accent: "text-sky-300" },
  { glyph: "🦎", id: "cunning", fav: ["lizard"],           accent: "text-emerald-300" },
];

export function ConstellationLobby({
  onBack, onPlay,
}: {
  onBack: () => void;
  onPlay: (winTo: number) => void;
}) {
  const t = useT();
  const [winTo, setWinTo] = useState(2);
  useAndroidBackPrompt(onBack);

  return (
    <ModeLobbyShell
      title={t("mode.constellation")}
      tagline={t("lobby.constellation.tagline")}
      icon={MODE_ICONS.constellation}
      accent="#a78bfa"
      onBack={onBack}
      cta={
        <LobbyPrimaryButton onClick={() => { hapticTick(); onPlay(winTo); }}>
          {t("lobby.play")}
        </LobbyPrimaryButton>
      }
    >
      {/* Les 3 couloirs — ce que chacun favorise. */}
      <LobbySection
        label={t("lobby.constellation.lanes")}
        hint={
          <>
            <b className="text-ink">{t("constel.tip.label")}</b> {t("constel.tip.body")} <b className="text-emerald-300">{t("constel.tip.bonus")}</b>. {t("constel.tip.example")}
          </>
        }
      >
        <div className="grid grid-cols-3 gap-2">
          {LANES.map((l) => (
            <div key={l.id} className="rounded-2xl p-2.5 bg-surface border border-hairline flex flex-col items-center gap-1 text-center">
              <span className="text-2xl">{l.glyph}</span>
              <span className={"text-[11px] font-black tracking-wide " + l.accent}>{t(`lanes.identity.${l.id}.title`)}</span>
              <span className="text-[9px] text-ink-muted leading-tight">{l.fav.map((m) => t("element." + m)).join(" & ")}</span>
            </div>
          ))}
        </div>
      </LobbySection>

      <DifficultyPicker />

      <RoundsStepper
        value={winTo}
        onChange={setWinTo}
        // winTo = MANCHES gagnées (battleStatus compte roundWins), pas des couloirs.
        hint={t(winTo > 1 ? "lobby.firstToWins" : "lobby.firstToWin", { n: winTo })}
      />
    </ModeLobbyShell>
  );
}
