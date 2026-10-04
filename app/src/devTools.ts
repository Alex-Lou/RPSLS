/**
 * Outils de test in-app (panneau de logs Arena, révocation d'achat…).
 *
 * `__DEV_TOOLS__` est injecté par Vite (`define`, vite.config.ts) : vrai en
 * `pnpm dev` / `tauri dev` / `tauri build --debug`, faux sinon (fail-closed).
 * Le `typeof` évite tout plantage si un build ne passe pas par ce define
 * (ReferenceError « __DEV_TOOLS__ is not defined » vu sur device, 2026-10) :
 * les outils sont alors simplement absents. Lire CE module, jamais la globale.
 */
export const DEV_TOOLS: boolean = typeof __DEV_TOOLS__ !== "undefined" && __DEV_TOOLS__;
