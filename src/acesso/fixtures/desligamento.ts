/**
 * `vw_fato_rh_desligamento` — quem saiu, quebrado (T-118.1).
 *
 * ## Por que uma view só para as saídas
 *
 * `vw_fato_rh_mes` guarda **quantos** saíram. Não guarda por que tipo, de que
 * gênero, de que faixa etária — e é isso que os painéis `tov-tipos` e
 * `tov-corte` mostram. A leitura que eles dão é a que muda decisão: saída
 * voluntária pede retenção, saída involuntária pede seleção, e a faixa 18–24
 * saindo várias vezes mais que a de 55+ é problema de integração, não de
 * mercado.
 *
 * A forma é o espelho de `vw_fato_rh_perfil`: `dimensao` e `valor` genéricos em
 * vez de uma coluna por atributo. Assim uma dimensão nova é uma linha nova, e
 * não uma migração de esquema.
 *
 * ## Não é uma segunda contagem de saídas
 *
 * Dentro de cada dimensão, a soma dos desligamentos de uma célula é **a mesma**
 * coluna que `vw_fato_rh_mes` já traz. Não há como o painel dizer 148 enquanto
 * o cartão diz 145: os dois leem o mesmo número, um deles repartido. Um teste
 * fixa a igualdade em toda célula e em toda dimensão.
 *
 * ## O que aqui é valor de protótipo
 *
 * A **taxonomia de tipo** (voluntário, sem justa causa, aposentadoria, outros)
 * é decisão de RH e está em **H-54** — inclusive o caso do acordo do art. 484-A,
 * que muitas empresas contam como voluntário e que faz o número de retenção
 * parecer melhor do que é.
 *
 * As **categorias de gênero** são decisão de RH com o Jurídico e estão em
 * **H-55**, junto com a questão de separar "outro" de "não informado" — que a
 * fixture herda junta do protótipo, e que não deveria continuar junta.
 *
 * O que **não** é valor de protótipo é o formato da repartição: o desligamento
 * de cada célula é repartido pelos pesos declarados abaixo, então filtrar por
 * área ou por entidade muda o desenho, em vez de mostrar o mesmo sempre.
 */

import {
  QUADRO_POR_FAIXA_ETARIA,
  QUADRO_POR_GENERO,
} from "@/acesso/fixtures/referencia-perfil";
import { repartirMatriz } from "@/acesso/fixtures/reparticao";
import { VW_FATO_RH_MES } from "@/acesso/fixtures/rh";

/** Uma linha: uma célula do grão de RH, um valor de uma dimensão. */
export type LinhaDesligamento = {
  readonly mes: string;
  readonly entidade: string;
  readonly area: string;
  readonly modalidade: string;
  /** `tipo`, `genero` ou `faixa_etaria`. */
  readonly dimensao: string;
  readonly valor: string;
  readonly desligamentos: number;
};

/**
 * As quebras das saídas, com o peso de cada valor.
 *
 * Os pesos vêm do protótipo e são **participação**, não contagem: a contagem
 * sai da repartição dos desligamentos reais de cada célula. Copiar as contagens
 * daria um total de 145 no consolidado e nada coerente em qualquer recorte.
 */
/**
 * O turnover declarado de cada valor, em décimos de ponto percentual.
 *
 * Vêm do protótipo. Não são a taxa que o produto exibe — essa sai da divisão
 * entre saídas e quadro, mês a mês, e muda com o recorte. Aqui servem só como
 * **peso relativo**: o que importa é que a faixa jovem saia várias vezes mais
 * que a mais velha, não o valor absoluto de cada uma.
 */
const TURNOVER_POR_GENERO: Readonly<Record<string, number>> = {
  masculino: 192,
  feminino: 172,
  "outro-ou-nao-informado": 150,
};

const TURNOVER_POR_FAIXA_ETARIA: Readonly<Record<string, number>> = {
  "18-24": 314,
  "25-34": 218,
  "35-44": 136,
  "45-54": 92,
  "55-mais": 68,
};

