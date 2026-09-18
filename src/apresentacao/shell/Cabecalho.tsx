import Link from "next/link";

import { BarraDeFiltros } from "@/apresentacao/filtros/BarraDeFiltros";
import {
  MODULOS,
  primeiraTelaDe,
  type Modulo,
  type Tela,
} from "@/apresentacao/navegacao/telas";
import { BotaoDeConta } from "@/apresentacao/shell/BotaoDeConta";
import { type Tema, MARCA, PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";
import type { Perfil } from "@/seguranca/identidade";
import type { Query } from "@/semantica/contrato";
import type { Dimensoes } from "@/semantica/recortes";
import { rotaCom, rotaDeApresentacao } from "@/semantica/url";

/**
 * Cabecalho da tela: os modulos, o breadcrumb, o titulo, os filtros e a tira
 * de telas (T-126, T-127; decisao D-CHAT-conversa-flutuante).
 *
 * ## Os modulos viraram abas, no centro
 *
 * A barra lateral do prototipo saiu. Os tres modulos — Recursos Humanos,
 * Financeiro e Integracao — sao uma tira de abas centralizada no alto da
 * tela, e a tira de telas do modulo fica logo abaixo. Trocar de modulo
 * continua levando a primeira tela dele (secao 6.1), **no mesmo recorte**.
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
/** A altura do logo no cabecalho, em pixels. A largura acompanha a proporcao. */
const ALTURA_DO_LOGO = 34;
/** Ate onde um logo largo pode ir antes de espremer a tira de modulos. */
const LARGURA_MAXIMA_DO_LOGO = 190;

export function Cabecalho({
  modulo,
  tela,
  query,
  dimensoes,
  painelDestacado,
  conta,
  nome,
  logo,
}: {
  readonly modulo: Modulo;
  readonly tela: Tela;
  readonly query: Query;
  readonly dimensoes: Dimensoes;
  readonly painelDestacado: string | null;
  /** Quem entrou, e se essa pessoa configura a instalacao (D-MARCA). */
  readonly conta: {
    readonly perfil: Perfil;
    readonly podeConfigurar: boolean;
    readonly podeApresentar: boolean;
    /** O tema em vigor, para o botao de troca propor o outro (T-372). */
    readonly tema: Tema;
  };
  /**
   * O nome da instalacao, escrito quando nao ha logo. Chega resolvido: o da
   * marca quando ela tem um, ou o padrao do produto.
   */
  readonly nome: string;
  /**
   * O logo da empresa, quando ha marca configurada.
   *
   * Chega como endereco e dimensao, ja resolvidos: a apresentacao nao le
   * armazem nem decide tamanho de imagem. `null` mostra o nome escrito, que e
   * o comportamento de sempre.
   */
  readonly logo: { readonly src: string; readonly alt: string } | null;
}) {
  return (
    <header
      /*
       * O cabecalho da tela tem nome proprio desde T-168.
       *
       * Ate os paineis entrarem, `page.locator("header")` so podia dar neste —
       * era o unico `<header>` da pagina. Com os paineis montados sao oito, um
       * por moldura, e o seletor solto passou a resolver para varios elementos.
       * O nome resolve para o e2e o que a estrutura ja dizia: este e o
       * cabecalho **da tela**, e os outros sao de painel.
       */
      data-teste="cabecalho"
      style={{
        background: PALETA.fundo,
        borderBottom: `1px solid ${PALETA.bordaForte}`,
        padding: "14px 28px 14px",
        flex: "none",
        zIndex: 5,
      }}
    >
      {/*
        A primeira linha: a marca à esquerda, os módulos no centro.

        Grade de três colunas com as laterais iguais: é o que mantém a tira
        de módulos no centro da tela, e não no centro do espaço que sobra
        depois da marca.
      */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: 16,
          marginBottom: 16,
        }}
      >
        {/*
          A marca da instalacao: o logo da empresa quando ha um, e o nome
          escrito quando nao ha.

          A altura e fixa e a largura e livre: o logo de cada empresa tem uma
          proporcao, e esticar todos para a mesma caixa deformaria uns e
          espremeria outros. Declarar altura e largura maxima e tambem o que
          impede a imagem de empurrar o cabecalho quando ela chega — o mesmo
          cuidado que a caixa reservada dos paineis tem com o deslocamento de
          layout (T-129).
        */}
        <div style={{ minWidth: 0 }}>
          {logo === null ? (
            <>
              <div
                data-teste="nome-da-instalacao"
                style={{
                  font: `500 15px/1.1 ${TIPOGRAFIA.titulo}`,
                  color: PALETA.texto,
                  letterSpacing: ".005em",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {nome}
              </div>
              <div
                style={{
                  font: `500 8px/1.2 ${TIPOGRAFIA.mono}`,
                  color: PALETA.textoFraco,
                  textTransform: "uppercase",
                  letterSpacing: ".14em",
                  marginTop: 3,
                }}
              >
                Painel executivo · BI
              </div>
            </>
          ) : (
            /*
              Uma tag simples, e nao o componente de imagem do Next: ele
              otimiza por endereco conhecido em tempo de build, e este vem da
              instalacao, muda sem novo build e ja chega com teto de bytes
              conferido. A excecao da regra vive em `eslint.config.mjs`.
            */
            <img
              data-teste="logo-da-marca"
              src={logo.src}
              alt={logo.alt}
              height={ALTURA_DO_LOGO}
              style={{
                height: ALTURA_DO_LOGO,
                width: "auto",
                maxWidth: LARGURA_MAXIMA_DO_LOGO,
                objectFit: "contain",
                display: "block",
              }}
            />
          )}
        </div>

        <nav
          aria-label="Módulos"
          style={{
            display: "flex",
            gap: 2,
            background: MARCA.barraLateral,
            borderRadius: 999,
            padding: 4,
            maxWidth: "100%",
            overflowX: "auto",
            overflowY: "hidden",
          }}
        >
          {MODULOS.map((m) => {
            const ligado = m.id === modulo.id;
            return (
              <Link
                key={m.id}
                href={rotaCom(primeiraTelaDe(m), query)}
                aria-current={ligado ? "page" : undefined}
                data-teste={`modulo-${m.id}`}
                style={{
                  whiteSpace: "nowrap",
                  padding: "8px 18px",
                  borderRadius: 999,
                  background: ligado ? PALETA.superficie : "transparent",
                  color: ligado ? PALETA.texto : PALETA.textoEmBarra,
                  font: `${ligado ? "600" : "500"} 12px/1.2 ${TIPOGRAFIA.texto}`,
                  textDecoration: "none",
                }}
              >
                {m.nome}
              </Link>
            );
          })}
        </nav>

        <BotaoDeConta
          tema={conta.tema}
          de={`/${modulo.id}/${tela.slug}`}
          perfil={conta.perfil}
          podeConfigurar={conta.podeConfigurar}
          apresentar={
            conta.podeApresentar
              ? rotaDeApresentacao(
                  `${modulo.id}/${tela.slug}`,
                  query,
                  painelDestacado,
                )
              : null
          }
        />
      </div>

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

      {/*
        A barra de filtros fica **dentro** do cabecalho, como no prototipo: o
        cabecalho nao rola, e um filtro que some da tela ao rolar deixa de
        responder "sob que recorte estou lendo isto".
      */}
      <BarraDeFiltros
        rota={`/${modulo.id}/${tela.slug}`}
        query={query}
        dimensoes={dimensoes}
        painelDestacado={painelDestacado}
      />

      {/*
        `nav`, e nao `div`.

        O `aria-label` estava num `div`, que nao tem papel implicito — um rotulo
        pendurado em nada, que leitor de tela nao anuncia como regiao. Virou
        `nav` quando o chat entrou e um atalho dele passou a colidir com a aba
        de mesmo nome: o teste precisava dizer "a aba, dentro da tira", e a tira
        precisava ser algo que se possa nomear.
      */}
      <nav
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
      </nav>
    </header>
  );
}
