/**
 * Identidade, perfil e escopo de acesso (T-135).
 *
 * Seção 11 do PRD. O recorte por perfil é aplicado **no servidor**, nunca no
 * cliente: a `Query` é interceptada e restringida antes de chegar ao adaptador.
 * Este módulo declara os tipos que tornam isso obrigatório em vez de opcional.
 *
 * O erro que a modelagem existe para impedir: um `Profile` que é só uma string
 * e um escopo que é só uma lista. Com isso, esquecer de aplicar o escopo
 * compila, roda e passa em teste — e o painel serve dado de uma entidade que a
 * pessoa não podia ver, sem erro em lugar nenhum. Aqui o escopo é um tipo
 * distinto de `Query`, e ir de um ao outro **exige** passar pela restrição.
 *
 * Nada aqui lê ambiente, cabeçalho ou token. A identidade chega pronta; quem a
 * constrói é a camada de acesso (T-162 em diante). Manter este módulo puro é o
 * que permite testar o escopo sem levantar provedor de identidade.
 */

import type { Area, Entidade, Query } from "@/semantica/contrato";
import { AREAS, ENTIDADES } from "@/semantica/contrato";

/* ------------------------------------------------------------------ *
 * Os cinco perfis previstos (seção 11)
 * ------------------------------------------------------------------ */

/**
 * Enum fechado. Um perfil novo é decisão de negócio com consequência de acesso,
 * nunca uma string que apareceu num claim que ninguém revisou.
 */
export const PERFIS = [
  "diretoria",
  "controller",
  "rh",
  "area",
  "auditor",
] as const;

export type Perfil = (typeof PERFIS)[number];

/** Os três módulos do produto, como a seção 5 os nomeia. */
export const MODULOS_DO_PRODUTO = ["rh", "fin", "int"] as const;
export type ModuloDoProduto = (typeof MODULOS_DO_PRODUTO)[number];

/**
 * O que cada perfil enxerga por módulo, direto da tabela da seção 11.
 *
 * `area` e `auditor` não aparecem aqui como casos especiais de módulo: `area`
 * tem recorte fixo à sua área — restrição de dimensão, não de módulo — e
 * `auditor` lê tudo, mais a trilha de auditoria.
 */
const MODULOS_POR_PERFIL: Readonly<Record<Perfil, readonly ModuloDoProduto[]>> =
  {
    diretoria: ["rh", "fin", "int"],
    controller: ["fin", "int"],
    rh: ["rh", "int"],
    area: ["rh", "fin", "int"],
    auditor: ["rh", "fin", "int"],
  };

/** O perfil enxerga este módulo? */
export function perfilVeModulo(
  perfil: Perfil,
  modulo: ModuloDoProduto,
): boolean {
  return MODULOS_POR_PERFIL[perfil].includes(modulo);
}

/* ------------------------------------------------------------------ *
 * A sessão
 * ------------------------------------------------------------------ */

/**
 * Quem está perguntando.
 *
 * `entidades` e `areas` vêm do provedor de identidade e são o que a pessoa
 * pode ver — não o que ela pediu. A distinção entre os dois é o produto
 * inteiro da seção 11.
 */
export type Session = {
  /** Identificador estável da pessoa no provedor de identidade. */
  readonly sujeito: string;
  readonly perfil: Perfil;
  /** As entidades concedidas. Vazio é sessão sem acesso, não sessão livre. */
  readonly entidades: readonly Entidade[];
  /** As áreas concedidas. Vazio é sessão sem acesso, não sessão livre. */
  readonly areas: readonly Area[];
};

/* ------------------------------------------------------------------ *
 * O escopo
 * ------------------------------------------------------------------ */

/**
 * O que a sessão pode ver, derivado dos valores de `Query`.
 *
 * Tipo **distinto** de `Query` de propósito. Se escopo e consulta tivessem a
 * mesma forma, passar um no lugar do outro compilaria — e o dia em que alguém
 * passasse a `Query` crua ao adaptador seria um dia sem erro nenhum e com dado
 * vazando.
 */
export type AccessScope = {
  readonly perfil: Perfil;
  readonly entidades: readonly Entidade[];
  readonly areas: readonly Area[];
  readonly modulos: readonly ModuloDoProduto[];
};

