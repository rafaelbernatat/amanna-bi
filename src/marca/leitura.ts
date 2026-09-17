/**
 * O caminho da tela até a marca, e da tela até gravá-la.
 *
 * Mesma ideia de `src/acesso/leitura.ts`: um lugar só monta a cadeia, e o que
 * a apresentação vê é uma função que devolve o que ela precisa desenhar.
 *
 * ## Por que a leitura é memorizada por requisição
 *
 * O layout raiz emite as variáveis de cor e o cabeçalho desenha o logo: dois
 * componentes, o mesmo dado, o mesmo passe de renderização. `cache` do React
 * memoriza dentro de **uma** requisição e não compartilha nada entre
 * requisições — que é exatamente o tempo de vida certo para uma configuração
 * que alguém pode ter acabado de trocar na aba ao lado.
 */

import { cache } from "react";

import { obterArmazemDaMarca, personalizacaoLigada } from "@/marca/armazem";
import {
  ESTADO_VAZIO,
  VERSAO_DA_MARCA,
  type EstadoDaMarca,
  type Marca,
  type Proposta,
} from "@/marca/documento";
import "@/marca/registrar";

/** O estado inteiro, uma vez por requisição. */
export const lerEstadoDaMarca = cache(async (): Promise<EstadoDaMarca> => {
  try {
    const armazem = await obterArmazemDaMarca();
    if (armazem === null) return ESTADO_VAZIO;
    return await armazem.ler();
  } catch {
    // Armazém mal configurado não derruba a tela: o produto abre no tema
    // padrão. Quem precisa saber que está mal configurado é o boot, e ele já
    // aborta lá — aqui a leitura é do caminho de desenho.
    return ESTADO_VAZIO;
  }
});

/** A marca em uso, ou `null` quando a tela deve abrir no tema padrão. */
export async function lerMarcaAtiva(): Promise<Marca | null> {
  return (await lerEstadoDaMarca()).aplicada;
}

/** A proposta pendente, quando há uma esperando decisão. */
export async function lerPropostaPendente(): Promise<Proposta | null> {
  return (await lerEstadoDaMarca()).proposta;
}

/** A personalização está ligada nesta instalação? */
export function marcaHabilitada(): boolean {
  return personalizacaoLigada();
}

/* ------------------------------------------------------------------ *
 * Escrita
 * ------------------------------------------------------------------ */

export class PersonalizacaoDesligada extends Error {
  constructor() {
    super(
      "A personalização visual não está habilitada nesta instalação: " +
        "MARCA_ARMAZEM não foi configurada. Sem armazém não há onde gravar, e " +
        "o produto diz isso em vez de aceitar e perder.",
    );
    this.name = "PersonalizacaoDesligada";
  }
}

async function exigirArmazem() {
  const armazem = await obterArmazemDaMarca();
  if (armazem === null) throw new PersonalizacaoDesligada();
  return armazem;
}

/** Guarda a proposta, preservando a marca em uso. */
export async function guardarProposta(proposta: Proposta): Promise<void> {
  const armazem = await exigirArmazem();
  const atual = await armazem.ler();
  await armazem.gravar({ ...atual, versao: VERSAO_DA_MARCA, proposta });
}

/** Descarta a proposta, preservando a marca em uso. */
export async function descartarProposta(): Promise<void> {
  const armazem = await exigirArmazem();
  const atual = await armazem.ler();
  await armazem.gravar({ ...atual, versao: VERSAO_DA_MARCA, proposta: null });
}

/** Aplica a marca e limpa a proposta, numa gravação só. */
export async function aplicarMarca(marca: Marca): Promise<void> {
  const armazem = await exigirArmazem();
  await armazem.gravar({
    versao: VERSAO_DA_MARCA,
    aplicada: marca,
    proposta: null,
  });
}

/** Volta ao tema padrão. */
export async function limparMarca(): Promise<void> {
  const armazem = await exigirArmazem();
  await armazem.limpar();
}
