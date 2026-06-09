# Constellation Pro — Build Plan (MVP)

**Branche :** `constellation-pro` (off `develop` à `f0e5729`)
**Started :** 2026-06-08
**Statut :** en construction

Living doc — coché au fur et à mesure. Quand toutes les cases sont cochées, le MVP est jouable vs CPU.

---

## 📌 Instructions Alex (verrouillées via AskUserQuestion)

> Toutes les décisions design valident avant de poser une ligne de code.

1. **Format match** — Standard : HP héros 20, mana cap 10, cible 10-15 min.
2. **Modèle de tour** — **Simultané** (RPSLS-style) : les deux joueurs planifient en parallèle, lock, le resolver fire.
3. **Types de cartes** — **Créatures + sorts** : les 5 coups RPSLS deviennent des créatures persistantes avec ATK/HP ; les 46 cartes existantes (registry `ranked/cards.ts`) deviennent des sorts.
4. **Timing** — Démarrage immédiat, branche séparée, MVP en 2-3 sessions.
5. **Reuse** — réutiliser tous les assets/registries du Constellation Ranked (thèmes, goodies, cards). Aucune duplication de registry / d'art / de thème.
6. **Pas de regression** sur Ranked actuel : le mode séparé doit cohabiter sans toucher au code existant.

---

## 🧱 Fondation (session #1, déjà fait — commit `XXXXXXX`)

- [x] `docs/CONSTELLATION_PRO_DESIGN.md` — design lock (HP/mana/cartes/combat/spell list)
- [x] `app/src/arena/arenaTypes.ts` — types pure : HeroState, Creature, LaneState, BoardState, TurnIntent, PlayedSpell, PlannedSummon. CREATURE_STATS + moveCountersMove.
- [x] `app/src/arena/arenaRules.ts` — resolveTurn() + combat + advanceToNextTurn().
- [x] `app/src/arena/arenaCardEffects.ts` — 15 sorts adaptés avec table de priorités.

**tsc clean. 0 UI encore.**

---

## 🎯 MVP construction (session courante — to do)

### Étape 1 — CPU AI (`arena/arenaAI.ts`)

- [ ] Algorithme greedy basique
- [ ] Prend en input : `BoardState`, `side: "b"` (CPU côté b)
- [ ] Retourne `TurnIntent` (spells + summons)
- [ ] Logique :
  1. Évalue mana disponible
  2. Summon sur les lanes vides en priorité (si mana restante ≥ 1)
  3. Si menacé (mes créatures HP bas) → joue sorts défensifs (Aegis, Second-wind, Anchor)
  4. Si lane gagnante évidente → joue Surge/Tide pour pousser dmg
  5. Si héros adv à HP bas → joue sorts offensifs (Heist, Supernova)
- [ ] Difficulty respecté (easy/normal/hard via store.player.difficulty)

### Étape 2 — Game orchestrator (`arena/ArenaGame.tsx`)

- [ ] State : `board: BoardState`, intent du joueur courant
- [ ] Lifecycle : mount → init board → planning phase → lock → CPU decision → resolveTurn → next turn (loop) → match-end
- [ ] Handlers : `onAddSpell`, `onAddSummon`, `onRemoveSpell`, `onRemoveSummon`, `onLockTurn`
- [ ] Match end : record stats (player.arenaStats) + return to menu

### Étape 3 — Board UI (`arena/ArenaBoard.tsx`)

- [ ] Layout vertical : 
  ```
  ┌─ Adv portrait + HP + mana ─┐
  │     ✦ Adv hand size        │
  │  [lane 1] [lane 2] [lane 3]│  ← créatures côté Adv
  │  [lane 1] [lane 2] [lane 3]│  ← créatures côté Toi
  │      ✦ Ta hand fanout      │
  └─ Ton portrait + HP + mana ─┘
  ```
- [ ] Créatures affichées : sprite RPSLS + barre HP + chip ATK
- [ ] Buff indicators : +N ATK chip si atkBuff > 0, halo divine shield, ancre si anchored, lame si riposte
- [ ] Réutilise `BattlePad` en backdrop, `MoveGlyph` pour les sprites

### Étape 4 — Plan phase UI (`arena/ArenaPlanPhase.tsx`)

- [ ] Main du joueur en fanout (réutilise pattern `CardHand`)
- [ ] 5 boutons RPSLS pour summon
- [ ] Targeting : tap carte sort → tap cible (lane/héros/global)
- [ ] Tap RPSLS → tap lane pour summon
- [ ] Affiche les intents pending (sorts queued + summons planifiés) avant lock
- [ ] Bouton "Fin de tour" (lock)

### Étape 5 — Page entry (`arena/ArenaPage.tsx`)

- [ ] Wrap `ArenaGame` avec match found splash + return-to-menu callback
- [ ] Récupère le deck du joueur depuis store (réutilise `player.rankedDeck`)

### Étape 6 — Menu wiring (`PlayPage`)

- [ ] Nouveau bouton "Constellation Pro" 
- [ ] Route vers `ArenaPage`
- [ ] Icon distinctif (différencier du Ranked)

### Étape 7 — i18n EN+FR

