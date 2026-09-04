"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import {
  assinarConversa,
  escreverConversa,
  lerConversa,
  lerConversaNoServidor,
} from "@/apresentacao/chat/armazem";
import {
  destinoDe,
  filtrosAplicados,
  historicoDe,
  separarLinhas,
  type Turno,
} from "@/apresentacao/chat/conversa";
import { rolarAte } from "@/apresentacao/chat/Destaque";
import {
  Atalhos,
  RespostaDoChat,
  Rotulo,
} from "@/apresentacao/chat/RespostaDoChat";
import { formatarValor } from "@/apresentacao/formato/formato";
import { acharTela } from "@/apresentacao/navegacao/telas";
import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";
import type { LinhaDoFluxo, PedidoDeChat, Previa } from "@/chat/protocolo";
import { sugestoesDaTela } from "@/chat/sugestoes";
import { QUERY_PADRAO } from "@/semantica/contrato";
import { ROTULO_DO_FILTRO, rotuloDe } from "@/semantica/dimensoes";

/**
 * O chat, como conversa (seção 7; decisão D-CHAT-conversa-flutuante).
 *
 * Fechado, é um botão flutuante no canto — o do protótipo. Aberto, encosta à
 * direita da tela como uma coluna própria, e o painel encolhe para caber ao
 * lado: o gráfico que a resposta destaca fica **visível**, e não escondido
 * atrás da conversa que fala dele. É a razão de não ser uma sobreposição.
 *
 * ## É componente de cliente, e é o único fora dos gráficos
 *
 * Uma conversa é estado que muda a cada tecla e sobrevive à navegação — a
 * resposta leva a pessoa a outra tela, e a conversa precisa continuar lá. O
 * servidor não tem onde guardar isso sem virar sessão, e a URL não tem onde
 * pôr dez turnos sem deixar de ser legível. Então a conversa vive no
 * navegador (`armazem.ts`), com cópia em `sessionStorage` para sobreviver a
 * recarregar. O que a seção 6.6 promete — filtros, tela e painel destacado na
 * URL — continua na URL: é o que este componente escreve nela quando a
 * resposta chega.
 *
 * ## O que ele não faz
 *
 * Não lê dado, não calcula e não formata além de `formatarValor`. Manda a
 * pergunta, a busca da URL e os turnos anteriores para `/api/chat`, e desenha
 * o que volta. O número nasce no servidor, no estágio 2, e o verificador
 * confere o texto antes de ele chegar aqui (RF-15). A rota responde em duas
 * fases, e a tela reage à primeira: assim que o número existe, os filtros e o
 * painel destacado vão para a URL, e a pessoa vê o gráfico enquanto o modelo
 * ainda escreve.
 */

const LARGURA_DO_PAINEL = 392;
const MARGEM_DO_PAINEL = 14;
/** O respiro do log; `offsetTop` de uma pergunta é medido contra ele. */
const MARGEM_DO_LOG = 14;
const ROTA_DA_API = "/api/chat";

export function Chat() {
  // `useSearchParams` pede uma fronteira de Suspense acima (documentação do
  // Next desta versão). A tela é dinâmica, então o fallback nunca aparece.
  return (
    <Suspense fallback={null}>
      <ChatNaTela />
    </Suspense>
  );
}

