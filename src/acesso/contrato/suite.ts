/**
 * O arnês da suíte de contrato (T-121).
 *
 * A seção 10.4 do PRD chama esta suíte de "onde o projeto dá certo ou errado", e
 * a razão é o RF-21: **os mesmos testes passam em fixtures e no warehouse**. É
 * aqui que aparecem as divergências de definição — turnover que conta
 * transferência interna, folha que inclui rescisão — e cada uma vira uma linha
 * `decisao:` no catálogo.
 *
 * Por isso o arnês é agnóstico de fonte. Ele recebe um `DataSource`, percorre a
 * matriz canônica de recortes e aplica as regras registradas. Trocar
 * `--source=fixtures` por `--source=warehouse` não muda nem o arquivo de casos
 * nem as regras: muda só quem responde.
 *
 * ## O que este arquivo não tem
 *
 * **Regras.** Elas chegam por registro: a regra 1 (reconciliação KPI × painel)
 * é T-122, e as regras 2 a 5 são T-159. Um arnês que trouxesse as próprias
 * regras junto tornaria impossível dizer qual tarefa entregou o quê — e, pior,
 * faria a suíte crescer sem que ninguém decidisse o que ela verifica.
 *
 * **Tolerância própria.** Vem de `src/semantica/tolerancia.ts`, onde o critério
 * está escrito. Duas tolerâncias divergiriam, e a mais frouxa venceria.
 *
 * ## Por que mora em `src/acesso/`
 *
 * Porque as regras chamam as quatro portas, e uma guarda de arquitetura reserva
 * essa chamada a esta camada — a mesma regra que impede uma tela de falar com o
 * adaptador. O comando em `ferramentas/` é só a casca: lê os argumentos, monta
 * a fonte e imprime o relatório.
 *
 * ## Suíte sem regra não passa: recusa
 *
 * Rodar zero regras sobre 768 recortes devolve zero falhas, e zero falhas se
 * parece muito com sucesso. O arnês recusa — verde que não verificou nada é
 * pior que vermelho, porque ninguém vai investigar.
 */

import type { DataSource, Query, Unidade } from "@/semantica/contrato";
import type { Recorte } from "@/semantica/recortes";
import { dentroDaTolerancia } from "@/semantica/tolerancia";

/* ------------------------------------------------------------------ *
 * O que uma regra é
 * ------------------------------------------------------------------ */

/**
 * Uma falha: o que quebrou, onde, e por qual regra.
 *
 * Os três campos do aceite — painel × recorte × regra — são obrigatórios, e não
 * por formalismo: um relatório que diz "reconciliação falhou" manda quem
 * investiga reproduzir 768 recortes à mão.
 */
export type Falha = {
  /** O painel, o KPI ou a métrica que falhou. */
  readonly assunto: string;
  readonly recorte: Recorte;
  /** O número da regra da seção 9.2. */
  readonly regra: number;
  readonly mensagem: string;
  /** Os dois números que deveriam concordar, quando a regra os compara. */
  readonly esperado?: number | null;
  readonly obtido?: number | null;
};

/** O que uma regra recebe para decidir. */
export type Contexto = {
  readonly fonte: DataSource;
  readonly recorte: Recorte;
  readonly consulta: Query;
};

/** Uma regra da seção 9.2, pronta para rodar num recorte. */
export type Regra = {
  readonly numero: number;
  readonly nome: string;
  /**
   * Roda num recorte e devolve as falhas encontradas — vazio quando passa.
   *
   * Devolve lista em vez de lançar porque uma regra que para no primeiro
   * problema esconde os outros 767, e quem investiga precisa ver o padrão:
   * "falha em toda área menos consolidado" é um diagnóstico; "falha" não é.
   */
  readonly rodar: (ctx: Contexto) => Promise<readonly Falha[]>;
};

/** A suíte não tem o que rodar. Ver o cabeçalho. */
export class SuiteSemRegra extends Error {
  constructor() {
    super(
      "A suíte de contrato não tem regra registrada. Rodar zero regras sobre " +
        "768 recortes devolve zero falhas, e zero falhas se parece com sucesso. " +
        "A regra 1 é entregue por T-122; as regras 2 a 5, por T-159.",
    );
    this.name = "SuiteSemRegra";
  }
}

/* ------------------------------------------------------------------ *
 * O registro
 * ------------------------------------------------------------------ */

const REGISTRO = new Map<number, Regra>();

/** Registra uma regra. Duas com o mesmo número é erro de quem registra. */
export function registrarRegra(regra: Regra): void {
  if (REGISTRO.has(regra.numero)) {
    throw new Error(
      `A regra ${String(regra.numero)} já está registrada como ` +
        `'${REGISTRO.get(regra.numero)?.nome ?? ""}'. Duas implementações da ` +
        "mesma regra divergem, e a que rodar segundo nunca é executada.",
    );
  }
  REGISTRO.set(regra.numero, regra);
}

