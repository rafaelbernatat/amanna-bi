/**
 * Repartir um total em partes inteiras que somam exatamente o total (T-110).
 *
 * ## Por que isto existe antes de qualquer fixture
 *
 * A regra 1 do contrato diz que o KPI e o painel que o detalha somam o mesmo
 * total. Se as partes forem obtidas multiplicando o total por uma fração e
 * arredondando cada uma por conta própria, elas **não somam o total** — sobra
 * ou falta 1, quase sempre, e o painel passa a discordar do KPI por um dígito.
 *
 * Um dígito é o pior tamanho de erro possível: pequeno demais para alguém
 * notar na revisão, grande demais para sobreviver a uma reunião em que o número
 * é questionado. E o produto inteiro existe para sobreviver a essa reunião.
 *
 * Então a repartição é exata por construção, não por sorte de arredondamento.
 *
 * ## O método
 *
 * Maior resto (o mesmo da distribuição de cadeiras em eleição proporcional):
 * cada parte leva o piso da sua cota, e as unidades que sobram vão para as
 * partes com maior resto fracionário. Determinístico — empate desempata pelo
 * índice, então a mesma entrada devolve sempre a mesma saída, o que é requisito
 * da regra 5 (idempotência).
 */

/** Um total não pode ser repartido em zero partes. */
export class ReparticaoImpossivel extends Error {
  constructor(motivo: string) {
    super(`Repartição impossível: ${motivo}`);
    this.name = "ReparticaoImpossivel";
  }
}

/**
 * Reparte `total` entre partes proporcionais a `pesos`.
 *
 * Devolve inteiros que somam **exatamente** `total`. Peso zero recebe zero.
 *
 * ```ts
 * repartir(10, [1, 1, 1])  // [4, 3, 3] — e não [3, 3, 3] com 1 sumindo
 * ```
 */
export function repartir(
  total: number,
  pesos: readonly number[],
): readonly number[] {
  if (pesos.length === 0) {
    throw new ReparticaoImpossivel("nenhuma parte para receber o total");
  }
  if (!Number.isInteger(total)) {
    throw new ReparticaoImpossivel(`o total ${total} não é inteiro`);
  }
  if (pesos.some((p) => p < 0)) {
    throw new ReparticaoImpossivel("peso negativo");
  }

  const somaDosPesos = pesos.reduce((a, b) => a + b, 0);
  if (somaDosPesos <= 0) {
    throw new ReparticaoImpossivel("a soma dos pesos é zero");
  }

  const cotas = pesos.map((p) => (total * p) / somaDosPesos);
  const partes = cotas.map((c) => Math.floor(c));
  const jaDistribuido = partes.reduce((a, b) => a + b, 0);

  // As unidades que o piso deixou para trás, na ordem do maior resto.
  const porResto = cotas
    .map((c, i) => ({ i, resto: c - Math.floor(c) }))
    .sort((a, b) => b.resto - a.resto || a.i - b.i);

  let sobra = total - jaDistribuido;
  for (const { i } of porResto) {
    if (sobra <= 0) break;
    partes[i] = (partes[i] ?? 0) + 1;
    sobra -= 1;
  }
  return partes;
}

/**
 * Reparte uma matriz respeitando **as duas margens** ao mesmo tempo.
 *
 * O caso: o quadro por área precisa somar 1.240 e o quadro por modalidade
 * também. Repartir por área e depois por modalidade dentro de cada área acerta
 * a primeira margem e erra a segunda por alguns inteiros — e aí o painel de
 * modalidade discorda do painel de área sobre o tamanho da mesma empresa.
 *
 * Devolve `m[linha][coluna]` inteiro, com `soma(m[i]) = linhas[i]` e
 * `soma(m[·][j]) = colunas[j]`, exatos.
 *
 * O algoritmo: cada célula leva o piso do produto das margens dividido pelo
 * total; as unidades restantes vão, na ordem do maior resto, para células cuja
 * linha **e** coluna ainda estejam devendo. Como o que falta nas linhas e o que
 * falta nas colunas somam o mesmo número, o laço sempre fecha.
 */
export function repartirMatriz(
  linhas: readonly number[],
  colunas: readonly number[],
): readonly (readonly number[])[] {
  const totalLinhas = linhas.reduce((a, b) => a + b, 0);
  const totalColunas = colunas.reduce((a, b) => a + b, 0);
  if (totalLinhas !== totalColunas) {
    throw new ReparticaoImpossivel(
      `as margens não fecham: linhas somam ${totalLinhas} e colunas somam ${totalColunas}`,
    );
  }
  if (totalLinhas === 0) {
    return linhas.map(() => colunas.map(() => 0));
  }

  const exato = linhas.map((li) =>
    colunas.map((cj) => (li * cj) / totalLinhas),
  );
  return arredondarComMargens(exato, linhas, colunas);
}

