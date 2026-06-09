# Constellation Pro — Roadmap & État Complet

> **Dernière mise à jour : 2026-06-09 (Round 6 build)**
> Document actualisé à chaque session. Source de vérité unique pour reprendre le travail.

## Pour un nouvel agent qui reprend

### Le mode "Constellation Pro" en 1 paragraphe
RPSLS Arena = mode CCG dans le jeu RPSLS, calqué sur le mode Ranked existant. Le joueur a 3 lanes (L0/L1/L2), invoque des créatures RPSLS (Pierre/Feuille/Ciseau/Lézard/Spock) chaque tour, cast des sorts (Aegis/Précision/Heist/Supernova/...). Combat lane-par-lane avec mécaniques counter RPSLS classiques + passifs (Provocation, Étouffe, Logique, Tranchant, Esquive). Une "Voie d'Affinité" lock un symbole favori qui donne un bonus passif sur ses créatures. À 3 créatures de la Voie vivantes simultanément = unlock un Finisher 1×/match (sort spécial overpowered).

### Architecture src/arena (état Round 6)
```
app/src/arena/
├── ArenaBoard.tsx            580 lignes — board layout 2 lanes rows + center status
├── ArenaCardInspect.tsx      106 lignes — modal inspect carte tap-and-hold
├── ArenaConstellationBar.tsx 138 lignes — 3⭐ counter par hero avec glow progression
├── ArenaDebugOverlay.tsx     156 lignes — panneau logs in-app (bug 🐛 button)
├── ArenaGame.tsx             427 lignes — orchestrateur top-level state + tour loop
├── ArenaHeroStrip.tsx        332 lignes — portrait + HP + mana + augur
├── ArenaHowItWorks.tsx       196 lignes — modal règles RPSLS Pro
├── ArenaLaneSlot.tsx         534 lignes — single lane slot (creature + chips)
├── ArenaLobby.tsx            304 lignes — lobby avant match (Voie picker + How It Works)
├── ArenaMatchEnd.tsx         156 lignes — modal fin de match (victoire/défaite/égalité)
├── ArenaMatchSplash.tsx      115 lignes — splash écran avant match (GO countdown)
├── ArenaPage.tsx              89 lignes — routing lobby/prep/game/deck
├── ArenaPlanPhase.tsx        528 lignes — phase planification (pad RPSLS + main cartes)
├── ArenaPrepScreen.tsx       348 lignes — écran prep pile-ou-face avant match
├── arenaAI.ts                363 lignes — CPU decision pickBestMove
├── arenaCardEffects.ts       356 lignes — dispatch effets sorts (applySpell)
├── arenaCombat.ts            239 lignes — résolution combat lane (NEW round 4)
├── arenaDecks.ts             176 lignes — builder decks player+CPU mirror
├── arenaFinishers.ts         171 lignes — Lot D 5 Finishers
├── arenaLog.ts                83 lignes — buffer logs in-app + console fallback
├── arenaPhase2Spells.ts      162 lignes — applyArenaSpell pour les 30+ cartes V3
├── arenaResolverFlow.ts      260 lignes — flow phase reveal/spells/summons/combat/settle
├── arenaRules.ts             516 lignes — makeHero/applySummons/turn lifecycle
├── arenaSpellHelpers.ts       56 lignes — helpers getMyCreatureOnLane etc.
└── arenaTypes.ts             490 lignes — tous les types BoardState/HeroState/Creature
```

### Pièges critiques (à ne pas refaire)

#### 🔴 TDZ bug (Cannot access 'c' before initialization)
Le minifier Vite renomme les `const` en variables courtes. Dans `resolveLaneCombat`, les helpers `hasAntiTaunt` + `findDeflector` + `consumeProvocation` DOIVENT être déclarés en TOP de la fonction. Si après les counter branches, le minifier les renomme `c`, et l'appel depuis A-wins/B-wins fait TDZ throw silencieux → cascade qui bloque tous les combats des lanes suivantes. Documenté dans `arenaCombat.ts:69-79`.

