# INSTRUÇÕES — o que depende de uma pessoa

| | |
|---|---|
| **Origem** | [TASKS.md](TASKS.md), derivado de [PRD.md](PRD.md) |
| **Total** | 44 itens (3 resolvidos), destravando 121 tarefas do backlog |
| **Quem usa** | Pessoas. O agente que executa [TASKS.md](TASKS.md) lê este arquivo, mas não consegue resolver nada aqui. |
| **Protocolo** | [EXECUTE.md](EXECUTE.md) |

Cada item aqui é uma coisa que **nenhum agente de código resolve sozinho**: uma decisão de negócio, um cadastro, uma credencial, um acesso, uma aprovação, uma assinatura.

---

## ⚠️ Segredo nunca entra neste arquivo

Este arquivo é versionado e vai para o repositório remoto. Ao concluir um item que produz chave, token, senha ou string de conexão:

- **Registre que foi feito e onde foi colocado.** Nunca o valor.
- Chave e credencial vão para `.env` local, fora do versionamento, ou para o cofre de segredos.
- Dado real de cliente não entra no repositório em nenhuma hipótese.

Se um segredo for colado aqui por engano, ele precisa ser **rotacionado**, não apenas apagado — o histórico do git guarda o que foi commitado.

---

## Legenda

Mesmos três status de [TASKS.md](TASKS.md):

- `[ ]` Não iniciada
- `[~]` Em andamento
- `[X]` Concluída

**Importante para quem executa o backlog:** marcar `[X]` aqui não basta. O protocolo exige confirmar que o artefato existe de fato antes de destravar a tarefa — o arquivo de decisão está no repositório, a variável responde, o acesso funciona.

---

## Panorama

| Quando | Itens | P0 | Tarefas destravadas |
|---|---:|---:|---:|
| Fase 1 · Contrato | 8 (2 resolvidos) | 3 | 34 |
| Fase 2 · Dado real | 22 | 18 | 57 |
| Fase 3 · Chat com IA | 7 | 4 | 21 |
| Fase 4 · Escala | 7 | 1 | 11 |
| **Total** | **44** | **26** | **121** |

**Por responsável**

| Responsável | Itens |
|---|---:|
| TI do cliente | 13 |
| Controladoria | 10 |
| Produto | 9 |
| Engenharia | 6 |
| Comercial | 4 |
| RH | 1 |
| Juridico do cliente | 1 |

**Os cinco que mais destravam** — se a fila estiver parada, comece por estes:

| Item | Destrava | Responsável |
|---|---:|---|
| **H-28** Criar a conta na Anthropic e emitir as chaves de API | 14 tarefas | Produto |

| **H-02** Habilitar o GitHub Actions e tornar os cinco checks obrigatórios em main | 9 tarefas | Engenharia |
| **H-12** Levantar com a TI do cliente o sistema de origem de cada uma das 7 views (P1) | 8 tarefas | TI do cliente |
| **H-08** Sessão de aprovação do catálogo de métricas e do mapeamento das views | 7 tarefas | Controladoria |

---

## Antes da Fase 1 · Contrato

Sem estes, a Fase 1 não fecha o critério de saída.

*8 itens · 3 P0 abertos · 2 resolvidos*

### [X] H-01 · Decidir P8: o alcance do filtro de ano

`P0` · **Responsável:** Produto

**O que fazer**

Marque 30 minutos com a pessoa responsável por Produto e leve a pergunta P8 da seção 18 do PRD. Peça que ela escolha exatamente uma entre três saídas: (a) o ano continua com dois valores fixos, 2026 e 2025; (b) o ano vira dimensão parametrizável e a lista de anos passa a sair de getMeta, de modo que acrescentar 2024 aos dados faça o filtro oferecer três anos sem mexer em código; (c) o filtro de ano sai da barra de filtros e da URL. Antes de decidir, mostre as consequências: a opção (b) obriga a carregar 24 meses de histórico na réplica e a manter a série de comparação do ano mais antigo, a opção (c) elimina esse custo mas remove o comparativo entre anos. Na mesma reunião decida quantos anos a base de teste (fixture) carrega, porque a série de comparação do primeiro ano depende disso: ou 2024 entra só como base de comparação, ou a série do ano anterior devolve vazio com motivo quando o recorte for 2025. Escreva a decisão num arquivo curto de uma página contendo: a saída escolhida, a data, o nome de quem aprovou por Produto e quantos anos a fixture carrega. Avise a Engenharia por escrito, porque a escolha muda o tipo Query, o número de recortes canônicos e a barra de filtros.

| | |
|---|---|
| **Resultado esperado** | Decisão P8 registrada com data e nome do aprovador de Produto, dizendo se o ano é dimensão parametrizável, valor fixo ou filtro removido, e quantos anos de fixture serão carregados |
| **Onde o resultado vai** | Arquivo versionado docs/decisoes/D-P8-filtro-ano.md, citado por referência no módulo de domínio da Query criado por T-101 |
| **Destrava** | T-002, T-004, T-101, T-103, T-131, T-140, T-152, T-153, T-185, T-237 *(10 tarefas)* |

> **Resolvido em 2026-08-22.** Saída escolhida: **(b) o ano é dimensão
> parametrizável**, com a lista vinda de `getMeta`. Fixture carrega 2 anos
> completos e selecionáveis (2025 e 2026); o ano mais antigo devolve comparação
> vazia com motivo, em vez de inventar série. Decisão registrada em
> `docs/decisoes/D-P8-filtro-ano.md`, com o critério de escolha e as três
> razões. Produto delegou a escolha por escrito à Engenharia — não houve sessão
> de revisão de Produto, e isso está dito no próprio documento.

### [X] H-02 · Habilitar o GitHub Actions e tornar os cinco checks obrigatórios em main

`P0` · **Responsável:** Engenharia

**O que fazer**

Alguém com permissão de administrador no repositório github.com/rafaelbernatat/amanna-bi precisa fazer três coisas, nesta ordem. Primeira: entrar em Settings > Actions > General e permitir a execução de workflows no repositório. Segunda: conferir em Settings > Billing que há minutos de execução disponíveis — em repositório privado os minutos gratuitos são limitados e podem exigir plano pago — e confirmar que o cache de dependências do Actions está disponível no plano da conta. Terceira: ir em Settings > Rules > Rulesets (ou Settings > Branches) e criar uma regra sobre a branch main que exija pull request para merge e marque como required status checks as cinco checagens do workflow de CI: typecheck, lint, teste, build e e2e. Os nomes marcados precisam ser idênticos aos nomes dos jobs em .github/workflows/ci.yml. Sem esse clique o workflow até roda, mas etapa reprovada não impede o merge, que é exatamente o critério de aceite de T-006 e a base de todos os portões de qualidade de F1. Valide abrindo um pull request de teste com uma etapa quebrada de propósito e confirmando que o botão de merge fica bloqueado.

| | |
|---|---|
| **Resultado esperado** | GitHub Actions habilitado com minutos disponíveis e ruleset ativo em main exigindo pull request e as cinco checagens como obrigatórias, comprovado por um pull request de teste que não pode ser mesclado |
| **Onde o resultado vai** | Configuração do repositório em github.com/rafaelbernatat/amanna-bi (Settings > Actions, Settings > Billing e Settings > Rules), casando com os nomes dos jobs em .github/workflows/ci.yml |
| **Destrava** | T-006, T-123, T-139, T-161, T-171, T-172, T-175, T-188, T-191 *(9 tarefas)* |

> **Resolvido em 2026-08-22.** O repositório foi publicado (36 commits) e o
> Actions já estava habilitado — a primeira execução em `main` saiu verde nos
> cinco jobs em **2 min 15 s**, dentro do teto de 15 minutos de T-006.
> Ruleset `21192375` ativo em `main`, exigindo pull request e as cinco
> checagens. Validado como o item pede: PR #1 com a etapa `teste` quebrada de
> propósito → `teste` vermelho, os outros quatro verdes,
> `mergeStateStatus: BLOCKED`, e a tentativa real de merge recusada com
> *"the base branch policy prohibits the merge"*. `main` ficou intacta e o PR
> foi fechado sem mesclar.
>
> ⚠️ **O portão depende da visibilidade.** Proteção de branch não existe em
> repositório privado no plano Free — as duas APIs devolvem
> *"Upgrade to GitHub Pro or make this repository public"*. O repositório está
> **público** por decisão de 2026-08-22, com a intenção declarada de torná-lo
> privado depois. **Se isso acontecer sem assinar o GitHub Pro, o ruleset deixa
> de valer e as cinco checagens voltam a apenas reportar, sem bloquear merge** —
> silenciosamente. Nesse dia, T-006 precisa voltar para `⏸` e este item
> reabrir.

> **Já pronto do lado da Engenharia (2026-08-21).** O arquivo
> `.github/workflows/ci.yml` existe no repositório e traz exatamente os cinco
> jobs a marcar como obrigatórios, com estes nomes: `typecheck`, `lint`,
> `teste`, `build`, `e2e`. As cinco etapas passam localmente. Falta só o que
> depende de permissão de administrador: habilitar o Actions, confirmar os
> minutos e criar o ruleset em `main`. A tarefa T-006 está parada em `⏸`
> esperando isto.

### [ ] H-03 · Aprovar a errata do Anexo C e fechar o dataset de referência

`P0` · **Responsável:** Produto

**O que fazer**

Reúna Produto e Controladoria para conferir linha a linha os números do Anexo C do PRD, que hoje não fecham entre si. Monte antes uma planilha que derive todos os valores do anexo de um único conjunto de fatos mensais, e verifique pelo menos estas quatro contas: o headcount de dezembro precisa fechar como saldo inicial mais admissões menos desligamentos (1.150 + 241 - 145); o turnover de 12 meses precisa fechar como soma dos desligamentos dos 12 meses dividida pela média do headcount FTE dos mesmos 12 meses; o ciclo financeiro precisa fechar como PMR mais PME menos PMP (52 + 75 - 51 = 76 dias); e o desvio orçamentário de R$ 56 mi precisa sair da diferença entre orçado e realizado dos 8 centros de custo. Onde o número derivado divergir do texto do anexo, escolha por escrito qual dos dois está certo. Publique a errata com a lista de correções, a data e os nomes de quem aprovou por Produto e por Controladoria. Isso precisa estar assinado antes de a Engenharia começar a modelar as fixtures, senão as bases de teste de RH e Financeiro nascem contra números que ninguém confirmou.

