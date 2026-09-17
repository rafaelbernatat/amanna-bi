import Link from "next/link";
import type { Metadata } from "next";

import { lerIdentidade } from "@/acesso/leitura";
import { formatarInstante } from "@/apresentacao/formato/formato";
import { NOME_DO_PAPEL, PARA_QUE_SERVE } from "@/apresentacao/marca/papeis";
import { PropostaDeMarca } from "@/apresentacao/marca/PropostaDeMarca";
import { TELA_PADRAO } from "@/apresentacao/navegacao/telas";
import {
  CHAVES_DE_MARCA,
  MARCA,
  PALETA,
  TIPOGRAFIA,
} from "@/apresentacao/tema/tema";
import { personalizacaoLigada } from "@/marca/armazem";
import { origemLegivel, TETO_DO_NOME, TIPOS_DE_LOGO } from "@/marca/documento";
import { lerMarcaAtiva, lerPropostaPendente } from "@/marca/leitura";
import { coresIniciais } from "@/marca/manual";
import { podeConfigurarMarca } from "@/marca/permissao";
import { FRASE_DA_RECUSA, type MotivoDeRecusa } from "@/marca/site/guarda";

/**
 * A tela de configuração da marca (D-MARCA).
 *
 * Fora do grupo `(painel)`: não é uma das treze telas, não tem filtros e não
 * tem chat. O que ela tem são dois formulários — o site da empresa, ou nome,
 * cores e logo à mão — e, quando há proposta pendente, a decisão sobre ela.
 *
 * ## Sem estado de cliente
 *
 * Formulário e redirecionamento, como a barra de filtros. Enviar vai para uma
 * rota, que monta a proposta, guarda e devolve um 303 para cá; esta tela lê a
 * proposta e mostra. A fronteira de cliente não cresce, e o comportamento é o
 * mesmo antes e depois da hidratação. O seletor de cor é o do navegador
 * (`<input type="color">`), que não precisa de JavaScript nosso.
 *
 */

