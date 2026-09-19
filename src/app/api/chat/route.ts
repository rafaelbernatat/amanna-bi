import { dimensoesProvisorias } from "@/acesso/dimensoes-provisorias";
import { lerIdentidade, lerVisitante } from "@/acesso/leitura";
import { contextoDe } from "@/chat/contexto";
import { controleDoProcesso, type MotivoDeLimite } from "@/chat/limite";
import { registrarIncidente } from "@/chat/incidente";
import { lerPedido, previaDe } from "@/chat/pedido";
import { redigirResposta, resolverPergunta } from "@/chat/perguntar";
import {
  CABECALHO_DE_PERGUNTAS_RESTANTES,
  PERGUNTAS_POR_CONVIDADO,
  perguntasRestantes,
  type CorpoDeRecusa,
  type LinhaDoFluxo,
  type MotivoDeFalha,
  type Previa,
} from "@/chat/protocolo";
import type { Resolucao } from "@/chat/resolver";
import { primeiroNome } from "@/convidados/cadastro";
import { armazemDeConvidados } from "@/convidados/registrar";
import { tokensDoProcesso } from "@/gateway/openrouter";
import { SessaoAusente } from "@/seguranca/convite";
import { GraoProibido } from "@/seguranca/grao";
import { ForaDoEscopo } from "@/seguranca/identidade";
import { origemPropria } from "@/seguranca/origem";

/**
 * A rota do chat (seção 7; T-320 em parte; D-CONVITE-apresentacao).
 *
 * `POST /api/chat` recebe a pergunta, a tela aberta, a busca da URL e os
 * turnos anteriores; devolve a resposta em duas fases, uma linha de JSON por
 * fase (ver `protocolo.ts`).
 *
 * ## A ordem das conferências
 *
 * Sessão, origem, limite de uso — nesta ordem, e todas antes de abrir o fluxo.
 * Sem sessão não há de quem contar o limite; origem cruzada não deve consumir
 * cota de ninguém; e o limite decide se a pergunta chega a existir. Depois
 * disso o corpo é lido.
 *
 * ## O perfil entra pelo mesmo caminho da tela
 *
 * Nada aqui lê dado. Os estágios 1 e 2 chamam `lerMetrica`, `lerPainel` e
 * `lerRanking`, que montam sessão, escopo e fronteira exatamente como a página
 * faz — o recorte por perfil é aplicado no servidor, antes de qualquer leitura
 * (seção 11), e a rota herda isso por construção. Uma pergunta sobre recorte
 * que o perfil não alcança volta como `sem_permissao`, sem valor agregado,
 * como o painel.
 *
 * ## A busca é lida pelo leitor da página
 *
 * O chat manda a busca da URL como texto e a tela aberta, e `contextoDe` os
 * lê com a mesma tolerância de T-127: filtro fora do vocabulário cai no
 * padrão, tela fora do inventário vira nenhuma, painel fora do registro vira
 * nenhum. É o que garante que o recorte que o chat herda é o recorte que a
 * tela mostra — e que "esse gráfico" é o painel que a URL destaca.
 */

export const dynamic = "force-dynamic";

/**
 * Quanto a função pode levar, em segundos (T-430).
 *
 * Uma pergunta composta faz até três rodadas de 20 s no laço, mais a redação
 * e uma rodada de correção de 30 s cada. Sem isto, a plataforma encerrava a
 * função no meio e a conversa via "não consegui falar com o servidor" — que
 * é a frase de rede, não a de um laço longo.
 */
export const maxDuration = 120;

/** Quanto da mensagem de uma exceção vai para o registro. */
const TAMANHO_DO_ERRO_REGISTRADO = 200;

/** Os primeiros quadros da pilha, para o log apontar o arquivo. */
const QUADROS_REGISTRADOS = 3;
function pilhaDoErro(erro: unknown): string {
  const pilha = erro instanceof Error ? (erro.stack ?? "") : "";
  return pilha
    .split("\n")
    .slice(1, 1 + QUADROS_REGISTRADOS)
    .map((l) => l.trim())
    .join(" | ");
}

