# RPSLS — Handoff / Onboarding for the next agent

> Read this **fully** before touching anything, then read `MEMORY.md`
> (`C:\Users\34643\.claude\projects\C--Users-34643-Desktop-RPSLS\memory\MEMORY.md`).
> The app is **live and released (last public = v0.4.33)**; the current work
> sits on `develop` as **v0.4.34, NOT released** (20 commits ahead of `main`).
> Treat the codebase as production: don't break working features, verify on the
> physical device, keep commits clean, ship DRY/SOLID code that matches the
> surrounding style.

---

## 0. GOLDEN RULES (non-negotiable)

- **Owner / sole author:** Alex `<alex.guennad@gmail.com>`. Every commit is authored by him (already the git default here).
- **Commits MUST be clean:** never the words "Claude", "Anthropic", "AI assistant", "Co-Authored-By", "Generated with", no 🤖 — in author/committer/body/trailers. "AI" is OK only as the in-game CPU opponent. Audit before every commit:
  `git diff -- app/src | grep -iE "claude|anthropic|co-author|generated with|🤖"`  (must be empty).
- **Shell:** prefix commands with `rtk` (token-saving passthrough): `rtk git status`, `rtk cargo check`…
- **Branch:** work on `develop`. **Release = fast-forward `develop`→`main` + push `main`** (this triggers every deploy). Never force-push. Push/commit only when Alex asks.
- **Version bump every delivered lot** (see §5). Current: **0.4.34**.
- **Verify on device** after client changes: build APK (workaround §4) → install → look. Device id `CMJFT4IN6HFYA6OV` (sometimes disconnects mid-session — re-check `adb devices`).
- **Language:** Alex speaks French; reply to him in French. UI is hardcoded FR + a 15-locale i18n layer.
- **`Cargo.toml` LF churn + `Profile miniatures/*.png` recompression** show up in `git status` after Tauri builds — never commit them: `git checkout -- app/src-tauri/Cargo.toml` and stage files explicitly (never `git add .`). `HANDOFF.md` is untracked on purpose (handoff doc — leave it unless Alex says otherwise).

---

## 1. What the app is

**RPSLS** = Rock-Paper-Scissors-Lizard-Spock, a polished mobile game.
- **Client:** Tauri 2 (Rust shell) + **React 19 + TS + Vite + Tailwind v4**, Android APK. WebGL backdrops/effects, Framer Motion (`motion/react`), Zustand (persisted, versioned migrations), 15-language i18n.
- **Server:** Rust **Axum** WebSocket server (`crates/rpsls-server`), real-time online 1v1, deployed on **Render** (Docker).
- **Leaderboard:** **Upstash Redis** (REST). Server writes LP (full token), client reads (read-only token).
- **Landing:** single-file `landing/index.html` → **GitHub Pages** (`https://alex-lou.github.io/RPSLS/`). APK via GitHub Releases.

**Game modes:** Entraînement (sandbox vs CPU) · Constellation (3 lanes vs CPU) · Constellation Classée (lanes + mana + cards + tournament, vs CPU) · Classé (classic 1v1 vs CPU, lobby + tournament + Atouts) · En ligne (real players via server, CPU fallback on cold-start). **Competitive LP comes ONLY from real online matches** (vs-CPU = XP).

---

## 2. Current state — v0.4.34 on `develop` (20 commits, NOT released)

Everything below is built, type-checked, GLSL-validated, and **installed on the device**, but **awaits Alex's visual sign-off and is not on `main`**. Highlights (newest first):

