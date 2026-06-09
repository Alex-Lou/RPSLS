# Constellation Pro v2 — Plan complet

**Date** : 2026-06-09
**Statut** : DESIGN VALIDÉ par Alex, en attente d'implémentation
**Branche cible** : `constellation-pro`

---

## 1. Vue d'ensemble

Constellation Pro v2 garde la base CCG familière (3 lanes, mana, créatures, sorts) MAIS ajoute 3 couches de profondeur stratégique uniques au mode :

- **Couche 1 — Affinité RPSLS** : chaque joueur choisit AVANT le match son symbole signature (1 sur 5). Donne un bonus passif permanent à ses créatures de ce type.
- **Couche 2 — Constellation à 3 étoiles** : objectif personnel à compléter pendant la partie. Pose ton symbole d'affinité 3 fois cumulé → complète ta constellation.
- **Couche 3 — Finisher** : carte légendaire unique gratuite qui apparaît dans ta main quand ta constellation est complète. Game-changer 1× par partie.

→ Résultat : stratégie identitaire ("je suis joueur Pierre") + dilemme tactique permanent ("respecter ma Voie pour le Finisher OU dévier pour counter l'opp").

---

## 2. Mécaniques de base (HÉRITÉES de v1)

Tout ce qui suit reste en l'état :

- **3 lanes** par side
- **20 HP** par héros
- **Mana** : 1 au tour 1, +1 par tour, cap à **8 mana** (réduit de 10 → 8 pour matchs plus serrés)
- **5 symboles RPSLS** : Pierre 1/3, Feuille 3/1, Ciseaux 4/1, Lézard 2/2, Spock 2/3
- **Combat RPSLS one-shot AVEC POURSUITE** (règle 2026-06-09) : counter = mort instant du perdant + le gagnant **continue son swing au héros opp** pour son ATK effective. Détourné par Provocation alliée si présente ailleurs. Esquive Lézard absorbe TOUT le swing (créature ET héros sauvés). Même symbole = trade ATK/HP normal sans poursuite.
- **5 passifs innés** : Provocation, Étouffe, Tranchant, Esquive, Logique (avec leurs malus respectifs : Lente, Fanaison, Émoussé, Lent, Détaché)
- **Anti-Provocation** : opp Feuille OU Spock supprime la Provocation Pierre board-wide
- **Cartes bonus** (~30 cartes adaptées Arena, jouables en sorts à mana)

---

## 3. Couche 1 — Les 5 Affinités

### Choix de l'affinité

En phase de préparation (avant chaque match), le joueur choisit 1 des 5 Voies RPSLS. Le choix est **affiché sur le board pendant tout le match** (icône d'affinité au-dessus de son portrait).

### Tableau des bonus passifs

| Affinité | Symbole | Bonus passif sur tes créatures de ce type |
|---|---|---|
| 🪨 **Voie de la Pierre** | Rock | Provocation **2 charges** au lieu de 1 (recharge naturelle au lieu de Aegis-only) |
| 📄 **Voie de la Feuille** | Paper | Fanaison **ralentie** : −1 ATK tous les **2 tours** au lieu de chaque tour |
| ✂️ **Voie des Ciseaux** | Scissors | **+1 HP** (HP 2 au lieu de 1) — survit à un échange |
| 🦎 **Voie du Lézard** | Lizard | Esquive **2 charges** au lieu de 1 |
| 🖖 **Voie de Spock** | Spock | **+1 ATK** (ATK 3 au lieu de 2) — touche plus fort |

### Règles importantes

- Le bonus ne s'applique qu'à TES créatures **du symbole d'affinité**. Si tu poses un Ciseaux et que ton affinité est Pierre → le Ciseaux n'a pas le bonus.
- Le joueur n'est PAS obligé de jouer son affinité. Il peut poser n'importe quel symbole pour s'adapter à l'opp.
- L'opp VOIT ton affinité dès le départ (transparence — tu sais à quoi t'attendre).

---

## 4. Couche 2 — La Constellation à 3 étoiles

### Le compteur visible

Au-dessus du board (entre le centre-status et le opp strip), affiche **3 étoiles** alignées :

