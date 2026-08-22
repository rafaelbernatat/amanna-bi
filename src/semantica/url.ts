/**
 * O recorte na URL (T-127).
 *
 * Seção 6.6 do PRD: "filtros, tela e painel destacado vivem na URL. Colar a URL
 * reproduz a mesma tela para outra pessoa **com o mesmo perfil de acesso**."
 *
 * ## Por que aqui é tolerante, e a fronteira de dados não
 *
 * `validarQuery` (T-103) **recusa** valor fora do vocabulário. Aqui, valor fora
 * do vocabulário **cai no padrão e registra aviso**. Não é incoerência — são
 * dois lugares com origens de erro diferentes:
 *
 * | Fronteira | De onde vem o valor errado | Resposta certa |
 * |---|---|---|
 * | URL | link truncado no e-mail, favorito velho, alguém editou à mão | abrir a tela no padrão, avisando |
 * | camada de dados | código do produto | recusar: é bug, e esconder bug é pior |
 *
 * Devolver 500 para quem colou um link cortado pelo cliente de e-mail seria
 * transformar um aborrecimento em um chamado de suporte. E cair no padrão **em
 * silêncio** seria pior ainda: a pessoa leria "12 meses" achando que está vendo
 * "4º trimestre". Por isso todo desvio vira aviso, e a tela mostra que o
 * recorte pedido não existia.
 *
 * ## Por que apelido em vez do valor literal
 *
 * `?periodo=4%C2%BA+trimestre` é o que sai de codificar "4º trimestre". Uma URL
 * de recorte é colada em e-mail e em conversa; ela precisa continuar legível.
 * Os apelidos são **derivados** do próprio valor — minúscula, sem acento,
 * espaço vira hífen — e nunca escritos à mão. Tabela escrita à mão é tabela que
 * sai de sincronia no dia em que um valor novo entra no vocabulário.
 */

import type {
  Area,
  Entidade,
  Modalidade,
  Periodo,
  Query,
} from "@/semantica/contrato";
import {
  AREAS,
  ENTIDADES,
  MODALIDADES,
  PERIODOS,
  QUERY_PADRAO,
} from "@/semantica/contrato";

/* ------------------------------------------------------------------ *
 * Apelidos, derivados dos valores
 * ------------------------------------------------------------------ */

/**
 * O apelido de um valor de dimensão.
 *
 * "4º trimestre" vira "4-trimestre"; "12 meses" vira "12-meses". Mecânico de
 * propósito: um valor novo no vocabulário ganha apelido sozinho.
 */
