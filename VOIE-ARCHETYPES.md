# Voies = Archétypes — Plan de design (2026-06-17)

> Demandé par Alex : « chaque Voie doit avoir son suivi de cartes/buffs/malus/passifs,
> un VRAI thème (visuel + gameplay + effectif)… il me faut un vrai plan, une VRAIE
> logique robuste qui fera la différence entre un jeu de cartes et CE jeu de cartes. »
> Issu d'une conception multi-agents ancrée code (run `wf_cbd7f1ec-f34`, 7 agents).
> Référence du chantier. Cf. [[ARENA-RETHINK.md]].

## Vision
Aujourd'hui une « Voie » = un modificateur de combat collé à 5 flags de créature + 1
finisher télégraphié, **déconnecté du deck** (on peut jouer « Cosmos » avec un deck 100%
neutre, et le pad anti-point-mort injecte du random qui dilue toute identité). Le plan fait
de chaque Voie un **archétype LISIBLE** (symbole RPSLS + passif qui se SENT + famille de
cartes signature + finisher payoff) **SANS toucher au moteur de combat RPSLS-lanes** (le
cœur). Tout passe par une **couche de deck-building** au-dessus de l'existant.

## Les 5 archétypes
- **Montagne** (rock · contrôle) — *La forteresse vivante.* **STRATES** : chaque échange
  gagné/dévié donne **+1 PV ET +1 ATK permanent** à la Pierre (cap +3), via `voieAtkBonus`
  qui persiste déjà → la défense PRODUIT l'offensive. Réponse directe au stalemate du rethink.
- **Forêt** (paper · contrôle) — *Le jardin qui s'enracine.* **RACINES** : inversion EXACTE
  du compteur Fanaison (branche `voieFeuille`) — une Feuille qui survit gagne +1 PV perm au
  lieu de −1 ATK (cap +2). Soin + étouffe les murs + attrition.
- **Tranchant** (scissors · aggro) — *La lame fragile qui frappe en premier et perce tout.*
  **PERFORATION** : Ciseau frais à ATK max + pierce du 1er Aegis (déjà codé) + Hémorragie
  (1 dmg héros/kill). Glass-cannon ; l'Émoussé reste le garde-fou.
- **Mirage** (lizard · tempo) — *L'insaisissable.* **ESQUIVE-RESSOURCE** : les `dodgeCharges`
  (déjà codé) qu'on peuple/recharge/monnaie ; la lane survit toujours un coup de trop + change
  de symbole (Mascarade). Tu ne gagnes pas en force, tu refuses de perdre.
- **Cosmos** (spock · contrôle) — *L'astronome-stratège.* **SURCHARGE** : tant que tu VOIS la
  main adverse (`augurRevealed`), tes sorts coûtent −1 mana (réutilise `effectiveSpellCost`).
  Savoir = payer moins, puis désintégrer le board à 3⭐.

