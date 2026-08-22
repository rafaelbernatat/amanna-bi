/**
 * O boot (T-139).
 *
 * `register()` roda uma vez, antes de a aplicação atender qualquer requisição.
 * É o único lugar de onde dá para abortar o processo *antes* de servir uma
 * tela — e servir uma tela com configuração parcial é exatamente o que a
 * validação existe para impedir (seção 11).
 */

import { exigirAmbienteValido } from "@/seguranca/configuracao";

export function register(): void {
  // Falha aqui derruba o processo com a lista completa de variáveis erradas.
  // Deixar subir e falhar depois trocaria "não sobe" por "sobe e mente".
  exigirAmbienteValido(process.env);
}
