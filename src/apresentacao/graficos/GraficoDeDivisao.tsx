import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";

/**
 * Primitiva `divisao` (T-164).
 *
 * A repartição interna de cada grupo — gênero, modalidade, categorias do eNPS.
 * Diferente de `barras-empilhadas`, e a diferença está no envelope: ali as
 * séries são as mesmas em toda categoria e o eixo compara entre elas; aqui cada
 * grupo tem as suas próprias partes e o que se lê é a repartição de 100% dentro
 * do grupo. Por isso não há eixo: comparar a largura de uma parte do grupo A
 * com uma do grupo B não significaria nada.
 *
 * Porta a forma `isSplit` do protótipo: uma pílula repartida por grupo, com o
 * nome da parte escrito dentro dela quando cabe, e a legenda embaixo para as
 * que não couberam. É a regra da seção 13 outra vez — a cor sozinha não diz
 * qual parte é qual.
 *
 * Server Component: repartição em porcentagem é largura de `div`.
 */

/** Altura da pílula repartida. */
const ESPESSURA = 18;

/** Fração convertida em porcentagem de CSS. */
const PERCENTUAL_CHEIO = 100;

/**
 * A partir de quanto o nome da parte cabe escrito dentro dela.
 *
 * Abaixo disso o texto sairia cortado no meio de uma palavra, que é pior que
 * não ter texto — a legenda embaixo cobre o caso.
 */
const LIMIAR_DE_ROTULO_INTERNO = 0.16;

/** Lado do quadrado de cor na legenda. */
const MARCA_DA_LEGENDA = 7;

export type ParteDaDivisao = {
  readonly nome: string;
  /** Quanto do grupo esta parte ocupa, de 0 a 1, já resolvido pelo servidor. */
  readonly fracao: number;
  /** O valor já formatado em pt-BR. */
  readonly texto: string;
  readonly cor: string;
};

export type GrupoDaDivisao = {
  readonly nome: string;
  /** O total do grupo, já formatado. `null` quando o grupo não tem dado. */
  readonly total: string | null;
  readonly partes: readonly ParteDaDivisao[];
};

export function GraficoDeDivisao({
  grupos,
}: {
  readonly grupos: readonly GrupoDaDivisao[];
}) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-evenly",
        gap: 8,
        overflow: "hidden",
      }}
    >
      {grupos.map((grupo) => (
        <div
          key={grupo.nome}
          data-grupo={grupo.nome}
          style={{ display: "flex", flexDirection: "column", gap: 4 }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 8,
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{
                font: `600 9px/1.2 ${TIPOGRAFIA.mono}`,
                color: PALETA.destaque,
                textTransform: "uppercase",
                letterSpacing: ".1em",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {grupo.nome}
            </span>
            {grupo.total === null ? null : (
              <span
                style={{
                  flex: "none",
                  font: `400 10px/1.2 ${TIPOGRAFIA.texto}`,
                  color: PALETA.textoFraco,
                }}
              >
                {grupo.total}
              </span>
            )}
          </div>

          <div
            style={{
              display: "flex",
              height: ESPESSURA,
              borderRadius: ESPESSURA,
              overflow: "hidden",
              background: PALETA.grade,
              gap: 2,
            }}
          >
            {grupo.partes.map((parte) => (
              <div
                key={parte.nome}
                style={{
                  width: `${String(parte.fracao * PERCENTUAL_CHEIO)}%`,
                  background: parte.cor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  font: `600 9px/1 ${TIPOGRAFIA.mono}`,
                  color: PALETA.superficieAlta,
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                }}
              >
                {parte.fracao >= LIMIAR_DE_ROTULO_INTERNO ? parte.texto : ""}
              </div>
            ))}
          </div>

          <div
            data-legenda=""
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              overflow: "hidden",
            }}
          >
            {grupo.partes.map((parte) => (
              <span
                key={parte.nome}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  font: `400 9.5px/1.2 ${TIPOGRAFIA.texto}`,
                  color: PALETA.textoSecundario,
                  whiteSpace: "nowrap",
                }}
              >
                <span
                  style={{
                    flex: "none",
                    width: MARCA_DA_LEGENDA,
                    height: MARCA_DA_LEGENDA,
                    borderRadius: 2,
                    background: parte.cor,
                  }}
                />
                {parte.nome}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
