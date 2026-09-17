/**
 * O inspetor de saída: a última conferência antes de cada ida ao gateway
 * (T-352, mínimo de T-321).
 *
 * A seção 11 diz o que sai do ambiente: o catálogo, a pergunta e os números
 * já agregados. Com ferramentas, o que sai a cada rodada é o **resultado** das
 * leituras — e este módulo confere que nada ali parece pessoa: nenhum CPF,
 * nenhuma matrícula, nenhum e-mail, nenhum campo com nome de gente. Confere
 * também que a instrução de sistema é a nossa, e não um texto que alguém
 * conseguiu injetar pela pergunta.
 *
 * Falhou → a rodada não sai. Quem chama registra o incidente e degrada ao
 * caminho simples. É defesa em profundidade: as portas já impedem linha de
 * pessoa, e o grão mínimo é área × mês; isto pega o dia em que uma view nova
 * esquecer disso.
 */

import type { Mensagem } from "@/gateway/openrouter";

/** O que um CPF parece, com ou sem pontuação. */
const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/;
/** Um e-mail. */
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
/** Campos que nomeiam pessoa: nunca deveriam estar num agregado. */
const CAMPO_DE_PESSOA =
  /"(?:cpf|matricula|matrícula|nome_do_colaborador|nomeDoColaborador|colaborador|funcionario|funcionário|email|e-mail|data_nascimento|dataDeNascimento)"\s*:/i;

/** Por que uma saída foi bloqueada. Sem o conteúdo: só a razão. */
export type Bloqueio = {
  readonly motivo:
    | "cpf_no_resultado"
    | "email_no_resultado"
    | "campo_de_pessoa"
    | "instrucao_trocada"
    | "papel_desconhecido";
  readonly mensagem: number;
};

/**
 * Inspeciona o que está para sair. `null` quer dizer que pode ir.
 *
 * `instrucao` é o texto de sistema que **nós** escrevemos: a primeira mensagem
 * precisa começar com ele.
 */
export function inspecionarSaida(
  mensagens: readonly Mensagem[],
  instrucao: string,
): Bloqueio | null {
  for (const [indice, m] of mensagens.entries()) {
    if (indice === 0) {
      if (m.role !== "system" || !m.content.startsWith(instrucao)) {
        return { motivo: "instrucao_trocada", mensagem: indice };
      }
      continue;
    }
    if (m.role === "tool") {
      if (CPF.test(m.content))
        return { motivo: "cpf_no_resultado", mensagem: indice };
      if (EMAIL.test(m.content)) {
        return { motivo: "email_no_resultado", mensagem: indice };
      }
      if (CAMPO_DE_PESSOA.test(m.content)) {
        return { motivo: "campo_de_pessoa", mensagem: indice };
      }
      continue;
    }
    if (m.role !== "user" && m.role !== "assistant" && m.role !== "system") {
      return { motivo: "papel_desconhecido", mensagem: indice };
    }
  }
  return null;
}
