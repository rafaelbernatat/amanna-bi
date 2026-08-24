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
    /*
     * Limite de 30 s por caso, e nao os 5 s do padrao.
     *
     * Tres casos das regras de lint (T-141 e T-181) montam uma instancia de
     * ESLint e passam o plugin sobre arquivos de verdade. Sozinhos levam de
     * meio a um segundo e meio; com a suite inteira disputando CPU chegaram a
     * 10,5 s e estouraram o padrao -- vermelho sem defeito, tres vezes seguidas,
     * exatamente o que ensina a ignorar vermelho.
     *
     * Isto nao afrouxa aceite nenhum: nenhuma assercao muda, so o tempo que
     * elas tem para terminar. Um caso que passe de 30 s e outra conversa e
     * merece investigacao, nao mais folga.
     */
    testTimeout: 30_000,
  },
});
