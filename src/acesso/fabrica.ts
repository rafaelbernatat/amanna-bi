/**
 * A fábrica de fonte de dados (T-106).
 *
 * PRD seção 8.3 e RF-20: uma variável de ambiente troca a implementação, e
 * **nenhuma tela muda**. É a peça que faz o princípio PR-1 ser verificável em
 * vez de aspiracional — a suíte de contrato roda idêntica nos dois modos, e é
 * isso que prova que demonstração e produção não divergem.
 *
 * A fronteira que este módulo cria: `pg`, o SDK da Anthropic e qualquer
 * implementação concreta só podem ser importados aqui dentro. Um teste de
 * arquitetura reprova o contrário. Sem essa regra, um painel acaba importando
 * o driver do Postgres "só para um caso", e o adaptador deixa de ser
 * substituível sem que ninguém perceba.
 */

import type { DataSource } from "@/semantica/contrato";

/** Os modos aceitos. Enum fechado: um valor novo é decisão, não digitação. */
export const FONTES = ["fixtures", "warehouse"] as const;
export type Fonte = (typeof FONTES)[number];

export class FonteInvalida extends Error {
  constructor(recebido: string) {
    super(
      `DATA_SOURCE='${recebido}' não é um modo válido. Aceitos: ${FONTES.join(", ")}. ` +
        "O boot para aqui de propósito: subir com fonte indefinida serviria dado " +
        "de origem desconhecida sem ninguém perceber.",
    );
    this.name = "FonteInvalida";
  }
}

/**
 * Lê e valida `DATA_SOURCE`.
 *
 * Aborta no boot quando o valor é inválido, nomeando os aceitos. Cair num
 * padrão em silêncio é pior que não subir: a tela mostraria número de uma fonte
 * que ninguém escolheu.
 */
export function lerFonte(ambiente: Record<string, string | undefined>): Fonte {
  const bruto = ambiente["DATA_SOURCE"];
  if (bruto === undefined || bruto === "") {
    throw new FonteInvalida(String(bruto));
  }
  if (!(FONTES as readonly string[]).includes(bruto)) {
    throw new FonteInvalida(bruto);
  }
  return bruto as Fonte;
}

/** Construtor de uma implementação concreta, registrado na fábrica. */
export type ConstrutorDeFonte = () => Promise<DataSource>;

const REGISTRO = new Map<Fonte, ConstrutorDeFonte>();

/**
 * Registra a implementação de um modo.
 *
 * O registro é explícito para que a fábrica não precise importar as duas
 * implementações — o adaptador de warehouse traz `pg` junto, e carregá-lo no
 * modo `fixtures` colocaria o driver do banco no grafo de uma demonstração.
 */
export function registrarFonte(
  fonte: Fonte,
  construtor: ConstrutorDeFonte,
): void {
  REGISTRO.set(fonte, construtor);
}

/** Só para teste: devolve a fábrica ao estado limpo. */
export function limparRegistro(): void {
  REGISTRO.clear();
}

/** Quais modos já têm implementação registrada. */
export function fontesRegistradas(): readonly Fonte[] {
  return [...REGISTRO.keys()];
}

/**
 * A única forma de obter um `DataSource` no produto.
 *
 * Nenhum arquivo de apresentação constrói adaptador. Ele pede aqui, recebe a
 * interface, e não sabe — nem pode saber — se por trás está uma fixture ou o
 * Postgres.
 */
export async function obterFonteDeDados(
  ambiente: Record<string, string | undefined> = process.env,
): Promise<DataSource> {
  const fonte = lerFonte(ambiente);
  const construtor = REGISTRO.get(fonte);
  if (construtor === undefined) {
    throw new FonteInvalida(
      `${fonte} (modo válido, mas sem implementação registrada)`,
    );
  }
  return construtor();
}
