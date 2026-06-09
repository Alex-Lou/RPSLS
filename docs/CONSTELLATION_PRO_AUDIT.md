# Constellation Pro — Audit complet (2026-06-09)

**Demande Alex** : *"je veux autant comprendre mon jeu et ses subtilités que être certain qu'il y'a AUCUNE injustice ou erreur algorithmique, logique, mathématique et aléatoire ou non"*

**Audit effectué sur la branche `constellation-pro`** — couvre tous les fichiers de `app/src/arena/` + utilisation des sorts depuis `ranked/cards.ts`.

---

## 🔴 BUGS CRITIQUES (équité, à corriger urgent)

### #1 — Asymétrie de la phase de sorts entre side A et side B

**Code concerné** : `app/src/arena/arenaRules.ts:246-252` + `arenaResolverFlow.ts`

**Comportement actuel** :
```ts
b = applySpellPhase(b, intentA, "a");  // TOUS les sorts de A fire d'abord
b = applySpellPhase(b, intentB, "b");  // PUIS TOUS les sorts de B
```

→ A's spells sont triés par priorité montante (Aegis 100 → Surge 210 → Supernova 410)
→ MAIS toute la chaîne de A finit AVANT que B commence

**Scénario d'injustice** :
- A joue Aegis sur sa lane 1 + Supernova sur lane 2 opp
- B joue Aegis sur sa lane 2 (pour se protéger du Supernova)
- A's Aegis fire → A.lane1 protégée ✅
- A's Supernova fire → B.lane2 prend 6 dégâts (B n'a PAS pu Aegis encore) ❌
- B's Aegis fire → B.lane2 morte ou inutile

**Pourquoi c'est injuste** : B's Aegis priorité 100 DEVRAIT fire AVANT le Supernova A priorité 410. Mais comme l'ordre est SIDE-FIRST, le Supernova de A passe avant les Aegis de B.

**Fix** : INTERCALER les sorts des 2 sides par priorité, pas par side. Code :
```ts
export function applyAllSpells(board: BoardState, intentA: TurnIntent, intentB: TurnIntent): BoardState {
  const combined = [
    ...intentA.spells.map(s => ({ spell: s, side: "a" as Side })),
    ...intentB.spells.map(s => ({ spell: s, side: "b" as Side })),
  ];
  combined.sort((x, y) => spellPriority(x.spell.id) - spellPriority(y.spell.id));
  // Tie-breaker pour égalités de priorité : ordre déterministe (side a d'abord)
  // → léger avantage à A mais documenté. Alternative : random coin-flip
  // chaque cast, mais alors le jeu devient non-reproductible.
  let b = board;
  for (const { spell, side } of combined) {
    const card = CARDS[spell.id];
    const hero = side === "a" ? b.a : b.b;
    if (hero.mana < card.cost) continue;
    b = { ...b, [side]: { ...hero, mana: hero.mana - card.cost } } as BoardState;
    const ctx = { board: b, side, spell };
    b = applyArenaSpell(ctx);
  }
  return b;
}
```

Et appeler `applyAllSpells(b, intentA, intentB)` au lieu de 2 appels séparés.

---

## 🟠 PROBLÈMES DE DESIGN (à discuter)

### #2 — Mana spent sans effet si la cible est invalide

**Code concerné** : `arenaCardEffects.ts:applyCurse, applyEchappee, applyMirror, applyTrouNoir`, etc.

Quand un sort est joué avec une cible qui devient invalide entre le lock et le fire (ex : Échappée sur une lane vide, Curse sur Spock Logique, Trou Noir sur Spock), la mana est **déjà déduite** dans `applySpellPhase` (ligne 282). Le sort fizzle sans rien faire mais le joueur a payé.

**Exemples concrets** :
- Tu cast Curse 1 mana sur opp Spock → fizzle, 1 mana perdu
- Tu cast Échappée 1 mana sur lane vide → fizzle, 1 mana perdu
- Tu cast Trou Noir 4 mana sur Spock → fizzle, 4 mana perdus

