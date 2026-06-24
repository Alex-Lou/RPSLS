# Lois de conception des cartes (Constellation Pro) — 2026-06-23

> ⚠️ `CARTES-BLUEPRINT.md` a été SUPPRIMÉ le 2026-06-24 (dérivait du code, ~20 cartes violaient les invariants).
> Ce doc est gardé pour ses **LOIS DURABLES de conception** (§2 les 7 patterns, §4 ce qui est solide) : **le CODE = source de vérité** pour les cartes. À relire avant de concevoir « les cartes propres au Pro » (cf. `ROADMAP.md` §2.1 / Lot 6).

---

## ✅ VÉRIFICATION TERRAIN + CORRECTIFS (Claude, 2026-06-23 — « mode expert, pas de rustine »)

Chaque point « code réel » de l'audit re-vérifié ligne par ligne avant de toucher. Résultat : **la liste s'effondre de ~20 à 2 vrais bugs.** (Beaucoup de findings comparaient le *blueprint* — qui sur-promettait — au code ; et l'audit a fait au moins 1 erreur factuelle.)

| Point audit | Verdict après vérif | Action |
|---|---|---|
| **Forteresse** « +3 / Aegis non-perm » | ❌ FAUX. Texte joueur = code (+2 ATK + bouclier). `endOfTurnReset` (heroCreature.ts:167-179) ne reset PAS `divineShield` → permanent. L'audit s'est trompé. | aucune (ne pas casser du code sain) |
| **Calcul** « ramp-loop non borné » | ❌ FAUX. Borné par main/deck ; aucune boucle (Dilatation consommée, pas de re-cast). Texte = code. | aucune (ne pas nerfer un finisher juste sur une crainte théorique) |
| **Coup-de-Bol / Tuile / 5 cartes de dégâts** | ❌ FAUX. Texte joueur = code (vérifié). | aucune |
| **Lame** | ✅ déjà solide (audit le confirme). | aucune |
| 🔴 **Métamorphose** « intouchable/infini » | ✅ VRAI BUG. Refresh = `max(dodge,1)` → 1 seule esquive/tour, DÉGRADE même un Lézard de Voie (2). Le texte ment. | **CORRIGÉ** : `METAMORPHOSE_DODGE=9` rechargé chaque tour (cast + lifecycle) → réellement intouchables. Textes FR/EN alignés (« INTOUCHABLES »). |
| 🔴 **Verger** « +1 PV/tour » | ✅ VRAI. Le code soigne `2+Sève` (seveHealAmount), le texte sous-vend. | **CORRIGÉ** : textes FR/EN → « 2 PV (+1 par cran de Sève) ». |

> Les ~18 autres findings concernent des **cartes du blueprint non codées** → rien à réparer dans le jeu ; ce sont des contraintes à respecter quand/si on les implémente (cf. les 7 patterns ci-dessous). Le code qui tourne, lui, est **sain**.

**Fichiers touchés par les correctifs** : `arenaFinishers.ts` (const + applyMetamorphose), `arenaRules/lifecycle.ts` (import + 2 refresh), `i18n/locales/fr.ts` + `en.ts` (4 descriptions chacune). tsc vert.

## 1) Verdict global
**CORRECTIONS MAJEURES requises — confiance élevée** (claims vérifiés dans `arenaEngines.ts`, `arenaFinishers.ts`, `arenaTypes/creatures.ts`, `arenaPhase4Spells.ts`, `arenaCardEffects.ts`, `arenaCastOnDraw.ts`, `cards.ts`).

- **L'algo est-il bon ?** OUI. Le moteur (engine de Voie, finishers, résolveur de phases) est **solide et cohérent**. Le problème n'est PAS le code.
- **Tout est-il logique ?** Non. ~20 cartes du blueprint ont des effets sous-spécifiés (cible/trigger/ordre indéfinis) ou violent des invariants du moteur.
- **Tout va bien ?** Le socle va bien. **La doc et certains effets ont dérivé** par rapport au moteur.

> Risque #1 = **dette de spécification** : le doc promet des choses (Esquive infinie, +3 ATK perm, Sève par sort, charges 3, gel de lane) que le moteur ne fait pas ou interdit. Coder le blueprint tel quel = casser des invariants. Garder le code = le doc ment au joueur.

## 2) Les 7 PATTERNS récurrents (à corriger systémiquement, pas carte par carte)
1. **Gain de jauge depuis un sort** (Écorce, Absorption, Rafale, Tempête, Germe). Loi dure : la jauge monte UNIQUEMENT quand ton symbole REMPORTE un counter RPSLS en lane (`riseEngineOnCounterWin`, « Le Tracé » 2026-06-24). → *Aucune carte ne touche la jauge.*
2. **Dépassement de caps** (provocationCharges 3, dodge infini, Aegis 2). Le moteur a des caps documentés (provoc max 2 = anti-stall délibéré ; divineShield = booléen). → *Aucune carte ne dépasse un cap d'invariant.*
3. **Mécaniques inventées par le texte** (gel, lane bloquée, « réaction »/interrupt, equipped persistant, decay de passive, cap-de-sorts/tour, replay-si-létal, heal-per-turn). Aucune n'existe. → *Un effet ne référence QUE des flags présents dans `creatures.ts`/`hero.ts`. Toute mécanique neuve = ticket d'ingénierie, pas un mot dans une description.*
4. **Triggers temporellement impossibles** : beaucoup de cartes Mirage/Forêt déclenchent « si la créature survit/n'attaque pas », mais SPELLS résout AVANT COMBAT. → *Un sort ne checke que l'état présent ; les triggers post-combat = passives/finishers.*
5. **Cibles/scopes non définis** (lane vs board vs global, « charge » générique, « +1 » sans ressource). → *Chaque effet nomme : (a) la cible exacte, (b) la ressource exacte (champ du modèle), (c) la temporalité.*
6. **Doc dérivée du code** (toute la série Phase-4 + pool neutre + finishers). Pattern le plus dangereux car silencieux. → *Code = source de vérité. Réécrire le blueprint DEPUIS le code, pas l'inverse.*
7. **RNG implicite non implémenté** (d3 de Coup-de-Bol, défausse aléatoire, scaling sur la main adverse). → *Décider déterministe vs RNG, et si RNG, l'implémenter vraiment.*

## 3) Bloquants confirmés (exemples)
- **Montagne** : Géode Dormante / Bloc de Fondation / Manteau demandent `provocationCharges` cap 3 → le moteur cape à **2** (anti-stall). Boucle de stall = bannie. → Garder cap 2, séparer la jauge.
- **Forêt** : Écorce/Absorption/Germe modifient `seveStack` depuis un sort → interdit. Carapace « Aegis 2 » → `divineShield` est booléen.
- **Tranchant** : Affûtage (decay de passive innée), Rafale/Tempête (jauge depuis un sort), Lame Tournante (replay-si-létal) → mécaniques inexistantes.
- **Mirage** : Coup dans l'Ombre (doc ≠ code), Métamorphose « intouchable/infini » alors que le code = 1 esquive/tour.
- **Cosmos** : Vide Quantique/Stase/Ralentissement (gel/lane-bloquée/cap-sorts = inexistant), Ancre de Mana (pas de compteur), **Convergence Inévitable = carte fantôme (n'existe pas en code)**, **Calcul = ramp-loop non borné** (−1 mana à TOUS les sorts + MAX_SPELLS=99 + Dilatation).
- **Neutre** : Rempart Provisoire/Tempo Volé/Convergence Mana/Siphon Équilibré **n'existent pas**. Coup-de-Bol/Tuile : doc dit « d3 RNG / adv invoc +1 », code = +2 mana fixe / défausse 1.
- **Finishers** : Forteresse doc = +3 ATK perm + Aegis perm ; code = **+2** et `divineShield` reset chaque tour (PAS permanent).

## 4) CE QUI EST SOLIDE (ne touche à rien)
- **Le moteur d'engine de Voie** (`arenaEngines.ts`) : pur, capé (3), reset/match, `riseEngineOnCounterWin` propre. Rien à corriger.
- **Le finisher Lame** : `lameActive` correctement posé + checké dans `resolveLaneCombat`. Aucune contradiction.
- **Les 5 cartes de dégâts signature DÉJÀ codées** (`eboulis-final`, `drain-vital`, `intrication-quantique`, `taillade-mortelle`, `coup-dans-lombre`) : bornées (cap 6-8), couplées au board, légendaire auto-exilée, zéro récursion. **Bien conçues — c'est le blueprint qui doit s'aligner sur elles.**
- **L'ordre de résolution** (REVEAL→SPELLS→SUMMONS→COMBAT→SETTLE) + **table de priorité** : cohérents (soins après dégâts, finishers tôt). `reverberation` bien dans la table, récursion bornée.

## Plan de réconciliation (l'ordre des opérations)
1. **Adopter la loi** : code = source de vérité. Le blueprint se réécrit DEPUIS le code.
2. **Bannir les 3 anti-patterns** : jauge-par-sort · dépassement de cap · mécanique inventée.
3. **Borner** : Calcul (cap N sorts réduits/tour) + stacks d'Esquive/ATK (atkBuff par-tour, pas permanent).
4. **Réconcilier les finishers** : aligner les TEXTES sur le code (Forteresse +2, Métamorphose 1/tour) OU étendre le code (shield éternel, esquive infinie) — décision par finisher.
5. **Couper les cartes fantômes** (Convergence Inévitable, pool neutre fictif) ou les implémenter vraiment.
