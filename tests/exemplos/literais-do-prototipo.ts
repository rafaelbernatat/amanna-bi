/**
 * Arquivo de exemplo de T-141 — NÃO é código de produto.
 *
 * Reproduz os cinco literais reais que o achado 5 do Anexo D do PRD encontrou
 * no protótipo: KPIs escritos à mão que não reagem a filtro nenhum. Existe para
 * que o teste da regra de AST tenha o que apontar, e para que a regra prove que
 * aponta. Fica fora do lint do repositório de propósito — se entrasse, o lint
 * ficaria permanentemente vermelho.
 *
 * Os cinco: 74 (cobertura da pesquisa), 54.3 (concentração top 10), 4.1
 * (inadimplência), 40.0 (conclusão de trilha) e -0.7 (variação de eNPS).
 */

import { formatarValor } from "@/apresentacao/formato/formato";

// 1. Cobertura da pesquisa: 74% digitado direto no formatador.
export const cobertura = formatarValor(74, "pct");

// 2. Concentração top 10: 54,3% igualmente fixo.
export const concentracao = formatarValor(54.3, "pct");

// 3. Inadimplência: 4,1% num campo de KPI.
export const kpiInadimplencia = {
  label: "Inadimplência",
  value: 4.1,
  sentiment: "bad",
};

// 4. Conclusão média de trilha: 40,0% num campo de KPI.
export const kpiConclusao = {
  label: "Conclusão média",
  value: 40.0,
};

// 5. Variação de eNPS: -0,7 p.p. no delta.
export const kpiEnps = {
  label: "eNPS",
  delta: -0.7,
};

// Contraexemplos: geometria e índice não são valor de negócio, e a regra
// precisa deixar os dois em paz.
export const geometria = { largura: 74, altura: 216, span: 4 };
export const primeiroMes = ["jan", "fev"][0];

// Contraexemplo: valor vindo da camada de dados atravessa o formatador.
export function exibir(valorLido: number): string {
  return formatarValor(valorLido, "pct");
}

// Exceção nomeada: meta vem do catálogo (PRD seção 9.4), não da imaginação.
export const META_DE_TURNOVER = 14;
export const metaFormatada = formatarValor(META_DE_TURNOVER, "pct");