**Options** :
- **A** : Garder tel quel (design choice : tu paies pour ton info imparfaite)
- **B** : Refund mana si fizzle (forgiving)
- **C** : Empêcher au moment du LOCK si target invalide (mais l'opp peut Anchor entre lock et fire)

Mon avis : **B** (refund) plus juste. Mais à discuter.

### #3 — Sangsue avec créature Lente / Fanaison / Émoussé

**Code concerné** : `arenaPhase2Spells.ts:applySangsue`

Sangsue heal le héros par `creatureEffectiveAtk(c)`. Si la créature est :
- Pierre Lente tour 1 (ATK 0) → heal 0
- Feuille Fanaison après 3 tours (ATK 1) → heal 1
- Ciseaux Émoussé (ATK 3) → heal 3

Joueur a payé 1 mana pour potentiellement 0 heal.

**Question** : devrait-on utiliser l'ATK BASE au lieu de l'effective ? Genre Sangsue Pierre Lente = heal 1 (base), pas 0.

### #4 — Logique Spock vs sorts GLOBAUX (Vortex / Genèse / Tide opp / Bénédiction opp)

**Code concerné** : `arenaPhase2Spells.ts:applyVortex`, `applyGenese`

Spock est immun aux sorts CIBLÉS adverses (Curse, Trou Noir, Sangsue). Mais les sorts GLOBAUX qui touchent toutes les créatures opp (Vortex rotate, Genèse destroy all) **n'épargnent PAS Spock**.

**Question** : Logique étend aux globaux ?
- **A** : Non, "ciblé seulement" comme aujourd'hui. Spock peut être Vortex/Genèse.
- **B** : Oui, Logique = "tous sorts opp". Genèse ne tue pas Spock, Vortex le laisse en place.

Le Finisher Spock du plan v2 inclut "Logique étend aux sorts globaux" — donc B est prévu pour la version Cosmique (Lot D). Pour la base, A reste.

### #5 — Augur révèle les 4 PREMIÈRES cartes, pas random

**Code concerné** : `arenaCardEffects.ts:applyAugur`

```ts
return { ...board, augurRevealedB: opp.hand.slice(0, 4) };
```

Si opp a 8 cartes en main (hand cap), Augur ne montre que les 4 PREMIÈRES dans l'ordre du tableau. Vu que le tirage ajoute en queue (`hand.push`), les 4 premières sont les plus VIEILLES de la main.

**Question** : random 4 plutôt ? Ou full hand mais coût plus haut ? Oracle Inverse fait full hand pour 2 mana (vs Augur 1 mana), donc le système actuel est cohérent économiquement.

### #6 — Heist vs Provocation Pierre opp

**Code concerné** : `arenaCardEffects.ts:applyHeist`

Heist fait 3 dégâts directs au héros opp. Mais **ignore la Provocation** Pierre opp (le code ne check pas findDeflector).

**Question** : la Pierre devrait-elle détourner Heist 3 dmg ?
- **A** : Non, Heist est un sort (pas une attaque physique). Provoc ne joue pas. **Cohérent avec Hearthstone**.
- **B** : Oui, Provoc bloque TOUT dégât au héros.

Aujourd'hui A est implementé. Cohérent thématiquement.

### #7 — Paradoxe Temporel ignore les divineShield des héros

**Code concerné** : `arenaPhase2Spells.ts:applyParadoxe`

```ts
return { ...board, a: damageHero(board.a, 5), b: damageHero(board.b, 5) };
```

`damageHero` honore divineShield (Aegis sur héros). Donc Paradoxe est absorbé si le héros a Aegis. ✅ OK.

---

## 🟢 OK — Mécaniques vérifiées et CORRECTES

### Stats des créatures (CREATURE_STATS)
| Symbole | ATK | HP | Passif inné |
|---|---|---|---|
| 🪨 Pierre | 1 | 3 | Provocation 1 charge |
| 📄 Feuille | 3 | 1 | Étouffe + anti-Provoc Pierre opp |
| ✂️ Ciseaux | 4 | 1 | Tranchant (perce Aegis) |
| 🦎 Lézard | 2 | 2 | Esquive 1 charge |
| 🖖 Spock | 2 | 3 | Logique (immun sorts ciblés) |

→ Cohérent avec MOVE_DESIGN_NOTES + HowItWorks.

### Combat one-shot + poursuite (resolveLaneCombat)

Ordre des sauvegardes au counter RPSLS :
1. **Esquive** (dodgeCharge Lézard) → loser survit, attacker n'attaque pas le héros
2. **Aegis** (divineShield) sauf si attacker Tranchant (Ciseaux) → loser survit, attacker n'attaque pas le héros
3. Sinon → loser meurt + attacker's effective ATK passe au héros opp
4. La poursuite peut être détournée par une Pierre alliée avec charges > 0 (consomme 1 charge)
5. La poursuite peut être damageHero-bloquée par divineShield du héros (Aegis self-cast)

Mirror match (même symbole) : trade ATK/HP normal (pas de poursuite, pas de winner RPSLS).

✅ Code symétrique entre side A et side B. Pas d'avantage A ou B.

### creatureEffectiveAtk — calcul des malus

```
base = CREATURE_STATS[move].atk + atkBuff

if summonedThisTurn AND move === rock:    return atkBuff (Lente, 0 ATK)
if summonedThisTurn AND move === lizard:  return 1 + atkBuff (Lent, 1 ATK)
if move === paper AND wiltedSteps > 0:    return max(1, 3 - wiltedSteps + atkBuff) (Fanaison)
if combatBlunted:                          return max(0, base - 1) (Émoussé)
sinon:                                     return max(0, base)
```

→ ✅ Logique correcte. Floor à 0 pour empêcher ATK négatives. Fanaison plancher 1.

### Provocation Pierre — 1 charge, rechargée par Aegis

- À l'invocation : `provocationCharges = move === "rock" ? 1 : 0`
- À chaque détournement (attaque undefended OU poursuite après counter) : `consumeProvocation` décrémente de 1
- Aegis sur Pierre : `provocationCharges = max(current, 1)` → recharge à 1 (pas accumulation)
- `findDeflector` renvoie le PREMIER rock avec charges > 0 (ordre lane 0, 1, 2)

✅ Cohérent. Une Pierre avec 0 charges devient un mur sans Provoc, juste 1/3 stats.

### Anti-taunt (Étouffe Feuille + anti-Provoc Spock)

`hasAntiTaunt(side)` retourne true si le side a une Paper OU Spock vivante. Si TRUE, l'opp Provocation est suspendue board-wide.

✅ Cohérent.

### Tranchant (Ciseaux perce Aegis)

Au combat de lane :
- Mirror : `cb.pierces ? damageCreaturePierce(ca, atkB) : damageCreature(ca, atkB)` — l'ATTAQUANT (cb pierces) bypass le shield de ca
- One-shot counter : check `cb.divineShield && !ca.pierces` — si attaquant ca est Tranchant, l'Aegis ne sauve PAS

✅ Symétrique et cohérent.

### Esquive Lézard — 1 charge

`dodgeCharge = move === "lizard"` à l'invocation. Au combat (mirror trade OU one-shot counter) :
- `damageCreature` : si dodgeCharge → consume, no HP loss
- `damageCreaturePierce` : si dodgeCharge → consume, no HP loss (Tranchant ne perce pas Esquive)
- One-shot counter : check `cb.dodgeCharge` → save creature ET poursuite n'a pas lieu

✅ Esquive a priorité sur Aegis. Tranchant ne perce pas Esquive. Cohérent.

### Logique Spock — immun aux sorts opp ciblés

Sorts qui check `opp.spellImmune` :
- Curse (`arenaCardEffects.ts:237`) ✅
- Supernova lane (`arenaCardEffects.ts:292`) ✅
- Trou Noir (`arenaPhase2Spells.ts:128`) ✅

Sorts qui ne check PAS spellImmune (par design — sorts globaux ou non-hostiles) :
- Vortex (global rotation) — affecte Spock, voir Question #4
- Genèse (board wipe) — affecte Spock, voir Question #4
- Tide (buff allié) — sort allié non concerné

✅ Cohérent pour ciblés.

### Détaché Spock — mes sorts ignorent Spock

Sorts qui check `isDetached(c)` ou `me.move === "spock"` (skip Spock côté CASTER) :
- Aegis lane ✅
- Anchor ✅
- Riposte ✅
- Precision ✅
- Surge ✅
- Tide (boucle) ✅
- Rempart (boucle) ✅
- Bénédiction (boucle) ✅

✅ Cohérent.

### endOfTurnReset — buffs reset correctement

```
atkBuff: 0
anchored: false
ripostePrimed: false
summonedThisTurn: false (cleared → Lente/Lent ne bite plus le tour suivant)
wiltedSteps: +1 si move === paper (Fanaison croît)
```

Passifs persistents (taunt, stifles, pierces, spellImmune, divineShield, dodgeCharge, combatBlunted, provocationCharges, hp).

✅ Cohérent.

### advanceToNextTurn

```
turn += 1
phase = "planning"
a + b : refreshHero (mana = min(maxMana + 1, MANA_CAP)) + drawCards(hero, 1)
augurRevealedA/B = []
```

✅ Mana ramp 1→2→...→10. Pioche 1/tour. Augur cleared.

### CPU AI (arenaAI.ts)

- **Defensive** (priorité 1) : Aegis sur ma créature qui mourrait (wouldDie calculé avec RPSLS one-shot)
- **Lethal** (priorité 2) : si hp opp ≤ 6 ou je peux le tuer ce tour, push Supernova/Heist
- **Develop** (priorité 3) : summon sur lanes vides, sauf si MAX_SUMMONS_PER_TURN (2) atteint
- **Spend mana** (priorité 4) : queue spells par coût desc

`pickBestMove` : sur lane vide, sac pondéré (Pierre 33% / Spock 22% / Ciseaux 22% / Lézard 11% / Feuille 11%). Sur lane occupée, choisit le best counter.

`targetOppBestCreature` : skip anchored OR spellImmune (cohérent).

✅ Pas de triche AI — utilise board public, pas le hand opp (sauf via Augur).

### Random utilisé

- `arenaAI.ts` : Math.random() pour skip chance, jitter lane order, pickBestMove sur lane vide, sac pondéré
- `arenaPhase2Spells.ts:Cascade` : Math.random() pour la carte discardée
- `arenaPhase2Spells.ts:Mascarade` : Math.random() pour la carte discardée opp
- `arenaRules.ts:shuffle` : Fisher-Yates shuffle du deck (correct)

✅ Pas de random caché. Tout est Math.random() standard, non-seedé donc non-reproductible (intentionnel pour les parties uniques).

### Économie globale

- HP héros : 20
- Mana cap : 10
- Hand cap : 8
- Starting hand : 4
- Cards per turn draw : 1
- TURN_HARD_CAP : 30 (sudden death) — pas encore implémenté côté code, juste constante

✅ Cohérent avec arenaTypes.ts. Plan v2 propose mana cap 8 + sudden death tour 15.

---

## 📋 Synthèse des actions

### À FIX maintenant
- [x] **#1 Asymétrie applySpellPhase** — créer `applyAllSpells` qui intercale par priorité

### À DISCUTER (décision design)
- [ ] **#2 Refund mana si target invalid** — sub-optimal aujourd'hui
- [ ] **#3 Sangsue avec malus créature** — base ATK vs effective ATK
- [ ] **#4 Logique Spock vs sorts globaux** — Vortex/Genèse affectent ou pas Spock
- [ ] **#5 Augur random vs 4 premières** — économie vs déterminisme
- [ ] **#6 Heist vs Provocation** — cohérent comme aujourd'hui
- [ ] **#7 Paradoxe ignore Aegis hero** — vérifié, OK

### Implémentations OK (pas de bug détecté)
- ✅ Combat one-shot + poursuite + sauvegardes (Esquive, Aegis, Provoc-déflexion)
- ✅ Stats des créatures + passifs innés (5 symboles)
- ✅ Malus thématiques (Lente, Lent, Fanaison, Émoussé, Détaché)
- ✅ Provocation Pierre 1 charge + recharge Aegis
- ✅ Anti-taunt Étouffe Feuille + Spock anti-Provoc
- ✅ Tranchant Ciseaux perce Aegis
- ✅ Esquive Lézard priorité sur Aegis
- ✅ Logique Spock immun aux sorts ciblés
- ✅ Détaché Spock — buffs alliés skip
- ✅ endOfTurnReset
- ✅ advanceToNextTurn (mana ramp, draws)
- ✅ CPU AI logique (pas de triche)
- ✅ Random standard (Math.random non-seedé)

---

**Conclusion** : le mode Pro est **largement correct** mathématiquement et logiquement. Le bug critique #1 (asymétrie spell phase) est le seul qui affecte directement l'équité du jeu. Les 6 questions de design sont des choix volontaires ou sub-optimaux mineurs, à trancher avec Alex.

Une fois #1 fixé, le système est solide pour aller plus loin (Lots B/C/D : Affinité + Constellation + Finishers).