| | |
|---|---|
| **Resultado esperado** | Planilha de reconciliação versionada que deriva todos os valores do Anexo C de um único conjunto de fatos mensais, mais a errata aprovada por Produto e Controladoria com data e nomes |
| **Onde o resultado vai** | docs/dados/anexo-c-reconciliacao.xlsx e docs/decisoes/errata-anexo-c.md, ambos versionados no repositório |
| **Destrava** | T-110, T-111, T-114, T-119, T-146 *(5 tarefas)* |

### [ ] H-04 · Decidir as quatro regras de recorte que mudam o comportamento do protótipo

`P0` · **Responsável:** Produto

**O que fazer**

Produto e Controladoria precisam dar quatro veredictos que a Engenharia não pode dar sozinha, porque mudam o que a pessoa vê na tela em relação ao protótipo. Primeiro: o módulo Financeiro passa a ter o filtro de Área — o que exige a view de resultado ganhar coluna de área e o orçamento ganhar um de-para de centro de custo para área, com o oitavo centro tratado explicitamente — ou os 22 painéis financeiros e os 5 de Integração passam a exibir a mensagem 'filtro não se aplica a este painel'. Segundo: a mesma pergunta para o filtro de Modalidade, listando em quais métricas ele se aplica. Terceiro: mediana salarial e faixas salariais viram um valor pré-calculado por área e por mês na view (um quarto tipo de agregação, chamado precomputado) ou saem do catálogo e o KPI vira faixa modal. Quarto: para cada um dos 71 painéis, quais dos cinco filtros afetam a consulta — a Engenharia entrega a tabela já preenchida e vocês revisam e aprovam linha a linha. Registre as quatro decisões num único documento com data e os nomes dos aprovadores de Produto e de Controladoria, e marque cada diferença em relação ao protótipo como intencional, para entrar na checklist de paridade.

| | |
|---|---|
| **Resultado esperado** | Quatro decisões registradas com data e aprovadores, mais a tabela de aplicabilidade dos cinco filtros nos 71 painéis revisada e aprovada |
| **Onde o resultado vai** | docs/decisoes/D-F1-recortes.md e o campo de aplicabilidade de filtro no registro de painéis, em config/registro-paineis.yaml |
| **Destrava** | T-142, T-144, T-162, T-184 *(4 tarefas)* |

### [ ] H-05 · Assinar a auditoria de paridade das 13 telas e a matriz de recortes de teste

`P1` · **Responsável:** Produto

**O que fazer**

No fechamento da Fase 1, antes de declarar o critério de saída cumprido, alguém de Produto precisa sentar com a captura lado a lado das 13 telas — protótipo à esquerda, produto à direita, ambos no recorte padrão — e assinar a checklist. Regra da conferência: cada diferença encontrada é marcada como intencional, citando o achado do Anexo D ou a decisão de recorte que a justifica, ou volta como correção para a Engenharia. Nenhum dos 71 ids de painel pode ficar sem verificação registrada. Na mesma passagem, aprove e assine a matriz de recortes de teste: a reconciliação entre KPI e painel roda nos 768 recortes sem amostragem, e qualquer dimensão que for amostrada nas demais regras precisa de justificativa escrita, com responsável e data. Devolva os dois artefatos assinados à Engenharia.

| | |
|---|---|
| **Resultado esperado** | Checklist de paridade das 13 telas assinada com data, com cada diferença classificada como intencional ou como correção, e a matriz de recortes com justificativa e responsável de cada dimensão amostrada |
| **Onde o resultado vai** | docs/qualidade/paridade-13-telas.md e tests/contrato/matriz-recortes.yaml |
| **Destrava** | T-170, T-193 *(2 tarefas)* |

### [ ] H-42 · Autorizar a correção das dependências que faltam entre decisão e tarefa

`P1` · **Responsável:** Produto

**O que fazer**

A tarefa T-013 padronizou as referências do backlog e publicou a matriz em `docs/rastreabilidade/matriz-decisoes-principios.md`. Ao fazer isso ela mediu a terceira exigência do próprio critério de aceite — *nenhuma tarefa de F1/F2/F3 referencia decisão pendente sem depender da tarefa F0 correspondente* — e encontrou **13 tarefas que citam uma decisão sem declarar dependência dela**, mais 3 que dependem só por caminho transitivo. A lista completa, com o par tarefa → decisão, está na última tabela da matriz. O risco é concreto: uma tarefa de F2 que aplica D-P6 sem depender de T-011 pode ser escolhida pelo laço antes de a decisão de hospedagem existir, e então congela em código uma escolha que ninguém fez — exatamente o defeito que a auditoria apontou em P8 e que originou T-004. Corrigir exige editar o campo `Depende de:` dessas 13 tarefas, e a seção 11 do EXECUTE.md reserva a reescrita de dependências à T-004, restrita a T-101, T-103, T-131 e T-140; T-013 está autorizada apenas a padronizar os campos `PRD:`. Decida uma entre duas saídas e registre por escrito com data e nome: (a) autorizar a Engenharia a acrescentar as 13 dependências, nomeando-as uma a uma, o que faz o laço parar de oferecer essas tarefas antes da decisão correspondente; ou (b) declarar que a citação da decisão nessas tarefas é informativa e não é dependência real, caso em que o critério de aceite de T-013 precisa ser reescrito para dizer isso, porque hoje ele afirma o contrário. Não escolha (b) sem olhar a tabela linha a linha: as 13 não são um bloco homogêneo.

| | |
|---|---|
| **Resultado esperado** | Decisão registrada com data e nome do aprovador de Produto, escolhendo entre autorizar as 13 dependências (nomeadas uma a uma) ou reescrever o terceiro critério de T-013; nenhuma das duas saídas deixa a contradição de pé |
| **Onde o resultado vai** | docs/decisoes/D-F0-dependencias-de-decisao.md, e o resultado é aplicado no campo `Depende de:` das tarefas nomeadas em TASKS.md |
| **Destrava** | T-013 *(1 tarefa)* |

### [ ] H-43 · Decidir os três tokens de texto do protótipo que não alcançam 4.5:1

`P1` · **Responsável:** Produto

**O que fazer**

A tarefa T-124 extraiu a paleta do protótipo para um tema tipado e, ao fazer isso, mediu a razão de contraste de cada par texto/fundo que a interface usa. Três não alcançam o mínimo de 4.5:1 que a seção 13 do PRD exige para texto: `textoTerciario` `#8a7f74` sobre superfície branca dá **3,91:1**; `textoFraco` `#a89c8e` dá **2,69:1** sobre superfície e **2,32:1** sobre o fundo da página; e `textoEmBarraFraco` `#8a7a66` sobre a barra lateral dá **4,36:1**. Não são cores decorativas: `textoFraco` é a cor dos rótulos de filtro, do *breadcrumb* e das legendas de eixo, e aparece 11 vezes no protótipo. O conflito é real e não se resolve sozinho — o PRD manda o protótipo vencer em comportamento de tela, e manda 4.5:1 em contraste. Traga a decisão para Produto com as três amostras impressas lado a lado e escolha uma saída por token: escurecer o token até alcançar 4.5:1, aceitando que a tela fica visivelmente diferente do protótipo; manter a cor e aumentar o tamanho da fonte acima do limite de texto grande, onde o mínimo cai para 3:1 (só resolve `textoTerciario` e `textoEmBarraFraco`, não `textoFraco`); ou registrar exceção assinada por token, com a justificativa. Registre a escolha com data e nome, e marque cada diferença resultante em relação ao protótipo como intencional, para entrar na checklist de paridade de H-05. Sem isso, a tarefa T-183 — que computa contraste e reprova o CI abaixo de 4.5:1 — nasce vermelha e não há critério para dizer se isso é defeito ou decisão.

| | |
|---|---|
| **Resultado esperado** | Decisão por token registrada com data e nome do aprovador de Produto — escurecer, tratar como texto grande ou registrar exceção assinada — com cada diferença em relação ao protótipo marcada como intencional |
| **Onde o resultado vai** | docs/decisoes/D-F1-contraste.md, os valores em `src/apresentacao/tema/tema.ts` e a lista de exceções lida por T-183 |
| **Destrava** | T-183 *(1 tarefa)* |

### [X] H-44 · Decidir se os gráficos usam biblioteca ou SVG próprio (revisão de D4)

`P0` · **Responsável:** Produto

**O que fazer**

*Resolvido em 2026-08-22 por Rafael Lang, por Produto.* A pergunta era se os gráficos continuam desenhados em SVG no servidor, como a seção 8.2 do PRD fixava, ou passam a usar biblioteca. Foram apresentadas por escrito as quatro consequências antes da escolha: o painel deixa de ser Server Component; passa a existir JavaScript de gráfico no cliente; o `ResponsiveContainer` usa `ResizeObserver`, o que ameaça o CLS zero medido em T-129; e a biblioteca cobre 7 das 12 formas do Anexo A.1, deixando `cascata`, `mosaico geográfico`, `régua de ciclo`, `divisão` e `estatísticas` ainda desenhadas à mão. **Decisão: adotar recharts**, aceitando as quatro consequências. A decisão reabre D4, que a seção 0 do PRD trata como travada, e por isso está registrada em documento próprio.

| | |
|---|---|
| **Resultado esperado** | Decisão registrada com data e nome do aprovador de Produto, reabrindo D4 e adotando recharts, com as consequências aceitas por escrito |
| **Onde o resultado vai** | docs/decisoes/D-D4-biblioteca-de-graficos.md; PRD seção 8.2 e linha D4 editadas; aceites de T-129, T-176 e T-409 reescritos para seguir o PRD novo |
| **Destrava** | T-129, T-130 *(2 tarefas)* |

