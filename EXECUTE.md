# EXECUTE — protocolo de execução do backlog

Documento operacional. Quem executa [TASKS.md](TASKS.md) segue isto do início ao fim, sem improvisar.

| Entrada | O que é |
|---|---|
| [PRD.md](PRD.md) | A especificação. Vence qualquer outra fonte. |
| [TASKS.md](TASKS.md) | O backlog: 230 tarefas em ordem executável. |
| [INSTRUCOES.md](INSTRUCOES.md) | Tudo que exige uma pessoa. O laço lê e escreve aqui. |
| `public/design/Dashboard BI v2.dc.html` | O protótipo. Fonte da verdade de comportamento de tela. **Somente leitura.** |

**Regra de ouro:** o critério de aceite é o contrato. Não está feito até ele passar de verdade, executado e observado.

---

## O laço

```
   INÍCIO DA SESSÃO
        |
        v
   [1] Ler PRD.md inteiro  +  INSTRUCOES.md  +  retomar tarefa órfã
        |
        v
   [2] ESCOLHER  ------- nenhuma elegível? -----> [12] RELATÓRIO E PARADA
        |
        v
   [3] MARCAR [~] com dono e hora  -->  grava e commita AGORA
        |
        v
   [4] Ler as seções do PRD que a tarefa cita
        |
        v
   [5] Precisa de uma pessoa?  --sim-->  registra H-xx, volta a [ ] com  ⛔
        | não                                              |
        v                                                  +--> volta a [2]
   [6] IMPLEMENTAR
        |
        v
   [7] VERIFICAR  --falhou--> volta a [6]   (no máximo 3 rodadas;
        |                                     na 4ª, vira H-xx e segue)
        | passou
        v
   [8] Falta aprovação humana?  --sim-->  fica [~] com  ⏸  e segue
        | não
        v
   [9] MARCAR [X] + Panorama + commit  -->  volta a [2]
```

---

## 1 · Portão do PRD

**Leia [PRD.md](PRD.md) inteiro antes de tocar em qualquer tarefa.** Uma vez por sessão, sem exceção, mesmo achando que já conhece.

**Antes de cada tarefa, releia as seções que ela cita** no campo `**PRD:**`. O título da tarefa é resumo; a seção é a especificação.

### Como ler o campo `**PRD:**`

O mesmo símbolo aparece com três sentidos diferentes no projeto. Não confunda:

| No campo `**PRD:**` | Significa | Onde está |
|---|---|---|
| `P1` … `P8` | Decisão **pendente** | PRD seção 18 |
| `princípio P1` … `P4` | Princípio de produto | PRD seção 2 |
| `D1` … `D5` | Decisão **travada** | PRD seção 0 |
| `RF-01` … `RF-24` | Requisito funcional | PRD seção 12 |
| `O1` … `O5` | Objetivo | PRD seção 4 |
| `` `P0` `P1` `P2` `` (entre crases, no início da linha) | **Prioridade da tarefa**, não decisão | TASKS.md |

### Os quatro princípios são portão de verificação

Nenhuma tarefa fecha violando um princípio da seção 2 do PRD, mesmo que o critério de aceite não os mencione:

- **P1 · Uma leitura, uma fonte** — nenhum componente de interface lê dado direto.
- **P2 · O chat não calcula; o chat lê** — o modelo nunca produz número.
- **P3 · Todo número declara sua fórmula** — e isso não é configurável.
- **P4 · Recorte vazio é estado, não zero.**

O mesmo vale para a seção 11 (segurança, perfis e LGPD): grão mínimo área × mês, dado de pessoa sempre agregado, recorte por perfil aplicado no servidor.

Em conflito, **o PRD vence** — inclusive sobre o texto da tarefa.

---

## 2 · Escolher a próxima tarefa

Percorra [TASKS.md](TASKS.md) de cima para baixo. A próxima é a **primeira** que satisfaz tudo isto:

1. Está `[ ]`.
2. Toda tarefa do campo `**Depende de:**` está `[X]`.
3. **Toda tarefa citada em prosa dentro do `**Aceite:**` também está `[X]`.** O campo `Depende de:` não é completo — vários aceites mencionam `T-xxx` no meio do texto, e isso é dependência real. Antes de começar, procure `T-` no aceite e confira.
4. Não tem `⛔` ativo.

Se uma tarefa **acima** dela tiver dependência não satisfeita, algo saiu do lugar: registre em INSTRUCOES.md e não reordene por conta própria.

### Uma por vez, com dono e hora

