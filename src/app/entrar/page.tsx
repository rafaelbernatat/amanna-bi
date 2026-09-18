import Link from "next/link";
import type { Metadata } from "next";

import { TELA_PADRAO } from "@/apresentacao/navegacao/telas";
import { MARCA, PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";
import {
  motivoValido,
  PARAMETRO_DE_DESTINO,
  PARAMETRO_DE_MOTIVO,
  type MotivoDeEntrada,
} from "@/seguranca/convite";
import { entradaPorSenhaLigada } from "@/seguranca/senha";

/**
 * A tela de entrada da apresentação (D-CONVITE-apresentacao).
 *
 * Quem chega sem sessão válida para aqui, e o que a tela oferece depende de
 * quem é a pessoa — o que, nesta porta, se descobre pelo que ela sabe.
 *
 * **A plateia** chega pelo QR. Para ela não há o que digitar: o acesso vem do
 * código na parede, e quem não tem precisa pedir outro, não adivinhar.
 *
 * **Quem apresenta** chega pelo endereço do produto, sem link nenhum, e para
 * essa pessoa existe o campo de senha — quando a instalação tem uma
 * (`SENHA_DO_PAINEL`). O formulário posta em `/api/entrar`, e a senha vai no
 * corpo: numa URL ela ficaria no histórico do navegador.
 *
 * O campo aparecer ensina a plateia a tentar? Ensina, e é por isso que a rota
 * limita tentativas por endereço (`src/seguranca/tentativas.ts`). A alternativa
 * — esconder o campo de quem chegou pelo QR — exigiria distinguir os dois antes
 * de haver sessão, que é justamente o que ainda não existe neste ponto.
 *
 * Estática, sem JavaScript e sem leitura de dado. É pública por construção (o
 * proxy a deixa passar), e por isso não pode mostrar número nenhum.
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
  senha: "Senha incorreta. Tente de novo.",
  tentativas:
    "Tentativas demais em pouco tempo. Espere um minuto antes de tentar de novo.",
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
  const porSenha = entradaPorSenhaLigada(process.env);
  const destino = primeiro(busca[PARAMETRO_DE_DESTINO]);

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
          {motivo === "expirado"
            ? "Seu acesso venceu"
            : porSenha
              ? "Entrar no painel"
              : "Entre pelo QR code"}
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
        {porSenha ? (
          <form
            method="post"
            action="/api/entrar"
            data-teste="forma-de-senha"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginTop: 6,
            }}
          >
            {/*
              O destino viaja escondido para a pessoa voltar à tela que pediu.
              Quem valida é `destinoSeguro`, do outro lado: campo escondido é
              campo que qualquer um edita.
            */}
            {destino === null ? null : (
              <input
                type="hidden"
                name={PARAMETRO_DE_DESTINO}
                value={destino}
              />
            )}
            <label
              htmlFor="senha"
              style={{
                font: `500 11px/1.2 ${TIPOGRAFIA.texto}`,
                color: PALETA.textoSecundario,
              }}
            >
              Senha do painel
            </label>
            <input
              id="senha"
              name="senha"
              type="password"
              autoComplete="current-password"
              required
              autoFocus
              style={{
                font: `400 16px/1.4 ${TIPOGRAFIA.texto}`,
                color: PALETA.texto,
                background: PALETA.fundo,
                border: `1px solid ${PALETA.borda}`,
                borderRadius: 10,
                padding: "10px 12px",
              }}
            />
            <button
              type="submit"
              data-teste="entrar-com-senha"
              style={{
                font: `500 13px/1.2 ${TIPOGRAFIA.texto}`,
                color: PALETA.superficie,
                background: MARCA.marca,
                border: "none",
                borderRadius: 10,
                padding: "11px 14px",
                cursor: "pointer",
              }}
            >
              Entrar
            </button>
          </form>
        ) : (
          <>
            {/*
              Um link para a tela padrão, e não para a anterior: se a sessão
              existir de novo (um segundo QR), o painel abre; se não, o proxy
              traz de volta para cá. É o único caminho que não depende de nada.

              Só faz sentido sem senha: com o campo na tela, há o que fazer
              aqui, e um link que pode voltar para si mesmo vira um laço.
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
          </>
        )}
      </div>
    </main>
  );
}
