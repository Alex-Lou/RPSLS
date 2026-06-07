# Audit Erreurs & Garde-fous — RPSLS

**Date:** 2026-06-07  
**Scope:** `app/src` (frontend React + Tauri) — patterns d'erreur, silencieux, redondances, propositions de centralisation.  
**Règle:** Audit uniquement. Aucune modification de code source.

---

## 1. État des lieux — capturer les erreurs

### 1.1 console.error dispersés (4 occurrences)

| Fichier:ligne | Contexte | Sévérité |
|--------------|----------|----------|
| `fx/LevelUpOverlay.tsx:1` | Échec compilation shader GLSL | LOW — dev-only, shader fixe |
| `fx/SplashShader.tsx:1` | Échec compilation shader splash | LOW — dev-only, shader fixe |
| `backdrops/ThemedBackdrop.tsx:1` | Échec compilation shader backdrop | LOW — dev-only, shader fixe |
| `monitoring/ErrorBoundary.tsx:31` | Crash React non rattrapé | HIGH — seul vrai log utile |

**Verdict:** Les 3 shader errors sont légitimes (le code est stable, ils ne devraient jamais échouer en prod). Le ErrorBoundary est le seul point où une erreur atteint l'utilisateur.

### 1.2 alert() en production (1 fichier, 3 occurrences)

| Fichier | Lignes | Message |
|---------|--------|---------|
| `pages/ProfilePage.tsx` | ~3× | `alert(t("profile.avatar.tooBig"))`, `alert(t("profile.avatar.invalid"))` |

**Problème:** `alert()` bloque le thread JS sur Android WebView avec une dialog native — UX catastrophique. Déjà signalé dans l'ARCHITECTURE_REVIEW comme HIGH.

### 1.3 catch() silencieux (7 occurrences problématiques)

| Fichier:ligne | Code | Ce qui est perdu |
|--------------|------|-----------------|
| `online/online.ts:251` | `catch { /* ignore */ }` | Erreur WebSocket close |
| `online/online.ts:300-303` | `try { this.ws.close(); } catch { /* ignore */ }` | Erreur nettoyage socket |
| `online/bootSync.ts:35` | `try { ws.close(); } catch { /* */ }` | Timeout boot sync |
| `online/bootSync.ts:77` | `try { ws.close(); } catch { /* */ }` | Fermeture après sync |
| `pages/OnlinePage.tsx:140` | `try { ac.abort(); } catch { /* ignore */ }` | AbortController santé |
| `haptic.ts:1` | `void nativeVibrate(...).catch(() => {});` | Échec vibration |
| `store/store.ts` | Multiple `try { ... } catch { /* */ }` | localStorage flush history |

**Problème commun:** Ces catch ne loggent jamais. Si un bug se glisse dans le nettoyage d'un WebSocket ou l'écriture localStorage, on ne le saura jamais. Les joueurs ne peuvent pas reporter "mon historique disparaît parfois" — et nous n'avons aucune trace pour debug.

---

## 2. Garde-fous existants — ce qui protège déjà

### 2.1 ✅ Excellents garde-fous

| Emplacement | Protection | Efficacité |
|------------|-----------|------------|
| `store/storeMigrationGuard.ts` | Valide tout le state chargé du localStorage avant que React le rende | **Excellent** — empêche crash au boot si localStorage corrompu |
| `backdrops/ThemedBackdrop.tsx` | `buildGL()` retourne false → CSS fallback silencieux | **Excellent** — pas de crash si WebGL indisponible |
| `online/online.ts:169` | `ws.max_frame_size(64*1024).max_message_size(64*1024)` | **Excellent** — pas d'OOM par message géant |
| `store/store.ts:407` | `migrate()` versionné avec 20 versions, chaque champ vérifié | **Excellent** — migration forward-compat |
| `monitoring/ErrorBoundary.tsx` | Attrape tout crash React, affiche UI de recovery | **Bon** — mais le message est en anglais hardcodé |
| `App.tsx:62-65` | `useEffect` qui init/shutdown Sentry selon le toggle crashReports | **Bon** — respecte le consentement |

### 2.2 ⚠️ Garde-fous partiels

| Emplacement | Protection | Ce qui manque |
|------------|-----------|---------------|
| `online/online.ts:216-222` | `setInterval ping 25s` + `clearInterval` au close | ✅ Bon — mais si le ping échoue silencieusement (catch vide), pas de reconnection |
| `pages/OnlinePage.tsx:82-177` | `useServerStatus` avec abortController + jitter retry | ✅ Bon — mais pas de log si le fetch /health échoue 3 fois de suite |
| `BattlePad.tsx:47` | `try { el.setCurrentTime(2.6); } catch { /* */ }` | ⚠️ Protège contre SMIL indisponible — mais ne log pas si ça arrive souvent (signe de bug) |

### 2.3 ❌ Garde-fous manquants

| Emplacement | Risque | Impact |
|------------|--------|--------|
| `store/store.ts` (recordMatch) | Pas de validation des bornes sur XP/LP après calcul | Si un bug additionne négatif ou NaN, le state est corrompu |
| `pages/OnlinePage.tsx` (onMessage) | Pas de `default` case dans le switch(msg.type) | Un nouveau message type du serveur → silent no-op |
| `online/playerSync.ts:mergeServerState` | `Math.max()` sur des valeurs potentiellement `undefined` | Si le serveur envoie un champ manquant, `undefined > 0` = `false` → le champ local prend le dessus (pas grave, mais pas intentionnel) |
| `theme/theme.ts:applyTheme` | Pas de validation que `THEMES[themeId]` existe | Si un themeId corrompu arrive du localStorage, `undefined[key]` → crash |
| `BattlePad.tsx` switch default | `default: return <ChalkboardPad {...common} />;` | ✅ Bon — fallback silencieux vers le pad par défaut |