export const metadata: Metadata = {
  title: "Marca da instalação · Configurações",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Busca = Record<string, string | string[] | undefined>;

const AVISOS: Readonly<Record<string, string>> = {
  vazio: "Informe o endereço do site da empresa.",
  gravacao:
    "Não foi possível gravar. Nada foi alterado — confira a configuração do armazém.",
  acao: "Ação desconhecida. Nada foi alterado.",
  "sem-proposta": "Não há proposta pendente para aplicar.",
  cor: "Uma das cores não está no formato #rrggbb. Nada foi alterado.",
  nome: `O nome precisa ter até ${String(TETO_DO_NOME)} caracteres, sem caracteres de controle. Nada foi alterado.`,
  grande:
    "O envio é grande demais. O logo tem de ter até 256 KiB. Nada foi alterado.",
  envio: "Não foi possível ler o formulário enviado. Nada foi alterado.",
};

const FEITOS: Readonly<Record<string, string>> = {
  aplicou: "Marca aplicada. Toda pessoa desta instalação já vê o painel assim.",
  limpou: "O painel voltou ao tema padrão.",
};

function primeiro(valor: string | string[] | undefined): string | null {
  if (valor === undefined) return null;
  return Array.isArray(valor) ? (valor.at(-1) ?? null) : valor;
}

export default async function Pagina({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}) {
  const identidade = await lerIdentidade();
  const busca = await searchParams;

  if (!podeConfigurarMarca(identidade.perfil)) {
    return (
      <Moldura>
        <Cartao>
          <h1 style={ESTILO_DO_TITULO}>Você não configura a marca</h1>
          <p style={ESTILO_DO_TEXTO}>
            A aparência do painel é da instalação inteira, e só diretoria e
            controladoria a alteram. Seu perfil enxerga os dados normalmente.
          </p>
          <Link href={TELA_PADRAO} style={ESTILO_DO_LINK}>
            Voltar ao painel
          </Link>
        </Cartao>
      </Moldura>
    );
  }

  if (!personalizacaoLigada()) {
    return (
      <Moldura>
        <Cartao>
          <h1 style={ESTILO_DO_TITULO}>Personalização desligada</h1>
          <p style={ESTILO_DO_TEXTO}>
            Esta instalação não tem armazém de marca configurado, então não há
            onde guardar logo e cores. Quem opera a instalação liga isso na
            configuração do ambiente.
          </p>
          <Link href={TELA_PADRAO} style={ESTILO_DO_LINK}>
            Voltar ao painel
          </Link>
        </Cartao>
      </Moldura>
    );
  }

  const [marca, proposta] = await Promise.all([
    lerMarcaAtiva(),
    lerPropostaPendente(),
  ]);
  const iniciais = coresIniciais(marca);

  const recusa = primeiro(busca["recusa"]);
  const erro = primeiro(busca["erro"]);
  const feito = primeiro(busca["feito"]);

  return (
    <Moldura>
      <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Link
          href={TELA_PADRAO}
          style={{ ...ESTILO_DO_LINK, font: `500 11px ${TIPOGRAFIA.texto}` }}
        >
          ← Voltar ao painel
        </Link>
        <h1 style={ESTILO_DO_TITULO}>A marca da empresa neste painel</h1>
        <p style={{ ...ESTILO_DO_TEXTO, maxWidth: "68ch" }}>
          Dois caminhos. Informe o site da empresa: o painel busca a página,
          reúne as cores e os logos que ela declara, e a inteligência artificial
          escolhe entre eles — nenhuma cor é inventada. Ou informe à mão o nome,
          as cinco cores e o logo. Nos dois, você vê a proposta antes de
          aplicar.
        </p>
      </header>

      {feito === null ? null : (
        <Faixa tom="bom" teste="marca-feito">
          {FEITOS[feito] ?? "Pronto."}
        </Faixa>
      )}
      {erro === null ? null : (
        <Faixa tom="ruim" teste="marca-erro">
          {AVISOS[erro] ?? "Não foi possível concluir."}
        </Faixa>
      )}
      {recusa === null ? null : (
        <Faixa tom="ruim" teste="marca-recusa">
          {FRASE_DA_RECUSA[recusa as MotivoDeRecusa] ??
            "Esse endereço não pode ser lido."}
        </Faixa>
      )}

      {/* O primeiro caminho: o site. Formulário comum, sem JavaScript. */}
      <form
        method="post"
        action="/api/marca/extrair"
        data-teste="formulario-de-marca"
        style={{
          display: "flex",
          gap: 9,
          alignItems: "flex-end",
          flexWrap: "wrap",
        }}
      >
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 5,
            flex: "1 1 340px",
          }}
        >
          <Rotulo>Site da empresa</Rotulo>
          <input
            type="text"
            name="site"
            inputMode="url"
            autoComplete="url"
            placeholder="empresa.com.br"
            defaultValue={marca?.site ?? ""}
            data-teste="campo-do-site"
            style={ESTILO_DO_CAMPO}
          />
        </label>
        <button type="submit" data-teste="buscar-marca" style={ESTILO_DO_BOTAO}>
          Buscar no site
        </button>
      </form>

      {/*
        O segundo caminho: à mão. `multipart` por causa do arquivo; o seletor
        de cor é o do navegador. As cores abrem com as da marca em uso, para
        quem quer trocar só uma não precisar digitar as outras quatro.
      */}
      <details data-teste="caminho-manual" style={ESTILO_DO_DETALHE}>
        <summary style={ESTILO_DO_SUMARIO}>Ou informe à mão</summary>
        <form
          method="post"
          action="/api/marca/manual"
          encType="multipart/form-data"
          data-teste="formulario-manual"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            paddingTop: 14,
          }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <Rotulo>Nome no cabeçalho</Rotulo>
            <input
              type="text"
              name="nome"
              maxLength={TETO_DO_NOME}
              autoComplete="organization"
              placeholder="Controladoria"
              defaultValue={marca?.nome ?? ""}
              data-teste="campo-do-nome"
              style={{ ...ESTILO_DO_CAMPO, maxWidth: 420 }}
            />
          </label>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: 10,
            }}
          >
            {CHAVES_DE_MARCA.map((papel) => (
              <label
                key={papel}
                data-teste="campo-de-cor"
                data-papel={papel}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  border: `1px solid ${PALETA.borda}`,
                  borderRadius: 12,
                  padding: "10px 12px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="color"
                  name={papel}
                  defaultValue={iniciais[papel]}
                  data-teste={`cor-${papel}`}
                  style={{
                    width: 34,
                    height: 34,
                    flex: "none",
                    border: `1px solid ${PALETA.bordaForte}`,
                    borderRadius: 8,
                    padding: 0,
                    background: "transparent",
                  }}
                />
                <span style={{ minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      font: `500 11.5px/1.2 ${TIPOGRAFIA.texto}`,
                      color: PALETA.texto,
                    }}
                  >
                    {NOME_DO_PAPEL[papel]}
                  </span>
                  <span
                    style={{
                      display: "block",
                      font: `400 10px/1.45 ${TIPOGRAFIA.texto}`,
                      color: PALETA.textoTerciario,
                    }}
                  >
                    {PARA_QUE_SERVE[papel]}
                  </span>
                </span>
              </label>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              gap: 16,
              alignItems: "flex-end",
              flexWrap: "wrap",
            }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <Rotulo>Logo (PNG, JPEG, WebP ou SVG, até 256 KiB)</Rotulo>
              <input
                type="file"
                name="logo"
                accept={TIPOS_DE_LOGO.join(",")}
                data-teste="campo-do-logo"
                style={{
                  font: `400 11.5px/1.4 ${TIPOGRAFIA.texto}`,
                  color: PALETA.textoSecundario,
                }}
              />
            </label>
            {marca?.logo == null ? null : (
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  font: `400 11.5px/1.4 ${TIPOGRAFIA.texto}`,
                  color: PALETA.textoSecundario,
                }}
              >
                <input
                  type="checkbox"
                  name="semLogo"
                  value="1"
                  data-teste="sem-logo"
                />
                Remover o logo em uso
              </label>
            )}
          </div>

          <div>
            <button
              type="submit"
              data-teste="propor-manual"
              style={ESTILO_DO_BOTAO}
            >
              Ver a proposta
            </button>
          </div>
        </form>
      </details>

      {proposta === null ? null : (
        <>
          <PropostaDeMarca proposta={proposta} />
          <form
            method="post"
            action="/api/marca/aplicar"
            data-teste="decisao-da-proposta"
            style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
          >
            <button
              type="submit"
              name="acao"
              value="aplicar"
              data-teste="aplicar-marca"
              style={ESTILO_DO_BOTAO}
            >
              {proposta.extracao.ajustes.length === 0
                ? "Aplicar a esta instalação"
                : `Aplicar com ${String(proposta.extracao.ajustes.length)} ajuste${proposta.extracao.ajustes.length === 1 ? "" : "s"} de contraste`}
            </button>
            <button
              type="submit"
              name="acao"
              value="descartar"
              data-teste="descartar-marca"
              style={ESTILO_DO_BOTAO_SECUNDARIO}
            >
              Descartar
            </button>
          </form>
        </>
      )}

      {marca === null ? (
        <p data-teste="marca-atual" data-tem-marca="0" style={ESTILO_DO_TEXTO}>
          Esta instalação usa o tema padrão do painel.
        </p>
      ) : (
        <section
          data-teste="marca-atual"
          data-tem-marca="1"
          data-origem={marca.origem}
          style={{
            borderTop: `1px solid ${PALETA.borda}`,
            paddingTop: 16,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <h2
            style={{
              margin: 0,
              font: `500 14px/1.2 ${TIPOGRAFIA.titulo}`,
              color: PALETA.texto,
            }}
          >
            Em uso agora
          </h2>
          {/*
            Quem aplicou e quando ficam à vista de propósito.

            A marca vale para a instalação inteira, e o último que grava vence
            para todo mundo. Num produto que se vende por auditabilidade, "alguém
            trocou o logo e ninguém sabe quem" não pode acontecer — e o próprio
            documento guardado é o registro.
          */}
          <p data-teste="quem-aplicou" style={ESTILO_DO_TEXTO}>
            {marca.nome === null ? "" : `${marca.nome} · `}
            {origemLegivel(marca)}, aplicada por {marca.aplicadaPor.perfil} em{" "}
            {formatarInstante(marca.aplicadaEm)}.
          </p>
          <form method="post" action="/api/marca/aplicar">
            <button
              type="submit"
              name="acao"
              value="limpar"
              data-teste="limpar-marca"
              style={ESTILO_DO_BOTAO_SECUNDARIO}
            >
              Voltar ao tema padrão
            </button>
          </form>
        </section>
      )}
    </Moldura>
  );
}

