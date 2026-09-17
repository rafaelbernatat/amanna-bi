/**
 * De onde vêm os bytes do site da empresa.
 *
 * Terceira instância do padrão de fábrica do repositório, e a razão é o arnês:
 * o servidor de ponta a ponta não pode buscar um site de verdade — seria lento,
 * dependeria de rede e o resultado mudaria quando o site mudasse.
 *
 * **A guarda não mora aqui dentro.** Ela fica na frente dos dois adaptadores,
 * em `guarda.ts`, e o adaptador de fixtures a chama igual. Trocar para
 * fixtures muda de onde vêm os bytes, nunca qual é a política: um endereço de
 * rede interna é recusado nos dois modos, com o mesmo motivo, e uma suíte de
 * contrato confere isso.
 */

import type { MotivoDeRecusa } from "@/marca/site/guarda";

/** O que voltou de uma busca bem-sucedida. */
export type Recurso = {
  readonly ok: true;
  /** A URL final, depois dos redirecionamentos seguidos. */
  readonly url: string;
  readonly tipo: string;
  readonly corpo: string;
};

export type RecursoBinario = {
  readonly ok: true;
  readonly url: string;
  readonly tipo: string;
  readonly bytes: Uint8Array;
};

export type FalhaDeBusca = {
  readonly ok: false;
  readonly motivo: MotivoDeRecusa;
};

export type FonteDeSite = {
  /** A página, como texto. Teto de bytes aplicado no fluxo. */
  buscarTexto(
    url: string,
    tiposAceitos: readonly string[],
    teto: number,
  ): Promise<Recurso | FalhaDeBusca>;
  /** Um recurso binário: o logo. */
  buscarBinario(
    url: string,
    teto: number,
  ): Promise<RecursoBinario | FalhaDeBusca>;
};

/** Os modos aceitos. Enum fechado. */
export const FONTES_DE_SITE = ["rede", "fixtures"] as const;
export type ModoDeFonteDeSite = (typeof FONTES_DE_SITE)[number];

export class FonteDeSiteInvalida extends Error {
  constructor(motivo: string) {
    super(
      `MARCA_SITE: ${motivo}. Aceitos: ${FONTES_DE_SITE.join(", ")}. ` +
        "O padrão é 'rede'; 'fixtures' existe para o arnês de teste e não " +
        "afrouxa a guarda de endereço, que vale nos dois.",
    );
    this.name = "FonteDeSiteInvalida";
  }
}

/** O modo configurado. `rede` é o padrão. */
export function lerModoDeFonteDeSite(
  ambiente: Record<string, string | undefined>,
): ModoDeFonteDeSite {
  const bruto = ambiente["MARCA_SITE"];
  if (bruto === undefined || bruto === "") return "rede";
  if (!(FONTES_DE_SITE as readonly string[]).includes(bruto)) {
    throw new FonteDeSiteInvalida(`'${bruto}' não é um modo válido`);
  }
  return bruto as ModoDeFonteDeSite;
}

export type ConstrutorDeFonteDeSite = () => Promise<FonteDeSite>;

const REGISTRO = new Map<ModoDeFonteDeSite, ConstrutorDeFonteDeSite>();

export function registrarFonteDeSite(
  modo: ModoDeFonteDeSite,
  construtor: ConstrutorDeFonteDeSite,
): void {
  REGISTRO.set(modo, construtor);
}

/** Só para teste. */
export function limparFontesDeSite(): void {
  REGISTRO.clear();
}

export function fontesDeSiteRegistradas(): readonly ModoDeFonteDeSite[] {
  return [...REGISTRO.keys()];
}

export async function obterFonteDeSite(
  ambiente: Record<string, string | undefined> = process.env,
): Promise<FonteDeSite> {
  const modo = lerModoDeFonteDeSite(ambiente);
  const construtor = REGISTRO.get(modo);
  if (construtor === undefined) {
    throw new FonteDeSiteInvalida(
      `'${modo}' é um modo válido, mas sem implementação registrada`,
    );
  }
  return construtor();
}
