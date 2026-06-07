# RPSLS — Handoff pour le prochain agent

**Date:** 2026-06-07
**Branche:** `develop` (commit `95e5232`)
**Statut:** Build OK (tsc + vite), NON release, NON push

---

## Etat actuel

6 themes premium implementes (Coral, Rust, Void, Prism, Ink, Bloom) avec :
- Shader WebGL (scenes 14-19 dans `ThemedBackdrop.tsx`)
- SVG pad anime par theme (`battlepads/{Coral,Rust,Void,Prism,Ink,Bloom}Pad.tsx`)
- Palette HUD + fonts (`theme/theme.ts` THEMES + `theme/themes.ts` BG_DEFAULT_THEME)
- Touch FX par theme (`backdrops/PremiumTouchLayer.tsx`)
- Slider intensite par theme (store v22 `premiumIntensity`, uniforme `u_intensity`)
- Gating premium (`premiumSetId` sur BackgroundDef et PAD_META)
- Arena override (pile-ou-face gagnant applique son theme complet: `ranked/arenaOverride.ts`)
- i18n 15 langues (fait par un agent Cline separement, merge `7137a7b`)

**Traductions:** Un agent Cline a deja fait toutes les traductions pour les 15 langues. Ne pas refaire.

---

## Taches restantes (par priorite)

### P0 — Demandees par Alex, en attente

1. **Bloom shader — 90% fini, reste la generation procedurale des fleurs**
   - 2026-06-07 device-validated: piques bouts de petales corriges (ellipse SDF
     `nx² + ny² < 1`, rx ≈ 0.34 × pLen, BloomPad-style), touch FX bloom refait
     (burst de N petales drift + flux continu pollen/petales sur slide, density
     scale avec slider intensity). Alex valide ("franchement j'admire").
   - **RESTE A FAIRE (10%)** : generation/disparition procedurale des fleurs.
     Aujourd'hui les 5 vines portent toujours la meme fleur a la meme position
     avec la meme couleur. Alex veut :
       - cycle de vie (grow → bloom → fade) avec re-spawn a une nouvelle position
       - variation continue : nb de petales (5/6/7/8), couleur (palette elargie),
         taille
       - "d'autres plantes" : ajouter une couche de petites fleurs sauvages au
         sol, marguerites, tulipes — pas uniquement les 5 vines existantes
   - Fichier : `app/src/backdrops/shaders/scenes/bloom.glsl.ts` (fonction `bloom`)
   - Approche shader : seed = hash(vec2(fi, floor(u_time/lifespan + offset)))
     change de valeur a chaque renouvellement de cycle → tous les params (x, hue,
     petal count, size) derivent de seed. `phase = fract(...)` puis
     `grow = smoothstep(0,0.15,phase)` et `fade = smoothstep(0.85,1.0,phase)` →
     alpha = grow * (1 - fade).

2. **Double confirmation online (0/2 → 1/2 → 2/2)**
   - Au pile-ou-face en ligne, les 2 joueurs doivent confirmer "pret" avant le lancer
   - Necessite: protocole WS serveur (Rust `crates/rpsls-server/src/main.rs`) + etat client
   - `MatchPrepScreen.tsx` doit afficher le compteur de joueurs prets
   - NON commence

3. **Menu principal style par theme**
   - Alex veut que chaque theme stylise le menu principal differemment
   - Touche potentiellement `PlayMenu.tsx`, `Sidebar.tsx`, boutons principaux
   - NON commence

4. **Qualite animations pads SVG**
   - Alex: "il faut GRAVEMENT POUSSER LES ANIMATIONS ET MOTIFS DES PADS, c'est HYPER PAUVRE"
   - Les 6 nouveaux pads (Coral, Rust, Void, Prism, Ink, Bloom) + les anciens
   - Plus de detail SMIL: ondulations, particules, effets de lumiere
   - Fichiers: `app/src/battlepads/*.tsx`

5. **Boutons "Integrer le tournoi" / "Combattre XXX" — plus de style**
   - Emoji retire, mais le style reste austere
   - Ajouter: gradient theme, brillance, animation hover/tap
   - Fichiers: `BracketPage.tsx`, `BracketUI.tsx`

