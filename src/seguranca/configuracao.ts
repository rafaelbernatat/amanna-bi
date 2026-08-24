/**
 * Validação de configuração e segredos no boot (T-139).
 *
 * Seção 11 do PRD: "credencial do banco e chave da API nunca no código nem na
 * imagem; injetadas por ambiente, rotacionáveis sem *rebuild*". Seção 15: imagem
 * única, e toda diferença de cliente vive em configuração.
 *
 * O modo de falha que este módulo existe para impedir não é subir sem uma
 * variável — é subir **quase** certo. Uma `DATABASE_URL` ausente com fallback
 * para localhost sobe a aplicação, serve tela, e mostra dado de um banco vazio
 * ou de outro ambiente. O erro aparece três dias depois, numa reunião, como um
 * número que ninguém reconhece. Por isso aqui o boot **para**, e para nomeando
 * todas as variáveis erradas de uma vez: quem está configurando não deve
 * descobrir uma por vez, a cada reinício.
 *
 * O que este módulo nunca faz:
 *
 * - **Ler arquivo versionado.** Nada de `.env` no repositório. A leitura é do
 *   ambiente do processo, e só.
 * - **Registrar o valor de um segredo.** As mensagens de erro dizem o *nome* da
 *   variável e o que se esperava dela — nunca o que veio. Um log de erro é
 *   copiado para ticket, e segredo em ticket é segredo vazado.
 */

/** O que uma variável precisa satisfazer. */
export type RegraDeVariavel = {
  readonly nome: string;
  /** Para que serve, em uma linha. Vai na mensagem de erro. */
  readonly proposito: string;
  /** Obrigatória em todo boot, ou só quando a fonte a exige. */
  readonly obrigatoria: boolean;
  /** É segredo? Segredo nunca aparece em mensagem, nem truncado. */
  readonly segredo: boolean;
  /** Valida o formato. Devolve o problema, ou `null` quando está boa. */
  readonly conferir?: (valor: string) => string | null;
};

/* ------------------------------------------------------------------ *
 * Conferências reutilizáveis
 * ------------------------------------------------------------------ */

function umDentre(aceitos: readonly string[]) {
  return (valor: string): string | null =>
    aceitos.includes(valor) ? null : `esperava um de: ${aceitos.join(", ")}`;
}

function urlComEsquema(esquemas: readonly string[]) {
  return (valor: string): string | null => {
    // `URL` recusa texto que não é URL sem lançar informação do valor adiante.
    let esquema: string;
    try {
      esquema = new URL(valor).protocol.replace(":", "");
    } catch {
      return "não é uma URL válida";
    }
    return esquemas.includes(esquema)
      ? null
      : `esperava esquema ${esquemas.join(" ou ")}`;
  };
}

function comprimentoMinimo(minimo: number) {
  return (valor: string): string | null =>
    valor.length >= minimo ? null : `esperava ao menos ${minimo} caracteres`;
}

/* ------------------------------------------------------------------ *
 * O esquema
 * ------------------------------------------------------------------ */

/**
 * As variáveis que o produto lê.
 *
 * A lista cresce com as fases: `DATABASE_URL` entra com o adaptador de
 * warehouse (F2), `ANTHROPIC_API_KEY` com o chat (F3). Ficam declaradas desde
 * já como **condicionais** para que o esquema seja o lugar único onde se
 * pergunta "de que este ambiente precisa" — e não uma descoberta por
 * `process.env.X!` espalhada pelo código.
 */
