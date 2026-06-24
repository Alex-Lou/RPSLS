/**
 * Constellation Pro — card-as-spell effect table.
 *
 * Each of the 46 existing CardIds (from ranked/cards.ts) gets an Arena-mode
 * effect distinct from its Ranked effect (since the underlying mechanics
 * are different: HP/board state vs round wins). For MVP we ship effects
 * for ~15 cards; the rest fall back to a no-op + console warning so they
 * can be filtered out of the deck-builder in Arena context.
 *
 * Spell priorities (lower = earlier in the spell phase):
 *   100  defensive setup — Aegis, Anchor, Riposte
 *   200  buffs / debuffs — Precision, Surge, Curse, Tide
 *   300  utility / draw  — Prescience, Augur, Oracle, Mirror, Heist
 *   400  direct damage / removal — Supernova, Vortex
 *
 * Cards not yet ported to Arena have spellPriority 999 and `arenaSupported`
 * false — the Arena DeckManager filters those out so they can't be loaded.
 *
 * See docs/CONSTELLATION_PRO_DESIGN.md for the locked adaptations.
 */

import { alog } from "./arenaLog";
import { applyFinisher } from "./arenaFinishers";
import {
  applyAegis, applyAnchor, applyRiposte, applySecondWind, applyPrecision, applySurge,
  applyTide, applyCurse, applyPrescience, applyAugur, applyOracle, applyMirror,
  applyHeist, applyRazzia, applySurcharge, applyToxine, applyRappel, applyDoubleMot,
  applyEcho, applyChronomancien, applySupernova, applyVortex,
} from "./arenaPhase1Spells";
import {
  applyGaia, applySablier, applyOffre, applyRempart, applyBenediction,
  applyOracleInverse, applyCascade, applyEchappee, applyMascarade, applySangsue,
  applyTrouNoir, applyMarchandAmes, applyParadoxe, applyJuge, applyGenese,
  applyContrefort, applyVeineGaia, applyRefletEcho, applyFrenesie,
  applyRamure, applyDilatation,
} from "./arenaPhase2Spells";
import {
  applyFrappeParfaite, applyBastion, applyAvalanche, applySourceVitale,
  applyOmniscience, applyCocon, applyApocalypse, applyImposteur,
} from "./arenaFusionCards";
import {
  applyJetCaillou, applySeve, applyCoupOeil, applyPermutation, applyToileGluante,
  applyGravite, applyDoppelganger, applyPurge, applyRoueDestin, applyPhenix, applySingularite,
  applyEboulement, applyStrateVive, applyGardienPierre,
  applyMascaradeEnchainee, applyFuiteMasquee,
  applyCoupDeTaille, applyAcuite,
  applyPhotosynthese, applyRonces, applyLoiCausalite, applyConvergence,
} from "./arenaPhase3Spells";
import {
  applyEboulisFinal, applyDrainVital, applyCoupDansLombre,
  applyIntricationQuantique, applyTailladeMortelle,
} from "./arenaPhase4Spells";
import { type BoardState, type PlayedSpell, type Side } from "./arenaTypes";
import type { CardId } from "../ranked/rankedTypes";

export interface ArenaSpellContext {
  board: BoardState;
  side: Side;
  spell: PlayedSpell;
}

/* ───────────────────────── Priority table ───────────────────────── */

