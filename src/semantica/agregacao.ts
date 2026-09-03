/**
 * Agregação por tipo de medida, e as guardas de precisão (T-104).
 *
 * Regra 4 da seção 9.2 do PRD: todo fato é mensal e aditivo, **exceto** taxas
 * (turnover, margens, PMR) e estoques (headcount, saldo de caixa).
 *
 * O erro que esta função existe para tornar impossível: somar percentual ao
 * longo do período. Um recorte de 3 meses com turnover 1,2% / 1,4% / 1,3% não
 * tem turnover de 3,9% — tem 1,3% recomputado sobre os 3 meses. O protótipo não
 * distingue, e o painel `tov-12m` só está certo por acidente do dataset.
 *
 * Arredondamento não acontece aqui. Seção 13: só na apresentação, e o módulo de
 * formatação (T-125) é o único lugar onde isso é permitido.
 */

import type { Agregacao, Unidade } from "@/semantica/contrato";
import {
  comValor,
  dividir,
  temValor,
  vazio,
  type Talvez,
} from "@/semantica/vazio";

/** Unidades que **não** podem ser somadas ao longo do período. */
/**
 * As unidades que somar ao longo do período é sempre errado.
 *
 * `pct` e `pp` desde sempre; `pontos` e `anos` desde D-H45; `vezes` desde
 * D-H60. eNPS de doze meses somados dá um número que não existe, e a mesma
 * coisa vale para idade média e para um múltiplo como liquidez corrente: são
 * razões disfarçadas de contagem, e se agregam por `ratio` ou `last`.
 */
const NAO_SOMAVEIS: readonly Unidade[] = [
  "pct",
  "pp",
  "pontos",
  "anos",
  "vezes",
];

export class SomaInvalida extends Error {
  constructor(unidade: Unidade) {
    super(
      `Somar '${unidade}' ao longo do período é sempre errado (PRD seção 9.2 regra 4). ` +
        "Use agg='ratio', que recompõe numerador e denominador.",
    );
    this.name = "SomaInvalida";
  }
}

/** Um mês de uma medida. `ratio` precisa dos dois lados, não do resultado. */
export type Ponto = {
  readonly mes: string;
  readonly valor: number | null;
  /** Só em `ratio`: o numerador do mês. */
  readonly numerador?: number | null;
  /** Só em `ratio`: o denominador do mês. */
  readonly denominador?: number | null;
};

/**
 * Agrega uma série mensal segundo o tipo declarado da medida no catálogo.
 *
 * `sum`   — aditiva: soma os meses do recorte
 * `last`  — estoque: o último mês do recorte, não a soma nem a média
 * `ratio` — taxa: recompõe numerador e denominador e divide uma vez só
 */
export function agregar(
  pontos: readonly Ponto[],
  agg: Agregacao,
  unidade: Unidade,
): Talvez<number> {
  if (pontos.length === 0) return vazio("sem_dado_no_recorte");

  switch (agg) {
    case "sum": {
      if (NAO_SOMAVEIS.includes(unidade)) throw new SomaInvalida(unidade);
      const validos = pontos.filter((p) => p.valor !== null);
      if (validos.length === 0) return vazio("sem_dado_no_recorte");
      return comValor(validos.reduce((t, p) => t + (p.valor ?? 0), 0));
    }

    case "last": {
      // O último do recorte, e não o último não-nulo: se dezembro não tem dado,
      // a resposta é "sem dado em dezembro", não "novembro serve".
      const ultimo = pontos[pontos.length - 1];
      if (ultimo === undefined || ultimo.valor === null) {
        return vazio("sem_dado_no_recorte");
      }
      return comValor(ultimo.valor);
    }

    case "ratio": {
      const comPartes = pontos.filter(
        (p) => p.numerador !== null && p.denominador !== null,
      );
      if (comPartes.length === 0) return vazio("sem_dado_no_recorte");

      let numerador = 0;
      let denominador = 0;
      for (const p of comPartes) {
        numerador += p.numerador ?? 0;
        denominador += p.denominador ?? 0;
      }
      // Uma divisão só, no fim — nunca a média das divisões mensais.
      return dividir(numerador, denominador);
    }
  }
}

/**
 * A variação entre dois valores, na unidade correta.
 *
 * Taxa varia em **pontos percentuais** (diferença), não em percentual da taxa.
 * Dizer que o turnover "subiu 30%" quando foi de 14% para 18,4% é errado: subiu
 * 4,4 p.p. As duas leituras existem, e confundi-las é como se justifica número
 * na reunião errada.
 */
export function variacao(
  atual: Talvez<number>,
  anterior: Talvez<number>,
  unidade: Unidade,
): { readonly delta: Talvez<number>; readonly unidade: Unidade } {
  if (!temValor(atual) || !temValor(anterior)) {
    return { delta: vazio("sem_dado_no_recorte"), unidade };
  }
  if (unidade === "pct" || unidade === "pp") {
    return { delta: comValor(atual.valor - anterior.valor), unidade: "pp" };
  }
  return {
    delta: dividir(atual.valor - anterior.valor, anterior.valor),
    unidade: "pct",
  };
}

/** A unidade permite soma ao longo do período? */
export function podeSomar(unidade: Unidade): boolean {
  return !NAO_SOMAVEIS.includes(unidade);
}
