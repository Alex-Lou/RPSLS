# HANDOFF — Premium Cosmetics & Style Direction

> Branche : `feat/premium-cosmetics-v1`
> Dernier commit au moment de l'écriture : `7b2d86b`
> Cible : Android (Tauri 2 + WebView), testé sur device réel via DevTools.
> Auteur du handoff : agent précédent. Lis **tout** avant de toucher au code.

---

## 0. TL;DR — où on en est

Le système de cosmétiques premium (5 sets : **Eclipse, Phantom, Emberforge, Tempus, Storm** + **Quartz**) est **fonctionnel mais pas fini niveau direction artistique**. Trois bugs bloquants sont **diagnostiqués mais pas corrigés** (voir §2). Le « vrai travail de style » réclamé par Alex est détaillé en §5 — c'est le cœur de ta mission.

**Ne recommence pas de zéro.** L'infra (shaders, pads, persistance serveur, achat) marche. Ce qui manque, c'est : (a) corriger 3 bugs UX, (b) donner à chaque thème une **identité visuelle forte et cohérente dans TOUTE l'app**, pas juste un joli fond.

---

## 1. Contexte produit & exigences d'Alex (verbatim, à respecter)

- « De **VRAIS contenus premium** à acheter qui donnent envie de revenir sur l'app. »
- « Pas des copies-collés des apparences » — chaque pad/thème doit **enrichir le jeu pendant les parties**, être *dans le même thème* que l'apparence mais **visuellement différent**.
- « Il faut du **60 fps** pour les téls et tablettes qui le peuvent. »
- Interactions tactiles : « des doigts curieux qui jouent avec l'écran, ils doivent en avoir pour leur argent » — **variées par thème**, **moins flashy** (ne pas aveugler / masquer les menus), inclure **long-press** et **swipe horizontal** (détectable, ne réagit PAS au scroll vertical).
- Les **cartes du menu** doivent adapter leur transparence selon les thèmes lumineux (lisibilité). Épaissir/agrandir les fonts là où c'est illisible.
- **Ember Forge** est le thème préféré d'Alex — « le seul qui sort du lot ». Ne pas le dénaturer ; s'en inspirer comme barre de qualité.
- Le splash screen doit refléter le thème enregistré (fait, sauf Tempest/Tempus/Ember où on améliore les pads à la place).
- Persistance : « si je change, ça s'enregistre dans la BDD, et au login l'user récupère direct son thème ». **Les diamants/étoiles ne doivent JAMAIS être perdus à un reinstall.** (FAIT — voir §4.)

---

## 2. ✅ BUGS BLOQUANTS — TOUS CORRIGÉS & vérifiés device (commit `3ae9312`)

> Les 3 bugs ci-dessous **sont résolus et vérifiés sur device réel** (via WebView DevTools / CDP). Section conservée pour la trace technique. **Tu peux passer directement au §5 (style).**

