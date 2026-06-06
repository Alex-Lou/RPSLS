# Play Games auth + IAP — migration plan

Status at this commit: **scaffolding only**.

The server now accepts an optional `auth_token` (JWT) in `Hello` and, when
present, prefers its `sub` claim as the effective `player_id`. The JWT is
**parsed but NOT signature-verified** — this is enough to wire the end-to-end
flow during development, but it MUST be locked down before any real IAP money
flows through the system.

## Goal

Two coupled features, both required to ship IAP-backed cosmetics safely:

1. **Identity** — a player's progression must be tied to a *real* account
   (Google Play Games / Sign in with Apple / Firebase Auth), not a UUID
   generated on first launch. Without it, "buying ✦ Étoiles" on one phone
   doesn't survive a reinstall, and there's no way to verify cross-device.
2. **Purchase** — a player tapping "Buy ✦1000" must reach Play Billing,
   complete a real transaction, and have the server credit `stars` only
   *after* validating the receipt against Google's API. Anything less is a
   client-trusted credit, i.e. infinite stars to anyone who patches the
   client.

The two features share infrastructure: both need a verified Google identity,
both rely on the server-side Google API client.

## Architecture (target state)

```
┌──────────────┐  Hello                ┌──────────────┐
│   Tauri App  │ ─── { jwt: "..." } ──▶│   Rust       │
│   (Android)  │ ◀── { stateLoaded } ──│   Server     │
└──────────────┘                       └──────┬───────┘
       │                                      │
       │ Play Billing                         │ Verify JWT (RS256 + JWKS)
       │ (Tauri plugin)                       │ Verify receipt (Google Play
       ▼                                      │  Developer API)
┌──────────────┐                              │
│  Play Store  │                              │
│   billing    │                              ▼
└──────────────┘                       ┌──────────────┐
                                       │   Redis      │
                                       │ player:{uid} │
                                       │ purchases:   │
                                       │   {token}    │
                                       └──────────────┘
```

## Migration phases

### Phase 0 — what's done today

- ✅ `protocol.rs` Hello accepts `auth_token?: string`
- ✅ `auth.rs` parses JWT structure, extracts `sub`, allowlists issuers
  (Google / Apple), checks `exp`
- ✅ `main.rs` Hello handler prefers the JWT `sub` over the client-supplied
  `player_id` when an auth_token is present
- ✅ Unit tests for malformed / expired / unknown-issuer cases
- ✅ TOFU claim-token fallback remains for legacy clients

### Phase 1 — real JWT verification (server, ~half day)

1. Add `jsonwebtoken = "9"` to `crates/rpsls-server/Cargo.toml`.
2. In `auth.rs`, add a JWKS cache:
   - static `OnceLock<RwLock<JwksCache>>`
   - `refresh_jwks()` fetches `https://www.googleapis.com/oauth2/v3/certs`
   - TTL ~1 hour
   - Repeat for Apple at `https://appleid.apple.com/auth/keys`
3. Replace `extract_unverified_subject` with `verify_id_token`:
   - Parse header to get `kid`
   - Look up matching JWK in cache
   - `jsonwebtoken::decode::<JwtClaims>(token, &decoding_key, &Validation::new(RS256))`
   - Cross-check `aud` against `PLAY_GAMES_OAUTH_CLIENT_ID` env var
4. Update Hello handler to call the verified version and bail on `Err`.
5. Remove TOFU `claim_token` migration window after ~6 months.

### Phase 2 — Tauri Android plugin (client, ~1 day)

Native shim that calls Google Play Games Sign-In and returns the ID token:

```kotlin
// android-app/src/main/java/com/alex/rpsls/PlayGamesPlugin.kt
class PlayGamesPlugin(private val activity: Activity) {
    suspend fun signIn(): String {
        val games = PlayGames.getGamesSignInClient(activity)
        val account = games.signIn().await()
        return account.idToken!! // The JWT we send in Hello
    }
}
```

Bridge to JS via Tauri's `tauri-plugin` template. From the React app:

```ts
import { invoke } from "@tauri-apps/api/core";
const idToken = await invoke<string>("play_games_sign_in");
client.send({ type: "hello", nickname, player_id, claim_token, auth_token: idToken });
```

