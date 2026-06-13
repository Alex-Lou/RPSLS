/**
 * gen-card-meta.mjs — SOURCE UNIQUE de la méta cartes pour le SERVEUR.
 *
 * Le serveur (Rust) a besoin de connaître, pour chaque carte, sa RARETÉ + son
 * COÛT + son KIND, afin de valider l'économie côté serveur (prix de craft,
 * tirages de pack, dust de doublon…) SANS faire confiance au client. Plutôt que
 * de dupliquer la liste à la main (= dérive garantie quand Alex ajoute des
 * cartes), on l'EXTRAIT de `app/src/ranked/cards.ts` (la source de vérité TS) et
 * on émet un JSON que le serveur embarque.
 *
 * Lancer après tout ajout/modif de carte :  node scripts/gen-card-meta.mjs
 * Sortie : crates/rpsls-server/cards_meta.json
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "app", "src", "ranked", "cards.ts");
const OUT = join(ROOT, "crates", "rpsls-server", "cards_meta.json");

const src = readFileSync(SRC, "utf8");

// Chaque def de carte commence par :  id: "X", cost: N, rarity: "Y"[, kind: "Z"]
const re = /id:\s*"([^"]+)",\s*cost:\s*(\d+),\s*rarity:\s*"(common|rare|epic|legendary)"(?:\s*,\s*kind:\s*"(active|passive|fusion)")?/g;

const cards = [];
const seen = new Set();
let m;
while ((m = re.exec(src)) !== null) {
  const [, id, cost, rarity, kind] = m;
  if (seen.has(id)) continue; // garde-fou anti-doublon
  seen.add(id);
  cards.push({ id, cost: Number(cost), rarity, kind: kind ?? "active" });
}

cards.sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(OUT, JSON.stringify(cards, null, 2) + "\n");
console.log(`gen-card-meta : ${cards.length} cartes → ${OUT}`);
