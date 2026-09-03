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

import { formatarMesAno, formatarValor } from "@/apresentacao/formato/formato";
import {
  CONFIANCA_MINIMA,
  filtrosDaPergunta,
  interpretarLocalmente,
  type Intencao,
} from "@/chat/interpretar";
import { PROXIMO_PASSO } from "@/chat/leitura";
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
import { QUERY_PADRAO, type Query, type Unidade } from "@/semantica/contrato";
import { rotuloDe } from "@/semantica/dimensoes";

/**
 * Como o texto foi produzido. A tela mostra, para não haver dúvida.
 *
 * `gateway-indisponivel` e `modelo-recusado` são coisas diferentes e precisam
 * aparecer diferentes: no primeiro o modelo nem escreveu (rede, chave, crédito
 * esgotado); no segundo escreveu um número que não existe no envelope e foi
 * barrado. Um dia inteiro de "recusada pelo verificador" que era, na verdade,
 * HTTP 402 do gateway ensinou a distinção.
 */
export type Autoria =
  "modelo" | "montado" | "modelo-recusado" | "gateway-indisponivel";

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

/**
 * Valores com unidade, como `formatarValor` os escreve: `R$ 1.200,0 mi`,
 * `-0,7%`, `+2,1 p.p.`, `1,8 vezes`, `52 dias`. Captura também o que o modelo
 * escreve **em vez** da forma canônica — `R$ 8 mi`, `1,8x`, `14,00%` — para
 * que a divergência apareça em vez de passar sem conferência. A fronteira de
 * palavra no fim impede "12 h" de casar dentro de "12 horas" e "1,8 vez"
 * dentro de "1,8 vezes".
 */
const COM_UNIDADE =
  /[-+]?R\$\s[\d.]+(?:,\d+)?(?:\s(?:mi|mil))?(?![\wÀ-ú])|[-+]?[\d.]+(?:,\d+)?\s?%|[-+]?[\d.]+(?:,\d+)?\s?(?:FTE|dias|dia|h|anos|ano|p\.p\.|vezes|vez|x|×)(?![\wÀ-ú])/g;

/**
 * As bases fixas do "Traduzindo": "a cada R$ 100 …", "para cada R$ 1,00 …".
 * Não são dado; são a escala em que o documento de CFO lê uma taxa.
 */
const BASES_DA_TRADUCAO: readonly string[] = ["R$ 100", "R$ 1,00"];

/**
 * O mesmo número dito em reais por base: 8,3% vira "R$ 8,3" a cada R$ 100;
 * liquidez de 1,5 vezes vira "R$ 1,5" para cada R$ 1,00. Vale para qualquer
 * porcentagem ou múltiplo do envelope — o valor principal, o apoio ("margem
 * EBITDA de 16,7%" vira "R$ 16,7 a cada R$ 100 de receita"), as taxas.
 *
 * ## As três reescritas que o verificador aceita
 *
 * RF-15 barra número que ninguém calculou. Três formas de dizer um número que
 * **está** no envelope não são invenção, e o verificador as reconhece de forma
 * determinística: (1) esta, em reais por base; (2) o sinal negativo dito em
 * palavra — "perda de R$ 2,3", "5,6 p.p. abaixo do CDI" — desde que a palavra
 * esteja na mesma frase, e o sinal positivo omitido ("2,7 p.p." por
 * "+2,7 p.p."); (3) número que veio no material que o modelo recebeu — a
 * pergunta ("se a receita cair 10%"), o rótulo, a definição ("mais de 90
 * dias"). Tudo o mais continua barrado, inclusive aritmética sobre números
 * permitidos.
 */
function emReaisPorBase(valor: number, unidade: Unidade): string | null {
  if (unidade !== "pct" && unidade !== "vezes") return null;
  const corpo = formatarValor(valor, unidade).replace(
    /\s?(?:%|vezes|vez)$/,
    "",
  );
  return corpo.startsWith("-") ? `-R$ ${corpo.slice(1)}` : `R$ ${corpo}`;
}

/**
 * O sinal negativo dito em palavra, sem acento e em minúsculas.
 *
 * Lista curta e explícita: o que um CFO escreve ao lado de um número que caiu.
 * Não é defesa — a defesa é o conjunto de permitidos; isto só reconhece a forma
 * de dizer o sinal.
 */
const SINAL_NEGATIVO_EM_PALAVRA =
  /\b(?:perdas?|prejuizos?|negativ[ao]s?|quedas?|recuos?|retracao|reducao|abaixo|inferior|menos|desfavoravel|consum(?:iu|e|indo|o)|consome|deficit|destru\w*|corroeu|corroendo|piorou|piora|caiu|cair|cairam|perdeu)\b/;

