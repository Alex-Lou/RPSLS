# RPSLS Architecture & Security Review

**Date:** 2026-06-06  
**Reviewer:** Senior Staff Engineer, Deep Audit  
**Scope:** Full stack — Rust server (axum), React 19 + Tauri 2 client, shared core crate, build/deploy config  
**Verdict:** The codebase is well-structured and security-conscious for its scale, but several CRITICAL issues block safe scaling past a few hundred concurrent users. The TOFU auth system has real race conditions, there is no cap on concurrent matches, and the i18n coverage for non-English locales is severely deficient.

---

## 1. Security

### CRITICAL — TOFU claim-token race condition enables player_id hijacking

**File:** `crates/rpsls-server/src/main.rs:291-327`

**What's wrong:** When two WebSocket connections send `Hello` with the same `player_id` and no (or empty) `claim_token` concurrently, both `load_claim_token` calls return `None` (first connection for that id). Both connections enter the `None` branch, each issues a fresh UUID token, and both `set_player_id` calls succeed. The second connection now has a valid token for that player_id — it has stolen the identity.

```rust
// main.rs:315-326 — race window
None => {
    // First connection for this player_id — issue token.
    let new_token = Uuid::new_v4().to_string();
    player_state::save_claim_token(pid.clone(), new_token.clone()); // fire-and-forget
    session_clone.set_player_id(pid);
    let state = progress.unwrap_or_default();
    session_clone.send(ServerMessage::StateLoaded {
        state,
        claim_token: Some(new_token),
    });
}
```

**Concrete fix:** Use Redis `SET NX` (atomic "set if not exists") for claim token creation. If `SET NX` fails, the second connection must present the existing token.

```rust
// In player_state.rs — new function
pub async fn try_create_claim_token(player_id: &str) -> Option<String> {
    let (url, token) = config()?;
    let new_token = Uuid::new_v4().to_string();
    let key = format!("{CLAIM_PREFIX}{player_id}");
    let endpoint = format!("{url}/pipeline");
    let cmds: Vec<Vec<String>> = vec![vec!["SET".into(), key, new_token.clone(), "NX".into()]];
    let resp = http().post(&endpoint).bearer_auth(token).json(&cmds).send().await.ok()?;
    // Upstash pipeline returns ["OK"] if set, [null] if key existed
    let body: serde_json::Value = resp.json().await.ok()?;
    let results = body.as_array()?;
    if results.first()?.as_str() == Some("OK") {
        Some(new_token)
    } else {
        None // token already exists — caller must present it
    }
}
```

Then in `main.rs`, replace the `None` branch with:
```rust
None => {
    match player_state::try_create_claim_token(&pid).await {
        Some(new_token) => {
            session_clone.set_player_id(pid);
            session_clone.send(ServerMessage::StateLoaded {
                state: progress.unwrap_or_default(),
                claim_token: Some(new_token),
            });
        }
        None => {
            // Another session already claimed this player_id first.
            // Force the client to load the existing token (it should have it
            // in localStorage) and retry.
            session_clone.send(ServerMessage::Error {
                code: "auth_needed".into(),
                message: "player_id already claimed — send your claim_token".into(),
            });
        }
    }
}
```

**Expected impact:** Eliminates the only identity-theft vector. A malicious client racing to claim a known player_id can no longer steal it.

---

### CRITICAL — PlayerProgress loaded from Redis is NOT sanitized

**File:** `crates/rpsls-server/src/player_state.rs:151-188` (load function)

**What's wrong:** `sanitize()` is called on `save()` (line 260) but NOT on `load()` (line 167-175). If a previous save was corrupted, or if a client wrote a crafted payload before sanitize was added, `serde_json::from_str::<PlayerProgress>` will deserialize it unchecked. The deserialized struct flows to `mergeServerState` on the client, which uses `Math.max` comparisons — a poisoned `xp: u64::MAX` from Redis will permanently corrupt the local player state.

**Concrete fix:** Call `sanitize()` immediately after deserialization in `load()`:

```rust
// player_state.rs:167-176
match serde_json::from_str::<PlayerProgress>(json_str) {
    Ok(mut state) => {
        state.sanitize(); // <-- ADD THIS LINE
        debug!(player_id, "player state loaded from Redis");
        Some(state)
    }
    Err(e) => {
        warn!(player_id, error = %e, "failed to deserialize player state");
        None
    }
}
```

**Expected impact:** Prevents a poisoned Redis key from permanently corrupting a player's account. Defense-in-depth — sanitize on both write AND read.

---

### CRITICAL — No cap on concurrent matches / lobbies

**File:** `crates/rpsls-server/src/main.rs:45-56` (AppState), `crates/rpsls-server/src/lobby.rs:29-38` (LobbyManager)

**What's wrong:** `in_match` is a `DashMap` with no size bound. `lobbies` is a `DashMap` with no size bound. A scripted attacker opening hundreds of WebSocket connections and calling `create_lobby` or `join_queue` can create unlimited entries. Each match spawns a `tokio::spawn` task (match_engine.rs:38, lanes_engine.rs:66). At ~1 MB stack + task metadata per spawned task, 10,000 concurrent matches ≈ 10 GB of memory before any game logic runs. The Render free tier has 512 MB RAM.

**Concrete fix:** Add global caps in AppState with rejection before spawning:

