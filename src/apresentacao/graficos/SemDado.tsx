import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";

/**
 * O estado "sem dado neste recorte" (T-130, princípio PR-4).
 *
 * Série vazia não desenha gráfico em branco. Um eixo sem barra nenhuma é
 * indistinguível de um recorte cujos valores são todos zero, e o PRD é
 * explícito: recorte vazio é estado, não zero. Aqui aparece o motivo e o
 * atalho para ampliar o recorte (PRD seção 6.4).
 *
 * Server Component: nada disto precisa do cliente.
 */

/** Os quatro motivos de vazio do contrato de dados (PRD seção 9.2 regra 3). */
export type MotivoDeVazio =
  | "sem_dado_no_recorte"
  | "grupo_pequeno"
  | "fora_do_perfil"
  | "fonte_indisponivel";

const TEXTO: Readonly<
  Record<MotivoDeVazio, { titulo: string; porque: string }>
> = {
  sem_dado_no_recorte: {
    titulo: "Sem dado neste recorte",
    porque: "A consulta é válida e não retornou nenhuma linha.",
  },
  grupo_pequeno: {
    titulo: "Grupo pequeno demais para exibir",
    porque:
      "O recorte tem menos de 5 pessoas, e dado de pessoa é sempre agregado.",
  },
  fora_do_perfil: {
    titulo: "Você não tem acesso a este recorte",
    porque: "O recorte está fora do seu perfil de acesso.",
  },
  fonte_indisponivel: {
    titulo: "Não foi possível ler a fonte",
    porque: "O adaptador de dados falhou nesta consulta.",
  },
};

export function SemDado({
  motivo,
  altura,
  ampliarPara,
}: {
  readonly motivo: MotivoDeVazio;
  readonly altura: number;
  /** Rótulo do recorte mais amplo sugerido, quando existe um. */
  readonly ampliarPara?: string;
}) {
  const { titulo, porque } = TEXTO[motivo];

  return (
    <div
      data-sem-dado={motivo}
      role="status"
      style={{
        width: "100%",
        height: altura,
        minHeight: altura,
        // A borda tracejada nao pode empurrar a altura: o estado vazio ocupa
        // exatamente a caixa que o grafico ocuparia, senao a tela desloca
        // quando o recorte passa a ter dado.
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        padding: "0 18px",
        textAlign: "center",
        border: `1px dashed ${PALETA.bordaForte}`,
        borderRadius: 12,
        background: PALETA.superficieSuave,
      }}
    >
      <span
        style={{
          font: `600 11.5px/1.3 ${TIPOGRAFIA.texto}`,
          color: PALETA.textoSecundario,
        }}
      >
        {titulo}
      </span>
      <span
        style={{
          font: `400 10.5px/1.5 ${TIPOGRAFIA.texto}`,
          color: PALETA.textoTerciario,
          maxWidth: "42ch",
        }}
      >
        {porque}
      </span>
      {ampliarPara !== undefined ? (
        <span
          style={{
            font: `500 9px/1.2 ${TIPOGRAFIA.mono}`,
            color: PALETA.marca,
            textTransform: "uppercase",
            letterSpacing: ".1em",
            marginTop: 2,
          }}
        >
          Ampliar para {ampliarPara}
        </span>
      ) : null}
    </div>
  );
}
