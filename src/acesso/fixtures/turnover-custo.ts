/**
 * `vw_fato_turnover_custo` — o custo do turnover por componente (T-117.2).
 *
 * ## Por que existe grão de componente
 *
 * O painel `tov-custo` do Anexo A.1 mostra quatro barras, e a fórmula do
 * protótipo nomeia as quatro: *"custo do turnover = rescisões + recrutamento +
 * ramp-up + produtividade perdida"*. Guardar só o total daria um número, e o
 * número sozinho não responde à pergunta que o painel existe para responder —
 * **qual parte pesa mais**. Rescisão é inevitável; ramp-up encurta com
 * integração melhor; produtividade perdida encurta contratando mais rápido. São
 * três alavancas diferentes atrás de um total só.
 *
 * ## Dois dos quatro componentes são custo modelado
 *
 * Rescisão sai da folha e recrutamento já está em `vw_fato_vagas`: os dois são
 * lançamento. Ramp-up e produtividade perdida não existem em lançamento nenhum
 * — dependem de parâmetro ("quantos meses até produzir como quem saiu, e a que
 * fração"), e o parâmetro muda o número numa ordem de grandeza.
 *
 * Esse parâmetro é decisão da Controladoria e está registrado em **H-52**.
 * Enquanto não houver resposta, os quatro totais aqui são os do protótipo — e
 * este comentário existe para que ninguém os cite como medição.
 *
 * ## O que NÃO é valor de protótipo
 *
 * A repartição. O custo é distribuído pelas células na proporção dos
 * **desligamentos** de cada uma, porque custo de turnover segue quem saiu: a
 * área que perdeu mais gente carrega mais custo, e o painel passa a responder
 * ao recorte de área e de entidade em vez de mostrar o mesmo total sempre.
 * Fosse repartido por igual, filtrar por área não mudaria nada — que é o
 * achado 5 do Anexo D em outra forma.
 */

import { CUSTO_DO_TURNOVER } from "@/acesso/fixtures/referencia-perfil";
import { repartirMatriz } from "@/acesso/fixtures/reparticao";
import { VW_FATO_RH_MES } from "@/acesso/fixtures/rh";

/** Uma linha da view: uma célula do grão de RH, um componente de custo. */
export type LinhaTurnoverCusto = {
  readonly mes: string;
  readonly entidade: string;
  readonly area: string;
  /** `rescisao`, `rampUp`, `produtividade` ou `recrutamento`. */
  readonly componente: string;
  /** Valor em reais. */
  readonly valor: number;
};

const UM_MILHAO = 1_000_000;

/** Os componentes declarados, na ordem em que o painel os desenha. */
export const COMPONENTES_DE_CUSTO_DE_TURNOVER: readonly string[] =
  CUSTO_DO_TURNOVER.map((c) => c.codigo);

export const VW_FATO_TURNOVER_CUSTO: readonly LinhaTurnoverCusto[] = (() => {
  /*
   * As células que vão receber custo, e o peso de cada uma.
   *
   * Célula sem desligamento recebe peso zero e sai com valor zero — o que está
   * certo: não houve saída, não houve custo de saída. Não é ausência de dado,
   * é a medida valendo zero, e as duas coisas se parecem só de longe.
   */
  const celulas = VW_FATO_RH_MES.map((l) => ({
    mes: l.mes,
    entidade: l.entidade,
    area: l.area,
    peso: l.desligamentos,
  }));

  const totalDeDesligamentos = celulas.reduce((a, c) => a + c.peso, 0);
  const totalDoCusto = CUSTO_DO_TURNOVER.reduce(
    (a, c) => a + Math.round(c.milhoes * UM_MILHAO),
    0,
  );

  /*
   * `repartirMatriz` fecha as DUAS margens ao mesmo tempo: a soma de cada
   * componente é o total declarado dele, e a soma de cada célula é a parte que
   * cabe àquela célula pelos desligamentos. Repartir componente por componente
   * fecharia só uma das duas, e a outra sairia com sobra de arredondamento
   * espalhada — que é como um painel passa a somar 12,3 quando o cartão ao lado
   * diz 12,4.
   */
  const porCelula = celulas.map((c) =>
    totalDeDesligamentos === 0
      ? 0
      : Math.round((totalDoCusto * c.peso) / totalDeDesligamentos),
  );

  // O arredondamento acima pode deixar a soma das células diferente do total;
  // a última célula absorve a diferença antes de a matriz ser montada, porque
  // `repartirMatriz` exige que as duas margens somem igual.
  const somaDasCelulas = porCelula.reduce((a, b) => a + b, 0);
  const ultima = porCelula.length - 1;
  if (ultima >= 0) {
    porCelula[ultima] =
      (porCelula[ultima] ?? 0) + (totalDoCusto - somaDasCelulas);
  }

  const matriz = repartirMatriz(
    porCelula,
    CUSTO_DO_TURNOVER.map((c) => Math.round(c.milhoes * UM_MILHAO)),
  );

  /*
   * Percorre a MATRIZ, e não os índices dela.
   *
   * A primeira versão era `valor: matriz[i]?.[j] ?? 0`, e a regra de T-141
   * reprovou — com razão. O `?? 0` que o `noUncheckedIndexedAccess` obriga
   * transformaria célula ausente em "custo zero", que é uma afirmação sobre o
   * negócio, e não sobre a estrutura de dados. Iterando o próprio vetor, o
   * valor existe por construção e não sobra literal para escrever.
   */
  return matriz.flatMap((valoresDaCelula, i) => {
    const celula = celulas[i];
    if (celula === undefined) return [];
    return valoresDaCelula.map((valor, j) => ({
      mes: celula.mes,
      entidade: celula.entidade,
      area: celula.area,
      componente: CUSTO_DO_TURNOVER[j]?.codigo ?? "",
      valor,
    }));
  });
})();
