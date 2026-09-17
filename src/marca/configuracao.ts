/**
 * As variáveis de ambiente da marca, e a armadilha que elas evitam.
 *
 * O esquema de `src/seguranca/configuracao.ts` continua sendo o lugar único
 * onde se pergunta "de que este ambiente precisa"; aqui ficam só as regras que
 * dependem umas das outras, para não engordar aquele arquivo com um assunto
 * que não é dele.
 */

/** As variáveis que este módulo declara. */
export const VARIAVEIS_DA_MARCA = [
  "MARCA_ARMAZEM",
  "MARCA_DIR",
  "MARCA_SITE",
] as const;

/** O diretório do armazém de arquivo. */
export function DIRETORIO_DA_MARCA(
  ambiente: Record<string, string | undefined>,
): string {
  const bruto = ambiente["MARCA_DIR"];
  if (bruto === undefined || bruto.trim() === "") {
    throw new Error(
      "MARCA_DIR é obrigatória quando MARCA_ARMAZEM=arquivo. A validação de " +
        "boot deveria ter parado antes daqui.",
    );
  }
  return bruto;
}

/**
 * O que cada modo de armazém exige junto.
 *
 * Mesma forma do mapa que a configuração já usa para condicionar
 * `DATABASE_URL` à fonte de dados. O modo `postgres` exige a **mesma**
 * `DATABASE_URL` da fonte de dados: marca e réplica moram no mesmo banco, no
 * esquema `amanna`.
 */
export const EXIGIDAS_POR_ARMAZEM: Readonly<Record<string, readonly string[]>> =
  {
    memoria: [],
    arquivo: ["MARCA_DIR"],
    postgres: ["DATABASE_URL"],
  };

/**
 * A combinação que parece funcionar e não funciona.
 *
 * `MARCA_ARMAZEM=arquivo` num ambiente de funções efêmeras é a pior espécie de
 * defeito: a gravação sucede, a leitura na mesma invocação sucede, a tela diz
 * "aplicado" — e a marca some no próximo início frio, ou não aparece para quem
 * caiu noutra instância. É o mesmo modo de falha que a trava de sessão de
 * fixtures na frente de dado real existe para impedir: subir **quase** certo.
 *
 * A detecção é por `VERCEL`, que a plataforma define sozinha. Num Docker do
 * cliente a variável não existe, e o modo de arquivo é justamente o certo.
 */
export function armazemDeArquivoEmDiscoEfemero(
  ambiente: Record<string, string | undefined>,
): boolean {
  const naVercel =
    ambiente["VERCEL"] !== undefined && ambiente["VERCEL"] !== "";
  return naVercel && ambiente["MARCA_ARMAZEM"] === "arquivo";
}

/**
 * O modo em memória só serve a teste.
 *
 * Numa instalação de verdade ele perde a marca a cada reinício, e ninguém
 * percebe até o cliente perguntar. `DATA_SOURCE=fixtures` é o sinal de que
 * isto é demonstração ou arnês — a mesma leitura que a trava de sessão faz.
 */
export function armazemEmMemoriaComDadoReal(
  ambiente: Record<string, string | undefined>,
): boolean {
  return (
    ambiente["MARCA_ARMAZEM"] === "memoria" &&
    ambiente["DATA_SOURCE"] === "warehouse"
  );
}
