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
import type { PanelResponse } from "@/semantica/contrato";
import { REGISTRO_DE_KPIS } from "@/semantica/kpis";
import { ORIGEM_DOS_PAINEIS } from "@/semantica/origem-de-painel";

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
export async function conferirQuebraPorArea(
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
   *
   * O padrão passou a ser `ctx.fonte` em T-140.1. Era `calcularPainel`, e o
   * padrão é que decide na prática: `rodarSuite` recebia uma fonte, o percurso
   * a usava, e a regra lia as fixtures de qualquer jeito. Quem descobriu foi o
   * controle negativo de T-140, que não conseguia reprovar um adaptador
   * deliberadamente errado — porque a regra nunca falava com ele.
   */
  ler: (id: string, q: Contexto["consulta"]) => Promise<PanelResponse> = (
    id,
    q,
  ) => ctx.fonte.getPanel(id, q),
): Promise<readonly Falha[]> {
  if (ctx.consulta.area === AGREGADO_DE_AREA) return [];

  const falhas: Falha[] = [];
  for (const painel of paineisQuebradosPorArea()) {
    const envelope = await ler(painel, ctx.consulta);
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

/**
 * Os painéis cujo eixo é a área. Contados do registro, nunca escritos.
 *
 * ## A primeira versão contava do lugar errado
 *
 * Ela partia de `PARES` — os painéis que têm cartão reconciliado — e filtrava
 * por eixo. Isso conferia 5 dos 9, e os 4 de fora eram exatamente os que não
 * têm KPI: `rec-vagas`, `rh-areas`, `tov-area`, `tre-area`.
 *
 * O achado 4 do Anexo D não fala de KPI. Fala de filtro que muda a escala das
 * barras e mantém as sete. Um painel sem cartão está igualmente exposto — e um
 * deles é turnover por área, que é onde a pergunta "qual área está perdendo
 * gente" é feita.
 *
 * Partir do registro faz a lista crescer sozinha quando um painel novo declara
 * `eixo: "area"`, que é o oposto de uma lista que só cresce quando alguém
 * lembra.
 */
export function paineisQuebradosPorArea(): readonly string[] {
  return ORIGEM_DOS_PAINEIS.filter((o) => o.eixo === "area").map(
    (o) => o.painel,
  );
}

/* ------------------------------------------------------------------ *
 * A regra
 * ------------------------------------------------------------------ */

export const REGRA_1: Regra = {
  numero: NUMERO,
  nome: "reconciliação entre KPI e painel",
  /**
   * Os painéis que esta regra confere, contados das duas metades.
   *
   * A primeira metade confere os painéis que detalham um cartão; a segunda,
   * todos os quebrados por área. A união é o que a regra 1 realmente olha — e
   * é menor que 71, porque painel sem cartão e sem eixo de área não tem o que
   * reconciliar. Os que faltam são cobertos pelas regras 2 a 5 (T-159), que
   * valem para todo painel.
   */
  cobre: () => [
    ...new Set([...PARES.map((p) => p.painel), ...paineisQuebradosPorArea()]),
  ],
  rodar: async (ctx) => {
    const falhas: Falha[] = [];

    /*
     * Os KPIs de cada tela são lidos uma vez por recorte, e não uma vez por
     * par. São 70 KPIs em 13 telas: ler por par faria 60 leituras onde 13
     * bastam, e a suíte roda isso 768 vezes.
     */
    const porTela = new Map(
      await Promise.all(
        TELAS.map(
          async (tela) =>
            [tela, await ctx.fonte.getKpis(tela, ctx.consulta)] as const,
        ),
      ),
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

      const envelope = await ctx.fonte.getPanel(par.painel, ctx.consulta);
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

    falhas.push(...(await conferirQuebraPorArea(ctx)));
    return falhas;
  },
};

/** Quantos pares a regra compara. Contado, nunca escrito. */
export function paresConferidos(): number {
  return PARES.length;
}