```rust
// In main.rs AppState
struct AppState {
    // ... existing fields ...
    max_matches: usize, // e.g. 200
    max_lobbies: usize, // e.g. 100
}

// In ws_handler, before create_lobby/join_lobby/join_queue:
fn check_match_cap(state: &AppState) -> bool {
    state.in_match.len() + state.in_lanes.len() < state.max_matches
}

// In create_lobby handler:
if state.lobbies.lobby_count() >= state.max_lobbies {
    return reply_error(session, "server_full", "too many lobbies — try again soon");
}
```

Add `lobby_count()` method to `LobbyManager`:
```rust
pub fn lobby_count(&self) -> usize { self.lobbies.len() }
```

**Expected impact:** Prevents OOM kills under load. The server degrades gracefully with a "server full" error instead of crashing.

---

### CRITICAL — join_queue / connect race can orphan a match

**File:** `crates/rpsls-server/src/main.rs:382-404`

**What's wrong:** When `join_queue` is called, the client enters `phase: "connecting"`. The server may queue the player and later match them. But in `OnlinePage.tsx`, `startBotFallback()` calls `clientRef.current?.disconnect()` which closes the WebSocket. The server match task is already spawned and will sit there waiting for moves from a disconnected client, holding memory until the round deadline expires (10s + 2s).

Worse: the `on_end` closure for `in_match` removal fires when the match task exits, but the match_engine holds `Arc<Session>` references — so the session's `tx` channel stays alive, the outgoing task keeps running, and the entry in `in_match` blocks a new match for that session_id.

**Concrete fix:** In `startBotFallback()`, send `leave_match` before disconnecting:
```typescript
// OnlinePage.tsx startBotFallback
function startBotFallback() {
    disarmBotFallback();
    // Tell the server we're out before dropping the socket.
    if (clientRef.current?.status === "open") {
        clientRef.current.send({ type: "leave_match" });
    }
    // Small grace period for the message to flush.
    setTimeout(() => {
        try { clientRef.current?.disconnect(); } catch { /* */ }
        clientRef.current = null;
    }, 100);
    // ... rest of function
}
```

**Expected impact:** Prevents orphaned match tasks and stale DashMap entries when a player falls back to bot mode.

---

### HIGH — Nickname is set even when auth fails

**File:** `crates/rpsls-server/src/main.rs:260-328`

**What's wrong:** The nickname is always set (lines 260-278) before any auth check. Even if the claim token is wrong (line 307-313 — auth_failed error is sent), the session already has the nickname of whichever player_id was attempted. A malicious client can Hello with someone else's player_id, fail auth, but still have their nickname set. If they then queue without a valid player_id, the match system uses `session.nickname()`.

**Concrete fix:** Move nickname setting into the auth success branches only, or set a placeholder "Unauthenticated" until auth passes.

**Expected impact:** Prevents nickname confusion in edge cases and makes the auth boundary clean.

---

### HIGH — CORS origin list missing landing page origin

**File:** `crates/rpsls-server/src/security.rs:32-40`

**What's wrong:** The `landing/` directory contains a landing page (`landing/index.html`). If this page is hosted on a custom domain (e.g. `rpsls.app`), it cannot open a WebSocket to the server because the origin isn't in `ALLOWED_ORIGINS`. The comment says "Add new entries here when shipping a real web build" — but there's no automated way to configure this.

**Concrete fix:** Add the production landing domain to the allow-list, or make it configurable via environment variable:

```rust
fn allowed_origins() -> Vec<String> {
    let mut origins: Vec<String> = ALLOWED_ORIGINS.iter().map(|s| s.to_string()).collect();
    if let Ok(extra) = std::env::var("CORS_EXTRA_ORIGINS") {
        for o in extra.split(',') {
            origins.push(o.trim().to_string());
        }
    }
    origins
}
```

**Expected impact:** Production web client can actually connect to the server.

---

### HIGH — localStorage tamper vector: claimToken is writable

**File:** `app/src/store/store.ts:401-402` (applyServerSync), `app/src/online/bootSync.ts:61-63`

**What's wrong:** `applyServerSync` does `{ ...s.player, ...patch }` — any field in `patch` overwrites the player state. `bootSync.ts:62` sets `patch.claimToken = msg.claim_token`. A tampered localStorage could set `claimToken` to an empty string or a crafted value before the app boots, causing the next `Hello` to fail auth silently (or worse, if the token matches another player's, hijack identity).

The `storeMigrationGuard` does NOT validate `claimToken` — it only guards `avatar`, `themeId`, `padId`, etc.

**Concrete fix:** Add `claimToken` validation to `sanitisePersisted`:

```typescript
// storeMigrationGuard.ts — add:
if ("claimToken" in p) {
    if (!isStr(p.claimToken) || p.claimToken.length > 64) {
        delete p.claimToken; // Force re-auth on next boot
    }
}
```

**Expected impact:** A tampered localStorage can't inject a stolen claim token.

---

### MEDIUM — Redis key injection via player_id

**File:** `crates/rpsls-server/src/player_state.rs:156-157`

**What's wrong:** The Redis key is constructed as `format!("{KEY_PREFIX}{player_id}")` where `player_id` is a client-supplied string cleaned with `.chars().filter(|c| !c.is_control()).take(64)`. This is a good start, but it doesn't prevent a player_id like `../../sensitive-key` from traversing the Redis key namespace (Upstash Redis REST uses URL paths like `/get/player:../../sensitive-key`).

