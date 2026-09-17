/**
 * A orquestração dos três estágios, com a fronteira no meio.
 *
 * ```
 *  site informado
 *     │
 *     ├─ 1 · reunir     NOSSO CÓDIGO. Busca a página e junta os candidatos.
 *     │                 Determinístico. Nenhuma escolha.
 *     ├─ 2 · escolher   modelo, por índice — ou ordenação determinística
 *     │                 quando não há chave. Nenhuma cor nova.
 *     ├─ verificar      NOSSO CÓDIGO. Índice fora da lista descarta a
 *     │                 resposta inteira e cai no determinístico.
 *     └─ 3 · conferir   contraste medido, ajuste **proposto**, logo baixado
 *                       e conferido pelos bytes.
 * ```
 *
 * O paralelo com o chat é literal, e é de propósito: quem já entende por que
 * `divergencias()` existe entende esta feature inteira sem explicação nova.
 */

import { conferirContraste } from "@/marca/conferir-contraste";
import type { Proposta } from "@/marca/documento";
import { reunirCandidatos } from "@/marca/extrair/candidatos";
import { escolherComGateway, modeloDaEscolha } from "@/marca/extrair/escolher";
import {
  aplicarEscolha,
  divergenciasDaEscolha,
  escolherSemModelo,
  type Escolha,
} from "@/marca/extrair/verificar";
import { baixarLogo } from "@/marca/logo";
import { obterFonteDeSite } from "@/marca/site/fonte";
import { FRASE_DA_RECUSA, type MotivoDeRecusa } from "@/marca/site/guarda";
import "@/marca/site/registrar";

export type ExtracaoRecusada = {
  readonly ok: false;
  readonly motivo: MotivoDeRecusa;
  readonly frase: string;
};

export type ExtracaoFeita = { readonly ok: true; readonly proposta: Proposta };

/**
 * Do endereço informado à proposta que a tela mostra.
 *
 * Nunca lança por causa do site: recusa vira `ok: false` com a frase que a tela
 * exibe, e problema em recurso secundário vira aviso dentro da proposta.
 */
export async function extrairMarca(
  siteBruto: string,
  ambiente: Record<string, string | undefined> = process.env,
): Promise<ExtracaoFeita | ExtracaoRecusada> {
  const fonte = await obterFonteDeSite(ambiente);

  const candidatos = await reunirCandidatos(siteBruto, fonte);
  if (!candidatos.ok) {
    return {
      ok: false,
      motivo: candidatos.motivo,
      frase: FRASE_DA_RECUSA[candidatos.motivo],
    };
  }

  const bruta = await escolherComGateway(candidatos);

  let escolha: Escolha;
  let modelo: string | null = null;

  if (bruta === null) {
    // Sem chave, ou o gateway não respondeu. O produto segue funcionando.
    escolha = {
      ...escolherSemModelo(candidatos),
      autoria: "gateway-indisponivel",
    };
  } else {
    const erradas = divergenciasDaEscolha(bruta, candidatos);
    if (erradas.length > 0) {
      // Apontou para fora da lista: a resposta inteira é descartada, e a
      // autoria diz isso. Corrigir escondia a frequência.
      escolha = {
        ...escolherSemModelo(candidatos),
        autoria: "modelo-recusado",
      };
    } else {
      escolha = aplicarEscolha(bruta, candidatos);
      modelo = modeloDaEscolha();
    }
  }

  const { cores, ajustes } = conferirContraste(escolha.cores);

  const logo =
    escolha.logo === null ? null : await baixarLogo(escolha.logo.url, fonte);

  return {
    ok: true,
    proposta: {
      origem: "site",
      site: candidatos.site,
      nome: null,
      cores,
      coresOriginais: escolha.cores,
      logo: logo !== null && logo.ok ? logo.logo : null,
      logoRecusado: logo !== null && !logo.ok ? logo.motivo : null,
      extracao: { autoria: escolha.autoria, modelo, ajustes },
      candidatos: candidatos.cores.length,
      avisos: candidatos.avisos,
      propostaEm: new Date().toISOString(),
    },
  };
}
