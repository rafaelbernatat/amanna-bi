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

import { ARMAZENS } from "@/marca/armazem";
import {
  armazemDeArquivoEmDiscoEfemero,
  armazemEmMemoriaComDadoReal,
  EXIGIDAS_POR_ARMAZEM,
} from "@/marca/configuracao";
import { FONTES_DE_SITE } from "@/marca/site/fonte";
import { PROVEDORES } from "@/acesso/sessao";
import { TAMANHO_MINIMO_DA_SENHA } from "@/seguranca/senha";
import { TAMANHO_MINIMO_DO_SEGREDO } from "@/seguranca/convite";

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

/**
 * Caminho absoluto.
 *
 * Relativo é armadilha: resolve contra o diretório de trabalho do processo,
 * que muda entre `next dev`, `next start` e o contêiner — e a marca gravada
 * num lugar seria lida noutro.
 *
 * A conferência é escrita à mão em vez de vir de `node:path`, e a razão é
 * concreta: este módulo é carregado pela instrumentação do boot, que roda em
 * **todos** os runtimes — inclusive o de borda, onde módulo nativo não existe.
 * Importar `node:path` aqui derrubava o servidor inteiro com "native module
 * not found", uma requisição por vez.
 */
function caminhoAbsoluto() {
  // Barra inicial cobre POSIX; letra de unidade cobre Windows.
  const ABSOLUTO = /^(\/|[A-Za-z]:[\\/])/;
  return (valor: string): string | null =>
    ABSOLUTO.test(valor) ? null : "esperava um caminho absoluto";
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
     * A leitura de sessão exige `AUTH_PROVIDER` e esta validação não a
     * conferia: o processo subia inteiro e **toda** requisição de tela
     * devolvia 500 — porque quem exige a variável roda por requisição. A
     * validação de T-139 existe justamente para trocar "sobe e falha em cada
     * página" por "não sobe, e diz o que falta".
     */
    nome: "AUTH_PROVIDER",
    proposito: "quem autentica a sessão (seção 8.2, RF-23)",
    obrigatoria: true,
    segredo: false,
    conferir: umDentre([...PROVEDORES]),
  },
  {
    /*
     * O segredo que assina convite e cookie de apresentação.
     *
     * Rotacioná-lo derruba todos os cookies de uma vez — é o botão de pânico
     * de uma apresentação cujo link vazou, e por isso ele é um segredo comum,
     * trocável sem rebuild.
     */
    nome: "CONVITE_SEGREDO",
    proposito:
      "assina o convite do QR e o cookie de sessão (D-CONVITE-apresentacao)",
    obrigatoria: false,
    segredo: true,
    conferir: comprimentoMinimo(TAMANHO_MINIMO_DO_SEGREDO),
  },
  {
    /*
     * A senha da porta do painel.
     *
     * Diferente de `CONVITE_SEGREDO` em natureza, não só em uso: aquele é uma
     * chave que o servidor usa consigo mesmo e ninguém precisa saber de cor;
     * esta é escolhida por uma pessoa e digitada por ela. Por isso o mínimo é
     * menor — o que segura uma senha curta é o limite de tentativas da rota,
     * e um mínimo alto demais empurra para o papel colado no monitor.
     *
     * Sem ela, a instalação simplesmente não tem porta por senha, e quem
     * apresenta entra pelo link assinado.
     */
    nome: "SENHA_DO_PAINEL",
    proposito:
      "a senha de quem apresenta, na tela de entrada (D-CONVITE-apresentacao)",
    obrigatoria: false,
    segredo: true,
    conferir: comprimentoMinimo(TAMANHO_MINIMO_DA_SENHA),
  },
  {
    /*
     * A conexão com o Postgres.
     *
     * Serve a réplica em warehouse (seção 10) **e** a marca da instalação
     * (D-MARCA): é a URL do pooler em modo transação. A carga dos CSVs usa a
     * de modo sessão, abaixo, porque `COPY` não atravessa o modo transação.
     */
    nome: "DATABASE_URL",
    proposito:
      "conexão com o Postgres: réplica em warehouse (seção 10) e marca da instalação (D-MARCA)",
    obrigatoria: false,
    segredo: true,
    conferir: urlComEsquema(["postgres", "postgresql"]),
  },
  {
    nome: "DATABASE_URL_CARGA",
    proposito:
      "conexão em modo sessão para a carga dos CSVs (D-DADOS); sem ela a carga usa DATABASE_URL",
    obrigatoria: false,
    segredo: true,
    conferir: urlComEsquema(["postgres", "postgresql"]),
  },
  {
    /*
     * A conexão do chat, autenticada como `amanna_chat_ro` (T-450).
     *
     * É a defesa da consulta livre: o papel tem GRANT só no esquema
     * `amanna_chat`, e nenhum em `amanna`. Sem esta variável a capacidade fica
     * desligada e a ferramenta não é oferecida ao modelo — o que é o estado
     * certo de qualquer instalação que não a queira.
     */
    nome: "DATABASE_URL_CHAT",
    proposito:
      "conexão somente-leitura do chat, como amanna_chat_ro (D-CHAT-sql); sem ela a consulta livre fica desligada",
    obrigatoria: false,
    segredo: true,
    conferir: urlComEsquema(["postgres", "postgresql"]),
  },
  {
    nome: "DATABASE_SSL_CA",
    proposito:
      "autoridade certificadora em PEM, só quando a cadeia do banco exigir (D-DADOS)",
    obrigatoria: false,
    segredo: false,
  },
  {
    nome: "ANTHROPIC_API_KEY",
    proposito: "chave da API do chat (seção 7)",
    obrigatoria: false,
    segredo: true,
    conferir: comprimentoMinimo(20),
  },
  {
    /*
     * A chave do OpenRouter.
     *
     * A seção 8.2 do PRD fixa o SDK da Anthropic; a decisão de usar o
     * OpenRouter como porta é de Produto, de 2026-08-30, e está registrada em
     * `docs/decisoes/D-CHAT-openrouter.md`. O gateway fala o protocolo da
     * OpenAI e roteia para o modelo escolhido, então o que muda é o cliente —
     * a arquitetura de três estágios da seção 7 continua idêntica.
     */
    nome: "OPENROUTER_API_KEY",
    proposito: "chave do gateway que atende o chat (seção 7, D-CHAT)",
    obrigatoria: false,
    segredo: true,
    conferir: comprimentoMinimo(20),
  },
  {
    nome: "OPENROUTER_MODEL",
    proposito: "qual modelo o chat usa nos estágios 1 e 3 (seção 7.3)",
    obrigatoria: false,
    segredo: false,
  },
  {
    nome: "OPENROUTER_MODEL_FERRAMENTAS",
    proposito:
      "qual modelo compõe leituras com ferramentas (D-CHAT-ferramentas); sem ela vale OPENROUTER_MODEL",
    obrigatoria: false,
    segredo: false,
  },
  {
    /*
     * A personalização visual por empresa (D-MARCA).
     *
     * Opcional, e a ausência é um estado explícito: sem armazém a
     * personalização fica desligada, o botão não aparece e a tela diz isso.
     * Uma instalação que não quer marca própria não precisa declarar nada.
     */
    nome: "MARCA_ARMAZEM",
    proposito: "onde a marca da instalação é guardada (D-MARCA)",
    obrigatoria: false,
    segredo: false,
    conferir: umDentre([...ARMAZENS]),
  },
  {
    nome: "MARCA_DIR",
    proposito: "diretório montado onde a marca é gravada (D-MARCA)",
    obrigatoria: false,
    segredo: false,
    conferir: caminhoAbsoluto(),
  },
  {
    nome: "MARCA_SITE",
    proposito: "quem busca o site da empresa: a rede ou o arnês (D-MARCA)",
    obrigatoria: false,
    segredo: false,
    conferir: umDentre([...FONTES_DE_SITE]),
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

/**
 * O mesmo para o provedor de sessão.
 *
 * `convite` sem segredo não assina nada: o boot para, em vez de servir uma
 * tela de entrada que recusa todo mundo sem dizer por quê.
 */
const EXIGIDAS_POR_PROVEDOR: Readonly<Record<string, readonly string[]>> = {
  fixtures: [],
  oidc: [],
  convite: ["CONVITE_SEGREDO"],
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
  const armazem = ambiente["MARCA_ARMAZEM"];
  const provedor = ambiente["AUTH_PROVIDER"];
  const extras = [
    ...(fonte !== undefined && fonte in EXIGIDAS_POR_FONTE
      ? (EXIGIDAS_POR_FONTE[fonte] ?? [])
      : []),
    ...(provedor !== undefined && provedor in EXIGIDAS_POR_PROVEDOR
      ? (EXIGIDAS_POR_PROVEDOR[provedor] ?? [])
      : []),
    ...(armazem !== undefined && armazem in EXIGIDAS_POR_ARMAZEM
      ? (EXIGIDAS_POR_ARMAZEM[armazem] ?? [])
      : []),
  ];

  /*
   * As duas combinações que sobem **quase** certo.
   *
   * Arquivo em disco efêmero grava, lê na mesma invocação e some depois;
   * memória na frente de dado real perde a marca a cada reinício. As duas
   * mostram "aplicado" na tela e falham em silêncio horas depois, que é
   * exatamente o modo de falha que esta validação existe para impedir.
   */
  if (armazemDeArquivoEmDiscoEfemero(ambiente)) {
    problemas.push({
      variavel: "MARCA_ARMAZEM",
      problema:
        "'arquivo' num ambiente de disco efêmero: a gravação sucede e a marca " +
        "some no próximo início. Use 'postgres' aqui (com DATABASE_URL), e " +
        "'arquivo' onde há volume",
    });
  }
  if (armazemEmMemoriaComDadoReal(ambiente)) {
    problemas.push({
      variavel: "MARCA_ARMAZEM",
      problema:
        "'memoria' só serve a teste: perde a marca a cada reinício, e " +
        "DATA_SOURCE=warehouse indica instalação de verdade",
    });
  }

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
