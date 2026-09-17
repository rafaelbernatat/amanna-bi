/**
 * A guarda do endereço: requisição forjada do lado do servidor (D-MARCA).
 *
 * A URL vem de quem usa. Sem guarda, "busque o site da minha empresa" é um
 * pedido para o servidor buscar **qualquer coisa alcançável de dentro da
 * rede** — o serviço de metadados da nuvem, um painel interno, um banco.
 *
 * ## Este módulo é puro
 *
 * Nenhuma rede, nenhuma resolução de nome, nenhum arquivo. A política é uma
 * função de texto e de endereço para motivo de recusa, e é isso que permite
 * cobrir as vinte e poucas formas de escrever "127.0.0.1" sem levantar nada.
 * Quem resolve nomes é o adaptador de rede, e ele chama daqui.
 *
 * ## A guarda fica na frente dos dois adaptadores
 *
 * O arnês de ponta a ponta troca a **fonte dos bytes**, nunca a política: o
 * adaptador de fixtures confere o endereço com estas mesmas funções antes de
 * servir qualquer coisa. Sem essa disciplina, "o e2e passa" deixaria de dizer
 * alguma coisa sobre a guarda — e uma guarda que o teste contorna é uma guarda
 * que ninguém testa.
 */

/** Por que um endereço foi recusado. */
export const MOTIVOS_DE_RECUSA = [
  "esquema_nao_aceito",
  "credencial_na_url",
  "porta_nao_aceita",
  "hospedeiro_ausente",
  "endereco_literal",
  "nome_reservado",
  "endereco_privado",
  "metadados_de_nuvem",
  "redirecionamentos_demais",
  "tempo_esgotado",
  "corpo_grande_demais",
  "tipo_nao_aceito",
] as const;
export type MotivoDeRecusa = (typeof MOTIVOS_DE_RECUSA)[number];

/** A frase que a tela mostra para cada motivo. Nenhuma expõe rede interna. */
export const FRASE_DA_RECUSA: Readonly<Record<MotivoDeRecusa, string>> = {
  esquema_nao_aceito: "O endereço precisa começar com https://.",
  credencial_na_url: "O endereço não pode carregar usuário e senha.",
  porta_nao_aceita: "O endereço precisa usar a porta padrão de https.",
  hospedeiro_ausente: "O endereço não tem um domínio.",
  endereco_literal: "Informe o domínio da empresa, e não um endereço numérico.",
  nome_reservado: "Esse nome não é um site público.",
  endereco_privado: "Esse endereço não é alcançável pela internet pública.",
  metadados_de_nuvem: "Esse endereço não é alcançável pela internet pública.",
  redirecionamentos_demais: "O site redirecionou vezes demais.",
  tempo_esgotado: "O site demorou demais para responder.",
  corpo_grande_demais: "A página do site é grande demais para ler.",
  tipo_nao_aceito: "O endereço não devolveu uma página de site.",
};

export type EnderecoAceito = {
  readonly ok: true;
  /** A URL normalizada, que é a que será buscada. */
  readonly url: string;
  readonly hospedeiro: string;
};

export type EnderecoRecusado = {
  readonly ok: false;
  readonly motivo: MotivoDeRecusa;
};

export type Conferencia = EnderecoAceito | EnderecoRecusado;

function recusar(motivo: MotivoDeRecusa): EnderecoRecusado {
  return { ok: false, motivo };
}

/* ------------------------------------------------------------------ *
 * Nomes que nunca são site público
 * ------------------------------------------------------------------ */

const NOMES_RESERVADOS = new Set(["localhost", "metadata.google.internal"]);

const SUFIXOS_RESERVADOS = [
  ".localhost",
  ".local",
  ".internal",
  ".home.arpa",
  ".localdomain",
];

/* ------------------------------------------------------------------ *
 * Endereços
 * ------------------------------------------------------------------ */

const OCTETOS = 4;
const MAIOR_OCTETO = 255;

/**
 * O texto é um endereço numérico, em **qualquer** notação?
 *
 * Não basta reconhecer `127.0.0.1`. O mesmo endereço se escreve `2130706433`,
 * `0177.0.0.1`, `0x7f.0.0.1` e `::ffff:127.0.0.1`, e todas resolvem para o
 * laço local. Recusar por forma, e não por valor, é o que fecha a lista — o
 * valor a gente confere depois, no resultado da resolução de nome.
 */
export function pareceEnderecoLiteral(hospedeiro: string): boolean {
  const nu = hospedeiro.replace(/^\[|\]$/g, "");
  if (nu.includes(":")) return true;
  // Decimal, octal ou hexadecimal puro: `2130706433`, `0x7f000001`, `017700000001`.
  if (/^(0x[0-9a-f]+|\d+)$/i.test(nu)) return true;
  // Notação pontuada em qualquer base, com uma a quatro partes.
  return /^(0x[0-9a-f]+|\d+)(\.(0x[0-9a-f]+|\d+)){1,3}$/i.test(nu);
}

function octetosDe(ip: string): readonly number[] | null {
  const partes = ip.split(".");
  if (partes.length !== OCTETOS) return null;
  const numeros = partes.map((p) => Number(p));
  if (numeros.some((n) => !Number.isInteger(n) || n < 0 || n > MAIOR_OCTETO)) {
    return null;
  }
  return numeros;
}

