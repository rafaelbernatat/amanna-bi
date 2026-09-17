/**
 * A busca de verdade, com o endereço fixado antes de o socket abrir.
 *
 * ## Por que `node:https` e não `fetch`
 *
 * Esta é a decisão que separa a guarda de existir e de parecer existir.
 *
 * Com `fetch`, a resolução de nome acontece **dentro** do cliente, depois da
 * conferência: a gente valida `empresa.com.br`, e o cliente resolve o nome
 * — possivelmente para um endereço diferente do que a gente checaria, ou para
 * um endereço que mudou entre a checagem e a conexão. É religação de DNS, e é
 * a falha que quase toda guarda de requisição forjada tem. Não há como passar
 * um resolvedor próprio ao `fetch` global sem trazer dependência nova.
 *
 * `https.request(url, { lookup })` é API pública: o nosso resolvedor devolve
 * só endereços que passaram por `enderecoPermitido`, e o socket conecta
 * exatamente naquele endereço. A conferência e a conexão falam do mesmo IP.
 *
 * ## Redirecionamento é seguido à mão, e refaz a guarda
 *
 * Cada salto passa por `conferirEndereco` e pelo resolvedor conferido de novo.
 * Um site público que redireciona para `169.254.169.254` é exatamente como se
 * escreve esse ataque, e seguir redirecionamento automaticamente entregaria a
 * resposta.
 */

import { lookup as resolverNome } from "node:dns";
import { request } from "node:https";
import type { LookupAddress } from "node:dns";

import type {
  FalhaDeBusca,
  FonteDeSite,
  Recurso,
  RecursoBinario,
} from "@/marca/site/fonte";
import { conferirEndereco, enderecoPermitido } from "@/marca/site/guarda";

/** Quanto se espera pela resposta inteira. */
const ORCAMENTO_MS = 8000;
/** Quanto se espera por um pedaço. */
const OCIOSO_MS = 3000;
/** Quantos saltos de redirecionamento. */
const SALTOS_MAXIMOS = 3;

const REDIRECIONAMENTO_MINIMO = 300;
const REDIRECIONAMENTO_MAXIMO = 399;
const SUCESSO_MINIMO = 200;
const SUCESSO_MAXIMO = 299;

/** O que dizemos de nós. Honesto, e sem nada de quem está usando. */
const IDENTIFICACAO = "amanna-bi/1.0 (+extracao-de-marca)";

/**
 * O resolvedor conferido.
 *
 * Recusa a conexão quando **qualquer** endereço devolvido é privado, e não só
 * quando todos são: um nome que resolve para um endereço público e um interno
 * é a forma mais barata de contornar uma guarda que aceita o primeiro que
 * passa.
 */
function resolvedorConferido(
  aoRecusar: (motivo: string) => void,
): typeof resolverNome {
  const conferido = (
    nome: string,
    opcoes: unknown,
    devolver: (erro: Error | null, ...resto: unknown[]) => void,
  ): void => {
    resolverNome(
      nome,
      { all: true },
      (erro: Error | null, enderecos: LookupAddress[]) => {
        if (erro !== null) {
          devolver(erro);
          return;
        }
        for (const { address } of enderecos) {
          const motivo = enderecoPermitido(address);
          if (motivo !== null) {
            aoRecusar(motivo);
            devolver(new Error("endereço recusado pela guarda"));
            return;
          }
        }
        const primeiro = enderecos[0];
        if (primeiro === undefined) {
          devolver(new Error("nome sem endereço"));
          return;
        }
        void opcoes;
        devolver(null, primeiro.address, primeiro.family);
      },
    );
  };
  return conferido as unknown as typeof resolverNome;
}

type Resposta = {
  readonly status: number;
  readonly tipo: string;
  readonly local: string | null;
  readonly bytes: Uint8Array;
};