- **Per-scene touch interactions** in the WebGL backdrop (`e5b8400`): the background reacts to the finger differently per scene — Neon Grid = piano-key glow, Quantum = liquid ripple, Holy = golden glitch square that grows while held, others = soft ripple. **Galaxy v3**: de-flashed (no more strobe novas; dim core + soft twinkle, liquid arms).
- **Typo unified** (`b0bf9eb`): every page title uses `font-headline` (theme font). **Constellation normale** now has the floating back arrow next to the burger (→ existing quit confirm).
- **Profile** (`0fff5b7`, `c7d8fc2`): "Apparence" card = **Background / HUD palette under tabs**; **Battle pad** = Animés / Images tabs; **12 HUD palettes** with rich swatch presentation.
- **HUD design tokens** (`eb0253c`→`89fad8b`): semantic Tailwind v4 tokens that follow the theme (see §4). Migrated across match / menu / pages (~550 sites).
- **i18n**: `de/es/it` completed + `pt/ru/tr` translated (45→686 keys) by background **Haiku** sub-agents (`0adf6ca`, `3611eef`).
- **Shaders**: Nebula liquid-on-mobile fix (`8e2b453`), Cybergrid synthwave rework, lane favoured-move hints.
- **Menus**: Entraînement/Classé accents, neutral "Constellation Classée · tournoi" tagline, compact sandbox (🎲 top-right), **Constellation prep screen**, splash i18n + landscape, avatar upload format hint.
- **Backdrop grey-screen fix** (`d8f0b4e`) + **Ranked polish** (`b4f1817`: Sudden Death at match point, bonus hints, Mirror display, tournament forfeit).

---

## 3. Repo layout & ARCHITECTURE conventions (respect these)

```
app/src/
├─ backdrops/ThemedBackdrop.tsx   # the ONLY live backdrop — 1 fragment shader, all scenes + touch FX
├─ ranked/                        # Constellation Ranked + Classé + tournament (cards, atouts, bracket, podium, board)
├─ match/                         # shared match bits (QuitConfirmModal…)
├─ battlepads/  flavor/  a11y/  legal/  monitoring/  assets/  i18n/locales/×15
├─ *Page.tsx                      # ⚠ pages still at src/ root (PlayPage 2.4k, OnlinePage 2.1k, LanesMatchView 1.4k…)
├─ App.tsx store.ts game.ts types.ts theme.ts themes.ts sharedMatchUI.tsx
├─ ThemeTouchFX.tsx menuFx.ts     # menu touch-particle canvas (distinct from backdrop touch FX)
└─ leaderboard.ts online.ts …     # ⚠ ~40 files still orphaned at src/ root → see §6.2
```

**DRY/SOLID rules to honour:**
- **Colours = tokens, not hardcodes.** Use the semantic Tailwind utilities (§4). Only hardcode a Tailwind colour for **state** (emerald=win, rose=loss, amber, sky) or a **mode/lane/move identity** — never for neutral surfaces/borders/text.
- **One source of truth:** theme gradient = `gradientFromTheme()`/`bg-themed`; lane identities = `LANE_IDENTITIES` (`lanesCombos.ts`); card rules = `ranked/rankedRules.ts` (pure). Don't duplicate.
- **Pure logic stays pure** (engines/rules); React owns state; refs never leak to children (see `ranked/RankedGame.tsx` header).
- **i18n:** add a key to `en.ts` + `fr.ts` at minimum; the 6 complete locales are en/fr/de/es/it/pt (+ru/tr near-complete). Keep placeholders `{x}` identical across locales.
- **Match full-screen views** call `useAndroidBackPrompt(...)` (which also mutes the menu particle FX via `useNoMenuFx`). Reuse `FloatingMatchBackButton` for the back arrow.

---

## 4. Key technical systems (read before editing visuals)

**HUD tokens** (`app/src/App.css` `:root` + `@theme inline`, derived from `--theme-primary/secondary/bg` which `App.tsx` syncs to the active background accent):
`bg-surface | bg-surface-2 | bg-surface-raised` · `border-hairline | border-hairline-strong` · `text-ink | text-ink-muted | text-ink-faint` · `accent | accent-2` · FIXED states `text-success|danger|warning|info` (+ `-soft`). State colours are intentionally fixed for legibility; surfaces/borders/text follow the theme.

