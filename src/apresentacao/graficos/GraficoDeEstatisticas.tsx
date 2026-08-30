import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";

/**
 * Primitiva `estatisticas` (T-164).
 *
 * Números soltos, sem eixo. É a forma dos painéis de leitura rápida — "Custo do
 * turnover em reais", "Resumo do funil" — onde o que se lê são três a cinco
 * grandezas que não compartilham escala e por isso não compartilham gráfico.
 *
 * É também a única forma em que a **unidade varia item a item**: um resumo
 * mistura `BRL_mi` e `pct` na mesma caixa. Por isso cada estatística chega aqui
 * com o texto já formatado — a unidade dela é dela, e escolher uma unidade
 * dominante para a caixa inteira seria afirmar algo falso.
 *
 * A cor vem por propriedade, do sentido que o envelope declara: verde quando
 * subir é bom, vermelho quando é ruim. Cor nunca é o único sinal (seção 13) —
 * o rótulo e o rodapé dizem a mesma coisa em texto.
 *
 * Server Component: três números numa grade não precisam do cliente.
 */

/**
 * `min-width: 0` na celula da grade.
 *
 * Sem isto, uma celula de grade nunca encolhe abaixo do conteudo dela, e um
 * rotulo longo estoura a caixa em vez de cortar com reticencias. E geometria,
 * nao medida — por isso tem nome em vez de ficar solto.
 */
const SEM_LARGURA_MINIMA = 0;

export type Estatistica = {
  readonly rotulo: string;
  /** O valor já formatado, ou o travessão quando não há dado (PR-4). */
  readonly texto: string;
  readonly rodape: string | null;
  readonly cor: string;
};

export function GraficoDeEstatisticas({
  estatisticas,
  colunas,
}: {
  readonly estatisticas: readonly Estatistica[];
  /**
   * Quantas colunas a grade tem.
   *
   * Vem de quem chama, e não de uma medição aqui: o painel sabe quantas colunas
   * da grade de 12 ocupa (seção 5), e é isso que decide se cinco números cabem
   * lado a lado ou empilham. Medir a largura no cliente para descobrir o mesmo
   * custaria a segunda pintura que T-129 zerou.
   */
  readonly colunas: number;
}) {
  return (
    <div
      style={{
        height: "100%",
        display: "grid",
        gridTemplateColumns: `repeat(${String(colunas)}, minmax(0, 1fr))`,
        gap: 10,
        overflow: "hidden",
      }}
    >
      {estatisticas.map((e) => (
        <div
          key={e.rotulo}
          data-estatistica={e.rotulo}
          style={{
            minWidth: SEM_LARGURA_MINIMA,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 3,
            padding: "12px 14px",
            background: PALETA.superficieSuave,
            border: `1px solid ${PALETA.borda}`,
            borderRadius: 15,
            borderLeft: `3px solid ${e.cor}`,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              font: `500 9.5px/1.25 ${TIPOGRAFIA.texto}`,
              color: PALETA.textoTerciario,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {e.rotulo}
          </div>
          <div
            style={{
              font: `500 23px/1.05 ${TIPOGRAFIA.titulo}`,
              color: e.cor,
              letterSpacing: "-.012em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {e.texto}
          </div>
          {e.rodape === null ? null : (
            <div
              style={{
                font: `400 9.5px/1.4 ${TIPOGRAFIA.texto}`,
                color: PALETA.textoFraco,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {e.rodape}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
