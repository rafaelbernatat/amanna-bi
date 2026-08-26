import { formatarInstante } from "@/apresentacao/formato/formato";
import { CartaoDeKpi } from "@/apresentacao/paineis/CartaoDeKpi";
import { SeloDeFrescor } from "@/apresentacao/paineis/SeloDeFrescor";
import { ALTURA_DA_SPARKLINE } from "@/apresentacao/paineis/sparkline";
import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";
import type { Kpi } from "@/semantica/contrato";
import { type EstadoDe, temCarga } from "@/semantica/estado";
import type { MotivoDeVazio } from "@/semantica/vazio";

/**
 * Um cartão de KPI nos seis estados da seção 6.4 (T-132).
 *
 * > "Todo painel e **todo KPI** implementam os seis estados abaixo."
 *
 * O cartão é o menor componente do produto e o mais copiado numa tela: são até
 * seis por tela, treze telas. Um cartão que tratasse só "com dado" e "sem dado"
 * multiplicaria o buraco por 78.
 *
 * ## O que "sem permissão" mostra
 *
 * O rótulo, e mais nada. Não o valor, não o delta, não a série — e nem o
 * rodapé, porque o rodapé de um KPI diz coisas como "média dos últimos 12
 * meses, 340 pessoas na base", que é agregado com outro nome.
 *
 * A garantia é do tipo: a variante `sem_permissao` de `EstadoDe<Kpi>` não tem
 * campo de carga. Não existe número neste caminho para vazar por descuido.
 *
 * ## O esqueleto do cartão não é o do painel
 *
 * Um cartão é rótulo, número grande, traço e rodapé — quatro faixas de alturas
 * conhecidas. O esqueleto imita essas quatro, e não a silhueta de um gráfico:
 * um retângulo do tamanho do cartão inteiro pareceria um painel carregando, e
 * quem lê ajustaria o olhar duas vezes.
 */

/** A altura do número grande, para o esqueleto reservar o mesmo espaço. */
const ALTURA_DO_VALOR = 29;

/** A altura da faixa de rótulo. */
const ALTURA_DO_ROTULO = 12;

/** A altura da linha de delta e rodapé. */
const ALTURA_DO_RODAPE = 14;

