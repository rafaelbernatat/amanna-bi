/**
 * Os seis estados obrigatórios de painel e KPI (T-132, PRD seção 6.4).
 *
 * O aceite tem quatro exigências, e três delas se provam sobre o **HTML
 * servido** — sem navegador, porque o que importa é o que sai do servidor:
 *
 * 1. os seis estados existem e desenham, em painel e em cartão;
 * 2. o vazio exibe o motivo **e** o atalho para ampliar o recorte;
 * 3. o "sem permissão" não contém agregado no HTML servido.
 *
 * A quarta — esqueleto com a altura do gráfico final dentro de 4 px — aparece
 * aqui como igualdade de marcação, e em `tests/e2e/estados.spec.ts` como
 * medição de altura resolvida no navegador. As duas juntas: uma diz que os
 * números declarados batem, a outra diz que o navegador concorda.
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { alturaDaForma, ALTURA_DA_FORMA } from "@/apresentacao/graficos/altura";
import { Esqueleto } from "@/apresentacao/graficos/Esqueleto";
import { CartaoEmEstado } from "@/apresentacao/paineis/CartaoEmEstado";
import { PainelEmEstado } from "@/apresentacao/paineis/PainelEmEstado";
import type { Frescor, Kpi, PanelResponse } from "@/semantica/contrato";
import { type EstadoDe, ESTADOS, estadoDe, temCarga } from "@/semantica/estado";
import {
  FORMAS_CATEGORICAS,
  FORMAS_COMPOSTAS,
  FORMAS_DE_SERIE_TEMPORAL,
} from "@/semantica/origem-de-painel";
import { type Forma, FORMAS } from "@/semantica/painel";
import { comValor, MOTIVOS_DE_VAZIO, vazio } from "@/semantica/vazio";

/* ------------------------------------------------------------------ *
 * O dado forjado
 * ------------------------------------------------------------------ */

/**
 * Números que não aparecem em lugar nenhum por acaso.
 *
 * O teste de vazamento procura por eles no HTML. Com 742 ou 100 não daria para
 * distinguir o agregado de um `padding` ou de uma cor — e o teste passaria ou
 * falharia por motivo errado.
 */
const TOTAL_MARCADO = 86753091;
const SERIE_MARCADA = [86753092, 86753093, 86753094];
const VALOR_MARCADO = 86753095;
const DELTA_MARCADO = 86753096;

const ENVELOPE = {
  id: "painel-de-teste",
  title: "Headcount por área",
  unit: "FTE",
  formula: "soma de headcount no mês, por área",
  total: TOTAL_MARCADO,
  note: null,
  asOf: "2026-12-31",
  forma: "barras",
  categories: ["Operações", "Comercial", "Tecnologia"],
  series: [{ name: "Headcount", values: SERIE_MARCADA, papel: "valor" }],
} as unknown as PanelResponse;

const CARTAO = {
  id: "kpi-de-teste",
  label: "Headcount total",
  value: VALOR_MARCADO,
  unit: "FTE",
  delta: DELTA_MARCADO,
  sentiment: "good",
  rodape: "Dezembro de 2026, consolidado",
  serie: SERIE_MARCADA,
} as unknown as Kpi;

const EM_DIA: Frescor = {
  asOf: "2026-12-31",
  sincronizadoEm: "2026-08-26T06:15",
  defasado: false,
};

const DEFASADO: Frescor = {
  asOf: "2026-11-30",
  sincronizadoEm: "2026-08-19T23:40",
  defasado: true,
};

const ESTADOS_DE_PAINEL: Readonly<Record<string, EstadoDe<PanelResponse>>> = {
  carregando: { estado: "carregando" },
  com_dado: { estado: "com_dado", carga: ENVELOPE },
  vazio_no_recorte: {
    estado: "vazio_no_recorte",
    motivo: "sem_dado_no_recorte",
    ampliarPara: "12 meses, consolidado",
  },
  erro_de_fonte: { estado: "erro_de_fonte", ultimoFrescor: EM_DIA },
  sem_permissao: { estado: "sem_permissao" },
  defasado: { estado: "defasado", carga: ENVELOPE, frescor: DEFASADO },
};

const ESTADOS_DE_CARTAO: Readonly<Record<string, EstadoDe<Kpi>>> = {
  carregando: { estado: "carregando" },
  com_dado: { estado: "com_dado", carga: CARTAO },
  vazio_no_recorte: {
    estado: "vazio_no_recorte",
    motivo: "sem_dado_no_recorte",
    ampliarPara: "12 meses, consolidado",
  },
  erro_de_fonte: { estado: "erro_de_fonte", ultimoFrescor: EM_DIA },
  sem_permissao: { estado: "sem_permissao" },
  defasado: { estado: "defasado", carga: CARTAO, frescor: DEFASADO },
};

