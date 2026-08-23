import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { MODULOS, acharTela } from "@/apresentacao/navegacao/telas";
import { BarraLateral } from "@/apresentacao/shell/BarraLateral";
import { Cabecalho } from "@/apresentacao/shell/Cabecalho";
import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";
import { buscaParaQuery } from "@/semantica/url";

/**
 * Uma rota por tela: de `/rh/visao` a `/int/cruz` (T-126).
 *
 * As 13 sao resolvidas no servidor — `generateStaticParams` as enumera a partir
 * do registro de navegacao, entao acrescentar uma tela ao registro cria a rota.
 * Qualquer outro par modulo/tela cai em `notFound()`, que devolve 404.
 */

type Parametros = { readonly modulo: string; readonly tela: string };

/**
 * A busca da URL, como o Next a entrega.
 *
 * `string[]` acontece quando o parametro vem repetido (`?ano=2025&ano=2026`),
 * o que e comum em link editado a mao ou concatenado por engano.
 */
type Busca = Record<string, string | string[] | undefined>;

/**
 * Converte a busca do Next em `URLSearchParams` (T-127).
 *
 * Parametro repetido fica com a **ultima** ocorrencia, que e o que
 * `URLSearchParams.get` devolveria se a URL tivesse sido lida direto. Escolher
 * a primeira faria a mesma URL render recortes diferentes conforme quem a
 * interpretou.
 */
function comoBusca(busca: Busca): URLSearchParams {
  const p = new URLSearchParams();
  for (const [chave, valor] of Object.entries(busca)) {
    if (valor === undefined) continue;
    p.set(chave, Array.isArray(valor) ? (valor.at(-1) ?? "") : valor);
  }
  return p;
}

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
  searchParams,
}: {
  params: Promise<Parametros>;
  searchParams: Promise<Busca>;
}) {
  const { modulo, tela } = await params;
  const achado = acharTela(modulo, tela);
  if (achado === undefined) notFound();

  /*
   * O recorte e resolvido **no servidor** (T-127, secao 6.6).
   *
   * A lista de anos vem de `getMeta` quando o adaptador existir (F2); ate la
   * o ano da URL e aceito como veio, que e o comportamento de D-P8 quando
   * ninguem ainda declarou quais anos foram carregados.
   */
  const { query, avisos, painelDestacado } = buscaParaQuery(
    comoBusca(await searchParams),
  );

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
      <BarraLateral ativo={achado.modulo.id} query={query} />

      <div
        style={{
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Cabecalho modulo={achado.modulo} tela={achado.tela} query={query} />

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
          {/*
            O recorte resolvido fica legivel para o teste e para quem depura.
            Nao e enfeite: e como se prova que colar a URL reproduz o mesmo
            recorte, antes de existir painel que o consuma.
          */}
          <dl
            data-teste="recorte"
            data-periodo={query.periodo}
            data-ano={query.ano}
            data-entidade={query.entidade}
            data-area={query.area}
            data-modalidade={query.modalidade}
            data-painel={painelDestacado ?? ""}
            data-avisos={String(avisos.length)}
            style={{ display: "none" }}
          />

          {avisos.length > 0 ? (
            <p
              data-teste="aviso-de-recorte"
              role="status"
              style={{
                margin: "0 0 14px",
                padding: "8px 12px",
                borderRadius: 8,
                border: `1px solid ${PALETA.bordaForte}`,
                background: PALETA.superficieSuave,
                font: `400 11px/1.5 ${TIPOGRAFIA.texto}`,
                color: PALETA.textoSecundario,
                maxWidth: "68ch",
              }}
            >
              {avisos.length === 1
                ? "Um filtro do link não existe e foi trocado pelo padrão: "
                : `${avisos.length} filtros do link não existem e foram trocados pelo padrão: `}
              {avisos
                .map((a) => `${a.campo} "${a.pedido}" → "${a.usado}"`)
                .join("; ")}
              .
            </p>
          ) : null}

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
