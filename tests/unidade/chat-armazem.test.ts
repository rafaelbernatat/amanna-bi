import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  assinarConversa,
  escreverConversa,
  esquecerConversa,
  lerConversa,
  lerConversaNoServidor,
} from "@/apresentacao/chat/armazem";
import {
  CHAVE_DE_ARMAZENAMENTO,
  CONVERSA_VAZIA,
  serializar,
  type Conversa,
} from "@/apresentacao/chat/conversa";

/**
 * O armazém da conversa, com um `sessionStorage` de mentira.
 *
 * O que se prova: a primeira leitura vem do que está guardado; escrever
 * guarda e avisa; o instantâneo do servidor é sempre a conversa vazia; e sem
 * armazenamento nenhum nada lança.
 */

class Memoria implements Pick<Storage, "getItem" | "setItem"> {
  readonly dados = new Map<string, string>();
  getItem(chave: string): string | null {
    return this.dados.get(chave) ?? null;
  }
  setItem(chave: string, valor: string): void {
    this.dados.set(chave, valor);
  }
}

const ABERTA: Conversa = { aberto: true, turnos: [] };

let memoria: Memoria;

beforeEach(() => {
  memoria = new Memoria();
  Object.defineProperty(globalThis, "window", {
    value: { sessionStorage: memoria },
    configurable: true,
    writable: true,
  });
  esquecerConversa();
});

afterEach(() => {
  esquecerConversa();
  delete (globalThis as { window?: unknown }).window;
});

describe("o armazém da conversa", () => {
  it("a primeira leitura vem do que está guardado", () => {
    memoria.setItem(CHAVE_DE_ARMAZENAMENTO, serializar(ABERTA));
    expect(lerConversa()).toEqual(ABERTA);
  });

  it("sem nada guardado, é a conversa vazia", () => {
    expect(lerConversa()).toEqual(CONVERSA_VAZIA);
  });

  it("o instantâneo do servidor é sempre a conversa vazia", () => {
    memoria.setItem(CHAVE_DE_ARMAZENAMENTO, serializar(ABERTA));
    expect(lerConversaNoServidor()).toEqual(CONVERSA_VAZIA);
  });

  it("a referência só muda quando alguém escreve", () => {
    const primeira = lerConversa();
    expect(lerConversa()).toBe(primeira);
    escreverConversa((c) => ({ ...c, aberto: true }));
    expect(lerConversa()).not.toBe(primeira);
  });

  it("escrever guarda e avisa quem assinou", () => {
    let avisos = 0;
    const cancelar = assinarConversa(() => {
      avisos += 1;
    });

    escreverConversa((c) => ({ ...c, aberto: true }));
    expect(avisos).toBe(1);
    expect(memoria.getItem(CHAVE_DE_ARMAZENAMENTO)).toBe(serializar(ABERTA));

    cancelar();
    escreverConversa((c) => ({ ...c, aberto: false }));
    expect(avisos).toBe(1);
  });

  it("sem armazenamento, a conversa vive em memória e nada lança", () => {
    Object.defineProperty(globalThis, "window", {
      value: {
        get sessionStorage(): Storage {
          throw new Error("bloqueado");
        },
      },
      configurable: true,
      writable: true,
    });
    esquecerConversa();

    expect(lerConversa()).toEqual(CONVERSA_VAZIA);
    expect(() => {
      escreverConversa((c) => ({ ...c, aberto: true }));
    }).not.toThrow();
    expect(lerConversa().aberto).toBe(true);
  });
});