No máximo uma tarefa em `[~]` **sem** `⏸`. Tarefas paradas em `⏸` (aguardando pessoa) não contam.

Antes de gravar qualquer status, **releia o arquivo do disco** (`git pull --rebase` se houver remoto). O marcador não é trava; a releitura é o que evita duas sessões pisando uma na outra.

Ao encontrar um `[~]` que não é seu:

| Situação | O que fazer |
|---|---|
| Dono é a sua sessão | Retome de onde parou |
| Dono é outra sessão, marcada há menos de 4 h | **Não pegue.** Escolha a próxima elegível |
| Dono é outra sessão, marcada há mais de 4 h | Sessão órfã: assuma, troque o dono e a hora, e diga isso no commit |

---

## 3 · Os três status

| Marcador | Significado | Quando escrever |
|---|---|---|
| `[ ]` | Não iniciada | Estado inicial, e para onde volta tarefa bloqueada antes de começar |
| `[~]` | Em andamento | **Ao pegar**, antes da primeira linha de código |
| `[X]` | Concluída | **Depois** do critério de aceite passar, e nunca antes |

### Anotações no fim da linha

```
- [~] **T-101** `P0` `M` `dados` Declarar os tipos...   ⏳ 2026-08-21 14:32 · sessao-a7fe
- [~] **T-146** `P1` `M` `dados` Publicar as fixtures...  ⏸ aguardando H-03
- [ ] **T-301** `P0` `M` `chat` Implementar o estágio 1...  ⛔ H-28
```

| Anotação | Sentido |
|---|---|
| `⏳ <data> <hora> · <sessão>` | Em execução. Obrigatória em todo `[~]`. |
| `⏸ aguardando H-xx` | Trabalho **feito**, esperando pessoa. Continua `[~]`, não conta no limite de um por vez. |
| `⛔ H-xx` | Não pôde começar: precisa de pessoa antes. Continua `[ ]`. |

### Três regras que não se negociam

- **`[~]` antes do trabalho, e commitado na hora.** Se a sessão cair, o repositório precisa mostrar onde parou.
- **`[X]` só com verificação executada.** Não é "acho que está pronto".
- **Nunca em lote.** Uma tarefa, uma edição, um commit.

---

## 4 · Fazer a tarefa

O campo `**Aceite:**` é a definição de pronto. Leia antes de começar.

- Faça **o que a tarefa pede**, nada além. Escopo extra vira tarefa nova.
- Reutilize o que já existe antes de criar.
- Se faltar um pré-requisito que não está no backlog, **não faça de contrabando**: crie a tarefa (seção 10) e faça-a primeiro.
- **Não altere o protótipo.** `public/design/Dashboard BI v2.dc.html` é entrada de leitura de nove tarefas — T-114, T-124, T-129, T-134, T-141, T-144, T-168, T-212 e T-317 — e é a referência de paridade das 13 telas. Ele nunca é editado por este laço.

---

## 5 · Bloqueio humano

Bloqueio humano é o que **você não pode fazer sozinho**: decisão de negócio, chave de API, cadastro, credencial, acesso de rede, aprovação, assinatura, ou uma dúvida que só uma pessoa resolve.

### Quando encontra um, antes de começar

1. Crie ou localize a entrada `H-xx` em [INSTRUCOES.md](INSTRUCOES.md).
2. Deixe a tarefa em `[ ]` e acrescente `⛔ H-xx` no fim da linha.
3. **Siga para a próxima.** Não pare o laço, não fique esperando.

### Quando o trabalho terminou mas falta aprovação

Esse é o caso mais comum do backlog — o aceite termina em "aprovado por", "acordado com", "assinado", "com data e responsável". Aqui **não** volte a `[ ]`: você perderia o trabalho feito.

1. Deixe a tarefa em `[~]` com `⏸ aguardando H-xx`.
2. Commite o entregável pronto.
3. Siga para a próxima.

### Desbloquear exige o artefato, não o marcador

Um `H-xx` marcado `[X]` **não basta**. Antes de retomar a tarefa, confirme que o resultado existe de fato: o arquivo de decisão está no repositório, a variável de ambiente responde, o acesso funciona. Se o marcador diz feito e o artefato não existe, reabra o `H-xx` e diga isso na entrada.

### Segredo nunca entra no repositório

[INSTRUCOES.md](INSTRUCOES.md) é versionado. Nele se registra **que** a chave foi emitida e **onde** ela foi colocada — nunca o valor.

