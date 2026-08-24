/**
 * As dimensões `vw_dim_*` da seção 10.1 (T-147).
 *
 * São **cadastros**: a lista de valores que cada dimensão pode assumir, com o
 * código estável que atravessa URL e chave de cache e o rótulo que a pessoa lê.
 * Quantas pessoas estão em cada valor é fato, e mora nas views de fato.
 *
 * ## A regra que governa este arquivo
 *
 * Seção 11: *"o menor grão exposto é área × mês"* e *"nenhuma superfície do
 * produto expõe linha individual de pessoa"*. Uma dimensão é justamente onde
 * essa promessa se perde sem alarde — basta alguém acrescentar `matricula` ou
 * `data_de_nascimento` a uma tabela de cadastro e a linha individual entra pela
 * porta dos fundos, parecendo dimensão.
 *
 * Por isso cada tabela declara um **conjunto fechado de atributos**, e um teste
 * de esquema reprova qualquer campo fora dele. O teste também reprova tabela
 * grande demais: dimensão com centenas de linhas é lista de pessoas com outro
 * nome, e a maior aqui tem doze.
 *
 * ## As faixas são dimensão, não cálculo
 *
 * `18–24`, `3–6k`, `1–3 anos` são valores de cadastro com limites declarados —
 * e não intervalos que alguém recalcula em cada painel. Guardar os limites aqui
 * é o que permite a T-151 aplicar a supressão da seção 11 (*"nunca descem a um
 * grupo com menos de 5 pessoas"*) sem adivinhar onde uma faixa começa.
 *
 * ## O que a seção 10.1 não lista, e dois painéis pedem
 *
 * A 10.1 nomeia oito dimensões, e **gênero não está entre elas** — mas
 * `col-perfil` ("Perfil do quadro") e `tov-corte` ("Turnover por gênero e faixa
 * etária") precisam dela. Estender a 10.1 é o entregável de **T-143**, e a
 * dimensão de gênero entra lá, junto das medidas ausentes. Aqui ficaria fora de
 * escopo — e fora do aceite, que enumera as oito.
 *
 * Faixa salarial **está** dentro: a seção 11 a nomeia junto de faixa etária e
 * tempo de casa como as três bandas de dado de pessoa que precisam da supressão.
 */

import {
  AREAS_ARMAZENADAS,
  ENTIDADES_ARMAZENADAS,
  MODALIDADES_ARMAZENADAS,
  mesesDe,
} from "@/acesso/fixtures/eixos";
import { CENTROS_DE_CUSTO } from "@/acesso/fixtures/referencia-fin";
import { rotuloDe } from "@/semantica/dimensoes";

/**
 * O que toda linha de dimensão tem, e nada além disso sem declarar.
 *
 * `ordem` é a sequência natural do valor — de idade, de escolaridade, de faixa
 * salarial. Painel que ordena por volume, como as barras horizontais de
 * `col-escol`, faz isso na hora de desenhar; o cadastro guarda o significado,
 * não a aparência.
 */
export type LinhaDeDimensao = {
  readonly codigo: string;
  readonly rotulo: string;
  readonly ordem: number;
};

/** Uma faixa: os limites que a definem, e o que "sem limite" significa. */
export type FaixaDeDimensao = LinhaDeDimensao & {
  /** Limite inferior, inclusivo. */
  readonly de: number;
  /** Limite superior, inclusivo. `null` é "sem teto" — a última faixa. */
  readonly ate: number | null;
};

/* ------------------------------------------------------------------ *
 * As dimensões que já têm vocabulário
 * ------------------------------------------------------------------ */

/**
 * Entidade, área e modalidade saem do registro de T-186, sem o agregado.
 *
 * Não são redigitadas: `consolidado` e `todas` são recorte, não valor, e por
 * isso não entram no cadastro. Uma área nova no vocabulário aparece aqui
 * sozinha.
 */
function daLista(
  codigos: readonly string[],
  dimensao: "entidade" | "area" | "modalidade",
) {
  return codigos.map((codigo, ordem) => ({
    codigo,
    rotulo: rotuloDe(dimensao, codigo),
    ordem,
  }));
}

export const VW_DIM_ENTIDADE: readonly LinhaDeDimensao[] = daLista(
  ENTIDADES_ARMAZENADAS,
  "entidade",
);

