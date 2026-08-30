/**
 * As curvas que fazem a fatia de uma dimensão variar ao longo do ano (T-140.2).
 *
 * ## Por que um dataset sem sazonalidade não exercita o produto
 *
 * Até aqui a folha se repartia entre as entidades por uma constante: Unidade SP
 * ficava com 0,6800 em janeiro e 0,6800 em dezembro. `repartirMatriz` distribui
 * o interior por independência — `célula = linha × coluna / total` — e essa é a
 * solução proporcional.
 *
 * Proporcional é exatamente o que **não** distingue recortar de escalar. Somar
 * seis meses da Unidade SP e multiplicar o consolidado de seis meses por 0,68
 * dão o mesmo número, então a suíte de contrato não tem como notar a diferença
 * entre um adaptador que filtra e um que multiplica — que é o achado 3 do
 * Anexo D, e o controle negativo de T-140 media exatamente esse ponto cego.
 *
 * Com curva, os dois deixam de coincidir: a fatia de um recorte de seis meses
 * não é a fatia do ano, e só quem soma as linhas certas acerta.
 *
 * ## O que estas curvas são, e o que não são
 *
 * São **forma relativa**, não valor. A repartição de T-140.2 encontra a matriz
 * mais próxima do perfil que ainda fecha as duas margens, então o total de cada
 * mês e o total de cada célula no ano continuam exatamente os de antes. Uma
 * curva mais inclinada muda como o mês se reparte por dentro, e nunca quanto o
 * mês vale.
 *
 * Por isso os números aqui não precisam somar nem valer nada: só as razões
 * entre eles importam.
 *
 * ## As três leituras de negócio
 *
 * Nenhuma é aleatória. Um dataset com ruído sem sentido é tão ruim quanto um
 * dataset plano: ele não sustenta a narrativa da seção 4 do Anexo C, e alguém
 * olhando o painel encontraria um pico que não explica nada.
 */

import { mesesDe } from "@/acesso/fixtures/eixos";

/**
 * Doze pontos, um por mês, de janeiro a dezembro, **em milésimos**.
 *
 * Inteiro, e não fração, e a razão não é estilo. A camada de dados tem um
 * guarda que proíbe fração literal, e o motivo dele é exatamente o achado 3:
 * *"um fator de escala é, por natureza, uma fração"*. Escrever `0.95` aqui
 * pediria dispensa desse guarda, e dispensa é o começo de um `0.62` voltar.
 *
 * Não é contorno, é a forma certa: estes números **são** pesos relativos, e o
 * ajuste de T-140.2 normaliza a escala deles de qualquer jeito. Dobrar todos os
 * valores da curva não muda uma célula sequer da saída. Milésimo é só a unidade
 * em que a razão fica legível — 950 para 1080 é a mesma curva que 0,95 para
 * 1,08, e não se parece com um fator de escala porque não é um.
 */
export type Curva = readonly number[];

/** O ponto neutro, em milésimos: a dimensão não tem inclinação naquela medida. */
const NEUTRO = 1000;
const PLANA: Curva = mesesDe("2026").map(() => NEUTRO);

/**
 * A folha, por entidade.
 *
 * A Unidade SP paga mais por cabeça — é a tensão que o Anexo C conta, unidade
 * cara e não mais produtiva. A participação dela na folha **cresce no fim do
 * ano**, quando entram décimo terceiro e variável: os dois são proporcionais ao
 * salário, então concentram-se onde o salário é maior.
 *
 * De 950 em janeiro a 1080 em dezembro (milésimos), com o degrau em novembro — que é
 * quando a primeira parcela do décimo terceiro é paga.
 */
export const FOLHA_POR_ENTIDADE: Readonly<Record<string, Curva>> = {
  "unidade-sp": [
    950, 950, 960, 960, 970, 980, 990, 1000, 1010, 1020, 1060, 1080,
  ],
  "demais-unidades": PLANA,
};

/**
 * A folha, por área.
 *
 * O ciclo de revisão salarial da empresa é em julho, e Tecnologia é onde ele
 * pesa: é a área com maior salário médio e maior pressão de mercado. A fatia
 * dela na folha sobe no segundo semestre e não volta.
 *
 * Comercial anda ao contrário no primeiro semestre, porque a parte variável da
 * remuneração dela segue o faturamento — que no dataset cresce ao longo do ano.
 */
export const FOLHA_POR_AREA: Readonly<Record<string, Curva>> = {
  tecnologia: [
    940, 940, 950, 950, 960, 970, 1040, 1050, 1050, 1060, 1060, 1070,
  ],
  comercial: [
    960, 960, 970, 980, 990, 1000, 1010, 1020, 1020, 1030, 1040, 1050,
  ],
};

/**
 * A folha, por modalidade.
 *
 * O trabalho remoto cresce ao longo do ano — é política de quadro, e o dataset
 * a reflete: quem entra no segundo semestre entra remoto com mais frequência.
 * Como a folha acompanha o quadro, a fatia do remoto sobe junto.
 *
 * Presencial é o espelho. Híbrido fica plano de propósito: sem uma dimensão
 * neutra, toda leitura teria inclinação e não daria para distinguir a curva do
 * ruído de arredondamento.
 */
export const FOLHA_POR_MODALIDADE: Readonly<Record<string, Curva>> = {
  remoto: [920, 930, 950, 970, 990, 1000, 1020, 1040, 1050, 1070, 1080, 1100],
  presencial: [
    1040, 1030, 1020, 1010, 1000, 1000, 990, 980, 980, 970, 960, 950,
  ],
  hibrido: PLANA,
};

/**
 * A admissão, por modalidade.
 *
 * A mesma política de trabalho da curva acima, vista na porta de entrada — e
 * mais inclinada, porque contratação muda antes do quadro. Quem já está na
 * empresa continua no arranjo que tinha; quem entra no segundo semestre entra
 * remoto com muito mais frequência.
 *
 * É esta curva que faz a **modalidade do quadro** deixar de ser constante. O
 * quadro é acumulado — saldo de abertura mais admissões menos desligamentos —
 * então inclinar quem entra desloca a composição mês a mês, sem mexer no
 * headcount de dezembro: o total de admissões de cada célula no ano continua
 * exato, e dezembro é o saldo de abertura mais esse total.
 */
export const ADMISSAO_POR_MODALIDADE: Readonly<Record<string, Curva>> = {
  remoto: [700, 760, 820, 880, 940, 1000, 1080, 1150, 1210, 1270, 1320, 1380],
  presencial: [
    1260, 1220, 1180, 1130, 1090, 1040, 990, 950, 900, 860, 820, 780,
  ],
  hibrido: PLANA,
};

/** O valor da curva no mês, ou 1 quando a dimensão não tem curva declarada. */
export function noMes(
  curvas: Readonly<Record<string, Curva>>,
  valor: string,
  mes: number,
): number {
  return curvas[valor]?.[mes] ?? NEUTRO;
}
