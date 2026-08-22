# D4 revisada — biblioteca de gráficos

|                  |                                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| **Decisão**      | Os gráficos passam a ser desenhados com **recharts**, no cliente                                |
| **Substitui**    | PRD v2.0 seção 8.2, linha `Gráficos`: _"SVG renderizado no servidor, sem biblioteca de charts"_ |
| **Quem decidiu** | Rafael Lang, por Produto                                                                        |
| **Data**         | 2026-08-22                                                                                      |
| **Alcance**      | Reabre a decisão travada **D4** (seção 0 do PRD), que só se reabre por nova versão do documento |

---

## A decisão

O produto adota **recharts 3.10.1** como biblioteca de gráficos. A escolha foi
tomada por Produto com as consequências abaixo apresentadas por escrito antes
da aprovação, e é ela que autoriza a edição do PRD e a reabertura de T-129.

## O que o PRD dizia, e por quê

A seção 8.2 fixava SVG renderizado no servidor, sem biblioteca, com três
justificativas: sem dependência de runtime, sem _layout shift_, e o mesmo
componente servindo painel e chat. As três continuam sendo requisitos do
produto — o que muda é que agora precisam ser sustentadas **apesar** da
biblioteca, e não por ausência dela.

## Consequências aceitas

| Consequência                               | Como fica                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Painel deixa de ser Server Component       | recharts exige `"use client"`. A consulta, a agregação e a formatação continuam no servidor (princípio PR-1): o cliente recebe séries já calculadas e formatadas, e só desenha.                                                                                                                                                                                                       |
| JavaScript de gráfico no cliente           | Passa a existir. T-176 media orçamento de JS inicial e reprovava pacote de gráficos no grafo do cliente; o critério foi reescrito para orçamento com teto, em vez de proibição.                                                                                                                                                                                                       |
| `ResponsiveContainer` usa `ResizeObserver` | O painel reserva a caixa por `aspect-ratio` **antes** de montar o gráfico, para o CLS seguir em zero. Isso é requisito, não detalhe: a seção 13 do PRD exige repintura em 400 ms e primeira carga em 1,5 s.                                                                                                                                                                           |
| Cobertura parcial do vocabulário           | recharts cobre nativamente 7 das 12 formas do Anexo A.1: `barras`, `linha`, `barras horizontais`, `barras empilhadas`, `rosca`, `dispersão` e `funil`. As outras 5 — `cascata`, `mosaico geográfico`, `régua de ciclo`, `divisão` e `estatísticas` — continuam desenhadas à mão. O projeto passa a ter **dois** caminhos de desenho, e o registro de painéis diz qual cada forma usa. |
| Exportação em PNG (T-409)                  | Deixa de partir do SVG do servidor e passa a partir do SVG que a biblioteca produz no cliente. O critério da tarefa foi ajustado.                                                                                                                                                                                                                                                     |

## O que **não** muda

- O vocabulário visual continua **fechado em 12 formas** (Anexo A.1). Não existe
  construtor de gráfico livre — isso segue como não-objetivo da seção 4.
- Os princípios PR-1 a PR-4 seguem valendo integralmente. Nenhum componente de
  gráfico lê dado: recebe séries prontas da camada de acesso.
- A fórmula continua obrigatória e não configurável (RF-04, PR-3).
- O grão mínimo continua área × mês (seção 11).

## Efeito no backlog

| Tarefa  | O que aconteceu                                                                                                                                                                                               |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `T-129` | Volta de `[X]` para `[~]`. O aceite exigia _"nenhuma biblioteca de gráficos no package.json"_, que a nova seção 8.2 contradiz. Reescrito para exigir determinismo do domínio e CLS zero **com** a biblioteca. |
| `T-176` | Aceite reescrito: orçamento de JavaScript com teto, em vez de proibir pacote de gráficos no grafo do cliente.                                                                                                 |
| `T-409` | Origem do PNG passa a ser o SVG produzido pela biblioteca.                                                                                                                                                    |

Cascade verificada em 2026-08-22: os seis dependentes de T-129 — `T-130`,
`T-164`, `T-165`, `T-191`, `T-312` e `T-409` — estavam todos em `[ ]`. Nenhuma
tarefa concluída dependia dela, então a reversão não propagou.
