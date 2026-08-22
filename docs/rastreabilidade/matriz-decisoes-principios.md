# Matriz de rastreabilidade — decisões e princípios

|                   |                                                              |
| ----------------- | ------------------------------------------------------------ |
| **Origem**        | [TASKS.md](../../TASKS.md), campo `PRD:` de todas as tarefas |
| **Produzida por** | T-013                                                        |
| **Gerada em**     | 2026-08-21                                                   |

O mesmo símbolo `P1` significava duas coisas diferentes no backlog: a decisão
pendente P1 da seção 18 do PRD e o princípio de produto P1 da seção 2. Nos
campos `PRD:` das tarefas os dois apareciam sem prefixo, e nada além do contexto
distinguia um do outro. Esta matriz existe para que a distinção deixe de
depender de leitura atenta.

## Convenção

| Prefixo         | Significa                | Onde está no PRD | Quantos |
| --------------- | ------------------------ | ---------------- | ------: |
| `D-P1` … `D-P8` | Decisão **pendente**     | seção 18         |       8 |
| `PR-1` … `PR-4` | Princípio de **produto** | seção 2          |       4 |

O PRD continua escrevendo `P1` nos dois sentidos — ele não é editado por esta
tarefa. A convenção com prefixo vale para o backlog, que é onde a ambiguidade
causava dano: uma tarefa citando `P4` sem prefixo podia ser lida como
"depende de uma decisão que ninguém tomou" ou como "obedece a um princípio".

## As 8 decisões: quem decide, quem aplica

Regra verificada: **cada decisão aparece exatamente uma vez como `decide` e ao menos uma vez como `aplica`.**

| Ref      | Pergunta (PRD 18)                                                      | Quem decide         | Tarefa que **decide** | Instrução | Tarefas que **aplicam**                              |
| -------- | ---------------------------------------------------------------------- | ------------------- | --------------------- | --------- | ---------------------------------------------------- |
| **D-P1** | Qual é o sistema de origem de cada uma das _views_?                    | TI do cliente       | `T-003`               | H-12      | `T-013`, `T-211`                                     |
| **D-P2** | Transferência interna conta como desligamento?                         | RH e Controladoria  | `T-007`               | H-06      | `T-113`, `T-155`, `T-218`, `T-239`                   |
| **D-P3** | Rescisão entra na folha do mês de competência ou de pagamento?         | Controladoria       | `T-008`               | H-07      | `T-113`, `T-155`, `T-219`, `T-239`                   |
| **D-P4** | Qual a janela e a cadência de sincronização aceitáveis?                | TI do cliente       | `T-009`               | H-13      | `T-208`, `T-232`                                     |
| **D-P5** | Qual o limite de defasagem que dispara o aviso no selo de frescor?     | Controladoria       | `T-010`               | H-23      | `T-149`, `T-166`, `T-233`, `T-235`                   |
| **D-P6** | Docker no cliente ou nuvem dedicada, para este contrato?               | Comercial           | `T-011`               | H-09      | `T-206`, `T-231`, `T-249`                            |
| **D-P7** | Retenção do registro de auditoria e das perguntas do chat?             | Jurídico do cliente | `T-012`               | H-11      | `T-250`, `T-323`, `T-324`                            |
| **D-P8** | O filtro de ano continua com dois valores fixos ou vira seleção livre? | Produto             | `T-002`               | H-01      | `T-004`, `T-013`, `T-152`, `T-153`, `T-237`, `T-307` |

## Decisões já registradas

Quando uma decisão é tomada, ela vira documento versionado — é ele que as
tarefas de F1 citam quando escrevem `D-Pn` no campo `PRD:`.

| Ref      | Documento                                            | Data       | Escolha                                                   |
| -------- | ---------------------------------------------------- | ---------- | --------------------------------------------------------- |
| **D-P8** | [D-P8-filtro-ano.md](../decisoes/D-P8-filtro-ano.md) | 2026-08-22 | O ano é dimensão parametrizável; a lista vem de `getMeta` |

Fora da seção 18, a revisão de D4 seguiu o mesmo formato:
[D-D4-biblioteca-de-graficos.md](../decisoes/D-D4-biblioteca-de-graficos.md).

## Os 4 princípios: quem os aplica

Princípio não se decide nem se destrava — ele é portão de verificação de toda tarefa (EXECUTE.md seção 1).