---

## Antes da Fase 2 · Dado real

Quase tudo aqui depende do cliente. É a fila mais longa e a que costuma atrasar o projeto inteiro — comece cedo.

*22 itens · 18 P0*

### [ ] H-06 · Decidir P2: transferência interna conta como desligamento

`P0` · **Responsável:** RH

**O que fazer**

Reúna RH e Controladoria na mesma sessão e decida se a transferência de um colaborador entre áreas ou entre entidades entra na contagem de desligamentos do turnover. Leve como insumo as duas leituras de turnover calculadas lado a lado sobre 12 meses, com a diferença expressa em pontos percentuais — é exatamente o material que a Engenharia produz em T-218. Feche as duas pontas da regra: se a transferência não contar como desligamento na área de origem, também não conta como admissão na área de destino. Registre a decisão por escrito com a data e as duas áreas nomeadas como aprovadoras, e deixe explícito que reabrir essa definição depois exige nova versão do catálogo de métricas, para a discussão não voltar do zero em seis meses.

| | |
|---|---|
| **Resultado esperado** | Decisão aprovada por RH e Controladoria, com data e áreas aprovadoras, dizendo se transferência interna entra ou não na contagem de desligamentos |
| **Onde o resultado vai** | Campo decisao da métrica turnover_12m em config/catalogo-metricas.yaml, com o filtro correspondente em config/mapeamento.yaml |
| **Destrava** | T-007, T-113, T-155, T-189, T-218, T-239 *(6 tarefas)* |

### [ ] H-07 · Decidir P3: rescisão entra na folha por competência ou por pagamento

`P0` · **Responsável:** Controladoria

**O que fazer**

Leve à Controladoria a pergunta: o valor da rescisão entra na folha do mês de competência, que é o mês do desligamento, ou do mês de pagamento. Leve como insumo a folha total recalculada nas duas bases para 12 meses, com a diferença em reais mês a mês — é o material que a Engenharia produz em T-219. O teste prático a propor na reunião é qual das duas bases faz o mês de fechamento bater com a folha oficial. Explique que a escolha muda a base que o mapeamento vai aplicar e afeta todo KPI derivado de folha, incluindo folha sobre receita e custo por colaborador. Registre a decisão com a data e o nome de quem aprovou pela Controladoria.

| | |
|---|---|
| **Resultado esperado** | Decisão da Controladoria registrada com data, indicando competência ou pagamento como base da folha |
| **Onde o resultado vai** | Campo decisao da métrica folha_total em config/catalogo-metricas.yaml, com a regra correspondente em config/mapeamento.yaml |
| **Destrava** | T-008, T-113, T-155, T-189, T-219, T-239 *(6 tarefas)* |

### [ ] H-08 · Sessão de aprovação do catálogo de métricas e do mapeamento das views

`P0` · **Responsável:** Controladoria

**O que fazer**

Marque uma sessão de trabalho com Controladoria e RH juntos, com duração de meio dia, para percorrer uma a uma as 36 métricas do catálogo — as 21 do Anexo B do PRD mais as 15 do achado 5 do Anexo D. Para cada métrica confira oito campos: rótulo, fonte, fórmula, unidade, agregação, sentido de bom ou ruim, meta e grão mínimo. Na mesma sessão revise o arquivo de mapeamento, que diz de qual view, de qual coluna e com qual agregação cada métrica sai. Toda métrica cuja definição gerar discussão precisa sair da reunião com uma linha 'decisao' escrita, contendo a data e as áreas que aprovaram; as decisões P2 e P3 (itens H-06 e H-07) devem chegar já fechadas a esta sessão. Ao final, nomeie a versão semântica do catálogo aprovada, por exemplo 1.0.0, registre a ata com data e os nomes de todos os aprovadores, e comunique a versão à Engenharia — é ela que o mapeamento das views vai citar na Fase 2. Esta sessão é o portão de entrada da Fase 2: sem ela, o mapeamento não pode ser escrito.

| | |
|---|---|
| **Resultado esperado** | Catálogo com as 36 métricas aprovadas, cada métrica discutida com o campo decisao preenchido com data e áreas aprovadoras, o mapeamento revisado e uma versão semântica nomeada, com ata datada |
| **Onde o resultado vai** | config/catalogo-metricas.yaml (campo decisao e campo versao), config/catalogo-metricas.CHANGELOG.md, config/mapeamento.yaml e a ata em docs/decisoes/aprovacao-catalogo.md |
| **Destrava** | T-113, T-155, T-189, T-201, T-210, T-211, T-217 *(7 tarefas)* |

### [ ] H-09 · Decidir P6 em contrato: Docker no cliente ou nuvem dedicada

`P0` · **Responsável:** Comercial

**O que fazer**

O Comercial precisa fechar com o cliente, como cláusula do contrato assinado e não apenas em ata, qual dos dois modos de hospedagem da seção 15 do PRD vale para este contrato: Docker rodando dentro da rede do cliente, cujo argumento comercial é que o dado nunca sai da rede dele, ou nuvem dedicada operada por nós, que exige túnel ou VPN até a base de origem. A escolha define quatro coisas: de onde vêm os segredos (variáveis de ambiente entregues pelo cliente ou cofre da nossa infraestrutura), quem provisiona a infraestrutura, quem opera a sincronização e quem responde pelo backup. Aproveite a mesma cláusula para escrever o compromisso da seção 11 do PRD: só o catálogo de métricas, o texto da pergunta e números já agregados saem do ambiente para a API do modelo, nunca dado bruto, linha de pessoa ou credencial. Registre com data no contrato e comunique formalmente a escolha à Engenharia, porque nenhuma diferença de cliente pode existir no código — a diferença vira configuração.

| | |
|---|---|
| **Resultado esperado** | Cláusula assinada no contrato definindo o modo de hospedagem e o compromisso de trânsito de dados, com data, comunicada por escrito à Engenharia |
| **Onde o resultado vai** | Contrato comercial assinado, espelhado em docs/decisoes/D-P6-hospedagem.md; a escolha vira as variáveis MODO_HOSPEDAGEM=docker_cliente|nuvem_dedicada e SECRETS_PROVIDER=env|cofre no ambiente |
| **Destrava** | T-011, T-205, T-206, T-231, T-249 *(5 tarefas)* |

### [ ] H-10 · Assinar o anexo técnico das views e da fronteira de dados no contrato

`P0` · **Responsável:** Comercial

**O que fazer**

O risco alto registrado no PRD é o cliente não conseguir produzir as views, e a mitigação é contratual, não técnica. Monte o anexo técnico com quatro blocos e leve ao Comercial para assinatura das duas partes. Bloco 1: a lista das 7 views da seção 10.1 (vw_fato_rh_mes, vw_fato_fin_mes, vw_fato_orcamento, vw_fato_vagas, vw_fato_treinamento, vw_fato_contas e as vw_dim_*), com o dicionário de colunas de cada uma. Bloco 2: o prazo em que a TI do cliente se compromete a entregá-las. Bloco 3: as horas de apoio da nossa equipe previstas na Fase 2 e o gatilho que aciona esse apoio. Bloco 4: a declaração da fronteira de dados — o que sai do ambiente do cliente (catálogo de métricas, texto da pergunta e números já agregados) e o que nunca sai (dado bruto, linha de pessoa, credencial). Colha assinatura das duas partes e guarde uma cópia versionada no repositório.

| | |
|---|---|
| **Resultado esperado** | Anexo técnico assinado pelas duas partes, com as 7 views, o dicionário de colunas, o prazo de entrega, as horas de apoio e a fronteira de dados declarada |
| **Onde o resultado vai** | Anexo do contrato assinado, com cópia versionada em docs/contrato/anexo-tecnico-views.md |
| **Destrava** | T-201, T-250, T-252 *(3 tarefas)* |

### [ ] H-11 · Obter o parecer jurídico de LGPD e decidir P7, os prazos de retenção

`P0` · **Responsável:** Juridico do cliente

**O que fazer**

Envie ao Jurídico do cliente o registro de tratamento preenchido, contendo categorias de dado, finalidade, base legal e retenção, mais a lista de subprocessadores, incluindo explicitamente a API da Anthropic usada pelo chat. Peça um prazo de retenção em dias, separadamente, para cada um dos três artefatos, porque são três coisas distintas: (1) a trilha de auditoria do chat, que guarda quem perguntou, quando, a intenção interpretada, as métricas lidas, o recorte aplicado e o custo em tokens; (2) os eventos de telemetria da seção 14 (chat.pergunta, chat.sem_resposta e chat.intencao); (3) o texto livre das perguntas feitas ao chat, que a seção 14 do PRD trata como dado do cliente. Explique que nenhum evento carrega dado de pessoa e que o produto é somente leitura. Peça também a base legal na LGPD de cada prazo e o nome de quem responde por pedido de exclusão. Cada prazo precisa voltar como número em dias, não como princípio, porque vira parâmetro de configuração e alimenta o job de expurgo. Registre o parecer e a decisão com data e áreas aprovadoras; os números viram variáveis de ambiente do ambiente de execução, nunca valores fixados em arquivo versionado.

| | |
|---|---|
| **Resultado esperado** | Parecer e registro LGPD aprovados, com três prazos em dias — um por artefato — registrados com data e aprovadores, prontos para virar parâmetro de configuração |
| **Onde o resultado vai** | Registro em docs/lgpd/registro-tratamento.md e docs/decisoes/D-P7-retencao.md (versionados, só com os números de prazo e o parecer); os valores operacionais entram como RETENCAO_AUDITORIA_DIAS, RETENCAO_TELEMETRIA_DIAS e RETENCAO_PERGUNTAS_DIAS no ambiente de cada instalação |
| **Destrava** | T-012, T-250, T-323, T-324, T-335 *(5 tarefas)* |

### [ ] H-12 · Levantar com a TI do cliente o sistema de origem de cada uma das 7 views (P1)

