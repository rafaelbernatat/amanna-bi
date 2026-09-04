/**
 * Onde a conversa mora no navegador (T-340 em parte).
 *
 * Um armazém externo ao React, lido por `useSyncExternalStore`. Existe por
 * duas razões que um `useState` não resolve ao mesmo tempo:
 *
 * 1. **Hidratação sem desencontro.** O servidor não sabe se há conversa
 *    guardada e desenha o botão fechado. No navegador, o React lê o
 *    instantâneo do servidor durante a hidratação (`lerConversaNoServidor`)
 *    e só depois o instantâneo real — que vem de `sessionStorage`. É o
 *    caminho que a biblioteca desenha para estado que só existe no cliente,
 *    sem `setState` dentro de efeito e sem HTML que não bate.
 * 2. **Uma fonte só.** Quem escreve aqui escreve também em `sessionStorage`,
 *    na mesma chamada. Não há efeito de sincronização que possa ficar para
 *    trás, nem cópia em memória que discorde da cópia guardada.
 *
 * Sem `sessionStorage` (janela privada, bloqueio de dados), a conversa vive
 * só em memória e morre com a página. Nada aqui lança.
 */

import {
  CHAVE_DE_ARMAZENAMENTO,
  CONVERSA_VAZIA,
  desserializar,
  serializar,
  type Conversa,
} from "@/apresentacao/chat/conversa";

let atual: Conversa | null = null;
const ouvintes = new Set<() => void>();

function armazenamento(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function lerGuardada(): Conversa {
  try {
    return (
      desserializar(armazenamento()?.getItem(CHAVE_DE_ARMAZENAMENTO) ?? null) ??
      CONVERSA_VAZIA
    );
  } catch {
    return CONVERSA_VAZIA;
  }
}

/**
 * O instantâneo no navegador. Lido de `sessionStorage` uma vez, na primeira
 * chamada; depois disso, a referência só muda quando alguém escreve — que é o
 * que `useSyncExternalStore` exige de um instantâneo.
 */
export function lerConversa(): Conversa {
  if (atual === null) atual = lerGuardada();
  return atual;
}

/** O instantâneo no servidor: nenhuma conversa, botão fechado. */
export function lerConversaNoServidor(): Conversa {
  return CONVERSA_VAZIA;
}

/** Aplica uma mudança, guarda e avisa quem está desenhando. */
export function escreverConversa(mudar: (c: Conversa) => Conversa): void {
  atual = mudar(lerConversa());
  try {
    armazenamento()?.setItem(CHAVE_DE_ARMAZENAMENTO, serializar(atual));
  } catch {
    // Só em memória, então.
  }
  for (const ouvinte of ouvintes) ouvinte();
}

export function assinarConversa(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** Só para teste: volta ao estado de antes da primeira leitura. */
export function esquecerConversa(): void {
  atual = null;
  ouvintes.clear();
}
