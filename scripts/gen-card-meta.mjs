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

// Chaque def de carte commence par :  id: "X", cost: N, rarity: "Y". Le `kind`
// peut venir APRÈS d'autres champs (`voie: "lizard", kind: "fusion"`) : on le
// cherche donc dans tout le BLOC de la carte (jusqu'à la fermeture `},` de son
// objet, sans déborder sur un commentaire qui suit), sinon une fusion passerait
// pour une carte active collectionnable.
const re = /id:\s*"([^"]+)",\s*cost:\s*(\d+),\s*rarity:\s*"(common|rare|epic|legendary)"/g;
const heads = [...src.matchAll(re)];

const cards = [];
const seen = new Set();
heads.forEach((m, i) => {
  const [, id, cost, rarity] = m;
  if (seen.has(id)) return; // garde-fou anti-doublon
  seen.add(id);
  const next = i + 1 < heads.length ? heads[i + 1].index : src.length;
  const close = src.indexOf("},", m.index);
  const block = src.slice(m.index, close === -1 ? next : Math.min(close, next));
  const kind = block.match(/\bkind:\s*"(active|passive|fusion)"/)?.[1] ?? "active";
  cards.push({ id, cost: Number(cost), rarity, kind });
});

cards.sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(OUT, JSON.stringify(cards, null, 2) + "\n");
console.log(`gen-card-meta : ${cards.length} cartes → ${OUT}`);