**Backdrop shader** (`ThemedBackdrop.tsx`, single `FRAG` template literal):
- Scenes: nebula/aurora/grid/galaxy/holy/quantum/casino (int `u_scene`).
- Noise stack is mobile-safe: **Hoskins hash21 + quintic interp + domain-rotated FBM** (this killed the "squares" on Adreno). Keep it.
- **Touch uniforms:** `u_touch` (vec2, GL y-up px), `u_touchAge` (s since tap), `u_hold` (eased press 0..1.2). Per-scene effect block is in `main()` before the vignette — add a new scene effect with another `else if (u_scene==N)`.
- ⚠ **Never put a backtick in a GLSL comment** — the whole FRAG is a template literal; a backtick closes it (TS1005).
- **Can't judge shader RENDER in the preview** (headless WebGL saturates contexts → false "shader error"/grey). VALIDATE GLSL by fetching the source and compiling the FRAG on a fresh context (pattern used repeatedly this session — see MEMORY). Judge the look on device.

**Menu particle FX** (`ThemeTouchFX.tsx` + `menuFx.ts`): canvas-2D particles on TAP only (not scroll), theme-coloured, additive sprites. Muted on game/deck screens (`useNoMenuFx`), on Contact/Online (by `page`), and inside `[data-no-touchfx]` (drawer/burger/scrim). This is SEPARATE from the backdrop touch uniforms.

**Preview navigation gotcha:** synthetic `dispatchEvent` does NOT trigger React onClick on menu cards / Sidebar (lazy + delegation). Use **native `el.click()`** (works) or the persistent UserHeader button to reach Profile. The splash advances with a dispatched MouseEvent.

---

## 5. Build / run / deploy

```bash
# Dev
cd app && pnpm install && pnpm dev           # vite (browser preview)
npx --no-install tsc --noEmit                # type-check before every commit
npx vite build                               # prod web build before every commit
# Server
rtk cargo check -p rpsls-server              # from repo root (no Docker on this box)
```

**Android APK (the symlink failure is NORMAL on Windows — workaround):**
```bash
cd app && npx tauri android build --apk --target aarch64   # → "Failed to create a symbolic link" → IGNORE; the .so is built
cp target/aarch64-linux-android/release/libapp_lib.so \
   app/src-tauri/gen/android/app/src/main/jniLibs/arm64-v8a/libapp_lib.so   # (run from repo root)
cd app/src-tauri/gen/android && ./gradlew assembleArm64Debug -x rustBuildArm64Debug
"$ANDROID_HOME/platform-tools/adb.exe" install -r app/src-tauri/gen/android/app/build/outputs/apk/arm64/debug/app-arm64-debug.apk
```
APK is **debug-signed** (~45 MB, sideloadable). **CSP gotcha:** any new external host the app talks to must be added to `connect-src` in `app/src-tauri/tauri.conf.json` (compiled into the `.so` → needs a full `tauri android build`, not just gradle).

**Version bump:** `app/src-tauri/tauri.conf.json` `"version"` + `app/src-tauri/gen/android/app/tauri.properties` `versionName`/`versionCode=40XX`.

