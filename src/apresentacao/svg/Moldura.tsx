import type { ReactNode } from "react";

import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";
import type { Eixo } from "@/apresentacao/svg/nucleo";

/**
 * A moldura de um grafico cartesiano: caixa, grade e rotulos (T-129).
 *
 * Server Component puro. O `viewBox` e fixo e a largura e 100%, entao o desenho
 * escala sem ser remedido: nao ha `ResizeObserver`, nao ha leitura de largura e
 * nao ha segunda pintura. A altura vem da razao do proprio viewBox, que e o que
 * mantem o CLS em zero.
 */
export function Moldura({
  eixo,
  titulo,
  children,
}: {
  readonly eixo: Eixo;
  readonly titulo: string;
  readonly children?: ReactNode;
}) {
  return (
    <svg
      viewBox={eixo.viewBox}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={titulo}
      style={{
        display: "block",
        width: "100%",
        height: "auto",
        aspectRatio: `${eixo.largura} / ${eixo.altura}`,
      }}
    >
      <g>
        {eixo.grade.map((linha, i) => (
          <line
            key={`grade-${String(i)}`}
            x1={linha.x1}
            y1={linha.y1}
            x2={linha.x2}
            y2={linha.y2}
            stroke={linha.zero ? PALETA.textoFraco : PALETA.grade}
            strokeWidth={linha.zero ? 1 : 0.75}
          />
        ))}
      </g>

      <g>
        {eixo.rotulos.map((rotulo, i) => (
          <text
            key={`rotulo-${String(i)}`}
            x={rotulo.x}
            y={rotulo.y}
            fill={PALETA.textoFraco}
            fontSize={9.5}
            fontWeight={500}
            textAnchor="end"
            fontFamily={TIPOGRAFIA.mono}
          >
            {rotulo.texto}
          </text>
        ))}
      </g>

      {children}
    </svg>
  );
}
