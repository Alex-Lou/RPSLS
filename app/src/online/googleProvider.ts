/**
 * googleProvider.ts — wires native "Sign in with Google" as the
 * GoogleTokenProvider. Self-registers on import (from main.tsx) IFF a client id
 * is configured (`VITE_GOOGLE_CLIENT_ID` = the Google **Web application** OAuth
 * client id). Until then `isGoogleAvailable()` is false and the Google button
 * stays hidden — never a dead button.
 *
 * Mechanism: `tauri-plugin-google-auth` uses Android's native Credential Manager
 * / AuthorizationClient (NO deep-link / redirect plumbing) and returns a Google
 * ID token, which the server verifies independently (RS256 + JWKS,
 * `crates/rpsls-server/src/google_auth.rs`). So this layer can't be a security
 * hole — a forged token is rejected server-side. Swapping to Play Games later =
 * a different provider registered here; the rest of the auth flow is untouched.
 */

import { setGoogleTokenProvider } from "./accountAuth";

// Web-application OAuth client id, injected at build time by Vite. The Android
// OAuth client (package + SHA-1) is configured in Google Cloud so Google trusts
// the app, but is NEVER used in code — the ID token's `aud` is THIS web id, and
// the server's GOOGLE_OAUTH_CLIENT_IDS must contain it.
const WEB_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim();

if (WEB_CLIENT_ID) {
  setGoogleTokenProvider(async () => {
    // Lazy import: the native module is only touched on an actual tap, so a
    // browser/preview build never loads it at boot.
    const { signIn } = await import("@choochmeque/tauri-plugin-google-auth-api");
    const res = await signIn({
      clientId: WEB_CLIENT_ID,
      scopes: ["openid", "email", "profile"],
      flowType: "native",
    });
    return res.idToken ?? null;
  });
}
