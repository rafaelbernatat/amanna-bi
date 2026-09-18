"use client";

import { useEffect, useRef } from "react";

import { px } from "@/apresentacao/chat/escala";
import { MARCA, PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";
import { PERGUNTAS_POR_CONVIDADO } from "@/chat/protocolo";
import {
  CHAMADA_DO_CONVITE,
  PERGUNTA_DO_CONVITE,
  ROTA_DO_INTERESSE,
  SITE_DA_DREAMY,
  type OrigemDoInteresse,
} from "@/convidados/interesse";

/**
 * O convite da Dreamy: o diálogo que abre na sexta pergunta e quando o
 * relógio vence (D-CONVIDADO-cadastro, T-426, T-427).
 *
 * ## O clique é gravado, e o link é um link
 *
 * O `<a>` navega sozinho para o site — navegação não é regida pela política
 * de segurança, e `target="_blank"` deixa a conversa atrás. O registro sai
 * por `fetch` para a **própria** origem, com `keepalive`, sem impedir a
 * navegação: se o JavaScript falhar, o link ainda leva ao site; só o registro
 * se perde. Um formulário que postasse ao site de fora seria bloqueado por
 * `form-action 'self'`, e um `fetch` ao site de fora, por `connect-src`.
 *
 * ## Foco e teclado
 *
 * Diálogo modal: o foco vai para o link ao abrir, Escape fecha, e clicar fora
 * fecha. Fechar não devolve perguntas — a conversa fica trancada, com o mesmo
 * link no rodapé.
 */

/** Grava o clique. Nunca lança: registro que falha não impede a navegação. */
export function registrarInteresse(
  id: string,
  origem: OrigemDoInteresse,
): void {
  void fetch(ROTA_DO_INTERESSE, {
    method: "POST",
    keepalive: true,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, origem }),
  }).catch(() => undefined);
}

const OLHO: Readonly<Record<OrigemDoInteresse, string>> = {
  limite: `Suas ${String(PERGUNTAS_POR_CONVIDADO)} perguntas acabaram`,
  expiracao: "Seu acesso venceu",
};

export function ConviteDaDreamy({
  origem,
  id,
  cheio,
  aoFechar,
}: {
  readonly origem: OrigemDoInteresse;
  /** O id do cadastro, que é o que a rota de interesse reconhece. */
  readonly id: string;
  readonly cheio: boolean;
  readonly aoFechar: () => void;
}) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    linkRef.current?.focus();
  }, []);

  return (
    <div
      role="presentation"
      onClick={aoFechar}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: `color-mix(in srgb, ${MARCA.barraLateral} 55%, transparent)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="convite-dreamy-titulo"
        data-teste="convite-dreamy"
        data-origem={origem}
        onClick={(evento) => {
          evento.stopPropagation();
        }}
        onKeyDown={(evento) => {
          if (evento.key === "Escape") aoFechar();
        }}
        style={{
          width: "100%",
          maxWidth: 420,
          background: PALETA.superficie,
          border: `1px solid ${PALETA.borda}`,
          borderRadius: 18,
          padding: "24px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          boxSizing: "border-box",
        }}
      >
        <span
          style={{
            font: `600 ${px(8.5, cheio)}/1.2 ${TIPOGRAFIA.mono}`,
            color: MARCA.destaque,
            textTransform: "uppercase",
            letterSpacing: ".12em",
          }}
        >
          {OLHO[origem]}
        </span>
        <h2
          id="convite-dreamy-titulo"
          style={{
            margin: 0,
            font: `500 ${px(20, cheio)}/1.2 ${TIPOGRAFIA.titulo}`,
            color: PALETA.texto,
          }}
        >
          {PERGUNTA_DO_CONVITE}
        </h2>
        <a
          ref={linkRef}
          data-teste="ir-para-dreamy"
          href={SITE_DA_DREAMY}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            registrarInteresse(id, origem);
          }}
          style={{
            display: "block",
            textAlign: "center",
            textDecoration: "none",
            font: `500 ${px(13, cheio)}/1.3 ${TIPOGRAFIA.texto}`,
            color: PALETA.superficie,
            background: MARCA.marca,
            borderRadius: 10,
            padding: "13px 14px",
          }}
        >
          {CHAMADA_DO_CONVITE}
        </a>
        <button
          type="button"
          data-teste="fechar-convite"
          onClick={aoFechar}
          style={{
            border: `1px solid ${PALETA.bordaForte}`,
            background: PALETA.superficie,
            color: PALETA.textoSecundario,
            borderRadius: 10,
            padding: "10px 14px",
            font: `500 ${px(11.5, cheio)}/1.2 ${TIPOGRAFIA.texto}`,
            cursor: "pointer",
          }}
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
