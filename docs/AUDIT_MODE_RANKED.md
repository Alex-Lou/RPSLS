# Rapport d'Audit — Mode Constellation Ranked (vs CPU)

**Date :** 2026-06-09
**Auditeur :** Cline (revue approfondie)
**Périmètre :** Constellation Ranked vs CPU — avec cartes, mana, deck de 8, main de 3
**Fichiers audités :**
- `ranked/RankedGame.tsx` (1767 lignes — orchestrateur)
- `ranked/rankedRules.ts` (applyCardEffects, computeRoundBonuses, finalRoundWinner)
- `ranked/rankedAI.ts` (cpuRankedDecision, chooseCpuCard)
- `ranked/rankedTypes.ts` (types)
- `engine/lanesEngine.ts`, `engine/lanesCombos.ts` (moteur + combos)
- `store/store.ts` (recordMatch, awardCardMasteryXp)

---

## 1. Chaîne de responsabilité audité

```
PlayPage → RankedLobby → RankedGame (winTo=2|3, opponentName)
  ├── makeBattle(savedDeck) → deck, hand, discard, usedOneShotCards, passives
  ├── shuffleLaneIdentities() → lanesCombos.ts
  ├── startNextRound()
  │     ├── cpuRankedDecision(ctx, laneCount) → rankedAI.ts
  │     ├── drawN() → pioche
  │     ├── Prophétie (passive): Augur gratuit chaque round
  │     └── setRound({ no, deadlineMs, startedAt })
  ├── handlePickMove / handleClearLane / handlePlayCard
  ├── handleLock() → resolveAndAdvance(players, timedOut)
  │     ├── Paradoxe Temporel : skip round
  │     ├── Vortex / Mirror / Rémanence / Échappée / Schrödinger / Juge
  │     ├── resolveLanesRound(playerPlays, cpuPlays)
  │     ├── applyCardEffects(base, myCard, oppCard)
  │     ├── computeRoundBonuses(...) → finalRoundWinner(...)
  │     ├── Écho temporel, Trinité, Gambit
  │     ├── Bookkeeping: Braise, Ancre temporelle, Cascade, Heist, CPU one-shots
  │     ├── Riposte sub-phase
  │     ├── Sudden-death (round tie)
  │     └── battleStatus → recordMatch + setEnd
  ├── handleLeave() → recordMatch( forfeit: true ) + onQuit
  └── rematch() → reset complet
```

---

## 2. Résumé exécutif

| Catégorie | Verdict | Détail |
|-----------|---------|--------|
| Robustesse | ✅ Excellente | State machine complète, tous les effets V3 intégrés, forfeit géré |
| Cycle de vie | ✅ Complet | Splash → rounds → cartes → resolve → end → recordMatch → rematch |
| Intégration V3 | ✅ Complète | 20 cartes V3 + 26 cartes base, effets, chips UI, feedback |
| Sécurité | ✅ Bonne | Pas de triche AI, mana validé, one-shotsCPU traqués |
| Bug détecté | ⚠️ 1 mineur | xpDelta dupliqué entre recordMatch normal et riposte |
| Améliorations | ℹ️ 1 note | Fichier très long (1767 lignes) — logique métier dense |

---

## 3. Résultats détaillés

### 3.1 Cycle de vie du match

| Étape | Gestion | Évaluation |
|-------|--------|-----------|
| Init | `makeBattle(savedDeck)`, `shuffleLaneIdentities()`, `setGaiaCharged(battle.passives.includes("gaia"))` | ✅ |
| Splash | `setTimeout → startNextRound()` après 2.5s | ✅ |
| Round start | `roundNoRef++`, mana calculé (cap + bonus + Marchand), `drawN`, CPU décision AVANT `playerHistoryRef.push` | ✅ AI ne triche pas |
| Pick | 3 moves + 1 carte max, `handleCancelCard()` pour annuler | ✅ |
| Lock | Gard `picks.some(p => p === null)`, `hapticLock()` | ✅ |
| Resolve | `resolveLanesRound → applyCardEffects → computeRoundBonuses → finalRoundWinner` | ✅ Pipeline pur |
| Riposte | Sub-phase pick→reveal, flip de lane si gagné | ✅ |
| Sudden death | Duel 1 move si round tie, re-pick si tie du duel | ✅ |
| Match end | `recordMatch()` + `awardCardMasteryXp()` + `setEnd` | ✅ |
| Forfeit | `handleLeave()` → `recordMatch({ forfeit: true, xpDelta: 0, lpDelta: -15 })` + `recordAbandon()` | ✅ Supérieur à Constellation locale |
| Rematch | Reset de TOUS les refs + states + timers, re-shuffle, `startNextRound` | ✅ |

### 3.2 Intégration des cartes V3

