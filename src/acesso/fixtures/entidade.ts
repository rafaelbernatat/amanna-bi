/**
 * Como cada medida se divide entre as duas entidades (T-110, T-111).
 *
 * ## Uma fração por medida, e não uma só
 *
 * O protótipo usa `0.62` para tudo — `entidade: 'Unidade SP'` multiplica
 * **todos** os valores por 0,62 — e é justamente isso que o achado 3 do Anexo D
 * aponta. A consequência está no achado 4: *"a reconciliação parece correta
 * porque KPI e painel escalam pelo mesmo fator, não porque somam o mesmo
 * dado"*.
 *
 * Com uma fração por medida, um adaptador que multiplique tudo por um número só
 * passa a errar em quase toda leitura — que é o controle negativo que T-140 vai
 * exigir da suíte de contrato.
 *
 * ## Por que uma tabela só, e não uma por módulo
 *
 * A tentação era declarar as frações de RH em `referencia-rh.ts` e as de
 * Financeiro em `referencia-fin.ts`. Seriam duas constantes com quase o mesmo
 * nome e o mesmo papel — e "quase igual" é onde alguém escolhe a errada. Aqui a
 * entidade tem um lugar só, e a lista de medidas cresce nele.
 *
 * ## A leitura de negócio
 *
 * SP concentra o quadro e concentra mais ainda a folha, porque paga mais. Do
 * lado financeiro, responde por pouco menos da receita do que do quadro — é a
 * unidade mais cara e não a mais produtiva, que é a tensão que o dataset conta.
 */

import { ENTIDADES_ARMAZENADAS } from "@/acesso/fixtures/eixos";

/** A fatia da Unidade SP em cada medida. O resto fica com `demais-unidades`. */
export const FATIA_DA_UNIDADE_SP: Readonly<Record<string, number>> = {
  // Recursos Humanos
  headcount: 0.62,
  admissoes: 0.58,
  desligamentos: 0.66,
  folha: 0.68,
  treinamento: 0.55,
  vagas: 0.6,
  // Financeiro
  receita: 0.58,
  cmv: 0.6,
  despesas: 0.55,
  caixa: 0.52,
  orcamento: 0.6,
  contas: 0.57,
  // Balanço e dívida (perguntas de CFO, 2026-09-03). SP carrega mais dívida
  // que patrimônio: é a unidade que cresceu a crédito.
  balanco: 0.56,
  divida: 0.61,
};

/** Uma medida sem fatia declarada é erro de digitação, não meio a meio. */
export class MedidaSemFatia extends Error {
  constructor(medida: string) {
    super(
      `A medida '${medida}' não tem fatia de entidade declarada em entidade.ts. ` +
        "Cair em 50/50 esconderia o erro de digitação atrás de um número plausível.",
    );
    this.name = "MedidaSemFatia";
  }
}

/**
 * A fatia de uma entidade numa medida.
 *
 * A primeira entidade do vocabulário leva a fração declarada; a segunda leva o
 * complemento. Recusar a medida desconhecida em vez de assumir meio a meio é o
 * que faz um erro de digitação aparecer na build em vez de virar um perfil
 * plano que ninguém questiona.
 */
export function fatiaDaEntidade(entidade: string, medida: string): number {
  const sp = FATIA_DA_UNIDADE_SP[medida];
  if (sp === undefined) throw new MedidaSemFatia(medida);
  return entidade === ENTIDADES_ARMAZENADAS[0] ? sp : 1 - sp;
}