export const VW_DIM_AREA: readonly LinhaDeDimensao[] = daLista(
  AREAS_ARMAZENADAS,
  "area",
);

export const VW_DIM_MODALIDADE: readonly LinhaDeDimensao[] = daLista(
  MODALIDADES_ARMAZENADAS,
  "modalidade",
);

/** Os oito centros de custo, do registro de T-111. Sete têm nome de área; o oitavo é Corporativo. */
export const VW_DIM_CENTRO_CUSTO: readonly LinhaDeDimensao[] =
  CENTROS_DE_CUSTO.map((c, ordem) => ({
    codigo: c.codigo,
    rotulo: c.rotulo,
    ordem,
  }));

/* ------------------------------------------------------------------ *
 * Mês
 * ------------------------------------------------------------------ */

/** Um mês de competência, com o trimestre a que pertence. */
export type LinhaDeMes = LinhaDeDimensao & {
  readonly ano: string;
  /** 1 a 12. */
  readonly numero: number;
  /** 1 a 4. É o que faz `4º trimestre` ser recorte e não uma janela mágica. */
  readonly trimestre: number;
};

const ROTULO_DO_MES = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const;

const MESES_POR_TRIMESTRE = 3;

export function vwDimMes(ano: string): readonly LinhaDeMes[] {
  return mesesDe(ano).map((codigo, i) => ({
    codigo,
    rotulo: ROTULO_DO_MES[i] ?? codigo,
    ordem: i,
    ano,
    numero: i + 1,
    trimestre: Math.floor(i / MESES_POR_TRIMESTRE) + 1,
  }));
}

/* ------------------------------------------------------------------ *
 * UF
 * ------------------------------------------------------------------ */

/** Uma unidade federativa onde a empresa opera. */
export type LinhaDeUf = LinhaDeDimensao & {
  readonly regiao: string;
};

/**
 * As **doze** UFs do Anexo C, e não as 27 do país.
 *
 * A dimensão é o cadastro de onde a empresa opera; o mosaico geográfico desenha
 * as 27 células e marca as ausentes com travessão, e essa grade de 27 posições é
 * geometria do painel — entra com T-165, não aqui. Confundir as duas faria a
 * dimensão dizer que existem operações em 27 estados.
 */
export const VW_DIM_UF: readonly LinhaDeUf[] = [
  { codigo: "SP", rotulo: "São Paulo", ordem: 0, regiao: "Sudeste" },
  { codigo: "MG", rotulo: "Minas Gerais", ordem: 1, regiao: "Sudeste" },
  { codigo: "PR", rotulo: "Paraná", ordem: 2, regiao: "Sul" },
  { codigo: "RJ", rotulo: "Rio de Janeiro", ordem: 3, regiao: "Sudeste" },
  { codigo: "SC", rotulo: "Santa Catarina", ordem: 4, regiao: "Sul" },
  { codigo: "RS", rotulo: "Rio Grande do Sul", ordem: 5, regiao: "Sul" },
  { codigo: "BA", rotulo: "Bahia", ordem: 6, regiao: "Nordeste" },
  { codigo: "PE", rotulo: "Pernambuco", ordem: 7, regiao: "Nordeste" },
  { codigo: "GO", rotulo: "Goiás", ordem: 8, regiao: "Centro-Oeste" },
  { codigo: "CE", rotulo: "Ceará", ordem: 9, regiao: "Nordeste" },
  { codigo: "ES", rotulo: "Espírito Santo", ordem: 10, regiao: "Sudeste" },
  {
    codigo: "DF",
    rotulo: "Distrito Federal",
    ordem: 11,
    regiao: "Centro-Oeste",
  },
];

/* ------------------------------------------------------------------ *
 * As três faixas da seção 11
 * ------------------------------------------------------------------ */

/**
 * Faixa etária. Começa em 18 porque abaixo disso não há contratação.
 *
 * A última não tem teto: `ate: null` significa "55 ou mais", e não "55 a algum
 * número que ninguém escreveu". Um teto inventado apareceria como pessoa fora
 * de qualquer faixa no dia em que alguém passasse dele.
 */
