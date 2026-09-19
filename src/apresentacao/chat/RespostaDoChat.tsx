import { formatarValor } from "@/apresentacao/formato/formato";
import {
  blocosDaResposta,
  type ItemDaLista,
} from "@/apresentacao/chat/paragrafos";
import { MARCA, PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";
import type {
  LeituraDeFerramenta,
  ResultadoDeFerramenta,
} from "@/chat/ferramentas/resultado";
import type { Autoria, Resposta } from "@/chat/perguntar";

/**
 * O corpo de uma resposta na conversa (seção 7.2).
 *
 * ## O que mostra, e por que nessa ordem
 *
 * O número primeiro, porque é o que foi perguntado. Depois **o que entrou na
 * conta**, que é a diferença entre uma resposta e uma afirmação. Depois a
 * comparação com o custo do dinheiro, que é o que transforma o número em
 * leitura. E por último a fórmula e a definição — quem quer auditar encontra,
 * quem quer o número já leu.
 *
 * Não lê dado nem formata além de `formatarValor`: recebe a `Resposta` que a
 * rota devolveu e a desenha. Os atalhos (alternativas de uma recusa e as
 * sugestões de uma resposta) viram botões que devolvem a frase a quem chama —
 * é o chat quem sabe perguntar.
 */
export function RespostaDoChat({
  resposta,
  aoPerguntar,
}: {
  readonly resposta: Resposta;
  readonly aoPerguntar: (pergunta: string) => void;
}) {
  if (resposta.tipo === "recusa") {
    return (
      <div
        data-teste="chat-recusa"
        style={{ display: "flex", flexDirection: "column", gap: 8 }}
      >
        <p style={ESTILO_DO_TEXTO}>{resposta.texto}</p>
        {resposta.alternativas.length === 0 ? null : (
          <Atalhos
            textos={resposta.alternativas.map((a) => a.rotulo)}
            aoPerguntar={aoPerguntar}
          />
        )}
        {/*
          A recusa diz o que dá para perguntar: o guia da tela, que o servidor
          mandou junto (T-441). Com métricas próximas, vem depois delas.
        */}
        {resposta.sugestoes.length > 0 ? (
          <Atalhos
            rotulo={
              resposta.alternativas.length === 0
                ? "pergunte, por exemplo"
                : "ou pergunte, por exemplo"
            }
            textos={resposta.sugestoes}
            aoPerguntar={aoPerguntar}
          />
        ) : null}
      </div>
    );
  }

  const { resolucao: r } = resposta;

  return (
    <div
      data-teste="chat-resposta"
      style={{ display: "flex", flexDirection: "column", gap: 10 }}
    >
      <TextoDaResposta texto={resposta.texto} />

      {r.leituras.length === 0 ? null : (
        <div
          data-teste="chat-leituras"
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
        >
          <Rotulo texto="o que foi lido" />
          {r.leituras.map((l, i) => (
            <Leitura key={`${l.ferramenta}-${String(i)}`} resultado={l} />
          ))}
        </div>
      )}

      {r.consideracoes.length === 0 ? null : (
        <div data-teste="chat-consideracoes">
          <Rotulo
            texto={
              r.consideracoes.some((c) => c.origem === "painel")
                ? "o que entrou na conta"
                : "o que explica"
            }
          />
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 3,
            }}
          >
            {r.consideracoes.map((c) => (
              <li
                key={`${c.origem}-${c.rotulo}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  font: `400 11px/1.5 ${TIPOGRAFIA.texto}`,
                  color: PALETA.textoSecundario,
                }}
              >
                <span style={{ minWidth: 0 }}>{c.rotulo}</span>
                <span
                  style={{
                    flex: "none",
                    font: `600 11px/1.5 ${TIPOGRAFIA.mono}`,
                    color: PALETA.texto,
                  }}
                >
                  {c.valor === null
                    ? c.origem === "apoio"
                      ? "sem dado"
                      : "—"
                    : formatarValor(c.valor, c.unidade)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {r.comparacao === null ? null : (
        <div
          data-teste="chat-comparacao"
          style={{
            border: `1px solid ${PALETA.bordaForte}`,
            background: PALETA.superficieSuave,
            borderRadius: 10,
            padding: "8px 11px",
            font: `400 11px/1.55 ${TIPOGRAFIA.texto}`,
            color: PALETA.textoSecundario,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <strong style={{ color: PALETA.texto }}>
            Contra o custo do dinheiro
            {r.comparacao.base === null
              ? ""
              : `, sobre ${r.comparacao.base.rotulo.toLowerCase()} de ${formatarValor(r.comparacao.base.valor, r.comparacao.base.unidade)}`}
            :
          </strong>
          {r.comparacao.leituras.map((l) => (
            <span key={l.rotulo} data-teste="chat-leitura">
              {l.rotulo}: {formatarValor(l.valor, l.unidade)}, contra{" "}
              {l.referencia.nome} de {formatarValor(l.referencia.valor, "pct")}{" "}
              {l.referencia.periodicidade}.{" "}
              <span style={{ color: PALETA.textoFraco }}>
                {l.referencia.fonte} · vigente desde {l.referencia.vigenteDesde}{" "}
                · {l.formula}
              </span>
            </span>
          ))}
        </div>
      )}

      {r.referencias.length === 0 ? null : (
        <p
          data-teste="chat-referencias"
          style={{
            margin: 0,
            font: `400 10px/1.5 ${TIPOGRAFIA.texto}`,
            color: PALETA.textoTerciario,
          }}
        >
          Referências:{" "}
          {r.referencias
            .map(
              (t) =>
                `${t.nome} ${formatarValor(t.valor, "pct")} ${t.periodicidade} (${t.fonte}, ${t.vigenteDesde})`,
            )
            .join(" · ")}
        </p>
      )}

      <p
        data-teste="chat-formula"
        style={{
          margin: 0,
          font: `400 9.5px/1.5 ${TIPOGRAFIA.mono}`,
          color: PALETA.textoTerciario,
          overflowWrap: "anywhere",
        }}
      >
        {r.metrica === "" ? (
          <>
            consulta ao banco · {String(linhasConsultadas(r.leituras))} linhas ·
            fonte {r.fontes.join(", ")}
          </>
        ) : (
          <>
            {r.formula} · fechamento {r.asOf} · fonte {r.fontes.join(", ")}
          </>
        )}{" "}
        · {autoriaEmTexto(resposta.autoria)} · caminho {r.caminho}
        {r.leituras.length === 0
          ? ""
          : ` · leituras: ${r.leituras.map((l) => l.ferramenta).join(", ")}`}
      </p>

      {/*
        A consulta executada, recolhida (T-454).

        O princípio P3 diz que todo número declara a fórmula. Numa resposta de
        consulta, o SELECT **é** a fórmula: sem ele, o número da tela não teria
        como ser auditado, e é isso que a linha de fórmula dá a toda outra
        resposta.
      */}
      {sqlDaResposta(r.leituras) === null ? null : (
        <details data-teste="chat-consulta-registrada">
          <summary
            style={{
              font: `500 9.5px/1.3 ${TIPOGRAFIA.mono}`,
              color: PALETA.textoTerciario,
              textTransform: "uppercase",
              letterSpacing: ".1em",
              cursor: "pointer",
            }}
          >
            consulta registrada
          </summary>
          <pre
            style={{
              margin: "6px 0 0",
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              font: `400 10px/1.5 ${TIPOGRAFIA.mono}`,
              color: PALETA.textoSecundario,
            }}
          >
            {sqlDaResposta(r.leituras)}
          </pre>
        </details>
      )}

      {r.decisao === null ? null : (
        <details>
          <summary
            style={{
              font: `500 9.5px/1.3 ${TIPOGRAFIA.mono}`,
              color: PALETA.textoTerciario,
              textTransform: "uppercase",
              letterSpacing: ".1em",
              cursor: "pointer",
            }}
          >
            definição registrada
          </summary>
          <p
            style={{
              margin: "6px 0 0",
              font: `400 10.5px/1.6 ${TIPOGRAFIA.texto}`,
              color: PALETA.textoSecundario,
            }}
          >
            {r.decisao}
          </p>
        </details>
      )}

      {resposta.sugestoes.length === 0 ? null : (
        <Atalhos
          rotulo="para continuar"
          textos={resposta.sugestoes}
          aoPerguntar={aoPerguntar}
        />
      )}
    </div>
  );
}

/** Quantas linhas a consulta devolveu, para o rodapé de uma resposta sem métrica. */
function linhasConsultadas(leituras: readonly ResultadoDeFerramenta[]): number {
  let total = 0;
  for (const { leitura } of leituras) {
    if (leitura.tipo === "consulta") total += leitura.linhas.length;
  }
  return total;
}

/** O SELECT executado, quando houve um. É a fórmula de uma resposta de consulta. */
function sqlDaResposta(
  leituras: readonly ResultadoDeFerramenta[],
): string | null {
  for (const { leitura } of leituras) {
    if (leitura.tipo === "consulta") return leitura.sql;
  }
  return null;
}

const ESTILO_DO_TEXTO = {
  margin: 0,
  font: `400 12px/1.6 ${TIPOGRAFIA.texto}`,
  color: PALETA.texto,
} as const;

const ESTILO_DA_LINHA = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  font: `400 11px/1.5 ${TIPOGRAFIA.texto}`,
  color: PALETA.textoSecundario,
} as const;

const ESTILO_DO_NUMERO = {
  flex: "none",
  font: `600 11px/1.5 ${TIPOGRAFIA.mono}`,
  color: PALETA.texto,
} as const;

/** Um par rótulo–valor, com o valor já formatado no servidor. */
function Linha({
  rotulo,
  valor,
}: {
  readonly rotulo: string;
  readonly valor: string | null;
}) {
  return (
    <li style={ESTILO_DA_LINHA}>
      <span style={{ minWidth: 0 }}>{rotulo}</span>
      <span style={ESTILO_DO_NUMERO}>{valor ?? "sem dado"}</span>
    </li>
  );
}

const ESTILO_DA_LISTA = {
  margin: 0,
  padding: 0,
  listStyle: "none",
  display: "flex",
  flexDirection: "column",
  gap: 3,
} as const;

/** Como cada leitura do laço se apresenta na tela. */
const TITULO_DA_LEITURA: Readonly<Record<LeituraDeFerramenta["tipo"], string>> =
  {
    metrica: "métrica",
    serie: "mês a mês",
    comparacao: "comparação",
    variacao: "contra o ano anterior",
    ranking: "ranking",
    decomposicao: "decomposição",
    grafico: "o gráfico",
    catalogo: "métricas próximas",
    consulta: "consulta ao banco",
  };

/**
 * Uma leitura do laço de ferramentas, desenhada sem derivar nada.
 *
 * Só texto que o servidor já formatou: `formatado`, `rotulo`, os destaques
 * escolhidos lá. A mini-tabela do ranking, o pico e o vale da série, as três
 * linhas da variação — tudo é cópia do envelope, como o resto da resposta.
 */
function Leitura({ resultado }: { readonly resultado: ResultadoDeFerramenta }) {
  const l = resultado.leitura;
  return (
    <div
      data-teste="chat-leitura-de-ferramenta"
      data-ferramenta={resultado.ferramenta}
      style={{
        border: `1px solid ${PALETA.borda}`,
        borderRadius: 10,
        padding: "7px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span
        style={{
          font: `500 9px/1.2 ${TIPOGRAFIA.mono}`,
          color: PALETA.textoTerciario,
          textTransform: "uppercase",
          letterSpacing: ".1em",
        }}
      >
        {TITULO_DA_LEITURA[l.tipo]}
        {"rotulo" in l ? ` · ${l.rotulo}` : ""}
        {l.tipo === "grafico" ? ` · ${l.resumo.titulo}` : ""}
      </span>
      <ul style={ESTILO_DA_LISTA}>
        <CorpoDaLeitura leitura={l} />
      </ul>
    </div>
  );
}

function CorpoDaLeitura({
  leitura: l,
}: {
  readonly leitura: LeituraDeFerramenta;
}) {
  switch (l.tipo) {
    case "metrica":
      return <Linha rotulo={l.rotulo} valor={l.formatado} />;
    case "serie":
      return (
        <>
          {l.destaques.map((d) => (
            <Linha
              key={d.tipo}
              rotulo={`${d.tipo === "maior" ? "pico" : d.tipo === "menor" ? "vale" : "último"} · ${d.ponto.rotulo}`}
              valor={d.ponto.formatado}
            />
          ))}
        </>
      );
    case "comparacao":
      return (
        <>
          {l.itens.map((i) => (
            <Linha key={i.metrica} rotulo={i.rotulo} valor={i.formatado} />
          ))}
          {l.diferenca === null ? null : (
            <Linha
              rotulo={`diferença (${l.diferenca.formula})`}
              valor={l.diferenca.formatado}
            />
          )}
        </>
      );
    case "variacao":
      return (
        <>
          <Linha rotulo={l.atual.ano} valor={l.atual.formatado} />
          <Linha rotulo={l.anterior.ano} valor={l.anterior.formatado} />
          {l.diferenca === null ? null : (
            <Linha rotulo="diferença" valor={l.diferenca.formatado} />
          )}
          {l.variacaoPercentual === null ? null : (
            <Linha rotulo="variação" valor={l.variacaoPercentual.formatado} />
          )}
        </>
      );
    case "ranking":
    case "decomposicao":
      return l.abre ? (
        <>
          {l.itens.map((i) => (
            <Linha
              key={i.codigo}
              rotulo={i.rotulo}
              valor={
                i.participacao === null
                  ? i.formatado
                  : `${i.formatado ?? "sem dado"} · ${i.participacao.formatado}`
              }
            />
          ))}
          {l.outros === null ? null : (
            <Linha rotulo="outros" valor={l.outros.formatado} />
          )}
          <Linha rotulo="total" valor={l.total.formatado} />
        </>
      ) : (
        <Linha
          rotulo={`não abre por ${l.dimensao.replace(/_/g, " ")}`}
          valor={null}
        />
      );
    case "grafico":
      return (
        <>
          {l.resumo.destaques.map((d) => (
            <Linha
              key={d.tipo}
              rotulo={`${d.tipo} · ${d.ponto.rotulo}`}
              valor={d.ponto.formatado}
            />
          ))}
          {l.resumo.total === null ? null : (
            <Linha rotulo="total" valor={l.resumo.total.formatado} />
          )}
        </>
      );
    case "catalogo":
      return (
        <>
          {l.metricas.map((m) => (
            <Linha key={m.id} rotulo={m.rotulo} valor={m.unidade} />
          ))}
        </>
      );
    /*
     * A tabela da consulta, uma linha por linha. Só cópia do que o servidor
     * escreveu: a célula já veio formatada pela unidade que o dicionário
     * declara, e esta camada não deriva nada.
     */
    case "consulta":
      return (
        <>
          {l.linhas.map((linha, i) => (
            <Linha
              key={`${linha.rotulo}-${String(i)}`}
              rotulo={
                linha.rotulo === "" ? `linha ${String(i + 1)}` : linha.rotulo
              }
              valor={linha.celulas
                .filter((_, c) => l.colunas[c]?.papel === "numero")
                .map((celula) => celula ?? "sem dado")
                .join(" · ")}
            />
          ))}
          {l.truncado ? <Linha rotulo="lista cortada" valor={null} /> : null}
        </>
      );
  }
}

/**
 * Os atalhos de uma resposta: as perguntas seguintes, como botões.
 *
 * Botões, e não links: a pergunta entra na conversa, e é a conversa que
 * navega. Um link com `?pergunta=` abriria a tela de novo e perderia o fio.
 */
export function Atalhos({
  rotulo,
  textos,
  aoPerguntar,
}: {
  readonly rotulo?: string;
  readonly textos: readonly string[];
  readonly aoPerguntar: (pergunta: string) => void;
}) {
  return (
    <div
      data-teste="chat-atalhos"
      style={{ display: "flex", flexDirection: "column", gap: 5 }}
    >
      {rotulo === undefined ? null : <Rotulo texto={rotulo} />}
      {textos.map((texto) => (
        <button
          key={texto}
          type="button"
          onClick={() => {
            aoPerguntar(texto);
          }}
          style={{
            textAlign: "left",
            border: `1px solid ${PALETA.borda}`,
            background: PALETA.superficie,
            color: MARCA.marca,
            borderRadius: 12,
            padding: "7px 11px",
            font: `400 11px/1.4 ${TIPOGRAFIA.texto}`,
            cursor: "pointer",
          }}
        >
          {texto}
        </button>
      ))}
    </div>
  );
}

/** Um item da lista da resposta, com o mesmo par rótulo–valor do ranking. */
function ItemNaTela({ item }: { readonly item: ItemDaLista }) {
  return (
    <li style={ESTILO_DA_LINHA}>
      <span style={{ minWidth: 0 }}>{item.rotulo}</span>
      {item.valor === null ? null : (
        <span style={ESTILO_DO_NUMERO}>{item.valor}</span>
      )}
    </li>
  );
}

/**
 * O texto da resposta em blocos, com o "Traduzindo" em destaque (T-441) e a
 * lista desenhada como lista (T-444).
 *
 * O modelo escreve até três parágrafos separados por linha em branco; a
 * bolha os desenha um a um. O que começa com "Traduzindo:" ganha o rótulo e
 * uma barra na cor de destaque — é a frase que diz o que o número significa
 * para o negócio. Quem pediu uma lista recebe uma lista, no mesmo desenho do
 * mini-quadro do ranking. O texto montado, sem marca nenhuma, é um parágrafo
 * só.
 */
function TextoDaResposta({ texto }: { readonly texto: string }) {
  return (
    <div
      data-teste="chat-texto"
      style={{ display: "flex", flexDirection: "column", gap: 8 }}
    >
      {blocosDaResposta(texto).map((b) => {
        if (b.tipo === "lista") {
          return (
            <ul
              key={b.itens.map((i) => i.rotulo).join("|")}
              data-teste="chat-lista"
              style={ESTILO_DA_LISTA}
            >
              {b.itens.map((item) => (
                <ItemNaTela key={item.rotulo} item={item} />
              ))}
            </ul>
          );
        }
        return b.rotulo === null ? (
          <p key={b.texto} data-teste="chat-paragrafo" style={ESTILO_DO_TEXTO}>
            {b.texto}
          </p>
        ) : (
          <div
            key={`${b.rotulo}:${b.texto}`}
            data-teste="chat-traduzindo"
            style={{
              borderLeft: `2px solid ${MARCA.destaqueSuave}`,
              padding: "2px 0 2px 10px",
            }}
          >
            <Rotulo texto={b.rotulo} cor={MARCA.destaque} />
            <p style={ESTILO_DO_TEXTO}>{b.texto}</p>
          </div>
        );
      })}
    </div>
  );
}

export function Rotulo({
  texto,
  cor = PALETA.textoTerciario,
}: {
  readonly texto: string;
  readonly cor?: string;
}) {
  return (
    <span
      style={{
        display: "block",
        marginBottom: 4,
        font: `500 8.5px/1.2 ${TIPOGRAFIA.mono}`,
        color: cor,
        textTransform: "uppercase",
        letterSpacing: ".1em",
      }}
    >
      {texto}
    </span>
  );
}

/**
 * De onde veio o texto.
 *
 * Fica escrito na tela de propósito. "Redação recusada" quer dizer que o modelo
 * escreveu um número que não existe no envelope e a resposta dele foi
 * descartada — RF-15 em ação. Esconder isso deixaria a pessoa sem saber que o
 * verificador trabalhou.
 */
function autoriaEmTexto(autoria: Autoria): string {
  switch (autoria) {
    case "modelo":
      return "redigido pelo modelo, números conferidos contra o envelope";
    case "modelo-corrigido":
      return "redigido pelo modelo e corrigido uma vez; números conferidos contra o envelope";
    case "modelo-recusado":
      return "redação do modelo recusada pelo verificador; texto montado do resultado";
    case "gateway-indisponivel":
      return "o gateway do modelo não respondeu; texto montado do resultado";
    default:
      return "texto montado do resultado (sem gateway configurado)";
  }
}
