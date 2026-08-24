/**
 * O provedor de sessão, trocável por variável de ambiente (T-136).
 *
 * Mesma forma da fábrica de dados (T-106), e pela mesma razão: `AUTH_PROVIDER`
 * troca a implementação e **nenhuma tela muda**. É o que faz demonstração e
 * produção não divergirem — a suíte roda idêntica nos dois modos, e por isso
 * "funciona com fixtures" quer dizer alguma coisa sobre produção.
 *
 * ## Por que o modo fixtures existe, e por que ele é perigoso
 *
 * Sem ele, ninguém abre o produto sem um provedor de identidade configurado —
 * nem para desenvolver, nem para demonstrar. Com ele, existe um caminho em que
 * a aplicação serve dado a quem escolher o próprio perfil por variável de
 * ambiente.
 *
 * Por isso duas travas:
 *
 * 1. **O modo é lido uma vez, no boot**, junto do resto da configuração
 *    (T-139). Não há como alternar em requisição.
 * 2. **Sessão de fixtures com dado real aborta.** Um perfil escolhido por
 *    variável de ambiente na frente do warehouse do cliente é autenticação que
 *    não autentica, e a forma de esse engano acontecer é sempre a mesma:
 *    alguém copia o `docker-compose` da demonstração e troca só o banco.
 *
 *    A primeira versão desta trava mirava `NODE_ENV=production`, e mirava
 *    errado nas duas direções. Recusava a demonstração — `next start` define
 *    `NODE_ENV=production`, então o mockup com fixtures não subia em build de
 *    produção nenhum, e a suíte de e2e junto. E não recusava o caso perigoso
 *    montado em desenvolvimento: `AUTH_PROVIDER=fixtures` com
 *    `DATA_SOURCE=warehouse` passava.
 *
 *    O que separa demonstração de risco não é o `NODE_ENV`, é **de onde vem o
 *    dado**. Sessão falsa com dado falso é uma demonstração; sessão falsa com
 *    dado de cliente é o incidente.
 */

import type { Perfil, Session } from "@/seguranca/identidade";
import { PERFIS, perfilValido } from "@/seguranca/identidade";
import { AREAS, ENTIDADES } from "@/semantica/contrato";

/** Os modos aceitos. Enum fechado: um valor novo é decisão, não digitação. */
export const PROVEDORES = ["fixtures", "oidc"] as const;
export type ProvedorDeSessao = (typeof PROVEDORES)[number];

export class ProvedorInvalido extends Error {
  constructor(motivo: string) {
    super(
      `AUTH_PROVIDER: ${motivo}. Aceitos: ${PROVEDORES.join(", ")}. ` +
        "O boot para aqui de propósito: subir sem saber quem autentica " +
        "serviria dado a uma sessão que ninguém verificou (seção 11).",
    );
    this.name = "ProvedorInvalido";
  }
}

/**
 * Lê e valida `AUTH_PROVIDER`.
 *
 * A terceira condição é a que importa: `fixtures` na frente do warehouse não é
 * configuração ruim, é ausência de autenticação com aparência de autenticação.
 */
export function lerProvedor(
  ambiente: Record<string, string | undefined>,
): ProvedorDeSessao {
  const bruto = ambiente["AUTH_PROVIDER"];
  if (bruto === undefined || bruto === "") {
    throw new ProvedorInvalido("ausente");
  }
  if (!(PROVEDORES as readonly string[]).includes(bruto)) {
    throw new ProvedorInvalido(`'${bruto}' não é um modo válido`);
  }
  if (bruto === "fixtures" && ambiente["DATA_SOURCE"] === "warehouse") {
    throw new ProvedorInvalido(
      "'fixtures' escolhe o perfil por variável de ambiente, e DATA_SOURCE=" +
        "warehouse serve dado real do cliente. A combinação é autenticação " +
        "que não autentica na frente de dado que importa",
    );
  }
  return bruto as ProvedorDeSessao;
}

/* ------------------------------------------------------------------ *
 * O modo fixtures
 * ------------------------------------------------------------------ */

