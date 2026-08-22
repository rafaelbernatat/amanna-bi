/**
 * O catálogo de métricas: esquema e carregador validado (T-112).
 *
 * Seção 9.4 do PRD: "um arquivo versionado, revisado por Controladoria e RH em
 * conjunto. É aqui que a divergência de definição entre áreas vira uma decisão
 * registrada em vez de um ajuste silencioso."
 *
 * ## Por que o carregador é implacável
 *
 * Uma métrica sem `formula` viola PR-3 — o número apareceria na tela sem saber
 * dizer de onde veio. Uma métrica sem `agg` deixa a agregação por conta de quem
 * lê, e é assim que um recorte de 3 meses soma percentuais (regra 4 da seção
 * 9.2). Uma métrica sem `sinonimos` é invisível para o chat: existe no catálogo
 * e nunca é encontrada, o que é pior que não existir, porque ninguém procura o
 * que acha que já tem.
 *
 * Nenhum desses campos tem padrão razoável. Aceitar a ausência seria escolher
 * um em silêncio.
 *
 * ## Por que quebra o *build*, e não o *runtime*
 *
 * Catálogo inválido em produção é tela que sobe e mente. Catálogo inválido na
 * build é uma mensagem de erro para quem está editando o arquivo, no momento em
 * que está editando. O mesmo carregador roda nos dois lugares; o que muda é
 * *quando* — e a conferência de build é o que garante que o runtime nunca veja
 * um catálogo que não passou.
 */

import type { Agregacao, Sentido, Unidade } from "@/semantica/contrato";
import { AGREGACOES, UNIDADES } from "@/semantica/contrato";

/* ------------------------------------------------------------------ *
 * O grão mínimo
 * ------------------------------------------------------------------ */

/**
 * O piso da seção 11: área × mês.
 *
 * Uma métrica pode declarar grão **mais grosso** (só `mes`, se não quebra por
 * área) — nunca mais fino. `[colaborador, dia]` é exatamente o que a seção 11
 * proíbe, e o catálogo é onde alguém tentaria declará-lo sem passar pela
 * fronteira de T-138.
 */
export const GRAO_MINIMO_EXIGIDO = ["area", "mes"] as const;

/** As dimensões que um grão pode citar. Fechada, como todo vocabulário. */
export const DIMENSOES_DE_GRAO = [
  "area",
  "mes",
  "entidade",
  "centro_custo",
  "faixa",
  "modalidade",
  "uf",
] as const;

export type DimensaoDeGrao = (typeof DIMENSOES_DE_GRAO)[number];

/* ------------------------------------------------------------------ *
 * A entrada
 * ------------------------------------------------------------------ */

/** Uma métrica do catálogo (seção 9.4). */
export type Metrica = {
  readonly id: string;
  readonly rotulo: string;
  /** A view da seção 10.1 de onde a métrica sai. */
  readonly fonte: string;
  /** Como o número é obtido. Princípio PR-3; sem padrão possível. */
  readonly formula: string;
  readonly unidade: Unidade;
  readonly agg: Agregacao;
  readonly sentido: Sentido;
  /** Meta acordada, quando existe. `null` é "não há meta", não "meta zero". */
  readonly meta: number | null;
  readonly grao_minimo: readonly DimensaoDeGrao[];
  /** Como as pessoas chamam a métrica. Sem isto, o chat não a encontra. */
  readonly sinonimos: readonly string[];
  /**
   * A decisão registrada, quando a definição foi discutida (seção 9.4).
   *
   * "O campo `decisao` é obrigatório em toda métrica cuja definição tenha sido
   * discutida. É o que impede que a discussão volte do zero em seis meses."
   */
  readonly decisao: string | null;
};

/* ------------------------------------------------------------------ *
 * Os erros
 * ------------------------------------------------------------------ */

export type ProblemaDoCatalogo = {
  readonly metrica: string;
  readonly campo: string;
  readonly problema: string;
};

export class CatalogoInvalido extends Error {
  constructor(readonly problemas: readonly ProblemaDoCatalogo[]) {
    super(
      `O catálogo de métricas não passou na conferência:\n` +
        problemas
          .map((p) => `  · ${p.metrica}.${p.campo}: ${p.problema}`)
          .join("\n") +
        "\n\nA seção 9.4 do PRD trata o catálogo como decisão registrada de " +
        "Controladoria e RH. Entrada incompleta é decisão que ninguém tomou.",
    );
    this.name = "CatalogoInvalido";
  }
}

