"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import {
  cookieDoMenu,
  LARGURA_DO_MENU_ABERTO,
  LARGURA_DO_MENU_RECOLHIDO,
  type EstadoDoMenu,
} from "@/apresentacao/navegacao/menu";
import { acharTela } from "@/apresentacao/navegacao/telas";
import { MARCA, PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";
import { buscaParaQuery, rotaCom } from "@/semantica/url";

/**
 * As telas do modulo ativo, num menu lateral recolhivel
 * (D-NAVEGACAO-menu-lateral-e-filtros-vivos, T-421).
 *
 * Os modulos continuam abas no cabecalho; o que saiu de la foi a tira de
 * telas, que virou esta coluna. Cada link leva o recorte (secao 6.2) e
 * descarta o painel destacado, como a tira fazia — `painel=orc-desvio` nomeia
 * um painel de outra tela.
 *
 * ## Por que e componente de cliente
 *
 * Recolher e abrir sao um clique, e um clique nao pode custar uma ida ao
 * servidor. O estado inicial vem do servidor (cookie lido no layout), para o
 * primeiro quadro ja sair certo; o clique inverte o estado e regrava o cookie
 * no navegador. E a terceira fronteira de cliente da apresentacao, nomeada
 * arquivo a arquivo no teste de arquitetura, junto da barra de filtros.
 *
 * ## O que nao faz
 *
 * Nao mede largura: quando a tela nao cabe, e uma consulta de conteiner
 * (`EstiloDoMenu`) que recolhe. Nao le dado. Nao formata.
 */
export function MenuLateral({
  recolhidoInicial,
}: {
  readonly recolhidoInicial: boolean;
}) {
  // `useSearchParams` pede Suspense acima; a tela e dinamica, o fallback
  // nunca aparece (o mesmo arranjo do chat).
  return (
    <Suspense fallback={null}>
      <MenuNaTela recolhidoInicial={recolhidoInicial} />
    </Suspense>
  );
}

function MenuNaTela({
  recolhidoInicial,
}: {
  readonly recolhidoInicial: boolean;
}) {
  const caminho = usePathname();
  const busca = useSearchParams();
  const [recolhido, setRecolhido] = useState(recolhidoInicial);

  const [idDoModulo = "", slug = ""] = caminho
    .split("/")
    .filter((p) => p !== "");
  const achado = acharTela(idDoModulo, slug);
  if (achado === undefined) return null;
  const { modulo, tela } = achado;
  const { query } = buscaParaQuery(busca.toString());

  const alternar = () => {
    const proximo: EstadoDoMenu = recolhido ? "aberto" : "recolhido";
    setRecolhido(!recolhido);
    document.cookie = cookieDoMenu(proximo, location.protocol === "https:");
  };

  return (
    <nav
      aria-label={`Telas de ${modulo.nomeCompleto}`}
      data-teste="menu-lateral"
      data-recolhido={recolhido ? "1" : "0"}
      style={{
        flex: "none",
        width: recolhido ? LARGURA_DO_MENU_RECOLHIDO : LARGURA_DO_MENU_ABERTO,
        boxSizing: "border-box",
        background: MARCA.barraLateral,
        color: PALETA.textoEmBarra,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        data-parte="topo"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: recolhido ? "center" : "space-between",
          gap: 8,
          padding: recolhido ? "14px 0" : "16px 12px 12px 16px",
        }}
      >
        {recolhido ? null : (
          <div data-parte="modulo" style={{ minWidth: 0 }}>
            <div
              style={{
                font: `600 9px/1.2 ${TIPOGRAFIA.mono}`,
                color: PALETA.textoEmBarraFraco,
                letterSpacing: ".14em",
              }}
            >
              {modulo.numero}
            </div>
            <div
              style={{
                font: `600 12px/1.25 ${TIPOGRAFIA.texto}`,
                color: PALETA.textoEmBarra,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {modulo.nomeCompleto}
            </div>
          </div>
        )}
        <button
          type="button"
          data-teste="recolher-menu"
          aria-expanded={!recolhido}
          aria-label={
            recolhido
              ? "Mostrar as telas do módulo"
              : "Recolher o menu de telas"
          }
          title={recolhido ? "Mostrar as telas" : "Recolher"}
          onClick={alternar}
          style={{
            flex: "none",
            width: 28,
            height: 28,
            border: `1px solid color-mix(in srgb, ${PALETA.textoEmBarra} 22%, transparent)`,
            background: "transparent",
            color: PALETA.textoEmBarra,
            borderRadius: 8,
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {recolhido ? (
              <path d="M9 6l6 6-6 6" />
            ) : (
              <path d="M15 6l-6 6 6 6" />
            )}
          </svg>
        </button>
      </div>

      {recolhido ? null : (
        <div
          data-parte="telas"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            padding: "0 8px 12px",
          }}
        >
          {modulo.telas.map((t) => {
            const ligada = t.slug === tela.slug;
            return (
              <Link
                key={t.slug}
                href={rotaCom(`/${modulo.id}/${t.slug}`, query)}
                aria-current={ligada ? "page" : undefined}
                data-teste={`tela-${t.slug}`}
                style={{
                  display: "block",
                  padding: "9px 10px",
                  borderRadius: 8,
                  background: ligada
                    ? `color-mix(in srgb, ${PALETA.textoEmBarra} 12%, transparent)`
                    : "transparent",
                  color: ligada
                    ? PALETA.textoEmBarra
                    : PALETA.textoEmBarraFraco,
                  borderLeft: `2px solid ${ligada ? MARCA.destaqueSuave : "transparent"}`,
                  font: `${ligada ? "600" : "500"} 12px/1.3 ${TIPOGRAFIA.texto}`,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {t.titulo}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
