/**
 * arenaLogFriendly — traducteur "grand public" des logs techniques d'Arena.
 *
 * Alex 2026-06-13 : "un système de logs plus vulgarisé et compréhensible pour
 * tous — détaillé mais simple, complet mais vulgarisé". L'onglet SIMPLE de
 * l'ArenaDebugOverlay passe chaque entrée ici : si un pattern matche, on
 * retourne une phrase claire en français ; sinon `null` → la ligne est
 * simplement omise de l'onglet Simple (les steps internes du moteur —
 * `step=bluntDone`, snapshots de mains, etc. — restent visibles dans
 * l'onglet COMPLET uniquement).
 *
 * Convention solo : side "a" = le joueur ("Toi"), side "b" = l'adversaire.
 * Lanes L0/L1/L2 → "voie 1/2/3". Moves traduits en symboles FR du jeu.
 */

import type { ArenaLogEntry } from "./arenaLog";

const MOVE_FR: Record<string, string> = {
  rock: "Pierre", paper: "Feuille", scissors: "Ciseau", lizard: "Lézard", spock: "Spock",
};
const mv = (m: string): string => MOVE_FR[m] ?? m;
const who = (s: string): string => (s === "a" ? "Toi" : "Adversaire");
const heroOf = (s: string): string => (s === "a" ? "TON héros" : "le héros adverse");
const lane = (l: string): string => `voie ${Number(l) + 1}`;