/**
 * Arredonda uma matriz de reais para inteiros que fecham as duas margens.
 *
 * Extraída em T-140.2 para que a repartição proporcional e a com perfil usem
 * **o mesmo** arredondamento. Duas cópias divergiriam no desempate, e o
 * desempate é o que faz a fixture ser reproduzível byte a byte — requisito da
 * regra 5 (idempotência), não detalhe de implementação.
 *
 * Maior resto, com empate resolvido pelo índice.
 */
function arredondarComMargens(
  exato: readonly (readonly number[])[],
  linhas: readonly number[],
  colunas: readonly number[],
): readonly (readonly number[])[] {
  const matriz = exato.map((linha) => linha.map((v) => Math.floor(v)));

  const faltaLinha = linhas.map(
    (li, i) => li - (matriz[i] ?? []).reduce((a, b) => a + b, 0),
  );
  const faltaColuna = colunas.map(
    (cj, j) => cj - matriz.reduce((a, m) => a + (m[j] ?? 0), 0),
  );

  const candidatas = linhas
    .flatMap((_li, i) =>
      colunas.map((_cj, j) => {
        const v = exato[i]?.[j] ?? 0;
        return { i, j, resto: v - Math.floor(v) };
      }),
    )
    .sort((a, b) => b.resto - a.resto || a.i - b.i || a.j - b.j);

  for (const { i, j } of candidatas) {
    if ((faltaLinha[i] ?? 0) <= 0 || (faltaColuna[j] ?? 0) <= 0) continue;
    const linha = matriz[i];
    if (linha === undefined) continue;
    linha[j] = (linha[j] ?? 0) + 1;
    faltaLinha[i] = (faltaLinha[i] ?? 0) - 1;
    faltaColuna[j] = (faltaColuna[j] ?? 0) - 1;
  }

  /*
   * Uma passada de maior resto pode não zerar tudo: uma linha ainda devendo
   * pode ter todas as suas colunas já satisfeitas naquela ordem. Aqui se
   * completa por varredura, que sempre encontra par — o que falta nas linhas e
   * nas colunas continua somando o mesmo número.
   */
  for (let i = 0; i < linhas.length; i += 1) {
    for (let j = 0; j < colunas.length && (faltaLinha[i] ?? 0) > 0; j += 1) {
      const passos = Math.min(faltaLinha[i] ?? 0, faltaColuna[j] ?? 0);
      if (passos <= 0) continue;
      const linha = matriz[i];
      if (linha === undefined) continue;
      linha[j] = (linha[j] ?? 0) + passos;
      faltaLinha[i] = (faltaLinha[i] ?? 0) - passos;
      faltaColuna[j] = (faltaColuna[j] ?? 0) - passos;
    }
  }

  return matriz;
}

/**
 * Ajusta as somas por coluna sem mexer nas somas por linha.
 *
 * Serve ao caso de três margens ao mesmo tempo. As horas de treinamento
 * precisam fechar por mês, por área **e** por modalidade; `repartirMatriz`
 * acerta duas, e a terceira sai com alguns inteiros de diferença — pouco em
 * proporção, e mesmo assim visível, porque o painel escreve "11.796 h" onde o
 * protótipo aprovado escreve "11.800 h".
 *
 * Move unidades entre colunas **dentro da mesma linha**, então a soma de cada
 * linha permanece exata. Devolve a matriz ajustada.
 */
export function ajustarMargemDeColuna(
  matriz: readonly (readonly number[])[],
  alvos: readonly number[],
): readonly (readonly number[])[] {
  const saida = matriz.map((linha) => [...linha]);
  const soma = (j: number) => saida.reduce((a, l) => a + (l[j] ?? 0), 0);

  for (let j = 0; j < alvos.length; j += 1) {
    let falta = (alvos[j] ?? 0) - soma(j);

    // Falta na coluna j: tira de uma coluna que está sobrando, na mesma linha.
    while (falta !== 0) {
      const doador = alvos.findIndex((alvo, k) => {
        if (k === j) return false;
        const diferenca = soma(k) - (alvo ?? 0);
        return falta > 0 ? diferenca > 0 : diferenca < 0;
      });
      if (doador === -1) break;

      const linha = saida.find((l) => {
        const de = falta > 0 ? doador : j;
        return (l[de] ?? 0) > 0;
      });
      if (linha === undefined) break;

      const passo = falta > 0 ? 1 : -1;
      linha[j] = (linha[j] ?? 0) + passo;
      linha[doador] = (linha[doador] ?? 0) - passo;
      falta -= passo;
    }
  }
  return saida;
}

