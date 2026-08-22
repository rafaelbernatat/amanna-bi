"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import type { ConfiguracaoDeEixo } from "@/apresentacao/graficos/nucleo";
import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";

/**
 * Primitiva `barras`, com eixo secundario opcional (T-130).
 *
 * Reproduz a forma de `rh-headcount`: barras de admissoes e desligamentos no
 * eixo esquerdo, linha de headcount FTE no eixo direito. E por isso que a base
 * e o `ComposedChart` e nao o `BarChart` — as duas escalas convivem no mesmo
 * desenho, com dominios calculados a parte no servidor.
 *
 * Nao le dado, nao calcula, nao formata: recebe series prontas (principio PR-1).
 */

export type SerieDeBarras = {
  readonly nome: string;
  readonly cor: string;
  /** Uma entrada por categoria, na mesma ordem de `categorias`. */
  readonly valores: readonly number[];
};

export type SerieDeLinha = {
  readonly nome: string;
  readonly cor: string;
  readonly valores: readonly number[];
};

const EIXO = {
  fill: PALETA.textoFraco,
  fontSize: 9.5,
  fontFamily: TIPOGRAFIA.mono,
} as const;

export function GraficoDeBarras({
  categorias,
  barras,
  eixo,
  linhaSecundaria,
  eixoSecundario,
  comLegenda = false,
}: {
  readonly categorias: readonly string[];
  readonly barras: readonly SerieDeBarras[];
  readonly eixo: ConfiguracaoDeEixo;
  /** Serie desenhada como linha, no eixo da direita. */
  readonly linhaSecundaria?: SerieDeLinha;
  readonly eixoSecundario?: ConfiguracaoDeEixo;
  readonly comLegenda?: boolean;
}) {
  const dados = categorias.map((categoria, i) => {
    const linha: Record<string, number | string> = { categoria };
    for (const serie of barras) {
      linha[serie.nome] = serie.valores[i] ?? 0;
    }
    if (linhaSecundaria !== undefined) {
      linha[linhaSecundaria.nome] = linhaSecundaria.valores[i] ?? 0;
    }
    return linha;
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={dados}
        margin={{
          top: 8,
          right: linhaSecundaria === undefined ? 12 : 4,
          bottom: 4,
          left: 4,
        }}
      >
        <CartesianGrid
          stroke={PALETA.grade}
          strokeWidth={0.75}
          vertical={false}
        />
        <XAxis
          dataKey="categoria"
          interval={eixo.intervaloDeRotulo}
          tickLine={false}
          axisLine={{ stroke: PALETA.bordaForte }}
          tick={EIXO}
        />
        <YAxis
          yAxisId="esquerdo"
          domain={[...eixo.dominio]}
          ticks={[...eixo.cortes]}
          tickLine={false}
          axisLine={false}
          width={44}
          tick={EIXO}
        />
        {eixoSecundario !== undefined ? (
          <YAxis
            yAxisId="direito"
            orientation="right"
            domain={[...eixoSecundario.dominio]}
            ticks={[...eixoSecundario.cortes]}
            tickLine={false}
            axisLine={false}
            width={44}
            tick={EIXO}
          />
        ) : null}

        {eixo.temLinhaDeZero ? (
          <ReferenceLine
            yAxisId="esquerdo"
            y={0}
            stroke={PALETA.textoFraco}
            strokeWidth={1}
          />
        ) : null}

        {comLegenda ? (
          <Legend
            verticalAlign="top"
            align="left"
            height={22}
            iconType="square"
            iconSize={8}
            wrapperStyle={{
              font: `500 9.5px ${TIPOGRAFIA.mono}`,
              color: PALETA.textoTerciario,
            }}
          />
        ) : null}

        {barras.map((serie) => (
          <Bar
            key={serie.nome}
            yAxisId="esquerdo"
            dataKey={serie.nome}
            fill={serie.cor}
            radius={[2, 2, 0, 0]}
            isAnimationActive={false}
          />
        ))}

        {linhaSecundaria !== undefined ? (
          <Line
            yAxisId={eixoSecundario === undefined ? "esquerdo" : "direito"}
            type="monotone"
            dataKey={linhaSecundaria.nome}
            stroke={linhaSecundaria.cor}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        ) : null}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
