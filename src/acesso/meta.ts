/**
 * A leitura de `getMeta`, e o que acontece quando ela falha (T-149).
 *
 * ## O requisito não é "tratar o erro"
 *
 * RF-22 e a seção 10.2 são específicos: *"a falha mantém a réplica anterior e
 * marca o selo de frescor como defasado. **Nunca serve dado parcial**."* E a
 * tabela 6.4 pede, no estado de erro de fonte, *"o horário da última leitura
 * bem-sucedida"*.
 *
 * As duas frases juntas descrevem uma coisa só: quando a fonte cai, quem
 * pergunta precisa saber **até quando** o que estava na tela era verdade. Um
 * `catch` que devolvesse `null`, ou um objeto meio preenchido, apagaria
 * exatamente essa informação — e a tela mostraria "erro" sem dizer se o número
 * de ontem ainda vale.
 *
 * ## Por que a memória mora aqui, e não no adaptador
 *
 * O adaptador de warehouse vai cair de um jeito, o de fixtures de outro, e um
 * terceiro apareceria com a sua própria ideia do que guardar. A memória do
 * último sucesso é comportamento de produto, não de fonte: ela vale igual para
 * os dois, e é isso que a suíte de contrato (RF-21) precisa poder afirmar.
 *
 * ## A memória é da sessão, e isso é deliberado
 *
 * Ela não sobrevive a um reinício. Poderia — bastaria persistir —, e não deve:
 * um horário de última leitura lido de disco depois de dias parados diria "o
 * dado é de terça" sobre um processo que nunca leu nada nesta vida. Vazio é a
 * resposta honesta para "nunca li com sucesso", e a 6.4 aceita: ela pede o
 * horário *quando ele existe*.
 */

import { obterFonteDeDados } from "@/acesso/fabrica";
import "@/acesso/registrar";
import type { DataSource, Frescor, Meta } from "@/semantica/contrato";

/**
 * A fonte não respondeu, e aqui está até quando o que se sabia era verdade.
 *
 * Tipado, e não um `Error` qualquer, porque a tela decide o estado a partir
 * dele: erro de fonte desenha a caixa com o horário da última leitura, e
 * qualquer outra falha é defeito de programação e não pode virar um estado
 * bonitinho na interface.
 */
export class MetaIndisponivel extends Error {
  constructor(
    /** O frescor da última leitura bem-sucedida, ou `null` se nunca houve. */
    readonly ultimoFrescor: Frescor | null,
    readonly causa: unknown,
  ) {
    super(
      "Não foi possível ler `getMeta` da fonte. " +
        (ultimoFrescor === null
          ? "Nenhuma leitura bem-sucedida nesta sessão."
          : `Última leitura bem-sucedida em ${ultimoFrescor.sincronizadoEm}.`) +
        " A réplica anterior é mantida e nada parcial é servido (RF-22).",
    );
    this.name = "MetaIndisponivel";
  }
}

/** Quem lê a meta guardando o último sucesso. */
export type LeitorDeMeta = {
  ler(agora: Date): Promise<Meta>;
  /** O frescor da última leitura que deu certo, para quem precisa reportá-lo. */
  ultimoFrescor(): Frescor | null;
};

/**
 * Monta um leitor sobre uma fonte.
 *
 * Recebe a fonte por parâmetro para que o teste possa entregar uma que falha —
 * sem isso, o caminho de erro só seria exercitado derrubando um banco.
 */
export function criarLeitorDeMeta(fonte: DataSource): LeitorDeMeta {
  let ultimo: Frescor | null = null;

  return {
    async ler(_agora: Date): Promise<Meta> {
      try {
        const meta = await fonte.getMeta();
        // Só depois de a leitura inteira ter dado certo. Guardar antes deixaria
        // a memória apontar para uma leitura que não terminou.
        ultimo = meta.frescor;
        return meta;
      } catch (erro) {
        throw new MetaIndisponivel(ultimo, erro);
      }
    },
    ultimoFrescor(): Frescor | null {
      return ultimo;
    },
  };
}

/**
 * O leitor do processo.
 *
 * Um por processo, porque a memória do último sucesso não faz sentido por
 * requisição: cada requisição teria a sua, sempre vazia, e o horário da última
 * leitura nunca existiria.
 */
let doProcesso: LeitorDeMeta | null = null;

/** A meta, pela fábrica de T-106. É por aqui que a tela lê. */
export async function lerMeta(agora: Date = new Date()): Promise<Meta> {
  doProcesso ??= criarLeitorDeMeta(await obterFonteDeDados());
  return doProcesso.ler(agora);
}

/**
 * O frescor da última leitura bem-sucedida do processo, ou `null`.
 *
 * É o que o estado "erro de fonte" da tabela 6.4 pede — e quem o consome é
 * `lerPainelParaTela`, que precisa dizer até quando o que estava na tela era
 * verdade. Não força uma leitura: se ninguém leu ainda, a resposta é `null`, e
 * `null` é a resposta certa.
 */
export function ultimoFrescorConhecido(): Frescor | null {
  return doProcesso?.ultimoFrescor() ?? null;
}

/** Só para teste: devolve o leitor do processo ao estado limpo. */
export function esquecerLeitorDeMeta(): void {
  doProcesso = null;
}
