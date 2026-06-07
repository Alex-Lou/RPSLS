import { PlayerBadge } from "./ui/PlayerBadge";
import type { Page } from "./Sidebar";

/**
 * Persistent player header on the mobile menu pages — a thin wrapper around
 * the shared `PlayerBadge` component. The badge is the single source of truth
 * for player surface (avatar / name / rank / xp bar / currencies); this
 * wrapper just adds the `md:hidden` (header is mobile-only — desktop has the
 * sidebar), routes taps to the profile page, AND matches the horizontal
 * padding (px-5) + max-width (max-w-3xl) the ProfilePage applies around the
 * same badge — so the SAME PlayerBadge renders at the IDENTICAL inner width
 * on both surfaces, the inconsistency Alex flagged.
 */
export function UserHeader({ onNavigate }: { onNavigate: (p: Page) => void }) {
  return (
    <div className="md:hidden w-full max-w-3xl mx-auto px-2">
      <PlayerBadge
        onTap={() => onNavigate("profile")}
        onCurrencyTap={() => onNavigate("shop")}
      />
    </div>
  );
}