/* ------------------------------------------------------------------ *
 * A validação
 * ------------------------------------------------------------------ */

/** Os campos sem os quais a entrada não existe. */
const OBRIGATORIOS = [
  "rotulo",
  "fonte",
  "formula",
  "unidade",
  "agg",
  "sentido",
  "grao_minimo",
  "sinonimos",
] as const;

const SENTIDOS: readonly Sentido[] = ["maior_melhor", "menor_melhor", "neutro"];

function texto(v: unknown): v is string {
  return typeof v === "string" && v.trim() !== "";
}

/**
 * Confere uma entrada e devolve **todos** os problemas dela.
 *
 * Todos, e não o primeiro: quem está escrevendo uma métrica nova erra três
 * campos, e descobrir um por rodada de build é o que faz alguém desistir de
 * manter o catálogo em dia.
 */
export function conferirEntrada(
  id: string,
  bruto: unknown,
): readonly ProblemaDoCatalogo[] {
  const p: ProblemaDoCatalogo[] = [];
  const erro = (campo: string, problema: string) =>
    p.push({ metrica: id, campo, problema });

  if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto)) {
    erro("(entrada)", "não é um mapa de campos");
    return p;
  }
  const e = bruto as Record<string, unknown>;

  for (const campo of OBRIGATORIOS) {
    if (e[campo] === undefined || e[campo] === null) {
      erro(campo, "ausente e sem padrão possível");
    }
  }

  if (e["rotulo"] !== undefined && !texto(e["rotulo"])) {
    erro("rotulo", "vazio");
  }
  if (e["fonte"] !== undefined && !texto(e["fonte"])) {
    erro("fonte", "vazia — precisa nomear a view da seção 10.1");
  }
  if (e["formula"] !== undefined && !texto(e["formula"])) {
    erro("formula", "vazia — todo número declara sua fórmula (PR-3)");
  }

  if (e["unidade"] !== undefined && !incluido(UNIDADES, e["unidade"])) {
    erro("unidade", `fora do enum: ${UNIDADES.join(", ")}`);
  }
  if (e["agg"] !== undefined && !incluido(AGREGACOES, e["agg"])) {
    erro("agg", `fora de {${AGREGACOES.join(", ")}}`);
  }
  if (e["sentido"] !== undefined && !incluido(SENTIDOS, e["sentido"])) {
    erro("sentido", `fora de {${SENTIDOS.join(", ")}}`);
  }

  /*
   * A guarda da regra 4 da seção 9.2, no catálogo.
   *
   * `pct` com `agg: sum` é o erro exato que T-104 torna impossível em
   * execução — mas T-104 só protege quem chama `agregar()`. Uma métrica
   * declarada assim no catálogo é a mesma falha uma camada acima, e aqui ela
   * é pega antes de existir consulta.
   */
  if ((e["unidade"] === "pct" || e["unidade"] === "pp") && e["agg"] === "sum") {
    erro(
      "agg",
      `'sum' com unidade '${String(e["unidade"])}' soma percentuais ao longo ` +
        "do período (seção 9.2 regra 4). Use 'ratio' ou 'last'.",
    );
  }

  conferirGrao(e["grao_minimo"], erro);

  const sin = e["sinonimos"];
  if (sin !== undefined) {
    if (!Array.isArray(sin) || sin.length === 0) {
      erro("sinonimos", "vazio — o chat não encontraria a métrica");
    } else if (!sin.every(texto)) {
      erro("sinonimos", "tem entrada vazia ou que não é texto");
    }
  }

  if (e["meta"] !== undefined && e["meta"] !== null) {
    if (typeof e["meta"] !== "number" || !Number.isFinite(e["meta"])) {
      erro("meta", "não é número");
    }
  }

  if (e["decisao"] !== undefined && e["decisao"] !== null) {
    if (!texto(e["decisao"])) erro("decisao", "presente mas vazia");
  }

  for (const chave of Object.keys(e)) {
    if (
      ![...OBRIGATORIOS, "meta", "decisao"].includes(
        chave as (typeof OBRIGATORIOS)[number],
      )
    ) {
      erro(chave, "campo desconhecido — o esquema é fechado");
    }
  }

  return p;
}

