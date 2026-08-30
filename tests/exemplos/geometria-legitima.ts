/**
 * O contraexemplo de T-134: este arquivo **precisa passar** o lint.
 *
 * Uma regra que proíbe tudo é desligada na primeira semana. A apresentação
 * calcula o tempo inteiro — largura de barra, posição de ponto, altura de
 * degrau — e nada disso é o número que a pessoa lê. O que a regra persegue é
 * conta que vira **texto**, e este arquivo mostra a fronteira.
 */

declare function formatarValor(v: number, unidade: string): string;

declare const lido: { readonly total: number; readonly maximo: number };

const PERCENTUAL_CHEIO = 100;

// Geometria: a conta vira largura de CSS, não número na tela.
export const largura = `${String((lido.total / lido.maximo) * PERCENTUAL_CHEIO)}%`;

// O valor lido chega ao formatador inteiro, como veio da fonte.
export const exibido = formatarValor(lido.total, "BRL_mi");

// Escolher entre dois valores lidos não é derivar nenhum deles.
export const maiorDeles = formatarValor(
  lido.total > lido.maximo ? lido.total : lido.maximo,
  "BRL_mi",
);

// Inverter o sinal não cria número novo: é o mesmo valor do outro lado do zero.
export const invertido = formatarValor(-lido.total, "BRL_mi");
