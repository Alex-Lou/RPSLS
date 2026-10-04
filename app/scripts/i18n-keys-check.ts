/**
 * i18n-keys-check — toute clé de traduction utilisée dans le code existe-t-elle
 * en français ET en anglais ?
 *
 * Scanne src/ pour les appels littéraux `t("…")`, `tNow("…")`, `tr("…")` et
 * vérifie, pour les clés `arena.*` et `tut.*` :
 *  - présence dans fr ET en ;
 *  - mêmes clés dans les fragments fr/en (locales/arena/*) ;
 *  - aucune clé de fragment masquée par le dictionnaire principal (doublon).
 * Les clés construites dynamiquement (`t("mode." + m)`) ne sont pas vérifiées.
 *
 * Usage : npx tsx app/scripts/i18n-keys-check.ts
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import en from "../src/i18n/locales/en";
import fr from "../src/i18n/locales/fr";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "../src");
const SCOPED = /./; // toutes les clés littérales de l'app

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !p.includes(`${join("i18n", "locales")}`)) out.push(p);
  }
  return out;
}

let failures = 0;
const fail = (msg: string) => { failures++; console.error(`  ÉCHEC  ${msg}`); };

const used = new Map<string, string>();
const CALL = /\b(?:t|tNow|tr)\(\s*["'`]([A-Za-z0-9_.\-]+)["'`]/g;
for (const file of walk(SRC)) {
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(CALL)) {
    // Préfixe de clé construite (`t("mode." + m)`) : non vérifiable ici.
    if (m[1].endsWith(".")) continue;
    if (SCOPED.test(m[1]) && !used.has(m[1])) used.set(m[1], file.replace(SRC + "/", ""));
  }
}
for (const [key, file] of used) {
  if (!(key in fr)) fail(`clé absente en fr : ${key} (${file})`);
  if (!(key in en)) fail(`clé absente en en : ${key} (${file})`);
}

// Fragments : parité fr/en et pas de doublon avec le dictionnaire principal.
for (const fragDir of ["arena", "app", "shell"].map((d) => join(SRC, "i18n/locales", d))) {
const mainSrc = { fr: readFileSync(join(SRC, "i18n/locales/fr.ts"), "utf8"), en: readFileSync(join(SRC, "i18n/locales/en.ts"), "utf8") };
const zones = [...new Set(readdirSync(fragDir).map((f) => f.split(".")[0]))];
for (const z of zones) {
  const load = async (l: "fr" | "en") => Object.keys((await import(join(fragDir, `${z}.${l}.ts`))).default as Record<string, string>);
  const kf = await load("fr"), ke = await load("en");
  for (const k of kf) if (!ke.includes(k)) fail(`fragment ${z} : « ${k} » en fr mais pas en en`);
  for (const k of ke) if (!kf.includes(k)) fail(`fragment ${z} : « ${k} » en en mais pas en fr`);
  for (const l of ["fr", "en"] as const) {
    for (const k of l === "fr" ? kf : ke) {
      if (mainSrc[l].includes(`"${k}":`)) fail(`fragment ${z} : « ${k} » existe déjà dans ${l}.ts (masqué)`);
    }
  }
}
}

console.log(`${used.size} clés utilisées vérifiées (fr + en).`);
if (failures > 0) { console.error(`\n${failures} échec(s).`); process.exit(1); }
console.log("Clés i18n OK.");
