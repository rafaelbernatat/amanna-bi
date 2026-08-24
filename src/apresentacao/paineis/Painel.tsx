import type { ReactNode } from "react";

import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";
import type { PanelResponse } from "@/semantica/contrato";

/**
 * O componente de painel (T-131).
 *
 * ## A fórmula não tem como ser desligada
 *
 * O achado 10 do Anexo D: *"a propriedade `mostrarMemoria` esconde a linha de
 * fórmula de todos os painéis"*. O tratamento decidido foi "a propriedade sai".
 *
 * Aqui ela não existe, e a ausência é estrutural e não uma escolha de quem
 * usa: `Painel` **não aceita** propriedade que controle a fórmula. Se
 * `PanelResponse.formula` tem texto, a linha aparece. Não há caminho pelo qual
 * ela não apareça, e é isso que faz RF-04 e o princípio PR-3 serem verdade em
 * vez de intenção.
 *
 * O tipo `Formula` de T-109 já garante que o texto não é vazio; este componente
 * garante que ele chega à tela.
 *
 * ## A caixa é reservada antes do gráfico montar
 *
 * A altura vem do envelope e é aplicada antes de o conteúdo existir, para o
 * *layout shift* seguir em zero (T-129, seção 13). O gráfico chega como
 * `children` porque quem sabe desenhar cada uma das doze formas são os
 * componentes de T-130, T-164 e T-165 — este aqui é a moldura.
 */
export function Painel({
  painel,
  altura,
  destacado = false,
  children,
}: {
  readonly painel: PanelResponse;
  /** Altura reservada para o desenho, em pixels. */
  readonly altura: number;
  /** O painel citado pela IA (seção 6.5). */
  readonly destacado?: boolean;
  readonly children?: ReactNode;
}) {
  return (
    <section
      data-teste="painel"
      data-painel={painel.id}
      data-destacado={destacado ? "1" : "0"}
      aria-label={painel.title}
      style={{
        minWidth: 0,
        background: PALETA.superficie,
        border: `1px solid ${destacado ? PALETA.destaque : PALETA.borda}`,
        borderRadius: 17,
        padding: "15px 16px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        overflow: "hidden",
      }}
    >
      <header style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <h2
            style={{
              margin: 0,
              font: `500 14px/1.25 ${TIPOGRAFIA.titulo}`,
              color: PALETA.texto,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {painel.title}
          </h2>
          <span
            data-teste="unidade-do-painel"
            style={{
              marginLeft: "auto",
              flex: "none",
              font: `500 8.5px/1.2 ${TIPOGRAFIA.mono}`,
              color: PALETA.textoFraco,
              textTransform: "uppercase",
              letterSpacing: ".1em",
            }}
          >
            {painel.unit}
          </span>
        </div>
        {destacado ? (
          <span
            data-teste="rotulo-de-referencia"
            style={{
              font: `500 8.5px/1.2 ${TIPOGRAFIA.mono}`,
              color: PALETA.destaque,
              textTransform: "uppercase",
              letterSpacing: ".1em",
            }}
          >
            Gráfico referenciado pela IA
          </span>
        ) : null}
      </header>

      {/*
        A caixa do desenho, reservada por altura antes de o conteúdo montar.
        Sem isto o painel cresce quando o gráfico aparece, e o CLS deixa de ser
        zero — que é o alvo medido em T-129.
      */}
      <div
        data-teste="caixa-do-painel"
        style={{ height: altura, minHeight: altura, minWidth: 0 }}
      >
        {children}
      </div>

      <FormulaDoPainel formula={painel.formula} />

      {painel.note === null || painel.note === undefined ? null : (
        <p
          data-teste="nota-do-painel"
          style={{
            margin: 0,
            font: `400 10.5px/1.5 ${TIPOGRAFIA.texto}`,
            color: PALETA.textoSecundario,
          }}
        >
          {painel.note}
        </p>
      )}
    </section>
  );
}

/**
 * A linha de fórmula.
 *
 * Componente próprio e sem propriedade de controle: quem quiser escondê-la
 * precisa apagar a chamada, e isso aparece no diff. Uma propriedade
 * `mostrarFormula={false}` seria a mesma coisa que `mostrarMemoria`, com outro
 * nome.
 */
function FormulaDoPainel({ formula }: { readonly formula: string }) {
  if (formula.trim() === "") return null;
  return (
    <p
      data-teste="formula-do-painel"
      style={{
        margin: 0,
        font: `400 9.5px/1.5 ${TIPOGRAFIA.mono}`,
        color: PALETA.textoTerciario,
        borderTop: `1px solid ${PALETA.grade}`,
        paddingTop: 8,
      }}
    >
      {formula}
    </p>
  );
}
