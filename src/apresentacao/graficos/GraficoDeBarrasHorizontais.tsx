import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";

/**
 * Primitiva `barras-horizontais` (T-164).
 *
 * A forma mais usada do Anexo A — 18 dos 71 painéis. É a resposta para
 * categoria com nome longo: "Tecnologia da informação" não cabe num eixo
 * vertical sem virar rótulo girado, e rótulo girado é o que faz uma tela
 * parar de ser lida numa passada (seção 5).
 *
 * Porta a forma `isHBars` do protótipo: rótulo à direita, trilho, preenchimento
 * e o valor em mono na coluna da direita. Três colunas fixas, e não um eixo —
 * o número está escrito ao lado de cada barra, então a grade seria ruído.
 *
 * ## Server Component, e sem recharts
 *
 * Não há eixo para medir nem escala para resolver no cliente: a largura de cada
 * barra é uma porcentagem do próprio trilho, e porcentagem o navegador resolve
 * no primeiro quadro. Passar por `ResponsiveContainer` custaria JavaScript e
 * uma segunda pintura para desenhar o que é uma `div` com `width: 62%` — e a
 * segunda pintura é exatamente o que T-129 mediu e zerou.
 *
 * Não lê dado, não calcula medida e não formata: recebe a fração já resolvida
 * contra o máximo e o texto já formatado pelo servidor (princípio PR-1).
 */

/** Largura das colunas de rótulo e de valor, em pixels. */
const LARGURA_DO_ROTULO = 96;
const LARGURA_DO_VALOR = 62;

/** Espessura do trilho e da barra. */
const ESPESSURA = 11;

/** Fração convertida em porcentagem de CSS. */
const PERCENTUAL_CHEIO = 100;

/** Largura do traço de referência (meta, orçado, benchmark). */
const ESPESSURA_DA_MARCA = 1.5;

export type BarraHorizontal = {
  readonly rotulo: string;
  /**
   * Quanto da barra preencher, de 0 a 1, já resolvido contra o máximo.
   *
   * `null` é "sem dado nesta categoria" e não zero: a barra não é desenhada e
   * o valor sai como travessão (princípio PR-4). Uma barra de largura zero é
   * indistinguível de uma medida que deu zero.
   */
  readonly fracao: number | null;
  /** O valor já formatado em pt-BR pelo servidor. */
  readonly texto: string;
  readonly cor: string;
  /** Onde cai a referência, de 0 a 1. Ausente quando não há meta. */
  readonly marca?: number;
};

export function GraficoDeBarrasHorizontais({
  linhas,
}: {
  readonly linhas: readonly BarraHorizontal[];
}) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 7,
        overflow: "hidden",
      }}
    >
      {linhas.map((linha) => (
        <div
          key={linha.rotulo}
          data-barra={linha.rotulo}
          style={{
            display: "grid",
            gridTemplateColumns: `${String(LARGURA_DO_ROTULO)}px minmax(0, 1fr) ${String(LARGURA_DO_VALOR)}px`,
            alignItems: "center",
            gap: 9,
          }}
        >
          <div
            style={{
              font: `500 10.5px/1.3 ${TIPOGRAFIA.texto}`,
              color: PALETA.textoSecundario,
              textAlign: "right",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {linha.rotulo}
          </div>

          <div
            style={{
              height: ESPESSURA,
              background: PALETA.grade,
              borderRadius: ESPESSURA,
              position: "relative",
              overflow: "hidden",
            }}
          >
            {linha.fracao === null ? null : (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${String(linha.fracao * PERCENTUAL_CHEIO)}%`,
                  background: linha.cor,
                  borderRadius: ESPESSURA,
                }}
              />
            )}
            {linha.marca === undefined ? null : (
              <div
                data-marca-de-referencia=""
                style={{
                  position: "absolute",
                  left: `${String(linha.marca * PERCENTUAL_CHEIO)}%`,
                  top: 0,
                  bottom: 0,
                  width: ESPESSURA_DA_MARCA,
                  background: PALETA.comparacao,
                }}
              />
            )}
          </div>

          <div
            style={{
              font: `600 10.5px/1.3 ${TIPOGRAFIA.mono}`,
              color: linha.fracao === null ? PALETA.textoFraco : PALETA.texto,
              textAlign: "right",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {linha.texto}
          </div>
        </div>
      ))}
    </div>
  );
}
