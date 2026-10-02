/**
 * gen-economy-meta.mjs — SOURCE UNIQUE des barèmes d'économie pour le SERVEUR.
 *
 * Le serveur (Rust) doit connaître prix / récompenses / poids INDÉPENDAMMENT du
 * client (sinon un client modifié prétend « ce craft coûte 0 »). Plutôt que de
 * re-saisir ces barèmes à la main dans economy.rs (= dérive garantie quand Alex
 * retouche economy.ts), on les EXTRAIT de `app/src/engine/economy.ts` — et les
 * floors de tiers de `app/src/engine/rank.ts` pour les récompenses de saison —
 * et on émet un JSON que le serveur embarque (include_str!).
 *
 * Lancer après toute modif de barème :  node scripts/gen-economy-meta.mjs
 * Sortie : crates/rpsls-server/economy_meta.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ECO = readFileSync(join(ROOT, "app", "src", "engine", "economy.ts"), "utf8");
const RANK = readFileSync(join(ROOT, "app", "src", "engine", "rank.ts"), "utf8");
const THEMES = readFileSync(join(ROOT, "app", "src", "theme", "themes.ts"), "utf8");
const TYPES = readFileSync(join(ROOT, "app", "src", "types.ts"), "utf8");
const CATALOG = readFileSync(join(ROOT, "app", "src", "pages", "ProfilePage", "premiumCatalog.tsx"), "utf8");
const UNLOCKS = readFileSync(join(ROOT, "app", "src", "store", "rankedUnlocks.ts"), "utf8");
const OUT = join(ROOT, "crates", "rpsls-server", "economy_meta.json");

const fail = (msg) => { throw new Error(`gen-economy-meta: ${msg}`); };

/** Scalaire `export const NAME = 123;` */
function scalar(name) {
  const m = ECO.match(new RegExp(`export const ${name}\\s*=\\s*(\\d+)`));
  if (!m) fail(`const ${name} introuvable`);
  return Number(m[1]);
}

/** Corps `{ ... }` d'un objet nommé `NAME ... = { ... };` (les annotations de
 *  type peuvent contenir des `{}` mais jamais de `=` ni de `};`). */
function objectBody(src, name) {
  // tolère `} as const;` (WELCOME_BONUS) en plus de `};`
  const m = src.match(new RegExp(`${name}[^=]*=\\s*\\{([\\s\\S]*?)\\}\\s*(?:as\\s+const)?\\s*;`));
  if (!m) fail(`objet ${name} introuvable`);
  return m[1];
}

/** Corps `[ ... ]` d'un tableau nommé. */
function arrayBody(src, name) {
  const m = src.match(new RegExp(`${name}[^=]*=\\s*\\[([\\s\\S]*?)\\]\\s*;`));
  if (!m) fail(`tableau ${name} introuvable`);
  return m[1];
}

/** Paires `key: 123` d'un corps d'objet → { key: number }. */
function numMap(body) {
  const out = {};
  for (const m of body.matchAll(/(\w+)\s*:\s*(\d+)/g)) out[m[1]] = Number(m[2]);
  return out;
}

const eclatsPerWin = numMap(objectBody(ECO, "ECLATS_PER_WIN"));
const packWeights = numMap(objectBody(ECO, "PACK_WEIGHTS"));
const dustPerDuplicate = numMap(objectBody(ECO, "DUST_PER_DUPLICATE"));
const craftCost = numMap(objectBody(ECO, "CRAFT_COST"));
const welcomeBonus = numMap(objectBody(ECO, "WELCOME_BONUS"));

// Ids des sets premium (whitelist anti-forge serveur) — UNION des `premiumSetId`
// déclarés sur les fonds (themes.ts) ET les pads (PAD_META dans types.ts), car un
// set est un bundle fond+pad+HUD. Un id absent de cette liste ne peut PAS être
// légitimement possédé → le serveur le retire de ownedPremiumSets. L'union ne
// peut qu'ajouter de vrais ids (jamais en retirer) → zéro perte.
const premiumSetIds = [...new Set(
  [THEMES, TYPES].flatMap((src) =>
    [...src.matchAll(/premiumSetId:\s*"([a-z0-9-]+)"/g)].map((m) => m[1]),
  ),
)].sort();
if (!premiumSetIds.length) fail("aucun premiumSetId trouvé dans themes.ts / types.ts");