`P0` · **Responsável:** TI do cliente

**O que fazer**

Marque uma reunião com o responsável de TI do cliente e percorra, linha a linha, as 7 linhas da tabela 10.1 do PRD: vw_fato_rh_mes, vw_fato_fin_mes, vw_fato_orcamento, vw_fato_vagas, vw_fato_treinamento, vw_fato_contas e as vw_dim_*. Para cada linha anote quatro campos e não saia da reunião sem eles: (1) sistema de origem, entre folha/HCM, ERP contábil, sistema de planejamento, ATS de recrutamento, LMS de treinamento e cadastros; (2) nome e e-mail do responsável técnico por aquele sistema dentro da TI do cliente; (3) forma de acesso pretendida, entre view criada no próprio ERP, réplica do banco ou extração agendada; (4) profundidade histórica disponível em meses — o produto precisa de 24 meses, cobrindo 2025 e 2026. Nenhuma linha pode ficar marcada como 'a definir'. Feche com aceite formal da TI do cliente, por e-mail ou ata assinada, de que reconhece este levantamento como o contrato de entrada do produto. Este é o primeiro item da Fase 2: nada de ingestão começa sem ele.

| | |
|---|---|
| **Resultado esperado** | Tabela das 7 views preenchida com sistema de origem, responsável nomeado, forma de acesso e profundidade histórica, sem nenhuma linha 'a definir', mais o aceite formal escrito da TI do cliente com data |
| **Onde o resultado vai** | Arquivo versionado docs/ingestao/origens.md, referenciado pela especificação de views de T-201 e pelo mapeamento em config/mapeamento.yaml |
| **Destrava** | T-003, T-009, T-201, T-205, T-207, T-211, T-237, T-252 *(8 tarefas)* |

### [ ] H-13 · Acordar P4: a janela e a cadência de sincronização

`P0` · **Responsável:** TI do cliente

**O que fazer**

Depois de conhecer os sistemas de origem (item H-12), acorde com a TI do cliente quatro números e escreva todos: (1) com que frequência a sincronização roda — o padrão do PRD é diária, de madrugada; (2) em que horário exato ela pode iniciar; (3) qual a duração máxima aceitável da janela sem impacto nos sistemas de origem; (4) o que acontece se a carga estourar a janela. Confirme na mesma conversa que a origem está disponível nesse horário e que não há conflito com backup, fechamento do ERP ou outras cargas, e que a leitura será somente leitura e restrita às views da tabela 10.1. Registre em documento versionado com a data e o nome de quem acordou dos dois lados, porque a configuração do job de sincronização vai citar esse documento.

| | |
|---|---|
| **Resultado esperado** | Cadência, horário de início, duração máxima da janela e regra de estouro acordados por escrito com a TI do cliente, com data e nomes dos dois lados |
| **Onde o resultado vai** | Arquivo versionado docs/decisoes/D-P4-janela-sync.md; os valores operacionais viram SYNC_CRON e SYNC_TIMEOUT_MINUTOS na configuração do agendador |
| **Destrava** | T-009, T-208, T-232 *(3 tarefas)* |

### [ ] H-14 · Criar o usuário somente leitura na base de origem e entregar a conexão

`P0` · **Responsável:** TI do cliente

**O que fazer**

Peça ao DBA do cliente a criação de um usuário de banco dedicado exclusivamente a este produto, com GRANT SELECT apenas nas 7 views da seção 10.1 do PRD e em mais nada — sem INSERT, sem UPDATE, sem DELETE e sem acesso a qualquer outra tabela, porque a tarefa T-205 testa as quatro tentativas e todas precisam falhar por falta de permissão. Peça seis dados: host, porta, nome da base, nome do usuário, senha e o certificado da autoridade certificadora (CA) do banco, necessário para conexão com sslmode=verify-full. Receba tudo por canal seguro — cofre de senhas ou gerenciador de credenciais compartilhado — e nunca por e-mail, chat ou planilha. Combine desde já como a senha será rotacionada, porque a rotação precisa funcionar sem gerar imagem nova da aplicação. IMPORTANTE: nenhum desses valores pode ser colado em arquivo do repositório. Eles vão para o arquivo .env do ambiente de execução (que fica fora do controle de versão e listado no .gitignore) ou para o cofre de segredos, conforme a decisão P6; o repositório carrega apenas um .env.example com valores fictícios. No INSTRUCOES.md registre somente que a credencial foi criada e entregue, com data e responsável, nunca o valor.

| | |
|---|---|
| **Resultado esperado** | Credencial dedicada de leitura com escopo restrito às 7 views, entregue por canal seguro junto do certificado da CA, com a regra de rotação acordada |
| **Onde o resultado vai** | SOURCE_DB_HOST, SOURCE_DB_PORT, SOURCE_DB_NAME, SOURCE_DB_USER, SOURCE_DB_PASSWORD e SOURCE_DB_SSLROOTCERT no .env do ambiente de execução ou no cofre, conforme a decisão P6; no repositório apenas .env.example com valores fictícios |
| **Destrava** | T-205, T-206, T-207, T-208, T-220, T-247 *(6 tarefas)* |

### [ ] H-15 · Liberar a rota de rede entre o job de sincronização e a base de origem

`P0` · **Responsável:** TI do cliente

**O que fazer**

Abra um chamado na TI do cliente informando o IP de origem da aplicação, a porta e o protocolo, e peça a rota de rede conforme o modo escolhido na decisão P6. No modo Docker dentro da rede do cliente, peça liberação de firewall da rede interna até a porta do banco de origem. No modo nuvem dedicada, peça túnel ou VPN site-to-site mais allowlist do nosso IP de saída fixo. Peça a mesma liberação para o ambiente de homologação, não só para produção. Só feche o chamado depois de um teste de conexão bem-sucedido executado a partir do ambiente real da aplicação, e não da estação de trabalho de quem pediu — testar da própria máquina é o erro mais comum e esconde o bloqueio.

| | |
|---|---|
| **Resultado esperado** | Rota de rede aberta e testada da aplicação até a base de origem, comprovada por conexão bem-sucedida a partir dos ambientes de homologação e de produção |
| **Onde o resultado vai** | Registrado em docs/infra/conectividade.md; o endereço acordado vira o valor de SOURCE_DB_HOST no ambiente e os parâmetros do túnel entram no docker-compose de produção |
| **Destrava** | T-205, T-208, T-247, T-249 *(4 tarefas)* |

### [ ] H-16 · Provisionar a nuvem dedicada, o domínio, o certificado e o cofre de segredos

`P0` · **Responsável:** Engenharia

**O que fazer**

Se a decisão P6 escolheu nuvem dedicada, alguém com poder de contratar e pagar o provedor precisa executar seis passos: abrir o projeto ou conta isolada deste cliente no provedor de nuvem; provisionar o PostgreSQL 16 gerenciado que vai servir de réplica; registrar o domínio e emitir o certificado TLS; criar o cofre de segredos; criar o destino de backup com a retenção acordada; e obter o certificado da autoridade certificadora do banco, necessário para conectar com sslmode=verify-full. Anote também o IP de saída fixo do ambiente, porque ele precisa ser entregue à TI do cliente para entrar na allowlist (item H-15). Nenhuma credencial gerada aqui pode ser colada em arquivo do repositório: as strings de conexão e chaves ficam no cofre ou nas variáveis de ambiente do provedor, e o INSTRUCOES.md registra apenas que o provisionamento foi feito, com data e responsável.

| | |
|---|---|
| **Resultado esperado** | Projeto isolado do cliente, banco PostgreSQL 16 gerenciado, domínio com certificado TLS, cofre de segredos e destino de backup ativos, com o IP de saída fixo anotado |
| **Onde o resultado vai** | WAREHOUSE_DB_URL (com sslmode=verify-full), WAREHOUSE_DB_SSLROOTCERT, SECRETS_PROVIDER=cofre e BACKUP_DESTINO no ambiente da nuvem ou no cofre; nenhum desses valores no repositório |
| **Destrava** | T-206, T-220, T-247, T-249, T-254 *(5 tarefas)* |

### [ ] H-17 · Provisionar o registry de imagens e a credencial de publicação

`P0` · **Responsável:** Engenharia

**O que fazer**

Crie ou obtenha a conta e o repositório de imagens de contêiner onde a aplicação será publicada — GitHub Container Registry, Amazon ECR, Docker Hub ou o registry do próprio cliente. Exija duas capacidades do plano contratado: aceitar imagens multiarquitetura (amd64 e arm64) e permitir política de retenção de tags. Gere um token com escopo restrito a push apenas nesse repositório, sem permissão de administração da conta. Cadastre esse token como segredo do pipeline de CI, em Settings > Secrets and variables > Actions do repositório — nunca em arquivo versionado, porque o scanner de segredo do CI reprova o build e a seção 11 do PRD proíbe credencial no código ou na imagem. Defina por fim quem recebe permissão de leitura (pull) na instalação do cliente. No INSTRUCOES.md registre apenas que o registry foi criado e o token cadastrado, com data e responsável.

| | |
|---|---|
| **Resultado esperado** | Repositório de imagens criado com suporte a multiarquitetura e retenção de tags, token de publicação cadastrado como segredo do CI e permissão de leitura definida para o cliente |
| **Onde o resultado vai** | Segredos REGISTRY_URL, REGISTRY_USERNAME e REGISTRY_TOKEN no cofre de segredos da CI (GitHub Actions); a referência da imagem entra no docker-compose de produção |
| **Destrava** | T-228, T-229, T-231, T-249, T-255 *(5 tarefas)* |

### [ ] H-18 · Obter do cliente as 7 views publicadas e populadas na origem

`P0` · **Responsável:** TI do cliente

**O que fazer**

