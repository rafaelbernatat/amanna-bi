import type { Metadata } from "next";

import { Moldura } from "@/apresentacao/svg/Moldura";
import { eixo, larguraDoSpan, type Margens } from "@/apresentacao/svg/nucleo";
import { formatarValor } from "@/apresentacao/formato/formato";
import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";

/**
 * Galeria de verificacao do nucleo SVG (T-129).
 *
 * Nao e tela de produto — nao esta no Anexo A e nao aparece na navegacao.
 * Existe porque o criterio de aceite de T-129 exige CLS zero entre 1280 e
 * 1920 px, e isso so se mede sobre algo desenhado. T-183 volta aqui para medir
 * contraste sobre o SVG servido.
 */

export const metadata: Metadata = {
  title: "Verificação · núcleo SVG",
  robots: { index: false, follow: false },
};

const MARGENS: Margens = { esquerda: 44, direita: 12, topo: 12, base: 24 };

const CASOS = [
  { nome: "faixa comum", span: 6, min: 0, max: 200 },
  { nome: "minimo negativo", span: 6, min: -40, max: 120 },
  { nome: "faixa nula", span: 4, min: 75, max: 75 },
  { nome: "tudo zero", span: 4, min: 0, max: 0 },
  { nome: "valores grandes", span: 4, min: 0, max: 1234567 },
  { nome: "span estreito", span: 2, min: 0, max: 50 },
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
        Verificação do núcleo SVG
      </h1>
      <p
        style={{
          margin: "0 0 22px",
          font: `400 11.5px/1.6 ${TIPOGRAFIA.texto}`,
          color: PALETA.textoSecundario,
        }}
      >
        Seis casos de geometria servidos pelo servidor, sem medição de largura.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        {CASOS.map((caso) => {
          const largura = larguraDoSpan(caso.span);
          const desenho = eixo({
            largura,
            altura: 200,
            margens: MARGENS,
            min: caso.min,
            max: caso.max,
            formatar: (v) => formatarValor(v, "FTE"),
          });
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
                {caso.nome} · span {caso.span}
              </figcaption>
              <Moldura eixo={desenho} titulo={`Caso ${caso.nome}`} />
            </figure>
          );
        })}
      </div>
    </main>
  );
}
