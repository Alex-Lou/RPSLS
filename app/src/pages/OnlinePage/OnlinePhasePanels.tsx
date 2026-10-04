/**
 * Panneaux simples des phases de la page En ligne (bannière de reconnexion,
 * salon ouvert, repli CPU Constellation, erreur). Extraits verbatim
 * d'OnlinePage — purement présentationnels.
 */
import { motion, AnimatePresence } from "motion/react";
import { useT } from "../../i18n";
import { LocalLanesGame } from "../../match/LocalLanesGame";
import { DotPulse } from "./StatusAndWaiting";

/** Transient reconnect banner — only shown while the WS is mid-retry. */
export function ReconnectBanner({ connDropped }: { connDropped: boolean }) {
  const t = useT();
  return (
    <AnimatePresence>
      {connDropped && (
        <motion.div
          key="reconn"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="mb-3 px-3 py-2 rounded-xl border bg-amber-500/10 border-amber-500/30 text-amber-200 text-xs flex items-center gap-2"
        >
          <motion.span
            className="w-2 h-2 rounded-full bg-amber-400"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
          <span className="font-semibold">{t("online.reconnecting")}</span>
          <span className="text-amber-300/70">
            {t("online.reconnecting.sub")}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function LobbyOpenPanel({
  lobbyCode,
  bestOf,
  cancel,
}: {
  lobbyCode: string;
  bestOf: number;
  cancel: () => void;
}) {
  const t = useT();
  return (
    <motion.div
      key="lobby"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center gap-4 py-10"
    >
      <div className="text-sm text-zinc-400">{t("online.lobby.share")}</div>
      <div className="text-5xl sm:text-6xl font-black tracking-[0.4em] font-mono text-themed">
        {lobbyCode}
      </div>
      <div className="text-xs text-zinc-500">{t("online.lobby.waiting", { n: bestOf })}</div>
      <DotPulse />
      <button
        onClick={cancel}
        className="mt-4 px-5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-sm transition"
      >
        {t("online.cancel")}
      </button>
    </motion.div>
  );
}

export function LanesBotPanel({ lanesWinTo, backToMenu }: { lanesWinTo: number; backToMenu: () => void }) {
  const t = useT();
  return (
    <motion.div
      key="lanes-bot"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col min-h-0"
    >
      <div className="mb-2 self-center px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-200 text-[11px] font-semibold">
        {t("online.botFallback")}
      </div>
      <LocalLanesGame winTo={lanesWinTo} onQuit={backToMenu} />
    </motion.div>
  );
}

export function OnlineErrorPanel({ errMsg, backToMenu }: { errMsg: string | null; backToMenu: () => void }) {
  const t = useT();
  return (
    <motion.div
      key="err"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center gap-4 py-6"
    >
      <div className="text-4xl">⚠️</div>
      <pre className="text-rose-200/90 text-xs sm:text-sm whitespace-pre-wrap text-center max-w-prose font-sans leading-relaxed">
        {errMsg || t("online.err.generic")}
      </pre>
      <button
        onClick={backToMenu}
        className="mt-2 px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm transition"
      >
        {t("online.backToMenu")}
      </button>
    </motion.div>
  );
}