export function CartaoEmEstado({
  identidade,
  estado,
}: {
  readonly identidade: { readonly id: string; readonly rotulo: string };
  readonly estado: EstadoDe<Kpi>;
}) {
  if (temCarga(estado)) {
    return (
      <div data-teste="cartao-em-estado" data-estado={estado.estado}>
        <CartaoDeKpi kpi={estado.carga} />
        {estado.estado === "defasado" ? (
          <div style={{ marginTop: 5 }}>
            <SeloDeFrescor frescor={estado.frescor} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <MolduraDeCartao id={identidade.id} estado={estado.estado}>
      <Rotulo texto={identidade.rotulo} />
      {estado.estado === "carregando" ? (
        <EsqueletoDeCartao />
      ) : (
        <Explicacao estado={estado} />
      )}
    </MolduraDeCartao>
  );
}

/* ------------------------------------------------------------------ *
 * A moldura
 * ------------------------------------------------------------------ */

/**
 * O quadro do cartão sem carga.
 *
 * Repete a geometria de `CartaoDeKpi` — mesma borda, mesmo raio, mesmo padding
 * — porque trocar de estado não pode mexer um pixel na grade de cartões. Um
 * cartão vazio mais baixo que o vizinho faria a linha inteira desalinhar.
 */
function MolduraDeCartao({
  id,
  estado,
  children,
}: {
  readonly id: string;
  readonly estado: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div
      data-teste="cartao-em-estado"
      data-kpi={id}
      data-estado={estado}
      role="status"
      style={{
        minWidth: 0,
        background: PALETA.superficie,
        border: `1px solid ${PALETA.borda}`,
        borderRadius: 17,
        padding: "14px 15px 13px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

function Rotulo({ texto }: { readonly texto: string }) {
  return (
    <span
      data-teste="rotulo-do-cartao"
      style={{
        font: `500 9.5px/1.2 ${TIPOGRAFIA.texto}`,
        color: PALETA.textoTerciario,
        minHeight: ALTURA_DO_ROTULO,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {texto}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Carregando
 * ------------------------------------------------------------------ */

/**
 * As três faixas do cartão, cinzas e sem texto.
 *
 * Não há número aqui, e não é disciplina: a variante `carregando` não tem
 * carga, então não há valor antigo para piscar enquanto o novo vem — que é o
 * defeito nomeado na tabela 6.4.
 */
function EsqueletoDeCartao() {
  return (
    <>
      <Faixa altura={ALTURA_DO_VALOR} largura="62%" />
      <Faixa altura={ALTURA_DA_SPARKLINE} largura="100%" />
      <Faixa altura={ALTURA_DO_RODAPE} largura="78%" />
    </>
  );
}

function Faixa({
  altura,
  largura,
}: {
  readonly altura: number;
  readonly largura: string;
}) {
  return (
    <div
      data-teste="faixa-de-esqueleto"
      style={{
        width: largura,
        height: altura,
        minHeight: altura,
        borderRadius: 5,
        background: PALETA.superficieSuave,
        border: `1px solid ${PALETA.grade}`,
        boxSizing: "border-box",
      }}
    />
  );
}

/* ------------------------------------------------------------------ *
 * Os três estados que explicam
 * ------------------------------------------------------------------ */

const TEXTO_DE_VAZIO: Readonly<Record<MotivoDeVazio, string>> = {
  sem_dado_no_recorte: "sem dado neste recorte",
  grupo_pequeno: "grupo pequeno demais para exibir",
  fora_do_perfil: "sem acesso a este recorte",
  fonte_indisponivel: "não foi possível ler a fonte",
  denominador_zero: "sem base para calcular",
};

/**
 * A frase do estado, no lugar do número.
 *
 * Ocupa a mesma altura que o número ocuparia. Um cartão que encolhe quando não
 * tem dado é um cartão que muda a grade toda sempre que um recorte fica vazio —
 * e recorte vazio é comum, não é exceção.
 */
function Explicacao({
  estado,
}: {
  readonly estado: Exclude<
    EstadoDe<Kpi>,
    | { readonly estado: "com_dado" }
    | { readonly estado: "defasado" }
    | { readonly estado: "carregando" }
  >;
}) {
  const frase =
    estado.estado === "sem_permissao"
      ? "sem acesso a este recorte"
      : estado.estado === "erro_de_fonte"
        ? "não foi possível ler a fonte"
        : TEXTO_DE_VAZIO[estado.motivo];

  const detalhe =
    estado.estado === "erro_de_fonte"
      ? estado.ultimoFrescor === null
        ? "sem leitura bem-sucedida registrada"
        : `última leitura: ${formatarInstante(estado.ultimoFrescor.sincronizadoEm)}`
      : estado.estado === "vazio_no_recorte" &&
          estado.ampliarPara !== undefined &&
          estado.motivo === "sem_dado_no_recorte"
        ? `Ampliar para ${estado.ampliarPara}`
        : estado.estado === "sem_permissao"
          ? "peça acesso a quem administra os perfis"
          : "";

  return (
    <>
      <span
        data-teste="valor-do-cartao"
        style={{
          font: `400 13px/1.3 ${TIPOGRAFIA.texto}`,
          color: PALETA.textoTerciario,
          minHeight: ALTURA_DO_VALOR,
          display: "flex",
          alignItems: "center",
        }}
      >
        {frase}
      </span>
      {/* Reserva o traço mesmo sem desenhar, como o cartão com dado faz. */}
      <div style={{ height: ALTURA_DA_SPARKLINE, minWidth: 0 }} />
      <span
        data-teste="detalhe-do-cartao"
        style={{
          font: `500 9px/1.2 ${TIPOGRAFIA.mono}`,
          color: PALETA.textoFraco,
          minHeight: ALTURA_DO_RODAPE,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {detalhe}
      </span>
    </>
  );
}
