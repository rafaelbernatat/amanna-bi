/**
 * O caminho de leitura da tela até o dado (T-131).
 *
 * Junta o que já existia em quatro peças separadas e nunca tinha sido ligado:
 *
 * ```
 * tela  →  getSession   (T-136)  quem está perguntando
 *       →  escopoDaSessao (T-135)  o que essa pessoa pode ver
 *       →  obterFonteDeDados (T-106)  qual adaptador
 *       →  criarFronteira (T-137/T-138)  grão e escopo, antes do adaptador
 *       →  lerKpis
 * ```
 *
 * ## Por que a tela não chama o adaptador
 *
 * Um teste de arquitetura reprova quem importar `obterFonteDeDados` fora de
 * `src/acesso/`, e a razão é a seção 11: o recorte por perfil é aplicado **no
 * servidor**, antes do adaptador, e não depois. Uma consulta recusada aqui não
 * vira consulta ao banco nem linha de log — é a diferença entre negar acesso e
 * ler o dado e jogar fora.
 *
 * Este módulo é o único ponto onde a cadeia se monta, e o que a apresentação vê
 * é uma função que recebe tela e recorte e devolve KPIs.
 */

import { obterFonteDeDados } from "@/acesso/fabrica";
import { dimensoesProvisorias } from "@/acesso/dimensoes-provisorias";
import { criarFronteira } from "@/acesso/fronteira";
import "@/acesso/registrar";
import { getSession } from "@/acesso/sessao";
import type { Kpi, Query } from "@/semantica/contrato";
import { escopoDaSessao } from "@/seguranca/identidade";

/**
 * Os KPIs de uma tela, já restringidos ao perfil de quem pediu.
 *
 * As dimensões vêm da ponte de `dimensoes-provisorias` até `getMeta` existir
 * (T-149). Quando existir, é uma linha que muda aqui.
 */
export async function lerKpisDaTela(
  tela: string,
  consulta: Query,
): Promise<readonly Kpi[]> {
  const [sessao, fonte] = await Promise.all([
    getSession(),
    obterFonteDeDados(),
  ]);
  const fronteira = criarFronteira(
    fonte,
    escopoDaSessao(sessao),
    dimensoesProvisorias(),
  );
  return fronteira.lerKpis(tela, consulta);
}
