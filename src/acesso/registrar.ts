/**
 * Registra os adaptadores na fábrica (T-131, D-DADOS).
 *
 * A fábrica de T-106 é um registro vazio de propósito: importar as duas
 * implementações nela colocaria o driver do Postgres no grafo de uma
 * demonstração com fixtures. Quem se registra é cada adaptador, e este arquivo
 * é onde os dois fazem isso.
 *
 * O de warehouse entra por **import dinâmico**: o módulo do driver só é
 * carregado quando `DATA_SOURCE=warehouse` pede a fonte. Em modo fixtures, o
 * `pg` não entra no grafo — que é exatamente a promessa do cabeçalho da
 * fábrica.
 *
 * Importado por `leitura.ts`, que é o único caminho da tela até o dado.
 *
 * ## A fonte de warehouse é memorizada, e isso não é otimização
 *
 * `obterFonteDeDados()` é chamada **por leitura**: uma tela com dez painéis a
 * chama onze vezes. Em fixtures isso não custa nada — a fonte fecha sobre
 * constantes já carregadas. No warehouse, cada chamada montava uma fonte nova,
 * e cada fonte nova nascia com um cache vazio: as dezoito views eram lidas
 * outra vez, por painel.
 *
 * Medido contra o Supabase: a página financeira levava 28 segundos, e o cache
 * de cinco minutos (`warehouse/cache.ts`) nunca servia ninguém, porque era
 * descartado antes da segunda leitura. A correção é guardar a **promessa** da
 * fonte, uma por processo — é o mesmo desenho de `clienteDoProcesso`, e pela
 * mesma razão.
 *
 * O defeito só aparecia com banco de verdade: com fixtures, reconstruir a
 * fonte é de graça, e por isso nem o contrato nem o e2e o viam.
 */

import { registrarFonte } from "@/acesso/fabrica";
import { criarFonteDeFixtures } from "@/acesso/fixtures/adaptador";
import type { DataSource } from "@/semantica/contrato";

registrarFonte("fixtures", async () => criarFonteDeFixtures());

let fonteDeWarehouse: Promise<DataSource> | null = null;

/** Só teste e carga: descarta a fonte memorizada e o cache que ela guarda. */
export function esquecerFonteDeWarehouse(): void {
  fonteDeWarehouse = null;
}

registrarFonte("warehouse", async () => {
  fonteDeWarehouse ??= (async () => {
    const [{ criarFonteDeWarehouse }, { clienteDoProcesso }] =
      await Promise.all([
        import("@/acesso/warehouse/adaptador"),
        import("@/acesso/postgres/cliente"),
      ]);
    return criarFonteDeWarehouse(clienteDoProcesso());
  })();
  /*
   * Uma construção que falha não fica guardada: um erro de rede na primeira
   * leitura deixaria a instância sem fonte para sempre.
   */
  try {
    return await fonteDeWarehouse;
  } catch (erro) {
    fonteDeWarehouse = null;
    throw erro;
  }
});