function painelEm(
  estado: EstadoDe<PanelResponse>,
  forma: Forma = "barras",
): string {
  return renderToStaticMarkup(
    createElement(PainelEmEstado, {
      identidade: { id: "p", titulo: "Headcount por área", unidade: "FTE" },
      forma,
      estado,
      desenhar: (carga: PanelResponse) =>
        createElement("span", { "data-teste": "desenho" }, String(carga.total)),
    }),
  );
}

function cartaoEm(estado: EstadoDe<Kpi>): string {
  return renderToStaticMarkup(
    createElement(CartaoEmEstado, {
      identidade: { id: "k", rotulo: "Headcount total" },
      estado,
    }),
  );
}

/** Todo dígito marcado, para a busca de vazamento. */
const MARCADOS = [
  TOTAL_MARCADO,
  ...SERIE_MARCADA,
  VALOR_MARCADO,
  DELTA_MARCADO,
].map(String);

/* ------------------------------------------------------------------ *
 * Os seis existem
 * ------------------------------------------------------------------ */

describe("os seis estados da tabela 6.4", () => {
  it("são seis, e são os da tabela", () => {
    expect([...ESTADOS]).toEqual([
      "carregando",
      "com_dado",
      "vazio_no_recorte",
      "erro_de_fonte",
      "sem_permissao",
      "defasado",
    ]);
  });

  it.each([...ESTADOS])("o painel desenha em '%s'", (nome) => {
    const estado = ESTADOS_DE_PAINEL[nome];
    expect(estado, `falta caso forjado para ${nome}`).toBeDefined();
    if (estado === undefined) return;

    const html = painelEm(estado);
    // Os seis mostram a identidade: título em toda caixa, inclusive na negada.
    expect(html).toContain("Headcount por área");
    expect(html.length).toBeGreaterThan(0);
  });

  it.each([...ESTADOS])("o cartão desenha em '%s'", (nome) => {
    const estado = ESTADOS_DE_CARTAO[nome];
    expect(estado, `falta caso forjado para ${nome}`).toBeDefined();
    if (estado === undefined) return;

    expect(cartaoEm(estado)).toContain("Headcount total");
  });
});

/* ------------------------------------------------------------------ *
 * Sem permissão: nada de agregado
 * ------------------------------------------------------------------ */

describe("sem permissão não revela agregado", () => {
  it("nenhum número marcado aparece no HTML do painel", () => {
    /*
     * A seção 6.4 diz "**sem** revelar o valor agregado", e a seção 11 explica
     * por quê: dois totais de recortes vizinhos permitem subtrair. Um total é
     * resposta parcial à pergunta que o perfil não pode fazer.
     */
    const html = painelEm({ estado: "sem_permissao" });
    for (const marcado of MARCADOS) {
      expect(html, `vazou ${marcado}`).not.toContain(marcado);
    }
    expect(html).toContain("Você não tem acesso a este recorte");
  });

  it("nenhum número marcado aparece no HTML do cartão", () => {
    const html = cartaoEm({ estado: "sem_permissao" });
    for (const marcado of MARCADOS) {
      expect(html, `vazou ${marcado}`).not.toContain(marcado);
    }
  });

  it("a variante não tem campo de carga — a garantia é do tipo", () => {
    /*
     * A guarda de verdade não é o teste acima: é a forma do tipo. `EstadoDe<T>`
     * não dá à variante `sem_permissao` um campo onde a carga caiba, então não
     * existe `carga?.total ?? "—"` para alguém escrever por engano.
     *
     * Este caso confere que a construção pela camada de dados também não põe
     * nada lá — um `{...t, estado}` descuidado carregaria o valor junto.
     */
    const e = estadoDe(vazio("fora_do_perfil"), EM_DIA);
    expect(e.estado).toBe("sem_permissao");
    expect(Object.keys(e)).toEqual(["estado"]);
  });
});

/* ------------------------------------------------------------------ *
 * Vazio: motivo e atalho
 * ------------------------------------------------------------------ */

describe("o vazio exibe o motivo e o atalho para ampliar", () => {
  it("mostra os dois no painel", () => {
    const html = painelEm({
      estado: "vazio_no_recorte",
      motivo: "sem_dado_no_recorte",
      ampliarPara: "12 meses, consolidado",
    });
    expect(html).toContain("Sem dado neste recorte");
    expect(html).toContain("A consulta é válida e não retornou nenhuma linha.");
    expect(html).toContain("Ampliar para 12 meses, consolidado");
  });

  it("mas não oferece o atalho onde ampliar não resolve", () => {
    /*
     * Divisor zero não some porque o recorte cresceu, e perfil não muda porque
     * a pessoa olhou mais amplo. Oferecer o atalho nesses casos manda repetir o
     * que não vai dar certo — que é o pior tipo de mensagem de erro (T-182).
     */
    const html = painelEm({
      estado: "vazio_no_recorte",
      motivo: "denominador_zero",
      ampliarPara: "12 meses, consolidado",
    });
    expect(html).toContain("Sem base para calcular");
    expect(html).not.toContain("Ampliar para");
  });
});

