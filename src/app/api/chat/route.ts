import { dimensoesProvisorias } from "@/acesso/dimensoes-provisorias";
import { lerPedido, previaDe } from "@/chat/pedido";
import { redigirResposta, resolverPergunta } from "@/chat/perguntar";
import type { LinhaDoFluxo } from "@/chat/protocolo";
import { buscaParaQuery } from "@/semantica/url";
import { GraoProibido } from "@/seguranca/grao";
import { ForaDoEscopo } from "@/seguranca/identidade";

/**
 * A rota do chat (seção 7; T-320 em parte).
 *
 * `POST /api/chat` recebe a pergunta, a busca da URL da tela e os turnos
 * anteriores; devolve a resposta em duas fases, uma linha de JSON por fase
 * (ver `protocolo.ts`).
 *
 * ## O perfil entra pelo mesmo caminho da tela
 *
 * Nada aqui lê dado. Os estágios 1 e 2 chamam `lerMetrica` e `lerPainel`, que
 * montam sessão, escopo e fronteira exatamente como a página faz — o recorte
 * por perfil é aplicado no servidor, antes de qualquer leitura (seção 11), e a
 * rota herda isso por construção. Uma pergunta sobre recorte que o perfil não
 * alcança volta como `sem_permissao`, sem valor agregado, como o painel.
 *
 * ## A busca é lida pelo leitor da página
 *
 * O chat manda a busca da URL como texto, e `buscaParaQuery` a lê com a mesma
 * tolerância de T-127: filtro fora do vocabulário cai no padrão, e não em
 * erro. É o que garante que o recorte que o chat herda é o recorte que a
 * tela mostra.
 */

export const dynamic = "force-dynamic";

/** Uma resposta curta de erro, sem corpo que diga mais que o status. */
function recusar(status: number, erro: string): Response {
  return Response.json({ erro }, { status });
}

export async function POST(requisicao: Request): Promise<Response> {
  let bruto: unknown;
  try {
    bruto = await requisicao.json();
  } catch {
    return recusar(400, "corpo não é JSON");
  }
  const pedido = lerPedido(bruto);
  if (pedido === null) return recusar(400, "pedido malformado");

  const { query } = buscaParaQuery(pedido.busca, dimensoesProvisorias().ano);

  const codificador = new TextEncoder();
  const fluxo = new ReadableStream<Uint8Array>({
    async start(controlador) {
      const emitir = (linha: LinhaDoFluxo) => {
        controlador.enqueue(codificador.encode(`${JSON.stringify(linha)}\n`));
      };
      try {
        const resolvida = await resolverPergunta(
          pedido.pergunta,
          query,
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
        controlador.close();
      }
    },
  });

  return new Response(fluxo, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
