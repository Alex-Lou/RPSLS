/**
 * arena-net-check — preuve de la Phase 1 réseau Pro (arenaNet.ts).
 *
 *  1. Round-trip : un intent valide → serializeIntent → parseTurnIntent = égal.
 *  2. Anti-triche : parseTurnIntent REJETTE (→ null) tout intent malformé
 *     (id de carte inconnu, kind/lane/move hors domaine, non-objet, surdimensionné).
 *  3. Hash de ruleset : déterministe (même valeur à 2 appels) et non vide.
 *
 * Usage : npx tsx app/scripts/arena-net-check.ts
 */
import { serializeIntent, parseTurnIntent, arenaRulesetHash, ARENA_ENGINE_VERSION } from "../src/arena/arenaNet";
import type { TurnIntent } from "../src/arena/arenaTypes";

let fail = 0;
const ok = (cond: boolean, label: string) => {
  console.log(`${cond ? "✓" : "✗"} ${label}`);
  if (!cond) fail++;
};

// 1. Round-trip d'un intent valide (une carte lane connue + une invocation).
const valid: TurnIntent = {
  spells: [{ id: "aegis", kind: "lane", lane: 1 }, { id: "oracle", kind: "self" }],
  summons: [{ lane: 0, move: "rock" }],
};
const wire = serializeIntent(valid);
const parsed = parseTurnIntent(JSON.parse(JSON.stringify(wire)));
ok(parsed !== null && JSON.stringify(parsed) === JSON.stringify(valid), "round-trip intent valide = identique");

// 2. Rejets anti-triche — chacun DOIT donner null.
const bad: [string, unknown][] = [
  ["non-objet (string)", "haha"],
  ["null", null],
  ["spells absent", { summons: [] }],
  ["spells non-array", { spells: {}, summons: [] }],
  ["id de carte inconnu", { spells: [{ id: "___triche___", kind: "self" }], summons: [] }],
  ["kind invalide", { spells: [{ id: "aegis", kind: "wtf" }], summons: [] }],
  ["lane hors domaine (3)", { spells: [{ id: "aegis", kind: "lane", lane: 3 }], summons: [] }],
  ["lane manquante sur kind=lane", { spells: [{ id: "aegis", kind: "lane" }], summons: [] }],
  ["move invalide", { spells: [], summons: [{ lane: 0, move: "dragon" }] }],
  ["summon lane négative", { spells: [], summons: [{ lane: -1, move: "rock" }] }],
  ["trop d'invocations (4 > 3 lanes)", { spells: [], summons: [0, 1, 2, 0].map((l) => ({ lane: l, move: "rock" })) }],
  ["spells surdimensionné (DoS)", { spells: Array.from({ length: 65 }, () => ({ id: "aegis", kind: "self" })), summons: [] }],
];
for (const [label, raw] of bad) ok(parseTurnIntent(raw) === null, `rejet: ${label}`);

// 3. Hash de ruleset déterministe + non vide + préfixé version.
const h1 = arenaRulesetHash();
const h2 = arenaRulesetHash();
ok(h1 === h2, "hash ruleset déterministe (2 appels identiques)");
ok(h1.length > 0 && h1.startsWith(`${ARENA_ENGINE_VERSION}-`), `hash non vide + préfixe version (${h1})`);

console.log(`\n── Phase 1 réseau : ${fail === 0 ? "OK ✅" : `${fail} ÉCHEC(S) ❌`} ──`);
if (fail > 0) process.exitCode = 1;
