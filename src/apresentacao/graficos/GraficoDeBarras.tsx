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
import {
  PALETA_CLARA,
  TIPOGRAFIA,
  type ChaveDePaletaClara,
} from "@/apresentacao/tema/tema";

type Pele = Readonly<Record<ChaveDePaletaClara, string>>;

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
  /** `null` e "sem dado nesta categoria", e nao zero (PR-4). */
  readonly valores: readonly (number | null)[];
};

export type SerieDeLinha = {
  readonly nome: string;
  readonly cor: string;
  /** `null` e "sem dado nesta categoria", e nao zero (PR-4). */
  readonly valores: readonly (number | null)[];
};

/**
 * O estilo do eixo depende da pele, entao e funcao e nao constante.
 *
 * Uma constante de modulo congela a cor no carregamento, e com dois temas a
 * cor certa so se sabe no render.
 */
function estiloDoEixo(pele: Pele) {
  return {
    fill: pele.textoFraco,
    fontSize: 9.5,
    fontFamily: TIPOGRAFIA.mono,
  } as const;
}

export function GraficoDeBarras({
  pele = PALETA_CLARA,
  categorias,
  barras,
  eixo,
  linhaSecundaria,
  eixoSecundario,
  comLegenda = false,
}: {
  /**
   * A pele ativa, em valor literal.
   *
   * Literal porque isto vira **atributo de SVG**, e `var()` nao pinta
   * atributo: a linha simplesmente some. Quem resolve o tema e a pagina, no
   * servidor; aqui ele chega pronto (T-372).
   */
  readonly pele?: Pele;
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
    // Ausente fica ausente: recharts desenha lacuna, e lacuna e o que PR-4
    // pede. `?? 0` transformava descompasso de tamanho entre `categorias` e
    // `valores` numa barra zero silenciosa -- e viraria "sem dado = zero" no
    // dia em que a serie do envelope, que aceita null, chegasse aqui.
    for (const serie of barras) {
      const v = serie.valores[i];
      if (v !== undefined && v !== null) linha[serie.nome] = v;
    }
    if (linhaSecundaria !== undefined) {
      const v = linhaSecundaria.valores[i];
      if (v !== undefined && v !== null) linha[linhaSecundaria.nome] = v;
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
          stroke={pele.grade}
          strokeWidth={0.75}
          vertical={false}
        />
        <XAxis
          dataKey="categoria"
          interval={eixo.intervaloDeRotulo}
          tickLine={false}
          axisLine={{ stroke: pele.bordaForte }}
          tick={estiloDoEixo(pele)}
        />
        <YAxis
          yAxisId="esquerdo"
          domain={[...eixo.dominio]}
          ticks={[...eixo.cortes]}
          tickLine={false}
          axisLine={false}
          width={44}
          tick={estiloDoEixo(pele)}
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
            tick={estiloDoEixo(pele)}
          />
        ) : null}

        {eixo.temLinhaDeZero ? (
          <ReferenceLine
            yAxisId="esquerdo"
            y={0}
            stroke={pele.textoFraco}
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
              color: pele.textoTerciario,
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
