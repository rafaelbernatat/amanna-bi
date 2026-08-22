"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import type { ConfiguracaoDeEixo } from "@/apresentacao/graficos/nucleo";
import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";

import type { SerieDeBarras } from "@/apresentacao/graficos/GraficoDeBarras";

/**
 * Primitiva `barras empilhadas`, com legenda (T-130).
 *
 * Reproduz a forma de `rec-vagas`: vagas por status dentro de cada area, com a
 * legenda dizendo qual faixa e qual status. A legenda nao e enfeite — a secao
 * 13 do PRD proibe cor como unico sinal, e numa pilha de tres faixas a cor e o
 * unico jeito de separar as partes sem ela.
 *
 * Nao le dado, nao calcula, nao formata (principio PR-1). O total de cada pilha
 * ja vem somado do servidor, e nao e recalculado aqui.
 */
export function GraficoDeBarrasEmpilhadas({
  categorias,
  faixas,
  eixo,
  horizontal = false,
}: {
  readonly categorias: readonly string[];
  readonly faixas: readonly SerieDeBarras[];
  readonly eixo: ConfiguracaoDeEixo;
  /** Barras deitadas, como no painel por área do protótipo. */
  readonly horizontal?: boolean;
}) {
  const dados = categorias.map((categoria, i) => {
    const linha: Record<string, number | string> = { categoria };
    for (const faixa of faixas) {
      linha[faixa.nome] = faixa.valores[i] ?? 0;
    }
    return linha;
  });

  const marcaDeEixo = {
    fill: PALETA.textoFraco,
    fontSize: 9.5,
    fontFamily: TIPOGRAFIA.mono,
  } as const;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={dados}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={{ top: 8, right: 12, bottom: 4, left: horizontal ? 24 : 4 }}
      >
        <CartesianGrid
          stroke={PALETA.grade}
          strokeWidth={0.75}
          vertical={horizontal}
          horizontal={!horizontal}
        />

        {horizontal ? (
          <>
            <XAxis
              type="number"
              domain={[...eixo.dominio]}
              ticks={[...eixo.cortes]}
              tickLine={false}
              axisLine={{ stroke: PALETA.bordaForte }}
              tick={marcaDeEixo}
            />
            <YAxis
              type="category"
              dataKey="categoria"
              width={92}
              tickLine={false}
              axisLine={false}
              tick={marcaDeEixo}
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey="categoria"
              interval={eixo.intervaloDeRotulo}
              tickLine={false}
              axisLine={{ stroke: PALETA.bordaForte }}
              tick={marcaDeEixo}
            />
            <YAxis
              domain={[...eixo.dominio]}
              ticks={[...eixo.cortes]}
              tickLine={false}
              axisLine={false}
              width={44}
              tick={marcaDeEixo}
            />
          </>
        )}

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

        {faixas.map((faixa, i) => (
          <Bar
            key={faixa.nome}
            dataKey={faixa.nome}
            stackId="pilha"
            fill={faixa.cor}
            isAnimationActive={false}
            // So a ultima faixa arredonda a ponta da pilha; as de baixo ficam
            // retas, senao aparece um vinco entre as faixas.
            {...(i === faixas.length - 1
              ? {
                  radius: (horizontal ? [0, 2, 2, 0] : [2, 2, 0, 0]) as [
                    number,
                    number,
                    number,
                    number,
                  ],
                }
              : {})}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