const codexTiers = [];
for (const m of arrayBody(ECO, "CODEX_TIERS").matchAll(
  /threshold:\s*(\d+),\s*eclats:\s*(\d+),\s*dust:\s*(\d+)/g)) {
  codexTiers.push({ threshold: Number(m[1]), eclats: Number(m[2]), dust: Number(m[3]) });
}
if (!codexTiers.length) fail("CODEX_TIERS vide");

// SEASON_REWARDS = RANK_TIERS.map(floor) + SEASON_REWARD_AMOUNTS[id] (cf. economy.ts).
const seasonAmounts = {};
for (const m of objectBody(ECO, "SEASON_REWARD_AMOUNTS").matchAll(
  /(\w+):\s*\{\s*eclats:\s*(\d+),\s*dust:\s*(\d+)\s*\}/g)) {
  seasonAmounts[m[1]] = { eclats: Number(m[2]), dust: Number(m[3]) };
}
const rankTiers = [];
for (const m of arrayBody(RANK, "RANK_TIERS").matchAll(/id:\s*"(\w+)"[\s\S]*?floor:\s*(\d+)/g)) {
  rankTiers.push({ id: m[1], floor: Number(m[2]) });
}
if (!rankTiers.length) fail("RANK_TIERS vide");
const seasonRewards = rankTiers.map((t) => {
  const a = seasonAmounts[t.id];
  if (!a) fail(`SEASON_REWARD_AMOUNTS manque le tier "${t.id}"`);
  return { minLp: t.floor, eclats: a.eclats, dust: a.dust };
});

// Prix des sets premium (✦) — PREMIUM_SETS de premiumCatalog.tsx. Chaque set
// connu du serveur DOIT avoir un prix, sinon il ne pourrait pas être acheté.
const premiumSetCosts = {};
for (const m of CATALOG.matchAll(/id:\s*"([a-z0-9-]+)",[\s\S]*?cost:\s*(\d+)/g)) {
  premiumSetCosts[m[1]] = Number(m[2]);
}
for (const id of premiumSetIds) {
  if (!(id in premiumSetCosts)) fail(`set premium "${id}" sans prix dans premiumCatalog.tsx`);
}

// Cartes de déblocage (rankedUnlocks.ts) : le serveur ne peut pas vérifier la
// condition (victoires vs CPU), mais il borne la réclamation à CETTE liste.
const unlockCards = [...new Set([
  ...[...UNLOCKS.matchAll(/set\.add\("([a-z0-9-]+)"\)/g)].map((m) => m[1]),
  ...[...UNLOCKS.matchAll(/for \(const c of \[([^\]]*)\]\)/g)]
    .flatMap((m) => [...m[1].matchAll(/"([a-z0-9-]+)"/g)].map((x) => x[1])),
])].sort();
if (!unlockCards.length) fail("aucune carte de déblocage trouvée dans rankedUnlocks.ts");

// SEASON_DURATION_MS = produit d'entiers (ex. 30 * 24 * 3600 * 1000).
const seasonExpr = ECO.match(/export const SEASON_DURATION_MS\s*=\s*([\d\s*]+);/);
if (!seasonExpr) fail("SEASON_DURATION_MS introuvable");
const seasonDurationMs = seasonExpr[1].split("*").reduce((acc, n) => acc * Number(n.trim()), 1);

const meta = {
  packCost: scalar("PACK_COST"),
  packSize: scalar("PACK_SIZE"),
  eclatsPerLoss: scalar("ECLATS_PER_LOSS"),
  eclatsPerWin,
  packWeights,
  dustPerDuplicate,
  craftCost,
  welcomeBonus,
  premiumSetIds,
  codexTiers,
  seasonRewards,
  premiumSetCosts,
  arenaEclats: numMap(objectBody(ECO, "ARENA_ECLATS")),
  cpuEclatsDailyCap: scalar("CPU_ECLATS_DAILY_CAP"),
  unlockCards,
  seasonDurationMs,
};
writeFileSync(OUT, JSON.stringify(meta, null, 2) + "\n");
console.log(`gen-economy-meta : ${codexTiers.length} paliers codex, ${seasonRewards.length} paliers saison → ${OUT}`);
