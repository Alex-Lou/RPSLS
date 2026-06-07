# Audit Final — Sécurité, Erreurs, Code Quality

**Date:** 2026-06-07  
**Scope:** `app/src` (React + Tauri frontend)  
**Méthode:** Scan automatisé (findstr + PowerShell) + revue manuelle des fichiers clés.

---

## 1. ⚠️ SECURITY BREACHES — Réelles et exploitables

### 1.1 `alert()` en production — blocage thread Android (CRITICAL UX + Security)
**Fichier:** `app/src/pages/ProfilePage.tsx` — lignes 151, 157, 172, 180, 191, 199  
**Problème:** 6 appels à `alert()` qui bloquent le thread JS natif sur Android WebView.  
**Exploitation:** Un attaquant qui injecte une image corrompue dans le uploader peut déclencher `alert()` en boucle → l'app devient inutilisable (DoS local).  
**Fix:** Toast system non-bloquant (voir §5).

### 1.2 `console.warn` en production — fuite de données d'identité (HIGH)
**Fichier:** `app/src/online/bootSync.ts` — ligne 51  
```typescript
console.warn("[bootSync] restored anchor identity from durable store", {
  // ... contient potentiellement player.id en clair dans les logs
```
**Problème:** `console.warn` n'est pas stripé en production. Les logs Android (logcat) capturent ces messages. Toute personne ayant accès au device (ou un malware) peut lire les `player.id` en clair.  
**Fix:** Stripper `console.warn` en prod, ou utiliser `import.meta.env.DEV` comme garde.

### 1.3 Fragment shader: aucune limite de taille de payload (MEDIUM)
**Fichier:** `app/src/backdrops/ThemedBackdrop.tsx` — le string FRAG (~600 lignes de GLSL)  
**Problème:** Le shader est un template literal inline. Si un attaquant parvient à modifier ce fichier (supply chain), il peut injecter un shader malveillant qui cause un crash GPU → app inutilisable.  
**Note:** Ce n'est pas exploitable à distance (fichier statique compilé par Vite), mais une injection via CI/CD corrompu est théoriquement possible. Acceptable pour du client-side.

### 1.4 Erreurs Sentry: DSN exposé dans le bundle (LOW)
**Fichier:** `app/src/monitoring/sentry.ts` — ligne 25  
```typescript
const dsn = getDsn(); // VITE_SENTRY_DSN injecté au build
```
**Problème:** Le DSN Sentry est inclus dans le bundle JS. Un attaquant peut extraire le DSN et spammer le projet Sentry avec de faux crash reports.  
**Fix standard:** Rate-limiting côté Sentry (déjà configuré normalement). Le DSN public est le mode normal de Sentry — ce n'est pas un secret.

### 1.5 Erreurs réseau: pas de timeout sur fetch leaderboard (LOW)
**Fichier:** `app/src/online/leaderboard.ts`  
**Problème:** Les appels fetch à l'API Upstash n'ont pas de timeout explicite. Si le serveur est lent/latent, la promesse reste pendante indéfiniment.  
**Fix:** Ajouter `AbortController` avec timeout (comme fait dans OnlinePage.tsx pour /health).

---

## 2. 🧯 GESTION D'ERREURS — Failles et manques

### 2.1 `console.error` éparpillés — aucune centralisation (HIGH)
**Occurrences:**
| Fichier | Ligne | Message |
|---------|-------|---------|
| `backdrops/ThemedBackdrop.tsx` | 1167 | `[ThemedBackdrop] shader error` |
| `fx/LevelUpOverlay.tsx` | 123 | shader compile error |
| `fx/SplashShader.tsx` | 177 | `[SplashShader] compile error` |
| `monitoring/ErrorBoundary.tsx` | 33 | `[RPSLS] Unhandled render error` |

**Problème:** 4 points d'émission d'erreur différents, aucun format commun, aucun routage vers Sentry (sauf ErrorBoundary qui est indépendant). Les shaders errors sont perdus en prod (pas de Sentry, et `console.error` est ignoré par les utilisateurs).  
**Fix:** Voir §5.1 — `monitoring/errorSink.ts`.

