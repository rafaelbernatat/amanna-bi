import { lerMarcaAtiva, lerPropostaPendente } from "@/marca/leitura";

/**
 * `GET /api/marca/logo` — o logo da empresa, servido pela própria origem.
 *
 * ## Por que uma rota, e não um endereço embutido no documento
 *
 * A política de segurança aceita imagem de `'self'` e de `data:`. Embutir
 * resolveria a política e criaria outro problema: com tudo renderizado por
 * requisição, o logo pesaria em **cada** resposta de **cada** tela, contra os
 * limites de tempo da seção 13. Uma rota é buscada uma vez e fica no cache do
 * navegador.
 *
 * ## Os cabeçalhos, e o que cada um impede
 *
 * - `content-type` sai do tipo que os **bytes** declararam na ingestão, nunca
 *   do que o site de origem dizia. Com `nosniff`, que o produto já manda em
 *   toda resposta, é o que impede um arquivo de ser interpretado como outra
 *   coisa.
 * - `Content-Security-Policy: default-src 'none'; sandbox` é a política **do
 *   próprio arquivo**. Vale para o caso em que alguém abre o endereço direto,
 *   em vez de vê-lo dentro de um `<img>`: um vetor que tenha passado por todas
 *   as conferências ainda não pode buscar nada nem executar nada.
 * - `ETag` é a impressão do conteúdo, e o endereço já carrega uma versão dela.
 *   Marca nova, endereço novo — por isso o cache pode ser longo sem nunca
 *   servir o logo velho.
 */

export const dynamic = "force-dynamic";

/** Um ano. O endereço muda quando o conteúdo muda, então isto é seguro. */
const CACHE = "private, max-age=31536000, immutable";

export async function GET(pedido: Request): Promise<Response> {
  /*
   * Duas origens, e a tela diz qual quer.
   *
   * A prévia precisa mostrar o logo **antes** de ele ser aplicado — senão a
   * pessoa decide sobre uma imagem que não viu. O padrão continua sendo a
   * marca em uso: é o que o cabeçalho pede em toda tela.
   */
  const daProposta = new URL(pedido.url).searchParams.get("de") === "proposta";

  const logo = daProposta
    ? ((await lerPropostaPendente())?.logo ?? null)
    : ((await lerMarcaAtiva())?.logo ?? null);

  if (logo === null) return new Response(null, { status: 404 });

  const etiqueta = `"${logo.impressao}"`;
  if (pedido.headers.get("if-none-match") === etiqueta) {
    return new Response(null, { status: 304, headers: { etag: etiqueta } });
  }

  const bytes = Uint8Array.from(Buffer.from(logo.conteudo, "base64"));

  return new Response(bytes, {
    status: 200,
    headers: {
      "content-type": logo.tipo,
      "content-length": String(bytes.byteLength),
      "content-disposition": "inline",
      "content-security-policy": "default-src 'none'; sandbox",
      "x-content-type-options": "nosniff",
      etag: etiqueta,
      "cache-control": CACHE,
    },
  });
}
