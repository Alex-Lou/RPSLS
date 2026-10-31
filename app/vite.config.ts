/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async ({ command }) => ({
  plugins: [react(), tailwindcss()],

  // Outils de test (achats gratuits, révocation, panneau de logs Arena) :
  // FAIL-CLOSED. Présents seulement en `pnpm dev` / `tauri dev` et dans les
  // builds `tauri build --debug` (Tauri pose TAURI_ENV_DEBUG pour le
  // beforeBuildCommand). Une release, ou un `pnpm build` nu, les retire du bundle.
  define: {
    // @ts-expect-error process is a nodejs global
    __DEV_TOOLS__: JSON.stringify(command === "serve" || process.env.TAURI_ENV_DEBUG === "true"),
  },

  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 1421 }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },

  // Logique pure en Node (`*.test.ts`), composants en jsdom (`*.test.tsx`).
  test: {
    projects: [
      { extends: true, test: { name: "logic", environment: "node", include: ["src/**/*.test.ts"] } },
      {
        extends: true,
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["src/test/setup.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/test/**", "src/arena/**", "src/balancelab/**", "src/i18n/locales/**"],
    },
  },
}));