/** Até onde, em caracteres, a palavra de sinal pode estar do número. */
const RAIO_DA_FRASE = 60;

function sinalNegativoPorPerto(
  texto: string,
  inicio: number,
  fim: number,
): boolean {
  const trecho = texto
    .slice(Math.max(0, inicio - RAIO_DA_FRASE), fim + RAIO_DA_FRASE)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  return SINAL_NEGATIVO_EM_PALAVRA.test(trecho);
}

/** Tudo que o texto pode citar sem inventar. */
function numerosPermitidos(
  r: Resolucao,
  pergunta: string,
): ReadonlySet<string> {
  const permitidos = new Set<string>(BASES_DA_TRADUCAO);
  const guardar = (valor: number | null, unidade: Unidade) => {
    if (valor !== null) {
      permitidos.add(formatarValor(valor, unidade));
      const emReais = emReaisPorBase(valor, unidade);
      if (emReais !== null) permitidos.add(emReais);
    }
  };

  guardar(r.valor, r.unidade);
  for (const c of r.consideracoes) guardar(c.valor, c.unidade);
  for (const t of r.referencias) guardar(t.valor, "pct");

  // O que veio escrito no material: repetir não é inventar.
  const material = [
    pergunta,
    r.rotulo,
    r.formula,
    r.decisao ?? "",
    ...r.consideracoes.map((c) => c.rotulo),
  ].join("\n");
  for (const m of material.match(COM_UNIDADE) ?? []) {
    permitidos.add(m.replace(/\s+/g, " ").trim());
  }
  if (r.comparacao !== null) {
    for (const l of r.comparacao.leituras) {
      guardar(l.valor, l.unidade);
      guardar(l.referencia.valor, "pct");
    }
    if (r.comparacao.base !== null) {
      guardar(r.comparacao.base.valor, r.comparacao.base.unidade);
    }
  }
  return permitidos;
}

/**
 * Os números do texto que não existem no envelope.
 *
 * Vazio quer dizer que a redação pode ir para a tela. Qualquer item quer dizer
 * que o modelo escreveu um número que ninguém calculou.
 */
export function divergencias(
  texto: string,
  r: Resolucao,
  pergunta = "",
): readonly string[] {
  const permitidos = numerosPermitidos(r, pergunta);
  const erradas: string[] = [];

  for (const casamento of texto.matchAll(COM_UNIDADE)) {
    const citado = casamento[0].replace(/\s+/g, " ").trim();
    if (permitidos.has(citado)) continue;

    // Com sinal e fora do envelope: não há reescrita que salve.
    if (citado.startsWith("-") || citado.startsWith("+")) {
      erradas.push(citado);
      continue;
    }

    // "+2,7 p.p." dito como "2,7 p.p.": o mesmo número.
    if (permitidos.has(`+${citado}`)) continue;

    // "-R$ 2,3" dito como "perda de R$ 2,3": o mesmo número, se a palavra
    // que carrega o sinal estiver por perto.
    const inicio = casamento.index ?? 0;
    if (
      permitidos.has(`-${citado}`) &&
      sinalNegativoPorPerto(texto, inicio, inicio + casamento[0].length)
    ) {
      continue;
    }

    erradas.push(citado);
  }
  return erradas;
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

  const doPainel = r.consideracoes.filter((c) => c.origem === "painel");
  const deApoio = r.consideracoes.filter((c) => c.origem === "apoio");

  if (doPainel.length > 0) {
    /*
     * `flatMap` em vez de `filter` seguido de `map`, e não é estilo: com os
     * dois passos separados, o `map` precisava de um `c.valor ?? 0` que o
     * TypeScript exige e a regra de T-141 reprova com razão — um zero escrito à
     * mão a um passo do formatador é o achado 5 do Anexo D. Aqui o valor existe
     * por construção dentro do ramo.
     */
    const itens = doPainel
      .flatMap((c) =>
        c.valor === null
          ? []
          : [`${c.rotulo} ${formatarValor(c.valor, c.unidade)}`],
      )
      .join("; ");
    linhas.push(`O que entrou na conta: ${itens}.`);
  }

  if (deApoio.length > 0) {
    // Apoio sem dado é dito, e não omitido: a pessoa saberia que faltou.
    const itens = deApoio
      .map((c) =>
        c.valor === null
          ? `${c.rotulo} sem dado`
          : `${c.rotulo} ${formatarValor(c.valor, c.unidade)}`,
      )
      .join("; ");
    linhas.push(`O que explica: ${itens}.`);
  }

  linhas.push(`Fórmula: ${r.formula}.`);

  if (r.comparacao !== null) {
    const c = r.comparacao;
    if (c.base !== null) {
      linhas.push(
        `Sobre ${c.base.rotulo.toLowerCase()} de ${formatarValor(c.base.valor, c.base.unidade)}:`,
      );
    }
    for (const l of c.leituras) {
      linhas.push(
        `${l.rotulo}: ${formatarValor(l.valor, l.unidade)} — contra ${l.referencia.nome} ` +
          `de ${formatarValor(l.referencia.valor, "pct")} ${l.referencia.periodicidade} ` +
          `(${l.referencia.fonte}, desde ${l.referencia.vigenteDesde}). ${l.formula}.`,
      );
    }
  } else if (r.comparacaoIndisponivelPorque !== null) {
    linhas.push(`Sem comparação com juros: ${r.comparacaoIndisponivelPorque}.`);
  }

  if (r.comparacao === null && r.referencias.length > 0) {
    const taxas = r.referencias
      .map(
        (t) => `${t.nome} ${formatarValor(t.valor, "pct")} ${t.periodicidade}`,
      )
      .join("; ");
    linhas.push(`Referências: ${taxas}.`);
  }

  const proximo = PROXIMO_PASSO[r.metrica];
  if (proximo !== undefined) linhas.push(proximo);

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
    // Só o que é comparável com o número principal: degrau do painel, ou apoio
    // na mesma unidade. Comparar |R$ mi| com |%| não escolhe nada.
    const maior = [...r.consideracoes]
      .filter(
        (c) =>
          c.valor !== null &&
          (c.origem === "painel" || c.unidade === r.unidade),
      )
      .sort((a, b) => Math.abs(b.valor ?? 0) - Math.abs(a.valor ?? 0))[0];
    if (maior !== undefined) {
      sugestoes.push(`Por que ${maior.rotulo.toLowerCase()} pesa tanto?`);
    }
  }
  return sugestoes;
}

