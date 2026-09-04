import { formatarValor } from "@/apresentacao/formato/formato";
import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";
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
            color: PALETA.marca,
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