export const VW_DIM_FAIXA_ETARIA: readonly FaixaDeDimensao[] = [
  { codigo: "18-24", rotulo: "18–24", ordem: 0, de: 18, ate: 24 },
  { codigo: "25-34", rotulo: "25–34", ordem: 1, de: 25, ate: 34 },
  { codigo: "35-44", rotulo: "35–44", ordem: 2, de: 35, ate: 44 },
  { codigo: "45-54", rotulo: "45–54", ordem: 3, de: 45, ate: 54 },
  { codigo: "55-mais", rotulo: "55+", ordem: 4, de: 55, ate: null },
];

/** Faixa de tempo de casa, em anos completos. */
export const VW_DIM_TEMPO_DE_CASA: readonly FaixaDeDimensao[] = [
  { codigo: "menos-de-1-ano", rotulo: "< 1 ano", ordem: 0, de: 0, ate: 0 },
  { codigo: "1-3-anos", rotulo: "1–3 anos", ordem: 1, de: 1, ate: 3 },
  { codigo: "3-5-anos", rotulo: "3–5 anos", ordem: 2, de: 3, ate: 5 },
  { codigo: "5-10-anos", rotulo: "5–10 anos", ordem: 3, de: 5, ate: 10 },
  { codigo: "10-mais-anos", rotulo: "10+ anos", ordem: 4, de: 10, ate: null },
];

/**
 * Faixa salarial, em reais mensais.
 *
 * Os limites são de **faixa**, não de pessoa: `de` e `ate` descrevem a banda, e
 * nenhuma linha aqui diz quanto alguém ganha. É a distinção que faz esta tabela
 * ser cadastro e não folha de pagamento.
 */
const MIL = 1000;

export const VW_DIM_FAIXA_SALARIAL: readonly FaixaDeDimensao[] = [
  { codigo: "ate-3k", rotulo: "≤ 3k", ordem: 0, de: 0, ate: 3 * MIL },
  { codigo: "3-6k", rotulo: "3–6k", ordem: 1, de: 3 * MIL, ate: 6 * MIL },
  { codigo: "6-10k", rotulo: "6–10k", ordem: 2, de: 6 * MIL, ate: 10 * MIL },
  { codigo: "10-18k", rotulo: "10–18k", ordem: 3, de: 10 * MIL, ate: 18 * MIL },
  { codigo: "18-30k", rotulo: "18–30k", ordem: 4, de: 18 * MIL, ate: 30 * MIL },
  { codigo: "acima-30k", rotulo: "> 30k", ordem: 5, de: 30 * MIL, ate: null },
];

/* ------------------------------------------------------------------ *
 * Gênero (T-118.1)
 * ------------------------------------------------------------------ *
 *
 * Entra como cadastro porque virou dimensão do quadro — a intenção 19 do
 * Anexo B a pede, e `col-perfil` e `tov-corte` a mostram.
 *
 * "Outro / não informado" é uma linha só, e não deveria ser: quem se declarou e
 * quem não foi perguntado são casos diferentes, e o segundo é sinal de cadastro
 * incompleto. A separação é **H-55**.
 */

export const VW_DIM_GENERO: readonly LinhaDeDimensao[] = [
  { codigo: "masculino", rotulo: "Masculino", ordem: 0 },
  { codigo: "feminino", rotulo: "Feminino", ordem: 1 },
  {
    codigo: "outro-ou-nao-informado",
    rotulo: "Outro / não informado",
    ordem: 2,
  },
];

/* ------------------------------------------------------------------ *
 * Cargo (T-118.1)
 * ------------------------------------------------------------------ *
 *
 * A política de remuneração, e não a folha. `de` e `ate` são os limites da
 * **banda** do cargo; nenhuma linha aqui diz quanto alguém ganha, que é a mesma
 * distinção que faz `vw_dim_faixa_salarial` ser cadastro.
 *
 * A área aparece no rótulo e não em coluna: o conjunto de atributos de dimensão
 * é fechado de propósito (T-147), e alargá-lo para caber um caso seria trocar
 * uma garantia por uma conveniência. O painel `sal-resumo` mostra o rótulo tal
 * como está.
 *
 * **Cuidado que fica registrado:** um cargo com uma pessoa só transforma o
 * limite da banda no salário dela. A supressão de grupo pequeno da seção 11
 * vale aqui, e quem a implementa é T-151.
 */