---

## 3. Redondances critiques / HIGH

### 3.1 Duplication des valeurs LP/XP entre client et serveur

| Client | Serveur | Problème |
|--------|---------|----------|
| `pages/OnlinePage.tsx:459-461` | `leaderboard.rs:20-22` | Les mêmes constantes `20`, `-15`, `60`, `25`, `15` sont copiées des deux côtés |
| `types.ts:197-208` (REWARDS table) | Non utilisé pour l'online | Le client utilise les REWARDS pour le mode vs-CPU mais l'online a ses propres valeurs hardcodées |

**Risque:** Si on change les récompenses LP/XP online côté serveur, le client affichera des valeurs incorrectes dans l'historique de match.

**Solution proposée:** Le serveur devrait inclure `xpAwarded` et `lpAwarded` dans le message `MatchEnd` / `LanesMatchEnd`. Le client les lit directement sans les calculer.

### 3.2 Filtrage de caractères dupliqué client vs serveur

| Emplacement | Filtre |
|------------|--------|
| `server/main.rs:264-274` (Hello nickname) | Strip contrôle + bidi + ZWJ + BOM, cap 24 |
| `store/storeMigrationGuard.ts:103-109` | Même strip via regex `UNSAFE_INVISIBLES` |

**Risque:** Si la règle change côté serveur, le guard client peut accepter un nickname que le serveur rejette → mismatch.

**Solution proposée:** Extraire la regex de nettoyage dans un fichier partagé `util/sanitize.ts` utilisé à la fois par le guard et le flux online (Hello).

### 3.3 Règles de validation best_of dupliquées

```typescript
// server/main.rs:534
fn validate_best_of(n: u8) -> bool { n >= 1 && n <= 9 && n % 2 == 1 }

// app/src/online/online.ts — aucune validation côté client
// app/src/store/store.ts — aucune validation sur le best_of stocké
```

Le client envoie `best_of` au serveur sans le valider. Le serveur le fait → sécurité OK. Mais le client pourrait valider avant l'envoi pour éviter un round-trip inutile.

---

## 4. Proposition de centralisation

### 4.1 ErrorSink — fichier unique pour toutes les erreurs

```typescript
// monitoring/errorSink.ts (nouveau)
import * as Sentry from "@sentry/react";

type ErrorKind = "shader" | "websocket" | "storage" | "render" | "user" | "network";

export function logError(kind: ErrorKind, message: string, detail?: unknown) {
  if (import.meta.env.DEV) {
    console.error(`[RPSLS][${kind}]`, message, detail);
  }
  // En prod, seules les erreurs render/storage/websocket vont à Sentry
  if (kind === "render" || kind === "storage" || kind === "websocket") {
    Sentry.captureException(new Error(`[${kind}] ${message}`), {
      level: kind === "render" ? "fatal" : "error",
      extra: { detail },
    });
  }
}

export function showToast(message: string) {
  window.dispatchEvent(new CustomEvent("rpsls:toast", { detail: { message } }));
}
```

**Impact:** Remplace 4 `console.error` + 3 `alert()` + 7 `catch { /* ignore */ }` par un point d'entrée unique. Sentry reçoit les erreurs de prod. Les devs voient tout en console. Les joueurs ont un toast au lieu d'un alert().

### 4.2 Validation Store — garde-fou post-set

```typescript
// store/store.ts — ajouter dans le persist migrate
function validatePlayerState(p: Partial<Player>): boolean {
  if (typeof p.xp !== "number" || p.xp < 0 || !Number.isFinite(p.xp)) return false;
  if (typeof p.rankLp !== "number" || p.rankLp < 0 || !Number.isFinite(p.rankLp)) return false;
  if (typeof p.eclats !== "number" || (p.eclats ?? 0) < 0) return false;
  // ... tous les champs numériques
  return true;
}
```

Appelé dans `recordMatch` après le calcul des nouvelles valeurs. Si invalide → rollback + log Sentry.

### 4.3 Guard sur applyTheme

```typescript
// theme/theme.ts:38
export function applyTheme(themeId: ThemeId) {
  const t = THEMES[themeId];
  if (!t) {
    logError("render", "theme not found", { themeId });
    return; // garde-fou: pas de crash si theme inconnu
  }
  // ... existing code
}
```

---

## 5. Priorités d'action

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 1 | Créer `monitoring/errorSink.ts` + remplacer 4 console.error + 7 catch muets | S | **HIGH** — visibilité immédiate sur les bugs |
| 2 | Remplacer 3 `alert()` par `showToast()` dans ProfilePage | S | **HIGH** — UX Android |
| 3 | Ajouter `guard` dans `applyTheme` | S | **MEDIUM** — évite crash si state corrompu |
| 4 | Ajouter validation numérique dans `recordMatch` | S | **MEDIUM** — integrité du state |
| 5 | Centraliser les constantes LP/XP online dans un fichier partagé | S | **LOW** — pas critique (valeurs stables) |
| 6 | Extraire `sanitizeNickname()` dans `util/sanitize.ts` | S | **LOW** — DRY |

**Total estimé:** ~2 heures pour les 6 actions. Toutes sont des quick wins < 30 min chacune.