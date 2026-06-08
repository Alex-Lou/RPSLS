/**
 * ArenaPage — menu entry point for Constellation Pro.
 *
 * Wraps ArenaGame with a back-to-menu callback. Kept thin so the same
 * pattern (page → game orchestrator) can grow with online matchmaking
 * later without rewriting the orchestrator.
 */

import { ArenaGame } from "./ArenaGame";

export function ArenaPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <ArenaGame onQuit={onBack} />
    </div>
  );
}
