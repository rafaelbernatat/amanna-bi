import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";

/**
 * Primitiva `cascata` (T-165).
 *
 * A ponte de um total a outro: receita líquida ao lucro líquido, saldo inicial
 * ao saldo final. Cada degrau começa onde o anterior parou, menos os que o
 * envelope marca como `ehTotal` — esses assentam no eixo, porque são o
 * acumulado e não uma variação sobre ele.
 *
 * A marca importa e o desenho depende dela: sem ela, "Lucro líquido" empilharia
 * sobre "Não operacional" e a ponte fecharia no dobro do valor. Desenharia
 * errado *plausivelmente*, que é a pior forma de desenhar errado — por isso o
 * degrau chega aqui com o intervalo já resolvido, `de` e `ate`, e este
 * componente não decide o que empilha sobre o quê.
 *
 * ## Por que não é SVG
 *
 * Um `viewBox` fixo obriga a escolher entre distorcer o texto
 * (`preserveAspectRatio="none"`) e deixar tarja nas laterais. Em barras
 * verticais a posição é percentual em cima e embaixo, e porcentagem o
 * navegador resolve sozinho, em qualquer largura, sem medir nada — que é o
 * mesmo motivo de `barras-horizontais` também não ser SVG.
 *
 * Server Component.
 */

/** Fração convertida em porcentagem de CSS. */
const PERCENTUAL_CHEIO = 100;

/**
 * Altura mínima de um degrau, em porcentagem da caixa.
 *
 * Uma variação perto de zero desenharia uma barra de altura zero, que some.
 * O mínimo faz o degrau existir na tela; o número escrito em cima diz quanto é.
 */
const ALTURA_MINIMA = 0.6;

/**
 * `min-width: 0` na coluna do degrau.
 *
 * Um item de flex nao encolhe abaixo do conteudo dele sem isto, e o nome de um
 * degrau longo alargaria a coluna em vez de cortar com reticencias — o que
 * espremeria os degraus vizinhos e faria a ponte mentir sobre a proporcao.
 */
const SEM_LARGURA_MINIMA = 0;

export type DegrauDeCascata = {
  readonly nome: string;
  /** Onde o degrau começa e termina, no eixo, já acumulado pelo servidor. */
  readonly de: number;
  readonly ate: number;
  /** A variação já formatada em pt-BR, com sinal. */
  readonly texto: string;
  readonly cor: string;
};

export function GraficoDeCascata({
  degraus,
  dominio,
}: {
  readonly degraus: readonly DegrauDeCascata[];
  /** O intervalo do eixo, de `configuracaoDeEixo`. */
  readonly dominio: readonly [number, number];
}) {
  const [minimo, maximo] = dominio;
  const amplitude = maximo - minimo;

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "stretch",
        gap: 6,
        overflow: "hidden",
      }}
    >
      {degraus.map((degrau) => {
        const alto = Math.max(degrau.de, degrau.ate);
        const baixo = Math.min(degrau.de, degrau.ate);
        const topo = ((maximo - alto) / amplitude) * PERCENTUAL_CHEIO;
        const altura = Math.max(
          ((alto - baixo) / amplitude) * PERCENTUAL_CHEIO,
          ALTURA_MINIMA,
        );

        return (
          <div
            key={degrau.nome}
            data-degrau={degrau.nome}
            style={{
              flex: "1 1 0",
              minWidth: SEM_LARGURA_MINIMA,
              display: "flex",
              flexDirection: "column",
              gap: 3,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                font: `600 9.5px/1.2 ${TIPOGRAFIA.mono}`,
                color: PALETA.textoSecundario,
                textAlign: "center",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {degrau.texto}
            </div>

            <div style={{ flex: "1 1 auto", position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: `${String(topo)}%`,
                  height: `${String(altura)}%`,
                  background: degrau.cor,
                  borderRadius: 2,
                }}
              />
            </div>

            <div
              style={{
                font: `500 8.5px/1.25 ${TIPOGRAFIA.texto}`,
                color: PALETA.textoFraco,
                textAlign: "center",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {degrau.nome}
            </div>
          </div>
        );
      })}
    </div>
  );
}
