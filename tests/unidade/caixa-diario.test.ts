/**
 * A view de caixa com grão de dia (T-117.1).
 *
 * O que este arquivo protege é uma coisa só, e ela é mais frágil do que parece:
 * **o caixa diário e o caixa mensal não podem discordar**. São a mesma medida
 * com resoluções diferentes, e o dia em que deixarem de bater ninguém vai
 * descobrir por acaso — vai descobrir numa reunião, com dois números na tela.
 */

import { describe, expect, it } from "vitest";

import {
  DIAS_DE_CONCENTRACAO_DE_SAIDA,
  diasUteisDoMes,
  VW_FATO_CAIXA_DIARIO,
} from "@/acesso/fixtures/caixa-diario";
import { ENTIDADES_ARMAZENADAS, mesesDe } from "@/acesso/fixtures/eixos";
import { VW_FATO_FIN_MES } from "@/acesso/fixtures/fin";

const MESES = mesesDe("2026");

describe("a reconciliação com o mensal", () => {
  it.each(MESES)("%s fecha nas duas medidas, entidade por entidade", (mes) => {
    for (const entidade of ENTIDADES_ARMAZENADAS) {
      const doMes = VW_FATO_FIN_MES.find(
        (l) => l.mes === mes && l.entidade === entidade,
      );
      expect(doMes, `${mes} ${entidade} não existe no mensal`).toBeDefined();

      const dias = VW_FATO_CAIXA_DIARIO.filter(
        (l) => l.mes === mes && l.entidade === entidade,
      );
      expect(dias.length, `${mes} ${entidade} sem dias`).toBeGreaterThan(0);

      const entradas = dias.reduce((a, l) => a + l.entradas, 0);
      const saidas = dias.reduce((a, l) => a + l.saidas, 0);

      expect(entradas, `entradas de ${mes} ${entidade}`).toBe(
        doMes?.entradasDeCaixa,
      );
      expect(saidas, `saídas de ${mes} ${entidade}`).toBe(doMes?.saidasDeCaixa);
    }
  });

  it("o ano inteiro fecha, somando tudo", () => {
    const diario = VW_FATO_CAIXA_DIARIO.reduce(
      (a, l) => a + l.entradas - l.saidas,
      0,
    );
    const mensal = VW_FATO_FIN_MES.reduce(
      (a, l) => a + l.entradasDeCaixa - l.saidasDeCaixa,
      0,
    );
    expect(diario).toBe(mensal);
  });

  /*
   * O contraste que dá sentido ao teste de cima.
   *
   * Bater no total anual seria fácil de conseguir por acaso — erro de mais num
   * mês e de menos noutro se cancelam. É por isso que a reconciliação é POR
   * MÊS e POR ENTIDADE, e é isso que este caso registra: as compensações
   * cruzadas não existem porque cada célula fecha sozinha.
   */
  it("nenhum mês individual depende de outro para fechar", () => {
    const desvios = MESES.flatMap((mes) =>
      ENTIDADES_ARMAZENADAS.map((entidade) => {
        const doMes = VW_FATO_FIN_MES.find(
          (l) => l.mes === mes && l.entidade === entidade,
        );
        const dias = VW_FATO_CAIXA_DIARIO.filter(
          (l) => l.mes === mes && l.entidade === entidade,
        );
        const soma = dias.reduce((a, l) => a + l.entradas - l.saidas, 0);
        const alvo =
          (doMes?.entradasDeCaixa ?? 0) - (doMes?.saidasDeCaixa ?? 0);
        return { celula: `${mes} ${entidade}`, desvio: soma - alvo };
      }),
    ).filter((d) => d.desvio !== 0);

    expect(desvios).toEqual([]);
  });
});

