import { MoveGlyph, MOVE_PALETTE } from "../../icons";
import type { Move } from "../../engine/game";
import type { LaneTarget } from "../rankedTypes";
import { RANKED_MOVES } from "./rankedOverlayShared";

/* ──────────── Riposte sub-phase UI ──────────── */

const LANE_LABEL = ["FORCE", "SAGESSE", "RUSE"] as const;

export function RiposteOverlay({
  data,
  onPick,
}: {
  data: { lane: LaneTarget; phase: "pick" | "reveal"; playerMove?: Move; cpuMove?: Move; flipped?: boolean };
  onPick: (mv: Move) => void;
}) {
  const verdict = data.phase === "reveal" && data.playerMove && data.cpuMove
    ? data.flipped ? "win"
      : data.playerMove === data.cpuMove ? "draw"
      : "loss"
    : null;
  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md px-4">
      <div className="text-[10px] sm:text-xs uppercase tracking-[0.4em] text-amber-300 mb-1.5">
        Riposte
      </div>
      <div className="text-2xl sm:text-3xl font-extrabold text-white mb-1 text-center">
        Rejoue la lane {LANE_LABEL[data.lane]}
      </div>
      <div className="text-xs sm:text-sm text-ink-muted mb-6 max-w-xs text-center">
        Gagne ce duel pour flipper la défaite en victoire.
      </div>
      {data.phase === "pick" && (
        <div className="grid grid-cols-5 gap-2 w-full max-w-md">
          {RANKED_MOVES.map((mv) => {
            const pal = MOVE_PALETTE[mv];
            return (
              <button
                key={mv}
                onClick={() => onPick(mv)}
                className={
                  "aspect-[4/5] rounded-xl flex flex-col items-center justify-center gap-1 py-1.5 transition active:scale-92 " +
                  "bg-gradient-to-br " + pal.from + " " + pal.to + " ring-2 " + pal.ring + " " + pal.glow +
                  " text-zinc-900 shadow-md"
                }
              >
                <MoveGlyph move={mv} className="w-7 h-7" />
                <span className="text-[8px] uppercase tracking-wider font-bold leading-none">{mv}</span>
              </button>
            );
          })}
        </div>
      )}
      {data.phase === "reveal" && data.playerMove && data.cpuMove && (
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] uppercase tracking-wider text-emerald-300">Toi</span>
              <div className={"w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br " +
                MOVE_PALETTE[data.playerMove].from + " " + MOVE_PALETTE[data.playerMove].to +
                " ring-2 " + MOVE_PALETTE[data.playerMove].ring}>
                <MoveGlyph move={data.playerMove} className="w-9 h-9" />
              </div>
            </div>
            <div className="text-3xl font-black text-ink-faint">vs</div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] uppercase tracking-wider text-rose-300">CPU</span>
              <div className={"w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br " +
                MOVE_PALETTE[data.cpuMove].from + " " + MOVE_PALETTE[data.cpuMove].to +
                " ring-2 " + MOVE_PALETTE[data.cpuMove].ring}>
                <MoveGlyph move={data.cpuMove} className="w-9 h-9" />
              </div>
            </div>
          </div>
          <div className={
            "text-xl sm:text-2xl font-black " +
            (verdict === "win" ? "text-emerald-300" :
             verdict === "loss" ? "text-rose-300" : "text-ink-muted")
          }>
            {verdict === "win" ? "Lane flippée — victoire !"
              : verdict === "loss" ? "Riposte perdue, défaite conservée."
              : "Égalité — la défaite reste."}
          </div>
        </div>
      )}
    </div>
  );
}
