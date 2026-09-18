import { formatarInstante } from "@/apresentacao/formato/formato";
import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";
import type { OrigemDosDados as Origem } from "@/semantica/contrato";

/**
 * Uma linha sob o breadcrumb que diz de onde os números vieram (T-419).
 *
 * ## Por que existe
 *
 * Fixture e base carregada eram indistinguíveis na tela. A fixture carimba o
 * instante da própria leitura como último sync, então o selo de frescor a
 * mostrava sempre recém-sincronizada, e ninguém conseguia responder, olhando
 * o painel, se os números eram os do banco ou os de demonstração. Esta linha
 * responde: nomeia a fonte e, quando há carga, a data e a hora dela.
 *
 * ## O que não faz
 *
 * Não calcula nada, não formata número: a data passa por `formatarInstante`,
 * como no selo. A versão da carga é texto livre de quem carregou e vai só no
 * atributo, para o teste e para quem inspeciona — não para a prosa.
 */
const FRASE: Readonly<Record<Origem["fonte"], string>> = {
  fixtures: "Dados de demonstração",
  warehouse: "Base Amanna",
};

const SEM_FONTE = "Fonte indisponível";

export function OrigemDosDados({ origem }: { readonly origem: Origem | null }) {
  const texto =
    origem === null
      ? SEM_FONTE
      : origem.fonte === "warehouse"
        ? `${FRASE.warehouse} · carga de ${formatarInstante(origem.sincronizadoEm)}`
        : FRASE.fixtures;

  return (
    <div
      data-teste="origem-dos-dados"
      data-fonte={origem?.fonte ?? "indisponivel"}
      data-versao={origem?.versao ?? ""}
      style={{
        font: `500 9px/1.2 ${TIPOGRAFIA.mono}`,
        color: PALETA.textoFraco,
        letterSpacing: ".04em",
        marginTop: 3,
      }}
    >
      {texto}
    </div>
  );
}
