import { formatarValor } from "@/apresentacao/formato/formato";
import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";
import type { Autoria, Resposta } from "@/chat/perguntar";
import type { Query } from "@/semantica/contrato";
import { rotaCom } from "@/semantica/url";

/**
 * O chat, na tela (seção 6.5 e 7.2).
 *
 * ## Sem JavaScript, e isso não é economia
 *
 * A pergunta é um `<form method="get">`: ela vai para a URL, o servidor resolve
 * e a página volta com a resposta. O mesmo mecanismo dos cinco filtros (T-127),
 * e pela mesma razão — a seção 6.6 promete que **colar a URL reproduz a tela**,
 * e uma conversa que só existe na memória do navegador não se cola em lugar
 * nenhum.
 *
 * O efeito prático é o que a diretoria pede: a pergunta e a resposta viram um
 * link que se manda por e-mail, e quem abre vê o mesmo número com o mesmo
 * recorte — desde que tenha o mesmo perfil de acesso.
 *
 * ## Enquanto o modelo trabalha
 *
 * Os dois estágios do modelo levam de 15 a 30 segundos. A tela chega antes,
 * em streaming, com este painel em estado `pendente`: o botão diz que está
 * consultando, a caixa fica travada e um aviso explica a espera. É a página
 * quem decide (Suspense, em `[modulo]/[tela]`); aqui só se desenha o estado.
 *
 * ## O que a caixa mostra, e por que nessa ordem
 *
 * O número primeiro, porque é o que foi perguntado. Depois **o que entrou na
 * conta**, que é a diferença entre uma resposta e uma afirmação. Depois a
 * comparação com o custo do dinheiro, que é o que transforma o número em
 * leitura. E por último a fórmula e a definição — quem quer auditar encontra,
 * quem quer o número já leu.
 */
