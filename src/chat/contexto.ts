/**
 * O que a pessoa está vendo quando pergunta: a tela, os filtros, o painel em
 * foco (D-CHAT-ferramentas, T-346).
 *
 * O chat sempre herdou os filtros da URL. O que faltava era o resto do
 * contexto: **qual** tela está aberta e **qual** painel a URL destaca. Sem
 * isso "o que esse gráfico mostra?" não tem resposta possível, e "e por
 * área?" não sabe de que métrica se fala quando a conversa está vazia.
 *
 * Tudo aqui é validado contra o inventário: tela fora das treze vira `null`,
 * painel fora do registro vira `null`. O modelo recebe rótulos, não códigos.
 */

import { acharTela } from "@/apresentacao/navegacao/telas";
import type { Query } from "@/semantica/contrato";
import { FILTROS, ROTULO_DO_FILTRO, rotuloDe } from "@/semantica/dimensoes";
import { painelPorId } from "@/semantica/paineis";
import { buscaParaQuery } from "@/semantica/url";

export type ContextoDaTela = {
  /** `modulo/tela`, ou `null` quando a pergunta não veio de uma tela. */
  readonly tela: string | null;
  readonly tituloDaTela: string | null;
  readonly filtros: Query;
  /** O painel que a URL destaca, quando ele existe e é desta tela. */
  readonly painelEmFoco: string | null;
  /** Os anos que a fonte tem. Vazio quando quem chama não sabe. */
  readonly anos: readonly string[];
};

/** Distingue o contexto de uma `Query` crua, nos pontos que aceitam os dois. */
export function ehContexto(x: Query | ContextoDaTela): x is ContextoDaTela {
  return "filtros" in x && "tela" in x;
}

/** Um contexto sem tela: só os filtros. É o que uma `Query` crua vira. */
export function contextoDeQuery(
  filtros: Query,
  anos: readonly string[] = [],
): ContextoDaTela {
  return { tela: null, tituloDaTela: null, filtros, painelEmFoco: null, anos };
}

/**
 * Monta o contexto a partir do que o navegador mandou.
 *
 * A busca é lida pelo **mesmo** leitor da página: filtro fora do vocabulário
 * cai no padrão, e o painel destacado sai do mesmo parâmetro que a tela usa.
 */
export function contextoDe(
  telaBruta: string | null | undefined,
  busca: string,
  anos: readonly string[],
): ContextoDaTela {
  const lida = buscaParaQuery(busca, anos.length === 0 ? undefined : anos);

  let tela: string | null = null;
  let tituloDaTela: string | null = null;
  if (telaBruta !== null && telaBruta !== undefined) {
    const [modulo = "", slug = ""] = telaBruta.replace(/^\//, "").split("/");
    const achada = acharTela(modulo, slug);
    if (achada !== undefined) {
      tela = `${achada.modulo.id}/${achada.tela.slug}`;
      tituloDaTela = `${achada.modulo.nome} · ${achada.tela.titulo}`;
    }
  }

  const painel =
    lida.painelDestacado === null
      ? undefined
      : painelPorId(lida.painelDestacado);
  const painelEmFoco =
    painel !== undefined && (tela === null || painel.tela === tela)
      ? painel.id
      : null;

  return { tela, tituloDaTela, filtros: lida.query, painelEmFoco, anos };
}

/** Os filtros como a pessoa os lê: "Período: Dezembro", "Área: Tecnologia". */
export function rotularFiltros(q: Query): Readonly<Record<string, string>> {
  const saida: Record<string, string> = {};
  for (const campo of FILTROS) {
    saida[ROTULO_DO_FILTRO[campo]] =
      campo === "ano" ? q.ano : rotuloDe(campo, q[campo]);
  }
  return saida;
}
