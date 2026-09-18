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
 * ## O frescor vem de quem carregou
 *
 * A fixture é calculada na leitura, então o último sync bem-sucedido é o
 * instante da própria leitura, e é isso que o adaptador de fixtures informa.
 * A base no Postgres tem uma carga com data e hora, e é ela que o adaptador de
 * warehouse informa — e o selo vira aviso um dia depois da carga, que é o
 * comportamento certo de um dado que ninguém atualizou (D-P5).
 *
 * O que **não** se finge é o `asOf`: ele é o último fechamento que o dado
 * carrega, lido das linhas. Com 2026 completo, é 31/12/2026 — mesmo que o
 * relógio diga agosto. É honesto: o dado é esse.
 */

import type { Base } from "@/acesso/calculo/base";
import { anoDoMes } from "@/acesso/calculo/eixos";
import {
  CATALOGO_GERADO,
  VERSAO_DO_CATALOGO,
} from "@/semantica/catalogo-gerado";
import type { Meta, OrigemDeDado } from "@/semantica/contrato";
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
function mesesCarregados(base: Base): readonly string[] {
  const meses = [
    ...new Set(base.views.vw_fato_rh_mes.map((l) => l.mes)),
  ].sort();
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

/** Quando a base foi carregada — o que cada adaptador sabe e o motor não. */
export type Carga = {
  /** Instante do último sync bem-sucedido, em ISO com fuso. */
  readonly sincronizadoEm: string;
  /** Qual adaptador está falando (T-419). */
  readonly fonte: OrigemDeDado;
  /** A versão da carga, ou `null` quando não há carga (fixture). */
  readonly versao: string | null;
};

/**
 * O que a base sabe sobre si mesma.
 *
 * `agora` entra por parâmetro pela mesma razão de `avaliarFrescor`: o instante
 * certo é o da requisição, e um `Date.now()` aqui dentro tornaria o frescor
 * impossível de testar sem esperar o relógio andar. A `carga` entra pelo mesmo
 * motivo: quem sabe quando o dado foi carregado é o adaptador.
 */
export function calcularMeta(base: Base, carga: Carga, agora: Date): Meta {
  const meses = mesesCarregados(base);
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
      sincronizadoEm: carga.sincronizadoEm,
      agora,
    }),
    origem: { fonte: carga.fonte, versao: carga.versao },
  };
}
