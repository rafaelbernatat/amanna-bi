import Link from "next/link";

import type { Modulo, Tela } from "@/apresentacao/navegacao/telas";
import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";
import type { Query } from "@/semantica/contrato";
import { rotaCom } from "@/semantica/url";

/**
 * Cabecalho da tela: breadcrumb, titulo e a tira de abas (T-126, T-127).
 *
 * O breadcrumb e "modulo · ano do recorte" (PRD secao 6.1), e o ano vem da
 * Query lida da URL.
 *
 * ## Por que a aba recebe a Query inteira, e nao so o ano
 *
 * A secao 6.2 diz que os cinco filtros "persistem ao trocar de tela", e nao ha
 * onde guarda-los: o recorte vive na URL e e resolvido no servidor. Entao quem
 * carrega o recorte de uma tela para a outra e o **proprio link** — se o href
 * sai sem a busca, clicar numa aba devolve a pessoa ao consolidado sem avisar.
 *
 * O painel destacado nao viaja junto, e isso e decisao: `painel=orc-desvio`
 * nomeia um painel de `fin/orc`, e pedir a `rh/visao` que destaque um painel
 * que ela nao tem seria um destaque que nunca acontece. O prototipo faz o
 * mesmo — `goto(tab, sub, null)` zera o destaque ao trocar de tela a mao.
 */
export function Cabecalho({
  modulo,
  tela,
  query,
}: {
  readonly modulo: Modulo;
  readonly tela: Tela;
  readonly query: Query;
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
        {modulo.nomeCompleto} · {query.ano}
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
              href={rotaCom(`/${modulo.id}/${t.slug}`, query)}
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
