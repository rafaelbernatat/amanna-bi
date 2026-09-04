import type { ReactNode } from "react";

import { SeloDeFrescor } from "@/apresentacao/paineis/SeloDeFrescor";
import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";
import type { Frescor, PanelResponse } from "@/semantica/contrato";

/**
 * O componente de painel (T-131).
 *
 * ## A fórmula não tem como ser desligada
 *
 * O achado 10 do Anexo D descreve uma propriedade do protótipo que esconde a
 * linha de fórmula de todos os painéis de uma vez. O tratamento decidido foi
 * "a propriedade sai".
 *
 * Aqui ela não existe, e a ausência é estrutural e não uma escolha de quem
 * usa: `Painel` **não aceita** propriedade que controle a fórmula. Se
 * `PanelResponse.formula` tem texto, a linha aparece. Não há caminho pelo qual
 * ela não apareça, e é isso que faz RF-04 e o princípio PR-3 serem verdade em
 * vez de intenção.
 *
 * O nome daquela propriedade não aparece neste arquivo de propósito: a guarda
 * de T-109 procura por ele no código do produto, e citá-lo aqui — ainda que só
 * em comentário — faria a guarda apontar para a explicação em vez de apontar
 * para o defeito. Quem quiser o nome exato o encontra no Anexo D.
 *
 * O tipo `Formula` de T-109 já garante que o texto não é vazio; este componente
 * garante que ele chega à tela.
 *
 * ## A caixa é reservada antes do gráfico montar
 *
 * A altura vem do envelope e é aplicada antes de o conteúdo existir, para o
 * *layout shift* seguir em zero (T-129, seção 13). O gráfico chega como
 * `children` porque quem sabe desenhar cada uma das doze formas são os
 * componentes de T-130, T-164 e T-165 — este aqui é a moldura.
 */
export function Painel({
  painel,
  altura,
  destacado = false,
  frescor,
  subtitulo,
  children,
}: {
  readonly painel: PanelResponse;
  /** Altura reservada para o desenho, em pixels. */
  readonly altura: number;
  /** O painel citado pela IA (seção 6.5). */
  readonly destacado?: boolean;
  /** O selo da seção 10.2. Em destaque quando `defasado` (T-132). */
  readonly frescor?: Frescor;
  /**
   * O subtítulo do painel (T-133).
   *
   * Quem chama passa o resultado de `subtituloSobRecorte`, que troca o
   * subtítulo próprio por "No recorte ativo · Área" quando há filtro fora do
   * padrão. A troca não acontece aqui de propósito: este componente não
   * conhece a `Query`, e dar-lhe a `Query` faria dele um segundo lugar que
   * decide o que o recorte significa.
   */
  readonly subtitulo?: string | null;
  readonly children?: ReactNode;
}) {
  return (
    <MolduraDePainel
      id={painel.id}
      titulo={painel.title}
      unidade={painel.unit}
      destacado={destacado}
      {...(frescor === undefined ? {} : { frescor })}
      {...(subtitulo === undefined ? {} : { subtitulo })}
    >
      {/*
        A caixa do desenho, reservada por altura antes de o conteúdo montar.
        Sem isto o painel cresce quando o gráfico aparece, e o CLS deixa de ser
        zero — que é o alvo medido em T-129.
      */}
      <div
        data-teste="caixa-do-painel"
        style={{ height: altura, minHeight: altura, minWidth: 0 }}
      >
        {children}
      </div>

      <FormulaDoPainel formula={painel.formula} />

      {painel.note === null || painel.note === undefined ? null : (
        <p
          data-teste="nota-do-painel"
          style={{
            margin: 0,
            font: `400 10.5px/1.5 ${TIPOGRAFIA.texto}`,
            color: PALETA.textoSecundario,
          }}
        >
          {painel.note}
        </p>
      )}
    </MolduraDePainel>
  );
}

