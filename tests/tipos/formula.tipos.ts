/**
 * Prova em tempo de compilação: fórmula vazia não entra no envelope (T-109).
 *
 * Este arquivo não roda. É conferido por `tsc --noEmit`, e existe porque a
 * proteção da marca **não é testável em execução**: se `Formula` voltar a ser
 * `string`, o construtor continua recusando vazio, o schema continua com
 * `minLength`, e a suíte inteira continua verde. O único lugar onde a perda da
 * marca aparece é o compilador.
 *
 * Foi exatamente assim que a lacuna apareceu: ao provocar a remoção da marca,
 * nenhum teste caiu.
 */

import { formula, type Formula, type PainelBarras } from "@/semantica/painel";

/* ------------------------------------------------------------------ *
 * A marca não sai de literal
 * ------------------------------------------------------------------ */

const legitima: Formula = formula("desvio = realizado - orcado");
void legitima;

// @ts-expect-error string comum não é Formula: precisa passar por formula()
const crua: Formula = "desvio = realizado - orcado";
void crua;

// @ts-expect-error e string vazia muito menos
const vazia: Formula = "";
void vazia;

// @ts-expect-error nem por template
const montada: Formula = `${"a"} = ${"b"}`;
void montada;

/* ------------------------------------------------------------------ *
 * O envelope não aceita o atalho
 * ------------------------------------------------------------------ */

const base = {
  forma: "barras",
  id: "orc-desvio",
  title: "Desvio por centro de custo",
  unit: "BRL_mi",
  categories: [],
  series: [],
  total: null,
  note: null,
  asOf: "2026-12-31",
} as const;

const valido: PainelBarras = {
  ...base,
  formula: formula("desvio = realizado - orcado"),
};
void valido;

const semFormula: PainelBarras = {
  ...base,
  // @ts-expect-error é o achado 10 do Anexo D: desligar a fórmula pondo vazio
  formula: "",
};
void semFormula;

const comStringCrua: PainelBarras = {
  ...base,
  // @ts-expect-error mesmo com texto de verdade, precisa passar pelo construtor
  formula: "desvio = realizado - orcado",
};
void comStringCrua;
