import { useState } from "react";
import { hapticTick, useAndroidBackPrompt } from "../../../match/sharedMatchUI";
import { useT } from "../../../i18n";
import { ModeLobbyShell, LobbySection, LobbyPrimaryButton } from "../../../ui/ModeLobbyShell";
import { MODE_ICONS } from "./menuShared";
import { DifficultyPicker, RoundsStepper } from "./lobbyControls";

/* ─────────── Constellation — prep menu before a lanes match ─────────── */

const LANES = [
  { glyph: "⚔️", title: "FORCE",   fav: "Pierre & Ciseaux", accent: "text-amber-300" },
  { glyph: "🧠", title: "SAGESSE", fav: "Feuille & Spock",  accent: "text-sky-300" },
  { glyph: "🦎", title: "RUSE",    fav: "Lézard",           accent: "text-emerald-300" },
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
            <b className="text-ink">Astuce :</b> gagne un couloir en y jouant l'un de ses coups favoris (listés ci-dessus) → <b className="text-emerald-300">+1 point bonus</b>. Ex : Pierre ou Ciseaux dans FORCE.
          </>
        }
      >
        <div className="grid grid-cols-3 gap-2">
          {LANES.map((l) => (
            <div key={l.title} className="rounded-2xl p-2.5 bg-surface border border-hairline flex flex-col items-center gap-1 text-center">
              <span className="text-2xl">{l.glyph}</span>
              <span className={"text-[11px] font-black tracking-wide " + l.accent}>{l.title}</span>
              <span className="text-[9px] text-ink-muted leading-tight">{l.fav}</span>
            </div>
          ))}
        </div>
      </LobbySection>

      <DifficultyPicker />

      <RoundsStepper
        value={winTo}
        onChange={setWinTo}
        lanes
        hint={t(winTo > 1 ? "lobby.lanesFirstTo" : "lobby.lanesFirstToOne", { n: winTo })}
      />
    </ModeLobbyShell>
  );
}