**Concrete fix:** Validate the player_id format strictly — UUID only:

```rust
fn validate_player_id(raw: &str) -> Option<String> {
    let clean: String = raw.chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-')
        .take(64)
        .collect();
    if clean.len() >= 32 && clean.len() <= 64 {
        Some(clean)
    } else {
        None
    }
}
```

Apply this in main.rs:281-283 instead of the current control-char filter. Since `crypto.randomUUID()` produces UUIDs, this is backward-compatible.

**Expected impact:** Prevents path traversal in Redis key namespace even if the Redis REST proxy is misconfigured.

---

### MEDIUM — Leaderboard: no anti-bot/alt-account protection

**File:** `crates/rpsls-server/src/leaderboard.rs:55-92`

**What's wrong:** The leaderboard records every match result unconditionally. Two players colluding (or one player with two devices) can trade wins to farm LP. No Elo/Glicko-style rating confidence, no K-factor decay, no minimum match count for leaderboard appearance.

**Concrete fix (immediate):** Track per-player recent opponents and flag/ignore repeated same-opponent results:

```rust
// In leaderboard.rs, add a short-lived cache:
static RECENT_OPPONENTS: LazyLock<DashMap<String, VecDeque<(String, Instant)>>> = ...;
// If winner_id and loser_id have played each other > 3 times in the last hour, skip LP.
```

**Expected impact:** Raises the bar for the simplest form of LP grinding. A more complete solution (Glicko-2) is a larger project.

---

## 2. Scalability & Performance

### CRITICAL — DashMap entries grow without bound in two maps

**File:** `crates/rpsls-server/src/main.rs:55` (sync_throttle), `crates/rpsls-server/src/main.rs:50-52` (in_match, in_lanes)

**What's wrong:**

1. **sync_throttle** has a 5-minute janitor sweep that drops entries older than 60s. Between sweeps, every unique `player_id` that pushes a `SyncState` adds one entry. With 1,000 unique players pushing state every 5 seconds, that's 1,000 entries × (5 min × 60s / 5s) = 60,000 entries before the sweep runs. Each entry is a `String` (up to 64 bytes) + `Instant` (16 bytes) + DashMap overhead (~40 bytes) ≈ 120 bytes. 60,000 × 120 = 7.2 MB — manageable but wasteful.

2. **in_match / in_lanes** are only cleaned up by the `on_end` closure. If the match task panics (e.g., due to a channel send error), `on_end` never fires. The session_id remains in the map forever. Over weeks of uptime, this is a slow memory leak.

**Concrete fix:**

For sync_throttle: Use a shorter sweep interval (60s, not 300s) or switch to a `moka::Cache` with TTL:

```rust
// Replace DashMap with moka::sync::Cache for auto-expiry
use moka::sync::Cache;
sync_throttle: Cache<String, ()>, // value ignored, just key with TTL
// Initialize: Cache::builder().time_to_idle(Duration::from_secs(6)).build()
```

For in_match/in_lanes: Add a periodic janitor that removes entries where the match task's sender is closed:

```rust
// In the janitor task:
let dead: Vec<String> = state.in_match.iter()
    .filter(|e| e.value().0.is_closed())
    .map(|e| e.key().clone())
    .collect();
for id in dead { state.in_match.remove(&id); }
```

**Expected impact:** Eliminates the two slowest memory leaks. The server can run for months without restart.

---

### HIGH — tokio::spawn without backpressure for every match

**File:** `crates/rpsls-server/src/match_engine.rs:38`, `crates/rpsls-server/src/lanes_engine.rs:66`

**What's wrong:** Every new match spawns a `tokio::spawn(async move { run_match(...).await })`. There's no semaphore or channel bounding the number of concurrent match tasks. Under a connection flood, the tokio runtime will keep spawning tasks until OOM.

**Concrete fix:** Add a semaphore gate before spawning:

```rust
use tokio::sync::Semaphore;
// In AppState:
match_semaphore: Arc<Semaphore>,

// Before tokio::spawn:
let permit = state.match_semaphore.clone().acquire_owned().await;
tokio::spawn(async move {
    let _permit = permit; // hold until match ends
    run_match(a, b, best_of, rx).await;
    on_end();
});
```

Initialize with `Semaphore::new(200)` in main(). The `acquire_owned().await` provides natural backpressure — new match requests queue up rather than spawning unbounded tasks.

**Expected impact:** Prevents OOM under load. The server degrades gracefully with queue delay instead of crashing.

---

### HIGH — WebSocket reconnect storm risk

**File:** `app/src/online/online.ts:170-171` (RECONNECT_DELAYS), `app/src/online/online.ts:263-279` (scheduleReconnect)

**What's wrong:** The reconnect delays are `[400, 1200, 3000]` ms — only 3 retries, then permanent failure. If the Render free-tier server is cold-starting (30-90s wake time), all clients will fail their 3 retries within 4.6 seconds and permanently disconnect. When the server finally wakes up, they'll all reconnect at once because `bootSync` and user retries happen at random moments — but the initial wave is synchronized.

**Concrete fix:** Extend the retry schedule to cover the cold-start window and add jitter:

```typescript
const RECONNECT_DELAYS = [
    400, 1_200, 3_000,    // fast retries for transient drops
    8_000, 15_000,         // cold-start window
    30_000, 60_000,        // deep sleep
];
// Apply jitter: delay * (0.7 + Math.random() * 0.6)
```

