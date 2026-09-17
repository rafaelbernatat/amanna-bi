/**
 * O que a tela precisa saber sobre a marca e sobre quem entrou.
 *
 * Um lugar só monta essa cadeia — identidade, permissão e marca — e a
 * apresentação recebe pronto. É a mesma disciplina de `src/acesso/leitura.ts`:
 * o componente de tela não constrói a própria sessão, não pergunta ao armazém
 * e não decide quem pode o quê.
 *
 * A identidade chega por `lerIdentidade`, que é da camada de acesso. O nome da
 * função que constrói sessão não aparece neste arquivo de propósito: um teste
 * de arquitetura procura por ele no texto do produto, e citá-lo aqui — ainda
 * que só em comentário — faria a guarda apontar para a explicação em vez de
 * apontar para o defeito.
 */

import { lerIdentidade } from "@/acesso/leitura";
import { hospedeiroDe, type Marca } from "@/marca/documento";
import { lerMarcaAtiva } from "@/marca/leitura";
import { podeConfigurarMarca } from "@/marca/permissao";
import { personalizacaoLigada } from "@/marca/armazem";
import type { Perfil } from "@/seguranca/identidade";

export { hospedeiroDe };

/** O endereço da rota que serve o logo, com a impressão como versão. */
export const ROTA_DO_LOGO = "/api/marca/logo";

/** O que o cabeçalho escreve quando a instalação não tem nome próprio. */
export const NOME_PADRAO_DA_INSTALACAO = "Controladoria";

export type CabecalhoDaInstalacao = {
  readonly conta: {
    readonly perfil: Perfil;
    readonly podeConfigurar: boolean;
  };
  /** O nome escrito no cabeçalho: o da marca, ou o padrão. */
  readonly nome: string;
  readonly logo: { readonly src: string; readonly alt: string } | null;
};

/**
 * O texto alternativo do logo nomeia a instalação, e não "logo": quem usa
 * leitor de tela precisa saber de quem é a marca, não que existe uma imagem.
 * O nome informado vem primeiro; sem ele, o domínio do site; sem os dois, o
 * que sobra dizer.
 */
export function rotuloDoLogo(marca: Marca): string {
  if (marca.nome !== null) return marca.nome;
  if (marca.site !== null) return hospedeiroDe(marca.site);
  return "Logo da instalação";
}

/**
 * Monta o que o cabeçalho desenha.
 *
 * O endereço do logo carrega a impressão do conteúdo. Isso deixa a rota poder
 * responder com cache longo sem nunca servir o logo velho: marca nova, endereço
 * novo. É a mesma ideia de um nome de arquivo com resumo, e evita a alternativa
 * ruim — cache curto, e uma ida ao armazém a cada tela.
 */
export async function lerCabecalhoDaInstalacao(): Promise<CabecalhoDaInstalacao> {
  const [identidade, marca] = await Promise.all([
    lerIdentidade(),
    lerMarcaAtiva(),
  ]);

  const logo =
    marca?.logo == null
      ? null
      : {
          src: `${ROTA_DO_LOGO}?v=${marca.logo.impressao.slice(0, 12)}`,
          alt: rotuloDoLogo(marca),
        };

  return {
    conta: {
      perfil: identidade.perfil,
      // A personalização desligada esconde o botão: não há para onde ir.
      podeConfigurar:
        personalizacaoLigada() && podeConfigurarMarca(identidade.perfil),
    },
    nome: marca?.nome ?? NOME_PADRAO_DA_INSTALACAO,
    logo,
  };
}
