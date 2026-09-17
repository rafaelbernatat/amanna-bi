/**
 * O logo: baixar, conferir e guardar.
 *
 * ## O tipo sai dos bytes, nunca do cabeçalho
 *
 * Um `content-type: image/png` num arquivo que começa com `<script` é
 * precisamente o ataque. O cabeçalho `nosniff` que o produto já manda só ajuda
 * se **nós** declararmos o tipo certo — e só sabemos o tipo certo porque
 * olhamos os primeiros bytes.
 *
 * ## Imagem vetorial é recusada, não limpa
 *
 * Um `<img src>` não executa script de SVG nem busca recurso externo dele —
 * isso é garantia de especificação. Ainda assim, SVG com script, manipulador
 * de evento ou referência externa é **recusado**, e a mensagem diz qual
 * construção apareceu. É a doutrina que o verificador do chat estabeleceu:
 * descartar e dizer, nunca corrigir em silêncio. Sanear e aceitar deixaria o
 * produto carregando um arquivo que alguém montou para ser perigoso.
 */

import { createHash } from "node:crypto";

import type { FonteDeSite } from "@/marca/site/fonte";
import type { LogoDaMarca, TipoDeLogo } from "@/marca/documento";

/** O teto de bytes de um logo. Um logo de cabeçalho tem 32 a 48 px de altura. */
export const TETO_DO_LOGO = 256 * 1024;

/** Acima disto, a decodificação no navegador vira bomba de descompressão. */
export const LADO_MAXIMO = 4096;

/** Por que um logo foi recusado. */
export const MOTIVOS_DE_RECUSA_DE_LOGO = [
  "nao_baixou",
  "grande_demais",
  "tipo_nao_reconhecido",
  "dimensao_demais",
  "vetor_perigoso",
] as const;
export type MotivoDeRecusaDeLogo = (typeof MOTIVOS_DE_RECUSA_DE_LOGO)[number];

export type LogoRecusado = {
  readonly ok: false;
  readonly motivo: MotivoDeRecusaDeLogo;
  /** A construção encontrada, quando o motivo é vetor perigoso. */
  readonly detalhe: string | null;
};

export type LogoAceito = { readonly ok: true; readonly logo: LogoDaMarca };

/* ------------------------------------------------------------------ *
 * Bytes mágicos
 * ------------------------------------------------------------------ */

const ASSINATURA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const ASSINATURA_JPEG = [0xff, 0xd8, 0xff];

function comecaCom(bytes: Uint8Array, assinatura: readonly number[]): boolean {
  return assinatura.every((byte, i) => bytes[i] === byte);
}

function texto(bytes: Uint8Array, inicio: number, fim: number): string {
  return Buffer.from(bytes.slice(inicio, fim)).toString("latin1");
}

