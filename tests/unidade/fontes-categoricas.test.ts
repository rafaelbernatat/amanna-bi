/**
 * As fontes que os painéis categóricos exigiram (T-118.1).
 *
 * Duas views novas e três colunas, e o que este arquivo protege em todas é a
 * mesma coisa: **elas repartem um número que já existe, e não criam um
 * segundo**. Uma quebra que não reconcilia com o total de onde saiu é a forma
 * mais silenciosa de a mesma pergunta ter duas respostas na mesma tela.
 */

import { describe, expect, it } from "vitest";

import {
  CLIENTES_A_RECEBER,
  FORNECEDORES_A_PAGAR,
  NATUREZAS_DE_SAIDA,
} from "@/acesso/fixtures/contraparte";
import {
  DIMENSOES_DA_SAIDA,
  QUEBRAS_DA_SAIDA,
  VW_FATO_RH_DESLIGAMENTO,
} from "@/acesso/fixtures/desligamento";
import { mesesDe } from "@/acesso/fixtures/eixos";
import {
  VW_FATO_CONTAS,
  VW_FATO_FATURAMENTO_CLIENTE,
  VW_FATO_FIN_MES,
  VW_FATO_SAIDA_CATEGORIA,
} from "@/acesso/fixtures/fin";
import { VW_FATO_RH_PERFIL } from "@/acesso/fixtures/perfil";
import {
  QUADRO_POR_GENERO,
  SEGMENTOS_DE_CLIENTE,
  TOP_CLIENTES,
} from "@/acesso/fixtures/referencia-perfil";
import { VW_FATO_RH_MES } from "@/acesso/fixtures/rh";

const MESES = mesesDe("2026");
const UM_MILHAO = 1_000_000;

/* ------------------------------------------------------------------ *
 * vw_fato_rh_desligamento
 * ------------------------------------------------------------------ */

describe("as saídas quebradas não são uma segunda contagem", () => {
  it.each(DIMENSOES_DA_SAIDA)(
    "na dimensão %s, cada célula soma o desligamento que ela já tinha",
    (dimensao) => {
      const daDimensao = VW_FATO_RH_DESLIGAMENTO.filter(
        (l) => l.dimensao === dimensao,
      );
      const divergentes: string[] = [];

      for (const celula of VW_FATO_RH_MES) {
        const soma = daDimensao
          .filter(
            (l) =>
              l.mes === celula.mes &&
              l.entidade === celula.entidade &&
              l.area === celula.area &&
              l.modalidade === celula.modalidade,
          )
          .reduce((a, l) => a + l.desligamentos, 0);
        if (soma !== celula.desligamentos) {
          divergentes.push(
            `${celula.mes} ${celula.entidade} ${celula.area}: ${String(soma)} contra ${String(celula.desligamentos)}`,
          );
        }
      }

      expect(divergentes.slice(0, 5)).toEqual([]);
    },
  );

  it.each(DIMENSOES_DA_SAIDA)(
    "na dimensão %s, o total do ano é o mesmo do fato mensal",
    (dimensao) => {
      const soma = VW_FATO_RH_DESLIGAMENTO.filter(
        (l) => l.dimensao === dimensao,
      ).reduce((a, l) => a + l.desligamentos, 0);
      const mensal = VW_FATO_RH_MES.reduce((a, l) => a + l.desligamentos, 0);
      expect(soma).toBe(mensal);
      expect(mensal).toBe(145);
    },
  );

  it("cada dimensão tem exatamente os valores declarados", () => {
    for (const [dimensao, valores] of Object.entries(QUEBRAS_DA_SAIDA)) {
      const presentes = new Set(
        VW_FATO_RH_DESLIGAMENTO.filter((l) => l.dimensao === dimensao).map(
          (l) => l.valor,
        ),
      );
      expect([...presentes].sort(), dimensao).toEqual(
        valores.map((v) => v.codigo).sort(),
      );
    }
  });

  /*
   * A leitura que o painel `tov-corte` existe para dar.
   *
   * Se as saídas fossem repartidas pelo tamanho de cada faixa, a taxa de saída
   * seria igual em todas e o painel não diria nada. A repartição é por
   * quadro × turnover, e é isso que faz a faixa 18–24 sair muito mais que a de
   * 55+ — que é o achado, não o desenho.
   */
  it("a faixa mais jovem sai proporcionalmente mais que a mais velha", () => {
    const saidasDe = (valor: string) =>
      VW_FATO_RH_DESLIGAMENTO.filter(
        (l) => l.dimensao === "faixa_etaria" && l.valor === valor,
      ).reduce((a, l) => a + l.desligamentos, 0);

    const quadroDe = (valor: string) =>
      VW_FATO_RH_PERFIL.filter(
        (l) =>
          l.dimensao === "faixa_etaria" &&
          l.valor === valor &&
          l.mes === "2026-12",
      ).reduce((a, l) => a + l.headcountFte, 0);

    const jovem = saidasDe("18-24") / quadroDe("18-24");
    const velha = saidasDe("55-mais") / quadroDe("55-mais");
    expect(jovem).toBeGreaterThan(velha * 2);
  });

  /*
   * A guarda que faltava, e o defeito que ela teria pegado.
   *
   * `tov-corte` divide saídas por quadro dentro da mesma faixa. Se os dois
   * lados usarem códigos diferentes para a mesma faixa, o denominador vem
   * vazio e a divisão dá infinito — foi exatamente o que aconteceu: eu escrevi
   * `55+` na quebra das saídas onde o quadro diz `55-mais`.
   *
   * A correção estrutural foi derivar os códigos do quadro em vez de copiá-los.
   * Este caso é o cinto: se alguém voltar a escrevê-los à mão, reprova aqui em
   * vez de reprovar numa tela com um gráfico vazio.
   */
  it.each(["genero", "faixa_etaria"])(
    "os códigos de %s são exatamente os do quadro",
    (dimensao) => {
      const doQuadro = new Set(
        VW_FATO_RH_PERFIL.filter((l) => l.dimensao === dimensao).map(
          (l) => l.valor,
        ),
      );
      const daSaida = new Set(
        VW_FATO_RH_DESLIGAMENTO.filter((l) => l.dimensao === dimensao).map(
          (l) => l.valor,
        ),
      );
      expect([...daSaida].sort()).toEqual([...doQuadro].sort());
      expect(daSaida.size).toBeGreaterThan(1);
    },
  );

  it("a saída voluntária é a maior parcela, como o protótipo lê", () => {
    const porTipo = QUEBRAS_DA_SAIDA["tipo"] ?? [];
    const soma = (codigo: string) =>
      VW_FATO_RH_DESLIGAMENTO.filter(
        (l) => l.dimensao === "tipo" && l.valor === codigo,
      ).reduce((a, l) => a + l.desligamentos, 0);
    const maior = porTipo
      .map((t) => ({ codigo: t.codigo, total: soma(t.codigo) }))
      .reduce((a, b) => (b.total > a.total ? b : a));
    expect(maior.codigo).toBe("voluntario");
  });
});

