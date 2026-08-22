import Link from "next/link";

import type { Modulo, Tela } from "@/apresentacao/navegacao/telas";
import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";

/**
 * Cabecalho da tela: breadcrumb, titulo e a tira de abas (T-126).
 *
 * O breadcrumb e "modulo · ano do recorte" (PRD secao 6.1). O ano ainda e o
 * padrao da secao 6.2; ele passa a vir da Query na URL com T-127.
 */
export function Cabecalho({
  modulo,
  tela,
  ano,
}: {
  readonly modulo: Modulo;
  readonly tela: Tela;
  readonly ano: string;
}) {
  return (
    <header
      style={{
        background: PALETA.fundo,
        borderBottom: `1px solid ${PALETA.bordaForte}`,
        padding: "22px 28px 14px",
        flex: "none",
        zIndex: 5,
      }}
    >
      <div
        style={{
          font: `500 9px/1.2 ${TIPOGRAFIA.mono}`,
          color: PALETA.textoFraco,
          textTransform: "uppercase",
          letterSpacing: ".13em",
        }}
      >
        {modulo.nomeCompleto} · {ano}
      </div>

      <h1
        style={{
          margin: "6px 0 0",
          font: `500 32px/1.08 ${TIPOGRAFIA.titulo}`,
          color: PALETA.texto,
          letterSpacing: "-.012em",
        }}
      >
        {tela.titulo}
      </h1>

      <div
        aria-label={`Telas de ${modulo.nomeCompleto}`}
        style={{
          display: "flex",
          gap: 2,
          margin: "18px 0 0",
          background: PALETA.grade,
          borderRadius: 999,
          padding: 4,
          width: "fit-content",
          maxWidth: "100%",
          overflowX: "auto",
          overflowY: "hidden",
        }}
      >
        {modulo.telas.map((t) => {
          const ligada = t.slug === tela.slug;
          return (
            <Link
              key={t.slug}
              href={`/${modulo.id}/${t.slug}`}
              aria-current={ligada ? "page" : undefined}
              style={{
                whiteSpace: "nowrap",
                padding: "7px 14px",
                borderRadius: 999,
                background: ligada ? PALETA.superficie : "transparent",
                color: ligada ? PALETA.texto : PALETA.textoTerciario,
                font: `${ligada ? "600" : "500"} 11.5px/1.2 ${TIPOGRAFIA.texto}`,
                textDecoration: "none",
              }}
            >
              {t.titulo}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
