/**
 * Quem configura a marca da instalacao (D-MARCA).
 *
 * ## Por que isto nao entra na matriz de autorizacao
 *
 * A matriz de `src/seguranca/autorizacao.ts` responde uma pergunta especifica
 * — "quem enxerga qual painel" — e e derivada do registro de paineis. Marca
 * nao e painel, nao e dado do cliente, e vale para a instalacao inteira.
 *
 * Enfia-la la exigiria inventar um painel que nao existe dentro de um modulo
 * que nao existe, e o artefato que a Controladoria le como inventario de
 * acesso a dado deixaria de dizer o que diz. Pior: o enum `Acesso` e fechado
 * **sobre leitura de dado do cliente**, e a frase "nenhum perfil escreve,
 * porque o produto nao escreve no dado do cliente" continua verdadeira — a
 * marca e configuracao da instalacao, nao dado do cliente.
 *
 * Entao a regra mora aqui, explicita e testada por perfil. O gerador da
 * matriz publica esta lista no contrato versionado, para que o documento
 * legivel continue completo sem que o enum precise crescer.
 *
 * ## Esconder o botao nao e o controle
 *
 * O cabecalho esconde o botao de quem nao pode, e isso e cortesia. O controle
 * e a rota, que confere a sessao antes de ler o corpo do pedido.
 */

import type { Perfil } from "@/seguranca/identidade";

/**
 * Os dois perfis que ja enxergam a instalacao inteira.
 *
 * `rh` e `area` tem recorte proprio e nao respondem pela aparencia do produto;
 * `auditor` le tudo e a trilha, mas leitura e o papel dele — dar-lhe escrita
 * inverteria o sentido do perfil.
 */
export const PERFIS_QUE_CONFIGURAM_MARCA: readonly Perfil[] = [
  "diretoria",
  "controller",
];

export function podeConfigurarMarca(perfil: Perfil): boolean {
  return PERFIS_QUE_CONFIGURAM_MARCA.includes(perfil);
}
