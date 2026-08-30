/**
 * O rótulo de uma categoria de painel (T-164).
 *
 * As séries do envelope vêm com o **código** da categoria, não com o rótulo:
 * `operacoes`, `menos-de-1-ano`, `2026-03`. É a decisão de T-186 — o código é
 * ASCII, minúsculo e com hífen, e o rótulo acentuado é da apresentação. Para os
 * cinco filtros o rótulo já existe em `dimensoes.ts`; para o resto, não existe
 * ainda, e este módulo é onde a falta fica visível em vez de virar
 * `menos-de-1-ano` escrito no eixo de um painel.
 *
 * ## O que é traduzido, e o que é derivado
 *
 * **Traduzido** — área, modalidade, entidade e período têm rótulo declarado, e
 * é ele que aparece: `operacoes` vira "Operações", com acento.
 *
 * **Derivado** — faixa etária, escolaridade, tempo de casa, gênero e faixa
 * salarial **não têm tabela de rótulos em lugar nenhum do código**. As fixtures
 * de `referencia-perfil.ts` guardam só `codigo` e `headcount`. Enquanto essa
 * tabela não existir, o rótulo é derivado do próprio código, e a derivação é
 * mecânica de propósito: "Menos de 1 ano" é uma leitura do código, não um nome
 * novo que alguém escolheu. Um nome escolhido aqui viraria a segunda fonte da
 * verdade que a seção 9.4 do PRD existe para impedir.
 *
 * A tabela de verdade é decisão de Produto, do mesmo tamanho que a de T-186 foi
 * para os filtros. Até ela existir, o que se lê na tela é fiel ao que o dado
 * diz — e é isso que faz a falta aparecer para quem olha, em vez de ficar
 * escondida atrás de um rótulo inventado.
 *
 * **Datas** — categoria mensal (`2026-03`) e diária (`2026-11-20`) são
 * formatadas pelo módulo de T-125, e não aqui: fuso e nome de mês têm um dono
 * só.
 */

import { formatarMesAno } from "@/apresentacao/formato/formato";
import { DIMENSOES, rotuloDe } from "@/semantica/dimensoes";
import type { NomeDeDimensao } from "@/semantica/dimensoes";

/** Um mês fechado: `2026-03`. */
const MES = /^\d{4}-\d{2}$/;

/** Um dia fechado: `2026-11-20`. */
const DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Um código no formato de T-186: minúsculo, ASCII, com hífen. */
const CODIGO = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** O travessão de intervalo, que substitui o hífen entre dois números. */
const INTERVALO = "–";

/** As dimensões que têm rótulo declarado, na ordem em que são consultadas. */
const COM_ROTULO: readonly NomeDeDimensao[] = Object.keys(
  DIMENSOES,
) as readonly NomeDeDimensao[];

/**
 * O rótulo de uma categoria, para eixo, linha de ranking ou legenda.
 *
 * Devolve o texto como veio quando já é texto de gente — "Cliente A",
 * "Matéria-prima", "SP". Só código no formato de T-186 é traduzido ou
 * derivado, e é isso que impede a função de mexer no que já estava certo.
 */
export function rotuloDeCategoria(codigo: string): string {
  const dia = DIA.exec(codigo);
  if (dia?.[2] !== undefined && dia[3] !== undefined) {
    return `${dia[3]}/${dia[2]}`;
  }
  if (MES.test(codigo)) return formatarMesAno(codigo);

  if (!CODIGO.test(codigo)) return codigo;

  for (const dimensao of COM_ROTULO) {
    const rotulo = rotuloDe(dimensao, codigo);
    if (rotulo !== codigo) return rotulo;
  }

  return humanizar(codigo);
}

/**
 * `menos-de-1-ano` vira `Menos de 1 ano`; `61-90d` vira `61–90d`.
 *
 * Mecânico e sem tabela: o hífen vira espaço, e sobe a primeira letra. Não
 * repõe acento, e não deveria — repor exigiria saber a palavra, e saber a
 * palavra é ter a tabela que ainda não existe.
 *
 * A exceção é o hífen **entre dois números**, que não separa palavras: é um
 * intervalo. `61-90d` virando "61 90d" descaracteriza a faixa de aging tanto
 * quanto `18-24` virando "18 24" descaracterizaria a faixa etária. Ali o hífen
 * vira travessão, que é como pt-BR escreve intervalo.
 */
function humanizar(codigo: string): string {
  const partes = codigo.split("-");
  let texto = partes[0] ?? "";
  for (let i = 1; i < partes.length; i += 1) {
    const parte = partes[i] ?? "";
    const entreNumeros = /\d$/.test(texto) && /^\d/.test(parte);
    texto += (entreNumeros ? INTERVALO : " ") + parte;
  }
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
