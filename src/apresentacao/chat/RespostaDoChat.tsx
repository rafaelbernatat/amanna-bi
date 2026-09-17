import { formatarValor } from "@/apresentacao/formato/formato";
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
      </div>
    );
  }

  const { resolucao: r } = resposta;

  return (
    <div
      data-teste="chat-resposta"
      style={{ display: "flex", flexDirection: "column", gap: 10 }}
    >
      <p style={ESTILO_DO_TEXTO}>{resposta.texto}</p>

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
        {r.formula} · fechamento {r.asOf} · fonte {r.fontes.join(", ")} ·{" "}
        {autoriaEmTexto(resposta.autoria)}
        {r.leituras.length === 0
          ? ""
          : ` · leituras: ${r.leituras.map((l) => l.ferramenta).join(", ")}`}
      </p>

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

export function Rotulo({ texto }: { readonly texto: string }) {
  return (
    <span
      style={{
        display: "block",
        marginBottom: 4,
        font: `500 8.5px/1.2 ${TIPOGRAFIA.mono}`,
        color: PALETA.textoTerciario,
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
    case "modelo-recusado":
      return "redação do modelo recusada pelo verificador; texto montado do resultado";
    case "gateway-indisponivel":
      return "o gateway do modelo não respondeu; texto montado do resultado";
    default:
      return "texto montado do resultado (sem gateway configurado)";
  }
}
