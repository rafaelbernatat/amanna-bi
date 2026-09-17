/**
 * Estágio 1: reunir o que o site declara. Determinístico, sem modelo.
 *
 * Espelha o estágio 1 do chat: aqui nasce a **lista de opções**, e nada mais.
 * O modelo entra depois e só escolhe entre elas; quem garante que a cor
 * aplicada existe no site é este arquivo, não ele.
 *
 * ## Por que expressão regular, e o que isso custa
 *
 * O projeto não tem analisador de HTML, e trazer um para extrair meia dúzia de
 * padrões conhecidos não se paga. O que se lê aqui é tudo plano: atributo de
 * `meta` e `link`, corpo de `style`, corpo de folha ligada, e dois JSON. Nada
 * exige árvore.
 *
 * O que se perde, dito com todas as letras: **"a imagem dentro do link dentro
 * do primeiro cabeçalho" não sai daqui**, porque isso é aninhamento e
 * expressão regular não faz aninhamento. Em sites que só têm o logotipo como
 * imagem solta no cabeçalho e não declaram ícone decente, vamos oferecer o
 * favicon e ficar feios. É um caso conhecido, não uma surpresa — e quando ele
 * for frequente demais, trocar por um analisador mexe só neste arquivo.
 *
 * O que torna isso seguro, e não apenas aceitável: o HTML buscado é **varrido,
 * nunca reemitido**. Um erro de leitura produz um candidato ruim, e candidato
 * ruim morre no estágio 3. A razão clássica para exigir analisador de verdade
 * — sanitizar para reexibir — não existe aqui.
 */

import { normalizarCor } from "@/apresentacao/tema/contraste";
import type { FonteDeSite } from "@/marca/site/fonte";
import { conferirEndereco, type MotivoDeRecusa } from "@/marca/site/guarda";

/* ------------------------------------------------------------------ *
 * Os tetos
 * ------------------------------------------------------------------ */

/** O quanto se lê de uma página. */
export const TETO_DA_PAGINA = 1024 * 1024;
/** O quanto se lê de uma folha de estilo. */
export const TETO_DA_FOLHA = 512 * 1024;
/** Quantas folhas ligadas se segue. `@import` não é seguido: profundidade zero. */
export const FOLHAS_MAXIMAS = 4;
/** O tamanho da evidência que acompanha um candidato. */
export const TETO_DA_EVIDENCIA = 120;

/* ------------------------------------------------------------------ *
 * Os tipos
 * ------------------------------------------------------------------ */

/** De onde uma cor veio, em ordem de qualidade de sinal. */
export const ORIGENS_DE_COR = [
  "theme-color",
  "manifesto",
  "variavel-css",
  "tile-color",
  "seletor-de-marca",
  "frequencia-em-css",
] as const;
export type OrigemDeCor = (typeof ORIGENS_DE_COR)[number];

export type CandidatoDeCor = {
  /** Sempre `#rrggbb` em caixa baixa: é a chave que o verificador compara. */
  readonly cor: string;
  readonly origem: OrigemDeCor;
  /** Trecho curto de onde ela apareceu, para auditoria e para o modelo. */
  readonly evidencia: string;
  readonly ocorrencias: number;
};

/** De onde um logo veio, em ordem de qualidade. */
export const ORIGENS_DE_LOGO = [
  "manifesto",
  "apple-touch-icon",
  "icon",
  "mask-icon",
  "og-image",
  "favicon",
] as const;
export type OrigemDeLogo = (typeof ORIGENS_DE_LOGO)[number];

export type CandidatoDeLogo = {
  readonly url: string;
  readonly origem: OrigemDeLogo;
  readonly tipoDeclarado: string | null;
  readonly tamanhoDeclarado: string | null;
};

export type Candidatos = {
  /** Discriminante: a extração distingue reunião feita de recusa pela guarda. */
  readonly ok: true;
  readonly site: string;
  readonly cores: readonly CandidatoDeCor[];
  readonly logos: readonly CandidatoDeLogo[];
  /** O que não deu certo pelo caminho, sem impedir o resto. */
  readonly avisos: readonly string[];
};

