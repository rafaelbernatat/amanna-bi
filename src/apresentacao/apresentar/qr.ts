import QRCode from "qrcode";

/**
 * O QR code como caminho de SVG, gerado no servidor
 * (D-CONVITE-apresentacao).
 *
 * ## Por que gerar aqui, e não pedir a um serviço
 *
 * O token do convite é o que abre o painel. Mandá-lo a um gerador de QR de
 * terceiro seria entregar o acesso a quem hospeda a imagem — e a seção 11 diz
 * o que sai deste ambiente. A biblioteca calcula os módulos localmente; o
 * desenho é nosso.
 *
 * ## Por que um caminho, e não uma imagem
 *
 * `toString(..., { type: "svg" })` devolve marcação, e pô-la na página exigiria
 * injetar HTML bruto. O que sai daqui é só o atributo `d` de um `<path>`: uma
 * cadeia de `M x y h w v h …`. O componente desenha o `<svg>` e o `<path>` em
 * JSX, a política de segurança não muda, e não há marcação de terceiro na
 * página.
 *
 * O resultado é determinístico: o mesmo texto dá o mesmo caminho, byte a byte,
 * e é isso que um teste consegue fixar.
 */

/** A correção de erro. `M` recupera ~15%: a tela pode ter reflexo. */
const CORRECAO = "M" as const;

/** Módulos de margem em volta, como a especificação do QR pede. */
export const MARGEM_EM_MODULOS = 2;

export type Qr = {
  /** O atributo `d` de um `<path>`, em unidades de módulo. */
  readonly caminho: string;
  /** O lado do desenho, em módulos, já com a margem. */
  readonly lado: number;
};

/**
 * O QR de um texto. Lança quando o texto não cabe num QR — o que só aconteceria
 * com um token absurdo, e é melhor a tela dizer isso que mostrar um quadrado
 * que ninguém consegue escanear.
 */
export function caminhoDoQr(texto: string): Qr {
  const qr = QRCode.create(texto, { errorCorrectionLevel: CORRECAO });
  const tamanho = qr.modules.size;
  const dados = qr.modules.data;

  const partes: string[] = [];
  for (let linha = 0; linha < tamanho; linha += 1) {
    let coluna = 0;
    while (coluna < tamanho) {
      if (dados[linha * tamanho + coluna] !== 1) {
        coluna += 1;
        continue;
      }
      // Junta os módulos escuros seguidos numa barra só: um retângulo por
      // sequência, em vez de um por módulo, deixa o caminho algumas vezes
      // menor sem mudar o desenho.
      let largura = 1;
      while (
        coluna + largura < tamanho &&
        dados[linha * tamanho + coluna + largura] === 1
      ) {
        largura += 1;
      }
      partes.push(
        `M${String(coluna + MARGEM_EM_MODULOS)} ${String(linha + MARGEM_EM_MODULOS)}h${String(largura)}v1h-${String(largura)}z`,
      );
      coluna += largura;
    }
  }

  return { caminho: partes.join(""), lado: tamanho + 2 * MARGEM_EM_MODULOS };
}
