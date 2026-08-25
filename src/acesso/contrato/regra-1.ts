/**
 * A regra 1 da seção 9.2: reconciliação entre KPI e painel (T-122).
 *
 * > "Para a mesma `Query`, o KPI e o painel que o detalha somam o mesmo total.
 * > Um painel que quebra por área, sob recorte de uma área, mostra só aquela
 * > área — nunca a lista inteira com o total de outro recorte."
 *
 * São **duas** afirmações, e a segunda é a que pega o achado 4 do Anexo D. A
 * primeira compara números; a segunda compara a forma do desenho com o recorte
 * pedido — um painel que ignora o filtro mostra o total certo e o gráfico
 * errado, e nenhuma comparação de número o pegaria.
 *
 * ## Onde ela roda
 *
 * Nos 768 recortes, sem amostragem. É o que H-05 exige por escrito, e a razão é
 * que divergência de reconciliação quase nunca aparece no consolidado: ela
 * aparece na terceira área do quarto trimestre, onde um denominador fica
 * pequeno e um arredondamento vira meio ponto.
 */

import { calcularKpis } from "@/acesso/fixtures/kpis";
import { calcularPainel } from "@/acesso/fixtures/paineis";
import {
  reconciliacaoDe,
  valorDoPainel,
} from "@/acesso/contrato/reconciliacao";
import {
  conferirIgual,
  type Contexto,
  type Falha,
  type Regra,
} from "@/acesso/contrato/suite";
import { AGREGADO_DE_AREA } from "@/acesso/fixtures/eixos";
import { REGISTRO_DE_KPIS } from "@/semantica/kpis";
import { origemDoPainel } from "@/semantica/origem-de-painel";

const NUMERO = 1;

/** As telas que têm KPI, cada uma lida uma vez por recorte. */
const TELAS: readonly string[] = [
  ...new Set(REGISTRO_DE_KPIS.map((k) => k.tela)),
];

/**
 * Os pares que a regra compara de verdade.
 *
 * Os declarados `nao_reconcilia` ficam de fora — não por serem ignorados, mas
 * porque o motivo deles está escrito em `reconciliacao.ts` e um teste confere
 * que nenhum par mapeado ficou sem declaração. A diferença entre "não comparo
 * porque decidi" e "não comparo porque esqueci" é a única que importa aqui.
 */
function paresComparaveis(): readonly { kpi: string; painel: string }[] {
  return REGISTRO_DE_KPIS.flatMap((k) => {
    if (k.detalhadoPor === null) return [];
    const par = reconciliacaoDe(k.id);
    if (par === undefined || par.forma.tipo === "nao_reconcilia") return [];
    return [{ kpi: k.id, painel: k.detalhadoPor }];
  });
}

const PARES = paresComparaveis();

/* ------------------------------------------------------------------ *
 * A segunda metade da regra: a forma respeita o recorte
 * ------------------------------------------------------------------ */

/**
 * Sob recorte de uma área, o painel quebrado por área mostra uma categoria.
 *
 * É o achado 4 do Anexo D: no protótipo, filtrar por área mudava a escala das
 * barras e mantinha as sete. O resultado é um gráfico que parece responder ao
 * filtro e não responde — e é pior que não filtrar, porque parece certo.
 *
 * Sete barras com seis zeradas seria o mesmo defeito com outra aparência: o
 * zero afirma "esta área não tem quadro", quando o que se sabe é "esta área não
 * está no recorte".
 */
