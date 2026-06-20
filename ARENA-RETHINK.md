# Constellation Pro — Rethink de fond (2026-06-17)

> Workstream pluri-sessions décidé par Alex : « repenser tout ça magnifiquement, faire
> honneur au jeu, niveau Hearthstone ». Issu d'une analyse multi-agents ancrée dans le
> code réel (run `wf_a0fa89f7-76b`). Ce fichier = la référence. Le tenir à jour.

## 🎯 Cause racine (l'aha)

**Le point mort est STRUCTUREL.** Les invocations RPSLS coûtent du **mana**, jamais une
**carte** (`resolver.ts` applySummons mana-1). Le deck est fini et ne recycle plus
(`boardInit.ts:157`). Donc vers **T6-T8 les deux mains sont vides et le restent**, mais on
peut poser des symboles à l'infini jusqu'au `TURN_HARD_CAP=30`. → la 2ᵉ moitié de CHAQUE
partie = RPSLS pur, sans sorts, sans info cachée = « on sait déjà ce qui est joué et permis ».

## Les 5 maux de fond

1. **Point mort structurel** (cartes ↔ invocations découplées) → late-game sans magie.
   `boardInit.ts:157`, `lifecycle.ts:54`, `constants.ts:30` TURN_HARD_CAP=30.
2. **Info trop publique** : counter = kill instantané (`arenaCombat.ts:119`) + Voie affichée
   dès T1 (révèle bonus/sur-invocations/Finisher, `arenaFinishers.ts:28` AFFINITY_TO_FINISHER
   1:1) + intent dévoilé au reveal (`arenaResolverFlow.ts:144`) → zéro bluff/lecture.
3. **Horloge léthale ~inexistante** : splash = max(0, atk−hp) presque toujours 0
   (`arenaCombat.ts:193`) ; Verger soigne (`lifecycle.ts:75`) ; murs Pierre gratis → stalemate
   T30. Kill-bonus (`lifecycle.ts:54`) aggrave (assèche le deck).
4. **Pool large mais plat** : 9× pioche, 7× buff ATK, 5× « révèle la main » jamais exploité
   (augurRevealed stocké jamais lu), ~35 ids no-op arène, fusion figée 8 paires
   (`arenaFusionCards.ts`, ARENA_CARD_TYPE jamais branché sur findFusionResult).
5. **Board statique** : aucune menace qui grossit (`creatures.ts:208` voieAtkBonus figé),
   zéro come-back, Finisher télégraphié (1 par Voie).

## Feuille de route (du + sûr au + risqué)

### Phase 0 — Sondes & quick-wins (réversibles) `S`  ← EN COURS
- **HP 20→15 _ou_ cap 30→18** (`constants.ts`) — sonde longueur. **[décision Alex en attente]**
- **Voie révélée progressivement** (`ArenaConstellationBar.tsx:81-93`) : étoiles anonymes →
  la Voie se dévoile à la 1ʳᵉ étoile (1ʳᵉ invocation du symbole d'affinité). Aura/filigrane
  idem. → fini le Finisher télégraphié dès T1.
- **Pioche de tempo** (`lifecycle.ts:54`) : remplacer killBonus (+1 plat) par +1 si main ≤ 2.
  → « 1-2 cartes en plus par partie » SEULEMENT quand on en a besoin (late), pas en early.

### Phase 1 — Tuer le point mort `S/M`
- **Fatigue douce** à deck sec (`lifecycle.ts` advanceToNextTurn) : champ `fatigueStacks` sur
  HeroState, dégâts 1,2,3… quand drawCards renvoie null. Démarrer à 1. Geler tant qu'aucun
  des deux n'est sec (symétrie). = horloge léthale principale.
- **OU** recyclage borné 1× (flag `deckRecycled`, défausse amputée de moitié). L'un OU l'autre.

### Phase 2 — Moins prévisible `M`
- Payoff aux cartes « révèle la main » (consommer augurRevealed : -mana conditionnel, sort
  gratuit, discard ciblé) `S`.
- **Créatures posées FACE CACHÉE** jusqu'au reveal (réutilise setOppPreview) → choisir rock
  redevient un pari. L'IA décide déjà sur board public (`ArenaGame.tsx:421`).
- **Cartes-pièges réactives** (secrets façon Hearthstone) : généraliser ripostePrimed/flags
  pré-armés, déclenchés au combat sur condition adverse, posées sans affichage.

### Phase 3 — Profondeur Hearthstone `M`
- **Fusion générique par famille** : brancher ARENA_CARD_TYPE sur findFusionResult (degat→AoE,
  buff+buff→persistant…), garder les 8 recettes nommées en override. = le « livre de recettes ».
- **Croissance des créatures de Voie** (`heroCreature.ts` endOfTurnReset) : +0/+1 capé +2 si
  survit, symbole d'affinité seulement = menace qui grossit.
- **Come-back sous 7 PV** (Sursaut) : choix d'1 effet de rattrapage ; option Finisher à 2⭐.

### Phase 4 — Refonte du combat `L` (le + risqué, en dernier)
- **Counter = +ATK** au lieu de kill auto (`arenaCombat.ts:123-275`), les HP décident. Gros
  re-tuning CREATURE_STATS + passifs qui supposent le one-shot (Tranchant, Riposte, splash).
  À ne lancer que si Phases 1-3 n'ont pas suffi.

## Principes de conduite
- KISS, réversible, **device-test + OK Alex tel à chaque cran** avant commit.
- Un levier à la fois côté équilibre (mesurer l'effet). Ne pas empiler fatigue + recyclage.
- Zéro émoji UI, commits sans trace IA, auteur Alex.
