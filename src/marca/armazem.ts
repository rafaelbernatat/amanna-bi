/**
 * O armazém da marca: a primeira escrita de estado do produto (D-MARCA).
 *
 * Mesma forma das duas fábricas que já existem — `src/acesso/fabrica.ts` para
 * a fonte de dados e `src/acesso/sessao.ts` para o provedor de identidade —, e
 * pela mesma razão: uma variável de ambiente troca a implementação e nenhuma
 * tela muda. O registro é explícito para que a fábrica não importe as três
 * implementações; quem fala com a nuvem só entra no grafo de quem escolheu a
 * nuvem.
 *
 * ## A assimetria de erro é proposital
 *
 * `ler()` devolve `null` em qualquer falha; `gravar()` e `limpar()` lançam.
 *
 * Não é inconsistência. Armazém fora do ar não pode derrubar treze telas, e
 * "ainda não configuraram a marca" é um estado legítimo que se parece com
 * falha de leitura — nos dois casos a resposta certa é o tema padrão. Já
 * gravação que falha em silêncio é a mentira que este repositório mais evita:
 * a pessoa lê "aplicado", o colega não vê nada, e ninguém sabe por quê.
 */

import type { EstadoDaMarca } from "@/marca/documento";

export type ArmazemDaMarca = {
  /** O estado guardado. Estado vazio quando não há, ou quando falhou. */
  ler(): Promise<EstadoDaMarca>;
  /**
   * Grava o estado inteiro. Lança quando não deu.
   *
   * Marca aplicada e proposta pendente vão juntas, numa escrita só: separá-las
   * daria gravação rasgada — cor nova com proposta velha — e um "voltar ao
   * padrão" que precisa acertar dois lugares e pode acertar um.
   */
  gravar(estado: EstadoDaMarca): Promise<void>;
  /** Volta ao tema padrão. Lança pela mesma razão. */
  limpar(): Promise<void>;
};

/** Os modos aceitos. Enum fechado: um valor novo é decisão, não digitação. */
export const ARMAZENS = ["memoria", "arquivo", "blob"] as const;
export type ModoDeArmazem = (typeof ARMAZENS)[number];

export class ArmazemInvalido extends Error {
  constructor(motivo: string) {
    super(
      `MARCA_ARMAZEM: ${motivo}. Aceitos: ${ARMAZENS.join(", ")}. ` +
        "Sem armazém a personalização fica desligada, e isso é um estado " +
        "explícito — o produto diz que está desligada em vez de fingir que " +
        "gravou.",
    );
    this.name = "ArmazemInvalido";
  }
}

export class FalhaAoGravarMarca extends Error {
  constructor(motivo: string) {
    super(
      `Não foi possível gravar a marca: ${motivo}. Nada foi aplicado — a tela ` +
        "precisa dizer isso, porque gravação que falha em silêncio faz uma " +
        "pessoa ver a marca nova e o resto da diretoria continuar sem ela.",
    );
    this.name = "FalhaAoGravarMarca";
  }
}

/**
 * O modo configurado, ou `null` quando a personalização está desligada.
 *
 * Ausência é resposta, e não erro: uma instalação que não quer personalizar
 * nada não deve precisar declarar isso. O que **é** erro é um valor escrito
 * errado, que aborta o boot como qualquer outra variável mal preenchida.
 */
export function lerModoDeArmazem(
  ambiente: Record<string, string | undefined>,
): ModoDeArmazem | null {
  const bruto = ambiente["MARCA_ARMAZEM"];
  if (bruto === undefined || bruto === "") return null;
  if (!(ARMAZENS as readonly string[]).includes(bruto)) {
    throw new ArmazemInvalido(`'${bruto}' não é um modo válido`);
  }
  return bruto as ModoDeArmazem;
}

/** A personalização está ligada nesta instalação? */
export function personalizacaoLigada(
  ambiente: Record<string, string | undefined> = process.env,
): boolean {
  return lerModoDeArmazem(ambiente) !== null;
}

export type ConstrutorDeArmazem = (
  ambiente: Record<string, string | undefined>,
) => Promise<ArmazemDaMarca>;

const REGISTRO = new Map<ModoDeArmazem, ConstrutorDeArmazem>();

export function registrarArmazem(
  modo: ModoDeArmazem,
  construtor: ConstrutorDeArmazem,
): void {
  REGISTRO.set(modo, construtor);
}

/** Só para teste: devolve a fábrica ao estado limpo. */
export function limparArmazens(): void {
  REGISTRO.clear();
}

export function armazensRegistrados(): readonly ModoDeArmazem[] {
  return [...REGISTRO.keys()];
}

/**
 * O armazém desta instalação, ou `null` quando a personalização está desligada.
 */
export async function obterArmazemDaMarca(
  ambiente: Record<string, string | undefined> = process.env,
): Promise<ArmazemDaMarca | null> {
  const modo = lerModoDeArmazem(ambiente);
  if (modo === null) return null;

  const construtor = REGISTRO.get(modo);
  if (construtor === undefined) {
    throw new ArmazemInvalido(
      `'${modo}' é um modo válido, mas sem implementação registrada`,
    );
  }
  return construtor(ambiente);
}
