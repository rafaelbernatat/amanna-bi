import Link from "next/link";
import { headers } from "next/headers";
import type { Metadata } from "next";

import { lerApresentacao, lerIdentidade } from "@/acesso/leitura";
import { CodigoQr } from "@/apresentacao/apresentar/CodigoQr";
import { acharTela, TELA_PADRAO } from "@/apresentacao/navegacao/telas";
import { MARCA, PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";
import {
  assinarConvite,
  PARAMETRO_DE_DESTINO,
  PARAMETRO_DO_CONVITE,
  PERFIL_DO_PUBLICO,
  podeApresentar,
  segredoDoConvite,
  VERSAO_DO_ENVELOPE,
} from "@/seguranca/convite";
import { ROTULO_DO_FILTRO, rotuloDe } from "@/semantica/dimensoes";
import { FILTROS } from "@/semantica/dimensoes";
import {
  buscaParaQuery,
  PARAMETRO_DA_TELA,
  rotaDaConversa,
} from "@/semantica/url";

/**
 * A tela do apresentador: o QR que abre a conversa no celular de cada pessoa
 * (D-CONVITE-apresentacao).
 *
 * Fora do grupo `(painel)`: não tem filtros, não tem chat e não é uma das
 * treze telas. O que ela tem é um código, o recorte em que a plateia vai
 * entrar, e a hora em que o acesso vence.
 *
 * ## O convite é assinado aqui, com o prazo do apresentador
 *
 * O token herda o **mesmo vencimento** do cookie de quem apresenta: a plateia
 * não fica com acesso depois de quem abriu a sala perder o dele. O perfil é
 * o de leitura (`auditor`), e por isso quem escaneia não configura a marca nem
 * enxerga esta tela.
 *
 * ## O endereço sai do cabeçalho encaminhado
 *
 * O host que o servidor enxerga pode ser interno; o QR precisa do host pelo
 * qual o navegador chegou. É a mesma lição do redirecionamento de formulário
 * da marca — só que aqui não dá para usar caminho relativo: um QR precisa do
 * endereço inteiro.
 */

export const metadata: Metadata = {
  title: "Apresentar · Painel BI",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Busca = Record<string, string | string[] | undefined>;

function primeiro(valor: string | string[] | undefined): string | null {
  if (valor === undefined) return null;
  return Array.isArray(valor) ? (valor.at(-1) ?? null) : valor;
}

/** A hora local de um instante em segundos, como se lê num relógio de parede. */
function horaDe(expiraEmSegundos: number): string {
  return new Date(expiraEmSegundos * 1000).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function Pagina({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}) {
  const [identidade, apresentacao, busca, cabecalhos] = await Promise.all([
    lerIdentidade(),
    lerApresentacao(),
    searchParams,
    headers(),
  ]);

  if (!podeApresentar(identidade.perfil)) {
    return (
      <Cartao titulo="Você não apresenta">
        A tela de apresentação abre o painel para quem estiver na sala, e só
        diretoria e controladoria a usam. Seu perfil enxerga os dados
        normalmente.
      </Cartao>
    );
  }

  const segredo = segredoDoConvite(process.env);
  if (apresentacao === null || segredo === null) {
    return (
      <Cartao titulo="Apresentação desligada">
        Esta instalação não tem segredo para assinar o convite, então não há QR
        code para gerar. Quem opera a instalação define CONVITE_SEGREDO na
        configuração do ambiente.
      </Cartao>
    );
  }

  /* O recorte e a tela que a plateia vai ver: os mesmos da URL desta página. */
  const { query, painelDestacado } = buscaParaQuery(
    new URLSearchParams(
      Object.entries(busca).flatMap(([chave, valor]) => {
        const unico = primeiro(valor);
        return unico === null ? [] : [[chave, unico] as [string, string]];
      }),
    ),
  );
  const pedida = primeiro(busca[PARAMETRO_DA_TELA]) ?? "";
  const [modulo = "", slug = ""] = pedida.replace(/^\//, "").split("/");
  const achada = acharTela(modulo, slug);
  const tela =
    achada === undefined
      ? TELA_PADRAO.slice(1)
      : `${achada.modulo.id}/${achada.tela.slug}`;

  const token = await assinarConvite(
    {
      v: VERSAO_DO_ENVELOPE,
      tipo: "convite",
      sala: apresentacao.sala,
      perfil: PERFIL_DO_PUBLICO,
      expira: apresentacao.expira,
    },
    segredo,
  );

  const anfitriao =
    cabecalhos.get("x-forwarded-host") ?? cabecalhos.get("host") ?? "";
  const esquema = cabecalhos.get("x-forwarded-proto") ?? "https";
  const destino = rotaDaConversa(tela, query, painelDestacado ?? undefined);
  const entrada = new URLSearchParams();
  entrada.set(PARAMETRO_DO_CONVITE, token);
  entrada.set(PARAMETRO_DE_DESTINO, destino);
  const endereco = `${esquema}://${anfitriao}/entrar?${entrada.toString()}`;

  const chips = FILTROS.map(
    (campo) =>
      `${ROTULO_DO_FILTRO[campo]}: ${campo === "ano" ? query.ano : rotuloDe(campo, query[campo])}`,
  );

  return (
    <main
      data-teste="apresentar"
      style={{
        minHeight: "100dvh",
        background: PALETA.fundo,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        padding: "28px 20px",
      }}
    >
      <CodigoQr
        texto={endereco}
        rotulo="Código para abrir o painel no seu celular"
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          maxWidth: 680,
          textAlign: "center",
        }}
      >
        <h1
          style={{
            margin: 0,
            font: `500 20px/1.2 ${TIPOGRAFIA.titulo}`,
            color: PALETA.texto,
          }}
        >
          Aponte a câmera e pergunte aos dados
        </h1>
        <p
          data-teste="tela-da-apresentacao"
          style={{
            margin: 0,
            font: `400 12.5px/1.6 ${TIPOGRAFIA.texto}`,
            color: PALETA.textoSecundario,
          }}
        >
          {achada === undefined
            ? "Visão geral"
            : `${achada.modulo.nomeCompleto} · ${achada.tela.titulo}`}
          {painelDestacado === null ? "" : ` · gráfico em foco`}
        </p>
        <div
          style={{
            display: "flex",
            gap: 5,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {chips.map((chip) => (
            <span
              key={chip}
              style={{
                background: PALETA.superficie,
                border: `1px solid ${PALETA.bordaForte}`,
                borderRadius: 999,
                padding: "4px 10px",
                font: `500 9.5px/1.3 ${TIPOGRAFIA.texto}`,
                color: PALETA.textoSecundario,
              }}
            >
              {chip}
            </span>
          ))}
        </div>
        <p
          data-teste="vence-as"
          style={{
            margin: 0,
            font: `500 11px/1.4 ${TIPOGRAFIA.mono}`,
            color: PALETA.textoTerciario,
          }}
        >
          O acesso vence às {horaDe(apresentacao.expira)} · sala{" "}
          {apresentacao.sala}
        </p>
        {/*
          O endereço escrito, para quem não consegue escanear.

          Em texto pequeno e quebrável: é longo de propósito — carrega o token
          assinado —, e ninguém o digita. Serve para ditar ou copiar da tela
          num apuro.
        */}
        <p
          data-teste="endereco-do-convite"
          style={{
            margin: 0,
            maxWidth: "62ch",
            font: `400 8.5px/1.45 ${TIPOGRAFIA.mono}`,
            color: PALETA.textoFraco,
            overflowWrap: "anywhere",
          }}
        >
          {endereco}
        </p>
        <Link
          href={`/${tela}`}
          data-teste="voltar-ao-painel"
          style={{
            marginTop: 4,
            font: `500 11.5px/1.2 ${TIPOGRAFIA.texto}`,
            color: MARCA.marca,
            textDecoration: "none",
          }}
        >
          ← Voltar ao painel
        </Link>
      </div>
    </main>
  );
}

function Cartao({
  titulo,
  children,
}: {
  readonly titulo: string;
  readonly children: React.ReactNode;
}) {
  return (
    <main
      data-teste="apresentar"
      style={{
        minHeight: "100dvh",
        background: PALETA.fundo,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 420,
          background: PALETA.superficie,
          border: `1px solid ${PALETA.borda}`,
          borderRadius: 18,
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          alignItems: "flex-start",
        }}
      >
        <h1
          style={{
            margin: 0,
            font: `500 22px/1.15 ${TIPOGRAFIA.titulo}`,
            color: PALETA.texto,
          }}
        >
          {titulo}
        </h1>
        <p
          style={{
            margin: 0,
            font: `400 12px/1.6 ${TIPOGRAFIA.texto}`,
            color: PALETA.textoSecundario,
          }}
        >
          {children}
        </p>
        <Link
          href={TELA_PADRAO}
          style={{
            font: `500 11.5px/1.2 ${TIPOGRAFIA.texto}`,
            color: MARCA.marca,
            textDecoration: "none",
          }}
        >
          Voltar ao painel
        </Link>
      </div>
    </main>
  );
}