function ChatNaTela() {
  const caminho = usePathname();
  const busca = useSearchParams();
  const roteador = useRouter();

  const [idDoModulo = "", slug = ""] = caminho
    .split("/")
    .filter((p) => p !== "");
  const achado = acharTela(idDoModulo, slug);
  const rota =
    achado === undefined ? null : `/${achado.modulo.id}/${achado.tela.slug}`;

  const conversa = useSyncExternalStore(
    assinarConversa,
    lerConversa,
    lerConversaNoServidor,
  );
  const [texto, setTexto] = useState("");
  const emAndamento = useRef(false);
  const contador = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);
  const campoRef = useRef<HTMLTextAreaElement>(null);

  // O log leva a última pergunta ao topo: quem pergunta lê a pergunta e a
  // resposta de cima para baixo, em vez de cair no fim de um texto longo.
  useEffect(() => {
    const log = logRef.current;
    if (log === null) return;
    const perguntas = log.querySelectorAll<HTMLElement>(
      '[data-teste="chat-pergunta"]',
    );
    const ultima = perguntas[perguntas.length - 1];
    log.scrollTop = ultima === undefined ? 0 : ultima.offsetTop - MARGEM_DO_LOG;
  }, [conversa.turnos, conversa.aberto]);

  useEffect(() => {
    if (conversa.aberto) campoRef.current?.focus();
  }, [conversa.aberto]);

  const atualizarTurno = useCallback((id: string, mudanca: Partial<Turno>) => {
    escreverConversa((c) => ({
      ...c,
      turnos: c.turnos.map((t) => (t.id === id ? { ...t, ...mudanca } : t)),
    }));
  }, []);

  const perguntar = useCallback(
    async (pergunta: string) => {
      const limpa = pergunta.trim();
      if (limpa === "" || emAndamento.current || rota === null) return;
      emAndamento.current = true;

      contador.current += 1;
      const id = `${String(Date.now())}-${String(contador.current)}`;
      const buscaAtual = busca.toString();
      const origem = buscaAtual === "" ? caminho : `${caminho}?${buscaAtual}`;
      const pedido: PedidoDeChat = {
        pergunta: limpa,
        busca: buscaAtual,
        historico: historicoDe(lerConversa().turnos),
      };

      setTexto("");
      escreverConversa((c) => ({
        aberto: true,
        turnos: [
          ...c.turnos,
          {
            id,
            pergunta: limpa,
            origem,
            estado: "consultando",
            previa: null,
            resposta: null,
            falha: null,
          },
        ],
      }));

      // A tela reage uma vez por resposta: na prévia, quando o número existe.
      let aplicado: string | null = null;
      const aplicar = (acoes: Previa["acoes"]) => {
        const destino = destinoDe(acoes, rota);
        if (destino === aplicado) return;
        aplicado = destino;
        if (destino === origem) {
          // Já estamos na tela e no recorte: só falta rolar até o painel.
          if (acoes.painel !== null) rolarAte(acoes.painel);
          return;
        }
        roteador.push(destino);
      };

      const tratar = (linha: string) => {
        const l = JSON.parse(linha) as LinhaDoFluxo;
        if (l.fase === "previa") {
          atualizarTurno(id, { estado: "redigindo", previa: l.previa });
          aplicar(l.previa.acoes);
        } else if (l.fase === "resposta") {
          atualizarTurno(id, { estado: "pronta", resposta: l.resposta });
          if (l.resposta.tipo === "resposta") {
            aplicar(l.resposta.resolucao.acoes);
          }
        } else {
          atualizarTurno(id, { estado: "falhou", falha: l.motivo });
        }
      };

      try {
        const resposta = await fetch(ROTA_DA_API, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(pedido),
        });
        if (!resposta.ok || resposta.body === null) {
          throw new Error(`HTTP ${String(resposta.status)}`);
        }
        const leitor = resposta.body.getReader();
        const decodificador = new TextDecoder();
        let resto = "";
        for (;;) {
          const { done, value } = await leitor.read();
          if (done) break;
          resto += decodificador.decode(value, { stream: true });
          const separado = separarLinhas(resto);
          resto = separado.resto;
          for (const linha of separado.completas) tratar(linha);
        }
        resto += decodificador.decode();
        if (resto.trim() !== "") tratar(resto);
        // O fluxo acabou sem fase final: a rota caiu no meio.
        escreverConversa((c) => ({
          ...c,
          turnos: c.turnos.map((t) =>
            t.id === id && t.resposta === null && t.falha === null
              ? { ...t, estado: "falhou", falha: "rede" }
              : t,
          ),
        }));
      } catch {
        atualizarTurno(id, { estado: "falhou", falha: "rede" });
      } finally {
        emAndamento.current = false;
      }
    },
    [atualizarTurno, busca, caminho, rota, roteador],
  );

  // `?pergunta=` na URL: um link que já chega perguntando. Só uma vez por
  // pergunta — a conversa guardada diz se ela já foi feita.
  useEffect(() => {
    const pedida = busca.get("pergunta")?.trim() ?? "";
    if (pedida === "") return;
    if (lerConversa().turnos.at(-1)?.pergunta === pedida) return;
    void perguntar(pedida);
  }, [busca, perguntar]);

  if (rota === null) return null;

  const abrir = () => {
    escreverConversa((c) => ({ ...c, aberto: true }));
  };
  const fechar = () => {
    escreverConversa((c) => ({ ...c, aberto: false }));
  };
  const limpar = () => {
    escreverConversa(() => ({ aberto: true, turnos: [] }));
  };

  if (!conversa.aberto) {
    return (
      <div
        data-teste="chat-flutuante"
        style={{
          position: "fixed",
          right: 22,
          bottom: 22,
          zIndex: 60,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <button
          type="button"
          onClick={abrir}
          style={{
            border: `1px solid ${PALETA.bordaForte}`,
            background: PALETA.superficie,
            color: PALETA.textoSecundario,
            borderRadius: 999,
            padding: "10px 16px",
            font: `500 11.5px/1.2 ${TIPOGRAFIA.texto}`,
            cursor: "pointer",
            boxShadow: `0 6px 18px color-mix(in srgb, ${PALETA.barraLateral} 14%, transparent)`,
            whiteSpace: "nowrap",
          }}
        >
          Pergunte sobre os dados
        </button>
        <button
          type="button"
          onClick={abrir}
          data-teste="chat-abrir"
          aria-label="Abrir a conversa com os dados"
          style={{
            border: 0,
            background: PALETA.barraLateral,
            color: PALETA.textoEmBarra,
            width: 58,
            height: 58,
            borderRadius: "50%",
            cursor: "pointer",
            boxShadow: `0 14px 34px -8px color-mix(in srgb, ${PALETA.barraLateral} 45%, transparent)`,
            font: `600 14px/1 ${TIPOGRAFIA.mono}`,
            letterSpacing: ".02em",
          }}
        >
          IA
        </button>
      </div>
    );
  }

  const ultimo = conversa.turnos.at(-1);
  const ocupado =
    ultimo !== undefined &&
    (ultimo.estado === "consultando" || ultimo.estado === "redigindo");
  const guia = sugestoesDaTela(rota.slice(1));

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    void perguntar(texto);
  };
  const aoTeclar = (evento: KeyboardEvent<HTMLTextAreaElement>) => {
    if (evento.key === "Enter" && !evento.shiftKey) {
      evento.preventDefault();
      void perguntar(texto);
    }
  };

  return (
    <aside
      data-teste="chat"
      aria-label="Conversa com os dados"
      onKeyDown={(evento) => {
        if (evento.key === "Escape") fechar();
      }}
      style={{
        flex: "none",
        width: LARGURA_DO_PAINEL + 2 * MARGEM_DO_PAINEL,
        height: "100vh",
        padding: MARGEM_DO_PAINEL,
        boxSizing: "border-box",
        display: "flex",
      }}
    >
      <div
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          minWidth: 0,
          background: PALETA.superficieSuave,
          border: `1px solid ${PALETA.borda}`,
          borderRadius: 24,
          boxShadow: `0 36px 80px -24px color-mix(in srgb, ${PALETA.barraLateral} 45%, transparent), 0 2px 8px color-mix(in srgb, ${PALETA.barraLateral} 8%, transparent)`,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            padding: "13px 14px 12px",
            borderBottom: `1px solid ${PALETA.borda}`,
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: PALETA.superficie,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 27,
              height: 27,
              borderRadius: 9,
              background: PALETA.barraLateral,
              color: PALETA.textoEmBarra,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              font: `600 10px/1 ${TIPOGRAFIA.mono}`,
              flex: "none",
            }}
          >
            IA
          </span>
          <div style={{ flex: "1 1 auto", minWidth: 0 }}>
            <div
              style={{
                font: `600 12px/1.2 ${TIPOGRAFIA.texto}`,
                color: PALETA.texto,
              }}
            >
              Converse com os dados
            </div>
            <div
              style={{
                font: `400 9.5px/1.3 ${TIPOGRAFIA.texto}`,
                color: PALETA.textoFraco,
              }}
            >
              Responde, filtra e abre o gráfico
            </div>
          </div>
          {conversa.turnos.length === 0 ? null : (
            <button
              type="button"
              onClick={limpar}
              data-teste="chat-nova"
              disabled={ocupado}
              style={{
                border: `1px solid ${PALETA.bordaForte}`,
                background: PALETA.superficie,
                color: PALETA.textoTerciario,
                borderRadius: 999,
                padding: "6px 10px",
                font: `500 10px/1 ${TIPOGRAFIA.texto}`,
                cursor: ocupado ? "default" : "pointer",
                flex: "none",
              }}
            >
              Nova conversa
            </button>
          )}
          <button
            type="button"
            onClick={fechar}
            data-teste="chat-fechar"
            aria-label="Fechar a conversa"
            style={{
              border: `1px solid ${PALETA.bordaForte}`,
              background: PALETA.superficie,
              color: PALETA.textoTerciario,
              borderRadius: 999,
              width: 27,
              height: 27,
              font: `600 12px/1 ${TIPOGRAFIA.texto}`,
              cursor: "pointer",
              flex: "none",
            }}
          >
            ✕
          </button>
        </header>

        <div
          ref={logRef}
          data-teste="chat-log"
          role="log"
          aria-live="polite"
          aria-busy={ocupado}
          style={{
            position: "relative",
            flex: "1 1 auto",
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            padding: `${String(MARGEM_DO_LOG)}px 16px`,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {conversa.turnos.length === 0 ? (
            <Bolha>
              <p style={{ margin: 0 }}>
                Pergunte aos dados desta tela ou de qualquer outra. A resposta
                traz o número, o que entrou na conta e a fórmula — e abre o
                gráfico certo, no recorte da pergunta.
              </p>
            </Bolha>
          ) : (
            conversa.turnos.map((turno) => (
              <TurnoNaTela
                key={turno.id}
                turno={turno}
                rota={rota}
                aoPerguntar={(p) => {
                  void perguntar(p);
                }}
              />
            ))
          )}
        </div>

        <footer
          style={{
            borderTop: `1px solid ${PALETA.borda}`,
            padding: "11px 14px 13px",
            background: PALETA.superficieSuave,
          }}
        >
          {guia.length === 0 ? null : (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 7,
                }}
              >
                <span
                  style={{
                    font: `600 8.5px/1.2 ${TIPOGRAFIA.mono}`,
                    color: PALETA.destaque,
                    textTransform: "uppercase",
                    letterSpacing: ".1em",
                    whiteSpace: "nowrap",
                  }}
                >
                  Guia desta tela
                </span>
                <span
                  aria-hidden="true"
                  style={{
                    flex: "1 1 auto",
                    height: 1,
                    background: PALETA.grade,
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 5,
                  marginBottom: 9,
                }}
              >
                {guia.map((pergunta) => (
                  <button
                    key={pergunta}
                    type="button"
                    data-teste="chat-guia"
                    disabled={ocupado}
                    onClick={() => {
                      void perguntar(pergunta);
                    }}
                    style={{
                      border: `1px solid ${PALETA.bordaForte}`,
                      background: PALETA.superficie,
                      color: PALETA.marca,
                      borderRadius: 999,
                      padding: "6px 11px",
                      font: `400 10px/1.3 ${TIPOGRAFIA.texto}`,
                      cursor: ocupado ? "default" : "pointer",
                      textAlign: "left",
                    }}
                  >
                    {pergunta}
                  </button>
                ))}
              </div>
            </>
          )}

          <form
            onSubmit={enviar}
            style={{ display: "flex", gap: 7, alignItems: "flex-end" }}
          >
            <textarea
              ref={campoRef}
              value={texto}
              onChange={(evento) => {
                setTexto(evento.target.value);
              }}
              onKeyDown={aoTeclar}
              rows={2}
              placeholder="Ex.: qual o lucro apurado do ano?"
              aria-label="Sua pergunta"
              data-teste="chat-campo"
              readOnly={ocupado}
              style={{
                flex: "1 1 auto",
                minWidth: 0,
                resize: "none",
                border: `1px solid ${PALETA.bordaForte}`,
                background: PALETA.superficie,
                borderRadius: 14,
                padding: "9px 12px",
                font: `400 11.5px/1.5 ${TIPOGRAFIA.texto}`,
                color: ocupado ? PALETA.textoTerciario : PALETA.texto,
              }}
            />
            <button
              type="submit"
              data-teste="chat-enviar"
              disabled={ocupado || texto.trim() === ""}
              style={{
                border: 0,
                background: ocupado ? PALETA.destaque : PALETA.barraLateral,
                color: PALETA.textoEmBarra,
                borderRadius: 999,
                padding: "0 17px",
                height: 40,
                font: `500 11px/1 ${TIPOGRAFIA.texto}`,
                cursor: ocupado ? "progress" : "pointer",
                flex: "none",
              }}
            >
              {ocupado ? "Consultando…" : "Enviar"}
            </button>
          </form>
          <p
            style={{
              margin: "7px 0 0",
              font: `400 9px/1.4 ${TIPOGRAFIA.texto}`,
              color: PALETA.textoFraco,
            }}
          >
            Cada número da resposta é conferido contra o painel antes de
            aparecer. Enter envia; Shift+Enter quebra a linha.
          </p>
        </footer>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ *
 * Um turno: a pergunta e o que veio dela
 * ------------------------------------------------------------------ */