/** A mensagem de uma exceção, curta e sem quebra: só para o log. */
function resumoDoErro(erro: unknown): string {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  return mensagem.replace(/\s+/g, " ").slice(0, TAMANHO_DO_ERRO_REGISTRADO);
}

/** Uma resposta curta de erro, sem corpo que diga mais que o status. */
function recusar(status: number, erro: string): Response {
  return Response.json({ erro }, { status });
}

/** O que o cabeçalho de repetição diz, por motivo. */
function recusarPorLimite(
  motivo: MotivoDeLimite,
  tentarEmSegundos: number,
): Response {
  return Response.json(
    { erro: "limite de uso", motivo },
    {
      status: 429,
      headers: { "retry-after": String(tentarEmSegundos) },
    },
  );
}

/** Uma recusa com o motivo que a conversa distingue (D-CONVIDADO-cadastro). */
function recusarComMotivo(
  status: number,
  erro: string,
  motivo: MotivoDeFalha,
): Response {
  const corpo: CorpoDeRecusa = { erro, motivo };
  return Response.json(corpo, { status });
}

/** A sala de uma sessão de convite, ou a instalação quando não há convite. */
function salaDe(sujeito: string): string {
  const partes = sujeito.split(":");
  return partes[0] === "convite" ? (partes[1] ?? "sem-sala") : "instalacao";
}

