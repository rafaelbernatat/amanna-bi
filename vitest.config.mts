import { defineConfig } from "vitest/config";

/**
 * Runner de teste de unidade (T-005.1).
 *
 * Cobre as tres camadas da secao 8.1 do PRD. Os testes de e2e ficam fora daqui:
 * rodam no Playwright, sob `npm run e2e`, para que uma etapa nao mascare a outra
 * no pipeline (T-006).
 */
export default defineConfig({
  resolve: {
    // Resolve os apelidos @/apresentacao, @/semantica, @/acesso e @/seguranca.
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**", ".next/**"],
    reporters: ["default"],
  },
});