Entregue à TI do cliente três artefatos juntos: a especificação das views produzida em T-201 (DDL de referência, dicionário coluna a coluna, grão e chave primária de cada uma), o kit de SQL parametrizável de T-252 e o anexo técnico já assinado (item H-10). Combine um prazo e um responsável nomeado, e acompanhe semanalmente até que as 7 views existam na origem com 24 meses de histórico, cobrindo 2025 e 2026. Exija que faixas com menos de 5 pessoas já cheguem suprimidas ou marcadas na própria origem, conforme T-236 — a supressão não pode depender só da aplicação. Se a TI do cliente não conseguir produzir as views no prazo, acione o caminho alternativo previsto em T-252, que extrai direto das tabelas do ERP. O aceite objetivo é um só: o validador de conformidade de T-207 executa sobre a origem e sai com código de retorno zero.

| | |
|---|---|
| **Resultado esperado** | As 6 views de fato e as vw_dim_* criadas e populadas na origem com 24 meses de histórico e supressão de grupos pequenos aplicada, aprovadas pelo validador de conformidade com código zero |
| **Onde o resultado vai** | Objetos no banco de origem do cliente; os nomes exatos ficam fixados em docs/ingestao/views-contrato.md e são lidos por config/mapeamento.yaml |
| **Destrava** | T-207, T-208, T-209, T-236, T-237, T-247, T-252 *(7 tarefas)* |

### [ ] H-19 · Obter uma cópia da base de origem para o ambiente de homologação

`P1` · **Responsável:** TI do cliente

**O que fazer**

Peça à TI do cliente um dump ou uma réplica restaurada da base de origem, com os mesmos objetos da produção e ao menos 24 meses de dado, autorizada por escrito para uso em homologação. Combine três coisas na mesma conversa: com que periodicidade essa cópia é atualizada, quem executa a atualização e o tratamento de dado pessoal contido nela — leve essa última pergunta ao Jurídico do cliente e registre se a cópia vai anonimizada ou não. Sem essa cópia, o ensaio de construção das views de T-252 e o runbook de conexão de T-248, que precisa ser executado por alguém que não escreveu o código, não podem acontecer. As credenciais de acesso a essa cópia entram no arquivo .env do ambiente de homologação, fora do repositório.

| | |
|---|---|
| **Resultado esperado** | Cópia da base de origem disponível e autorizada por escrito no ambiente de homologação, com periodicidade de atualização acordada e o tratamento de dado pessoal definido pelo Jurídico |
| **Onde o resultado vai** | Variáveis SOURCE_DB_* do arquivo .env.homolog, fora do repositório, no ambiente provisionado por T-247 |
| **Destrava** | T-247, T-248, T-252 *(3 tarefas)* |

### [ ] H-20 · Cadastrar a aplicação OIDC no provedor de identidade do cliente

`P0` · **Responsável:** TI do cliente

**O que fazer**

Peça à TI do cliente a criação de uma aplicação web confidencial no provedor de identidade em uso — Entra ID, Okta, Keycloak ou Google Workspace — configurada com o fluxo Authorization Code mais PKCE. Informe a eles: as redirect URIs de produção e de homologação, no formato https://<dominio>/api/auth/callback; a post_logout_redirect_uri; e os escopos openid, profile e email, mais o claim de grupos incluído no token. Receba de volta três valores: a URL de discovery (o endereço .well-known/openid-configuration), o client_id e o client_secret. Exija que o client_secret venha por canal seguro (cofre ou gerenciador de senhas), nunca por e-mail ou chat. Antes de fechar, peça um token de exemplo e confirme com os próprios olhos que o claim de grupos realmente chega dentro dele — é o erro mais comum e só aparece quando a autorização já está sendo construída. O client_secret vai para o .env do ambiente ou para o cofre; o repositório carrega apenas .env.example com valores fictícios, e o INSTRUCOES.md registra somente que o cadastro foi feito, com data e responsável.

| | |
|---|---|
| **Resultado esperado** | Aplicação OIDC criada com as redirect URIs registradas e o fluxo Authorization Code com PKCE, mais discovery URL, client_id e client_secret entregues por canal seguro, com o claim de grupos comprovado em token de exemplo |
| **Onde o resultado vai** | AUTH_PROVIDER=oidc, OIDC_ISSUER_URL, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET e OIDC_REDIRECT_URI no .env do ambiente ou no cofre; apenas valores fictícios no .env.example versionado |
| **Destrava** | T-221, T-222, T-223, T-242, T-245, T-248 *(6 tarefas)* |

### [ ] H-21 · Definir quem recebe cada perfil e mapear os grupos do provedor de identidade

`P0` · **Responsável:** Controladoria

**O que fazer**

Leve a Controladoria, RH e Diretoria a lista nominal de usuários e defina, pessoa a pessoa, qual dos cinco perfis previstos cada uma recebe: diretoria (enxerga tudo), controller (Financeiro e Integração), rh (RH e Integração), area (travado na própria área) e auditor (leitura mais trilha de auditoria). Para cada pessoa de perfil 'area', defina a qual das 7 áreas ela fica presa. Depois peça à TI do cliente o nome exato dos grupos do provedor de identidade que correspondem a cada perfil, e a criação dos grupos que ainda não existirem. Isso exige aprovação escrita com data e nomes, porque define quem enxerga folha, salário e resultado. O resultado é um arquivo de configuração que traduz grupo do IdP para perfil mais escopo de acesso, montado no diretório de configuração do cliente, fora da imagem da aplicação.

| | |
|---|---|
| **Resultado esperado** | Lista aprovada por escrito de usuários por perfil e escopo, com o nome exato de cada grupo do provedor de identidade correspondente e os grupos faltantes já criados |
| **Onde o resultado vai** | config/perfis.yaml (grupo do IdP para perfil mais AccessScope), montado no diretório de configuração do cliente, fora da imagem |
| **Destrava** | T-223, T-242, T-243, T-244, T-245, T-256 *(6 tarefas)* |

### [ ] H-22 · Fixar com a Controladoria o calendário de competência e o fechamento

`P0` · **Responsável:** Controladoria

**O que fazer**

Marque uma conversa com a Controladoria e traga quatro respostas escritas. Primeira: em que dia útil do mês seguinte o mês passa a ser considerado fechado. Segunda: como o mês corrente parcial deve aparecer no painel — marcado como aberto, oculto, ou exibido com aviso. Terceira: se meses já fechados podem ser reabertos, e por quanto tempo. Quarta: qual a regra de competência quando o lançamento chega atrasado, depois do fechamento. Sem essas quatro respostas o produto pode somar um mês parcial como se fosse fechado e a reconciliação contábil nunca fecha em zero, que é o critério de saída da Fase 2. Registre em documento versionado, aprovado pela Controladoria com data e nome.

| | |
|---|---|
| **Resultado esperado** | Documento aprovado pela Controladoria com o dia do fechamento, a regra de exibição do mês parcial, a política de reabertura e a regra de lançamento atrasado |
| **Onde o resultado vai** | docs/ingestao/calendario-competencia.md, lido pelo job de sincronização para marcar meses abertos na tabela de controle de sync |
| **Destrava** | T-226, T-227 *(2 tarefas)* |

### [ ] H-23 · Decidir P5: o limite de defasagem que dispara o aviso no selo de frescor

`P0` · **Responsável:** Controladoria

**O que fazer**

Peça à Controladoria um único número em horas: a partir de quantas horas sem uma sincronização bem-sucedida o número na tela deixa de ser confiável para decisão, fazendo o selo de frescor sair de informativo e virar aviso em destaque, e colocando os painéis no estado 'dado defasado' da seção 6.4 do PRD. Dê a referência prática para a discussão: com sincronização diária de madrugada, o intervalo usualmente discutido fica entre 26 e 48 horas — use a cadência já acordada no item H-13 como base. O número precisa ser único, porque o mesmo valor alimenta três coisas: o selo de frescor, o estado de tela e o alerta de falha de sincronização. Registre com data e o nome de quem aprovou pela Controladoria; o número vira um valor de configuração por instalação.

| | |
|---|---|
| **Resultado esperado** | Limite único em horas decidido e registrado com data e responsável pela Controladoria |
| **Onde o resultado vai** | docs/decisoes/D-P5-limite-defasagem.md (versionado) e a variável LIMITE_DEFASAGEM_HORAS na configuração do ambiente, lida pelo campo frescor.limiteDefasagemHoras de getMeta |
| **Destrava** | T-010, T-149, T-166, T-233, T-235 *(5 tarefas)* |

### [ ] H-24 · Definir o canal de alerta de falha de sincronização e criar o webhook

`P1` · **Responsável:** Engenharia

**O que fazer**

Combine com o cliente e com quem vai operar o produto para onde vai o alerta quando a sincronização falhar ou quando a defasagem passar do limite decidido em P5 (item H-23). Escolha um canal entre: lista de e-mail de plantão, canal do Slack, canal do Microsoft Teams ou ferramenta de plantão. Crie a integração no serviço escolhido — no Slack ou Teams isso exige alguém com permissão de administrador do workspace criando um webhook de entrada no canal — e gere a URL do webhook ou as credenciais de SMTP. Registre também, por escrito, quem responde ao alerta e em quanto tempo, porque sem esse aviso a réplica antiga continua servindo as telas normalmente e ninguém percebe a falha. A URL do webhook e a senha de SMTP entram como variáveis de ambiente no .env ou no cofre, nunca em arquivo versionado; o INSTRUCOES.md registra apenas que o canal foi criado, com data e responsável.

| | |
|---|---|
| **Resultado esperado** | Canal de alerta escolhido, integração criada, webhook ou credencial de SMTP emitidos, e responsável de plantão nomeado com tempo de resposta acordado |
| **Onde o resultado vai** | ALERTA_WEBHOOK_URL e ALERTA_DESTINATARIOS no .env do ambiente ou no cofre; o canal escolhido e o nome do responsável de plantão ficam em docs/operacao/alertas.md |
| **Destrava** | T-233, T-234 *(2 tarefas)* |

### [ ] H-25 · Acordar a janela de atualização e quem autoriza a promoção para produção

`P1` · **Responsável:** TI do cliente

**O que fazer**

