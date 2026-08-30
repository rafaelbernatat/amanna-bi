/**
 * Os três estágios, na ordem, com a fronteira no meio (seção 7.1).
 *
 * ```
 *  pergunta
 *     │
 *     ├─ 1 · interpretar   modelo, ou casamento de sinônimo se não houver chave
 *     │                    devolve intenção. Nenhum número.
 *     ├─ 2 · resolver      NOSSO CÓDIGO. Valida no catálogo, lê pela fronteira
 *     │                    de perfil, calcula. É aqui que o número nasce.
 *     ├─ 3 · redigir       modelo, ou texto montado do resultado
 *     │
 *     └─ verificar         todo número do texto tem de existir no envelope
 * ```
 *
 * ## O verificador não é enfeite
 *
 * RF-15 e a métrica O5: *"número citado no texto é igual ao do gráfico e ao do
 * painel na tela. Verificador determinístico compara texto e envelope;
 * divergência **bloqueia** a exibição."*
 *
 * É o que separa este produto de um chatbot que chuta. O modelo pode escrever
 * "R$ 12 mi" onde o envelope diz "-R$ 8 mi" — modelos fazem isso. Quando faz, a
 * resposta dele é descartada e entra o texto montado do resultado, que não tem
 * como divergir porque é feito dos mesmos campos.
 *
 * Descartar e registrar, e não corrigir em silêncio: uma correção silenciosa
 * esconderia a frequência com que isso acontece, que é justamente o número que
 * a seção 7.7 quer medir.
 */

import { formatarValor } from "@/apresentacao/formato/formato";
import {
  CONFIANCA_MINIMA,
  interpretarLocalmente,
  type Intencao,
} from "@/chat/interpretar";
import {
  gatewayConfigurado,
  interpretarComGateway,
  redigirComGateway,
} from "@/chat/openrouter";
import {
  MetricaForaDoCatalogo,
  resolver,
  type Resolucao,
} from "@/chat/resolver";
import { CATALOGO_GERADO } from "@/semantica/catalogo-gerado";
import { QUERY_PADRAO, type Query } from "@/semantica/contrato";

/** Como o texto foi produzido. A tela mostra, para não haver dúvida. */
export type Autoria = "modelo" | "montado" | "modelo-recusado";

/** O que a tela recebe (seção 7.2). */
export type Resposta =
  | {
      readonly tipo: "resposta";
      readonly texto: string;
      readonly autoria: Autoria;
      readonly resolucao: Resolucao;
      readonly sugestoes: readonly string[];
    }
  | {
      readonly tipo: "recusa";
      readonly texto: string;
      readonly alternativas: readonly {
        readonly id: string;
        readonly rotulo: string;
      }[];
    };

/* ------------------------------------------------------------------ *
 * O verificador
 * ------------------------------------------------------------------ */

/** Valores com unidade: `R$ 1.200,0 mi`, `-0,7%`, `1.240 FTE`, `52 dias`. */
const COM_UNIDADE =
  /-?R\$\s[\d.]+,?\d*\s(?:mi|mil)|-?[\d.]+,?\d*\s?%|-?[\d.]+,?\d*\s(?:FTE|dias|dia|h|anos|ano|p\.p\.)/g;

/** Tudo que o texto pode citar sem inventar. */
function numerosPermitidos(r: Resolucao): ReadonlySet<string> {
  const permitidos = new Set<string>();
  const guardar = (
    valor: number | null,
    unidade: Parameters<typeof formatarValor>[1],
  ) => {
    if (valor !== null) permitidos.add(formatarValor(valor, unidade));
  };

  guardar(r.valor, r.unidade);
  for (const c of r.consideracoes) guardar(c.valor, c.unidade);
  if (r.comparacao !== null) {
    guardar(r.comparacao.retornoPercentual, "pct");
    guardar(r.comparacao.base.valor, "BRL_mi");
    guardar(r.comparacao.taxa.valor, "pct");
  }
  return permitidos;
}

/**
 * Os números do texto que não existem no envelope.
 *
 * Vazio quer dizer que a redação pode ir para a tela. Qualquer item quer dizer
 * que o modelo escreveu um número que ninguém calculou.
 */
