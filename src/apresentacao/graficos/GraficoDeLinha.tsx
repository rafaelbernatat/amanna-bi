"use client";

import {
  CartesianGrid,
  Legend,
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

/**
 * Uma serie desenhada junto da principal (T-164).
 *
 * Tres paineis do Anexo A comparam medidas na mesma escala e no mesmo eixo de
 * tempo — margem bruta, EBITDA e liquida em `fin-margens`, orcado e realizado
 * acumulados em `orc-acum`. Desenhar so a primeira delas deixaria o painel
 * afirmando menos do que o envelope traz, e a comparacao e o painel inteiro.
 *
 * Os valores acompanham a ordem de `pontos`: a categoria e a mesma, e repetir
 * o eixo por serie abriria a porta para duas series com meses diferentes no
 * mesmo desenho.
 */
export type SerieDeLinhaAdicional = {
  readonly nome: string;
  readonly cor: string;
  /** `null` e "sem dado nesta categoria", e nao zero (PR-4). */
  readonly valores: readonly (number | null)[];
};

export function GraficoDeLinha({
  pontos,
  eixo,
  referencia,
  nome,
  linhas,
}: {
  readonly pontos: readonly PontoDeSerie[];
  readonly eixo: ConfiguracaoDeEixo;
  /** Traço de meta, quando a métrica tem meta declarada no catálogo. */
  readonly referencia?: { readonly valor: number; readonly rotulo: string };
  /** O nome da serie principal. Aparece na legenda, quando ha legenda. */
  readonly nome?: string;
  /** Series desenhadas junto, alinhadas as categorias de `pontos`. */
  readonly linhas?: readonly SerieDeLinhaAdicional[];
}) {
  const adicionais = linhas ?? [];
  const nomeDaPrincipal = nome ?? "valor";

  /*
   * Uma linha por serie no mesmo registro, indexada pelo nome dela.
   *
   * `valor` continua sendo a chave da serie principal quando nao ha nome, para
   * o caminho de uma serie so seguir identico ao que T-130 entregou.
   */
  const dados = pontos.map((ponto, i) => {
    const linha: Record<string, number | string> = {
      categoria: ponto.categoria,
      [nomeDaPrincipal]: ponto.valor,
    };
    for (const serie of adicionais) {
      // Ausente fica ausente: recharts desenha lacuna, que e o que PR-4 pede.
      const v = serie.valores[i];
      if (v !== undefined && v !== null) linha[serie.nome] = v;
    }
    return linha;
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={dados}
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
        {adicionais.length === 0 ? null : (
          <Legend
            verticalAlign="top"
            align="left"
            height={22}
            iconType="plainline"
            iconSize={10}
            wrapperStyle={{
              font: `500 9.5px ${TIPOGRAFIA.mono}`,
              color: PALETA.textoTerciario,
            }}
          />
        )}
        <Line
          type="monotone"
          dataKey={nomeDaPrincipal}
          stroke={PALETA.marca}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
        {adicionais.map((serie) => (
          <Line
            key={serie.nome}
            type="monotone"
            dataKey={serie.nome}
            stroke={serie.cor}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
