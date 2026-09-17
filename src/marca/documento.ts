/**
 * O documento da marca: o que fica guardado, e a leitura defensiva dele.
 *
 * ## Por que um módulo próprio, fora de `src/acesso/`
 *
 * A carta de `src/acesso/` diz que aquela camada recebe uma `Query` e devolve
 * séries e agregados, e `autorizacao.ts` afirma que *"nenhum perfil escreve,
 * porque o produto não escreve no dado do cliente"*. As duas frases precisam
 * continuar literalmente verdadeiras. Marca não é dado do cliente: é
 * configuração da instalação, e é a **primeira coisa que o produto escreve**.
 * Um espaço separado é o que preserva as duas afirmações.
 *
 * ## Um documento só, com o logo dentro
 *
 * Cores e logo poderiam ser dois objetos, e não são de propósito: dois objetos
 * dão gravação rasgada — cor nova com logo velho — e um "voltar ao padrão" que
 * precisa acertar dois lugares. O logo vai em base64 dentro do documento, o
 * que custa um terço a mais de tamanho e, com o teto de 256 KiB, mantém o
 * documento abaixo de 400 KiB.
 *
 * ## Duas origens, um documento
 *
 * A marca pode vir do **site** da empresa (extraída em três estágios) ou ser
 * informada **à mão** (cores, logo enviado e nome). O documento é o mesmo nos
 * dois casos, e `origem` diz qual foi: é o que a tela usa para dizer "o que
 * encontramos em dreamy.com.br" ou "o que você informou", e o que a
 * auditoria lê para saber se alguém digitou uma cor ou o site a declarou.
 *
 * A versão 1 só conhecia o site. A leitura ainda a entende — `origem: "site"`,
 * `nome: null` — e a próxima gravação já escreve a versão 2. Ninguém precisa
 * migrar nada à mão.
 *
 * ## O que se guarda de quem aplicou, e o que não se guarda
 *
 * Só o `sujeito` da sessão — o identificador estável do provedor de
 * identidade. Nunca nome de pessoa, nunca e-mail: seria dado pessoal novo, num
 * armazenamento novo, sem retenção acordada (seção 11). O par
 * `aplicadaPor`/`aplicadaEm` é a trilha de auditoria desta feature, e é o
 * próprio artefato — não há registro à parte que possa divergir dele. O `nome`
 * do documento é o da **instalação** ("Dreamy S.A."), não o de quem aplicou.
 */

import {
  corCanonica,
  type AjusteDeContraste,
} from "@/apresentacao/tema/contraste";
import { CHAVES_DE_MARCA, type CoresDaMarca } from "@/apresentacao/tema/tema";
import { perfilValido, type Perfil } from "@/seguranca/identidade";

/** Sobe quando o formato do documento mudar. Campo novo é migração. */
export const VERSAO_DA_MARCA = 2;

/** As versões que a leitura ainda entende. A gravação só escreve a atual. */
export const VERSOES_LIDAS: readonly number[] = [1, VERSAO_DA_MARCA];

/** De onde a marca veio. */
export const ORIGENS = ["site", "manual"] as const;
export type OrigemDaMarca = (typeof ORIGENS)[number];

/** O nome da instalação cabe num cabeçalho de uma linha. */
export const TETO_DO_NOME = 60;

/** Os tipos de imagem que o logo pode ter. */
export const TIPOS_DE_LOGO = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
] as const;
export type TipoDeLogo = (typeof TIPOS_DE_LOGO)[number];

export type LogoDaMarca = {
  readonly tipo: TipoDeLogo;
  /** O conteúdo em base64. Servido pela rota, nunca embutido no documento. */
  readonly conteudo: string;
  readonly bytes: number;
  /** De onde veio, para auditoria. */
  readonly origem: string;
  /** SHA-256 do conteúdo: o que se serve é o que foi aprovado. */
  readonly impressao: string;
};

/**
 * Como a escolha das cores foi feita.
 *
 * `manual` é a pessoa digitando: não houve candidato nem modelo, e o único
 * estágio que roda é o de contraste.
 */
export const AUTORIAS = [
  "modelo",
  "deterministica",
  "modelo-recusado",
  "gateway-indisponivel",
  "manual",
] as const;
export type AutoriaDaExtracao = (typeof AUTORIAS)[number];