#### 🔴 APK build Tauri Android sur Windows
Le `npx tauri android build` échoue au DERNIER pas avec "Creation symbolic link is not allowed" (pas de Developer Mode). MAIS le `.so` est compilé à `target/aarch64-linux-android/debug/libapp_lib.so`. **Procédure manuelle** :
1. `$env:ANDROID_NDK_ROOT=$env:NDK_HOME; npx tauri android build --debug --apk --target aarch64` (échoue mais .so compilé)
2. **COPIER** `.so` vers `app/src-tauri/gen/android/app/src/main/jniLibs/arm64-v8a/libapp_lib.so` (PowerShell `Copy-Item`, vérifier que la cmdline a bien Path remplis !)
3. `gradlew assembleArm64Debug -x rustBuildArm64Debug` (package only)
4. `adb uninstall`+`adb install`
5. `adb shell am force-stop com.alex.rpsls`+`am start`

⚠️ Si copy step 2 échoue silencieusement, APK packagée sans `.so` → CRASH `dlopen failed: library libapp_lib.so not found` au lancement.

#### 🔴 Tauri WebView frontend in .so
Le frontend dist est EMBARQUÉ dans `libapp_lib.so` (compressé brotli). Le workflow "copier dist→assets + gradle" ne met pas à jour le frontend servi — il faut rebuild le `.so` Rust.

#### 🔴 Fichiers `.md` racine repo
CARTES-NOUVELLES.md / PROMPTS-ICONES.md / IDEES-LOOT.md sont **untracked** → un `rm` = perte définitive. ATTENTION aux commandes destructives sur untracked.

## État global Lots

| Lot | Description | Statut |
|-----|-------------|--------|
| A | Stabilisation UI (calque Ranked) | ✅ DONE |
| B | Affinité 5 Voies RPSLS | 🟡 PARTIEL (3/5 voies câblées) |
| C | Constellation 3⭐ simultanée | ✅ DONE + validé device |
| D | 5 Finishers (FORTERESSE/VERGER/LAME/MÉTAMORPHOSE/CALCUL) | ✅ DONE MVP (effets fonctionnels, hooks runtime D-bis Round 7) |
| E | Lobby Pro (calque RankedLobby) | ✅ DONE |
| F | Matchmaking online | 🟢 PENDING (optionnel) |
| G | Tournoi Arena | 🟢 PENDING (optionnel) |
| H | Polish UX feedback Alex | 🟡 EN COURS (Round 5/6 done, restants Round 7+) |

## Lot A — Stabilisation UI ✅

- Bouton retour + ConfirmModal forfait + wire arenaStats
- Mini-barre HP animée par créature (vert/ambre/rose)
- Chips ABSORBÉ + ESQUIVÉ (Aegis/dodge save)
- Pad stable (overlay Augur en absolute)
- Pulse glow bouton FIN DE TOUR
- Augur opp ne déforme plus mon HUD (mini-chip discret)
- Replace lane occupée ("↻ Remplacer")
- Snapshots board log à chaque tour
- Logs Hand/Deck/Discard/Mana à chaque snapshot (analyse CCG post-mortem)

## Lot B — Affinité 5 Voies RPSLS 🟡

### Câblé (3/5)
- 🪨 **Pierre Voie** : Provocation **2 charges** initiales (au lieu de 1) — validé `P2L` visible
- ✂️ **Ciseau Voie** : HP **2** au lieu de 1 (survit à un échange)
- 🖖 **Spock Voie** : ATK **3 perm** (`voieAtkBonus = +1`)

### À câbler (2/5) — TODO Round 8
- 📄 **Feuille Voie** : Fanaison **ralentie** (−1 ATK tous les **2** tours au lieu de chaque tour) — nécessite refactor `wiltedSteps`
- 🦎 **Lézard Voie** : Esquive **2 charges** (au lieu de 1) — nécessite refactor `dodgeCharge: boolean` → `dodgeCharges: number`

## Lot C — Constellation 3⭐ ✅ DONE

