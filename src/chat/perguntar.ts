/**
 * Os três estágios, na ordem, com a fronteira no meio (seção 7.1).
 *
 * ```
 *  pergunta
 *     │
 *     ├─ 0 · classificar   NOSSO CÓDIGO. Simples ou composta, por sinais.
 *     │                    Composta vai ao laço de `laco.ts`, em que o modelo
 *     │                    PEDE leituras e nosso código as executa.
 *     ├─ 1 · interpretar   modelo, ou casamento de sinônimo se não houver chave
 *     │                    devolve intenção. Nenhum número.
 *     ├─ 2 · resolver      NOSSO CÓDIGO. Valida no catálogo, lê pela fronteira
 *     │                    de perfil, calcula. É aqui que o número nasce.
 *     ├─ 3 · redigir       modelo, ou texto montado do resultado
 *     │
 *     └─ verificar         todo número do texto tem de existir no envelope;
 *                          ponto de série, só junto do rótulo (D-CHAT-ferramentas)
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
import { classificar } from "@/chat/classificar";
import {
  contextoDeQuery,
  ehContexto,
  rotularFiltros,
  type ContextoDaTela,
} from "@/chat/contexto";
import { paraOModeloLeitura } from "@/chat/ferramentas/executar";
import {
  mesDaPergunta,
  pedeOPeriodoInteiro,
  pontoDoMes,
  semMes,
  type MesPedido,
} from "@/chat/mes";
import { RAIO_DO_ROTULO } from "@/chat/ferramentas/limites";
import {
  fraseDe,
  numerosDe,
  numerosDoResumo,
  type NumeroPermitido,
} from "@/chat/ferramentas/resultado";
import { resumirPainel, variantesDoRotulo } from "@/chat/grafico";
import { registrarIncidente } from "@/chat/incidente";
import {
  CONFIANCA_MINIMA,
  filtrosDaPergunta,
  interpretarLocalmente,
  mudaRecorte,
  semRecorte,
  type Intencao,
  type TurnoAnterior,
} from "@/chat/interpretar";
import { resolverComposta, type EventosDoLaco } from "@/chat/laco";
import { PROXIMO_PASSO } from "@/chat/leitura";
import { sugestoesDaTela } from "@/chat/sugestoes";
import {
  corrigirComGateway,
  gatewayConfigurado,
  interpretarComGateway,
  modeloEmUso,
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

export type { TurnoAnterior } from "@/chat/interpretar";

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
  | "modelo"
  /** O modelo escreveu, o verificador recusou, e a única reescrita passou (T-433). */
  | "modelo-corrigido"
  | "montado"
  | "modelo-recusado"
  | "gateway-indisponivel";

/**
 * Quantas vezes o modelo pode reescrever um texto recusado. Uma: a segunda
 * recusa cai no montado. Mais que isso seria pagar para o modelo insistir.
 */
export const RODADAS_DE_CORRECAO = 1;

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
      /** O guia da tela: o que dá para perguntar, quando nada casou (T-441). */
      readonly sugestoes: readonly string[];
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
 *
 * Porcentagem lê-se a cada R$ 100 e múltiplo para cada R$ 1,00. O modelo
 * recebe **só a base da unidade** do valor principal: com as duas na mão, o
 * gpt-4o escreveu "para cada R$ 1,00 investido, o retorno foi de R$ 11,1" de
 * um ROIC de 11,1% — número certo, escala errada, e o verificador não tem
 * como ver escala (2026-09-03).
 */
const BASE_DA_PORCENTAGEM = "R$ 100";
const BASE_DO_MULTIPLO = "R$ 1,00";
const BASES_DA_TRADUCAO: readonly string[] = [
  BASE_DA_PORCENTAGEM,
  BASE_DO_MULTIPLO,
];

function baseDaTraducao(unidade: Unidade): string | null {
  if (unidade === "pct") return BASE_DA_PORCENTAGEM;
  if (unidade === "vezes") return BASE_DO_MULTIPLO;
  return null;
}

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