- **Bug 1 (crash achat)** → `previewArt` n'est plus un `ThemedBackdrop` live : remplacé par `PremiumPreviewTile` (gradient CSS/motion, zéro WebGL). Vérifié : contexte WebGL reste à **1** quand la modale s'ouvre sur un fond premium (était 2 → crash).
- **Bug 2 (célébration invisible)** → (a) modale portalisée sur `body` à `z-[10000]` (au-dessus du peek z-9999) + célébration plein écran sortie de la carte ; (b) **vraie cause** : le `useEffect` de reset de `phase` dépendait de `onClose` (recréé à chaque render parent → l'achat re-render → reset `phase` à idle instantanément). Scindé pour ne dépendre que de `set`. Vérifié : **28 particules** rendues à l'achat.
- **Bug 3 (Quartz pas tactile)** → couche passive portalisée sur `body` à `z-[60]` (au-dessus du menu, pointer-events-none, listeners window). Vérifié : un tap spawne un cristal visible par-dessus le menu, les boutons restent cliquables.
- **Secondaire (peek post-achat)** → le `setTimeout(onClose,2200)` capturait un `onClose` périmé ; lecture de l'ownership via `useStore.getState()`. Vérifié : le peek bascule en « ✓ Choisir ce thème » après achat.

---

## 2bis. 🔴 (archive) Diagnostic original des bugs

### BUG 1 — Crash + restart à l'achat d'un premium

**Cause racine : deux contextes WebGL `ThemedBackdrop` montés simultanément.**

Le flow actuel (que j'ai introduit avec le « peek premium ») :
1. Tap sur une vignette de fond premium → `ProfilePage` applique le fond ET ouvre le peek plein écran → `App.tsx` monte `<ThemedBackdrop scene="storm">` = **contexte WebGL #1**.
2. Tap « Acheter ce thème » dans le peek → ouvre `PremiumPurchaseModal`, dont le `previewArt` est **un autre** `<ThemedBackdrop scene="storm">` = **contexte WebGL #2**.
3. Deux instances du shader lourd (FBM 5 octaves) à 60 fps sur GPU mobile → context-loss / ANR / crash natif → l'app redémarre.

**Fichiers concernés :**
- `app/src/pages/ProfilePage.tsx` → `PREMIUM_SETS` (lignes ~1101-1136) : chaque `previewArt: <ThemedBackdrop scene="…" />`.
- `app/src/App.tsx` (~204) : le `ThemedBackdrop` du fond appliqué.

**Fix recommandé (au choix, par ordre de préférence) :**
1. **Le `previewArt` ne doit JAMAIS être un 2e contexte WebGL live.** Remplace-le par un **aperçu statique léger** : soit un `<canvas>` peint une seule frame puis stoppe le rAF, soit une **vignette CSS gradient** dérivée de `accent.from/to` (déjà dans `themes.ts`), soit un PNG capturé. Le shader live est réservé au fond unique.
2. OU : quand la modale d'achat est ouverte **par-dessus un peek premium**, **démonter le fond** (`ThemedBackdrop`) derrière, pour ne garder qu'un seul contexte. Plus fragile.
3. Garde-fou défensif : un **compteur global de contextes `ThemedBackdrop`** (module-level `let liveContexts = 0`), et si `> 1` au mount, fallback CSS gradient. Empêche toute régression future.

> ⚠️ Règle d'or du projet (déjà documentée dans `ThemedBackdrop.tsx`) : **UN SEUL contexte WebGL à la fois.** Le `SplashShader` en possède un pendant le splash (démonté après). `QuartzBackdrop` est volontairement SVG/SMIL **pour ne pas créer de 2e contexte**. Le `previewArt` premium viole cette règle.

### BUG 2 — Aucune animation d'achat visible

**Cause racine : z-index / stacking.** La `CelebrationOverlay` (burst + particules thématiques) se monte **dans** `PremiumPurchaseModal` à `z-[5]` (relatif à la carte modale, elle-même `z-[120]`). Mais le **peek** est portalisé sur `document.body` à **`z-[9999]`**. Donc la modale + sa célébration jouent **derrière** le peek → invisible.

**Fichiers :**
- `app/src/ui/PremiumPurchaseModal.tsx` → `CelebrationOverlay` (le composant existe et est correct, il est juste masqué).
- `app/src/pages/ProfilePage.tsx` → l'overlay peek `createPortal(..., document.body)` à `z-[9999]`.

**Fix recommandé :**
- Repenser le flow d'achat **depuis le peek** : à la confirmation d'achat, **fermer le peek d'abord**, puis jouer la célébration **plein écran** (portal `document.body`, `z-[10000]`), pas enfermée dans la carte modale. La célébration mérite tout l'écran de toute façon (cf. §5, « moment premium »).
- OU : remonter la `CelebrationOverlay` hors de la modale, en portal `z-[10001]`, déclenchée par le succès d'achat quel que soit le point d'entrée (modale classique OU peek).

### BUG 3 — Quartz pas tactile (toujours, malgré le mode `passive`)

**Cause racine : le layer rend à `z-0` (fond), donc les cristaux/bulles tactiles sont cachés DERRIÈRE les cartes opaques du menu.** En peek ça marchait (le menu est `invisible`), mais en jeu normal le contenu opaque les recouvre.

**Fichiers :**
- `app/src/App.tsx` (~216-222) : `<QuartzBackdropWithLayer interactive={peek} />` dans un `<div className="fixed inset-0 z-0 …">`.
- `app/src/backdrops/QuartzInteractiveLayer.tsx` : le mode `passive` écoute bien au niveau `window` (ça c'est correct), mais le rendu visuel est sous le menu.

**Fix recommandé :**
- En mode `passive`, rendre la **couche visuelle des cristaux** dans un **portal `document.body` à `z-[60]` (au-dessus du contenu, sous les modales `z-[120]`)** avec `pointer-events: none`. Les listeners restent au niveau `window`. Ainsi : on voit les effets PAR-DESSUS le menu, mais les taps continuent d'atteindre les boutons.
- Vérifier que `pctFromEvent` utilise un rect plein écran (viewport) en mode passive, pas le rect du wrapper `z-0`.

---

## 3. Architecture — carte du territoire

### 3.1 Backdrops (fonds animés)

| Fichier | Rôle | Tech |
|---|---|---|
| `backdrops/ThemedBackdrop.tsx` | **Tous** les fonds WebGL (nebula→storm). UN shader, branch `u_scene`. | WebGL1, 1 triangle plein écran, FBM. **~1270 lignes** (gros, mais un seul shader monolithique — le splitter créerait plusieurs contextes = régression perf). |
| `backdrops/QuartzBackdrop.tsx` | Fond Quartz **SVG/SMIL** (pas WebGL, exprès). | SVG + SMIL, pause off-screen. |
| `backdrops/QuartzInteractiveLayer.tsx` | Couche tactile Quartz, tri-state `off`/`passive`/`active`. | React state + motion, pas de rAF. |
| `backdrops/previewScene.ts` | Store Zustand du flag `peek` (aperçu plein écran). | — |

**Conventions shader (à respecter absolument) :**
- **Hash de Hoskins** (`hash21`, `vec3 * 0.1031`) — stable en précision mobile (Adreno/Mali). Le `fract(p.x*p.y)` classique bande en blocs.
- **Interpolation quintique** (C2) dans le noise — supprime le banding de grille.
- **Rotation de domaine** entre octaves FBM (`mat2(0.80,0.60,-0.60,0.80)`) — décorrèle les grilles, rendu liquide.
- **Glows = gaussiennes douces** `exp(-d*d*k)`, **jamais** de `step()` dur (pixels blancs carrés).
- **60 fps gate** : `MIN_DT = 1000/60`. DPR capé à 1.5. rAF en pause sur `visibilitychange`.
- **Context-loss recovery** : `preventDefault()` sur `webglcontextlost` est OBLIGATOIRE, sinon `webglcontextrestored` ne fire jamais → écran gris mort.
- Le GL setup tourne **une fois** (`deps: []`). Changer de scène = **mettre à jour un uniform** (`u_scene`), pas re-créer le contexte (sinon écran gris).

**Uniforms d'interaction tactile (déjà câblés) :**
- `u_touch` (vec2, px GL y-up), `u_touchAge` (s depuis le tap), `u_hold` (0→~1.2 eased press).
- `u_swipeMag` (0→1, magnitude swipe horizontal), `u_swipeAge` (s depuis fin swipe).
- Détection swipe JS : `|dx| > |dy|*1.2` + dead-zone 36px → **ne déclenche jamais sur un scroll vertical**.

### 3.2 Pads (tapis de jeu)

- Tous **SVG/SMIL** dans `app/src/battlepads/*.tsx` (`EclipsePad`, `PhantomPad`, `EmberforgePad`, `TempusPad`, `StormPad`, `QuartzPad`, `AuraPad`, …).
- Dispatch dans `app/src/BattlePad.tsx` (prop `padId`, `frozen` pour figer l'anim en miniature via `setCurrentTime` + `pauseAnimations`).
- **Chaque pad premium a maintenant un EMBLÈME CENTRAL** distinct du fond : sceau céleste (Eclipse), œil spectral (Phantom), bobine Tesla (Storm), sablier (Tempus), enclume (Emberforge). C'est le bon principe — **continue dans cette direction** (cf. §5).
- `dims.ts` exporte `W`/`H` (viewBox commun).

### 3.3 Thèmes & couleurs

- `theme/theme.ts` → `THEMES: Record<ThemeId, ThemeDef>` = **palettes HUD** (primary/secondary/bg + 3 font stacks par thème). `applyTheme()` pose `--theme-primary/secondary/bg` sur `:root`.
- `theme/themes.ts` → `BACKGROUNDS: BackgroundDef[]` = **catalogue des fonds** (scene, defaultPadId, premiumSetId, `light`, `flashy`, accent, skin fonts). `BG_DEFAULT_THEME` mappe fond→palette HUD assortie.
- `theme/fonts.ts` → `FONT_STACK` (@fontsource, toutes bundlées).
- **Surfaces theme-adaptive** : `App.css` dérive `--surface*`, `--ink*`, `--hairline*` via `color-mix(in oklab, var(--theme-bg) …%, …)`. **`color-mix` oklab + `var(--theme-primary)` marche en WebView Chromium** (vérifié).
- Classes root : `.theme-light` (fonds pastel type Quartz) et `.theme-flashy` (fonds lumineux : storm/aurora/galaxy/holy/casino/grid/eclipse/phantom/tempus) → épaississent les surfaces + bumpent le poids des titres. Togglées dans `App.tsx`.

### 3.4 Store & persistance

- `store/store.ts` — Zustand + persist (`rpsls-app-state`), `partialize` exclut `history` (écrit en side-channel `rpsls-history` debounced 2 s).
- `store/storeMigrationGuard.ts` — ⚠️ **contient des NUL/control bytes Unicode** (test de localStorage corrompu). **TOUJOURS `Edit`, JAMAIS `sed`** (sed casse les NULs). git le voit « Bin ».
- `online/playerSync.ts` — sync serveur (merge max/union, LWW pour cosmétiques via `updatedAt`).
- `online/bootSync.ts` — sync one-shot au boot + **recovery reinstall** + **restore de l'anchor durable**.
- `online/playerAnchor.ts` — **persistance durable id+claimToken** via `tauri-plugin-store` (cf. §4).
- Serveur : `crates/rpsls-server/src/player_state.rs` (Upstash Redis REST). `PlayerProgress` serde camelCase persiste progression + cosmétiques.

---

## 4. ✅ Persistance compte — FAIT & vérifié (ne pas casser)

Le bug « les diamants se reset à chaque reinstall » est **résolu et vérifié end-to-end sur device**.

- **Pourquoi ça cassait** : le WebView Android wipe le localStorage au reinstall / update WebView / clear cache → `player.id` régénéré, `claimToken` perdu → le serveur crée un nouveau joueur → ressources orphelines sur l'ancien id.
- **Fix** : `tauri-plugin-store` écrit `player_anchor.json` dans `/data/data/com.alex.rpsls/` (hors WebView storage, hors `no_backup/` → inclus dans l'auto-backup Google). Contient `{ id, claimToken }`.
- **Flow** : au boot, `restoreAnchorIntoStore()` réinjecte id+token AVANT le premier Hello serveur ; après chaque bootSync confirmé, `saveAnchor()` réécrit le fichier.
- **Fallback** : si le `claimToken` local est vide et le serveur répond `claim token mismatch`, `bootSync` régénère l'id proprement (`crypto.randomUUID()`).
- **Vérifié** : localStorage vidé (`remainingKeys: []`) → reload → id `7ebf538c…` + token `cd993c57…` restaurés, serveur a re-sync 10000✦/10000💎/5000✨/owned[quartz,tempus].

**Touche-pas sans raison.** Modifs concernées : `Cargo.toml` (dep `tauri-plugin-store`, approuvée par Alex), `lib.rs` (plugin init), `capabilities/default.json` (perms `store:*`), `playerAnchor.ts`, `bootSync.ts`, `App.tsx`.

---

## 5. 🎨 LE VRAI TRAVAIL DE STYLE — ta mission principale

> Constat d'Alex : « il manque un vrai travail de style ». **C'est juste.** L'infra marche, mais chaque thème premium n'a pas encore d'**identité forte et cohérente**. Aujourd'hui un thème = un fond + un pad + une palette. Un VRAI premium = une **signature visuelle qui imprègne toute l'app**.

### Principe directeur

Chaque set premium doit avoir une **direction artistique** déclinée sur **5 axes**, pas seulement le fond :

1. **Fond animé** (✅ existe, à raffiner) — ambiance, profondeur, mouvement permanent.
2. **Pad** (✅ emblème central ajouté) — objet de jeu distinct du fond.
3. **Typographie** (⚠️ assignée mais sous-exploitée) — les fonts sont mappées par thème mais les **compositions** (titres, accents, chiffres) ne portent pas l'identité. Travailler les tailles, letter-spacing, ornements typographiques.
4. **Formes & cadres** (❌ manquant) — chaque thème devrait avoir ses **bordures / coins / ornements** propres. Eclipse = arcs dorés Art-déco. Tempus = cadres à engrenages. Storm = angles électriques. Phantom = bordures brumeuses irrégulières. Emberforge = rivets de métal. Aujourd'hui tous les cadres sont identiques (`rounded-2xl border-hairline`).
5. **Micro-interactions & moments** (⚠️ partiel) — feedback tactile (✅), mais le **moment d'achat** (✅ célébration thématique existe, mais masquée — bug 2) et les **transitions** (changement de thème, ouverture de modale) devraient porter la signature.

### Direction artistique cible, set par set

- **Eclipse** — *solennel, sacré, doré sur noir.* Or corona + indigo. Typo Cinzel/Cormorant (gravé). Cadres = arcs concentriques fins, dorés, dashés. Tactile = flare solaire doux (PAS aveuglant). Moment : éclipse qui « s'ouvre » (anneau de diamant).
- **Phantom** — *éthéré, inquiétant, froid.* Lavande-gris spectral. Bordures **floues/irrégulières** (pas de rectangles nets). Typo Cinzel light, espacée. Tactile = volute d'âme qui monte. Moment : apparition fantôme qui traverse.
- **Emberforge** ⭐ (référence qualité d'Alex) — *industriel, chaud, puissant.* Orange/cuivre, bouche de forge en haut, enclume au centre, **frappe de marteau**. Typo Bebas/Rajdhani (massive). Cadres = métal rivé. Tactile = on attise les braises (long-press = forge grandit). Moment : étincelles de frappe.
- **Tempus** — *ancien, mécanique, sépia.* Sable + engrenages contra-rotatifs + sablier central + zodiaque. Typo Cinzel. Cadres = rouages. Tactile = le temps ralentit (long-press), sable balayé (swipe). Moment : chrono-fracture (onde dorée).
- **Storm** — *électrique, déchaîné, cyan/violet.* Vortex de nuages, 4 éclairs simultanés, pluie torrentielle, bobine Tesla. Typo Orbitron. Cadres = angles électriques. Tactile = éclair vers le doigt (charge en long-press). Moment : foudre + tonnerre.
- **Quartz** — *glacial, prismatique, luxe doux.* Cristaux, arc-en-ciel spectral, lattice hexagonal. Typo Cinzel/Cormorant. Tactile = cristaux qui poussent / se brisent (✅ existe, à exposer — bug 3). Moment : éclats dichroïques.

### Checklist concrète « travail de style » (par priorité)

1. **[P0] Corriger les 3 bugs §2** (sinon le premium est inachetable / invisible).
2. **[P1] Cadres & ornements par thème** — créer un système de « skin de cadre » (ex. `themeFrame(themeId)` → classes/SVG bordure) appliqué aux cartes du menu, modales, HUD. C'est le **plus gros manque visuel**.
3. **[P1] Lisibilité menu sur fonds flashy** — vérifier `.theme-flashy` sur device (la capture d'Alex montrait Tempus illisible). Possiblement augmenter encore l'opacité des surfaces, agrandir/épaissir les titres `Choisis ton combat` etc.
4. **[P2] Typo signature** — exploiter vraiment les fonts par thème dans les compositions (pas juste `font-family`). Tailles, casse, letter-spacing, petites majuscules.
5. **[P2] Moment d'achat plein écran** — la célébration mérite l'écran entier, thématique, mémorable (cf. bug 2).
6. **[P3] Transitions de thème** — un petit fondu/balayage signature quand on applique un thème.

---

## 6. Pipeline build & déploiement Android (CRITIQUE — lis avant de build)

Le frontend dist est **embarqué dans le binaire Rust `libapp_lib.so`** (brotli) et servi depuis `http://tauri.localhost/`, **PAS** depuis `gen/android/.../assets/`. Donc copier dist→assets ne met **jamais** à jour le front réellement servi.

**Procédure correcte (Windows, pas de Developer Mode) :**
```powershell
# 1. Build front + recompile .so (échoue au DERNIER pas sur le symlink Windows — NORMAL,
#    le .so est déjà compilé à ce stade)
cd app
$env:ANDROID_NDK_ROOT = $env:NDK_HOME
pnpm build
npx tauri android build --debug --apk --target aarch64   # exit 1 attendu (symlink)

# 2. Copier (PAS symlink) le .so frais
Copy-Item -Force `
  "target\aarch64-linux-android\debug\libapp_lib.so" `
  "app\src-tauri\gen\android\app\src\main\jniLibs\arm64-v8a\libapp_lib.so"

# 3. Packager l'APK (le .so est déjà frais)
cd app\src-tauri\gen\android
./gradlew assembleArm64Debug -x rustBuildArm64Debug

# 4. Installer + relancer (force-stop OBLIGATOIRE, sinon vieux JS en mémoire)
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb install -r "app\src-tauri\gen\android\app\build\outputs\apk\arm64\debug\app-arm64-debug.apk"
& $adb shell am force-stop com.alex.rpsls
& $adb shell am start -n com.alex.rpsls/.MainActivity
```

**Vérif sur device via WebView DevTools** (le tap ADB est bloqué par INJECT_EVENTS) :
```powershell
$appPid = (& $adb shell pidof com.alex.rpsls).Trim()
& $adb forward tcp:9222 "localabstract:webview_devtools_remote_$appPid"
# http://localhost:9222/json/list → récupère le pageId → WebSocket Runtime.evaluate
```
- Pour vérifier qu'un build est bien servi : `fetch('/')` puis matcher le chunk `index-XXXX.js` ; vérifier qu'il contient ton nouveau texte.
- Pour piloter l'UI : `Runtime.evaluate` (pas de tap natif).
- Pour créditer des ressources de test : patch `localStorage['rpsls-app-state']` puis `location.reload()`.

---

## 7. Best practices & garde-fous du projet (à respecter)

- **Fichiers < 400 lignes**, idéalement moins. Découper si ça dépasse (sauf `ThemedBackdrop.tsx` : shader monolithique volontaire).
- **Jamais de `Co-Authored-By`** dans les commits.
- **Jamais `git add .`** — lister les fichiers explicitement.
- **Commits en lots logiques**, messages descriptifs.
- `storeMigrationGuard.ts` : **`Edit` jamais `sed`** (NUL bytes).
- Préfixe **`rtk`** sur les commandes (filtre tokens) — passthrough sûr.
- `Cargo.toml` : ne pas committer **sans raison/approbation** (l'ajout `tauri-plugin-store` était explicitement approuvé par Alex).
- `_avatar_backup/`, les `.md` racine non-trackés, les PNG `Cards Bonus/` non-trackés = **dépôts d'assets d'Alex, NE PAS `rm`**. Un `rm` sur untracked = perte définitive.
- **60 fps** non négociable : tout effet doit passer le gate, pauser off-screen, ne pas fuir de rAF/timers (cleanup systématique).
- **Un seul contexte WebGL.** (cf. bug 1.)

---

## 8. État des lieux fichier par fichier (ce qui a bougé récemment)

| Fichier | État | Note |
|---|---|---|
| `backdrops/ThemedBackdrop.tsx` | ✅ shaders enrichis + 5 touch premium + swipe | mouvement permanent partout |
| `backdrops/QuartzBackdrop.tsx` | ✅ enrichi (12 cristaux, rainbow, lattice) | `mode="passive"` hors peek |
| `backdrops/QuartzInteractiveLayer.tsx` | ⚠️ tri-state OK mais **rendu sous le menu** | bug 3 |
| `battlepads/*Pad.tsx` | ✅ emblèmes centraux ajoutés | continuer la direction |
| `theme/theme.ts` | ✅ 5 palettes premium | — |
| `theme/themes.ts` | ✅ flags `flashy`, `BG_DEFAULT_THEME` | — |
| `ui/PremiumPurchaseModal.tsx` | ⚠️ célébration thématique OK mais **masquée** | bug 2 |
| `pages/ProfilePage.tsx` | ⚠️ peek + boutons OK mais **previewArt = 2e WebGL** | bug 1 ; aperçu pad taille réelle ✅ |
| `online/playerAnchor.ts` | ✅ persistance durable | vérifié device |
| `online/bootSync.ts` | ✅ restore anchor + recovery | vérifié device |
| `App.tsx` / `App.css` | ✅ `.theme-flashy` + restore anchor au boot | vérifier lisibilité device |

---

## 9. Première action recommandée pour le prochain agent

Les 3 bugs bloquants (§2) sont **déjà corrigés et vérifiés device**. Donc :

1. Lire ce fichier en entier. ✅
2. Attaquer le **système de cadres/ornements par thème** (§5, checklist P1) — le plus gros levier de « vrai travail de style » qu'Alex réclame. Aujourd'hui tous les cadres sont `rounded-2xl border-hairline` identiques ; chaque thème mérite sa bordure (arcs dorés Eclipse, rouages Tempus, angles électriques Storm, brume Phantom, rivets Emberforge).
3. Vérifier sur device la **lisibilité menu sur fonds flashy** (la capture d'Alex montrait Tempus limite) — ajuster `.theme-flashy` dans `App.css` si besoin.
4. Exploiter vraiment la **typo signature** par thème (§5, P2).
5. Builder + installer + vérifier sur device après chaque lot (cf. §6).

Bon courage. L'infra est solide, les bugs sont morts ; il reste à lui donner une âme. 🎨
