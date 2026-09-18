/**
 * O armazém de convidados em memória: o arnês, e a demonstração local.
 *
 * Não persiste, e é o que o arnês de ponta a ponta quer: cada subida começa
 * sem convidados. Na nuvem seria o pior dos mundos — cada instância contaria
 * a própria cota —, e por isso a fábrica só escolhe este modo quando não há
 * `DATABASE_URL`.
 *
 * O estado mora no escopo global do processo pela mesma razão do armazém de
 * marca: a rota que grava e a página que lê são pedaços diferentes do mesmo
 * servidor, e uma variável de módulo daria um estado por pedaço.
 */

import type {
  ArmazemDeConvidados,
  ChaveDoConvidado,
  Convidado,
} from "@/convidados/armazem";
import type { OrigemDoInteresse } from "@/convidados/interesse";

type Linha = {
  id: string;
  nome: string;
  email: string;
  expiraEm: string;
  perguntas: number;
  interesseEm: string | null;
  interesseOrigem: OrigemDoInteresse | null;
  cliquesDeInteresse: number;
};

const CHAVE = Symbol.for("amanna-bi.convidados.memoria");
type Portador = { [CHAVE]?: Map<string, Linha> };

function tabela(): Map<string, Linha> {
  const portador = globalThis as unknown as Portador;
  portador[CHAVE] ??= new Map();
  return portador[CHAVE];
}

function chaveDe(chave: ChaveDoConvidado): string {
  return `${chave.sala}|${chave.dispositivo}`;
}

function convidadoDe(linha: Linha): Convidado {
  return {
    id: linha.id,
    nome: linha.nome,
    perguntas: linha.perguntas,
    interesseEm: linha.interesseEm,
  };
}

export function criarArmazemDeConvidadosEmMemoria(): ArmazemDeConvidados {
  return {
    registrar: async (novo) => {
      const atual = tabela().get(chaveDe(novo));
      const linha: Linha = {
        id: atual?.id ?? crypto.randomUUID(),
        nome: novo.nome,
        email: novo.email,
        expiraEm: novo.expiraEm,
        perguntas: atual?.perguntas ?? 0,
        interesseEm: atual?.interesseEm ?? null,
        interesseOrigem: atual?.interesseOrigem ?? null,
        cliquesDeInteresse: atual?.cliquesDeInteresse ?? 0,
      };
      tabela().set(chaveDe(novo), linha);
      return convidadoDe(linha);
    },

    ler: async (chave) => {
      const linha = tabela().get(chaveDe(chave));
      return linha === undefined ? null : convidadoDe(linha);
    },

    admitirPergunta: async (chave, limite) => {
      const linha = tabela().get(chaveDe(chave));
      if (linha === undefined) return { tipo: "sem_cadastro" };
      if (linha.perguntas >= limite) {
        return { tipo: "esgotada", convidado: convidadoDe(linha) };
      }
      linha.perguntas += 1;
      return { tipo: "admitida", convidado: convidadoDe(linha) };
    },

    registrarInteresse: async (id, origem) => {
      for (const linha of tabela().values()) {
        if (linha.id !== id) continue;
        linha.interesseEm ??= new Date().toISOString();
        linha.interesseOrigem ??= origem;
        linha.cliquesDeInteresse += 1;
        return;
      }
    },
  };
}

/** Só para teste: devolve o estado do processo ao começo. */
export function esquecerConvidadosEmMemoria(): void {
  delete (globalThis as unknown as Portador)[CHAVE];
}

/** Só para teste: o que está gravado, inclusive o que a tela nunca vê. */
export function convidadosEmMemoria(): readonly Readonly<Linha>[] {
  return [...tabela().values()];
}