/**
 * Como um número permitido pode aparecer no texto.
 *
 * `livre` é o valor principal, o apoio, uma taxa, um total, uma derivação
 * nossa: pode ser citado em qualquer frase. `com_rotulo` é um ponto de
 * série, de gráfico ou de ranking: só passa se um dos rótulos do ponto está
 * a até `RAIO_DO_ROTULO` caracteres do número — "em mar/2026, 5,2%". Sem o
 * rótulo, "5,2%" é um valor solto que pode ser de qualquer mês, e o
 * verificador não tem como saber se o modelo o atribuiu ao mês certo.
 */
type Permissao =
  | { readonly modo: "livre" }
  | { readonly modo: "com_rotulo"; readonly rotulos: readonly string[] };

const LIVRE: Permissao = { modo: "livre" };

/** Um número livre nunca é rebaixado por uma entrada posterior com rótulo. */
function permitir(
  permitidos: Map<string, Permissao>,
  n: NumeroPermitido,
): void {
  const atual = permitidos.get(n.texto);
  if (atual?.modo === "livre") return;
  if (n.rotulos === null) {
    permitidos.set(n.texto, LIVRE);
    return;
  }
  const rotulos = atual?.modo === "com_rotulo" ? atual.rotulos : [];
  permitidos.set(n.texto, {
    modo: "com_rotulo",
    rotulos: [...new Set([...rotulos, ...n.rotulos])],
  });
}

/**
 * A lista do que o texto pode citar, para a rodada de correção (T-433).
 *
 * Só as chaves do mapa: nada sai daqui que o envelope já não tenha levado.
 */
export function numerosPermitidosDe(
  r: Resolucao,
  pergunta: string,
): readonly string[] {
  return [...numerosPermitidos(r, pergunta).keys()];
}

