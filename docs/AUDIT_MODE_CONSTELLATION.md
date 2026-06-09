# Rapport d'Audit — Mode Constellation locale (vs CPU)

**Date :** 2026-06-09
**Auditeur :** Cline (revue approfondie)
**Périmètre :** Constellation classique locale (pas Ranked, pas Pro) — vs CPU, sans serveur
**Fichiers audités :**
- `pages/PlayPage.tsx` (entrée `lanes_cpu`)
- `match/LocalLanesGame.tsx` (orchestrateur)
- `engine/lanesEngine.ts` (résolution RPSLS + AI)
- `engine/lanesCombos.ts` (identités de lanes)
- `store/store.ts` (recordMatch)

---

## 1. Chaîne de responsabilité audité

```
PlayPage.tsx (view "lanes_cpu")
  └── LocalLanesGame (winTo, onQuit)
        ├── makeLocalBattle() → battleRef
        ├── shuffleLaneIdentities() → lanesCombos.ts
        ├── startNextRound() → roundNoRef++, setRound(...)
        ├── handleSubmit(picks) → resolveAndAdvance(plays, timedOut=false)
        │     ├── cpuLanesPicks(ctx, laneCount) → lanesEngine.ts
        │     ├── resolveLanesRound(playerPlays, cpuPlays) → lanesEngine.ts
        │     ├── battleStatus(battle, cfg) → vérifie fin de match
        │     └── recordMatch({ mode: "constellation", ... })
        ├── rematch() → reset tout, re-shuffle, startNextRound
        └── cleanup → clearTimeout(deadlineTimerRef)
```

---

## 2. Résumé exécutif