export async function POST(requisicao: Request): Promise<Response> {
  /*
   * A sessão primeiro.
   *
   * Com `AUTH_PROVIDER=convite`, `lerIdentidade` lança quando o cookie venceu
   * no meio da conversa — e é 401, não 500: a conversa no celular trata esse
   * status e mostra "seu acesso venceu", em vez de "não consegui falar com o
   * servidor".
   */
  let identidade: Awaited<ReturnType<typeof lerIdentidade>>;
  try {
    identidade = await lerIdentidade();
  } catch (erro) {
    if (erro instanceof SessaoAusente) {
      return recusar(401, "sessão ausente ou vencida");
    }
    throw erro;
  }

  /*
   * A origem, como nas rotas de marca.
   *
   * O chat é um `POST` com JSON, e um site de terceiro pode montá-lo. O que
   * ele conseguiria é gastar a cota da apresentação alheia; e a política do
   * produto já declara `form-action 'self'`, que só vale para o navegador que
   * a respeita.
   */
  if (!origemPropria(requisicao)) {
    return recusar(403, "origem do envio não confere");
  }

  const controle = controleDoProcesso();
  const sala = salaDe(identidade.sujeito);
  const admissao = controle.admitir(identidade.sujeito, sala, Date.now());
  if (!admissao.ok) {
    // O log diz que houve limite, e não o que a pessoa perguntou.
    console.warn(
      JSON.stringify({
        evento: "chat.limite",
        motivo: admissao.motivo,
        sala,
        em: new Date().toISOString(),
      }),
    );
    return recusarPorLimite(admissao.motivo, admissao.tentarEmSegundos);
  }

  let bruto: unknown;
  try {
    bruto = await requisicao.json();
  } catch {
    admissao.liberar();
    return recusar(400, "corpo não é JSON");
  }
  const pedido = lerPedido(bruto);
  if (pedido === null) {
    admissao.liberar();
    return recusar(400, "pedido malformado");
  }

  /*
   * A cota do convidado (T-426), depois do corpo: um pedido malformado não
   * pode custar uma das cinco. Quem apresenta e o modo `fixtures` não têm
   * cota — `lerVisitante` só devolve o público do QR. Contada no armazém, e
   * não na memória do processo: na nuvem há mais de uma instância.
   */
  const visitante = await lerVisitante();
  let restantes: number | null = null;
  let quemPergunta: string | null = null;
  if (visitante !== null) {
    const cota = await (
      await armazemDeConvidados()
    ).admitirPergunta(visitante, PERGUNTAS_POR_CONVIDADO);
    if (cota.tipo === "sem_cadastro") {
      admissao.liberar();
      return recusarComMotivo(401, "cadastro ausente", "sem_cadastro");
    }
    if (cota.tipo === "esgotada") {
      admissao.liberar();
      console.warn(
        JSON.stringify({
          evento: "chat.cota",
          sala,
          em: new Date().toISOString(),
        }),
      );
      return recusarComMotivo(
        429,
        "limite de perguntas",
        "limite_de_perguntas",
      );
    }
    restantes = perguntasRestantes(cota.convidado.perguntas);
    quemPergunta = primeiroNome(cota.convidado.nome);
  }

  const contexto = contextoDe(
    pedido.tela,
    pedido.busca,
    dimensoesProvisorias().ano ?? [],
    quemPergunta,
  );

  /*
   * O que a pergunta gastou no gateway.
   *
   * O total do processo é lido antes e depois; a diferença vai para o teto da
   * sala. Somando as diferenças de todas as perguntas, o que a sala registra
   * fecha com o que o gateway gastou, mesmo com perguntas concorrentes — é por
   * isso que o contador é do processo e não da chamada.
   */
  const antes = tokensDoProcesso();

  const codificador = new TextEncoder();
  const fluxo = new ReadableStream<Uint8Array>({
    async start(controlador) {
      const emitir = (linha: LinhaDoFluxo) => {
        controlador.enqueue(codificador.encode(`${JSON.stringify(linha)}\n`));
      };
      try {
        /*
         * A prévia sai na primeira leitura do laço que nomeia uma métrica
         * (T-434), e de novo no fim só se o painel mudou — o ranking que a
         * pergunta pediu vence a métrica de que ele deriva (T-432).
         */
        let previaEmitida: Previa | null = null;
        const emitirPrevia = (resolucao: Resolucao) => {
          /*
           * Resolução sem métrica do catálogo não tem prévia (T-454): a bolha
           * de prévia desenha "{rótulo}: {valor}", e sem os dois ela sairia
           * como ": sem dado neste recorte". O andamento já narra a espera
           * ("Consultando o banco…").
           */
          if (resolucao.metrica === "") return;
          const previa = previaDe(resolucao);
          if (
            previaEmitida !== null &&
            previaEmitida.metrica === previa.metrica &&
            previaEmitida.painel?.id === previa.painel?.id
          ) {
            return;
          }
          previaEmitida = previa;
          emitir({ fase: "previa", previa });
        };
        const resolvida = await resolverPergunta(
          pedido.pergunta,
          contexto,
          pedido.historico,
          {
            aoAndamento: (passo) => emitir({ fase: "andamento", passo }),
            aoPrevia: emitirPrevia,
          },
        );
        if (resolvida.tipo === "recusa") {
          emitir({ fase: "resposta", resposta: resolvida });
          return;
        }
        emitirPrevia(resolvida.resolucao);
        const resposta = await redigirResposta(
          pedido.pergunta,
          resolvida.resolucao,
          resolvida.redacao,
          contexto,
        );
        emitir({ fase: "resposta", resposta });
      } catch (erro) {
        // Mesma tradução de `lerPainelParaTela`: fora do perfil é estado, e
        // qualquer outra coisa é a fonte. O detalhe fica no servidor — e
        // fica mesmo, registrado (T-430): um erro de fonte sem nome no log
        // custou uma tarde inteira de "o chat responde genérico".
        const semPermissao =
          erro instanceof ForaDoEscopo || erro instanceof GraoProibido;
        if (!semPermissao) {
          registrarIncidente({
            tipo: "fonte_falhou",
            detalhe: {
              nome: erro instanceof Error ? erro.name : "desconhecido",
              erro: resumoDoErro(erro),
              pilha: pilhaDoErro(erro),
            },
          });
        }
        emitir({
          fase: "falha",
          motivo: semPermissao ? "sem_permissao" : "erro_de_fonte",
        });
      } finally {
        const depois = tokensDoProcesso();
        controle.registrarTokens(
          sala,
          depois.entrada - antes.entrada + (depois.saida - antes.saida),
          Date.now(),
        );
        admissao.liberar();
        controlador.close();
      }
    },
    cancel() {
      // A aba fechou no meio: a vaga volta para a fila da sala.
      admissao.liberar();
    },
  });

  return new Response(fluxo, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      ...(restantes === null
        ? {}
        : { [CABECALHO_DE_PERGUNTAS_RESTANTES]: String(restantes) }),
    },
  });
}