## Architecture (la logique robuste — 4 pièces, toutes EN AMONT du combat)
1. **Source de vérité unique** — `app/src/arena/arenaVoies.ts` : `VOIE_DEF: Record<Move,
   VoieDef>` `{ symbol, label, icon, finisher, signature: CardId[] }`. Centralise l'existant
   éclaté (AFFINITY_TO_FINISHER, bonus inline de makeCreature, VOIE_BONUS/LABEL d'ArenaLobby).
   DRY/SRP iso-comportement, réversible.
2. **Tag de Voie sur les cartes** (la pièce manquante) — champ OPTIONNEL `voie?: Move` sur
   `RankedCard`. On ne tague QUE les cartes évidemment thématiques ; le reste reste NEUTRE
   (`voie` absent = jouable par toutes). Data inerte → back-compat saves totale, zéro carte cassée.
3. **Deck orienté Voie** — `buildPlayerDeck(saved, affinity)` : le pad anti-point-mort
   (arenaDecks.ts) priorise les cartes `voie===affinity`, puis les neutres, **jamais** une
   carte d'une AUTRE Voie. Les choix du joueur restent souverains. ~1 paramètre + 1 tri.
4. **Parité CPU symétrique** — `buildCpuDeckMirroring(deck, cpuAffinity)` : même algo de
   comptage par rareté (équité), mais ordonné signatures-de-sa-Voie d'abord, hors-Voie exclus.
   → archétype vs archétype, plus jamais archétype vs bouillie.

Les nouvelles mécaniques (Strates, Racines, Hémorragie, Surcharge) **réutilisent des hooks
déjà câblés** (voieAtkBonus, branche voieFeuille, dodgeCharges, pierceUsed, effectiveSpellCost)
→ pas de plomberie neuve = robustesse.

## Deck-building : HYBRIDE tranché (« boussole, pas barreaux »)
- ❌ PAS de verrouillage dur (pool draftable ~39 cartes → 3-6 propres/Voie = decks famine,
  contredit « le deck respecte les choix du joueur »).
- ❌ PAS de neutres-boostés purs (= état actuel, Voie pas ressentie).
- ✅ HYBRIDE = **neutres** (colonne vertébrale) + **signatures** (priorisées par le pad +
  finisher à 3⭐) + **hors-Voie** (le joueur peut forcer, mais voyant non bloquant + jamais
  auto-injectées). Pré-requis : **≥4-5 signatures/Voie** avant d'activer la priorisation.

## Roadmap
- **Phase A — Socle technique** (réversible, zéro effet visible) : créer `arenaVoies.ts`/
  VOIE_DEF (centralise l'existant) + champ optionnel `voie?` sur RankedCard (data inerte).
- **Phase B — Voie pilote = MONTAGNE** : taguer 4-5 signatures rock + `buildPlayerDeck(saved,
  affinity)` + tri padPool + CPU symétrique + voyant hors-Voie DeckManager + 1 nouveau passif
  (ex. Strates) AVEC son badge lisible. Device-test + OK Alex AVANT d'étendre.
- **Phase C — Étendre aux 4 autres** une par une (Forêt d'abord = + sûr ; puis Tranchant,
  Mirage, Cosmos). Même recette : tag 4-5 signatures + ≤1 passif lisible + badge.
- **Phase D — Passif unifié** (optionnel, en dernier) : extraire les 5 bonus inline de
  makeCreature vers VOIE_DEF, VERBATIM, zéro changement de valeur.
- **Phase E — Équilibrage** : sonder les caps (Strates +3, Racines +2, burst Tranchant,
  intuable Mirage, double-réduction Cosmos). Cohabitation avec fatigue/HP du rethink, un levier
  à la fois.

## À trancher par Alex
1. **Combien de nouvelles mécaniques/Voie au lancement** (reco KISS : 1 passif lisible + tag
   de l'existant ; 2e nouveauté seulement si la 1re est bien lue au device-test).
2. **Caps d'équilibre** (feel device) : Strates +3 ou +2 ? Racines +2 ? Hémorragie 1/lane/tour ?
3. **Renommage des Voies** : adopter Montagne/Forêt/Tranchant/Mirage/Cosmos (évocateur) ou garder
   Pierre/Feuille/Ciseaux/Lézard/Spock (symbole) ? Touche VOIE_LABEL + locales FR/EN.
4. **Quelles cartes taguer signature** (choix d'identité) — démarrer avec TRÈS PEU, itérer.
5. **Nouveaux effets de COMBAT** (Faille tectonique, Éboulement…) ? Reco : NON pour ce chantier
   (rester en amont) ; tout effet de résolveur = Phase 4 du rethink (le + risqué), fermé ici.
6. **Ordre des Voies** après Montagne (Forêt = + sûr techniquement).

## Garde-fous
Très peu de tags au départ (sinon asymétrie de puissance) · ≥4-5 signatures avant priorisation
(sinon archétype invisible) · CHAQUE passif vient avec son **badge/cue** (sinon montée invisible
= piège récurrent du projet) · extraction passif (Phase D) VERBATIM iso-comportement · NE PAS
déborder vers le combat (toute la robustesse vient de rester en amont) · un seul levier
d'équilibre mesuré à la fois (cohabitation rethink).
