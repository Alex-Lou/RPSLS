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
  };
  foret: {
    seveHealActive: number; // cap du soin Sève (Forêt active, nourrie)
    seveHealVerger: number; // cap du soin Verger (nourri)
    drainAmount: number; // Drain Vital (dégât = soin)
    secondWindHeal: number; // Second Souffle (soin héros)
    photosyntheseHeal: number; // Photosynthèse (soin créature)
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
  };
  cosmos: {
    chipCap: number; // cap du chip inévitable Cosmos / tour
    convergenceDmgCap: number; // cap des dégâts de Convergence Cosmique
    intricationCap: number; // cap des dégâts d'Intrication Quantique
    calculDiscount: number; // réduction de coût de TOUS les sorts (Calcul)
  };
}

/** Défauts du moteur. Iso-comportement VÉRIFIÉ (sim seed 1337 byte-identique au
 *  baseline) AVANT le seul changement validé : strateHp 1→0 (Alex 2026-06-27 —
 *  le +PV de Strate est gaspillé en RPSLS, un counter tue quel que soit le PV ;
 *  la Strate ne renforce plus QUE la menace via +ATK). */
export const DEFAULT_BALANCE: ArenaBalance = {
  engine: { cap: 3, risePerCounterWin: 1, voieAtkBonus: 1, trancheAtkPerStack: 1 },
  montagne: { strateAtk: 1, strateHp: 0, forteresseAtk: 2, voieProvocationCharges: 2, eboulisPerRock: 2, eboulisCap: 8 },
  foret: { seveHealActive: 1, seveHealVerger: 2, drainAmount: 4, secondWindHeal: 4, photosyntheseHeal: 2 },
  tranchant: { voieScissorsHp: 1, acuiteAtkCap: 2 },
  mirage: { dodgeCapOnSummon: 5, dodgeSpellCap: 3, coupDansLombreCap: 6, voieLizardDodge: 2 },
  cosmos: { chipCap: 2, convergenceDmgCap: 6, intricationCap: 6, calculDiscount: 1 },
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
