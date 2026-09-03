/**
 * O grão mínimo, imposto na fronteira da camada de dados (T-138).
 *
 * Seção 11 do PRD: "área × mês. Nenhuma superfície do produto — painel, chat,
 * exportação — expõe linha individual de pessoa." Seção 7.5: "sem acesso a
 * linha individual; o menor grão exposto é área × mês."
 *
 * ## Por que uma lista fechada, e não uma lista de proibidos
 *
 * A tentação é escrever um filtro que recusa `cpf`, `matricula`, `nome`. É a
 * forma errada: a lista de proibidos nunca está completa. Amanhã alguém pede
 * `email`, `cracha`, `login`, `id_folha` — e cada um passa até que alguém
 * lembre de acrescentá-lo. O padrão certo é o inverso: **só passa o que está
 * na lista**, e ela tem cinco entradas que vieram da seção 7.2 do PRD.
 *
 * Um `breakdown` novo é decisão com consequência de privacidade, não um valor
 * de string que apareceu num prompt.
 *
 * ## Onde isto roda
 *
 * Antes do adaptador, sempre. O teste que acompanha este módulo prova que dez
 * formas de pedir grão individual **não chegam** a tocar a fonte de dados — o
 * que é diferente de a fonte devolver vazio. Uma consulta recusada na fronteira
 * não vira consulta ao banco, não vira linha de log com nome de pessoa e não
 * vira resposta parcial que alguém possa recompor.
 */

/**
 * Os cinco recortes que a seção 7.2 do PRD declara.
 *
 * Todos são agregados por construção: `area` e `centro_custo` agrupam pessoas,
 * `mes` agrupa tempo, `faixa` agrupa valor (etária, salarial, de tempo de
 * casa), e `none` é o total.
 */
export const BREAKDOWNS = [
  "none",
  "area",
  "mes",
  "centro_custo",
  "faixa",
] as const;

export type Breakdown = (typeof BREAKDOWNS)[number];

/** Por que uma consulta foi recusada na fronteira. Enum fechado. */
export const MOTIVOS_DE_GRAO = [
  "breakdown_fora_do_vocabulario",
  "pedido_de_linha_individual",
  "grupo_pequeno",
] as const;

export type MotivoDeGrao = (typeof MOTIVOS_DE_GRAO)[number];

export class GraoProibido extends Error {
  constructor(
    readonly motivo: MotivoDeGrao,
    readonly pedido: string,
  ) {
    super(
      `Grão recusado (${motivo}): '${pedido}'. ` +
        `O menor grão exposto é área × mês (PRD seção 11 e 7.5). ` +
        `Recortes aceitos: ${BREAKDOWNS.join(", ")}.`,
    );
    this.name = "GraoProibido";
  }
}

/**
 * O mínimo de pessoas num grupo antes de o valor poder aparecer.
 *
 * Seção 11: "faixas etárias, faixas salariais e faixas de tempo de casa nunca
 * descem a um grupo com menos de 5 pessoas". Abaixo disso o painel mostra
 * "grupo pequeno demais para exibir" — que é o motivo `grupo_pequeno` de
 * T-105, e não um zero.
 */
export const MINIMO_DE_PESSOAS_POR_GRUPO = 5;

/* ------------------------------------------------------------------ *
 * A validação
 * ------------------------------------------------------------------ */

/** O recorte pertence ao vocabulário fechado? */
export function breakdownValido(candidato: string): candidato is Breakdown {
  return (BREAKDOWNS as readonly string[]).includes(candidato);
}

/**
 * Aceita o recorte, ou lança.
 *
 * Lança em vez de devolver `none`: cair no total quando alguém pediu por
 * colaborador esconderia a tentativa. A recusa precisa ser visível, porque é
 * ela que vira linha de auditoria (seção 11).
 */
export function exigirGraoPermitido(candidato: string): Breakdown {
  if (candidato === "") {
    throw new GraoProibido("breakdown_fora_do_vocabulario", "(vazio)");
  }
  if (!breakdownValido(candidato)) {
    // O motivo distingue os dois casos porque a consequência é diferente:
    // vocabulário errado é bug de quem chamou; pedido de linha individual é
    // tentativa de acesso, e a trilha de auditoria trata as duas coisas de
    // formas diferentes.
    throw new GraoProibido(
      pareceLinhaIndividual(candidato)
        ? "pedido_de_linha_individual"
        : "breakdown_fora_do_vocabulario",
      candidato,
    );
  }
  return candidato;
}

/**
 * Reconhece um pedido de linha individual, **só para classificar o motivo**.
 *
 * Não é a defesa: a defesa é a lista fechada acima, que já recusou tudo que
 * chegou aqui. Esta função existe para que a trilha de auditoria distinga
 * "alguém digitou errado" de "alguém pediu o CPF" — a segunda merece olhar.
 *
 * Por isso ser incompleta não é falha: um termo novo que não esteja aqui
 * continua recusado, só que classificado como vocabulário errado.
 */
const TERMOS_DE_PESSOA = [
  "colaborador",
  "funcionario",
  "empregado",
  "pessoa",
  "cpf",
  "matricula",
  "nome",
  "email",
  "cracha",
  "login",
  "id",
  "individual",
];

function pareceLinhaIndividual(candidato: string): boolean {
  const normalizado = candidato
    .toLowerCase()
    .normalize("NFD")
    // Escape de propriedade, como url.ts e dimensoes.ts, e não a faixa com
    // caracteres combinantes literais no fonte: as duas funcionam, e esta não
    // depende de como o arquivo é lido.
    .replace(/\p{Diacritic}/gu, "");
  return TERMOS_DE_PESSOA.some((t) => normalizado.includes(t));
}

/**
 * O grupo é grande o bastante para exibir?
 *
 * Devolve `false` para grupo pequeno, e quem chama transforma isso no vazio
 * com motivo `grupo_pequeno` (T-105). Não lança: grupo pequeno é **estado
 * normal** de um recorte legítimo, não tentativa de acesso.
 */
export function grupoExibivel(quantidadeDePessoas: number): boolean {
  return quantidadeDePessoas >= MINIMO_DE_PESSOAS_POR_GRUPO;
}
