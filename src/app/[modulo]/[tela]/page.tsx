import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { MODULOS, acharTela } from "@/apresentacao/navegacao/telas";
import { BarraLateral } from "@/apresentacao/shell/BarraLateral";
import { Cabecalho } from "@/apresentacao/shell/Cabecalho";
import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";

/**
 * Uma rota por tela: de `/rh/visao` a `/int/cruz` (T-126).
 *
 * As 13 sao resolvidas no servidor — `generateStaticParams` as enumera a partir
 * do registro de navegacao, entao acrescentar uma tela ao registro cria a rota.
 * Qualquer outro par modulo/tela cai em `notFound()`, que devolve 404.
 */

type Parametros = { readonly modulo: string; readonly tela: string };

/** Ano padrao da secao 6.2 do PRD. Passa a vir da Query na URL com T-127. */
const ANO_PADRAO = "2026";

export const dynamicParams = true;

export function generateStaticParams(): Parametros[] {
  return MODULOS.flatMap((m) =>
    m.telas.map((t) => ({ modulo: m.id, tela: t.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Parametros>;
}): Promise<Metadata> {
  const { modulo, tela } = await params;
  const achado = acharTela(modulo, tela);
  if (achado === undefined) return { title: "Tela não encontrada" };
  return { title: `${achado.tela.titulo} · ${achado.modulo.nomeCompleto}` };
}

export default async function Pagina({
  params,
}: {
  params: Promise<Parametros>;
}) {
  const { modulo, tela } = await params;
  const achado = acharTela(modulo, tela);
  if (achado === undefined) notFound();

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "236px minmax(0, 1fr)",
        height: "100vh",
        overflow: "hidden",
        background: PALETA.fundo,
      }}
    >
      <BarraLateral ativo={achado.modulo.id} />

      <div
        style={{
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Cabecalho modulo={achado.modulo} tela={achado.tela} ano={ANO_PADRAO} />

        <main
          data-teste="conteudo"
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            minWidth: 0,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "16px 28px 28px",
          }}
        >
          <p
            style={{
              margin: 0,
              font: `400 11.5px/1.6 ${TIPOGRAFIA.texto}`,
              color: PALETA.textoSecundario,
              maxWidth: "68ch",
            }}
          >
            Os filtros globais entram com T-128 e os painéis desta tela com
            T-117 a T-119. O shell, as 13 rotas e o recorte na URL são o
            contrato que eles vão preencher.
          </p>
        </main>
      </div>
    </div>
  );
}
