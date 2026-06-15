import { motion } from "motion/react";
import { useT } from "../../i18n";
import { PlayerBadge } from "../../ui/PlayerBadge";
import type { Page } from "../../Sidebar";
import { NicknameStatsCard } from "./NicknameStatsCard";
import { AvatarSection } from "./AvatarSection";
import { DifficultySection } from "./DifficultySection";
import { HapticsSection } from "./HapticsSection";
import { StyleSection } from "./StyleSection";
import { ByMoveStatsSection } from "./ByMoveStatsSection";
import { AccessibilitySection } from "./AccessibilitySection";
import { PrivacySection } from "./PrivacySection";
import { ResetSection } from "./ResetSection";

/** Page navigation callback wired by App.tsx — used by the shared PlayerBadge
 *  (currency chips → shop) at the top of the profile. Each section below owns
 *  its own state + store access; this orchestrator is pure layout. */
export function ProfilePage({ onNavigate }: { onNavigate?: (page: Page) => void } = {}) {
  const t = useT();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-3xl mx-auto px-5 pt-2 pb-6 md:p-6 flex flex-col gap-5"
    >
      <h1 className="font-headline text-3xl font-extrabold tracking-tight">{t("nav.profile")}</h1>

      {/* Player summary — exactly the same badge as the persistent UserHeader
          on the menus, so the player surface looks IDENTICAL everywhere.
          Edit-nickname + stats live in their own row below (kept off the
          shared badge to keep it lean and reusable). */}
      <PlayerBadge onCurrencyTap={onNavigate ? () => onNavigate("shop") : undefined} />

      <NicknameStatsCard />
      <AvatarSection />
      <DifficultySection />
      <HapticsSection />
      <StyleSection />
      <ByMoveStatsSection />
      <AccessibilitySection />
      <PrivacySection />
      <ResetSection />
    </motion.div>
  );
}
