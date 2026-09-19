/**
 * O vocabulário fechado de ferramentas que o modelo pode pedir
 * (D-CHAT-ferramentas, T-348).
 *
 * Oito ferramentas fechadas, cada uma um `JSON Schema` com
 * `additionalProperties: false` e enums derivados do que o produto já declara:
 * os ids do catálogo, os códigos dos filtros, as oito dimensões de ranking, os
 * anos que a fonte tem. O modelo **pede** leituras por este vocabulário; quem
 * executa é o nosso código, pela mesma fronteira de perfil das telas.
 *
 * ## E uma nona, que recebe SQL
 *
 * Até 2026-09-19 este cabeçalho dizia "não há SQL, não há expressão, não há
 * campo aberto". Produto reverteu: o chat responde qualquer pergunta sobre os
 * dados, e as oito ferramentas partem todas de um id do catálogo — esse era o
 * teto. `consultar_dados` recebe um SELECT.
 *
 * O que sustenta a reversão **não** é este arquivo: é o papel `amanna_chat_ro`,
 * que tem GRANT só no esquema `amanna_chat` e nenhum em `amanna`, numa conexão
 * própria (migração 012). As oito continuam fechadas, continuam mantendo o
 * piso de área × mês, e continuam sendo o caminho preferido — mais rápidas, já
 * conferidas, e são elas que acendem o painel na conversa.
 *
 * A nona só é oferecida quando há banco. Em `fixtures` não há, e o modelo nem
 * a enxerga.
 *
 * ## Por que enums, e não `pattern`
 *
 * Um enum com os 145 ids custa uns poucos milhares de caracteres no prompt e
 * compra uma garantia: o modelo não consegue inventar um id. O que ele não
 * consegue pedir, o validador não precisa recusar — e a recusa que sobra é a
 * de argumento fora do sentido (métrica que não abre pela dimensão), que vem
 * com as alternativas certas.
 */

import type { ContextoDaTela } from "@/chat/contexto";
import {
  MAXIMO_DE_METRICAS_NA_COMPARACAO,
  MINIMO_DE_METRICAS_NA_COMPARACAO,
  TOP_N_MAXIMO,
} from "@/chat/ferramentas/limites";
import { CATALOGO_GERADO } from "@/semantica/catalogo-gerado";
import { DIMENSOES_DE_RANKING } from "@/semantica/contrato";
import { codigosDe } from "@/semantica/dimensoes";

export const NOMES_DE_FERRAMENTA = [
  "ler_metrica",
  "serie_da_metrica",
  "comparar_metricas",
  "variacao",
  "ranking",
  "decompor",
  "explicar_grafico",
  "listar_metricas",
  "consultar_dados",
] as const;
export type NomeDeFerramenta = (typeof NOMES_DE_FERRAMENTA)[number];

export function nomeDeFerramentaValido(
  candidato: string,
): candidato is NomeDeFerramenta {
  return (NOMES_DE_FERRAMENTA as readonly string[]).includes(candidato);
}

/** Uma ferramenta como o gateway a recebe: nome, descrição e esquema. */
export type Ferramenta = {
  readonly nome: NomeDeFerramenta;
  readonly descricao: string;
  readonly parametros: Readonly<Record<string, unknown>>;
};

/** Os ids do catálogo, em ordem, para o enum ser byte-estável. */
function idsDoCatalogo(): readonly string[] {
  return Object.keys(CATALOGO_GERADO).sort();
}

/** O esquema de `filtros`: os quatro fechados mais o ano, todos opcionais. */
export function esquemaDeFiltros(
  anos: readonly string[],
): Readonly<Record<string, unknown>> {
  return {
    type: "object",
    description:
      "Recorte da leitura. Campo omitido herda o filtro que está na tela.",
    additionalProperties: false,
    properties: {
      periodo: { type: "string", enum: codigosDe("periodo") },
      entidade: { type: "string", enum: codigosDe("entidade") },
      area: { type: "string", enum: codigosDe("area") },
      modalidade: { type: "string", enum: codigosDe("modalidade") },
      ano:
        anos.length === 0
          ? { type: "string", pattern: "^\\d{4}$" }
          : { type: "string", enum: [...anos] },
    },
  };
}

