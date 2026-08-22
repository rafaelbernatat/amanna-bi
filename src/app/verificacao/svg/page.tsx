import type { Metadata } from "next";

import { formatarValor } from "@/apresentacao/formato/formato";
import { CaixaDeGrafico } from "@/apresentacao/graficos/CaixaDeGrafico";
import { GraficoDeLinha } from "@/apresentacao/graficos/GraficoDeLinha";
import { configuracaoDeEixo } from "@/apresentacao/graficos/nucleo";
import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";

/**
 * Galeria de verificacao do nucleo de graficos (T-129).
 *
 * Nao e tela de produto — nao esta no Anexo A e nao aparece na navegacao.
 * Existe porque o criterio de aceite exige CLS zero entre 1280 e 1920 px, e
 * isso so se mede sobre algo desenhado. T-183 volta aqui para medir contraste.
 *
 * As series abaixo sao formas, nao dados de negocio: existem para exercitar a
 * geometria. Os numeros do Anexo C entram com as fixtures de T-110 e T-111,
 * que esperam a errata de H-03.
 */

export const metadata: Metadata = {
  title: "Verificação · núcleo de gráficos",
  robots: { index: false, follow: false },
};

const MESES = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

const CASOS = [
  {
    nome: "faixa comum",
    valores: [12, 40, 33, 61, 58, 74, 69, 88, 81, 96, 92, 110],
  },
  {
    nome: "minimo negativo",
    valores: [-40, -22, -8, 5, 18, 30, 12, -6, -18, 22, 41, 60],
  },
  { nome: "faixa nula", valores: Array.from({ length: 12 }, () => 75) },
  { nome: "tudo zero", valores: Array.from({ length: 12 }, () => 0) },
  {
    nome: "valores grandes",
    valores: [
      120000, 340000, 512000, 733000, 690000, 880000, 910000, 1020000, 998000,
      1180000, 1204000, 1234567,
    ],
  },
  { nome: "ponto unico", valores: [42] },
] as const;

export default function Pagina() {
  return (
    <main
      style={{
        padding: "28px",
        background: PALETA.fundo,
        minHeight: "100vh",
      }}
    >
      <h1
        style={{
          margin: "0 0 6px",
          font: `500 26px/1.1 ${TIPOGRAFIA.titulo}`,
          color: PALETA.texto,
        }}
      >
        Verificação do núcleo de gráficos
      </h1>
      <p
        style={{
          margin: "0 0 22px",
          font: `400 11.5px/1.6 ${TIPOGRAFIA.texto}`,
          color: PALETA.textoSecundario,
        }}
      >
        Seis casos de geometria sobre recharts, com a caixa reservada pelo
        servidor antes de o gráfico montar.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 16,
        }}
      >
        {CASOS.map((caso) => {
          const categorias = MESES.slice(0, caso.valores.length);
          const eixo = configuracaoDeEixo({
            valores: caso.valores,
            categorias,
          });
          const pontos = caso.valores.map((valor, i) => ({
            categoria: categorias[i] ?? "",
            valor,
            rotulo: formatarValor(valor, "FTE"),
          }));

          return (
            <figure
              key={caso.nome}
              data-caso={caso.nome}
              style={{
                margin: 0,
                minWidth: 0,
                background: PALETA.superficie,
                border: `1px solid ${PALETA.borda}`,
                borderRadius: 14,
                padding: "12px 14px",
              }}
            >
              <figcaption
                style={{
                  font: `500 9px/1.2 ${TIPOGRAFIA.mono}`,
                  color: PALETA.textoTerciario,
                  textTransform: "uppercase",
                  letterSpacing: ".12em",
                  marginBottom: 8,
                }}
              >
                {caso.nome}
                {eixo.degenerada ? " · faixa aberta" : ""}
              </figcaption>
              <CaixaDeGrafico altura={200} rotulo={`Caso ${caso.nome}`}>
                <GraficoDeLinha pontos={pontos} eixo={eixo} />
              </CaixaDeGrafico>
            </figure>
          );
        })}
      </div>
    </main>
  );
}
