/**
 * O que a rota `/api/chat` aceita, e o que ela mostra antes do texto.
 *
 * Fica fora do arquivo da rota porque o Next só admite, num `route.ts`, os
 * manipuladores HTTP e a configuração de segmento — e estas duas funções
 * precisam ser testadas sem subir servidor.
 */

import type { TurnoAnterior } from "@/chat/interpretar";
import { mesValido } from "@/chat/mes";
import type { Query } from "@/semantica/contrato";
import { FILTROS } from "@/semantica/dimensoes";
import { buscaParaQuery } from "@/semantica/url";
import {
  TAMANHO_MAXIMO_DA_PERGUNTA,
  TURNOS_LEMBRADOS,
  type PedidoDeChat,
  type Previa,
} from "@/chat/protocolo";
import type { Resolucao } from "@/chat/resolver";
import { CATALOGO_GERADO } from "@/semantica/catalogo-gerado";

/** `modulo/tela` cabe nisto; mais que isto não é rota do inventário. */
const TAMANHO_MAXIMO_DA_TELA = 40;

function ehObjeto(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

/**
 * Lê e valida o corpo. `null` é pedido malformado, e vira 400.
 *
 * A pergunta tem teto de tamanho, que é limite de custo do modelo e não de
 * conteúdo. Os ids de métrica do histórico vêm do navegador e são conferidos
 * contra o catálogo: o que não existe vira `null` antes de chegar ao estágio
 * 1, e só os últimos `TURNOS_LEMBRADOS` seguem.
 */
/** Até onde um valor de filtro vindo do navegador é lido. */
const TAMANHO_MAXIMO_DE_FILTRO = 40;

/**
 * O recorte da resposta anterior, se for um recorte de verdade: cada campo
 * passa pelo leitor da URL, e um valor fora do vocabulário derruba o todo —
 * antes herdar errado, melhor não herdar.
 */
function filtrosValidos(bruto: unknown): Query | null {
  if (!ehObjeto(bruto)) return null;
  const busca = new URLSearchParams();
  for (const campo of FILTROS) {
    const valor = bruto[campo];
    if (typeof valor !== "string") return null;
    if (campo === "ano" && !/^20\d{2}$/.test(valor)) return null;
    busca.set(campo, valor.slice(0, TAMANHO_MAXIMO_DE_FILTRO));
  }
  const { query, avisos } = buscaParaQuery(busca);
  return avisos.length === 0 ? query : null;
}

export function lerPedido(bruto: unknown): PedidoDeChat | null {
  if (!ehObjeto(bruto)) return null;

  const pergunta = bruto["pergunta"];
  if (typeof pergunta !== "string") return null;
  const limpa = pergunta.trim();
  if (limpa === "" || limpa.length > TAMANHO_MAXIMO_DA_PERGUNTA) return null;

  const busca = bruto["busca"];
  if (busca !== undefined && typeof busca !== "string") return null;

  // A tela é validada contra o inventário adiante, ao montar o contexto;
  // aqui só a forma: texto curto, ou nada.
  const tela = bruto["tela"];
  if (tela !== undefined && tela !== null && typeof tela !== "string") {
    return null;
  }

  const historicoBruto = bruto["historico"];
  const historico: TurnoAnterior[] = [];
  if (historicoBruto !== undefined) {
    if (!Array.isArray(historicoBruto)) return null;
    for (const turno of historicoBruto) {
      if (!ehObjeto(turno) || typeof turno["pergunta"] !== "string") continue;
      const metrica = turno["metrica"];
      const mes = turno["mes"];
      const filtros = filtrosValidos(turno["filtros"]);
      historico.push({
        pergunta: turno["pergunta"].slice(0, TAMANHO_MAXIMO_DA_PERGUNTA),
        metrica:
          typeof metrica === "string" && CATALOGO_GERADO[metrica] !== undefined
            ? metrica
            : null,
        // O contexto da resposta anterior (T-443), só na forma — um mês do
        // calendário e um recorte que o mesmo leitor da URL aceita — e só
        // quando existe: turno sem contexto não ganha chave nenhuma.
        ...(mesValido(mes) ? { mes: { mes: mes.mes, ano: mes.ano } } : {}),
        ...(filtros === null ? {} : { filtros }),
      });
    }
  }

  return {
    pergunta: limpa,
    busca: busca ?? "",
    tela:
      typeof tela === "string" && tela.length <= TAMANHO_MAXIMO_DA_TELA
        ? tela
        : null,
    historico: historico.slice(-TURNOS_LEMBRADOS),
  };
}

/** O que o chat mostra antes do texto: o número e para onde a tela vai. */
export function previaDe(r: Resolucao): Previa {
  return {
    metrica: r.metrica,
    rotulo: r.rotulo,
    valor: r.valor,
    unidade: r.unidade,
    acoes: r.acoes,
    painel: r.painel,
  };
}
