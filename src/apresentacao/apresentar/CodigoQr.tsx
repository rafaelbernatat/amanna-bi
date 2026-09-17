import { caminhoDoQr, MARGEM_EM_MODULOS } from "@/apresentacao/apresentar/qr";
import { PALETA } from "@/apresentacao/tema/tema";

/**
 * O QR na tela do apresentador (D-CONVITE-apresentacao).
 *
 * SVG desenhado em JSX, a partir do caminho que `qr.ts` calcula. Nada de
 * marcação injetada: o componente escreve `<svg>` e `<path>`, e a política de
 * segurança do produto continua a mesma.
 *
 * ## Preto no branco, e não a cor da empresa
 *
 * A leitura do QR depende de contraste, e a cor da marca não é escolhida por
 * isso. Um QR azul-claro sobre branco é um QR que metade da sala não consegue
 * escanear de longe — e a apresentação inteira depende de ele funcionar na
 * primeira tentativa. É o mesmo princípio dos papéis que ficam fora do alcance
 * da marca (D-MARCA): o que sustenta legibilidade medida não se personaliza.
 */

/** O lado do desenho: o que cabe numa tela de projeção sem ocupar tudo. */
const LADO = "min(62vh, 86vw)";

export function CodigoQr({
  texto,
  rotulo,
}: {
  readonly texto: string;
  readonly rotulo: string;
}) {
  const { caminho, lado } = caminhoDoQr(texto);

  return (
    <svg
      data-teste="qr"
      role="img"
      aria-label={rotulo}
      viewBox={`0 0 ${String(lado)} ${String(lado)}`}
      width={LADO}
      height={LADO}
      shapeRendering="crispEdges"
      style={{
        display: "block",
        background: PALETA.superficie,
        borderRadius: 12,
      }}
    >
      {/*
        O fundo cobre a margem exigida pela especificação: sem a faixa clara em
        volta, o leitor não encontra o código contra um fundo escuro.
      */}
      <rect
        x="0"
        y="0"
        width={lado}
        height={lado}
        fill={PALETA.superficie}
        rx={MARGEM_EM_MODULOS / 2}
      />
      <path d={caminho} fill={PALETA.texto} />
    </svg>
  );
}
