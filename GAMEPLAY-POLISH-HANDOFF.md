# GAMEPLAY-POLISH-HANDOFF — ~50 retouches du JEU (agent suivant)

> **Ceci n'est PAS du refactor.** La chaîne de refactor des god-components est **TERMINÉE + shippée** (`main` = `e1e5b75`,
> tous les fichiers en dossiers, 2 exceptions assumées documentées). Voir `REFACTOR-CHAIN.md`. Ce fichier-ci = le
> **nouveau chantier gameplay / UX / features** dicté par Alex (liste brute notée au fil de l'eau).
>
> Créé 2026-06-16. Workstream **pluri-sessions** (chaque point ≈ comprendre → coder → rebuild APK → device-test Alex).
> Garde ce fichier À JOUR (coche / déplace les points faits). IDs = ceux d'Alex (il y raisonne ; numéros à trous = points déjà traités/retirés, ne pas réinventer).

---

## 0. AVANT DE CODER — règles & workflow (lire en entier)

- **🔒 RÈGLES DE CODE D'ALEX (dans `~/.claude/CLAUDE.md` global, chargées auto — ELLES PRIMENT SUR TOUT).** À appliquer par défaut : **SOLID / SRP, DRY-avec-prudence** (ne pas factoriser prématurément 2 codes qui divergeront), **KISS / YAGNI**, fail-fast ; **séparer UI / logique métier / API / persistance / auth / config** (ne jamais mélanger métier et technique) ; modules petits/cohérents/testables, **< 400 lignes idéal** (dispatch en dossiers) ; sécurité (jamais confiance aux entrées, échapper l'affiché, moindre privilège, pas de secrets loggés) ; **NE TOUCHE PAS au code non lié** (note-le en fin, ne le modifie pas). **Demande, ne suppose pas** : confirme toute ambiguïté/tension AVANT de coder. Règle de décision (plusieurs solutions) : 1) la plus sûre, 2) la plus simple, 3) la plus lisible, 4) la plus testable, 5) la plus évolutive. **Commits SANS trace IA** (pas de Co-Authored-By/🤖, auteur = Alex, messages FR conventional). **Finis chaque tâche** par : Fichiers modifiés / Ce qui a changé / Fichiers intentionnellement non touchés / Suivi nécessaire.
- **Stack / build / persistance / serveur** : `HANDOFF.md`. **Méthode refactor + pièges + build APK + état prod** : `REFACTOR-CHAIN.md` §0,§2,§4,§9. **Mémoire** : `memory/MEMORY.md` (index) — lis surtout `player-data-integrity-mandate`, `economy-server-authoritative`, `accounts-system`, `data-persistence`, `restructure-component-folders`.
- **RÈGLE DURE ALEX — ZÉRO ÉMOJI / ÉMOTICÔNE dans toute l'app.** (Points 5, 6, 31 + partout.) Tout glyphe émoji visible = à remplacer par une vraie illustration/icône SVG ou à retirer.
- **Confirmations obligatoires** (oui dans le message courant) : suppression de fichier, remplacement de code, **merge vers `main` = déploiement Render**, migration, appel externe. Auto-push sur branche de travail seulement si Alex le redonne.
- **Cadence device** : Alex build/teste sur SON tel (`adb -s CMJFT4IN6HFYA6OV`, modèle goya) ET celui de sa femme (`fce0fa440c14`, veux). Tu peux builder+installer (`-r` = garde localStorage) — procédure exacte dans `REFACTOR-CHAIN.md` §pièges (⚠️ `.so` à la **racine** `target/`, gradle `--rerun-tasks`, `git add dossier/` SEUL après `git mv`).
- **Intégrité données joueur (mandat dur)** : chaque élément sauvé correctement (local+serveur), anti-triche, zéro perte/inéquité. Audit à chaque touche au modèle/sync/éco.
- **Ne PAS re-toucher les 2 exceptions refactor** (RankedGame/RankedGame.tsx 1341, OnlinePage/OnlinePage.tsx 1340) pour du refactor — mais OUI pour du gameplay (c'est leur but ici).
- Verts obligatoires avant push : `cd app && pnpm exec tsc --noEmit` + `pnpm exec vite build`. Tests serveur Rust : `cd crates/rpsls-server && cargo test`.

---

## 1. 🔴 BUGS CRITIQUES (à faire en premier)

- **[Pro-20] + [Pro-25] — Second Souffle & Supernova ne se sélectionnent PAS comme les autres au toucher.** Elles « bougent un peu puis reviennent dans le tas » ; obligé de rester appuyé. Pire à l'extrémité GAUCHE de l'éventail (demi-sélection). → Vit dans `app/src/arena/ArenaPlanPhase/ArenaHandFanout.tsx` (onPointerDown/startPress/endPress + pointer-capture) ET `ArenaPlanPhase.tsx` (commitCard/playCard + branchement `fusible`/`castDraw`). HYPOTHÈSE : ces cartes ont un comportement spécial (fusibles/cast-on-draw/utilitaire self) qui détourne le tap → fiche/forge au lieu de sélection. Comparer leur chemin de tap vs une carte normale. **Bug pré-existant** (préservé verbatim au refactor, PAS introduit).
- **[Pro-26] — Cartes de FUSION réapparaissent chaque tour dans le deck.** Depuis qu'il a fusionné « Frappe parfaite » une fois, elle revient à tous les tours. → Logique de recycle deck/défausse : `app/src/arena/arenaDecks.ts` + `arenaRules` (advanceToNextTurn/draw). Les cartes fusionnées (kind:"fusion") ne devraient PAS être reshufflées comme une carte normale. Gérer leur cycle de vie + apparition.
- **[Ranked-1] — Le pad du mode Classé « panique » et se redimensionne** selon les éléments qui apparaissent pendant la partie. → Appliquer le pattern **BoardFillSlot** (résolu en Pro, mesure clientHeight + hauteur px explicite ; voir `arena/ArenaGame/BoardFillSlot.tsx` + mémoire « PAD RÉSOLU Round 16 »). Le mode Classé (`ranked/RankedGame/` + `RankedMatchView`/`LanesBoard`) n'a pas ce fix → cadre fixe absolu comme en Pro.

---

## 2. 🟡 DÉCISIONS DESIGN — demander l'avis d'Alex AVANT de coder

- **[Pro-3] — Carte qui VOLE la carte forgée non récupérée + récup coûte 1 mana** (empêchement + opportunité de vol). ⚠️ **PROBABLEMENT DÉJÀ FAIT** : `useArenaForge` a `FORGE_RECOVER_COST` (récup d'une fusion coûte du mana, dépôt gratuit) et le commentaire mentionne « Razzia adverse peut la voler » ; cartes `pillage`/`trou-noir` existent. → **VÉRIFIER que ça marche comme il l'imagine + confirmer le design** plutôt que reconstruire.
- **[Pro-9] — Mécanique de RECETTES de fusion complète.** Dans la collection : indiquer dans la fiche AVEC QUI + sous quelles conditions chaque carte fusionne. Penser une mécanique exhaustive, fun, logique. → Existe `arenaFusionCards.ts` (findFusionResult/fusionPartnersOf) + mémoire `fusion-recipe-book` (SPEC confirmée NON construite : fusionner en match découvre la recette → craft dust+éclats → carte deckable ; 1re découverte = anim « NOUVELLE RECETTE »). **Gros design+impl — caler la spec avec Alex.**
- **[Pro-10] Télépathie & [Pro-11] Prophétie — readapter.** Pas de bluff/prévision (c'est du live tour par tour, rien à prévoir). Idée d'Alex (qu'il juge brillante) : révéler les lanes adverses **en semi-transparent EN DIRECT, À L'INSTANT où la carte est lancée** (pas en fin de tour). ⚠️ N'a de sens **qu'en ONLINE** (vs CPU, l'IA décide instantanément → pas de « pendant qu'il joue »). Décider : comportement online vs solo, et le timing exact (activation au cast, avant le « Fin de tour » adverse). **Design lourd + dépend du online (§7).**
- **[Pro-22] + [Pro-30] — Même Voie des 2 côtés → 3×2 mêmes lanes** (3 pierres vs 3 pierres…). Comment mieux séparer ce cas / ajouter un mécanisme fun & motivant (pas juste handicapant) ? Est-ce un vrai problème ou ça fait partie du jeu ? → **Question de game design pure, à trancher avec Alex.**
- **[Ranked-3] — Carte utilisée → quitte la main, usage unique. « Legit ? »** → Confirmer la règle voulue (probablement déjà le cas en Pro/Classé).

---

## 3. 🚫 SWEEP ANTI-ÉMOJI + ILLUSTRATIONS (règle dure)

- **[Pro-5] — Émojis sous chaque carte dans le deck** → retirer OU remplacer par de vraies miniatures illustrées. JAMAIS d'émoji.
- **[Pro-6] — Icônes du MENU PRINCIPAL trop proches d'émojis** (de « Défi du jour » à « Constellation Pro »). → Besoin de **prompts pour générer de vraies illustrations cool** (livrer les prompts + intégrer les assets). Voir `PROMPTS_CARTES_FUSION.md` / `PROMPTS-ICONES` (style établi).
- **[Pro-31] — Logo de cartes dans le modal sign in/up** = émoticône → vraie icône.
- Sweep global : grep les glyphes émoji dans `app/src` (UI rendue) et traiter chaque occurrence.

---

## 4. 🎨 ARENA / PRO — UX & équilibrage

- **[Pro-17] + [Pro-21] — Strip de l'adversaire** : descendre légèrement l'avatar (qu'il ressorte un peu du cadre en haut), déplacer le bouton LOGS sous le bouton BURGER (remonter le burger un poil), étirer le strip opp vers la droite pour respirer, et remettre la « voie » (presque hors cadre à droite) plus à gauche. → `arena/ArenaHeroStrip` + `ArenaGame`/`ArenaPlanPhase` (le strip you est rendu dans ArenaPlanPhase).
- **[Pro-36] — Couleur du strip « you » (moi)** : actuellement ROUGE → bleu/vert/émeraude (positif).
- **[Pro-37] — Animation « Tranchant » trop lente / saccadée** → ralentir le rythme global pour espacer/laisser respirer les animations (revoir les durées/délais de la séquence Ciseaux).
- **[Pro-18] — Les Pierres ne doivent pas s'absorber entre elles** (bug de résolution combat). → `arena/arenaCombat`/`arenaRules` (résolution lane Pierre vs Pierre / taunt).
- **[Pro-19] — Revoir « Surcharge »** (utilité/action/logique/équité) + vérifier qu'**Ancrage** fait bien son boulot et est juste. → cartes dans `arenaCardEffects`/`arenaRules` ; auditer l'effet vs le texte.
- **[Pro-35] — Revoir les pioches/apparitions des cartes dans la main** (Pro). → `arenaRules` (drawCards/advanceToNextTurn).

---

## 5. ⚔️ MODE CLASSÉ (Constellation Ranked)

- **[Ranked-2] — Réduire le temps d'attente après une manche** (−0.5 à −1 s avant la manche suivante). → `ranked/RankedGame/RankedGame.tsx` const `ROUND_PAUSE_MS` (7500) — baisser.
- **[Ranked-4] — Animations modernes/fluides comme en Pro** (effets, battle, card, bonus/malus/buffs). → Porter les FX du Pro (`arena/ArenaSpellFX`/`ArenaImpactFX`/etc.) vers le Classé.
- **[Ranked-5] — Même pile-ou-face que le Pro, partout** (autres modes en ligne). → réutiliser `ranked/MatchPrepScreen/` (Coin) dans les autres flux.
- **[RankedConstellation-1] — Disposition de « Toutes les cartes »** pas propre → revoir la grille (probablement `ranked/DeckManager/` ou la vue collection).

---

## 6. 👤 PROFIL / SETTINGS / AUTH

- **[Profil-1] — Burger en avant au scroll** : quand on descend la page profil, le burger doit rester au-dessus + cliquable pour revenir en arrière.
- **[Pro-32] — Traduire « Danger Zone »** dans toutes les langues (actuellement en dur). → `pages/ProfilePage/ResetSection.tsx` (strings en dur EN) → passer par `useT` + clés i18n.
- **[Pro-33] — Ajouter un Logoff dans le profil** AVANT la Danger Zone.
- **[Pro-34] — Mode invité** : dans le burger, là où il y a « Log off », mettre un bouton **Signup/Signin** pour inciter à s'inscrire. → lié à `accounts-system` (mémoire : AuthGate, logout burger déjà en place pour les comptes).
- Agrandir les petits textes (codex + achats deck/cartes) — cf. §9.

---

## 7. 🌐 ONLINE / MULTIJOUEUR (gros, backend+client)

- **[Pro-12] + [Pro-28] — Brancher le mode EN LIGNE pour Constellation Pro ET Classé** (matchmaking via Render comme le mode « en ligne » lanes actuel). Commencer **1v1 simple**, tournois plus tard. Le serveur Render tourne (`rpsls-server-tptj.onrender.com`, keepalive cron). → Énorme : étendre `crates/rpsls-server` (lanes_engine) + `online/online.ts` + brancher `OnlinePage`/`ArenaGame`/`RankedGame` au flux WS. Alex veut tester avec femme/amis.
- **[Pro-13] — Accès aux cartes par joueur** (débloquées/achetées) géré dès le départ côté serveur. « Je suis le SEUL à pouvoir tout avoir, et encore. » → anti-triche : le serveur doit valider la collection. Lié à `economy-server-authoritative` (mémoire, §9-B éco) + `accounts-system`.

---

## 8. 💾 PERSISTANCE / DONNÉES (mandat intégrité)

- **Vérifier que les ACHATS de deck ET le côté CODEX** (cartes ouvertes/récupérées/sauvées) sont bien persistés (local ET serveur). → cf. mémoire `data-persistence` (struct serveur + fingerprint sync) — auditer champ par champ.

---

## 9. 🏗️ GROS CHANTIERS / FEATURES (large, à planifier)

- **Paiement RÉEL des diamants** (actuellement simulé). → IAP réel (store) + lié à `economy-server-authoritative`. Gros, sécurité-sensible.
- **Traductions manquantes À PLEIN D'ENDROITS → « fatal ».** es/de/it/pt/ru/tr incomplets (locales ~740 l vs fr/en ~1130). + traduire la **policy de confidentialité**. → `app/src/i18n/locales/*`. Récurrent et prioritaire pour Alex.
- **Agrandir les petits textes** dans les codex + achats deck/cartes (lisibilité).
- **Landing à SÉPARER du reste + refactor urgent + traductions de la policy.** (Le landing/Welcome mélange encore des choses.)
- **`avatar_backup` utilisé ?** Si non → le dégager (chasse au code mort). → grep `avatar_backup` / `avatarBackup`.
- **[Pro-24] — Refonte des styles entiers des lobbys + arena** pour entraînement, en ligne et classé simple. → gros chantier UI ; aligner avec mémoire `restructure-component-folders` (CSS co-localisé, JAMAIS un mega-CSS).

---

## 10. POINTEURS RAPIDES

- **État prod** : `main` = `develop` = `e1e5b75` (déployé, `/health` 200). Brancher un `feat/...` depuis `develop`.
- **graphify** : `graphify-out/graph.json` — interroge-le (`graphify query/explain/path`) au lieu de lire 40 fichiers (cf. mémoire `graphify-graph`). ⚠️ le graphe date d'avant ce refactor → `graphify update .` d'abord (sûr via `.graphifyignore`).
- **Arbo post-refactor** : les gros composants sont en dossiers (`arena/ArenaGame/`, `ranked/RankedGame/`, `pages/OnlinePage/`, `pages/ProfilePage/`, `match/LanesMatchView/`, etc.) — chaque dossier a son `index.ts` barrel + sous-composants/hooks.
- **Exceptions à connaître** : `RankedGame.tsx` (1341) + `OnlinePage.tsx` (1340) restent gros (cœurs match/sync) — normal, documenté.
- **Build APK** : `REFACTOR-CHAIN.md` §pièges (procédure exacte, chemins).
