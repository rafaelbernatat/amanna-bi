/**
 * Os seis estados obrigatórios de painel e KPI (T-132, PRD seção 6.4).
 *
 * > "Isso não é tratamento de exceção: com dado real, metade deles ocorre na
 * > primeira semana."
 *
 * | Estado | Quando | O que a tela mostra |
 * |---|---|---|
 * | Carregando | Consulta em curso | Esqueleto com a forma do painel, sem número piscando |
 * | Com dado | Caminho normal | O painel |
 * | Vazio no recorte | Consulta válida, zero linhas | O motivo, e um atalho para ampliar |
 * | Erro de fonte | Adaptador falhou | O horário da última leitura bem-sucedida |
 * | Sem permissão | Recorte fora do perfil | Nada do valor — nem agregado |
 * | Dado defasado | Sync acima do limite | O painel, com selo de frescor em destaque |
 *
 * ## Por que a carga vive dentro da variante
 *
 * `sem_permissao` **não tem** campo de carga, e isso não é economia de tipo: é
 * a seção 11 escrita de um jeito que não dá para desobedecer por descuido. Uma
 * forma `{ estado, carga: T | null }` deixaria a tela escrever
 * `carga?.total ?? "—"` e servir o agregado no HTML de quem não pode vê-lo, e o
 * defeito só apareceria em revisão de código. Aqui não há o que ler: o número
 * não chega ao componente.
 *
 * A mesma razão vale para `carregando` e `erro_de_fonte`. O esqueleto não tem
 * como piscar valor porque não recebe valor.
 *
 * ## Por que existe uma função só que traduz
 *
 * `Talvez<T>` é o que a camada de dados devolve (T-105) e traz `motivo`;
 * `EstadoDe<T>` é o que a tela desenha. A tradução entre os dois é uma decisão
 * — `fora_do_perfil` vira "sem permissão", `fonte_indisponivel` vira "erro de
 * fonte", e o resto vira "vazio no recorte" — e mora em `estadoDe`, uma vez.
 *
 * Treze telas traduzindo cada uma por conta própria dariam treze respostas na
 * primeira vez que um motivo novo entrasse no enum, e a diferença entre elas
 * apareceria como bug de uma tela só.
 */

import type { Frescor } from "@/semantica/contrato";
import { estaDefasado } from "@/semantica/frescor";
import type { MotivoDeVazio, Talvez } from "@/semantica/vazio";

/** Os seis da tabela 6.4. Enum fechado: um sétimo estado é decisão de Produto. */
export const ESTADOS = [
  "carregando",
  "com_dado",
  "vazio_no_recorte",
  "erro_de_fonte",
  "sem_permissao",
  "defasado",
] as const;

export type Estado = (typeof ESTADOS)[number];

/**
 * A identidade de um painel ou cartão: o que a tela mostra em **todos** os seis
 * estados.
 *
 * Título e unidade não são agregado. "Headcount por área, em FTE" não revela
 * quanto é o headcount — e sem eles o estado "sem permissão" viraria uma caixa
 * anônima, que é pior para quem usa e não é mais seguro para ninguém.
 */
export type Identidade = {
  readonly id: string;
  readonly titulo: string;
};

/**
 * O estado de um painel ou cartão, com a carga só onde ela pode existir.
 *
 * União discriminada: quem desenha **precisa** olhar `estado` antes de chegar
 * em `carga`, e nas três variantes onde não há carga o campo não existe.
 */
export type EstadoDe<T> =
  | { readonly estado: "carregando" }
  | { readonly estado: "com_dado"; readonly carga: T }
  | {
      readonly estado: "vazio_no_recorte";
      readonly motivo: MotivoDeVazio;
      /** Recorte mais amplo que teria dado, quando existe um. */
      readonly ampliarPara?: string;
    }
  | {
      readonly estado: "erro_de_fonte";
      /**
       * O frescor da última leitura bem-sucedida, quando se sabe dele.
       *
       * `null` é o caso honesto de "nunca leu com sucesso nesta sessão". A 6.4
       * pede o horário; inventar um seria pior que admitir que não há.
       */
      readonly ultimoFrescor: Frescor | null;
    }
  | { readonly estado: "sem_permissao" }
  | {
      readonly estado: "defasado";
      readonly carga: T;
      readonly frescor: Frescor;
    };

/* ------------------------------------------------------------------ *
 * A tradução, num lugar só
 * ------------------------------------------------------------------ */

/**
 * Para onde cada motivo de vazio leva, na tabela 6.4.
 *
 * Escrito como tabela total sobre o enum: acrescentar um motivo em
 * `MOTIVOS_DE_VAZIO` sem decidir o estado dele **para de compilar**. Um `switch`
 * com `default` engoliria o motivo novo no estado mais genérico, e ninguém
 * descobriria até alguém reclamar da mensagem errada.
 */
const ESTADO_DO_MOTIVO: Readonly<
  Record<MotivoDeVazio, "vazio_no_recorte" | "erro_de_fonte" | "sem_permissao">
> = {
  sem_dado_no_recorte: "vazio_no_recorte",
  grupo_pequeno: "vazio_no_recorte",
  denominador_zero: "vazio_no_recorte",
  fora_do_perfil: "sem_permissao",
  fonte_indisponivel: "erro_de_fonte",
};

/**
 * O que a camada de dados devolveu, virado estado de tela.
 *
 * `frescor` é o da leitura corrente. Quando ele diz `defasado`, um retorno com
 * valor vira `defasado` e não `com_dado`: o painel aparece igual, com o selo em
 * destaque, que é o que a 6.4 pede.
 */
export function estadoDe<T>(
  t: Talvez<T>,
  frescor: Frescor | null,
): EstadoDe<T> {
  if (!t.vazio) {
    if (frescor !== null && estaDefasado(frescor)) {
      return { estado: "defasado", carga: t.valor, frescor };
    }
    return { estado: "com_dado", carga: t.valor };
  }

  const destino = ESTADO_DO_MOTIVO[t.motivo];
  if (destino === "sem_permissao") return { estado: "sem_permissao" };
  if (destino === "erro_de_fonte") {
    return { estado: "erro_de_fonte", ultimoFrescor: frescor };
  }
  return {
    estado: "vazio_no_recorte",
    motivo: t.motivo,
    ...(t.ampliarPara === undefined ? {} : { ampliarPara: t.ampliarPara }),
  };
}

/**
 * O estado tem carga? Estreita o tipo para quem desenha.
 *
 * Existe para que a tela não precise repetir `e.estado === "com_dado" ||
 * e.estado === "defasado"` em cada ponto — a repetição é onde um dos dois
 * acaba esquecido, e o painel some quando o dado está defasado.
 */
export function temCarga<T>(e: EstadoDe<T>): e is
  | { readonly estado: "com_dado"; readonly carga: T }
  | {
      readonly estado: "defasado";
      readonly carga: T;
      readonly frescor: Frescor;
    } {
  return e.estado === "com_dado" || e.estado === "defasado";
}