/* ------------------------------------------------------------------ *
 * Erro de fonte: o horário
 * ------------------------------------------------------------------ */

describe("o erro de fonte traz a última leitura bem-sucedida", () => {
  it("mostra o horário quando ele existe", () => {
    const html = painelEm({ estado: "erro_de_fonte", ultimoFrescor: EM_DIA });
    expect(html).toContain("Não foi possível ler a fonte");
    expect(html).toContain("26/08/2026 às 06:15");
  });

  it("e diz que não há, quando não há — em vez de omitir a linha", () => {
    /*
     * Uma ausência silenciosa se lê como "acabou de acontecer", que é a leitura
     * mais otimista e nem sempre a verdadeira.
     */
    const html = painelEm({ estado: "erro_de_fonte", ultimoFrescor: null });
    expect(html).toContain("Sem leitura bem-sucedida registrada");
  });
});

/* ------------------------------------------------------------------ *
 * Defasado: o painel aparece, com selo
 * ------------------------------------------------------------------ */

describe("defasado mostra o painel, e não o esconde", () => {
  it("desenha o gráfico e o selo ao mesmo tempo", () => {
    /*
     * Defasado não é ausência: o número existe, só é mais velho que o acordado.
     * Esconder mandaria quem lê buscá-lo numa planilha — que é o que este
     * produto existe para aposentar.
     */
    const html = painelEm({
      estado: "defasado",
      carga: ENVELOPE,
      frescor: DEFASADO,
    });
    expect(html).toContain('data-teste="desenho"');
    expect(html).toContain(String(TOTAL_MARCADO));
    expect(html).toContain('data-defasado="1"');
    expect(html).toContain("Dado defasado");
  });

  it("o selo diz 'defasado' em texto, e não só em cor", () => {
    // Seção 13: todo indicador crítico traz rótulo ou seta. Quem não distingue
    // os tons lê a palavra.
    expect(
      painelEm(ESTADOS_DE_PAINEL["defasado"] as EstadoDe<PanelResponse>),
    ).toContain("Dado defasado");
  });

  it("com dado em dia, o mesmo painel não traz o selo em destaque", () => {
    const html = painelEm({ estado: "com_dado", carga: ENVELOPE });
    expect(html).not.toContain('data-defasado="1"');
  });
});

/* ------------------------------------------------------------------ *
 * Carregando: nenhum número
 * ------------------------------------------------------------------ */

describe("o esqueleto não pisca valor", () => {
  it("não há dígito de dado no HTML de carregando", () => {
    const html = painelEm({ estado: "carregando" });
    for (const marcado of MARCADOS) {
      expect(html, `piscou ${marcado}`).not.toContain(marcado);
    }
    expect(html).toContain('aria-busy="true"');
  });

  it("nem no cartão", () => {
    const html = cartaoEm({ estado: "carregando" });
    for (const marcado of MARCADOS) {
      expect(html, `piscou ${marcado}`).not.toContain(marcado);
    }
  });
});

/* ------------------------------------------------------------------ *
 * A altura: esqueleto e desenho final leem a mesma linha
 * ------------------------------------------------------------------ */

describe("o esqueleto tem a altura do gráfico final", () => {
  /** A folga que o aceite dá. A diferença medida é zero — ver o comentário. */
  const FOLGA = 4;

  it("as doze formas têm altura declarada", () => {
    expect(Object.keys(ALTURA_DA_FORMA).sort()).toEqual([...FORMAS].sort());
  });

  it.each([...FORMAS])("%s: o esqueleto pede a altura da tabela", (forma) => {
    const html = renderToStaticMarkup(
      createElement(Esqueleto, { forma, rotulo: forma }),
    );
    const declarada = alturaDaForma(forma);

    /*
     * A altura sai do `style` servido, e não de uma constante repetida aqui.
     * Comparar com um número escrito no teste provaria que o teste concorda com
     * o teste.
     */
    const achado = /height:\s*(\d+)px/.exec(html);
    expect(achado?.[1], `${forma} não declarou altura`).toBeDefined();
    expect(Math.abs(Number(achado?.[1]) - declarada)).toBeLessThanOrEqual(
      FOLGA,
    );
  });

  it("nenhuma forma cai num padrão silencioso", () => {
    // Toda forma tem altura própria e positiva: um zero esquecido daria um
    // esqueleto invisível, que é pior que nenhum esqueleto.
    for (const forma of FORMAS) {
      expect(alturaDaForma(forma), forma).toBeGreaterThan(0);
    }
  });
});