export function conferirQuebraPorArea(
  ctx: Contexto,
  /*
   * O leitor de painel entra por parâmetro para que esta metade da regra tenha
   * teste próprio.
   *
   * A primeira versão chamava `calcularPainel` direto, e uma provocação que
   * apagava esta chamada da regra **não derrubava teste nenhum**: os casos
   * conferiam a propriedade nos painéis, e não que a regra a cobrava. Com o
   * leitor injetável dá para forjar um painel que ignora o filtro e exigir que
   * a regra o acuse.
   */
  ler: (
    id: string,
    q: Contexto["consulta"],
  ) => ReturnType<typeof calcularPainel> = calcularPainel,
): readonly Falha[] {
  if (ctx.consulta.area === AGREGADO_DE_AREA) return [];

  const falhas: Falha[] = [];
  for (const painel of paineisQuebradosPorArea()) {
    const envelope = ler(painel, ctx.consulta);
    if (!("categories" in envelope)) continue;

    if (envelope.categories.length !== 1) {
      falhas.push({
        assunto: painel,
        recorte: ctx.recorte,
        regra: NUMERO,
        mensagem:
          `sob recorte de uma área, devolveu ${String(envelope.categories.length)} ` +
          "categorias em vez de uma",
      });
      continue;
    }

    if (envelope.categories[0] !== ctx.consulta.area) {
      falhas.push({
        assunto: painel,
        recorte: ctx.recorte,
        regra: NUMERO,
        mensagem:
          `devolveu a categoria '${String(envelope.categories[0])}' sob recorte ` +
          `da área '${ctx.consulta.area}'`,
      });
    }
  }
  return falhas;
}

/** Os painéis cujo eixo é a área. Contados do registro, nunca escritos. */
function paineisQuebradosPorArea(): readonly string[] {
  return [...new Set(PARES.map((p) => p.painel))].filter(
    (p) => origemDoPainel(p)?.eixo === "area",
  );
}

/* ------------------------------------------------------------------ *
 * A regra
 * ------------------------------------------------------------------ */

export const REGRA_1: Regra = {
  numero: NUMERO,
  nome: "reconciliação entre KPI e painel",
  rodar: (ctx) => {
    const falhas: Falha[] = [];

    /*
     * Os KPIs de cada tela são lidos uma vez por recorte, e não uma vez por
     * par. São 70 KPIs em 13 telas: ler por par faria 60 leituras onde 13
     * bastam, e a suíte roda isso 768 vezes.
     */
    const porTela = new Map(
      TELAS.map((tela) => [tela, calcularKpis(tela, ctx.consulta)]),
    );

    for (const par of PARES) {
      const declarado = reconciliacaoDe(par.kpi);
      if (declarado === undefined) continue;

      const kpi = [...porTela.values()].flat().find((k) => k.id === par.kpi);
      if (kpi === undefined) {
        falhas.push({
          assunto: par.kpi,
          recorte: ctx.recorte,
          regra: NUMERO,
          mensagem: "o KPI não foi devolvido pela tela dele",
        });
        continue;
      }

      const envelope = calcularPainel(par.painel, ctx.consulta);
      const doPainel = valorDoPainel(envelope, declarado.forma, kpi.unit);

      if (doPainel === undefined) {
        /*
         * A declaração não encontrou o que prometeu no envelope — série
         * renomeada, degrau que sumiu, unidade que deixou de somar. É defeito
         * da declaração ou do painel, e nunca "recorte sem dado".
         */
        falhas.push({
          assunto: `${par.kpi} → ${par.painel}`,
          recorte: ctx.recorte,
          regra: NUMERO,
          mensagem: `a forma '${declarado.forma.tipo}' não existe neste envelope`,
        });
        continue;
      }

      falhas.push(
        ...conferirIgual(kpi.value, doPainel, kpi.unit, {
          assunto: `${par.kpi} → ${par.painel}`,
          recorte: ctx.recorte,
          regra: NUMERO,
          mensagem: `o cartão e o painel não dizem o mesmo (${declarado.forma.tipo})`,
        }),
      );
    }

    falhas.push(...conferirQuebraPorArea(ctx));
    return Promise.resolve(falhas);
  },
};

/** Quantos pares a regra compara. Contado, nunca escrito. */
export function paresConferidos(): number {
  return PARES.length;
}
