/**
 * A natureza das contas, `vw_fato_natureza_mes` (perguntas de CFO, bloco B).
 *
 * Margem de contribuição, ponto de equilíbrio, margem de segurança e grau de
 * alavancagem operacional pedem uma coisa que a DRE não guarda: quanto do
 * custo é **fixo** e quanto é **variável**. É a classificação de cada conta —
 * "se vender o dobro, gasta perto do dobro?" — que só Controladoria decide
 * (H-08). Aqui ela é fictícia, sob D-H03, e derivada da DRE: custos fixos
 * mais variáveis são exatamente CMV mais despesas operacionais, em todo mês
 * e entidade. A depreciação fica fora dos dois, como fica fora do EBITDA.
 *
 * ## A narrativa
 *
 * De R$ 1.000 mi de custo no ano, 640 variam com a venda e 360 são
 * estrutura. Margem de contribuição de 46,7%; ponto de equilíbrio contábil
 * de R$ 69 mi por mês contra receita de R$ 100 mi; a folga operacional é a
 * margem de segurança de 31%.
 */

import { ENTIDADES_ARMAZENADAS, mesesDe } from "@/acesso/fixtures/eixos";
import { VW_FATO_FIN_MES } from "@/acesso/fixtures/fin";
import { ANO_DA_FIXTURE } from "@/acesso/fixtures/rh";

const MESES = mesesDe(ANO_DA_FIXTURE);
const POR_MIL = 1000;

/**
 * A parte variável do custo, em milésimos, por entidade.
 *
 * Diferente por entidade de propósito: a Unidade SP terceiriza mais, e por
 * isso tem custo mais variável e estrutura menor. É o que faz a margem de
 * contribuição mudar sob recorte — e é o que defeita a mutação da suíte de
 * contrato, que escala tudo por um fator só.
 */
const VARIAVEL_POR_MIL: readonly number[] = [661, 611];

export type LinhaNaturezaMes = {
  readonly mes: string;
  readonly entidade: string;
  /** Custos que variam com a venda, em reais: CMV variável, comissão, frete, taxa de cartão. */
  readonly custosVariaveis: number;
  /** A estrutura, em reais: o que continua existindo sem venda. Sem a depreciação. */
  readonly custosFixos: number;
};

export const VW_FATO_NATUREZA_MES: readonly LinhaNaturezaMes[] = MESES.flatMap(
  (mes) =>
    ENTIDADES_ARMAZENADAS.flatMap((entidade, e) => {
      const dre = VW_FATO_FIN_MES.find(
        (l) => l.mes === mes && l.entidade === entidade,
      );
      if (dre === undefined) return [];
      const custoTotal = dre.cmv + dre.despesasOperacionais;
      const variaveis = Math.round(
        (custoTotal * (VARIAVEL_POR_MIL[e] ?? 0)) / POR_MIL,
      );
      return [
        {
          mes,
          entidade,
          custosVariaveis: variaveis,
          custosFixos: custoTotal - variaveis,
        },
      ];
    }),
);