Combine com a TI do cliente e registre por escrito quatro pontos: em que janela de horário a aplicação pode ser atualizada; qual tempo de indisponibilidade é tolerado durante a atualização; quem, nominalmente, autoriza cada promoção para produção; e quem executa o retorno para a versão anterior se algo falhar. Registre por escrito porque o ensaio de atualização e retorno de versão de T-253 e a implantação contínua do modo nuvem de T-249 precisam rodar dentro dessa janela acordada — rodar fora dela, especialmente em instalação Docker dentro da rede do cliente, é tratado como incidente.

| | |
|---|---|
| **Resultado esperado** | Janela de atualização, tolerância de indisponibilidade, autorizador nomeado e executor do retorno de versão registrados por escrito e aceitos pela TI do cliente |
| **Onde o resultado vai** | docs/operacao/janela-atualizacao.md, citado pelo roteiro de atualização e pelo docker-compose de produção |
| **Destrava** | T-249, T-253 *(2 tarefas)* |

### [ ] H-26 · Obter os relatórios oficiais de fechamento e o aceite de zero divergência

`P0` · **Responsável:** Controladoria

**O que fazer**

Este item tem duas etapas, com a mesma contraparte. Etapa 1, coleta: peça à Controladoria a DRE oficial fechada de três meses consecutivos, com receita bruta, deduções, receita líquida, CMV, despesas, EBITDA, resultado financeiro e lucro líquido; peça à RH o relatório de folha e do HCM dos mesmos três meses, com headcount FTE de fechamento, admissões e desligamentos; peça ao Planejamento o orçado e o realizado por centro de custo nos 8 centros; e peça ao responsável pelo ERP o razão com aging de contas a receber e a pagar, mais PMR, PME e PMP na data de corte. Combine o formato de entrega e quem responde por cada diferença encontrada. Etapa 2, aceite: quando o relatório de reconciliação de T-227 fechar com diferença zero contra o fechamento contábil oficial, leve-o à Controladoria e peça aceite por escrito de que o painel confere com o relatório oficial — é esse aceite que cumpre o objetivo O3 e encerra a Fase 2. Antes de pedir o aceite, cada divergência encontrada precisa ter sido fechada com uma linha 'decisao' no catálogo, com data e áreas aprovadoras, e a lista de divergências abertas precisa estar em zero.

| | |
|---|---|
| **Resultado esperado** | Relatórios oficiais de DRE, folha/HCM, orçamento e razão de três meses consecutivos em mãos, e o aceite escrito e datado da Controladoria de que o painel confere com o fechamento contábil oficial, com zero divergência aberta |
| **Onde o resultado vai** | Relatórios em docs/reconciliacao/<AAAA-MM>/ (fora do repositório se contiverem dado real do cliente) e o aceite em docs/reconciliacao/aceite-F2.md, com as decisões espelhadas em config/catalogo-metricas.yaml |
| **Destrava** | T-217, T-227, T-239, T-240 *(4 tarefas)* |

### [ ] H-27 · Contratar e autorizar o teste de intrusão antes do go-live de F2

`P1` · **Responsável:** Engenharia

**O que fazer**

Contrate um fornecedor de teste de intrusão, ou aloque um time interno independente de quem escreveu o código. Defina no escopo, por escrito, seis frentes: autenticação, autorização por perfil, escalonamento horizontal (ver dado de outra área ou entidade), escalonamento vertical (ganhar perfil superior), exposição de dado no payload dos componentes de servidor, e segredos e cabeçalhos HTTP. Peça ao cliente autorização formal por escrito para testar o ambiente — sem isso o teste é acesso não autorizado — e acorde a janela em que o teste pode rodar. Combine antes de começar que todo achado classificado como alto ou médio precisa de correção com teste de regressão, ou de aceite formal registrado com data e responsável. Rastreie cada achado até correção ou aceite antes do go-live da Fase 2.

| | |
|---|---|
| **Resultado esperado** | Fornecedor contratado, autorização escrita do cliente com janela acordada, e relatório de intrusão com achados classificados e cada achado alto ou médio rastreado até correção ou aceite formal |
| **Onde o resultado vai** | docs/seguranca/pentest-F2.md, com a rastreabilidade de cada achado |
| **Destrava** | T-246 *(1 tarefa)* |

---

## Antes da Fase 3 · Chat com IA

A Fase 3 pode correr em paralelo com a Fase 2, então estes itens não esperam a Fase 2 terminar.

*8 itens · 3 P0 abertos · 2 resolvidos*

### [ ] H-28 · Criar a conta na Anthropic e emitir as chaves de API

`P0` · **Responsável:** Produto

**O que fazer**

Acesse console.anthropic.com e crie a organização com e-mail corporativo. Em Billing, ative o faturamento com cartão corporativo e adicione crédito suficiente para subir de tier — o tier inicial limita requisições por minuto e a execução das 100 perguntas do conjunto de avaliação esbarra nesse limite. Em Settings > Workspaces, crie dois workspaces separados, um de desenvolvimento e um de CI, cada um com limite de gasto próprio. Em API keys, emita uma chave por workspace, de modo que a chave de desenvolvimento e a de CI possam ser rotacionadas de forma independente. Confirme no Console que o modelo claude-opus-5 está habilitado para a organização, porque a seção 7.3 do PRD fixa esse modelo e não aceita rebaixamento. IMPORTANTE: a chave nunca é colada em arquivo do repositório. A chave de desenvolvimento vai para o arquivo .env local de cada máquina, que precisa estar listado no .gitignore; o repositório carrega apenas .env.example com um valor fictício. A chave de CI é entregue no item H-29. No INSTRUCOES.md registre somente que as chaves foram emitidas, com data, workspace e responsável, nunca o valor.

| | |
|---|---|
| **Resultado esperado** | Duas chaves de API emitidas (uma de desenvolvimento e uma de CI), faturamento ativo com crédito suficiente, limite de gasto por workspace e o modelo claude-opus-5 liberado para a organização |
| **Onde o resultado vai** | ANTHROPIC_API_KEY no arquivo .env local de cada máquina de desenvolvimento, nunca versionado e listado no .gitignore; a variável é validada no boot pelo esquema de T-139, e o repositório só carrega .env.example com valor fictício |
| **Destrava** | T-302, T-304, T-305, T-313, T-317, T-320, T-321, T-334, T-336, T-338, T-339, T-341, T-342, T-344 *(14 tarefas)* |

### [ ] H-29 · Cadastrar a chave de API como segredo do CI e do ambiente de execução

`P0` · **Responsável:** Engenharia

**O que fazer**

Com a chave do workspace de CI em mãos (item H-28), faça duas instalações. Primeira: abra o repositório no GitHub, vá em Settings > Secrets and variables > Actions e crie o segredo chamado ANTHROPIC_API_KEY, colando o valor apenas nesse formulário. Segunda: instale a mesma chave no ambiente onde a aplicação roda, conforme o modo de hospedagem decidido em P6 — se for nuvem dedicada, no cofre de segredos da nossa infraestrutura; se for Docker na rede do cliente, entregue à TI do cliente por canal seguro para injeção como variável de ambiente do compose. Garanta que a chave pode ser trocada sem reconstruir a imagem. NUNCA cole a chave em arquivo do repositório, em docker-compose versionado, em README ou em ticket: o scanner de segredo de T-139 reprova o build e a seção 11 do PRD proíbe chave no código ou na imagem. No INSTRUCOES.md registre apenas que o segredo foi cadastrado no CI e no ambiente, com data e responsável.

| | |
|---|---|
| **Resultado esperado** | Segredo ANTHROPIC_API_KEY disponível para o job de CI e para o ambiente de execução, rotacionável sem reconstruir a imagem, sem nenhuma ocorrência do valor em arquivo versionado |
| **Onde o resultado vai** | Segredo ANTHROPIC_API_KEY em GitHub Actions (Settings > Secrets and variables > Actions) e no cofre de segredos ou nas variáveis de ambiente do modo de hospedagem escolhido em P6 |
| **Destrava** | T-304, T-334, T-338, T-342 *(4 tarefas)* |

### [ ] H-30 · Coletar e aprovar as 100 perguntas de avaliação e as 39 sugestões de tela

`P0` · **Responsável:** Controladoria

**O que fazer**

Marque uma sessão com Controladoria, RH e um controller de área para duas entregas. Primeira, coleta: peça que essas pessoas escrevam as perguntas que realmente fazem hoje, na formulação delas, incluindo as ambíguas e as que o produto não responde — não reescreva as perguntas para caberem no catálogo, porque isso invalida a medida. Segunda, gabarito: para cada uma das 100 perguntas, valide linha a linha qual métrica do catálogo a responde, qual recorte de filtros se aplica, qual das 13 telas ela abre e qual dos 71 painéis do Anexo A ela destaca; e marque explicitamente quais perguntas devem ser recusadas por estarem fora do catálogo. Na mesma sessão, aprove as 39 sugestões contextuais, três por tela. Sem esse aceite, o gabarito acaba escrito pelo mesmo time que constrói o chat e a meta de 95% da seção 7.7 mede o produto contra si mesmo. Registre data e nomes dos aprovadores no cabeçalho do arquivo.

| | |
|---|---|
| **Resultado esperado** | Lista de 100 perguntas reais com gabarito de métrica, recorte, tela e painel, aceita por Controladoria e RH, mais as 39 sugestões contextuais aprovadas, tudo com data e aprovadores no cabeçalho |
| **Onde o resultado vai** | Arquivo versionado do conjunto de avaliação, na mesma pasta do catálogo de métricas |
| **Destrava** | T-325, T-332, T-333, T-334, T-337 *(5 tarefas)* |

### [ ] H-31 · Fechar a base contratual do trânsito de dados para a API do modelo

`P0` · **Responsável:** Comercial

**O que fazer**