/**
 * O perfil de desenvolvimento, escolhido por `AUTH_PROFILE`.
 *
 * Existe para que uma pessoa consiga ver o produto pelos olhos de um
 * `controller` ou de um `area` sem provedor de identidade nenhum — que é
 * exatamente o teste que a seção 11 pede e que ninguém faz quando exige
 * cadastro de usuário para cada perfil.
 *
 * O padrão é `diretoria` porque é o perfil que enxerga tudo: cair num perfil
 * estreito faria a demonstração parecer quebrada em vez de restrita.
 */
const PERFIL_PADRAO: Perfil = "diretoria";

/** O que cada perfil de desenvolvimento enxerga. */
const CONCESSOES: Readonly<
  Record<Perfil, Pick<Session, "entidades" | "areas">>
> = {
  diretoria: { entidades: [...ENTIDADES], areas: [...AREAS] },
  controller: { entidades: [...ENTIDADES], areas: [...AREAS] },
  auditor: { entidades: [...ENTIDADES], areas: [...AREAS] },
  rh: { entidades: [...ENTIDADES], areas: [...AREAS] },
  // O perfil `area` tem recorte fixo à sua área (seção 11). Aqui isso é
  // demonstrado com uma área concreta: um `area` que enxerga todas não
  // exercita a restrição, e é justamente ela que se quer ver funcionando.
  area: { entidades: ["consolidado"], areas: ["tecnologia"] },
};

export function sessaoDeFixtures(
  ambiente: Record<string, string | undefined>,
): Session {
  const pedido = ambiente["AUTH_PROFILE"];
  const perfil: Perfil =
    pedido !== undefined && perfilValido(pedido) ? pedido : PERFIL_PADRAO;

  if (pedido !== undefined && !perfilValido(pedido)) {
    // Avisa e segue no padrão: em desenvolvimento, derrubar o processo por
    // um perfil mal digitado atrapalha mais do que ajuda. Em produção este
    // caminho nem existe — `lerProvedor` já abortou.
    console.warn(
      `AUTH_PROFILE='${pedido}' não é um perfil. Usando '${PERFIL_PADRAO}'. ` +
        `Perfis: ${PERFIS.join(", ")}.`,
    );
  }

  const concessao = CONCESSOES[perfil];
  return {
    sujeito: `fixtures:${perfil}`,
    perfil,
    entidades: concessao.entidades,
    areas: concessao.areas,
  };
}

/* ------------------------------------------------------------------ *
 * O registro
 * ------------------------------------------------------------------ */

export type ConstrutorDeSessao = () => Promise<Session>;

const REGISTRO = new Map<ProvedorDeSessao, ConstrutorDeSessao>();

/**
 * Registra a implementação de um modo.
 *
 * Explícito, como na fábrica de dados: o provedor OIDC traz cliente HTTP e
 * validação de JWT junto, e carregá-lo no modo `fixtures` colocaria isso no
 * grafo de uma demonstração que não fala com IdP nenhum.
 */
export function registrarProvedor(
  provedor: ProvedorDeSessao,
  construtor: ConstrutorDeSessao,
): void {
  REGISTRO.set(provedor, construtor);
}

/** Só para teste: devolve o registro ao estado limpo. */
export function limparProvedores(): void {
  REGISTRO.clear();
}

export function provedoresRegistrados(): readonly ProvedorDeSessao[] {
  return [...REGISTRO.keys()];
}

// O modo fixtures é registrado aqui porque não traz dependência nenhuma: são
// dois objetos literais. O OIDC se registra no seu próprio módulo (T-161).
registrarProvedor("fixtures", async () => sessaoDeFixtures(process.env));

/**
 * A única forma de obter uma `Session` no produto.
 *
 * Nenhuma tela constrói sessão. Ela pede aqui, recebe a `Session`, e não sabe —
 * nem pode saber — se por trás está uma fixture ou um provedor OIDC.
 */
export async function getSession(
  ambiente: Record<string, string | undefined> = process.env,
): Promise<Session> {
  const provedor = lerProvedor(ambiente);
  const construtor = REGISTRO.get(provedor);
  if (construtor === undefined) {
    throw new ProvedorInvalido(
      `'${provedor}' é um modo válido, mas sem implementação registrada`,
    );
  }
  return construtor();
}
