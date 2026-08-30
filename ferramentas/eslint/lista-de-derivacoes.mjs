/**
 * As derivações que a apresentação pode fazer (T-134).
 *
 * A regra `painel/sem-derivacao-exibida` proíbe conta em argumento de
 * formatador: o número que a pessoa lê vem de `getKpis`, `getPanel` ou
 * `getMetric`, e não de uma multiplicação na tela (achado 3 do Anexo D).
 *
 * Duas exceções existem, e existem porque o **envelope guarda os operandos e
 * não o resultado** — de propósito. Guardar o resultado criaria dois números
 * para a mesma coisa, que é exatamente o que o princípio PR-1 impede.
 *
 * ## Por que a liberação é por nome de função
 *
 * Liberar por arquivo abriria o arquivo inteiro: `DesenhoDePainel.tsx` trata as
 * doze formas, e uma dispensa no topo dele valeria para todas. Por nome, a
 * dispensa alcança uma função e para ali. Uma terceira derivação precisa de
 * função nova, nome novo e uma linha aqui — e isso aparece no diff.
 *
 * ## Como crescer
 *
 * Só cresce quando o envelope **não puder** trazer o número pronto. Se o valor
 * couber no envelope, ele vai para o envelope: derivar na tela é a última
 * opção, não a primeira.
 */

/** @type {readonly { funcao: string, motivo: string }[]} */
export const DERIVACOES = [
  {
    funcao: "conversaoDoPasso",
    motivo:
      "A conversão entre passos do funil é derivada por decisão de contrato: " +
      "`PainelFunil` guarda o valor de cada passo e não a razão entre eles, " +
      "porque a razão é dedutível e guardá-la criaria uma segunda verdade que " +
      "sairia de sincronia com os valores. O envelope tem os dois operandos; a " +
      "apresentação faz a divisão e formata.",
  },
  {
    funcao: "duracaoDaFaixa",
    motivo:
      "A duração de uma faixa da régua de ciclo é `ate - de`. " +
      "`PainelReguaDeCiclo` declara os dois marcos porque é a posição deles na " +
      "régua que o painel desenha; a duração é a distância entre eles, e " +
      "guardá-la como terceira coluna deixaria três números onde dois bastam — " +
      "e um deles poderia discordar dos outros dois.",
  },
];