Also add exponential backoff continuation after the array is exhausted:
```typescript
if (this.reconnectAttempt >= RECONNECT_DELAYS.length) {
    // Continue with exponential backoff: 60s, 120s, 240s...
    const base = 60_000;
    const exp = this.reconnectAttempt - RECONNECT_DELAYS.length;
    return base * Math.pow(2, Math.min(exp, 4));
}
```

**Expected impact:** Clients survive the Render cold-start and reconnect cleanly after 30-90s of dormancy.

---

### MEDIUM — localStorage write amplification from Zustand persist

**File:** `app/src/store/store.ts:191-518`

**What's wrong:** Zustand's `persist` middleware serializes the ENTIRE store to localStorage on every state change. `recordMatch` triggers a write. `updateProfile` triggers a write. Every `set()` call triggers a write. The serialized state includes `history` (up to 100 match records with full round logs) and `player` (with card masteries, collections). This is ~15-50 KB of JSON per write. At 60 writes/minute during active play, that's ~900 KB-3 MB/minute of localStorage I/O.

**Concrete fix:** Add a `partialize` option to the persist config to exclude `history` from auto-save (save it separately on an interval):

```typescript
persist(
    (set, get) => ({ /* ... */ }),
    {
        name: "rpsls-app-state",
        version: 20,
        partialize: (state) => ({
            player: state.player,
            onboarded: state.onboarded,
            locale: state.locale,
            serverConfig: state.serverConfig,
            // history excluded — saved separately
        }),
        // ...
    }
)
```

Save history on a debounced schedule (every 30s of changes):
```typescript
let _historyDirty = false;
// In recordMatch:
_historyDirty = true;
// Separate interval:
setInterval(() => {
    if (_historyDirty) {
        localStorage.setItem("rpsls-history", JSON.stringify(get().history));
        _historyDirty = false;
    }
}, 30_000);
```

**Expected impact:** Reduces localStorage I/O by ~80%. The player state (without history) is < 5 KB.

---

### MEDIUM — Render free-tier cold-start herd thundering

**File:** `app/src/pages/OnlinePage.tsx:82-177` (useServerStatus hook)

**What's wrong:** The auto-retry while offline (lines 157-174) has jitter (`10_000 + random * 10_000`), which is good. However, `runBootSync()` in `App.tsx:106` fires at app launch with NO jitter. If 50 users open the app within the same 5-second window (e.g., after a push notification), they all hit the dormant server simultaneously. The first few get the 429 from the governor; the rest pile on.

**Concrete fix:** Add jitter to `runBootSync`:

```typescript
export function runBootSync() {
    // Stagger by 0-8 seconds so a wave of app opens doesn't thundering-herd
    // the dormant Render instance.
    const delay = Math.floor(Math.random() * 8_000);
    setTimeout(() => {
        // ... existing bootSync logic
    }, delay);
}
```

**Expected impact:** Smoothes the cold-start wake-up. The server sees a ramp of connections over 8 seconds instead of a synchronized spike.

---

## 3. Error Handling

### HIGH — Scattered error reporting: alert(), console.error, console.warn

**File:** `app/src/pages/ProfilePage.tsx` (3× `alert()` calls), `app/src/fx/SplashShader.tsx:1` (`console.error`), `app/src/fx/LevelUpOverlay.tsx:1` (`console.error`), `app/src/backdrops/ThemedBackdrop.tsx:1` (`console.error`)

**What's wrong:**

1. **Production `alert()` calls:** `ProfilePage.tsx` uses `alert(t("profile.avatar.tooBig"))` and `alert(t("profile.avatar.invalid"))`. On Android WebView, `alert()` blocks the JS thread with a native dialog — it's a terrible UX. On desktop it's merely ugly. These are user-facing validation errors that should use a toast or inline message.

2. **Shader compilation errors use `console.error`:** These are developer-relevant errors that should go through the Sentry error boundary or at minimum be guarded behind `import.meta.env.DEV`.

3. **No centralized error sink:** There's no single place where all errors are routed for logging, user notification, and Sentry reporting.

**Concrete fix:**

Create a unified error sink:

```typescript
// monitoring/errorSink.ts
import * as Sentry from "@sentry/react";

export type ErrorSeverity = "fatal" | "error" | "warn" | "info";

export function reportError(err: Error, severity: ErrorSeverity, context?: Record<string, unknown>) {
    if (import.meta.env.DEV) {
        console.error(`[RPSLS][${severity}]`, err, context);
    }
    Sentry.captureException(err, {
        level: severity,
        extra: context,
    });
}

export function showUserError(message: string) {
    // Dispatch a custom event that a ToastProvider picks up
    window.dispatchEvent(new CustomEvent("rpsls:toast", {
        detail: { message, kind: "error" }
    }));
}
```

Replace all `alert()` calls with `showUserError()` calls. Replace all `console.error` with `reportError()`.

**Expected impact:** User-facing errors use a consistent toast pattern. Developer errors are routed to Sentry in production. No `alert()` dialogs in the shipped app.

---

### MEDIUM — User-facing error messages are not localized

**File:** `app/src/monitoring/ErrorBoundary.tsx:49-56`

**What's wrong:** The crash screen has hardcoded English strings:
```
"Something broke"
"The app hit an unexpected error..."
"Try again"
```