export const ESQUEMA: readonly RegraDeVariavel[] = [
  {
    nome: "DATA_SOURCE",
    proposito: "de onde o produto lê dado (seção 8.3, RF-20)",
    obrigatoria: true,
    segredo: false,
    conferir: umDentre(["fixtures", "warehouse"]),
  },
  {
    /*
     * Faltava no esquema, e a falta aparecia tarde.
     *
     * `getSession` exige `AUTH_PROVIDER` e a validação de boot não a conferia:
     * o processo subia inteiro e **toda** requisição de tela devolvia 500. A
     * validação de T-139 existe justamente para trocar "sobe e falha em cada
     * página" por "não sobe, e diz o que falta".
     */
    nome: "AUTH_PROVIDER",
    proposito: "quem autentica a sessão (seção 8.2, RF-23)",
    obrigatoria: true,
    segredo: false,
    conferir: umDentre(["fixtures", "oidc"]),
  },
  {
    nome: "DATABASE_URL",
    proposito: "conexão com a réplica em warehouse (seção 10)",
    obrigatoria: false,
    segredo: true,
    conferir: urlComEsquema(["postgres", "postgresql"]),
  },
  {
    nome: "ANTHROPIC_API_KEY",
    proposito: "chave da API do chat (seção 7)",
    obrigatoria: false,
    segredo: true,
    conferir: comprimentoMinimo(20),
  },
];

/**
 * Variáveis que passam a ser obrigatórias conforme o modo.
 *
 * `DATA_SOURCE=warehouse` sem `DATABASE_URL` é o caso que mais dói: o modo diz
 * "leia do banco" e não há banco. Sem esta regra, o erro só aparece na primeira
 * consulta — depois de a tela já ter carregado.
 */
const EXIGIDAS_POR_FONTE: Readonly<Record<string, readonly string[]>> = {
  fixtures: [],
  warehouse: ["DATABASE_URL"],
};

/* ------------------------------------------------------------------ *
 * A validação
 * ------------------------------------------------------------------ */

export type ProblemaDeConfiguracao = {
  readonly variavel: string;
  readonly problema: string;
};

export class ConfiguracaoInvalida extends Error {
  constructor(readonly problemas: readonly ProblemaDeConfiguracao[]) {
    super(
      "A configuração do ambiente não permite subir:\n" +
        problemas.map((p) => `  · ${p.variavel}: ${p.problema}`).join("\n") +
        "\n\nO boot para aqui de propósito. Subir com configuração parcial " +
        "serve tela com dado de origem que ninguém escolheu (seção 11).",
    );
    this.name = "ConfiguracaoInvalida";
  }
}

/**
 * Confere o ambiente inteiro e devolve **todos** os problemas.
 *
 * Devolver todos, e não o primeiro, é decisão de usabilidade com consequência
 * real: quem configura um ambiente novo erra três variáveis, e descobrir uma
 * por reinício transforma dez minutos em uma hora.
 */
export function conferirAmbiente(
  ambiente: Record<string, string | undefined>,
): readonly ProblemaDeConfiguracao[] {
  const problemas: ProblemaDeConfiguracao[] = [];

  const fonte = ambiente["DATA_SOURCE"];
  const extras =
    fonte !== undefined && fonte in EXIGIDAS_POR_FONTE
      ? (EXIGIDAS_POR_FONTE[fonte] ?? [])
      : [];

  for (const regra of ESQUEMA) {
    const valor = ambiente[regra.nome];
    const exigida = regra.obrigatoria || extras.includes(regra.nome);

    if (valor === undefined || valor === "") {
      if (exigida) {
        problemas.push({
          variavel: regra.nome,
          problema: `ausente — ${regra.proposito}`,
        });
      }
      continue;
    }

    const erro = regra.conferir?.(valor) ?? null;
    if (erro !== null) {
      // A mensagem carrega o nome e a expectativa. Nunca o valor: nem os
      // primeiros caracteres, nem o comprimento — para segredo, isso é pista.
      problemas.push({ variavel: regra.nome, problema: erro });
    }
  }

  return problemas;
}

/**
 * Confere e aborta se houver problema.
 *
 * Chamada uma vez no boot. Não faz I/O nem espera rede — a validação é
 * comparação de texto, e o teto de 2 segundos do aceite é folga de duas ordens
 * de grandeza sobre o que ela custa.
 */
export function exigirAmbienteValido(
  ambiente: Record<string, string | undefined> = process.env,
): void {
  const problemas = conferirAmbiente(ambiente);
  if (problemas.length > 0) throw new ConfiguracaoInvalida(problemas);
}

/** Os nomes das variáveis marcadas como segredo. Usado pelo teste e pelo CI. */
export const NOMES_DE_SEGREDO: readonly string[] = ESQUEMA.filter(
  (r) => r.segredo,
).map((r) => r.nome);
