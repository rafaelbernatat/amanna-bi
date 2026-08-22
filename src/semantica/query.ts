/**
 * Validação e canonização da Query (T-103).
 *
 * PRD seção 9.1 e 9.2 regra 5. Duas responsabilidades, e as duas são portão:
 *
 *   1. **Nada entra no adaptador sem passar por aqui.** Uma `Query` com valor
 *      fora do vocabulário da seção 6.2 é recusada antes de virar consulta —
 *      não adianta o tipo garantir em compilação se o recorte chega da URL,
 *      onde tudo é texto e qualquer pessoa pode digitar qualquer coisa.
 *   2. **A chave de cache é determinística.** Os mesmos filtros produzem a
 *      mesma string em qualquer ordem de chaves, e recortes distintos produzem
 *      chaves distintas. É o que sustenta a regra 5 — idempotência: a mesma
 *      `Query` devolve o mesmo resultado enquanto o *sync* não avançar.
 *
 * O ano é validado contra `getMeta`, não contra um union de literais (D-P8).
 */

import {
  AREAS,
  ENTIDADES,
  MODALIDADES,
  PERIODOS,
  type Area,
  type Entidade,
  type Modalidade,
  type Periodo,
  type Query,
} from "@/semantica/contrato";
import { anoEhDimensao, anoValido, type Dimensoes } from "@/semantica/recortes";

/** Por que a Query foi recusada. Enum fechado: vira mensagem de tela. */
export type MotivoDeRecusa =
  | "periodo_invalido"
  | "ano_invalido"
  | "entidade_invalida"
  | "area_invalida"
  | "modalidade_invalida"
  | "campo_ausente"
  | "campo_desconhecido";

export class QueryInvalida extends Error {
  readonly motivo: MotivoDeRecusa;
  readonly campo: string;
  readonly recebido: string;

  constructor(motivo: MotivoDeRecusa, campo: string, recebido: string) {
    super(
      `Query recusada (${motivo}): campo '${campo}' recebeu ${JSON.stringify(recebido)}.`,
    );
    this.name = "QueryInvalida";
    this.motivo = motivo;
    this.campo = campo;
    this.recebido = recebido;
  }
}

/** Os cinco campos do recorte, na ordem canônica da seção 6.2. */
const CAMPOS = ["periodo", "ano", "entidade", "area", "modalidade"] as const;

function exigirTexto(bruto: Record<string, unknown>, campo: string): string {
  const valor = bruto[campo];
  if (typeof valor !== "string" || valor === "") {
    throw new QueryInvalida("campo_ausente", campo, String(valor));
  }
  return valor;
}

function exigirDe<T extends string>(
  valor: string,
  dominio: readonly T[],
  campo: string,
  motivo: MotivoDeRecusa,
): T {
  if (!(dominio as readonly string[]).includes(valor)) {
    throw new QueryInvalida(motivo, campo, valor);
  }
  return valor as T;
}

/**
 * Valida um recorte vindo de fora — URL, chat, requisição forjada.
 *
 * Recusa em vez de corrigir. Cair no padrão em silêncio faria a tela mostrar um
 * recorte que ninguém pediu, e o princípio PR-4 existe justamente contra isso:
 * o estado é dito, não escondido. Quem quiser o padrão pede o padrão.
 */
export function validarQuery(bruto: unknown, dimensoes: Dimensoes): Query {
  if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto)) {
    throw new QueryInvalida("campo_ausente", "query", String(bruto));
  }
  const objeto = bruto as Record<string, unknown>;

  for (const chave of Object.keys(objeto)) {
    if (!(CAMPOS as readonly string[]).includes(chave)) {
      throw new QueryInvalida(
        "campo_desconhecido",
        chave,
        String(objeto[chave]),
      );
    }
  }

  const periodo: Periodo = exigirDe(
    exigirTexto(objeto, "periodo"),
    PERIODOS,
    "periodo",
    "periodo_invalido",
  );
  const entidade: Entidade = exigirDe(
    exigirTexto(objeto, "entidade"),
    ENTIDADES,
    "entidade",
    "entidade_invalida",
  );
  const area: Area = exigirDe(
    exigirTexto(objeto, "area"),
    AREAS,
    "area",
    "area_invalida",
  );
  const modalidade: Modalidade = exigirDe(
    exigirTexto(objeto, "modalidade"),
    MODALIDADES,
    "modalidade",
    "modalidade_invalida",
  );

  // O ano não tem domínio em código: vale o que getMeta declarou (D-P8).
  const ano = exigirTexto(objeto, "ano");
  if (anoEhDimensao(dimensoes) && !anoValido(dimensoes, ano)) {
    throw new QueryInvalida("ano_invalido", "ano", ano);
  }

  return { periodo, ano, entidade, area, modalidade };
}

/**
 * A chave de cache de um recorte.
 *
 * Monta a partir dos cinco campos **na ordem canônica**, não na ordem em que o
 * objeto foi escrito. `JSON.stringify` de um objeto preserva a ordem de
 * inserção, então usá-lo direto faria `{area, periodo}` e `{periodo, area}`
 * gerarem chaves diferentes para o mesmo recorte — e o cache erraria por
 * completo, servindo duas entradas onde deveria haver uma.
 *
 * O separador é o *unit separator*, U+001F, escrito como `String.fromCharCode(31)`
 * para nao virar um caractere invisivel no fonte — que ninguem enxerga ao editar
 * e qualquer um apaga sem perceber. Ele nao aparece em nenhum rotulo da secao
 * 6.2, entao nenhum valor pode forjar uma fronteira de campo e colidir com
 * outro recorte. Um teste percorre os quatro dominios e confirma isso.
 */
const SEPARADOR = String.fromCharCode(31); // unit separator (U+001F)

export function queryKey(q: Query): string {
  return CAMPOS.map((campo) => `${campo}=${q[campo]}`).join(SEPARADOR);
}

/** Reconstrói o recorte a partir da chave — o caminho de volta do cache. */
export function deQueryKey(chave: string, dimensoes: Dimensoes): Query {
  const bruto: Record<string, string> = {};
  for (const parte of chave.split(SEPARADOR)) {
    const igual = parte.indexOf("=");
    if (igual <= 0) {
      throw new QueryInvalida("campo_ausente", "chave", parte);
    }
    bruto[parte.slice(0, igual)] = parte.slice(igual + 1);
  }
  return validarQuery(bruto, dimensoes);
}