### Mécanique simultanée (vs cumulé, Alex feedback round 2)
- `HeroState.constellationCount = nb créatures Voie VIVANTES sur board`
- `countAliveAffinity(lanes, side, affinity)` helper dans arenaRules
- ArenaHeroStrip recompute live à chaque render depuis `board.lanes`
- `finisherUnlocked` flag set au 1er passage 3/3 → carte Finisher injectée 1× dans la main
- `ArenaConstellationBar.tsx` (138L) — 3 étoiles colorées par Voie, glow progressif 1⭐→2⭐→3⭐+pulse, label "FINISHER ✦" amber permanent au unlock

### Logs validés device
```
T0 a pose rock L0 affinity=rock
T0 a constellation ⭐ 1/3
T2 a pose rock L1 affinity=rock
T2 a constellation ⭐ 2/3
T2 a pose rock L2 affinity=rock
T2 a constellation ⭐ 3/3 → FINISHER UNLOCKED
T2 a → carte Finisher [finisher-forteresse] injectée en main
```

## Lot D — 5 Finishers ✅ DONE MVP

### Spécs câblées (arenaFinishers.ts)
| Voie | Finisher | Effet implémenté |
|------|----------|------------------|
| 🪨 Pierre | **finisher-forteresse** | Mes Pierres existantes prennent 🛡 + ATK +2 perm |
| 📄 Feuille | **finisher-verger** | Mes Feuilles wiltedSteps=0 + flag vergerActive (hook heal/tour Lot D-bis) |
| ✂️ Ciseau | **finisher-lame** | Flag lameActive (hook combat pierce all = Lot D-bis) |
| 🦎 Lézard | **finisher-metamorphose** | Mes Lézard dodgeCharge=true immédiat + flag (cycle refresh Lot D-bis) |
| 🖖 Spock | **finisher-calcul** | Flag calculActive — `applyAllSpells` cost−1 ✅ |

### Mécaniques
- Cost 4m, priority 60 (early dans spell phase)
- Injection auto à 3⭐ Constellation (dans `arenaRules.applySummons`)
- 1× par match (`finisherUsed` flag)
- Exclus du deck builder (`isDeckable()` retourne false pour `isFinisherCard()`)
- CPU mirror raretés exclu les Finishers (pas drawables)
- i18n EN+FR

### Lot D-bis pending (Round 7)
- Hook `resolveLaneCombat` pour LAME (Tranchant pierce TOUT save/deflect)
- Hook `endOfTurnReset` pour VERGER (heal hero +1/tour si vergerActive)
- Hook `endOfTurnReset` pour MÉTAMORPHOSE (dodge refresh sur tous Lézard si metamorphoseActive)
- Animation cinématique cast Finisher (overlay grand format slow-mo)

## Lot E — Lobby Pro ✅

- Calque RankedLobby
- Profil + stats arena
- DeckManager filtré par `isDeckable()` (no Finishers, no unsupported)
- How It Works modal règles RPSLS Pro
- Sélecteur Voie d'Affinité (5 boutons) + bonus visuel
- ENTRAÎNEMENT vs CPU

## Round 1-6 fixes Alex feedback ✅

### Round 1 — TDZ bug critique
- Bug "Cannot access 'c' before initialization" qui bloquait counter A-wins/B-wins kill
- Fix : `hasAntiTaunt` + `findDeflector` + `consumeProvocation` déclarés en TOP de `resolveLaneCombat`
- Validé : tous les counter kill firement correctement avec deflectCheck visible

### Round 2 — 6 fixes UX
- Constellation simultanée (vs cumulé) — countAliveAffinity live recompute
- But d'or partiel : combat 3 lanes joue toujours (plus de early-exit interim)
- Aegis + Anchor mutual exclusion par lane (option A — force choix défense)
- Aegis LOCK badge si déjà cast 1×/match (grayscale + 🔒)
- Pad agrandi (+ comble vide)
- Bouton logs top-right (libère boutons Android)

### Round 3 — 4 fixes ressenti
- Layout opp strip dans top header (HORS du board pad)
- MAX_SPELLS exemption sorts hero/self (Second Wind avec Anchor OK)
- Heal popup vert "+N" (symétrique au damage "−N")
- Banner Supernova lane distinct du hero (`SUPERNOVA L<n> → 6 dmg creature opp`)

