/**
 * Registra os três armazéns na fábrica.
 *
 * Mesma divisão de `src/acesso/registrar.ts`: memória e arquivo entram por
 * import comum, porque são `node:fs` e um objeto; o de Postgres entra por
 * **import dinâmico**, para que quem escolheu o Docker do cliente com um
 * volume montado não carregue no grafo o driver de banco que nunca vai
 * chamar. Em modo `memoria` e `arquivo`, `pg` fica fora do pacote.
 *
 * ## Por que o registro é uma função, e não só o efeito de importar
 *
 * O efeito de importar acontece uma vez por processo, e um teste que limpa a
 * fábrica não tem como refazê-lo. Com a função exportada, o produto continua
 * registrando ao importar — a última linha faz isso — e o teste consegue
 * devolver a fábrica ao estado do produto depois de mexer nela.
 */

import { registrarArmazem, type ArmazemDaMarca } from "@/marca/armazem";
import { criarArmazemEmArquivo } from "@/marca/armazens/arquivo";
import { criarArmazemEmMemoria } from "@/marca/armazens/memoria";
import { DIRETORIO_DA_MARCA } from "@/marca/configuracao";

/*
 * O armazém em memória é criado **uma vez**, e não a cada chamada.
 *
 * A fábrica chama o construtor toda vez que alguém pede o armazém, e o de
 * memória guarda o estado numa variável do próprio objeto: um construtor por
 * chamada dava um armazém por chamada, a gravação ia para um e a leitura vinha
 * de outro vazio. A tela dizia "aplicado" e o painel não mudava — e como o
 * arnês de ponta a ponta usa justamente este modo, o defeito só apareceu lá.
 *
 * O de arquivo não tem esse cuidado porque não guarda estado: o estado é o
 * arquivo, e dois objetos apontando para o mesmo caminho são a mesma coisa.
 *
 * O de Postgres também é um por processo, mas por outra razão: ele memoriza a
 * aplicação do DDL, e o cliente por baixo já é o pool único do processo. Um
 * armazém por chamada refaria o `CREATE TABLE IF NOT EXISTS` a cada gravação —
 * inofensivo, e desnecessário.
 */
const EM_MEMORIA = criarArmazemEmMemoria();

const CHAVE_DO_POSTGRES = Symbol.for("amanna-bi.marca.postgres");
type Portador = {
  [CHAVE_DO_POSTGRES]?: Promise<ArmazemDaMarca>;
};

/** Põe na fábrica os armazéns que o produto traz consigo. */
export function registrarArmazensDoProduto(): void {
  registrarArmazem("memoria", async () => EM_MEMORIA);
  registrarArmazem("arquivo", async (ambiente) =>
    criarArmazemEmArquivo(DIRETORIO_DA_MARCA(ambiente)),
  );
  registrarArmazem("postgres", async (ambiente) => {
    const portador = globalThis as unknown as Portador;
    portador[CHAVE_DO_POSTGRES] ??= Promise.all([
      import("@/marca/armazens/postgres"),
      import("@/acesso/postgres/cliente"),
    ]).then(([{ criarArmazemEmPostgres }, { clienteDoProcesso }]) =>
      criarArmazemEmPostgres({ cliente: clienteDoProcesso(ambiente) }),
    );
    return portador[CHAVE_DO_POSTGRES];
  });
}

registrarArmazensDoProduto();