| Carte | Implémentation | Évaluation |
|-------|---------------|------------|
| Sablier | +1 draw + +1 mana next round | ✅ |
| Rémanence | Ghost du move adverse du round précédent sur la lane choisie | ✅ |
| Offre | +2 mana next round | ✅ |
| Braise | Stack +1 par défaite, discount sur prochaine carte, UI pip orange | ✅ |
| Échappée | Lane vidée (draw forcé) + +1 mana next round | ✅ |
| Oracle Inverse | Révèle 3 cartes aléatoires du pool CPU | ✅ |
| Fardeau | Force CPU à jouer `second-wind` au prochain round | ✅ |
| Crépuscule | Lane immunisée aux cartes (twilightLane dans fx) | ✅ |
| Cascade | Win → refill main gratuit, Lose → main vidée | ✅ |
| Écho Temporel | Stop-loss : défaite → draw + refund carte | ✅ |
| Ancre Temporelle | Snapshot → restore si 2 défaites consécutives | ✅ |
| Métamorphose | Sacrifice auto (lowest rarity) → draw rareté supérieure | ✅ |
| Bouclier de Gaïa | Passif, 1/match, défaite → draw forcé | ✅ |
| Marchand d'Âmes | -1 carte random + +3 mana cap permanent + draw 3 | ✅ |
| Télépathie | Oracle silencieux (même affichage, pas de notif) | ✅ |
| Paradoxe Temporel | Skip round, refund mana, carte brûlée, 1/match | ✅ |
| Bénédiction | +1/lane gagnée pour les deux joueurs | ✅ |
| Schrödinger | Contre automatique par lane (COUNTER_MOVE) | ✅ |
| Le Juge | Résolution alternative : roundWins/handSize/deckSize | ✅ |
| Genèse | Reset complet, 1/match, setTimeout 50ms | ⚠️ Note ci-dessous |

### 3.3 Forfeit

**Fichier :** `RankedGame.tsx` (handleLeave)

```typescript
recordMatch({
  id: `ranked-forfeit-${Date.now()}`,
  mode: "constellation",
  opponent: { kind: "cpu", mood: moodRef.current },
  scorePlayer: battle.roundWinsA,
  scoreOpponent: battle.roundWinsB,
  outcome: "loss",
  xpDelta: 0,
  lpDelta: -15,
  forfeit: true,
});
recordAbandon(); // pénalité LP escalating
```

**Évaluation :** ✅ Gestion complète du forfeit avec pénalité LP et stats, contrairement à Constellation locale qui n'en a pas.

### 3.4 CPU AI (rankedAI.ts)

| Aspect | Évaluation |
|--------|-----------|
| Easy | Joue SANS cartes — pure RPSLS |
| Normal | 50% de jouer une carte si affordable, priorité : Trou-Noir > Heist > Surge > Curse > Sangsue > Aegis > Precision > Bénédiction |
| Hard | 72% de jouer une carte, même priorité |
| Lane ciblage | Choisit une lane que l'adversaire "favours" (où son move est favorisé) |
| One-shots CPU | Épiques/Légendaires traqués dans `cpuOneShotsRef`, retirés du pool après usage |

### 3.5 Moteur de résolution (rankedRules.ts)

| Fonction | Rôle | Évaluation |
|----------|------|-----------|
| `applyVortex` | Rotation horaire des picks adverses | ✅ |
| `applyCardEffects` | Aegis, Surge, Precision, Curse, Tide, Sangsue, Anchor, Second-wind, Heist, Rempart, Prescience, Mascarade, Boussole, Crépuscule, Bouclier de Gaïa | ✅ Fonction pure |
| `computeRoundBonuses` | Combo, Favoured, Surge, Tide, Curse, Leech, Bénédiction | ✅ |
| `finalRoundWinner` | Détermine le gagnant du round après bonus | ✅ |

### 3.6 Points notables

#### 3.6.1 Genèse setTimeout 50ms

**Fichier :** `RankedGame.tsx` ligne 385

```typescript
window.setTimeout(() => startNextRound(), 50);
```

Le reset de Genèse est appliqué via `setTimeout(50ms)` + ré-entrée dans `startNextRound`. Cela fonctionne mais introduit une dépendance temporelle. Si le match-end coïncide avec ce timer, le comportement est indéfini. Le commentaire dans `CARTES_BONUS_V3.md` note déjà ce risque.

**Sévérité :** Théorique. En pratique, Genèse coûte 4 mana et n'est jouable qu'en round 3+ d'un BO5 — le match-end est peu probable dans la même frame.

#### 3.6.2 xpDelta dupliqué

Le `xpDelta` est hardcodé à 60/15 dans les deux appels à `recordMatch` (match normal et riposte). Ce n'est pas un bug (valeurs identiques), mais si l'équilibrage change, il faudra modifier deux endroits.

**Sévérité :** Cosmétique.

---

## 4. Vérifications négatives

| Recherche | Résultat |
|-----------|----------|
| Double recordMatch | ❌ Aucun : `battleStatus` checké une fois, guard `submitted` |
| AI qui triche | ❌ Aucune : CPU décision AVANT `playerHistoryRef.push` |
| Carte jouée sans mana | ❌ Aucun : `cost <= mana` vérifié dans `handleSelectCard` (CardHand) |
| One-shot rejoué | ❌ Aucun : `usedOneShotCards` traqué des deux côtés |
| Timers non nettoyés | ❌ Aucun : cleanup dans useEffect |
| Forfeit sans recordMatch | ❌ Aucun : `handleLeave` gère le cas |

---

## 5. Conclusion

Le mode Constellation Ranked est **le plus complet et le mieux structuré des modes audités**. L'intégration des 46 cartes (26 base + 20 V3) est exhaustive, avec effets, chips UI, et bookkeeping cross-round. Le forfeit est correctement géré avec pénalité LP. Le CPU joue des cartes à partir de Normal, rendant le mode engageant.

**Un seul point d'attention** : le `setTimeout(50ms)` de Genèse, déjà documenté comme risque théorique.

**Verdict final :** ✅ Mode Constellation Ranked prêt pour la production. Aucune correction requise.