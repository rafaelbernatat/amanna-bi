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
 */

import { registrarFonte } from "@/acesso/fabrica";
import { criarFonteDeFixtures } from "@/acesso/fixtures/adaptador";

registrarFonte("fixtures", async () => criarFonteDeFixtures());

registrarFonte("warehouse", async () => {
  const [{ criarFonteDeWarehouse }, { clienteDoProcesso }] = await Promise.all([
    import("@/acesso/warehouse/adaptador"),
    import("@/acesso/postgres/cliente"),
  ]);
  return criarFonteDeWarehouse(clienteDoProcesso());
});