export function divergencias(texto: string, r: Resolucao): readonly string[] {
  const permitidos = numerosPermitidos(r);
  const citados = texto.match(COM_UNIDADE) ?? [];
  return citados
    .map((c) => c.replace(/\s+/g, " ").trim())
    .filter((c) => !permitidos.has(c));
}

/* ------------------------------------------------------------------ *
 * O estágio 3 sem modelo
 * ------------------------------------------------------------------ */

/**
 * O texto montado do resultado.
 *
 * Não tem como divergir do envelope: cada frase é feita dos mesmos campos que o
 * verificador confere. É o piso da qualidade da resposta — o modelo escreve
 * melhor, e nunca escreve mais verdadeiro.
 */
export function montarTexto(r: Resolucao, pergunta: string): string {
  const valor =
    r.valor === null
      ? "sem dado neste recorte"
      : formatarValor(r.valor, r.unidade);

  const linhas: string[] = [`${r.rotulo}: ${valor}.`];

  if (r.consideracoes.length > 0) {
    /*
     * `flatMap` em vez de `filter` seguido de `map`, e não é estilo: com os
     * dois passos separados, o `map` precisava de um `c.valor ?? 0` que o
     * TypeScript exige e a regra de T-141 reprova com razão — um zero escrito à
     * mão a um passo do formatador é o achado 5 do Anexo D. Aqui o valor existe
     * por construção dentro do ramo.
     */
    const itens = r.consideracoes
      .flatMap((c) =>
        c.valor === null
          ? []
          : [`${c.rotulo} ${formatarValor(c.valor, c.unidade)}`],
      )
      .join("; ");
    linhas.push(`O que entrou na conta: ${itens}.`);
  }

  linhas.push(`Fórmula: ${r.formula}.`);

  if (r.comparacao !== null) {
    const c = r.comparacao;
    linhas.push(
      `Sobre ${c.base.rotulo.toLowerCase()} de ${formatarValor(c.base.valor, "BRL_mi")}, ` +
        `isso é ${formatarValor(c.retornoPercentual, "pct")} — contra ${c.taxa.nome} ` +
        `de ${formatarValor(c.taxa.valor, "pct")} ao ano (${c.taxa.fonte}, desde ${c.taxa.vigenteDesde}). ` +
        `${c.formula}.`,
    );
  } else if (r.comparacaoIndisponivelPorque !== null) {
    linhas.push(`Sem comparação com juros: ${r.comparacaoIndisponivelPorque}.`);
  }

  /*
   * A `decisao` do catálogo NÃO entra no texto.
   *
   * Ela é o registro da seção 9.4 — quem aprovou a definição, quando, e o que
   * ficou pendente. Em `turnover_12m` são oito linhas explicando que P2 ainda
   * está aberto. Despejar isso no meio da resposta afoga o número que a pessoa
   * perguntou.
   *
   * Continua na `Resolucao`, e a tela a mostra como nota de rodapé recolhível:
   * quem quer auditar a definição encontra; quem quer o número lê o número.
   */
  void pergunta;
  return linhas.join(" ");
}

/* ------------------------------------------------------------------ *
 * A orquestração
 * ------------------------------------------------------------------ */

function rotuloDaMetrica(id: string): string {
  return CATALOGO_GERADO[id]?.rotulo ?? id;
}

/** As duas perguntas seguintes, escolhidas para levar adiante (seção 7.6). */
function sugestoesApos(r: Resolucao): readonly string[] {
  const sugestoes = [`Como isso se compara com o ano anterior?`];
  if (r.consideracoes.length > 0) {
    const maior = [...r.consideracoes]
      .filter((c) => c.valor !== null)
      .sort((a, b) => Math.abs(b.valor ?? 0) - Math.abs(a.valor ?? 0))[0];
    if (maior !== undefined) {
      sugestoes.push(`Por que ${maior.rotulo.toLowerCase()} pesa tanto?`);
    }
  }
  return sugestoes;
}

