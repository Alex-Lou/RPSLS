/**
 * arenaBalance — table CENTRALE et MUTABLE des leviers d'équilibrage des 5 Voies.
 *
 * But : le moteur lit `BALANCE.<voie>.<knob>` au lieu de magic numbers dispersés,
 * pour que le **Voie Balance Lab** (page `balance.html`, hors-jeu) puisse muter
 * ces valeurs via des sliders et re-simuler en live. Le JEU réel charge ce module
 * avec ses DÉFAUTS == valeurs historiques → **iso-comportement strict** (sauf le
 * seul changement validé par Alex 2026-06-27 : Strate +PV retiré, cf. strateHp=0).
 *
 * IMPORTANT (frontière de module) : chaque site de lecture DOIT lire `BALANCE.x`
 * INLINE (jamais `const X = BALANCE.x` hoisté en tête de module), sinon la valeur
 * est figée à l'import et le slider ne propage plus. Le Lab fait
 * `resetBalance(); applyBalance(cfg)` AVANT chaque batch de sim.
 *
 * Le LAB seul mute cet objet (sur sa page à part) ; sur la page du jeu, rien ne
 * le touche → le jeu reste sur les défauts. Pur data, zéro logique.
 */

export interface ArenaBalance {
  engine: {
    cap: number; // ENGINE_CAP — plafond commun des jauges de Voie
    risePerCounterWin: number; // +jauge par counter RPSLS de Voie gagné
    voieAtkBonus: number; // ATK+ d'un Spock OU Lézard de Voie (littéral PARTAGÉ)
    trancheAtkPerStack: number; // facteur du buff ATK global Tranchant (× trancheStack)
  };
  montagne: {
    strateAtk: number; // +ATK perm d'une Pierre qui tient (Strate)
    strateHp: number; // +PV simultané (Alex 2026-06-27 : RETIRÉ → 0)
    forteresseAtk: number; // +ATK perm donné par le Finisher Forteresse
    voieProvocationCharges: number; // charges de Provocation d'une Pierre de Voie
    eboulisPerRock: number; // dégâts d'Éboulis Final par Pierre (win-con Montagne)
    eboulisCap: number; // cap des dégâts d'Éboulis Final
    grondementCap: number; // cap du chip récurrent Grondement (= mes Strates/tour)
  };
  foret: {
    seveHealActive: number; // cap du soin Sève (Forêt active, nourrie)
    seveHealVerger: number; // cap du soin Verger (nourri)
    drainAmount: number; // Drain Vital (dégât = soin)
    secondWindHeal: number; // Second Souffle (soin héros)
    photosyntheseHeal: number; // Photosynthèse (soin créature)
    sangsueCap: number; // plafond du vol de vie Sangsue (anti-compounding Photosynthèse)
  };
  tranchant: {
    voieScissorsHp: number; // +PV d'un Ciseaux de Voie
    acuiteAtkCap: number; // cap d'ATK perm via Acuité
  };
  mirage: {
    dodgeCapOnSummon: number; // cap Esquive d'un Lézard de Voie posé
    dodgeSpellCap: number; // cap Esquive via Mascarade / Fuite Masquée
    coupDansLombreCap: number; // cap des dégâts de Coup dans l'Ombre
    voieLizardDodge: number; // charges Esquive de base d'un Lézard de Voie
    dodgeGrowAtk: number; // +ATK PERM gagné par un Lézard à chaque esquive (saveur « grandit » ; 0 = off, iso)
    dodgeGrowAtkCap: number; // plafond du +ATK cumulé via esquives (anti-explosion d'ATK)
    dodgeRiposte: number; // l'attaquant encaisse (ATK Lézard × ce facteur) quand le Lézard esquive (win-con Mirage ; 0 = off)
    dodgeCumulativeCap: number; // plafond GLOBAL des charges d'esquive (Métamorphose s'y plie → plus de « courant d'air »)
  };
  cosmos: {
    chipCap: number; // cap du chip inévitable Cosmos / tour
    convergenceDmgCap: number; // cap des dégâts de Convergence Cosmique
    intricationCap: number; // cap des dégâts d'Intrication Quantique
    calculDiscount: number; // réduction de coût de TOUS les sorts (Calcul)
    tempoDiscount: number; // jauge VIVANTE : −coût des sorts à cosmosCount≥2 (0 = off)
  };
}

