/**
 * O armazém em memória: teste, e só teste.
 *
 * Não persiste nada, e é por isso que ele é o modo do arnês de ponta a ponta:
 * cada subida do servidor começa sem marca, e um caso que aplica marca não
 * contamina o próximo. Numa instalação de verdade seria o pior dos mundos — a
 * marca sumiria a cada reinício sem ninguém perceber —, e a validação de
 * configuração recusa este modo na frente de dado real.
 *
 * ## Por que o estado mora no escopo global do processo
 *
 * Uma variável de módulo parece bastar e não basta: o servidor empacota cada
 * rota e cada página em seu próprio pedaço, e o mesmo módulo pode ser
 * instanciado mais de uma vez no mesmo processo. Com o estado numa variável de
 * módulo, a rota que grava e a página que lê ficavam em instâncias diferentes:
 * a tela dizia "aplicado" e o painel não mudava, sem erro em lugar nenhum.
 *
 * O escopo global é um por processo, e é a única coisa que os dois pedaços
 * compartilham com certeza. É o mesmo recurso que se usa para um cliente de
 * banco não ser aberto duas vezes.
 */

import type { ArmazemDaMarca } from "@/marca/armazem";
import { ESTADO_VAZIO, type EstadoDaMarca } from "@/marca/documento";

/** A chave do estado no escopo do processo. */
const CHAVE = Symbol.for("amanna-bi.marca.memoria");

type Portador = { [CHAVE]?: EstadoDaMarca };

function portador(): Portador {
  return globalThis as unknown as Portador;
}

export function criarArmazemEmMemoria(): ArmazemDaMarca {
  return {
    ler: async () => portador()[CHAVE] ?? ESTADO_VAZIO,
    gravar: async (estado) => {
      portador()[CHAVE] = estado;
    },
    limpar: async () => {
      portador()[CHAVE] = ESTADO_VAZIO;
    },
  };
}

/** Só para teste: devolve o estado do processo ao começo. */
export function esquecerMarcaEmMemoria(): void {
  delete portador()[CHAVE];
}
