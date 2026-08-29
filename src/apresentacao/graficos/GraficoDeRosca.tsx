import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";

/**
 * Primitiva `rosca` (T-164).
 *
 * Partes de um todo, com o total no centro. O centro não é enfeite: uma rosca
 * sem ele obriga quem lê a somar as fatias de cabeça para saber sobre quanto as
 * porcentagens falam.
 *
 * ## SVG servido, e não biblioteca
 *
 * O anel é desenhado com `stroke-dasharray` sobre um círculo — a técnica do
 * protótipo. Cada fatia é o mesmo círculo com um traço visível do tamanho dela
 * e o resto invisível, girado pelo acumulado das anteriores. Sai inteiro do
 * servidor, sem JavaScript e sem segunda pintura.
 *
 * ## A legenda não é opcional
 *
 * A seção 13 do PRD proíbe cor como único sinal, e numa rosca a cor é o único
 * jeito de saber qual fatia é qual. Por isso a legenda vem ao lado, sempre, com
 * o nome e o valor de cada fatia — e não como `tooltip`, que não existe para
 * quem lê a tela impressa ou por leitor de tela.
 *
 * Não lê dado, não calcula e não formata: recebe fração e texto prontos (PR-1).
 */

/** Geometria do anel, no sistema de coordenadas do `viewBox`. */
const LADO = 150;
/** Metade — o anel e centrado no quadrado do `viewBox`. */
const MEIO = 0.5;
const CENTRO = LADO * MEIO;
const RAIO = 52;
const ESPESSURA = 20;

/** Perímetro do círculo — a unidade em que o traço de cada fatia é medido. */
const CIRCUNFERENCIA = Math.PI * (RAIO + RAIO);

/** Respiro entre duas fatias, para a borda entre elas ficar visível. */
const FOLGA = 1.5;

/** Traço mínimo: uma fatia pequena aparece, em vez de sumir. */
const TRACO_MINIMO = 0.5;

/** Lado do quadrado de cor na legenda. */
const MARCA_DA_LEGENDA = 8;

/** A primeira fatia comeca no topo: nada acumulado antes dela. */
const INICIO_DO_ARCO = 0;

export type FatiaDeRosca = {
  readonly nome: string;
  /** Quanto do total esta fatia ocupa, de 0 a 1, já resolvido pelo servidor. */
  readonly fracao: number;
  /** O valor já formatado em pt-BR. */
  readonly texto: string;
  readonly cor: string;
};

export function GraficoDeRosca({
  fatias,
  centro,
}: {
  readonly fatias: readonly FatiaDeRosca[];
  readonly centro: { readonly texto: string; readonly rotulo: string };
}) {
  /*
   * O deslocamento de cada fatia é a soma das anteriores. Percorrido aqui, e
   * não calculado dentro do laço de desenho, para o acumulado existir uma vez
   * só — duas contagens do mesmo acumulado divergiriam na primeira fatia nula.
   */
  const arcos: {
    readonly nome: string;
    readonly cor: string;
    readonly traco: number;
    readonly deslocamento: number;
  }[] = [];
  let acumulado = INICIO_DO_ARCO;
  for (const fatia of fatias) {
    const comprimento = CIRCUNFERENCIA * fatia.fracao;
    arcos.push({
      nome: fatia.nome,
      cor: fatia.cor,
      traco: Math.max(comprimento - FOLGA, TRACO_MINIMO),
      deslocamento: -acumulado,
    });
    acumulado += comprimento;
  }

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        gap: 12,
        overflow: "hidden",
      }}
    >
      <svg
        viewBox={`0 0 ${String(LADO)} ${String(LADO)}`}
        style={{ flex: "none", width: LADO, height: "100%" }}
        aria-hidden="true"
      >
        <circle
          cx={CENTRO}
          cy={CENTRO}
          r={RAIO}
          fill="none"
          stroke={PALETA.grade}
          strokeWidth={ESPESSURA}
        />
        {arcos.map((arco) => (
          <circle
            key={arco.nome}
            cx={CENTRO}
            cy={CENTRO}
            r={RAIO}
            fill="none"
            stroke={arco.cor}
            strokeWidth={ESPESSURA}
            strokeDasharray={`${String(arco.traco)} ${String(CIRCUNFERENCIA - arco.traco)}`}
            strokeDashoffset={arco.deslocamento}
            transform={`rotate(-90 ${String(CENTRO)} ${String(CENTRO)})`}
          />
        ))}
        <text
          x={CENTRO}
          y={CENTRO}
          fill={PALETA.texto}
          fontSize={19}
          fontWeight="600"
          fontFamily={TIPOGRAFIA.mono}
          textAnchor="middle"
        >
          {centro.texto}
        </text>
        <text
          x={CENTRO}
          y={CENTRO}
          dy={16}
          fill={PALETA.textoTerciario}
          fontSize={9.5}
          fontWeight="500"
          fontFamily={TIPOGRAFIA.texto}
          textAnchor="middle"
        >
          {centro.rotulo}
        </text>
      </svg>

      <ul
        data-legenda=""
        style={{
          flex: "1 1 auto",
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          overflow: "hidden",
        }}
      >
        {fatias.map((fatia) => (
          <li
            key={fatia.nome}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              font: `400 10px/1.3 ${TIPOGRAFIA.texto}`,
              color: PALETA.textoSecundario,
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{
                flex: "none",
                width: MARCA_DA_LEGENDA,
                height: MARCA_DA_LEGENDA,
                borderRadius: 2,
                background: fatia.cor,
              }}
            />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
              {fatia.nome}
            </span>
            <span
              style={{
                marginLeft: "auto",
                font: `600 10px/1.3 ${TIPOGRAFIA.mono}`,
                color: PALETA.texto,
              }}
            >
              {fatia.texto}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
