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
import { ultimoFrescorConhecido } from "@/acesso/meta";
import { dimensoesProvisorias } from "@/acesso/dimensoes-provisorias";
import { criarFronteira } from "@/acesso/fronteira";
import "@/acesso/registrar";
import { getSession } from "@/acesso/sessao";
import type {
  Kpi,
  MetricValue,
  PanelResponse,
  Query,
} from "@/semantica/contrato";
import type { EstadoDe } from "@/semantica/estado";
import { GraoProibido } from "@/seguranca/grao";
import { escopoDaSessao, ForaDoEscopo } from "@/seguranca/identidade";

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

/**
 * Um painel, já restringido ao perfil de quem pediu (T-132).
 *
 * Mesmo caminho de `lerKpisDaTela`, e pelo mesmo motivo: o recorte por perfil é
 * aplicado no servidor, antes de qualquer leitura. Uma tela que chamasse
 * `getPanel` direto pularia a fronteira da seção 11 — e o adaptador não sabe
 * quem está perguntando.
 *
 * O `breakdown` vem por parâmetro com o padrão da seção 6.3: sem quebra. Quem
 * precisa de quebra a pede explicitamente, e a fronteira valida se o perfil
 * alcança aquele nível de detalhe.
 */
export async function lerPainel(
  painel: string,
  consulta: Query,
  breakdown = "none",
): Promise<PanelResponse> {
  const [sessao, fonte] = await Promise.all([
    getSession(),
    obterFonteDeDados(),
  ]);
  const fronteira = criarFronteira(
    fonte,
    escopoDaSessao(sessao),
    dimensoesProvisorias(),
  );
  return fronteira.lerPainel({ painel, consulta, breakdown });
}

/**
 * Um painel já traduzido para um dos seis estados da seção 6.4 (T-168).
 *
 * ## Por que a tradução mora aqui, e não na tela
 *
 * `lerPainel` **lança** quando o recorte está fora do perfil: é o que a
 * fronteira de T-137 precisa fazer para que a linha seguinte nunca execute. Mas
 * a seção 6.6 diz que colar a URL de um recorte para alguém de perfil menor
 * abre a tela "sem permissão", e não uma página de erro — então alguém precisa
 * transformar a exceção em estado.
 *
 * Esse alguém não pode ser a tela. Treze telas com o próprio `try` dariam treze
 * respostas, e a primeira que esquecesse de distinguir `ForaDoEscopo` de uma
 * falha de fonte mostraria "erro ao ler" para quem só não tem acesso — ou, pior,
 * mostraria "sem permissão" quando o banco caiu, e ninguém iria olhar o banco.
 *
 * ## O que cada exceção vira
 *
 * | Exceção | Estado | Por quê |
 * |---|---|---|
 * | `ForaDoEscopo` | `sem_permissao` | O recorte não cabe no perfil (seção 11) |
 * | `GraoProibido` | `sem_permissao` | O grão pedido é mais fino que o permitido |
 * | qualquer outra | `erro_de_fonte` | Adaptador, rede, painel inexistente |
 *
 * O `ultimoFrescor` vem da memória de `getMeta` (T-149). A 6.4 pede o horário
 * da última leitura bem-sucedida, e agora existe quem o guarde — `null`
 * continua sendo resposta possível, e é a honesta para "nunca li com sucesso
 * nesta sessão".
 */
export async function lerPainelParaTela(
  painel: string,
  consulta: Query,
): Promise<EstadoDe<PanelResponse>> {
  try {
    return { estado: "com_dado", carga: await lerPainel(painel, consulta) };
  } catch (erro) {
    if (erro instanceof ForaDoEscopo || erro instanceof GraoProibido) {
      return { estado: "sem_permissao" };
    }
    return { estado: "erro_de_fonte", ultimoFrescor: ultimoFrescorConhecido() };
  }
}

/**
 * Uma métrica, já restringida ao perfil de quem pediu (T-149, chat da seção 7).
 *
 * Mesmo caminho de `lerKpisDaTela` e `lerPainel`, e pelo mesmo motivo: o
 * recorte por perfil é aplicado no servidor, antes de qualquer leitura. É por
 * aqui que o estágio 2 do chat lê — *"a consulta herda o perfil de quem
 * perguntou; o modelo nunca vê dado fora do escopo dessa pessoa"* (seção 7.5).
 */
export async function lerMetrica(
  metrica: string,
  consulta: Query,
  breakdown = "none",
): Promise<MetricValue> {
  const [sessao, fonte] = await Promise.all([
    getSession(),
    obterFonteDeDados(),
  ]);
  const fronteira = criarFronteira(
    fonte,
    escopoDaSessao(sessao),
    dimensoesProvisorias(),
  );
  return fronteira.lerMetrica(metrica, consulta, breakdown);
}
