/**
 * De uma métrica para a tela e o painel que a mostram (seção 6.5 e RF-13).
 *
 * O chat não responde só com número: ele **navega**. *"Quando o chat responde,
 * ele navega até a tela citada, rola até o painel e o marca."* Para isso
 * precisa saber, dada uma métrica, onde ela mora.
 *
 * ## O mapa já existe, repartido em dois registros
 *
 * `ORIGEM_DOS_KPIS` diz qual métrica alimenta cada cartão; `REGISTRO_DE_KPIS`
 * diz em que tela o cartão está e qual painel o detalha. Juntar os dois dá o
 * caminho inteiro — e juntá-los aqui, em vez de escrever uma terceira tabela,
 * é o que impede o mapa de sair de sincronia no dia em que um painel mudar de
 * tela.
 *
 * O Anexo B do PRD tem essa tabela escrita à mão para as 21 intenções. Ela é a
 * origem dos dois registros, e não uma terceira fonte: um teste confere que o
 * que se deriva aqui bate com o que o Anexo declara.
 */

import { REGISTRO_DE_KPIS } from "@/semantica/kpis";
import { ORIGEM_DOS_KPIS } from "@/semantica/origem-de-kpi";

/** Onde uma métrica é mostrada. */
export type Destino = {
  /** A rota da tela, como `fin/visao`. */
  readonly tela: string;
  /** O painel que detalha a métrica, quando existe um. */
  readonly painel: string | null;
  /** O cartão de onde a métrica veio, para quem quiser rastrear. */
  readonly kpi: string;
};

/**
 * A tela e o painel de uma métrica, ou `null` se ela não aparece em nenhuma.
 *
 * Métrica sem destino não é erro: o catálogo tem 65 entradas e as telas mostram
 * menos que isso. O chat responde com o número e sem navegação, que é melhor do
 * que recusar a pergunta por não saber para onde ir.
 *
 * Quando a mesma métrica alimenta mais de um cartão, vence o primeiro do
 * registro — que é a ordem do Anexo A, isto é, a ordem em que as telas
 * aparecem. Levar para a primeira tela onde a métrica é a leitura principal é o
 * que a seção 6.5 quer dizer com "a tela citada".
 */
export function destinoDaMetrica(metrica: string): Destino | null {
  for (const origem of ORIGEM_DOS_KPIS) {
    if (origem.metrica !== metrica) continue;
    const registro = REGISTRO_DE_KPIS.find((k) => k.id === origem.kpi);
    if (registro === undefined) continue;
    return {
      tela: registro.tela,
      painel: registro.detalhadoPor,
      kpi: registro.id,
    };
  }
  return null;
}

/** As métricas que têm destino. Usado pelo teste e pelas sugestões. */
export function metricasComDestino(): readonly string[] {
  return [
    ...new Set(
      ORIGEM_DOS_KPIS.filter((o) => destinoDaMetrica(o.metrica) !== null).map(
        (o) => o.metrica,
      ),
    ),
  ];
}
