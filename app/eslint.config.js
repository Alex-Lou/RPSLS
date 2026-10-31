import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  // arena/ + balancelab/ : Constellation Pro est en veille (code gelé).
  { ignores: ["dist", "coverage", "public", "src-tauri", "src/arena", "src/balancelab"] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      "no-console": "error",
    },
  },
  {
    files: ["scripts/**/*.ts", "*.config.{js,ts}"],
    languageOptions: { globals: globals.node },
  },
);
