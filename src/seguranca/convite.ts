/**
 * O convite assinado: como cinquenta pessoas entram pelo QR sem cadastro
 * (D-CONVITE-apresentacao).
 *
 * ## O que isto é, e o que não é
 *
 * É **autenticação de apresentação**: quem tem o link entra, com perfil fixo
 * de leitura, até o link vencer. Não é o provedor de identidade de um cliente
 * — esse é OIDC (T-221), e continua pendente. A distinção não é de qualidade
 * de implementação: um portador de link não é uma pessoa identificada, e o
 * produto não deve fingir que é. Por isso o sujeito da sessão diz o que é:
 * `convite:<sala>:<dispositivo>`.
 *
 * ## Dois envelopes, e por que o `tipo` existe
 *
 * O **convite** é o que vai no QR. A **sessão** é o cookie que o navegador
 * guarda depois de entrar. Os dois são assinados com o mesmo segredo, e por
 * isso cada um declara o `tipo`: sem ele, colar o token do QR no lugar do
 * cookie daria uma sessão sem dispositivo — e duas pessoas com o mesmo link
 * teriam o mesmo sujeito, que é exatamente o conflito de conversa que a
 * apresentação precisa não ter.
 *
 * ## Só Web Crypto
 *
 * Nada de `node:crypto`: este módulo roda no proxy, que é runtime de
 * borda, e no servidor. `crypto.subtle` existe nos dois. A chave é derivada
 * uma vez por segredo e fica memorizada — importar a chave a cada requisição
 * custa mais que verificar a assinatura.
 *
 * ## O que o token carrega, e o que não carrega
 *
 * Sala, perfil, prazo. Nenhum nome, nenhum identificador de pessoa: o QR fica
 * projetado numa parede e é fotografado. O dispositivo é sorteado **aqui**,
 * no servidor, quando a pessoa entra — e é o que separa as conversas.
 */

import type { Perfil } from "@/seguranca/identidade";
import { perfilValido } from "@/seguranca/identidade";

/** O nome do cookie de sessão. */
export const NOME_DO_COOKIE = "amanna-bi.sessao";

/** O parâmetro que leva o token na URL do QR. */
export const PARAMETRO_DO_CONVITE = "convite";

/** O parâmetro que diz para onde ir depois de entrar. */
export const PARAMETRO_DE_DESTINO = "ir";

/** O parâmetro que explica por que a tela de entrada apareceu. */
export const PARAMETRO_DE_MOTIVO = "motivo";

/**
 * O perfil de quem entra pelo QR.
 *
 * `auditor` lê os três módulos e a trilha, e **não** configura a marca nem
 * enxerga a tela de apresentação. É o perfil de leitura que já existe; criar
 * um sexto perfil só para isto faria a matriz de autorização crescer para
 * descrever um caso que é leitura pura.
 */
export const PERFIL_DO_PUBLICO: Perfil = "auditor";

/** Quem pode abrir a tela de apresentação e gerar o QR. */
export const PERFIS_QUE_APRESENTAM: readonly Perfil[] = [
  "diretoria",
  "controller",
];

export function podeApresentar(perfil: Perfil): boolean {
  return PERFIS_QUE_APRESENTAM.includes(perfil);
}

/**
 * Os caminhos que não exigem sessão.
 *
 * `/entrar` porque é onde se entra; o logo porque o cabeçalho da própria tela
 * de entrada o pede; o ícone porque o navegador o busca sozinho. Nada aqui lê
 * dado do cliente.
 */
export const CAMINHOS_PUBLICOS: readonly string[] = [
  "/entrar",
  "/api/marca/logo",
  "/favicon.ico",
];

/** Quanto tempo um convite pode durar, no máximo. */
export const HORAS_MAXIMAS = 24;

/** O tamanho do segredo, em caracteres, que o boot exige. */
export const TAMANHO_MINIMO_DO_SEGREDO = 32;

/* ------------------------------------------------------------------ *
 * Os dois envelopes
 * ------------------------------------------------------------------ */

/** A versão do envelope. Sobe quando o formato mudar. */
export const VERSAO_DO_ENVELOPE = 1;

