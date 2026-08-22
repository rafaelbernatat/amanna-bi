/**
 * A matriz de autorização: perfil × módulo × tela × painel (T-173).
 *
 * Seção 11 do PRD. É o artefato que responde, sem ninguém precisar ler código,
 * à pergunta que a Controladoria faz na primeira reunião de segurança: *quem
 * enxerga o quê*.
 *
 * ## Por que não são 71 linhas
 *
 * A seção 11 concede por **módulo**, não por painel. Escrever uma entrada por
 * painel produziria 71 cópias da mesma regra — e cópia é onde a divergência
 * mora: bastaria alguém editar uma delas para o produto passar a ter duas
 * respostas para a mesma pergunta.
 *
 * O que fica explícito aqui é a regra por módulo mais a lista de **exceções**.
 * A cobertura dos 71 é garantida por resolução, e conferida contra o Anexo A do
 * PRD no teste — um painel novo sem regra não passa despercebido, ele resolve
 * pela regra do módulo dele ou o teste reprova.
 *
 * ## O que esta matriz não faz
 *
 * Não restringe **entidade** nem **área** — isso é `AccessScope` (T-135), e
 * acontece por consulta. Aqui é só a pergunta anterior: esta tela, este painel,
 * aparecem para este perfil? Separar as duas evita o erro clássico de deixar a
 * tela abrir e o dado vir vazio, o que a pessoa lê como "não temos esse dado"
 * em vez de "você não tem acesso".
 */

import {
  MODULOS_DO_PRODUTO,
  PERFIS,
  perfilVeModulo,
  type ModuloDoProduto,
  type Perfil,
} from "@/seguranca/identidade";
import {
  REGISTRO_DE_PAINEIS,
  type RegistroDePainel,
} from "@/semantica/paineis";

/** O que um perfil pode fazer com o que vê. */
export const ACESSOS = ["leitura", "leitura_e_trilha", "nenhum"] as const;
export type Acesso = (typeof ACESSOS)[number];

/**
 * O que cada perfil faz com o que enxerga.
 *
 * `auditor` é o único com `leitura_e_trilha`: a seção 11 lhe dá a trilha de
 * auditoria além do dado. Os outros leem — nenhum perfil escreve, porque o
 * produto não escreve no dado do cliente.
 */
const ACESSO_POR_PERFIL: Readonly<Record<Perfil, Acesso>> = {
  diretoria: "leitura",
  controller: "leitura",
  rh: "leitura",
  area: "leitura",
  auditor: "leitura_e_trilha",
};

/**
 * Uma exceção à regra do módulo.
 *
 * Existe para o dia em que um painel específico precisar sair da regra — um
 * painel de custo de pessoal no módulo de RH que só a Controladoria deve ver,
 * por exemplo. Toda exceção carrega motivo escrito: sem isso, seis meses depois
 * ninguém sabe se aquilo foi decisão ou engano.
 *
 * Hoje está vazia, e isso é informação: **nenhum painel foge da regra do
 * módulo**. O teste confere que continua assim, e uma exceção nova chega com
 * revisão.
 */
export type Excecao = {
  readonly painel: string;
  readonly perfil: Perfil;
  readonly acesso: Acesso;
  /** Por que este painel foge da regra do módulo dele. */
  readonly motivo: string;
};

export const EXCECOES: readonly Excecao[] = [];

/* ------------------------------------------------------------------ *
 * Resolução
 * ------------------------------------------------------------------ */

/**
 * O módulo de uma tela `modulo/tela`.
 *
 * Exige as **duas** partes. Só o prefixo — `'rh'` — não é tela, e aceitá-lo
 * abria um caminho em que um id incompleto resolvia para um módulo válido e a
 * autorização dizia "pode". Foi um teste de padrão-negar que pegou isto.
 */
export function moduloDaTela(tela: string): ModuloDoProduto | undefined {
  const partes = tela.split("/");
  if (partes.length !== 2) return undefined;
  const [id, slug] = partes;
  if (slug === undefined || slug === "") return undefined;
  return (MODULOS_DO_PRODUTO as readonly string[]).includes(id ?? "")
    ? (id as ModuloDoProduto)
    : undefined;
}

/** O perfil enxerga esta tela? */
export function podeVerTela(perfil: Perfil, tela: string): boolean {
  const modulo = moduloDaTela(tela);
  // Tela fora dos três módulos não existe. Negar é o padrão seguro: um id
  // digitado errado não deve abrir nada.
  if (modulo === undefined) return false;
  return perfilVeModulo(perfil, modulo);
}

/** O acesso de um perfil a um painel, já considerando exceções. */
export function acessoAoPainel(perfil: Perfil, painel: string): Acesso {
  const excecao = EXCECOES.find(
    (e) => e.painel === painel && e.perfil === perfil,
  );
  if (excecao !== undefined) return excecao.acesso;

  const registro = REGISTRO_DE_PAINEIS.find((p) => p.id === painel);
  if (registro === undefined) return "nenhum";

  return podeVerTela(perfil, registro.tela)
    ? ACESSO_POR_PERFIL[perfil]
    : "nenhum";
}

export function podeVerPainel(perfil: Perfil, painel: string): boolean {
  return acessoAoPainel(perfil, painel) !== "nenhum";
}

/* ------------------------------------------------------------------ *
 * A matriz expandida, para revisão humana
 * ------------------------------------------------------------------ */

export type LinhaDaMatriz = {
  readonly perfil: Perfil;
  readonly modulo: ModuloDoProduto;
  readonly tela: string;
  readonly painel: string;
  readonly acesso: Acesso;
};

/**
 * Os 5 × 71 pares, resolvidos.
 *
 * É o que o gerador grava em `contratos/autorizacao.json`, para que a matriz
 * possa ser lida e revisada sem executar nada — e para que uma mudança de regra
 * apareça como diff numa revisão, e não como comportamento novo em produção.
 */
export function matrizExpandida(): readonly LinhaDaMatriz[] {
  const linhas: LinhaDaMatriz[] = [];
  for (const perfil of PERFIS) {
    for (const p of REGISTRO_DE_PAINEIS) {
      const modulo = moduloDaTela(p.tela);
      if (modulo === undefined) continue;
      linhas.push({
        perfil,
        modulo,
        tela: p.tela,
        painel: p.id,
        acesso: acessoAoPainel(perfil, p.id),
      });
    }
  }
  return linhas;
}

/** Quantos painéis cada perfil enxerga. Contado, nunca escrito. */
export function paineisVisiveis(perfil: Perfil): readonly RegistroDePainel[] {
  return REGISTRO_DE_PAINEIS.filter((p) => podeVerPainel(perfil, p.id));
}
