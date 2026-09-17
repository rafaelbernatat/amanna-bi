/**
 * O resumo de um painel, para o modelo ler e para o verificador conferir.
 *
 * O modelo não vê o envelope do painel: vê **isto** — os pontos já formatados,
 * cada um com o seu rótulo, os destaques (maior, menor, último) escolhidos por
 * nós, e o total. É o que permite responder "o que esse gráfico mostra?" sem
 * que nenhum número nasça fora do estágio 2: todo número do resumo vem do
 * envelope, e o verificador só aceita um ponto citado junto do rótulo dele.
 *
 * ## Um switch exaustivo sobre as doze formas
 *
 * Cada forma diz o que é um "ponto" nela: a categoria de uma barra, a fatia de
 * uma rosca, o degrau de uma cascata, a célula de um mosaico. A exaustividade
 * é verificada pelo compilador: uma forma nova sem resumo não compila.
 *
 * ## Acima de `LIMITE_DE_PONTOS`, só destaques
 *
 * Um painel de 31 centros de custo × 3 séries tem 93 pontos. Mandar todos ao
 * modelo é custo sem leitura; ficam os destaques e o total, e `truncado` diz
 * que a lista foi cortada — para a tela e o modelo não presumirem que viram
 * tudo.
 */

import { formatarMesAno, formatarValor } from "@/apresentacao/formato/formato";
import type { PanelResponse, Unidade } from "@/semantica/contrato";
import type { Forma } from "@/semantica/painel";

/** Acima disto o resumo traz só os destaques e o total. */
export const LIMITE_DE_PONTOS = 48;

/** Um ponto do painel, com o rótulo que o identifica e o valor já formatado. */
export type PontoDoResumo = {
  readonly rotulo: string;
  readonly valor: number | null;
  readonly unidade: Unidade;
  /** `formatarValor`, ou `null` quando não há dado. */
  readonly formatado: string | null;
};

export type DestaqueDoResumo = {
  readonly tipo: "maior" | "menor" | "ultimo";
  readonly ponto: PontoDoResumo;
};

export type ResumoDoPainel = {
  readonly id: string;
  readonly titulo: string;
  readonly forma: Forma;
  readonly unidade: Unidade;
  readonly formula: string;
  readonly asOf: string;
  readonly total: PontoDoResumo | null;
  readonly nota: string | null;
  readonly pontos: readonly PontoDoResumo[];
  readonly destaques: readonly DestaqueDoResumo[];
  readonly truncado: boolean;
  /** Quantos pontos o painel tem, contando os que a lista não trouxe. */
  readonly quantidadeDePontos: number;
};

/* ------------------------------------------------------------------ *
 * Rótulos
 * ------------------------------------------------------------------ */

