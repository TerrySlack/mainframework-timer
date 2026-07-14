// eslint.config.mjs
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactCompiler from "eslint-plugin-react-compiler";

export default [
  // 1) Ignore generated and vendor content
  {
    ignores: [
      "dist/**",
      "build/**",
      "coverage/**",
      ".next/**",
      "out/**",
      ".rollup.cache/**",
      "node_modules/**",
      "pnpm-lock.yaml",
      "package-lock.json",
      "yarn.lock",
      "jest.worker-setup.ts",
    ],
  },

  // 2) Base JS recommended rules
  js.configs.recommended,

  // 3) TypeScript type-aware rules — scoped to .ts/.tsx only
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ["**/*.ts", "**/*.tsx"],
  })),

  // 4) Language options for TS (type-aware; matches tsconfig.eslint.json)
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ["./tsconfig.eslint.json"],
        tsconfigRootDir: import.meta.dirname,
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    rules: {
      // Add any TypeScript-specific rule adjustments here
    },
  },

  // 5) JS/MJS config files — non-type-checked TypeScript rules
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["**/*.mjs", "**/*.js"],
  })),

  // 6) Hooks + React Compiler (hook-only .ts files)
  {
    files: ["src/hooks/**/*.ts"],
    plugins: {
      "react-hooks": reactHooks,
      "react-compiler": reactCompiler,
    },
    rules: {
      ...(reactHooks.configs?.recommended?.rules ?? {}),
      "react-hooks/refs": "off",
      "react-compiler/react-compiler": "error",
    },
  },

  // 7) Globals for browser and node
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
    },
  },

  // 8) Test files: relax strict rules for Jest matchers
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
    },
  },
];
