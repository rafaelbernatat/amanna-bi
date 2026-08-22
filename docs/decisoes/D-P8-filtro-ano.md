# P8 — o alcance do filtro de ano

|                       |                                                                                                                                                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Decisão**           | O ano é **dimensão parametrizável**: a lista de anos sai de `getMeta`                                                                                                                                                                                                          |
| **Responde**          | PRD seção 18, decisão pendente P8 · Anexo D achado 6 · RF-05                                                                                                                                                                                                                   |
| **Quem decidiu**      | Rafael Lang, por Produto                                                                                                                                                                                                                                                       |
| **Data**              | 2026-08-22                                                                                                                                                                                                                                                                     |
| **Como foi decidido** | Produto delegou a escolha à Engenharia por escrito, com um critério único: _"a melhor opção pensando no usuário que vai utilizar a ferramenta"_. A decisão abaixo foi tomada sob essa delegação, não em sessão de revisão de Produto. Reabri-la exige nova decisão registrada. |
| **Fixture**           | 2 anos completos e selecionáveis: **2025 e 2026**                                                                                                                                                                                                                              |

---

## O que estava errado

O protótipo tem um seletor de **Ano** com `2026` e `2025` na barra de filtros. Ele
não faz nada: `f.ano` aparece **zero vezes** no código. A pessoa troca o ano e
nenhum número muda em nenhum painel. O que existe é `receitaLY`, uma série de
_comparação_ dentro do gráfico — não um recorte do ano anterior.

Isso é o achado 6 do Anexo D, e contraria RF-05: _"Selecionar 2025 muda os
valores de todos os painéis, e não apenas a série de comparação."_

## A decisão

**Saída (b): o ano é uma dimensão como qualquer outra.** A lista de anos
disponíveis vem de `getMeta`, junto com as demais dimensões e o selo de frescor.
Acrescentar 2024 aos dados faz o filtro passar a oferecer três anos **sem
alteração de código e sem imagem nova**.

## Por que esta, pensando em quem usa

**1 · A ferramenta não pode quebrar na virada do ano.**
Com dois valores fixos em código (saída _a_), na primeira semana de janeiro de
2027 o CFO abre o painel e não consegue ver 2027 — alguém precisa editar o tipo
`Query`, reconstruir a imagem e reimplantar, para uma mudança que é puramente de
dado. Numa instalação dedicada, feita para rodar anos (D1), isso é uma falha
constrangedora num produto de controladoria. A seção 15 do PRD já diz o
princípio: _imagem única, sem build específico por cliente; toda diferença de
cliente vive em configuração_. Ano fixado em código viola exatamente isso.

**2 · Sem ano no recorte, um link compartilhado mente com o tempo.**
RF-08 promete que colar a URL reproduz a mesma tela para outra pessoa. Se o ano
sair do filtro e da URL (saída _c_), o link que alguém mandou em dezembro
apontando para o fechamento de 2026 passa a mostrar 2027 sozinho, em silêncio,
depois da virada. O _job to be done_ da seção 3 é literalmente _"quando alguém
questiona um número na reunião, quero mostrar de onde ele veio"_ — e um endereço
que muda de resposta com o calendário não sustenta isso.

**3 · Auditar o passado é uso previsto, não exceção.**
O objetivo O3 é zero divergência entre painel e fechamento contábil, e a persona
Analista de BI existe para responder _"de onde vem esse número?"_. Reproduzir um
número citado numa reunião de seis meses atrás exige voltar ao ano em que ele
foi calculado. A saída (c) elimina essa possibilidade para economizar histórico —
economia pequena, perda grande.

## O que a decisão custa, e por que vale

Carregar 24 meses de histórico na réplica em vez de 12. No grão mensal, com 13
telas, é volume desprezível — a própria seção 8.2 do PRD escolhe PostgreSQL
dizendo que ele é _"suficiente para o volume"_. O custo real não é de banco: é de
o tipo `Query` deixar de ter o ano como par fixo de literais. Esse custo já
estava previsto: a tarefa **T-004** existe exatamente para derivar a matriz
canônica de recortes de `getMeta` em vez de escrevê-la como constante.

## Quantos anos a fixture carrega

**Dois anos completos, ambos selecionáveis: 2025 e 2026.**

O ano mais antigo disponível **não inventa** uma série de comparação: ao
selecionar 2025, a comparação com 2024 devolve vazio com motivo
`sem_dado_no_recorte`, e o painel mostra o estado, não um zero (princípio PR-4).

Duas razões para preferir isto a carregar 2024 só como base de comparação:

- Um ano que serve de comparação mas não pode ser selecionado é uma assimetria
  que a pessoa não tem como entender na tela.
- O caso "não há ano anterior" deixa de ser uma borda descoberta em produção e
  vira **estado exercitado pela suíte de contrato** — que é o que a seção 10.4
  pede quando manda rodar com dados deliberadamente incompletos.

Como o domínio é parametrizável, acrescentar 2024 depois é carga de dado, não
mudança de código. É esse justamente o ponto de ter escolhido (b).

## Efeito no contrato

| O que muda                  | Como fica                                                                                                                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Query.ano`                 | Deixa de ser `"2026" \| "2025"` fixo em código; o domínio válido vem de `getMeta` e é validado contra ele                                                                                      |
| Matriz canônica de recortes | Os **768** recortes (4 períodos × 2 anos × 3 entidades × 8 áreas × 4 modalidades) continuam sendo 768 **na fixture atual** — mas passam a ser **contados**, não escritos. É o aceite de T-004. |
| Barra de filtros            | O seletor de ano é populado por `getMeta`, como as demais dimensões                                                                                                                            |
| RF-05                       | Passa a ser verificável: selecionar 2025 muda os valores de todos os painéis                                                                                                                   |

## Efeito no backlog

Aplicado por `T-004`, o portão de domínio que a própria seção 18 do PRD exigia
antes de F1:

| Tarefa  | O que mudou                                                                                                                                                                                             |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `T-101` | Aceite alinhado: `Query` deixa de exigir "2 anos" como literais de tipo. O ano é validado contra o que `getMeta` declara, e a matriz de recortes vem de `T-004`. Passa a depender de `T-002` e `T-004`. |
| `T-103` | Passa a depender de `T-002` e `T-004`                                                                                                                                                                   |
| `T-131` | Passa a depender de `T-002`                                                                                                                                                                             |
| `T-140` | Passa a depender de `T-002` e `T-004`                                                                                                                                                                   |

O módulo `src/semantica/recortes.ts` deriva a matriz canônica das dimensões e
**conta** os recortes em vez de repetir 768. Um teste garante que o literal
`768` não volta ao código de produção.

## Tarefas destravadas

`T-002` · `T-004` · `T-101` · `T-103` · `T-131` · `T-140` · `T-152` · `T-153` ·
`T-185` · `T-237`
