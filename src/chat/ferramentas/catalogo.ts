/**
 * O vocabulário fechado de ferramentas que o modelo pode pedir
 * (D-CHAT-ferramentas, T-348).
 *
 * Oito ferramentas, cada uma um `JSON Schema` com `additionalProperties:
 * false` e enums derivados do que o produto já declara: os ids do catálogo, os
 * códigos dos filtros, as oito dimensões de ranking, os anos que a fonte tem.
 * O modelo **pede** leituras por este vocabulário; quem executa é o nosso
 * código, pela mesma fronteira de perfil das telas. Nenhuma ferramenta recebe
 * texto livre que vire consulta: não há SQL, não há expressão, não há campo
 * aberto além da busca no catálogo — que é busca, e não leitura.
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

/** As oito ferramentas, com os enums do contexto desta pergunta. */
export function ferramentas(contexto: ContextoDaTela): readonly Ferramenta[] {
  const filtros = esquemaDeFiltros(contexto.anos);
  return [
    {
      nome: "ler_metrica",
      descricao:
        "Lê o valor de uma métrica do catálogo no recorte pedido. Use para " +
        "qualquer número simples. Devolve o valor formatado, a fórmula e a data " +
        "de fechamento.",
      parametros: {
        type: "object",
        additionalProperties: false,
        required: ["metrica"],
        properties: { metrica: metrica("Id da métrica."), filtros },
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
        properties: { metrica: metrica("Id da métrica."), filtros },
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
  ];
}
