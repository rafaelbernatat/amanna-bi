import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";

/**
 * Primitiva `dispersao` (T-165).
 *
 * Duas medidas por ponto, cada eixo com a sua unidade — custo de pessoal contra
 * retorno por área, margem de contribuição por cliente. É a única forma do
 * Anexo A em que o painel afirma uma **relação** e não uma série, e por isso a
 * única em que os dois eixos precisam declarar o que medem: sem os rótulos, uma
 * nuvem de pontos é um borrão.
 *
 * O rótulo de cada ponto fica escrito ao lado dele, e não em `tooltip`. Um
 * painel que só se lê passando o mouse não se lê impresso, não se lê por leitor
 * de tela e não se lê numa reunião projetada (seção 13).
 *
 * Server Component: posição percentual dentro de uma caixa.
 */

/** Fração convertida em porcentagem de CSS. */
const PERCENTUAL_CHEIO = 100;

/** Largura da coluna de rótulos do eixo vertical. */
const LARGURA_DO_EIXO = 44;

export type PontoDeDispersao = {
  readonly rotulo: string;
  /** Posição no eixo, de 0 a 1, já resolvida contra o domínio pelo servidor. */
  readonly fracaoX: number;
  readonly fracaoY: number;
  /** Diâmetro do ponto quando há terceira medida (bolha). */
  readonly diametro: number;
  readonly cor: string;
};

export type EixoDaDispersao = {
  readonly rotulo: string;
  /** Os extremos do eixo, já formatados em pt-BR. */
  readonly minimo: string;
  readonly maximo: string;
};

export function GraficoDeDispersao({
  pontos,
  eixoX,
  eixoY,
}: {
  readonly pontos: readonly PontoDeDispersao[];
  readonly eixoX: EixoDaDispersao;
  readonly eixoY: EixoDaDispersao;
}) {
  const marca = {
    font: `500 9px/1.2 ${TIPOGRAFIA.mono}`,
    color: PALETA.textoFraco,
  } as const;

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        overflow: "hidden",
      }}
    >
      <div style={{ flex: "1 1 auto", display: "flex", gap: 6 }}>
        <div
          style={{
            flex: "none",
            width: LARGURA_DO_EIXO,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            alignItems: "flex-end",
            ...marca,
          }}
        >
          <span>{eixoY.maximo}</span>
          <span>{eixoY.minimo}</span>
        </div>

        <div
          data-area-de-desenho=""
          style={{
            flex: "1 1 auto",
            position: "relative",
            borderLeft: `1px solid ${PALETA.bordaForte}`,
            borderBottom: `1px solid ${PALETA.bordaForte}`,
          }}
        >
          {pontos.map((ponto) => (
            <div
              key={ponto.rotulo}
              data-ponto={ponto.rotulo}
              style={{
                position: "absolute",
                left: `${String(ponto.fracaoX * PERCENTUAL_CHEIO)}%`,
                bottom: `${String(ponto.fracaoY * PERCENTUAL_CHEIO)}%`,
                transform: "translate(-50%, 50%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
              }}
            >
              <span
                style={{
                  font: `600 9px/1.2 ${TIPOGRAFIA.texto}`,
                  color: PALETA.textoSecundario,
                  whiteSpace: "nowrap",
                }}
              >
                {ponto.rotulo}
              </span>
              <span
                style={{
                  width: ponto.diametro,
                  height: ponto.diametro,
                  borderRadius: ponto.diametro,
                  background: ponto.cor,
                  border: `1.4px solid ${PALETA.superficieAlta}`,
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <span style={{ flex: "none", width: LARGURA_DO_EIXO }} />
        <span
          style={{
            flex: "1 1 auto",
            display: "flex",
            justifyContent: "space-between",
            ...marca,
          }}
        >
          <span>{eixoX.minimo}</span>
          <span>{eixoX.maximo}</span>
        </span>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 14,
          font: `500 9.5px/1.2 ${TIPOGRAFIA.texto}`,
          color: PALETA.textoTerciario,
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        <span>{`↔ ${eixoX.rotulo}`}</span>
        <span>{`↕ ${eixoY.rotulo}`}</span>
      </div>
    </div>
  );
}