export type Convite = {
  readonly v: typeof VERSAO_DO_ENVELOPE;
  readonly tipo: "convite";
  /** A sala: uma apresentação. Só letras, dígitos e hífen. */
  readonly sala: string;
  readonly perfil: Perfil;
  /** Instante de expiração, em segundos desde a época. */
  readonly expira: number;
};

export type SessaoDeConvite = {
  readonly v: typeof VERSAO_DO_ENVELOPE;
  readonly tipo: "sessao";
  readonly sala: string;
  readonly perfil: Perfil;
  /** Sorteado no servidor: é o que separa a conversa de cada celular. */
  readonly dispositivo: string;
  readonly expira: number;
};

/** Sala: o que cabe numa URL sem escapar, e numa etiqueta de reunião. */
export const FORMA_DA_SALA = /^[a-z0-9][a-z0-9-]{0,31}$/;

export function salaValida(candidata: string): boolean {
  return FORMA_DA_SALA.test(candidata);
}

/** A sessão não existe ou não vale mais. */
export class SessaoAusente extends Error {
  constructor(motivo: string) {
    super(
      `Sem sessão de convite: ${motivo}. Quem entra pelo QR recebe um cookie ` +
        "assinado em /entrar; sem ele o produto não serve dado nenhum.",
    );
    this.name = "SessaoAusente";
  }
}

/* ------------------------------------------------------------------ *
 * Base64url e a assinatura
 * ------------------------------------------------------------------ */

function paraBase64Url(bytes: Uint8Array): string {
  let binario = "";
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function deBase64Url(texto: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(texto)) return null;
  const preenchido = texto
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(texto.length / 4) * 4, "=");
  try {
    const binario = atob(preenchido);
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i += 1)
      bytes[i] = binario.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

const CODIFICADOR = new TextEncoder();
const DECODIFICADOR = new TextDecoder();

/**
 * A chave HMAC, memorizada por segredo.
 *
 * No escopo do processo, como o cliente do banco: o servidor empacota cada
 * rota à parte, e uma variável de módulo daria uma chave por pedaço.
 */
const CHAVES = Symbol.for("amanna-bi.convite.chaves");
type Portador = { [CHAVES]?: Map<string, Promise<CryptoKey>> };