- Chave, token, senha e string de conexão vão para `.env` local (fora do versionamento) ou para o cofre de segredos.
- Dado real de cliente não entra no repositório em nenhuma hipótese: nem como fixture, nem como anexo, nem em mensagem de commit.
- Não invente credencial nem contorne cadastro com valor de exemplo que depois vaza para produção.

---

## 6 · Verificar

Rodar o verificador **é** a tarefa. Sem isso não existe `[X]`.

### O que fazer

1. Execute o que o critério descreve: o teste, o comando, o build, a consulta.
2. **Registre o que rodou e quanto cobriu** — "14 testes passaram", não "os testes passaram". Um verde sem contagem não prova tamanho.
3. Se o critério diz "um teste falha se X", **provoque X** e confirme o vermelho. Teste que nunca falhou não prova nada.
4. Se o critério é de **ausência** — "a busca retorna zero ocorrências", "nenhum literal", "nenhum import" — rode a busca e mostre o zero, e depois plante uma ocorrência de propósito para confirmar que a busca a encontra. Uma busca quebrada também retorna zero.
5. Confira os princípios P1–P4 e a seção 11 (seção 1 deste documento).

### Orçamento de tentativas

O laço verificar → corrigir tem limite de **três rodadas**. Na quarta, pare: registre em INSTRUCOES.md o que foi tentado e por que não fecha, deixe a tarefa `[~]` com `⏸`, e siga. Um laço sem limite consome a sessão inteira numa tarefa só.

### Não dá para verificar?

Falta ambiente, dado ou acesso: **a tarefa não está concluída**. Vira `⛔` ou `⏸` conforme a seção 5, com a razão anotada.

---

## 7 · Concluir

Ao marcar `[X]`, atualize **os três contadores** de TASKS.md na mesma edição:

1. O cabeçalho: `| **Total** | 230 tarefas: N pendentes e M já concluídas... |`
2. A linha da fase no Panorama: `| Fase 1 · Contrato | 94 | ... | 3 de 94 |`
3. A linha `**Total**` do Panorama: `| **Total** | **230** | ... | **8 de 230** |`

Os contadores de P0/P1/P2 não mudam ao concluir — só ao criar ou remover tarefa.

---

## 8 · Git

O repositório tem `origin` configurado. Comece pelo commit inicial se ainda não houver histórico.

### Antes do primeiro commit

Crie `.gitignore` cobrindo pelo menos: `.env`, `.env.*` (exceto `.env.example`), `node_modules/`, `.next/`, `coverage/`, `*.log`, `*.pem`, `*.key`.

### Disciplina por commit

- **Prepare arquivo por arquivo.** Nunca `git add -A` sem olhar. Rode `git diff --cached` antes de commitar.
- **Varra segredo** no que está preparado antes de fechar o commit. Um `.env` commitado por engano não se apaga do histórico com um `rm`.
- **Um commit por transição de status**, e não commite código com tarefa em `[~]` sem dizer isso na mensagem.

### Mensagens

```
T-101 [~]: inicia os tipos do contrato de dados
```

```
T-101 [X]: declara os tipos do contrato de dados

Aceite verificado: npm test -- contrato/tipos  ->  14 passed, 0 failed
Falha provocada: literal fora do enum de Query nao compila (confirmado)
PRD: secao 9.1, secao 9.3
```

### Branch, CI e conflito

- Trabalhe em branch por tarefa ou por lote curto; nunca commite direto em `main` se houver regra de proteção.
- Se houver CI, **o verde do CI faz parte do aceite** de qualquer tarefa que dependa de portão de qualidade. Local passando e CI vermelho não é `[X]`.
- Conflito em TASKS.md: resolva **preservando os dois lados** — os marcadores de status de outra sessão nunca são descartados. Em dúvida, mantenha o status mais avançado (`[X]` > `[~]` > `[ ]`) e registre a resolução no commit.

---

## 9 · Desfazer um `[X]` indevido

Acontece: uma tarefa foi fechada e depois se descobre que o aceite não estava satisfeito.

1. Volte a tarefa para `[~]` com `⏳` e diga o motivo no commit.
2. **Verifique a cascata:** liste toda tarefa que depende dela (campo `Depende de:` e citações no aceite) e que já está `[X]`. Cada uma precisa ser reverificada, não presumida.
3. Corrija os três contadores do Panorama.
4. Registre em INSTRUCOES.md se a causa foi ambiguidade do critério — é sinal de que o aceite precisa ser endurecido.

---

## 10 · Quando a tarefa está errada

