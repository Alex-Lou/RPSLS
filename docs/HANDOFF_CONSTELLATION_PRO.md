# HANDOFF — Constellation Pro (RPSLS app)

**Date du handoff** : 2026-06-08
**Branche** : `constellation-pro` (NON-mergée dans `develop` — la branche vit son propre cycle de tests sur le tel d'Alex)
**Dernière APK installée sur le tel d'Alex** : commit `6ef10b6` (avant nettoyage refs CCG) + commit du présent handoff
**Cible** : android arm64 debug, déploiement via adb

> **Statut** : MVP partiellement jouable mais **Alex (l'owner) n'est PAS satisfait**. L'expérience reste confuse, le combat n'est pas lisible/logique pour lui, beaucoup d'items demandés ne sont pas faits. **Ce handoff est le résultat de plusieurs lots de fixes intercalés avec des feedbacks frustrés**. Lis tout avant de coder.

---

## 1. Contexte projet

**RPSLS** = Rock-Paper-Scissors-Lizard-Spock multi-modes (web + Android Tauri). Repo : `C:\Users\34643\Desktop\RPSLS\`.

Modes existants stables :
- **Classique** : RPSLS à la mano
- **Constellation Ranked** : variante 3-lanes simultanées avec deck de cartes (46 cartes V1+V2+V3), ladder LP, tournois, boutique, codex, etc. → **C'est la référence UI/UX qu'Alex veut copier pour Pro**.
- **Classé** : ladder cloud-synced séparé
- **Online** : matchmaking websocket via Render + Upstash

**Constellation Pro** (`branche constellation-pro`, dossier `app/src/arena/`) = mini-CCG inspiré des CCG modernes (créatures + sorts + mana scalable + lanes persistantes). **Démarré il y a quelques sessions** et toujours en itération.

### ⚠️ LÉGAL — JAMAIS dire "Hearthstone" nulle part

Alex a explicitement interdit toute mention de Hearthstone dans le code, les docs, les commits, les chips UI, les commentaires. Tout a été remplacé par **"CCG-style"** / **"mini-CCG"** / **"TCG-classic"** / **"jeu de cartes moderne"**. Vérifie avec `grep -ri hearthstone .` avant de commiter. Risque de procès.

---

## 2. État actuel de l'arène (Constellation Pro)

### Fichiers principaux (tous sous le ceiling 400 lignes)

| Fichier | Lignes | Rôle |
|---|---|---|
| `app/src/arena/ArenaPage.tsx` | 89 | Entry point, gère prep→game stage, snapshot/restore CSS vars |
| `app/src/arena/ArenaPrepScreen.tsx` | 322 | Phase prep: VS face-off + coin flip + bouton "?" + bouton commencer |
| `app/src/arena/ArenaGame.tsx` | 311 | Orchestrateur: state board/intent/preview/combat, gère lockTurn |
| `app/src/arena/ArenaBoard.tsx` | 394 | Layout: opp strip + opp row + center status + player row + player strip |
| `app/src/arena/ArenaLaneSlot.tsx` | 350+ | UI d'un slot de lane (créature/ghost/empty + clickable label) |
| `app/src/arena/ArenaHeroStrip.tsx` | 257 | Portrait + HP bar + mana + main + augur reveal chips |
| `app/src/arena/ArenaPlanPhase.tsx` | 359 | Picker RPSLS + hand strip + lock button (long-press 1.4s = inspect) |
| `app/src/arena/ArenaCardInspect.tsx` | 106 | Modal fullscreen de description de carte |
| `app/src/arena/ArenaHowItWorks.tsx` | 110 | Modal "Comment ça marche" (accessible uniquement depuis le prep screen) |
| `app/src/arena/ArenaMatchEnd.tsx` | 156 | Cinématique fin de match avec récompense éclats |
| `app/src/arena/ArenaMatchSplash.tsx` | 115 | Splash VS face-à-face ~1.8s |
| `app/src/arena/arenaTypes.ts` | 286 | Types: HeroState, Creature, BoardState, CARD_TARGET_KIND, LANE_SPELL_TARGET_SIDE, helpers isValidLaneTarget + targetLabelFor |
| `app/src/arena/arenaRules.ts` | 368 | Pure rules: resolveLaneCombatAt, applySpellPhase, applySummons, makeCreature, etc. |
| `app/src/arena/arenaCardEffects.ts` | 280 | Dispatch des sorts (15 cartes adaptées) |
| `app/src/arena/arenaPhase2Spells.ts` | 250 | Phase 2 spell effects |
| `app/src/arena/arenaSpellHelpers.ts` | ~80 | Helpers communs aux spells |
| `app/src/arena/arenaAI.ts` | 312 | CPU greedy AI avec lethal check, défense, cap 2 summons/turn |
| `app/src/arena/arenaDecks.ts` | 82 | CPU_ARENA_DECK + buildPlayerDeck (avec FILLER Heist+Supernova forcé) |
| `app/src/arena/arenaResolverFlow.ts` | 170 | Sequenced resolver: reveal→spells→summons→combat lane-by-lane→settle |

Composant partagé (utilisé Ranked + Pro) :
- `app/src/ranked/BigCardReveal.tsx` (70L) — animation de flip dramatique pour un sort joué (top-right pour opp, bottom-left pour you).

### Ce qui marche aujourd'hui

- Tour simultané (player + CPU planifient en parallèle, lock, resolver séquencé)
- Combat lane-par-lane avec charge anim (créature traverse +/-60px, scale 1.28, drop-shadow doré)
- HP flash dramatique sur le héros attaqué
- Taunt deflection chip "🪨 PROVOCATION BLOQUE !"
- BigCardReveal pour sorts joués
- Carte-collée-sur-lane (mini-CardSlot dans le coin)
- Long-press 1.4s = inspect modal, single-tap = commit
- Targeting par carte : table `LANE_SPELL_TARGET_SIDE` qui dit "my-creature" / "opp-creature" / "my-empty-opp-occupied" → highlight les bons slots
- Prep screen avec coin flip pour thème (player win = ton thème, opp win = thème CPU randomisé)
- Rematch retourne à prep (fresh coin)
- HowItWorks modal (8 sections explicatives)
- Augur révèle la main opp comme chips ambre sur l'opp strip

### Ce qui NE marche PAS (Alex)

**TOUT le reste de la liste ci-dessous** — voir section 4.

---

## 3. Procédure de build & déploiement APK (Windows, CRITIQUE)

**Le bug Windows** : `npx tauri android build --debug --apk --target aarch64` échoue TOUJOURS au DERNIER pas avec "Creation symbolic link is not allowed" (faut Developer Mode pour le symlink). MAIS le `.so` est déjà compilé. Donc :

```powershell
# 1) Compile (échoue exprès au symlink, c'est OK)
Set-Location app
$env:ANDROID_NDK_ROOT = $env:NDK_HOME
npx tauri android build --debug --apk --target aarch64

# 2) Copie le .so fraîchement compilé vers jniLibs
$src = "C:\Users\34643\Desktop\RPSLS\target\aarch64-linux-android\debug\libapp_lib.so"
$dst = "C:\Users\34643\Desktop\RPSLS\app\src-tauri\gen\android\app\src\main\jniLibs\arm64-v8a\libapp_lib.so"
Copy-Item $src $dst -Force

# 3) Gradle package (skip rust rebuild — .so déjà frais)
Set-Location app\src-tauri\gen\android
.\gradlew assembleArm64Debug -x rustBuildArm64Debug

# 4) Install
$apk = "C:\Users\34643\Desktop\RPSLS\app\src-tauri\gen\android\app\build\outputs\apk\arm64\debug\app-arm64-debug.apk"
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb uninstall com.alex.rpsls
& $adb install $apk
# CRITIQUE : Play Protect peut refuser l'install → demander à Alex d'accepter sur le tel

# 5) Force-stop + launch (CRITIQUE : sinon le vieux JS reste en mémoire)
& $adb shell am force-stop com.alex.rpsls
& $adb shell am start -n com.alex.rpsls/.MainActivity

# 6) Vérif PID + logcat
Start-Sleep -Seconds 3
& $adb shell pidof com.alex.rpsls
& $adb logcat -d -t 200 | Select-String -Pattern "FATAL|AndroidRuntime"
```

**Temps total** : ~3-5 min pour la compile, ~30s pour gradle, ~10s pour install. Total ~5 min par déploiement.

**Alt durable** : activer Windows Developer Mode → tauri symlink marche → pas besoin de copier manuellement. Mais Alex ne l'a pas activé.

### Procédure git

```bash
cd /c/Users/34643/Desktop/RPSLS
git add app/src/arena/<files...>
pnpm -C app exec tsc --noEmit  # OBLIGATOIRE typecheck avant commit
git commit -m "..."  # message en français, sections claires
git push  # vers constellation-pro
```

**Ne jamais merger dans `develop` sans validation explicite d'Alex sur le tel.**

---

## 4. Problèmes Alex — état détaillé

### ❌ PROBLÈMES CRITIQUES NON-FIXÉS

#### A. Combat RPSLS pas respecté (#2 de son dernier feedback)
**Citation** : *"ciseaux vs feuille — le ciseaux bat toujours la feuille, sans carte ou condition à part, je vois pas pourquoi je suis pas blessé alors que j'avais feuille... pas logique on va me lyncher"*

**Diagnostic** : le combat actuel est HP/ATK first avec RPSLS = +1 ATK bonus. Alex veut RPSLS-first où le perdant RPSLS DIE et le hero du perdant prend des dégâts d'office.

**Décision design ouverte** — propose une **AskUserQuestion** :
- Option A : RPSLS one-shot kill (counter = défenseur mort + attaquant intact ; pas de counter = échange ATK/HP normal ; draw = tous 2 perdent 1 HP)
- Option B : RPSLS-only damage (le perdant RPSLS pousse les dégâts directs ATK au HÉROS opp ; HP/ATK des créatures servent uniquement à survivre les rounds suivants)
- Option C : Garder HP/ATK + boost le bonus RPSLS de +1 à +3 ATK (compromis)

À éclairer avec Alex avant de toucher. **NE RIEN CHANGER tant que pas décidé.**

#### B. CPU joue les mêmes moves en boucle (#6)
**Citation** : *"l'ia débloque grave elle joue un tour et après rejoue encore et toujours les mêmes moves... pas logique"*

**Diagnostic** : `cpuArenaDecision` dans `arenaAI.ts` n'a pas de mémoire turn-à-turn. À chaque tour elle re-calcule depuis zéro avec heuristique greedy. Si l'état du board reste similaire, elle répète son choix.

**Fix proposé** : (a) ajouter un état d'historique des N derniers moves dans `playerDeck.current` ref, (b) pénaliser le score d'un move récemment utilisé. Ou : (c) plus simple — augmenter la randomisation dans `pickBestMove` (actuellement déterministe).

#### C. Drag-and-drop des moves/cartes vers lanes (#4 chronique)
**Citation** : *"il faut être super flexible dans les touchers selections de lane"* + *"DRag and drop des moves et cartes vers lane absents!"*

**Diagnostic** : flow actuel = tap card → entre en targeting → tap lane. Pas de drag.

**Fix proposé** : framer-motion drag handlers sur les boutons du picker RPSLS et sur les cartes du hand strip. onDragEnd → calcul du drop target via hit-test des lane slots. **Gros chantier** (~3-4h).

#### D. Cadre coloré autour de la carte tap + case de lane qui l'accueille (#1)
**Citation** : *"Quand je tap une carte ou la drag, je veux voir aussi un cadre de couleur autour de la carte et de la case du tour qui est censée l'accueillir (du même type ; ruse, sagesse, etc)"*

**Diagnostic** : actuellement quand on tap une carte, les lanes valides pulsent en ambre. Alex veut un système plus visuel et thématique : couleurs assorties au "type" de carte (ex : carte buff = vert sur lanes player, carte debuff = rouge sur lanes opp, mais aussi reliée au type de la lane "Ruse/Sagesse/Force").

**Note** : les lanes en Pro n'ont pas d'identité (Ruse/Sagesse/Force) — c'est un concept Ranked. Alex demande de les porter en Pro + de varier leur position par match (#5 de son feedback session-1). À implémenter avec une `LANE_IDENTITY_PERM` shuffle par match comme dans `ranked/laneIdentityAt`.

**Fix proposé** : (a) porter `laneIdentityAt` à Pro avec shuffle par match, (b) tinter les lanes par identité, (c) ajouter un cadre coloré sur la carte tap + sur les lanes valides en couleur de l'identité.

#### E. Bouton retour + confirmation forfait + wire rank perdu (#3)
**Citation** : *"Il manque le bouton/flèche de retour comme pour toutes les autres interfaces dans la partie + demande de confirmation et avertissement de perte par forfait + wire les pertes réellement sur le rank du joueur"*

**Diagnostic** : Pro a un `useAndroidBackPrompt` mais pas de FloatingBackButton visible. Pas de wire arena → ranked LP rank (Arena a son propre `arenaStats` séparé).

**Fix proposé** : (a) intégrer `FloatingMatchBackButton` du `sharedMatchUI.tsx` dans ArenaGame, (b) ConfirmModal "Forfait = défaite + perte de progression", (c) sur forfait → `recordArenaMatch("loss")` qui affecte `arenaStats`. **PAS** toucher au LP du Ranked — c'est un ladder séparé.

#### F. Comment ça marche trop technique (#5 de son dernier feedback)
**Citation** : *"Comment ça marche hyper technique et pas clair du tout même pour moi... arrange-le en VRAI, et simplifie à fond"*

**Diagnostic** : le modal actuel `ArenaHowItWorks.tsx` a 8 sections avec des termes techniques (ATK, HP, RPSLS counter, Aegis, Anchor, Taunt, etc.). Alex veut une explication tutoriel-style avec des visuels.

**Fix proposé** : refonte complète en mode storytelling : 3 écrans (slides) au lieu d'un long texte. Slide 1 = "L'objectif : 20 ❤ → 0" (avec dessin/animation), Slide 2 = "Un tour : tu invoques (1 mana) ou lances un sort", Slide 3 = "Le combat : créatures s'affrontent ou frappent le héros". Avec mini-animations cliquables.

#### G. Pad bloom incorrect appliqué (#3 du feedback précédent)
**Citation** : *"Je n'ai jamais choisi bloom pad et pourtant il est là alors que j'ai gagné!"*

**Diagnostic** : si Alex a `player.padId = "bloom"` saved dans son store, c'est attendu (il a peut-être tap dessus sans le savoir). Sinon c'est un vrai bug : `ArenaPrepScreen` lit `useStore((s) => s.player.padId)` et `ArenaPage` passe `prep?.padId` à `ArenaPadProvider`.

**À investiguer** : faire ouvrir DevTools sur le tel et vérifier `JSON.stringify(useStore.getState().player)` pour voir le `padId` réel.

#### H. Pas de Lobby (#6/#7 de la session précédente)
**Citation** : *"Je veux un lobby comme dans Constellation Ranked, pour monter son deck, dépenser, acheter, craft, etc avant de se lancer dans un matchmaking"* + *"Possibilité de choisir dans ce même lobby entre entraînement, match rapide, tournoi (simple / classé), je dois aussi avoir une section de "Comment ça marche""*

**Diagnostic** : actuellement Arena va direct prep → game. Pas de lobby distinct avec sections.

**Fix proposé (GROS chantier ~3-4h)** : créer `ArenaLobby.tsx` qui présente :
- Onglet "Entraînement" (vs CPU, current flow)
- Onglet "Match rapide" (matchmaking online via WS, fallback bot après 25s — copier le pattern de `OnlinePage` queue + fallback)
- Onglet "Tournoi" (bracket avec persona seedés + classique vs classé)
- Onglet "Boutique" (réutiliser ShopPage spec)
- Onglet "Comment ça marche" (HowItWorks toujours accessible)
- Onglet "Deck" (DeckManager spécifique Arena ou réutiliser le Ranked DeckManager — décision à prendre)

### ✅ PROBLÈMES DÉJÀ FIXÉS (lots 1 à 1e)

- Rematch coincé → splash useEffect dep fixed
- Carte-collée-sur-lane (CardSlot mini) ✓
- HowItWorks modal ✓
- Shield "🛡️ ABSORBÉ" chip ✓
- Long-press inspect / single-tap commit ✓
- Augur révèle la main opp visuellement (chips ambre) ✓
- Ghost overlap nom/en-attente ✓
- HowItWorks section tour-par-tour ✓
- CPU shuffle lane order (plus de pattern 1→2→3 systématique) ✓
- Coin-flip prep screen ✓ (thème dépend du coin)
- Dots animés au lieu de "en attente" ✓
- Rematch via prep (fresh coin) ✓
- Taunt deflection visible ("🪨 PROVOCATION BLOQUE !") ✓
- BigCardReveal en Arena (parité Ranked) ✓
- "?" retiré du match ✓
- Refs Hearthstone purgées ✓

---

## 5. Architecture & patterns clés

### Combat (résolveur)
- `arenaResolverFlow.ts:runResolverFlow` orchestre les phases avec setTimeouts
- Phases : REVEAL_MS (1500) → SPELLS_MS (1200) → SUMMONS_MS (1000) → COMBAT_MS (3000) → SETTLE_MS (1500)
- Combat = boucle `runLane(0)→runLane(1)→runLane(2)` avec LANE_CHARGE_MS (520) + LANE_PAUSE_MS (320)
- Détecte `aHitsB`, `bHitsA`, `aDeflectedByB`, `bDeflectedByA` et émet `setHeroHit` ou `setTauntBlock` au timing apex (55% de la charge)

### Targeting
- `arenaTypes.ts:CARD_TARGET_KIND` mappe chaque carte → "lane" | "self" | "hero" | "global"
- `arenaTypes.ts:LANE_SPELL_TARGET_SIDE` mappe les "lane" cartes → "my-creature" | "opp-creature" | "my-empty-opp-occupied" | "my-empty"
- `arenaTypes.ts:isValidLaneTarget(targeting, side, lane, lanes, playerSide)` retourne booléen
- `arenaTypes.ts:targetLabelFor(targeting)` retourne le label affiché ("✦ Invoquer ici", "✦ Cible ta créature", etc.)

### Prep & coin flip
- `ArenaPrepScreen.tsx` : auto-flip retiré, player tape le coin → 1.6s anim 3D → result chip
- Pool de personas CPU (10) + pool de thèmes (14) + pool de pads (14)
- `ArenaPage.tsx` snapshot/restore CSS vars autour de la game mount
- `ArenaPadProvider` (context React de `ranked/arena.tsx`) override le pad pour la durée du match

### Decks
- `arenaDecks.ts:buildPlayerDeck` filtre par `arenaSupported` puis force-include Heist+Supernova si absent (Alex avait le bug "opp ne perd jamais de vie" car son deck n'avait aucun direct-damage)
- `CPU_ARENA_DECK` = 12 cartes curatées (1 par archétype Phase-1)

---

## 6. Plan de travail recommandé pour le prochain agent

### Lot 2 — UX clarté gameplay (priorité MAX)
1. **AskUserQuestion sur le modèle combat RPSLS** (item A) — DOIT être tranché avant de coder
2. Bouton retour + ConfirmModal forfait + wire arenaStats sur défaite (item E) — easy
3. Refonte HowItWorks en mode tutoriel slides (item F)

### Lot 3 — Variation lanes + targeting visuel
4. Porter `laneIdentityAt` à Pro avec shuffle par match (item D précurseur)
5. Cadre coloré tap-card + tint lane par identité (item D)

### Lot 4 — Drag-and-drop
6. Drag-drop moves RPSLS du picker vers lanes (item C)
7. Drag-drop cartes du hand strip vers cibles (item C)

### Lot 5 — Lobby
8. Créer `ArenaLobby.tsx` avec 6 onglets (item H)
9. Wire matchmaking online via WS + fallback bot 25s
10. DeckManager Arena (ou réutilisation Ranked)

### Lot 6 — IA et balance
11. Mémoire CPU + pénalisation moves répétés (item B)
12. Tester équilibre + ajuster ATK/HP/coûts

### Lot ∞ — Quand Alex valide
- Merger dans `develop`
- Release officielle bump version
- Update `MEMORY.md` avec entrée "Constellation Pro merged"

---

## 7. Conventions du repo

- **400 lignes par fichier max** — Alex rappelle ça souvent
- **Pas de fichiers orphelins** — chaque fichier doit être importé quelque part
- **Commits en français** avec section claire + Co-Authored-By footer
- **Typecheck obligatoire** avant chaque commit : `pnpm -C app exec tsc --noEmit`
- **i18n EN + FR** pour tout texte user-facing (`app/src/i18n/locales/{en,fr}.ts`)
- **RTK** : si tu vois `rtk` dans les commandes utilisateur, c'est un wrapper de filtrage de tokens. Tu peux ignorer.

---

## 8. Communication avec Alex

- Réponse en **français**
- Court et concret — il déteste les pavés
- Quand tu plantes ou tu dois reculer, dis-le direct
- **Test sur le tel obligatoire** après chaque APK — sans test device, ne dis pas "fixé"
- Quand tu fais un AskUserQuestion, propose 2-4 options claires
- Quand tu doutes du design : POSE LA QUESTION avant de coder
- Tone : Alex est exigeant, il alterne entre frustration et bienveillance. Ne le prends pas mal.

---

## 9. Erreurs à NE PAS répéter

- ❌ Mentionner "Hearthstone" dans le code, les docs, les commits, les chips, l'i18n (légal)
- ❌ Coder un gros refactor sans demander d'abord (Alex préfère qu'on s'aligne)
- ❌ Promettre "c'est fait" sans avoir buildé + déployé + vérifié sur le tel
- ❌ Auto-flip sur le coin (Alex veut le contrôle)
- ❌ Mettre des boutons d'aide / d'inspect ENNUYEUX en plein match (la prep screen est faite pour ça)
- ❌ Dupliquer le code Ranked au lieu de l'importer (BigCardReveal est le bon pattern)
- ❌ Auto-merger dans develop sans validation Alex

---

## 10. Pour démarrer

```bash
cd /c/Users/34643/Desktop/RPSLS
git checkout constellation-pro
git pull
pnpm -C app install
pnpm -C app exec tsc --noEmit  # vérifier typecheck clean

# Pour build APK : voir section 3
```

Lis :
1. Ce fichier en entier
2. `docs/CONSTELLATION_PRO_DESIGN.md`
3. `docs/CONSTELLATION_PRO_BUILD_PLAN.md`
4. `app/src/arena/arenaTypes.ts` (types + tables targeting)
5. `app/src/arena/arenaRules.ts` (combat engine)
6. `app/src/arena/ArenaGame.tsx` (orchestrateur)
7. `app/src/ranked/LanesBoard.tsx` (référence UI à copier)

Puis demande à Alex : "J'ai lu le handoff. Sur quel item du Lot 2 tu veux que j'attaque en premier ?" et propose des AskUserQuestion pour le combat model.

---

**Bonne chance.**
