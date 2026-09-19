/**
 * O mês que a pergunta nomeia, e o ponto da série que responde por ele
 * (T-439).
 *
 * "Quanto faturamos em abril?" abria com o total de doze meses e só citava
 * abril no parágrafo do gráfico. O recorte da URL não tem "abril" — os
 * períodos são os quatro da seção 6.2 —, mas a série mensal por trás de toda
 * métrica tem: o ponto de abril **é** o número que a pergunta pediu, e a
 * resposta abre com ele.
 *
 * Nada aqui lê dado nem calcula: reconhece o mês no texto e escolhe um ponto
 * que o estágio 2 já leu. O verificador continua conferindo o número.
 */

import type { PontoDoResumo } from "@/chat/grafico";

/** Os meses, na ordem, como rótulo por extenso. */
export const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

/** Quantas letras tem a abreviação do mês nos rótulos: "abr/2026". */
const LETRAS_DA_ABREVIACAO = 3;

export type MesPedido = {
  /** De 1 (janeiro) a 12 (dezembro). */
  readonly mes: number;
  /** O ano, quando a pergunta o diz; senão `null`, e vale o mais recente. */
  readonly ano: number | null;
};

function semAcento(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

const POR_EXTENSO = new RegExp(
  `\\b(${MESES.map((m) => semAcento(m)).join("|")})\\b(?:\\s*(?:de\\s+|/)?\\s*(20\\d{2})\\b)?`,
);

const ABREVIADO = new RegExp(
  `\\b(${MESES.map((m) => semAcento(m).slice(0, LETRAS_DA_ABREVIACAO)).join("|")})/(20\\d{2})\\b`,
);

/**
 * O mês que a pergunta nomeia: por extenso ("em abril", "abril de 2025",
 * "abril/2025") ou abreviado com ano ("abr/2026"). O primeiro que aparecer.
 * A abreviação só vale com o ano: "mar" e "set" são palavras comuns demais.
 */
export function mesDaPergunta(pergunta: string): MesPedido | null {
  return mesesDaPergunta(pergunta)[0] ?? null;
}

/**
 * **Todos** os meses que a pergunta nomeia, na ordem em que aparecem (T-457).
 *
 * "Qual o faturamento de abril e agosto?" nomeia dois, e o produto enxergava
 * um: `mesDaPergunta` devolvia abril e agosto sumia — a resposta saía com um
 * mês só, e ninguém via que faltava. Quem precisa de um usa o primeiro; quem
 * precisa saber que há mais de um — o roteamento — pergunta o tamanho.
 */
export function mesesDaPergunta(pergunta: string): readonly MesPedido[] {
  const texto = semAcento(pergunta);
  const achados: MesPedido[] = [];

  // `g` para varrer o texto inteiro, e não só o primeiro casamento.
  for (const casado of texto.matchAll(new RegExp(POR_EXTENSO, "g"))) {
    const nome = casado[1] ?? "";
    const mes = MESES.findIndex((m) => semAcento(m) === nome) + 1;
    achados.push({
      mes,
      ano: casado[2] === undefined ? null : Number(casado[2]),
    });
  }
  for (const casado of texto.matchAll(new RegExp(ABREVIADO, "g"))) {
    const nome = casado[1] ?? "";
    const mes =
      MESES.findIndex(
        (m) => semAcento(m).slice(0, LETRAS_DA_ABREVIACAO) === nome,
      ) + 1;
    // Sem repetir o que o padrão por extenso já achou no mesmo lugar.
    if (achados.some((a) => a.mes === mes)) continue;
    achados.push({ mes, ano: Number(casado[2]) });
  }
  return achados;
}

/** O começo do rótulo que corresponde ao mês pedido: "abr/2026" ou "abr/". */
function prefixoDoRotulo(pedido: MesPedido): string {
  const nome = MESES[pedido.mes - 1];
  if (nome === undefined) return "";
  const abreviacao = semAcento(nome).slice(0, LETRAS_DA_ABREVIACAO);
  return pedido.ano === null
    ? `${abreviacao}/`
    : `${abreviacao}/${String(pedido.ano)}`;
}

/**
 * O ponto da série que responde pelo mês pedido, ou `null` se a série não o
 * tem. Sem ano na pergunta, vale o mais recente — a série vai do passado ao
 * presente, e "em abril" numa conversa de 2026 é abril de 2026.
 */
export function pontoDoMes(
  pontos: readonly PontoDoResumo[],
  pedido: MesPedido,
): PontoDoResumo | null {
  const prefixo = prefixoDoRotulo(pedido);
  if (prefixo === "") return null;
  const candidatos = pontos.filter((p) =>
    semAcento(p.rotulo).startsWith(prefixo),
  );
  return candidatos.at(-1) ?? null;
}

/** O rótulo do mês pedido, como a série o escreve: "abr/2026", ou "abril" sem ano. */
export function rotuloDoMes(pedido: MesPedido): string {
  const nome = MESES[pedido.mes - 1] ?? "";
  if (pedido.ano === null) return nome;
  return `${semAcento(nome).slice(0, LETRAS_DA_ABREVIACAO)}/${String(pedido.ano)}`;
}

const ROTULO_DE_MES = /^([a-z]{3})\/(20\d{2})\b/;

/**
 * O mês que um rótulo de ponto nomeia — "abr/2026", "abr/2026 · Ano atual" —,
 * para a conversa lembrar de que mês a resposta anterior falou (T-443).
 */
export function mesDoRotulo(rotulo: string): MesPedido | null {
  const m = ROTULO_DE_MES.exec(semAcento(rotulo));
  if (m === null) return null;
  const mes =
    MESES.findIndex(
      (nome) => semAcento(nome).slice(0, LETRAS_DA_ABREVIACAO) === m[1],
    ) + 1;
  return mes === 0 ? null : { mes, ano: Number(m[2]) };
}

/** É um mês pedido? A forma que chega do navegador, conferida campo a campo. */
export function mesValido(candidato: unknown): candidato is MesPedido {
  if (typeof candidato !== "object" || candidato === null) return false;
  const { mes, ano } = candidato as { mes?: unknown; ano?: unknown };
  const mesCerto =
    Number.isInteger(mes) && Number(mes) >= 1 && Number(mes) <= 12;
  const anoCerto =
    ano === null ||
    (Number.isInteger(ano) && Number(ano) >= 2000 && Number(ano) <= 2100);
  return mesCerto && anoCerto;
}

/** A pergunta sem o mês que nomeia, para ver se sobra métrica nela. */
export function semMes(pergunta: string): string {
  return pergunta
    .replace(new RegExp(POR_EXTENSO.source, "gi"), " ")
    .replace(new RegExp(ABREVIADO.source, "gi"), " ")
    .replace(/\s{2,}/g, " ");
}

const PERIODO_INTEIRO =
  /\b(?:no ano (?:todo|inteiro)|o ano (?:todo|inteiro)|anual|acumulad[oa]|nos? (?:ultimos )?(?:12|doze) meses|12 meses|doze meses)\b/;

/**
 * A pergunta pede o período inteiro ("e no ano todo?", "nos 12 meses?"): é
 * o que fecha o assunto do mês herdado e volta ao recorte de doze meses.
 */
export function pedeOPeriodoInteiro(pergunta: string): boolean {
  return PERIODO_INTEIRO.test(semAcento(pergunta));
}