These are NOT going through `t()`. If the app crashes for an Arabic user, they get an English crash screen.

**Concrete fix:** Import `useT` (or `tFor` directly since this is a class component's static render):

```typescript
import { tFor } from "../i18n";
// In CrashScreen:
const locale = useStore.getState().locale;
<h1>{tFor(locale, "crash.title")}</h1>
```

Add the corresponding keys to all locale files.

**Expected impact:** Crash screen is readable in the user's language.

---

### MEDIUM — Server errors lack session/player context

**File:** `crates/rpsls-server/src/main.rs:527-532`

**What's wrong:** `reply_error` only sends `code` and `message` to the client. There's no server-side log with session_id, player_id, or peer IP. When debugging a player report "I got error X", there's no way to find the corresponding server log line.

**Concrete fix:**

```rust
fn reply_error(session: &Arc<Session>, code: &str, msg: &str) {
    warn!(
        session_id = %session.id,
        player_id = %session.player_id(),
        peer = %session.peer_ip,
        code = code,
        message = msg,
        "sending error to client"
    );
    session.send(ServerMessage::Error {
        code: code.into(),
        message: msg.into(),
    });
}
```

**Expected impact:** Every error is traceable in server logs with full context.

---

### LOW — Silent catches that swallow bugs

**File:** `crates/rpsls-server/src/match_engine.rs:271-272`

```rust
// The rematch handshake only matters after a match — ignore mid-round.
MatchCommand::RequestRematch { .. } | MatchCommand::RespondRematch { .. } => {}
```

This is intentional (a rematch request during a round is meaningless), but a client sending `request_rematch` mid-round indicates a client-side state bug. Silently dropping it means we never learn about the bug.

**Concrete fix:** Log a warning:
```rust
MatchCommand::RequestRematch { .. } | MatchCommand::RespondRematch { .. } => {
    tracing::warn!(?slot, "rematch handshake received mid-round — client state bug?");
}
```

---

## 4. DRY / Code Smells

### HIGH — OnlinePage.tsx is 2,399 lines — the single largest file in the project

**File:** `app/src/pages/OnlinePage.tsx` — 2,399 lines

**What's wrong:** This file contains: server status polling hook, match state machine, bot fallback engine, rematch handshake, cinematic UI (splash/reveal timers), lane placement UI, and ALL the JSX for every phase (menu, connecting, queued, matched, round, reveal, match_end, lanes_match, lanes_bot, error). This is a monolithic component that's impossible to test in isolation.

**Concrete fix:** Split into:

1. `online/useServerStatus.ts` — the health-check hook (lines 82-177)
2. `online/useOnlineMatch.ts` — match state machine + WS message handler (lines 356-595)
3. `online/useBotFallback.ts` — bot fallback engine (lines 662-781)
4. `online/OnlineMenu.tsx` — menu phase JSX (lines 937-997)
5. `online/OnlineMatchView.tsx` — classic match phases (round, reveal, match_end JSX)
6. `online/OnlineLanesView.tsx` — lanes match phases
7. `OnlinePage.tsx` — orchestrator, ~200 lines

**Expected impact:** Testable, maintainable. Each hook/component can be unit-tested independently.

---

### HIGH — Duplicated rematch window logic (classic + lanes engines)

**File:** `crates/rpsls-server/src/match_engine.rs:173-221` (rematch_window), `crates/rpsls-server/src/lanes_engine.rs:247-289` (lanes_rematch_window)

**What's wrong:** The two rematch window functions are structurally identical — they only differ in the command enum type (`MatchCommand` vs `LanesCommand`). This is ~45 lines of duplicated state machine logic.

**Concrete fix:** Extract a generic rematch window using a trait or enum wrapper:

```rust
enum RematchCmd {
    RequestRematch { slot: PlayerSlot },
    RespondRematch { slot: PlayerSlot, accept: bool },
    Leave { slot: PlayerSlot },
}

async fn rematch_window(
    a: &Arc<Session>,
    b: &Arc<Session>,
    rx: &mut mpsc::UnboundedReceiver<RematchCmd>,
) -> RematchOutcome {
    // ... unified logic
}
```

Convert `MatchCommand` / `LanesCommand` into `RematchCmd` at the call site before entering the window.

**Expected impact:** One bug fix applies to both match types. ~40 fewer lines to maintain.

---

### MEDIUM — Duplicate picker/logic patterns across ranked pickers

**File:** `app/src/ranked/RankedPickPhase.tsx`, `app/src/ranked/CardSlot.tsx`, `app/src/ranked/DeckManager.tsx` — all share card-selection UX patterns

**What's wrong:** Card tap-to-select, card drag, card cancel, mana validation — these patterns are re-implemented across multiple ranked components. The pick phase alone likely has duplicated lane-pick logic with the Lanes online picker.

**Concrete fix:** Extract a `useCardPicker` hook and `CardSelector` component that encapsulates the shared interaction model.

---

### MEDIUM — Magic numbers in OnlinePage for LP/XP/ECLATS values

**File:** `app/src/pages/OnlinePage.tsx:459-461`

```typescript
xpDelta: outcome === "win" ? 60 : outcome === "draw" ? 25 : 15,
lpDelta: outcome === "win" ? 20 : outcome === "draw" ? 0 : -15,
```

These match the server constants (leaderboard.rs:20-22) but are duplicated. If the server changes these values, the client history records will show incorrect rewards.

**Concrete fix:** Ship reward constants from the server in `MatchEnd` / `LanesMatchEnd` messages, or define them in a shared constants file imported by both.

---

### LOW — Dead code: Session::is_in_match

**File:** `crates/rpsls-server/src/session.rs:68-71`

```rust
#[allow(dead_code)]
pub fn is_in_match(&self) -> bool {
    self.in_match.load(Ordering::SeqCst)
}
```

Marked `#[allow(dead_code)]` — either use it or remove it. Currently only `set_in_match` is called.

---

### LOW — Inconsistent naming: éclats vs dust vs "poussière"

**File:** `app/src/types.ts:85-88` (eclats, dust), `app/src/store/store.ts:60-61` (eclats: 0, dust: 0), but `app/src/i18n/locales/fr.ts` uses "éclats" and "poussière"

The currency is named "éclats" in the code but the craft resource is "dust" in code and "poussière" in French. Inconsistent: if "dust" maps to "poussière" in French, the code field should be `poussiere` to match. Or use the English name consistently.

---

## 5. Test Coverage

### What's tested today

**rpsls-core:** 6 unit tests covering:
- Same-move draws
- All 10 canonical RPSLS wins
- Exhaustive 25-pair verification
- Each-move-beats-exactly-two
- Best-of-3 match state machine
- Serde roundtrip

**rpsls-server/security.rs:** 2 unit tests:
- Message rate limiter allows up to max then blocks
- Lobby brute-force tracker blocks after max attempts

### What's NOT tested (CRITICAL gaps)

1. **Round resolution in match_engine:** No test for `collect_round_moves` timeout/forfeit paths
2. **Lanes round resolution:** No test for timeout plays, banned moves, lane point calculation
3. **TOFU claim token flow:** No integration test for the race condition
4. **PlayerProgress::sanitize:** No test verifying that `u64::MAX` values are clamped
5. **mergeServerState:** No test for the client-side merge logic (max wins? union of cards? last-write-wins cosmetics?)
6. **storeMigrationGuard::sanitisePersisted:** No test for XSS vectors in avatar field
7. **OnlineClient reconnect:** No test for the reconnect sequence

### Smallest test suite for 80% regression coverage

```
rpsls-core (already good):
  [x] Existing 6 tests

rpsls-server — add:
  [ ] test_match_engine_timeout
  [ ] test_match_engine_forfeit
  [ ] test_lanes_timeout_round_loss
  [ ] test_lanes_forfeit_match_loss
  [ ] test_player_progress_sanitize_clamps_all_fields
  [ ] test_claim_token_nx_prevents_double_issue

app/src — add (vitest):
  [ ] test_mergeServerState_takes_max_currencies
  [ ] test_mergeServerState_union_cards
  [ ] test_mergeServerState_lww_cosmetics
  [ ] test_mergeServerState_ignores_unknown_theme_id
  [ ] test_sanitisePersisted_rejects_svg_avatar
  [ ] test_sanitisePersisted_preserves_unknown_fields
  [ ] test_normalizeServerUrl_handles_all_variants

Total: 6 existing + 13 new = 19 tests
Estimated effort: ~4 hours
```

---

## 6. Build / Release Readiness (Play Store)

### HIGH — No automated versionCode/versionName flow

**File:** `app/src-tauri/tauri.conf.json:4` — version is `"0.4.48"` (hardcoded), `app/package.json:4` — version is `"0.1.0"` (out of sync)

**What's wrong:** The Tauri config version and the npm package version are mismatched (0.4.48 vs 0.1.0). There's no script to bump both simultaneously. Android requires `versionCode` (integer) that must increase with each upload — this isn't configured anywhere visible.

**Concrete fix:** Add to `tauri.conf.json`:
```json
{
  "bundle": {
    "android": {
      "versionCode": "${VERSION_CODE}"
    }
  }
}
```

Create a release script:
```bash
#!/bin/bash
# scripts/release.sh
VERSION=$1  # e.g. 0.5.0
VERSION_CODE=$(git rev-list --count HEAD)

# Update all version references
cd app && npm version "$VERSION" --no-git-tag
# Update tauri.conf.json version
# Build with VERSION_CODE
VERSION_CODE=$VERSION_CODE tauri android build --aab
```

**Expected impact:** Every Play Store upload has a monotonically increasing versionCode. Impossible to accidentally upload with a conflicting version.

---

### MEDIUM — Sentry release tracking references VITE_APP_VERSION but it's never set

**File:** `app/src/monitoring/sentry.ts:43`

```typescript
release: (import.meta.env.VITE_APP_VERSION as string | undefined) ?? "dev",
```

**What's wrong:** `VITE_APP_VERSION` is never defined in `.env.example` or set during the build. Every release will be tagged as "dev" in Sentry, making it impossible to correlate crashes with specific releases.

**Concrete fix:** Add to the build pipeline:
```bash
VITE_APP_VERSION=$(node -p "require('./package.json').version") tauri android build --aab
```

Or use `vite.config.ts` to read from `package.json`:
```typescript
import { readFileSync } from "fs";
const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));
export default defineConfig({
    define: {
        "import.meta.env.VITE_APP_VERSION": JSON.stringify(pkg.version),
    },
});
```

---

### LOW — Bundle size: 18 font packages in dependencies

**File:** `app/package.json:14-32` — 18 separate `@fontsource/*` packages

**What's wrong:** Many of these fonts (e.g., `@fontsource/bevan`, `@fontsource/im-fell-english`, `@fontsource/medievalsharp`) may not be used in the current theme set. Each adds ~50-200 KB to the bundle.

**Concrete fix:** Audit which fonts are actually referenced in `theme/fonts.ts` and remove unused ones. Consider serving fonts from Google Fonts CDN for non-critical weights.

---

### LOW — Privacy policy completeness

**File:** `landing/privacy.html` — exists but should be verified against Google Play's Data Safety requirements

**Concrete fix:** Ensure the privacy policy covers:
- Data collected (nickname, player_id, match history)
- Data storage (localStorage + Upstash Redis)
- Third-party services (Sentry for crash reporting, Upstash for leaderboard)
- User rights (data deletion request process)
- Contact information

---

## 7. Internationalization

### CRITICAL — ar.ts has only 48 keys vs en.ts with ~780

**File:** `app/src/i18n/locales/ar.ts` — 48 keys

**What's wrong:** The Arabic locale file is essentially unusable. Only basic nav, splash, welcome, mode picker, and match quit strings are translated. Every Constellation Lanes string, every card description, every combo name, every quest, every shop string, every profile setting, every verb — all fall back to English via the `?? STRINGS.en[key] ?? key` fallback chain in `tFor()`.

The same likely applies to `hi.ts`, `tr.ts`, `pl.ts`, `nl.ts`, `ko.ts` — all locales added in bulk but not fully translated.

**Concrete fix:**

1. Run a script to identify all keys in `en.ts` missing from each locale
2. For the Play Store launch, prioritize: `ar` (RTL, large market), `zh`, `ja`, `ko`, `ru` (fully translated already), `de`, `fr`, `es`, `it`, `pt`
3. Drop or hide locales that are < 50% translated (`hi`, `tr`, `pl`, `nl` — verify their coverage)

Build a coverage check into CI:
```bash
# scripts/i18n-check.sh
node -e "
const en = require('./app/src/i18n/locales/en.ts').default;
const locale = require('./app/src/i18n/locales/${LOCALE}.ts').default;
const missing = Object.keys(en).filter(k => !(k in locale));
if (missing.length > Object.keys(en).length * 0.3) {
    console.error(\`${LOCALE}: \${missing.length} keys missing (\${(missing.length/Object.keys(en).length*100).toFixed(0)}%)\`);
    process.exit(1);
}
"
```

**Expected impact:** Non-English users get a fully translated experience instead of mixed-language UI.

---

### MEDIUM — No locale fallback cascade beyond en

**File:** `app/src/i18n/index.ts:66`

```typescript
let s = STRINGS[locale]?.[key] ?? STRINGS.en[key] ?? key;
```

**What's wrong:** If a key is missing in `fr`, it falls back directly to `en`. A better UX would be: `fr` → `en` (works today) but also `fr-CA` → `fr` → `en` for regional variants. Not critical for the current locale set (all are base language codes), but the infrastructure should support it.

**Concrete fix:**
```typescript
function resolveLocale(locale: Locale): Locale[] {
    const chain = [locale];
    const base = locale.split("-")[0] as Locale;
    if (base !== locale) chain.push(base);
    if (base !== "en") chain.push("en");
    return chain;
}

export function tFor(locale: Locale, key: string, params?: ...): string {
    for (const loc of resolveLocale(locale)) {
        const s = STRINGS[loc]?.[key];
        if (s !== undefined) {
            if (params) { /* interpolate */ }
            return s;
        }
    }
    return key;
}
```

---

### LOW — RTL handling: dir attribute set but no RTL CSS

**File:** `app/src/App.tsx:164`

```typescript
root.dir = RTL_LOCALES.has(locale) ? "rtl" : "ltr";
```

**What's wrong:** Setting `dir="rtl"` on `<html>` is correct for native HTML elements, but Tailwind's RTL variants (e.g., `rtl:ml-4`) are not used anywhere in the codebase. Flexbox layouts using `flex-row` won't automatically mirror. The Sidebar, UserHeader, and all page layouts will render LTR even with `dir="rtl"`.

**Concrete fix:** Audit all layout components for RTL compatibility. At minimum:
- Sidebar should render on the right in RTL
- "Back" arrow should point right in RTL
- Text alignment should flip from left to right
- Tailwind `rtl:` variants should be applied to directional margins/paddings

This is a significant effort (~1-2 days of testing) but only matters if you ship to Arabic-speaking users. Given ar.ts has only 48 keys, this is a Phase 2 concern.

---

## 8. Architecture Concerns

### MEDIUM — Zustand persist is the wrong tool for match history

**File:** `app/src/store/store.ts:191-518`

**What's wrong:** The entire `history: MatchRecord[]` (up to 100 entries) is stored in Zustand persist, which serializes it to a single localStorage key on EVERY state change. Match records include full round logs with move-by-move detail. This is relational data that would be better served by IndexedDB (via `idb-keyval` or Dexie).

The current approach means:
- Every `set()` call serializes and writes all 100 match records
- localStorage has a 5-10 MB limit; 100 match records at ~2 KB each = 200 KB (fine, but grows)
- No query capability — filtering history by mode requires loading all records and filtering in JS

**Concrete fix:** Move history to IndexedDB:
```typescript
import { get, set } from "idb-keyval";

// In store:
history: [], // in-memory only
loadHistory: async () => {
    const saved = await get<MatchRecord[]>("history") ?? [];
    set({ history: saved.slice(0, HISTORY_LIMIT) });
},
// In recordMatch:
const newHistory = [m, ...get().history].slice(0, HISTORY_LIMIT);
set({ history: newHistory });
set("history", newHistory).catch(() => {}); // fire-and-forget to IndexedDB
```

This also removes history from the Zustand persist serialization, solving the write amplification issue from §2.

**Expected impact:** localStorage writes drop from 30-50 KB to < 5 KB per change. History is queryable. The persist migration system becomes simpler.

---

### MEDIUM — No WebSocket protocol versioning

**File:** `crates/rpsls-server/src/protocol.rs`, `app/src/online/online.ts`

**What's wrong:** The `ClientMessage` / `ServerMessage` enums use `#[serde(tag = "type")]` with `rename_all = "snake_case"`. There is NO version field. If the server adds a new required field to `MatchFound` (e.g., `server_version: String`), old clients will fail to deserialize it. If the client sends a new variant (e.g., `QuickMatch`), the server will silently drop it (the `match` statement has no catch-all arm — it falls through to… actually, looking at main.rs:258-524, there IS no catch-all. A new variant would just silently do nothing).

**Concrete fix (backward-compatible):** Add a `protocol_version: u32` field to the `Welcome` message:

```rust
ServerMessage::Welcome {
    session_id: String,
    protocol_version: u32, // currently 1
}
```

The client stores this and can warn the user if it's higher than what it supports ("Server requires a newer app version"). Add `#[serde(deny_unknown_fields)]` to all server→client messages so the client detects unknown fields (forward compat detection).

For client→server, the server already ignores unknown variants (serde denies them at deserialization time and the `match` in `handle_client_message` only handles known variants). This is actually safe — the error path sends `"bad_message"`.

**Expected impact:** Future protocol changes don't silently break old clients or cause undefined behavior.

---

### LOW — Store version 20 with manual migration is fragile

**File:** `app/src/store/store.ts:406-516`

**What's wrong:** The `migrate` function has 15 manual version bumps (v2 through v20). Each adds a check like `if (version < 14 && state?.player && !("backgroundId" in state.player))`. This is increasingly error-prone:
- Version 15 references `customBgUrl` which might not exist in the state if v15 migration didn't run yet
- The order of checks matters but isn't enforced
- A single typo in a field name (e.g., `backroundId`) would silently fail to migrate

**Concrete fix:** Consider a declarative migration approach or at minimum add TypeScript type guards:

```typescript
type Migration = {
    version: number;
    up: (state: Record<string, unknown>) => void;
};

const MIGRATIONS: Migration[] = [
    { version: 2, up: (s) => { if (!s.player?.padId) s.player.padId = "chalkboard"; } },
    { version: 3, up: (s) => { /* ... */ } },
    // ...
];

function migrate(persisted: unknown, version: number): AppState {
    const state = persisted as Record<string, unknown>;
    for (const m of MIGRATIONS) {
        if (version < m.version) m.up(state);
    }
    return sanitisePersisted(state) as AppState;
}
```

---

## Prioritized Punch-List (Top 10 Before Scaling Past 1k DAU)

| # | Finding | Severity | Effort | Classification |
|---|---------|----------|--------|----------------|
| 1 | TOFU claim-token race condition (§1) | CRITICAL | M | **BLOCKER** — identity theft |
| 2 | PlayerProgress not sanitized on load (§1) | CRITICAL | S | **BLOCKER** — data corruption |
| 3 | No cap on concurrent matches (§2) | CRITICAL | M | **BLOCKER** — OOM crash |
| 4 | tokio::spawn without semaphore (§2) | HIGH | S | **BLOCKER** — OOM crash |
| 5 | DashMap entries grow without bound (§2) | CRITICAL | M | **BLOCKER** — memory leak |
| 6 | ar.ts only 48 keys — Arabic/RTL unusable (§7) | CRITICAL | L | **BLOCKER** — Play Store rejection risk |
| 7 | alert() calls in ProfilePage (§3) | HIGH | S | POLISH — but user-visible |
| 8 | WebSocket reconnect storm (§2) | HIGH | S | POLISH — user experience |
| 9 | Nickname set before auth (§1) | HIGH | S | POLISH — auth boundary |
| 10 | No automated versionCode flow (§6) | HIGH | S | **BLOCKER** — Play Store upload |

**Effort key:** S = < 2 hours, M = 2-8 hours, L = 1-3 days

**BLOCKER** = Must fix before scaling past ~100 concurrent users or shipping to Play Store.  
**POLISH** = Degrades user experience but isn't a safety/stability risk.

---

## Summary

The codebase is well-architected for its current scale. The core game logic (`rpsls-core`) is pure, tested, and correct. The server security primitives (rate limiting, brute-force protection, message sanitization) show real security awareness. The client-side store migration guard is unusually thorough for a project of this size.

The critical weaknesses are all in the operational/scaling dimension: no resource caps, no backpressure, and leaky maps. These are the kinds of issues that are invisible at 10 concurrent users and catastrophic at 1,000. Fix them before the user base grows.

The i18n situation is the most user-visible quality gap — shipping "15 languages" where 4-5 are actually translated is a credibility problem. Either invest in translations or reduce the supported locale list to match reality.