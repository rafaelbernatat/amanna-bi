import { describe, expect, it } from "vitest";

/**
 * Teste quebrado de proposito (H-02).
 *
 * Existe para provar que uma etapa vermelha impede o merge. E removido assim
 * que a prova termina — se este arquivo sobreviver, o portao nunca foi testado.
 */
describe("Prova do portao de CI", () => {
  it("falha de proposito para reprovar a etapa 'teste'", () => {
    expect(1 + 1, "quebra deliberada de H-02").toBe(3);
  });
});