const PRIORITY_TABLE: Partial<Record<CardId, number>> = {
  // Defensive setup (100)
  aegis:        100,
  anchor:       110,
  riposte:      120,
  // Soins du HÉROS (470) — RESOLUS APRÈS les dégâts directs (Alex 2026-06-13) :
  // sinon le joueur voyait son PV MONTER (soin) PUIS DESCENDRE (Supernova) =
  // confus. Maintenant l'anim est dégât D'ABORD, soin ENSUITE. (Le verdict de
  // mort est calculé après TOUS les sorts → second souffle sauve toujours d'un
  // Supernova létal le même tour, le clamp à 0 est rattrapé par le soin.)
  "second-wind": 470,
  gaia:         475,
  // Mana / tempo (160) — fires early so the extra mana can be spent on
  // the same turn.
  sablier:      160,
  offre:        170,
  // Buffs / debuffs (200)
  precision:    200,
  surge:        210,
  tide:         220,
  rempart:      225,
  benediction:  228,
  curse:        230,
  // Utility / draw (300)
  prescience:   300,
  augur:        310,
  oracle:       320,
  "oracle-inverse": 325,
  mirror:       330,
  cascade:      335,
  echappee:     340,
  mascarade:    345,
  // Direct damage / removal (400)
  heist:        400,
  razzia:       408, // vol de la forge adverse (disruption setup)
  // ── 6 arts orphelins (2026-06-13) — alignés sur leur famille ──
  chronomancien: 165, // mana/tempo (tôt)
  surcharge:    215, // buff
  "double-mot": 218, // buff
  toxine:       236, // debuff
  echo:         322, // utility/pioche
  rappel:       412, // removal
  sangsue:      405,
  supernova:    410,
  vortex:       420,
  "trou-noir":  430,
  "marchand-ames": 440,
  paradoxe:     450,
  // Hand / board wipes (500) — fire LAST so prior effects are accounted for.
  juge:         500,
  genese:       510,
  // ⚗️ Cartes de FUSION (Forge 2026-06-13) — priorités alignées sur leur
  // famille (défense tôt, dégâts tard).
  bastion:           105,
  "source-vitale":   142,
  "frappe-parfaite": 212,
  cocon:             232,
  omniscience:       305,
  imposteur:         402,
  avalanche:         415,
  apocalypse:        460,
  // Finishers Lot D — fire EARLY (priority 60) so leur effet est en place
  // avant les autres sorts du tour (buff/debuff/dmg). C'est le climax du
  // hero, l'effet "écrase" la résolution.
  "finisher-forteresse":   60,
  "finisher-verger":       60,
  "finisher-lame":         60,
  "finisher-metamorphose": 60,
  "finisher-calcul":       60,
  // ── Nouvelles cartes Pro (2026-06-12) ──
  phenix:          130, // setup défensif (snapshot avant tout)
  seve:            148, // soin créature (avant buffs)
  "toile-gluante": 245, // debuff (après les buffs adverses)
  purge:           250, // dissipe APRÈS que les buffs adverses aient atterri
  permutation:     255, // manipulation de board
  "coup-oeil":     308, // pioche / info
  doppelganger:    348, // invocation utilitaire
  reverberation:   365, // TARD : rejoue le dernier sort déjà appliqué
  "jet-caillou":   405, // dégât direct créature
  gravite:         408, // dégât de zone
  singularite:     414, // dégât héros (scale board)
  "roue-destin":   418, // gamble, très tard
  // ── Voie Montagne (2026-06-22) ──
  "gardien-pierre": 125, // setup défensif (riposte + ancre)
  "strate-vive":    206, // buff (escalade ATK)
  contrefort:       226, // buff PV board-wide
  eboulement:       407, // dégât AOE
  "veine-gaia":     476, // soin héros (après les dégâts directs)
  // ── Voie Mirage (2026-06-22) ──
  "mascarade-enchainee": 128, // setup défensif (esquive)
  "fuite-masquee":       129, // setup défensif (esquive + malus tempo)
  "reflet-echo":         322, // utility / pioche-cycle
  // ── Voie Tranchant (2026-06-22) ──
  "coup-de-taille": 118, // setup (recharge perforation)
  acuite:           205, // buff (re-affûtage + ATK perm)
  frenesie:         216, // buff board-wide ATK
  // ── Voie Forêt (2026-06-23) ──
  ronces:           127, // setup défensif (riposte + bouclier)
  photosynthese:    149, // soin créature + ATK perm (avant les buffs)
  ramure:           227, // bouclier board-wide (après les buffs)
  // ── Voie Cosmos (2026-06-23) ──
  "dilatation-temporelle": 158, // mana/tempo (tôt, comme sablier/chronomancien)
  "loi-de-causalite":      246, // debuff/stase (après les buffs adverses, voisin toile-gluante)
  "convergence-cosmique":  412, // dégât héros tardif (voisin supernova/singularité)
  // ── Dégâts signature par Voie (2026-06-23) — dégâts héros tardifs ──
  "eboulis-final":         416, // dégât héros (= Pierres + Strates)
  "coup-dans-lombre":      417, // dégât héros (= Esquive)
  "intrication-quantique": 413, // dégât héros (= mes Spock)
  "taillade-mortelle":     411, // dégât héros brut (légendaire, voisin supernova)
  "drain-vital":           478, // dégât héros PUIS soin (après les dégâts, voisin veine-gaia)
};