/** Tudo que o texto pode citar sem inventar, e em que condição. */
function numerosPermitidos(
  r: Resolucao,
  pergunta: string,
): ReadonlyMap<string, Permissao> {
  const permitidos = new Map<string, Permissao>();
  for (const base of BASES_DA_TRADUCAO) permitidos.set(base, LIVRE);
  const guardar = (valor: number | null, unidade: Unidade) => {
    if (valor !== null) {
      permitidos.set(formatarValor(valor, unidade), LIVRE);
      const emReais = emReaisPorBase(valor, unidade);
      if (emReais !== null) permitidos.set(emReais, LIVRE);
    }
  };

  guardar(r.valor, r.unidade);
  for (const c of r.consideracoes) guardar(c.valor, c.unidade);
  for (const t of r.referencias) guardar(t.valor, "pct");
  // O mês que a pergunta nomeou é o número principal da resposta: livre.
  if (r.pontoPedido !== null)
    guardar(r.pontoPedido.valor, r.pontoPedido.unidade);
  // Os demais meses da série, só junto do rótulo, como todo ponto (RF-15).
  for (const ponto of r.serieMensal) {
    if (ponto.formatado !== null) {
      permitir(permitidos, {
        texto: ponto.formatado,
        rotulos: variantesDoRotulo(ponto.rotulo),
      });
    }
  }

  // O que veio escrito no material: repetir não é inventar.
  const material = [
    pergunta,
    r.rotulo,
    r.formula,
    r.decisao ?? "",
    ...r.consideracoes.map((c) => c.rotulo),
  ].join("\n");
  for (const m of material.match(COM_UNIDADE) ?? []) {
    permitidos.set(m.replace(/\s+/g, " ").trim(), LIVRE);
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

  // O gráfico que a resposta destaca: destaques e total livres, ponto só com
  // o rótulo por perto. E as leituras do laço, cada uma com a própria regra.
  if (r.painel !== null) {
    for (const n of numerosDoResumo(resumirPainel(r.painel))) {
      permitir(permitidos, n);
    }
  }
  for (const { leitura } of r.leituras) {
    for (const n of numerosDe(leitura)) permitir(permitidos, n);
  }
  return permitidos;
}

function semAcento(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Um dos rótulos está a até `RAIO_DO_ROTULO` caracteres do número? */
function rotuloPorPerto(
  texto: string,
  inicio: number,
  fim: number,
  rotulos: readonly string[],
): boolean {
  const trecho = semAcento(
    texto.slice(Math.max(0, inicio - RAIO_DO_ROTULO), fim + RAIO_DO_ROTULO),
  );
  return rotulos.some((rotulo) => rotulo !== "" && trecho.includes(rotulo));
}

/** O número passa: livre, ou com o rótulo por perto. */
function aceito(
  permissao: Permissao | undefined,
  texto: string,
  inicio: number,
  fim: number,
): boolean {
  if (permissao === undefined) return false;
  if (permissao.modo === "livre") return true;
  return rotuloPorPerto(texto, inicio, fim, permissao.rotulos);
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
    const inicio = casamento.index ?? 0;
    const fim = inicio + casamento[0].length;
    if (aceito(permitidos.get(citado), texto, inicio, fim)) continue;

    // Com sinal e fora do envelope: não há reescrita que salve.
    if (citado.startsWith("-") || citado.startsWith("+")) {
      erradas.push(citado);
      continue;
    }

    // "+2,7 p.p." dito como "2,7 p.p.": o mesmo número.
    if (aceito(permitidos.get(`+${citado}`), texto, inicio, fim)) continue;

    // "-R$ 2,3" dito como "perda de R$ 2,3": o mesmo número, se a palavra
    // que carrega o sinal estiver por perto.
    if (
      aceito(permitidos.get(`-${citado}`), texto, inicio, fim) &&
      sinalNegativoPorPerto(texto, inicio, fim)
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
/** O que o texto diz quando a parte composta da pergunta ficou sem resposta. */
export const AVISO_DE_DEGRADACAO =
  "A parte composta da pergunta não pôde ser respondida agora; segue a métrica principal.";

export function montarTexto(r: Resolucao, pergunta: string): string {
  const valor =
    r.valor === null
      ? "sem dado neste recorte"
      : formatarValor(r.valor, r.unidade);

  const linhas: string[] = [];
  if (r.caminho === "degradado") linhas.push(AVISO_DE_DEGRADACAO);
  // As leituras do laço vêm primeiro: são o que a pergunta composta pediu.
  for (const { leitura } of r.leituras) linhas.push(fraseDe(leitura));
  if (r.pontoPedido === null) {
    linhas.push(`${r.rotulo}: ${valor}.`);
  } else {
    // O mês perguntado abre; o recorte inteiro vem como contexto (T-439).
    const deOnde =
      r.pontoPedido.herdado === true ? ", como na pergunta anterior" : "";
    linhas.push(
      `${r.rotulo} em ${r.pontoPedido.rotulo}${deOnde}: ${r.pontoPedido.formatado ?? "sem dado"}.`,
    );
    linhas.push(`${r.rotulo} no recorte inteiro: ${valor}.`);
  }

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

/** Quantas perguntas seguintes uma resposta oferece, no máximo. */
export const MAXIMO_DE_SUGESTOES = 4;

/** Quantas delas vêm do apoio: as outras são de recorte. */
const SUGESTOES_DE_APOIO = 2;

/** "Lucro líquido" vira "lucro líquido"; "ROE" e "EBITDA" ficam como estão. */
function minusculaInicial(rotulo: string): string {
  const segunda = rotulo.charAt(1);
  if (segunda !== "" && segunda === segunda.toUpperCase()) return rotulo;
  return rotulo.charAt(0).toLowerCase() + rotulo.slice(1);
}

/**
 * As perguntas seguintes, escolhidas para levar adiante (seção 7.6).
 *
 * Duas famílias, e as duas **respondíveis por construção**:
 *
 * - **o apoio**: as métricas que explicaram o número ("E lucro líquido?"
 *   depois do ROE). São ids do catálogo, lidos no estágio 2 — e ainda assim
 *   cada frase passa pelo interpretador local antes de ir para a tela, e só
 *   entra se cair na métrica que a motivou;
 * - **o recorte**: o mesmo número noutro período e noutra entidade ("E só em
 *   dezembro?", "E na Unidade SP?"). Não citam métrica de propósito: é a regra
 *   de herança de `interpretar` quem as responde, e cada uma passa pelo
 *   mesmo crivo dela: troca um filtro e, tirado o recorte, não casa métrica
 *   nenhuma.
 *
 * A versão anterior oferecia "Como isso se compara com o ano anterior?" em
 * toda resposta. A fixture só tem 2026 (D-CHAT-perguntas-cfo), então o atalho
 * levava sempre a "sem dado" — uma sugestão que não leva a lugar nenhum.
 */
export function sugestoesApos(r: Resolucao): readonly string[] {
  const filtros = r.acoes.filtros;

  const deApoio = r.consideracoes
    .flatMap((c) =>
      c.origem === "apoio" && c.metrica !== null && c.metrica !== r.metrica
        ? [{ pergunta: `E ${minusculaInicial(c.rotulo)}?`, metrica: c.metrica }]
        : [],
    )
    .filter(({ pergunta, metrica }) => {
      const lida = interpretarLocalmente(pergunta, filtros);
      return (
        lida !== null &&
        lida.metrica === metrica &&
        lida.confianca >= CONFIANCA_MINIMA
      );
    })
    .map((x) => x.pergunta)
    .slice(0, SUGESTOES_DE_APOIO);

  const deRecorte = [
    filtros.periodo === "12-meses"
      ? `E só em ${rotuloDe("periodo", "dezembro").toLowerCase()}?`
      : `E nos ${rotuloDe("periodo", "12-meses")}?`,
    filtros.entidade === "consolidado"
      ? `E na ${rotuloDe("entidade", "unidade-sp")}?`
      : `E no ${rotuloDe("entidade", "consolidado").toLowerCase()}?`,
  ].filter(
    (p) =>
      mudaRecorte(p, filtros) &&
      interpretarLocalmente(semRecorte(p), filtros) === null,
  );

  return [...new Set([...deApoio, ...deRecorte])].slice(0, MAXIMO_DE_SUGESTOES);
}

/** A confiança de uma recusa do modelo: nenhuma, por definição. */
const SEM_CONFIANCA = 0;

/** A confiança de uma métrica herdada da conversa: é a mesma, por construção. */
const CONFIANCA_DA_HERANCA = 1;

/**
 * A regra de herança: continuação de conversa herda a métrica anterior.
 *
 * "E em dezembro?" depois de "qual o ROE?" pede o ROE em dezembro. Três
 * condições, todas determinísticas: houve uma resposta anterior com métrica; a
 * pergunta troca ao menos um filtro; e, tirado o recorte, o que sobra não
 * nomeia métrica nenhuma. A terceira é o que impede "e a margem em dezembro?"
 * de virar ROE — a pessoa nomeou outra métrica, e o chat pergunta qual.
 *
 * Devolve `null` quando não é continuação. Quem decide entre isto, o palpite
 * local e o do modelo é `interpretar`.
 */
function herdar(
  pergunta: string,
  atuais: Query,
  historico: readonly TurnoAnterior[],
): Intencao | null {
  const anterior = [...historico].reverse().find((t) => t.metrica !== null);
  if (anterior?.metrica === undefined || anterior.metrica === null) return null;
  /*
   * Continuação também quando a pergunta só troca o mês ("e em maio?") ou
   * pede o período inteiro ("e no ano todo?"): o calendário não é filtro da
   * URL, mas é recorte da conversa (T-443).
   */
  const trocaOMes = mesDaPergunta(pergunta) !== null;
  const pedeOAno = pedeOPeriodoInteiro(pergunta);
  if (!mudaRecorte(pergunta, atuais) && !trocaOMes && !pedeOAno) return null;
  if (interpretarLocalmente(semRecorte(semMes(pergunta)), atuais) !== null) {
    return null;
  }
  const filtros = filtrosDaPergunta(pergunta, atuais);
  return {
    metrica: anterior.metrica,
    filtros: pedeOAno ? { ...filtros, periodo: "12-meses" } : filtros,
    confianca: CONFIANCA_DA_HERANCA,
    alternativas: [],
  };
}

/** O palpite local quando é confiante; senão a herança; senão o que houver. */
function escolher(
  local: Intencao | null,
  herdada: Intencao | null,
): Intencao | null {
  if (local !== null && local.confianca >= CONFIANCA_MINIMA) return local;
  return herdada ?? local;
}

/**
 * O estágio 1, com o gateway quando há chave e com o catálogo quando não há.
 *
 * A conversa anterior entra pelos dois caminhos: o modelo a recebe junto da
 * pergunta, e o caminho local aplica a regra de `herdar`. Nos dois, ela só
 * decide quando a pergunta sozinha não decide.
 */
async function interpretar(
  pergunta: string,
  atuais: Query,
  historico: readonly TurnoAnterior[],
): Promise<Intencao | null> {
  const local = interpretarLocalmente(pergunta, atuais);
  const herdada = herdar(pergunta, atuais, historico);

  if (!gatewayConfigurado()) return escolher(local, herdada);

  const metricas = Object.entries(CATALOGO_GERADO).map(([id, m]) => ({
    id,
    rotulo: m.rotulo,
    sinonimos: m.sinonimos,
  }));
  const doModelo = await interpretarComGateway(pergunta, metricas, historico);

  // Gateway fora, chave recusada ou JSON malformado: o caminho local vale.
  if (doModelo === null) return escolher(local, herdada);

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
    if (herdada !== null) return herdada;
    return {
      metrica: "",
      filtros,
      confianca: SEM_CONFIANCA,
      alternativas: doModelo.alternativas,
    };
  }

  // O modelo escolheu sem convicção e a conversa diz de que métrica se fala:
  // a continuação vale mais que um palpite abaixo do limiar.
  if (doModelo.confianca < CONFIANCA_MINIMA && herdada !== null) return herdada;

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
 * filtros valem para tudo na tela ativa. `historico` são os turnos anteriores
 * da conversa, para "e em dezembro?" saber de que métrica se fala.
 */
export async function perguntar(
  pergunta: string,
  atuais: Query = QUERY_PADRAO,
  historico: readonly TurnoAnterior[] = [],
): Promise<Resposta> {
  const resolvida = await resolverPergunta(pergunta, atuais, historico);
  if (resolvida.tipo === "recusa") return resolvida;
  return redigirResposta(pergunta, resolvida.resolucao);
}

/**
 * O texto que o laço de ferramentas já escreveu, quando escreveu.
 *
 * A pergunta composta redige na mesma conversa em que lê; o estágio 3 não
 * chama o modelo de novo, só verifica. `autoria` diz de onde o texto veio.
 */
export type Redacao = {
  readonly texto: string;
  readonly autoria: Autoria;
};

/** O que os estágios 1 e 2 entregam: o número resolvido, ou a recusa. */
export type Resolvida =
  | {
      readonly tipo: "resolvida";
      readonly resolucao: Resolucao;
      readonly redacao?: Redacao;
    }
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
  atuaisOuContexto: Query | ContextoDaTela = QUERY_PADRAO,
  historico: readonly TurnoAnterior[] = [],
  eventos: EventosDoLaco = {},
): Promise<Resolvida> {
  const contexto = ehContexto(atuaisOuContexto)
    ? atuaisOuContexto
    : contextoDeQuery(atuaisOuContexto);
  const atuais = contexto.filtros;

  /*
   * Composta vai ao laço (D-CHAT-ferramentas). A classificação é nossa e
   * determinística: os sinais da pergunta, descontados os que estão no nome
   * da métrica que o interpretador local escolheu com confiança.
   */
  const { classe } = classificar(
    pergunta,
    interpretarLocalmente(pergunta, atuais),
  );
  /*
   * Uma continuação herdada ("e no ano todo?", "e em maio?") fica no caminho
   * da resposta anterior, ainda que carregue um sinal de série ou ranking:
   * "no ano todo" é sinal de série numa pergunta nova, e recorte numa
   * continuação (T-443). "E por área?" não herda — segue ao laço.
   */
  const continuacao = herdar(pergunta, atuais, historico);
  let degradada = false;
  if (classe === "composta" && continuacao === null) {
    const composta = await resolverComposta(
      pergunta,
      contexto,
      historico,
      undefined,
      eventos,
    );
    if (composta !== null) {
      if (composta.tipo === "recusa") {
        return {
          tipo: "recusa",
          texto: composta.texto,
          alternativas: composta.alternativas,
          sugestoes: sugestoesParaRecusa(contexto),
        };
      }
      return composta.texto === null
        ? { tipo: "resolvida", resolucao: composta.resolucao }
        : {
            tipo: "resolvida",
            resolucao: composta.resolucao,
            redacao: { texto: composta.texto, autoria: "modelo" },
          };
    }
    // O laço não concluiu: o caminho simples responde a métrica principal,
    // e o texto dirá que a parte composta ficou sem resposta.
    degradada = true;
    registrarIncidente({
      tipo: "laco_degradou",
      detalhe: { modelo: modeloEmUso("ferramentas") },
    });
  }

  const intencao = await interpretar(pergunta, atuais, historico);

  if (intencao === null || intencao.confianca < CONFIANCA_MINIMA) {
    /*
     * O laço na dúvida (T-436). Nada casou de primeira, mas a pergunta pode
     * ser sobre o dado com outras palavras — "quanto entrou de caixa em
     * março?", "quantos clientes novos?". Com gateway, o laço de ferramentas
     * busca no catálogo (`listar_metricas`) e lê antes de qualquer recusa; a
     * recusa útil continua sendo o que sai quando nem ele conclui.
     */
    // O interpretador do modelo disse que a pergunta não é sobre os dados
    // (métrica vazia e nenhuma próxima): o laço não tem o que buscar.
    const foraDosDados =
      intencao !== null &&
      intencao.metrica === "" &&
      intencao.alternativas.length === 0;
    if (
      !degradada &&
      !foraDosDados &&
      lacoNaDuvidaLigado(process.env) &&
      gatewayConfigurado()
    ) {
      const tentativa = await resolverComposta(
        pergunta,
        contexto,
        historico,
        undefined,
        eventos,
      );
      const concluiu = tentativa !== null && tentativa.tipo !== "recusa";
      registrarIncidente({
        tipo: "laco_na_duvida",
        detalhe: { modelo: modeloEmUso("ferramentas"), concluiu },
      });
      if (tentativa !== null && tentativa.tipo !== "recusa") {
        const resolucao = comOMesPedido(
          tentativa.resolucao,
          pergunta,
          historico,
        );
        return tentativa.texto === null
          ? { tipo: "resolvida", resolucao }
          : {
              tipo: "resolvida",
              resolucao,
              redacao: { texto: tentativa.texto, autoria: "modelo" },
            };
      }
    }

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
          ? "Não consigo responder a isso com os dados do painel. Posso responder perguntas sobre as métricas de RH e financeiro."
          : recusou
            ? "Não tenho essa métrica no catálogo. Estas são as mais próximas:"
            : "Não tenho certeza do que você quer saber. Estas são as métricas mais próximas:",
      alternativas,
      sugestoes: sugestoesParaRecusa(contexto),
    };
  }

  try {
    const resolucao = comOMesPedido(
      await resolver(intencao.metrica, intencao.filtros),
      pergunta,
      historico,
    );
    return {
      tipo: "resolvida",
      resolucao: degradada ? { ...resolucao, caminho: "degradado" } : resolucao,
    };
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
        sugestoes: sugestoesParaRecusa(contexto),
      };
    }
    throw erro;
  }
}

/**
 * O guia da tela, para a recusa dizer o que dá para perguntar (T-441). Sem
 * tela no contexto — a conversa em tela cheia sem tela nomeada —, nada.
 */
function sugestoesParaRecusa(contexto: ContextoDaTela): readonly string[] {
  return contexto.tela === null
    ? []
    : sugestoesDaTela(contexto.tela.replace(/^\//, ""));
}

/**
 * O laço na dúvida vale por padrão quando há gateway; `CHAT_LACO_NA_DUVIDA=0`
 * desliga, e a pergunta sem métrica recebe a recusa útil direto (T-436).
 */
export function lacoNaDuvidaLigado(
  ambiente: Record<string, string | undefined>,
): boolean {
  const valor = ambiente["CHAT_LACO_NA_DUVIDA"]?.trim().toLowerCase();
  return valor !== "0" && valor !== "nao" && valor !== "false";
}

/**
 * A resolução com o ponto do mês que a pergunta nomeou (T-439) — ou, quando
 * ela não nomeia mês nem período, o mês da resposta anterior da conversa
 * (T-443), marcado como herdado. Sem mês de lado nenhum, volta como veio.
 */
export function comOMesPedido(
  r: Resolucao,
  pergunta: string,
  historico: readonly TurnoAnterior[] = [],
): Resolucao {
  const proprio = mesDaPergunta(pergunta);
  const pedido = proprio ?? mesHerdado(pergunta, historico);
  if (pedido === null) return r;
  const ponto = pontoDoMes(r.serieMensal, pedido);
  if (ponto === null) return { ...r, pontoPedido: null };
  return {
    ...r,
    pontoPedido: proprio === null ? { ...ponto, herdado: true } : ponto,
  };
}

/**
 * O mês herdado da conversa: o da resposta imediatamente anterior, quando a
 * pergunta atual não nomeia mês nem período (T-443). "E a receita bruta?"
 * depois de "quanto faturamos em abril?" é sobre abril; "e no ano todo?" ou
 * "e em dezembro?" fecham o assunto do mês.
 */
export function mesHerdado(
  pergunta: string,
  historico: readonly TurnoAnterior[],
): MesPedido | null {
  const anterior = historico.at(-1);
  if (anterior?.mes === undefined || anterior.mes === null) return null;
  if (pedeOPeriodoInteiro(pergunta) || mencionaPeriodo(pergunta)) return null;
  return anterior.mes;
}

/**
 * A pergunta nomeia um período do vocabulário? `filtrosDaPergunta` lê o
 * período sobre uma base; lido sobre duas bases diferentes, o resultado só
 * coincide quando a própria pergunta o diz.
 */
function mencionaPeriodo(pergunta: string): boolean {
  const sobreDoze = filtrosDaPergunta(pergunta, {
    ...QUERY_PADRAO,
    periodo: "12-meses",
  }).periodo;
  const sobreSeis = filtrosDaPergunta(pergunta, {
    ...QUERY_PADRAO,
    periodo: "6-meses",
  }).periodo;
  return sobreDoze === sobreSeis;
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
  redacao?: Redacao,
  contexto?: ContextoDaTela,
): Promise<Resposta> {
  const montado = montarTexto(resolucao, pergunta);

  // O laço já escreveu: não há segunda ida ao modelo, só o verificador. Sem
  // laço nem gateway, o texto é o montado; com gateway, o modelo redige.
  const doModelo =
    redacao !== undefined
      ? redacao.texto
      : gatewayConfigurado()
        ? await redigirComGateway(pergunta, paraOModelo(resolucao, contexto))
        : null;

  let texto = montado;
  let autoria: Autoria =
    redacao === undefined && !gatewayConfigurado()
      ? "montado"
      : "gateway-indisponivel";

  if (doModelo !== null) {
    const erradas = divergencias(doModelo, resolucao, pergunta);
    if (erradas.length === 0) {
      texto = doModelo;
      autoria = redacao?.autoria ?? "modelo";
    } else {
      /*
       * Divergiu. RF-15 pede bloqueio, não correção silenciosa — e o bloqueio
       * continua: nada com número fora do envelope vai para a tela. O que
       * T-433 acrescenta é uma reescrita, com os números recusados e a lista
       * do que pode citar, conferida pelo mesmo verificador. Os dois
       * incidentes ficam registrados: a frequência continua medida.
       */
      registrarIncidente({
        tipo: "verificador_recusou",
        detalhe: {
          metrica: resolucao.metrica,
          caminho: resolucao.caminho,
          numerosRecusados: erradas.length,
          tentativa: 1,
        },
      });
      const reescrito = gatewayConfigurado()
        ? await corrigirComGateway(
            pergunta,
            paraOModelo(resolucao, contexto),
            doModelo,
            erradas,
            numerosPermitidosDe(resolucao, pergunta),
          )
        : null;
      const erradasDepois =
        reescrito === null
          ? null
          : divergencias(reescrito, resolucao, pergunta);
      if (reescrito !== null && erradasDepois?.length === 0) {
        texto = reescrito;
        autoria = "modelo-corrigido";
      } else {
        autoria = "modelo-recusado";
        registrarIncidente({
          tipo: "verificador_recusou",
          detalhe: {
            metrica: resolucao.metrica,
            caminho: resolucao.caminho,
            numerosRecusados: erradasDepois?.length ?? erradas.length,
            tentativa: RODADAS_DE_CORRECAO + 1,
            reescrito: reescrito !== null,
          },
        });
      }
    }
  }

  // O texto do modelo não sabe que a parte composta falhou; o aviso é nosso.
  if (
    resolucao.caminho === "degradado" &&
    !texto.startsWith(AVISO_DE_DEGRADACAO)
  ) {
    texto = `${AVISO_DE_DEGRADACAO} ${texto}`;
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
export function paraOModelo(r: Resolucao, contexto?: ContextoDaTela): unknown {
  const formatado = (valor: number | null, unidade: Unidade) =>
    valor === null ? null : formatarValor(valor, unidade);

  const grafico = r.painel === null ? null : resumirPainel(r.painel);

  return {
    tela:
      contexto === undefined || contexto.tela === null
        ? null
        : {
            rota: contexto.tela,
            titulo: contexto.tituloDaTela,
            filtros: rotularFiltros(contexto.filtros),
          },
    quemPergunta: contexto?.primeiroNome ?? null,
    grafico:
      grafico === null
        ? null
        : {
            painel: grafico.id,
            titulo: grafico.titulo,
            forma: grafico.forma,
            pontos: grafico.pontos.map((p) => ({
              rotulo: p.rotulo,
              valor: p.formatado,
            })),
            destaques: grafico.destaques.map((d) => ({
              tipo: d.tipo,
              rotulo: d.ponto.rotulo,
              valor: d.ponto.formatado,
            })),
            total: grafico.total?.formatado ?? null,
            truncado: grafico.truncado,
          },
    leituras: r.leituras.map((l) => paraOModeloLeitura(l.leitura)),
    metrica: r.rotulo,
    valor: { bruto: r.valor, formatado: formatado(r.valor, r.unidade) },
    /*
     * O mês que a pergunta nomeou, e a série mensal da própria métrica
     * (T-439). Só o formatado: o bruto ao lado é convite para arredondar de
     * outro jeito.
     */
    pontoPedido:
      r.pontoPedido === null
        ? null
        : {
            rotulo: r.pontoPedido.rotulo,
            valor: r.pontoPedido.formatado,
            herdado: r.pontoPedido.herdado === true,
          },
    serieMensal: r.serieMensal.map((ponto) => ({
      rotulo: ponto.rotulo,
      valor: ponto.formatado,
    })),
    periodo: rotuloDe("periodo", r.acoes.filtros.periodo),
    fechamento: formatarMesAno(r.asOf),
    leitura: r.familia,
    /*
     * A tradução em reais só faz sentido para métrica financeira — a que tem
     * família de leitura. Turnover de 12,1% "a cada R$ 100 de salário" era
     * número certo e frase sem sentido; sem família, o modelo traduz em
     * palavras, como a instrução manda.
     */
    traducao: {
      base: r.familia === null ? null : baseDaTraducao(r.unidade),
      emReais:
        r.valor === null || r.familia === null
          ? null
          : emReaisPorBase(r.valor, r.unidade),
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
