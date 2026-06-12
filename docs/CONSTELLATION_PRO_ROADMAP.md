# Constellation Pro — Roadmap & État Complet

> **Dernière mise à jour : 2026-06-11 (Round 17 — AUDIT LOGIQUE moteur : 14 correctifs, dont BUT D'OR annulé par les timers + Finishers FORTERESSE/VERGER/LAME/CALCUL qui ne respectaient pas leur texte)**
> Document actualisé à chaque session. Source de vérité unique pour reprendre le travail.
> Branche : `constellation-pro`. Dernier commit poussé : `c589dc8` (Round 11.5). **Rounds 12→17 NON commités** (attendent feu vert commit Alex). **Pad VALIDÉ device** sur build `index-jUIZZstP.js` (hash servi vérifié via DevTools). Aussi non commités : Aegis/Anchor double-cast fix, chips passifs Étouffe/Logique/Tranchant, chip lane label `L{n}`, éventail élargi, + tout le Round 17 ci-dessous.

---

## 🔴🔴 PRIORITÉ ABSOLUE POUR LE PROCHAIN AGENT 🔴🔴

### 1. ✅✅ PAD — RÉSOLU & VALIDÉ DEVICE PAR ALEX (Round 16, build `index-jUIZZstP.js`)

**Solution finale = `BoardFillSlot` dans `ArenaGame.tsx` + prop `fillHeight` sur `ArenaBoard.tsx`.** Cause racine des ~3h perdues : le **WebView Android NE résout PAS de façon fiable** une chaîne `flex-1` profonde NI `height:100%`/`h-full` contre un parent flex-grow (le pad restait court → **rangée du bas COUPÉE**) — alors que **ça marche en preview Chromium desktop** (LE piège qui trompe). MAIS `clientHeight` (mesure post-layout) EST fiable.

**Mécanisme :** `BoardFillSlot` = un slot `flex-1 min-h-0 overflow-hidden` qui **mesure son `clientHeight`** et le passe à `ArenaBoard` via `fillHeight` → posé en **`minHeight` px** sur la racine du board → le pad `flex-1 min-h-0 justify-between` REMPLIT pour de vrai (les 2 rangées de lanes s'écartent haut/bas, **espace au centre** pour les chip queues), **cartes `aspect-[5/4]` INCHANGÉES (zéro scale)**. Filet écran court : `BoardFillSlot` mesure aussi `inner.scrollHeight` ; si > dispo → `transform:scale(dispo/nh)` (réduit UNIQUEMENT si ça ne rentre pas, **jamais de coupe**). **La plan phase (moves + deck) est DEHORS du slot → JAMAIS rétrécie** (exigence Alex : "touche QUE le pad").

**Vérifié preview puis validé device :** 412×915 (tel d'Alex) → scale 1, board=slot=477px, `center_gap` 71px, carte 97px intacte, main 293px naturelle ; 412×680 (court) → scale 0.52, aucune coupe.

⚠️ **NE JAMAIS REFAIRE** (chacun a échoué sur device) : (a) `flex-1` profond pour remplir le pad ; (b) `height:100%`/`h-full` contre flex-grow ; (c) `ScaleToFit` autour de TOUTE la stage (ça rétrécit AUSSI la main → rejeté par Alex). Le harness preview `#measure-arena` donne un contexte flex propre que l'app réelle (PlayPage→ArenaPage) n'a PAS dans le WebView → **ne pas s'y fier pour le fill, seul le device fait foi**.

**Saga des tentatives ratées (pour mémoire) :** R13 (retrait ScaleToFit global, pad `flex-1`) + R14 (flexbox pur `items-stretch`) → marchaient en preview, lanes COUPÉES sur device (flex profond non résolu). R15 (calque Ranked, `ScaleToFit` autour de board+main) → pad OK mais **rétrécit la main** (rejeté). **R16 (`BoardFillSlot` measured-fill) → ✅ validé.**

### 2. PIÈGE WEBVIEW CACHE (perte de temps majeure cette session)

**Symptôme** : après build + install, l'app sert TOUJOURS l'ancien frontend (vérifiable via le hash `index-XXXX.js` dans les logs `[arena:*]` qui apparaît dans `File: http://tauri.localhost/assets/index-XXXX.js`).

**Diagnostic** : le `.so` compilé EST frais (vérifier avec `grep -c "NOUVEAUHASH" target/aarch64-linux-android/debug/libapp_lib.so`), l'APK packagée EST fraîche (`unzip -p APK lib/arm64-v8a/libapp_lib.so | grep -c HASH`), MAIS le **WebView Android cache l'ancien bundle JS** et le ressert.

**2 pièges combinés cette session** :
- **(a) cargo n'a pas re-embarqué le frontend** : après un changement TSX, `npx tauri android build` régénère `dist/` mais cargo relinke le `.so` SANS re-embarquer le nouveau `dist` (cache incrémental). → **FIX : `touch app/src-tauri/src/lib.rs`** AVANT le build pour forcer cargo à recompiler + re-embarquer. Vérifier ensuite `grep -c HASH .so`.
- **(b) WebView cache** : même avec un `.so` frais installé, le WebView ressert l'ancien JS. `adb shell pm clear` est REFUSÉ (SecurityException, device sécurisé). → **FIX : `adb uninstall com.alex.rpsls` COMPLET (vérifier "CONFIRMED REMOVED" via `pm list packages`) puis `adb install`**. L'uninstall efface `/data/data/com.alex.rpsls/` (cache WebView inclus). Un simple `adb install -r` ou `am start` NE SUFFIT PAS.

**Procédure build fiable validée (à suivre ABSOLUMENT)** :
```powershell
# 1. touch lib.rs pour forcer re-embed frontend
# (bash) touch app/src-tauri/src/lib.rs
# 2. build (échoue au symlink Windows mais compile le .so)
cd app; $env:ANDROID_NDK_ROOT=$env:NDK_HOME; npx tauri android build --debug --apk --target aarch64
# 3. VÉRIFIER le .so contient le bon frontend (bash) :
#    grep -o 'index-[A-Za-z0-9_]*\.js' app/dist/index.html   → hash attendu
#    grep -c "<hash>" target/aarch64-linux-android/debug/libapp_lib.so  → doit être 1
# 4. copier .so + gradle
Copy-Item target\aarch64-linux-android\debug\libapp_lib.so app\src-tauri\gen\android\app\src\main\jniLibs\arm64-v8a\libapp_lib.so -Force
cd app\src-tauri\gen\android; .\gradlew assembleArm64Debug -x rustBuildArm64Debug
# 5. UNINSTALL COMPLET + install (PAS juste -r)
adb uninstall com.alex.rpsls            # vérifier "Success"
adb shell pm list packages com.alex.rpsls   # doit être VIDE
adb install app\build\outputs\apk\arm64\debug\app-arm64-debug.apk
adb shell am force-stop com.alex.rpsls; adb shell am start -n com.alex.rpsls/.MainActivity
# 6. VÉRIFIER le hash servi via logcat (doit être le NOUVEAU) :
#    adb logcat -s "Tauri/Console:*" | grep "index-"
```

⚠️ **TOUJOURS vérifier le hash servi dans les logs AVANT de demander à Alex de tester.** Sinon il teste l'ancien build (perte de temps + frustration).

---

## État réel des lots (au 2026-06-10)

| Lot | Description | Statut RÉEL |
|-----|-------------|-------------|
| A | Stabilisation UI | ✅ DONE |
| B | Affinité 5 Voies RPSLS | ✅ DONE (5/5 voies câblées) |
| C | Constellation 3⭐ simultanée | ✅ DONE + validé device |
| D | 5 Finishers + hooks runtime | ✅ DONE (effets + VERGER/MÉTAMORPHOSE/LAME runtime) |
| E | Lobby Pro | ✅ DONE |
| F | Matchmaking online | 🟢 PENDING (optionnel, jamais commencé) |
| G | Tournoi Arena | 🟢 PENDING (optionnel, jamais commencé) |
| H | Polish UX feedback Alex | 🟡 EN COURS — voir détail rounds ci-dessous |

### Voie de la Pierre — VALIDÉE EN LIVE (ne PAS toucher)
Alex teste UNIQUEMENT la Voie Pierre pour l'instant (pour ne pas tout mélanger). Match complet watché 2026-06-10 : **les 8 mécaniques roulent parfaitement**. NE RIEN MODIFIER sur la Voie Pierre.
1. Provoc 2 charges (`P2L` au summon, Voie bonus)
2. Lente au summon (⚔0 le tour de pose)
3. Deflect attaque undefended → héros
4. Charges consommées (P2→P1→P0)
5. Anti-taunt (opp Feuille/Spock → `deflectCheck deflect=null`)
6. Combat counter prime en lane directe (Feuille bat Pierre, Pierre bat Lézard/Ciseau)
7. Constellation compte Pierres vivantes
8. Recharge ⚔ après Lente

---

## Rounds de fix Alex (chronologie détaillée)

### Round 5 ✅ (commit `7a596ec`)
- #4 BUG carte multi-cast : `addSpell` check `usageCount >= handCount` (1 carte = 1 cast)
- #6 Match-end delay 200ms→1600ms
- #7 GO countdown 0.45s→1.2s + scale dramatique
- Filet MAX_SPELLS aligné UI (truncateByCaps : 2 lane + 1 utility)

### Round 6 ✅ (commit `d406064`)
- #5 Esquive sticker stuck — clear sur mort/changement creature
- Fix crash dlopen (copy .so foiré silencieusement)

### Round 7 ✅ (commit `ba2647e`, `d2dec10`)
- Caps rareté pioche (common 3 / rare 2 / epic 1 / leg 1) avec retry option A
- Log explicite `consumed cards=[...]` dans removeSpentCards

### Round 8 ✅ (commit `4dd2fae`)
- Lot B complet : Voie Feuille (Fanaison /2 via `voieFeuille` + `wiltSkipNext`) + Voie Lézard (Esquive 2 charges via refactor `dodgeCharge: boolean` → `dodgeCharges: number`)

### Round 9 ✅ (commit `c65c4ef`)
- #1 Anim attaque snappy (LANE_CHARGE 520→380, LANE_PAUSE 320→200)
- #2 Voie adverse visible (label texte "Pierre/Feuille/..." dans ConstellationBar)
- #3 CPU moins parfait (30% random au lieu de counter parfait)
- #4 BUG Heist target `"lane"` → `"none"` + i18n FR/EN
- #5 Pad bigger (padding 4/5, gap 5/6) — **INSUFFISANT selon Alex**

### Round 10 ✅ (commit `61f3950`)
- Lot D-bis hooks runtime : VERGER heal +1/tour, MÉTAMORPHOSE dodge refresh, LAME pierce TOUT (dans `advanceToNextTurn` + `arenaCombat`)
- **VRAI BUT D'OR** : phase `sudden-death` + `ArenaSuddenDeath.tsx` (mort subite RPSLS quand égalité parfaite aDead&&bDead). PAS ENCORE testé en live (pas d'égalité parfaite rencontrée).

### Round 11 ✅ (commit `03f231e`)
- #1 Tooltip Provoc/anti-taunt (section ArenaHowItWorks "🚨 Pourquoi MA Pierre ne défend pas ?")
- #3 Éventail multi-cartes par lane (fan rotation −10°/+10° + offset X)

### Round 11.5 ✅ (commit `c589dc8`)
- Pad encore agrandi (padding 5/6, gap 6/7, min-h 420/480) — **TOUJOURS INSUFFISANT selon Alex**

### Round 12 🔴 NON COMMITÉ (attend validation Alex sur bon build)
- Layout strips SORTIS du pad : opp strip tout en haut (hors backdrop pad), player strip tout en bas (hors backdrop pad), pad = lanes + center seulement avec `justify-between` + min-h 440/520
- **Problème** : Alex perçoit toujours le pad comme RÉTRÉCI, pas agrandi. À RETRAVAILLER en priorité.
- Fichiers modifiés non commités : `ArenaBoard.tsx` (layout strips)

### Round 13 ✅ NON COMMITÉ — build+install+hash vérifiés device, attend validation Alex
- **PAD FIX architectural** (cf. priorité #1 RÉSOLUE) : `ScaleToFit` (sharedMatchUI) a un nouveau mode **`fill`**. `ArenaGame.tsx` wrappe TOUT le board dans `<ScaleToFit fill>` ; `ArenaBoard.tsx` : pad = cadre `flex-1 min-h-[280px] w-full flex flex-col` pleine largeur, strips `shrink-0`, contenu lanes `h-full justify-between` (REMPLIT le pad). Mesuré preview : écran haut (le tel d'Alex) → scale 1, pleine largeur **412px**, lanes remplissent le pad (plus d'espace vide en dessous — 2e feedback Alex) ; écran court 620px → scale-down 0.4 propre, lock visible, **pas de clip**. Vrai diag via `getBoundingClientRect` : l'ancien `ScaleToFit` global scalait tout à **0.76** (board 625>slot 477) → gouttières = effet "écrasé". Bumps min-h aggravaient. `fill` mode : si le contenu tient → stretch + space-between (remplit) ; sinon → scale-down (sécurité court). Alex d'abord "non plus haut" puis "remplis l'espace vide" → fill.
- **P1 Aegis double-cast FIXÉ** : garde dans `ArenaGame.addSpell` — refuse un 2e aegis (déjà en queue ce tour OU `board.a.aegisCastThisMatch`) → la carte n'est plus gaspillée. Aegis = seul sort lock 1×/match aujourd'hui.
- **P1 Supernova investigué (pas de fix code)** : `targetOppBestCreature` (arenaAI.ts:357-359) skippe DÉJÀ anchored/spellImmune. Le fizzle T5 = Anchor même tour du joueur (imprévisible → comportement correct). "CPU préfère héros" = tweak DIFFICULTÉ en attente décision Alex (ne pas changer à l'aveugle).
- **Animations passifs (lot P2)** : chips Étouffe/Logique ("Provoc annulée") + Tranchant ("🩸 Bouclier percé"). Resolver `setAntiTaunt` + `ArenaLaneSlot` pierce. Typecheck OK. **NON buildé** (attend prochain build).
- Build device COURANT : **`index-VF5-XvkD.js`** (pad fill + Aegis double-cast) installé + servi vérifié via DevTools — à tester par Alex. Les chips passifs ne sont PAS dedans (build suivant).
- Fichiers Round 13 : `ArenaBoard.tsx`, `ArenaGame.tsx`, `arenaResolverFlow.ts`, `ArenaLaneSlot.tsx`, `match/sharedMatchUI.tsx` (ScaleToFit `fill`). Harness mesure `App.tsx` ajouté/retiré.

### Round 14 ✅ NON COMMITÉ — build en cours (corrections feedback test Alex sur VF5-XvkD)
- **(B) PAD pas assez étiré vers le bas** : cause = `height:100%` (`h-full`) contre un parent flex-grow NE RÉSOUT PAS dans le WebView Android (marchait en preview desktop, d'où le piège). FIX = remplissage 100 % flexbox : `ScaleToFit` filled → outer **`items-stretch`** (au lieu de `h-full` sur l'inner) ; pad content **`flex-1`** (au lieu de `h-full`). + re-mesure sur **2 frames (rAF)** car le board monte APRÈS le splash → 1ʳᵉ mesure trop tôt → `filled` pas latché → pad non étiré. ⚠️ DURABLE : pour étirer dans le WebView, flexbox pur, jamais `h-full` sur flex-grow.
- **(A) espace milieu pour chip queues** : `justify-between` garde les lanes à leur taille (PAS agrandies), l'espace va dans les gaps → les chips au centre ont de la place.
- **(#1) Aegis ET Anchor cast 2× sur la même main** : VRAIE cause = les sorts à lane se posent via `handleBoardLaneTap` (tap sur la lane) qui faisait `setIntent` direct → CONTOURNAIT toutes les vérifs (cap, 1 carte=1 cast, exclusion aegis/anchor, lock aegis). Le garde `addSpell` du Round 13 ne couvrait QUE le flux main. FIX = `handleBoardLaneTap` route via `addSpell`. ⚠️ DURABLE : les lane-spells passent par le tap-board, pas addSpell direct.
- **(#2) supprimer une carte assignée à une lane** : les chips removables sous la main existaient déjà mais SANS le n° de lane → FIX : chip sort affiche `L{n}` (`ArenaPlanPhase`).
- **(#3) éventail dur à distinguer** : fan-out élargi (angle ×15, X ×16) dans `ArenaBoard` LaneRow.
- Inclut le lot **Animations passifs** (chips Étouffe/Logique/Tranchant).
- Typecheck OK. Fichiers : `match/sharedMatchUI.tsx`, `ArenaBoard.tsx`, `ArenaGame.tsx`, `ArenaPlanPhase.tsx`, `arenaResolverFlow.ts`, `ArenaLaneSlot.tsx`.

### Round 15 🔴 NON COMMITÉ — superseded par Round 16 (itération pad ratée)
- Tentatives pad sur device qui marchaient en preview mais PAS sur le WebView (flex profond non résolu → lanes coupées). Puis calque EXACT du mode Ranked : `ScaleToFit` autour de TOUTE la stage (board + main). Pad OK MAIS **rétrécit aussi la main/deck** (le scale s'applique à tout) → Alex : "touche QUE le pad, dé-serre les moves/deck". Abandonné au profit de Round 16.

### Round 16 ✅ VALIDÉ DEVICE par Alex — build `index-jUIZZstP.js` (attend commit)
- **PAD RÉSOLU** (cf. priorité #1) : composant `BoardFillSlot` (`ArenaGame.tsx`) qui **mesure `clientHeight`** (fiable WebView) → `ArenaBoard` prop `fillHeight` → `minHeight` px sur la racine → pad `flex-1 min-h-0 justify-between` remplit (lanes écartées, espace au centre), **cartes `aspect-[5/4]` intactes**. Filet `transform:scale` si écran trop court (jamais de coupe). **Plan phase (moves+deck) DEHORS du slot → jamais rétrécie.** Vérifié preview 412×915 (scale 1, center_gap 71px, carte 97px) + 412×680 (scale 0.52, no clip). **Alex a validé sur device.**
- Fichiers : `ArenaGame.tsx` (BoardFillSlot + plan phase sortie du wrap + import `useLayoutEffect`/`ReactNode`), `ArenaBoard.tsx` (prop `fillHeight`→minHeight, pad `flex-1 justify-between`).
- **Travail gameplay des Rounds 13-14 toujours présent et non commité** : Aegis/Anchor double-cast fix (lane-tap→`addSpell`), chips passifs Étouffe/Logique ("Provoc annulée") + Tranchant ("🩸 Bouclier percé"), chip lane label `L{n}` (`ArenaPlanPhase`), éventail élargi (`ArenaBoard` LaneRow).
- ⚠️ Dead code : le mode `fill` ajouté au `ScaleToFit` (`sharedMatchUI.tsx`, Rounds 13-14) n'est plus utilisé (l'arène passe par `BoardFillSlot`) → à nettoyer plus tard, inoffensif (Classic/Ranked utilisent `ScaleToFit` sans `fill`).

### Round 17 ✅ NON COMMITÉ — AUDIT LOGIQUE complet du moteur (2026-06-11, à tester device)

Audit systématique arenaRules/arenaCombat/arenaCardEffects/arenaFinishers/arenaAI/arenaResolverFlow vs les contrats écrits (textes de cartes, docs des types, design lockées). **14 correctifs logiques** — AUCUNE retouche au pad (BoardFillSlot intact) ni aux 8 mécaniques Voie Pierre validées :

1. **🔴 BUT D'OR ANNULÉ PAR LES TIMERS** (`arenaResolverFlow`) : le garde du settle ne couvrait que `match-end` → quand l'égalité parfaite déclenchait `sudden-death`, `onAdvanceTurn()` repartait en planning ~3s après (les timers settle courent toujours). La mort subite était ANNULÉE. Jamais vu en live car aucune égalité rencontrée. Garde élargi à `sudden-death`.
2. **TURN_HARD_CAP=30 jamais câblé** (`arenaResolverFlow`) : constante documentée "fail-safe match défensif" mais appliquée nulle part → match infini possible. Câblé au cleanup : T30 résolu sans mort → plus bas HP perd (HP forcé 0) ; HP égaux → BUT D'OR.
3. **FORTERESSE pas permanent** (`arenaFinishers`) : "+2 ATK permanents" (texte carte) via `atkBuff`… remis à 0 chaque fin de tour → durait 1 tour. Passé sur `voieAtkBonus` (persistant, compté par creatureEffectiveAtk).
4. **VERGER Fanaison pas désactivée** (`arenaRules`) : reset one-shot des wiltedSteps, mais `endOfTurnReset` re-fanait dès le tour suivant (le doc des types prétendait le contraire). `endOfTurnReset(c, vergerActive)` skippe le wilt en continu.
5. **LAME ne perçait PAS la Provoc** (`arenaCombat`) : texte carte "perce TOUT (Aegis, Provoc…)" et doc types "findDeflector (skip)" — mais aucun check. Deflect skippé sur les 4 sites (poursuites A/B-wins + 2 branches undefended) + sync anim (`findDeflectorLane`/follow-through dans le flow).
6. **RIPOSTE ignorée sur counter-kill** (`arenaCombat`) : contrat "si elle meurt au combat, son tueur meurt aussi" — seul le mirror l'honorait. Les branches A-wins/B-wins tuent maintenant le tueur (pas de poursuite, kill bonus des 2 côtés, même règle que mutual-kill mirror).
7. **Émoussé appliqué AVANT la poursuite** (`arenaCombat`) : le Ciseau counter-kill poursuivait le héros à 3 au lieu de 4 (blunt prématuré). Poursuite à l'ATK pré-blunt ; le −1 ne vaut que pour les combats suivants.
8. **CALCUL QUANTIQUE injouable** : le −1m n'existait qu'à la résolution — l'UI (intentCost, affordability, chips) et l'IA budgétaient au coût plein → discount jamais dépensable. Nouvelle source unique `arenaSpellCost(hero,id)` (`arenaSpellHelpers`) branchée engine + ArenaGame + ArenaPlanPhase + IA.
9. **Main à 8 cartes** (`arenaRules.drawCards`) : `< 8` codé en dur (résidu cap 10→7) vs HAND_CAP=7 → utilise la constante.
10. **CPU piochait des cartes injouables** (`arenaAI`/`arenaDecks`) : le deck-mirror puisait dans TOUTES les cartes supportées mais `buildSpellTarget` ne gérait que la Phase-1 → cartes mortes en main CPU. Ajout des cibles Phase-2 (gaia/sablier/offre/rempart/bénédiction/cascade/marchand/mascarade/sangsue/trou-noir/paradoxe avec conditions sensées) + pool CPU restreint à `cpuCanPlay` (oracle-inverse/échappée/juge/genèse restent joueur-only).
11. **CPU gaspillait Aegis** (`arenaAI`) : aucune garde lock 1×/match → cast fizzle = carte+mana brûlés. Guards symétriques au joueur (lock + déjà-en-file).
12. **CPU tronqué à 2 sorts TOTAL** (`arenaAI`) : la règle est 2 lane + 1 utility = 3. `truncateIntentByCaps` exportée d'arenaRules, partagée engine/IA (parité exacte). `applySpellPhase` legacy (orphelin, sans caps ni CALCUL) supprimé.
13. **Textes de cartes = mode CLASSÉ en Arena** (UI + i18n) : l'inspect/tooltips affichaient `ranked.cards.*.desc` qui décrivent les effets Classé (ex. Trou Noir "annule la carte adverse ce round" vs effet Arena réel "détruit une créature ciblée"). 31 clés `arena.cards.*.desc` FR+EN (fallback EN pour les 13 autres langues) + `arenaCardDescKey()` branchée dans ArenaCardInspect/ArenaBoard/ArenaHeroStrip. Aussi : peek Oracle Inverse ne tronque plus à 4 cartes (sa plus-value vs Augur = main COMPLÈTE).
14. **Mort subite : résolution dans le render** (`ArenaSuddenDeath`) : les setTimeout d'onResolved/re-spin étaient programmés à chaque render (un re-render parent pendant le reveal = double fire). Passé en `useEffect` avec cleanup. + **Constellation** : resync du compteur sur les Voies vivantes en fin de tour (`endOfTurnCleanup`) — couvre la 3e étoile obtenue via Mirror (avant : unlock seulement au summon suivant) et le champ stale après morts.

Hors périmètre (signalé, pas touché) : doc vs code sur la recharge Provoc par Aegis (roadmap dit "+1 charge", code = recharge-à-1 `max(charges,1)` — comportement validé live conservé, commentaires alignés sur le code) ; Sablier reste plafonné à 8 (le texte Arena le dit maintenant explicitement).

Fichiers : `arenaRules.ts`, `arenaCombat.ts`, `arenaFinishers.ts`, `arenaSpellHelpers.ts`, `arenaPhase2Spells.ts` (comment), `arenaResolverFlow.ts`, `arenaAI.ts`, `arenaDecks.ts`, `arenaTypes.ts`, `ArenaGame.tsx`, `ArenaPlanPhase.tsx`, `ArenaCardInspect.tsx`, `ArenaBoard.tsx` (title only), `ArenaHeroStrip.tsx`, `ArenaSuddenDeath.tsx`, `i18n/locales/fr.ts`, `i18n/locales/en.ts`. Typecheck OK.

---

## TODO restants (priorité décroissante)

### ✅✅ P0 — Pad — RÉSOLU & VALIDÉ DEVICE Round 16 (reste : commit)
- [x] `BoardFillSlot` measured-fill : pad remplit la hauteur dispo, lanes écartées, espace au centre, **cartes intactes**, main NON rétrécie
- [x] Vérifié preview (915 scale 1 / 680 scale 0.52) + **VALIDÉ device par Alex** (`index-jUIZZstP.js`)
- [ ] **COMMIT** les Rounds 12→16 (pad + gameplay) — attend feu vert Alex

### 🟠 P1 — Bugs gameplay observés
- [x] **Aegis double-cast gaspillé** — FIXÉ Round 13 (garde `addSpell` : refuse 2e aegis si déjà en queue OU `board.a.aegisCastThisMatch`). Attend prochain build. (chip task_20ee6566)
- [~] **Supernova CPU fizzle** — investigué Round 13 : `targetOppBestCreature` skippe DÉJÀ anchored/spellImmune (arenaAI.ts:357-359), donc pas de bug code. Fizzle T5 = Anchor même tour du joueur (correct). Optionnel restant : "CPU préfère héros sur supernova" = décision DIFFICULTÉ Alex.

### 🟡 P2 — Features restantes
- [ ] **CPU theme+pad assortis** au pile-ou-face (le CPU choisit une apparence parmi `BG_DEFAULT_THEME` dans `themes.ts`, révélée au coin-flip). Refactor `ArenaPrepScreen` + passer le thème CPU au board.
- [ ] **Surcharge ×2** : 2 copies même carte cast simultané = effet doublé (consume les 2). **Besoin UX decision Alex** (tap-and-hold ? bouton dédié ?) avant de coder.
- [ ] **5 cartes anti-counter** (anti-stalemate, nouveau set) : Brouillard (3m, no counter ce tour), Triade (4m, pose 3 lanes atomique), Aveuglement (5m, opp pose en aveugle), Miroir parfait (5m, copie summon opp), Inversion (4m, swap counter rules). Nouveau set dans `cards.ts` + `rankedTypes.ts` CardId + i18n FR/EN + effets `arenaCardEffects`/`arenaPhase2Spells`.
- [x] **Animations passifs restants** — FAIT Round 13 (code, attend build) : chip Étouffe/Logique = "Provoc annulée" sur la Pierre bypassée (resolver `findAntiTauntBypass` + `setAntiTaunt` → chip `ArenaBoard`), chip Tranchant = "🩸 Bouclier percé" quand une créature meurt bouclier levé (`ArenaLaneSlot` `prev.shield` à la mort). Typecheck OK. (Heuristique pierce : couvre aussi LAME ; un sort tuant une créature bouclier afficherait le chip — cosmétique mineur acceptable.)
- [ ] **Animation cinématique cast Finisher** (overlay grand format slow-mo au cast d'un des 5 Finishers).

### 🟢 P3 — Optionnel / long terme
- [ ] Lot F Matchmaking online (WebSocket queue Pro)
- [ ] Lot G Tournoi Arena (bracket 4/8/16)
- [ ] Persona CPU avec noms+stats
- [ ] Refactor fichiers >400 lignes : `ArenaBoard.tsx` (~600 maintenant), `ArenaLaneSlot.tsx` 534, `ArenaPlanPhase.tsx` 528, `arenaRules.ts` ~540, `arenaTypes.ts` 490, `ArenaGame.tsx` ~450.

---

## Architecture src/arena

```
app/src/arena/
├── ArenaBoard.tsx            ~600 — board layout (strips hors pad ; R16 prop fillHeight→minHeight, pad flex-1 justify-between)
├── ArenaCardInspect.tsx      106 — modal inspect carte
├── ArenaConstellationBar.tsx ~150 — 3⭐ counter + label Voie (Round 9)
├── ArenaDebugOverlay.tsx     156 — panneau logs in-app (🐛 button bottom-right)
├── ArenaGame.tsx             ~490 — orchestrateur + tour loop + sudden-death + BoardFillSlot (measured-fill pad R16)
├── ArenaHeroStrip.tsx        332 — portrait + HP + mana + augur (utilisé 2× hors pad)
├── ArenaHowItWorks.tsx       ~210 — modal règles (Round 11 : section Provoc)
├── ArenaLaneSlot.tsx         534 — single lane slot + chips save
├── ArenaLobby.tsx            304 — lobby (Voie picker)
├── ArenaMatchEnd.tsx         156 — modal fin de match
├── ArenaMatchSplash.tsx      ~120 — splash GO countdown (Round 5 : 1.2s)
├── ArenaPage.tsx              89 — routing
├── ArenaPlanPhase.tsx        528 — phase plan (pad RPSLS + main + CHIP QUEUES)
├── ArenaPrepScreen.tsx       348 — prep pile-ou-face
├── ArenaSuddenDeath.tsx      ~210 — VRAI BUT D'OR (Round 10, NEW)
├── arenaAI.ts                ~370 — CPU decision (Round 9 : 30% random)
├── arenaCardEffects.ts       356 — dispatch effets sorts
├── arenaCombat.ts            ~250 — combat lane (Round 4 extract, Round 10 LAME hook)
├── arenaDecks.ts             ~190 — builders deck + removeSpentCards (log consumed)
├── arenaFinishers.ts         171 — Lot D 5 Finishers
├── arenaLog.ts                83 — buffer logs in-app
├── arenaPhase2Spells.ts      162 — applyArenaSpell cartes V3
├── arenaRules.ts             ~540 — makeHero/applySummons/turn lifecycle/drawCards caps
├── arenaSpellHelpers.ts       56 — helpers
└── arenaTypes.ts             490 — types (dodgeCharges, voieFeuille, wiltSkipNext, finisher flags)
```

---

## Pièges critiques techniques (à NE PAS refaire)

### 🔴 WebView cache + cargo re-embed (cf. PRIORITÉ ABSOLUE #2 en haut)
Le piège qui a fait perdre le plus de temps. `touch lib.rs` + `uninstall complet` + vérifier hash servi.

### 🔴 TDZ bug (Cannot access 'c' before initialization)
Minifier Vite renomme les `const`. Dans `arenaCombat.ts resolveLaneCombat`, helpers `hasAntiTaunt` + `findDeflector` + `consumeProvocation` DOIVENT être déclarés en TOP de fonction. Documenté dans `arenaCombat.ts`.

### 🔴 APK build Tauri Android Windows
`npx tauri android build` échoue au symlink (pas de Developer Mode). Workaround = procédure build fiable ci-dessus.

### 🔴 Fichiers `.md` racine repo
CARTES-NOUVELLES.md / PROMPTS-ICONES.md / IDEES-LOOT.md untracked → `rm` = perte définitive.

### 🔴 storeMigrationGuard.ts
Contient des NUL/control bytes → utiliser Edit (préserve NULs), pas sed.

---

## Décisions design lockées

### Caps & limites
- HAND_CAP = 7, STARTING_HAND_SIZE = 5, MAX_SUMMONS_PER_TURN = 3
- MAX_SPELLS_PER_TURN = 2 (lane) + 1 (utility) = 3 max
- MANA_CAP = 8
- Caps rareté main : common 3 / rare 2 / epic 1 / legendary 1

### Combat RPSLS one-shot
- Counter A-wins/B-wins = loser dies INSTANTLY (peu importe ATK/HP)
- Saves : Aegis (divineShield), Esquive (dodgeCharges, décrémenté)
- Tranchant Ciseau PIERCE Aegis ; LAME Finisher PIERCE TOUT
- Pursuit hero après kill counter (sauf deflect Provoc Pierre)
- Mirror (même symbole) = trade ATK vs HP

### Provocation Pierre (cf. Voie Pierre validée)
- Deflect 1 attaque undefended/charge ; Voie Pierre = 2 charges
- Anti-taunt : opp Feuille (Étouffe) OU Spock (Logique) cancel
- Aegis cast sur Pierre = +1 charge

### Finishers (injectés à 3⭐, 1×/match, cost 4)
- FORTERESSE (Pierre) : 🛡 + ATK+2 sur Pierres présentes
- VERGER (Feuille) : heal hero +1/tour
- LAME (Ciseau) : Tranchant pierce TOUT
- MÉTAMORPHOSE (Lézard) : dodge refresh/tour
- CALCUL (Spock) : sorts cost −1

---

## Workflow validé Alex (IMPÉRATIF)

- Cycle : code → `pnpm -C app exec tsc --noEmit` → build APK (procédure fiable) → **VÉRIFIER HASH SERVI** → install → "à tester, PAS de commit/push" → attendre Alex
- Si OK device : commit + push. Sinon fix sans toucher git.
- **NE JAMAIS demander à Alex de tester sans avoir vérifié le hash servi dans les logs.**
- Logs in-app via 🐛 button + `[arena:*]` (hand/deck/discard/mana/consumed cards à chaque snapshot)
- Commits français avec sections claires, i18n EN+FR obligatoire
- Surveiller les parties en live via `adb logcat -s "Tauri/Console:*" | grep "arena:"` (outil Monitor persistent)

## Règles code
SOLID / DRY / KISS / <400 lignes par fichier (6 fichiers en dépassement à splitter) / pas d'orphelins / pas de console.log sans fallback.
