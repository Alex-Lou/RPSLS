import type { ReactNode } from "react";
import { useT } from "../../i18n";
import { ModeLobbyShell, LobbySection, LobbyPrimaryButton } from "../../ui/ModeLobbyShell";
import { MODE_ICONS } from "../play/PlayMenu/menuShared";

/**
 * OnlineMenu — phase « menu » de la page En ligne, sur le TEMPLATE commun des
 * lobbies : héros (accroche + statut serveur) → réglages (mode, format, partie
 * privée) → « Trouver un adversaire » docké en bas. Titre + retour : barre du
 * haut (défauts de la page En ligne). Toute la logique réseau reste dans
 * OnlinePage, ce composant n'est que présentationnel.
 */

type OnlineMode = "classic" | "lanes";

const ON = "bg-themed text-white shadow-lg shadow-themed";
const OFF = "bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10";

/** Rangée de chiffres (best-of / premier à N). */
function NumberRow({ values, value, onChange }: { values: number[]; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-2">
      {values.map((n) => (
        <button key={n} onClick={() => onChange(n)} className={"flex-1 py-2.5 rounded-xl font-bold transition " + (n === value ? ON : OFF)}>
          {n}
        </button>
      ))}
    </div>
  );
}

export function OnlineMenu({
  status, mode, onMode, bestOf, onBestOf, lanesWinTo, onLanesWinTo,
  joinCode, onJoinCode, onFind, onCreate, onJoin,
}: {
  /** Badge de statut serveur (rendu par OnlinePage). */
  status: ReactNode;
  mode: OnlineMode;
  onMode: (m: OnlineMode) => void;
  bestOf: number;
  onBestOf: (n: number) => void;
  lanesWinTo: number;
  onLanesWinTo: (n: number) => void;
  joinCode: string;
  onJoinCode: (c: string) => void;
  onFind: () => void;
  onCreate: () => void;
  onJoin: () => void;
}) {
  const t = useT();
  const modes: { id: OnlineMode; label: string; sub: string }[] = [
    { id: "classic", label: t("online.menu.classic"), sub: t("online.menu.classicSub") },
    { id: "lanes", label: t("online.menu.lanes"), sub: t("online.menu.lanesSub") },
  ];
  return (
    <ModeLobbyShell
      title={t("nav.online")}
      tagline={t("mode.online.tag")}
      icon={MODE_ICONS.online}
      accent="#22d3ee"
      heroExtra={<div className="w-full [&>div]:mb-0">{status}</div>}
      cta={<LobbyPrimaryButton onClick={onFind}>{t("online.menu.find")}</LobbyPrimaryButton>}
    >
      <LobbySection label={t("online.menu.mode")}>
        <div className="grid grid-cols-2 gap-2">
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => onMode(m.id)}
              className={"py-2.5 px-2 rounded-xl font-semibold transition flex flex-col items-center gap-0.5 " + (mode === m.id ? ON : OFF)}
            >
              <span className="text-sm leading-tight">{m.label}</span>
              <span className="text-[10px] font-normal opacity-80">{m.sub}</span>
            </button>
          ))}
        </div>
      </LobbySection>

      {mode === "classic" ? (
        <LobbySection label={t("online.menu.bestOf")}>
          <NumberRow values={[1, 3, 5, 7]} value={bestOf} onChange={onBestOf} />
        </LobbySection>
      ) : (
        <LobbySection label={t("online.menu.firstTo")} hint={t("online.menu.lanesHint")}>
          <NumberRow values={[1, 2, 3, 4]} value={lanesWinTo} onChange={onLanesWinTo} />
        </LobbySection>
      )}

      {/* Partie privée : créer un salon OU rejoindre avec un code. */}
      <LobbySection label={t("online.menu.private")}>
        <div className="flex flex-col gap-2">
          <button
            onClick={onCreate}
            className="w-full py-2.5 rounded-xl bg-emerald-500/85 hover:bg-emerald-500 font-semibold text-white shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition"
          >
            {t("online.menu.create")}
          </button>
          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => onJoinCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              aria-label={t("online.menu.code")}
              className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 font-mono uppercase tracking-widest text-center text-base"
            />
            <button
              onClick={onJoin}
              disabled={joinCode.trim().length !== 6}
              className="px-5 py-2.5 rounded-xl bg-sky-500/90 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-white active:scale-[0.98] transition"
            >
              {t("online.menu.join")}
            </button>
          </div>
        </div>
      </LobbySection>
    </ModeLobbyShell>
  );
}
