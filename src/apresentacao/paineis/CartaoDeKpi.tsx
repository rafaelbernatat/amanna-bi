import { formatarValor } from "@/apresentacao/formato/formato";
import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";
import type { Kpi } from "@/semantica/contrato";

/**
 * O cartão de KPI (T-131).
 *
 * ## Não há número neste arquivo
 *
 * Valor, delta e rodapé vêm inteiros do `Kpi` que `getKpis` devolveu. É RF-07
 * escrito como componente — *"nenhum literal de valor no código de KPI; todos
 * vêm de getKpis"* — e é o que fecha o achado 5 do Anexo D, onde metade dos
 * cartões era texto digitado.
 *
 * Uma regra de lint confere isso: os números que sobram aqui são geometria, e
 * cada um passa por um nome estrutural da lista de T-181.
 *
 * ## Cor nunca é o único sinal
 *
 * A seção 13 exige que "todo indicador crítico traga rótulo ou seta". O
 * sentimento aparece em três lugares ao mesmo tempo: a cor do delta, a seta, e
 * o texto do próprio número. Quem não distingue verde de vermelho lê a seta;
 * quem usa leitor de tela ouve o valor com sinal.
 *
 * ## Ausência é estado
 *
 * `value: null` não vira zero nem traço mudo: vira "sem dado neste recorte",
 * com o rodapé preservado, porque o rodapé diz **em que recorte** o número
 * seria válido. É o princípio PR-4 no menor componente do produto.
 */
export function CartaoDeKpi({ kpi }: { readonly kpi: Kpi }) {
  const temValor = kpi.value !== null;

  return (
    <div
      data-teste="cartao-de-kpi"
      data-kpi={kpi.id}
      data-sentimento={kpi.sentiment}
      style={{
        minWidth: 0,
        background: PALETA.superficie,
        border: `1px solid ${PALETA.borda}`,
        borderRadius: 17,
        padding: "14px 15px 13px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          aria-hidden="true"
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: corDoSentimento(kpi.sentiment),
            flex: "none",
          }}
        />
        <span
          style={{
            font: `500 9.5px/1.2 ${TIPOGRAFIA.texto}`,
            color: PALETA.textoTerciario,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {kpi.label}
        </span>
      </div>

      <div
        data-teste="valor-do-kpi"
        style={{
          font: temValor
            ? `500 28px/1.02 ${TIPOGRAFIA.titulo}`
            : `400 13px/1.3 ${TIPOGRAFIA.texto}`,
          color: temValor ? PALETA.texto : PALETA.textoTerciario,
          letterSpacing: temValor ? "-.014em" : "0",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {temValor
          ? formatarValor(kpi.value ?? 0, kpi.unit)
          : "sem dado neste recorte"}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 6,
          font: `400 10px/1.4 ${TIPOGRAFIA.texto}`,
          color: PALETA.textoTerciario,
          minHeight: 14,
        }}
      >
        {kpi.delta === null ? null : (
          <span
            data-teste="delta-do-kpi"
            style={{
              font: `500 10px/1.4 ${TIPOGRAFIA.texto}`,
              color: corDoSentimento(kpi.sentiment),
            }}
          >
            {/*
              A seta acompanha o sinal, e não o sentimento: subir é para cima
              mesmo quando subir é ruim. Misturar as duas coisas faria uma seta
              para baixo significar "melhorou", que é ilegível.
            */}
            {kpi.delta > 0 ? "▲" : "▼"} {formatarValor(kpi.delta, kpi.unit)}
          </span>
        )}
        <span
          data-teste="rodape-do-kpi"
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {kpi.rodape}
        </span>
      </div>
    </div>
  );
}

/** A cor do sentimento. Nunca é o único sinal — ver o cabeçalho. */
function corDoSentimento(sentimento: Kpi["sentiment"]): string {
  if (sentimento === "good") return PALETA.positivo;
  if (sentimento === "bad") return PALETA.negativo;
  return PALETA.neutro;
}

/**
 * A faixa de KPIs de uma tela.
 *
 * A seção 5 do PRD limita a **seis por tela**. O corte acontece aqui, e não em
 * `getKpis`: cortar na camada de dados esconderia um registro que cresceu, e
 * quem lê o registro veria sete. Aqui o excedente não aparece e o teste reprova
 * — o defeito fica visível onde dá para corrigi-lo.
 */
export const MAXIMO_DE_KPIS_POR_TELA = 6;

export function FaixaDeKpis({ kpis }: { readonly kpis: readonly Kpi[] }) {
  return (
    <div
      data-teste="faixa-de-kpis"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(178px, 1fr))",
        gap: 13,
        marginBottom: 18,
      }}
    >
      {kpis.slice(0, MAXIMO_DE_KPIS_POR_TELA).map((kpi) => (
        <CartaoDeKpi key={kpi.id} kpi={kpi} />
      ))}
    </div>
  );
}