/* ------------------------------------------------------------------ *
 * A tradução de Talvez para estado
 * ------------------------------------------------------------------ */

describe("a camada de dados vira estado num lugar só", () => {
  it("todo motivo de vazio tem destino, e nenhum cai em outro", () => {
    /*
     * A tabela é total sobre o enum: um motivo novo sem destino para de
     * compilar. Este caso confere o outro lado — que a tradução realmente
     * percorre todos, e não que ela compila.
     */
    for (const motivo of MOTIVOS_DE_VAZIO) {
      const e = estadoDe(vazio(motivo), EM_DIA);
      expect(
        ["vazio_no_recorte", "erro_de_fonte", "sem_permissao"],
        motivo,
      ).toContain(e.estado);
    }
  });

  it("fora_do_perfil vira sem permissão, e fonte_indisponivel vira erro", () => {
    expect(estadoDe(vazio("fora_do_perfil"), EM_DIA).estado).toBe(
      "sem_permissao",
    );
    expect(estadoDe(vazio("fonte_indisponivel"), EM_DIA).estado).toBe(
      "erro_de_fonte",
    );
  });

  it("valor com frescor defasado vira 'defasado', e não 'com dado'", () => {
    const e = estadoDe(comValor(ENVELOPE), DEFASADO);
    expect(e.estado).toBe("defasado");
    expect(temCarga(e)).toBe(true);
  });

  it("valor com frescor em dia vira 'com dado'", () => {
    expect(estadoDe(comValor(ENVELOPE), EM_DIA).estado).toBe("com_dado");
  });

  it("o atalho de ampliar atravessa a tradução", () => {
    // Perder `ampliarPara` no caminho faria o vazio chegar à tela sem o atalho
    // que a 6.4 exige, e nada reprovaria — o estado continuaria certo.
    const e = estadoDe(vazio("sem_dado_no_recorte", "12 meses"), EM_DIA);
    expect(e.estado === "vazio_no_recorte" ? e.ampliarPara : null).toBe(
      "12 meses",
    );
  });
});

/* ------------------------------------------------------------------ *
 * Uma forma de cada família
 * ------------------------------------------------------------------ */

describe("os seis estados valem em uma forma de cada família", () => {
  /**
   * O aceite pede "ao menos uma forma de cada família", e as famílias são as
   * três de `origem-de-painel`: série temporal, categóricas e compostas.
   *
   * A representante de cada uma é a **primeira** da lista, e não uma escolhida
   * a dedo aqui: escolher a dedo deixaria a lista crescer sem o teste crescer
   * junto, e o dia em que uma família ganhasse uma forma nova ninguém saberia
   * que ela nunca foi exercitada em estado nenhum.
   *
   * As três não desenham igual — colunas, faixas e degraus — e ocupam alturas
   * diferentes, que é exatamente o que faz valer testar as três em vez de
   * confiar que barras responde por todas.
   */
  const FAMILIAS: readonly { readonly nome: string; readonly forma: Forma }[] =
    [
      { nome: "série temporal", forma: FORMAS_DE_SERIE_TEMPORAL[0] },
      { nome: "categóricas", forma: FORMAS_CATEGORICAS[0] },
      { nome: "compostas", forma: FORMAS_COMPOSTAS[0] },
    ];

  it("as três famílias cobrem as doze formas, sem sobra nem falta", () => {
    // Se uma forma nova entrar sem família, ela nunca chega aqui — e este caso
    // é o que avisa.
    const cobertas = [
      ...FORMAS_DE_SERIE_TEMPORAL,
      ...FORMAS_CATEGORICAS,
      ...FORMAS_COMPOSTAS,
    ];
    expect([...cobertas].sort()).toEqual([...FORMAS].sort());
  });

  for (const familia of FAMILIAS) {
    it.each([...ESTADOS])(
      `${familia.nome} (${familia.forma}) desenha em '%s'`,
      (nome) => {
        const estado = ESTADOS_DE_PAINEL[nome];
        expect(estado, `falta caso forjado para ${nome}`).toBeDefined();
        if (estado === undefined) return;

        const html = painelEm(estado, familia.forma);
        expect(html).toContain("Headcount por área");

        // A caixa tem a altura da família, nos seis estados. Um estado que
        // caísse na altura de outra forma faria a tela pular ao trocar.
        const declarada = String(alturaDaForma(familia.forma));
        expect(html, `${familia.forma} em ${nome}`).toContain(
          `height:${declarada}px`,
        );
      },
    );
  }

  it("sem permissão não vaza agregado em nenhuma das três", () => {
    for (const familia of FAMILIAS) {
      const html = painelEm({ estado: "sem_permissao" }, familia.forma);
      for (const marcado of MARCADOS) {
        expect(html, `${familia.forma} vazou ${marcado}`).not.toContain(
          marcado,
        );
      }
    }
  });
});
