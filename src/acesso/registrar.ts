/**
 * Registra os adaptadores na fábrica (T-131).
 *
 * A fábrica de T-106 é um registro vazio de propósito: importar as duas
 * implementações nela colocaria o driver do Postgres no grafo de uma
 * demonstração com fixtures. Quem se registra é cada adaptador, e este arquivo
 * é onde o de fixtures faz isso.
 *
 * Importado por `leitura.ts`, que é o único caminho da tela até o dado. O
 * adaptador de warehouse se registra no próprio módulo, em F2.
 */

import { registrarFonte } from "@/acesso/fabrica";
import { criarFonteDeFixtures } from "@/acesso/fixtures/adaptador";

registrarFonte("fixtures", async () => criarFonteDeFixtures());