```
        ✨ ✨ ✨        ← Constellation Pierre (vide)
        ⭐ ✨ ✨        ← 1ère Pierre posée
        ⭐ ⭐ ⭐        ← 3 Pierres posées : CONSTELLATION COMPLÈTE
```

### Règles d'allumage

- À chaque fois que tu **invoques** ton symbole d'affinité (peu importe la lane), 1 étoile s'allume.
- Cumulatif : compte tous les invocations de la partie. Même si la créature meurt, ça compte.
- Les **sorts qui invoquent une créature** (Mirror, Verger via Finisher Feuille) **comptent aussi**.
- Quand la 3e étoile s'allume → le Finisher arrive dans ta main au début du tour suivant.

### Visualisation

- Étoiles non allumées : grises avec pulsation discrète
- Étoiles allumées : couleur de l'affinité (Pierre amber, Feuille emerald, Ciseaux rose, Lézard sky, Spock violet) avec halo
- Animation : flash + ding sonore à chaque allumage

---

## 5. Couche 3 — Les 5 Finishers

### Règles génériques

- Carte automatiquement ajoutée à la main quand la constellation est complète
- **Coût mana** : 0 (gratuite)
- **Utilisable** : 1× par partie
- **Cinématique** : 1.5s d'animation épique avant l'effet
- **Apparaît dans la main** comme une carte gold-rimmed légendaire
- **Ne peut être défaussée** : reste en main jusqu'à utilisation ou fin de partie

### Détail des 5 Finishers

#### 🪨 FORTERESSE (Voie de la Pierre)
- **Effet** : toutes les attaques sur ton héros sont **annulées pendant 2 tours**. Tes créatures peuvent encore attaquer normalement.
- **Calcul d'équilibre** : 2 tours d'invulnérabilité = ~6-10 HP économisés. Énorme pour la défense.
- **Implémentation** : flag `playerInvulnerableTurnsLeft: 2` sur HeroState. Dans `damageHero()`, si > 0 → return hero unchanged + decrement.
- **Cinématique** : 3 piliers de pierre se lèvent du sol autour du héros, dôme amber.

#### 📄 VERGER ÉTERNEL (Voie de la Feuille)
- **Effet** : invoque automatiquement **1 Feuille fraîche** (3/1, avec ton bonus +Feuille Fanaison ralentie) sur **chaque lane vide à toi**. Si toutes tes lanes sont occupées → toutes tes Feuilles existantes regagnent leur ATK max et leur `wiltedSteps` est reset à 0.
- **Calcul d'équilibre** : 3 Feuilles d'un coup = 9 ATK potentiel sur les 3 lanes. Fort mais aucune Provocation pour défendre derrière.
- **Implémentation** : itère sur les lanes, si `lane.a === null` → invoque `makeCreature("paper", "a")`. Sinon, reset `wiltedSteps` et `atkBuff: 0`.
- **Cinématique** : tornade de pétales verts qui se posent en feuilles sur les lanes.

#### ✂️ LAME COSMIQUE (Voie des Ciseaux)
- **Effet** : **8 dégâts directs au héros opp** (ignore Provocation, ignore Aegis sur héros).
- **Calcul d'équilibre** : 8 sur 20 HP = 40%. Très fort mais ne tue pas seul (besoin de finir).
- **Implémentation** : `damageHero(opp, 8, { ignoreShield: true })` — nouvelle option pour skip `divineShield`. La taunt board-wide est aussi bypassée.
- **Cinématique** : éclair argenté qui traverse le board diagonalement → impact sonore tranchant.

