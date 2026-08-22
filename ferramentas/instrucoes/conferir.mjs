/**
 * Recomputa os resumos de INSTRUCOES.md a partir dos proprios itens.
 *
 *   node ferramentas/instrucoes/conferir.mjs           corrige os resumos
 *   node ferramentas/instrucoes/conferir.mjs --check   reprova se divergirem
 *
 * ## Por que isto existe
 *
 * Uma auditoria encontrou oito contagens erradas neste arquivo ao mesmo tempo:
 * o Panorama dizia 44 itens quando havia 47, o total de P0 dizia 26 quando
 * eram 29, a tabela "Por responsavel" somava 44, o subtitulo da Fase 1 nao
 * fechava consigo mesmo, e o Indice reverso tinha perdido cinco tarefas.
 *
 * Nenhuma delas foi descuido isolado: toda vez que um item H-xx entra, cinco
 * lugares diferentes precisam ser atualizados a mao, e a mao esquece. O
 * arquivo e lido por **pessoas** para decidir por onde comecar -- um Panorama
 * que subconta manda a fila para o lugar errado.
 *
 * A partir daqui os resumos sao **derivados**. Os itens continuam escritos a
 * mao, que e onde o julgamento mora; o que era aritmetica virou aritmetica.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ARQUIVO = resolve(RAIZ, "INSTRUCOES.md");

const texto = readFileSync(ARQUIVO, "utf8");
const linhas = texto.split("\n");

/* ------------------------------------------------------------------ *
 * Ler os itens
 * ------------------------------------------------------------------ */

const SECOES = [
  "Antes da Fase 1 · Contrato",
  "Antes da Fase 2 · Dado real",
  "Antes da Fase 3 · Chat com IA",
  "Antes da Fase 4 · Escala",
];

/** Nome curto da secao, como aparece no Panorama. */
const curto = (s) => s.replace(/^Antes da /, "");

const itens = [];
let secaoAtual = null;
let item = null;

for (const linha of linhas) {
  // Só os quatro títulos de fase mudam a seção corrente. Os demais `##`
  // (Panorama, Legenda, Índice reverso) não trazem itens H-xx atrás deles.
  const cab = /^## (.+)$/.exec(linha);
  if (cab !== null && SECOES.includes(cab[1])) secaoAtual = cab[1];

  const titulo = /^### \[(.)\] (H-\d+) · (.+)$/.exec(linha);
  if (titulo !== null) {
    item = {
      resolvido: titulo[1] === "X",
      id: titulo[2],
      titulo: titulo[3],
      secao: secaoAtual,
      prioridade: null,
      responsavel: null,
      destrava: [],
    };
    itens.push(item);
    continue;
  }

  if (item === null) continue;

  const pri = /^`(P\d)` · \*\*Respons[áa]vel:\*\* (.+)$/.exec(linha);
  if (pri !== null && item.prioridade === null) {
    item.prioridade = pri[1];
    item.responsavel = pri[2].trim();
  }

  const des = /^\| \*\*Destrava\*\* \| (.+?) \|$/.exec(linha);
  if (des !== null && item.destrava.length === 0) {
    item.destrava = [...des[1].matchAll(/T-\d+(?:\.\d+)?/g)].map((m) => m[0]);
  }
}

if (itens.length === 0) {
  console.error("Nenhum item H-xx encontrado. O formato do arquivo mudou?");
  process.exit(1);
}

const semPrioridade = itens.filter((i) => i.prioridade === null);
if (semPrioridade.length > 0) {
  console.error(
    `Itens sem linha de prioridade/responsável: ${semPrioridade.map((i) => i.id).join(", ")}`,
  );
  process.exit(1);
}

/* ------------------------------------------------------------------ *
 * Recomputar
 * ------------------------------------------------------------------ */

const total = itens.length;
const resolvidos = itens.filter((i) => i.resolvido).length;
const p0 = itens.filter((i) => i.prioridade === "P0").length;

/** Tarefas distintas destravadas — a uniao, nao a soma (uma tarefa pode esperar duas). */
const tarefas = new Set(itens.flatMap((i) => i.destrava));

const porSecao = SECOES.map((s) => {
  const dela = itens.filter((i) => i.secao === s);
  return {
    secao: curto(s),
    itens: dela.length,
    resolvidos: dela.filter((i) => i.resolvido).length,
    p0: dela.filter((i) => i.prioridade === "P0").length,
    tarefas: new Set(dela.flatMap((i) => i.destrava)).size,
  };
});

const porResponsavel = [
  ...itens.reduce(
    (m, i) => m.set(i.responsavel, (m.get(i.responsavel) ?? 0) + 1),
    new Map(),
  ),
].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

/** Os que mais destravam, contando tarefas distintas. */
const maisDestravam = [...itens]
  .filter((i) => !i.resolvido)
  .sort((a, b) => b.destrava.length - a.destrava.length)
  .slice(0, 5);

/** Indice reverso: tarefa -> instrucoes que a seguram. */
const reverso = new Map();
for (const i of itens) {
  for (const t of i.destrava) {
    if (!reverso.has(t)) reverso.set(t, []);
    reverso.get(t).push(i.id);
  }
}
const ordemDeTarefa = (t) => Number(t.replace(/^T-/, "").replace(".", "."));