/* ------------------------------------------------------------------ *
 * A moldura da tela
 * ------------------------------------------------------------------ */

const ESTILO_DO_TITULO = {
  margin: 0,
  font: `500 28px/1.1 ${TIPOGRAFIA.titulo}`,
  color: PALETA.texto,
  letterSpacing: "-.01em",
} as const;

const ESTILO_DO_TEXTO = {
  margin: 0,
  font: `400 12px/1.6 ${TIPOGRAFIA.texto}`,
  color: PALETA.textoSecundario,
} as const;

/*
 * Link e botão leem a camada viva do tema, e não a paleta crua: esta é a
 * tela que **aplica** a marca, e seria a única em que o botão de aplicar
 * ficaria com a cor antiga depois de aplicada.
 */
const ESTILO_DO_LINK = {
  font: `500 11.5px/1.2 ${TIPOGRAFIA.texto}`,
  color: MARCA.marca,
  textDecoration: "none",
} as const;

const ESTILO_DO_BOTAO = {
  border: "none",
  background: MARCA.marca,
  color: PALETA.superficie,
  borderRadius: 999,
  padding: "11px 18px",
  font: `500 11.5px/1 ${TIPOGRAFIA.texto}`,
  cursor: "pointer",
} as const;

const ESTILO_DO_BOTAO_SECUNDARIO = {
  border: `1px solid ${PALETA.bordaForte}`,
  background: PALETA.superficie,
  color: PALETA.textoSecundario,
  borderRadius: 999,
  padding: "10px 16px",
  font: `500 11.5px/1 ${TIPOGRAFIA.texto}`,
  cursor: "pointer",
} as const;