#### 🦎 MÉTAMORPHOSE (Voie du Lézard)
- **Effet** : toutes tes créatures gagnent **Esquive 1 charge** (qu'elles soient Lézard ou pas) + tes Lézards regagnent leur dodgeCharge si consommé.
- **Calcul d'équilibre** : sauve 3-6 dégâts (selon nombre créatures attaquées). Bonus défensif + survie globale.
- **Implémentation** : itère sur tes créatures, set `dodgeCharge: true` pour toutes.
- **Cinématique** : skin écailleux luisant qui couvre toutes tes créatures.

#### 🖖 CALCUL QUANTIQUE (Voie de Spock)
- **Effet** : **pioche 4 cartes** + immunité aux sorts opp pour 1 tour (sur toi et toutes tes créatures) + révèle la main complète opp **pour le reste de la partie**.
- **Calcul d'équilibre** : pioche 4 = énorme avantage de ressource. Immunité = absorbe un wave de sorts. Révèle perma = info totale.
- **Implémentation** : `drawCards(me, 4)` + flag `spellShieldThisTurn: true` global + set `augurRevealedB` (ou A selon side) + flag `augurPersistsUntilEnd: true` (nouveau pour ne pas auto-clear).
- **Cinématique** : matrice de chiffres holographiques qui flotte autour du héros.

---

## 6. Économie de partie

### Tableau de progression typique

Pour un joueur Voie de la Pierre qui suit fidèlement sa Voie :

| Tour | Mana dispo | Action typique | Constellation | HP toi / opp |
|---|---|---|---|---|
| 1 | 1 | Pierre lane 1 (1m) — Lente, 0 ATK | ⭐✨✨ (1/3) | 20 / 20 |
| 2 | 2 | Pierre lane 2 (1m) + sort 1m | ⭐⭐✨ (2/3) | 20 / 19 (1 dégât Pierre tour 1 active) |
| 3 | 3 | Pierre lane 3 (1m) + sort 2m | ⭐⭐⭐ (3/3) **COMPLET** | 20 / 17 |
| 4 | 4 | Joue FORTERESSE (0m) + sort 4m | ✅ Finisher actif | 20 / 14 (invulnérable) |
| 5 | 5 | Encore invulnérable + push | (Forteresse continue) | 20 / 10 |
| 6 | 6 | Plein push, fin invulnérable | — | 17 / 5 |
| 7 | 7 | Lethal sur opp | — | 14 / 0 ✅ WIN |

→ Partie typique : **6-8 tours**. Finisher arrive **tour 4**. Sweet spot.

### Calculs HP / mana / durée

| Variable | Valeur v1 actuelle | Valeur v2 proposée | Pourquoi |
|---|---|---|---|
| HP héros | 20 | **20 (gardé)** | Sweet spot pour 6-8 tours de partie avec Finisher impactant |
| Mana cap | 10 | **8 (réduit)** | Force priorisation tactique, évite le late-game lent où tout est jouable |
| Hand cap | 8 | **8 (gardé)** | Pas de raison de changer |
| Starting hand | 4 cards | **4 (gardé)** | |
| Combat one-shot | Oui | Oui (gardé) | |
| Turn hard cap (sudden death) | 30 | **15 (réduit)** | Si match traîne, mort lente automatique du héros le plus faible |

### Scénario "tu choisis de ne PAS suivre ta Voie"

Tu es Voie Pierre mais opp a posé Spock tour 1 → tu poses Feuille pour casser son Spock. Tu n'allumes pas d'étoile. Pas de Finisher. Mais tu as gagné le micro-engagement.

→ **Tradeoff permanent**. Le génie du système : chaque coup tactique est un investissement (ou pas) pour ton long-terme.

---

## 7. Phase de préparation (NOUVELLE — calquée sur Ranked)

### Étapes du flow prep

1. **Lobby Pro** (nouvelle entrée, calquée sur RankedLobby) :
   - Tabs : Entraînement, Match rapide (online), Tournoi, Deck, Boutique, Comment ça marche
   - Bouton "Jouer" lance le flow prep ↓

2. **Écran prep match** (calqué sur MatchPrepScreen Ranked) :
   - VS face-off : ton avatar + ton affinité + ton deck VS opp
   - **Sélecteur d'affinité** : 5 cards des 5 Voies à choisir avant le coin-flip
   - Affichage des 3 étoiles vides de la constellation choisie
   - Bouton "Vérifier mon deck" (ouvre DeckManager)
   - Coin-flip pour le thème/pad (gardé)
   - Bouton "Commencer" lance la partie

3. **DeckManager Arena** (réutiliser le DeckManager Ranked existant, filtrer cards par `arenaSupported`) :
   - Compose ton deck de 8 cartes parmi celles dispo en Arena
   - Affichage des cartes avec rim coloré rareté
   - Sauvegarder

4. **Boutique Arena** (réutiliser ShopPage existant) :
   - Achète packs en éclats
   - Craft cartes manquantes en poussière
   - Codex de progression

---

## 8. UI / UX — Plan de refonte (calque Ranked)

### Composants Ranked à RÉUTILISER / ADAPTER

| Composant Ranked existant | Usage dans Pro v2 |
|---|---|
| `RankedLobby.tsx` | Devient `ArenaLobby.tsx` avec mêmes tabs |
| `MatchPrepScreen.tsx` | Devient `ArenaPrepScreen.tsx` (déjà existe partiellement, refondre) |
| `LanesBoard.tsx` | Inspiration pour `ArenaBoard.tsx` (déjà aligné mais stabiliser) |
| `DeckManager.tsx` | Réutilise direct, filtre arenaSupported |
| `ShopPage.tsx` | Réutilise direct |
| `RankedGame.tsx` | Pattern d'orchestration pour `ArenaGame.tsx` (déjà aligné) |
| `BracketPage.tsx` (Tournoi) | Adapté pour Arena Tournament |

### Stabilité — corrections à apporter

- **Pad qui rescale** : verrouiller les hauteurs des sections variables (queue chips, mana summary, etc.) → fait via `h-7` mais à étendre à tout le PlanPhase
- **Strips qui empiètent** : copier la stack vertical du Ranked qui fonctionne
- **Bouton fin de tour bloqué** : utilise le pattern Ranked qui marche
- **Drag-and-drop fluide** : adapter le pattern de Ranked si différent

---

## 9. Plan d'implémentation par chantier

### Lot A — Stabilisation UI (priorité MAX, ~3h)
- A1. Identifier les divergences ArenaBoard vs LanesBoard (Ranked)
- A2. Aligner les patterns de layout (containers, gaps, paddings)
- A3. Verrouiller les hauteurs des sections variables
- A4. Fix bouton fin de tour
- A5. Test stable sur device

### Lot B — Système d'Affinité (priorité haute, ~2h)
- B1. Ajouter `affinity: Move` à `Player` (store)
- B2. Sélecteur d'affinité dans ArenaPrepScreen
- B3. Appliquer bonus passif dans `makeCreature` (selon player.affinity)
- B4. Afficher affinité au-dessus du portrait dans ArenaHeroStrip

### Lot C — Constellation à 3 étoiles (~2h)
- C1. Ajouter `constellationStars: number` à `HeroState` (incremental compteur)
- C2. Increment dans `applySummons` si move === affinity
- C3. UI : barre 3 étoiles au-dessus du board (entre opp strip et opp lanes)
- C4. Animation flash + son à chaque allumage

### Lot D — Finishers (le plus gros, ~4h)
- D1. Ajouter 5 nouvelles cartes (FORTERESSE, VERGER, LAME, METAMORPHOSE, CALCUL) dans `ranked/cards.ts` avec rim doré
- D2. Implémenter les 5 effets dans `arenaCardEffects.ts`
- D3. Détecter constellation complète → ajouter la carte appropriée à la main
- D4. UI : carte légendaire avec rim doré épais + animation cosmique au render
- D5. Cinématiques de chaque finisher (1.5s)

### Lot E — Lobby Pro (~3h)
- E1. Créer `ArenaLobby.tsx` (copy/adapt RankedLobby)
- E2. 6 tabs : Entraînement, Match rapide, Tournoi, Deck, Boutique, Comment ça marche
- E3. Wire Entraînement → ArenaPrepScreen → ArenaGame
- E4. Wire Deck → DeckManager (filtre arenaSupported)
- E5. Wire Boutique → ShopPage (réutilise)

### Lot F — Matchmaking online (~3h, optionnel)
- F1. Adapter le WebSocket Ranked pour Pro
- F2. Match rapide queue + fallback bot 25s

### Lot G — Tournoi Arena (~2h, optionnel)
- G1. Adapter BracketPage pour Pro

---

## 10. Erreurs à éviter

- ❌ Casser la base v1 (les fans actuels ne doivent pas être perdus)
- ❌ Faire des Finishers instant-win (ils sont des game-changers, pas des kill-switch)
- ❌ Forcer le joueur à suivre son affinité (le tradeoff doit rester libre)
- ❌ Refondre l'UI sans copier le pattern Ranked qui marche
- ❌ Mentionner "Hearthstone" partout (légal, déjà fait)

---

## 11.5 Règle combat — POURSUITE (Alex feedback 2026-06-09)

### Le problème détecté

Le combat RPSLS one-shot pur faisait que le winner restait passif : "Ciseau perd, Ciseau mort, fin". Alex a flagged : *"si l'autre joue Spock et moi Ciseaux, je devrais perdre 2 PDV non ?"*

### La règle corrigée — POURSUITE

Quand un counter RPSLS se résout dans un combat de lane :

1. **Le perdant MEURT** instantanément (comme avant)
2. **Le gagnant SURVIT intact**
3. **NOUVEAUTÉ — Le gagnant continue son swing** : son ATK effective passe au **héros adverse** comme dégâts directs
4. **Exceptions** :
   - **Esquive** du Lézard : si le perdant a `dodgeCharge`, l'esquive consomme la charge → le perdant SURVIT + le gagnant NE poursuit PAS au héros (l'esquive a "détourné" le swing)
   - **Provocation** alliée : si le héros visé a une Pierre chargée ailleurs sur le board, la poursuite est détournée comme une attaque undefended normale (consomme 1 charge)