const MESES = [
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

const COMPETENCIA = /^(\d{4})-(\d{2})(?:-\d{2})?$/;

/** `2026-03` vira `mar/2026`; qualquer outro rótulo fica como está. */
export function rotuloDeCategoria(categoria: string): string {
  return COMPETENCIA.test(categoria) ? formatarMesAno(categoria) : categoria;
}

function semAcento(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

/** Palavras curtas demais para identificar um ponto sozinhas. */
const TAMANHO_MINIMO_DE_PALAVRA = 4;

/**
 * As formas pelas quais o texto pode nomear um ponto, sem acento e em
 * minúsculas: o rótulo inteiro, o mês por extenso e abreviado quando o rótulo
 * é competência, e as palavras longas do rótulo.
 *
 * É o que o verificador procura por perto de um número de ponto. Palavra
 * solta longa entra porque o modelo escreve "a Tecnologia" para o rótulo
 * "Tecnologia · Headcount"; o que continua exato é o **número**.
 */
export function variantesDoRotulo(rotulo: string): readonly string[] {
  const variantes = new Set<string>([semAcento(rotulo)]);

  const competencia = COMPETENCIA.exec(rotulo);
  if (competencia !== null) {
    const mes = Number(competencia[2]);
    const nome = MESES[mes - 1];
    if (nome !== undefined) {
      variantes.add(semAcento(nome));
      variantes.add(semAcento(nome.slice(0, 3)));
    }
    variantes.add(semAcento(formatarMesAno(rotulo)));
  }

  for (const nome of MESES) {
    if (semAcento(rotulo).includes(nome.slice(0, 3))) {
      variantes.add(semAcento(nome));
    }
  }

  for (const palavra of semAcento(rotulo).split(/[^a-z0-9]+/)) {
    if (palavra.length >= TAMANHO_MINIMO_DE_PALAVRA) variantes.add(palavra);
  }
  return [...variantes];
}

/* ------------------------------------------------------------------ *
 * O resumo
 * ------------------------------------------------------------------ */

function ponto(
  rotulo: string,
  valor: number | null,
  unidade: Unidade,
): PontoDoResumo {
  return {
    rotulo,
    valor,
    unidade,
    formatado: valor === null ? null : formatarValor(valor, unidade),
  };
}

/** Maior e menor entre os pontos com valor; vazio quando nada tem valor. */
function maiorEMenor(pontos: readonly PontoDoResumo[]): DestaqueDoResumo[] {
  const comValor = pontos.filter((p) => p.valor !== null);
  if (comValor.length === 0) return [];
  let maior = comValor[0];
  let menor = comValor[0];
  for (const p of comValor) {
    if (maior === undefined || menor === undefined) break;
    if ((p.valor ?? 0) > (maior.valor ?? 0)) maior = p;
    if ((p.valor ?? 0) < (menor.valor ?? 0)) menor = p;
  }
  if (maior === undefined || menor === undefined) return [];
  const destaques: DestaqueDoResumo[] = [{ tipo: "maior", ponto: maior }];
  if (menor !== maior) destaques.push({ tipo: "menor", ponto: menor });
  return destaques;
}

/** Os pontos de uma forma cartesiana: categoria por série de valor. */
function pontosCartesianos(
  p: Extract<
    PanelResponse,
    { forma: "barras" | "linha" | "barras-horizontais" | "barras-empilhadas" }
  >,
): { readonly pontos: PontoDoResumo[]; readonly principal: PontoDoResumo[] } {
  const deValor = p.series.filter((s) => s.papel === "valor");
  const series = deValor.length > 0 ? deValor : p.series;
  const varias = series.length > 1;
  const pontos: PontoDoResumo[] = [];
  let principal: PontoDoResumo[] = [];
  for (const serie of series) {
    const daSerie = p.categories.map((categoria, i) =>
      ponto(
        varias
          ? `${rotuloDeCategoria(categoria)} · ${serie.name}`
          : rotuloDeCategoria(categoria),
        serie.values[i] ?? null,
        p.unit,
      ),
    );
    if (principal.length === 0) principal = daSerie;
    pontos.push(...daSerie);
  }
  return { pontos, principal };
}

/** Resume o painel. Todo número aqui veio do envelope. */
export function resumirPainel(p: PanelResponse): ResumoDoPainel {
  const base = {
    id: p.id,
    titulo: p.title,
    forma: p.forma,
    unidade: p.unit,
    formula: p.formula,
    asOf: p.asOf,
    total: p.total === null ? null : ponto("Total", p.total, p.unit),
    nota: p.note,
  };

  let pontos: PontoDoResumo[] = [];
  let destaques: DestaqueDoResumo[] = [];

  switch (p.forma) {
    case "barras":
    case "barras-horizontais":
    case "barras-empilhadas": {
      const c = pontosCartesianos(p);
      pontos = c.pontos;
      destaques = maiorEMenor(c.principal);
      break;
    }
    case "linha": {
      const c = pontosCartesianos(p);
      pontos = c.pontos;
      destaques = maiorEMenor(c.principal);
      const ultimo = [...c.principal].reverse().find((x) => x.valor !== null);
      if (ultimo !== undefined)
        destaques.push({ tipo: "ultimo", ponto: ultimo });
      break;
    }
    case "divisao":
      pontos = p.grupos.flatMap((g) => [
        ponto(g.nome, g.total, p.unit),
        ...g.partes.map((parte) =>
          ponto(`${g.nome} · ${parte.nome}`, parte.valor, p.unit),
        ),
      ]);
      destaques = maiorEMenor(
        p.grupos.map((g) => ponto(g.nome, g.total, p.unit)),
      );
      break;
    case "estatisticas":
      pontos = p.estatisticas.map((e) => ponto(e.rotulo, e.valor, e.unidade));
      break;
    case "funil":
      pontos = p.passos.map((passo) => ponto(passo.nome, passo.valor, p.unit));
      break;
    case "mosaico-geografico":
      pontos = p.celulas.map((c) => ponto(c.uf, c.valor, p.unit));
      destaques = maiorEMenor(pontos);
      break;
    case "rosca":
      pontos = [
        ...p.fatias.map((f) => ponto(f.nome, f.valor, p.unit)),
        ponto(p.centro.rotulo, p.centro.valor, p.unit),
      ];
      destaques = maiorEMenor(
        p.fatias.map((f) => ponto(f.nome, f.valor, p.unit)),
      );
      break;
    case "cascata":
      pontos = p.passos.map((passo) => ponto(passo.nome, passo.valor, p.unit));
      break;
    case "dispersao":
      pontos = p.pontos.flatMap((q) => [
        ponto(`${q.rotulo} · ${p.eixoX.rotulo}`, q.x, p.eixoX.unidade),
        ponto(`${q.rotulo} · ${p.eixoY.rotulo}`, q.y, p.eixoY.unidade),
      ]);
      break;
    case "regua-de-ciclo":
      pontos = [
        ...p.marcos.map((m) => ponto(m.rotulo, m.dia, "dias")),
        ...p.faixas.flatMap((f) => [
          ponto(`${f.rotulo} · início`, f.de, "dias"),
          ponto(`${f.rotulo} · fim`, f.ate, "dias"),
        ]),
      ];
      break;
  }

  const truncado = pontos.length > LIMITE_DE_PONTOS;
  return {
    ...base,
    pontos: truncado ? [] : pontos,
    destaques,
    truncado,
    quantidadeDePontos: pontos.length,
  };
}