function chaveDe(segredo: string): Promise<CryptoKey> {
  const portador = globalThis as unknown as Portador;
  portador[CHAVES] ??= new Map();
  const guardada = portador[CHAVES].get(segredo);
  if (guardada !== undefined) return guardada;
  const nova = crypto.subtle.importKey(
    "raw",
    CODIFICADOR.encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  portador[CHAVES].set(segredo, nova);
  return nova;
}

async function assinar(payload: string, segredo: string): Promise<string> {
  const chave = await chaveDe(segredo);
  const assinatura = await crypto.subtle.sign(
    "HMAC",
    chave,
    CODIFICADOR.encode(payload),
  );
  return `${payload}.${paraBase64Url(new Uint8Array(assinatura))}`;
}

/**
 * Verifica e devolve o JSON de dentro. `null` para qualquer coisa que não
 * seja um envelope nosso, íntegro e no prazo.
 *
 * `crypto.subtle.verify` compara em tempo constante: comparar a assinatura
 * como texto vazaria, por tempo, quanto de um palpite está certo.
 */
async function abrir(
  envelope: string,
  segredo: string,
): Promise<Record<string, unknown> | null> {
  const separador = envelope.lastIndexOf(".");
  if (separador <= 0) return null;
  const payload = envelope.slice(0, separador);
  const assinatura = deBase64Url(envelope.slice(separador + 1));
  if (assinatura === null) return null;

  const chave = await chaveDe(segredo);
  const confere = await crypto.subtle.verify(
    "HMAC",
    chave,
    // `Uint8Array` genérico não satisfaz `BufferSource` no TypeScript desta
    // versão: o buffer pode ser compartilhado, e a assinatura pede um comum.
    assinatura.buffer.slice(
      assinatura.byteOffset,
      assinatura.byteOffset + assinatura.byteLength,
    ) as ArrayBuffer,
    CODIFICADOR.encode(payload),
  );
  if (!confere) return null;

  const corpo = deBase64Url(payload);
  if (corpo === null) return null;
  try {
    const bruto: unknown = JSON.parse(DECODIFICADOR.decode(corpo));
    return typeof bruto === "object" && bruto !== null
      ? (bruto as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function comum(
  bruto: Record<string, unknown>,
  tipo: string,
  agoraSegundos: number,
): {
  readonly sala: string;
  readonly perfil: Perfil;
  readonly expira: number;
} | null {
  if (bruto["v"] !== VERSAO_DO_ENVELOPE) return null;
  if (bruto["tipo"] !== tipo) return null;
  const sala = bruto["sala"];
  const perfil = bruto["perfil"];
  const expira = bruto["expira"];
  if (typeof sala !== "string" || !salaValida(sala)) return null;
  if (typeof perfil !== "string" || !perfilValido(perfil)) return null;
  if (typeof expira !== "number" || !Number.isFinite(expira)) return null;
  if (expira <= agoraSegundos) return null;
  return { sala, perfil, expira };
}

/* ------------------------------------------------------------------ *
 * Assinar e verificar
 * ------------------------------------------------------------------ */

export async function assinarConvite(
  convite: Convite,
  segredo: string,
): Promise<string> {
  return assinar(
    paraBase64Url(CODIFICADOR.encode(JSON.stringify(convite))),
    segredo,
  );
}

export async function verificarConvite(
  token: string,
  segredo: string,
  agoraSegundos: number,
): Promise<Convite | null> {
  const bruto = await abrir(token, segredo);
  if (bruto === null) return null;
  const lido = comum(bruto, "convite", agoraSegundos);
  if (lido === null) return null;
  return { v: VERSAO_DO_ENVELOPE, tipo: "convite", ...lido };
}

export async function assinarSessao(
  sessao: SessaoDeConvite,
  segredo: string,
): Promise<string> {
  return assinar(
    paraBase64Url(CODIFICADOR.encode(JSON.stringify(sessao))),
    segredo,
  );
}

export async function verificarSessao(
  cookie: string,
  segredo: string,
  agoraSegundos: number,
): Promise<SessaoDeConvite | null> {
  const bruto = await abrir(cookie, segredo);
  if (bruto === null) return null;
  const lido = comum(bruto, "sessao", agoraSegundos);
  if (lido === null) return null;
  const dispositivo = bruto["dispositivo"];
  if (typeof dispositivo !== "string" || dispositivo === "") return null;
  return { v: VERSAO_DO_ENVELOPE, tipo: "sessao", ...lido, dispositivo };
}

/** Quantos bytes de sorteio identificam um celular nesta sala. */
const BYTES_DO_DISPOSITIVO = 16;

/** Um identificador de dispositivo, sorteado no servidor. */
export function gerarDispositivo(): string {
  const bytes = new Uint8Array(BYTES_DO_DISPOSITIVO);
  crypto.getRandomValues(bytes);
  return paraBase64Url(bytes);
}

/** O que marca um sujeito como celular de apresentação, e não pessoa. */
export const PREFIXO_DO_CONVITE = "convite:";

/** O sujeito da sessão: diz o que é, e separa os celulares. */
export function sujeitoDe(sessao: SessaoDeConvite): string {
  return `${PREFIXO_DO_CONVITE}${sessao.sala}:${sessao.dispositivo}`;
}

/**
 * Este sujeito é um celular que entrou pelo QR?
 *
 * A distinção decide o limite por minuto (`src/chat/limite.ts`): um celular
 * anônimo numa plateia de cinquenta é o que aquele limite protege; uma pessoa
 * identificada da empresa é outra conversa, e outra tarefa.
 */
export function ehDispositivoDeApresentacao(sujeito: string): boolean {
  return sujeito.startsWith(PREFIXO_DO_CONVITE);
}

/* ------------------------------------------------------------------ *
 * O destino
 * ------------------------------------------------------------------ */

/** Para onde ir quando o convite não diz. */
export const DESTINO_PADRAO = "/rh/visao";

/**
 * O destino pedido, se for um caminho desta instalação.
 *
 * Só caminho relativo de uma barra. `//evil.com` é endereço absoluto sem
 * esquema, `https://evil.com` é absoluto, e os dois redirecionariam para fora
 * levando quem escaneou o QR. Um controle de redirecionamento aberto é
 * exatamente o que um link colado numa apresentação não pode ter.
 */
export function destinoSeguro(pedido: string | null | undefined): string {
  if (pedido === null || pedido === undefined || pedido === "") {
    return DESTINO_PADRAO;
  }
  if (!pedido.startsWith("/")) return DESTINO_PADRAO;
  if (pedido.startsWith("//")) return DESTINO_PADRAO;
  if (pedido.includes("\\")) return DESTINO_PADRAO;
  // Um caminho com esquema embutido ("/\t/evil") não chega aqui: o controle é
  // começar com uma barra e não ter a segunda.
  return pedido;
}

/* ------------------------------------------------------------------ *
 * As duas decisões do proxy
 * ------------------------------------------------------------------ */

/** Por que a tela de entrada apareceu. Enum fechado, como todo motivo. */
export const MOTIVOS_DE_ENTRADA = [
  "sem-sessao",
  "expirado",
  "invalido",
  "desligado",
] as const;
export type MotivoDeEntrada = (typeof MOTIVOS_DE_ENTRADA)[number];

export function motivoValido(candidato: string): candidato is MotivoDeEntrada {
  return (MOTIVOS_DE_ENTRADA as readonly string[]).includes(candidato);
}

/** O modo de acesso desta instalação, lido do ambiente. */
export function acessoPorConvite(
  ambiente: Record<string, string | undefined>,
): boolean {
  return ambiente["AUTH_PROVIDER"] === "convite";
}

/** O segredo, ou `null` quando não há. Nunca é registrado nem devolvido. */
export function segredoDoConvite(
  ambiente: Record<string, string | undefined>,
): string | null {
  const bruto = ambiente["CONVITE_SEGREDO"];
  return bruto === undefined || bruto.trim() === "" ? null : bruto;
}

/* ------------------------------------------------------------------ *
 * A sala aberta pelo botão
 * ------------------------------------------------------------------ */

/**
 * Apresentar e entrar são coisas diferentes, e esta é a linha entre elas.
 *
 * `AUTH_PROVIDER=convite` responde *"como esta instalação sabe quem entrou"*:
 * é a porta do painel, e existe porque o OIDC ainda não existe (T-221). Já a
 * apresentação responde outra coisa — *"esta instalação abre uma sala para uma
 * plateia?"* — e a resposta é sim sempre que houver segredo para assinar o QR.
 *
 * Amarrar as duas foi um erro de desenho: obrigava quem apresenta a entrar por
 * link no próprio painel, quando o pedido era abrir o painel como sempre e
 * clicar num botão. Com a separação, o painel continua abrindo do jeito que a
 * instalação escolheu, e o QR passa a existir em qualquer um dos modos.
 */
export function apresentacaoLigada(
  ambiente: Record<string, string | undefined>,
): boolean {
  return segredoDoConvite(ambiente) !== null;
}

/**
 * A sala de quem abriu a apresentação pelo botão, sem ter entrado por convite.
 *
 * Um nome fixo, e não sorteado: a sala é a unidade do teto de tokens do chat
 * (D-CONVITE-apresentacao), e uma sala nova a cada recarga zeraria esse teto
 * — que é justamente o que ele existe para não deixar acontecer.
 */
export const SALA_PADRAO = "apresentacao";

/** Quanto vale o QR de uma sala aberta pelo botão. */
export const HORAS_DA_SALA_PADRAO = 4;

/** Segundos numa hora, para as contas de prazo. */
export const SEGUNDOS_POR_HORA = 3600;

export type Acesso =
  | { readonly tipo: "seguir" }
  | { readonly tipo: "redirecionar"; readonly para: string }
  | { readonly tipo: "negar" };

export type EntradaDaRequisicao = {
  readonly caminho: string;
  readonly busca: string;
  readonly cookie: string | null;
  readonly ambiente: Record<string, string | undefined>;
  readonly agoraSegundos: number;
};

/** O caminho é público? Casamento por prefixo de segmento, nunca por `includes`. */
function publico(caminho: string): boolean {
  return CAMINHOS_PUBLICOS.some(
    (p) => caminho === p || caminho.startsWith(`${p}/`),
  );
}

/**
 * A decisão de toda requisição que não é a entrada.
 *
 * Em modo aberto (`fixtures`, `oidc`), segue: o proxy não nega nada, e o
 * arnês de ponta a ponta continua como sempre. Em modo convite, sem cookie
 * válido, página vai para `/entrar` levando o destino, e `/api/*` é negada —
 * uma rota de dados não redireciona, responde 401.
 *
 * **O proxy não é o controle.** O matcher pula requisições de prefetch, e
 * por isso quem verifica o cookie de verdade é o provedor de sessão, a cada
 * leitura. Isto aqui é a negação cedo, que poupa render e deixa a tela certa
 * na frente de quem chegou sem convite.
 */
export async function decidirAcesso(e: EntradaDaRequisicao): Promise<Acesso> {
  if (!acessoPorConvite(e.ambiente)) return { tipo: "seguir" };
  if (publico(e.caminho)) return { tipo: "seguir" };

  const segredo = segredoDoConvite(e.ambiente);
  const sessao =
    segredo === null || e.cookie === null
      ? null
      : await verificarSessao(e.cookie, segredo, e.agoraSegundos);
  if (sessao !== null) return { tipo: "seguir" };

  if (e.caminho.startsWith("/api/")) return { tipo: "negar" };

  const motivo: MotivoDeEntrada = e.cookie === null ? "sem-sessao" : "expirado";
  const destino = new URLSearchParams();
  destino.set(PARAMETRO_DE_MOTIVO, motivo);
  destino.set(
    PARAMETRO_DE_DESTINO,
    e.busca === "" ? e.caminho : `${e.caminho}?${e.busca}`,
  );
  return { tipo: "redirecionar", para: `/entrar?${destino.toString()}` };
}

export type Entrada =
  | {
      readonly tipo: "entrar";
      readonly cookie: string;
      readonly maxAge: number;
      readonly destino: string;
    }
  | { readonly tipo: "recusar"; readonly motivo: MotivoDeEntrada };

/**
 * A entrada por `/entrar?convite=…`.
 *
 * O cookie herda o **prazo do convite**: quando o link vence, todos os
 * celulares vencem juntos, e ninguém fica com acesso porque entrou cedo. O
 * dispositivo é sorteado aqui — é o que faz duas pessoas com o mesmo QR terem
 * conversas separadas.
 */
export async function decidirEntrada(e: {
  readonly token: string | null;
  readonly ir: string | null;
  readonly ambiente: Record<string, string | undefined>;
  readonly agoraSegundos: number;
}): Promise<Entrada> {
  /*
   * Quem entra pelo QR entra em qualquer modo de sessão.
   *
   * Antes esta porta só abria com `AUTH_PROVIDER=convite`, e isso obrigava a
   * instalação inteira a entrar por link para que a plateia pudesse entrar por
   * QR. O que decide aqui é haver segredo para conferir a assinatura — sem
   * ele não há apresentação, e o motivo é `desligado`.
   */
  const segredo = segredoDoConvite(e.ambiente);
  if (segredo === null) {
    return { tipo: "recusar", motivo: "desligado" };
  }
  if (e.token === null || e.token === "") {
    return { tipo: "recusar", motivo: "invalido" };
  }
  const convite = await verificarConvite(e.token, segredo, e.agoraSegundos);
  if (convite === null) return { tipo: "recusar", motivo: "invalido" };

  const sessao: SessaoDeConvite = {
    v: VERSAO_DO_ENVELOPE,
    tipo: "sessao",
    sala: convite.sala,
    perfil: convite.perfil,
    dispositivo: gerarDispositivo(),
    expira: convite.expira,
  };
  return {
    tipo: "entrar",
    cookie: await assinarSessao(sessao, segredo),
    maxAge: Math.max(0, convite.expira - e.agoraSegundos),
    destino: destinoSeguro(e.ir),
  };
}