/** O que a marca guarda sobre como chegou até aqui. */
export type RegistroDaExtracao = {
  readonly autoria: AutoriaDaExtracao;
  /** O modelo que escolheu, quando houve um. */
  readonly modelo: string | null;
  /** Os ajustes de contraste aceitos, com antes e depois. */
  readonly ajustes: readonly AjusteDeContraste[];
};

/** A marca aplicada numa instalação. */
export type Marca = {
  readonly versao: typeof VERSAO_DA_MARCA;
  readonly origem: OrigemDaMarca;
  /** A origem informada, já normalizada. Só existe quando veio do site. */
  readonly site: string | null;
  /** O nome que o cabeçalho mostra no lugar de "Controladoria". */
  readonly nome: string | null;
  readonly cores: CoresDaMarca;
  readonly logo: LogoDaMarca | null;
  /** ISO 8601 com fuso. */
  readonly aplicadaEm: string;
  readonly aplicadaPor: {
    readonly sujeito: string;
    readonly perfil: Perfil;
  };
  readonly extracao: RegistroDaExtracao;
};

/* ------------------------------------------------------------------ *
 * O nome
 * ------------------------------------------------------------------ */

/** Caractere de controle ou de formatação: nada disso é nome. */
const CONTROLE = /[\p{Cc}\p{Cf}]/u;

/**
 * O nome como a pessoa o digitou, posto em forma: espaços colapsados, pontas
 * aparadas. Vazio vira `null`, que é "sem nome", e não "nome vazio".
 */
export function normalizarNome(bruto: string): string | null {
  const limpo = bruto.replace(/\s+/g, " ").trim();
  return limpo === "" ? null : limpo;
}

/** O nome cabe no cabeçalho e não carrega caractere invisível? */
export function nomeDentroDaForma(nome: string): boolean {
  return (
    nome.length <= TETO_DO_NOME &&
    !CONTROLE.test(nome) &&
    normalizarNome(nome) === nome
  );
}

/* ------------------------------------------------------------------ *
 * Leitura defensiva
 * ------------------------------------------------------------------ */

