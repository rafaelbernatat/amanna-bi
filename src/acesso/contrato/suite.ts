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
import { REGISTRO_DE_PAINEIS } from "@/semantica/paineis";
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

  /**
   * Os painéis que esta regra confere. Contados da própria regra, nunca
   * escritos à mão.
   *
   * Existe para que a cobertura seja **medida**, e não afirmada. Sem isto, a
   * frase "a suíte cobre os 71 painéis" é uma promessa que ninguém confere —
   * e uma regra que deixasse de olhar metade deles continuaria devolvendo
   * zero falhas, que se parece com sucesso.
   */
  readonly cobre?: () => readonly string[];
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

/**
 * O número que marca uma falha de percurso, e não de regra da 9.2.
 *
 * Zero porque a seção 9.2 numera as regras de 1 a 5, e o percurso não é uma
 * delas: é a leitura que precede qualquer regra. Misturar os dois no relatório
 * faria "regra 1 falhou" significar duas coisas diferentes.
 */
const PERCURSO = 0;

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

/**
 * A cobertura da suíte: quais painéis ela tocou, e a que profundidade.
 *
 * São duas profundidades, e a diferença entre elas é o que este tipo existe
 * para não deixar confundir:
 *
 * - **percorrido** é o painel que a suíte leu pelas quatro portas em todo
 *   recorte da matriz. Pega painel que lança, painel que devolve o envelope de
 *   outro, painel que quebra em dezembro e não em janeiro.
 * - **verificado** é o painel que alguma regra da seção 9.2 confere de fato.
 *
 * Percorrer não é verificar, e chamar os dois de "cobertura" seria o tipo de
 * frase que faz um relatório verde parecer mais forte do que é.
 */
export type Cobertura = {
  /** Os painéis do registro. Contados, nunca escritos. */
  readonly declarados: readonly string[];
  /** Lidos pelas portas em todo recorte, sem lançar e com a identidade certa. */
  readonly percorridos: readonly string[];
  /** Conferidos por alguma regra da 9.2. */
  readonly verificados: readonly string[];
};

/** O que a suíte devolve. */
export type Relatorio = {
  readonly fonte: string;
  readonly recortes: number;
  readonly regras: readonly number[];
  readonly falhas: readonly Falha[];
  /** Quantas verificações rodaram. Zero aqui é suíte que não verificou nada. */
  readonly verificacoes: number;
  readonly cobertura: Cobertura;
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

  const declarados = REGISTRO_DE_PAINEIS.map((p) => p.id);
  const quebrados = new Set<string>();

  const falhas: Falha[] = [];
  let verificacoes = 0;

  for (const recorte of matriz) {
    const consulta = consultaDe(recorte, anoPadrao);

    falhas.push(
      ...(await percorrerPaineis(fonte, recorte, consulta, quebrados)),
    );

    for (const regra of regras) {
      verificacoes += 1;
      falhas.push(...(await regra.rodar({ fonte, recorte, consulta })));
    }
  }

  const verificados = [
    ...new Set(regras.flatMap((r) => (r.cobre === undefined ? [] : r.cobre()))),
  ];

  return {
    fonte: nomeDaFonte,
    recortes: matriz.length,
    regras: regras.map((r) => r.numero),
    falhas,
    verificacoes,
    cobertura: {
      declarados,
      percorridos: declarados.filter((id) => !quebrados.has(id)),
      verificados: declarados.filter((id) => verificados.includes(id)),
    },
  };
}

/**
 * Lê os 71 painéis pelas quatro portas, num recorte.
 *
 * O que se exige é o mínimo que não pode falhar: a leitura volta, e volta com
 * a identidade pedida. É pouco como verificação e é muito como percurso —
 * painel que lança em dezembro e não em janeiro, ou que devolve o envelope do
 * vizinho, aparece aqui e em lugar nenhum das regras.
 *
 * Vai pelas portas, e não por `calcularPainel`, porque é o que faz o percurso
 * valer igual em `--source=warehouse` no dia em que o adaptador entrar. Um
 * percurso que importasse as fixtures diria "os 71 painéis respondem" sobre
 * uma fonte que ninguém vai usar em produção.
 */
async function percorrerPaineis(
  fonte: DataSource,
  recorte: Recorte,
  consulta: Query,
  quebrados: Set<string>,
): Promise<readonly Falha[]> {
  const falhas: Falha[] = [];

  for (const registro of REGISTRO_DE_PAINEIS) {
    try {
      const envelope = await fonte.getPanel(registro.id, consulta);
      if (envelope.id !== registro.id) {
        quebrados.add(registro.id);
        falhas.push({
          assunto: registro.id,
          recorte,
          regra: PERCURSO,
          mensagem: `a porta devolveu o envelope de '${envelope.id}'`,
        });
      }
    } catch (erro) {
      quebrados.add(registro.id);
      falhas.push({
        assunto: registro.id,
        recorte,
        regra: PERCURSO,
        mensagem: erro instanceof Error ? erro.message : String(erro),
      });
    }
  }

  return falhas;
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

  const cobertura = coberturaEmTexto(r.cobertura);

  if (r.falhas.length === 0) {
    return `${cabecalho}\n\n${cobertura}\n\nnenhuma divergência.`;
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
    `${cabecalho}\n\n${cobertura}\n\n${String(r.falhas.length)} divergência` +
    `${r.falhas.length === 1 ? "" : "s"}:\n\n${linhas.join("\n")}`
  );
}

/**
 * A cobertura em texto, com as duas profundidades separadas.
 *
 * Os painéis percorridos e não verificados aparecem **nomeados**, e não
 * contados. Um relatório que dissesse "40 de 71 verificados" e parasse aí
 * deixaria quem lê supondo quais são os 31 — e a suposição mais confortável é
 * sempre a de que são os que não importam.
 */
function coberturaEmTexto(c: Cobertura): string {
  const total = c.declarados.length;
  const linhas = [
    `cobertura · ${String(c.percorridos.length)} de ${String(total)} painéis ` +
      `percorridos pelas portas · ${String(c.verificados.length)} de ` +
      `${String(total)} verificados por alguma regra`,
  ];

  const naoPercorridos = c.declarados.filter(
    (id) => !c.percorridos.includes(id),
  );
  if (naoPercorridos.length > 0) {
    linhas.push(
      `  não percorridos (${String(naoPercorridos.length)}): ` +
        naoPercorridos.join(", "),
    );
  }

  const semRegra = c.percorridos.filter((id) => !c.verificados.includes(id));
  if (semRegra.length > 0) {
    linhas.push(
      `  percorridos sem regra que os confira (${String(semRegra.length)}): ` +
        semRegra.join(", "),
    );
  }

  return linhas.join("\n");
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