/** A confiança de uma recusa do modelo: nenhuma, por definição. */
const SEM_CONFIANCA = 0;

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
    sinonimos: m.sinonimos,
  }));
  const doModelo = await interpretarComGateway(pergunta, metricas);

  // Gateway fora, chave recusada ou JSON malformado: o caminho local vale.
  if (doModelo === null) return local;

  // Os filtros continuam saindo do nosso código: o modelo escolhe a métrica,
  // e o recorte é vocabulário fechado que ele não precisa adivinhar. Saem da
  // pergunta, e não do palpite local — que é `null` sempre que nada casa, e
  // "nos últimos 12 meses" não pode sumir junto com ele.
  const filtros = filtrosDaPergunta(pergunta, atuais);

  /*
   * O modelo recusou: é o que o prompt pede quando nada casa, e a recusa vai
   * para a tela como recusa útil (seção 7.5). Antes ela era descartada e o
   * chat caía no casamento de sinônimo — "qual é o ROE?" virava eNPS, e a
   * recusa certa do modelo nunca chegava a ninguém.
   *
   * Uma exceção, de propósito: quando o catálogo casa a pergunta por sinônimo
   * com confiança, o sinônimo vence a recusa. Sinônimo é vocabulário que
   * Produto declarou para aquela métrica — "centro de custo" leva ao desvio
   * orçamentário porque é o painel que existe por centro de custo, e não por
   * o modelo achar que é a métrica certa. Um modelo mais barato recusou
   * "quais centros de custo dão mais retorno?" (2026-09-03); o interpretador
   * local, que sabe os sinônimos, respondia. O caso do eNPS não volta: ele
   * era casamento por palavra solta, que hoje não passa do limiar.
   */
  if (doModelo.metrica === "") {
    if (local !== null && local.confianca >= CONFIANCA_MINIMA) return local;
    return {
      metrica: "",
      filtros,
      confianca: SEM_CONFIANCA,
      alternativas: doModelo.alternativas,
    };
  }

  return {
    metrica: doModelo.metrica,
    filtros,
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
  const resolvida = await resolverPergunta(pergunta, atuais);
  if (resolvida.tipo === "recusa") return resolvida;
  return redigirResposta(pergunta, resolvida.resolucao);
}

/** O que os estágios 1 e 2 entregam: o número resolvido, ou a recusa. */
export type Resolvida =
  | { readonly tipo: "resolvida"; readonly resolucao: Resolucao }
  | Extract<Resposta, { tipo: "recusa" }>;

/**
 * Os estágios 1 e 2, sem redação.
 *
 * Existe separado de `perguntar` porque a tela precisa decidir **para onde
 * ir** antes de gastar o estágio 3. Quando a resposta cita outra tela, a
 * página redireciona levando a pergunta, e a tela de destino é quem redige.
 * Redigir aqui e lá dobrava a espera: dois estágios 3 do modelo, o primeiro
 * jogado fora, e 40 segundos sem nada na tela parecem chat quebrado — foi
 * exatamente o que quem testou relatou.
 */
