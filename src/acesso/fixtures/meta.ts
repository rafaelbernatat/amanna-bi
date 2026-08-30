/**
 * `getMeta` sobre as fixtures (T-149).
 *
 * A porta que diz **o que existe**: quais dimensões o dado carregado oferece,
 * qual catálogo produziu os números, e quão fresco está tudo isso.
 *
 * ## Os anos saem do dado, e não de uma lista
 *
 * É a decisão D-P8 inteira em três linhas: os anos são lidos das próprias
 * linhas de fato. *"Acrescentar 2024 aos dados faz o filtro passar a oferecer
 * três anos sem alteração de código e sem imagem nova."*
 *
 * Enquanto a lista era literal — em `dimensoes-provisorias`, ou pior, dentro da
 * barra de filtros —, essa frase era intenção. Aqui ela é consequência: não
 * existe lugar onde escrever um ano.
 *
 * As outras quatro dimensões não são derivadas do dado, e a diferença é de
 * natureza. Período, entidade, área e modalidade são **vocabulário fechado** da
 * seção 6.2 — a lista não muda porque um mês veio vazio. Ano é o oposto: ele
 * existe porque foi carregado.
 *
 * ## O frescor de uma fixture é agora
 *
 * A fixture é calculada na leitura, então o último sync bem-sucedido é o
 * instante da própria leitura. Fingir um horário passado faria o selo virar
 * aviso sozinho depois de um dia parado, e a demonstração passaria a mostrar um
 * problema que não existe.
 *
 * O que **não** se finge é o `asOf`: ele é o último fechamento que o dado
 * carrega, lido das linhas. Com a fixture de 2026 completa, é 31/12/2026 —
 * mesmo que o relógio diga agosto. É honesto: o dado é esse.
 */

import { anoDoMes } from "@/acesso/fixtures/eixos";
import { VW_FATO_RH_MES } from "@/acesso/fixtures/rh";
import {
  CATALOGO_GERADO,
  VERSAO_DO_CATALOGO,
} from "@/semantica/catalogo-gerado";
import type { Meta } from "@/semantica/contrato";
import { codigosDe } from "@/semantica/dimensoes";
import { avaliarFrescor } from "@/semantica/frescor";

/** O dado não tem mês nenhum — não há de onde tirar ano nem fechamento. */
export class FixtureSemMes extends Error {
  constructor() {
    super(
      "Nenhuma linha de fato tem mês. `getMeta` derivaria uma lista de anos " +
        "vazia e o filtro de ano ficaria sem opção nenhuma — o que é " +
        "indistinguível, na tela, de um filtro quebrado.",
    );
    this.name = "FixtureSemMes";
  }
}

/** Os meses que o dado carrega, em ordem. */
function mesesCarregados(): readonly string[] {
  const meses = [...new Set(VW_FATO_RH_MES.map((l) => l.mes))].sort();
  if (meses.length === 0) throw new FixtureSemMes();
  return meses;
}

/**
 * O último dia do mês, em ISO.
 *
 * `Date.UTC(ano, mes, 0)` devolve o último dia do mês anterior ao índice — e
 * como o mês entra 1-based, isso é exatamente o último dia dele. Em UTC de
 * propósito: o dia de fechamento é rótulo de calendário, e construir em fuso
 * local faria 31/12 virar 30/12 a oeste de Greenwich.
 */
function ultimoDiaDoMes(mes: string): string {
  const [ano, numero] = mes.split("-");
  const data = new Date(Date.UTC(Number(ano), Number(numero), 0));
  return data.toISOString().slice(0, "0000-00-00".length);
}

/**
 * O que a fixture sabe sobre si mesma.
 *
 * `agora` entra por parâmetro pela mesma razão de `avaliarFrescor`: o instante
 * certo é o da requisição, e um `Date.now()` aqui dentro tornaria o frescor
 * impossível de testar sem esperar o relógio andar.
 */
export function calcularMeta(agora: Date): Meta {
  const meses = mesesCarregados();
  const anos = [...new Set(meses.map(anoDoMes))].sort().reverse();
  const ultimo = meses[meses.length - 1] ?? "";

  return {
    dimensoes: {
      periodo: codigosDe("periodo"),
      ano: anos,
      entidade: codigosDe("entidade"),
      area: codigosDe("area"),
      modalidade: codigosDe("modalidade"),
    },
    versaoDoCatalogo: VERSAO_DO_CATALOGO,
    metricas: Object.keys(CATALOGO_GERADO).sort(),
    frescor: avaliarFrescor({
      asOf: ultimoDiaDoMes(ultimo),
      sincronizadoEm: agora.toISOString(),
      agora,
    }),
  };
}
