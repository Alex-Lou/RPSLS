# HANDOFF — RPSLS / Constellation (à lire EN PREMIER, agent suivant)

> ⚠️ **MISE À JOUR 2026-06-15 → voir `SUITE.md` (racine) pour l'état RÉEL et l'ordre de reprise.**
> Le §9-A « comptes » de ce fichier est **FAIT + déployé** (e-mail/mdp finis, durcis, validés device ; Google câblé mais désactivé). Le §9-B éco reste à faire. Ce HANDOFF reste la réf générale (stack, persistance, build, règles) mais ses sections « prochaine tâche = comptes » (§0, §8-A) sont **périmées**.
> Depuis : **splits serveur faits** (`player_state/`/`lanes_engine/` sur `main`, `account/` sur `refactor`), **vague refactor client device-free faite** (`store/`/`arenaTypes/`/`arenaRules/`/`sharedMatchUI/` sur la branche `refactor`, attend device-test + merge), **DRY #2/#5/#6 faits**. Le « reste à faire » consolidé est dans **`SUITE.md` §1-§2 + §6**.

> Mis à jour : 2026-06-13. But : que tu sois productif **sans cramer des tokens** à re-explorer le repo. Lis les §1–§4 avant de toucher quoi que ce soit.

---

## 0. TL;DR — où on en est
- **Jeu** RPSLS (pierre-papier-ciseaux-lézard-spock) devenu un vrai **CCG** multi-modes, app **Tauri Android** (React/TS), serveur **Rust** sur **Render** + **Upstash Redis**.
- **Base de départ** : pars de **`develop`** = `main` (déployé ; **redeploy Render déclenché cette session** pour le cap collection + la fondation éco). Le lot léger (#23/#27/#8 + anim forge) est **promu**. **➜ Crée une branche neuve `feat/accounts` depuis `develop`.** Plus aucun WIP en attente (`_screen_debug.png` racine = junk non tracké, ignore-le). Détail des derniers commits en §7.
- **Gros chantiers EN COURS** : (A) **économie serveur-autoritaire anti-triche** (β, fondation faite), (B) **comptes e-mail/mot de passe + bonus de bienvenue + mode invité** (designé, modal mocké, pas codé). Voir §9.
- **Workflow Alex** : il **build l'APK lui-même** et teste sur tel → toi tu **codes + typecheck**, tu dis « prêt à builder », tu **commit/push seulement après son OK**. Voir §4.

### 🎯 PROCHAINE TÂCHE → voir `SUITE.md` §6 (ordre de reprise à jour 15/06)
~~Comptes~~ **FAITS** (e-mail/mdp déployés + validés device). Ordre actuel (détail `SUITE.md`) : (1) merger `refactor` après device-test, (2) DRY #4 helper Redis (serveur, sans device), (3) vague de splits device-needed (13 UI), (4) Google config, (5) éco serveur-autoritaire §9‑B, (6) features §8‑C, (7) traductions. La roadmap comptes ci-dessous (§9‑A) reste comme **archive de référence** (ce qui a été construit).

---

## 1. ⚡ ÉCONOMISER LES TOKENS : utilise GRAPHIFY (ne lis PAS tout le repo)
Un graphe de code existe : **`graphify-out/graph.json`** (+ `manifest.json`). **Interroge-le** au lieu d'ouvrir 40 fichiers.
- **Le graphe DATE (Jun 11)** → commence par `graphify update .` (SÛR : un `.graphifyignore` à la racine est lu À LA PLACE de `.gitignore` ; après update, resauve le manifest si besoin).
- Commandes : `graphify query <terme>`, `graphify explain <symbole>`, `graphify path <A> <B>`, `graphify affected <fichier>`.
- Binaire : `graphify.exe` (env Python) — chemin probable `C:\Users\34643\Desktop\Brol\Graphify\venv` (à confirmer si la commande `graphify` n'est pas sur le PATH).
- Réflexe : **query d'abord, lecture ciblée ensuite**. Ne `Read` un fichier que quand tu sais lequel + quelle zone.

---

## 2. 🔨 BUILD + INSTALL APK sur device — PROCÉDURE EXACTE (piège majeur)
**Piège critique** : Tauri Android **EMBARQUE le frontend `dist` DANS `libapp_lib.so`** (compressé brotli) et le sert **depuis le `.so`**, PAS depuis `gen/android/.../assets/`. Donc « copier dist→assets + gradlew » **ne met JAMAIS à jour** le front servi.

Procédure correcte :
1. `$env:ANDROID_NDK_ROOT=$env:NDK_HOME; npx tauri android build --debug --apk --target aarch64`
   → **échoue au symlink Windows** MAIS le `.so` est compilé à `target/aarch64-linux-android/debug/libapp_lib.so`.
2. Copier ce `.so` → `app/src-tauri/gen/android/app/src/main/jniLibs/arm64-v8a/libapp_lib.so`.
3. `gradlew assembleArm64Debug -x rustBuildArm64Debug`.
4. `adb uninstall com.alex.rpsls` puis `adb install <apk>`. ⚠️ **`adb install` SANS `-r` (ou un uninstall) WIPE le localStorage** (cf. persistance §6).
5. `adb shell am force-stop com.alex.rpsls && adb shell am start com.alex.rpsls/...`.
- En pratique **Alex lance `RPSLS_BUILD_INSTALL.bat`** lui-même. Vérif du front servi via **WebView DevTools** (Runtime.evaluate). `adb shell input tap` est **BLOQUÉ** (INJECT_EVENTS SecurityException) → pas d'auto-nav UI.

---

## 3. ✅ COMMANDES DE VÉRIF (typecheck / build)
- **Client TS** : `cd app && ./node_modules/.bin/tsc --noEmit -p tsconfig.json` (⚠️ `rtk tsc` ÉCHOUE — tsc pas global ; `npx tsc` ok aussi).
- **Serveur Rust** : `cargo check -p rpsls-server` (rapide). Tests : `cargo test -p rpsls-server`.
- **Toujours** typecheck après chaque lot. `TSC_EXIT=0` / `CARGO_EXIT=0` avant de dire « prêt ».

---

## 4. WORKFLOW & RÈGLES DURABLES (NE PAS enfreindre)
- **Confirmer avant push** : build+install device → **ATTENDRE l'OK d'Alex** → commit/push APRÈS. Ne JAMAIS auto-push.
- **Commits SANS trace IA** (demande Alex) : pas de `Co-Authored-By`, pas de « Generated with… », pas de 🤖. Auteur = Alex (git user). Messages FR, style conventionnel.
- **Architecture (dure)** : SOLID / DRY / **fichiers < 400 lignes** / dispatch. « Au fil de l'eau » : à chaque fichier touché, **extraire** une tranche vers <400 (mécanique + typecheck), **PAS de big-bang**. Features = **nouveaux fichiers**.
- **Anims** : zéro `repeat: Infinity` pour du FX transitoire, zéro timer non nettoyé (clearTimeout + AnimatePresence). `motion/react` : un `spring` NE PEUT PAS animer un tableau de keyframes (il snappe) → transition `duration` pour les keyframes.
- **Échelle git** : `feat/* → develop → main`. **Render déploie depuis `main`** (auto sur push). Cron Alex garde Render éveillé en permanence (pas de souci cold-start).
- **Mémoire agent** : `~/.claude/.../memory/MEMORY.md` + fichiers liés (constellation-pro, data-persistence, economy-server-authoritative, etc.) — riche, à jour. Lis-la.

---

## 5. STACK & STRUCTURE
**Client** : Tauri 2.11 (Android aarch64), React + TypeScript + Vite, **Zustand** (persist localStorage), **motion/react** (framer-motion), Tailwind. pnpm 9.12.
```
app/src/
├── arena/    ← Constellation PRO (mode CCG vs-CPU : lanes + mana 1→8 + créatures). LE gros morceau actif.
├── ranked/   ← Constellation RANKED (CCG mana 1→4) + cards.ts (87 cartes) + DeckManager + Shop
├── engine/   ← game (RPSLS de base, Move/AiMood), economy.ts (RÈGLES éco), rank, lanesEngine, leveling
├── match/    ← LanesMatchView, LocalLanesGame (online lanes)
├── online/   ← online.ts (PlayerProgress wire), playerSync.ts, bootSync.ts, leaderboard, playerAnchor
├── pages/    ← *Page.tsx (Play, Shop, Profile, History, Online…)
├── store/    ← store.ts (LE state + persist + migrate v22), storeMigrationGuard (⚠️ NUL bytes, éditer via Edit)
├── i18n/locales/ ← en.ts + fr.ts (clés plates "ranked.cards.X.desc", "arena.cards.X.desc")
└── theme/    ← theme.ts, themes.ts, fonts.ts (12 palettes HUD, fonts @fontsource bundlées)
```
**Serveur** : `crates/rpsls-server/src/` — `main.rs` (WS + handlers), `protocol.rs` (messages ⇄ `app/src/online/online.ts`, GARDER EN SYNC), `player_state.rs` (Redis : load/save `PlayerProgress`), `auth.rs` (claim token TOFU), `economy.rs` (NOUVEAU, règles éco), `lobby/session/match_engine/lanes_engine`. Déploiement = **`render.yaml`** (Blueprint Docker, branche `main`, autoDeploy).

---

## 6. PERSISTANCE DES DONNÉES (CRITIQUE — « rien perdre pour le joueur »)
Deux couches : **localStorage** (Zustand persist, clé `rpsls-app-state` v22 + side-channel `rpsls-history`) — **WIPÉ à chaque réinstall** — et **Redis** (`PlayerProgress`) = **ce qui survit au réinstall**. Identité durable = anchor Tauri (id+claimToken).
- ✅ Persisté DB : xp, rankLp, éclats/poussière/stars, stats, **cardCollection** (union-merge), cardMastery, codex, quêtes, **rankedDeck + arenaDeck**, premium sets, season, streak, classeLp+stats, **arenaStats**, **history+voies**, cosmetics.
- ✅ **Caps `card_collection`/`card_mastery` relevés 64→256** (sinon ~79 cartes tronquées = perte) — **promu sur `main` + déployé cette session**. (Le reste de la struct — `arena_deck`/`arena_*`/`history` — était déjà déployé via `fcaf310`.)
- Merge : `mergeServerState` (playerSync.ts) restaure decks sur **install fraîche** (`!syncedAt`) ; history **restore-only-si-local-vide** (jamais d'écrasement).
- Réf complète : memory `data-persistence.md`.

---

## 7. DERNIÈRE PROMOTION (cette session, 2026‑06‑13) — sur `develop` + `main` (déployé)
Lot validé par Alex + correctif persistance + fondation éco : **commités proprement** (zéro trace IA, auteur Alex), **mergés `feat/fusion-card-art` → develop → main (FF)**, **poussés** → **redeploy Render déclenché**. Les commits :
- **#27 art cartes fusion** (`cards.ts`) : 7 fusions wirées (BASTION/AVALANCHE/SOURCE VITALE/OMNISCIENCE/cocon/APOCALYPSE/IMPOSTEUR.png), casse exacte (Android sensible).
- **#23 couleurs strip** (`ArenaHeroStrip.tsx` + `ArenaSpellQueueChip.tsx`) : joueur = **bleu (sky)**, adversaire = **rouge (rose)**.
- **#8 Cadence** (`RankedGame.tsx` + `fr/en.ts`) : effet relatif `MAX_MANA+1` (au lieu d'un `5` en dur).
- **Anim forge « Récupérer »** (`ArenaForge.tsx` composant `RecoverBurst` one‑shot : anneau or + cœur ambre + 12 motes biaisées **vers le bas** = rappel vers la main ; + wiring `ArenaBoard.tsx`/`ArenaGame.tsx`). **Déclenchée UNIQUEMENT** sur la récup d'une carte **FUSIONNÉE** (« ✨ Récupérer ») — une simple reprise de dépôt reste **silencieuse**. Vérifiée live device (chunk `index-TieQ5hOX.js`).
- **#13 cap collection/maîtrise 64→256** (`player_state.rs`) : **changement SERVEUR, déployé**.
- **Éco Incrément 1 (fondation)** : `scripts/gen-card-meta.mjs` → `crates/rpsls-server/cards_meta.json` + `crates/rpsls-server/src/economy.rs` (méta + barèmes) + `mod economy` dans `main.rs`. **Pur, additif, inerte, test vert** — prêt à servir au **bonus de bienvenue** (§9‑A étape 4).
- `_screen_debug.png` (racine) = **junk non tracké, NE PAS committer**.
- ✅ `feat/fusion-card-art` a rempli son rôle. **Le prochain chantier (comptes) part d'une branche neuve `feat/accounts` depuis `develop`** (§9‑A). Pour la suite éco, une branche `feat/server-economy` dédiée reste pertinente (§9‑B).

---

## 8. CHANTIERS — EN COURS / À FAIRE
### A. ✅ COMPTES + bonus de bienvenue + mode invité — **FAIT + déployé** (e-mail/mdp ; Google câblé mais désactivé, config console pending — `SUITE.md` §3). Roadmap construite archivée en **§9‑A**.
### REFACTOR (en cours, branche `refactor`) — splits <400l : serveur fait, **vague client device-free faite** (attend device-test + merge FF), vague device-needed (13 UI) reste. **État + ordre dans `SUITE.md` §2 + §6.**
### B. 🎯 Économie SERVEUR-AUTORITAIRE anti-triche (β) — **prochain gros chantier serveur** ; fondation faite (§7). Endpoints validés. Voir **§9‑B**.
### C. Pendings (spécifiés, NON construits) :
- **Livre de recettes** (fusion) : découvrir recettes en jouant → craft (dust+éclats SEULEMENT, jamais argent réel ; stars = accélérateur) → carte deckable. 1re découverte = anim « NOUVELLE RECETTE ». Memory `fusion-recipe-book.md`.
- **Carte « Brume »** (anti-augure, rare, voile la main 2 tours + dissipe une révélation active).
- **Lot de fusions** doubles/triples/quadruples (via chaînage forge).
- **Cartes « Sur Coup »** (#16) : type rare qui se résout AVANT la fin du tour (sauve : mana/vie/pioche). À clarifier le timing avec Alex.
- **Tuto** (à faire EN DERNIER) : hook reward placeholder (+50 éclats + 1 pack en fin de tuto).
- **Bundle par thème** (boutons/bracket thémés + slide-FX par apparence). Memory `theme-bundle-ux.md`.

---

## 9. CHANTIERS DÉTAILLÉS

### 9‑A. 🎯 COMPTES + BONUS + INVITÉ — **PRIORITÉ, COMMENCE ICI**
But : inscription/connexion (e‑mail+mdp), redirection, BDD compte, **liaison de la progression**, et le **bonus de bienvenue**. **Sécu‑critique** (mots de passe + argent réel) → carré, par incréments compilés. Transport déjà **wss (TLS)**.

**Étapes séquencées :**
1. **Backend — ressource compte + Argon2** : `crates/rpsls-server` — Redis `account:{email_normalisé}` → `{ email, password_hash, player_id, created_at, verified:false }`. Hash **Argon2id + sel** (ajouter la crate `argon2` au `Cargo.toml`). Normaliser l'e‑mail (trim + lowercase). Stocker le hash, **jamais** le mot de passe.
2. **Backend — protocole** (`protocol.rs` ⇄ `app/src/online/online.ts`, GARDER EN SYNC) : `Signup{email,password}`, `Login{email,password}` ; réponses `AuthOk{player_id, state}` / `AuthError{code}`. Codes **génériques** (`invalid_credentials`, `email_taken`, `weak_password`, `rate_limited`) — **jamais** « cet e‑mail existe » (anti‑énumération). **Anti‑bruteforce** : rate‑limit par e‑mail+IP (réutiliser le pattern throttle de `main.rs`).
3. **Backend — handlers** (`main.rs`) : *signup* = e‑mail libre ? → hash → créer `account` lié au **player_id de la session invitée courante** → renvoyer AuthOk + progression. *login* = charger account par e‑mail → vérifier Argon2 → renvoyer le player_id du compte + sa progression (cross‑device natif).
4. **Backend — bonus de bienvenue** : à un signup RÉUSSI & nouveau, accorder le pack (monnaies + cartes via `economy.rs`) à la `PlayerProgress` du player_id + flag **`welcomed:true`** → **1×/compte**, infarmable. Montants à valider Alex : **300 éclats · 150 poussière · 30 stars · 14 cartes** (6 starters + heist/supernova/seve/jet‑caillou que les decks par défaut référencent + prescience/riposte/curse/gaia). ⚠️ corrige au passage : les decks par défaut référencent des cartes **hors** `cardCollection`.
5. **Client — store auth + flux** : actions `signup/login` (envoi WS → à la réponse, **bascule l'identité** invité→compte : adopte player_id + progression). Au lancement : invité → **modal/nudge** vers l'inscription. **Gate** : économie / online / sauvegarde‑cloud = **compte requis** ; invité = vs‑CPU + parcourir cartes **seulement**.
6. **Client — modal React** : cosmique / verre dépoli / néon violet‑fuchsia + bandeau **bonus**, calé sur le **thème actif**, animé (étoiles, halo, focus glow). Onglets Connexion/Inscription + « Continuer en invité (sans bonus) ». *(Le mock chat ne reflète pas l'aspect réel — coder pour de vrai.)*
7. **Migration** : joueurs anonymes existants → inviter à créer un compte pour **garder** leur progression (lier leur player_id) ; bonus = **nouveaux comptes uniquement** (ne pas gonfler l'éco).

**Décisions par défaut** (sauf avis Alex) : vérif e‑mail **différée** (champ `verified` prévu ; service SMTP/SendGrid + « mdp oublié » plus tard) ; **invité autorisé sans bonus**. ⚠️ e‑mail = **donnée perso** (Alex disait « rien de perso ») → OK pour un compte *fonctionnel*, mais sécu sérieuse obligatoire.

### 9‑B. ÉCONOMIE SERVEUR‑AUTORITAIRE (β) — **APRÈS les comptes**
**Vérité dure** : app offline‑first sur device du joueur → seul ce qui est **validé serveur** est sûr. Un « plafond de gain par sync » NE SUFFIT PAS (gros one‑shots légitimes : codex 1500, saison 700, palier = +10 cartes). → **le serveur valide chaque ÉVÉNEMENT** (récompense match, buy_pack, craft, claim codex/saison/quête), pas le solde brut.
1. ✅ **Fondation** (FAIT, §7) : `gen-card-meta.mjs` + `economy.rs` (méta cartes + barèmes, miroir de `app/src/engine/economy.ts` — À GARDER EN SYNC).
2. **Endpoints validés** (protocol.rs + main.rs + player_state) : `buy_pack` (serveur tire via `rand` + débite PACK_COST), `craft_card`, `grant_match_reward`, `claim_codex/season/quest`. Atomiques. Solde + collection deviennent **autoritaires en Redis**.
3. **Migration « trust‑on‑first‑sync then lock »** : flag `economy_migrated` ; 1er sync post‑deploy → adopte le solde légitime, puis **rejette/clamp** les valeurs brutes éco du client.
4. **Client = cache** : `mergeServerState` → **serveur‑gagne** sur l'éco (fini max/union) ; mutations via endpoints ; offline = file d'events validée au retour.
- Memory : `economy-server-authoritative.md`.

---

## 10. PIÈGES TECHNIQUES (DURABLE)
- **Réinstall APK WIPE le localStorage** → tout doit survivre via Redis (§6). Bonus 1×/compte verrouille l'abus.
- `storeMigrationGuard.ts` contient des **NUL/bytes de contrôle** (test localStorage corrompu) → git le voit « Bin », **éditer via Edit** (préserve les NUL), jamais sed.
- `.md` racine non trackés (CARTES-NOUVELLES/PROMPTS-ICONES…) → `rm` = perte définitive. Prudence sur les commandes destructives.
- `color-mix(in oklab, var(--theme-*) …)` + transform/opacity **marchent** en WebView Chromium (App.css l'utilise partout).
- CardId est une **union FIXE** dans `rankedTypes.ts` → toute nouvelle carte doit y être ajoutée. `CARDS` typé `Record<CardId, RankedCard>`.
- `arenaSupported(id) = id in PRIORITY_TABLE` (arenaCardEffects) → gate `isDeckable`. Les passifs/fusion en sont exclus.
- Load-test : 1000 matchs concurrents, 0 erreur, ~60ms p50 (réseau).

---

## 11. POINTEURS RAPIDES
- **State + persist + migrate** : `app/src/store/store.ts`. **Sync** : `app/src/online/playerSync.ts` + `bootSync.ts`. **Wire** : `app/src/online/online.ts` ⇄ `crates/rpsls-server/src/protocol.rs`.
- **Cartes** : `app/src/ranked/cards.ts` (defs) + `rankedTypes.ts` (union) + i18n `fr/en.ts` (`ranked.cards.X.*` + `arena.cards.X.desc`).
- **Éco règles** : client `app/src/engine/economy.ts` ⇄ serveur `crates/rpsls-server/src/economy.rs` (SYNC manuel).
- **Arena (Pro)** : `app/src/arena/` — `ArenaGame.tsx` (orchestrateur), `arenaRules.ts` (moteur pur), `arenaCardEffects.ts` (dispatch sorts), `arenaTypes.ts`.
- **Docs design** : `docs/CONSTELLATION_PRO_DESIGN.md`, `docs/CONSTELLATION_PRO_ROADMAP.md`, `docs/FUSIONS_DESIGN.md`, `docs/CCG_EXPERT_REDESIGN.md`.
