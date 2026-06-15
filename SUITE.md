# SUITE — où reprendre (mis à jour 2026-06-15)

> Fichier de **reprise** : l'état réel + ce qui reste. `HANDOFF.md` (racine) = réf générale (stack, persistance, build, règles).
> ⚠️ MàJ 15/06 : la **vague refactor** (splits en dossiers) + plusieurs DRY sont **FAITS** depuis le 14/06 — sections ci-dessous à jour.

---

## 0. TL;DR — état au 15/06
- **Base déployée Render** = `main` = `develop` — la **refonte est mergée + déployée + device-validée le 15/06**. Serveur live `/health` 200 ✅.
- **Comptes e-mail/mdp** : FINIS, durcis (revue adversariale), validés device. ✅
- **Google sign-in** : serveur (`google_auth.rs`, RS256/JWKS) + client (`googleProvider.ts`) **câblés** mais **DÉSACTIVÉ** (crash natif tant que la config OAuth console n'est pas faite — §3). **Aucun code à écrire**, juste la config console + SHA-1.
- **Refonte (splits)** : ✅ **serveur 100%** (`main.rs`/`dispatch`/`hello` + `player_state/`/`lanes_engine/`/`account/`) + **client vague device-free** (`store/`, `arenaTypes/`, `arenaRules/`, `sharedMatchUI/`) — **mergés + déployés + device-testés** (sync/persist OK, #3 pas de boucle, **0 perte / 0 doublon / 0 crash**). `cards.ts` skippé (table de données). **Reste = vague device-needed (13 god-components UI)** — §2.
- **DRY** : ✅ **TOUS faits** — #2 (ModalShell), #3 (fingerprint dérivé), #4 (helper Redis), #5 (éco générée), #6 (bonus single-source) ; #1 (WS transitoire) **laissé tel quel** (divergence justifiée auth/anti-doublon/Promise — décision). §1.
- **Traductions** : FR 100%, autres incomplètes (reporté — §4).
- **Règles durables** (détail `HANDOFF.md` §4) : commits **sans trace IA**, auteur Alex, FR conventionnel · fichiers **<400 lignes** · `feat → develop → main` (Render déploie `main`) · **build + device-test AVANT merge vers `main`**.

---

## 1. DRY — état

**Vérif après chaque lot** : `pnpm -C app exec tsc --noEmit` (client) · `cargo test -p rpsls-server` (serveur).

### ✅ Fait + poussé (NE PAS refaire)
- `app/src/i18n/format.ts` — `formatNumber`/`formatCompact` locale-aware.
- Decks starter/défaut centralisés dans `app/src/ranked/cards.ts`.
- `SEASON_REWARDS` (`engine/economy.ts`) **dérivé de** `RANK_TIERS` (`engine/rank.ts`).
- **#2 `<ModalShell>`** (`app/src/ui/ModalShell.tsx`) : overlay + panneau ressort + close-backdrop partagés.
- **#5 Barèmes éco GÉNÉRÉS** : `scripts/gen-economy-meta.mjs` → `crates/rpsls-server/economy_meta.json` (`include_str!` dans `economy.rs`). **Relancer le générateur après toute modif de barème TS** (`economy.ts`).
- **#6 Bonus de bienvenue single-source** dans `economy.ts` (affichage `AuthGate` ⇄ don serveur `account/bonus.rs`).
- **#4 Helper Redis Upstash** (`player_state/redis.rs`) : `pipeline_send(cmds) -> Option<reqwest::Result<Response>>` centralise le POST `/pipeline` (appliqué à `delete_player`/`get_raw`/`set_nx`/`del` ; `save` laissé explicite — early-return config + logging body d'erreur). **Comportement identique** (warns `set_nx` + logique NX/parse inchangés). `cargo test` 24/24, clippy propre. Commit `0dd3286` (sur `refactor`, inerte = behavior-identical, déploiera au prochain merge `main`).

- **#3 Fingerprint progression** (`online/playerSync.ts::syncFingerprint`) : **dérivé** du payload `buildProgressFromPlayer` (zéro drift — tout champ ajouté au payload est auto-couvert) ; `updatedAt`/`seasonStartedAt`/`history` neutralisés (sinon push infini/inutile). Commit `5841217` (sur `refactor`). ⚠️ **à device-tester** : un match/achat pousse bien, PAS de push en boucle.
- **#1 WS transitoire** : **laissé tel quel (décision Alex 15/06)**. L'extraction sûre est faite (`resolveWsUrl`/`helloFrame`) ; le reste est une **divergence justifiée** — `accountAuth` (Promise + credential + sécu), `bootSync` (récup anti-doublon claim-mismatch = intégrité données, device-test-rare), `pushPlayerStateOneShot` (trivial). Forcer un harness = factorisation prématurée sur des chemins critiques pour ~0 gain de lignes.

> **DRY terminé** (#1→#6 traités). Reste produit = vague de splits device-needed, éco §9-B, Google, traductions, features §8-C — voir §6.

---

## 2. SPLITS <400 LIGNES

### ✅ Serveur — TOUT fait (cargo vert)
`main.rs` (762→317) → `dispatch.rs` + `hello.rs` · `player_state.rs` → dossier `player_state/` (mod+redis) · `lanes_engine.rs` → dossier `lanes_engine/` (mod+phases) · `account.rs` → dossier `account/` (validation/hashing/bonus/store/handlers). Seul reste >400 du Rust : `rpsls-core/constellation.rs` (404, sous plafond 600 — non prioritaire).

### ✅ Client — vague DEVICE-FREE faite (sur `refactor`, attend device-test + merge)
| Fichier | Avant → après | Note |
|---|---|---|
| `store/store.ts` | 811 → 7 fichiers | barrel = **fichier d'entrée gardé** (50 importateurs `store/store`) |
| `arena/arenaTypes.ts` | 664 → dossier `arenaTypes/` (6) | dossier+index, 28 conso |
| `arena/arenaRules.ts` | 775 → dossier `arenaRules/` (5) | cycle `arenaRules↔arenaCombat` préservé (heroCreature = feuilles) |
| `match/sharedMatchUI.tsx` | 798 → dossier `sharedMatchUI/` (9) | 10 conso |
| `ranked/cards.ts` | **SKIPPÉ** | ~85% table plate `CARDS` (~635l, resterait >600) + piège `gen-card-meta.mjs` parse en **texte** → casserait l'éco serveur en silence |

**Méthode** : déplacement **verbatim** (corps identiques) → dossier + barrel (`index.ts` OU fichier d'entrée gardé selon comment les conso importent) → `tsc --noEmit` + `vite build` + diff logique vs HEAD. Tout <400.

### ⬜ Client — vague DEVICE-NEEDED (reste, exige tes cycles device)
UI rendus, **du moins au plus risqué** : `PlayMenu` (1089) · `ShopPage` (683) · `DeckManager` (1030) · `MatchPrepScreen` (640) · `ArenaLaneSlot`→`ArenaBoard`→`ArenaGame` (859/861/909, **high**) · `PlayGame` (1437) · `ArenaPlanPhase` (680) · `LanesMatchView`+`MatchPrepScreen`→`OnlinePage` (1459/2575, **high**) · `ProfilePage` (1646) · `RankedGame` (1768, **high**).
- **2 décisions avant exécution** : **RankedGame** Plan A (extraire `useRankedMatch`, closures/timing fragiles) requis pour <600 ; **ArenaGame/OnlinePage** = livrer <600 sans forcer <400 (l'extraction hook serait invasive/non-verbatim).
- ⚠️ Les 3 high-risk (OnlinePage/RankedGame/ArenaGame) : `tsc`+`build` ne prouvent PAS la non-régression timing/refs → **playtest device obligatoire** après chacun.
- `i18n/locales/*` = data, **exemptés**.

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
APK debug arm64 (après build) = `app/src-tauri/gen/android/app/build/outputs/apk/arm64/debug/app-arm64-debug.apk`.

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
- ⚠️ **Piège build Tauri** (détail `HANDOFF.md` §2) : le frontend est embarqué dans `libapp_lib.so`, PAS dans `assets/`. Le `RPSLS_BUILD_INSTALL.bat` (racine bureau) fait la procédure correcte (`tauri android build` → copie `.so` → `gradlew` → install). Son étape `pnpm build` (`beforeBuildCommand`) rebuild bien le frontend depuis les sources.

---

## 6. Ordre conseillé pour reprendre
1. ✅ **Refonte mergée `refactor → develop → main` + déployée + device-testée (15/06)** : splits serveur+client + DRY #3/#4. Sync/persist validés en live (#3 pas de boucle, 0 perte/doublon/crash). #1 laissé (décision).
2. **➜ PROCHAIN : vague device-needed** (§2) — low-risk d'abord (`PlayMenu`/`ShopPage`/`DeckManager`/`MatchPrepScreen`), puis trancher les 2 décisions (RankedGame Plan A, ArenaGame/OnlinePage <600), puis high-risk avec playtest. Chaque split = build + device-test avant merge `main`.
5. **Google** (§3) — config console + SHA-1, réactiver + test device.
6. **Éco serveur-autoritaire** (`HANDOFF.md` §9-B) — gros chantier serveur (endpoints validés `buy_pack`/`craft`/`grant_match_reward`/`claim`).
7. **Features spécifiées non construites** (`HANDOFF.md` §8-C) : livre de recettes fusion, carte « Brume », fusions doubles/triples, cartes « Sur Coup », tuto, bundle thème.
8. **Traductions** (§4) — passe parallèle + garde de couverture.