const ESTILO_DO_CAMPO = {
  font: `400 12.5px/1.4 ${TIPOGRAFIA.texto}`,
  color: PALETA.texto,
  background: PALETA.superficie,
  border: `1px solid ${PALETA.bordaForte}`,
  borderRadius: 10,
  padding: "10px 12px",
  minWidth: 0,
} as const;

const ESTILO_DO_DETALHE = {
  background: PALETA.superficie,
  border: `1px solid ${PALETA.borda}`,
  borderRadius: 17,
  padding: "14px 20px",
} as const;

const ESTILO_DO_SUMARIO = {
  cursor: "pointer",
  font: `500 14px/1.2 ${TIPOGRAFIA.titulo}`,
  color: PALETA.texto,
} as const;

function Rotulo({ children }: { readonly children: React.ReactNode }) {
  return (
    <span
      style={{
        font: `500 8.5px/1.2 ${TIPOGRAFIA.mono}`,
        color: PALETA.textoFraco,
        textTransform: "uppercase",
        letterSpacing: ".12em",
      }}
    >
      {children}
    </span>
  );
}

function Moldura({ children }: { readonly children: React.ReactNode }) {
  return (
    <main
      data-teste="configuracoes-de-marca"
      style={{
        minHeight: "100vh",
        background: PALETA.fundo,
        padding: "36px 28px 48px",
      }}
    >
      <div
        style={{
          maxWidth: 880,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {children}
      </div>
    </main>
  );
}

function Cartao({ children }: { readonly children: React.ReactNode }) {
  return (
    <div
      style={{
        background: PALETA.superficie,
        border: `1px solid ${PALETA.borda}`,
        borderRadius: 17,
        padding: "22px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      {children}
    </div>
  );
}

function Faixa({
  tom,
  teste,
  children,
}: {
  readonly tom: "bom" | "ruim";
  readonly teste: string;
  readonly children: React.ReactNode;
}) {
  return (
    <p
      role="status"
      data-teste={teste}
      style={{
        margin: 0,
        padding: "10px 13px",
        borderRadius: 10,
        border: `1px solid ${PALETA.bordaForte}`,
        borderLeft: `3px solid ${tom === "bom" ? PALETA.positivo : PALETA.negativo}`,
        background: PALETA.superficie,
        font: `400 11.5px/1.55 ${TIPOGRAFIA.texto}`,
        color: PALETA.textoSecundario,
      }}
    >
      {children}
    </p>
  );
}
