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
 * ## O que se guarda de quem aplicou, e o que não se guarda
 *
 * Só o `sujeito` da sessão — o identificador estável do provedor de
 * identidade. Nunca nome, nunca e-mail: seria dado pessoal novo, num
 * armazenamento novo, sem retenção acordada (seção 11). O par
 * `aplicadaPor`/`aplicadaEm` é a trilha de auditoria desta feature, e é o
 * próprio artefato — não há registro à parte que possa divergir dele.
 */

import {
  corCanonica,
  type AjusteDeContraste,
} from "@/apresentacao/tema/contraste";
import { CHAVES_DE_MARCA, type CoresDaMarca } from "@/apresentacao/tema/tema";
import { perfilValido, type Perfil } from "@/seguranca/identidade";

/** Sobe quando o formato do documento mudar. Campo novo é migração. */
export const VERSAO_DA_MARCA = 1;

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

/** Como a escolha das cores foi feita. */
export const AUTORIAS = [
  "modelo",
  "deterministica",
  "modelo-recusado",
  "gateway-indisponivel",
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
  /** A origem informada, já normalizada. */
  readonly site: string;
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
 * Lê um documento guardado. `null` para qualquer coisa que não seja um.
 *
 * Nunca lança, e a razão é operacional: o arquivo mora num diretório montado
 * que uma pessoa pode abrir e editar. Um JSON quebrado precisa devolver a tela
 * ao tema padrão, não derrubar as treze telas — mesmo espírito de `ler()` no
 * armazém e de `lerPainelParaTela` na camada de acesso.
 */
export function lerMarca(bruto: unknown): Marca | null {
  if (!ehObjeto(bruto)) return null;
  if (bruto["versao"] !== VERSAO_DA_MARCA) return null;

  const site = bruto["site"];
  const aplicadaEm = bruto["aplicadaEm"];
  const aplicadaPor = bruto["aplicadaPor"];
  if (!textoNaoVazio(site) || !textoNaoVazio(aplicadaEm)) return null;
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
    site,
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
 * O que a extração produziu e a tela mostra antes de alguém aplicar.
 *
 * Guarda **as duas versões das cores**: a que o site declara e a que passou
 * pelo ajuste de contraste. É o que permite a tela mostrar o antes e o depois
 * lado a lado — e é o que impede o ajuste de ser silencioso.
 */
export type Proposta = {
  readonly site: string;
  /** As cores já ajustadas: é o que entra se alguém aplicar. */
  readonly cores: CoresDaMarca;
  /** As cores como o site as declara, antes do ajuste. */
  readonly coresDoSite: CoresDaMarca;
  readonly logo: LogoDaMarca | null;
  /** Por que o logo do site não serviu, quando não serviu. */
  readonly logoRecusado: string | null;
  readonly extracao: RegistroDaExtracao;
  /** Quantas cores o site declarava, para a tela dizer o tamanho da escolha. */
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

function lerProposta(bruto: unknown): Proposta | null {
  if (!ehObjeto(bruto)) return null;
  const cores = lerCores(bruto["cores"]);
  const coresDoSite = lerCores(bruto["coresDoSite"]);
  const extracao = lerExtracao(bruto["extracao"]);
  const site = bruto["site"];
  const propostaEm = bruto["propostaEm"];
  if (cores === null || coresDoSite === null || extracao === null) return null;
  if (!textoNaoVazio(site) || !textoNaoVazio(propostaEm)) return null;

  const logoRecusado = bruto["logoRecusado"];
  const candidatos = bruto["candidatos"];
  const avisos = bruto["avisos"];

  return {
    site,
    cores,
    coresDoSite,
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
 */
export function lerEstado(bruto: unknown): EstadoDaMarca {
  if (!ehObjeto(bruto) || bruto["versao"] !== VERSAO_DA_MARCA) {
    return ESTADO_VAZIO;
  }
  return {
    versao: VERSAO_DA_MARCA,
    aplicada: lerMarca(bruto["aplicada"]),
    proposta: lerProposta(bruto["proposta"]),
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
