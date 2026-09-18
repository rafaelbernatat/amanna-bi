/**
 * O segundo caminho da marca: informar à mão.
 *
 * Nome da instalação, cinco cores e um logo enviado — sem buscar site nenhum.
 * É o caminho de quem não tem site, de quem tem um site que a guarda recusa,
 * e de quem quer só trocar uma cor do que o site declarou. Também é o único
 * caminho **sem saída de rede**: uma instalação que só usa este pode ligar a
 * personalização antes de H-61 e H-62 decidirem sobre a busca de sites.
 *
 * ## O que é igual ao caminho do site, de propósito
 *
 * A proposta. Nada é aplicado aqui: o formulário vira uma `Proposta`, a tela
 * mostra as cores, os ajustes de contraste e o logo, e a pessoa aplica com um
 * clique — ou descarta. E o ajuste de contraste é o mesmo estágio 3, com a
 * mesma regra: cor digitada que reprova é ajustada e **mostrada** riscada ao
 * lado da aplicada.
 *
 * ## A fronteira não confia no navegador
 *
 * `<input type="color">` só produz `#rrggbb`, mas o formulário pode ser
 * enviado por qualquer cliente. Cada cor passa por `normalizarCor`; cada
 * arquivo passa por `conferirLogo`, que olha os bytes e não o nome. O nome
 * passa pelo mesmo leitor que o documento usa na saída do armazém.
 *
 * ## O logo que não serviu não apaga o que estava
 *
 * Um arquivo recusado mantém o logo em uso e a proposta **diz** que recusou,
 * com o motivo. A alternativa — descartar o envio em silêncio, ou pior, tirar
 * o logo atual — é a correção silenciosa que este repositório não faz. Para
 * remover o logo de verdade há uma caixa própria (`semLogo`).
 */

import { normalizarCor } from "@/apresentacao/tema/contraste";
import {
  CHAVES_DE_MARCA,
  PALETA_CLARA,
  type ChaveDeMarca,
  type CoresDaMarca,
} from "@/apresentacao/tema/tema";
import { conferirContraste } from "@/marca/conferir-contraste";
import {
  nomeDentroDaForma,
  normalizarNome,
  type Marca,
  type Proposta,
} from "@/marca/documento";
import { conferirLogo, TETO_DO_LOGO } from "@/marca/logo";

/**
 * O teto do pedido inteiro: o logo mais a folga dos campos de texto e das
 * bordas do `multipart`. A rota recusa acima disto **antes** de ler o corpo.
 */
export const TETO_DO_PEDIDO_MANUAL = TETO_DO_LOGO + 64 * 1024;

/** De onde o logo veio, para a auditoria do documento. */
export const ORIGEM_DO_LOGO_MANUAL = "envio-manual";

/** O que o formulário manda, já separado por campo e ainda sem conferir. */
export type EntradaManual = {
  readonly nome: string;
  readonly cores: Readonly<Record<ChaveDeMarca, string>>;
  /** Os bytes do arquivo enviado, ou `null` quando nenhum foi. */
  readonly logo: Uint8Array | null;
  /** A caixa "sem logo": remove o logo em uso. */
  readonly semLogo: boolean;
};

/** O que pode estar errado numa entrada, e a tela diz qual. */
export type ErroManual = "cor" | "nome";

export type PropostaManual =
  | { readonly ok: true; readonly proposta: Proposta }
  | { readonly ok: false; readonly erro: ErroManual };

/* ------------------------------------------------------------------ *
 * Do formulário à entrada
 * ------------------------------------------------------------------ */

function textoDe(formulario: FormData, campo: string): string {
  const valor = formulario.get(campo);
  return typeof valor === "string" ? valor : "";
}

/**
 * Lê os campos do `FormData`. Não confere nada: só separa.
 *
 * Um `<input type="file">` sem arquivo escolhido chega como um `File` de zero
 * bytes com nome vazio — isso é "nenhum logo enviado", e não "logo vazio".
 */
export async function lerEntradaManual(
  formulario: FormData,
): Promise<EntradaManual> {
  const cores = Object.fromEntries(
    CHAVES_DE_MARCA.map((chave) => [chave, textoDe(formulario, chave)]),
  ) as Record<ChaveDeMarca, string>;

  const arquivo = formulario.get("logo");
  const logo =
    arquivo instanceof Blob && arquivo.size > 0
      ? new Uint8Array(await arquivo.arrayBuffer())
      : null;

  return {
    nome: textoDe(formulario, "nome"),
    cores,
    logo,
    semLogo: textoDe(formulario, "semLogo") === "1",
  };
}

/* ------------------------------------------------------------------ *
 * Da entrada à proposta
 * ------------------------------------------------------------------ */

/** Com que cores o formulário abre: as da marca em uso, ou as de hoje. */
export function coresIniciais(marca: Marca | null): CoresDaMarca {
  if (marca !== null) return marca.cores;
  return Object.fromEntries(
    CHAVES_DE_MARCA.map((chave) => [chave, PALETA_CLARA[chave]]),
  ) as Record<ChaveDeMarca, string>;
}

/** As cinco cores em forma canônica, ou `null` se alguma não é cor. */
function normalizarCores(
  brutas: Readonly<Record<ChaveDeMarca, string>>,
): CoresDaMarca | null {
  const cores: Record<string, string> = {};
  for (const chave of CHAVES_DE_MARCA) {
    const cor = normalizarCor(brutas[chave]);
    if (cor === null) return null;
    cores[chave] = cor;
  }
  return cores as CoresDaMarca;
}

/**
 * Monta a proposta a partir do que a pessoa informou.
 *
 * `atual` é a marca em uso, de onde o logo é mantido quando nenhum arquivo é
 * enviado (ou quando o enviado é recusado). Puro: recebe o instante e não lê
 * relógio nem armazém.
 */
export function montarPropostaManual(
  entrada: EntradaManual,
  atual: Marca | null,
  agora: Date = new Date(),
): PropostaManual {
  const originais = normalizarCores(entrada.cores);
  if (originais === null) return { ok: false, erro: "cor" };

  const nome = normalizarNome(entrada.nome);
  if (nome !== null && !nomeDentroDaForma(nome)) {
    return { ok: false, erro: "nome" };
  }

  const { cores, ajustes } = conferirContraste(originais);

  let logo = atual?.logo ?? null;
  let logoRecusado: string | null = null;
  if (entrada.semLogo) {
    logo = null;
  } else if (entrada.logo !== null) {
    const conferido = conferirLogo(entrada.logo, ORIGEM_DO_LOGO_MANUAL);
    if (conferido.ok) {
      logo = conferido.logo;
    } else {
      // Recusado: o logo em uso fica, e a proposta diz por quê.
      logoRecusado = conferido.motivo;
    }
  }

  return {
    ok: true,
    proposta: {
      origem: "manual",
      site: null,
      nome,
      cores,
      coresOriginais: originais,
      logo,
      logoRecusado,
      extracao: { autoria: "manual", modelo: null, ajustes },
      candidatos: 0,
      avisos: [],
      propostaEm: agora.toISOString(),
    },
  };
}
