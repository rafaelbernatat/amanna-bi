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

  // T-124: cor hexadecimal literal so existe no arquivo de tema.
  //
  // Sem isto, a paleta volta a se espalhar em atributos style como no
  // prototipo, onde 68 cores vivem soltas e nenhuma tem nome. O tema e a
  // unica excecao, e e por isso que ele esta em `ignores`.
  {
    files: ["src/**/*.ts", "src/**/*.tsx", "tests/**/*.ts"],
    ignores: ["src/apresentacao/tema/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/#[0-9a-fA-F]{3,8}/]",
          message:
            "Cor hexadecimal literal fora do tema. Importe a chave de PALETA em src/apresentacao/tema/tema.ts (T-124).",
        },
        {
          selector: "TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}/]",
          message:
            "Cor hexadecimal literal fora do tema. Importe a chave de PALETA em src/apresentacao/tema/tema.ts (T-124).",
        },
      ],
    },
  },

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
