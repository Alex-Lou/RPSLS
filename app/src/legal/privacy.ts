/**
 * Privacy policy content — structured data, rendered by PrivacyPage.
 *
 * Stored as plain objects (not markdown) so we don't ship a parser. Sections
 * map 1:1 to <section> blocks in the page. Each language has its own object;
 * the page picks based on the active locale. The public-facing URL hosted
 * for the Play Console listing should mirror this exact content.
 */

import type { Locale } from "../i18n";

export interface PrivacySection {
  title: string;
  body: string;
}

export interface PrivacyContent {
  title: string;
  intro: string;
  lastUpdated: string;
  sections: PrivacySection[];
  contactEmail: string;
}

export const PRIVACY_EMAIL = "alex.guennad@gmail.com";
export const PRIVACY_LAST_UPDATED = "2026-06-03";

const EN: PrivacyContent = {
  title: "Privacy Policy",
  intro:
    "This policy describes what data RPSLS collects, why, and your rights " +
    "over it. We collect the minimum needed to run the game.",
  lastUpdated: `Last updated: ${PRIVACY_LAST_UPDATED}`,
  contactEmail: PRIVACY_EMAIL,
  sections: [
    {
      title: "1. What we store locally",
      body:
        "Your nickname, avatar, theme choice, XP, level, LP / rank, " +
        "match history, card collection and deck, settings (haptic, " +
        "background, language). All of this lives only on your device " +
        "until you play online.",
    },
    {
      title: "2. What we send to the server",
      body:
        "When you play an online match, we send: your nickname, avatar URL " +
        "or chosen preset, a session ID, the moves you play, and the " +
        "match outcome. We do NOT send your phone identifiers, contacts, " +
        "location, ads ID, or any data unrelated to the match.",
    },
    {
      title: "3. Crash reporting (opt-in)",
      body:
        "If you turn on 'Send crash reports' in Settings, an anonymized " +
        "stack trace is sent to Sentry when the app crashes. This contains " +
        "no personal data, only error details that help us fix bugs. " +
        "You can turn it off any time.",
    },
    {
      title: "4. Children",
      body:
        "RPSLS is rated for everyone but contains online chat-free matches " +
        "and is intended for players aged 7 and up. We do not knowingly " +
        "collect data from children under 13.",
    },
    {
      title: "5. Your rights",
      body:
        "You can delete your local data by tapping 'Reset profile' in " +
        "Settings. For server-side deletion of any data tied to your " +
        "nickname, email the address below and we will erase it within 30 " +
        "days. You can also opt out of crash reporting at any time.",
    },
    {
      title: "6. Third parties",
      body:
        "We do not sell, share, or rent your data. Sentry (crash reports, " +
        "opt-in only) is the sole third-party service. No ads, no " +
        "analytics SDKs.",
    },
    {
      title: "7. Changes to this policy",
      body:
        "If we change this policy we will bump the 'Last updated' date and " +
        "show a notice the next time you open the app.",
    },
    {
      title: "8. Contact",
      body: `Questions or data requests: ${PRIVACY_EMAIL}`,
    },
  ],
};

const FR: PrivacyContent = {
  title: "Politique de confidentialité",
  intro:
    "Cette politique décrit les données collectées par RPSLS, pourquoi, " +
    "et vos droits dessus. Nous collectons le strict minimum nécessaire " +
    "au fonctionnement du jeu.",
  lastUpdated: `Dernière mise à jour : ${PRIVACY_LAST_UPDATED}`,
  contactEmail: PRIVACY_EMAIL,
  sections: [
    {
      title: "1. Ce qui est stocké localement",
      body:
        "Ton pseudo, ton avatar, ton thème, XP, niveau, LP / rang, " +
        "historique des parties, collection de cartes et deck, " +
        "préférences (vibration, fond, langue). Tout cela reste " +
        "uniquement sur ton appareil tant que tu ne joues pas en ligne.",
    },
    {
      title: "2. Ce qui est envoyé au serveur",
      body:
        "Quand tu joues une partie en ligne, nous envoyons : ton pseudo, " +
        "l'URL ou le preset de ton avatar, un identifiant de session, les " +
        "coups que tu joues, et le résultat du match. Nous N'envoyons PAS " +
        "les identifiants de ton téléphone, contacts, géolocalisation, " +
        "ID publicitaire, ni aucune donnée hors-partie.",
    },
    {
      title: "3. Rapports de crash (opt-in)",
      body:
        "Si tu actives 'Envoyer les rapports de crash' dans Paramètres, " +
        "une trace anonymisée est envoyée à Sentry quand l'app plante. " +
        "Aucune donnée personnelle, juste les détails du bug. " +
        "Désactivable à tout moment.",
    },
    {
      title: "4. Enfants",
      body:
        "RPSLS est noté tout-public mais propose des parties en ligne " +
        "(sans chat) et vise les 7 ans et plus. Nous ne collectons " +
        "sciemment aucune donnée des moins de 13 ans.",
    },
    {
      title: "5. Tes droits",
      body:
        "Tu peux effacer tes données locales via 'Réinitialiser le profil' " +
        "dans Paramètres. Pour effacer les données serveur liées à ton " +
        "pseudo, écris à l'adresse ci-dessous : nous supprimerons sous " +
        "30 jours. Tu peux aussi désactiver les rapports de crash à tout " +
        "moment.",
    },
    {
      title: "6. Tiers",
      body:
        "Nous ne vendons, partageons ni louons tes données. Sentry " +
        "(rapports de crash, opt-in uniquement) est le seul service " +
        "tiers. Pas de pub, pas de SDK d'analytics.",
    },
    {
      title: "7. Modifications de cette politique",
      body:
        "Si nous modifions cette politique, la date 'Dernière mise à " +
        "jour' sera incrémentée et un avis s'affichera à ta prochaine " +
        "ouverture de l'app.",
    },
    {
      title: "8. Contact",
      body: `Questions ou demandes : ${PRIVACY_EMAIL}`,
    },
  ],
};

/** Pick the right privacy content for the active locale. Falls back to EN. */
export function getPrivacyContent(locale: Locale): PrivacyContent {
  return locale === "fr" ? FR : EN;
}
