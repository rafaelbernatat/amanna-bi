/**
 * Registra os armazéns que não trazem dependência nenhuma.
 *
 * Mesma divisão de `src/acesso/registrar.ts`: memória e arquivo entram aqui
 * porque são `node:fs` e um objeto; o armazém de nuvem se registra no próprio
 * módulo, para que quem escolheu o Docker do cliente não carregue no grafo um
 * cliente HTTP de nuvem que nunca vai chamar.
 *
 * ## Por que o registro é uma função, e não só o efeito de importar
 *
 * O efeito de importar acontece uma vez por processo, e um teste que limpa a
 * fábrica não tem como refazê-lo. Com a função exportada, o produto continua
 * registrando ao importar — a última linha faz isso — e o teste consegue
 * devolver a fábrica ao estado do produto depois de mexer nela.
 */

import { registrarArmazem } from "@/marca/armazem";
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
 */
const EM_MEMORIA = criarArmazemEmMemoria();

/** Põe na fábrica os armazéns que o produto traz consigo. */
export function registrarArmazensDoProduto(): void {
  registrarArmazem("memoria", async () => EM_MEMORIA);
  registrarArmazem("arquivo", async (ambiente) =>
    criarArmazemEmArquivo(DIRETORIO_DA_MARCA(ambiente)),
  );
}

registrarArmazensDoProduto();