export async function resolverPergunta(
  pergunta: string,
  atuais: Query = QUERY_PADRAO,
): Promise<Resolvida> {
  const intencao = await interpretar(pergunta, atuais);

  if (intencao === null || intencao.confianca < CONFIANCA_MINIMA) {
    // Nada casou (local) ou o modelo recusou: não há métrica para oferecer.
    const recusou = intencao === null || intencao.metrica === "";
    const propria: readonly string[] =
      intencao !== null && intencao.metrica !== "" ? [intencao.metrica] : [];
    // A melhor candidata vem primeiro: é o palpite mais próximo, não o último.
    const alternativas = propria
      .concat(intencao?.alternativas ?? [])
      // Os ids vêm do modelo: só o que existe no catálogo vira atalho na tela.
      .filter((id) => CATALOGO_GERADO[id] !== undefined)
      .slice(0, 3)
      .map((id) => ({ id, rotulo: rotuloDaMetrica(id) }));

    return {
      tipo: "recusa",
      texto:
        alternativas.length === 0
          ? "Não tenho métrica no catálogo que responda a isso."
          : recusou
            ? "Não tenho essa métrica no catálogo. Estas são as mais próximas:"
            : "Não tenho certeza do que você quer saber. Estas são as métricas mais próximas:",
      alternativas,
    };
  }

  try {
    const resolucao = await resolver(intencao.metrica, intencao.filtros);
    return { tipo: "resolvida", resolucao };
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
}

/**
 * O estágio 3 e o verificador, sobre um número já resolvido.
 *
 * O modelo escreve; o verificador confere cada número contra o envelope e,
 * se algum não existir, fica o texto montado (RF-15).
 */
export async function redigirResposta(
  pergunta: string,
  resolucao: Resolucao,
): Promise<Resposta> {
  const montado = montarTexto(resolucao, pergunta);
  const doModelo = gatewayConfigurado()
    ? await redigirComGateway(pergunta, paraOModelo(resolucao))
    : null;

  let texto = montado;
  let autoria: Autoria = gatewayConfigurado()
    ? "gateway-indisponivel"
    : "montado";

  if (doModelo !== null) {
    const erradas = divergencias(doModelo, resolucao, pergunta);
    if (erradas.length === 0) {
      texto = doModelo;
      autoria = "modelo";
    } else {
      // Divergiu: fica o texto montado, e a autoria diz que a redação foi
      // recusada. RF-15 pede bloqueio, não correção.
      autoria = "modelo-recusado";
    }
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
export function paraOModelo(r: Resolucao): unknown {
  const formatado = (valor: number | null, unidade: Unidade) =>
    valor === null ? null : formatarValor(valor, unidade);

  return {
    metrica: r.rotulo,
    valor: { bruto: r.valor, formatado: formatado(r.valor, r.unidade) },
    periodo: rotuloDe("periodo", r.acoes.filtros.periodo),
    fechamento: formatarMesAno(r.asOf),
    leitura: r.familia,
    traducao: {
      bases: BASES_DA_TRADUCAO,
      emReais: r.valor === null ? null : emReaisPorBase(r.valor, r.unidade),
    },
    formula: r.formula,
    definicao: r.decisao,
    dataDoFechamento: r.asOf,
    consideracoes: r.consideracoes.map((c) => ({
      rotulo: c.rotulo,
      formatado: formatado(c.valor, c.unidade),
      origem: c.origem,
    })),
    referencias: r.referencias.map((t) => ({
      nome: t.nome,
      formatado: formatarValor(t.valor, "pct"),
      periodicidade: t.periodicidade,
      fonte: t.fonte,
      vigenteDesde: t.vigenteDesde,
    })),
    comparacao:
      r.comparacao === null
        ? null
        : {
            familia: r.comparacao.familia,
            base:
              r.comparacao.base === null
                ? null
                : {
                    rotulo: r.comparacao.base.rotulo,
                    formatado: formatarValor(
                      r.comparacao.base.valor,
                      r.comparacao.base.unidade,
                    ),
                  },
            leituras: r.comparacao.leituras.map((l) => ({
              rotulo: l.rotulo,
              formatado: formatarValor(l.valor, l.unidade),
              formula: l.formula,
              referencia: {
                nome: l.referencia.nome,
                formatado: formatarValor(l.referencia.valor, "pct"),
                periodicidade: l.referencia.periodicidade,
                fonte: l.referencia.fonte,
              },
            })),
          },
    comparacaoIndisponivelPorque: r.comparacaoIndisponivelPorque,
    proximoPasso: PROXIMO_PASSO[r.metrica] ?? null,
  };
}