**Deploy:** Server → Render Blueprint on push to `main` (Dockerfile MUST stay `rust:1.95-bookworm`; wss `wss://rpsls-server-tptj.onrender.com`; free plan sleeps ~15min → that's why online has a CPU fallback). Landing → GH Pages on push to `main` touching `landing/**`. Render env vars (set in dashboard, NOT repo): `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`. App reads with the read-only token in `app/.env.local` (gitignored).

---

## 6. THE PLAN — ordered work for the next agent

> Do these in order. Each item: implement → `tsc` + `vite build` → (visual? build APK + install + eyeball on device) → clean commit. One concern per commit.

### 6.1 — FIRST: collect Alex's device feedback & adjust
v0.4.34 is fully installed but unvalidated. Get his verdict on, and tweak if needed:
- **Touch interactions** (Neon Grid piano / Quantum ripple / Holy held square / Galaxy ripple) — these were coded blind (no shader render in preview), most likely to need tuning of intensity/feel.
- **Galaxy v3** (flash gone? readable under the transparent cards?), **Cybergrid** synthwave, **12 palettes**, particle FX feel.
These are quick numeric tweaks in `ThemedBackdrop.tsx` (effect multipliers) — don't rewrite, dial in.

### 6.2 — Architecture pass (`#31`, Alex insists "PAS DE CA")
~40 files orphaned at `app/src/` root → group into folders (`pages/` for `*Page.tsx`, then split the giants). **This is a DEDICATED, RISKY refactor — do it in safe slices, NOT a naive script:**
- A naive `./`→`../` import rewrite **breaks cross-imports between co-moved files**. Move **one group at a time** (e.g. all `*Page.tsx` → `pages/`), fix imports (the moved files' `./x`→`../x`, and every importer's `./XPage`→`./pages/XPage`, plus cross-page imports back to `./`), then `tsc` + `vite build` to catch every broken path, then commit. Repeat per group.
- Candidate splits (from the old plan): PlayPage → `classic/` (Game + panels) + `menu/`; OnlinePage → match views + queue + bot-fallback; LanesMatchView → phase components. **Extract → tsc/build/install/test → commit**, never one big rewrite.

### 6.3 — Meta-progression for the card mode (`D`, design proposed, NOT built)
Alex wants the card mode to feel like an investment. Proposed brick order (local-first; trading/market = future "accounts" phase since the app is local-only, no auth yet):
1. **Soft currency (Éclats) + shop + animated pack opening** (reuse the level-up WebGL burst).
2. **Duplicates → dust + craft** (anti-RNG).
3. **Collection Codex + completion tiers.**
4. **Per-card mastery + multiple saved decks.**
5. **Seasons** (LP soft-reset + end rewards).
6. *(accounts phase)* player-to-player trade/market.
Confirm WHICH bricks first with Alex (`AskUserQuestion` for balancing) before coding. Card data lives in `ranked/cards.ts`/`rankedTypes.ts`; unlocks in `store.ts` `applyRankedUnlocks`; deck UI in `ranked/DeckManager.tsx`.

### 6.4 — Play Store (`#19`, Alex paid the dev account + verified ID)
Blockers, in order: **1)** release keystore — Gradle already reads `keystore/keystore.properties` (NOT created) → builds are debug-signed; run `keytool -genkey -v -keystore rpsls.jks -alias rpsls -keyalg RSA -keysize 2048 -validity 9125`, Alex keeps the `.jks` (NEVER commit it), agent prepares `keystore.properties`. **2)** build **AAB** (`tauri android build --aab` + gradle `bundleArm64Release`) + Play App Signing. **3)** privacy policy public URL (add to `landing/` → GH Pages `/privacy`). **4)** Data safety form (player.id+nickname→Upstash, Sentry). **5)** content rating (IARC) + listing (icon 512, feature 1024×500, screenshots — generate from preview/device). **6)** internal test track first. targetSdk=36/minSdk=24 OK; permissions INTERNET+VIBRATE only. Also: rotate the full Upstash token before public launch; verify no secret in the AAB; consider a Render keep-alive (`.github/workflows/keepalive.yml` exists) so online isn't a 30s cold start.

### 6.5 — Open bugs / cleanup (low priority)
- **#34** "perdre à l'impasse" (lose on a draw) — not reproducible in code; needs a screenshot/repro from Alex.
- **#41** Hot-seat dead code — `isHotseat`/`PassPanel`/"pass"/"p2-pick" phases still in `PlayPage.tsx`'s Game but unreachable → remove (overlaps with 6.2).

---

## 7. Gotchas / lessons (hard-won this session)

- **Get the real error before guessing** (Render build logs, device logcat). Past blind guesses wasted time.
- **Shaders:** validate by compiling the FRAG on a fresh WebGL context (fetch source); never trust the saturated preview. No backticks in GLSL comments.
- **HUD:** "remove X means remove X, keep the rest." Don't collapse visible menus (a past sandbox collapse made Alex furious → reverted).
- **Mobile WebGL:** clean up rAF / timers / contexts on unmount (`WEBGL_lose_context.loseContext()` on real unmount only — NOT on a `[scene]` re-run, that caused a grey screen). Cap heavy effects.
- **Background agents:** delegate big mechanical/parallel work to **Haiku** sub-agents (the i18n translations were done this way, cheaply, while the main agent coded) — but always verify their output yourself (key counts, placeholders, tsc).
- After any client change: bump version, build APK (workaround §4), install, eyeball, THEN commit. Release = FF-merge to `main` + push (only when Alex says).
