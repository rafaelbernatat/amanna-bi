/**
 * O estágio 3 da marca: contraste medido, ajuste **proposto**.
 *
 * Uma fórmula, um lugar. A extração pelo site e o formulário manual chegam
 * aqui com cinco cores e saem com as cinco ajustadas e a lista do que mudou —
 * e é a mesma regra nos dois caminhos, de propósito: uma cor digitada à mão
 * que reprova no contraste é tão ilegível quanto uma que o site declarou.
 *
 * Mora fora de `extrair/` para o caminho manual não puxar para o grafo as
 * fontes de site, o resolvedor de DNS e a guarda de endereço, que ele nunca
 * usa.
 */

import {
  ajustarParaContraste,
  contrasteSuficiente,
  type AjusteDeContraste,
} from "@/apresentacao/tema/contraste";
import { PALETA, type CoresDaMarca } from "@/apresentacao/tema/tema";

/**
 * Os pares que carregam texto, e por isso precisam do mínimo de 4,5:1.
 *
 * `destaqueSuave` fica de fora de propósito: ele é a borda de três pixels do
 * banner de recorte, e não fundo de texto nenhum. Exigir contraste de texto de
 * um enfeite empurraria a cor da empresa sem necessidade — e o ajuste existe
 * para ser o menor possível.
 */
export const PARES_DA_MARCA: readonly {
  readonly papel: keyof CoresDaMarca;
  readonly contra: string;
}[] = [
  { papel: "marca", contra: PALETA.superficie },
  { papel: "marcaEscura", contra: PALETA.superficie },
  { papel: "destaque", contra: PALETA.superficie },
  // A barra escura leva texto claro em cima: quem se move é o fundo.
  { papel: "barraLateral", contra: PALETA.textoEmBarra },
];

/** As cores ajustadas e a lista do que mudou. Nada é aplicado aqui. */
export function conferirContraste(cores: CoresDaMarca): {
  readonly cores: CoresDaMarca;
  readonly ajustes: readonly AjusteDeContraste[];
} {
  const ajustadas: Record<string, string> = { ...cores };
  const ajustes: AjusteDeContraste[] = [];

  for (const { papel, contra } of PARES_DA_MARCA) {
    const original = cores[papel];
    if (contrasteSuficiente(original, contra)) continue;
    const ajuste = ajustarParaContraste(papel, original, contra);
    ajustadas[papel] = ajuste.ajustada;
    ajustes.push(ajuste);
  }

  return { cores: ajustadas as CoresDaMarca, ajustes };
}
