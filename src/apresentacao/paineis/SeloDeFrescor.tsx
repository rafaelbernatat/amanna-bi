import {
  formatarInstante,
  formatarMesAno,
} from "@/apresentacao/formato/formato";
import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";
import type { Frescor } from "@/semantica/contrato";

/**
 * O selo de frescor (T-132, PRD seção 6.4 e 10.2).
 *
 * > "Dado defasado · O painel, com selo de frescor em destaque"
 *
 * ## O painel continua aparecendo
 *
 * Defasado não é ausência: o número existe, só é mais velho do que o acordado.
 * Esconder o painel obrigaria quem lê a escolher entre não ver nada e ir buscar
 * o número em outro lugar — e o outro lugar é sempre uma planilha, que é
 * exatamente o que este produto existe para aposentar.
 *
 * O que muda é o selo: fora do limite ele deixa de ser uma linha discreta de
 * rodapé e vira aviso, com cor e contorno próprios.
 *
 * ## Cor não é o único sinal
 *
 * A seção 13 exige rótulo ou seta em todo indicador crítico. O selo defasado
 * traz a palavra "defasado" escrita, além da cor — quem não distingue os tons
 * lê o texto, e quem usa leitor de tela ouve o `role="status"`.
 */
export function SeloDeFrescor({ frescor }: { readonly frescor: Frescor }) {
  return (
    <span
      data-teste="selo-de-frescor"
      data-defasado={frescor.defasado ? "1" : "0"}
      role="status"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        font: `500 8.5px/1.2 ${TIPOGRAFIA.mono}`,
        textTransform: "uppercase",
        letterSpacing: ".1em",
        color: frescor.defasado ? PALETA.negativo : PALETA.textoFraco,
        border: frescor.defasado ? `1px solid ${PALETA.negativo}` : "none",
        borderRadius: 6,
        padding: frescor.defasado ? "3px 7px" : "0",
        background: frescor.defasado ? PALETA.superficieSuave : "transparent",
      }}
    >
      {frescor.defasado ? (
        <span aria-hidden="true" style={{ fontSize: "1.1em" }}>
          ⚠
        </span>
      ) : null}
      <span>
        {frescor.defasado ? "Dado defasado · " : ""}
        {formatarMesAno(frescor.asOf)}
      </span>
      <span
        data-teste="sincronizado-em"
        style={{ color: PALETA.textoFraco, textTransform: "none" }}
      >
        sync {formatarInstante(frescor.sincronizadoEm)}
      </span>
    </span>
  );
}