function ehObjeto(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function textoNaoVazio(x: unknown): x is string {
  return typeof x === "string" && x.trim() !== "";
}

function lerCores(bruto: unknown): CoresDaMarca | null {
  if (!ehObjeto(bruto)) return null;
  const cores: Record<string, string> = {};
  for (const chave of CHAVES_DE_MARCA) {
    const valor = bruto[chave];
    // A conferência de forma acontece de novo aqui, na saída do armazém, e não
    // só na entrada: o arquivo é editável à mão, e a cor vai para dentro de uma
    // folha de estilo.
    if (typeof valor !== "string" || !corCanonica(valor)) return null;
    cores[chave] = valor;
  }
  return cores as CoresDaMarca;
}

function lerLogo(bruto: unknown): LogoDaMarca | null {
  if (!ehObjeto(bruto)) return null;
  const { tipo, conteudo, bytes, origem, impressao } = bruto;
  if (!(TIPOS_DE_LOGO as readonly unknown[]).includes(tipo)) return null;
  if (!textoNaoVazio(conteudo)) return null;
  if (typeof bytes !== "number" || bytes <= 0) return null;
  if (!textoNaoVazio(origem)) return null;
  if (!textoNaoVazio(impressao)) return null;
  return {
    tipo: tipo as TipoDeLogo,
    conteudo,
    bytes,
    origem,
    impressao,
  };
}

function lerExtracao(bruto: unknown): RegistroDaExtracao | null {
  if (!ehObjeto(bruto)) return null;
  const { autoria, modelo, ajustes } = bruto;
  if (!(AUTORIAS as readonly unknown[]).includes(autoria)) return null;
  if (modelo !== null && typeof modelo !== "string") return null;
  if (!Array.isArray(ajustes)) return null;
  return {
    autoria: autoria as AutoriaDaExtracao,
    modelo: modelo ?? null,
    ajustes: ajustes as readonly AjusteDeContraste[],
  };
}

/**
 * O nome guardado. `undefined` quer dizer "fora da forma": o documento inteiro
 * é recusado, porque o nome vai para o cabeçalho de todas as telas.
 */
function lerNome(bruto: unknown): string | null | undefined {
  if (bruto === null || bruto === undefined) return null;
  if (typeof bruto !== "string") return undefined;
  if (bruto === "") return null;
  return nomeDentroDaForma(bruto) ? bruto : undefined;
}

/**
 * A origem e o site, que andam juntos.
 *
 * Na versão 1 não havia origem: tudo era do site. Na 2, `site` é obrigatório
 * quando a origem é o site, e precisa ser nulo quando é manual — um documento
 * manual com site é contradição, e contradição não se lê.
 */
function lerOrigem(
  bruto: Record<string, unknown>,
  versao: number,
): { readonly origem: OrigemDaMarca; readonly site: string | null } | null {
  const site = bruto["site"];
  if (versao === 1) {
    return textoNaoVazio(site) ? { origem: "site", site } : null;
  }
  const origem = bruto["origem"];
  if (!(ORIGENS as readonly unknown[]).includes(origem)) return null;
  if (origem === "site") {
    return textoNaoVazio(site) ? { origem, site } : null;
  }
  if (site !== null && site !== undefined) return null;
  return { origem: "manual", site: null };
}

/**
 * Lê um documento guardado. `null` para qualquer coisa que não seja um.
 *
 * Nunca lança, e a razão é operacional: o arquivo mora num diretório montado
 * que uma pessoa pode abrir e editar. Um JSON quebrado precisa devolver a tela
 * ao tema padrão, não derrubar as treze telas — mesmo espírito de `ler()` no
 * armazém e de `lerPainelParaTela` na camada de acesso.
 *
 * Lê a versão 1 e a 2, e devolve sempre a forma atual.
 */
export function lerMarca(bruto: unknown): Marca | null {
  if (!ehObjeto(bruto)) return null;
  const versao = bruto["versao"];
  if (typeof versao !== "number" || !VERSOES_LIDAS.includes(versao)) {
    return null;
  }

  const origem = lerOrigem(bruto, versao);
  if (origem === null) return null;

  const nome = versao === 1 ? null : lerNome(bruto["nome"]);
  if (nome === undefined) return null;

  const aplicadaEm = bruto["aplicadaEm"];
  const aplicadaPor = bruto["aplicadaPor"];
  if (!textoNaoVazio(aplicadaEm)) return null;
  if (!ehObjeto(aplicadaPor)) return null;

  const sujeito = aplicadaPor["sujeito"];
  const perfil = aplicadaPor["perfil"];
  if (!textoNaoVazio(sujeito)) return null;
  if (typeof perfil !== "string" || !perfilValido(perfil)) return null;

  const cores = lerCores(bruto["cores"]);
  if (cores === null) return null;

  const extracao = lerExtracao(bruto["extracao"]);
  if (extracao === null) return null;

  return {
    versao: VERSAO_DA_MARCA,
    origem: origem.origem,
    site: origem.site,
    nome,
    cores,
    logo: bruto["logo"] === null ? null : lerLogo(bruto["logo"]),
    aplicadaEm,
    aplicadaPor: { sujeito, perfil },
    extracao,
  };
}

/* ------------------------------------------------------------------ *
 * A proposta, e o estado inteiro
 * ------------------------------------------------------------------ */

/**
 * O que a extração — ou o formulário — produziu, e a tela mostra antes de
 * alguém aplicar.
 *
 * Guarda **as duas versões das cores**: a original (a que o site declara, ou a
 * que a pessoa digitou) e a que passou pelo ajuste de contraste. É o que
 * permite a tela mostrar o antes e o depois lado a lado — e é o que impede o
 * ajuste de ser silencioso.
 */
export type Proposta = {
  readonly origem: OrigemDaMarca;
  readonly site: string | null;
  readonly nome: string | null;
  /** As cores já ajustadas: é o que entra se alguém aplicar. */
  readonly cores: CoresDaMarca;
  /** As cores antes do ajuste: como o site as declara, ou como foram digitadas. */
  readonly coresOriginais: CoresDaMarca;
  readonly logo: LogoDaMarca | null;
  /**
   * Por que o logo não serviu, quando não serviu.
   *
   * No caminho manual, `logo` pode continuar preenchido ao lado disto: é o
   * logo **em uso**, mantido porque o arquivo enviado foi recusado.
   */
  readonly logoRecusado: string | null;
  readonly extracao: RegistroDaExtracao;
  /** Quantas cores o site declarava. Zero no caminho manual. */
  readonly candidatos: number;
  readonly avisos: readonly string[];
  readonly propostaEm: string;
};

/** Tudo que o armazém guarda: a marca em uso e a proposta pendente. */
export type EstadoDaMarca = {
  readonly versao: typeof VERSAO_DA_MARCA;
  readonly aplicada: Marca | null;
  readonly proposta: Proposta | null;
};

export const ESTADO_VAZIO: EstadoDaMarca = {
  versao: VERSAO_DA_MARCA,
  aplicada: null,
  proposta: null,
};

function lerProposta(bruto: unknown, versao: number): Proposta | null {
  if (!ehObjeto(bruto)) return null;
  const origem = lerOrigem(bruto, versao);
  if (origem === null) return null;

  const nome = versao === 1 ? null : lerNome(bruto["nome"]);
  if (nome === undefined) return null;

  const cores = lerCores(bruto["cores"]);
  // Na versão 1 o campo chamava `coresDoSite`; só o site as declarava.
  const coresOriginais = lerCores(
    versao === 1 ? bruto["coresDoSite"] : bruto["coresOriginais"],
  );
  const extracao = lerExtracao(bruto["extracao"]);
  const propostaEm = bruto["propostaEm"];
  if (cores === null || coresOriginais === null || extracao === null) {
    return null;
  }
  if (!textoNaoVazio(propostaEm)) return null;

  const logoRecusado = bruto["logoRecusado"];
  const candidatos = bruto["candidatos"];
  const avisos = bruto["avisos"];

  return {
    origem: origem.origem,
    site: origem.site,
    nome,
    cores,
    coresOriginais,
    logo: bruto["logo"] === null ? null : lerLogo(bruto["logo"]),
    logoRecusado: typeof logoRecusado === "string" ? logoRecusado : null,
    extracao,
    candidatos: typeof candidatos === "number" ? candidatos : 0,
    avisos: Array.isArray(avisos)
      ? avisos.filter((a): a is string => typeof a === "string")
      : [],
    propostaEm,
  };
}

/**
 * Lê o estado inteiro. Nunca lança.
 *
 * Documento quebrado devolve o estado vazio, e não uma exceção: o arquivo mora
 * num diretório montado que uma pessoa pode abrir e editar, e um JSON com um
 * caractere a mais não pode derrubar as treze telas. Mesmo espírito de
 * `lerPainelParaTela` na camada de acesso.
 *
 * A versão do estado manda na leitura da proposta, que não carrega versão
 * própria; a marca aplicada carrega a dela.
 */
export function lerEstado(bruto: unknown): EstadoDaMarca {
  if (!ehObjeto(bruto)) return ESTADO_VAZIO;
  const versao = bruto["versao"];
  if (typeof versao !== "number" || !VERSOES_LIDAS.includes(versao)) {
    return ESTADO_VAZIO;
  }
  return {
    versao: VERSAO_DA_MARCA,
    aplicada: lerMarca(bruto["aplicada"]),
    proposta: lerProposta(bruto["proposta"], versao),
  };
}

/** Lê o texto guardado. O estado vazio quando não é um documento válido. */
export function lerEstadoDeTexto(texto: string | null): EstadoDaMarca {
  if (texto === null || texto.trim() === "") return ESTADO_VAZIO;
  try {
    return lerEstado(JSON.parse(texto));
  } catch {
    return ESTADO_VAZIO;
  }
}

/* ------------------------------------------------------------------ *
 * Como a marca se apresenta
 * ------------------------------------------------------------------ */

/** O domínio, como a pessoa o reconhece. */
export function hospedeiroDe(site: string): string {
  try {
    return new URL(site).hostname.replace(/^www\./, "");
  } catch {
    return site;
  }
}

/**
 * De onde a marca veio, em uma expressão que a tela mostra.
 *
 * "dreamy.com.br" quando veio do site; "cores informadas à mão" quando não.
 */
export function origemLegivel(marca: {
  readonly origem: OrigemDaMarca;
  readonly site: string | null;
}): string {
  return marca.origem === "site" && marca.site !== null
    ? hospedeiroDe(marca.site)
    : "cores informadas à mão";
}
