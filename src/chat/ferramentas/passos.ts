/**
 * O que a conversa mostra enquanto o laço lê (T-434).
 *
 * Uma frase determinística por pedido validado — nunca texto do modelo, nunca
 * número: só o rótulo da métrica e o nome da dimensão. É o que a bolha exibe
 * no lugar de "Lendo os dados…" quando a pergunta é composta e a resposta
 * leva dez segundos em vez de dois.
 */

import type { PedidoValidado } from "@/chat/ferramentas/validar";
import { CATALOGO_GERADO } from "@/semantica/catalogo-gerado";
import type { DimensaoDeRanking } from "@/semantica/contrato";

/** Como cada dimensão de ranking se chama numa frase. */
export const ROTULO_DA_DIMENSAO: Readonly<Record<DimensaoDeRanking, string>> = {
  area: "área",
  centro_custo: "centro de custo",
  cliente: "cliente",
  fornecedor: "fornecedor",
  conta: "conta",
  linha_dre: "linha da DRE",
  uf: "UF",
  segmento: "segmento",
};

/** O que a bolha diz quando as leituras acabaram e o modelo está escrevendo. */
export const PASSO_DE_REDACAO = "Redigindo com o que foi lido…";

function rotuloDe(metrica: string): string {
  return CATALOGO_GERADO[metrica]?.rotulo ?? metrica;
}

/** A frase de andamento de um pedido, antes de ele ser executado. */
export function fraseDePasso(pedido: PedidoValidado): string {
  switch (pedido.nome) {
    case "ler_metrica":
      return `Lendo ${rotuloDe(pedido.metrica)}…`;
    case "serie_da_metrica":
      return `Lendo ${rotuloDe(pedido.metrica)} mês a mês…`;
    case "comparar_metricas":
      return `Comparando ${pedido.metricas.map(rotuloDe).join(" e ")}…`;
    case "variacao":
      return `Comparando ${rotuloDe(pedido.metrica)} com o ano anterior…`;
    case "ranking":
    case "decompor":
      return `Lendo ${rotuloDe(pedido.metrica)} por ${ROTULO_DA_DIMENSAO[pedido.dimensao]}…`;
    case "explicar_grafico":
      return "Lendo o gráfico em foco…";
    case "listar_metricas":
      return "Procurando a métrica no catálogo…";
    // Determinística e sem número, como as outras: o SQL não vai para a tela
    // aqui — ele aparece depois, em "consulta registrada", junto da resposta.
    case "consultar_dados":
      return "Consultando o banco…";
  }
}