- [ ] `arena.title` / `arena.tagline` / `arena.matchFound`
- [ ] `arena.lockTurn` / `arena.endTurn` / `arena.yourTurn` / `arena.cpuTurn`
- [ ] `arena.heroHp` / `arena.summon` / `arena.deckEmpty`
- [ ] `arena.matchWin` / `arena.matchLoss` / `arena.matchDraw`
- [ ] Hint : "Réduisez les PV de l'adversaire à 0"
- [ ] Hint summon : "Touchez un coup puis une lane pour invoquer"
- [ ] Hint sort : "Touchez une carte puis une cible"

### Étape 8 — Store updates

- [ ] `player.arenaStats: { wins, losses, draws }` (optionnel pour MVP, peut commencer à 0)
- [ ] `applyServerSync` accepte le champ pour la sync cloud (Phase 3)

### Étape 9 — Build + device

- [ ] `pnpm exec tsc --noEmit` → clean
- [ ] `npx tauri android build --debug --apk --target aarch64` → .so produit
- [ ] Copy .so → jniLibs
- [ ] `gradlew assembleArm64Debug -x rustBuildArm64Debug` → APK packagé
- [ ] `adb install -r` + `am force-stop` + `am start`
- [ ] Vérifier : Arena lance depuis menu, board s'affiche, un tour se résoud sans crash

---

## 🚦 Définition de "MVP done"

✅ Quand on peut :
1. Cliquer "Constellation Pro" depuis le menu
2. Voir le board avec 2 héros (HP 20) et 3 lanes vides
3. Pendant le tour 1 : avoir 1 mana, pouvoir summon 1 créature sur 1 lane (le joueur)
4. Lock → CPU summon de son côté → resolver fire → combat → HP héros décrémenté si lane libre
5. Tour 2 : mana = 2, drawn 1 card, replay
6. Jusqu'à HP 0 d'un côté → écran match-end → retour menu

❌ **Pas MVP** :
- Animations de combat avancées (Phase 2)
- 30 cartes restantes adaptées (Phase 2)
- Cartes Arena-only (Phase 3)
- Online multi (Phase 3)
- Récompenses éclats/mastery (Phase 2)

---

## 📂 Fichiers touchés / créés

### Créés (session #1 + #2)
- `docs/CONSTELLATION_PRO_DESIGN.md`
- `docs/CONSTELLATION_PRO_BUILD_PLAN.md` ← ce fichier
- `app/src/arena/arenaTypes.ts`
- `app/src/arena/arenaRules.ts`
- `app/src/arena/arenaCardEffects.ts`
- `app/src/arena/arenaAI.ts` (à créer)
- `app/src/arena/ArenaGame.tsx` (à créer)
- `app/src/arena/ArenaBoard.tsx` (à créer)
- `app/src/arena/ArenaPlanPhase.tsx` (à créer)
- `app/src/arena/ArenaPage.tsx` (à créer)

### Modifiés
- `app/src/pages/PlayPage.tsx` (ajouter bouton)
- `app/src/i18n/locales/en.ts` (+ keys arena)
- `app/src/i18n/locales/fr.ts` (+ keys arena)
- `app/src/store/store.ts` (optionnel : arenaStats)
- `app/src/types.ts` (optionnel : ArenaStats)

### NON touchés (zéro régression)
- Tout `app/src/ranked/` (Ranked existant intact)
- `crates/rpsls-server/` (pas de back-end change pour MVP)
- `app/src/online/` (pas de online Arena pour MVP)

---

## 🔧 Procédure build Tauri Android (rappel)

```powershell
cd "C:\Users\34643\Desktop\RPSLS\app"
$env:ANDROID_NDK_ROOT = $env:NDK_HOME
npx tauri android build --debug --apk --target aarch64
# Fail attendu au symlink (Windows sans Dev Mode) — le .so est compilé OK

# Copy .so
Copy-Item "C:\Users\34643\Desktop\RPSLS\target\aarch64-linux-android\debug\libapp_lib.so" `
  "C:\Users\34643\Desktop\RPSLS\app\src-tauri\gen\android\app\src\main\jniLibs\arm64-v8a\libapp_lib.so"

# Gradle package
cd src-tauri\gen\android
.\gradlew.bat assembleArm64Debug -x rustBuildArm64Debug

# Install + relaunch
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb install -r "C:\Users\34643\Desktop\RPSLS\app\src-tauri\gen\android\app\build\outputs\apk\arm64\debug\app-arm64-debug.apk"
& $adb shell am force-stop com.alex.rpsls
& $adb shell am start -n com.alex.rpsls/.MainActivity
```

---

## ⚠️ Pièges identifiés

- **Power creep** : multi-card par tour permet des combos puissants. Equilibrer après playtest.
- **Game length** : si > 15 min, baisser HP à 15.
- **CPU AI** : greedy ≠ smart. Itérer après MVP.
- **Cartes non adaptées** : 31/46 sont no-op en MVP. Le DeckManager Arena doit les filtrer (Phase 2).
- **Hand cap overdraw** : si la main est pleine et tu draws, la carte est "burned" — pas dans la discard (design HS).

---

## ✅ Critères de validation par session

**Session #2 (courante) :** AI + Game + Board + Plan + Page + i18n + Menu wire + build OK device.

**Session #3 :** Animations combat, polish UX, gestion edge cases, adapter 10-15 cartes restantes, match-end screen.

**Session #4+ :** Cartes Arena-only, ladder/stats arena, packs séparés, online multiplayer.
