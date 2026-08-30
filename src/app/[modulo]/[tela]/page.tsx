import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { dimensoesProvisorias } from "@/acesso/dimensoes-provisorias";
import { lerKpisDaTela, lerPainelParaTela } from "@/acesso/leitura";
import { FaixaDeKpis } from "@/apresentacao/paineis/CartaoDeKpi";
import { DesenhoDePainel } from "@/apresentacao/paineis/DesenhoDePainel";
import { PainelEmEstado } from "@/apresentacao/paineis/PainelEmEstado";
import { BannerDeRecorte } from "@/apresentacao/filtros/BannerDeRecorte";
import { subtituloSobRecorte } from "@/apresentacao/filtros/recorte-ativo";
import { MODULOS, acharTela } from "@/apresentacao/navegacao/telas";
import { BarraLateral } from "@/apresentacao/shell/BarraLateral";
import { Cabecalho } from "@/apresentacao/shell/Cabecalho";
import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";
import type { Query } from "@/semantica/contrato";
import { COLUNAS_DA_GRADE, paineisDaTela } from "@/semantica/paineis";
import { PARAMETROS, buscaParaQuery, rotaCom } from "@/semantica/url";

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

/**
 * As chaves que esta rota conhece: os cinco filtros mais o painel destacado.
 *
 * Serve so a canonizacao abaixo — uma busca com chave desconhecida e deixada
 * como esta, porque reescreve-la apagaria um parametro que alguem pode estar
 * usando para outra coisa.
 */
const CHAVES_CONHECIDAS: ReadonlySet<string> = new Set([
  ...PARAMETROS,
  "painel",
]);

/**
 * A URL canonica de um recorte, quando ela difere da que chegou.
 *
 * Existe por causa do formulario da barra de filtros (T-128): um `<form
 * method="get">` envia **todos** os campos, inclusive os que estao no padrao.
 * Sem isto, trocar um filtro e voltar ao consolidado deixaria
 * `?periodo=12-meses&ano=2026&entidade=consolidado&area=todas&modalidade=todas`
 * grudado na barra de enderecos — o oposto da URL legivel que a secao 6.6
 * promete.
 *
 * Devolve `null` quando nao ha o que canonizar. Dois casos ficam de fora de
 * proposito:
 *
 * - **houve aviso.** Redirecionar apagaria o parametro invalido junto com a
 *   explicacao, e a pessoa leria "12 meses" achando que o link dela funcionou.
 * - **ha chave desconhecida.** Ver `CHAVES_CONHECIDAS`.
 */
function canonizar(
  rota: string,
  busca: URLSearchParams,
  query: Parameters<typeof rotaCom>[1],
  painelDestacado: string | null,
  houveAviso: boolean,
): string | null {
  if (houveAviso) return null;
  for (const chave of busca.keys()) {
    if (!CHAVES_CONHECIDAS.has(chave)) return null;
  }
  const sufixo = busca.toString();
  const atual = sufixo === "" ? rota : `${rota}?${sufixo}`;
  const canonica = rotaCom(rota, query, painelDestacado ?? undefined);
  return canonica === atual ? null : canonica;
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
  /*
   * As dimensoes disponiveis. Hoje vem da ponte de `dimensoes-provisorias`;
   * com T-149 passam a vir de `getMeta`, ja recortadas pelo perfil (secao 11).
   * A lista de anos e o que faz `?ano=2024` virar aviso em vez de tela vazia.
   */
  const dimensoes = dimensoesProvisorias();
  const busca = comoBusca(await searchParams);
  const { query, avisos, painelDestacado } = buscaParaQuery(
    busca,
    dimensoes.ano,
  );

  const rota = `/${achado.modulo.id}/${achado.tela.slug}`;
  const canonica = canonizar(
    rota,
    busca,
    query,
    painelDestacado,
    avisos.length > 0,
  );
  if (canonica !== null) redirect(canonica);

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
        <Cabecalho
          modulo={achado.modulo}
          tela={achado.tela}
          query={query}
          dimensoes={dimensoes}
          painelDestacado={painelDestacado}
        />

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

          <BannerDeRecorte
            rota={rota}
            query={query}
            painelDestacado={painelDestacado}
          />

          {/*
            Os KPIs da tela, no recorte da URL.

            Lidos pela fronteira de seguranca (secao 11), e nao pelo adaptador:
            o recorte por perfil e aplicado no servidor, antes de qualquer
            leitura. `lerKpisDaTela` e o unico ponto onde essa cadeia se monta.
          */}
          <FaixaDeKpis kpis={await lerKpisDaTela(rota.slice(1), query)} />

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

          {/*
            Os painéis da tela, na ordem do Anexo A e na grade de 12 colunas da
            seção 5. Quem diz quais painéis e com que largura é o registro de
            T-107 — acrescentar um painel ao Anexo A e ao registro o coloca na
            tela, sem editar arquivo de tela nenhum.
          */}
          <PaineisDaTela
            tela={rota.slice(1)}
            query={query}
            painelDestacado={painelDestacado}
          />
        </main>
      </div>
    </div>
  );
}

/**
 * A grade de painéis de uma tela (T-168 e T-169).
 *
 * ## Por que as leituras são disparadas juntas
 *
 * `Promise.all` sobre os painéis da tela, e não um `await` por painel dentro do
 * laço. Com sete painéis, esperar um de cada vez somaria sete idas à fonte em
 * série — e no modo warehouse cada ida é uma consulta ao banco. A tela leva o
 * tempo do painel mais lento, e não a soma de todos.
 *
 * O streaming por painel, que faz cada caixa aparecer assim que a resposta dela
 * chega, é de T-171. Aqui a tela ainda espera todas — o que já é correto, e
 * será mais rápido sem mudar nenhuma destas linhas.
 *
 * ## Por que o subtítulo é resolvido aqui
 *
 * `subtituloSobRecorte` precisa da `Query`, e `PainelEmEstado` não a conhece de
 * propósito (T-133): dar-lhe a `Query` faria dele um segundo lugar que decide o
 * que o recorte significa. Este componente é quem tem as duas coisas na mão.
 */
async function PaineisDaTela({
  tela,
  query,
  painelDestacado,
}: {
  readonly tela: string;
  readonly query: Query;
  readonly painelDestacado: string | null;
}) {
  const registro = paineisDaTela(tela);
  if (registro.length === 0) return null;

  const estados = await Promise.all(
    registro.map((p) => lerPainelParaTela(p.id, query)),
  );

  return (
    <div
      data-teste="grade-de-paineis"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${String(COLUNAS_DA_GRADE)}, minmax(0, 1fr))`,
        gap: 14,
        alignItems: "start",
      }}
    >
      {registro.map((p, i) => (
        <div
          key={p.id}
          style={{ gridColumn: `span ${String(p.span)}`, minWidth: 0 }}
        >
          <PainelEmEstado
            identidade={{
              id: p.id,
              titulo: p.titulo,
              ...(p.unidade === null ? {} : { unidade: p.unidade }),
            }}
            forma={p.forma}
            estado={estados[i] ?? { estado: "carregando" }}
            destacado={painelDestacado === p.id}
            subtitulo={subtituloSobRecorte(query)}
            desenhar={(carga) => (
              <DesenhoDePainel painel={carga} span={p.span} />
            )}
          />
        </div>
      ))}
    </div>
  );
}
