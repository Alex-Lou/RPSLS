/**
 * cards-consistency-check — les listes de cartes Arena (Pro) se contredisent-elles ?
 *
 * Une carte Pro vit dans plusieurs tables tenues à la main : effet
 * (applyArenaSpell), priorité (PRIORITY_TABLE → arenaSupported), IA
 * (CPU_PLAYABLE), decks signature, exclusions (ARENA_EXCLUDED), recettes de
 * fusion. Un oubli donne une carte morte sans aucune erreur (bug Bosquet
 * Épineux / Greffe, 2026-10 ; fusion Omniscience injouable).
 *
 * Usage : npx tsx app/scripts/cards-consistency-check.ts   (lancé par la CI)
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CARDS } from "../src/ranked/cards";
import type { CardId } from "../src/ranked/rankedTypes";
import { arenaSupported } from "../src/arena/arenaCardEffects";
import { cpuCanPlay } from "../src/arena/arenaAI";
import { isDeckable } from "../src/arena/arenaDecks";
import { SIGNATURE_DECK } from "../src/arena/arenaVoies";
import { FUSION_RECIPES } from "../src/arena/arenaFusionCards";
import { isCastOnDraw } from "../src/arena/arenaCastOnDraw";

const ids = Object.keys(CARDS) as CardId[];
const effectsSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "src", "arena", "arenaCardEffects.ts"),
  "utf8",
);
const effectCases = new Set([...effectsSrc.matchAll(/case "([a-z0-9-]+)":/g)].map((m) => m[1]));

const failures: string[] = [];
function expectNone(label: string, bad: string[]) {
  console.log(`${bad.length ? "FAIL" : "OK  "} ${label}${bad.length ? " : " + bad.join(", ") : ""}`);
  if (bad.length) failures.push(label);
}

expectNone("effet codé mais absent de PRIORITY_TABLE (carte injouable)",
  [...effectCases].filter((c) => c in CARDS && !arenaSupported(c as CardId)));
expectNone("dans PRIORITY_TABLE mais sans effet codé",
  ids.filter((id) => arenaSupported(id) && !effectCases.has(id)));
expectNone("jouable par le CPU mais pas en Pro",
  ids.filter((id) => cpuCanPlay(id) && !arenaSupported(id) && !isCastOnDraw(id)));
for (const [voie, deck] of Object.entries(SIGNATURE_DECK)) {
  expectNone(`deck signature ${voie} : cartes non deckables`, (deck ?? []).filter((c) => !isDeckable(c)));
}
expectNone("résultat de fusion sans effet Pro",
  FUSION_RECIPES.filter((r) => !arenaSupported(r.result)).map((r) => r.result));
expectNone("ingrédient de fusion non deckable (recette impossible)",
  FUSION_RECIPES.flatMap((r) => [r.a, r.b]).filter((c) => !isDeckable(c)));

console.log(failures.length ? `\n${failures.length} incohérence(s) ❌` : "\n── Cartes Pro : cohérentes ✅ ──");
process.exit(failures.length ? 1 : 0);