/**
 * Os pesos de uma quebra, derivados do quadro.
 *
 * Os códigos vêm de `QUEBRAS_DO_QUADRO` e **não** são reescritos aqui. A
 * primeira versão os copiava à mão e escreveu `55+` onde o quadro diz
 * `55-mais`; o resultado foi um painel que dividia saídas por um quadro vazio.
 * Derivando, os dois lados não têm como divergir.
 */
function pesosDe(
  quadro: readonly { readonly codigo: string; readonly headcount: number }[],
  taxa: Readonly<Record<string, number>>,
): readonly { readonly codigo: string; readonly peso: number }[] {
  return quadro.map((parte) => ({
    codigo: parte.codigo,
    peso: parte.headcount * (taxa[parte.codigo] ?? 0),
  }));
}

export const QUEBRAS_DA_SAIDA: Readonly<
  Record<string, readonly { readonly codigo: string; readonly peso: number }[]>
> = {
  /* 90 + 42 + 8 + 5 = 145 saídas no protótipo. Ver H-54. */
  tipo: [
    { codigo: "voluntario", peso: 90 },
    { codigo: "sem-justa-causa", peso: 42 },
    { codigo: "aposentadoria", peso: 8 },
    { codigo: "outros", peso: 5 },
  ],
  /*
   * Peso = quadro × turnover da faixa. É isso que faz a repartição das SAÍDAS
   * diferir da repartição do QUADRO: masculino é 57 % do quadro e sai um pouco
   * mais que isso, porque o turnover dele é maior. Repartir pelo tamanho da
   * faixa daria taxa de saída igual em todas, e o painel `tov-corte` não diria
   * nada. Ver H-55 e H-54.
   */
  genero: pesosDe(QUADRO_POR_GENERO, TURNOVER_POR_GENERO),
  /*
   * Aqui o contraste é forte e é a leitura do painel: a faixa mais jovem é uma
   * fatia pequena do quadro e responde por uma fatia muito maior das saídas.
   */
  faixa_etaria: pesosDe(QUADRO_POR_FAIXA_ETARIA, TURNOVER_POR_FAIXA_ETARIA),
};

export const DIMENSOES_DA_SAIDA: readonly string[] =
  Object.keys(QUEBRAS_DA_SAIDA);

export const VW_FATO_RH_DESLIGAMENTO: readonly LinhaDesligamento[] = (() => {
  const saida: LinhaDesligamento[] = [];

  for (const [dimensao, valores] of Object.entries(QUEBRAS_DA_SAIDA)) {
    /*
     * `repartirMatriz` por dimensão, e não `repartir` por célula.
     *
     * As duas margens fecham ao mesmo tempo: cada célula soma o desligamento
     * que ela já tinha, e cada valor da dimensão soma a participação
     * declarada. Repartir célula a célula fecharia só a primeira, e a segunda
     * sairia com sobra espalhada — o painel mostraria 61,8 % de saídas
     * voluntárias onde a decisão registrada diz 62 %.
     */
    const porCelula = VW_FATO_RH_MES.map((l) => l.desligamentos);
    const total = porCelula.reduce((a, b) => a + b, 0);

    const alvos = valores.map((v) => v.peso);
    const somaDosPesos = alvos.reduce((a, b) => a + b, 0);
    const porValor = alvos.map((p) => Math.round((total * p) / somaDosPesos));

    // As duas margens precisam somar igual; a última absorve o arredondamento.
    const ultimo = porValor.length - 1;
    if (ultimo >= 0) {
      porValor[ultimo] =
        (porValor[ultimo] ?? 0) + (total - porValor.reduce((a, b) => a + b, 0));
    }

    const matriz = repartirMatriz(porCelula, porValor);

    matriz.forEach((daCelula, i) => {
      const celula = VW_FATO_RH_MES[i];
      if (celula === undefined) return;
      daCelula.forEach((quantos, j) => {
        const valor = valores[j];
        if (valor === undefined) return;
        saida.push({
          mes: celula.mes,
          entidade: celula.entidade,
          area: celula.area,
          modalidade: celula.modalidade,
          dimensao,
          valor: valor.codigo,
          desligamentos: quantos,
        });
      });
    });
  }

  return saida;
})();
