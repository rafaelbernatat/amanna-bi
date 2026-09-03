# H-60 — a unidade de múltiplo: `vezes`

|                       |                                                                                                                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Decisão**           | **Estender o enum.** `vezes` entra na regra 2 da seção 9.2, ao lado das nove unidades de D-H45, para os múltiplos: liquidez, dívida líquida sobre EBITDA, cobertura de juros, giro e GAO. |
| **Responde**          | INSTRUCOES.md H-60 · PRD seção 9.2 regra 2 · as perguntas de CFO da Dreamy (D-CHAT-perguntas-cfo)                                                                                         |
| **Quem decidiu**      | Rafael Lang, por Produto                                                                                                                                                                  |
| **Data**              | 2026-09-03                                                                                                                                                                                |
| **Como foi decidido** | Ao aprovar o plano de responder as 33 perguntas de CFO, com o mesmo critério de D-H45: é a única saída que **não muda o que nenhum número significa**.                                    |

---

## O que estava errado

O documento de perguntas de CFO da Dreamy pede, em seis respostas, um número
que é um **múltiplo**: "a dívida líquida é {alav} vezes o EBITDA", "a cobertura
de juros é de {cob} vezes", "a liquidez corrente é de {lc}" (lida como "para
cada R$ 1,00 devido, R$ 1,50 disponível"), "o grau de alavancagem operacional
é de {gao} vezes", giro do ativo e multiplicador do patrimônio.

Nenhuma das nove unidades os nomeia sem mentir. `pct` diria que liquidez de 1,8
é 1,8%; `pontos` diria que é uma diferença de proporções; `contagem` diria que
se soma ao longo do ano. A mentira não fica no código: aparece no eixo do
gráfico e na frase do chat.

## A decisão, e por que esta

As mesmas três saídas de H-45, com o mesmo resultado. Reinterpretar dentro do
enum custa significado; tirar do escopo tira justamente as perguntas que a
diretoria faz. Estender o enum custa reabrir a regra 2, e é reversível.

**Como se escreve:** por extenso, com uma casa — `1,8 vezes`, `1,0 vez`. Não
`1,8x` nem `1,8×`: a resposta do chat é prosa lida em voz alta, e o verificador
de RF-15 só aceita a forma canônica. Um modelo que escrever "1,8x" tem a
redação recusada, o que é o comportamento desejado: forma diferente é número
não conferido.

**Como se agrega:** não se soma. Um múltiplo é razão por definição — liquidez
de doze meses somada não é nada. `vezes` entra nos não-somáveis com `pct`,
`pp`, `pontos` e `anos`; métricas nessa unidade se agregam por `ratio` ou
`last`.

## Efeito no contrato

| O que muda                                     | Como fica                                                                                                             |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `UNIDADES` em `src/semantica/contrato.ts`      | Passa de nove para dez valores                                                                                        |
| PRD seção 9.2 regra 2                          | A lista de nove passa a dez                                                                                           |
| `NAO_SOMAVEIS` em `src/semantica/agregacao.ts` | Ganha `vezes`                                                                                                         |
| `TOLERANCIA` em `src/semantica/tolerancia.ts`  | `vezes: 0.05`, uma casa exibida                                                                                       |
| `formatarValor`                                | `1,8 vezes`, `1,0 vez`                                                                                                |
| `contratos/painel.schema.json`                 | Regerado por `npm run schema`                                                                                         |
| Cabeçalho de `catalogo/metricas.yaml`          | A lista de unidades ganha `vezes`                                                                                     |
| Verificador do chat (`src/chat/perguntar.ts`)  | Passa a capturar "vezes", "vez", "x" e "×" — e só a forma canônica é permitida                                        |
| Testes com a lista fixa                        | `contrato`, `camada-de-dados`, `suite-de-contrato`, `formato`; a guarda de não-somáveis passa a consultar `podeSomar` |

## Métricas que usam

`liquidez_corrente`, `liquidez_seca`, `liquidez_imediata`,
`divida_liquida_sobre_ebitda`, `divida_sobre_pl`, `cobertura_de_juros`,
`cobertura_do_servico_da_divida`, `giro_do_ativo`, `multiplicador_de_capital`,
`gao`. Todas provisórias (D-H03), a aprovar em H-08.
