import Link from "next/link";
import type { Metadata } from "next";

import { TELA_PADRAO } from "@/apresentacao/navegacao/telas";
import { MARCA, PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";
import {
  motivoValido,
  PARAMETRO_DE_MOTIVO,
  type MotivoDeEntrada,
} from "@/seguranca/convite";

/**
 * A tela de entrada da apresentação (D-CONVITE-apresentacao).
 *
 * Quem chega sem convite válido para aqui. Não tem formulário: não há o que
 * digitar — o acesso vem do QR, e quem não tem o QR precisa pedir um novo, não
 * adivinhar uma senha. Um campo de senha aqui só ensinaria a plateia a tentar.
 *
 * Estática, sem JavaScript e sem leitura de dado. É pública por construção (o
 * middleware a deixa passar), e por isso não pode mostrar número nenhum.
 */

export const metadata: Metadata = {
  title: "Entrar · Painel BI",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** O que cada motivo diz para quem está com o celular na mão. */
const FRASE: Readonly<Record<MotivoDeEntrada, string>> = {
  "sem-sessao":
    "Escaneie o QR code que está na tela da apresentação para abrir o painel neste celular.",
  expirado: "Seu acesso venceu. Peça um novo QR code a quem está apresentando.",
  invalido:
    "Este link não vale mais. Escaneie de novo o QR code que está na tela.",
  desligado:
    "Esta instalação não usa convite para entrar. Procure quem administra o painel.",
};

type Busca = Record<string, string | string[] | undefined>;

function primeiro(valor: string | string[] | undefined): string | null {
  if (valor === undefined) return null;
  return Array.isArray(valor) ? (valor.at(-1) ?? null) : valor;
}

export default async function Pagina({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}) {
  const busca = await searchParams;
  const bruto = primeiro(busca[PARAMETRO_DE_MOTIVO]) ?? "";
  const motivo: MotivoDeEntrada = motivoValido(bruto) ? bruto : "sem-sessao";

  return (
    <main
      data-teste="entrar"
      data-motivo={motivo}
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
          padding: "26px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <span
          style={{
            font: `500 8.5px/1.2 ${TIPOGRAFIA.mono}`,
            color: PALETA.textoFraco,
            textTransform: "uppercase",
            letterSpacing: ".14em",
          }}
        >
          Painel executivo · BI
        </span>
        <h1
          style={{
            margin: 0,
            font: `500 24px/1.15 ${TIPOGRAFIA.titulo}`,
            color: PALETA.texto,
          }}
        >
          {motivo === "expirado" ? "Seu acesso venceu" : "Entre pelo QR code"}
        </h1>
        <p
          data-teste="frase-da-entrada"
          style={{
            margin: 0,
            font: `400 12.5px/1.6 ${TIPOGRAFIA.texto}`,
            color: PALETA.textoSecundario,
          }}
        >
          {FRASE[motivo]}
        </p>
        <p
          style={{
            margin: 0,
            font: `400 11px/1.6 ${TIPOGRAFIA.texto}`,
            color: PALETA.textoTerciario,
          }}
        >
          O acesso vale durante a apresentação e mostra os mesmos números da
          tela grande. Cada celular tem a própria conversa.
        </p>
        {/*
          Um link para a tela padrão, e não para a anterior: se a sessão
          existir de novo (um segundo QR), o painel abre; se não, o middleware
          traz de volta para cá. É o único caminho que não depende de nada.
        */}
        <Link
          href={TELA_PADRAO}
          data-teste="tentar-de-novo"
          style={{
            alignSelf: "flex-start",
            marginTop: 4,
            font: `500 11.5px/1.2 ${TIPOGRAFIA.texto}`,
            color: MARCA.marca,
            textDecoration: "none",
          }}
        >
          Já escaneei — abrir o painel
        </Link>
      </div>
    </main>
  );
}
