import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";
import type { MotivoDeVazio } from "@/semantica/vazio";

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

// O enum vive no contrato de dados (T-105), nao aqui: uma segunda copia na
// apresentacao sairia de sincronia no dia em que um motivo novo entrasse.
export type { MotivoDeVazio } from "@/semantica/vazio";

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
  denominador_zero: {
    titulo: "Sem base para calcular",
    porque:
      "Há dado no numerador, mas o divisor é zero neste recorte — a taxa não existe.",
  },
};

/**
 * Motivos para os quais "ampliar o recorte" **não** é a ação certa (T-182).
 *
 * Divisor zero não some porque o recorte cresceu: a taxa continua sem base.
 * Perfil não muda porque a pessoa olhou mais amplo. Oferecer o atalho nesses
 * casos manda tentar de novo o que não vai dar certo, que é o pior tipo de
 * mensagem de erro.
 */
const SEM_ATALHO_DE_AMPLIAR: readonly MotivoDeVazio[] = [
  "denominador_zero",
  "fora_do_perfil",
];

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
  const podeAmpliar =
    ampliarPara !== undefined && !SEM_ATALHO_DE_AMPLIAR.includes(motivo);

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
      {podeAmpliar ? (
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
