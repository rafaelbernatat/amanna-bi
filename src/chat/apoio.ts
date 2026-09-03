/**
 * As métricas de apoio: o que explica o número (T-328).
 *
 * O painel que detalha a métrica dá a **composição** (a ponte da DRE). Isto dá
 * o **contexto**: para o ROE, lucro líquido e patrimônio; para a liquidez
 * corrente, o que há de caixa, recebível e estoque. O estágio 2 lê cada uma
 * pelo mesmo `lerMetrica` e no mesmo recorte — nenhuma nasce fora do catálogo,
 * e todas passam pelo verificador como qualquer outro número.
 *
 * ## Por que em código, e não no YAML
 *
 * O esquema do catálogo é fechado de propósito: o que Controladoria revisa lá é
 * **definição** — fórmula, fonte, unidade, sentido. "O que o chat cita ao
 * explicar" é editorial do chat, e mora com o chat, como `roteamento.ts` já faz
 * para tela e painel. Um teste faz este mapa tão fechado quanto o esquema: id
 * que não existe no catálogo reprova a suíte.
 */

/** Quantas de apoio uma principal pode declarar. */
export const MAXIMO_DE_APOIO = 4;

export const APOIO: Readonly<Record<string, readonly string[]>> = {
  ebitda: ["margem_ebitda", "conversao_de_caixa", "fco"],
  margem_bruta: ["receita_liquida"],
  margem_liquida: ["lucro_liquido", "receita_liquida"],
  ciclo_financeiro: ["pme", "pmr", "pmp"],
  pmr: ["inadimplencia", "ciclo_financeiro"],
  pmp: ["pmr", "ciclo_financeiro"],
  pme: ["ciclo_financeiro"],
  crescimento_yoy: ["receita_liquida"],
};

export function apoioDe(metrica: string): readonly string[] {
  return APOIO[metrica] ?? [];
}
