import React from "react";

/**
 * GameTable — felt-mat container that frames the two rows of lanes
 * (Opponent on top, You on bottom) so the player can never confuse which
 * side belongs to whom. Used by PickStage, LockedStage and RevealStage.
 */
export function GameTable({
  opponentName, youName,
  oppRow, youRow,
  oppStatus, youStatus,
}: {
  opponentName: string;
  youName: string;
  oppRow: React.ReactNode;
  youRow: React.ReactNode;
  oppStatus?: React.ReactNode;
  youStatus?: React.ReactNode;
}) {
  return (
    <div
      className="w-full max-w-2xl rounded-2xl p-2 sm:p-4 flex flex-col gap-2 sm:gap-3
                 border border-emerald-800/50
                 bg-gradient-to-b from-emerald-950/85 via-zinc-950/90 to-emerald-950/85
                 shadow-[inset_0_0_36px_rgba(0,0,0,0.6)]"
    >
      {/* Opponent header */}
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-rose-300/90 truncate">
          ✦ {opponentName}
        </span>
        {oppStatus && (
          <span className="text-[10px] uppercase tracking-wider text-ink-faint shrink-0 ml-2">{oppStatus}</span>
        )}
      </div>

      {/* Opponent row */}
      {oppRow}

      {/* Felt divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />

      {/* You row */}
      {youRow}

      {/* You footer */}
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-emerald-300/90 truncate">
          ✦ {youName}
        </span>
        {youStatus && (
          <span className="text-[10px] uppercase tracking-wider text-ink-faint shrink-0 ml-2">{youStatus}</span>
        )}
      </div>
    </div>
  );
}

/** Tiny "?" face-down card for an opponent lane we can't see yet.
 *  Perfectly STATIC — no opacity pulse — so the opponent row reads as a calm,
 *  solid surface instead of three cards randomly fading in and out (which felt
 *  unstable). The `index`/`pulsing` props are kept for call-site compatibility
 *  but no longer drive any animation. A solid dark fill stops the animated
 *  app backdrop from showing through. */
export function FaceDownLaneCard({ index: _index, pulsing: _pulsing = false }: { index: number; pulsing?: boolean }) {
  return (
    <div
      className="aspect-square w-full rounded-xl border-2 border-dashed border-hairline bg-surface-2
                 flex items-center justify-center"
    >
      <span className="text-xl sm:text-2xl text-zinc-600 font-black">?</span>
    </div>
  );
}