function metrica(descricao: string): Readonly<Record<string, unknown>> {
  return { type: "string", enum: idsDoCatalogo(), description: descricao };
}

/**
 * O mês pedido, ao nível da ferramenta e não dentro de `filtros` (T-447).
 *
 * O vocabulário de `filtros` é o `Query` das telas, e ele não tem mês: os
 * períodos são "12-meses", "6-meses", "4-trimestre" e "dezembro". Pôr um mês
 * ali seria mentir sobre o que o recorte da URL alcança. Aqui é outra coisa —
 * o valor lido continua sendo o do recorte, e o mês escolhe um ponto da série
 * que a métrica já traz.
 */
const MES: Readonly<Record<string, unknown>> = {
  type: "string",
  pattern: "^(0[1-9]|1[0-2])/20\\d{2}$",
  description:
    "Um mês específico, como MM/AAAA ('06/2026'). Use quando a pergunta " +
    "nomeia um mês: a resposta abre por ele, e o valor do período inteiro " +
    "vira contexto. O recorte não muda.",
};

/**
 * A descrição da nona ferramenta.
 *
 * Diz ao modelo **quando não usá-la**, que é o que mantém o caminho barato no
 * caso comum: o ranking de uma dimensão já devolve cada item com rótulo, valor
 * e participação, e responde "quanto gastamos com o fornecedor X" sempre que X
 * estiver entre os maiores.
 */
const DESCRICAO_DA_CONSULTA =
  "Uma consulta SQL de leitura ao banco. Alcança TUDO que existe nos dados, " +
  "linha a linha: os lançamentos do razão com histórico e parceiro, as " +
  "pessoas com nome, cargo e custo, as ausências, a pesquisa de engajamento, " +
  "as vagas e candidaturas, os treinamentos, as horas por projeto, as notas " +
  "fiscais, o orçamento contra o realizado, os projetos, os empréstimos e as " +
  "dimensões. Use sempre que a pergunta pedir algo que as outras ferramentas " +
  "não devolvem — um nome, uma lista de itens concretos, um recorte por mês " +
  "por dimensão, um cruzamento que não existe como métrica. Prefira o ranking " +
  "ou a decomposição quando eles respondem exatamente o que se pediu, porque " +
  "desenham o gráfico; fora isso, consulte. " +
  "Só SELECT, uma consulta por vez, até 25 linhas e 6 colunas — escolha as " +
  "colunas, nunca 'SELECT *'. Dê apelido claro a cada coluna, e ponha o nome " +
  "(a conta, o colaborador, o mês) como PRIMEIRA coluna: é ele que rotula a " +
  "linha na resposta.";

