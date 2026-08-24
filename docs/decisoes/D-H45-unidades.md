# H-45 — a unidade de horas, contagem, pontos e anos

|                       |                                                                                                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Decisão**           | **Estender o enum.** `horas`, `contagem`, `pontos` e `anos` entram na regra 2 da seção 9.2, ao lado de `BRL_mi`, `pct`, `pp`, `dias` e `FTE`.                                           |
| **Responde**          | INSTRUCOES.md H-45 · PRD seção 9.2 regra 2 · T-107, T-113, T-145, T-164, T-165                                                                                                          |
| **Quem decidiu**      | Rafael Lang, por Produto                                                                                                                                                                |
| **Data**              | 2026-08-24                                                                                                                                                                              |
| **Como foi decidido** | Engenharia apresentou as três saídas de H-45 com o que cada uma custa. Produto escolheu a primeira, com o critério de que ela é a única que **não muda o que nenhum número significa**. |

---

## O que estava errado

A regra 2 da seção 9.2 fixa cinco unidades como enum fechado. Ao montar os
registros de painéis (T-107) e de KPIs (T-145), **cinco painéis e treze KPIs**
mostraram medidas que nenhuma das cinco nomeia — horas de treinamento,
candidatos por etapa, vagas por status, pontos de eNPS, idade média e tempo de
casa.

Não é enfeite do protótipo: horas de treinamento é a métrica 10 do Anexo B e
eNPS é a 14. Os dois registros ficaram com `unidade: null` nesses itens,
travando T-113 — e com ela toda a cadeia até o painel na tela.

## A decisão, e por que esta

**Nenhuma das outras duas saídas era barata do jeito que parecia.**

Reinterpretar dentro do enum atual (saída 2) não custa código — custa
significado. Dizer que eNPS é `pct` afirma que o número é uma proporção, e ele
não é: é a diferença entre duas proporções, e vive de -100 a +100. Dizer que
vaga é `FTE` afirma que uma vaga aberta é uma pessoa. Essas afirmações não ficam
no código; elas aparecem na primeira reunião em que alguém lê o eixo do gráfico.

Tirar do escopo (saída 3) encolheria justamente o que precisa ser aprovado: as
telas de Treinamento, Recrutamento e Engajamento ficariam parciais.

Estender o enum custa reabrir uma regra do PRD. É o custo menor, e é reversível:
uma unidade a mais no enum não muda nenhum número já escrito.

## As quatro unidades

| Unidade    | O que mede                                    | Soma ao longo do período? | Onde aparece                                  |
| ---------- | --------------------------------------------- | ------------------------- | --------------------------------------------- |
| `horas`    | horas de treinamento realizadas               | **sim**                   | `tre-horas`, `tre-area`, 2 KPIs de `rh/trein` |
| `contagem` | vagas, candidatos, desligamentos, estados     | **sim**                   | `rec-funil`, `rec-vagas`, 5 KPIs              |
| `pontos`   | eNPS, de -100 a +100                          | **não** — é taxa          | `eng-enps`, 2 KPIs de `rh/engaj`              |
| `anos`     | idade média, tempo de casa, tempo até a saída | **não** — é média         | 3 KPIs de `rh/colab` e `rh/turnover`          |

`pontos` e `anos` entram na lista de não-somáveis junto com `pct` e `pp`. Somar
o eNPS de doze meses dá um número que não existe, e a mesma coisa vale para
idade média. As duas se agregam por `ratio` — numerador e denominador
recompostos — ou por `last`.

## Uma correção de contagem no próprio item

H-45 escreve "**13 KPIs**" na prosa e sua tabela detalha **12**. O que falta é
`rh-turnover-tempo-ate-a-saida`, que mede tempo de casa na saída em **anos** — a
linha de `anos` do item cita só os dois de `rh/colab`. O registro de KPIs já
sabia disso: o campo `semDetalhamentoPorque` daquele KPI diz, com estas
palavras, _"o KPI é tempo de casa na saída, medido em anos"_.

Os treze estão nomeados na tabela acima e fixados em teste.

## Efeito no contrato

| O que muda                                | Como fica                                                                                                   |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `UNIDADES` em `src/semantica/contrato.ts` | Passa de cinco para nove valores                                                                            |
| PRD seção 9.2 regra 2                     | A lista de cinco passa a nove                                                                               |
| `NAO_SOMAVEIS` em `agregacao.ts`          | Ganha `pontos` e `anos`                                                                                     |
| Guarda do catálogo                        | Deixa de repetir `pct`/`pp` e passa a consultar `podeSomar`, que é a mesma lista                            |
| `src/semantica/paineis.ts`                | Os 5 painéis com `unidade: null` ganham unidade; sobram os 7 de forma `estatisticas`, que não são pendência |
| `src/semantica/kpis.ts`                   | Os 13 KPIs com `unidade: null` ganham unidade; nenhum sobra                                                 |

## Tarefas destravadas

`T-113` · `T-164` · `T-165`
