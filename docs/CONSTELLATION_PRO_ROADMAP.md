# Constellation Pro — Roadmap & État Complet

> **Dernière mise à jour : 2026-06-10 (Round 12 — layout strips + WebView cache fix)**
> Document actualisé à chaque session. Source de vérité unique pour reprendre le travail.
> Branche : `constellation-pro`. Dernier commit poussé : `c589dc8` (Round 11.5). Round 12 (layout) NON commité (attend validation Alex).

---

## 🔴🔴 PRIORITÉ ABSOLUE POUR LE PROCHAIN AGENT 🔴🔴

### 1. LE PAD DE JEU DOIT ÊTRE **AGRANDI**, PAS RÉTRÉCI

**Alex a demandé À PLUSIEURS REPRISES (rounds 9, 11, 11.5, 12) d'AGRANDIR le pad de jeu des lanes (plus large ET plus haut).** L'agent précédent a fait l'INVERSE — le pad paraît rétréci / écrasé. C'est la frustration #1 d'Alex.

**Contrainte exacte d'Alex** : pad plus large + plus haut, MAIS la hauteur ne doit **PAS empiéter sur la zone des "chip queues"** (les chips au-dessus de la ligne de mains jouables, dans `ArenaPlanPhase`).

**Ce qui a été tenté (et a échoué à satisfaire Alex)** :
- `ArenaBoard.tsx` : padding `px-5 py-6 sm:px-6 sm:py-7`, `gap-5 sm:gap-6`, `min-h-[440px] sm:min-h-[520px]`, `justify-between`
- Round 12 : sorti les 2 hero strips HORS du pad (opp en haut, player en bas) pour libérer de l'espace board — **PAS ENCORE VALIDÉ par Alex sur le bon build** (cf. piège WebView ci-dessous).

**Hypothèse de pourquoi ça paraît petit** : il y a un `ScaleToFit` (`app/src/match/sharedMatchUI.tsx`) qui SCALE tout le board pour tenir dans l'écran. Si le contenu total (board + strips + main) dépasse, le ScaleToFit réduit le tout → le pad paraît petit. **Piste à creuser** : augmenter le pad SANS augmenter le contenu hors-pad, ou ajuster le ScaleToFit pour donner plus de place au board et moins aux marges. Mesurer les hauteurs réelles avec WebView DevTools (Runtime.evaluate sur `getBoundingClientRect`).

**Le board (pad) est rendu dans** : `ArenaBoard.tsx` → wrapper externe flex-col (Round 12) contenant : [opp strip] + [div pad avec BattlePad backdrop, lanes + center] + [player strip]. Le `ArenaBoard` est lui-même wrappé par `ScaleToFit` dans `ArenaGame.tsx`.

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

---

## TODO restants (priorité décroissante)

### 🔴 P0 — Pad agrandi (cf. priorité absolue en haut)
- [ ] Retravailler le pad pour qu'il soit VRAIMENT plus grand visuellement (mesurer via DevTools, ajuster ScaleToFit si besoin)
- [ ] Valider sur le bon build (vérifier hash servi)

### 🟠 P1 — Bugs gameplay observés
- [ ] **Aegis double-cast gaspillé** : le joueur peut cast 2 Aegis le même tour, le 2e FIZZLE (lock 1×/match) mais est consommé quand même → carte perdue. Fix dans `ArenaGame.addSpell` : refuser un 2e aegis si déjà 1 dans l'intent ce tour OU `aegisCastThisMatch`. (chip task_20ee6566 spawné) Généraliser aux autres sorts lock/1×.
- [ ] **Supernova CPU fizzle** : observé `T5 b SUPERNOVA L1 fizzle (cible invalide ou anchored)` — le CPU gaspille son burst 6 dmg (ciblage AI Supernova lane buggé ?). Affecte l'équilibre (CPU trop faible). Investiguer `arenaAI.buildSpellTarget` pour supernova + `applySupernova`.

### 🟡 P2 — Features restantes
- [ ] **CPU theme+pad assortis** au pile-ou-face (le CPU choisit une apparence parmi `BG_DEFAULT_THEME` dans `themes.ts`, révélée au coin-flip). Refactor `ArenaPrepScreen` + passer le thème CPU au board.
- [ ] **Surcharge ×2** : 2 copies même carte cast simultané = effet doublé (consume les 2). **Besoin UX decision Alex** (tap-and-hold ? bouton dédié ?) avant de coder.
- [ ] **5 cartes anti-counter** (anti-stalemate, nouveau set) : Brouillard (3m, no counter ce tour), Triade (4m, pose 3 lanes atomique), Aveuglement (5m, opp pose en aveugle), Miroir parfait (5m, copie summon opp), Inversion (4m, swap counter rules). Nouveau set dans `cards.ts` + `rankedTypes.ts` CardId + i18n FR/EN + effets `arenaCardEffects`/`arenaPhase2Spells`.
- [ ] **Animations passifs restants** : chip Étouffe (Feuille), chip Logique (Spock), chip Tranchant explicite (Ciseau) — actuellement seuls Aegis/Esquive ont des chips save.
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
├── ArenaBoard.tsx            ~600 — board layout (Round 12 : strips sortis du pad)
├── ArenaCardInspect.tsx      106 — modal inspect carte
├── ArenaConstellationBar.tsx ~150 — 3⭐ counter + label Voie (Round 9)
├── ArenaDebugOverlay.tsx     156 — panneau logs in-app (🐛 button bottom-right)
├── ArenaGame.tsx             ~450 — orchestrateur state + tour loop + sudden-death route
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