export function apelidar(valor: string): string {
  return (
    valor
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      // Tudo que não for letra ou dígito vira hífen, e sequências colapsam numa só.
      // É o que cobre o ordinal de "4º trimestre": 'º' e o espaço viram um hífen
      // único, e sai "4-trimestre". (Uma versão anterior tinha uma linha extra
      // só para 'º' e 'ª'; removê-la não mudou nenhum apelido — era morta.)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  );
}

/** Índice apelido → valor, montado uma vez a partir do vocabulário. */
function indexar<T extends string>(
  valores: readonly T[],
): ReadonlyMap<string, T> {
  return new Map(valores.map((v) => [apelidar(v), v]));
}

const POR_APELIDO = {
  periodo: indexar(PERIODOS),
  entidade: indexar(ENTIDADES),
  area: indexar(AREAS),
  modalidade: indexar(MODALIDADES),
} as const;

/* ------------------------------------------------------------------ *
 * Query → URL
 * ------------------------------------------------------------------ */

/** Os nomes dos parâmetros, na ordem canônica. */
export const PARAMETROS = [
  "periodo",
  "ano",
  "entidade",
  "area",
  "modalidade",
] as const;

/**
 * A busca de uma Query.
 *
 * Campos iguais ao padrão da tabela 6.2 são **omitidos**. Um recorte
 * consolidado vira `/rh/visao` limpo, e não uma URL com cinco parâmetros que
 * não dizem nada. O round-trip continua exato porque quem lê preenche o que
 * falta com o mesmo padrão.
 *
 * A ordem é sempre a de `PARAMETROS`: duas pessoas que chegaram ao mesmo
 * recorte por caminhos diferentes compartilham a mesma URL, byte a byte.
 */
export function queryParaBusca(q: Query): URLSearchParams {
  const busca = new URLSearchParams();
  for (const campo of PARAMETROS) {
    const valor = q[campo];
    if (valor === QUERY_PADRAO[campo]) continue;
    // O ano não tem vocabulário fechado (D-P8): vai como está.
    busca.set(campo, campo === "ano" ? valor : apelidar(valor));
  }
  return busca;
}

/** A URL completa de uma tela com um recorte, e opcionalmente um destaque. */
export function rotaCom(
  tela: string,
  q: Query,
  painelDestacado?: string,
): string {
  const busca = queryParaBusca(q);
  if (painelDestacado !== undefined && painelDestacado !== "") {
    busca.set("painel", painelDestacado);
  }
  const sufixo = busca.toString();
  const caminho = tela.startsWith("/") ? tela : `/${tela}`;
  return sufixo === "" ? caminho : `${caminho}?${sufixo}`;
}

/* ------------------------------------------------------------------ *
 * URL → Query
 * ------------------------------------------------------------------ */

/** Um desvio entre o que a URL pedia e o que foi possível servir. */
export type AvisoDeUrl = {
  readonly campo: string;
  readonly pedido: string;
  readonly usado: string;
  readonly motivo: "fora_do_vocabulario" | "ano_indisponivel";
};

export type LeituraDaUrl = {
  readonly query: Query;
  /** Vazio quando a URL veio íntegra. Não vazio, a tela precisa dizer. */
  readonly avisos: readonly AvisoDeUrl[];
  /** O painel a destacar, quando a URL pedia um (seção 6.6). */
  readonly painelDestacado: string | null;
};

/**
 * Lê o recorte de uma busca de URL.
 *
 * Nunca lança. Um recorte impossível vira o padrão mais um aviso — e é a tela
 * que decide como contar isso (seção 6.4).
 *
 * `anosDisponiveis` vem de `getMeta` (D-P8). Quando não é passado, o ano é
 * aceito como veio: quem chama sem a lista ainda não sabe quais anos existem, e
 * inventar uma lista aqui seria a decisão que D-P8 tirou do código.
 */
export function buscaParaQuery(
  busca: URLSearchParams | string,
  anosDisponiveis?: readonly string[],
): LeituraDaUrl {
  const p = typeof busca === "string" ? new URLSearchParams(busca) : busca;
  const avisos: AvisoDeUrl[] = [];

  function resolver<T extends string>(
    campo: "periodo" | "entidade" | "area" | "modalidade",
    padrao: T,
  ): T {
    const bruto = p.get(campo);
    if (bruto === null || bruto === "") return padrao;
    const achado = POR_APELIDO[campo].get(bruto.toLowerCase()) as T | undefined;
    if (achado !== undefined) return achado;
    avisos.push({
      campo,
      pedido: bruto,
      usado: padrao,
      motivo: "fora_do_vocabulario",
    });
    return padrao;
  }

  const ano = resolverAno(p, anosDisponiveis, avisos);
  const painel = p.get("painel");

  return {
    query: {
      periodo: resolver<Periodo>("periodo", QUERY_PADRAO.periodo),
      ano,
      entidade: resolver<Entidade>("entidade", QUERY_PADRAO.entidade),
      area: resolver<Area>("area", QUERY_PADRAO.area),
      modalidade: resolver<Modalidade>("modalidade", QUERY_PADRAO.modalidade),
    },
    avisos,
    painelDestacado: painel === null || painel === "" ? null : painel,
  };
}

function resolverAno(
  p: URLSearchParams,
  disponiveis: readonly string[] | undefined,
  avisos: AvisoDeUrl[],
): string {
  const bruto = p.get("ano");
  if (bruto === null || bruto === "") {
    // Sem ano na URL: o padrão só vale se existir de fato. Se `getMeta` diz
    // que 2026 não foi carregado, cair nele mostraria uma tela vazia sem
    // explicar por quê — o ano mais recente é a leitura útil.
    if (disponiveis === undefined || disponiveis.includes(QUERY_PADRAO.ano)) {
      return QUERY_PADRAO.ano;
    }
    return maisRecente(disponiveis);
  }
  if (disponiveis === undefined || disponiveis.includes(bruto)) return bruto;

  const usado = maisRecente(disponiveis);
  avisos.push({
    campo: "ano",
    pedido: bruto,
    usado,
    motivo: "ano_indisponivel",
  });
  return usado;
}

function maisRecente(anos: readonly string[]): string {
  // Sem lista, o padrão: é o único valor que não depende de dado nenhum.
  return [...anos].sort().at(-1) ?? QUERY_PADRAO.ano;
}