A seção 11 do PRD exige que o trânsito de dados para a API do modelo esteja escrito no contrato, e não apenas garantido pelo código. Redija o aditivo ou a cláusula com a lista fechada do que sai do ambiente do cliente — somente o catálogo de métricas, o texto da pergunta e números já agregados — e do que nunca sai — dado bruto, linha de pessoa e credencial. Nomeie a Anthropic como subprocessador na mesma cláusula. Antes de levar ao Jurídico do cliente, obtenha da Anthropic o acordo de tratamento de dados (DPA) e, se o cliente exigir, a retenção zero de dados no console comercial: são os dois documentos que o Jurídico vai pedir como anexo. Leve o conjunto para aprovação e assinatura. Sem essa cláusula assinada, a Fase 3 não pode ir para nenhum ambiente com dado real do cliente — a codificação contra dados de teste pode começar antes.

| | |
|---|---|
| **Resultado esperado** | Cláusula de trânsito de dados assinada pelo cliente, com o DPA da Anthropic anexado, autorizando explicitamente o envio de catálogo, pergunta e números agregados e proibindo o resto |
| **Onde o resultado vai** | Anexo do contrato comercial assinado, com o número da cláusula citado em docs/decisoes/transito-api.md, referenciado pelo inspetor de payload de T-321 |
| **Destrava** | T-321, T-322, T-342 *(3 tarefas)* |

### [ ] H-32 · Aprovar o teto mensal de gasto com a API e configurar o limite no Console

`P1` · **Responsável:** Comercial

**O que fazer**

Calcule e aprove o teto mensal em dólares deste contrato. A conta parte de dois insumos: o preço da seção 7.3 do PRD (US$ 5 por milhão de tokens de entrada e US$ 25 por milhão de tokens de saída no claude-opus-5) e o volume esperado de perguntas por usuário por mês. Decida também duas regras de operação: quem autoriza estouro do teto e o que a interface faz quando o consumo atinge 100% — a tarefa T-336 recusa novas requisições com mensagem própria. Registre o número aprovado com data e nome do aprovador. Depois configure o mesmo valor como spend limit do workspace em console.anthropic.com > Settings > Limits, e ative o alerta de uso em 80%. O mesmo número entra como valor de configuração da aplicação.

| | |
|---|---|
| **Resultado esperado** | Teto mensal em dólares aprovado e registrado com data e aprovador, replicado como spend limit do workspace no Console da Anthropic com alerta em 80% |
| **Onde o resultado vai** | CHAT_TETO_MENSAL_USD e CHAT_ALERTA_PERCENT nas variáveis de ambiente por instalação, mais o spend limit do workspace no Console da Anthropic |
| **Destrava** | T-336 *(1 tarefa)* |

### [ ] H-33 · Liberar o acesso ao warehouse de homologação com dado real

`P1` · **Responsável:** TI do cliente

**O que fazer**

A tarefa T-342 roda as mesmas 100 perguntas também contra a fonte de dado real (DATA_SOURCE=warehouse), o que exige um ambiente de homologação com o PostgreSQL réplica já carregado pela sincronização da Fase 2. Peça à TI do cliente três coisas: um usuário de banco somente leitura, com senha própria e sem reaproveitar o usuário usado pelo job de sincronização; a string de conexão do warehouse de homologação; e a liberação de rede até ele — allowlist do IP do runner de CI, ou acesso por VPN ou túnel, conforme o modo decidido em P6. Feche só depois de um teste de conexão bem-sucedido a partir do próprio runner de CI. A string de conexão vai para o .env do ambiente de homologação e para o cofre de segredos do CI, nunca para arquivo versionado.

| | |
|---|---|
| **Resultado esperado** | Usuário somente leitura criado com senha própria, string de conexão entregue por canal seguro e rota de rede liberada e testada a partir do runner de CI até o warehouse de homologação |
| **Onde o resultado vai** | WAREHOUSE_DATABASE_URL no .env do ambiente de homologação e como segredo do job de CI; nunca no repositório |
| **Destrava** | T-342 *(1 tarefa)* |

### [ ] H-34 · Definir o denominador do O2 e medir a linha de base do O1 com pessoas

`P1` · **Responsável:** Controladoria

**O que fazer**

A Controladoria precisa entregar duas coisas antes de a Fase 3 entrar em produção, porque depois disso a medida de referência fica contaminada pelo próprio produto. Primeira: escrever e aprovar o que conta como 'pergunta do comitê', ou seja, quais reuniões e quais tipos de pergunta entram no denominador do objetivo O2, e escolher o instrumento de captura da via analista — registro leve preenchido pelo próprio analista a cada pedido, ou marcação feita na ata da reunião. Segunda: medir a linha de base do objetivo O1 como ela é hoje, sem o produto — com as quatro personas, cronometrar pelo menos cinco perguntas reais, do momento em que a pergunta é feita até o número confiável chegar às mãos de quem perguntou, registrando cada tempo com data, persona e a pergunta. Combine que a coleta roda por quatro semanas consecutivas antes de qualquer afirmação sobre as metas de menos de 30 segundos (O1) e de 70% (O2).

| | |
|---|---|
| **Resultado esperado** | Documento aprovado com a definição do denominador do O2 e o instrumento de captura escolhido, mais a planilha da linha de base do O1 com pelo menos cinco perguntas cronometradas, com data e persona |
| **Onde o resultado vai** | docs/f4/objetivos-o1-o2.md versionado, citado pela configuração do relatório semanal de uso |
| **Destrava** | T-407, T-408 *(2 tarefas)* |

---

## Antes da Fase 4 · Escala

Itens de adoção e operação contínua.

*7 itens · 1 P0*

### [ ] H-35 · Indicar as pessoas reais das quatro personas e agendar a adoção guiada

`P0` · **Responsável:** Produto

**O que fazer**

O critério de saída da Fase 4 é uso recorrente semanal pelos quatro perfis, e isso não existe sem pessoas de verdade usando o produto. Peça ao patrocinador do cliente a indicação nominal de pelo menos um usuário real para cada persona da seção 3 do PRD — CFO ou Diretoria, Controller, business partner de RH e analista de BI — com e-mail corporativo e o perfil de acesso correspondente entre diretoria, controller, rh, area e auditor. Para cada persona, nomeie também um responsável interno que acompanhe a adoção. Agende as quatro sessões de onboarding com data confirmada na agenda dessas pessoas, cada uma abrindo na tela de entrada daquela persona, com o recorte padrão e as três sugestões contextuais daquela tela. Combine explicitamente com o gestor de cada pessoa que o uso será observado por quatro semanas consecutivas. Cadastre os mesmos usuários nos grupos do provedor de identidade que alimentam o mapeamento de perfis.

| | |
|---|---|
| **Resultado esperado** | Lista nominal de usuários por persona com perfil de acesso, um responsável interno nomeado por persona, e as quatro sessões de onboarding agendadas com data confirmada |
| **Onde o resultado vai** | docs/f4/adocao-personas.md versionado no repositório, e os mesmos usuários cadastrados nos grupos do IdP que alimentam config/perfis.yaml |
| **Destrava** | T-401, T-406, T-407, T-416 *(4 tarefas)* |

### [ ] H-36 · Aprovar as metas oficiais por métrica e a política de alertas

`P1` · **Responsável:** Controladoria

**O que fazer**

A Controladoria, junto com RH nas métricas de pessoas, precisa decidir duas coisas e registrá-las com data e aprovadores. Primeira: quais métricas do catálogo têm meta oficial e qual é o valor numérico de cada uma — por exemplo, turnover de 12 meses com meta 14,0. Segunda: a política de alerta, respondendo quais dessas métricas disparam notificação ao sair da meta, com qual tolerância antes de disparar, e para qual perfil e qual área vai cada alerta. Sem essa lista aprovada, o traço de meta desenhado no painel e o disparo de alerta ficam sem referência oficial e viram número escolhido por quem programou. Cada meta entra no campo 'meta' da métrica no catálogo, com a linha 'decisao' correspondente, e o catálogo tem a versão semântica incrementada.

| | |
|---|---|
| **Resultado esperado** | Lista de métricas com meta oficial, valor, data e aprovadores, mais a matriz de quem recebe qual alerta por perfil e por área, com a versão do catálogo incrementada |
| **Onde o resultado vai** | Campo meta e linha decisao de cada métrica em config/catalogo-metricas.yaml (com incremento de versão) e config/alertas.yaml com os destinatários |
| **Destrava** | T-404, T-411, T-412 *(3 tarefas)* |

### [ ] H-37 · Provisionar o canal de notificação dos alertas e a credencial dele

`P2` · **Responsável:** TI do cliente

**O que fazer**

Decida com a TI do cliente por qual canal os alertas de métrica fora de meta saem: e-mail pelo servidor SMTP do cliente, webhook de entrada do Slack, ou webhook do Microsoft Teams. Se for e-mail, peça à TI um endereço remetente dedicado e as credenciais de SMTP: host, porta, usuário e senha. Se for Slack ou Teams, alguém com permissão de administrador do workspace precisa criar o aplicativo ou o webhook de entrada no canal escolhido e devolver a URL. Em instalação Docker dentro da rede do cliente, peça também a liberação de saída no firewall para o host do canal, senão o alerta falha silenciosamente. A senha de SMTP e a URL do webhook entram exclusivamente como variáveis de ambiente, rotacionáveis sem reconstruir a imagem, e nunca no código, na imagem ou em arquivo versionado (PRD seção 11); o INSTRUCOES.md registra apenas que o canal foi provisionado, com data e responsável.

| | |
|---|---|
| **Resultado esperado** | Canal escolhido e credencial funcional entregue por canal seguro — usuário e senha de SMTP com remetente dedicado, ou URL de webhook — mais a liberação de firewall quando aplicável, comprovada por um alerta de teste recebido |
| **Onde o resultado vai** | ALERT_CHANNEL e SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, ou ALERT_WEBHOOK_URL, no .env do ambiente ou no cofre, nunca versionado |
| **Destrava** | T-411, T-412 *(2 tarefas)* |

### [ ] H-38 · Homologar a quarta entidade nas views, no IdP e na matriz de autorização

`P2` · **Responsável:** TI do cliente

**O que fazer**