export function spellPriority(id: CardId): number {
  return PRIORITY_TABLE[id] ?? 999;
}

/** Whether a card has an Arena adaptation. The Arena DeckManager hides
 *  cards that return false here so the deck-builder doesn't allow a 0-effect
 *  card to be slotted. Will grow as Phase 2 adapts the remaining 30 cards. */
export function arenaSupported(id: CardId): boolean {
  return id in PRIORITY_TABLE;
}

/* ───────────────────────── Effect dispatch ───────────────────────── */

export function applyArenaSpell(ctx: ArenaSpellContext): BoardState {
  const { board, side, spell } = ctx;
  switch (spell.id) {
    // ── Defensive setup ──
    case "aegis":       return applyAegis(board, side, spell);
    case "anchor":      return applyAnchor(board, side, spell);
    case "riposte":     return applyRiposte(board, side, spell);
    case "second-wind": return applySecondWind(board, side);
    // ── Buffs / debuffs ──
    case "precision":   return applyPrecision(board, side, spell);
    case "surge":       return applySurge(board, side, spell);
    case "tide":        return applyTide(board, side);
    case "curse":       return applyCurse(board, side, spell);
    // ── Utility / draw ──
    case "prescience":  return applyPrescience(board, side);
    case "augur":       return applyAugur(board, side);
    case "oracle":      return applyOracle(board, side);
    case "mirror":      return applyMirror(board, side, spell);
    // ── Healing ──
    case "gaia":        return applyGaia(board, side);
    // ── Mana / tempo ──
    case "sablier":     return applySablier(board, side);
    case "offre":       return applyOffre(board, side);
    // ── Buffs / debuffs ──
    case "rempart":     return applyRempart(board, side);
    case "benediction": return applyBenediction(board, side);
    // ── Utility / draw ──
    case "oracle-inverse": return applyOracleInverse(board, side);
    case "cascade":     return applyCascade(board, side);
    case "echappee":    return applyEchappee(board, side, spell);
    case "mascarade":   return applyMascarade(board, side, spell);
    // ── Direct damage / removal ──
    case "heist":       return applyHeist(board, side);
    case "razzia":      return applyRazzia(board, side);
    case "surcharge":    return applySurcharge(board, side, spell);
    case "toxine":       return applyToxine(board, side, spell);
    case "rappel":       return applyRappel(board, side, spell);
    case "double-mot":   return applyDoubleMot(board, side, spell);
    case "echo":         return applyEcho(board, side);
    case "chronomancien": return applyChronomancien(board, side);
    case "sangsue":     return applySangsue(board, side, spell);
    case "supernova":   return applySupernova(board, side, spell);
    case "vortex":      return applyVortex(board, side);
    case "trou-noir":   return applyTrouNoir(board, side, spell);
    case "marchand-ames": return applyMarchandAmes(board, side);
    case "paradoxe":    return applyParadoxe(board);
    // ── Hand / board wipes ──
    case "juge":        return applyJuge(board);
    case "genese":      return applyGenese(board);
    // ── Nouvelles cartes Pro (2026-06-12) ──
    case "jet-caillou":   return applyJetCaillou(board, side, spell);
    // ── Voie Montagne (2026-06-22) ──
    case "eboulement":     return applyEboulement(board, side, spell);
    case "strate-vive":    return applyStrateVive(board, side, spell);
    case "gardien-pierre": return applyGardienPierre(board, side, spell);
    case "contrefort":     return applyContrefort(board, side);
    case "veine-gaia":     return applyVeineGaia(board, side);
    // ── Voie Mirage (2026-06-22) ──
    case "mascarade-enchainee": return applyMascaradeEnchainee(board, side, spell);
    case "fuite-masquee":       return applyFuiteMasquee(board, side, spell);
    case "reflet-echo":         return applyRefletEcho(board, side);
    // ── Voie Tranchant (2026-06-22) ──
    case "coup-de-taille": return applyCoupDeTaille(board, side, spell);
    case "acuite":         return applyAcuite(board, side, spell);
    case "frenesie":       return applyFrenesie(board, side);
    // ── Voie Forêt (2026-06-23) ──
    case "ramure":         return applyRamure(board, side);
    case "photosynthese":  return applyPhotosynthese(board, side, spell);
    case "ronces":         return applyRonces(board, side, spell);
    // ── Voie Cosmos (2026-06-23) ──
    case "dilatation-temporelle": return applyDilatation(board, side);
    case "loi-de-causalite":      return applyLoiCausalite(board, side, spell);
    case "convergence-cosmique":  return applyConvergence(board, side);
    // ── Dégâts signature par Voie (2026-06-23) ──
    case "eboulis-final":         return applyEboulisFinal(board, side);
    case "drain-vital":           return applyDrainVital(board, side);
    case "coup-dans-lombre":      return applyCoupDansLombre(board, side);
    case "intrication-quantique": return applyIntricationQuantique(board, side);
    case "taillade-mortelle":     return applyTailladeMortelle(board, side);
    case "seve":          return applySeve(board, side, spell);
    case "coup-oeil":     return applyCoupOeil(board, side);
    case "permutation":   return applyPermutation(board, side, spell);
    case "toile-gluante": return applyToileGluante(board, side, spell);
    case "gravite":       return applyGravite(board, side);
    case "doppelganger":  return applyDoppelganger(board, side);
    case "purge":         return applyPurge(board, side);
    case "roue-destin":   return applyRoueDestin(board, side);
    case "phenix":        return applyPhenix(board, side);
    case "singularite":   return applySingularite(board, side);
    case "reverberation": {
      // Rejoue le DERNIER sort non-réverbération appliqué par ce côté ce tour
      // (tracké dans applyAllSpells) sur sa cible d'origine. Appel récursif à
      // self — borné (le sort rejoué n'est jamais une réverbération).
      const last = side === "a" ? board.lastSpellAppliedA : board.lastSpellAppliedB;
      if (!last) {
        alog("spell", `💤 ${side} Réverbération ne fait rien : aucun sort joué avant elle ce tour.`);
        return board;
      }
      alog("spell", `${side} RÉVERBÉRATION → rejoue [${last.id}]`);
      return applyArenaSpell({ board, side, spell: last });
    }
    // ── ⚗️ Cartes de fusion (Forge) ──
    case "frappe-parfaite": return applyFrappeParfaite(board, side, spell);
    case "bastion":         return applyBastion(board, side, spell);
    case "avalanche":       return applyAvalanche(board, side);
    case "source-vitale":   return applySourceVitale(board, side, spell);
    case "omniscience":     return applyOmniscience(board, side);
    case "cocon":           return applyCocon(board, side, spell);
    case "apocalypse":      return applyApocalypse(board, side);
    case "imposteur":       return applyImposteur(board, side);
    // ── Finishers Lot D — Constellation Pro ──
    case "finisher-forteresse":
    case "finisher-verger":
    case "finisher-lame":
    case "finisher-metamorphose":
    case "finisher-calcul":
      return applyFinisher(board, side, spell.id);
    default:
      // Unadapted card — no-op for MVP. Phase 2 fills these in.
      // eslint-disable-next-line no-console
      console.warn(`[arena] card "${spell.id}" has no Arena effect yet`);
      return board;
  }
}
