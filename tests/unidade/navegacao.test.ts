import { describe, expect, it } from "vitest";

import {
  MODULOS,
  TELA_PADRAO,
  acharModulo,
  acharTela,
  primeiraTelaDe,
  todasAsRotas,
} from "@/apresentacao/navegacao/telas";

/**
 * O registro de navegacao de T-126.
 *
 * As contagens do PRD (3 modulos, 13 telas) ficam aqui como numero para que
 * acrescentar ou remover uma tela sem intencao reprove o comando.
 */

/** Inventario do Anexo A do PRD: tela por tela, na ordem. */
const INVENTARIO = [
  "/rh/visao",
  "/rh/colab",
  "/rh/turnover",
  "/rh/recrut",
  "/rh/trein",
  "/rh/engaj",
  "/rh/sal",
  "/fin/visao",
  "/fin/caixa",
  "/fin/orc",
  "/fin/contas",
  "/fin/fat",
  "/int/cruz",
] as const;

describe("Registro de navegacao", () => {
  it("tem exatamente 3 modulos", () => {
    expect(MODULOS).toHaveLength(3);
    expect(MODULOS.map((m) => m.id)).toEqual(["rh", "fin", "int"]);
  });

  it("tem exatamente as 13 telas do Anexo A, na ordem", () => {
    expect(todasAsRotas()).toEqual([...INVENTARIO]);
  });

  it("distribui as telas como o Anexo A: 7 de RH, 5 de Financeiro, 1 de Integracao", () => {
    expect(MODULOS.map((m) => m.telas.length)).toEqual([7, 5, 1]);
  });

  it("nenhuma rota se repete", () => {
    const rotas = todasAsRotas();
    expect(new Set(rotas).size).toBe(rotas.length);
  });

  it("todo modulo abre na primeira tela dele", () => {
    expect(MODULOS.map((m) => primeiraTelaDe(m))).toEqual([
      "/rh/visao",
      "/fin/visao",
      "/int/cruz",
    ]);
  });

  it("a tela padrao do produto e a primeira do primeiro modulo", () => {
    expect(TELA_PADRAO).toBe("/rh/visao");
    expect(todasAsRotas()[0]).toBe(TELA_PADRAO);
  });

  it("toda tela tem titulo e todo modulo tem nome completo", () => {
    for (const modulo of MODULOS) {
      expect(modulo.nomeCompleto.length, modulo.id).toBeGreaterThan(0);
      for (const tela of modulo.telas) {
        expect(tela.titulo.length, `${modulo.id}/${tela.slug}`).toBeGreaterThan(
          0,
        );
      }
    }
  });

  it("acharTela devolve indefinido para modulo ou slug fora do inventario", () => {
    expect(acharTela("rh", "visao")).toBeDefined();
    expect(acharTela("rh", "nao-existe")).toBeUndefined();
    expect(acharTela("xx", "visao")).toBeUndefined();
    expect(acharTela("int", "visao")).toBeUndefined();
    expect(acharModulo("xx")).toBeUndefined();
  });
});
