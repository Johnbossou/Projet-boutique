import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // Fichiers de configuration CommonJS générés par create-next-app.
      // La règle no-require-imports est pertinente pour le code applicatif,
      // pas pour un jest.config.js dont le format CommonJS est imposé par Jest.
      "jest.config.js",
      "jest.setup.js",
      "postcss.config.js",
    ],
  },
];

export default eslintConfig;
