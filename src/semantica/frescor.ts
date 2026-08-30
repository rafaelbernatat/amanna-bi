/**
 * O selo de frescor, e a única conta que decide se ele vira aviso (T-149).
 *
 * PRD seção 10.2: *"`getMeta()` devolve a data do último fechamento carregado;
 * a tela sempre mostra. Acima do limite acordado, o selo vira aviso."* E RF-22:
 * a sincronização falha de forma segura — *"mantém a réplica anterior e marca o
 * selo de frescor como defasado. Nunca serve dado parcial."*
 *
 * ## Por que a conta mora aqui, e não no adaptador
 *
 * Cada adaptador saberia dizer quando sincronizou pela última vez, e cada um
 * decidiria por conta própria se isso já é defasagem. Dois adaptadores, duas
 * respostas para a mesma pergunta — e a suíte de contrato, que existe para
 * provar que os dois concordam (RF-21), passaria a comparar números calculados
 * por regras diferentes.
 *
 * Aqui é uma função pura: recebe os dois instantes e o limite, devolve o
 * estado. O adaptador informa **quando**; quem decide **o que isso significa** é
 * este módulo, uma vez.
 *
 * ## O relógio entra por parâmetro
 *
 * `Date.now()` dentro da função tornaria o teste de borda impossível de
 * escrever sem esperar o relógio andar. Com o instante entrando por argumento,
 * limite-1, limite e limite+1 são três chamadas.
 *
 * Não é só conveniência de teste: em produção, o instante certo é o da
 * requisição, e não o do momento em que esta linha executa. Duas leituras da
 * mesma tela não podem discordar sobre o frescor porque uma delas demorou.
 */

import type { EstadoDeFrescor, Frescor } from "@/semantica/contrato";

/** Milissegundos numa hora, para converter a diferença de instantes. */
const MS_POR_HORA = 60 * 60 * 1000;

/**
 * O limite padrão, em horas, enquanto **P5 não for decidido**.
 *
 * A seção 10.2 fixa a cadência — *"diária, de madrugada, na janela acordada com
 * o cliente"* —, e a pergunta que falta é outra: a partir de quanto tempo sem
 * sync o número deixa de ser confiável para uma reunião. Isso é decisão de
 * Controladoria, está registrada como **P5** na seção 18 do PRD, e a tarefa que
 * a resolve é T-010, travada em H-23.
 *
 * Vinte e seis horas é o padrão porque uma carga diária que atrase duas horas
 * ainda é uma carga diária: alarmar em 24 em ponto transformaria toda
 * madrugada lenta em aviso vermelho, e um aviso que aparece toda semana deixa
 * de ser lido. Não é a decisão — é o que o produto usa até ela existir, e o
 * valor vem por configuração, nunca daqui.
 */
export const LIMITE_PADRAO_DE_DEFASAGEM_HORAS = 26;

/** Não foi possível ler o instante de um dos dois lados. */
export class InstanteInvalido extends Error {
  constructor(campo: string, valor: string) {
    super(
      `O campo '${campo}' não é um instante ISO legível: "${valor}". ` +
        "O frescor compara dois instantes, e um deles ilegível viraria " +
        "'defasado' ou 'ok' por acidente de parsing — nunca por medição.",
    );
    this.name = "InstanteInvalido";
  }
}

function instante(campo: string, valor: string): number {
  const t = Date.parse(valor);
  if (Number.isNaN(t)) throw new InstanteInvalido(campo, valor);
  return t;
}

/**
 * Quantas horas se passaram desde o último sync bem-sucedido.
 *
 * Separada de `avaliarFrescor` porque a tela precisa do número para escrever
 * "sync de 31h" — e derivar isso de novo lá seria a segunda conta sobre a mesma
 * pergunta.
 */
export function horasDesdeOSync(sincronizadoEm: string, agora: Date): number {
  return (
    (agora.getTime() - instante("sincronizadoEm", sincronizadoEm)) / MS_POR_HORA
  );
}

/**
 * O estado do selo.
 *
 * **No limite exato ainda é `ok`.** A comparação é estritamente maior, e a
 * escolha tem consequência: com `>=`, um acordo de "24 horas" alarmaria numa
 * carga que levou exatamente 24, que é a carga que cumpriu o acordo. O aceite
 * de T-149 fixa isso em três casos — limite-1, limite e limite+1 devolvem ok,
 * ok e defasado.
 */
export function estadoDoFrescor(
  horas: number,
  limiteDefasagemHoras: number,
): EstadoDeFrescor {
  return horas > limiteDefasagemHoras ? "defasado" : "ok";
}

/** Monta o selo a partir do que o adaptador sabe e do instante da leitura. */
export function avaliarFrescor(entrada: {
  /** Data do último fechamento carregado. */
  readonly asOf: string;
  /** Instante do último sync bem-sucedido, em ISO com fuso. */
  readonly sincronizadoEm: string;
  readonly limiteDefasagemHoras?: number;
  readonly agora: Date;
}): Frescor {
  const limiteDefasagemHoras =
    entrada.limiteDefasagemHoras ?? LIMITE_PADRAO_DE_DEFASAGEM_HORAS;

  // Confere que `asOf` é legível aqui, e não na tela: uma data de fechamento
  // quebrada precisa reprovar na leitura, não no formatador.
  instante("asOf", entrada.asOf);

  return {
    asOf: entrada.asOf,
    sincronizadoEm: entrada.sincronizadoEm,
    limiteDefasagemHoras,
    status: estadoDoFrescor(
      horasDesdeOSync(entrada.sincronizadoEm, entrada.agora),
      limiteDefasagemHoras,
    ),
  };
}

/**
 * O selo está em aviso?
 *
 * Existe para que os componentes não escrevam `frescor.status === "defasado"`
 * em seis lugares — a repetição é onde alguém compara com a string errada e o
 * aviso deixa de aparecer, silenciosamente.
 */
export function estaDefasado(frescor: Frescor): boolean {
  return frescor.status === "defasado";
}
