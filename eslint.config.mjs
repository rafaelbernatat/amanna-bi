import js from "@eslint/js";
import tseslint from "typescript-eslint";
import next from "eslint-config-next";
import prettierRecomendado from "eslint-plugin-prettier/recommended";

/**
 * Configuracao de lint do painel (T-005).
 *
 * Duas garantias que o criterio de aceite exige e que nao podem ser afrouxadas:
 *   1. `any` explicito e erro, nao aviso — o contrato de dados da secao 9 do PRD
 *      so tem valor se for verificado (PRD secao 8.2).
 *   2. Formatacao divergente e erro de lint, via eslint-plugin-prettier, para que
 *      um unico comando reprove os dois casos.
 */
export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "dist/**",
      "coverage/**",
      "next-env.d.ts",
      "public/**",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...next,

  // Formatacao: divergencia do Prettier vira erro de lint.
  prettierRecomendado,

  {
    rules: {
      // O criterio de aceite de T-005 nomeia este caso explicitamente.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