export type FalhaNaExtracao = {
  readonly ok: false;
  readonly motivo: MotivoDeRecusa;
};

/* ------------------------------------------------------------------ *
 * Limpeza
 * ------------------------------------------------------------------ */

/**
 * Tira do documento o que não é conteúdo declarado.
 *
 * Sem isto, uma cor dentro de comentário ou de script vira candidato — e o
 * site de teste tem as duas, de propósito, para o caso existir.
 */
export function semRuido(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<template\b[\s\S]*?<\/template\s*>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript\s*>/gi, " ");
}

function recortar(texto: string): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  return limpo.length > TETO_DA_EVIDENCIA
    ? `${limpo.slice(0, TETO_DA_EVIDENCIA)}…`
    : limpo;
}

/** O valor de um atributo dentro de uma tag já isolada. */
function atributo(tag: string, nome: string): string | null {
  const casado = new RegExp(
    `\\b${nome}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`,
    "i",
  ).exec(tag);
  if (casado === null) return null;
  return (casado[2] ?? casado[3] ?? casado[4] ?? "").trim();
}

/** Todas as tags de um nome, sem aninhamento — `meta` e `link` são vazias. */
function tagsDe(html: string, nome: string): readonly string[] {
  return [...html.matchAll(new RegExp(`<${nome}\\b[^>]*>`, "gi"))].map(
    (m) => m[0],
  );
}

/* ------------------------------------------------------------------ *
 * Cores
 * ------------------------------------------------------------------ */

/** Nomes de variável CSS que declaram marca. */
const NOMES_DE_MARCA =
  /^--(bs-)?(brand|primary|primaria|cor-primaria|marca|accent|acento|destaque|theme|color-primary|main-color)/i;

/** Seletores cuja cor é sinal forte de identidade. */
const SELETORES_DE_MARCA =
  /(^|[},])\s*(body|header|nav|\.header|\.navbar|\.btn|\.button|\.botao|a)\b[^{]*\{([^}]*)\}/gi;

const COR_EM_CSS = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g;

/** Cinzas e quase-extremos não são marca: entram em todo site. */
function corDeMarcaPlausivel(cor: string): boolean {
  const canal = (i: number) =>
    Number.parseInt(cor.slice(1 + i * 2, 3 + i * 2), 16);
  const r = canal(0);
  const g = canal(1);
  const b = canal(2);
  const maior = Math.max(r, g, b);
  const menor = Math.min(r, g, b);
  const QUASE_BRANCO = 246;
  const QUASE_PRETO = 12;
  const AMPLITUDE_MINIMA = 12;
  if (menor >= QUASE_BRANCO) return false;
  if (maior <= QUASE_PRETO) return false;
  // Cinza puro: os três canais quase iguais.
  return maior - menor >= AMPLITUDE_MINIMA;
}

type Acumulador = Map<
  string,
  { origem: OrigemDeCor; evidencia: string; n: number }
>;

function guardarCor(
  acumulado: Acumulador,
  bruta: string | null,
  origem: OrigemDeCor,
  evidencia: string,
): void {
  if (bruta === null) return;
  const cor = normalizarCor(bruta);
  if (cor === null) return;

  const existente = acumulado.get(cor);
  if (existente === undefined) {
    acumulado.set(cor, { origem, evidencia: recortar(evidencia), n: 1 });
    return;
  }
  // A melhor origem vence; a contagem soma de qualquer jeito.
  const melhor =
    ORIGENS_DE_COR.indexOf(origem) < ORIGENS_DE_COR.indexOf(existente.origem)
      ? { origem, evidencia: recortar(evidencia) }
      : { origem: existente.origem, evidencia: existente.evidencia };
  acumulado.set(cor, { ...melhor, n: existente.n + 1 });
}

