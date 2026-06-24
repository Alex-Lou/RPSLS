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
export function UserHeader({
  onNavigate,
  // Classes du conteneur. Défaut = `px-2` (pages autres que Play : le burger
  // ET le bouton "retour Play" occupent déjà le coin → on NE remonte PAS).
  // La page Play passe une variante "remontée + décalée à droite du burger"
  // (Alex 2026-06-12 : carte joueur au MÊME niveau que le burger, pas abaissée)
  // — sûr là-bas car la page Play n'a PAS de bouton retour à côté du burger.
  className = "px-2",
}: {
  onNavigate: (p: Page) => void;
  className?: string;
}) {
  return (
    <div className={"portrait:min-[900px]:hidden w-full max-w-3xl mx-auto " + className}>
      <PlayerBadge
        onTap={() => onNavigate("profile")}
        onCurrencyTap={() => onNavigate("shop")}
      />
    </div>
  );
}
