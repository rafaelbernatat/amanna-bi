/**
 * Gera e confere `tests/contrato/matriz-recortes.yaml` (T-121).
 *
 *   npx tsx ferramentas/contrato/matriz.mts           grava
 *   npx tsx ferramentas/contrato/matriz.mts --check   reprova se divergir
 *
 * ## Por que a matriz é um arquivo versionado
 *
 * Porque alguém precisa **assinar** o que a suíte cobre. O item H-05 põe isso
 * por escrito: a reconciliação entre KPI e painel roda nos 768 recortes sem
 * amostragem, e qualquer dimensão amostrada nas demais regras exige
 * justificativa com responsável e data.
 *
 * Uma matriz que vive só em código muda com um commit e ninguém percebe que a
 * cobertura encolheu. Em arquivo, encolher a cobertura vira diff — e o diff é o
 * que a pessoa que assinou vai reconhecer.
 *
 * ## Derivado, e não escrito
 *
 * As 768 combinações saem de `matrizDeRecortes`, que sai das dimensões. Escrever
 * a lista à mão daria um arquivo que concorda com o produto no dia em que foi
 * escrito — e a contagem, especialmente, precisa ser **contada**: foi o defeito
 * que T-004 corrigiu, onde 768 era constante literal nos critérios de aceite.
 *
 * ## Nada está amostrado hoje, e isso é a resposta certa
 *
 * Amostragem exige justificativa assinada, e H-05 está aberto. Enquanto
 * estiver, toda combinação é exaustiva: cobrir demais custa tempo de CI, cobrir
 * de menos custa uma divergência que ninguém viu.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { format, resolveConfig } from "prettier";

import { dimensoesProvisorias } from "../../src/acesso/dimensoes-provisorias.ts";
import {
  contarRecortes,
  matrizDeRecortes,
} from "../../src/semantica/recortes.ts";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DESTINO = resolve(RAIZ, "tests", "contrato", "matriz-recortes.yaml");

const dimensoes = dimensoesProvisorias();
const matriz = matrizDeRecortes(dimensoes);
const contagem = contarRecortes(dimensoes);

/**
 * Uma combinação em uma linha de YAML, na ordem canônica.
 *
 * O tipo vem da própria matriz, e não de um `import type`. A configuração do
 * ESLint deste repositório cobre `src/` e `tests/`, e não `.mts` — nesses
 * arquivos a anotação de tipo não é reconhecida como uso, e um tipo importado
 * vira "declarado e nunca usado". Derivar evita a falsa infração sem desligar
 * regra nenhuma.
 */
function linha(r: (typeof matriz)[number]): string {
  const ano = r.ano === undefined ? "" : `, ano: ${r.ano}`;
  return (
    `  - { periodo: ${r.periodo}${ano}, entidade: ${r.entidade}, ` +
    `area: ${r.area}, modalidade: ${r.modalidade}, cobertura: exaustiva }`
  );
}

const bruto = `# A matriz canônica de recortes da suíte de contrato (T-121)
#
# GERADO. Não edite. A fonte são as dimensões do produto; para mudar a matriz,
# mude as dimensões e rode 'npm run matriz'.
#
# Este arquivo é versionado porque alguém precisa assinar o que a suíte cobre
# (H-05). Uma matriz que vive só em código muda com um commit e ninguém percebe
# que a cobertura encolheu; em arquivo, encolher vira diff.
#
# ---------------------------------------------------------------------------
# Cobertura
# ---------------------------------------------------------------------------
#
#   exaustiva  a suíte roda esta combinação
#   amostrada  a suíte pula, e o porquê está na seção 'amostragem' abaixo
#
# Hoje TODAS são exaustivas, e isso não é preguiça de amostrar: amostragem exige
# justificativa com responsável e data, e o item H-05 — que aprova a matriz —
# está aberto. Enquanto estiver, cobrir demais custa tempo de CI e cobrir de
# menos custa uma divergência que ninguém viu.
#
# A regra 1 (reconciliação KPI × painel) roda SEMPRE exaustiva, mesmo depois de
# H-05: é o que o item exige por escrito, e T-193 reprova o CI se alguma
# combinação dela for marcada como amostrada.

versao: 1
gerado_por: ferramentas/contrato/matriz.mts
dimensoes:
  periodo: ${JSON.stringify(dimensoes.periodo)}
  ano: ${JSON.stringify(dimensoes.ano ?? [])}
  entidade: ${JSON.stringify(dimensoes.entidade)}
  area: ${JSON.stringify(dimensoes.area)}
  modalidade: ${JSON.stringify(dimensoes.modalidade)}

# Contado a partir das dimensões, nunca escrito.
total: ${String(contagem)}
exaustivas: ${String(contagem)}
amostradas: 0

# Uma entrada por dimensão amostrada, com responsável e data (H-05).
# Vazio enquanto H-05 não assinar.
amostragem: []

recortes:
${matriz.map(linha).join("\n")}
`;

const config = await resolveConfig(DESTINO);
const gerado = await format(bruto, { ...config, filepath: DESTINO });

if (process.argv.includes("--check")) {
  let atual = "";
  try {
    atual = readFileSync(DESTINO, "utf8");
  } catch {
    atual = "";
  }
  if (atual !== gerado) {
    console.error(
      "tests/contrato/matriz-recortes.yaml está atrasado.\n" +
        "Rode 'npm run matriz' e inclua o arquivo no commit.\n\n" +
        "A matriz é o que alguém assina (H-05). Divergir dela em silêncio é\n" +
        "encolher a cobertura sem que a assinatura fique inválida.",
    );
    process.exit(1);
  }
  console.log(`matriz em dia · ${String(contagem)} recortes, todos exaustivos`);
} else {
  writeFileSync(DESTINO, gerado);
  console.log(
    `matriz gravada · ${String(contagem)} recortes, todos exaustivos`,
  );
}
