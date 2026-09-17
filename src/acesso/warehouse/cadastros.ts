/**
 * Os cadastros que são vocabulário do produto, e não dado da base.
 *
 * Faixa etária, tempo de casa e faixa salarial são bandas que o produto
 * define — as mesmas de `vw_dim_*` nas fixtures e das funções
 * `amanna.faixa_*` em ferramentas/dados/sql/005_views_rh.sql. Um teste confere
 * que as três listas coincidem com as das fixtures; se alguém mudar uma banda
 * num lugar só, reprova.
 *
 * Aging e componentes do custo do turnover também são vocabulário fechado.
 */

import type { FaixaDeCadastro, ItemDeCadastro } from "@/acesso/calculo/base";

export const FAIXAS_DE_AGING: readonly ItemDeCadastro[] = [
  { codigo: "a-vencer", rotulo: "A vencer" },
  { codigo: "1-30d", rotulo: "1–30d" },
  { codigo: "31-60d", rotulo: "31–60d" },
  { codigo: "61-90d", rotulo: "61–90d" },
  { codigo: "mais-90d", rotulo: "> 90d" },
];

const MIL = 1000;

export const FAIXA_SALARIAL: readonly FaixaDeCadastro[] = [
  { codigo: "ate-3k", rotulo: "≤ 3k", de: 0, ate: 3 * MIL },
  { codigo: "3-6k", rotulo: "3–6k", de: 3 * MIL, ate: 6 * MIL },
  { codigo: "6-10k", rotulo: "6–10k", de: 6 * MIL, ate: 10 * MIL },
  { codigo: "10-18k", rotulo: "10–18k", de: 10 * MIL, ate: 18 * MIL },
  { codigo: "18-30k", rotulo: "18–30k", de: 18 * MIL, ate: 30 * MIL },
  { codigo: "acima-30k", rotulo: "> 30k", de: 30 * MIL, ate: null },
];

/** As quebras cujos valores são bandas do produto, em código e ordem. */
export const QUEBRAS_FIXAS = {
  faixa_etaria: ["18-24", "25-34", "35-44", "45-54", "55-mais"],
  tempo_de_casa: [
    "menos-de-1-ano",
    "1-3-anos",
    "3-5-anos",
    "5-10-anos",
    "10-mais-anos",
  ],
  faixa_salarial: FAIXA_SALARIAL.map((f) => f.codigo),
} as const;

/** Os componentes do custo do turnover que contam como reposição. */
export const COMPONENTES_DE_REPOSICAO: readonly string[] = [
  "recrutamento",
  "ramp-up",
  "produtividade",
];
