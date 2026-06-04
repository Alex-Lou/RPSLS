/**
 * Internationalisation — 5 langues, dictionnaires plats.
 * Toutes les chaînes traduisibles passent par t(key).
 */

import { useStore } from "../store";

export type Locale =
  | "en" | "fr" | "es" | "de" | "it"
  | "pt" | "zh" | "ja" | "ru" | "ar"
  | "ko" | "hi" | "tr" | "pl" | "nl";

export const LOCALES: Record<Locale, { code: string; label: string; flag: string }> = {
  en: { code: "EN", label: "English",     flag: "🇬🇧" },
  fr: { code: "FR", label: "Français",    flag: "🇫🇷" },
  es: { code: "ES", label: "Español",     flag: "🇪🇸" },
  de: { code: "DE", label: "Deutsch",     flag: "🇩🇪" },
  it: { code: "IT", label: "Italiano",    flag: "🇮🇹" },
  pt: { code: "PT", label: "Português",   flag: "🇵🇹" },
  zh: { code: "ZH", label: "中文",         flag: "🇨🇳" },
  ja: { code: "JA", label: "日本語",       flag: "🇯🇵" },
  ru: { code: "RU", label: "Русский",     flag: "🇷🇺" },
  ar: { code: "AR", label: "العربية",     flag: "🇸🇦" },
  ko: { code: "KO", label: "한국어",       flag: "🇰🇷" },
  hi: { code: "HI", label: "हिन्दी",        flag: "🇮🇳" },
  tr: { code: "TR", label: "Türkçe",      flag: "🇹🇷" },
  pl: { code: "PL", label: "Polski",      flag: "🇵🇱" },
  nl: { code: "NL", label: "Nederlands",  flag: "🇳🇱" },
};

export const LOCALE_LIST: Locale[] = [
  "en", "fr", "es", "de", "it",
  "pt", "zh", "ja", "ru", "ar",
  "ko", "hi", "tr", "pl", "nl",
];

/** Languages that should render right-to-left. */
export const RTL_LOCALES: Set<Locale> = new Set(["ar"]);

type Dict = Record<string, string>;

/* ════════════ Per-locale dictionaries (one file each, under ./locales) ════════════ */
import en from "./locales/en";
import fr from "./locales/fr";
import es from "./locales/es";
import de from "./locales/de";
import it from "./locales/it";
import pt from "./locales/pt";
import zh from "./locales/zh";
import ja from "./locales/ja";
import ru from "./locales/ru";
import ar from "./locales/ar";
import ko from "./locales/ko";
import hi from "./locales/hi";
import tr from "./locales/tr";
import pl from "./locales/pl";
import nl from "./locales/nl";

const STRINGS: Record<Locale, Dict> = {
  en, fr, es, de, it,
  pt, zh, ja, ru, ar,
  ko, hi, tr, pl, nl,
};

/** Translation lookup with optional {key} interpolation. */
export function tFor(locale: Locale, key: string, params?: Record<string, string | number>): string {
  let s = STRINGS[locale]?.[key] ?? STRINGS.en[key] ?? key;
  if (params) {
    for (const k of Object.keys(params)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(params[k]));
    }
  }
  return s;
}

/** React hook returning a `t(key, params?)` function bound to the current locale. */
export function useT() {
  const locale = useStore((s) => s.locale);
  return (key: string, params?: Record<string, string | number>) => tFor(locale, key, params);
}

