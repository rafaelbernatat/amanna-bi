/**
 * A geometria do sparkline do cartão de KPI (T-131).
 *
 * Fica em módulo próprio, e não dentro do componente, por dois motivos. Um: dá
 * para testar a forma sem montar React — e o que precisa de teste aqui é a
 * conversão de série em traço, não a marcação. Dois: mantém o componente sem
 * conta nenhuma, que é o que o aceite pede quando diz que valor, delta, rodapé
 * e sparkline vêm de `getKpis`.
 *
 * Os números daqui são **espaço de desenho**, não dado: o `viewBox` é um
 * sistema de coordenadas fixo que o CSS estica. Nenhum deles pode virar valor
 * exibido, e nenhum passa por formatador.
 */

/** A largura do sistema de coordenadas. O CSS estica; a proporção fica. */
export const LARGURA_DA_SPARKLINE = 100;

/** A altura do sistema de coordenadas. */
export const ALTURA_DA_SPARKLINE = 24;

/** Folga em cima e embaixo, para o traço não encostar na borda da caixa. */
export const FOLGA_DA_SPARKLINE = 2;

/**
 * Menos que isto não é tendência, é ruído.
 *
 * O protótipo usa o mesmo corte (`k.sv.length < 3` devolve o cartão sem
 * traço), e a razão continua valendo: dois pontos desenham uma reta que sugere
 * direção sem ter evidência de direção. Recorte de um mês, por exemplo, tem um
 * ponto só — ali o cartão mostra o número e mais nada.
 */
export const MINIMO_DE_PONTOS = 3;

/**
 * Os traços que desenham a série.
 *
 * Devolve **um caminho por trecho contínuo**, e não um só. Mês sem dado no
 * recorte é lacuna de verdade: ligar o ponto de antes ao de depois desenharia
 * uma reta atravessando a ausência, que é exatamente transformar "não sei" em
 * "foi assim" — o oposto do princípio PR-4.
 *
 * Vazio quer dizer "não desenhe": série curta demais, ou pontos de menos.
 */
export function caminhosDaSparkline(
  serie: readonly (number | null)[],
): readonly string[] {
  const conhecidos = serie.filter((v): v is number => v !== null);
  if (conhecidos.length < MINIMO_DE_PONTOS) return [];

  const menor = Math.min(...conhecidos);
  const maior = Math.max(...conhecidos);
  const amplitude = maior - menor;

  const x = (i: number) =>
    serie.length <= 1 ? 0 : (i / (serie.length - 1)) * LARGURA_DA_SPARKLINE;

  /*
   * Série constante desenha no meio da caixa.
   *
   * Dividir pela amplitude zero daria infinito; escolher o topo ou o rodapé
   * daria a impressão de máximo ou de mínimo. O meio é a única posição que não
   * afirma nada — e é o que uma série sem variação tem a dizer.
   */
  const util = ALTURA_DA_SPARKLINE - FOLGA_DA_SPARKLINE * 2;
  const y = (valor: number) =>
    amplitude === 0
      ? ALTURA_DA_SPARKLINE / 2
      : ALTURA_DA_SPARKLINE -
        FOLGA_DA_SPARKLINE -
        ((valor - menor) / amplitude) * util;

  const caminhos: string[] = [];
  let trecho: string[] = [];

  const fechar = () => {
    // Um ponto sozinho não é trecho: não há segmento para desenhar.
    if (trecho.length > 1) caminhos.push(trecho.join(" "));
    trecho = [];
  };

  serie.forEach((valor, i) => {
    if (valor === null) {
      fechar();
      return;
    }
    const comando = trecho.length === 0 ? "M" : "L";
    trecho.push(`${comando}${arredondar(x(i))} ${arredondar(y(valor))}`);
  });
  fechar();

  return caminhos;
}

/**
 * Duas casas no caminho SVG.
 *
 * Não é formatação de número para leitura — é precisão de coordenada. O
 * módulo de formatação (`formatarValor`) continua sendo o único lugar onde
 * número vira texto que alguém lê, e nada daqui passa por ele.
 */
function arredondar(n: number): number {
  const CASAS = 100;
  return Math.round(n * CASAS) / CASAS;
}