| Situação | O que fazer |
|---|---|
| Grande demais | Divida em filhas com **sufixo decimal**: `T-142.1`, `T-142.2`. Elas ficam logo abaixo da mãe. A mãe só vira `[X]` quando todas as filhas estiverem `[X]`, e enquanto isso fica `[~]`. |
| Falta pré-requisito | Crie `T-nnn.1` logo acima da tarefa atual e faça-a primeiro. |
| Aceite impossível ou ambíguo | Não invente um critério mais fraco. Registre em INSTRUCOES.md como dúvida, deixe `⏸`, siga. |
| Conflita com o PRD | O PRD vence. Registre em INSTRUCOES.md e não implemente pelo texto da tarefa. |
| **O PRD contradiz a si mesmo** | Acontece — o Anexo C tem duas fórmulas que não fecham. Não escolha sozinho: registre em INSTRUCOES.md e trate como decisão de Produto. |
| Já estava feita | `[X]` com a evidência de que o aceite já era satisfeito. |

Nunca use sufixo decimal para renumerar tarefas existentes. IDs são estáveis: outras tarefas apontam para eles.

### Formato exato de uma tarefa nova

```
- [ ] **T-142.1** `P0` `M` `dados` Título imperativo e curto
  · **Aceite:** Critério verificável, uma frase, dizendo como se sabe que terminou.
  · **PRD:** seção 9.2 regra 4, RF-04 · **Depende de:** T-104, T-107
```

O marcador `- [ ] `, as crases nos três rótulos, o prefixo `  · ` nas linhas de continuação e a ordem dos campos são obrigatórios: há verificação automática que lê esse formato.

---

## 11 · As três exceções

O laço proíbe editar o PRD e o backlog — **exceto quando isso é o entregável da tarefa.** Nesses casos, editar é obrigatório:

| Exceção | Quais tarefas | O que é permitido |
|---|---|---|
| Tarefa de domínio `auditoria` | As 32 marcadas `auditoria` | Corrigir o PRD onde a auditoria apontou defeito, dentro do escopo do aceite |
| Tarefa que reescreve dependências | `T-004` altera o `Depende de:` de T-101, T-103, T-131 e T-140 | Editar os campos nomeados no aceite |
| Tarefa que reescreve referências | `T-013` padroniza os campos `PRD:` | Editar os campos nomeados no aceite |

Fora dessas, PRD e estrutura do backlog são somente leitura. Toda edição permitida vai em commit separado, dizendo qual tarefa a autoriza.

---

## 12 · Começo, fim e parada

### Ao começar a sessão

1. Leia PRD.md inteiro.
2. Leia INSTRUCOES.md. Alguma entrada virou `[X]`? Confirme o artefato (seção 5) e tire o `⛔` ou o `⏸` das tarefas correspondentes.
3. Procure `[~]` órfão e retome pela regra das 4 horas (seção 2).

### Ao encerrar

1. Nenhum `[~]` sem `⏳` ou `⏸`.
2. Trabalho pendente commitado, com a mensagem dizendo onde parou.
3. Panorama batendo com os marcadores.

### Quando não há tarefa elegível

Isso não é erro, é o estado esperado sempre que a fase depende de pessoas. **Pare e produza um relatório**, não fique girando:

- Quantas tarefas em cada status.
- Toda tarefa em `⛔` ou `⏸`, com o `H-xx` que a segura.
- Os `H-xx` abertos, ordenados por quantas tarefas cada um destrava — é a fila de prioridade de quem for resolver.

Encerre a sessão. O laço recomeça quando um `H-xx` for resolvido.

---

## 13 · O que nunca fazer

- Marcar `[X]` sem executar a verificação.
- **Enfraquecer o aceite pela via técnica:** afrouxar `tsconfig`, baixar limiar de cobertura, marcar teste como `skip`, desligar regra de lint, alargar uma exceção. O critério vive na sua expressão executável, não só no texto.
- Atualizar status em lote no fim.
- Trabalhar em duas tarefas ao mesmo tempo.
- Pegar tarefa marcada por outra sessão há menos de 4 horas.
- Editar o PRD ou reordenar o backlog fora das três exceções da seção 11.
- Editar o protótipo.
- Escrever segredo em arquivo versionado, inclusive em INSTRUCOES.md.
- Trazer dado real de cliente para o repositório.
- Inventar credencial, chave ou aprovação.
- Marcar `[X]` numa tarefa cujo aceite exige aprovação humana que não aconteceu.