/** As cores de uma folha de estilo, por variável, por seletor e por frequência. */
export function coresDeCss(css: string, acumulado: Acumulador): void {
  for (const casado of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;}]+)[;}]/gi)) {
    const nome = casado[1] ?? "";
    if (!NOMES_DE_MARCA.test(nome)) continue;
    guardarCor(acumulado, casado[2] ?? null, "variavel-css", casado[0]);
  }

  for (const casado of css.matchAll(SELETORES_DE_MARCA)) {
    const corpo = casado[3] ?? "";
    for (const cor of corpo.match(COR_EM_CSS) ?? []) {
      guardarCor(acumulado, cor, "seletor-de-marca", casado[0]);
    }
  }

  for (const cor of css.match(COR_EM_CSS) ?? []) {
    guardarCor(acumulado, cor, "frequencia-em-css", cor);
  }
}

/* ------------------------------------------------------------------ *
 * A reunião
 * ------------------------------------------------------------------ */

function absoluta(referencia: string, bruta: string | null): string | null {
  if (bruta === null || bruta.trim() === "") return null;
  try {
    return new URL(bruta, referencia).toString();
  } catch {
    return null;
  }
}

/**
 * Reúne os candidatos de um site.
 *
 * Nunca lança por causa do site: página que não responde vira falha com
 * motivo, e recurso secundário que falha vira aviso. Uma folha de estilo fora
 * do ar não pode impedir a extração de continuar com o que a página já disse.
 */
