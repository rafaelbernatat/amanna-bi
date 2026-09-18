/**
 * O armazém de convidados: quem entrou pelo QR e se cadastrou
 * (D-CONVIDADO-cadastro, T-424).
 *
 * ## O passe é o aparelho; o cadastro é a pessoa
 *
 * A sessão de convite identifica um **celular** — `convite:<sala>:<dispositivo>`,
 * sem nome, de propósito (D-CONVITE). O cadastro é o que a pessoa informa
 * depois de entrar, e mora aqui, chaveado pela mesma sala e pelo mesmo
 * dispositivo. Nenhum cookie novo: quem tem o passe tem o cadastro, e o
 * servidor lê os dois na mesma requisição.
 *
 * ## O que este módulo guarda além do nome
 *
 * A cota de perguntas e o clique no convite da Dreamy. A cota é contada
 * **aqui**, no armazém, e não na memória do processo: na nuvem há mais de
 * uma instância, e cinco perguntas contadas em cada uma seriam quinze.
 *
 * ## Fora de `src/acesso`
 *
 * Como `src/marca`: é estado que o produto grava, e não dado do cliente. A
 * camada de acesso não escreve. O adaptador de Postgres recebe um
 * `ClientePostgres` e nunca importa o driver.
 */

import type { Cadastro } from "@/convidados/cadastro";
import type { OrigemDoInteresse } from "@/convidados/interesse";

/** O que identifica um convidado: a sala e o celular que entrou nela. */
export type ChaveDoConvidado = {
  readonly sala: string;
  readonly dispositivo: string;
};

/** O que a tela e a rota sabem de um convidado. O e-mail fica no armazém. */
export type Convidado = {
  readonly id: string;
  readonly nome: string;
  /** Quantas perguntas já foram admitidas. */
  readonly perguntas: number;
  /** Quando clicou no convite pela primeira vez, ou `null`. */
  readonly interesseEm: string | null;
};

export type NovoConvidado = ChaveDoConvidado &
  Cadastro & {
    /** Quando a sessão vence, em ISO: é até quando o cadastro vale. */
    readonly expiraEm: string;
  };

/** O resultado de pedir mais uma pergunta. */
export type AdmissaoDePergunta =
  /** Admitida; `perguntas` já conta esta. */
  | { readonly tipo: "admitida"; readonly convidado: Convidado }
  /** A cota acabou; nada foi contado. */
  | { readonly tipo: "esgotada"; readonly convidado: Convidado }
  /** Ninguém se cadastrou com esta chave. */
  | { readonly tipo: "sem_cadastro" };

export type ArmazemDeConvidados = {
  /**
   * Grava ou atualiza o cadastro da chave. Idempotente por chave: o mesmo
   * celular que se cadastra de novo mantém o id e a cota, e troca nome e
   * e-mail. Lança `FalhaNoCadastro` quando o armazém não consegue gravar.
   */
  registrar(novo: NovoConvidado): Promise<Convidado>;
  /** O cadastro da chave, ou `null` — inclusive quando a tabela não existe. */
  ler(chave: ChaveDoConvidado): Promise<Convidado | null>;
  /**
   * Conta mais uma pergunta se ainda houver cota. Uma operação só, atômica
   * entre instâncias: duas perguntas simultâneas nunca contam a mesma vaga.
   */
  admitirPergunta(
    chave: ChaveDoConvidado,
    limite: number,
  ): Promise<AdmissaoDePergunta>;
  /** Registra o clique no convite. Id desconhecido é silêncio, não erro. */
  registrarInteresse(id: string, origem: OrigemDoInteresse): Promise<void>;
};

/**
 * O armazém não conseguiu gravar.
 *
 * Só o nome e o código do erro: a mensagem do driver pode carregar o texto da
 * consulta, e o texto da consulta carrega o cadastro.
 */
export class FalhaNoCadastro extends Error {
  constructor(readonly motivo: string) {
    super(`Não foi possível gravar o cadastro: ${motivo}.`);
    this.name = "FalhaNoCadastro";
  }
}

/* ------------------------------------------------------------------ *
 * A fábrica
 * ------------------------------------------------------------------ */

export const MODOS_DE_ARMAZEM = ["memoria", "postgres"] as const;
export type ModoDeArmazem = (typeof MODOS_DE_ARMAZEM)[number];

/**
 * Postgres quando há banco, memória quando não há.
 *
 * Não há variável própria de propósito: a lista de convidados vai para onde
 * o banco está. Um ambiente com `DATABASE_URL` e fixtures — um Preview — ainda
 * grava no banco, que é o que se quer de um cadastro. O arnês de ponta a
 * ponta zera a variável para ficar em memória.
 */
export function modoDoArmazemDeConvidados(
  ambiente: Record<string, string | undefined> = process.env,
): ModoDeArmazem {
  const url = ambiente["DATABASE_URL"];
  return url === undefined || url.trim() === "" ? "memoria" : "postgres";
}

export type ConstrutorDeArmazem = (
  ambiente: Record<string, string | undefined>,
) => Promise<ArmazemDeConvidados>;

const REGISTRO = new Map<ModoDeArmazem, ConstrutorDeArmazem>();

export function registrarArmazemDeConvidados(
  modo: ModoDeArmazem,
  construtor: ConstrutorDeArmazem,
): void {
  REGISTRO.set(modo, construtor);
}

/** Só para teste: devolve a fábrica ao estado limpo. */
export function limparArmazensDeConvidados(): void {
  REGISTRO.clear();
}

export function armazensDeConvidadosRegistrados(): readonly ModoDeArmazem[] {
  return [...REGISTRO.keys()];
}

export class ArmazemDeConvidadosInvalido extends Error {
  constructor(modo: string) {
    super(
      `'${modo}' é um modo válido de armazém, mas sem implementação registrada.`,
    );
    this.name = "ArmazemDeConvidadosInvalido";
  }
}

/** O armazém desta instalação. */
export async function obterArmazemDeConvidados(
  ambiente: Record<string, string | undefined> = process.env,
): Promise<ArmazemDeConvidados> {
  const modo = modoDoArmazemDeConvidados(ambiente);
  const construtor = REGISTRO.get(modo);
  if (construtor === undefined) throw new ArmazemDeConvidadosInvalido(modo);
  return construtor(ambiente);
}