/* ------------------------------------------------------------------ *
 * Reescrever os blocos derivados
 * ------------------------------------------------------------------ */

let saida = texto;

// 1. Total do cabecalho
saida = saida.replace(
  /\| \*\*Total\*\* \| \d+ itens \(\d+ resolvidos\), destravando \d+ tarefas do backlog \|/,
  `| **Total** | ${total} itens (${resolvidos} resolvidos), destravando ${tarefas.size} tarefas do backlog |`,
);

// 2. Panorama
const panorama = [
  "| Quando | Itens | P0 | Tarefas destravadas |",
  "|---|---:|---:|---:|",
  ...porSecao.map(
    (s) =>
      `| ${s.secao} | ${s.itens}${s.resolvidos > 0 ? ` (${s.resolvidos} resolvidos)` : ""} | ${s.p0} | ${s.tarefas} |`,
  ),
  `| **Total** | **${total}** | **${p0}** | **${tarefas.size}** |`,
].join("\n");
saida = saida.replace(
  /\| Quando \| Itens \| P0 \| Tarefas destravadas \|\n(?:.*\n)*?\| \*\*Total\*\* \| \*\*\d+\*\* \| \*\*\d+\*\* \| \*\*\d+\*\* \|/,
  panorama,
);

// 3. Por responsavel
const tabelaResp = [
  "| Responsável | Itens |",
  "|---|---:|",
  ...porResponsavel.map(([r, n]) => `| ${r} | ${n} |`),
].join("\n");
saida = saida.replace(
  /\| Responsável \| Itens \|\n\|---\|---:\|\n(?:\| .+ \| \d+ \|\n?)+/,
  `${tabelaResp}\n`,
);

// 4. Os cinco que mais destravam
const tabelaTop = [
  "| Item | Destrava | Responsável |",
  "|---|---:|---|",
  ...maisDestravam.map(
    (i) =>
      `| **${i.id}** ${i.titulo} | ${i.destrava.length} tarefa${i.destrava.length === 1 ? "" : "s"} | ${i.responsavel} |`,
  ),
].join("\n");
saida = saida.replace(
  /\| Item \| Destrava \| Responsável \|\n\|---\|---:\|---\|\n(?:(?:\| .*\n)|\n)*?(?=\n?---)/,
  `${tabelaTop}\n`,
);

// 5. Subtitulo de cada secao
//
// A versao escrita a mao nao fechava consigo mesma: a da Fase 1 declarava 11
// itens e detalhava 4+1+1+2 = 8. Formato unico e derivado resolve as duas
// coisas -- a soma e a inconsistencia entre secoes.
for (const s of porSecao) {
  const dela = itens.filter((i) => curto(i.secao) === s.secao);
  const abertos = dela.filter((i) => !i.resolvido);
  const partes = [`${s.itens} ${s.itens === 1 ? "item" : "itens"}`];
  for (const p of ["P0", "P1", "P2"]) {
    const n = abertos.filter((i) => i.prioridade === p).length;
    if (n > 0) partes.push(`${n} ${p} aberto${n === 1 ? "" : "s"}`);
  }
  if (s.resolvidos > 0)
    partes.push(`${s.resolvidos} resolvido${s.resolvidos === 1 ? "" : "s"}`);
  const linha = `*${partes.join(" · ")}*`;

  // Ancorado no titulo da secao para nao trocar o subtitulo errado.
  const marca = `## Antes da ${s.secao}`;
  const i0 = saida.indexOf(marca);
  if (i0 >= 0) {
    const trecho = saida.slice(i0, i0 + 600);
    const atual = /^\*\d+ (?:item|itens).*\*$/m.exec(trecho);
    if (atual !== null) {
      saida =
        saida.slice(0, i0) +
        trecho.replace(atual[0], linha) +
        saida.slice(i0 + 600);
    }
  }
}

// 6. Indice reverso
const tabelaReverso = [
  "| Tarefa | Espera |",
  "|---|---|",
  ...[...reverso.keys()]
    .sort((a, b) => ordemDeTarefa(a) - ordemDeTarefa(b))
    .map((t) => `| ${t} | ${[...new Set(reverso.get(t))].join(", ")} |`),
].join("\n");
saida = saida.replace(
  /\| Tarefa \| Espera \|\n\|---\|---\|\n(?:\| T-.+ \| .+ \|\n?)+/,
  `${tabelaReverso}\n`,
);

/* ------------------------------------------------------------------ *
 * Gravar ou conferir
 * ------------------------------------------------------------------ */

const resumo = `${total} itens · ${resolvidos} resolvidos · ${p0} P0 · ${tarefas.size} tarefas destravadas`;

if (process.argv.includes("--check")) {
  if (saida !== texto) {
    console.error(
      "Os resumos de INSTRUCOES.md divergem dos itens que o arquivo define.\n" +
        "Rode 'npm run instrucoes' e inclua INSTRUCOES.md no commit.\n\n" +
        `O que os itens dizem: ${resumo}\n\n` +
        "Este arquivo é lido por pessoas para decidir por onde começar. Um\n" +
        "Panorama que subconta manda a fila para o lugar errado.",
    );
    process.exit(1);
  }
  console.log(`instruções em dia · ${resumo}`);
} else {
  writeFileSync(ARQUIVO, saida, "utf8");
  console.log(`INSTRUCOES.md atualizado · ${resumo}`);
}