### Exemples concrets

| Match | Résultat |
|---|---|
| Spock 2/3 attaque Ciseaux 4/1 (lane même côté) | Ciseaux meurt, Spock intact, **2 dégâts au héros Ciseaux** |
| Pierre 1/3 (tour 1 Lente, ATK 0) attaque Ciseaux 4/1 | Ciseaux meurt, Pierre intacte, **0 dégât au héros Ciseaux** (Pierre Lente) |
| Pierre 1/3 (tour 2, ATK 1) attaque Lézard 2/2 | Lézard ESQUIVE (dodgeCharge consommée) → Lézard survit + **0 dégât au héros Lézard** |
| Feuille 3/1 attaque Pierre 1/3 + opp a une autre Pierre ailleurs | Pierre frontale meurt + Feuille tente poursuite → **détournée par Pierre arrière** (1 charge Provoc consommée) |

### Implémentation

`arenaRules.ts` — branches `counterAB && !counterBA` et `counterBA && !counterAB` :

```ts
if (counterAB && !counterBA) {
  const winnerA = bluntOnCombat(ca);
  if (cb.dodgeCharge) {
    // Esquive absorbe tout
    return { ...board, lanes: [..., { a: winnerA, b: { ...cb, dodgeCharge: false } }, ...] };
  }
  // B dies, A pursues to hero
  const lanes = ...; lanes[laneIdx] = { a: winnerA, b: null };
  const updatedBoard = { ...board, lanes };
  const deflect = findDeflector("b");
  if (deflect) return consumeProvocation(updatedBoard, deflect);
  return { ...updatedBoard, b: damageHero(updatedBoard.b, creatureEffectiveAtk(winnerA)) };
}
```

### Impact équilibrage

- Matches plus agressifs (le winner punit en HP au héros)
- Pose une créature = vraie menace même si elle counter une créature opp
- Le Lézard devient un vrai **defender** (sa charge sauve à la fois la créature ET le héros)
- La Pierre Provocation devient encore plus précieuse (couvre les follow-throughs)
- Calcul partie : maintenant 2-4 dégâts héros par tour si combats actifs → partie 5-7 tours au lieu de 6-9

## 11. Validation / progression

Cocher au fur et à mesure :

- [ ] Plan validé par Alex
- [ ] Lot A — Stabilisation UI
- [ ] Lot B — Affinité
- [ ] Lot C — Constellation
- [ ] Lot D — Finishers
- [ ] Lot E — Lobby Pro
- [ ] Lot F — Online (optionnel)
- [ ] Lot G — Tournoi (optionnel)
- [ ] Playtest device complet
- [ ] Merge dans `develop`

---

**Fin du plan.**
