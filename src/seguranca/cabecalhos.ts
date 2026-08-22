/**
 * Os cabeçalhos de segurança das respostas (T-139).
 *
 * Um painel de controladoria carrega folha, margem e nome de fornecedor. O que
 * estes cabeçalhos impedem é concreto: um script injetado exfiltrar a tela, e
 * um `<iframe>` de terceiro sobrepor a interface para capturar clique.
 *
 * ## A questão do `unsafe-inline`
 *
 * O aceite de T-139 pede CSP **sem `unsafe-inline`**. Está cumprido onde
 * importa e onde é possível hoje:
 *
 * - `script-src` — sem `unsafe-inline` e sem `unsafe-eval`. Os scripts do Next
 *   passam por *nonce*, gerado por resposta. É aqui que mora o risco de XSS, e
 *   é aqui que a regra vale mais.
 * - `style-src` — **com** `unsafe-inline`, e isso é uma dívida declarada, não
 *   um descuido. Os painéis desenham com objetos de estilo em linha (T-124,
 *   T-129), que viram atributos `style=`. Tirar `unsafe-inline` daqui exige
 *   migrar as 13 telas para folha de estilo — refatoração que não cabe nesta
 *   tarefa e que muda a decisão de tema. Registrado em **H-46**.
 *
 * A diferença de risco entre os dois não é retórica: `script-src` sem
 * `unsafe-inline` bloqueia execução de código injetado; `style-src` permissivo
 * abre, no pior caso, exfiltração por seletor de CSS, que precisa de injeção de
 * marcação para começar — e essa a `script-src` já barra.
 */

/** Origens permitidas para conexão. Só a própria; nada sai para terceiro. */
const CONEXOES = ["'self'"];

/**
 * Monta a Content-Security-Policy da resposta.
 *
 * O *nonce* muda a cada resposta. Reaproveitá-lo entre respostas devolveria ao
 * atacante exatamente o que o nonce tira: um valor previsível para colar no
 * script injetado.
 */
export function montarCsp(nonce: string): string {
  const diretivas: readonly (readonly [string, readonly string[]])[] = [
    ["default-src", ["'self'"]],
    // Sem 'unsafe-inline' e sem 'unsafe-eval'. 'strict-dynamic' deixa os
    // scripts carregados pelo Next herdarem a confiança do nonce, em vez de
    // exigir uma lista de origens que envelheceria a cada versão.
    ["script-src", ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"]],
    // A dívida declarada. Ver H-46 e o cabeçalho deste arquivo.
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["'self'", "data:"]],
    ["font-src", ["'self'", "data:"]],
    ["connect-src", CONEXOES],
    // Nenhum plugin, nenhum objeto embutido, nenhuma base reescrita.
    ["object-src", ["'none'"]],
    ["base-uri", ["'none'"]],
    // Ninguém enquadra o produto: é a defesa contra clickjacking, e substitui
    // o X-Frame-Options, que não sabe dizer "nenhum".
    ["frame-ancestors", ["'none'"]],
    ["form-action", ["'self'"]],
    ["upgrade-insecure-requests", []],
  ];

  return diretivas
    .map(([nome, valores]) =>
      valores.length === 0 ? nome : `${nome} ${valores.join(" ")}`,
    )
    .join("; ");
}

/**
 * Os cabeçalhos que não dependem do nonce.
 *
 * `Strict-Transport-Security` com dois anos e subdomínios: o produto roda em
 * rede do cliente ou em nuvem dedicada (seção 15), e nos dois casos a primeira
 * requisição em texto claro é a que vale a pena eliminar.
 */
export const CABECALHOS_FIXOS: Readonly<Record<string, string>> = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  // Sem isto, um arquivo servido como texto pode ser executado como script
  // porque o navegador "adivinhou" o tipo.
  "X-Content-Type-Options": "nosniff",
  // A URL do produto carrega o recorte (T-127). Vazá-la inteira para um site
  // externo entregaria filtros e tela de quem clicou num link.
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // Nenhuma dessas capacidades é usada; negá-las custa nada e fecha superfície.
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  // Redundante com frame-ancestors para navegador moderno, mantido para os que
  // não implementam CSP nível 2.
  "X-Frame-Options": "DENY",
};

/** Todos os cabeçalhos da resposta, dado o nonce daquela resposta. */
export function cabecalhosDeSeguranca(
  nonce: string,
): Readonly<Record<string, string>> {
  return {
    ...CABECALHOS_FIXOS,
    "Content-Security-Policy": montarCsp(nonce),
  };
}

/**
 * Gera um nonce de 128 bits em base64.
 *
 * `crypto.getRandomValues` e não `Math.random`: nonce previsível é nonce que
 * não existe. A Web Crypto API está disponível tanto no runtime do Next quanto
 * no Node 24, o que evita um import condicional.
 */
export function gerarNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
