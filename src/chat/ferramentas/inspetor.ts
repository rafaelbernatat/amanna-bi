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
/**
 * Os campos que continuam proibidos, por nome (T-452).
 *
 * Produto liberou o dado de pessoa em 2026-09-19 — nome, cargo, área, centro
 * de custo e custo —, e o que ficou de fora é o que identifica alguém fora da
 * empresa ou diz dela algo que o trabalho não pede: CPF, matrícula, data de
 * nascimento, conta bancária, PIX, sindicato. Antes desta lista o inspetor
 * barrava `"colaborador":` e `"nome_do_colaborador":`, o que mataria em
 * silêncio toda consulta com uma coluna de gente — inclusive a que Produto
 * pediu por escrito ("os nomes dos colaboradores mais caros").
 *
 * CPF e e-mail continuam barrados **por forma**, em qualquer campo: é a
 * defesa que não depende de alguém ter nomeado a coluna direito.
 */
const CAMPO_DE_PESSOA =
  /"(?:cpf|cpf_ficticio|matricula|matrícula|email|e-mail|data_nascimento|dataDeNascimento|nascimento|banco|agencia|agência|conta_bancaria|pix|sindicato|rg|pis|titulo_eleitor)"\s*:/i;

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
