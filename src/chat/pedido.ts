/**
 * O que a rota `/api/chat` aceita, e o que ela mostra antes do texto.
 *
 * Fica fora do arquivo da rota porque o Next só admite, num `route.ts`, os
 * manipuladores HTTP e a configuração de segmento — e estas duas funções
 * precisam ser testadas sem subir servidor.
 */

import type { TurnoAnterior } from "@/chat/interpretar";
import {
  TAMANHO_MAXIMO_DA_PERGUNTA,
  TURNOS_LEMBRADOS,
  type PedidoDeChat,
  type Previa,
} from "@/chat/protocolo";
import type { Resolucao } from "@/chat/resolver";
import { CATALOGO_GERADO } from "@/semantica/catalogo-gerado";

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
export function lerPedido(bruto: unknown): PedidoDeChat | null {
  if (!ehObjeto(bruto)) return null;

  const pergunta = bruto["pergunta"];
  if (typeof pergunta !== "string") return null;
  const limpa = pergunta.trim();
  if (limpa === "" || limpa.length > TAMANHO_MAXIMO_DA_PERGUNTA) return null;

  const busca = bruto["busca"];
  if (busca !== undefined && typeof busca !== "string") return null;

  const historicoBruto = bruto["historico"];
  const historico: TurnoAnterior[] = [];
  if (historicoBruto !== undefined) {
    if (!Array.isArray(historicoBruto)) return null;
    for (const turno of historicoBruto) {
      if (!ehObjeto(turno) || typeof turno["pergunta"] !== "string") continue;
      const metrica = turno["metrica"];
      historico.push({
        pergunta: turno["pergunta"].slice(0, TAMANHO_MAXIMO_DA_PERGUNTA),
        metrica:
          typeof metrica === "string" && CATALOGO_GERADO[metrica] !== undefined
            ? metrica
            : null,
      });
    }
  }

  return {
    pergunta: limpa,
    busca: busca ?? "",
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
  };
}