/** O tipo real do arquivo, pelos primeiros bytes. `null` quando não é imagem. */
export function tipoPelosBytes(bytes: Uint8Array): TipoDeLogo | null {
  if (comecaCom(bytes, ASSINATURA_PNG)) return "image/png";
  if (comecaCom(bytes, ASSINATURA_JPEG)) return "image/jpeg";
  if (texto(bytes, 0, 4) === "RIFF" && texto(bytes, 8, 12) === "WEBP") {
    return "image/webp";
  }

  // SVG: pode vir depois de marca de ordem, espaço, declaração XML, tipo de
  // documento ou comentário. Olhar só o começo cru perderia metade dos casos.
  const inicio = texto(bytes, 0, 512)
    .replace(/^\uFEFF/, "")
    .replace(/<\?xml[\s\S]*?\?>/i, "")
    .replace(/<!DOCTYPE[\s\S]*?>/i, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trimStart();
  if (inicio.toLowerCase().startsWith("<svg")) return "image/svg+xml";

  return null;
}

/* ------------------------------------------------------------------ *
 * Dimensão
 * ------------------------------------------------------------------ */

const DESLOCAMENTO_IHDR = 16;
const BYTES_DE_DIMENSAO = 4;

function inteiroGrande(bytes: Uint8Array, inicio: number): number {
  let valor = 0;
  for (let i = 0; i < BYTES_DE_DIMENSAO; i += 1) {
    valor = valor * 256 + (bytes[inicio + i] ?? 0);
  }
  return valor;
}

/** O lado maior da imagem, quando dá para saber sem decodificar. */
export function ladoMaior(bytes: Uint8Array, tipo: TipoDeLogo): number | null {
  if (tipo === "image/png") {
    return Math.max(
      inteiroGrande(bytes, DESLOCAMENTO_IHDR),
      inteiroGrande(bytes, DESLOCAMENTO_IHDR + BYTES_DE_DIMENSAO),
    );
  }
  // JPEG, WebP e vetor: o teto de bytes já limita, e ler o quadro de cada um
  // custaria mais código do que protege.
  return null;
}

/* ------------------------------------------------------------------ *
 * Vetor
 * ------------------------------------------------------------------ */

/** As construções que fazem um vetor deixar de ser desenho. */
const CONSTRUCOES_PERIGOSAS: readonly (readonly [string, RegExp])[] = [
  ["script", /<script\b/i],
  ["manipulador de evento", /\bon[a-z]+\s*=/i],
  ["objeto estrangeiro", /<foreignObject\b/i],
  ["endereço javascript:", /javascript:/i],
  // A referência externa é conferida à parte, em `referenciaExterna`: o
  // atributo precisa ser **lido**, e não reconhecido pelo que vem depois.
  // Com a aspa opcional no fim do padrão, `href="#simbolo"` passava por
  // trás do quantificador — a aspa ficava por consumir e a espiada via o
  // caractere errado. Foi um teste de referência interna que pegou.
  ["importação de estilo", /@import\b/i],
  ["quadro embutido", /<(iframe|embed|object)\b/i],
];

/**
 * Uma referência que sai do próprio arquivo.
 *
 * Interna (`#simbolo`) e embutida (`data:`) continuam valendo: são desenho.
 * O que se recusa é o vetor que busca alguma coisa em outro servidor quando
 * alguém o abre.
 */
function referenciaExterna(svg: string): boolean {
  const REFERENCIA =
    /<(?:use|image)\b[^>]*?\b(?:xlink:)?href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  for (const casado of svg.matchAll(REFERENCIA)) {
    const valor = (casado[1] ?? casado[2] ?? casado[3] ?? "").trim();
    if (valor === "") continue;
    if (valor.startsWith("#")) continue;
    if (valor.toLowerCase().startsWith("data:")) continue;
    return true;
  }
  return false;
}

/** A construção perigosa encontrada, ou `null` quando o vetor é só desenho. */
export function construcaoPerigosa(svg: string): string | null {
  for (const [nome, padrao] of CONSTRUCOES_PERIGOSAS) {
    if (padrao.test(svg)) return nome;
  }
  return referenciaExterna(svg) ? "referência externa" : null;
}

/* ------------------------------------------------------------------ *
 * A conferência inteira
 * ------------------------------------------------------------------ */

/** Confere bytes já baixados e monta o logo, ou recusa dizendo por quê. */
export function conferirLogo(
  bytes: Uint8Array,
  origem: string,
): LogoAceito | LogoRecusado {
  if (bytes.byteLength === 0) {
    return { ok: false, motivo: "nao_baixou", detalhe: null };
  }
  if (bytes.byteLength > TETO_DO_LOGO) {
    return { ok: false, motivo: "grande_demais", detalhe: null };
  }

  const tipo = tipoPelosBytes(bytes);
  if (tipo === null) {
    return { ok: false, motivo: "tipo_nao_reconhecido", detalhe: null };
  }

  if (tipo === "image/svg+xml") {
    const perigosa = construcaoPerigosa(Buffer.from(bytes).toString("utf8"));
    if (perigosa !== null) {
      return { ok: false, motivo: "vetor_perigoso", detalhe: perigosa };
    }
  }

  const lado = ladoMaior(bytes, tipo);
  if (lado !== null && lado > LADO_MAXIMO) {
    return { ok: false, motivo: "dimensao_demais", detalhe: null };
  }

  return {
    ok: true,
    logo: {
      tipo,
      conteudo: Buffer.from(bytes).toString("base64"),
      bytes: bytes.byteLength,
      origem,
      impressao: createHash("sha256").update(bytes).digest("hex"),
    },
  };
}

/** Baixa e confere. `null` de fonte vira recusa por "não baixou". */
export async function baixarLogo(
  url: string,
  fonte: FonteDeSite,
): Promise<LogoAceito | LogoRecusado> {
  const baixado = await fonte.buscarBinario(url, TETO_DO_LOGO);
  if (!baixado.ok) {
    return {
      ok: false,
      motivo:
        baixado.motivo === "corpo_grande_demais"
          ? "grande_demais"
          : "nao_baixou",
      detalhe: null,
    };
  }
  return conferirLogo(baixado.bytes, baixado.url);
}