### Phase 3 — IAP / Play Billing (client + server, ~2 days)

**Client (Tauri Android plugin):**

```kotlin
class BillingPlugin(activity: Activity) {
    suspend fun purchase(productId: String): Purchase { ... }
}
```

On a successful purchase, the plugin returns the `purchaseToken`. The React
app sends:

```ts
client.send({ type: "verify_purchase", product_id: "stars_1000", purchase_token: "..." });
```

**Server (new handler in main.rs):**

1. `ClientMessage::VerifyPurchase { product_id, purchase_token }`
2. Look up the IAP product in a static table (`stars_1000` → `+1000 stars`,
   `set_quartz` → `+ownedPremiumSets["quartz"]`).
3. Call Google Play Developer API:
   `GET https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{packageName}/purchases/products/{productId}/tokens/{purchaseToken}`
   with a service-account OAuth token (provisioned in Render env vars).
4. Verify response: `purchaseState == 0 (PURCHASED)`, `consumptionState`
   matches the product's consumability, `acknowledgementState == 1`.
5. Idempotency: write `purchases:{purchaseToken}` to Redis with `SET … NX`
   — if NX rejects, the purchase has already been credited, ignore.
6. Grant the reward server-side, then push a `StateLoaded` with the updated
   player state to the client.

**Product registry (static, in server):**

```rust
struct IapProduct {
    id: &'static str,
    grant: fn(&mut PlayerProgress),
}
const PRODUCTS: &[IapProduct] = &[
    IapProduct { id: "stars_1000", grant: |p| p.stars += 1000 },
    IapProduct { id: "set_quartz", grant: |p| {
        p.owned_premium_sets.push("quartz".into());
    }},
    // …
];
```

### Phase 4 — migrate existing players (one-shot, ~1 hour)

Existing players have `player_id = <local UUID>`. After they sign in for the
first time their `sub` (Google ID) is different — their progression would be
zeroed.

Handler:

1. New `ClientMessage::LinkAccount { legacy_player_id, legacy_claim_token, auth_token }`
2. Server verifies both: legacy via claim-token TOFU, new via JWT.
3. If both pass: `RENAME player:{legacy} → player:{sub}`, copy claim, delete legacy.
4. Returns `StateLoaded` so the client adopts the new player_id.

The client shows a one-time "Link my account" CTA in Profile until the user
links or dismisses.

## Required external setup (you, Alex)

Before any of the code lands in production, you need:

1. **Play Console** (free)
   - Enable Play Games Services on the RPSLS app
   - Create an OAuth 2.0 Web Client ID — this is `PLAY_GAMES_OAUTH_CLIENT_ID`
   - Create IAP products under In-app products / Subscriptions
2. **Google Cloud Console** (free for low volume)
   - Create a service account, download the JSON key
   - Enable "Google Play Android Developer API"
   - Link the service account to your Play Console under Users & permissions
3. **Render env vars** (paste from above)
   - `PLAY_GAMES_OAUTH_CLIENT_ID`
   - `GOOGLE_SERVICE_ACCOUNT_JSON` (the whole JSON blob, single-line)
4. **Privacy policy update** — declare "Google Play Games sign-in", account
   identifier collected, IAP receipts stored.

## Effort summary

| Phase | Owner | Effort |
|---|---|---|
| 0 — scaffolding (this commit) | done | — |
| 1 — real JWT verify | server | ~4h |
| 2 — Tauri Android sign-in plugin | client | ~1 day |
| 3 — IAP plugin + receipt verify | both | ~2 days |
| 4 — legacy migration | both | ~3h |
| External setup (Play Console + GCP) | you | ~2h |

Realistic total: **one good week of focused work**, split over phases so each
piece ships behind a flag and you can roll back independently.

## Not in scope (yet)

- Apple App Store equivalent (Sign in with Apple + StoreKit) — same shape,
  separate JWKS + receipt endpoint, ~1 day extra once Android is done
- Refunds / chargebacks handling — Google's Real-time Developer Notifications
  webhook into a new `/iap/notification` route on Render
- Subscription products — receipts have a different lifecycle (renewals,
  pauses, holds). Sticking to one-shot consumables for v1.
