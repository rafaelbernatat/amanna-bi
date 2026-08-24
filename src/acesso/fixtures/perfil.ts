/**
 * `vw_fato_rh_perfil` — o quadro quebrado por atributo (T-143).
 *
 * Grão: mês × entidade × área × modalidade × **dimensão × valor**. É a mesma
 * chave dimensional de `vw_fato_rh_mes`, mais o par que diz por qual atributo o
 * quadro está sendo olhado.
 *
 * ## Por que uma view e não cinco
 *
 * Idade, tempo de casa, escolaridade, UF e faixa salarial respondem à mesma
 * pergunta — *"como o quadro se divide?"* — e diferem só pelo atributo. Cinco
 * tabelas idênticas menos o nome seriam cinco lugares para alguém esquecer de
 * aplicar a supressão de grupo pequeno da seção 11.
 *
 * ## A invariante que segura tudo
 *
 * Para qualquer recorte, **cada dimensão soma o mesmo quadro**. São a mesma
 * empresa vista por cinco atributos: uma quebra que não fechasse com as outras
 * seria gente contada duas vezes ou nenhuma. E as cinco fecham com
 * `vw_fato_rh_mes`, que é o que faz o KPI de headcount e o painel de perfil
 * concordarem na mesma tela.
 *
 * ## Dado de pessoa, agregado
 *
 * Cada linha é uma contagem, nunca uma pessoa. Faixa etária, faixa salarial e
 * tempo de casa são as três bandas que a seção 11 nomeia — *"nunca descem a um
 * grupo com menos de 5 pessoas"* — e a supressão é T-151. Esta view entrega o
 * número; quem decide não exibi-lo é a camada de cima.
 */

import { celulas, mesesDe } from "@/acesso/fixtures/eixos";
import {
  QUEBRAS_DO_QUADRO,
  type NomeDeQuebra,
} from "@/acesso/fixtures/referencia-perfil";
import { repartir, repartirMatriz } from "@/acesso/fixtures/reparticao";
import { ANO_DA_FIXTURE, VW_FATO_RH_MES } from "@/acesso/fixtures/rh";

const MESES = mesesDe(ANO_DA_FIXTURE);
const CELULAS = celulas();

/** O quadro de cada célula em cada mês, lido da view de fato. */
const QUADRO_POR_MES = MESES.map((mes) => {
  const doMes = VW_FATO_RH_MES.filter((l) => l.mes === mes);
  return CELULAS.map((c) =>
    doMes
      .filter(
        (l) =>
          l.entidade === c.entidade &&
          l.area === c.area &&
          l.modalidade === c.modalidade,
      )
      .reduce((t, l) => t + l.headcountFte, 0),
  );
});

export type LinhaPerfil = {
  readonly mes: string;
  readonly entidade: string;
  readonly area: string;
  readonly modalidade: string;
  /** `faixa_etaria`, `tempo_de_casa`, `escolaridade`, `uf`, `faixa_salarial`. */
  readonly dimensao: NomeDeQuebra;
  /** O código do valor dentro daquela dimensão. */
  readonly valor: string;
  readonly headcountFte: number;
};

/**
 * As linhas de perfil, com as duas margens exatas em todo mês.
 *
 * Para cada mês e cada dimensão: as colunas são os valores daquela dimensão,
 * escalados ao quadro do mês; as linhas são as células. `repartirMatriz` fecha
 * as duas — a soma por célula é o quadro da célula, e a soma por valor é o que
 * aquele valor tem no mês.
 *
 * Em dezembro isso reproduz exatamente os números do protótipo, porque escalar
 * o quadro de dezembro ao quadro de dezembro não muda nada.
 */
export const VW_FATO_RH_PERFIL: readonly LinhaPerfil[] = MESES.flatMap(
  (mes, m) => {
    const quadroDasCelulas = QUADRO_POR_MES[m] ?? [];
    const quadroDoMes = quadroDasCelulas.reduce((a, b) => a + b, 0);

    return Object.entries(QUEBRAS_DO_QUADRO).flatMap(([dimensao, partes]) => {
      const porValor = repartir(
        quadroDoMes,
        partes.map((p) => p.headcount),
      );
      const matriz = repartirMatriz(quadroDasCelulas, porValor);

      return CELULAS.flatMap((c, k) =>
        partes.map((parte, j) => ({
          mes,
          entidade: c.entidade,
          area: c.area,
          modalidade: c.modalidade,
          dimensao: dimensao as NomeDeQuebra,
          valor: parte.codigo,
          headcountFte: matriz[k]?.[j] ?? 0,
        })),
      );
    });
  },
);

/** As linhas de uma dimensão só, para quem vai desenhar um painel de perfil. */
export function perfilPor(dimensao: NomeDeQuebra): readonly LinhaPerfil[] {
  return VW_FATO_RH_PERFIL.filter((l) => l.dimensao === dimensao);
}