export function PainelDeChat({
  pergunta,
  resposta,
  pendente = false,
  rota,
  query,
}: {
  readonly pergunta: string;
  readonly resposta: Resposta | null;
  /** A pergunta foi feita e o modelo ainda não respondeu. */
  readonly pendente?: boolean;
  readonly rota: string;
  readonly query: Query;
}) {
  return (
    <section
      data-teste="chat"
      aria-label="Perguntar aos dados"
      aria-busy={pendente}
      style={{
        background: PALETA.superficie,
        border: `1px solid ${PALETA.borda}`,
        borderRadius: 17,
        padding: "14px 16px",
        marginBottom: 14,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <Formulario
        pergunta={pergunta}
        pendente={pendente}
        rota={rota}
        query={query}
      />
      {pendente ? (
        <Consultando />
      ) : resposta === null ? (
        <Sugestoes rota={rota} query={query} />
      ) : (
        <Corpo resposta={resposta} rota={rota} query={query} />
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * A pergunta
 * ------------------------------------------------------------------ */

function Formulario({
  pergunta,
  pendente,
  rota,
  query,
}: {
  readonly pergunta: string;
  readonly pendente: boolean;
  readonly rota: string;
  readonly query: Query;
}) {
  return (
    <form
      method="get"
      action={rota}
      style={{ display: "flex", gap: 8, alignItems: "center" }}
    >
      {/*
        Os cinco filtros viajam junto como campos escondidos. Sem isso, perguntar
        sob um recorte devolveria a resposta no consolidado — e a pessoa leria um
        número que não é o da tela que ela está vendo.
      */}
      {(["periodo", "ano", "entidade", "area", "modalidade"] as const).map(
        (campo) => (
          <input key={campo} type="hidden" name={campo} value={query[campo]} />
        ),
      )}

      <input
        type="text"
        name="pergunta"
        defaultValue={pergunta}
        readOnly={pendente}
        placeholder="Pergunte aos dados — ex.: qual o lucro apurado do ano"
        aria-label="Sua pergunta"
        style={{
          flex: "1 1 auto",
          minWidth: 0,
          font: `400 12.5px/1.4 ${TIPOGRAFIA.texto}`,
          color: pendente ? PALETA.textoTerciario : PALETA.texto,
          background: PALETA.superficieSuave,
          border: `1px solid ${PALETA.bordaForte}`,
          borderRadius: 10,
          padding: "9px 12px",
        }}
      />
      <button
        type="submit"
        disabled={pendente}
        style={{
          flex: "none",
          font: `500 11.5px/1 ${TIPOGRAFIA.texto}`,
          color: PALETA.textoEmBarra,
          background: pendente ? PALETA.destaque : PALETA.marca,
          border: "none",
          borderRadius: 10,
          padding: "10px 16px",
          cursor: pendente ? "progress" : "pointer",
        }}
      >
        {pendente ? "Consultando…" : "Perguntar"}
      </button>
    </form>
  );
}

/** O aviso enquanto o modelo lê e redige. Texto fixo: não há número aqui. */
function Consultando() {
  return (
    <p
      role="status"
      data-teste="chat-pendente"
      style={{
        margin: 0,
        font: `400 12px/1.6 ${TIPOGRAFIA.texto}`,
        color: PALETA.textoTerciario,
      }}
    >
      Lendo os dados e redigindo a resposta. Leva alguns segundos; se a pergunta
      for de outra tela, o painel abre lá.
    </p>
  );
}

function Sugestoes({
  rota,
  query,
}: {
  readonly rota: string;
  readonly query: Query;
}) {
  const EXEMPLOS = [
    "qual o lucro apurado do ano",
    "como está o turnover",
    "quanto é a folha total",
  ];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {EXEMPLOS.map((exemplo) => (
        <Atalho key={exemplo} texto={exemplo} rota={rota} query={query} />
      ))}
    </div>
  );
}

function Atalho({
  texto,
  rota,
  query,
}: {
  readonly texto: string;
  readonly rota: string;
  readonly query: Query;
}) {
  const alvo = `${rotaCom(rota, query)}${rotaCom(rota, query).includes("?") ? "&" : "?"}pergunta=${encodeURIComponent(texto)}`;
  return (
    <a
      href={alvo}
      style={{
        font: `400 11px/1.2 ${TIPOGRAFIA.texto}`,
        color: PALETA.textoSecundario,
        background: PALETA.superficieSuave,
        border: `1px solid ${PALETA.borda}`,
        borderRadius: 999,
        padding: "6px 11px",
        textDecoration: "none",
      }}
    >
      {texto}
    </a>
  );
}

/* ------------------------------------------------------------------ *
 * A resposta
 * ------------------------------------------------------------------ */

function Corpo({
  resposta,
  rota,
  query,
}: {
  readonly resposta: Resposta;
  readonly rota: string;
  readonly query: Query;
}) {
  if (resposta.tipo === "recusa") {
    return (
      <div data-teste="chat-recusa">
        <p
          style={{
            margin: "0 0 8px",
            font: `400 12px/1.6 ${TIPOGRAFIA.texto}`,
            color: PALETA.textoSecundario,
          }}
        >
          {resposta.texto}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {resposta.alternativas.map((a) => (
            <Atalho key={a.id} texto={a.rotulo} rota={rota} query={query} />
          ))}
        </div>
      </div>
    );
  }

  const { resolucao: r } = resposta;

  return (
    <div
      data-teste="chat-resposta"
      style={{ display: "flex", flexDirection: "column", gap: 11 }}
    >
      <p
        style={{
          margin: 0,
          font: `400 13px/1.65 ${TIPOGRAFIA.texto}`,
          color: PALETA.texto,
          maxWidth: "80ch",
        }}
      >
        {resposta.texto}
      </p>

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
              flexWrap: "wrap",
              gap: "4px 18px",
            }}
          >
            {r.consideracoes.map((c) => (
              <li
                key={`${c.origem}-${c.rotulo}`}
                style={{
                  font: `400 11.5px/1.5 ${TIPOGRAFIA.texto}`,
                  color: PALETA.textoSecundario,
                }}
              >
                {c.rotulo}{" "}
                <span
                  style={{
                    font: `600 11.5px/1.5 ${TIPOGRAFIA.mono}`,
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
            padding: "9px 12px",
            font: `400 11.5px/1.55 ${TIPOGRAFIA.texto}`,
            color: PALETA.textoSecundario,
            maxWidth: "80ch",
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
            font: `400 10.5px/1.5 ${TIPOGRAFIA.texto}`,
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
          font: `400 10px/1.5 ${TIPOGRAFIA.mono}`,
          color: PALETA.textoTerciario,
        }}
      >
        {r.formula} · fechamento {r.asOf} · fonte {r.fontes.join(", ")} ·{" "}
        {autoriaEmTexto(resposta.autoria)}
      </p>

      {r.decisao === null ? null : (
        <details>
          <summary
            style={{
              font: `500 10px/1.3 ${TIPOGRAFIA.mono}`,
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
              font: `400 11px/1.6 ${TIPOGRAFIA.texto}`,
              color: PALETA.textoSecundario,
              maxWidth: "80ch",
            }}
          >
            {r.decisao}
          </p>
        </details>
      )}

      {resposta.sugestoes.length === 0 ? null : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {resposta.sugestoes.map((s) => (
            <Atalho key={s} texto={s} rota={rota} query={query} />
          ))}
        </div>
      )}
    </div>
  );
}

function Rotulo({ texto }: { readonly texto: string }) {
  return (
    <span
      style={{
        display: "block",
        marginBottom: 4,
        font: `500 9px/1.2 ${TIPOGRAFIA.mono}`,
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
