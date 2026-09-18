"use client";

import { DesenhoDePainel } from "@/apresentacao/paineis/DesenhoDePainel";
import {
  type CoresDaMarca,
  PALETA,
  TIPOGRAFIA,
} from "@/apresentacao/tema/tema";
import type { PanelResponse } from "@/semantica/contrato";

/**
 * O gráfico dentro da conversa (T-351; D-CHAT-ferramentas).
 *
 * A resposta destaca um painel na tela; na coluna do chat — e no celular, onde
 * não há tela ao lado — o mesmo painel aparece **na bolha**, desenhado do
 * mesmo envelope, pelo mesmo `DesenhoDePainel`. Nada é relido: o envelope
 * veio na prévia, e é o que a tela também desenha.
 *
 * ## Não é uma moldura de painel
 *
 * A moldura da tela tem `data-teste="painel"` e o id do painel, e é por esse
 * par que o destaque rola até o painel e que os testes contam os painéis de
 * uma tela. Uma segunda moldura com o mesmo id, dentro do chat, faria a
 * rolagem parar no lugar errado. Esta é uma caixa própria, nomeada como
 * gráfico do chat.
 */

/**
 * As colunas da grade de 12 que o desenho supõe ocupar na coluna do chat.
 *
 * A altura vem do próprio desenho (`alturaDaForma`), a mesma da tela: o
 * esqueleto e o gráfico têm a altura da forma, e a bolha só precisa dar a
 * largura.
 */
export const SPAN_DO_CHAT = 4;

export function GraficoNoChat({
  painel,
  cores = null,
}: {
  readonly painel: PanelResponse;
  /** As cores da marca, ja resolvidas; ver `DesenhoDePainel`. */
  readonly cores?: CoresDaMarca | null;
}) {
  return (
    <figure
      data-teste="chat-grafico"
      data-painel={painel.id}
      style={{
        margin: 0,
        border: `1px solid ${PALETA.borda}`,
        borderRadius: 12,
        background: PALETA.superficie,
        padding: "9px 10px 6px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minWidth: 0,
      }}
    >
      <figcaption
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          font: `500 10.5px/1.3 ${TIPOGRAFIA.texto}`,
          color: PALETA.texto,
        }}
      >
        <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
          {painel.title}
        </span>
        <span
          style={{
            flex: "none",
            font: `400 9px/1.3 ${TIPOGRAFIA.mono}`,
            color: PALETA.textoTerciario,
          }}
        >
          {painel.unit}
        </span>
      </figcaption>
      <div style={{ minWidth: 0 }}>
        <DesenhoDePainel painel={painel} span={SPAN_DO_CHAT} cores={cores} />
      </div>
    </figure>
  );
}