function incluido(lista: readonly string[], v: unknown): boolean {
  return typeof v === "string" && lista.includes(v);
}

function conferirGrao(
  bruto: unknown,
  erro: (campo: string, problema: string) => void,
): void {
  if (bruto === undefined || bruto === null) return;
  if (!Array.isArray(bruto) || bruto.length === 0) {
    erro("grao_minimo", "precisa ser uma lista não vazia de dimensões");
    return;
  }

  const desconhecidas = bruto.filter(
    (d) => !incluido(DIMENSOES_DE_GRAO, d),
  ) as unknown[];
  if (desconhecidas.length > 0) {
    // A mensagem nomeia o piso porque o erro típico é justamente pedir mais
    // fino — 'colaborador', 'cpf', 'dia' — e quem escreveu precisa saber que
    // não é digitação, é limite.
    erro(
      "grao_minimo",
      `dimensão fora do vocabulário: ${desconhecidas.map(String).join(", ")}. ` +
        `O piso é [${GRAO_MINIMO_EXIGIDO.join(", ")}] (seção 11).`,
    );
    return;
  }

  /*
   * Grão mais grosso é permitido; mais fino, não.
   *
   * Uma métrica que só existe mensal declara `[mes]`, e isso é legítimo. O que
   * o piso proíbe é descer abaixo de área × mês — e como o vocabulário já não
   * tem `colaborador`, a checagem acima é a que pega. Esta segunda existe para
   * o dia em que alguém acrescentar uma dimensão fina ao vocabulário sem
   * lembrar do piso.
   */
  const finas = bruto.filter(
    (d) =>
      typeof d === "string" &&
      !(DIMENSOES_DE_GRAO as readonly string[]).includes(d),
  );
  if (finas.length > 0) {
    erro("grao_minimo", `abaixo do piso área × mês: ${finas.join(", ")}`);
  }
}

/* ------------------------------------------------------------------ *
 * O carregador
 * ------------------------------------------------------------------ */

/**
 * Valida um catálogo inteiro já desserializado.
 *
 * Recebe o objeto, e não o texto YAML: quem lê arquivo é o carregador de
 * `ferramentas/catalogo`, e manter esta função sem I/O é o que permite testá-la
 * com uma entrada por vez.
 */
export function conferirCatalogo(
  bruto: unknown,
): readonly ProblemaDoCatalogo[] {
  if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto)) {
    return [
      {
        metrica: "(catálogo)",
        campo: "(raiz)",
        problema: "não é um mapa de id para métrica",
      },
    ];
  }
  const entradas = Object.entries(bruto as Record<string, unknown>);
  if (entradas.length === 0) {
    return [
      {
        metrica: "(catálogo)",
        campo: "(raiz)",
        problema: "está vazio — nenhuma métrica declarada",
      },
    ];
  }

  const problemas: ProblemaDoCatalogo[] = [];
  for (const [id, entrada] of entradas) {
    if (!/^[a-z][a-z0-9_]*$/.test(id)) {
      problemas.push({
        metrica: id,
        campo: "(id)",
        problema: "id fora do padrão minúsculo com sublinhado",
      });
    }
    problemas.push(...conferirEntrada(id, entrada));
  }
  return problemas;
}

/** Valida e devolve o catálogo tipado, ou lança com a lista inteira. */
export function carregarCatalogo(bruto: unknown): ReadonlyMap<string, Metrica> {
  const problemas = conferirCatalogo(bruto);
  if (problemas.length > 0) throw new CatalogoInvalido(problemas);

  const mapa = new Map<string, Metrica>();
  for (const [id, e] of Object.entries(bruto as Record<string, unknown>)) {
    const c = e as Record<string, unknown>;
    mapa.set(id, {
      id,
      rotulo: c["rotulo"] as string,
      fonte: c["fonte"] as string,
      formula: c["formula"] as string,
      unidade: c["unidade"] as Unidade,
      agg: c["agg"] as Agregacao,
      sentido: c["sentido"] as Sentido,
      meta: (c["meta"] as number | undefined) ?? null,
      grao_minimo: c["grao_minimo"] as readonly DimensaoDeGrao[],
      sinonimos: c["sinonimos"] as readonly string[],
      decisao: (c["decisao"] as string | undefined) ?? null,
    });
  }
  return mapa;
}