/* ------------------------------------------------------------------ *
 * Gênero como dimensão do quadro
 * ------------------------------------------------------------------ */

describe("gênero entra como quebra do quadro", () => {
  it("as três categorias somam o quadro, como as demais dimensões", () => {
    const dezembro = VW_FATO_RH_PERFIL.filter(
      (l) => l.dimensao === "genero" && l.mes === "2026-12",
    );
    const soma = dezembro.reduce((a, l) => a + l.headcountFte, 0);
    const declarado = QUADRO_POR_GENERO.reduce((a, p) => a + p.headcount, 0);
    expect(soma).toBe(declarado);
    expect(declarado).toBe(1240);
  });

  it("a dimensão responde ao recorte de área", () => {
    // Sem isto seria o achado 5 outra vez: uma composição igual em toda área.
    const daArea = (area: string) =>
      VW_FATO_RH_PERFIL.filter(
        (l) =>
          l.dimensao === "genero" && l.mes === "2026-12" && l.area === area,
      ).reduce((a, l) => a + l.headcountFte, 0);
    expect(daArea("operacoes")).not.toBe(daArea("tecnologia"));
  });
});

/* ------------------------------------------------------------------ *
 * Contraparte e naturezas de saída
 * ------------------------------------------------------------------ */

describe("a contraparte reparte a carteira, e o resíduo é declarado", () => {
  it("as listas incluem o balde de resto, sem o qual a soma não fecharia", () => {
    /*
     * As seis contrapartes nomeadas não são a carteira inteira. Sem um balde
     * explícito, a soma das linhas daria menos que o saldo do balanço — e
     * ninguém notaria, porque o painel só desenha as maiores.
     */
    expect(CLIENTES_A_RECEBER.map((c) => c.codigo)).toContain(
      "outros-clientes",
    );
    expect(FORNECEDORES_A_PAGAR.map((c) => c.codigo)).toContain(
      "outros-fornecedores",
    );
  });

  it("os três maiores clientes concentram a maior parte do vencido", () => {
    const vencido = VW_FATO_CONTAS.filter(
      (l) => l.mes === "2026-12" && l.faixaDeAging !== "a-vencer",
    );
    const porCliente = CLIENTES_A_RECEBER.filter(
      (c) => c.codigo !== "outros-clientes",
    ).map((c) => ({
      codigo: c.codigo,
      total: vencido
        .filter((l) => l.contraparte === c.codigo)
        .reduce((a, l) => a + l.aReceber, 0),
    }));

    const nomeados = porCliente.reduce((a, c) => a + c.total, 0);
    const tres = porCliente
      .map((c) => c.total)
      .sort((a, b) => b - a)
      .slice(0, 3)
      .reduce((a, b) => a + b, 0);

    expect(nomeados).toBeGreaterThan(0);
    expect(tres / nomeados).toBeGreaterThan(0.6);
  });
});

