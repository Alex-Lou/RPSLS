import { useRef } from "react";
import { motion } from "motion/react";
import { useT } from "../../i18n";
import { PlayerBadge } from "../../ui/PlayerBadge";
import type { Page } from "../../Sidebar";
import { ProfileTabBar } from "./ProfileTabBar";
import { useProfileTab, type ProfileTab } from "./useProfileTab";
import { IdentityCard } from "./IdentityCard";
import { ByMoveStatsSection } from "./ByMoveStatsSection";
import { AvatarSection } from "./AvatarSection";
import { StyleSection } from "./StyleSection";
import { GameplaySection } from "./GameplaySection";
import { HapticsSection } from "./HapticsSection";
import { DisplaySection } from "./DisplaySection";
import { PrivacySection } from "./PrivacySection";
import { ResetSection } from "./ResetSection";

/** Page Profil — deux onglets (validés produit) au lieu d'une seule page
 *  « fourre-tout » de ~5000 px :
 *   - Profil   : identité (badge, pseudo, stats, stats par coup), avatar,
 *                style (apparences, tapis, premium) ;
 *   - Réglages : partie (difficulté, combat rapide), vibrations, affichage
 *                (taille du texte, qualité graphique), confidentialité, reset.
 *  L'onglet est mémorisé (localStorage). Chaque section garde son propre
 *  état + accès store ; cet orchestrateur ne fait que la mise en page.
 *  `onNavigate` (fourni par App.tsx) sert aux puces de monnaie → boutique. */
export function ProfilePage({ onNavigate }: { onNavigate?: (page: Page) => void } = {}) {
  const t = useT();
  const [tab, setTab] = useProfileTab();
  const topRef = useRef<HTMLDivElement>(null);

  const switchTab = (next: ProfileTab) => {
    setTab(next);
    // Le nouvel onglet démarre en haut (sinon on atterrit au milieu d'une
    // liste plus courte/longue selon le défilement précédent).
    const el = topRef.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start" });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-3xl mx-auto px-4 sm:px-5 pt-2 pb-6 md:p-6 flex flex-col gap-4"
    >
      <h1 className="font-headline text-3xl font-extrabold tracking-tight">{t("nav.profile")}</h1>

      <div ref={topRef} className="scroll-mt-14">
        <ProfileTabBar value={tab} onChange={switchTab} />
      </div>

      <motion.div
        key={tab}
        id={`profile-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`profile-tab-${tab}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col gap-4"
      >
        {tab === "profile" ? (
          <>
            {/* Même badge que l'en-tête des menus : surface joueur IDENTIQUE
                partout (pseudo + stats détaillées dans la carte Identité). */}
            <PlayerBadge onCurrencyTap={onNavigate ? () => onNavigate("shop") : undefined} />
            <IdentityCard />
            <ByMoveStatsSection />
            <AvatarSection />
            <StyleSection />
          </>
        ) : (
          <>
            <GameplaySection />
            <HapticsSection />
            <DisplaySection />
            <PrivacySection />
            <ResetSection />
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
