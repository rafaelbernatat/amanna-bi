/**
 * As dimensões disponíveis, enquanto `getMeta` não existe (ponte para T-128).
 *
 * ## Por que este arquivo existe, e quando ele some
 *
 * A barra de filtros precisa saber **quais valores oferecer**. No produto
 * pronto isso vem de `getMeta().dimensoes` — inclusive quais anos foram
 * carregados na réplica, que é o coração da decisão D-P8. Mas `getMeta` é
 * T-149, o adaptador de fixtures é T-114, e as duas dependem das fixtures de
 * T-110 e T-111, que estão paradas em `⛔ H-03`.
 *
 * A alternativa seria digitar os valores dentro da barra de filtros. É a pior
 * das saídas: a lista ficaria em dois lugares (aqui e no vocabulário), e o
 * seletor de ano voltaria a ser um par de literais em código — exatamente o que
 * D-P8 removeu.
 *
 * Então esta ponte faz o mínimo, e faz explícito:
 *
 * - as **quatro dimensões fechadas** não são copiadas: vêm de `codigosDe`, o
 *   mesmo registro de T-186 que o contrato e a URL já usam;
 * - só a **lista de anos** é provisória, e é a que a própria D-P8 fixou para a
 *   fixture: "2 anos completos e selecionáveis: 2025 e 2026".
 *
 * Quando T-149 entregar `getMeta`, a página troca uma chamada por outra e este
 * arquivo é apagado. Nada mais precisa mudar — quem consome recebe `Dimensoes`,
 * que é a forma que `getMeta` devolve.
 *
 * Mora em `src/acesso` porque é dado sobre o dado. Pô-lo na apresentação faria
 * a tela declarar quais anos existem, e é justamente isso que D-P8 proíbe.
 */

import { codigosDe } from "@/semantica/dimensoes";
import type { Dimensoes } from "@/semantica/recortes";

/**
 * Os anos que a fixture da Fase 1 carrega (D-P8).
 *
 * Do mais recente para o mais antigo, que é a ordem em que a tabela 6.2 do PRD
 * os escreve e a ordem em que o protótipo os oferece.
 *
 * **Esta é a única lista provisória do arquivo.** Ela sai quando `getMeta` ler
 * os anos do dado. Até lá, um teste confere que ela é exatamente o que a tabela
 * 6.2 declara — para que a divergência apareça na suíte, e não na tela.
 */
export const ANOS_DA_FIXTURE: readonly string[] = ["2026", "2025"];

/**
 * As dimensões que a tela oferece hoje.
 *
 * Mesma forma de `getMeta().dimensoes`. As quatro fechadas são lidas do
 * registro de T-186; o ano é a lista acima.
 */
export function dimensoesProvisorias(): Dimensoes {
  return {
    periodo: codigosDe("periodo"),
    ano: ANOS_DA_FIXTURE,
    entidade: codigosDe("entidade"),
    area: codigosDe("area"),
    modalidade: codigosDe("modalidade"),
  };
}
