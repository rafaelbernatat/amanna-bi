"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import type { ConfiguracaoDeEixo } from "@/apresentacao/graficos/nucleo";
import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";

/**
 * Primitiva `linha` (T-129 monta, T-130 completa).
 *
 * Componente de cliente — recharts exige. O que ele **nao** faz e tao
 * importante quanto o que faz: nao le dado, nao calcula, nao formata e nao
 * arredonda. Recebe pontos ja calculados e ja formatados pelo servidor e
 * desenha (principio PR-1).
 */

export type PontoDeSerie = {
  readonly categoria: string;
  readonly valor: number;
  /** Valor ja formatado em pt-BR pelo servidor, para rotulo e leitura. */
  readonly rotulo: string;
};

export function GraficoDeLinha({
  pontos,
  eixo,
  referencia,
}: {
  readonly pontos: readonly PontoDeSerie[];
  readonly eixo: ConfiguracaoDeEixo;
  /** Traço de meta, quando a métrica tem meta declarada no catálogo. */
  readonly referencia?: { readonly valor: number; readonly rotulo: string };
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={[...pontos]}
        margin={{ top: 8, right: 12, bottom: 4, left: 4 }}
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
          tick={{
            fill: PALETA.textoFraco,
            fontSize: 9.5,
            fontFamily: TIPOGRAFIA.mono,
          }}
        />
        <YAxis
          domain={[...eixo.dominio]}
          ticks={[...eixo.cortes]}
          tickLine={false}
          axisLine={false}
          width={44}
          tick={{
            fill: PALETA.textoFraco,
            fontSize: 9.5,
            fontFamily: TIPOGRAFIA.mono,
          }}
        />
        {eixo.temLinhaDeZero ? (
          <ReferenceLine y={0} stroke={PALETA.textoFraco} strokeWidth={1} />
        ) : null}
        {referencia !== undefined ? (
          <ReferenceLine
            y={referencia.valor}
            stroke={PALETA.comparacao}
            strokeDasharray="4 3"
            label={{
              value: referencia.rotulo,
              position: "insideTopRight",
              fill: PALETA.comparacao,
              fontSize: 9,
              fontFamily: TIPOGRAFIA.mono,
            }}
          />
        ) : null}
        <Line
          type="monotone"
          dataKey="valor"
          stroke={PALETA.marca}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
