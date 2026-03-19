import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import globals from "globals";
import mozilla from "eslint-plugin-mozilla";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "web-ext-artifacts/**",
      "coverage/**",
      "**/*_files/**",
      "**/*.html",
      "**/*.css",
      "**/*.svg",
    ],
  },
  js.configs.recommended,
  ...mozilla.configs["flat/recommended"],
  {
    files: ["**/*.{js,cjs,mjs}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-console": "off",
    },
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        { "checksVoidReturn": { "attributes": false } }
      ]
    },
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      globals: {
        browser: "readonly",
        chrome: "readonly",
      },
    },
  },
  {
    files: ["tests/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    rules: {
      "no-undef": "off",
    },
  },
];
