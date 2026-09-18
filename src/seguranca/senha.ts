/**
 * A porta por senha do painel (D-CONVITE-apresentacao).
 *
 * Quem apresenta abre o endereço do produto, digita uma senha e entra. É a
 * segunda porta da instalação, ao lado do convite assinado que vive no QR — e
 * as duas levam ao mesmo lugar: um cookie de sessão assinado por
 * `CONVITE_SEGREDO`.
 *
 * ## Por que uma senha, e não só o link
 *
 * O link assinado resolve a plateia: cinquenta pessoas apontam a câmera e
 * entram sem digitar nada. Para quem apresenta ele resolve mal. Exige um
 * terminal para ser gerado, vence em horas, e o token viaja na barra de
 * endereços — que é por isso que a entrada o apaga logo depois.
 *
 * A senha inverte esses três pontos. Não precisa de ferramenta: abre-se o
 * endereço e digita-se. Não vence sozinha. E nada sensível entra na URL,
 * porque o formulário vai por `POST`.
 *
 * Há um quarto ponto, e é o que mais pesou na prática: a senha é um valor que
 * **uma pessoa escolhe**. O segredo que assina os envelopes precisa apenas ser
 * o mesmo dentro do servidor — ninguém de fora precisa conhecê-lo. Enquanto a
 * única porta era o link, o segredo tinha que ser idêntico na máquina que
 * gerava o link e no servidor que o conferia, e essa igualdade entre dois
 * lugares foi a fonte de todos os erros de configuração até aqui.
 *
 * ## O que esta porta **não** é
 *
 * Não é identidade. Uma senha compartilhada diz que alguém a conhece, não quem
 * é. Não há trilha por pessoa, não há revogação individual, e quem sai da
 * empresa continua sabendo a senha. Para um cliente de verdade o provedor é o
 * OIDC (T-221); isto é a porta de uma apresentação, e o perfil que ela entrega
 * é o de quem apresenta.
 *
 * ## A comparação é de tempo constante
 *
 * Comparar com `===` vaza o tamanho do prefixo acertado pelo tempo de resposta,
 * e com pedidos suficientes isso reconstrói a senha caractere a caractere. As
 * duas entram em SHA-256 — digestos de tamanho fixo — e a comparação soma as
 * diferenças de todos os bytes antes de decidir, sem sair no primeiro que
 * diverge.
 *
 * Só Web Crypto, como o resto de `convite.ts`: este módulo é importado pela
 * rota e pode ser importado pelo proxy.
 */

import type { Perfil } from "@/seguranca/identidade";

import {
  assinarSessao,
  destinoSeguro,
  gerarDispositivo,
  SALA_PADRAO,
  SEGUNDOS_POR_HORA,
  segredoDoConvite,
  VERSAO_DO_ENVELOPE,
  type Entrada,
  type SessaoDeConvite,
} from "@/seguranca/convite";

/**
 * O menor tamanho aceito.
 *
 * Oito não protege contra quem tem o banco; protege contra quem chuta pela
 * rede, junto com o limite de tentativas da rota. Uma senha de apresentação
 * precisa ser digitável por quem a escolheu, e um mínimo alto demais empurra
 * para o papel colado no monitor.
 */
export const TAMANHO_MINIMO_DA_SENHA = 8;

/** Quem entra pela senha apresenta: é a porta de quem conduz a sala. */
export const PERFIL_DE_QUEM_APRESENTA: Perfil = "diretoria";

/**
 * Quanto dura a sessão de quem entrou pela senha.
 *
 * Uma jornada, não um mês. Se a aba ficar aberta numa sala de reunião, o
 * acesso morre no mesmo dia — e digitar a senha de novo custa segundos.
 */
export const HORAS_DA_SESSAO_POR_SENHA = 8;

/** A senha da instalação, ou `null` quando não há. Nunca registrada. */
export function senhaDoPainel(
  ambiente: Record<string, string | undefined>,
): string | null {
  const bruta = ambiente["SENHA_DO_PAINEL"];
  if (bruta === undefined || bruta.trim() === "") return null;
  return bruta;
}

/** Esta instalação tem porta por senha? */
export function entradaPorSenhaLigada(
  ambiente: Record<string, string | undefined>,
): boolean {
  return senhaDoPainel(ambiente) !== null;
}

/** O digesto de um texto, para comparar sem revelar tempo. */
async function digesto(texto: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(texto);
  const saida = await crypto.subtle.digest("SHA-256", bytes);
  return new Uint8Array(saida);
}

/**
 * As duas senhas são a mesma?
 *
 * Tempo constante: ver o cabeçalho. O retorno nunca diz **onde** diferem.
 */
export async function conferirSenha(
  informada: string,
  esperada: string,
): Promise<boolean> {
  const [a, b] = await Promise.all([digesto(informada), digesto(esperada)]);
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i += 1) {
    diferenca |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diferenca === 0;
}

/**
 * A decisão da entrada por senha.
 *
 * Devolve o mesmo envelope de sessão que o QR devolve — a sala é a padrão, o
 * dispositivo é sorteado, e o perfil é o de quem apresenta. Daí para a frente
 * o produto não sabe (nem precisa saber) por qual das duas portas a pessoa
 * entrou.
 */
export async function decidirEntradaPorSenha(e: {
  readonly senha: string | null;
  readonly ir: string | null;
  readonly ambiente: Record<string, string | undefined>;
  readonly agoraSegundos: number;
}): Promise<Entrada> {
  const esperada = senhaDoPainel(e.ambiente);
  const segredo = segredoDoConvite(e.ambiente);
  if (esperada === null || segredo === null) {
    return { tipo: "recusar", motivo: "desligado" };
  }
  if (e.senha === null || e.senha === "") {
    return { tipo: "recusar", motivo: "senha" };
  }
  if (!(await conferirSenha(e.senha, esperada))) {
    return { tipo: "recusar", motivo: "senha" };
  }

  const expira =
    e.agoraSegundos + HORAS_DA_SESSAO_POR_SENHA * SEGUNDOS_POR_HORA;
  const sessao: SessaoDeConvite = {
    v: VERSAO_DO_ENVELOPE,
    tipo: "sessao",
    sala: SALA_PADRAO,
    perfil: PERFIL_DE_QUEM_APRESENTA,
    dispositivo: gerarDispositivo(),
    expira,
  };
  return {
    tipo: "entrar",
    cookie: await assinarSessao(sessao, segredo),
    maxAge: HORAS_DA_SESSAO_POR_SENHA * SEGUNDOS_POR_HORA,
    destino: destinoSeguro(e.ir),
  };
}