/** Esquece tudo. Só para teste — o produto registra uma vez e roda. */
export function limparRegras(): void {
  REGISTRO.clear();
}

/** As regras registradas, na ordem da seção 9.2. */
export function regrasRegistradas(): readonly Regra[] {
  return [...REGISTRO.values()].sort((a, b) => a.numero - b.numero);
}

/* ------------------------------------------------------------------ *
 * A execução
 * ------------------------------------------------------------------ */

/** O que a suíte devolve. */
export type Relatorio = {
  readonly fonte: string;
  readonly recortes: number;
  readonly regras: readonly number[];
  readonly falhas: readonly Falha[];
  /** Quantas verificações rodaram. Zero aqui é suíte que não verificou nada. */
  readonly verificacoes: number;
};

/** Um recorte da matriz vira a `Query` que as portas entendem. */
export function consultaDe(recorte: Recorte, anoPadrao: string): Query {
  return {
    entidade: recorte.entidade,
    area: recorte.area,
    modalidade: recorte.modalidade,
    periodo: recorte.periodo,
    ano: recorte.ano ?? anoPadrao,
  } as Query;
}

/**
 * Roda a suíte sobre a matriz.
 *
 * Sequencial de propósito. A suíte existe para produzir um relatório legível,
 * não para ser rápida — e paralelizar embaralharia a ordem das falhas, que é o
 * que permite ler "falha em toda área menos consolidado" na saída.
 */
export async function rodarSuite(
  fonte: DataSource,
  nomeDaFonte: string,
  matriz: readonly Recorte[],
  anoPadrao: string,
): Promise<Relatorio> {
  const regras = regrasRegistradas();
  if (regras.length === 0) throw new SuiteSemRegra();

  const falhas: Falha[] = [];
  let verificacoes = 0;

  for (const recorte of matriz) {
    const consulta = consultaDe(recorte, anoPadrao);
    for (const regra of regras) {
      verificacoes += 1;
      falhas.push(...(await regra.rodar({ fonte, recorte, consulta })));
    }
  }

  return {
    fonte: nomeDaFonte,
    recortes: matriz.length,
    regras: regras.map((r) => r.numero),
    falhas,
    verificacoes,
  };
}

/* ------------------------------------------------------------------ *
 * O relatório
 * ------------------------------------------------------------------ */

/** Um recorte em uma linha, para caber na saída. */
export function recorteEmTexto(r: Recorte): string {
  const ano = r.ano === undefined ? "" : ` · ${r.ano}`;
  return `${r.entidade} · ${r.area} · ${r.modalidade} · ${r.periodo}${ano}`;
}

/**
 * O relatório em texto.
 *
 * Uma linha por falha, com os três campos do aceite na frente. Quem investiga
 * copia a linha, monta a `Query` e reproduz — sem isso, "a suíte falhou" é uma
 * caça ao tesouro em 768 recortes.
 */
export function relatorioEmTexto(r: Relatorio): string {
  const cabecalho =
    `suíte de contrato · fonte ${r.fonte} · ${String(r.recortes)} recortes · ` +
    `regras ${r.regras.join(", ")} · ${String(r.verificacoes)} verificações`;

  if (r.falhas.length === 0) {
    return `${cabecalho}\n\nnenhuma divergência.`;
  }

  const linhas = r.falhas.map((f) => {
    const numeros =
      f.esperado === undefined && f.obtido === undefined
        ? ""
        : `  (esperado ${String(f.esperado)}, obtido ${String(f.obtido)})`;
    return (
      `  regra ${String(f.regra)} · ${f.assunto} · ` +
      `${recorteEmTexto(f.recorte)}\n    ${f.mensagem}${numeros}`
    );
  });

  return (
    `${cabecalho}\n\n${String(r.falhas.length)} divergência` +
    `${r.falhas.length === 1 ? "" : "s"}:\n\n${linhas.join("\n")}`
  );
}

/**
 * A comparação que as regras usam.
 *
 * Fica aqui, e não em cada regra, porque tolerância aplicada de formas
 * diferentes em regras diferentes é a mesma suíte dizendo duas coisas.
 */
export function conferirIgual(
  esperado: number | null,
  obtido: number | null,
  unidade: Unidade,
  falha: Omit<Falha, "esperado" | "obtido" | "mensagem"> & {
    readonly mensagem: string;
  },
): readonly Falha[] {
  if (dentroDaTolerancia(esperado, obtido, unidade)) return [];
  return [{ ...falha, esperado, obtido }];
}