| Ref      | Princípio (PRD 2)                | Tarefas que o citam                                                                                      |
| -------- | -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **PR-1** | Uma leitura, uma fonte           | `T-013`, `T-101`, `T-106`, `T-134`, `T-312` _(5)_                                                        |
| **PR-2** | O chat não calcula; o chat lê    | `T-305`, `T-306`, `T-313`, `T-314`, `T-322` _(5)_                                                        |
| **PR-3** | Todo número declara sua fórmula  | `T-109`, `T-131`, `T-150`, `T-310` _(4)_                                                                 |
| **PR-4** | Recorte vazio é estado, não zero | `T-013`, `T-105`, `T-132`, `T-133`, `T-154`, `T-159`, `T-162`, `T-170`, `T-216`, `T-329`, `T-340` _(11)_ |

## Achado em aberto — dependência que falta

Terceira exigência do aceite de T-013: _nenhuma tarefa de F1/F2/F3 referencia
decisão pendente sem depender da tarefa F0 correspondente._ **Ela não está
satisfeita hoje:** 13 tarefas citam uma decisão sem declarar dependência
dela, e outras 3 dependem apenas por caminho transitivo.

Corrigir isso exige editar o campo `Depende de:` dessas tarefas. A seção 11 do
EXECUTE.md reserva a reescrita de dependências a `T-004`, e apenas para
`T-101`, `T-103`, `T-131` e `T-140`. T-013 está autorizada a padronizar os
campos `PRD:`, não a alterar a estrutura de dependência do backlog — por isso o
achado é publicado aqui em vez de corrigido em silêncio, e a autorização está
pedida no item **H-42** de INSTRUCOES.md.

Por que importa: uma tarefa de F2 que aplica D-P6 sem depender de `T-011` pode
ser escolhida pelo laço antes de a decisão existir. Ela então congela em código
uma escolha que ainda não foi feita — que é exatamente o defeito que a auditoria
apontou em P8 e que originou `T-004`.

| Ref  | Tarefa                                               | Fase | Precisa depender de | Hoje        |
| ---- | ---------------------------------------------------- | ---- | ------------------- | ----------- |
| D-P1 | `T-211` Preencher o mapeamento das métricas financei | F2   | `T-003`             | transitiva  |
| D-P2 | `T-113` Escrever as 21 métricas do Anexo B no catálo | F1   | `T-007`             | **ausente** |
| D-P2 | `T-155` Versionar o catálogo e tornar o campo decisã | F1   | `T-007`             | **ausente** |
| D-P2 | `T-239` Reconciliar os números de RH contra a folha  | F2   | `T-007`             | transitiva  |
| D-P3 | `T-113` Escrever as 21 métricas do Anexo B no catálo | F1   | `T-008`             | **ausente** |
| D-P3 | `T-155` Versionar o catálogo e tornar o campo decisã | F1   | `T-008`             | **ausente** |
| D-P3 | `T-239` Reconciliar os números de RH contra a folha  | F2   | `T-008`             | transitiva  |
| D-P4 | `T-208` Implementar o job de sync com carga completa | F2   | `T-009`             | **ausente** |
| D-P5 | `T-149` Definir o contrato de Meta com frescor, impl | F1   | `T-010`             | **ausente** |
| D-P5 | `T-166` Renderizar o selo de frescor e o estado dado | F1   | `T-010`             | **ausente** |
| D-P5 | `T-233` Registrar o histórico de execuções do sync e | F2   | `T-010`             | **ausente** |
| D-P6 | `T-231` Montar o pacote de instalação Docker no clie | F2   | `T-011`             | **ausente** |
| D-P6 | `T-249` Montar o modo de nuvem dedicada e adequar o  | F2   | `T-011`             | **ausente** |
| D-P7 | `T-250` Anexar ao contrato as views, a fronteira de  | F2   | `T-012`             | **ausente** |
| D-P7 | `T-323` Registrar a trilha de auditoria completa de  | F3   | `T-012`             | **ausente** |
| D-P8 | `T-307` Normalizar e validar os filtros da intenção  | F3   | `T-002`             | **ausente** |

## Como reverificar

O comando abaixo reconstrói esta matriz a partir de TASKS.md e falha se a
convenção regredir — um `P<n>` nu voltar a aparecer num campo `PRD:`, uma
decisão perder seu `decide`, ou uma decisão ficar sem nenhum `aplica`.

```
npm test -- rastreabilidade
```

Estado na geração: convenção aplicada em **58 referências**, **0** tokens
ambíguos restantes, critério de `decide`/`aplica` **satisfeito nas 8 decisões**,
critério de dependência **com 13 pendências** listadas acima.