### Round 4 — refactor qualité + pad/constellation
- Refactor `arenaRules.ts` 715→516 lignes (combat extrait dans `arenaCombat.ts` 239L)
- Pad un peu plus grand (gap-4/sm:gap-5)
- Constellation indicator 2× plus grand (étoiles 14/15/17px au lieu de 11/12/14)

### Round 5 — 3 fixes critiques
- #4 BUG carte multi-cast : addSpell check `usageCount >= handCount` (1 carte main = 1 cast max)
- #6 Match-end delay 200ms→1600ms (laisse respirer)
- #7 GO countdown 0.45s→1.2s + scale plus dramatique
- Filet MAX_SPELLS aligné UI : truncateByCaps (max 2 lane + 1 utility = 3 sorts max/tour)

### Round 6 — #5 Esquive sticker stuck
- Guard explicite : `!creature || creature.move !== prev.move` → clear immédiat des chips save
- Sticker plus jamais stale après mort/replace
- BUG résolu : copy `.so` PowerShell foiré silencieusement → crash dlopen — fixé en relançant copy proprement

## TODO restants (par round prévu)

### Round 7 — Lot D-bis + polish UX restant
- [ ] **Caps par rareté** : common 3, rare 2, epic 1, legendary 1 (max copies en main + max copies en deck)
- [ ] **Surcharge ×2** : 2 copies même carte cast simultané = effet doublé (consume les 2)
  - Précision +4 ATK au lieu +2
  - Second Wind +8 heal au lieu +4
  - Anchor 2 tours au lieu 1
  - Heist 6 dmg au lieu 3
  - Surge +4 ATK au lieu +2
- [ ] **Pioche option A** (replace) : si cap dépassé à la pioche, retry une autre carte du deck
- [ ] **#3 Eventail multi-cartes par lane** : refactor sticker render dans ArenaLaneSlot pour stack en éventail (rotation −10°/0°/+10° + offset X) au lieu de stack
- [ ] **#1 Tooltip mécanique Provoc/anti-taunt** : tap-and-hold sur Pierre → modal explicatif (Provoc = deflect 1 attaque, cancelled by opp Feuille/Spock anti-taunt)
- [ ] **#2 Bouton logs** : design final taille+position définitive (peut-être hide/show via long-press)
- [ ] Hook LAME (Tranchant pierce all) dans `resolveLaneCombat`
- [ ] Hook VERGER (heal +1/tour) dans `endOfTurnReset`
- [ ] Hook MÉTAMORPHOSE (dodge refresh) dans `endOfTurnReset`

### Round 8 — Lot B complet + CPU apparence
- [ ] **Voie Feuille bonus** : Fanaison ralentie (−1 ATK tous les 2 tours)
  - Refactor `wiltedSteps`: incrémenter tous les 2 tours pour les Feuilles Voie
  - Champ `vergerVoieActive` ou modifier la formule dans `creatureEffectiveAtk`
- [ ] **Voie Lézard bonus** : Esquive 2 charges
  - Refactor `dodgeCharge: boolean` → `dodgeCharges: number` partout dans arenaTypes
  - Update `damageCreature` + `damageCreaturePierce` pour décrémenter
  - Update `ESQUIVE save` log avec "charge X/2"
- [ ] **CPU theme+pad assortis** au pile-ou-face
  - Le CPU choisit une apparence parmi le pool `BG_DEFAULT_THEME`
  - Au reveal pile-ou-face, winner impose son assemblage visible à l'autre
  - Reuse `BG_DEFAULT_THEME` mapping fond→palette
- [ ] Animations passifs restants chips (Étouffe Feuille, Logique Spock, Tranchant explicit Ciseau)

### Round 9 — VRAI BUT D'OR + Voie adverse + cartes anti-counter
- [ ] **VRAI BUT D'OR / Mort subite RPSLS** : si vraiment égalité absolue après les 3 lanes (a≤0 ET b≤0)
  - Phase tie-break dédiée
  - 1 lane unique "Arène d'Or" (animation gold pulse permanente)
  - Chaque joueur pose UN symbole RPSLS aveugle (pas de cartes)
  - Reveal cinématique slow-mo
  - Winner gagne. Mirror → re-spin avec shuffle visible
  - Animation HD avec fanfare audio
