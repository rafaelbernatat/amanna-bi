/**
 * `getRanking`: uma métrica do catálogo aberta por uma dimensão (D-CHAT-ferramentas).
 *
 * É a quinta porta, e a que o chat usa para "os cinco maiores clientes",
 * "qual área mais gasta", "que conta pesa mais". O número continua nascendo
 * aqui, no nosso código: o modelo pede a dimensão e a métrica por id, e recebe
 * itens já somados. Nenhuma linha desce a pessoa — as oito dimensões são
 * agregados ou pessoa jurídica.
 *
 * ## Como cada dimensão abre
 *
 * `area` reaproveita o próprio cálculo da métrica, um recorte de área por vez
 * — vale para toda métrica cuja view tenha área, e para nenhuma outra
 * (receita não tem área de origem, e responder o consolidado sete vezes seria
 * mentir sete vezes). As demais dimensões leem a view que as carrega, com a
 * medida que casa com a métrica pedida. Métrica que não abre por uma dimensão
 * devolve `abre: false` e nenhum item: é resposta, não erro.
 *
 * ## O total é o da métrica
 *
 * `total` é o mesmo número que `getMetric` devolve para o mesmo recorte, e
 * não a soma dos itens. Onde a dimensão parte a métrica em fatias (área,
 * centro de custo, linha da DRE), as fatias somam o total por construção; onde
 * não parte (os dez maiores clientes), a soma dos itens é uma parte dele — e é
 * essa diferença que o chat chama de concentração.
 */

import type { Base } from "@/acesso/calculo/base";
import { AGREGADO_DE_AREA, AREAS_ARMAZENADAS } from "@/acesso/calculo/eixos";
import {
  calculoDaMetrica,
  emMilhoes,
  linhas,
  type Recorte,
  recorteDe,
} from "@/acesso/calculo/kpis";
import {
  MetricaDesconhecida,
  metricasProximas,
} from "@/acesso/calculo/metricas";
import { somar } from "@/acesso/calculo/recorte";
import { CATALOGO_GERADO } from "@/semantica/catalogo-gerado";
import type {
  DimensaoDeRanking,
  ItemDeRanking,
  PedidoDeRanking,
  Query,
  Ranking,
} from "@/semantica/contrato";
import { rotuloDe } from "@/semantica/dimensoes";

/** Um item antes do rótulo: o código e o valor somado. */
type Parcela = { readonly codigo: string; readonly valor: number | null };

/** O maior limite que um ranking devolve. Acima disso é lista, não ranking. */
export const LIMITE_MAXIMO_DE_RANKING = 50;

/* ------------------------------------------------------------------ *
 * As aberturas
 * ------------------------------------------------------------------ */

/** Soma uma medida por chave, sobre as linhas do recorte. Nulo propaga. */
function somarPor<T extends { readonly mes: string }>(
  doRecorte: readonly T[],
  chave: (l: T) => string,
  medida: (l: T) => number | null,
): readonly Parcela[] {
  const chaves = [...new Set(doRecorte.map(chave))];
  return chaves.map((codigo) => ({
    codigo,
    valor: emMilhoes(
      somar(
        doRecorte.filter((l) => chave(l) === codigo),
        medida,
      ),
    ),
  }));
}

/** O recorte só do último mês da janela: para medidas de estoque. */
function noUltimoMes(r: Recorte): Recorte {
  const ultimo = r.meses.at(-1);
  return { ...r, meses: ultimo === undefined ? [] : [ultimo] };
}

/** A métrica lida por área, um recorte de área por vez. */
function porArea(r: Recorte, metrica: string): readonly Parcela[] | null {
  const entrada = CATALOGO_GERADO[metrica];
  const calculo = calculoDaMetrica(metrica);
  if (entrada === undefined || calculo === undefined) return null;

  // A view de origem tem área? Sem isso, cada área devolveria o consolidado.
  const views = r.base.views as Record<string, readonly { area?: string }[]>;
  const origem = views[entrada.fonte];
  const primeira = origem?.[0];
  if (primeira === undefined || primeira.area === undefined) return null;

  const areas = r.q.area === AGREGADO_DE_AREA ? AREAS_ARMAZENADAS : [r.q.area];
  return areas.map((area) => ({
    codigo: area,
    valor: calculo({ ...r, q: { ...r.q, area: area as Query["area"] } }),
  }));
}