/** As ferramentas, com os enums do contexto desta pergunta. */
export function ferramentas(
  contexto: ContextoDaTela,
  comConsulta = false,
): readonly Ferramenta[] {
  const filtros = esquemaDeFiltros(contexto.anos);
  const consulta: readonly Ferramenta[] = comConsulta
    ? [
        {
          nome: "consultar_dados",
          descricao: DESCRICAO_DA_CONSULTA,
          parametros: {
            type: "object",
            additionalProperties: false,
            required: ["consulta"],
            properties: {
              consulta: {
                type: "string",
                minLength: 10,
                description:
                  "O SELECT, sobre as views do esquema amanna_chat. Sem " +
                  "ponto e vírgula, sem esquema no nome da tabela.",
              },
            },
          },
        },
      ]
    : [];
  return [
    {
      nome: "ler_metrica",
      descricao:
        "Lê o valor de uma métrica do catálogo no recorte pedido. Use para " +
        "qualquer número simples. Devolve o valor formatado, a fórmula e a data " +
        "de fechamento. Com 'mes', devolve também o valor desse mês.",
      parametros: {
        type: "object",
        additionalProperties: false,
        required: ["metrica"],
        properties: { metrica: metrica("Id da métrica."), mes: MES, filtros },
      },
    },
    {
      nome: "serie_da_metrica",
      descricao:
        "A evolução mês a mês de uma métrica, como o painel dela mostra. " +
        "Devolve os pontos com rótulo de mês, o pico, o vale e o último. Use " +
        "para 'pior mês', 'melhor mês', 'tendência', 'evolução'.",
      parametros: {
        type: "object",
        additionalProperties: false,
        required: ["metrica"],
        properties: { metrica: metrica("Id da métrica."), mes: MES, filtros },
      },
    },
    {
      nome: "comparar_metricas",
      descricao:
        "Lê de duas a quatro métricas no mesmo recorte, lado a lado. Quando as " +
        "duas primeiras têm a mesma unidade, devolve a diferença já calculada.",
      parametros: {
        type: "object",
        additionalProperties: false,
        required: ["metricas"],
        properties: {
          metricas: {
            type: "array",
            minItems: MINIMO_DE_METRICAS_NA_COMPARACAO,
            maxItems: MAXIMO_DE_METRICAS_NA_COMPARACAO,
            items: metrica("Id da métrica."),
          },
          filtros,
        },
      },
    },
    {
      nome: "variacao",
      descricao:
        "A métrica no ano atual contra o ano anterior, com a diferença e, " +
        "quando a métrica é somável, a variação percentual já calculadas. Use " +
        "para 'cresceu', 'caiu', 'em relação ao ano passado'.",
      parametros: {
        type: "object",
        additionalProperties: false,
        required: ["metrica", "contra"],
        properties: {
          metrica: metrica("Id da métrica."),
          contra: { type: "string", enum: ["ano_anterior"] },
          filtros,
        },
      },
    },
    {
      nome: "ranking",
      descricao:
        "Os N maiores (ou menores) de uma métrica por uma dimensão: área, " +
        "centro de custo, cliente, fornecedor, conta, linha da DRE, UF ou " +
        "segmento. Devolve os itens com a participação no total. Use para " +
        "'top', 'maiores', 'quais ... mais'.",
      parametros: {
        type: "object",
        additionalProperties: false,
        required: ["metrica", "dimensao"],
        properties: {
          metrica: metrica("Id da métrica."),
          dimensao: { type: "string", enum: [...DIMENSOES_DE_RANKING] },
          topN: { type: "integer", minimum: 1, maximum: TOP_N_MAXIMO },
          ordem: { type: "string", enum: ["maior", "menor"] },
          filtros,
        },
      },
    },
    {
      nome: "decompor",
      descricao:
        "Como uma métrica se distribui por uma dimensão: todas as categorias " +
        "(até doze, o resto em 'outros') com a participação de cada uma. Use " +
        "para 'como se distribui', 'por área', 'composição'.",
      parametros: {
        type: "object",
        additionalProperties: false,
        required: ["metrica", "dimensao"],
        properties: {
          metrica: metrica("Id da métrica."),
          dimensao: { type: "string", enum: [...DIMENSOES_DE_RANKING] },
          filtros,
        },
      },
    },
    {
      nome: "explicar_grafico",
      descricao:
        "O resumo de um painel da tela: título, forma, os pontos com rótulo, " +
        "os destaques e o total. Sem 'painel', usa o painel em foco na tela. " +
        "Use para 'o que esse gráfico mostra', 'explica esse painel'.",
      parametros: {
        type: "object",
        additionalProperties: false,
        properties: {
          painel: {
            type: "string",
            description: "Id do painel. Omitido: o painel em foco.",
          },
          filtros,
        },
      },
    },
    {
      nome: "listar_metricas",
      descricao:
        "Procura métricas do catálogo por palavra. Use quando não souber o id " +
        "certo, ou quando a pessoa perguntar o que dá para perguntar.",
      parametros: {
        type: "object",
        additionalProperties: false,
        required: ["busca"],
        properties: { busca: { type: "string", minLength: 2 } },
      },
    },
    ...consulta,
  ];
}