export const VW_DIM_CARGO: readonly FaixaDeDimensao[] = [
  {
    codigo: "auxiliar-operacional",
    rotulo: "Auxiliar operacional · Operações",
    ordem: 0,
    de: 2.1 * MIL,
    ate: 3.4 * MIL,
  },
  {
    codigo: "analista-junior",
    rotulo: "Analista júnior · Corporativo",
    ordem: 1,
    de: 3.6 * MIL,
    ate: 6.2 * MIL,
  },
  {
    codigo: "analista-pleno",
    rotulo: "Analista pleno · Corporativo",
    ordem: 2,
    de: 6.4 * MIL,
    ate: 10.8 * MIL,
  },
  {
    codigo: "especialista",
    rotulo: "Especialista · Tecnologia",
    ordem: 3,
    de: 11.2 * MIL,
    ate: 18.6 * MIL,
  },
  {
    codigo: "coordenacao",
    rotulo: "Coordenação · Operações",
    ordem: 4,
    de: 14.8 * MIL,
    ate: 22.4 * MIL,
  },
  {
    codigo: "gerencia-senior",
    rotulo: "Gerência sênior · Tecnologia",
    ordem: 5,
    de: 19.6 * MIL,
    ate: 28.4 * MIL,
  },
];

/* ------------------------------------------------------------------ *
 * Escolaridade
 * ------------------------------------------------------------------ */

/**
 * Escolaridade, na ordem **do nível** e não do volume.
 *
 * O protótipo lista Superior primeiro porque é a maior barra, e barra
 * horizontal se ordena por valor na hora de desenhar. O cadastro guarda o
 * significado: médio vem antes de técnico, que vem antes de superior.
 */
export const VW_DIM_ESCOLARIDADE: readonly LinhaDeDimensao[] = [
  { codigo: "medio", rotulo: "Médio", ordem: 0 },
  { codigo: "tecnico", rotulo: "Técnico", ordem: 1 },
  { codigo: "superior", rotulo: "Superior", ordem: 2 },
  { codigo: "pos-graduacao", rotulo: "Pós-graduação", ordem: 3 },
  { codigo: "mestrado-mais", rotulo: "Mestrado+", ordem: 4 },
];

/* ------------------------------------------------------------------ *
 * O catálogo das dimensões
 * ------------------------------------------------------------------ */

/**
 * As oito dimensões da seção 10.1, mais mês e faixa salarial, por nome.
 *
 * O mapa existe para que o teste de esquema percorra **todas** sem que ninguém
 * precise lembrar de acrescentar a nova à lista de conferência. Uma dimensão
 * que não estivesse aqui escaparia da varredura, que é o único jeito de a
 * garantia da seção 11 falhar em silêncio.
 */
export const VW_DIM = {
  vw_dim_entidade: VW_DIM_ENTIDADE,
  vw_dim_area: VW_DIM_AREA,
  vw_dim_centro_custo: VW_DIM_CENTRO_CUSTO,
  vw_dim_modalidade: VW_DIM_MODALIDADE,
  vw_dim_uf: VW_DIM_UF,
  vw_dim_faixa_etaria: VW_DIM_FAIXA_ETARIA,
  vw_dim_tempo_de_casa: VW_DIM_TEMPO_DE_CASA,
  vw_dim_escolaridade: VW_DIM_ESCOLARIDADE,
  vw_dim_faixa_salarial: VW_DIM_FAIXA_SALARIAL,
  vw_dim_genero: VW_DIM_GENERO,
  vw_dim_cargo: VW_DIM_CARGO,
  vw_dim_mes: vwDimMes("2026"),
} as const;

export type NomeDeDimensaoFisica = keyof typeof VW_DIM;

/**
 * Os atributos que uma linha de dimensão pode ter. Conjunto fechado.
 *
 * Qualquer campo fora daqui reprova o teste de esquema. É a forma executável da
 * seção 11: a lista curta é o que impede `matricula`, `nome` ou
 * `data_de_nascimento` de entrarem parecendo cadastro.
 */
export const ATRIBUTOS_PERMITIDOS: readonly string[] = [
  "codigo",
  "rotulo",
  "ordem",
  "de",
  "ate",
  "regiao",
  "ano",
  "numero",
  "trimestre",
];
