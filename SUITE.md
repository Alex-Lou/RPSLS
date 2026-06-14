# SUITE — où reprendre (post-session 2026-06-14)

> Fichier propre pour **reprendre** : continuer le DRY, savoir où en est le **bug Google**, et **installer/désinstaller** depuis le tel.
> Le `HANDOFF.md` (13/06) reste la réf générale (stack, persistance, règles) — mais son §9-A « comptes » est **FAIT**. Ici = l'état réel au 14/06.

---

## 0. TL;DR — état au 14/06
- Tout est **en prod** : `main` = `develop` = `feat/accounts` = `5c74631` (pushé, déployé Render). Working tree **propre**.
- **Comptes e-mail/mdp** : FINIS, durcis (revue adversariale, 4 trous corrigés), validés device. ✅
- **Google sign-in** : **DÉSACTIVÉ** (plante l'app — voir §3). Le bouton ne s'affiche plus.
- **DRY** : 3 wins faits + pushés (voir §1). Le reste = §1.
- **Splits <400 lignes** : à peine entamés (serveur `main.rs` 854→703). ~20 fichiers restants — voir §2.
- **Traductions** : FR 100%, autres langues incomplètes (reporté — voir §4).
- **Règles durables** (rappel, détail dans `HANDOFF.md` §4) : commits **sans trace IA**, auteur Alex, FR conventionnel · **build + test device AVANT push** · fichiers **<400 lignes** · `feat → develop → main` (Render déploie depuis `main`).

---

## 1. CONTINUER LE DRY

**Vérif après chaque lot** : `pnpm -C app exec tsc --noEmit` (client) · `cargo test -p rpsls-server` (serveur). Commit **par concern**, push **après test device** (les changements client n'apparaissent que dans un nouvel APK).

### ✅ Fait + pushé (NE PAS refaire)
- `app/src/i18n/format.ts` — `formatNumber`/`formatCompact` locale-aware (dédup `toLocaleString("fr-FR")` sur 7 sites).
- Decks starter/défaut centralisés dans `app/src/ranked/cards.ts` (`STARTER_COLLECTION`/`DEFAULT_RANKED_DECK`/`DEFAULT_ARENA_DECK`), importés par `store.ts` + `DeckManager.tsx`.
- `SEASON_REWARDS` (`engine/economy.ts`) **dérivé de** `RANK_TIERS` (`engine/rank.ts`, désormais exporté).

### ⏳ Reste à faire — chacun avec **test device** (touche des chemins sensibles)
1. **3 impls WebSocket transitoire → 1** (`online/accountAuth.ts`, `online/bootSync.ts`, `online/playerSync.ts::pushPlayerStateOneShot`). Même cycle connect→hello→state_loaded→sync→close. ⚠️ flux auth/sync online → device-verify obligatoire.
2. **`<ModalShell>`** : extraire overlay + panneau ressort + close-on-backdrop + focus-trap, recopiés dans chaque modal (`ui/PremiumPurchaseModal`, etc.). ⚠️ rendu visuel → device-verify.
3. **Fingerprint progression** (`online/playerSync.ts::syncFingerprint`) : dériver du payload `buildProgressFromPlayer` au lieu de relister les champs. ⚠️ change le déclenchement du sync (inclut history/avatar) → tester que ça ne sur-pousse pas.
4. **Helper Redis Upstash** (`crates/rpsls-server/src/player_state.rs`) : ~7 sites répètent `format!("{url}/pipeline") + bearer_auth + json(&cmds) + send`. Extraire `redis_pipeline(cmds) -> Option<Value>`. ⚠️ chemin **persistance argent** → mécanique strict + `cargo test` 23/23, redéploie.
5. **Barèmes éco TS↔Rust** : `app/src/engine/economy.ts` ⇄ `crates/rpsls-server/src/economy.rs` synchronisés à la main. Faire générer `economy.rs` depuis `economy.ts` (comme `cards_meta.json` via `scripts/gen-card-meta.mjs`). Plus gros, serveur.
6. **Montants bonus ×2** (client `auth/AuthGate.tsx` affichage ⇄ serveur `account.rs` autoritaire) — lié au point 5.

> Astuce : les wins « purs » (mécaniques, sans changement de comportement, sans rendu) sont faits. Le reste **modifie un comportement ou un rendu** → ne PAS le faire à l'aveugle, build + device d'abord.

---

## 2. SPLITS <400 LIGNES (« au fil de l'eau », mécanique + typecheck)

Fichiers >400l (hors `i18n/locales/*` = data, exemptés). **Du plus gros au plus petit** :

| Fichier | Lignes | Note |
|---|---|---|
| `app/src/pages/OnlinePage.tsx` | 2575 | god-component (WS + machine d'état + bot local + ~12 sous-composants) |
| `app/src/ranked/RankedGame.tsx` | 1768 | moteur de match inline |
| `app/src/pages/ProfilePage.tsx` | 1646 | 8 sections réglages + 3 modaux |
| `app/src/match/LanesMatchView.tsx` | 1459 | + 9 sous-composants |
| `app/src/pages/play/PlayGame.tsx` | 1437 | |
| `app/src/pages/play/PlayMenu.tsx` | 1089 | |
| `app/src/ranked/DeckManager.tsx` | 1030 | |
| `app/src/arena/ArenaGame.tsx` / `ArenaBoard` / `ArenaLaneSlot` | 909 / 861 / 859 | |
| `crates/rpsls-server/src/main.rs` | **703** | **entamé** (janitors sortis) → reste à extraire `handle_client_message` → `dispatch.rs` pour passer <400 |
| `app/src/store/store.ts` | 811 | extraire `migrate` (v7→v22) + `defaultPlayer` |
| `app/src/match/sharedMatchUI.tsx` · `arena/arenaRules.ts` · `ranked/cards.ts` · `pages/ShopPage.tsx` · `App.tsx` (605, extraire Splash/AppBackdropLayers) … | 600-800 | |

**Méthode** : extraire des sous-composants/helpers vers de nouveaux fichiers en **gardant l'API publique identique** (le fichier d'origine ré-exporte / importe), `tsc`/`cargo` vert, **un fichier = un commit**. À la fin du lot client : rebuild APK + test device + push.

---

## 3. 🔴 GOOGLE CONNEXION QUI PLANTE — situation + fix

**Symptôme** : appuyer sur « Continuer avec Google » **fait planter l'app** (crash natif Android : `DEVELOPER_ERROR` + `TransactionTooLargeException`).

**Pourquoi c'est un crash natif** : le flux passe par `tauri-plugin-google-auth` (Android Credential Manager). L'erreur vient du **natif** → **non rattrapable en JavaScript** (un `try/catch` ne l'attrape pas). La seule façon de stopper le crash = **ne pas afficher le bouton** tant que la config OAuth n'est pas bonne.

**Ce qui est en place** :
- ✅ **Bouton désactivé** : `app/.env` (gitignored) → la ligne `VITE_GOOGLE_CLIENT_ID=...` est **commentée**. Donc `isGoogleAvailable()` = false, bouton caché. Réversible en décommentant.
- ✅ **Serveur prêt** : `crates/rpsls-server/src/google_auth.rs` vérifie réellement les ID tokens (RS256/JWKS). Inerte tant que personne n'envoie de token.
- ✅ **Client câblé** : `app/src/online/googleProvider.ts` (s'auto-enregistre SI `VITE_GOOGLE_CLIENT_ID` est défini).

**La VRAIE cause = config Google Cloud incomplète** (`DEVELOPER_ERROR` = l'app n'est pas reconnue). À régler dans la **Google Cloud Console** :
1. **Client OAuth Android** : créer (ou vérifier) un client OAuth de type **Android** avec :
   - package name = **`com.alex.rpsls`**
   - **empreinte SHA-1** du keystore qui **signe l'APK debug**. La récupérer :
     ```
     keytool -list -v -keystore "$env:USERPROFILE\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android
     ```
     → copier la ligne `SHA1:` dans le client OAuth Android.
2. **Écran de consentement OAuth** : configuré + ton e-mail ajouté en **utilisateur de test** (si l'app est en mode « Testing »).
3. **Client OAuth Web** : déjà créé (`353076917557-...apps.googleusercontent.com`) — c'est l'`aud` du token. Présent dans `render.yaml` (`GOOGLE_OAUTH_CLIENT_IDS`) et serait l'`app/.env` (`VITE_GOOGLE_CLIENT_ID`).

**Pour réactiver une fois la config faite** : décommenter la ligne dans `app/.env` → rebuild APK → **tester Google sur le device** AVANT de considérer que c'est bon (le crash est device-only).

> Détail mémoire agent : `accounts-system.md`. Le serveur étant prêt + le client câblé, il n'y a **probablement aucun code à écrire** — juste la config console + le SHA-1.

---

## 4. TRADUCTIONS (reporté par Alex)

`t(clé)` = `langue[clé] ?? en[clé] ?? clé` → une clé absente **retombe en anglais**. Couverture actuelle (réf = `en` 1067 clés) :
- **`fr` : 0 manquante (100%)**.
- `es`/`de`/`it`/`pt`/`ru`/`tr` : **335 manquantes** · `nl` : 595 · `zh`/`ja`/`ar`/`ko`/`hi`/`pl` : **~950** (quasi non traduites).

→ En changeant de langue, des menus s'affichent en anglais = **ces trous** (pré-existant, pas une régression). **À faire** : passe de traduction (parallélisable, 1 langue/agent ; `es/de/it/pt` en priorité) + **test de couverture** (set-diff de chaque locale vs `en`, échoue le build sur clé manquante). Lister les manquantes :
```
cd app/src/i18n/locales
grep -oE '^\s*"[^"]+":' en.ts | grep -oE '"[^"]+"' | sort -u > /tmp/en.keys
grep -oE '^\s*"[^"]+":' es.ts | grep -oE '"[^"]+"' | sort -u | comm -23 /tmp/en.keys -
```

---

## 5. 📱 INSTALLER / DÉSINSTALLER DEPUIS LE TEL (branché)

**Prérequis** : tel branché en USB, **débogage USB activé** (Options développeur). Si `adb` n'est pas sur le PATH, utilise le chemin complet :
`C:\Users\34643\AppData\Local\Android\Sdk\platform-tools\adb.exe` (remplace `adb` ci-dessous par ce chemin, ou ajoute `platform-tools` au PATH).

Package = **`com.alex.rpsls`**.
APK debug arm64 (après build) = `app/src-tauri/gen/android/app/src/main/...` → `app/src-tauri/gen/android/app/build/outputs/apk/arm64/debug/app-arm64-debug.apk`.

```powershell
# 1. Vérifier que le tel est vu (et AUTORISÉ — sinon accepter le popup sur le tel)
adb devices            # doit afficher : <serial>   device   (pas "unauthorized")

# 2a. INSTALLER en GARDANT tes données (compte + localStorage préservés) — pour tester une maj
adb install -r "app\src-tauri\gen\android\app\build\outputs\apk\arm64\debug\app-arm64-debug.apk"

# 2b. INSTALLER PROPRE / état vierge (WIPE localStorage → repart à l'écran d'auth, re-login requis)
adb uninstall com.alex.rpsls
adb install   "app\src-tauri\gen\android\app\build\outputs\apk\arm64\debug\app-arm64-debug.apk"

# 3. DÉSINSTALLER complètement
adb uninstall com.alex.rpsls

# 4. RELANCER proprement (force-stop + démarrage)
adb shell am force-stop com.alex.rpsls
adb shell monkey -p com.alex.rpsls -c android.intent.category.LAUNCHER 1
```

**À retenir** :
- `-r` = **garde les données** (le compte reste connecté). `uninstall` puis `install` (ou `install` sans `-r`) = **wipe** → tu repars en invité, reconnecte-toi (le compte est sur le serveur, rien de perdu).
- ⚠️ **Piège build Tauri** (détail `HANDOFF.md` §2) : le frontend est embarqué dans `libapp_lib.so`, PAS dans `assets/`. Un build qui ne **recompile pas le `.so`** (juste `dist`→`assets`) **n'embarque PAS** tes changements. Bon enchaînement : `tauri android build --apk --target aarch64` (échoue au symlink Windows, normal) → copier `target/aarch64-linux-android/debug/libapp_lib.so` vers `app/src-tauri/gen/android/app/src/main/jniLibs/arm64-v8a/` → `gradlew assembleArm64Debug -x rustBuildArm64Debug`.

---

## 6. Ordre conseillé pour reprendre
1. **DRY restant** (§1) — point par point, build + device.
2. **Splits** (§2) — `main.rs` dispatch d'abord (serveur, cargo-vérifié), puis client du plus gros au plus petit.
3. **Google** (§3) — config console + SHA-1, puis réactiver + test device.
4. **Traductions** (§4) — passe parallèle + garde de couverture.