export async function reunirCandidatos(
  siteBruto: string,
  fonte: FonteDeSite,
): Promise<Candidatos | FalhaNaExtracao> {
  const conferido = conferirEndereco(siteBruto);
  if (!conferido.ok) return { ok: false, motivo: conferido.motivo };

  const pagina = await fonte.buscarTexto(
    conferido.url,
    ["text/html", "application/xhtml+xml"],
    TETO_DA_PAGINA,
  );
  if (!pagina.ok) return { ok: false, motivo: pagina.motivo };

  const html = semRuido(pagina.corpo);
  const avisos: string[] = [];
  const cores: Acumulador = new Map();
  const logos: CandidatoDeLogo[] = [];

  // A base contra a qual os endereços relativos resolvem.
  const tagBase = tagsDe(html, "base")[0];
  const base =
    (tagBase === undefined
      ? null
      : absoluta(pagina.url, atributo(tagBase, "href"))) ?? pagina.url;

  /* --- o que a página declara --- */

  for (const tag of tagsDe(html, "meta")) {
    const nome = (atributo(tag, "name") ?? "").toLowerCase();
    const propriedade = (atributo(tag, "property") ?? "").toLowerCase();
    const conteudo = atributo(tag, "content");

    if (nome === "theme-color") guardarCor(cores, conteudo, "theme-color", tag);
    if (nome === "msapplication-tilecolor") {
      guardarCor(cores, conteudo, "tile-color", tag);
    }
    if (propriedade === "og:image") {
      const url = absoluta(base, conteudo);
      if (url !== null) {
        logos.push({
          url,
          origem: "og-image",
          tipoDeclarado: null,
          tamanhoDeclarado: null,
        });
      }
    }
  }

  let manifesto: string | null = null;
  for (const tag of tagsDe(html, "link")) {
    const rel = (atributo(tag, "rel") ?? "").toLowerCase();
    const href = absoluta(base, atributo(tag, "href"));
    if (href === null) continue;

    if (rel.includes("manifest")) {
      manifesto = href;
      continue;
    }
    if (rel === "apple-touch-icon" || rel === "apple-touch-icon-precomposed") {
      logos.push({
        url: href,
        origem: "apple-touch-icon",
        tipoDeclarado: atributo(tag, "type"),
        tamanhoDeclarado: atributo(tag, "sizes"),
      });
      continue;
    }
    if (rel === "mask-icon") {
      logos.push({
        url: href,
        origem: "mask-icon",
        tipoDeclarado: atributo(tag, "type"),
        tamanhoDeclarado: null,
      });
      guardarCor(cores, atributo(tag, "color"), "theme-color", tag);
      continue;
    }
    if (rel.split(/\s+/).includes("icon")) {
      logos.push({
        url: href,
        origem: "icon",
        tipoDeclarado: atributo(tag, "type"),
        tamanhoDeclarado: atributo(tag, "sizes"),
      });
    }
  }

  /* --- o estilo embutido --- */

  for (const bloco of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) {
    coresDeCss(bloco[1] ?? "", cores);
  }

  /* --- o manifesto --- */

  if (manifesto !== null) {
    const lido = await fonte.buscarTexto(
      manifesto,
      ["application/manifest+json", "application/json", "text/plain"],
      TETO_DA_FOLHA,
    );
    if (lido.ok) {
      try {
        const dados = JSON.parse(lido.corpo) as Record<string, unknown>;
        for (const campo of ["theme_color", "background_color"]) {
          const valor = dados[campo];
          if (typeof valor === "string") {
            guardarCor(cores, valor, "manifesto", `manifesto ${campo}`);
          }
        }
        const icones = dados["icons"];
        if (Array.isArray(icones)) {
          for (const icone of icones) {
            if (typeof icone !== "object" || icone === null) continue;
            const registro = icone as Record<string, unknown>;
            const url = absoluta(
              manifesto,
              typeof registro["src"] === "string" ? registro["src"] : null,
            );
            if (url === null) continue;
            logos.push({
              url,
              origem: "manifesto",
              tipoDeclarado:
                typeof registro["type"] === "string" ? registro["type"] : null,
              tamanhoDeclarado:
                typeof registro["sizes"] === "string"
                  ? registro["sizes"]
                  : null,
            });
          }
        }
      } catch {
        avisos.push("O manifesto do site não é um JSON válido.");
      }
    } else {
      avisos.push("Não foi possível ler o manifesto do site.");
    }
  }

  /* --- as folhas ligadas --- */

  const folhas = tagsDe(html, "link")
    .filter((tag) =>
      (atributo(tag, "rel") ?? "").toLowerCase().includes("stylesheet"),
    )
    .map((tag) => absoluta(base, atributo(tag, "href")))
    .filter((url): url is string => url !== null)
    .slice(0, FOLHAS_MAXIMAS);

  for (const folha of folhas) {
    const lida = await fonte.buscarTexto(folha, ["text/css"], TETO_DA_FOLHA);
    if (lida.ok) {
      coresDeCss(lida.corpo, cores);
    } else {
      avisos.push("Uma folha de estilo do site não pôde ser lida.");
    }
  }

  /* --- o favicon, por último e só se não houver nada --- */

  if (logos.length === 0) {
    const favicon = absoluta(base, "/favicon.ico");
    if (favicon !== null) {
      logos.push({
        url: favicon,
        origem: "favicon",
        tipoDeclarado: null,
        tamanhoDeclarado: null,
      });
    }
  }

  const lista = [...cores.entries()]
    .filter(([cor]) => corDeMarcaPlausivel(cor))
    .map(([cor, dados]) => ({
      cor,
      origem: dados.origem,
      evidencia: dados.evidencia,
      ocorrencias: dados.n,
    }))
    .sort(ordenarCandidatos);

  if (lista.length === 0) {
    avisos.push("O site não declara nenhuma cor de marca reconhecível.");
  }

  return { ok: true, site: conferido.url, cores: lista, logos, avisos };
}

/**
 * A ordem canônica dos candidatos: melhor origem, mais ocorrências, e o
 * hexadecimal como último desempate.
 *
 * Precisa ser **total e estável**: é ela que faz o caminho sem modelo dar o
 * mesmo resultado duas vezes, e é ela que numera os índices que o modelo
 * escolhe.
 */
export function ordenarCandidatos(
  a: CandidatoDeCor,
  b: CandidatoDeCor,
): number {
  const porOrigem =
    ORIGENS_DE_COR.indexOf(a.origem) - ORIGENS_DE_COR.indexOf(b.origem);
  if (porOrigem !== 0) return porOrigem;
  if (a.ocorrencias !== b.ocorrencias) return b.ocorrencias - a.ocorrencias;
  return a.cor.localeCompare(b.cor);
}
