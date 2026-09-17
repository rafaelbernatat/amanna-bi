/* eslint-disable no-restricted-syntax --
 * As cores aqui não são do produto: são o conteúdo de sites de mentira que o
 * arnês serve para exercitar a extração. A regra de T-124 existe para impedir
 * que a paleta se espalhe pelo código; um site de exemplo é dado de teste, e
 * escrevê-lo sem hexadecimal seria escrever um site que não existe.
 */

/**
 * Os sites de mentira que o arnês serve (D-MARCA).
 *
 * Três páginas, escolhidas para cobrir os três casos que aparecem de verdade:
 *
 * | Site | O que exercita |
 * |---|---|
 * | `dreamy.com.br` | O caso bom: cor declarada, manifesto, ícone grande |
 * | `industria-fosca.com.br` | O caso pobre: nada declarado, só cor em folha |
 * | `sem-marca.com.br` | O caso vazio: nenhum candidato, e não pode quebrar |
 *
 * O terceiro é o que mais importa. Um extrator que nunca viu uma página sem
 * marca é um extrator que vai lançar na primeira.
 */

export type PaginaDeExemplo = {
  readonly tipo: string;
  readonly corpo: string;
};

const DREAMY = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Dreamy — Indústria e Comércio</title>
  <meta name="theme-color" content="#0b5cff">
  <meta name="msapplication-TileColor" content="#0b5cff">
  <link rel="manifest" href="/site.webmanifest">
  <link rel="icon" type="image/svg+xml" href="/marca/simbolo.svg">
  <link rel="apple-touch-icon" sizes="180x180" href="/marca/dreamy-180.png">
  <meta property="og:image" content="https://dreamy.com.br/social/capa.png">
  <link rel="stylesheet" href="/estilo/principal.css">
  <style>
    :root { --brand-primary: #0b5cff; --brand-ink: #06246b; --accent: #ff9f1c; }
    header { background: #06246b; }
  </style>
</head>
<body>
  <header><a href="/"><img src="/marca/dreamy.png" alt="Dreamy"></a></header>
  <!-- cor em comentário, que não pode virar candidato: #ff0000 -->
  <script>var corDeScript = "#00ff00";</script>
</body>
</html>`;

const DREAMY_MANIFESTO = `{
  "name": "Dreamy",
  "short_name": "Dreamy",
  "theme_color": "#0b5cff",
  "background_color": "#06246b",
  "icons": [
    { "src": "/marca/dreamy-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/marca/dreamy-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}`;

const DREAMY_CSS = `.botao { background: #0b5cff; color: #ffffff; }
.botao:hover { background: #06246b; }
.destaque { color: #ff9f1c; }
.rodape { background: #06246b; }
.aviso { color: #0b5cff; }`;

const FOSCA = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Indústria Fosca</title>
  <link rel="stylesheet" href="/css/site.css">
</head>
<body><h1>Indústria Fosca</h1></body>
</html>`;

const FOSCA_CSS = `body { background: #ffffff; color: #222222; }
.cabecalho { background: #7a1f2b; }
.botao { background: #7a1f2b; }
.link { color: #7a1f2b; }
.cinza { color: #808080; }`;

const SEM_MARCA = `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>Sem marca</title></head>
<body><p>Uma página sem nada declarado.</p></body>
</html>`;

/** Um PNG de um pixel, em base64: o menor logo válido que existe. */
export const PNG_DE_UM_PIXEL =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/** As páginas, por URL exata. */
export const PAGINAS: Readonly<Record<string, PaginaDeExemplo>> = {
  "https://dreamy.com.br/": { tipo: "text/html", corpo: DREAMY },
  "https://dreamy.com.br/site.webmanifest": {
    tipo: "application/manifest+json",
    corpo: DREAMY_MANIFESTO,
  },
  "https://dreamy.com.br/estilo/principal.css": {
    tipo: "text/css",
    corpo: DREAMY_CSS,
  },
  "https://industria-fosca.com.br/": { tipo: "text/html", corpo: FOSCA },
  "https://industria-fosca.com.br/css/site.css": {
    tipo: "text/css",
    corpo: FOSCA_CSS,
  },
  "https://sem-marca.com.br/": { tipo: "text/html", corpo: SEM_MARCA },
};

/** Os recursos binários, por URL exata. */
export const BINARIOS: Readonly<
  Record<string, { tipo: string; base64: string }>
> = {
  "https://dreamy.com.br/marca/dreamy-180.png": {
    tipo: "image/png",
    base64: PNG_DE_UM_PIXEL,
  },
  "https://dreamy.com.br/marca/dreamy-192.png": {
    tipo: "image/png",
    base64: PNG_DE_UM_PIXEL,
  },
  "https://dreamy.com.br/marca/dreamy-512.png": {
    tipo: "image/png",
    base64: PNG_DE_UM_PIXEL,
  },
};
