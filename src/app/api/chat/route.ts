import { dimensoesProvisorias } from "@/acesso/dimensoes-provisorias";
import { lerIdentidade } from "@/acesso/leitura";
import { contextoDe } from "@/chat/contexto";
import { controleDoProcesso, type MotivoDeLimite } from "@/chat/limite";
import { lerPedido, previaDe } from "@/chat/pedido";
import { redigirResposta, resolverPergunta } from "@/chat/perguntar";
import type { LinhaDoFluxo } from "@/chat/protocolo";
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

  const contexto = contextoDe(
    pedido.tela,
    pedido.busca,
    dimensoesProvisorias().ano ?? [],
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
        const resolvida = await resolverPergunta(
          pedido.pergunta,
          contexto,
          pedido.historico,
        );
        if (resolvida.tipo === "recusa") {
          emitir({ fase: "resposta", resposta: resolvida });
          return;
        }
        emitir({ fase: "previa", previa: previaDe(resolvida.resolucao) });
        const resposta = await redigirResposta(
          pedido.pergunta,
          resolvida.resolucao,
          resolvida.redacao,
          contexto,
        );
        emitir({ fase: "resposta", resposta });
      } catch (erro) {
        // Mesma tradução de `lerPainelParaTela`: fora do perfil é estado, e
        // qualquer outra coisa é a fonte. O detalhe fica no servidor.
        emitir({
          fase: "falha",
          motivo:
            erro instanceof ForaDoEscopo || erro instanceof GraoProibido
              ? "sem_permissao"
              : "erro_de_fonte",
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
    },
  });
}