/**
 * Quantas passadas de ajuste o encaixe faz (T-140.2).
 *
 * Numero fixo, e nao "ate convergir por tolerancia": a fixture precisa sair
 * byte a byte igual em toda execucao (regra 5), e um criterio de parada por
 * tolerancia depende de ponto flutuante numa ordem que pode mudar entre
 * plataformas. Quarenta passadas sobre uma matriz de 12 x 42 custa
 * microssegundos e chega muito alem do que o arredondamento consegue
 * distinguir.
 */
const PASSADAS_DE_AJUSTE = 40;

/** Quanto as margens podem divergir depois do ajuste, antes de virar erro. */
const FOLGA_DO_AJUSTE = 1e-6;

/**
 * Reparte respeitando as duas margens **e** um perfil declarado (T-140.2).
 *
 * ## O que `repartirMatriz` nao consegue fazer
 *
 * Ela distribui o interior por independencia: `celula = linha x coluna / total`.
 * E a solucao proporcional, e proporcional e exatamente o que **nao** distingue
 * recortar de escalar. Com ela, a fatia da Unidade SP na folha e 0,6800 nos
 * doze meses; somar seis meses de um recorte e escalar o consolidado por 0,68
 * dao o mesmo numero, e a suite de contrato nao tem como notar a diferenca.
 *
 * O achado 3 do Anexo D e sobre isso, e o achado 4 e a consequencia: a
 * reconciliacao parecia correta porque KPI e painel escalavam pelo mesmo fator.
 * Um dataset onde toda dimensao se reparte por constante e um dataset onde o
 * defeito do prototipo passa despercebido.
 *
 * ## O que esta faz
 *
 * Recebe um `perfil` — um peso por celula e por mes — e encontra a matriz mais
 * proxima dele que ainda fecha as duas margens. As margens continuam exatas: o
 * total de cada mes e o total de cada celula no ano sao os mesmos de antes. O
 * que muda e **como** cada mes se reparte por dentro.
 *
 * O metodo e ajuste proporcional iterativo: escala as linhas para fecharem,
 * depois as colunas, e repete. Cada passada aproxima as duas margens ao mesmo
 * tempo, e o perfil sobrevive como a forma relativa do interior.
 *
 * ## Peso zero e margem zero
 *
 * Peso zero mantem a celula em zero para sempre — e o jeito de dizer "esta
 * combinacao nao existe". Se isso tornar uma margem inalcancavel, a funcao
 * **lanca**: uma margem que nao fecha em silencio e uma fixture que nao soma, e
 * a regra 1 acusaria isso muito depois, num painel, sem dizer de onde veio.
 */
export function repartirMatrizComPerfil(
  linhas: readonly number[],
  colunas: readonly number[],
  perfil: readonly (readonly number[])[],
): readonly (readonly number[])[] {
  const totalLinhas = linhas.reduce((a, b) => a + b, 0);
  const totalColunas = colunas.reduce((a, b) => a + b, 0);
  if (totalLinhas !== totalColunas) {
    throw new ReparticaoImpossivel(
      `as margens não fecham: linhas somam ${totalLinhas} e colunas somam ${totalColunas}`,
    );
  }
  if (totalLinhas === 0) {
    return linhas.map(() => colunas.map(() => 0));
  }

  const x = linhas.map((_li, i) =>
    colunas.map((_cj, j) => Math.abs(perfil[i]?.[j] ?? 0)),
  );

  for (let passada = 0; passada < PASSADAS_DE_AJUSTE; passada += 1) {
    for (let i = 0; i < linhas.length; i += 1) {
      const linha = x[i];
      if (linha === undefined) continue;
      const soma = linha.reduce((a, b) => a + b, 0);
      // Soma zero: não há como escalar, e forçar dividiria por zero. A margem
      // que ficar devendo aparece na conferência abaixo, com nome.
      if (soma === 0) continue;
      const fator = (linhas[i] ?? 0) / soma;
      for (let j = 0; j < linha.length; j += 1)
        linha[j] = (linha[j] ?? 0) * fator;
    }
    for (let j = 0; j < colunas.length; j += 1) {
      const soma = x.reduce((a, linha) => a + (linha[j] ?? 0), 0);
      if (soma === 0) continue;
      const fator = (colunas[j] ?? 0) / soma;
      for (const linha of x) linha[j] = (linha[j] ?? 0) * fator;
    }
  }

  for (let i = 0; i < linhas.length; i += 1) {
    const soma = (x[i] ?? []).reduce((a, b) => a + b, 0);
    if (Math.abs(soma - (linhas[i] ?? 0)) > FOLGA_DO_AJUSTE * totalLinhas) {
      throw new ReparticaoImpossivel(
        `o perfil não permite fechar a linha ${String(i)}: ela pede ` +
          `${String(linhas[i])} e o ajuste chegou a ${String(soma)}. ` +
          "Peso zero em toda a linha é o caso mais comum.",
      );
    }
  }

  return arredondarComMargens(x, linhas, colunas);
}