describe("o calendário", () => {
  it("cobre todo dia útil de 2026, e nenhum fim de semana", () => {
    for (const mes of MESES) {
      const dias = diasUteisDoMes(mes);
      for (const dia of dias) {
        const semana = new Date(`${dia}T00:00:00Z`).getUTCDay();
        expect(semana, dia).toBeGreaterThan(0);
        expect(semana, dia).toBeLessThan(6);
      }
    }
  });

  it("2026 tem 261 dias úteis, contados e não escritos", () => {
    /*
     * O número está aqui porque um teste que só diz "mais de zero" não pega o
     * defeito que interessa: um mês faltando inteiro. 2026 começa numa
     * quinta-feira e não é bissexto — 261 é o que sai da contagem, e se a
     * função mudar de comportamento este caso diz exatamente quanto mudou.
     */
    const total = MESES.reduce((a, mes) => a + diasUteisDoMes(mes).length, 0);
    expect(total).toBe(261);
  });

  it("cada dia útil aparece uma vez por entidade, e só uma", () => {
    const chaves = VW_FATO_CAIXA_DIARIO.map((l) => `${l.dia}|${l.entidade}`);
    expect(new Set(chaves).size).toBe(chaves.length);

    const uteis = MESES.reduce((a, mes) => a + diasUteisDoMes(mes).length, 0);
    expect(VW_FATO_CAIXA_DIARIO.length).toBe(
      uteis * ENTIDADES_ARMAZENADAS.length,
    );
  });

  it("fevereiro de ano bissexto ganha o dia 29 quando ele é útil", () => {
    // 29/02/2028 cai numa terça. O caso existe porque a regra de bissexto é o
    // tipo de coisa que se escreve errado uma vez e ninguém percebe por anos.
    expect(diasUteisDoMes("2028-02")).toContain("2028-02-29");
    expect(diasUteisDoMes("2026-02")).not.toContain("2026-02-29");
  });
});

describe("o mês tem forma, e a forma é a que o painel quer mostrar", () => {
  it("há dia negativo, e ele é minoria", () => {
    /*
     * A nota do protótipo diz "9 dos 30 dias fecharam negativos, concentrados
     * nas datas de vencimento". Não copio o 9 — ele é do dado do protótipo,
     * não deste. O que precisa valer é a leitura: dia negativo existe e é
     * exceção. Uma repartição por igual daria zero dias negativos e o painel
     * viraria um retângulo.
     */
    const dezembro = VW_FATO_CAIXA_DIARIO.filter(
      (l) => l.mes === "2026-12" && l.entidade === "unidade-sp",
    );
    const negativos = dezembro.filter((l) => l.entradas - l.saidas < 0);

    expect(negativos.length).toBeGreaterThan(0);
    expect(negativos.length).toBeLessThan(dezembro.length / 2);
  });

  /*
   * O invariante do perfil, em todos os meses e não num escolhido a dedo.
   *
   * A primeira versão deste caso afirmava que o dia 30 era o mais pesado,
   * porque era o que o comentário do módulo dizia. Era o comentário que estava
   * errado: o dia 5 acumula vencimento de fornecedor e adiantamento de folha, e
   * as constantes sempre disseram isso. Prosa e código agora concordam, e o
   * teste passou a afirmar a propriedade em vez de uma data.
   */
  it.each(MESES)(
    "em %s a maior saída cai num dia de concentração declarado",
    (mes) => {
      const doMes = VW_FATO_CAIXA_DIARIO.filter(
        (l) => l.mes === mes && l.entidade === "unidade-sp",
      );
      const maior = doMes.reduce((a, l) => (l.saidas > a.saidas ? l : a));
      const numero = Number(maior.dia.split("-")[2]);

      expect(
        DIAS_DE_CONCENTRACAO_DE_SAIDA.some((d) => d === numero),
        `${mes}: a maior saída caiu no dia ${String(numero)}`,
      ).toBe(true);

      // E é concentração de verdade: pelo menos o dobro de um dia comum.
      const comum = doMes.find(
        (l) =>
          !DIAS_DE_CONCENTRACAO_DE_SAIDA.some(
            (d) => Math.abs(d - Number(l.dia.split("-")[2])) <= 1,
          ),
      );
      expect(maior.saidas).toBeGreaterThan((comum?.saidas ?? 0) * 2);
    },
  );
});
