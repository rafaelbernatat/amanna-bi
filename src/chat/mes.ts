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
  const texto = semAcento(pergunta);
  const extenso = POR_EXTENSO.exec(texto);
  if (extenso !== null) {
    const nome = extenso[1] ?? "";
    const mes = MESES.findIndex((m) => semAcento(m) === nome) + 1;
    const ano = extenso[2] === undefined ? null : Number(extenso[2]);
    return { mes, ano };
  }
  const abreviado = ABREVIADO.exec(texto);
  if (abreviado !== null) {
    const nome = abreviado[1] ?? "";
    const mes =
      MESES.findIndex(
        (m) => semAcento(m).slice(0, LETRAS_DA_ABREVIACAO) === nome,
      ) + 1;
    return { mes, ano: Number(abreviado[2]) };
  }
  return null;
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