describe("a saída por natureza é a mesma saída, com mais detalhe", () => {
  it.each(MESES)("%s: as naturezas somam a saída de caixa do mês", (mes) => {
    const doMes = VW_FATO_FIN_MES.filter((l) => l.mes === mes);
    const declarado = doMes.reduce((a, l) => a + l.saidasDeCaixa, 0);
    const porNatureza = VW_FATO_SAIDA_CATEGORIA.filter(
      (l) => l.mes === mes,
    ).reduce((a, l) => a + l.valor, 0);
    expect(porNatureza).toBe(declarado);
  });

  it("as oito naturezas do protótipo estão todas lá", () => {
    const presentes = new Set(VW_FATO_SAIDA_CATEGORIA.map((l) => l.categoria));
    expect([...presentes].sort()).toEqual(
      NATUREZAS_DE_SAIDA.map((n) => n.codigo).sort(),
    );
  });

  it("juros aparecem entre as três maiores, que é a leitura do painel", () => {
    const total = (codigo: string) =>
      VW_FATO_SAIDA_CATEGORIA.filter((l) => l.categoria === codigo).reduce(
        (a, l) => a + l.valor,
        0,
      );
    const ordenadas = NATUREZAS_DE_SAIDA.map((n) => ({
      codigo: n.codigo,
      total: total(n.codigo),
    })).sort((a, b) => b.total - a.total);
    expect(ordenadas.slice(0, 3).map((n) => n.codigo)).toContain("juros");
  });

  it("nenhuma natureza é maior que a saída do ano", () => {
    // Guarda contra repartição invertida, que passaria despercebida no total.
    const anual = VW_FATO_FIN_MES.reduce((a, l) => a + l.saidasDeCaixa, 0);
    for (const natureza of NATUREZAS_DE_SAIDA) {
      const total = VW_FATO_SAIDA_CATEGORIA.filter(
        (l) => l.categoria === natureza.codigo,
      ).reduce((a, l) => a + l.valor, 0);
      expect(total, natureza.codigo).toBeLessThan(anual);
      expect(total / UM_MILHAO, natureza.codigo).toBeGreaterThan(0);
    }
  });
});

/* ------------------------------------------------------------------ *
 * Segmento
 * ------------------------------------------------------------------ */

describe("o segmento comercial do cliente", () => {
  it("todo cliente tem segmento, e ele é um dos declarados", () => {
    for (const cliente of TOP_CLIENTES) {
      expect(SEGMENTOS_DE_CLIENTE, cliente.codigo).toContain(cliente.segmento);
    }
  });

  it("os cinco segmentos cobrem a carteira inteira, sem sobra", () => {
    const total = VW_FATO_FATURAMENTO_CLIENTE.reduce(
      (a, l) => a + l.receita,
      0,
    );
    const soma = SEGMENTOS_DE_CLIENTE.reduce(
      (a, seg) =>
        a +
        VW_FATO_FATURAMENTO_CLIENTE.filter((l) => l.segmento === seg).reduce(
          (b, l) => b + l.receita,
          0,
        ),
      0,
    );
    expect(soma).toBe(total);
  });

  it("indústria é o maior segmento, como o centro da rosca diz", () => {
    const porSegmento = SEGMENTOS_DE_CLIENTE.map((seg) => ({
      seg,
      total: VW_FATO_FATURAMENTO_CLIENTE.filter(
        (l) => l.segmento === seg,
      ).reduce((a, l) => a + l.receita, 0),
    }));
    const maior = porSegmento.reduce((a, b) => (b.total > a.total ? b : a));
    expect(maior.seg).toBe("industria");
  });
});
