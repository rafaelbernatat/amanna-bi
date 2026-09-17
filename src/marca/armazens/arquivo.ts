/**
 * O armazém em arquivo: o modo do Docker no cliente.
 *
 * A decisão D5 põe o produto rodando dentro da rede do cliente, e a seção 15
 * manda a diferença de cliente viver em configuração. Um diretório montado é
 * exatamente isso: o documento fica no volume do cliente, some quando o
 * cliente apaga o volume, e nunca atravessa a nossa infraestrutura.
 *
 * ## A gravação é atômica, e precisa ser
 *
 * Escreve num arquivo temporário e renomeia. Renomear dentro do mesmo sistema
 * de arquivos é atômico, então nunca existe um instante em que o documento
 * está pela metade — e a leitura, que é defensiva mas não é transacional,
 * jamais vê meio JSON. Sem isso, um contêiner reiniciado no meio da escrita
 * deixaria a instalação com um arquivo quebrado, que a leitura trataria como
 * "sem marca" e alguém interpretaria como "o produto perdeu a configuração".
 */

import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { FalhaAoGravarMarca, type ArmazemDaMarca } from "@/marca/armazem";
import {
  ESTADO_VAZIO,
  lerEstadoDeTexto,
  type EstadoDaMarca,
} from "@/marca/documento";

/** O nome do arquivo dentro do diretório montado. */
export const NOME_DO_ARQUIVO = "marca.json";

function motivoDe(erro: unknown): string {
  return erro instanceof Error ? erro.message : "erro desconhecido";
}

export function criarArmazemEmArquivo(diretorio: string): ArmazemDaMarca {
  const caminho = join(diretorio, NOME_DO_ARQUIVO);

  return {
    ler: async () => {
      try {
        return lerEstadoDeTexto(await readFile(caminho, "utf8"));
      } catch {
        // Arquivo ausente, diretório inexistente, permissão negada: para quem
        // lê, tudo isso é "não há marca", e a tela abre no tema padrão.
        return ESTADO_VAZIO;
      }
    },

    gravar: async (estado: EstadoDaMarca) => {
      const temporario = `${caminho}.${String(process.pid)}.tmp`;
      try {
        await mkdir(diretorio, { recursive: true });
        await writeFile(temporario, JSON.stringify(estado), "utf8");
        await rename(temporario, caminho);
      } catch (erro) {
        try {
          await unlink(temporario);
        } catch {
          // O temporário pode nem ter chegado a existir.
        }
        throw new FalhaAoGravarMarca(motivoDe(erro));
      }
    },

    limpar: async () => {
      try {
        await unlink(caminho);
      } catch (erro) {
        // Apagar o que já não existe é sucesso: o estado desejado é o estado.
        if (
          typeof erro === "object" &&
          erro !== null &&
          (erro as NodeJS.ErrnoException).code === "ENOENT"
        ) {
          return;
        }
        throw new FalhaAoGravarMarca(motivoDe(erro));
      }
    },
  };
}
