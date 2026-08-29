import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";

/**
 * Primitiva `regua-de-ciclo` (T-165).
 *
 * A única leitura do produto em que o eixo é **duração** e não período: o ciclo
 * de conversão de caixa mede dias entre comprar, pagar, faturar e receber. As
 * faixas se sobrepõem de propósito — o prazo do fornecedor e o de estoque
 * começam no mesmo dia — e é a sobreposição que mostra onde a empresa fica sem
 * caixa.
 *
 * Cada faixa ocupa a sua própria linha, com o rótulo numa coluna fixa à
 * esquerda, a duração noutra à direita, e todas as barras na mesma escala no
 * meio. Empilhá-las sobre uma régua só, como no protótipo, economiza altura e
 * custa a leitura: com quatro faixas sobrepostas, qual começa onde vira
 * adivinhação.
 *
 * As três colunas são a mesma grade em todas as linhas, inclusive na dos
 * marcos. É o que mantém o dia 51 do marco exatamente sobre o fim da faixa que
 * termina no dia 51 — com larguras independentes, os dois sairiam de alinhamento
 * e a régua passaria a mentir sobre onde cada etapa acaba.
 *
 * `sentido` chega do envelope e vira cor: uma faixa que é boa quando cresce
 * (prazo do fornecedor) não se lê como uma que é ruim (ciclo sem caixa). Quem
 * traduz sentido em cor é quem chama — aqui a cor já vem escolhida.
 *
 * Server Component.
 */

/** Fração convertida em porcentagem de CSS. */
const PERCENTUAL_CHEIO = 100;

/** Largura das colunas de rótulo e de duração. */
const LARGURA_DO_ROTULO = 148;
const LARGURA_DA_DURACAO = 54;

/** Espessura da faixa. */
const ESPESSURA = 10;

/** Diâmetro da marca de um marco na régua. */
const MARCA = 6;

/** Largura mínima de uma faixa, para uma etapa curta não sumir. */
const LARGURA_MINIMA = 0.4;

export type FaixaDoCiclo = {
  readonly rotulo: string;
  /** Onde a faixa começa e termina, de 0 a 1 da régua inteira. */
  readonly inicio: number;
  readonly fim: number;
  /** A duração já formatada em pt-BR. */
  readonly texto: string;
  readonly cor: string;
};

export type MarcoDoCiclo = {
  readonly rotulo: string;
  /** Onde o marco cai, de 0 a 1 da régua inteira. */
  readonly posicao: number;
  /** O dia já formatado em pt-BR. */
  readonly texto: string;
};

export function GraficoDeReguaDeCiclo({
  faixas,
  marcos,
}: {
  readonly faixas: readonly FaixaDoCiclo[];
  readonly marcos: readonly MarcoDoCiclo[];
}) {
  const colunas = `${String(LARGURA_DO_ROTULO)}px minmax(0, 1fr) ${String(LARGURA_DA_DURACAO)}px`;

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 5,
        overflow: "hidden",
      }}
    >
      {faixas.map((faixa) => (
        <div
          key={faixa.rotulo}
          data-faixa={faixa.rotulo}
          style={{
            display: "grid",
            gridTemplateColumns: colunas,
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              font: `500 9.5px/1.3 ${TIPOGRAFIA.texto}`,
              color: PALETA.textoSecundario,
              textAlign: "right",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {faixa.rotulo}
          </span>

          <span
            style={{
              position: "relative",
              height: ESPESSURA,
              background: PALETA.grade,
              borderRadius: ESPESSURA,
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: `${String(faixa.inicio * PERCENTUAL_CHEIO)}%`,
                width: `${String(Math.max((faixa.fim - faixa.inicio) * PERCENTUAL_CHEIO, LARGURA_MINIMA))}%`,
                background: faixa.cor,
                borderRadius: ESPESSURA,
              }}
            />
          </span>

          <span
            style={{
              font: `600 9.5px/1.3 ${TIPOGRAFIA.mono}`,
              color: PALETA.texto,
              whiteSpace: "nowrap",
            }}
          >
            {faixa.texto}
          </span>
        </div>
      ))}

      {/*
        Os marcos, na mesma grade das faixas.

        O primeiro e o último caem nas pontas da régua, e um `translateX(-50%)`
        neles jogaria metade do texto para fora da caixa. Por isso a âncora
        acompanha a posição: quem está na ponta esquerda alinha pela esquerda,
        quem está na direita alinha pela direita, e o miolo continua centrado.
      */}
      <div
        data-marcos=""
        style={{
          display: "grid",
          gridTemplateColumns: colunas,
          gap: 8,
          marginTop: 4,
        }}
      >
        <span />
        <span
          style={{
            position: "relative",
            height: MARCA,
            borderTop: `1px solid ${PALETA.bordaForte}`,
          }}
        >
          {marcos.map((marco) => (
            <span
              key={marco.rotulo}
              data-marco={marco.rotulo}
              style={{
                position: "absolute",
                left: `${String(marco.posicao * PERCENTUAL_CHEIO)}%`,
                top: 0,
                transform: ancora(marco.posicao),
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  width: MARCA,
                  height: MARCA,
                  borderRadius: MARCA,
                  background: PALETA.marca,
                }}
              />
              <span
                style={{
                  font: `600 9px/1.4 ${TIPOGRAFIA.mono}`,
                  color: PALETA.textoTerciario,
                  whiteSpace: "nowrap",
                }}
              >
                {marco.texto}
              </span>
            </span>
          ))}
        </span>
        <span />
      </div>
    </div>
  );
}

/** Onde o rótulo do marco encosta, para não sair da caixa nas pontas. */
const PONTA_ESQUERDA = 0.02;
const PONTA_DIREITA = 0.98;

function ancora(posicao: number): string {
  if (posicao <= PONTA_ESQUERDA) return "translateX(0)";
  if (posicao >= PONTA_DIREITA) return "translateX(-100%)";
  return "translateX(-50%)";
}