/** O estágio 1, com o gateway quando há chave e com o catálogo quando não há. */
async function interpretar(
  pergunta: string,
  atuais: Query,
): Promise<Intencao | null> {
  const local = interpretarLocalmente(pergunta, atuais);

  if (!gatewayConfigurado()) return local;

  const metricas = Object.entries(CATALOGO_GERADO).map(([id, m]) => ({
    id,
    rotulo: m.rotulo,
  }));
  const doModelo = await interpretarComGateway(pergunta, metricas);
  if (doModelo === null || doModelo.metrica === "") return local;

  return {
    metrica: doModelo.metrica,
    // Os filtros continuam saindo do nosso código: o modelo escolhe a métrica,
    // e o recorte é vocabulário fechado que ele não precisa adivinhar.
    filtros: local?.filtros ?? atuais,
    confianca: doModelo.confianca,
    alternativas: doModelo.alternativas,
  };
}

/**
 * Pergunta e resposta, com a fronteira no meio.
 *
 * `atuais` é o recorte que já está na tela: uma pergunta sem recorte explícito
 * herda o que a pessoa está vendo, que é o que 6.2 promete quando diz que os
 * filtros valem para tudo na tela ativa.
 */
export async function perguntar(
  pergunta: string,
  atuais: Query = QUERY_PADRAO,
): Promise<Resposta> {
  const intencao = await interpretar(pergunta, atuais);

  if (intencao === null || intencao.confianca < CONFIANCA_MINIMA) {
    const alternativas = (intencao?.alternativas ?? [])
      .concat(intencao === null ? [] : [intencao.metrica])
      .slice(0, 3)
      .map((id) => ({ id, rotulo: rotuloDaMetrica(id) }));

    return {
      tipo: "recusa",
      texto:
        alternativas.length === 0
          ? "Não tenho métrica no catálogo que responda a isso."
          : "Não tenho certeza do que você quer saber. Estas são as métricas mais próximas:",
      alternativas,
    };
  }

  let resolucao: Resolucao;
  try {
    resolucao = await resolver(intencao.metrica, intencao.filtros);
  } catch (erro) {
    if (erro instanceof MetricaForaDoCatalogo) {
      return {
        tipo: "recusa",
        texto:
          "Não tenho essa métrica no catálogo. Estas são as mais próximas:",
        alternativas: erro.proximas.map((id) => ({
          id,
          rotulo: rotuloDaMetrica(id),
        })),
      };
    }
    throw erro;
  }

  const montado = montarTexto(resolucao, pergunta);
  const doModelo = gatewayConfigurado()
    ? await redigirComGateway(pergunta, paraOModelo(resolucao))
    : null;

  let texto = montado;
  let autoria: Autoria = gatewayConfigurado() ? "modelo-recusado" : "montado";

  if (doModelo !== null) {
    const erradas = divergencias(doModelo, resolucao);
    if (erradas.length === 0) {
      texto = doModelo;
      autoria = "modelo";
    }
    // Divergiu: fica o texto montado, e a autoria diz que a redação foi
    // recusada. RF-15 pede bloqueio, não correção.
  }

  return {
    tipo: "resposta",
    texto,
    autoria,
    resolucao,
    sugestoes: sugestoesApos(resolucao),
  };
}

/**
 * O que atravessa a fronteira no estágio 3.
 *
 * Números **já formatados** junto dos brutos, para o modelo copiar em vez de
 * reescrever — é assim que "substituição de campo" da seção 7.1 vira prática.
 */
function paraOModelo(r: Resolucao): unknown {
  return {
    metrica: r.rotulo,
    valor: {
      bruto: r.valor,
      formatado: r.valor === null ? null : formatarValor(r.valor, r.unidade),
    },
    formula: r.formula,
    definicao: r.decisao,
    dataDoFechamento: r.asOf,
    consideracoes: r.consideracoes.map((c) => ({
      rotulo: c.rotulo,
      formatado: c.valor === null ? null : formatarValor(c.valor, c.unidade),
    })),
    comparacao:
      r.comparacao === null
        ? null
        : {
            taxa: r.comparacao.taxa,
            taxaFormatada: formatarValor(r.comparacao.taxa.valor, "pct"),
            retornoFormatado: formatarValor(
              r.comparacao.retornoPercentual,
              "pct",
            ),
            base: {
              rotulo: r.comparacao.base.rotulo,
              formatado: formatarValor(r.comparacao.base.valor, "BRL_mi"),
            },
            formula: r.comparacao.formula,
          },
  };
}
