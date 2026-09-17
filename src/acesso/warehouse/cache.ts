/**
 * A base em memória, por processo, invalidada pela versão da carga.
 *
 * O adaptador lê as dezoito views uma vez por instância e por versão de carga
 * — não por requisição. Dentro do TTL, serve o que tem; passado o TTL, faz
 * **uma** consulta barata (a versão em `amanna.carga`) e só relê tudo se a
 * carga mudou. É o que mantém o produto a alguns milissegundos do banco sem
 * servir dado de uma carga antiga depois de uma nova.
 *
 * Duas leituras concorrentes compartilham a mesma promessa: um cold start com
 * treze telas em paralelo não dispara dezoito consultas treze vezes.
 */

import type { Base } from "@/acesso/calculo/base";

export type CacheDeBase = {
  obter(): Promise<Base>;
  /** Só para teste: esquece o que tem. */
  esquecer(): void;
};

export type OpcoesDoCache = {
  readonly ler: () => Promise<Base>;
  readonly versao: () => Promise<string>;
  readonly ttlMs: number;
  readonly agora?: () => number;
};

export function criarCacheDeBase(opcoes: OpcoesDoCache): CacheDeBase {
  const agora = opcoes.agora ?? (() => Date.now());
  let guardado: { base: Base; versao: string; lidoEm: number } | null = null;
  let emCurso: Promise<Base> | null = null;

  async function reler(): Promise<Base> {
    const [base, versao] = await Promise.all([opcoes.ler(), opcoes.versao()]);
    guardado = { base, versao, lidoEm: agora() };
    return base;
  }

  return {
    async obter() {
      if (emCurso !== null) return emCurso;
      if (guardado !== null) {
        if (agora() - guardado.lidoEm < opcoes.ttlMs) return guardado.base;
        const atual = await opcoes.versao();
        if (atual === guardado.versao) {
          guardado = { ...guardado, lidoEm: agora() };
          return guardado.base;
        }
      }
      emCurso = reler().finally(() => {
        emCurso = null;
      });
      return emCurso;
    },
    esquecer() {
      guardado = null;
      emCurso = null;
    },
  };
}