function TurnoNaTela({
  turno,
  rota,
  aoPerguntar,
}: {
  readonly turno: Turno;
  readonly rota: string;
  readonly aoPerguntar: (pergunta: string) => void;
}) {
  return (
    <>
      <div
        data-teste="chat-pergunta"
        style={{
          alignSelf: "flex-end",
          maxWidth: "88%",
          background: PALETA.barraLateral,
          color: PALETA.textoEmBarra,
          borderRadius: "16px 16px 4px 16px",
          padding: "9px 12px",
          font: `400 11.5px/1.5 ${TIPOGRAFIA.texto}`,
          whiteSpace: "pre-line",
          overflowWrap: "anywhere",
        }}
      >
        {turno.pergunta}
      </div>
      <div
        data-teste="chat-turno"
        data-estado={turno.estado}
        style={{
          alignSelf: "flex-start",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <CorpoDoTurno turno={turno} rota={rota} aoPerguntar={aoPerguntar} />
      </div>
    </>
  );
}

function CorpoDoTurno({
  turno,
  rota,
  aoPerguntar,
}: {
  readonly turno: Turno;
  readonly rota: string;
  readonly aoPerguntar: (pergunta: string) => void;
}) {
  switch (turno.estado) {
    case "consultando":
      return (
        <Bolha>
          <p role="status" data-teste="chat-pendente" style={{ margin: 0 }}>
            Lendo os dados…
          </p>
        </Bolha>
      );

    case "redigindo": {
      const previa = turno.previa;
      return (
        <>
          <Bolha>
            {previa === null ? null : (
              <p
                data-teste="chat-previa"
                style={{
                  margin: "0 0 4px",
                  font: `500 12px/1.5 ${TIPOGRAFIA.texto}`,
                  color: PALETA.texto,
                }}
              >
                {previa.rotulo}:{" "}
                <span style={{ font: `600 12px/1.5 ${TIPOGRAFIA.mono}` }}>
                  {previa.valor === null
                    ? "sem dado neste recorte"
                    : formatarValor(previa.valor, previa.unidade)}
                </span>
              </p>
            )}
            <p
              role="status"
              data-teste="chat-pendente"
              style={{ margin: 0, color: PALETA.textoTerciario }}
            >
              Número conferido. Redigindo a leitura…
            </p>
          </Bolha>
          {previa === null ? null : (
            <AcoesAplicadas
              acoes={previa.acoes}
              origem={turno.origem}
              rota={rota}
            />
          )}
        </>
      );
    }

    case "pronta": {
      const resposta = turno.resposta;
      if (resposta === null) return null;
      return (
        <>
          <Bolha>
            <RespostaDoChat resposta={resposta} aoPerguntar={aoPerguntar} />
          </Bolha>
          {resposta.tipo === "resposta" ? (
            <AcoesAplicadas
              acoes={resposta.resolucao.acoes}
              origem={turno.origem}
              rota={rota}
            />
          ) : null}
        </>
      );
    }

    case "falhou":
      return (
        <Bolha>
          <div
            data-teste="chat-falha"
            data-motivo={turno.falha ?? ""}
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
          >
            <p style={{ margin: 0 }}>{fraseDaFalha(turno.falha)}</p>
            {turno.falha === "rede" ? (
              <Atalhos textos={[turno.pergunta]} aoPerguntar={aoPerguntar} />
            ) : null}
          </div>
        </Bolha>
      );
  }
}

/** As frases da seção 6.4, na voz do chat. Nenhuma traz número. */
function fraseDaFalha(falha: Turno["falha"]): string {
  switch (falha) {
    case "sem_permissao":
      return "Você não tem acesso a este recorte.";
    case "erro_de_fonte":
      return "Não foi possível ler a fonte agora. Tente de novo em instantes.";
    default:
      return "Não consegui falar com o servidor. Quer tentar de novo?";
  }
}

/**
 * O que a resposta fez com a tela (RF-13), e o caminho de volta (RF-14).
 *
 * Os chips dizem o recorte e a tela aplicados. "Ver o gráfico" reabre o
 * destino — útil quando a pessoa já navegou para longe. "Desfazer" volta à
 * URL em que a pergunta foi feita: filtros **e** tela, como o Anexo D achado 7
 * pede. Os dois são links: funcionam por teclado, mostram o destino e não
 * dependem de estado nenhum além da URL.
 */
function AcoesAplicadas({
  acoes,
  origem,
  rota,
}: {
  readonly acoes: Previa["acoes"];
  readonly origem: string;
  readonly rota: string;
}) {
  const destino = destinoDe(acoes, rota);
  const [idDoModulo = "", slug = ""] = (acoes.tela ?? rota.slice(1)).split("/");
  const tela = acharTela(idDoModulo, slug);

  const chips = filtrosAplicados(acoes.filtros, QUERY_PADRAO).map(
    (campo) =>
      `${ROTULO_DO_FILTRO[campo]}: ${rotuloDe(campo, acoes.filtros[campo])}`,
  );
  if (tela !== undefined) {
    chips.push(`Tela: ${tela.modulo.nome} · ${tela.tela.titulo}`);
  }

  return (
    <div
      data-teste="chat-acoes"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        background: PALETA.grade,
        border: `1px solid ${PALETA.bordaForte}`,
        borderRadius: 14,
        padding: "9px 12px",
      }}
    >
      <Rotulo texto="ações aplicadas" />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {chips.map((chip) => (
          <span
            key={chip}
            style={{
              background: PALETA.superficie,
              border: `1px solid ${PALETA.bordaForte}`,
              borderRadius: 999,
              padding: "4px 10px",
              font: `500 9.5px/1.3 ${TIPOGRAFIA.texto}`,
              color: PALETA.textoSecundario,
            }}
          >
            {chip}
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
        <Link
          href={destino}
          data-teste="chat-ver-grafico"
          style={{
            background: PALETA.barraLateral,
            color: PALETA.textoEmBarra,
            borderRadius: 999,
            padding: "6px 12px",
            font: `500 10px/1 ${TIPOGRAFIA.texto}`,
            textDecoration: "none",
          }}
        >
          Ver o gráfico
        </Link>
        <Link
          href={origem}
          data-teste="chat-desfazer"
          style={{
            border: `1px solid ${PALETA.bordaForte}`,
            background: PALETA.superficie,
            color: PALETA.marca,
            borderRadius: 999,
            padding: "5px 12px",
            font: `500 10px/1 ${TIPOGRAFIA.texto}`,
            textDecoration: "none",
          }}
        >
          Desfazer
        </Link>
      </div>
    </div>
  );
}

/** A bolha da resposta: fundo claro, à esquerda, com a largura toda. */
function Bolha({ children }: { readonly children: ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        boxSizing: "border-box",
        background: PALETA.superficie,
        border: `1px solid ${PALETA.borda}`,
        borderRadius: "4px 16px 16px 16px",
        padding: "10px 12px",
        font: `400 11.5px/1.55 ${TIPOGRAFIA.texto}`,
        color: PALETA.textoSecundario,
      }}
    >
      {children}
    </div>
  );
}
