/**
 * A fonte de site do arnês.
 *
 * Serve as páginas de `paginas.ts` em vez de ir à rede. O que ela **não** faz
 * é afrouxar a política: `conferirEndereco` é chamada aqui igual ao adaptador
 * de rede, antes de qualquer byte sair. Um endereço de rede interna é recusado
 * neste modo com o mesmo motivo, e é isso que faz o verde do arnês dizer
 * alguma coisa sobre a guarda.
 */

import type {
  FalhaDeBusca,
  FonteDeSite,
  Recurso,
  RecursoBinario,
} from "@/marca/site/fonte";
import { conferirEndereco } from "@/marca/site/guarda";
import { BINARIOS, PAGINAS } from "@/marca/site/paginas";

/** A URL como as páginas a indexam: sem barra final ausente. */
function canonizar(url: string): string {
  try {
    const alvo = new URL(url);
    return alvo.pathname === "" ? `${alvo.origin}/` : alvo.toString();
  } catch {
    return url;
  }
}

export function criarFonteDeFixtures(): FonteDeSite {
  return {
    buscarTexto: async (url, tiposAceitos, teto) => {
      const conferida = conferirEndereco(url);
      if (!conferida.ok) return { ok: false, motivo: conferida.motivo };

      const pagina = PAGINAS[canonizar(conferida.url)];
      if (pagina === undefined) return { ok: false, motivo: "tipo_nao_aceito" };
      if (!tiposAceitos.some((t) => pagina.tipo.startsWith(t))) {
        return { ok: false, motivo: "tipo_nao_aceito" };
      }
      if (pagina.corpo.length > teto) {
        return { ok: false, motivo: "corpo_grande_demais" };
      }
      const recurso: Recurso = {
        ok: true,
        url: conferida.url,
        tipo: pagina.tipo,
        corpo: pagina.corpo,
      };
      return recurso;
    },

    buscarBinario: async (url, teto) => {
      const conferida = conferirEndereco(url);
      if (!conferida.ok) return { ok: false, motivo: conferida.motivo };

      const binario = BINARIOS[canonizar(conferida.url)];
      if (binario === undefined)
        return { ok: false, motivo: "tipo_nao_aceito" };

      const bytes = Uint8Array.from(Buffer.from(binario.base64, "base64"));
      if (bytes.byteLength > teto) {
        const falha: FalhaDeBusca = {
          ok: false,
          motivo: "corpo_grande_demais",
        };
        return falha;
      }
      const recurso: RecursoBinario = {
        ok: true,
        url: conferida.url,
        tipo: binario.tipo,
        bytes,
      };
      return recurso;
    },
  };
}
