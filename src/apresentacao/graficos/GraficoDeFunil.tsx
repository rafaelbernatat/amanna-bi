import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";

/**
 * Primitiva `funil` (T-164).
 *
 * Passos em ordem, cada um subconjunto do anterior. A largura da pílula é a
 * proporção contra o **primeiro** passo, e não contra o anterior: é o que faz
 * a queda entre candidaturas e contratados ser visível de uma vez, em vez de
 * cinco pílulas parecidas cada uma medindo a sua própria etapa.
 *
 * A conversão entre passos chega pronta, em texto. Ela não vem no envelope de
 * propósito — é derivada, e o envelope não guarda derivada — mas derivá-la
 * *aqui* colocaria uma divisão e uma formatação dentro de um componente de
 * desenho, e nenhuma das duas é desenho.
 *
 * Server Component: cinco pílulas de largura percentual.
 */

/** Altura da pílula de cada passo. */
const ESPESSURA = 30;

/**
 * Quanto da linha a pílula do primeiro passo ocupa, em porcentagem.
 *
 * Não é 100 de propósito. O nome do passo e a conversão ficam **ao lado** da
 * pílula, e uma pílula de largura total empurrava os dois para fora da caixa —
 * o primeiro passo do funil aparecia sem dizer o que era. Reservar o resto da
 * linha para o texto mantém a proporção entre os passos (todos medem contra a
 * mesma régua) e mantém todos legíveis.
 */
const LARGURA_DO_PRIMEIRO = 58;

/**
 * Largura mínima da pílula, em pixels.
 *
 * O último passo de um funil real é uma fração pequena do primeiro, e uma
 * pílula proporcional ficaria estreita demais para caber o número dentro. O
 * mínimo mantém o valor legível; a proporção continua verdadeira nos passos
 * onde ela cabe, e o número escrito dentro diz o resto.
 */
const LARGURA_MINIMA = 68;

export type PassoDoFunil = {
  readonly nome: string;
  /** Quanto do primeiro passo este representa, de 0 a 1. */
  readonly fracao: number;
  /** O valor já formatado em pt-BR. */
  readonly texto: string;
  /** A conversão contra o passo anterior, já em texto. */
  readonly conversao: string;
  readonly cor: string;
};

export function GraficoDeFunil({
  passos,
}: {
  readonly passos: readonly PassoDoFunil[];
}) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 4,
        overflow: "hidden",
      }}
    >
      {passos.map((passo) => (
        <div
          key={passo.nome}
          data-passo={passo.nome}
          style={{ display: "flex", alignItems: "center", gap: 10 }}
        >
          <div
            style={{
              width: `${String(passo.fracao * LARGURA_DO_PRIMEIRO)}%`,
              minWidth: LARGURA_MINIMA,
              height: ESPESSURA,
              flex: "none",
              background: passo.cor,
              borderRadius: ESPESSURA,
              display: "flex",
              alignItems: "center",
              padding: "0 13px",
              font: `600 11px/1 ${TIPOGRAFIA.mono}`,
              color: PALETA.superficieAlta,
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            {passo.texto}
          </div>
          <div
            style={{
              font: `500 10.5px/1.2 ${TIPOGRAFIA.texto}`,
              color: PALETA.textoSecundario,
              whiteSpace: "nowrap",
            }}
          >
            {passo.nome}
          </div>
          <div
            style={{
              font: `500 9.5px/1.2 ${TIPOGRAFIA.mono}`,
              color: PALETA.textoFraco,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {passo.conversao}
          </div>
        </div>
      ))}
    </div>
  );
}