A promessa de suportar novas entidades sem alteração de código só fica provada com uma entidade nova de verdade, e ela vem do cliente. Peça três entregas. Primeira: que o cliente escolha qual é a nova entidade — uma unidade, filial ou empresa adquirida. Segunda: que a TI do cliente estenda as sete views da seção 10.1 do PRD para trazer essa entidade com a mesma profundidade histórica das demais, mantendo o grão mês por entidade por área. Terceira: que o administrador do provedor de identidade crie o grupo correspondente à nova entidade e o inclua no claim de grupos que a aplicação já lê. Por fim, a Controladoria junto com a Diretoria precisa aprovar por escrito quem passa a enxergar a nova entidade em cada um dos cinco perfis. O teste de sucesso é a entidade aparecer no filtro sem que uma linha de código mude: só configuração.

| | |
|---|---|
| **Resultado esperado** | Views entregues com a quarta entidade e histórico completo, grupo criado no IdP e exposto no claim de grupos, e matriz de autorização aprovada com data |
| **Onde o resultado vai** | As views no schema de origem, config/mapeamento.yaml, config/escopos.yaml e o mapeamento de claims do IdP — sem alteração de código |
| **Destrava** | T-413, T-414 *(2 tarefas)* |

### [ ] H-39 · Expor marca de alteração na origem e decidir a regra de mês reaberto

`P2` · **Responsável:** TI do cliente

**O que fazer**

Para carregar apenas os meses que mudaram, a origem precisa dizer o que mudou. Peça à TI do cliente que exponha nas views de fato uma marca de alteração confiável: uma coluna com data e hora da última atualização da linha, ou da última carga do fechamento daquele mês, documentada no dicionário de colunas. Em paralelo, peça à Controladoria a regra de reabertura contábil por escrito: por quantos meses um período já fechado ainda pode ser alterado, e quem avisa quando isso acontece. Sem essa regra o carregamento incremental ignora ajuste retroativo e a réplica deixa de bater linha a linha com a carga completa, que é exatamente o critério de aceite de T-415. Confirme também com a TI que a janela de sincronização acordada na decisão P4 continua valendo no modo incremental.

| | |
|---|---|
| **Resultado esperado** | Views com coluna de marca de alteração documentada no dicionário de colunas, e regra escrita de quantos meses retroativos podem ser reabertos, aprovada pela Controladoria |
| **Onde o resultado vai** | docs/f4/sync-incremental.md e o dicionário de colunas lido por config/mapeamento.yaml, citado pela configuração do job de sincronização |
| **Destrava** | T-415 *(1 tarefa)* |

### [ ] H-40 · Instituir o ritual mensal que promove pergunta sem resposta a métrica do catálogo

`P2` · **Responsável:** Controladoria

**O que fazer**

As perguntas reais que o chat não soube responder viram itens do conjunto de avaliação, e isso passa por decidir definição de métrica, que é decisão de negócio e não de engenharia. Nomeie o dono do ritual — Controladoria, com RH nas métricas de pessoas — e marque uma reunião mensal recorrente na agenda. A cada rodada o comitê recebe a fila de perguntas sem resposta agrupada por frequência e classifica cada pergunta em exatamente uma de três saídas: entra no catálogo, com fórmula, unidade e agregação acordadas na hora; fica declaradamente fora de escopo; ou depende de dado que o cliente ainda não fornece. Cada entrada nova no catálogo exige incremento de versão com a linha 'decisao' preenchida, com data e áreas aprovadoras. Antes da primeira rodada, confirme com o Jurídico do cliente que reutilizar o texto das perguntas reais respeita o prazo de retenção decidido em P7 (item H-11).

| | |
|---|---|
| **Resultado esperado** | Reunião mensal marcada com dono nomeado, e a primeira rodada de perguntas classificada entre entra no catálogo, fica fora de escopo, ou falta dado |
| **Onde o resultado vai** | Novas entradas e changelog em config/catalogo-metricas.yaml e config/catalogo-metricas.CHANGELOG.md, e o conjunto de perguntas rotuladas versionado junto do catálogo |
| **Destrava** | T-416 *(1 tarefa)* |

### [ ] H-41 · Autorizar janela, ambiente e teto de gasto do teste de carga

`P2` · **Responsável:** TI do cliente

**O que fazer**

O teste de carga simula o uso semanal dos quatro perfis e dispara chamadas reais à API do modelo no estágio de chat, o que consome orçamento de verdade e carrega a infraestrutura. Peça à TI do cliente duas coisas por escrito: uma janela autorizada para a execução, porque em instalação Docker dentro da rede do cliente rodar carga sem aviso prévio é tratado como incidente; e um ambiente de homologação com o mesmo dimensionamento do de produção, senão o resultado não diz nada sobre produção. Peça a quem administra a conta da Anthropic que confirme, ou eleve temporariamente, o teto mensal de gasto da chave usada na homologação, para o teste não ser cortado no meio nem estourar o custo do mês. Registre a janela acordada e o teto confirmado antes de executar.

| | |
|---|---|
| **Resultado esperado** | Janela e ambiente de homologação com dimensionamento equivalente ao de produção autorizados por escrito, e teto de gasto confirmado ou elevado para a rodada de carga |
| **Onde o resultado vai** | docs/f4/teste-carga.md com a janela acordada; o limite fica configurado no Console da Anthropic sobre a chave usada em ANTHROPIC_API_KEY do ambiente de homologação |
| **Destrava** | T-417 *(1 tarefa)* |

---

## Índice reverso — qual tarefa espera qual instrução

Use ao encontrar uma tarefa marcada `⛔` ou `⏸` em [TASKS.md](TASKS.md).

| Tarefa | Espera |
|---|---|
| T-002 | H-01 |
| T-003 | H-12 |
| T-004 | H-01 |
| T-006 | H-02 |
| T-007 | H-06 |
| T-008 | H-07 |
| T-009 | H-12, H-13 |
| T-010 | H-23 |
| T-011 | H-09 |
| T-012 | H-11 |
| T-013 | H-42 |
| T-101 | H-01 |
| T-103 | H-01 |
| T-110 | H-03 |
| T-111 | H-03 |
| T-113 | H-06, H-07, H-08 |
| T-114 | H-03 |
| T-119 | H-03 |
| T-123 | H-02 |
| T-131 | H-01 |
| T-139 | H-02 |
| T-140 | H-01 |
| T-142 | H-04 |
| T-144 | H-04 |
| T-146 | H-03 |
| T-149 | H-23 |
| T-152 | H-01 |
| T-153 | H-01 |
| T-155 | H-06, H-07, H-08 |
| T-161 | H-02 |
| T-162 | H-04 |
| T-166 | H-23 |
| T-170 | H-05 |
| T-171 | H-02 |
| T-172 | H-02 |
| T-175 | H-02 |
| T-183 | H-43 |
| T-184 | H-04 |
| T-185 | H-01 |
| T-188 | H-02 |
| T-189 | H-06, H-07, H-08 |
| T-191 | H-02 |
| T-193 | H-05 |
| T-201 | H-08, H-10, H-12 |
| T-205 | H-09, H-12, H-14, H-15 |
| T-206 | H-09, H-14, H-16 |
| T-207 | H-12, H-14, H-18 |
| T-208 | H-13, H-14, H-15, H-18 |
| T-209 | H-18 |
| T-210 | H-08 |
| T-211 | H-08, H-12 |
| T-217 | H-08, H-26 |
| T-218 | H-06 |
| T-219 | H-07 |
| T-220 | H-14, H-16 |
| T-221 | H-20 |
| T-222 | H-20 |
| T-223 | H-20, H-21 |
| T-226 | H-22 |
| T-227 | H-22, H-26 |
| T-228 | H-17 |
| T-229 | H-17 |
| T-231 | H-09, H-17 |
| T-232 | H-13 |
| T-233 | H-23, H-24 |
| T-234 | H-24 |
| T-235 | H-23 |
| T-236 | H-18 |
| T-237 | H-01, H-12, H-18 |
| T-239 | H-06, H-07, H-26 |
| T-240 | H-26 |
| T-242 | H-20, H-21 |
| T-243 | H-21 |
| T-244 | H-21 |
| T-245 | H-20, H-21 |
| T-246 | H-27 |
| T-247 | H-14, H-15, H-16, H-18, H-19 |
| T-248 | H-19, H-20 |
| T-249 | H-09, H-15, H-16, H-17, H-25 |
| T-250 | H-10, H-11 |
| T-252 | H-10, H-12, H-18, H-19 |
| T-253 | H-25 |
| T-254 | H-16 |
| T-255 | H-17 |
| T-256 | H-21 |
| T-302 | H-28 |
| T-304 | H-28, H-29 |
| T-305 | H-28 |
| T-313 | H-28 |
| T-317 | H-28 |
| T-320 | H-28 |
| T-321 | H-28, H-31 |
| T-322 | H-31 |
| T-323 | H-11 |
| T-324 | H-11 |
| T-325 | H-30 |
| T-332 | H-30 |
| T-333 | H-30 |
| T-334 | H-28, H-29, H-30 |
| T-335 | H-11 |
| T-336 | H-28, H-32 |
| T-337 | H-30 |
| T-338 | H-28, H-29 |
| T-339 | H-28 |
| T-341 | H-28 |
| T-342 | H-28, H-29, H-31, H-33 |
| T-344 | H-28 |
| T-401 | H-35 |
| T-404 | H-36 |
| T-406 | H-35 |
| T-407 | H-34, H-35 |
| T-408 | H-34 |
| T-411 | H-36, H-37 |
| T-412 | H-36, H-37 |
| T-413 | H-38 |
| T-414 | H-38 |
| T-415 | H-39 |
| T-416 | H-35, H-40 |
| T-417 | H-41 |

---

*Ao concluir um item, troque `[ ]` por `[X]` no título dele e atualize o Panorama. Quem executa o backlog confere o artefato antes de destravar a tarefa — ver [EXECUTE.md](EXECUTE.md), seção 5.*