/** A marca que diz "esta Query já passou pela restrição de escopo". */
declare const RESTRINGIDA: unique symbol;

/**
 * Uma `Query` que já foi restringida ao escopo.
 *
 * O adaptador aceita **só** este tipo. Como a marca é um símbolo declarado e
 * nunca exportado, o único jeito de obter um valor destes é chamar
 * `restringir()` — não existe literal, cast acidental nem objeto montado à mão
 * que satisfaça o tipo sem passar pela função.
 */
export type QueryRestrita = Query & { readonly [RESTRINGIDA]: true };

/** Por que uma consulta foi recusada. Enum fechado, como todo motivo. */
export const MOTIVOS_DE_RECUSA = [
  "entidade_fora_do_perfil",
  "area_fora_do_perfil",
  "modulo_fora_do_perfil",
  "sessao_sem_acesso",
] as const;

export type MotivoDeRecusa = (typeof MOTIVOS_DE_RECUSA)[number];

export class ForaDoEscopo extends Error {
  constructor(
    readonly motivo: MotivoDeRecusa,
    detalhe: string,
  ) {
    super(`Recorte fora do perfil (${motivo}): ${detalhe}`);
    this.name = "ForaDoEscopo";
  }
}

/* ------------------------------------------------------------------ *
 * Derivar escopo e restringir consulta
 * ------------------------------------------------------------------ */

/** O escopo de uma sessão. */
export function escopoDaSessao(sessao: Session): AccessScope {
  return {
    perfil: sessao.perfil,
    entidades: sessao.entidades,
    areas: sessao.areas,
    modulos: MODULOS_POR_PERFIL[sessao.perfil],
  };
}

/**
 * Restringe uma `Query` ao escopo, ou recusa.
 *
 * **Recusa, não silencia.** Trocar a entidade pedida pela primeira permitida
 * seria pior que o erro: a tela mostraria número de outro recorte com o
 * cabeçalho do recorte pedido, e ninguém teria como perceber. A seção 11 é
 * explícita para o chat ("um recorte fora do perfil é recusado no estágio 2"),
 * e a mesma regra vale para o painel.
 *
 * `'Todas'` em área é o único alargamento aceito, e mesmo ele é restrição: a
 * consulta passa a valer só pelas áreas concedidas, o que o adaptador lê em
 * `escopo.areas`.
 */
export function restringir(
  consulta: Query,
  escopo: AccessScope,
): QueryRestrita {
  if (escopo.entidades.length === 0 || escopo.areas.length === 0) {
    return recusar(
      "sessao_sem_acesso",
      "a sessão não tem entidade nem área concedida",
    );
  }

  if (!escopo.entidades.includes(consulta.entidade)) {
    return recusar(
      "entidade_fora_do_perfil",
      `pediu '${consulta.entidade}', concedidas: ${escopo.entidades.join(", ")}`,
    );
  }

  // 'Todas' não é uma área concedível: é o pedido de "todas as que eu puder".
  if (consulta.area !== "Todas" && !escopo.areas.includes(consulta.area)) {
    return recusar(
      "area_fora_do_perfil",
      `pediu '${consulta.area}', concedidas: ${escopo.areas.join(", ")}`,
    );
  }

  return consulta as QueryRestrita;
}

function recusar(motivo: MotivoDeRecusa, detalhe: string): never {
  throw new ForaDoEscopo(motivo, detalhe);
}

/** Restringe o acesso a um módulo, ou recusa (seção 11, tabela de perfis). */
export function exigirModulo(
  escopo: AccessScope,
  modulo: ModuloDoProduto,
): void {
  if (!escopo.modulos.includes(modulo)) {
    recusar(
      "modulo_fora_do_perfil",
      `perfil '${escopo.perfil}' não enxerga o módulo '${modulo}'`,
    );
  }
}

/* ------------------------------------------------------------------ *
 * Guardas de valor
 * ------------------------------------------------------------------ */

export function perfilValido(candidato: string): candidato is Perfil {
  return (PERFIS as readonly string[]).includes(candidato);
}

export function entidadeValida(candidata: string): candidata is Entidade {
  return (ENTIDADES as readonly string[]).includes(candidata);
}

export function areaValida(candidata: string): candidata is Area {
  return (AREAS as readonly string[]).includes(candidata);
}
