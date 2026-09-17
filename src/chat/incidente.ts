/**
 * O registro de incidente do chat (T-352, parte de T-321 e da seção 7.7).
 *
 * "Descartar e registrar, e não corrigir em silêncio" só vale se o registro
 * existir. Hoje é um log estruturado, uma linha por incidente, sem a pergunta
 * e sem o sujeito: o que se mede é a **frequência** — quantas vezes o
 * verificador recusou, quantas o inspetor bloqueou, quantas o laço não
 * concluiu —, e frequência não precisa de conteúdo. A tabela
 * `amanna.chat_incidente` (migração 010) recebe isto quando a auditoria de
 * T-324 decidir a retenção.
 *
 * Nunca lança: registrar não pode derrubar a resposta que está a caminho.
 */

export type TipoDeIncidente =
  | "verificador_recusou"
  | "inspetor_bloqueou"
  | "laco_falhou"
  | "laco_degradou"
  | "ferramenta_recusada";

export type Incidente = {
  readonly tipo: TipoDeIncidente;
  /** Só contagens, ids de métrica e códigos. Nunca texto da pergunta. */
  readonly detalhe: Readonly<Record<string, string | number | boolean | null>>;
};

/** Quem escreve o registro. Parâmetro para o teste ler o que saiu. */
export type Registrador = (linha: string) => void;

const PADRAO: Registrador = (linha) => {
  console.warn(linha);
};

export function registrarIncidente(
  incidente: Incidente,
  registrar: Registrador = PADRAO,
): void {
  try {
    registrar(
      JSON.stringify({
        evento: `chat.${incidente.tipo}`,
        ...incidente.detalhe,
        em: new Date().toISOString(),
      }),
    );
  } catch {
    // Registro que falha não vira erro de resposta.
  }
}