/** Uma requisição, com teto de bytes contado no fluxo. */
async function pedir(
  url: string,
  teto: number,
  aoRecusar: (motivo: string) => void,
): Promise<Resposta | FalhaDeBusca> {
  return new Promise((resolver) => {
    const pedido = request(
      url,
      {
        method: "GET",
        lookup: resolvedorConferido(aoRecusar),
        headers: {
          "user-agent": IDENTIFICACAO,
          accept:
            "text/html,application/xhtml+xml,text/css,application/json,image/*",
          "accept-language": "pt-BR",
          // Sem compressão: o teto de bytes precisa contar o que trafega, e
          // descomprimir para contar depois é justamente a bomba que o teto
          // existe para impedir.
          "accept-encoding": "identity",
        },
        timeout: OCIOSO_MS,
      },
      (resposta) => {
        const pedacos: Uint8Array[] = [];
        let total = 0;
        resposta.on("data", (pedaco: Uint8Array) => {
          total += pedaco.byteLength;
          if (total > teto) {
            resposta.destroy();
            resolver({ ok: false, motivo: "corpo_grande_demais" });
            return;
          }
          pedacos.push(pedaco);
        });
        resposta.on("end", () => {
          resolver({
            status: resposta.statusCode ?? 0,
            tipo: String(resposta.headers["content-type"] ?? ""),
            local: resposta.headers.location ?? null,
            bytes: Uint8Array.from(Buffer.concat(pedacos)),
          });
        });
        resposta.on("error", () => {
          resolver({ ok: false, motivo: "tempo_esgotado" });
        });
      },
    );

    const orcamento = setTimeout(() => {
      pedido.destroy();
      resolver({ ok: false, motivo: "tempo_esgotado" });
    }, ORCAMENTO_MS);

    pedido.on("timeout", () => {
      pedido.destroy();
      resolver({ ok: false, motivo: "tempo_esgotado" });
    });
    pedido.on("error", () => {
      resolver({ ok: false, motivo: "tempo_esgotado" });
    });
    pedido.on("close", () => {
      clearTimeout(orcamento);
    });
    pedido.end();
  });
}

function ehFalha(x: Resposta | FalhaDeBusca): x is FalhaDeBusca {
  return "ok" in x && x.ok === false;
}

/** Segue a cadeia, refazendo a guarda a cada salto. */
async function buscarBytes(
  urlInicial: string,
  teto: number,
): Promise<
  | {
      readonly ok: true;
      readonly url: string;
      readonly tipo: string;
      readonly bytes: Uint8Array;
    }
  | FalhaDeBusca
> {
  let alvo = urlInicial;

  for (let salto = 0; salto <= SALTOS_MAXIMOS; salto += 1) {
    const conferida = conferirEndereco(alvo);
    if (!conferida.ok) return { ok: false, motivo: conferida.motivo };

    let recusadoPelaGuarda: string | null = null;
    const resposta = await pedir(conferida.url, teto, (motivo) => {
      recusadoPelaGuarda = motivo;
    });

    if (recusadoPelaGuarda !== null) {
      return {
        ok: false,
        motivo:
          recusadoPelaGuarda === "metadados_de_nuvem"
            ? "metadados_de_nuvem"
            : "endereco_privado",
      };
    }
    if (ehFalha(resposta)) return resposta;

    if (
      resposta.status >= REDIRECIONAMENTO_MINIMO &&
      resposta.status <= REDIRECIONAMENTO_MAXIMO &&
      resposta.local !== null
    ) {
      if (salto === SALTOS_MAXIMOS) {
        return { ok: false, motivo: "redirecionamentos_demais" };
      }
      alvo = new URL(resposta.local, conferida.url).toString();
      continue;
    }

    if (resposta.status < SUCESSO_MINIMO || resposta.status > SUCESSO_MAXIMO) {
      return { ok: false, motivo: "tipo_nao_aceito" };
    }

    return {
      ok: true,
      url: conferida.url,
      tipo: resposta.tipo,
      bytes: resposta.bytes,
    };
  }

  return { ok: false, motivo: "redirecionamentos_demais" };
}

export function criarFonteDeRede(): FonteDeSite {
  return {
    buscarTexto: async (url, tiposAceitos, teto) => {
      const bruta = await buscarBytes(url, teto);
      if (!bruta.ok) return bruta;
      if (!tiposAceitos.some((t) => bruta.tipo.includes(t))) {
        return { ok: false, motivo: "tipo_nao_aceito" };
      }
      const recurso: Recurso = {
        ok: true,
        url: bruta.url,
        tipo: bruta.tipo,
        corpo: Buffer.from(bruta.bytes).toString("utf8"),
      };
      return recurso;
    },

    buscarBinario: async (url, teto) => {
      const bruta = await buscarBytes(url, teto);
      if (!bruta.ok) return bruta;
      const recurso: RecursoBinario = {
        ok: true,
        url: bruta.url,
        tipo: bruta.tipo,
        bytes: bruta.bytes,
      };
      return recurso;
    },
  };
}