### P1 — Ameliorations UX

6. **Ecran victoire match — espace utilise**
   - La page de resultats peut etre trop serree sur certains ecrans
   - Fichier: `ranked/RankedMatchView.tsx`, `ranked/TournamentPodium.tsx`

7. **Fusion doublons cartes → bonus (ordre Alex #39)**
   - Systeme de fusion: si le joueur a des doublons de cartes, les fusionner en bonus
   - Necessite: store + UI + equilibrage
   - NON commence

8. **Pads dedies par theme (ordre Alex #40)**
   - Les 6 nouveaux pads sont faits, mais Alex veut aussi un 2e pad Casino "hyper style"
   - Et potentiellement d'autres pads thematiques pour les anciens themes

---

## Architecture et contraintes critiques

### Build Android (Windows, pas de Developer Mode)

```powershell
# 1. Build frontend + .so (s'arrete au symlink sur Windows)
$env:ANDROID_NDK_ROOT = $env:NDK_HOME
npx tauri android build --debug --apk --target aarch64

# 2. Copier le .so fraichement compile
Copy-Item "app\src-tauri\target\aarch64-linux-android\debug\libapp_lib.so" `
          "app\src-tauri\gen\android\app\src\main\jniLibs\arm64-v8a\libapp_lib.so" -Force

# 3. Packager l'APK (le .so est deja a jour)
Set-Location "app\src-tauri\gen\android"
.\gradlew assembleArm64Debug -x rustBuildArm64Debug

# 4. Installer sur device
adb uninstall com.alex.rpsls
adb install "app\build\outputs\apk\arm64\debug\app-arm64-debug.apk"

# 5. TOUJOURS force-stop avant lancer (sinon vieux JS en memoire)
adb shell am force-stop com.alex.rpsls
adb shell am start -n com.alex.rpsls/.MainActivity
```

**PIEGE CRITIQUE:** Le frontend est embarque DANS `libapp_lib.so` (brotli). Copier dist→assets ne sert a RIEN. Il FAUT recompiler le .so via `npx tauri android build`.

### Verification device via CDP

```powershell
# Trouver le PID du WebView
adb shell "cat /proc/net/unix | grep devtools"
# Forward le port
adb forward tcp:9222 localabstract:webview_devtools_remote_<PID>
# Verifier le chunk servi
# Ouvrir ws://localhost:9222 et Runtime.evaluate
```

### Contraintes GLSL ES 1.00 (shader `ThemedBackdrop.tsx`)

- **JAMAIS de backticks** dans les commentaires GLSL (ferme le template literal JS)
- **JAMAIS de `continue`** dans les boucles (crash Mali/Adreno) — utiliser if-guard
- **JAMAIS de ternaire sur float** — utiliser if/else ou step/mix
- **JAMAIS de `1e-6`** (exponent literal) — ecrire `0.000001`
- **JAMAIS de variable locale prefixee `u_`** (conflit uniforme)
- **Boucles a bornes constantes** uniquement (pas de `i < someFloat`)

### Fichiers sensibles — NE PAS toucher sans precaution

| Fichier | Particularite |
|---------|--------------|
| `storeMigrationGuard.ts` | Contient des NUL bytes (test corruption) — utiliser Edit, JAMAIS sed |
| `*.md` a la racine repo | UNTRACKED — un `rm` = perte definitive |
| `_avatar_backup/` | Backup Alex — ne pas committer ni supprimer |
| `app/src-tauri/gen/android/` | Genere — ne pas committer |

### Regles strictes

- **Prefixer toutes les commandes avec `rtk`** (voir CLAUDE.md)
- **Ne JAMAIS `git add .`** — lister les fichiers explicitement
- **Ne JAMAIS push** sans approbation explicite d'Alex
- **Store version = 22** (migration dans `store.ts`)
- **`menuFxSuppressed()`** doit arreter les FX pendant les matchs
- **Alex ecrit/repond en francais**
- Device: `CMJFT4IN6HFYA6OV`

---

## Fichiers cles par fonctionnalite

### Systeme de themes
- `app/src/types.ts` — ThemeId, PadId, BackgroundId, PAD_META, Player
- `app/src/theme/theme.ts` — THEMES (palettes HUD + fonts)
- `app/src/theme/themes.ts` — BACKGROUNDS (BackgroundDef + BG_DEFAULT_THEME)
- `app/src/store/store.ts` — updateProfile, premiumIntensity, migrations
- `app/src/store/storeMigrationGuard.ts` — VALID_*_IDS (garde binaire)

### Rendu visuel
- `app/src/backdrops/ThemedBackdrop.tsx` — TOUS les shaders WebGL (FRAG, ~1750 lignes)
- `app/src/backdrops/PremiumTouchLayer.tsx` — Touch FX (tap/hold/swipe)
- `app/src/backdrops/StormRain.tsx` — Pluie canvas pour Tempest Fury
- `app/src/battlepads/*.tsx` — Pads SVG animes (SMIL)
- `app/src/App.css` — Variables CSS, light-theme overrides, .shadow-themed

### Pages
- `app/src/pages/ProfilePage.tsx` — Profil, pickers theme/pad/bg, intensite, premium shop
- `app/src/pages/PlayPage.tsx` — Page jeu, arena override, prep screen
- `app/src/pages/OnlinePage.tsx` — Online, health probe, queue radar
- `app/src/pages/play/PlayMenu.tsx` — Menu modes de jeu

### Ranked / Tournoi
- `app/src/ranked/BracketPage.tsx` — Page bracket tournoi
- `app/src/ranked/BracketUI.tsx` — Arbre bracket theme
- `app/src/ranked/MatchPrepScreen.tsx` — Ecran prep + pile-ou-face
- `app/src/ranked/arenaOverride.ts` — Zustand store arena bg swap
- `app/src/ranked/TournamentPodium.tsx` — Podium + FloatingNewRunButton

### Composants partages
- `app/src/ui/PlayerBadge.tsx` — Badge joueur (avatar/nom/rang/xp/monnaies)
- `app/src/ui/ThemedXpBar.tsx` — Barre XP avec animations theme
- `app/src/UserHeader.tsx` — Header mobile (wrapper PlayerBadge)
- `app/src/match/sharedMatchUI.tsx` — FloatingMatchBackButton (portal)

### Serveur
- `crates/rpsls-server/src/main.rs` — WS principal
- `crates/rpsls-server/src/player_state.rs` — Persistance Upstash

---

## Ce qui a ete fait dans cette session

1. 6 shaders WebGL (coral, rust, void, prism, ink, bloom) — scenes 14-19
2. 6 pads SVG animes (CoralReefPad, RustPad, VoidPad, PrismPad, InkPad, BloomPad)
3. 6 palettes HUD + fonts dans THEMES
4. 6 BackgroundDef dans BACKGROUNDS + BG_DEFAULT_THEME
5. PremiumTouchLayer — FX distincts par theme (bulle, fish, spark, chevron, photon, blot, petal)
6. StormRain — pluie canvas pleine largeur avec intensite
7. Slider intensite premium (store v22, uniform u_intensity, steep curve k^1.6)
8. Slider vertical en peek preview (custom pointer handler, pas input rotate)
9. Arena override — pile-ou-face applique le theme entier du gagnant
10. PlayerBadge — composant DRY (UserHeader + ProfilePage)
11. ThemedXpBar — animation counter-sweep + leading-edge glow
12. BracketUI — connecteurs theme, pulse match en cours
13. TournamentPodium — FloatingNewRunButton, layout scroll
14. Light-theme contrast (Bloom/Ink/Void) — dark ink CSS vars
15. CSP fix pour cloud connectivity (connect-src + no-cors health)
16. FloatingMatchBackButton — createPortal fix (Motion transform)
17. Bloom shader reecrit 3x — version finale avec sin(uu*PI) petal SDF
18. Nouveaux assets cartes bonus (7 nouvelles + 11 MAJ haute-res)