/** As aberturas por dimensão: qual view, qual chave, qual medida por métrica. */
const ABERTURAS: Readonly<
  Record<
    Exclude<DimensaoDeRanking, "area">,
    Readonly<Record<string, (r: Recorte) => readonly Parcela[]>>
  >
> = {
  cliente: {
    receita_liquida: (r) =>
      somarPor(
        linhas("vw_fato_faturamento_cliente", r),
        (l) => l.cliente,
        (l) => l.receita,
      ),
    receita_dos_principais_clientes: (r) =>
      somarPor(
        linhas("vw_fato_faturamento_cliente", r).filter((l) => l.principal),
        (l) => l.cliente,
        (l) => l.receita,
      ),
    contas_a_receber: (r) =>
      somarPor(
        linhas("vw_fato_contas", noUltimoMes(r)).filter((l) => l.aReceber > 0),
        (l) => l.contraparte,
        (l) => l.aReceber,
      ),
    a_receber_vencido: (r) =>
      somarPor(
        linhas("vw_fato_contas", noUltimoMes(r)).filter(
          (l) => l.aReceber > 0 && l.faixaDeAging !== "a-vencer",
        ),
        (l) => l.contraparte,
        (l) => l.aReceber,
      ),
  },
  fornecedor: {
    contas_a_pagar: (r) =>
      somarPor(
        linhas("vw_fato_contas", noUltimoMes(r)).filter((l) => l.aPagar > 0),
        (l) => l.contraparte,
        (l) => l.aPagar,
      ),
    a_pagar_vencido: (r) =>
      somarPor(
        linhas("vw_fato_contas", noUltimoMes(r)).filter(
          (l) => l.aPagar > 0 && l.faixaDeAging !== "a-vencer",
        ),
        (l) => l.contraparte,
        (l) => l.aPagar,
      ),
  },
  centro_custo: {
    orcado: (r) =>
      somarPor(
        linhas("vw_fato_orcamento", r),
        (l) => l.centroDeCusto,
        (l) => l.orcado,
      ),
    realizado: (r) =>
      somarPor(
        linhas("vw_fato_orcamento", r),
        (l) => l.centroDeCusto,
        (l) => l.realizado,
      ),
    desvio_orcamentario: (r) =>
      somarPor(
        linhas("vw_fato_orcamento", r),
        (l) => l.centroDeCusto,
        (l) => l.realizado - l.orcado,
      ),
  },
  segmento: {
    receita_liquida: (r) =>
      somarPor(
        linhas("vw_fato_faturamento_cliente", r),
        (l) => l.segmento,
        (l) => l.receita,
      ),
  },
  uf: {
    headcount_fte: (r) =>
      linhas("vw_fato_rh_perfil", noUltimoMes(r))
        .filter((l) => l.dimensao === "uf")
        .reduce<Parcela[]>((acc, l) => {
          const existente = acc.find((p) => p.codigo === l.valor);
          if (existente === undefined) {
            acc.push({ codigo: l.valor, valor: l.headcountFte });
          } else {
            acc[acc.indexOf(existente)] = {
              codigo: l.valor,
              valor: (existente.valor ?? 0) + l.headcountFte,
            };
          }
          return acc;
        }, []),
  },
  conta: {
    // O sinal é o do efeito sobre o resultado: receita positiva, custo negativo.
    lucro_liquido: (r) =>
      somarPor(
        linhas("vw_fato_dre_conta_mes", r),
        (l) => l.conta,
        (l) => l.valor,
      ),
    receita_bruta: (r) =>
      somarPor(
        linhas("vw_fato_dre_conta_mes", r).filter(
          (l) => l.linhaDre === "Receita bruta",
        ),
        (l) => l.conta,
        (l) => l.valor,
      ),
  },
  linha_dre: {
    lucro_liquido: (r) =>
      somarPor(
        linhas("vw_fato_dre_conta_mes", r),
        (l) => l.linhaDre,
        (l) => l.valor,
      ),
  },
};

