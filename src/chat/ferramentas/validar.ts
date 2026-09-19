/**
 * O validador de chamadas: nada do modelo toca uma porta sem passar aqui.
 *
 * O esquema JSON já restringe o que o modelo consegue pedir; este módulo é a
 * segunda conferência, a que **nós** fazemos, e a única em que confiamos. Um
 * gateway pode ignorar `strict`, um modelo pode mandar texto onde se pedia
 * objeto, e "metrica" pode chegar como um id que existia ontem. Tudo isso é
 * recusado com uma mensagem que o modelo consegue usar — as métricas próximas,
 * o que faltou — em vez de uma exceção que derruba a pergunta.
 *
 * Puro: não lê dado, não conhece portas. O teste prova com um espião que uma
 * chamada recusada não chega a leitura nenhuma.
 */

import type { ContextoDaTela } from "@/chat/contexto";
import {
  nomeDeFerramentaValido,
  type NomeDeFerramenta,
} from "@/chat/ferramentas/catalogo";
import {
  MAXIMO_DE_METRICAS_NA_COMPARACAO,
  MINIMO_DE_METRICAS_NA_COMPARACAO,
  TOP_N_MAXIMO,
  TOP_N_PADRAO,
} from "@/chat/ferramentas/limites";
import type { MesPedido } from "@/chat/mes";
import { proximasDe } from "@/chat/resolver";
import type { Chamada } from "@/gateway/openrouter";
import { CATALOGO_GERADO } from "@/semantica/catalogo-gerado";
import {
  dimensaoDeRankingValida,
  type DimensaoDeRanking,
  type Query,
} from "@/semantica/contrato";
import { codigosDe, FILTROS, type NomeDeFiltro } from "@/semantica/dimensoes";
import { painelPorId } from "@/semantica/paineis";

/** O que sai do validador: um pedido tipado, pronto para a porta certa. */
export type PedidoValidado =
  | {
      readonly nome: "ler_metrica";
      readonly metrica: string;
      readonly mes: MesPedido | null;
      readonly filtros: Query;
    }
  | {
      readonly nome: "serie_da_metrica";
      readonly metrica: string;
      readonly mes: MesPedido | null;
      readonly filtros: Query;
    }
  | {
      readonly nome: "comparar_metricas";
      readonly metricas: readonly string[];
      readonly filtros: Query;
    }
  | {
      readonly nome: "variacao";
      readonly metrica: string;
      readonly contra: "ano_anterior";
      readonly filtros: Query;
    }
  | {
      readonly nome: "ranking";
      readonly metrica: string;
      readonly dimensao: DimensaoDeRanking;
      readonly limite: number;
      readonly ordem: "maior" | "menor";
      readonly filtros: Query;
    }
  | {
      readonly nome: "decompor";
      readonly metrica: string;
      readonly dimensao: DimensaoDeRanking;
      readonly filtros: Query;
    }
  | { readonly nome: "consultar_dados"; readonly consulta: string }
  | {
      readonly nome: "explicar_grafico";
      readonly painel: string;
      readonly filtros: Query;
    }
  | { readonly nome: "listar_metricas"; readonly busca: string };

export type Validacao =
  | { readonly ok: true; readonly pedido: PedidoValidado }
  | {
      readonly ok: false;
      readonly erro: string;
      readonly metricasProximas?: readonly string[];
    };

function recusar(
  erro: string,
  metricasProximas?: readonly string[],
): Validacao {
  return metricasProximas === undefined
    ? { ok: false, erro }
    : { ok: false, erro, metricasProximas };
}