/** Traduit une entrée de log en phrase simple, ou null si interne/technique. */
export function friendlyArenaLog(e: ArenaLogEntry): string | null {
  const m = e.msg;

  // Déjà vulgarisés à la source (blocages 🚫, fizzles 💤) : tels quels.
  if (m.startsWith("🚫") || m.startsWith("💤")) return m;

  let x: RegExpMatchArray | null;

  // ── Tours ──
  if ((x = m.match(/^=== Tour (\d+) === a\.hp=(\d+) b\.hp=(\d+)/)))
    return `🕐 Tour ${x[1]} — Toi ${x[2]} ❤ · Adversaire ${x[3]} ❤`;
  if (/BUT D'OR|Mort subite/i.test(m)) return "🌟 Égalité parfaite — MORT SUBITE !";
  if (/HARD CAP/.test(m)) return "⏱ Limite de tours atteinte — le héros le plus blessé s'incline.";

  // ── Invocations ──
  if ((x = m.match(/^([ab]) pose (\w+) L(\d)/)))
    return `🌟 ${who(x[1])} : ${mv(x[2])} invoqué sur la ${lane(x[3])}`;

  // ── Sorts nommés ──
  if ((x = m.match(/^([ab]) SUPERNOVA → 6 dmg hero ([ab])/)))
    return `💥 ${who(x[1])} : Supernova frappe ${heroOf(x[2])} (−6 ❤)`;
  if ((x = m.match(/^([ab]) SUPERNOVA L(\d) → 6 dmg/)))
    return `💥 ${who(x[1])} : Supernova pulvérise la créature adverse (${lane(x[2])})`;
  if ((x = m.match(/^([ab]) LARCIN → \[([\w-]+)\] volée/)))
    return `🃏 ${who(x[1])} : Larcin vole la carte « ${x[2]} » !`;
  if ((x = m.match(/^([ab]) LARCIN → main adverse vide.*3 dmg hero ([ab])/)))
    return `🃏 ${who(x[1])} : Larcin ne trouve rien à voler → 3 dégâts à ${heroOf(x[2])}`;
  if ((x = m.match(/^([ab]) MASCARADE L(\d) : (\w+) → (\w+)(?: \(counter (\w+)\))?/)))
    return `🎭 ${who(x[1])} : sur la ${lane(x[2])}, ${mv(x[3])} se déguise en ${mv(x[4])}${x[5] ? ` pour contrer ${mv(x[5])}` : ""}`;
  if ((x = m.match(/^([ab]) VERGER/)))
    return `🌿 ${who(x[1])} : le Verger régénère son héros`;
  if ((x = m.match(/^([ab]) MÉTAMORPHOSE/)))
    return `🦎 ${who(x[1])} : Métamorphose recharge l'esquive des Lézards`;
  if (/FINISHER UNLOCKED/i.test(m)) {
    const side = m.match(/^([ab])/)?.[1];
    return `⭐ ${side ? who(side) : ""} Constellation complète — FINISHER DÉBLOQUÉ !`;
  }
  if ((x = m.match(/^([ab]).*constellation ⭐ (\d)\/3/i)))
    return `⭐ ${who(x[1])} : Constellation ${x[2]}/3`;

  // ── ⚗️ Forge / fusions ──
  if ((x = m.match(/^([ab]) FORGE dépôt : ([\w-]+)/)))
    return `⚗️ ${who(x[1])} : « ${x[2]} » posée sur la Forge (visible, reprenable)`;
  if ((x = m.match(/^([ab]) FORGE reprise : ([\w-]+)/)))
    return `⚗️ ${who(x[1])} : « ${x[2]} » reprise de la Forge`;
  if ((x = m.match(/^([ab]) FUSION ⚗️ : ([\w-]+) \+ ([\w-]+) = ([\w-]+)/)))
    return `⚗️ FUSION ! ${who(x[1])} : ${x[2]} + ${x[3]} = « ${x[4]} » ✨`;

  // ── Économie expert (exil légendaires, mulligan) ──
  if ((x = m.match(/^([ab]) EXIL légendaire : \[([\w,-]+)\]/)))
    return `⭐ ${who(x[1])} : « ${x[2]} » exilée — les légendaires ne servent qu'UNE fois par partie`;
  if (/^mulligan :/.test(m))
    return `🔁 Mulligan — cartes remplacées, nouvelles cartes piochées`;

  // ── Caps / garde-fous ──
  if ((x = m.match(/BYPASS BLOCKED ([ab])/)))
    return `⚠️ ${who(x[1])} : un sort au-delà des limites du tour a été annulé`;

  // ── Combat (catégorie combat, messages "L0 ...") ──
  if ((x = m.match(/^L(\d) A wins → B die\. Splash (\d+) → hero b/)))
    return `⚔️ ${lane(x[1])} : TA créature gagne le duel — ${x[2]} dégâts percent jusqu'au héros adverse !`;
  if ((x = m.match(/^L(\d) B wins → A die\. Splash (\d+) → hero a/)))
    return `⚔️ ${lane(x[1])} : la créature ADVERSE gagne — ${x[2]} dégâts percent jusqu'à TON héros !`;
  if ((x = m.match(/^L(\d) A wins → B die\. Splash absorbé/)))
    return `⚔️ ${lane(x[1])} : TA créature détruit l'adversaire — son héros est protégé`;
  if ((x = m.match(/^L(\d) B wins → A die\. Splash absorbé/)))
    return `⚔️ ${lane(x[1])} : ta créature est détruite — ton héros est protégé`;
  if ((x = m.match(/^L(\d) (A|B) wins → AEGIS save (A|B)/)))
    return `🛡 ${lane(x[1])} : le bouclier divin absorbe le coup fatal (${x[3] === "A" ? "ta créature" : "créature adverse"} sauvée)`;
  if ((x = m.match(/^L(\d) (A|B) wins → ESQUIVE save (A|B) \(charge (\d) → (\d)\)/)))
    return `✨ ${lane(x[1])} : ${x[3] === "A" ? "ta créature" : "la créature adverse"} ESQUIVE l'attaque (${x[5]} esquive(s) restante(s))`;
  if ((x = m.match(/^L(\d).*Splash (\d+) → DEFLECTED par Pierre L(\d)/)))
    return `🪨 La Pierre (${lane(x[3])}) PROVOQUE : elle encaisse les dégâts à la place du héros`;
  if ((x = m.match(/^L(\d) (\w+)\(([ab])\)\d+HP undefended → hero ([ab]) atk=(\d+)/)))
    return `⚔️ ${lane(x[1])} : ${mv(x[2])} attaque sans opposition → −${x[5]} ❤ pour ${heroOf(x[4])}`;
  if ((x = m.match(/^L(\d) RIPOSTE/)))
    return `🗡 ${lane(x[1])} : RIPOSTE — le tueur est emporté avec sa victime !`;

  // ── Sorts Phase 2/3 avec logs dédiés (formats alignés sur arenaPhase3Spells) ──
  if ((x = m.match(/^([ab]) PERMUTATION L(\d) : (\w+) ↔ (\w+)/)))
    return `🔄 ${who(x[1])} : Permutation sur la ${lane(x[2])} — ${mv(x[3])} et ${mv(x[4])} changent de camp !`;
  if ((x = m.match(/^([ab]) TOILE GLUANTE L(\d) : (\w+)/)))
    return `🕸 ${who(x[1])} : Toile Gluante englue ${mv(x[3])} (${lane(x[2])}) — il ne peut plus attaquer ce tour`;
  if ((x = m.match(/^([ab]) GRAVITÉ → .*?(\d+) tuée\(s\) → pioche (\d+)/)))
    return `🌑 ${who(x[1])} : Gravité écrase les créatures adverses — ${x[2]} détruite(s), ${x[3]} carte(s) piochée(s)`;
  if ((x = m.match(/^([ab]) GRAVITÉ/)))
    return `🌑 ${who(x[1])} : Gravité écrase toutes les créatures adverses (−1 PV)`;
  if ((x = m.match(/^([ab]) COUP D'ŒIL → pioche 1 \+ révèle ([\w-]+|\(main vide\))/)))
    return `🔍 ${who(x[1])} : Coup d'Œil — pioche 1 et révèle « ${x[2]} »`;
  if ((x = m.match(/^([ab]) DOPPELGÄNGER → copie (\w+) sur L(\d)/)))
    return `👥 ${who(x[1])} : Doppelgänger copie ${mv(x[2])} sur la ${lane(x[3])}`;
  if ((x = m.match(/^([ab]) PURGE/)))
    return `🧹 ${who(x[1])} : Purge dissipe tous les buffs, boucliers et ancres adverses`;
  if ((x = m.match(/^([ab]) PHÉNIX/i)))
    return `🔥 ${who(x[1])} : Phénix veille — les créatures mortes ce tour renaîtront !`;
  if ((x = m.match(/^([ab]) ROUE DU DESTIN → (.+)/i)))
    return `🎡 ${who(x[1])} : la Roue du Destin tourne… ${x[2]} !`;
  if ((x = m.match(/^([ab]) SINGULARITÉ → .*?= (\d+) dmg/i)))
    return `🌀 ${who(x[1])} : Singularité — ${x[2]} dégâts massifs au héros adverse !`;
  if ((x = m.match(/^([ab]) RÉVERBÉRATION/i)))
    return `🔊 ${who(x[1])} : Réverbération répète le dernier sort !`;

  // Interne / technique (steps moteur, snapshots de main, états) → omis.
  return null;
}