/** As faixas de IPv4 que não são internet pública, com o prefixo em bits. */
const FAIXAS_V4: readonly (readonly [string, number])[] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

const BITS_V4 = 32;

function comoNumero(octetos: readonly number[]): number {
  return octetos.reduce(
    (acumulado, o) => acumulado * (MAIOR_OCTETO + 1) + o,
    0,
  );
}

function dentroDaFaixa(
  ip: readonly number[],
  base: string,
  bits: number,
): boolean {
  const octetosDaBase = octetosDe(base);
  if (octetosDaBase === null) return false;
  const mascara = bits === 0 ? 0 : (-1 << (BITS_V4 - bits)) >>> 0;
  return ((comoNumero(ip) ^ comoNumero(octetosDaBase)) & mascara) === 0;
}

/**
 * Os endereços de metadados, nomeados à parte.
 *
 * As faixas acima já os cobrem. Nomeá-los mesmo assim é o que faz um revisor
 * futuro acreditar na guarda: a lista de faixas exige confiar na aritmética, e
 * esta lista se lê.
 */
const METADADOS_DE_NUVEM = new Set([
  "169.254.169.254",
  "169.254.170.2",
  "100.100.100.200",
  "fd00:ec2::254",
]);

/**
 * O endereço resolvido é alcançável pela internet pública?
 *
 * Devolve o motivo da recusa, ou `null` quando o endereço passa. Chamada para
 * **cada** endereço que a resolução de nome devolver, e antes de o socket
 * conectar.
 */
export function enderecoPermitido(ip: string): MotivoDeRecusa | null {
  const limpo = ip.trim().toLowerCase();
  if (METADADOS_DE_NUVEM.has(limpo)) return "metadados_de_nuvem";

  if (limpo.includes(":")) return enderecoV6Permitido(limpo);

  const octetos = octetosDe(limpo);
  if (octetos === null) return "endereco_privado";
  if (comoNumero(octetos) === comoNumero([255, 255, 255, 255])) {
    return "endereco_privado";
  }
  for (const [base, bits] of FAIXAS_V4) {
    if (dentroDaFaixa(octetos, base, bits)) return "endereco_privado";
  }
  return null;
}

function enderecoV6Permitido(ip: string): MotivoDeRecusa | null {
  const nu = ip.replace(/^\[|\]$/g, "");

  // IPv4 embutido: confere pelo caminho de v4, senão `::ffff:127.0.0.1` passa.
  const embutido = /(\d+\.\d+\.\d+\.\d+)$/.exec(nu);
  if (embutido?.[1] !== undefined) {
    const motivo = enderecoPermitido(embutido[1]);
    if (motivo !== null) return motivo;
  }

  if (nu === "::" || nu === "::1") return "endereco_privado";
  // Local único (fc00::/7), ligação local (fe80::/10), multicast (ff00::/8).
  if (/^(f[cd]|fe[89ab]|ff)/i.test(nu)) return "endereco_privado";
  // Documentação, e o prefixo de tradução que alcança metadados por NAT64.
  if (/^(2001:db8|64:ff9b|100:)/i.test(nu)) return "endereco_privado";
  return null;
}

/* ------------------------------------------------------------------ *
 * A URL
 * ------------------------------------------------------------------ */

/** Só `https`. O produto já exige TLS na própria política de segurança. */
const ESQUEMA_ACEITO = "https:";
const PORTAS_ACEITAS = new Set(["", "443"]);

/**
 * Confere a URL informada, sem tocar na rede.
 *
 * O que sobrevive daqui ainda pode ser recusado: o nome resolve para um
 * endereço, e o endereço passa por `enderecoPermitido` antes de conectar.
 */
export function conferirEndereco(bruto: string): Conferencia {
  let url: URL;
  try {
    url = new URL(bruto.trim());
  } catch {
    // Sem esquema, tenta como domínio digitado a seco: é o que a pessoa faz.
    try {
      url = new URL(`https://${bruto.trim()}`);
    } catch {
      return recusar("hospedeiro_ausente");
    }
  }

  if (url.protocol !== ESQUEMA_ACEITO) return recusar("esquema_nao_aceito");

  // `https://usuario:senha@confiavel@interno/` é confusão de leitor clássica.
  if (url.username !== "" || url.password !== "") {
    return recusar("credencial_na_url");
  }

  if (!PORTAS_ACEITAS.has(url.port)) return recusar("porta_nao_aceita");

  const hospedeiro = url.hostname.toLowerCase();
  if (hospedeiro === "") return recusar("hospedeiro_ausente");

  if (pareceEnderecoLiteral(hospedeiro)) return recusar("endereco_literal");

  if (NOMES_RESERVADOS.has(hospedeiro)) return recusar("nome_reservado");
  if (SUFIXOS_RESERVADOS.some((s) => hospedeiro.endsWith(s))) {
    return recusar("nome_reservado");
  }
  // Rótulo único, sem ponto: é nome de máquina na rede interna.
  if (!hospedeiro.includes(".")) return recusar("nome_reservado");

  return { ok: true, url: url.toString(), hospedeiro };
}