| Catégorie | Verdict | Détail |
|-----------|---------|--------|
| Robustesse | ✅ Très bonne | State machine propre, cleanup OK, pas de double submit |
| Cycle de vie | ✅ Complet | Entrée → round → reveal → end → record → rematch → cleanup |
| AI | ✅ Bien | 3 difficultés, counterTo randomisé (anti-exploit), mood respecté |
| Résolution | ✅ Correcte | Miroir fidèle du serveur Rust (constellation.rs) |
| Bug détecté | ⚠️ 1 réel | `forfeit` non géré (pas de recordMatch en cas d'abandon) |
| Améliorations | ℹ️ 1 mineure | `playerHistoryRef` pousse 3 moves par round (entiers, pas par lane) |

---

## 3. Résultats détaillés

### 3.1 Cycle de vie du match

| Étape | Gestion | Évaluation |
|-------|--------|-----------|
| Entrée | `PlayPage` → `LocalLanesGame winTo={2\|3}` | ✅ |
| Init | `shuffleLaneIdentities()`, `makeLocalBattle()` | ✅ Appelé avant le premier render |
| Splash | `setTimeout → startNextRound()` après 2.5s | ✅ |
| Round start | `roundNoRef++`, `setSubmitted(false)`, `setLastResult(null)`, `setRound({...})` | ✅ |
| Pick | `handleSubmit(picks)` avec guard `submitted` | ✅ Anti-double-submit |
| Résolution | `cpuLanesPicks()` AVANT `playerHistoryRef.push()` | ✅ L'AI ne peut pas tricher |
| Reveal | `setRound(null)` + `setLastResult(...)`, haptique à 1.4s | ✅ |
| Match end | `battleStatus()` → `recordMatch()` + `setEnd()` après 7.5s | ✅ |
| Rematch | Reset complet : round, result, end, mood, history, battle, roundNo, timer | ✅ |
| Cleanup | `clearTimeout(deadlineTimerRef)` dans le useEffect de retour | ✅ |

### 3.2 Moteur de résolution (lanesEngine.ts)

| Aspect | Évaluation |
|--------|-----------|
| Règles RPSLS | ✅ Miroir exact du serveur Rust (constellation.rs), mêmes verbes |
| Résolution round | ✅ `resolveLanesRound()` : aWins/bWins par lane, roundWinner = best-of-3 |
| Throw si lane counts mismatch | ✅ |
| AI Easy | ✅ Joue le move perdant contre le dernier move du joueur (randomisé parmi 2) |
| AI Normal | ✅ 40% de contre le move le plus fréquent, 60% mood-weighted random |
| AI Hard | ✅ 75% de contre si ≥1 historique, randomisé entre les 2 counters (anti-exploit) |
| `mostFrequent` | ✅ Tie-break vers le plus récent |
| `counterTo` / `counterableBy` | ✅ Randomisé entre les 2 options valides |

### 3.3 RecordMatch

**Fichier :** `LocalLanesGame.tsx` lignes 194-207

```typescript
recordMatch({
  id: `lanes-cpu-${Date.now()}`,
  mode: "constellation",
  bestOf: winTo,
  opponent: { kind: "cpu", mood: moodRef.current },
  scorePlayer: battle.roundWinsA,
  scoreOpponent: battle.roundWinsB,
  outcome: outcomeKind,
  rounds: [],           // rounds vides car pas de per-move round log
  xpDelta: youWon ? 40 : 10,
  lpDelta: 0,           // vs-CPU = pas de LP
  timestamp: Date.now(),
  forfeit: false,
});
```

**Évaluation :**
- ✅ `mode: "constellation"` → correct, permet le tracking dans l'historique
- ✅ `opponent: { kind: "cpu", mood }` → correct
- ✅ `xpDelta` 40/10 → raisonnable (entre Casual 50/10 et Ranked 30/5)
- ✅ `lpDelta: 0` → correct, le LP compétitif est online-only
- ✅ `rounds: []` → intentionnel, le format 3-lanes ne se mappe pas au round log classique

### 3.4 Bug détecté : Pas de forfeit / abandon

**Fichier :** `LocalLanesGame.tsx`

**Description :** `onQuit` est passé directement à `LanesMatchView` via `onLeave={onQuit}`. Aucun `recordMatch` n'est appelé avant de quitter. Si le joueur abandonne en cours de match, aucune trace n'est enregistrée — ni dans l'historique, ni dans les stats.

**Comparaison avec les autres modes :**
- `PlayGame.tsx` : `handleQuit()` crée un `MatchRecord` avec `forfeit: true`, `xpDelta: 0`, `lpDelta: r.lpLoss`
- `OnlinePage.tsx` : `leaveMatch()` appelle `client.send(leave_match)` + `recordAbandon()`
- `LocalLanesGame.tsx` : **rien** — juste `onQuit()` qui démonte le composant

**Impact :**
- Le match abandonné n'apparaît pas dans l'historique
- Aucune pénalité (même cosmétique) n'est appliquée

**Gravité :** Faible. Le mode est vs CPU, sans enjeu compétitif. Mais l'incohérence avec les autres modes existe.

**Correction suggérée :** Ajouter une fonction `handleForfeit()` qui appelle `recordMatch()` avec `forfeit: true`, `outcome: "loss"`, `xpDelta: 0`, puis `onQuit()`.

### 3.5 Amélioration mineure : playerHistoryRef par round, pas par lane

**Fichier :** `LocalLanesGame.tsx` ligne 136

```typescript
playerHistoryRef.current.push(...playerPlays.map((p) => p.mv));
```

Les 3 moves d'un round sont poussés en une fois. L'AI lit `playerHistory.slice(-5)`, donc elle voit jusqu'aux 5 derniers moves individuels — ce qui correspond à ~1.6 rounds. C'est fonctionnel mais l'historique ne distingue pas "le joueur a joué Rock sur la lane 1 et Paper sur la lane 2" — il voit juste `[Rock, Paper, Scissors]` en vrac.

**Sévérité :** Cosmétique. L'AI fonctionne correctement avec cette approche (elle cherche juste le move le plus fréquent).

---

## 4. Vérifications négatives (choses cherchées, non trouvées)

| Recherche | Résultat |
|-----------|----------|
| Double recordMatch | ❌ Aucun : `battleStatus` est checké une fois, le guard `submitted` empêche la double soumission |
| Race condition recordMatch + rematch | ❌ Aucune : `recordMatch` est appelé avant `setEnd`, et `rematch()` reset tout |
| Fuite mémoire (timers) | ❌ Aucune : `clearTimeout(deadlineTimerRef)` dans le cleanup |
| Crash sur état invalide | ❌ Aucun : `resolveLanesRound` throw si lane counts mismatch (ne peut pas arriver en local) |
| AI qui triche | ❌ Aucune : `cpuLanesPicks` est appelé AVANT `playerHistoryRef.push` |
| Mood non respecté | ❌ Aucune : le mood est passé à `cpuLanesPicks` et utilisé dans `moodPick` |

---

## 5. Conclusion

Le mode Constellation locale est **propre et bien conçu**. L'orchestrateur (`LocalLanesGame`) gère correctement tout le cycle de vie : splash → rounds → résolution → recordMatch → rematch → cleanup. Le moteur (`lanesEngine`) est un miroir fidèle du serveur Rust, avec une AI à 3 niveaux de difficulté correctement randomisée pour éviter l'exploit.

**Un seul bug mineur :** l'absence de `recordMatch` en cas d'abandon (forfeit), contrairement aux autres modes qui enregistrent un match avec `forfeit: true`.

**Verdict final :** ✅ Le mode Constellation locale est prêt pour la production. Une correction mineure recommandée (gestion du forfeit).