function ehObjeto(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/** Só letras minúsculas, dígitos e sublinhado: a forma de um id do catálogo. */
const FORMA_DE_ID = /^[a-z][a-z0-9_]*$/;

/** Uma métrica que existe, ou a recusa com as próximas. */
function lerMetrica(bruto: unknown, campo = "metrica"): Validacao | string {
  if (typeof bruto !== "string" || !FORMA_DE_ID.test(bruto)) {
    return recusar(`'${campo}' precisa ser um id de métrica do catálogo`);
  }
  if (CATALOGO_GERADO[bruto] === undefined) {
    return recusar(
      `a métrica '${bruto}' não existe no catálogo`,
      proximasDe(bruto),
    );
  }
  return bruto;
}

/**
 * Os filtros pedidos, sobre os da tela. Código fora do vocabulário é recusa,
 * ano fora do que a fonte tem é recusa — o modelo não inventa recorte.
 */
function lerFiltros(
  bruto: unknown,
  contexto: ContextoDaTela,
): Validacao | Query {
  if (bruto === undefined) return contexto.filtros;
  if (!ehObjeto(bruto)) return recusar("'filtros' precisa ser um objeto");

  let saida: Query = contexto.filtros;
  for (const [chave, valor] of Object.entries(bruto)) {
    if (!(FILTROS as readonly string[]).includes(chave)) {
      return recusar(`filtro desconhecido: '${chave}'`);
    }
    if (typeof valor !== "string") {
      return recusar(`o filtro '${chave}' precisa ser texto`);
    }
    const campo = chave as NomeDeFiltro;
    if (campo === "ano") {
      const anoValido =
        contexto.anos.length === 0
          ? /^\d{4}$/.test(valor)
          : contexto.anos.includes(valor);
      if (!anoValido) {
        return recusar(
          `o ano '${valor}' não está carregado; anos disponíveis: ${contexto.anos.join(", ")}`,
        );
      }
      saida = { ...saida, ano: valor };
      continue;
    }
    if (!codigosDe(campo).includes(valor)) {
      return recusar(
        `'${valor}' não é um valor de ${campo}; aceitos: ${codigosDe(campo).join(", ")}`,
      );
    }
    saida = { ...saida, [campo]: valor };
  }
  return saida;
}

function semChavesExtras(
  args: Record<string, unknown>,
  permitidas: readonly string[],
): string | null {
  const extra = Object.keys(args).find((k) => !permitidas.includes(k));
  return extra === undefined ? null : `argumento desconhecido: '${extra}'`;
}

function ehValidacao(
  x: Validacao | string | Query | MesPedido | null,
): x is Validacao {
  return typeof x === "object" && x !== null && "ok" in x;
}

/** O mês pedido, `MM/AAAA`. Ausente é `null`, e não erro. */
const FORMA_DE_MES = /^(0[1-9]|1[0-2])\/(20\d{2})$/;

/**
 * Lê o mês de uma chamada (T-447).
 *
 * O ano é conferido contra os anos que a fonte carregou, como o filtro de ano
 * já é: um mês de 2024 não é um mês vazio, é um mês que não existe, e dizer
 * isso ao modelo vale mais que devolver uma série sem o ponto.
 */
function lerMes(
  bruto: unknown,
  contexto: ContextoDaTela,
): Validacao | MesPedido | null {
  if (bruto === undefined || bruto === null) return null;
  if (typeof bruto !== "string") {
    return recusar("'mes' precisa ser um texto no formato MM/AAAA");
  }
  const casado = FORMA_DE_MES.exec(bruto);
  if (casado === null) {
    return recusar(
      `'mes' precisa ser MM/AAAA, com o mês entre 01 e 12; veio '${bruto}'`,
    );
  }
  const ano = casado[2] ?? "";
  if (contexto.anos.length > 0 && !contexto.anos.includes(ano)) {
    return recusar(
      `o ano ${ano} não está carregado; a fonte tem ${contexto.anos.join(", ")}`,
    );
  }
  return { mes: Number(casado[1]), ano: Number(ano) };
}

/** Valida uma chamada do modelo contra o vocabulário e o contexto. */
export function validarChamada(
  chamada: Chamada,
  contexto: ContextoDaTela,
): Validacao {
  if (!nomeDeFerramentaValido(chamada.nome)) {
    return recusar(`ferramenta desconhecida: '${chamada.nome}'`);
  }
  const nome: NomeDeFerramenta = chamada.nome;
  const args = chamada.argumentos ?? {};
  if (!ehObjeto(args)) {
    return recusar("os argumentos precisam ser um objeto JSON");
  }

  switch (nome) {
    case "ler_metrica":
    case "serie_da_metrica": {
      const extra = semChavesExtras(args, ["metrica", "mes", "filtros"]);
      if (extra !== null) return recusar(extra);
      const metrica = lerMetrica(args["metrica"]);
      if (ehValidacao(metrica)) return metrica;
      const mes = lerMes(args["mes"], contexto);
      if (ehValidacao(mes)) return mes;
      const filtros = lerFiltros(args["filtros"], contexto);
      if (ehValidacao(filtros)) return filtros;
      return { ok: true, pedido: { nome, metrica, mes, filtros } };
    }

    case "comparar_metricas": {
      const extra = semChavesExtras(args, ["metricas", "filtros"]);
      if (extra !== null) return recusar(extra);
      const lista = args["metricas"];
      if (
        !Array.isArray(lista) ||
        lista.length < MINIMO_DE_METRICAS_NA_COMPARACAO ||
        lista.length > MAXIMO_DE_METRICAS_NA_COMPARACAO
      ) {
        return recusar(
          `'metricas' precisa ter de ${String(MINIMO_DE_METRICAS_NA_COMPARACAO)} a ${String(MAXIMO_DE_METRICAS_NA_COMPARACAO)} ids`,
        );
      }
      const metricas: string[] = [];
      for (const item of lista) {
        const m = lerMetrica(item, "metricas[]");
        if (ehValidacao(m)) return m;
        metricas.push(m);
      }
      const filtros = lerFiltros(args["filtros"], contexto);
      if (ehValidacao(filtros)) return filtros;
      return { ok: true, pedido: { nome, metricas, filtros } };
    }

    case "variacao": {
      const extra = semChavesExtras(args, ["metrica", "contra", "filtros"]);
      if (extra !== null) return recusar(extra);
      const metrica = lerMetrica(args["metrica"]);
      if (ehValidacao(metrica)) return metrica;
      if (args["contra"] !== "ano_anterior") {
        return recusar("'contra' aceita só 'ano_anterior'");
      }
      const filtros = lerFiltros(args["filtros"], contexto);
      if (ehValidacao(filtros)) return filtros;
      return {
        ok: true,
        pedido: { nome, metrica, contra: "ano_anterior", filtros },
      };
    }

    case "ranking":
    case "decompor": {
      const permitidas =
        nome === "ranking"
          ? ["metrica", "dimensao", "topN", "ordem", "filtros"]
          : ["metrica", "dimensao", "filtros"];
      const extra = semChavesExtras(args, permitidas);
      if (extra !== null) return recusar(extra);
      const metrica = lerMetrica(args["metrica"]);
      if (ehValidacao(metrica)) return metrica;
      const dimensao = args["dimensao"];
      if (typeof dimensao !== "string" || !dimensaoDeRankingValida(dimensao)) {
        return recusar(
          "'dimensao' precisa ser uma das oito: area, centro_custo, cliente, fornecedor, conta, linha_dre, uf, segmento",
        );
      }
      const filtros = lerFiltros(args["filtros"], contexto);
      if (ehValidacao(filtros)) return filtros;
      if (nome === "decompor") {
        return { ok: true, pedido: { nome, metrica, dimensao, filtros } };
      }
      const topN = args["topN"] ?? TOP_N_PADRAO;
      if (
        typeof topN !== "number" ||
        !Number.isInteger(topN) ||
        topN < 1 ||
        topN > TOP_N_MAXIMO
      ) {
        return recusar(
          `'topN' precisa ser inteiro de 1 a ${String(TOP_N_MAXIMO)}`,
        );
      }
      const ordem = args["ordem"] ?? "maior";
      if (ordem !== "maior" && ordem !== "menor") {
        return recusar("'ordem' aceita 'maior' ou 'menor'");
      }
      return {
        ok: true,
        pedido: { nome, metrica, dimensao, limite: topN, ordem, filtros },
      };
    }

    case "explicar_grafico": {
      const extra = semChavesExtras(args, ["painel", "filtros"]);
      if (extra !== null) return recusar(extra);
      const pedido = args["painel"];
      const painel = pedido === undefined ? contexto.painelEmFoco : pedido;
      if (painel === null) {
        return recusar(
          "não há painel em foco na tela; peça um 'painel' pelo id ou pergunte por uma métrica",
        );
      }
      if (typeof painel !== "string" || painelPorId(painel) === undefined) {
        return recusar(`o painel '${String(painel)}' não existe`);
      }
      const registro = painelPorId(painel);
      if (
        registro !== undefined &&
        contexto.tela !== null &&
        registro.tela !== contexto.tela &&
        painel !== contexto.painelEmFoco
      ) {
        return recusar(
          `o painel '${painel}' é da tela ${registro.tela}, não da tela aberta`,
        );
      }
      const filtros = lerFiltros(args["filtros"], contexto);
      if (ehValidacao(filtros)) return filtros;
      return { ok: true, pedido: { nome, painel, filtros } };
    }

    case "listar_metricas": {
      const extra = semChavesExtras(args, ["busca"]);
      if (extra !== null) return recusar(extra);
      const busca = args["busca"];
      if (typeof busca !== "string" || busca.trim().length < 2) {
        return recusar("'busca' precisa ser um texto com ao menos duas letras");
      }
      return { ok: true, pedido: { nome, busca: busca.trim() } };
    }

    /*
     * A consulta livre (T-453).
     *
     * O validador confere só a **forma** — texto, e não vazio. O que pode ser
     * lido é decidido pelo papel do banco e pelo esquema `amanna_chat`; o lint
     * de `sql-guarda.ts` recusa cedo o que não é SELECT, para o modelo ter uma
     * mensagem com que se corrigir. Recusar aqui por conteúdo seria a terceira
     * cópia da mesma regra, e a que sairia de sincronia primeiro.
     */
    case "consultar_dados": {
      const extra = semChavesExtras(args, ["consulta"]);
      if (extra !== null) return recusar(extra);
      const consulta = args["consulta"];
      if (typeof consulta !== "string" || consulta.trim() === "") {
        return recusar("'consulta' precisa ser um SELECT em texto");
      }
      return { ok: true, pedido: { nome, consulta: consulta.trim() } };
    }
  }
}