/**
 * O quadro do painel: borda, cabeçalho, título, unidade e selo.
 *
 * Extraído em T-132 porque os seis estados da seção 6.4 precisam do **mesmo**
 * quadro. Um painel carregando e um painel com dado que desenhassem molduras
 * separadas divergiriam na primeira vez que alguém mexesse em uma delas, e a
 * tela pularia ao trocar de estado — que é o CLS de T-129 voltando pela porta
 * dos estados.
 *
 * Recebe **identidade**, e nunca carga. Título e unidade aparecem nos seis
 * estados, inclusive em "sem permissão": "Headcount por área, em FTE" não
 * revela quanto é o headcount, e sem eles a caixa vira anônima — pior para quem
 * lê e não mais segura para ninguém (seção 11).
 */
export function MolduraDePainel({
  id,
  titulo,
  unidade,
  destacado = false,
  frescor,
  subtitulo = null,
  children,
}: {
  readonly id: string;
  readonly titulo: string;
  readonly unidade?: string;
  readonly destacado?: boolean;
  readonly frescor?: Frescor;
  /** Ver `Painel`. `null` é ausência de subtítulo, e é o padrão. */
  readonly subtitulo?: string | null;
  readonly children?: ReactNode;
}) {
  return (
    <section
      data-teste="painel"
      data-painel={id}
      data-destacado={destacado ? "1" : "0"}
      aria-label={titulo}
      style={{
        minWidth: 0,
        background: PALETA.superficie,
        border: `1px solid ${destacado ? PALETA.destaque : PALETA.borda}`,
        /*
          Contorno, sombra e rótulo (seção 6.5). A sombra é um halo da cor de
          destaque, para o painel citado se distinguir dos vizinhos mesmo de
          longe — a borda de um pixel sozinha se perdia numa grade de sete.
          `scrollMargin` deixa folga quando o navegador rola até aqui.
        */
        boxShadow: destacado
          ? `0 0 0 4px color-mix(in srgb, ${PALETA.destaque} 22%, transparent), 0 18px 40px -16px color-mix(in srgb, ${PALETA.destaque} 60%, transparent)`
          : undefined,
        scrollMargin: 16,
        borderRadius: 17,
        padding: "15px 16px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        overflow: "hidden",
      }}
    >
      <header style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <h2
            style={{
              margin: 0,
              font: `500 14px/1.25 ${TIPOGRAFIA.titulo}`,
              color: PALETA.texto,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {titulo}
          </h2>
          {unidade === undefined ? null : (
            <span
              data-teste="unidade-do-painel"
              style={{
                marginLeft: "auto",
                flex: "none",
                font: `500 8.5px/1.2 ${TIPOGRAFIA.mono}`,
                color: PALETA.textoFraco,
                textTransform: "uppercase",
                letterSpacing: ".1em",
              }}
            >
              {unidade}
            </span>
          )}
        </div>
        {subtitulo === null || subtitulo === "" ? null : (
          <p
            data-teste="subtitulo-do-painel"
            style={{
              margin: 0,
              font: `400 10px/1.4 ${TIPOGRAFIA.texto}`,
              color: PALETA.textoTerciario,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {subtitulo}
          </p>
        )}
        {destacado ? (
          <span
            data-teste="rotulo-de-referencia"
            style={{
              font: `500 8.5px/1.2 ${TIPOGRAFIA.mono}`,
              color: PALETA.destaque,
              textTransform: "uppercase",
              letterSpacing: ".1em",
            }}
          >
            Gráfico referenciado pela IA
          </span>
        ) : null}
        {frescor === undefined ? null : <SeloDeFrescor frescor={frescor} />}
      </header>

      {children}
    </section>
  );
}

/**
 * A linha de fórmula.
 *
 * Componente próprio e sem propriedade de controle: quem quiser escondê-la
 * precisa apagar a chamada, e isso aparece no diff. Uma propriedade booleana
 * de exibir-ou-não, com qualquer nome, seria a chave do achado 10 de volta —
 * é por isso que a guarda de T-109 procura pela forma, e não só pelo nome.
 */
function FormulaDoPainel({ formula }: { readonly formula: string }) {
  if (formula.trim() === "") return null;
  return (
    <p
      data-teste="formula-do-painel"
      style={{
        margin: 0,
        font: `400 9.5px/1.5 ${TIPOGRAFIA.mono}`,
        color: PALETA.textoTerciario,
        borderTop: `1px solid ${PALETA.grade}`,
        paddingTop: 8,
      }}
    >
      {formula}
    </p>
  );
}