/** Défauts du moteur. PASSE DE RÉÉQUILIBRAGE 2026-06-28 (sim seed 1337 IA-vs-IA,
 *  4000 parties, validée) — baseline 50 pts de spread → ~37, l'injustice
 *  structurelle Cosmos réglée :
 *   - Cosmos : chip RETIRÉ (chipCap 2→0, le « gagne sans interaction RPSLS » mort)
 *     + sorts-visage trimmés (convergence/intrication 6→3). 70%→52%.
 *   - Montagne : Strate +1 ATK (strateAtk 1→2). 42%→46%.
 *   - Mirage : win-con d'ÉVASION = RIPOSTE (l'attaquant encaisse l'ATK du Lézard qui
 *     esquive). Audit 2026-06-28 sur vraies parties Alex (67% + 19 esquives/partie +
 *     164 ripostes invisibles → injuste/illisible) → CALMÉE : riposte 1→0.5, grandit
 *     plafonné (dodgeGrowAtkCap 3), turtle borné (dodgeCapOnSummon 3 + cap GLOBAL
 *     dodgeCumulativeCap 4, Métamorphose 9→4). + FX riposte visible (cf. arenaCombat
 *     /arenaResolverFlow). Cible : Mirage fort MAIS juste ET lisible — jugé au Watcher.
 *   - Tranchant s'auto-rééquilibre dès que Cosmos baisse (matchup 19→43). 45%→47%.
 *  Antérieur : strateHp 1→0 (2026-06-27, +PV de Strate gaspillé en RPSLS-lock).
 *
 *  PASSE 2026-06-29 (sim seed 1337, 4000 parties, Balance Lab) — Forêt « increvable »
 *  signalée par Alex en vrai. Diagnostic : baseline Forêt 66.9% (écrase Cosmos/Montagne/
 *  Mirage >70%). Le mur de régen vient surtout du SOIN HÉROS empilé. Nerf CIBLÉ du
 *  sustain en gardant l'identité : secondWindHeal 4→2 (Second Souffle = suspect n°1),
 *  drainAmount 4→3 (Drain : dégât=soin, double-dip), seveHealVerger 2→1 (sur-soin du
 *  finisher). Sève active + Photosynthèse INTACTES (identité ; photosynthese mesurée
 *  INERTE sur le WR : +ATK perm dilué par le RPSLS-lock). Résultat : Forêt 66.9%→62.7%.
 *  PLAFOND knob mesuré ~57% MÊME en supprimant la Sève active → le reste de la
 *  domination Forêt est STRUCTUREL (Phénix revive / Ramure bouclier / Ronces / Sangsue,
 *  non exposés en knobs) = passe MÉCANIQUE dédiée si on veut viser 55%.
 *  COSMOS : 54.5% (la passe 2026-06-28 a réglé l'« injustice #1 », plus d'action).
 *  MIRAGE : 19.4% MAIS knobs INERTES (offense ×2 → 19.4% inchangé) — faiblesse
 *  MÉCANIQUE (finisher 2%, jauge ne monte que sur counter-Lézard) + IA qui sous-pilote
 *  l'esquive (en main humaine Mirage ~67% jadis). NON tunable ici = chantier dédié.
 *
 *  PASSE MONTAGNE 2026-06-30 (audit profond Watcher+sim+multi-agents). Racine du
 *  « décalage » = MÊME bug que Mirage : la jauge Strates ne montait que sur
 *  counter-rock-GAGNÉ (or rock perd vs paper/spock + est Lente) → finisher Forteresse
 *  à 5-6%, snowball jamais lancé. FIX MÉCANIQUE (arenaEngines.riseEngineOnHeld +
 *  resolver) : la jauge monte AUSSI quand une Pierre TIENT un tour (= la win-condition
 *  snowball, parallèle au fix esquive de Mirage) → finisher 5%→47%. KNOBS (survie aggro
 *  + climax) : strateHp 0→1 (re-test post-fix, +PV au mur qui tient → early 45%→55%),
 *  voieProvocationCharges 2→3 (le mur encaisse plus de splash early), eboulisCap 8→10
 *  (le snowball établi délivre un vrai coup de grâce, ne se plafonne plus à 8). WR
 *  Montagne 51→52% (sain, pas de sur-buff). RESTE : vs Forêt 28-29% (paper>rock +
 *  Forêt encore OP 62.7% — non corrigeable par knobs Montagne → carte anti-heal
 *  « Écrasement » OU passe Forêt dédiée) ; vs Cosmos 38%. Parité contenu (cartes/
 *  fusions/anims) Montagne à faire (Barricade validée, reste à détailler). */
