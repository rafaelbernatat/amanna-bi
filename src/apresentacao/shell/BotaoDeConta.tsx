import Link from "next/link";

import { FormularioDeTema } from "@/apresentacao/shell/FormularioDeTema";
import { MARCA, PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";
import type { Perfil } from "@/seguranca/identidade";

/** Como cada perfil se chama na tela. O código usa o id; a pessoa lê isto. */
const NOME_DO_PERFIL: Readonly<Record<Perfil, string>> = {
  diretoria: "Diretoria",
  controller: "Controladoria",
  rh: "Recursos Humanos",
  area: "Área",
  auditor: "Auditoria",
};

/**
 * O canto direito do cabeçalho: quem entrou, e o caminho para as configurações.
 *
 * A terceira coluna da grade do cabeçalho existia vazia desde que os módulos
 * viraram abas — um `div` só para manter a tira centralizada. É este o
 * conteúdo dela.
 *
 * ## Esconder o botão não é o controle
 *
 * Quem não pode configurar não vê o botão, e isso é cortesia: poupa a pessoa
 * de abrir uma tela que vai recusá-la. O controle de verdade está na rota, que
 * confere a sessão antes de ler o corpo do pedido — esconder da tela nunca
 * impediu ninguém de mandar um pedido à mão. Vale igual para o código da
 * apresentação: a tela `/apresentar` recusa quem não apresenta.
 */
export function BotaoDeConta({
  perfil,
  podeConfigurar,
  apresentar = null,
  de = "/",
}: {
  readonly perfil: Perfil;
  readonly podeConfigurar: boolean;
  /** O caminho de volta depois da troca de tema, com o recorte. */
  readonly de?: string;
  /**
   * O endereço da tela de apresentação, com a tela e o recorte atuais
   * (D-CONVITE-apresentacao). `null` esconde o botão: ou não há sala aberta,
   * ou este perfil não apresenta.
   */
  readonly apresentar?: string | null;
}) {
  return (
    <div
      data-teste="conta"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 8,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          minWidth: 0,
        }}
      >
        <span
          aria-hidden="true"
          data-teste="avatar-do-perfil"
          style={{
            width: 26,
            height: 26,
            flex: "none",
            borderRadius: "50%",
            background: MARCA.marca,
            color: PALETA.superficie,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            font: `600 10px/1 ${TIPOGRAFIA.mono}`,
          }}
        >
          {NOME_DO_PERFIL[perfil].slice(0, 1)}
        </span>
        <span
          data-teste="perfil-da-sessao"
          data-perfil={perfil}
          style={{
            font: `500 10.5px/1.2 ${TIPOGRAFIA.texto}`,
            color: PALETA.textoSecundario,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {NOME_DO_PERFIL[perfil]}
        </span>
      </div>

      {apresentar === null ? null : (
        <Link
          href={apresentar}
          data-teste="abrir-apresentacao"
          target="_blank"
          rel="noopener"
          aria-label="Abrir o código da apresentação"
          title="Código para a plateia perguntar pelo celular"
          style={{
            flex: "none",
            width: 30,
            height: 30,
            borderRadius: 999,
            border: `1px solid ${PALETA.bordaForte}`,
            background: PALETA.superficie,
            color: PALETA.textoSecundario,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textDecoration: "none",
          }}
        >
          {/*
            Um QR desenhado, e não um caractere: o símbolo de código de barras
            do Unicode sai como caixa vazia em metade dos sistemas, e este
            botão precisa parecer o mesmo em todos.
          */}
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <path d="M14 14h3v3h-3zM19 19h2M14 19v2M19 14v2" />
          </svg>
        </Link>
      )}

      {/*
        A troca de tema, em formulario e sem JavaScript.

        Vira cookie porque o **servidor** precisa da escolha: a moldura troca
        sozinha pelas propriedades CSS, mas o grafico recebe a cor ja
        resolvida, e `var()` nao pinta atributo de SVG (T-372).

        Sao dois formularios, e a folha de `EstiloDoTema` mostra um so: o que
        propoe a pele que **nao** esta em vigor. O servidor nao enxerga a
        preferencia do sistema, entao nao saberia escolher — e quando escolhia
        pelo cookie, oferecia "usar tema escuro" a uma tela ja escura (T-418).
      */}
      <FormularioDeTema alvo="claro" de={de} />
      <FormularioDeTema alvo="escuro" de={de} />

      {podeConfigurar ? (
        <Link
          href="/configuracoes/marca"
          data-teste="abrir-configuracoes"
          aria-label="Configurações da instalação"
          title="Configurações da instalação"
          style={{
            flex: "none",
            width: 30,
            height: 30,
            borderRadius: 999,
            border: `1px solid ${PALETA.bordaForte}`,
            background: PALETA.superficie,
            color: PALETA.textoSecundario,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textDecoration: "none",
            font: `400 14px/1 ${TIPOGRAFIA.texto}`,
          }}
        >
          {/*
            Engrenagem desenhada, e não caractere: um emoji de engrenagem sai
            colorido em alguns sistemas e monocromático noutros, e o cabeçalho
            precisa parecer o mesmo em todos.
          */}
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </Link>
      ) : null}
    </div>
  );
}
