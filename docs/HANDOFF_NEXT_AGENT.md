# HANDOFF — Suite UX / "Bundles par thème" (RPSLS)

> Lis **tout** ce fichier avant de toucher au code. Tu reprends une session longue.
> Projet : RPSLS, **Tauri 2 + WebView Android**, front React/TS dans `app/`, serveur Rust dans `crates/rpsls-server/`.
> Branche : `develop`. **NON publié.** Device de test branché : **`CMJFT4IN6HFYA6OV`** (adb).
> Auteur du handoff : agent précédent. Alex (le user) écrit en français, répond en français.

---

## 0. TL;DR — ce qui se passe MAINTENANT

Alex itère vite sur l'UX premium. Progrès majeurs depuis le dernier agent :
- **En-tête mobile : RÉPARÉ** — nouveau composant `PlayerBadge` (source unique avatar/nom/rang/XP/devises, utilisé par UserHeader ET ProfilePage). Les devises ont leur propre ligne → plus de chevauchement à 375px.
- **XP bar DRY : FAIT** — même disposition partout via `PlayerBadge`.
- **PremiumTouchLayer : identité distincte par thème** — storm (ruban électrique + éclairs), eclipse (ruban doré + anneaux), phantom (brouillard multi-couche), emberforge (traînée de lave), tempus (ruban sépia + marques d'horloge).
- **StormRain : renforcé** — densité ×2.5, couleur plus vive, z-[1]. **Pas encore vérifié sur device par Alex.**
- **ThemedXpBar : enrichi** — gloss sweep + counter-sweep thémé + edge glow pulsé.

**Reste à faire** : boutons tournoi thémés (§3.3), vérif pluie sur device (§3.4), polish FX premium au niveau Quartz (§3.5), le "bundle par thème" complet (§4).

---

## 1. PIPELINE BUILD & VÉRIF (CRITIQUE — Windows, pas de Developer Mode)

Le front dist est **embarqué dans `libapp_lib.so`** (brotli) servi depuis `http://tauri.localhost/`. Copier dist→assets ne marche PAS. Procédure :

```powershell
# 1. Build front + recompile .so (ÉCHOUE au DERNIER pas sur le symlink Windows = NORMAL, exit 1,
#    le .so EST compilé à ce stade)
cd C:\Users\34643\Desktop\RPSLS\app
$env:ANDROID_NDK_ROOT = $env:NDK_HOME
npx tauri android build --debug --apk --target aarch64   # exit 1 attendu ("symbolic link")

# 2. COPIER (pas symlink) le .so frais
Copy-Item -Force "C:\Users\34643\Desktop\RPSLS\target\aarch64-linux-android\debug\libapp_lib.so" `
  "C:\Users\34643\Desktop\RPSLS\app\src-tauri\gen\android\app\src\main\jniLibs\arm64-v8a\libapp_lib.so"

# 3. Packager l'APK (.so déjà frais)
cd C:\Users\34643\Desktop\RPSLS\app\src-tauri\gen\android
./gradlew assembleArm64Debug -x rustBuildArm64Debug

# 4. Installer + relancer (force-stop OBLIGATOIRE sinon vieux JS en mémoire)
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb install -r "C:\Users\34643\Desktop\RPSLS\app\src-tauri\gen\android\app\build\outputs\apk\arm64\debug\app-arm64-debug.apk"
& $adb shell am force-stop com.alex.rpsls
& $adb shell am start -n com.alex.rpsls/.MainActivity
```

**Vérif du build servi** (anti-piège du `.so` figé) via CDP :
```powershell
$pid_ = (& $adb shell pidof com.alex.rpsls).Trim()
& $adb forward tcp:9222 "localabstract:webview_devtools_remote_$pid_"
# puis WebSocket sur http://localhost:9222/json/list → Runtime.evaluate
# vérifier que le <script> servi (index-XXXX.js) == le chunk du dernier build.
```
- **CDP marche** pour des evals à **petite sortie**. Les grosses sorties (DOM dump, screenshot base64) font **avorter le socket** — garde l'expression minuscule.
- **Tap ADB bloqué** (INJECT_EVENTS). Pour piloter l'UI sur device : `Runtime.evaluate` (dispatch d'events) — mais le **splash** exige un tap réel finicky.

**Vérifs rapides :** `pnpm exec tsc --noEmit` (depuis `app/`) ; `cargo check` (depuis `crates/rpsls-server/`).

**⚠️ Preview dev (`preview_*`, port 5174) :** le **WebGL est CASSÉ** (fond gris, "shader error") → impossible de juger les fonds animés en preview. Utilisable seulement pour DOM/HTML/canvas-2D. Le bypass du splash en preview est aléatoire.

---

## 2. CE QUI EST DÉJÀ FAIT (en code, buildé device sauf mention)

Voir les 2 fichiers mémoire (à LIRE) :
`C:\Users\34643\.claude\projects\C--Users-34643-Desktop-RPSLS\memory\classe-ranked-track.md`
`C:\Users\34643\.claude\projects\C--Users-34643-Desktop-RPSLS\memory\theme-bundle-ux.md`

Résumé :
- **Mode Classé** = a son **propre classement** (`classeLp` + `classeStats`), sa carte rank/record/récompenses (ClasseLobby dans `pages/play/PlayMenu.tsx`), "vs IA" retiré (15 locales). **Cloud-syncé** (client `online/online.ts` + `online/playerSync.ts` + Rust `crates/rpsls-server/src/player_state.rs`). Intégrité BDD : ont AUSSI été ajoutés au sync `stars` (monnaie premium ✦ — était perdue au reinstall !), `claimedQuests`, `difficulty`, `fontScale`, `padChosen`.
- **Tiles menu** : base opaque `bg-surface-raised` (lisibilité sur fonds animés).
- **Titre principal** : traitement AAA (font-black, uppercase, dégradé thème + halo).
- **Barre XP** : retrait des `|` (ticks) + retrait de la "boule" (c'était le `rounded-full` sur le FILL à faible progression) → **confirmé OK par Alex**. Élargie (pleine largeur) dans PlayerBadge. Enrichie de 3 animations continues : gloss sweep L→R, counter-sweep thémé (--theme-secondary) en sens inverse, et edge glow pulsé sur le bord droit. Keyframes injectés une seule fois (`themed-xpbar-keyframes`).
- **PlayerBadge** (`ui/PlayerBadge.tsx`) : **NOUVEAU** composant source unique pour l'identité joueur (avatar, pseudo, rang, devises, barre XP). 3 lignes : Row 1 = avatar+nom+rang, Row 2 = devises (centré, border-t), Row 3 = ThemedXpBar pleine largeur. Gère le gain XP en interne (pas de prop `gainPulse` à passer). Utilisé par `UserHeader` (onTap→profil, `md:hidden`) et `ProfilePage` (sans onTap).
- **Quartz** : densité réduite (interactif 6 cristaux / 12 bulles / TTL 2.2s ; ambiant 5 shards / 2 seeds). **Alex AIME les particules Quartz** → les prendre comme référence.
- **Pad Storm** : pluie retirée du pad (gardé ciel + éclairs + bobine Tesla).
- **PremiumTouchLayer** (`backdrops/PremiumTouchLayer.tsx`) : **réécrit DOM→CANVAS** — chaque thème a une identité véritablement DISTINCTE :
  - **storm** = ruban électrique jitté (quadraticCurveTo) + branches d'éclairs (fork 4% par segment) + sparks radiants ; `globalCompositeOperation: "lighter"`.
  - **eclipse** = ruban doré large glow + anneaux concentriques expansifs (kind=`"ring"`) + motes flottantes.
  - **phantom** = brouillard multi-couche (4 strokes offset avec opacité/largeur différentes → effet nuage profond, pas de blend additive).
  - **emberforge** = traînée de lave (cœur blanc-chaud → orange → cendre rouge, `lerpC` sur l'âge) + braises montantes (3 particules/emit, `globalCompositeOperation: "lighter"`).
  - **tempus** = ruban sépia + marques perpendiculaires ("tick marks" d'horloge tous les 6 segments) + grains de sable en spirale (kind=`"spiral"`).
  - Taps minimes (5 particules pop), slides permanents & fluides. 364 lignes.
- **StormRain** (`backdrops/StormRain.tsx`) : pluie canvas renforcée — densité ~1 drop/1200px² (avant 3200), zone de spawn élargie ±0.5×viewport (pas de bande morte latérale), couleur plus vive `rgba(210,230,245)`, `z-[1]`, splashes en arc semi-circulaire. ⚠️ Pas encore vérifié par Alex sur device — **voir §3.4**.
- **Reveal classique** (`pages/play/PlayGame.tsx`) : retiré `backdrop-blur` (countdown/reveal/end) + le flash `blur-3xl` (→ radial-gradient, sans filtre) + timings resserrés (la main gagnante arrive ~2× plus vite). **Dans le .so copié non installé.**
- **DRY** : `rankProgress()` (engine/rank.ts) + `<LpBar>` (ranked/LpBar.tsx) partagés.

⚠️ **SERVEUR À REDÉPLOYER** : tant que `crates/rpsls-server` n'est pas redéployé, le cloud ne stocke PAS les nouveaux champs (classeLp, stars…). Repo a un `fly.toml` + `Dockerfile` (→ **Fly.io**, l'ancien handoff disait "Render"). Remote `github.com/Alex-Lou/RPSLS`. **Rien n'a été commité/pushé** (pas de push sans accord d'Alex).

---

## 3. CORRECTIONS — état actuel

### 3.1 ✅ EN-TÊTE MOBILE — RÉSOLU
Nouveau composant `PlayerBadge` (`ui/PlayerBadge.tsx`) sépare les devises sur leur propre ligne (Row 2, centré, border-t). Row 1 = avatar+nom+rang+LP. Row 3 = ThemedXpBar pleine largeur. Plus de chevauchement à 375px. `UserHeader.tsx` est devenu un wrapper de 19 lignes.

### 3.2 ✅ BARRE XP DRY — RÉSOLU
`PlayerBadge` est la source unique pour le header ET la page Profil (les deux l'importent). Même disposition, même composant, zéro redondance.

### 3.3 BOUTONS "INTÉGRER LE TOURNOI" non thémés
> Alex (rappel, plusieurs fois) : ces boutons ne suivent PAS le thème appliqué.

- Fichier : `app/src/ranked/BracketPage.tsx` (chercher "Intégrer", `joined`, `preparing`, `TournamentPreparingOverlay`). Styliser les boutons (et idéalement TOUT l'arbre) avec les couleurs/dégradés du thème actif via `var(--theme-primary/secondary)` / `gradientFromTheme()` / `bg-themed` (cf. `theme/theme.ts`).
- Plus large : **l'arbre de tournoi doit avoir son identité visuelle animée attachée au thème**.

### 3.4 PLUIE TEMPEST FURY — renforcée, EN ATTENTE VÉRIF DEVICE
> Alex : « ET TU N'AS PAS FAIT LA PLUIE DEMANDÉE DE TEMPEST FURY » + (avant) « la pluie flotte, c'est pas de la pluie ».

`StormRain` a été **renforcé** depuis le retour d'Alex :
- Densité ×2.5 (~1 drop/1200px² au lieu de 3200 ; phone 400×900 ≈ 300 drops)
- Couleur plus vive `rgba(210,230,245)` au lieu de `rgba(174,216,240)`
- z-[1] (au-dessus du backdrop WebGL z-0)
- Zone de spawn élargie ±0.5×largeur viewport → pluie uniforme bord à bord
- Respawn aussi quand le drop dérive hors-écran à droite (plus de bande morte)

**Mais Alex N'A PAS ENCORE TESTÉ cette version sur device.** Le `.so` installé sur le tel est peut-être une ancienne version. À builder + installer + vérifier.

Hypothèses restantes si toujours invisible :
1. Alex n'est peut-être pas sur le fond **storm** (la pluie ne rend que pour `activeScene==="storm"`).
2. Le **scrim** (`App.tsx`, voile lisibilité) pourrait couvrir la pluie — vérifier l'ordre de rendu.
3. La pluie flottante du **shader** (`backdrops/ThemedBackdrop.tsx` scène storm) est toujours là et pourrait interférer — retrait/atténuation = travail shader.

### 3.5 PARTICULES PREMIUM — identité distincte IMPLÉMENTÉE, à juger device
> Alex : « les particules dans le Quartz sont pas mal du tout, inspire-t'en pour créer de nouvelles particules tout aussi fluides pour les autres premiums ».

- Référence qualité : `backdrops/QuartzInteractiveLayer.tsx` (cristaux/bulles, tap/slide/hold, shatter). Alex le trouve fluide.
- **`PremiumTouchLayer.tsx` a été entièrement retravaillé** avec une identité visuelle véritablement DISTINCTE par thème (voir §2 pour le détail par scène). Canvas unique, rAF, 364 lignes. Chaque thème = traînée + particules **uniques** :
  - storm = ruban électrique + éclairs forkés
  - eclipse = ruban doré + anneaux + motes
  - phantom = brouillard multi-couche (4 strokes)
  - emberforge = traînée lave (blanc→orange→cendre) + braises
  - tempus = ruban sépia + tick marks perpendiculaires + sable spiral
- **En attente de jugement device par Alex.** Si la qualité ne matche pas encore Quartz, l'archi canvas est en place — il suffit d'ajuster les paramètres (couleurs, densité, TTL, glow).

---

## 4. PRINCIPE DIRECTEUR : "UN BUNDLE PAR THÈME"
> Alex (répété) : « La SEULE chose qui doit changer, c'est TOUT quand on change de thème (histoire des bundles). Mais dans un MÊME thème, il ne doit y avoir AUCUNE INCOHÉRENCE. »

Chaque apparence/thème = un **bundle cohérent** : couleurs, **police**, motifs, vagues/animations de fond, **réactions tactiles (slide/draw/hold)**, **cadres/ornements**, **boutons**, **arbre de tournoi**, barre XP/HUD. Quand on change de thème, TOUT bascule ensemble ; à l'intérieur d'un thème, zéro incohérence.

**Recommandation archi** (pas encore fait) : un registre unique `THEME_BUNDLE[theme]` (source de vérité : titleFont/color, buttonStyle, bracketSkin, touchFxConfig, motifs, accents) que titre/boutons/bracket/FX/barre lisent. Aujourd'hui c'est éparpillé (`theme/theme.ts` THEMES = palette+fonts ; `theme/themes.ts` BACKGROUNDS = scènes+skins+flashy/light ; `data-premium` dans `App.css` pour les cadres premium).

Portée des **slide-FX uniques** validée par Alex : **sets premium d'abord** (Eclipse/Phantom/Emberforge/Tempus/Storm/Quartz).

---

## 5. BACKLOG / DÉFÉRÉ (Task #11 — le gros du "bundle")
- Shader par thème : retirer la pluie flottante du shader storm ; motifs/vagues/réactions **uniques** par scène (`backdrops/ThemedBackdrop.tsx`, monolithe WebGL — exception à la règle <400 lignes).
- Boutons thémés **partout** (pas que le tournoi).
- Arbre de tournoi animé & thémé.
- **Icônes centrales des pads** récemment ajoutés : « trop codé », à rendre plus pro/propre/fluide (`battlepads/*Pad.tsx`).
- Étendre l'idée "pluie réelle / ambiance" aux autres thèmes si Alex valide storm.

---

## 6. NOTES TECHNIQUES & GARDE-FOUS
- **Fichiers < 400 lignes** (sauf `ThemedBackdrop.tsx`). ⚠️ déjà hors-règle : `pages/play/PlayMenu.tsx` ≈ 1009 lignes (6 écrans dedans), `pages/play/PlayGame.tsx` ≈ 1435. Respecter DRY / SOLID / KISS / **éviter redondances** (Alex y tient).
- `store/storeMigrationGuard.ts` : contient des **NUL bytes** → **`Edit` jamais `sed`**.
- `store/store.ts` : version persist **21** (migrations additives ; classeLp/classeStats init v21).
- **Pas de `git add .`**, lister les fichiers ; pas de `Co-Authored-By` ; **ne pas push sans accord d'Alex**.
- Assets `.md` racine + `Cards Bonus/*.png` + `_avatar_backup/` non-trackés = dépôts d'Alex, **ne pas `rm`**.
- `menuFxSuppressed()` (`fx/menuFx.ts`) = vrai pendant un match (via `useAndroidBackPrompt`→`useNoMenuFx`, appelé dans `PlayGame` et les vues match). Sert à couper FX/pluie en combat.
- `color-mix(in oklab, var(--theme-primary) X%, …)` marche en WebView Chromium (utilisé partout).

## 7. CARTE DES FICHIERS TOUCHÉS (working tree, NON commité, 57 modified + 19 untracked)
- `app/src/UserHeader.tsx` — wrapper minimal (19 lignes), délègue à PlayerBadge. ✅ RÉPARÉ.
- `app/src/ui/PlayerBadge.tsx` — **NOUVEAU**, source unique identité joueur (170 lignes). ✅ RÉSOUT §3.1+§3.2.
- `app/src/ui/ThemedXpBar.tsx` — fill nettoyé (plus de boule), h-6, + gloss sweep + counter-sweep thémé + edge glow + 3 keyframes.
- `app/src/ranked/LpBar.tsx` — sheen, no rounded fill.
- `app/src/Sidebar.tsx` — fill sans rounded.
- `app/src/pages/play/PlayMenu.tsx` — ClasseLobby (rank card), tiles bg-surface-raised, titre AAA.
- `app/src/pages/play/PlayGame.tsx` — reveal allégé + timings.
- `app/src/backdrops/PremiumTouchLayer.tsx` — canvas, 5 identités de traînée distinctes (364 lignes).
- `app/src/backdrops/StormRain.tsx` — pluie renforcée (densité ×2.5, z-[1], couleur vive, 124 lignes).
- `app/src/backdrops/QuartzInteractiveLayer.tsx` + `QuartzBackdrop.tsx` — densité réduite.
- `app/src/battlepads/StormPad.tsx` — pluie retirée du pad.
- `app/src/App.tsx` — wiring PremiumTouchLayer + StormRain + data-premium.
- `app/src/engine/rank.ts` — `rankProgress()`.
- `app/src/types.ts`, `app/src/store/store.ts`, `app/src/store/storeMigrationGuard.ts`, `app/src/online/online.ts`, `app/src/online/playerSync.ts`, `crates/rpsls-server/src/player_state.rs` — sync classeLp/stats/stars/quests/prefs.
- `app/src/i18n/locales/*.ts` — `mode.ranked.tag` reformulé (15 langues).

## 8. PREMIÈRE ACTION RECOMMANDÉE
1. Lire ce fichier + les 2 mémoires.
2. ~~Réparer l'en-tête~~ ✅ + ~~centraliser la barre XP~~ ✅ — **FAIT** (PlayerBadge).
3. **Thémer les boutons tournoi (§3.3)** — bouton "Intégrer le tournoi" + arbre bracket doivent adopter `var(--theme-primary/secondary)`.
4. **Builder + installer** (pipeline §1) pour que Alex puisse juger sur device :
   - La pluie storm (§3.4) — visible ou non ?
   - Les traînées premium (§3.5) — qualité Quartz atteinte ?
   - Le reveal classique allégé
   - Le PlayerBadge sans chevauchement
5. **Polir les FX premium** selon le retour device d'Alex.
6. Avancer sur le **bundle par thème** complet (§4) : registre `THEME_BUNDLE[theme]`, shader motifs, boutons/bracket/titre/barre XP cohérents.
7. Quand Alex valide : lui proposer de commit/push (+ redéploiement serveur Fly/Render pour le cloud-sync).

L'infra est solide, l'en-tête est réparé, les FX canvas sont en place. Reste le polish device + les boutons/bracket thémés + le système de bundles complet.