export const DEFAULT_BALANCE: ArenaBalance = {
  engine: { cap: 3, risePerCounterWin: 1, voieAtkBonus: 1, trancheAtkPerStack: 2 },
  montagne: { strateAtk: 2, strateHp: 1, forteresseAtk: 2, voieProvocationCharges: 3, eboulisPerRock: 2, eboulisCap: 10, grondementCap: 3 },
  foret: { seveHealActive: 1, seveHealVerger: 1, drainAmount: 2, secondWindHeal: 1, photosyntheseHeal: 2, sangsueCap: 3 },
  tranchant: { voieScissorsHp: 1, acuiteAtkCap: 2 },
  mirage: { dodgeCapOnSummon: 3, dodgeSpellCap: 3, coupDansLombreCap: 3, voieLizardDodge: 1, dodgeGrowAtk: 1, dodgeGrowAtkCap: 3, dodgeRiposte: 0.5, dodgeCumulativeCap: 4 },
  cosmos: { chipCap: 0, convergenceDmgCap: 3, intricationCap: 3, calculDiscount: 1, tempoDiscount: 1 },
};

function clone(b: ArenaBalance): ArenaBalance {
  return {
    engine: { ...b.engine },
    montagne: { ...b.montagne },
    foret: { ...b.foret },
    tranchant: { ...b.tranchant },
    mirage: { ...b.mirage },
    cosmos: { ...b.cosmos },
  };
}

/** L'objet LU par le moteur. Mutable — le Lab le réécrit avant chaque sim. */
export const BALANCE: ArenaBalance = clone(DEFAULT_BALANCE);

/** Copie fraîche des défauts (état initial des sliders du Lab). */
export function makeDefaultBalance(): ArenaBalance {
  return clone(DEFAULT_BALANCE);
}

/** Restaure les défauts (le Lab l'appelle avant d'appliquer un nouveau réglage). */
export function resetBalance(): void {
  Object.assign(BALANCE.engine, DEFAULT_BALANCE.engine);
  Object.assign(BALANCE.montagne, DEFAULT_BALANCE.montagne);
  Object.assign(BALANCE.foret, DEFAULT_BALANCE.foret);
  Object.assign(BALANCE.tranchant, DEFAULT_BALANCE.tranchant);
  Object.assign(BALANCE.mirage, DEFAULT_BALANCE.mirage);
  Object.assign(BALANCE.cosmos, DEFAULT_BALANCE.cosmos);
}

/** Applique un patch partiel (par groupe) dans BALANCE (le Lab, après reset). */
export function applyBalance(patch: Partial<{ [K in keyof ArenaBalance]: Partial<ArenaBalance[K]> }>): void {
  for (const k of Object.keys(patch) as (keyof ArenaBalance)[]) {
    Object.assign(BALANCE[k], patch[k]);
  }
}
