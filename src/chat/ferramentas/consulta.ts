/**
 * O resultado de uma consulta vira leitura, envelope e frase (T-451).
 *
 * A decisão de Produto foi explícita: o verificador de RF-15 **fica**, e o
 * resultado da consulta é que passa a ser o envelope. Este módulo é essa
 * passagem, e ela tem duas regras.
 *
 * ## A formatação é nossa
 *
 * O verificador compara **texto**. Se o modelo recebesse `4329.15` e
 * escrevesse "R$ 4.329,15", o texto dele não estaria na lista de permitidos e
 * toda resposta cairia. Então a célula chega ao modelo já escrita, pela
 * unidade que o dicionário de `amanna_chat` declara, e o modelo copia — que é
 * o que o estágio 3 sempre fez com `formatado`.
 *
 * Coluna sem unidade declarada sai como número puro, sem símbolo. Falha no
 * lado seguro: o verificador só examina número com unidade, e um "R$" que o
 * modelo puser por conta própria não está na lista e é barrado.
 *
 * ## O rótulo por perto
 *
 * Um resultado 1×1 é o caso agregado, igual a `ler_metrica`: o valor é livre.
 * Qualquer outro é uma tabela, e vale a regra que D-CHAT-ferramentas já fixou
 * para ponto de série e item de ranking — a célula só passa **com o rótulo da
 * linha por perto**. "Ana Silva custou R$ 24.500,00" passa; um `R$ 24.500,00`
 * solto três parágrafos depois, não.
 *
 * Nada é calculado aqui. Sem total de coluna, sem "os cinco juntos somam X":
 * seria um número que consulta nenhuma devolveu.
 */

import type { ResultadoDaConsulta } from "@/acesso/consulta";
import {
  formatarNumero,
  formatarReais,
  formatarValor,
} from "@/apresentacao/formato/formato";
import { variantesDoRotulo } from "@/chat/grafico";
import type {
  LeituraDeConsulta,
  LinhaDeConsulta,
  NumeroPermitido,
} from "@/chat/ferramentas/resultado";
import type { Unidade } from "@/semantica/contrato";

/**
 * A unidade de cada coluna, como o dicionário de `amanna_chat` a declara.
 *
 * Chega pronta de quem consultou: o dicionário é uma tabela semeada, e não uma
 * consulta a `information_schema` — a seção 7.4 exige prefixo de prompt
 * byte-estável, e o catálogo do Postgres não dá isso.
 */
export type UnidadeDeColuna = "reais" | Unidade | null;

/** Escreve uma célula pela unidade declarada da coluna. */
export function celulaFormatada(
  valor: unknown,
  unidade: UnidadeDeColuna,
): string | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor !== "number") return String(valor);
  if (unidade === "reais") return formatarReais(valor);
  if (unidade === null)
    return formatarNumero(valor, Number.isInteger(valor) ? 0 : 2);
  return formatarValor(valor, unidade);
}

/** A coluna que dá nome à linha: a primeira que não é número. */
function colunaDoRotulo(
  colunas: readonly string[],
  linhas: ResultadoDaConsulta["linhas"],
): string | null {
  const primeira = linhas[0];
  if (primeira === undefined) return null;
  return colunas.find((c) => typeof primeira[c] !== "number") ?? null;
}

/**
 * O resultado como leitura do laço.
 *
 * `unidades` mapeia coluna → unidade declarada; o que não estiver ali sai como
 * número puro.
 */
export function leituraDaConsulta(
  sql: string,
  resultado: ResultadoDaConsulta,
  unidades: Readonly<Record<string, UnidadeDeColuna>>,
  fontes: readonly string[],
  asOf: string,
): LeituraDeConsulta {
  const { colunas, linhas: brutas, truncado } = resultado;
  const doRotulo = colunaDoRotulo(colunas, brutas);

  const linhas: LinhaDeConsulta[] = brutas.map((bruta) => ({
    rotulo:
      doRotulo === null ? "" : (celulaFormatada(bruta[doRotulo], null) ?? ""),
    celulas: colunas.map((c) => celulaFormatada(bruta[c], unidades[c] ?? null)),
  }));

  return {
    tipo: "consulta",
    sql,
    colunas: colunas.map((nome) => ({
      nome,
      papel: nome === doRotulo ? "rotulo" : "numero",
      unidade: unidades[nome] ?? null,
    })),
    linhas,
    truncado,
    fontes,
    asOf,
  };
}

/**
 * Os números que o texto pode citar por causa desta leitura.
 *
 * Um resultado 1×1 é livre. Qualquer outro exige o rótulo da linha por perto,
 * e o nome da coluna também serve — "custo total de Ana Silva: R$ 24.500,00"
 * e "Ana Silva, R$ 24.500,00" passam as duas.
 */
export function numerosDaConsulta(
  l: LeituraDeConsulta,
): readonly NumeroPermitido[] {
  const unica = l.linhas.length === 1 && l.colunas.length === 1 && !l.truncado;

  const permitidos: NumeroPermitido[] = [];
  for (const linha of l.linhas) {
    for (const [i, celula] of linha.celulas.entries()) {
      if (celula === null) continue;
      const coluna = l.colunas[i];
      if (coluna?.papel === "rotulo") continue;
      if (unica) {
        permitidos.push({ texto: celula, rotulos: null });
        continue;
      }
      permitidos.push({
        texto: celula,
        rotulos: [
          ...variantesDoRotulo(linha.rotulo),
          ...variantesDoRotulo(coluna?.nome ?? ""),
        ],
      });
    }
  }
  return permitidos;
}

/** O texto montado desta leitura, quando o verificador recusa o do modelo. */
export function fraseDaConsulta(l: LeituraDeConsulta): string {
  if (l.linhas.length === 0) return "A consulta não devolveu linha nenhuma.";
  const numericas = l.colunas.filter((c) => c.papel === "numero");
  const itens = l.linhas.map((linha) => {
    const valores = numericas
      .map((c) => linha.celulas[l.colunas.indexOf(c)] ?? "sem dado")
      .join(" · ");
    return linha.rotulo === "" ? valores : `${linha.rotulo}: ${valores}`;
  });
  const corte = l.truncado ? " Lista cortada." : "";
  return `Consulta ao banco — ${itens.join("; ")}.${corte}`;
}