/* ------------------------------------------------------------------ *
 * Rótulos
 * ------------------------------------------------------------------ */

function rotuloDoItem(
  base: Base,
  dimensao: DimensaoDeRanking,
  codigo: string,
): string {
  const doCadastro = (lista: readonly { codigo: string; rotulo: string }[]) =>
    lista.find((c) => c.codigo === codigo)?.rotulo ?? codigo;
  switch (dimensao) {
    case "area":
      return rotuloDe("area", codigo);
    case "centro_custo":
      return doCadastro(base.cadastros.centrosDeCusto);
    case "cliente":
      return doCadastro(base.cadastros.clientes);
    case "fornecedor":
      return doCadastro(base.cadastros.fornecedores);
    case "conta":
      return doCadastro(base.cadastros.contas);
    case "linha_dre":
    case "uf":
    case "segmento":
      return codigo;
  }
}

/* ------------------------------------------------------------------ *
 * O ranking
 * ------------------------------------------------------------------ */

/** O ranking de uma métrica por uma dimensão, no recorte, sobre uma base. */
export function calcularRanking(
  base: Base,
  pedido: PedidoDeRanking,
  q: Query,
): Ranking {
  const entrada = CATALOGO_GERADO[pedido.metrica];
  if (entrada === undefined) {
    throw new MetricaDesconhecida(
      pedido.metrica,
      metricasProximas(pedido.metrica),
    );
  }
  const calculo = calculoDaMetrica(pedido.metrica);
  if (calculo === undefined) {
    throw new Error(
      `A métrica '${pedido.metrica}' está no catálogo e não sabe se calcular.`,
    );
  }

  const r = recorteDe(base, q);
  const total = calculo(r);
  const asOf = fechamentoDoRecorte(r);

  const parcelas =
    pedido.dimensao === "area"
      ? porArea(r, pedido.metrica)
      : (ABERTURAS[pedido.dimensao][pedido.metrica]?.(r) ?? null);

  const comum = {
    metrica: pedido.metrica,
    dimensao: pedido.dimensao,
    unit: entrada.unidade,
    formula: entrada.formula,
    total,
    asOf,
  };

  if (parcelas === null) {
    return { ...comum, itens: [], abre: false, truncado: false };
  }

  const sinal = pedido.ordem === "menor" ? 1 : -1;
  const ordenadas = [...parcelas].sort((a, b) => {
    if (a.valor === null) return 1;
    if (b.valor === null) return -1;
    return sinal * (a.valor - b.valor) || a.codigo.localeCompare(b.codigo);
  });
  const limite = Math.min(
    Math.max(1, Math.trunc(pedido.limite)),
    LIMITE_MAXIMO_DE_RANKING,
  );
  const itens: ItemDeRanking[] = ordenadas.slice(0, limite).map((p) => ({
    codigo: p.codigo,
    rotulo: rotuloDoItem(base, pedido.dimensao, p.codigo),
    valor: p.valor,
  }));

  return {
    ...comum,
    itens,
    abre: true,
    truncado: ordenadas.length > itens.length,
  };
}

/** A data de fechamento que originou o ranking (seção 10.2). */
function fechamentoDoRecorte(r: Recorte): string {
  const ultimo = r.meses.at(-1);
  if (ultimo === undefined) return "";
  const [ano, mes] = ultimo.split("-");
  const dia = new Date(Date.UTC(Number(ano), Number(mes), 0)).getUTCDate();
  return `${ultimo}-${String(dia)}`;
}

/** As métricas que abrem por cada dimensão, para o chat oferecer. */
export function metricasQueAbremPor(
  dimensao: DimensaoDeRanking,
): readonly string[] {
  if (dimensao === "area") return Object.keys(CATALOGO_GERADO);
  return Object.keys(ABERTURAS[dimensao]);
}
