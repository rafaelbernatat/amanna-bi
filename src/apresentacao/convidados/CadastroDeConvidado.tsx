import { MARCA, PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";
import {
  MINIMO_DO_NOME_DO_CONVIDADO,
  TETO_DO_EMAIL_DO_CONVIDADO,
  TETO_DO_NOME_DO_CONVIDADO,
  type ErroDeCadastro,
} from "@/convidados/cadastro";

/**
 * A porta do cadastro: nome e e-mail antes da primeira pergunta
 * (D-CONVIDADO-cadastro, T-425).
 *
 * Componente de servidor, sem JavaScript, no lugar da conversa: quem chegou
 * pelo QR e ainda não disse quem é vê isto em vez do chat. Um formulário
 * comum que posta em `/api/convidado`; a rota valida e volta por 303 — com
 * `erro=` quando um campo não passou, e a tela marca o campo.
 *
 * A tipografia é a de celular: 16 px nos campos, porque abaixo disso o iOS
 * amplia a página ao focar.
 */

/** O que cada erro diz, na voz da tela. */
const FRASE_DO_ERRO: Readonly<Record<ErroDeCadastro, string>> = {
  nome: "Escreva seu nome, com pelo menos duas letras.",
  email: "Esse e-mail não parece completo. Confira e tente de novo.",
  gravacao:
    "Não foi possível guardar seu cadastro agora. Tente de novo em instantes.",
};

/** O texto de consentimento, aprovado em H-71. Mudou lá, muda aqui. */
export const CONSENTIMENTO =
  "Ao entrar, você autoriza a Dreamy a guardar seu nome e e-mail para falar com você sobre esta solução.";

const ESTILO_DO_CAMPO = {
  font: `400 16px/1.4 ${TIPOGRAFIA.texto}`,
  color: PALETA.texto,
  background: PALETA.fundo,
  border: `1px solid ${PALETA.borda}`,
  borderRadius: 10,
  padding: "11px 12px",
} as const;

const ESTILO_DO_ROTULO = {
  font: `500 12px/1.2 ${TIPOGRAFIA.texto}`,
  color: PALETA.textoSecundario,
} as const;

export function CadastroDeConvidado({
  de,
  erro,
}: {
  /** A URL da conversa a que o cadastro volta, com a tela e o recorte. */
  readonly de: string;
  readonly erro: ErroDeCadastro | null;
}) {
  return (
    <main
      data-teste="cadastro-de-convidado"
      data-erro={erro ?? ""}
      style={{
        minHeight: "100dvh",
        background: PALETA.fundo,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        boxSizing: "border-box",
      }}
    >
      <form
        method="post"
        action="/api/convidado"
        style={{
          width: "100%",
          maxWidth: 420,
          background: PALETA.superficie,
          border: `1px solid ${PALETA.borda}`,
          borderRadius: 18,
          padding: "26px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          boxSizing: "border-box",
        }}
      >
        <span
          style={{
            font: `500 9px/1.2 ${TIPOGRAFIA.mono}`,
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
          Antes de perguntar, diga quem é você
        </h1>
        <p
          style={{
            margin: 0,
            font: `400 14px/1.55 ${TIPOGRAFIA.texto}`,
            color: PALETA.textoSecundario,
          }}
        >
          A conversa com os dados é sua, neste celular, durante a apresentação.
        </p>

        <input type="hidden" name="de" value={de} />

        <label htmlFor="cadastro-nome" style={ESTILO_DO_ROTULO}>
          Seu nome
        </label>
        <input
          id="cadastro-nome"
          name="nome"
          type="text"
          data-teste="cadastro-nome"
          autoComplete="name"
          required
          minLength={MINIMO_DO_NOME_DO_CONVIDADO}
          maxLength={TETO_DO_NOME_DO_CONVIDADO}
          autoFocus
          aria-invalid={erro === "nome" ? true : undefined}
          style={ESTILO_DO_CAMPO}
        />

        <label htmlFor="cadastro-email" style={ESTILO_DO_ROTULO}>
          Seu e-mail
        </label>
        <input
          id="cadastro-email"
          name="email"
          type="email"
          inputMode="email"
          data-teste="cadastro-email"
          autoComplete="email"
          required
          maxLength={TETO_DO_EMAIL_DO_CONVIDADO}
          aria-invalid={erro === "email" ? true : undefined}
          style={ESTILO_DO_CAMPO}
        />

        {erro === null ? null : (
          <p
            data-teste="erro-do-cadastro"
            role="alert"
            style={{
              margin: 0,
              font: `500 13px/1.5 ${TIPOGRAFIA.texto}`,
              color: PALETA.negativo,
            }}
          >
            {FRASE_DO_ERRO[erro]}
          </p>
        )}

        <button
          type="submit"
          data-teste="entrar-na-conversa"
          style={{
            font: `500 15px/1.2 ${TIPOGRAFIA.texto}`,
            color: PALETA.superficie,
            background: MARCA.marca,
            border: "none",
            borderRadius: 10,
            padding: "13px 14px",
            cursor: "pointer",
            marginTop: 4,
          }}
        >
          Entrar na conversa
        </button>

        <p
          data-teste="consentimento"
          style={{
            margin: 0,
            font: `400 11.5px/1.55 ${TIPOGRAFIA.texto}`,
            color: PALETA.textoTerciario,
          }}
        >
          {CONSENTIMENTO}
        </p>
      </form>
    </main>
  );
}