### 2.2 `console.warn` éparpillés — pas de niveau de sévérité (MEDIUM)
**Occurrences:** 8 dans `bootSync.ts` + `playerAnchor.ts`  
**Problème:** Les `console.warn` de bootSync sont des logs de débogage utiles en dev mais polluent logcat en prod (fuite d'info + bruit). Aucun mécanisme pour les désactiver globalement.  
**Fix:** Wrapper `logDebug()` qui check `import.meta.env.DEV` avant d'émettre.

### 2.3 `catch` silencieux — bugs invisibles (HIGH)
**Fichiers concernés:** `online.ts`, `bootSync.ts`, `OnlinePage.tsx`, `playerAnchor.ts`, `haptic.ts`  
**Pattern problématique:**
```typescript
try { ws.close(); } catch { /* ignore */ }       // online.ts:295
try { ac.abort(); } catch { /* ignore */ }        // OnlinePage.tsx:140
void nativeVibrate(...).catch(() => {});          // haptic.ts
try { ... } catch (e) { console.warn(...) }       // playerAnchor.ts:59-61
```

**Problème:** Les erreurs de nettoyage WebSocket, d'abort fetch, et de vibration sont silencieuses. Si un bug se glisse, on ne le saura jamais.  
**Fix:** Remplacer `/* ignore */` par `logError("websocket", "close failed", e)`.

### 2.4 Aucune validation numérique post-calcul dans `recordMatch()` (MEDIUM)
**Fichier:** `app/src/store/store.ts`  
**Problème:** Après avoir calculé `p.xp + m.xpDelta + bonusXp`, `p.rankLp + m.lpDelta`, le résultat n'est jamais vérifié. Un bug de calcul peut produire `NaN`, `Infinity`, ou des valeurs négatives.  
**Fix:** Ajouter un guard:
```typescript
function validatePlayerState(p: Partial<Player>): boolean {
  if (typeof p.xp !== "number" || p.xp < 0 || !Number.isFinite(p.xp)) return false;
  if (typeof p.rankLp !== "number" || p.rankLp < 0 || !Number.isFinite(p.rankLp)) return false;
  return true;
}
```

### 2.5 `applyTheme()` sans null-check — crash possible (MEDIUM)
**Fichier:** `app/src/theme/theme.ts` — ligne 38  
```typescript
export function applyTheme(themeId: ThemeId) {
  const t = THEMES[themeId]; // pas de check si undefined
  root.style.setProperty("--theme-primary", t.primary); // crash si t undefined
```
**Fix:**
```typescript
if (!t) {
  logError("render", "theme not found", { themeId });
  return;
}
```

### 2.6 `onMessage` dans OnlinePage sans `default` case (LOW)
**Fichier:** `app/src/pages/OnlinePage.tsx` — le switch(msg.type)  
**Problème:** Si le serveur envoie un nouveau type de message, le client l'ignore silencieusement. Pas de log, pas d'erreur.  
**Fix:** Ajouter un `default` avec `logError("websocket", "unknown message type", { type: msg.type })`.

---

## 3. 🧩 GARDE-FOUS — Ce qui manque

### 3.1 Aucune limite de taille sur le state persisté (MEDIUM)
**Fichier:** `app/src/store/store.ts` — persist middleware  
**Problème:** `localStorage` a une limite de 5-10 MB selon le navigateur. L'historique (100 matchs × ~2KB) + les cartes + les backgrounds custom peuvent dépasser. Aucune vérification avant `JSON.stringify`.  
**Fix:** Vérifier `JSON.stringify(state).length` avant d'écrire, et tronquer l'historique si nécessaire.

### 3.2 Fusion de state serveur sans coalescence des `undefined` (LOW)
**Fichier:** `app/src/online/playerSync.ts` — `mergeServerState()`  
**Problème:** Si le serveur envoie un champ manquant, `Math.max(local, undefined)` = `NaN`.  
**Fix:** `Math.max(local.xp ?? 0, server.xp ?? 0)`.

### 3.3 Aucun rate-limit sur le push de `SyncState` (LOW)
**Fichier:** `app/src/online/playerSync.ts` — `pushPlayerState()` + `startSyncSubscriber()`  
**Problème:** Le debounce de 500ms est uniquement côté client. Le serveur a un throttle de 5s, mais si le client envoie plus vite (bug), le serveur ignore silencieusement → data loss potentielle.  
**Note:** La protection serveur existe (sync_throttle dans main.rs). OK en pratique mais le client devrait savoir qu'il est throttlé.

---

## 4. 📏 FICHIERS > 400 LIGNES

| Fichier | Lignes | Problème |
|---------|--------|----------|
| `backdrops/ThemedBackdrop.tsx` | ~1360 | Le FRAG GLSL est le gros morceau. Acceptable car tout vit dans un seul shader pour la perf GPU. Mais le fichier TypeScript hors-shader fait ~460 lignes. |
| `pages/OnlinePage.tsx` | ~2400 | **CRITIQUE** — le plus gros fichier du projet. Split proposé: `online/useServerStatus.ts`, `online/useOnlineMatch.ts`, `online/OnlineMenu.tsx`, `online/OnlineMatchView.tsx` |
| `store/store.ts` | ~540 | Acceptable pour un store Zustand (c'est le cœur de l'app). Mais la migration v1→v20 pourrait être dans un fichier séparé `store/migrations.ts`. |
| `pages/ProfilePage.tsx` | ~600 | Acceptable, mais la logique d'upload d'image (3 blocs quasi-identiques) pourrait être extraite dans `util/uploadImage.ts`. |
| `match/sharedMatchUI.tsx` | ~750 | Pourrait être splitté: `match/CinematicEndView.tsx`, `match/BurstAnimation.tsx` |
| `ranked/LanesBoard.tsx` | ~420 | Légèrement au-dessus de 400. Bordeline. |
| `ranked/RankedMatchView.tsx` | ~500 | Pourrait extraire `ranked/RankedRevealPhase.tsx`. |

**Total: 7 fichiers > 400 lignes.** OnlinePage.tsx est le problème majeur (2400 lignes — 6× la limite).

---

## 5. 📂 FICHIERS SANS DOSSIER — Mauvais dispatch

Fichiers à la racine de `app/src/` qui DEVRAIENT être dans des sous-dossiers:

| Fichier | Devrait être dans | Raison |
|---------|-------------------|--------|
| `BattlePad.tsx` | `battlepads/` | C'est un dispatcher de pads — il appartient au dossier battlepads |
| `Sidebar.tsx` | `ui/layout/` ou `shell/` | Composant de layout, pas un point d'entrée |
| `UserHeader.tsx` | `ui/` ou `shell/` | Composant UI, pas un point d'entrée |
| `icons.tsx` | `ui/` | Utilitaires d'icônes |
| `haptic.ts` | `util/` | Utilitaire de vibration |
| `LanguagePicker.tsx` | `ui/` ou `i18n/` | Composant UI de sélection |
| `usePageVisible.ts` | `util/` ou `hooks/` | Hook React utilitaire |
| `App.css` | ✅ Peut rester à la racine | CSS global |
| `App.tsx` | ✅ Peut rester à la racine | Point d'entrée React |
| `main.tsx` | ✅ Peut rester à la racine | Point d'entrée Vite |
| `types.ts` | ✅ Peut rester à la racine | Types partagés globaux (mais ~270 lignes, pourrait être splitté par domaine) |
| `vite-env.d.ts` | ✅ Peut rester à la racine | Config Vite |

**Recommandation:** Créer un dossier `src/util/` pour `haptic.ts`, `usePageVisible.ts`, et `resizeImage.ts`. Créer un dossier `src/shell/` pour `Sidebar.tsx`, `UserHeader.tsx`, `LanguagePicker.tsx`.

---

## 6. 🔄 MANQUES DE CENTRALISATION — Code dupliqué

### 6.1 Logique d'upload d'image ×3 (HIGH)
**Fichier:** `app/src/pages/ProfilePage.tsx`  
**Problème:** 3 blocs quasi-identiques pour uploader avatar, background custom, et pad custom. Mêmes vérifications de taille, mêmes appels à `resizeImageToDataUrl`, mêmes `alert()`.  
**Fix:** Extraire dans `util/uploadImage.ts`:
```typescript
export async function handleImageUpload(file: File, maxDim: number): Promise<string> {
  if (file.size > 12 * 1024 * 1024) throw new Error("too_big");
  return resizeImageToDataUrl(file, { maxDim });
}
```

### 6.2 Nettoyage de nickname ×2 (MEDIUM)
**Fichiers:** `store/storeMigrationGuard.ts` + `server/main.rs`  
**Problème:** La regex `UNSAFE_INVISIBLES` est définie côté client, et le filtre de caractères est défini côté serveur. Si la règle change, il faut modifier deux fichiers.  
**Fix:** Extraire dans un module `util/sanitize.ts` partagé.

### 6.3 Constantes LP/XP dupliquées client/serveur (MEDIUM)
**Fichiers:** `pages/OnlinePage.tsx` + `leaderboard.rs`  
**Problème:** `20`, `-15`, `60`, `25`, `15` pour les LP/XP online sont hardcodées des deux côtés.  
**Fix:** Le serveur devrait inclure `xpAwarded` et `lpAwarded` dans le message `MatchEnd`.

### 6.4 Palette de couleurs MOVE dupliquée (LOW)
**Fichiers:** `icons.tsx` + `engine/game.ts`  
**Problème:** Les couleurs des 5 moves sont définies dans `MOVE_PALETTE` (icons.tsx) et aussi potentiellement référencées ailleurs.  
**Fix:** Single source of truth dans `types.ts` ou `engine/game.ts`.

---

## 7. 🛡️ GARDE-FOUS MANQUANTS — Rust (crates/)

### 7.1 `.unwrap()` dans `main()` — crash serveur (HIGH)
**Fichier:** `crates/rpsls-server/src/main.rs` — lignes 145, 149, 154  
```rust
let listener = tokio::net::TcpListener::bind(addr).await.unwrap(); // ligne 145 — crash si port occupé
axum::serve(...).await.unwrap(); // ligne 154 — crash si erreur de binding
```

**Problème:** Si le port est occupé, le serveur crashe sans message d'erreur utile. Les `unwrap()` s'arrêtent net.  
**Fix:** Remplacer par `expect("failed to bind to port {port}: {err}")` ou un `match` avec log + exit propre.

### 7.2 Aucune limite de connexions simultanées (MEDIUM)
**Fichier:** `crates/rpsls-server/src/main.rs` — pas de `max_connections`  
**Problème:** 10 000 WebSocket ouverts = OOM. Pas de semaphore, pas de limite.  
**Fix:** Ajouter un compteur atomique de connexions actives et refuser les nouvelles quand un seuil est atteint.

### 7.3 `DashMap` sans cleanup si le match task panique (MEDIUM)
**Fichiers:** `main.rs:50-52` — `in_match`, `in_lanes`  
**Problème:** Si un `tokio::spawn` de match panique, le `on_end` closure n'est jamais appelé → l'entrée dans `in_match`/`in_lanes` reste forever. Mémoire leak lent.  
**Fix:** Janitor périodique qui vérifie si le `mpsc::UnboundedSender` est fermé (`is_closed()`).

---

## 8. 📋 PRIORITÉS D'ACTION

| # | Problème | Sévérité | Effort | Fichier(s) |
|---|----------|----------|--------|------------|
| 1 | `alert()` bloque le thread Android | CRITICAL | S | ProfilePage.tsx |
| 2 | Pas d'ErrorSink centralisé | HIGH | S | monitoring/errorSink.ts (nouveau) |
| 3 | `catch {}` silencieux (×7) | HIGH | S | online.ts, OnlinePage.tsx, haptic.ts... |
| 4 | `applyTheme` sans null-check | MEDIUM | S | theme.ts |
| 5 | Pas de validation numérique dans `recordMatch` | MEDIUM | S | store.ts |
| 6 | `unwrap()` sans message dans main.rs | HIGH | S | main.rs |
| 7 | Fichiers orphelins dans `src/` (×7) | MEDIUM | M | BattlePad, Sidebar, UserHeader, icons, haptic... |
| 8 | OnlinePage.tsx ~2400 lignes | HIGH | L | pages/OnlinePage.tsx |
| 9 | Upload image ×3 dupliqué | MEDIUM | S | ProfilePage.tsx |
| 10 | Constantes LP/XP dupliquées client/serveur | MEDIUM | S | OnlinePage.tsx + leaderboard.rs |
| 11 | Pas de limite de connexions serveur | MEDIUM | S | main.rs |
| 12 | Console en prod non strippé | LOW | S | bootSync.ts, playerAnchor.ts |
| 13 | Pas de default case dans onMessage | LOW | S | OnlinePage.tsx |
| 14 | Cas de fusion `undefined` dans mergeServerState | LOW | S | playerSync.ts |

**Effort total estimé:** ~3 jours (S = < 1h, M = 2-4h, L = 1 jour).

---

## 9. 🆕 AUDIT COMPLÉMENTAIRE — Backend, BDD, protocole (2026-06-07 PM)

**Scope:** Deuxième passe d'audit après revue approfondie de `player_state.rs`, `main.rs`, `leaderboard.ts`, `playerAnchor.ts`, `capabilities/default.json`.

**Constat positif:** La majorité des failles critiques identifiées dans l'ARCHITECTURE_REVIEW originale ont été corrigées :
- `sanitize()` est appelé sur `load()` ET `save()` ✅
- `try_create_claim_token()` utilise `SET NX` atomique ✅
- Cap de 400 matchs + 200 lobbies concurrents avec env vars ✅
- Nickname capturé mais appliqué SEULEMENT après auth réussie ✅
- `player_id` validé strictement (alphanum+dash uniquement) ✅

---

### 9.1 🔴 CRITICAL — JWT auth_token non vérifié

**Fichier:** `crates/rpsls-server/src/main.rs:412-421`
```rust
match auth::extract_unverified_subject(auth_token.trim()) {
    Ok(c) => c.sub,
    Err(e) => { /* fallback to player_id */ }
}
```
**Problème:** Le commentaire dit `TODO_VERIFY for the signature-verification plan`. Le JWT est décodé SANS vérification de signature cryptographique. Un attaquant peut créer un JWT forgé avec n'importe quel `sub` (ex: le `player_id` de la cible) et usurper son identité. La validation `validate_player_id()` limite le format mais pas l'usurpation.

**Condition:** Ce code est compilé et exécuté en production si un client envoie `auth_token`. Tant que le flux principal utilise `player_id` + `claim_token`, ce n'est pas exploitable. Mais dès que l'auth Google/Apple sera activée côté client, cette faille devient critique.

**Fix:** Implémenter la vérification JWT (clé publique Google/Apple) AVANT d'extraire le `sub`, ou désactiver temporairement le champ `auth_token` côté serveur si la vérification n'est pas prête.

---

### 9.2 🟡 MEDIUM — `reqwest::Client` sans timeout

**Fichiers:** `player_state.rs:196-199`, `leaderboard.rs` serveur
```rust
fn http() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(reqwest::Client::new)  // pas de timeout!
}
```
**Problème:** Toutes les requêtes HTTP vers Upstash Redis (load/save player state, leaderboard writes, claim token CRUD) utilisent un client sans timeout. Si Upstash est lent ou ne répond pas, ces requêtes pendent indéfiniment. Les appels `tokio::spawn` côté serveur fuient des tasks (pas de cleanup si la tâche ne termine jamais). Côté client (`leaderboard.ts`), les promesses fetch restent pendantes sans `AbortController`.

**Fix:** 
```rust
CLIENT.get_or_init(|| {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .expect("static reqwest client must build")
});
```

---

### 9.3 🟡 MEDIUM — `std::sync::Mutex` dans Session — poisoning sur panic

**Fichier:** `crates/rpsls-server/src/session.rs:17-29`
```rust
pub struct Session {
    pub nickname: Mutex<String>,    // std::sync::Mutex — PAS tokio
    pub player_id: Mutex<String>,   // std::sync::Mutex — PAS tokio
}
```
**Problème:** `std::sync::Mutex` se POISONNE si un thread panique en le tenant. Si n'importe quel code panique en appelant `session.nickname()` (lock), le mutex est empoisonné. Tous les appels FUTURS à `nickname()` paniqueront aussi (le `.unwrap()` sur le lock va panic). Cela peut faire crasher tout le serveur ou silencieusement casser des sessions.

**Fix:** Soit remplacer par `tokio::sync::Mutex` (pas de poisoning), soit remplacer les `.unwrap()` par `.unwrap_or_else(|e| e.into_inner())` qui récupère le mutex même empoisonné.

```rust
pub fn nickname(&self) -> String {
    self.nickname.lock().unwrap_or_else(|e| e.into_inner()).clone()
}
```

---

### 9.4 🟡 MEDIUM — Déduplication leaderboard par nickname — collision d'identité

**Fichier:** `app/src/online/leaderboard.ts:78-83`
```typescript
const byNick = new Map<string, {...}>();
for (...) {
    const key = nickname.toLowerCase();
    if (!byNick.has(key)) byNick.set(key, { id: ids[i], nickname, lp: lps[i] });
}
```
**Problème:** Deux joueurs avec le même pseudo partagent UN SEUL slot sur le leaderboard. Un joueur malveillant peut :
1. Repérer le pseudo du #1 du classement
2. Créer un compte avec le même pseudo (insensible à la casse)
3. Jouer un match online → son entrée écrase celle du #1 ou est ignorée

C'est un vecteur d'usurpation sociale. Le commentaire du code reconnaît le trade-off.

**Fix:** Utiliser `player.id` comme clé unique de déduplication au lieu du pseudo. Ajouter un affichage "Joueur1 (alias Joueur1_2)" si deux joueurs partagent le même pseudo.

---

### 9.5 🟢 LOW — `unwrap_or_default()` masque les erreurs de parsing HTTP

**Fichier:** `crates/rpsls-server/src/player_state.rs:457`
```rust
let body = resp.text().await.unwrap_or_default();
```
**Problème:** Dans le chemin d'erreur (save rejeté par Upstash), si la lecture du corps de réponse échoue, l'erreur est silencieusement remplacée par une string vide. On ne sait pas POURQUOI la sauvegarde a été rejetée.

**Fix:** Logger l'erreur :
```rust
let body = match resp.text().await {
    Ok(b) => b,
    Err(e) => { warn!(error=%e, "failed to read rejected save body"); return; }
};
```

---

### 9.6 🟢 LOW — Ping WebSocket n'écho pas le payload

**Fichier:** `crates/rpsls-server/src/main.rs:354-357`
```rust
Message::Ping(b) => {
    let _ = tx.send(ServerMessage::Pong);
    let _ = b;  // payload ignoré
```
**Problème:** La spec WebSocket (RFC 6455 §5.5.2) exige que le pong contienne les mêmes données que le ping. Ignorer `b` signifie que le pong envoyé est vide. La plupart des clients tolèrent ça, mais certains WebSocket load balancers/proxies utilisent le payload pour tracer les connexions.

**Fix:** Envoyer le pong au niveau WebSocket avec le payload :
```rust
Message::Ping(b) => {
    if let Err(e) = sink.send(Message::Pong(b)).await {
        warn!(?e, "pong failed");
    }
```

---

### 9.7 🟢 LOW — Permissions Tauri Store trop larges

**Fichier:** `app/src-tauri/capabilities/default.json:12-19`
```json
"store:default", "store:allow-get", "store:allow-set",
"store:allow-save", "store:allow-load", "store:allow-delete",
"store:allow-keys", "store:allow-entries"
```
**Problème:** `store:allow-delete` et `store:allow-keys` ne sont nécessaires que pour le flow "delete my account". Un frontend compromis pourrait lister toutes les clés du store (`allow-keys`) ou supprimer des données (`allow-delete`). Risque faible car l'app est locale, mais principe de moindre privilège.

**Fix:** Retirer `store:allow-delete` et `store:allow-keys` si le flow "delete account" n'est pas encore implémenté. Les rajouter quand nécessaire.

---

### 9.8 📊 BONUS — Choses qui ont été CORRIGÉES depuis l'audit initial

| Problème (ARCHITECTURE_REVIEW.md) | Statut | Correction |
|-----------------------------------|--------|------------|
| TOFU race condition (double Hello) | ✅ FIXÉ | `try_create_claim_token()` avec SET NX |
| PlayerProgress non sanitize on load | ✅ FIXÉ | `sanitize()` appelé ligne 230 |
| Pas de cap sur matches/lobbies | ✅ FIXÉ | `MAX_CONCURRENT_MATCHES=400`, `MAX_CONCURRENT_LOBBIES=200` |
| Nickname set avant auth | ✅ FIXÉ | `pending_nickname` capturé, appliqué après auth |
| player_id injection via Redis key | ✅ FIXÉ | `validate_player_id()` strict (alphanum+dash) |
| `unwrap()` dans main() | ❌ RESTE | Acceptable pour un serveur (crash = restart par Render) |
| Pas de semaphore sur tokio::spawn | ⚠️ PARTIEL | Le cap limite le nombre, mais pas de backpressure |

**Bilan:** 5/7 problèmes critiques de l'audit initial sont résolus. Le code serveur a significativement progressé en sécurité.

---

### 9.9 📋 Priorités additionnelles (section 9)

| # | Problème | Sévérité | Effort | Fichier(s) |
|---|----------|----------|--------|------------|
| 15 | JWT auth_token non vérifié | CRITICAL | M | main.rs, auth.rs |
| 16 | reqwest::Client sans timeout | MEDIUM | S | player_state.rs, leaderboard.rs |
| 17 | std::sync::Mutex poisoning | MEDIUM | S | session.rs |
| 18 | Leaderboard dédup par pseudo | MEDIUM | S | leaderboard.ts |
| 19 | unwrap_or_default masque erreurs | LOW | S | player_state.rs |
| 20 | Ping WS n'écho pas le payload | LOW | S | main.rs |
| 21 | Permissions Tauri Store trop larges | LOW | S | capabilities/default.json |

**Ajout effort total:** ~1 jour supplémentaire. **Grand total AUDIT_FINAL: ~4 jours.**