- [ ] **Voie adverse visible** : sur strip opp, afficher icône Affinité + label "Voie de X" (info justice gameplay — savoir quel Finisher anticiper)
- [ ] **Cartes anti-counter** (anti-stalemate)
  - **Brouillard** (3m) : aucun counter ce tour, toute confrontation = mutual trade ATK vs HP
  - **Triade** (4m) : pose tes 3 lanes en atomique (opp ne voit rien jusqu'au reveal)
  - **Aveuglement** (5m) : opp pose ses summons EN AVEUGLE (cache ton intent)
  - **Miroir parfait** (5m) : copie EXACTEMENT le summon de l'opp dans tes lanes vides
  - **Inversion** (4m) : swap les counter rules ce tour
- [ ] **Cartes nouveau** (à designer Round 9)
  - **Dispel** (2m) : retire shields + Provoc charges d'une créature opp
  - **Banish** (5m) : détruit créature, ignore shields
- [ ] Animations cinématiques cast Finisher (Lot D-bis polish)

### Round 10+ — optionnel
- [ ] Lot F Matchmaking online (WebSocket queue Pro)
- [ ] Lot G Tournoi Arena (bracket 4/8/16)
- [ ] Persona CPU avec noms+stats personnalisés
- [ ] Saisons & récompenses cosmétiques Pro

## Décisions design lockées

### Caps & limites
- HAND_CAP = 7 (réduit de 10 sur flag Alex)
- STARTING_HAND_SIZE = 5
- MAX_SUMMONS_PER_TURN = 3 (passé de 2)
- MAX_SPELLS_PER_TURN = 2 (lane-target) + 1 (utility) = 3 max total
- MANA_CAP = 8

### Mécaniques counter RPSLS one-shot
- Counter A-wins ou B-wins = creature loser dies INSTANTLY (peu importe ATK/HP)
- Saves : Aegis (divineShield) + Esquive (dodgeCharge)
- Tranchant Ciseau PIERCE Aegis (counter scissors>paper bypass shield)
- Pursuit hero après kill via counter (creature winner attack opp hero)
- Mirror match (même symbole) = trade ATK normal vs HP

### Provocation Pierre
- Pierre avec charges Provoc = deflect 1 attaque undefended sur hero
- Consume 1 charge par deflect
- **Anti-taunt** : opp Feuille (Étouffe) ou opp Spock (Logique) sur board = CANCEL ma Provoc
- Voie Pierre = 2 charges initiales (au lieu de 1)
- Aegis cast sur Pierre = refill 1 charge bonus

### Spock spell immunité
- Mes Spock sont immune aux sorts opp (Curse, Trou-Noir, etc.)
- Pas immune à Heist/Supernova hero (target hero, pas creature)

### Combat order
- Spell phase (priority asc) → Summon phase → Combat L0 → L1 → L2 → endOfTurnCleanup
- Combat continue les 3 lanes même si match-end interim (round 2 fix)
- Tie-break Mort subite RPSLS si vraiment égalité absolue (Round 9 TODO)

## Workflow validé Alex

- Cycle : code → typecheck → build APK → install + force-stop + start → "à tester, PAS de commit/push" → attendre Alex
- Si OK : commit+push, sinon fix sans toucher git
- Logs in-app via 🐛 button (top-right) + `[arena:*]` log mains/decks/discard/mana à chaque snapshot pour analyse CCG post-mortem
- Confirmer avant push si Alex demande
- Commits français avec sections claires
- i18n EN+FR obligatoire pour user-facing
- Typecheck obligatoire avant commit

## Règles code

- **SOLID** : single responsibility par fichier
- **DRY** : pas de duplication, helpers réutilisables (ex: AFFINITY_TO_FINISHER unique)
- **KISS** : code simple, pas d'over-engineering
- **<400 lignes par fichier** ceiling (6 fichiers actuellement >400 — à splitter)
- **Pas d'orphelins** : tout fichier créé doit être référencé / importé
- **Pas de console.log** sans fallback (sauf debug deliberate)
