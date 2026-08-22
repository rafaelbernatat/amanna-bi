# TASKS — Painel BI de Controladoria com chat de IA

| | |
|---|---|
| **Origem** | [PRD.md](PRD.md) v2.0 |
| **Total** | 231 tarefas: 214 pendentes e 17 já concluídas (5 no protótipo) |
| **Ordem** | Fase, depois dependência, depois prioridade. A lista é executável de cima para baixo: nenhuma tarefa aparece antes de algo de que ela dependa. |
| **Verificado** | Zero ciclos de dependência; nenhuma tarefa depende de outra que venha depois na lista, nem de fase posterior. |

---

## Legenda

**Status** — edite o marcador na própria linha da tarefa:

- `[ ]` Não iniciada
- `[~]` Em andamento
- `[X]` Concluída

**Prioridade**

- `P0` — bloqueia outras tarefas da mesma fase. Se parar, a fase para.
- `P1` — essencial para o critério de saída da fase, mas não bloqueia ninguém.
- `P2` — importante, e adiável sem travar a fase.

**Esforço** — `S` até um dia · `M` de dois a quatro dias · `L` mais de uma semana.

**Domínio** — `dados` `paineis` `chat` `ingestao` `seguranca` `plataforma` `decisao` `auditoria`.

Cada tarefa cita a seção do PRD que a origina. Tarefas marcadas `auditoria` não vieram da leitura direta do PRD: foram levantadas por uma auditoria adversarial de completude, que procurou requisito descoberto e critério de aceite mais fraco que o do PRD. Elas estão explicadas em [Como esta lista foi construída](#como-esta-lista-foi-construída).

---

## Panorama

| Fase | Tarefas | P0 | P1 | P2 | Concluídas |
|---|---:|---:|---:|---:|---:|
| [Fase 0 · Protótipo](#fase-0--protótipo--concluída) | 5 | — | — | — | **5 de 5** |
| [Fase 0 · Decisões e bootstrap](#fase-0--decisões-e-bootstrap) | 14 | 6 | 8 | 0 | 6 de 14 |
| [Fase 1 · Contrato](#fase-1--contrato) | 94 | 53 | 37 | 4 | 6 de 94 |
| [Fase 2 · Dado real](#fase-2--dado-real) | 56 | 28 | 25 | 3 | 0 de 56 |
| [Fase 3 · Chat com IA](#fase-3--chat-com-ia) | 45 | 28 | 15 | 2 | 0 de 45 |
| [Fase 4 · Escala](#fase-4--escala) | 17 | 1 | 7 | 9 | 0 de 17 |
| **Total** | **231** | **116** | **92** | **18** | **17 de 231** |

> As cinco tarefas da Fase 0 · Protótipo aparecem concluídas porque o protótipo existe e roda: `public/design/Dashboard BI v2.dc.html`. Ficam na lista como marco, não como trabalho pendente.

**Caminho crítico.** F1 destrava tudo. Depois dela, F2 e F3 correm em paralelo — F3 depende do catálogo de métricas, não do dado real. F4 só começa quando F2 e F3 fecharem.

```
   Fase 0 · Decisões e bootstrap ......  13 tarefas
                 |
                 v
   F1 · Contrato .......................  94 tarefas
                 |
         +-------+-------+
         |               |          (F2 e F3 correm em paralelo)
         v               v
   F2 · Dado real   F3 · Chat com IA
    56 tarefas         45 tarefas
         |               |
         +-------+-------+
                 |
                 v
   F4 · Escala .........................  17 tarefas
```

---

## Fase 0 · Protótipo — CONCLUÍDA

> **Critério de saída:** roteiro de perguntas responde com filtro e gráfico corretos. *(PRD seção 16)*

- [X] **T-P01** `L` `prototipo` As 13 telas dos três módulos, com navegação lateral e tira de abas
  · **PRD:** Anexo A
- [X] **T-P02** `L` `prototipo` Os 71 painéis sobre 12 primitivas de gráfico em SVG
  · **PRD:** Anexo A
- [X] **T-P03** `L` `prototipo` Os cinco filtros globais, com banner de recorte ativo
  · **PRD:** seção 6.2
- [X] **T-P04** `L` `prototipo` O chat determinístico de 21 intenções, que aplica filtro, navega e destaca o painel
  · **PRD:** Anexo B
- [X] **T-P05** `L` `prototipo` O dataset fictício de 12 meses
  · **PRD:** Anexo C

---

## Fase 0 · Decisões e bootstrap

Nada aqui é código de produto, e tudo aqui destrava F1 ou F2. As oito decisões vêm da seção 18 do PRD; o resto é o repositório, que hoje está vazio — zero arquivos rastreados, nenhum `package.json`.

> **Critério de saída:** As oito decisões pendentes estão registradas com data e responsável, e um clone limpo passa typecheck, lint, teste e build.

*14 tarefas · 6 P0 · 8 P1 · 0 P2*

- [X] **T-001** `P0` `M` `plataforma` Bootstrap do repositório: Next.js 16, TypeScript estrito e as três camadas
  · **Aceite:** Clone limpo passa typecheck e build; tsconfig com strict, noUncheckedIndexedAccess, noImplicitOverride e exactOptionalPropertyTypes; Node fixado; pastas de apresentação, semântica e acesso criadas.
  · **PRD:** D4, seção 8.1, seção 8.2, seção 16 F1
- [X] **T-002** `P0` `S` `decisao` Decidir P8: filtro de ano com dois valores fixos ou seleção livre
  · **Aceite:** Decisão registrada com data e responsável de Produto; a escolha determina se o ano vira dimensão parametrizável ou sai do filtro, e o registro é referenciado pelas tarefas de F1.
  · **PRD:** D-P8, seção 18, seção 6.2, Anexo D achado 6
- [ ] **T-003** `P0` `M` `decisao` Decidir P1: sistema de origem de cada uma das views  ⛔ H-12
  · **Aceite:** Arquivo versionado com, para cada uma das 7 linhas da tabela 10.1, sistema de origem, responsável na TI do cliente, forma de acesso e profundidade histórica; nenhuma linha 'a definir' e aceite formal da TI.
  · **PRD:** D-P1, seção 10.1, seção 18
- [X] **T-004** `P0` `M` `auditoria` Portão de domínio da Query após P8
  · **Aceite:** T-101, T-103, T-131 e T-140 passam a depender de T-002; a matriz canônica de recortes é derivada de getMeta em vez de constante literal (contagem calculada, não escrita); o registro de P8 é citado no arquivo de domínio; e as duas saídas possíveis de P8 (ano parametrizável / ano fora do filtro) têm efeito verificado em teste.
  · **PRD:** Seção 18, decisão D-P8 (prazo 'Antes de F1') e Anexo D achado 6
- [X] **T-005** `P1` `S` `plataforma` Configurar ESLint, Prettier e ganchos de pre-commit
  · **Aceite:** Lint sai zero no repositório e falha em arquivo com any explícito ou formatação divergente; o gancho de pre-commit bloqueia o commit nesse mesmo caso.
  · **PRD:** seção 8.2 · **Depende de:** T-001
- [X] **T-005.1** `P0` `M` `plataforma` Instalar o runner de teste de unidade e o arnês de e2e
  · **Aceite:** `npm test` e `npm run e2e` existem e executam ao menos um caso cada com contagem no relatório, cada comando sai diferente de zero quando um caso é quebrado de propósito, e o e2e sobe a aplicação e verifica uma rota servida sem intervenção manual.
  · **PRD:** seção 8.2 testes, seção 16 F1 · **Depende de:** T-001, T-005
- [X] **T-006** `P0` `M` `plataforma` Montar o pipeline de CI com typecheck, lint, teste, build e e2e
  · **Aceite:** Um pull request executa as cinco etapas com cache de dependências, qualquer etapa falhando reprova o merge, e o job completo termina em menos de 15 minutos.
  · **PRD:** seção 8.2, RF-21 · **Depende de:** T-001, T-005
- [ ] **T-007** `P1` `S` `decisao` Decidir P2: transferência interna conta como desligamento  ⛔ H-06
  · **Aceite:** Decisão aprovada por RH e Controladoria, com data e áreas aprovadoras, registrada como linha decisão no catálogo de turnover_12m; reabri-la exige nova versão do catálogo.
  · **PRD:** D-P2, seção 9.4, seção 18, Anexo B intenção 2
- [ ] **T-008** `P1` `S` `decisao` Decidir P3: rescisão entra na folha por competência ou por pagamento  ⛔ H-07
  · **Aceite:** Decisão da Controladoria registrada com data como linha decisão no catálogo de folha_total, definindo a base que o mapeamento vai aplicar em F2.
  · **PRD:** D-P3, seção 9.4, seção 18, Anexo B intenção 11
- [ ] **T-009** `P1` `S` `decisao` Decidir P4: janela e cadência de sincronização aceitáveis  ⛔ H-12, H-13
  · **Aceite:** Cadência, horário e duração máxima da janela acordados com a TI do cliente e registrados em documento versionado que a configuração do job de sync passa a citar.
  · **PRD:** D-P4, seção 10.2, seção 18 · **Depende de:** T-003
- [ ] **T-010** `P1` `S` `decisao` Decidir P5: limite de defasagem que dispara o aviso no selo de frescor  ⛔ H-23
  · **Aceite:** Limite em horas decidido pela Controladoria e registrado; vira valor de configuração único, usado tanto pelo selo quanto pelo estado 'dado defasado' da seção 6.4.
  · **PRD:** D-P5, seção 10.2, RF-10, seção 18
- [ ] **T-011** `P1` `S` `decisao` Decidir P6: Docker no cliente ou nuvem dedicada para este contrato  ⛔ H-09
  · **Aceite:** Escolha comercial registrada com data no contrato; a decisão seleciona o modo de hospedagem e a trilha de segredos, sem que nenhuma diferença de cliente exista no código.
  · **PRD:** D-P6, D5, seção 15, seção 18
- [ ] **T-012** `P1` `S` `decisao` Decidir P7: retenção do registro de auditoria e das perguntas do chat  ⛔ H-11
  · **Aceite:** Prazos por artefato (trilha de auditoria, telemetria, texto de pergunta) decididos pelo Jurídico do cliente e registrados; cada prazo vira parâmetro de configuração antes de F3.
  · **PRD:** D-P7, seção 11, seção 14, seção 18
- [~] **T-013** `P1` `M` `auditoria` Desambiguar a referência e publicar a matriz de rastreabilidade  ⏸ aguardando H-42
  · **Aceite:** refs viram D-P1..D-P8 (decisões da seção 18) e PR-1..PR-4 (princípios da seção 2). cada uma das 8 decisões aparece exatamente uma vez como 'decide' e ao menos uma vez como 'aplica'; nenhuma tarefa de F1/F2/F3 referencia decisão pendente sem depender da tarefa F0 correspondente.
  · **PRD:** seção 18 (decisões D-P1 a D-P8) versus seção 2 (princípios PR-1 a PR-4)

---

## Fase 1 · Contrato

A fase que transforma o protótipo em produto. Extrai a camada de dados para trás de uma interface, versiona o catálogo de métricas, implementa os seis estados de tela e paga a dívida técnica dos achados 3, 5, 6, 7 e 10 do Anexo D. É a maior fase, e é pré-requisito de F2 **e** de F3.

> **Critério de saída:** A mesma tela roda com dois adaptadores distintos, e a suíte de contrato passa nos dois.

*94 tarefas · 53 P0 · 37 P1 · 4 P2*

- [ ] **T-101** `P0` `M` `dados` Declarar os tipos do contrato de dados em pacote sem dependência de interface
  · **Aceite:** Query, DataSource, Meta, Kpi, PanelResponse e MetricValue são exportados de um pacote que não importa React nem Next (teste de grafo falha se importar); teste de tipo prova que Query aceita exatamente os 4 períodos, 3 entidades, 8 áreas e 4 modalidades e recusa qualquer outro literal; o ano **não** é literal em tipo — é validado contra os anos que `getMeta` declara (D-P8), e a matriz canônica de recortes vem de T-004, com a contagem calculada.
  · **PRD:** seção 9.1, seção 9.3, seção 8.1, PR-1, D-P8 · **Depende de:** T-001, T-002, T-004
- [ ] **T-102** `P0` `M` `dados` Estender o envelope PanelResponse para as 12 formas e gerar o JSON Schema
  · **Aceite:** União discriminada cobre as 12 formas do Anexo A.1 com ao menos um exemplo validado cada, forma sem variante não compila, e o schema gerado no build e versionado reprova no CI se dessincronizar dos tipos ou se faltar unit, formula ou asOf.
  · **PRD:** seção 9.3, Anexo A.1, RF-04, RF-15 · **Depende de:** T-101
- [ ] **T-103** `P0` `S` `dados` Validar e canonizar a Query, com chave de cache determinística
  · **Aceite:** Query fora do vocabulário da seção 6.2 é rejeitada antes do adaptador; queryKey() produz a mesma string para os mesmos filtros em qualquer ordem de chaves e chaves distintas para cada um dos 768 recortes.
  · **PRD:** seção 9.1, seção 9.2 regra 5, seção 13, D-P8 · **Depende de:** T-002, T-004, T-101
- [ ] **T-104** `P0` `M` `dados` Implementar unidades declaradas, agregação sum/last/ratio e guardas de precisão
  · **Aceite:** BRL_mi, pct, pp, dias e FTE formam enum fechado; agg=ratio recomputa numerador e denominador em vez de somar, agg=last devolve o último mês do recorte, somar pct ou pp lança erro, divisão por zero devolve null com motivo e nenhum arredondamento ocorre fora da apresentação.
  · **PRD:** seção 9.2 regra 2, seção 9.2 regra 4, seção 13 · **Depende de:** T-101
- [ ] **T-105** `P0` `S` `dados` Modelar o vazio explícito com motivo em todo retorno da camada de dados
  · **Aceite:** Todo retorno de KPI, painel e métrica pode ser null com motivo de enum fechado (sem_dado_no_recorte, grupo_pequeno, fora_do_perfil, fonte_indisponivel); teste percorre os quatro motivos e falha se algum caminho devolver 0, valor herdado ou média silenciosa.
  · **PRD:** seção 9.2 regra 3, PR-4, seção 6.4, RF-24 · **Depende de:** T-101
- [ ] **T-106** `P0` `S` `dados` Publicar a interface DataSource, a fábrica por DATA_SOURCE e a fronteira de camadas
  · **Aceite:** DATA_SOURCE=fixtures e =warehouse trocam a implementação por uma fábrica única sem alterar nenhum arquivo de apresentação, valor inválido interrompe o boot nomeando os aceitos, e um teste de arquitetura reprova import de pg, do SDK da Anthropic ou de implementação concreta fora da fábrica.
  · **PRD:** RF-20, seção 8.3, seção 8.1, PR-1 · **Depende de:** T-101
- [ ] **T-107** `P0` `M` `dados` Publicar o registro dos 71 painéis com tela, forma, span, unidade, fórmula e view
  · **Aceite:** Um teste compara o registro com o inventário do Anexo A e falha em id faltante, extra, tela divergente ou forma fora das 12; o mesmo teste reprova tela com mais de 6 KPIs ou 7 painéis.
  · **PRD:** Anexo A.2, Anexo A.3, Anexo A.4, seção 5, RF-04 · **Depende de:** T-102
- [ ] **T-108** `P0` `M` `dados` Mapear qual painel detalha qual KPI nas 13 telas
  · **Aceite:** Cada KPI das 13 telas está mapeado ao painel que o detalha ou marcado como sem detalhamento com justificativa escrita; o mapa é o insumo da suíte de reconciliação e o teste falha se um KPI novo entrar sem classificação.
  · **PRD:** seção 9.2 regra 1, RF-03, Anexo D achado 4 · **Depende de:** T-107
- [ ] **T-109** `P0` `S` `dados` Tornar a fórmula obrigatória no contrato e remover a chave que a desliga
  · **Aceite:** O tipo exige fórmula não vazia em todo painel de indicador derivado, um teste enumera os 71 painéis e falha se algum derivado vier sem fórmula, e a busca por mostrarMemoria no repositório retorna zero ocorrências.
  · **PRD:** Anexo D achado 10, RF-04, PR-3, seção 9.3 · **Depende de:** T-102, T-107
- [ ] **T-110** `P0` `L` `dados` Modelar as fixtures dimensionais de RH no grão mês x entidade x área x modalidade  ⛔ H-03
  · **Aceite:** vw_fato_rh_mes, vw_fato_vagas e vw_fato_treinamento existem com uma linha por combinação; somar todas as linhas de 2026 reproduz o Anexo C: 1.240 FTE em dezembro, 241 admissões, 145 desligamentos, folha R$ 186 mi e 21.400 horas de treinamento.
  · **PRD:** Anexo D achado 3, Anexo C, seção 10.1, seção 9.1 · **Depende de:** T-001
- [ ] **T-111** `P0` `L` `dados` Modelar as fixtures dimensionais de Financeiro no grão mês x entidade x centro de custo  ⛔ H-03
  · **Aceite:** vw_fato_fin_mes, vw_fato_orcamento e vw_fato_contas existem no grão mensal e a soma consolidada de 2026 reproduz receita líquida R$ 1.200 mi, EBITDA R$ 200 mi, lucro líquido -R$ 8 mi, desvio +R$ 56 mi e ciclo de 76 dias (PMR 52 + PME 75 - PMP 51).
  · **PRD:** Anexo D achado 3, Anexo C, seção 10.1 · **Depende de:** T-001
- [ ] **T-112** `P0` `M` `dados` Definir o esquema do catálogo de métricas em YAML e o carregador validado
  · **Aceite:** O carregador rejeita entrada sem rótulo, fonte, fórmula, unidade, agg, sentido, grao_minimo ou sinônimos; agg fora de {sum,last,ratio} e grao_minimo abaixo de [area, mes] reprovam no CI, e catálogo inválido quebra o build, não o runtime.
  · **PRD:** seção 9.4, seção 8.1, seção 8.2 · **Depende de:** T-001, T-104
- [ ] **T-113** `P0` `L` `dados` Escrever as 21 métricas do Anexo B no catálogo
  · **Aceite:** As 21 entradas trazem os nove campos preenchidos, com decisão presente nas métricas discutidas; um teste cruza catálogo x Anexo B e falha se faltar métrica, se o destino não for uma das 13 telas ou se o painel destacado não constar do registro dos 71 painéis.
  · **PRD:** Anexo B, seção 9.4, seção 7.5, D-P2, D-P3 · **Depende de:** T-107, T-112
- [ ] **T-114** `P0` `L` `dados` Implementar o adaptador de fixtures com filtro dimensional real
  · **Aceite:** Busca no repositório pelos multiplicadores do protótipo (0.62, 0.38 e participação da área) retorna zero ocorrências, e para toda medida aditiva soma(Unidade SP) + soma(Demais unidades) = soma(Consolidado) e a soma das 7 áreas = 'Todas', verificado nos 12 meses e nos 4 períodos.
  · **PRD:** Anexo D achado 3, Anexo D achado 4, seção 8.3, RF-01 · **Depende de:** T-103, T-104, T-106, T-110, T-111
- [ ] **T-115** `P0` `L` `dados` Implementar getKpis para as 7 telas de Recursos Humanos
  · **Aceite:** As 7 telas devolvem até 6 KPIs cada, todos originados do catálogo, e o teste falha se algum KPI ficar idêntico entre recortes distintos de área, período, entidade, ano ou modalidade sem constar de uma lista explícita de invariantes.
  · **PRD:** seção 9.1, RF-01, RF-07, Anexo A.2 · **Depende de:** T-113, T-114
- [ ] **T-116** `P0` `M` `dados` Implementar getKpis para as 5 telas de Financeiro e para a de Integração
  · **Aceite:** As 6 telas devolvem até 6 KPIs cada, todos originados do catálogo, e o teste falha se algum KPI ficar idêntico entre recortes distintos sem constar da lista de invariantes.
  · **PRD:** seção 9.1, RF-01, RF-07, Anexo A.3, Anexo A.4 · **Depende de:** T-113, T-114
- [ ] **T-117** `P0` `L` `dados` Implementar getPanel para as primitivas de série temporal
  · **Aceite:** Todo painel do registro cuja forma é barras, linha ou barras empilhadas responde com envelope válido no JSON Schema, muda de valor ao trocar entidade e área, e tem as categorias respeitando o recorte de período (12, 6, 3 e 1 mês).
  · **PRD:** seção 9.3, Anexo A.1, RF-01, RF-05 · **Depende de:** T-107, T-114
- [ ] **T-118** `P0` `L` `dados` Implementar getPanel para as primitivas categóricas
  · **Aceite:** Todo painel com forma barras horizontais, rosca, funil, divisão ou estatísticas responde com envelope válido; sob recorte de uma única área o painel quebrado por área devolve exatamente uma categoria e as fatias da rosca somam o total declarado.
  · **PRD:** seção 9.3, Anexo A.1, seção 9.2 regra 1, RF-01 · **Depende de:** T-107, T-114
- [ ] **T-119** `P0` `M` `dados` Implementar getPanel para as primitivas compostas
  · **Aceite:** Todo painel com forma cascata, dispersão, régua de ciclo ou mosaico geográfico responde com envelope válido; a cascata da ponte da DRE fecha da receita líquida ao lucro líquido sem resíduo, a régua devolve PMR, PME, PMP e o ciclo, e os três lotes de getPanel cobrem exatamente os 71 painéis.
  · **PRD:** seção 9.3, Anexo A.1, Anexo C, RF-01 · **Depende de:** T-107, T-114
- [ ] **T-120** `P0` `M` `dados` Implementar getMetric para as 21 métricas do Anexo B
  · **Aceite:** getMetric devolve valor, unidade, fórmula e série nas 21 métricas x 4 períodos x 3 entidades, e métrica fora do catálogo devolve recusa tipada com ao menos duas métricas próximas.
  · **PRD:** seção 9.1, Anexo B, seção 7.1, RF-16 · **Depende de:** T-113, T-114
- [ ] **T-121** `P0` `M` `dados` Construir o arnês da suíte de contrato, a matriz canônica de recortes e a tolerância
  · **Aceite:** O comando roda com --source=fixtures e --source=warehouse sobre o mesmo arquivo de casos; um arquivo versionado enumera as 768 combinações marcando exaustivas e amostradas, a tolerância por unidade é fixada em código, e o relatório identifica painel x recorte x regra em cada falha.
  · **PRD:** RF-21, seção 9.2, seção 10.4, seção 13 precisão · **Depende de:** T-006, T-101, T-114
- [ ] **T-122** `P0` `L` `dados` Escrever a suíte da regra 1 - reconciliação entre KPI e painel
  · **Aceite:** A suíte compara soma do painel e valor do KPI nos 768 recortes para cada par mapeado e falha em delta acima da tolerância; sob recorte de uma única área, o painel quebrado por área devolve exatamente uma categoria e nunca a lista inteira.
  · **PRD:** seção 9.2 regra 1, RF-03, Anexo D achado 3, Anexo D achado 4 · **Depende de:** T-108, T-115, T-116, T-117, T-118, T-119, T-121
- [ ] **T-123** `P0` `S` `plataforma` Executar a suíte de contrato em CI no modo fixtures
  · **Aceite:** O CI roda a suíte com DATA_SOURCE=fixtures em job próprio cobrindo os 71 painéis, e o job falha quando qualquer regra da seção 9.2 é violada, com o relatório arquivado como artefato.
  · **PRD:** RF-21, RF-03, seção 10.4, Anexo A · **Depende de:** T-006, T-121, T-122
- [X] **T-124** `P0` `S` `paineis` Extrair os tokens visuais do protótipo para um tema tipado
  · **Aceite:** As 24 chaves da paleta e as três famílias tipográficas do protótipo existem no tema, e uma regra de lint falha se houver cor hexadecimal literal fora do arquivo de tema.
  · **PRD:** Anexo A, seção 13 acessibilidade, protótipo · **Depende de:** T-001
- [X] **T-125** `P0` `M` `plataforma` Criar o módulo único de formatação pt-BR e fixar locale e fuso
  · **Aceite:** Um único módulo formata BRL_mi, pct, pp, dias e FTE com vírgula decimal, ponto de milhar, R$ em milhões com uma casa e data em mês/ano abreviado, validado por tabela de 30 casos com negativos, zero e valores grandes; teste de arquitetura falha se Intl, toLocaleString ou toFixed forem usados fora dele, e a suíte produz saída idêntica com TZ e LANG diferentes.
  · **PRD:** seção 13, seção 9.2 regra 2 · **Depende de:** T-001
- [X] **T-126** `P0` `M` `paineis` Construir o shell de aplicação e as rotas das 13 telas
  · **Aceite:** Em 1440x900 e 1280x720 a barra lateral fixa lista os três módulos, o conteúdo rola independente do cabeçalho e o body nunca rola horizontalmente; as 13 URLs de rh/visao a int/cruz resolvem no servidor, clicar num módulo abre a primeira tela dele, título e breadcrumb refletem a rota e slug inválido devolve 404.
  · **PRD:** seção 6.1, seção 5, Anexo A.2, Anexo A.3, Anexo A.4 · **Depende de:** T-124
- [ ] **T-127** `P0` `M` `paineis` Modelar a Query na URL do servidor e tornar o recorte compartilhável
  · **Aceite:** O round-trip Query->URL->Query é idêntico para os 768 combos válidos, valor fora do enum cai no padrão com aviso registrado, trocar de tela preserva os cinco filtros, e colar a URL em sessão limpa reproduz filtros, tela e painel destacado com os mesmos valores exibidos para o mesmo perfil.
  · **PRD:** seção 6.2, seção 6.6, RF-01, RF-08 · **Depende de:** T-103, T-126
- [ ] **T-128** `P0` `M` `paineis` Construir a barra de filtros com os cinco controles e o banner de recorte ativo
  · **Aceite:** Cada controle expõe exatamente os valores da tabela 6.2 com o padrão selecionado e é percorrível por Tab, setas e Enter sem mouse; o banner aparece se e somente se ao menos um filtro difere do padrão, lista os que diferem, e um clique em 'Voltar ao consolidado' restaura os cinco, coberto em 5 casos isolados mais um combinado.
  · **PRD:** seção 6.2, RF-02, Anexo D achado 1, Anexo D achado 2 · **Depende de:** T-127
- [X] **T-129** `P0` `L` `paineis` Construir o núcleo de gráficos sobre recharts, com caixa reservada
  · **Aceite:** O núcleo produz domínio, escala e rótulos determinísticos, coberto por 20 casos (min<0, faixa nula, valores iguais, rótulos longos), e monta os gráficos sobre recharts recebendo séries já calculadas e formatadas pelo servidor; a caixa do painel é reservada por proporção antes de o gráfico montar, o CLS medido é zero entre 1280 e 1920 px, e nenhum componente de gráfico lê dado (PR-1).
  · **PRD:** seção 8.2 gráficos, Anexo A.1, seção 13 desempenho, protótipo ax() e cw() · **Depende de:** T-124
- [X] **T-130** `P0` `L` `paineis` Portar as primitivas de série: barras, barras empilhadas e linha
  · **Aceite:** As três formas reproduzem rh-headcount com eixo secundário, rec-vagas empilhada com legenda e tov-12m com linha de referência de meta, com snapshot SVG estável; série vazia devolve o estado 'sem dado neste recorte' em vez de gráfico em branco.
  · **PRD:** Anexo A.1, Anexo A.2, seção 8.2 gráficos · **Depende de:** T-129
- [ ] **T-131** `P0` `M` `paineis` Construir o componente de painel e o cartão de KPI
  · **Aceite:** A linha de fórmula é renderizada sempre que PanelResponse.formula existe, sem propriedade capaz de escondê-la; valor, delta, rodapé e sparkline do KPI vêm exclusivamente de getKpis, nenhuma tela renderiza mais de 6 cartões, e a análise estática falha diante de literal numérico formatado no código de KPI.
  · **PRD:** RF-04, RF-07, PR-3, D-P8, Anexo D achado 5, Anexo D achado 10 · **Depende de:** T-002, T-102, T-115, T-124
- [ ] **T-132** `P0` `L` `paineis` Implementar os seis estados obrigatórios de painel e KPI, com esqueletos
  · **Aceite:** Teste de interface exercita com dado forjado carregando, com dado, vazio no recorte, erro de fonte, sem permissão e defasado em ao menos uma forma de cada família; o vazio exibe o motivo e o atalho para ampliar o recorte, o sem permissão não contém agregado no HTML servido, e cada uma das 12 formas tem esqueleto com altura igual à do gráfico final dentro de 4 px, sem piscar valor.
  · **PRD:** seção 6.4, RF-06, PR-4, seção 13 desempenho · **Depende de:** T-105, T-131
- [ ] **T-133** `P0` `M` `paineis` Declarar o escopo da nota e suprimir narrativa incompatível com o recorte
  · **Aceite:** Para cada um dos 71 painéis, sob recorte fora do padrão a nota vem nula ou escrita para aquele recorte e o subtítulo passa a 'No recorte ativo · <area>'; um detector de valor absoluto roda sobre todas as notas nos 768 recortes e falha se um número válido apenas no consolidado aparecer sob outro recorte.
  · **PRD:** RF-09, seção 6.3, PR-4, seção 9.3 · **Depende de:** T-117, T-118, T-119, T-131
- [ ] **T-134** `P0` `L` `paineis` Eliminar os fatores de escala do protótipo da camada de apresentação
  · **Aceite:** Grep no código de tela não encontra nenhum multiplicador do tipo fctx (ent 0.62/0.38, hc, money, rev, trein) nem aritmética sobre valores de negócio, e um adaptador de teste que devolve valores arbitrários por área prova que a tela não deriva nem escala número algum.
  · **PRD:** Anexo D achado 3, Anexo D achado 4, PR-1, RF-07 · **Depende de:** T-107, T-114
- [ ] **T-135** `P0` `S` `seguranca` Definir os contratos de identidade, perfil e escopo em TypeScript estrito
  · **Aceite:** Existe um módulo com Session, Profile (diretoria, controller, rh, area, auditor) e AccessScope derivado dos valores de Query; tsc --strict passa e um teste de tipos rejeita perfil ou entidade fora do enum em tempo de compilação.
  · **PRD:** seção 11, seção 9.1, RF-23 · **Depende de:** T-001, T-101
- [ ] **T-136** `P0` `M` `seguranca` Criar o provedor de sessão plugável com modo fixtures
  · **Aceite:** getSession() devolve Session pelo provedor escolhido por AUTH_PROVIDER=fixtures|oidc, com um perfil de desenvolvimento selecionável sem IdP, e um teste prova que nenhuma tela ou rota muda entre os dois modos.
  · **PRD:** seção 8.2, seção 8.3, RF-20, RF-23 · **Depende de:** T-135
- [ ] **T-137** `P0` `M` `seguranca` Implementar o interceptador de escopo no servidor entre a chamada e o adaptador
  · **Aceite:** Toda chamada a getKpis, getPanel, getMetric e getMeta passa por applyScope(query, session), que restringe entidade e área ou devolve Denied, e uma regra de arquitetura reprova qualquer caminho de código que chame o DataSource sem passar por ele.
  · **PRD:** seção 11, RF-23, seção 9.1, seção 7.5 · **Depende de:** T-103, T-106, T-135
- [ ] **T-138** `P0` `M` `seguranca` Impor o grão mínimo área x mês na fronteira da camada de dados
  · **Aceite:** Um validador recusa com erro tipado qualquer consulta com breakdown fora de {none, area, mes, centro_custo, faixa} ou que peça linha individual, e um teste tenta 10 formas de pedir grão individual (colaborador, cpf, matricula, nome, id) sem que nenhuma toque o adaptador.
  · **PRD:** seção 11, seção 7.5, RF-18, seção 7.2 · **Depende de:** T-103, T-106
- [ ] **T-139** `P0` `M` `seguranca` Validar segredos e configuração no boot, varrer segredo em CI e fixar cabeçalhos HTTP
  · **Aceite:** O boot valida todas as variáveis por esquema e aborta em menos de 2 segundos nomeando as ausentes ou inválidas, sem ler credencial de arquivo versionado ou da imagem; um scanner de segredo no CI reprova um segredo plantado de propósito; e as respostas trazem CSP sem unsafe-inline, HSTS, X-Content-Type-Options, Referrer-Policy e frame-ancestors restrito.
  · **PRD:** seção 11, seção 15, seção 8.3, seção 13 · **Depende de:** T-001, T-006
- [ ] **T-140** `P0` `M` `auditoria` Fixtures com perfis não proporcionais e controle negativo de mutação
  · **Aceite:** os shares de entidade, área e modalidade diferem entre medidas e entre meses (ex.: Unidade SP com 62% do headcount, 41% da folha e ranking de áreas distinto por medida); um adaptador de mutação que reproduz fctx (consolidado x share fixo) REPROVA a suíte de contrato em pelo menos um recorte de cada uma das cinco dimensões, e a suíte só é considerada válida se esse controle negativo falhar.
  · **PRD:** Anexo D achados 3 e 4 (fctx: entidade 0.62/0.38; área pela participação no total), D-P8 · **Depende de:** T-002, T-004
- [X] **T-141** `P0` `M` `auditoria` Regra de AST contra literal numérico em argumento de formatador
  · **Aceite:** qualquer literal numérico que alcance o módulo de formatação (pc, rs, n, sg) ou os campos value/delta/rodape de um Kpi reprova o CI; os cinco casos reais do protótipo (74, 54.3, 4.1, 40.0, -0.7) são apontados pelo teste num arquivo de exemplo; exceção só por allowlist nomeada (metas vindas do catálogo).
  · **PRD:** Anexo D achado 5 - cobertura da pesquisa 74%, concentração top 10 54,3%, inadimplência 4,1%
- [ ] **T-142** `P0` `M` `auditoria` Decidir e implementar o tratamento de métricas posicionais (mediana/percentil)  ⛔ H-04
  · **Aceite:** ou existe um quarto agg (precomputado) com o valor materializado por área x mês na view, ou a métrica sai do catálogo e o KPI vira faixa modal; a mediana salarial e sal-faixas respondem nos 768 recortes; um teste prova que a mediana de 'Todas' não é a média das medianas por área; a supressão k<5 continua valendo sobre as faixas.
  · **PRD:** Anexo D achado 5 - mediana salarial R$ 6.240 (e o painel sal-faixas)
- [ ] **T-143** `P0` `M` `auditoria` Levantamento de medidas ausentes (não só dimensões) e extensão de 10.1 e das fixtures
  · **Aceite:** para cada um dos 15 KPIs do achado 5 estão declarados view, coluna-medida e denominador; custo de recrutamento entra em vw_fato_vagas; respondentes e elegíveis entram em vw_fato_rh_mes; soma de idade e soma de tempo de casa (ou média ponderada declarada) entram em vw_fato_rh_mes; T-117 passa a depender das tarefas de fixture e nenhuma das 15 métricas fica sem coluna de origem.
  · **PRD:** Anexo D achado 5 - custo por contratação R$ 8,6 mil, cobertura da pesquisa 74%, idade média 34,2 anos, tempo médio de casa 3,1 anos
- [ ] **T-144** `P0` `M` `auditoria` Decidir e implementar a semântica de Area no módulo Financeiro  ⛔ H-04
  · **Aceite:** ou vw_fato_fin_mes ganha área e vw_fato_orcamento ganha o de-para centro de custo -> área (com o 8o centro tratado explicitamente), ou os 22 painéis financeiros e os 5 de Integração declaram 'filtro não se aplica a este painel'; a soma dos centros de custo reconcilia com o consolidado; a mudança em relação ao comportamento do protótipo entra como diferença intencional na checklist de paridade de T-156.
  · **PRD:** Anexo D achado 3 aplicado ao Financeiro (fctx: rev = ar.rec/1200, money = ar.folha/186) + seção 10.1 vw_fato_fin_mes
- [ ] **T-145** `P0` `M` `auditoria` Registro de KPIs por tela, no mesmo padrão do registro de painéis
  · **Aceite:** id, tela, métrica do catálogo, unidade, sentido, rodapé e painel que o detalha. um teste compara o registro com as 13 telas e falha em KPI faltante, extra, tela com mais de 6, ou métrica fora do catálogo; T-108, T-117, T-128 e T-156 passam a se parametrizar por ele.
  · **PRD:** Anexo D achado 5 (kpisRaw) + seção 5 'ate 6 KPIs no topo' + RF-07
- [ ] **T-146** `P0` `M` `auditoria` Reconciliar o Anexo C e publicar o dataset de referência fechado  ⛔ H-03
  · **Aceite:** uma planilha versionada deriva TODOS os valores do Anexo C de um único conjunto de fatos mensais; o headcount de dezembro fecha como saldo inicial + admissões - desligamentos, o turnover_12m fecha como soma(desligamentos,12m)/média(headcount_fte,12m) com os mesmos números, e cada divergência com o texto atual do anexo vira errata aprovada por Produto e Controladoria, com data, antes de T-110 e T-111 começarem.
  · **PRD:** Anexo C — linhas 'Headcount (dez) 1.240 FTE = 1.150 + 241 admissões - 145 saídas' e 'Turnover 12m 18,4% = saídas 12m / headcount médio'
- [ ] **T-147** `P1` `M` `dados` Modelar as dimensões vw_dim_* e as faixas usadas pelos painéis de perfil
  · **Aceite:** Existem dimensões de entidade, área, centro de custo, modalidade, UF, faixa etária, faixa de tempo de casa e escolaridade com as cardinalidades do Anexo C (7 áreas, 8 centros de custo, 12 UFs, 3 modalidades, 12 meses); teste de esquema falha se alguma expuser atributo identificável de pessoa.
  · **PRD:** seção 10.1, Anexo C, seção 11 · **Depende de:** T-110
- [ ] **T-148** `P0` `M` `dados` Catalogar as métricas que hoje são KPI com valor fixo em texto
  · **Aceite:** As 15 métricas do achado 5 (idade média, tempo de casa, tempo de fechamento, custo por contratação, encargos, mediana salarial, participação e conclusão de treinamento, cobertura da pesquisa, ticket médio, concentração top 10, PMR, PME, PMP e inadimplência) existem no catálogo com fórmula, unidade e agg, e cada uma tem medida correspondente nas fixtures.
  · **PRD:** Anexo D achado 5, RF-07, seção 9.4 · **Depende de:** T-112, T-147
- [ ] **T-149** `P0` `M` `dados` Definir o contrato de Meta com frescor, implementar getMeta e o modo de falha
  · **Aceite:** getMeta devolve dimensões com os valores exatos da seção 6.2, versão do catálogo e frescor { asOf, ultimoSyncEm, limiteDefasagemHoras, status }; testes em limite-1, limite e limite+1 devolvem ok, ok e defasado, e falha de fonte devolve erro tipado com o horário da última leitura bem-sucedida, nunca dado parcial.
  · **PRD:** seção 9.1, RF-10, RF-22, seção 10.2, seção 6.4, D-P5 · **Depende de:** T-101, T-147
- [ ] **T-150** `P0` `M` `dados` Substituir todos os KPIs literais por leitura do catálogo e bloquear novos literais
  · **Aceite:** Os 15 KPIs do achado 5 mudam ao trocar área e período, verificado em 4 períodos x 8 áreas; o ciclo financeiro é recalculado como PMR + PME - PMP em vez de fixado em 76 dias; e uma regra de lint ou teste de AST reprova número formatado (R$, %, dias, anos, p.p.) nos módulos de KPI e painel, demonstrado em um arquivo de exemplo.
  · **PRD:** Anexo D achado 5, RF-07, RF-01, PR-3 · **Depende de:** T-109, T-115, T-116, T-148
- [ ] **T-151** `P0` `M` `seguranca` Implementar a supressão de grupo pequeno nos dados e nas telas de faixas
  · **Aceite:** Toda série com breakdown de faixa cujo grupo tenha menos de 5 pessoas volta null com motivo grupo_pequeno e o total agregado não permite reconstruir o grupo suprimido; com a fixture de área pequena, col-idade, col-tempo, col-escol e sal-faixas exibem 'grupo pequeno demais para exibir' no lugar do valor.
  · **PRD:** RF-24, seção 11, Anexo A.2, seção 7.5 · **Depende de:** T-105, T-132, T-147
- [ ] **T-152** `P1` `M` `dados` Produzir a fixture do ano de 2025 no mesmo grão da de 2026
  · **Aceite:** Toda medida de 2026 tem contraparte de 2025 no mesmo grão, e a série de comparação hoje fixa como receitaLY passa a ser lida da fixture de 2025, com os dois caminhos devolvendo os mesmos 12 valores em teste.
  · **PRD:** Anexo D achado 6, RF-05, D-P8 · **Depende de:** T-002, T-110, T-111
- [ ] **T-153** `P0` `M` `dados` Tornar o filtro de ano um recorte real e o ano uma dimensão parametrizável
  · **Aceite:** Selecionar 2025 altera o valor de todos os 71 painéis e dos KPIs das 13 telas exceto invariantes declarados; a lista de anos vem de getMeta e acrescentar 2024 as fixtures faz o filtro oferecer três anos sem alteração de código; se P8 decidir remover o filtro, ele some da barra e da URL.
  · **PRD:** Anexo D achado 6, RF-05, D-P8, seção 6.2 · **Depende de:** T-002, T-114, T-149, T-152
- [ ] **T-154** `P1` `M` `dados` Gerar as fixtures sujas e escassas de forma determinística
  · **Aceite:** Um conjunto contém área nula, mês ausente no meio da série, centro de custo inédito, área com 3 pessoas, faixa etária com 1 pessoa e entidade fora do perfil de teste; regenerar duas vezes produz arquivos byte-idênticos e a série diária de caixa vira dado materializado.
  · **PRD:** seção 10.4, RF-06, RF-24, PR-4, seção 9.2 regra 5 · **Depende de:** T-110, T-111, T-147
- [ ] **T-155** `P1` `S` `dados` Versionar o catálogo e tornar o campo decisão obrigatório em métrica discutida
  · **Aceite:** O catálogo tem versão semântica e changelog próprio; alterar fórmula, unidade ou agg sem incrementar a versão e sem registrar a linha correspondente reprova o CI, e as métricas afetadas por P2 e P3 trazem decisão preenchida ou marcada como pendente com o número da decisão.
  · **PRD:** seção 9.4, seção 17, D-P2, D-P3 · **Depende de:** T-113
- [ ] **T-156** `P1` `M` `dados` Definir o formato do arquivo de mapeamento métrica para view, coluna e agregação
  · **Aceite:** O schema exige view, coluna, agg e filtros por métrica do catálogo; métrica sem mapeamento, coluna inexistente no dicionário e agg incompatível reprovam no CI, e o próprio adaptador de fixtures passa a ler por ele, provando que a peça que muda por cliente é configuração.
  · **PRD:** seção 10.3, seção 9.4, seção 15 · **Depende de:** T-112
- [ ] **T-157** `P1` `M` `plataforma` Indexar e memorizar as leituras por Query com invalidação por asOf
  · **Aceite:** Repetir a mesma Query responde em menos de 50 ms sem tocar a fonte, avançar o asOf invalida todas as entradas afetadas, e a primeira carga de um recorte novo fica abaixo de 1,5 s com as fixtures completas.
  · **PRD:** seção 13, seção 9.2 regra 5, seção 10.2 · **Depende de:** T-103, T-114
- [ ] **T-158** `P0` `S` `seguranca` Chavear o cache de consulta pelo escopo do perfil
  · **Aceite:** A chave de cache inclui o AccessScope efetivo além dos cinco filtros, e um teste executa a mesma Query com perfil diretoria e depois com perfil área provando que o segundo não recebe o resultado cacheado do primeiro, inclusive após troca de perfil na mesma sessão.
  · **PRD:** seção 11, seção 13 desempenho, RF-23 · **Depende de:** T-137, T-157
- [ ] **T-159** `P1` `L` `dados` Escrever as suítes das regras de contrato 2 a 5
  · **Aceite:** A suíte falha se algum valor vier como string ou com R$, %, vírgula decimal ou ponto de milhar, se recorte sem dado devolver zero em vez de null com motivo na fixture suja, se métrica agg=ratio ou pct for somada ao longo do período, ou se três execuções da mesma Query com o mesmo asOf divergirem byte a byte.
  · **PRD:** seção 9.2 regra 2, seção 9.2 regra 3, seção 9.2 regra 4, seção 9.2 regra 5, PR-4, RF-06 · **Depende de:** T-104, T-105, T-113, T-121, T-154
- [ ] **T-160** `P1` `M` `dados` Congelar os envelopes dos 71 painéis em snapshots dourados
  · **Aceite:** Cada painel tem snapshot do envelope no recorte padrão e em ao menos dois recortes fora do padrão, todos válidos contra o JSON Schema, e mudança de valor sem atualização explícita do snapshot reprova o CI.
  · **PRD:** seção 9.3, RF-03, Anexo A · **Depende de:** T-102, T-117, T-118, T-119
- [ ] **T-161** `P1` `L` `dados` Provar RF-20 e RF-21 ainda em F1 com um segundo adaptador sobre Postgres semeado
  · **Aceite:** Um Postgres semeado com as mesmas fixtures responde as quatro funções do DataSource e a suíte de contrato passa idêntica nos dois adaptadores em CI; qualquer divergência de valor entre eles reprova o pipeline.
  · **PRD:** RF-20, RF-21, seção 16 F1, seção 8.3 · **Depende de:** T-106, T-121
- [ ] **T-162** `P1` `M` `paineis` Declarar a aplicabilidade de cada filtro por painel e aplicar o recorte de período
  · **Aceite:** Cada um dos 71 painéis declara quais dos cinco filtros afetam sua consulta e filtrar por Modalidade numa tela do Financeiro exibe 'filtro não se aplica a este painel' em vez de repetir o consolidado; com Período = Dezembro os painéis mensais mostram uma única categoria sem quebra de layout.
  · **PRD:** RF-01, PR-4, seção 6.2, seção 6.4 · **Depende de:** T-107, T-127
- [ ] **T-163** `P1` `M` `paineis` Implementar o destaque de painel pela IA e a API de navegação que restaura filtros e tela
  · **Aceite:** Abrir uma URL com o parâmetro de painel rola até ele, aplica contorno, sombra e o rótulo 'Gráfico referenciado pela IA', visível sem rolagem manual em 1366x768 nas 13 telas; e uma chamada única restaura os cinco filtros e a tela anterior produzindo URL byte a byte igual a de antes, coberta em 5 pares distintos incluindo troca de módulo.
  · **PRD:** seção 6.5, RF-13, RF-14, Anexo D achado 7 · **Depende de:** T-127
- [ ] **T-164** `P1` `L` `paineis` Portar as primitivas categóricas: rosca, funil, divisão, barras horizontais e estatísticas
  · **Aceite:** As fatias da rosca somam 100% com tolerância de 0,1 pp, o funil de rec-funil exibe a conversão passo a passo, a divisão mostra rótulo interno só a partir de 13%, as barras horizontais respeitam o traço de meta e larguras configuráveis, e o painel de estatísticas ajusta as colunas conforme o span, com snapshot no CI.
  · **PRD:** Anexo A.1, Anexo A.2, Anexo A.3 · **Depende de:** T-129
- [ ] **T-165** `P1` `L` `paineis` Portar as primitivas compostas: cascata, dispersão, régua de ciclo e mosaico geográfico
  · **Aceite:** A cascata de fin-dre e cx-ponte fecha no total declarado com tolerância de 0,05 e marca etapas negativas com rótulo além da cor, a dispersão posiciona pontos legíveis em 3 larguras, a régua de ct-ciclo posiciona 4 marcos e 3 faixas a partir de PMR, PME e PMP vindos de getPanel sem número fixo, e o mosaico mostra as 27 UFs com 5 faixas de intensidade e travessão nas ausentes.
  · **PRD:** Anexo A.1, Anexo A.3, Anexo A.4, Anexo C dimensões · **Depende de:** T-129
- [ ] **T-166** `P1` `S` `paineis` Renderizar o selo de frescor e o estado dado defasado a partir de getMeta
  · **Aceite:** As 13 telas exibem a data do último fechamento carregado; com Meta forjado nos três valores de status o selo vira aviso em destaque e os painéis entram no estado defasado, testado com defasagem de 1 dia e de 30 dias.
  · **PRD:** RF-10, seção 6.4, seção 10.2, D-P5 · **Depende de:** T-132, T-149
- [ ] **T-167** `P1` `M` `paineis` Publicar a galeria de verificação das 12 formas em todos os estados
  · **Aceite:** Página interna renderiza no servidor as 12 formas x 6 estados (72 células) a partir de fixtures forjadas, o snapshot SVG é byte a byte estável entre duas execuções, e o CI falha em diferença acima do limiar acordado.
  · **PRD:** Anexo A.1, seção 6.4, RF-06 · **Depende de:** T-130, T-132, T-164, T-165
- [ ] **T-168** `P1` `L` `paineis` Portar as 7 telas do módulo de Recursos Humanos
  · **Aceite:** Os 44 painéis de rh/visao, rh/colab, rh/turnover, rh/recrut, rh/trein, rh/engaj e rh/sal e os KPIs das sete telas vêm de getPanel/getKpis sem cálculo na apresentação, as fórmulas de turnover e eNPS aparecem no painel, sob recorte de área o painel por área mostra só aquela área, e a captura lado a lado com o protótipo no recorte padrão não tem diferença não justificada.
  · **PRD:** Anexo A.2, RF-01, RF-04, RF-07, Anexo D achado 5 · **Depende de:** T-107, T-130, T-131, T-134, T-164, T-165
- [ ] **T-169** `P1` `L` `paineis` Portar as 5 telas de Financeiro e a tela de Integração
  · **Aceite:** Os 27 painéis de fin/visao, fin/caixa, fin/orc, fin/contas, fin/fat e int/cruz e seus KPIs vêm do adaptador; a ponte da DRE e a de caixa fecham no total declarado, o desvio por centro de custo confere com o KPI no mesmo recorte, PMR/PME/PMP alimentam a régua de ciclo, e receita por FTE confere com receita líquida dividida por headcount do mesmo recorte.
  · **PRD:** Anexo A.3, Anexo A.4, RF-03, RF-04, Anexo C · **Depende de:** T-107, T-130, T-131, T-134, T-164, T-165
- [ ] **T-170** `P1` `M` `paineis` Auditar a paridade das 13 telas e exercitá-las com dados incompletos
  · **Aceite:** Checklist assinada com captura lado a lado das 13 telas no recorte padrão, cada diferença registrada como intencional com referência ao Anexo D ou corrigida, nenhum dos 71 ids sem verificação; e sobre a fixture suja as 13 telas renderizam estados vazios ou parciais sem exceção não tratada e com console limpo, cada painel afetado mostrando o motivo.
  · **PRD:** Anexo A, seção 16 F1, seção 10.4, RF-06, PR-4 · **Depende de:** T-132, T-154, T-168, T-169
- [ ] **T-171** `P1` `M` `paineis` Servir cada painel com streaming e travar as metas de desempenho em CI
  · **Aceite:** O HTML inicial chega com cabeçalho, filtros e esqueletos antes de as consultas terminarem e cada painel troca esqueleto por conteúdo de forma independente, verificado na ordem dos chunks de uma tela com 7 painéis; e a medição automatizada falha acima de 400 ms para troca de filtro com cache quente e de 1,5 s para primeira carga de recorte novo.
  · **PRD:** seção 8.2, seção 13 desempenho, O1 · **Depende de:** T-006, T-132, T-157
- [ ] **T-172** `P1` `L` `paineis` Entregar acessibilidade: alternativa textual, teclado, contraste e auditoria em CI
  · **Aceite:** Todo SVG de painel sai com role=img e rótulo acessível derivado de título, nota e fórmula, exigido nos 71 painéis; um teste percorre por teclado barra lateral, abas, os cinco filtros e o botão de voltar ao consolidado; o axe roda nas 13 telas sem violação séria ou crítica; e com a folha de cor neutralizada todo indicador crítico ainda traz rótulo ou seta.
  · **PRD:** seção 13 acessibilidade, RF-04 · **Depende de:** T-006, T-128, T-131
- [ ] **T-173** `P1` `S` `seguranca` Declarar a matriz de autorização perfil x módulo x tela x painel
  · **Aceite:** Arquivo versionado mapeia os 5 perfis para as 13 telas e os 71 painéis (controller: Financeiro e Integração; rh: RH e Integração; diretoria: tudo; area: tudo com recorte fixo; auditor: leitura e trilha), e o teste falha se algum id do Anexo A ficar sem entrada.
  · **PRD:** seção 11, Anexo A.2, Anexo A.3, Anexo A.4 · **Depende de:** T-107, T-135
- [ ] **T-174** `P1` `M` `seguranca` Renderizar o estado sem permissão sem revelar valor agregado
  · **Aceite:** Painel e KPI sob recorte fora do perfil renderizam 'Você não tem acesso a este recorte', e a inspeção do HTML servido, do payload de RSC e da resposta de API confirma ausência de qualquer valor, total, categoria ou nota do recorte negado.
  · **PRD:** seção 6.4, RF-06, RF-23, seção 11 · **Depende de:** T-132, T-137
- [ ] **T-175** `P1` `M` `seguranca` Incluir os testes de autorização na suíte de contrato em fixtures
  · **Aceite:** Para cada um dos 5 perfis a suíte executa as consultas das 13 telas e compara o resultado com a matriz de autorização, rodando no CI em modo fixtures e falhando se qualquer combinação permitida ou negada divergir.
  · **PRD:** RF-23, RF-21, seção 10.4, seção 11 · **Depende de:** T-121, T-137, T-173
- [ ] **T-176** `P1` `M` `plataforma` Construir a fundação de observabilidade e a higiene de log do servidor
  · **Aceite:** Todo log sai estruturado em JSON com identificador de requisição, usuário e versão, com destino configurável por ambiente; um wrapper redige credencial, token, cabeçalho Authorization e texto de pergunta, e um teste falha se algum campo de dado de pessoa ou texto livre for emitido fora dos campos permitidos.
  · **PRD:** seção 13, seção 14, seção 11, seção 15 · **Depende de:** T-139
- [ ] **T-177** `P0` `M` `plataforma` Construir o emissor de telemetria tipado, o sink plugável e o validador anti-PII
  · **Aceite:** track(evento, payload) tem união tipada dos 4 eventos da seção 14 com schema versionado e sink selecionável por ambiente; um validador de runtime e de teste rejeita payload com chave ou valor casando padrões de PII (cpf, matrícula, nome, email) ou com campo fora do schema, testado nos quatro eventos.
  · **PRD:** seção 14, seção 13, seção 11, seção 15 · **Depende de:** T-176
- [ ] **T-178** `P1` `M` `plataforma` Emitir os eventos consulta.duracao e painel.visto
  · **Aceite:** Toda chamada às quatro funções do DataSource emite consulta.duracao com view, recorte, adaptador, duração e resultado, permitindo relatório de p50 e p95 por view; e cada painel renderizado com dado emite painel.visto com id, tela, perfil e semana ISO, sem duplicidade em re-render de troca de filtro e sem identificar a pessoa.
  · **PRD:** seção 14, seção 13, O2 · **Depende de:** T-114, T-132, T-177
- [ ] **T-179** `P1` `M` `auditoria` Teste e2e de transição de recorte
  · **Aceite:** numa tela de 7 painéis, trocar Área e depois Entidade e capturar o DOM em cada frame até a estabilização, exigindo que nenhum KPI ou painel exiba um valor do recorte anterior em qualquer instante (o caminho permitido é esqueleto -> valor novo, nunca valor antigo -> valor novo), repetido nas 13 telas. injetar atraso artificial em um único painel e o teste reprova se ele continuar mostrando o número do recorte anterior.
  · **PRD:** RF-01
- [ ] **T-180** `P1` `M` `auditoria` Classificar os 71 painéis como derivado ou medida direta no registro, cada não-derivado com justificativa
  · **Aceite:** escrita de uma linha, e ligar o teste de T-109 a essa classificação. painel novo entra sem classificação reprova o CI; mudar um painel de derivado para direto exige a justificativa no mesmo commit; e o teste de T-109 falha ao ser rodado contra uma cópia do registro em que um painel derivado teve a fórmula esvaziada.
  · **PRD:** RF-04
- [ ] **T-181** `P1` `M` `auditoria` Endurecer a regra de AST para proibir qualquer literal numérico (cru ou formatado) nos módulos de KPI e
  · **Aceite:** painel, com lista branca explícita e comentada de constantes estruturais (índices, spans de grade, limiares de layout). um arquivo de exemplo com 'const x = 34.2' seguido de chamada ao formatador reprova o lint, e a lista branca é revisada no CI quando cresce.
  · **PRD:** RF-07
- [ ] **T-182** `P1` `M` `auditoria` Acrescentar o motivo denominador_zero ao enum fechado da camada de dados e definir seu estado de tela
  · **Aceite:** para cada métrica com agg=ratio no catálogo, uma fixture com denominador zero devolve null com motivo denominador_zero, o painel e o cartão de KPI exibem texto próprio (nunca 0, nunca traço mudo), e a suíte da regra 3 percorre todas as métricas ratio; a suíte de contrato falha se alguma expuser Infinity, NaN ou 0.
  · **PRD:** seção 13 precisão (divisão por zero)
- [ ] **T-183** `P1` `M` `auditoria` Verificar contraste por cálculo sobre o tema e sobre o SVG servido  ⛔ H-43
  · **Aceite:** um teste computa a razão de cada par texto/fundo declarado no tema e reprova abaixo de 4.5:1 (3:1 para texto grande), e um segundo teste percorre o SVG de cada uma das 12 formas na galeria de verificação extraindo fill de texto contra o fill imediatamente abaixo, reprovando qualquer rótulo fora do limite. escurecer um token de fundo em um ponto reprova o CI nomeando o par.
  · **PRD:** seção 13 acessibilidade (contraste 4.5:1)
- [ ] **T-184** `P1` `M` `auditoria` Fechar modalidade como dimensão de recorte  ⛔ H-04
  · **Aceite:** cada métrica declara se modalidade se aplica (insumo de T-142); soma(Presencial) + soma(Híbrido) + soma(Remoto) = 'Todas' para toda medida aditiva com modalidade aplicável; grep por hcA, vagas e modS na apresentação retorna zero; folha e receita mudam sob modalidade nas métricas em que ela se aplica e os demais painéis devolvem 'filtro não se aplica a este painel'.
  · **PRD:** Anexo D achado 3 - modalidade também é fator de escala (fctx: modS = md.v / 1240)
- [ ] **T-185** `P1` `M` `auditoria` Definir a série de comparação no primeiro ano carregado
  · **Aceite:** ou 36 meses são carregados (2024 apenas como base de comparação), ou a série LY e os KPIs derivados dela devolvem null com motivo sem_dado_no_recorte; com ano=2025, fin-receita, o KPI de crescimento e a intenção 1 do chat mostram o estado vazio com motivo (nunca zero nem a série de 2026); a lista de invariantes de T-129 vira arquivo versionado com justificativa por item.
  · **PRD:** Anexo D achado 6 / RF-05 e Anexo B intenção 1 (crescimento_yoy) sob ano = 2025
- [ ] **T-186** `P1` `M` `auditoria` Fixar código canônico e rótulo de exibição por valor de dimensão num único arquivo
  · **Aceite:** URL, chave de cache, catálogo, matriz de autorização e CSV usam só o código; barra de filtros e notas usam só o rótulo; um teste falha se rótulo acentuado aparecer em chave, URL ou nome de arquivo, e se algum valor da 6.2 não tiver código correspondente.
  · **PRD:** Anexo D achados 1 e 2 (Resolvidos) - valores de 6.2 versus os literais da seção 9.1
- [ ] **T-187** `P1` `M` `auditoria` Estender o escopo de narrativa aos KPIs
  · **Aceite:** rodapé e delta declaram o recorte em que são válidos e são suprimidos quando o recorte muda. o mesmo detector de valor absoluto de T-150 roda sobre rodapé e delta dos KPIs das 13 telas nos 768 recortes e falha se um número válido apenas no consolidado aparecer sob outro recorte.
  · **PRD:** Anexo D achado 5 / RF-09 - rodapé e delta dos KPIs (kpisFor aplica hasAbs sobre k.f e k.d)
- [ ] **T-188** `P1` `M` `auditoria` Renderizar as 13 telas sob o segundo adaptador ainda em F1
  · **Aceite:** um job de CI sobe o Postgres semeado com as mesmas fixtures, executa as 13 rotas com DATA_SOURCE=warehouse e compara o HTML e o SVG servidos com a execução em fixtures no recorte padrão e em dois recortes fora do padrão; qualquer diferença de valor, categoria, nota, fórmula ou estado em qualquer dos 71 painéis reprova o pipeline.
  · **PRD:** seção 16, critério de saída de F1: 'A mesma tela roda com dois adaptadores distintos, e a suíte passa nos dois'
- [ ] **T-189** `P1` `M` `auditoria` Sessão de aprovação do catálogo de métricas com Controladoria e RH, como gate de entrada de F2  ⛔ H-06, H-07, H-08
  · **Aceite:** as 36 métricas (21 do Anexo B mais as 15 do achado 5) são percorridas uma a uma com rótulo, fonte, fórmula, unidade, agg, sentido e grao_minimo; cada uma sai aprovada ou com linha decisão registrada com data e áreas aprovadoras; a versão semântica do catálogo aprovada é nomeada e é ela que T-219 e T-220 citam ao preencher o mapeamento.
  · **PRD:** Cabeçalho do PRD, 'Decisão pedida: aprovar o catálogo de métricas (seção 9) e o mapeamento das views (seção 10) antes de F2', combinado com seção 9.4 ('arquivo versionado, revisado por Controladoria e RH em conjunto')
- [ ] **T-190** `P1` `M` `auditoria` Publicar o registro dos KPIs das 13 telas
  · **Aceite:** arquivo versionado com id, tela, rótulo, unidade, métrica do catálogo, sentido e painel que o detalha para cada KPI; um teste reprova se uma tela declarar mais de 6, se um KPI apontar para métrica inexistente no catálogo, se um KPI renderizado não constar do registro, ou se algum dos 15 KPIs do achado 5 estiver ausente; T-108 e T-128 passam a consumir esse registro em vez de pressupô-lo.
  · **PRD:** seção 5 ('Cada tela carrega até 6 KPIs no topo'), RF-07 e Anexo D achado 5
- [ ] **T-191** `P2` `M` `paineis` Cobrir o grid responsivo e travar o orçamento de bundle
  · **Aceite:** Em 1440, 1024 e 768 px as 13 telas reempilham sem overflow horizontal no body e a tira de abas rola dentro de si; e o CI falha se o JavaScript inicial de qualquer rota passar do orçamento, com o teto declarado em arquivo versionado e o custo do pacote de gráficos medido à parte.
  · **PRD:** seção 5, seção 13, seção 8.2 · **Depende de:** T-006, T-107, T-129
- [ ] **T-192** `P2` `S` `plataforma` Documentar o contrato de dados, o roteiro de nova métrica e as decisões de arquitetura
  · **Aceite:** O documento descreve as quatro funções, as cinco regras e os cinco passos da seção 10.5, e alguém que não escreveu o contrato acrescenta uma métrica seguindo só ele com a suíte passando a cobri-la; o README leva do clone à aplicação com fixtures em três comandos e D1 a D5 estão registradas como ADRs.
  · **PRD:** seção 0, seção 9, seção 10.5, seção 8 · **Depende de:** T-113, T-121
- [ ] **T-193** `P2` `M` `auditoria` Fixar em T-131 que a reconciliação KPI x painel (regra 1) roda sempre na matriz exaustiva de 768  ⛔ H-05
  · **Aceite:** restringindo a amostragem às regras 2 a 5, e registrar no próprio arquivo de matriz a justificativa de cada dimensão amostrada com responsável e data. marcar qualquer combinação como amostrada na suíte da regra 1 reprova o CI.
  · **PRD:** RF-03
- [ ] **T-194** `P2` `M` `auditoria` Governança do inventário: o registro de painéis (e o de KPIs) ganha campo de justificativa e data para
  · **Aceite:** todo item além do inventário do Anexo A. acrescentar um painel sem justificativa preenchida e sem remover outro da mesma tela reprova o CI, com a mesma regra valendo para o 7o KPI de uma tela.
  · **PRD:** Anexo D achado 11 (Resolvido) + seção 5 - 'incluir um painel novo exige remover outro ou justificar por escrito'

---

## Fase 2 · Dado real

Conecta o banco do cliente. É aqui que aparecem as divergências de definição entre áreas — turnover que conta transferência interna, folha que inclui rescisão — e resolvê-las é a entrega mais valiosa da fase, não um contratempo dela.

> **Critério de saída:** O fechamento do mês confere com o relatório contábil oficial: zero divergência (objetivo O3).

*56 tarefas · 28 P0 · 25 P1 · 3 P2*

- [ ] **T-201** `P0` `L` `ingestao` Escrever a especificação entregável das 6 views de fato e das dimensões
  · **Aceite:** Documento com DDL de referência, dicionário coluna a coluna (nome, tipo, unidade, nulabilidade, domínio), grão declarado e chave primária de cada view, mais código estável, rótulo pt-BR e regra de valor desconhecido por dimensão; revisado por Controladoria e RH e entregue à TI como contrato de entrada.
  · **PRD:** seção 10.1, seção 10.5 passo 1, Anexo C dimensões, seção 17 · **Depende de:** T-003
- [ ] **T-202** `P0` `L` `ingestao` Fazer a análise de cobertura dos 71 painéis contra as views de 10.1
  · **Aceite:** Relatório mapeia cada painel para view e colunas e lista as dimensões e medidas ausentes (gênero, faixa etária, escolaridade, tempo de casa, UF, faixa salarial, trilha, etapa de funil, fonte do candidato, categoria de despesa, cliente, fornecedor, segmento, rating, componente de folha, tipo de benefício, tipo de desligamento); cada falta vira extensão de view ou painel reprovado com justificativa, e cx-diario ganha view própria no grão dia ou é reespecificado para mensal.
  · **PRD:** Anexo A, seção 10.1, seção 10.3, seção 5 · **Depende de:** T-107, T-201
- [ ] **T-203** `P0` `M` `plataforma` Empacotar a aplicação em imagem Docker única e compor o ambiente local
  · **Aceite:** docker build produz imagem standalone que sobe só com variáveis de ambiente, responde 200 no endpoint de saúde em menos de 10 s, roda como usuário não-root e não contém segredo nem arquivo de cliente nas camadas; docker compose up sobe aplicação e Postgres 16 a partir do .env.example sem edição, abrindo rh/visao com fixtures, e o volume sobrevive a restart.
  · **PRD:** D5, seção 15, seção 8.2 · **Depende de:** T-001
- [ ] **T-204** `P0` `M` `ingestao` Definir o esquema físico do warehouse com migração idempotente e reversível
  · **Aceite:** A migração cria tabelas espelho, índices por (mes, entidade, area) e a tabela de controle de sync; rodar duas vezes não altera esquema nem dados, duas instâncias simultâneas não corrompem o esquema, o job de ida e volta reproduz o esquema esperado, e uma varredura falha se alguma tabela de fato tiver chave abaixo de área x mês ou coluna identificadora de pessoa.
  · **PRD:** seção 15, seção 8.2, D2, seção 11, RF-18 · **Depende de:** T-201, T-203
- [ ] **T-205** `P0` `M` `ingestao` Provisionar conectividade e credencial somente leitura à origem
  · **Aceite:** Credencial dedicada com SELECT apenas nas 7 views da seção 10.1; teste automatizado tenta INSERT, UPDATE, DELETE e SELECT em tabela fora da lista e as quatro tentativas falham por permissão, nos dois modos de hospedagem previstos.
  · **PRD:** seção 10.2, seção 11, seção 15, D5 · **Depende de:** T-003, T-011
- [ ] **T-206** `P0` `M` `seguranca` Implementar as duas trilhas de segredo com rotação sem rebuild
  · **Aceite:** A mesma imagem carrega segredos por variável de ambiente (Docker no cliente) ou por cofre (nuvem dedicada), selecionado por configuração; trocar a senha da origem e reiniciar o contêiner restabelece o sync sem nova imagem, e nenhum segredo aparece em log, build ou camadas da imagem.
  · **PRD:** D-P6, seção 15, seção 11, D5 · **Depende de:** T-011, T-139, T-205
- [ ] **T-207** `P0` `M` `ingestao` Construir o validador de conformidade das views do cliente
  · **Aceite:** O comando roda contra a origem e reporta por view existência, colunas ausentes e extras, tipos divergentes, grão real medido por duplicatas de chave, percentual de nulos por coluna e valores de dimensão fora do cadastro, saindo diferente de zero se qualquer view não conformar.
  · **PRD:** seção 10.1, seção 10.4, seção 10.5 passo 1 · **Depende de:** T-201, T-205
- [ ] **T-208** `P0` `L` `ingestao` Implementar o job de sync com carga completa das views
  · **Aceite:** O job lê as 7 views, grava em tabelas de estágio e registra linhas lidas por view, e a execução completa sobre 24 meses e as dimensões do Anexo C termina dentro da janela acordada em P4, com o tempo medido e registrado no log.
  · **PRD:** seção 10.2, RF-22, D-P4, D2 · **Depende de:** T-204, T-205, T-207
- [ ] **T-209** `P0` `M` `ingestao` Implementar a troca atômica de estágio para réplica, com asOf congelado
  · **Aceite:** A promoção ocorre em uma única transação e injeção de falha durante extração, escrita e troca deixa a réplica anterior intacta e o asOf inalterado, sem consulta lendo mistura de duas cargas; nenhum dos 71 painéis serve valor de carga incompleta, e rodar o sync duas vezes sobre a mesma origem produz réplicas idênticas linha a linha.
  · **PRD:** RF-22, seção 10.2, seção 9.2 regra 5, D2 · **Depende de:** T-119, T-208
- [ ] **T-210** `P0` `M` `ingestao` Preencher o mapeamento das métricas de RH
  · **Aceite:** Toda métrica de RH do catálogo tem view, coluna e agg preenchidos, o validador de mapeamento passa e a suíte no modo warehouse resolve 100% das métricas do módulo sem nenhuma marcada como sem mapeamento.
  · **PRD:** seção 10.3, seção 10.5 passo 2, seção 9.4 · **Depende de:** T-156, T-201
- [ ] **T-211** `P0` `M` `ingestao` Preencher o mapeamento das métricas financeiras e de integração
  · **Aceite:** Toda métrica de Financeiro e de Integração tem view, coluna e agg preenchidos, o validador passa, métrica sem mapeamento reprova o boot com DATA_SOURCE=warehouse, e o arquivo cobre as seis views de fato e as dimensões da seção 10.1.
  · **PRD:** seção 10.3, seção 10.5 passo 2, seção 10.1, D-P1 · **Depende de:** T-156, T-201
- [ ] **T-212** `P0` `L` `dados` Implementar a tradução de Query para SQL com recorte dimensional real
  · **Aceite:** Os cinco filtros viram cláusulas WHERE e GROUP BY sobre colunas de dimensão, a busca por fatores de escala do protótipo retorna zero ocorrências, entidade='Unidade SP' soma as linhas daquela entidade em vez de multiplicar o consolidado, e toda consulta tem timeout configurável cancelado no banco com pool dimensionado por ambiente.
  · **PRD:** Anexo D achado 3, Anexo D achado 4, RF-01, RF-05, seção 8.3, seção 13 · **Depende de:** T-106, T-204
- [ ] **T-213** `P0` `L` `dados` Implementar getMeta e getKpis no adaptador de warehouse com a view de origem
  · **Aceite:** getKpis devolve por SQL os até 6 KPIs de cada uma das 13 telas com unidade declarada, sem literal de valor no código, e os 14 KPIs fixos do achado 5 passam a variar ao trocar a área; todo envelope carrega sources com uma view existente no arquivo de mapeamento.
  · **PRD:** RF-07, Anexo D achado 5, seção 9.1, seção 7.2, seção 10.5 passo 3 · **Depende de:** T-210, T-211, T-212
- [ ] **T-214** `P0` `L` `dados` Implementar getPanel no warehouse para os 44 painéis de RH
  · **Aceite:** Os 44 painéis das 7 telas de RH respondem pelo warehouse a partir de vw_fato_rh_mes, vw_fato_vagas e vw_fato_treinamento com séries, categorias, unidade, fórmula e asOf, e a suíte de reconciliação passa para todos eles em toda a matriz de recortes.
  · **PRD:** Anexo A.2, seção 10.1, RF-03, seção 9.3 · **Depende de:** T-202, T-212
- [ ] **T-215** `P0` `L` `dados` Implementar getPanel no warehouse para os 22 painéis de Financeiro
  · **Aceite:** Os 22 painéis das 5 telas financeiras respondem a partir de vw_fato_fin_mes, vw_fato_orcamento e vw_fato_contas; a ponte da DRE e a de caixa fecham aritmeticamente em toda a matriz, o ciclo fecha como PMR + PME - PMP e os aging somam o saldo total do razão na data de corte.
  · **PRD:** Anexo A.3, seção 10.1, RF-03, Anexo C · **Depende de:** T-202, T-212
- [ ] **T-216** `P0` `M` `dados` Executar a suíte de contrato contra o warehouse em CI, inclusive com dados incompletos
  · **Aceite:** O mesmo arquivo de casos roda com DATA_SOURCE=fixtures e =warehouse no pipeline, ambos verdes para liberar o merge, com os dois relatórios arquivados e cada divergência listada com métrica, recorte, valor da fixture e valor do banco; um dataset semeado com área nula, mês faltando, centro de custo novo e área com menos de 5 pessoas atinge os seis estados da seção 6.4 sem exceção não tratada.
  · **PRD:** RF-21, RF-20, seção 10.4, seção 10.5 passo 4, PR-4 · **Depende de:** T-123, T-154, T-204, T-213
- [ ] **T-217** `P0` `M` `dados` Montar o processo de resolução de divergências de definição
  · **Aceite:** Cada divergência da suíte tem registro com métrica, valor do painel, valor da fonte, área responsável e decisão, nenhuma é fechada sem uma linha decisão no catálogo com data e áreas aprovadoras, e a lista de divergências abertas chega a zero antes do critério de saída de F2.
  · **PRD:** seção 10.4, seção 9.4, seção 17, O3, seção 10.5 passo 4 · **Depende de:** T-155, T-216
- [ ] **T-218** `P0` `M` `dados` Aplicar a decisão P2 no mapeamento de turnover
  · **Aceite:** As duas leituras são calculadas lado a lado sobre 12 meses reais com a diferença em pontos percentuais apresentada a RH e Controladoria, a escolha de P2 vira filtro no mapeamento de turnover_12m, e a suíte falha se o mapeamento mudar sem atualizar a linha decisão.
  · **PRD:** D-P2, seção 9.4, seção 10.4, Anexo B intenção 2 · **Depende de:** T-007, T-210, T-217
- [ ] **T-219** `P0` `M` `dados` Aplicar a decisão P3 no mapeamento da folha
  · **Aceite:** A folha total é recalculada nas duas bases para 12 meses com a diferença em reais mês a mês, a escolha de P3 vira regra no mapeamento de folha_total, e o mês de fechamento passa a bater com a folha oficial na base escolhida.
  · **PRD:** D-P3, seção 9.4, seção 10.4, Anexo B intenção 11 · **Depende de:** T-008, T-210, T-217
- [ ] **T-220** `P0` `M` `ingestao` Garantir que nenhuma consulta do produto toca o ERP produtivo
  · **Aceite:** A aplicação só recebe a string de conexão do warehouse e a credencial de origem não existe no ambiente dela; um teste de arquitetura falha se qualquer módulo fora do job de sync importar o cliente da origem, e a conexão ao Postgres exige sslmode=verify-full com cifra em repouso documentada nos dois modos.
  · **PRD:** D2, seção 10.2, seção 11, seção 15 · **Depende de:** T-206, T-208
- [ ] **T-221** `P0` `L` `seguranca` Integrar autenticação OIDC com Authorization Code, PKCE e validação de token
  · **Aceite:** O fluxo completo contra um IdP de teste leva o usuário não autenticado ao login e de volta à tela pedida, com discovery configurável por ambiente; state ou PKCE inválidos são recusados, e tokens forjados com assinatura inválida, issuer errado, audience errada, expirado, sem nonce ou com chave rotacionada recebem 401 sem criar sessão.
  · **PRD:** seção 8.2, seção 11, RF-23, seção 16 F2 · **Depende de:** T-136
- [ ] **T-222** `P0` `M` `seguranca` Implementar a sessão de servidor, o logout e a autenticação obrigatória em todas as rotas
  · **Aceite:** Cookie httpOnly, Secure e SameSite=Lax sem perfil legível no cliente, com expiração absoluta, por inatividade e revogação imediata; o logout apaga a sessão e redireciona ao end_session_endpoint sem exibir dado cacheado no histórico; um middleware nega por padrão e a varredura de todas as rotas falha se alguma responder sem sessão fora da lista pública, e POST ao chat sem token anti-CSRF ou de origem cruzada recebe 403.
  · **PRD:** seção 8.2, seção 11, RF-23, seção 13 · **Depende de:** T-221
- [ ] **T-223** `P0` `M` `seguranca` Mapear claims e grupos do IdP para os cinco perfis e aplicar o perfil área
  · **Aceite:** Arquivo de configuração por cliente traduz grupo do IdP em perfil e AccessScope, 5 tokens de exemplo produzem os 5 perfis, grupo desconhecido falha fechado e é registrado na auditoria; para o perfil área o filtro vem travado na própria área sem oferecer 'Todas', e requisição direta com outra área é recusada nas 7 áreas.
  · **PRD:** seção 11, seção 8.2, seção 6.2, RF-23, seção 15 · **Depende de:** T-128, T-137, T-173, T-221
- [ ] **T-224** `P0` `M` `seguranca` Criar o esquema e a migração idempotente da trilha de auditoria
  · **Aceite:** Tabela de auditoria com quem, quando, pergunta, intenção, métricas lidas, recorte aplicado e custo em tokens; a migração roda duas vezes no start sem erro, é reversível, e um teste insere e lê um registro completo.
  · **PRD:** seção 11, RF-19, seção 15 · **Depende de:** T-204
- [ ] **T-225** `P0` `M` `seguranca` Escrever o teste de requisição forjada que fecha RF-23
  · **Aceite:** A suíte bate direto na API para cada um dos 5 perfis com entidade fora do escopo, área fora do escopo, tela de outro módulo e painel de outro módulo, todas recusadas sem valor agregado no corpo; a mesma URL aberta por perfil menor renderiza sem permissão, e a captura do payload de RSC e das respostas de rede de uma sessão controller não contém métrica de RH nem de entidade fora do escopo.
  · **PRD:** RF-23, RF-08, seção 11, seção 6.4, seção 6.6 · **Depende de:** T-127, T-137, T-174, T-222
- [ ] **T-226** `P1` `S` `ingestao` Definir o calendário de competência e a chave de mês
  · **Aceite:** Documento fixa o que é mês fechado, o dia do fechamento contábil e o tratamento do mês corrente parcial; a réplica marca meses abertos e um teste com mês parcial confirma que o painel não o trata como fechado nem o soma como se fosse.
  · **PRD:** seção 10.2, RF-10, O3, seção 9.2 regra 4 · **Depende de:** T-201
- [ ] **T-227** `P0` `L` `dados` Construir o relatório de reconciliação contra o fechamento contábil
  · **Aceite:** Relatório mensal compara linha a linha da ponte da DRE (receita bruta, deduções, receita líquida, CMV, despesas, EBITDA, resultado financeiro, lucro líquido) mais folha e desvio orçamentário entre painel e relatório contábil oficial, com delta explícito, e o mês só é aceito com zero divergência.
  · **PRD:** O3, seção 16 F2, Anexo A fin-dre, seção 10.4, Anexo C · **Depende de:** T-215, T-226
- [ ] **T-228** `P1` `S` `plataforma` Publicar imagem versionada e multiarquitetura a partir da CI
  · **Aceite:** Uma tag semver publica amd64 e arm64 com as tags x.y.z e o SHA do commit, com changelog gerado, e reexecutar o job para a mesma tag não altera o digest publicado.
  · **PRD:** seção 15 · **Depende de:** T-006, T-203
- [ ] **T-229** `P0` `M` `plataforma` Externalizar catálogo, mapeamento e variáveis como configuração de cliente
  · **Aceite:** Catálogo e mapeamento são carregados de diretório montado, validados por esquema no boot com erro nomeando arquivo e linha, e nenhum arquivo específico de cliente existe na imagem; duas instâncias do mesmo digest sobem com catálogos, mapeamentos e bancos diferentes e nenhum identificador de cliente aparece no código ou no esquema.
  · **PRD:** seção 15, seção 10.3, D1 · **Depende de:** T-139, T-156, T-228
- [ ] **T-230** `P1` `S` `plataforma` Expor a versão instalada e implementar saúde e prontidão
  · **Aceite:** Versão, SHA e data de build são injetados no build e aparecem no rodapé da interface e em /api/health junto com o modo de DATA_SOURCE, com teste exigindo igualdade entre os dois; /api/ready responde 503 enquanto getMeta não responde e inclui a data do último fechamento quando responde 200.
  · **PRD:** seção 15, seção 10.2, RF-10, RF-20 · **Depende de:** T-149, T-203
- [ ] **T-231** `P0` `M` `plataforma` Montar o pacote de instalação Docker no cliente e o comando de diagnóstico
  · **Aceite:** Um docker compose de produção com template de variáveis e roteiro de portas, rede e volumes leva uma máquina limpa à instalação funcional em menos de 30 minutos, e um comando único no contêiner imprime versão, migrações aplicadas, modo de DATA_SOURCE, conectividade e idade do último sync sem exibir segredo.
  · **PRD:** seção 15, D5, D-P6, seção 10.2 · **Depende de:** T-204, T-229, T-230
- [ ] **T-232** `P1` `S` `ingestao` Tornar cadência e janela configuráveis e empacotar o agendador com trava
  · **Aceite:** Cadência e horário vêm de configuração com o valor acordado em P4 registrado, alterar a janela não exige rebuild, e um teste comprova que duas execuções concorrentes são impedidas por trava.
  · **PRD:** D-P4, seção 10.2, seção 15, RF-22 · **Depende de:** T-009, T-208
- [ ] **T-233** `P1` `S` `ingestao` Registrar o histórico de execuções do sync e expor a idade do último sync
  · **Aceite:** Cada execução grava início, fim, duração, linhas por view, resultado e erro, as últimas 30 são consultáveis e getMeta lê o último sucesso desse registro; a idade do último sync é exposta continuamente e dispara alerta ao ultrapassar o limite de P5.
  · **PRD:** seção 10.2, RF-10, seção 13 observabilidade, D-P5 · **Depende de:** T-149, T-208
- [ ] **T-234** `P1` `M` `ingestao` Implementar retentativa, timeout e alerta de falha de sync
  · **Aceite:** Falha transitória é retentada com espera crescente até um limite configurado; esgotadas as tentativas o status vira falhou, o selo vira aviso e um alerta é emitido no canal acordado, com a réplica anterior continuando a servir todas as telas.
  · **PRD:** RF-22, seção 10.2, seção 13 observabilidade · **Depende de:** T-209, T-233
- [ ] **T-235** `P1` `S` `ingestao` Implementar o limite de defasagem configurável do selo de frescor
  · **Aceite:** O limite em horas vem de configuração com o valor decidido em P5, e um teste com relógio forjado mostra selo normal abaixo do limite e aviso acima, acionando o estado dado defasado pela mesma regra, sem segunda lógica.
  · **PRD:** D-P5, RF-10, seção 6.4, seção 10.2 · **Depende de:** T-010, T-166, T-233
- [ ] **T-236** `P1` `M` `ingestao` Agregar grupos com menos de 5 pessoas ainda na origem
  · **Aceite:** Faixas com contagem entre 1 e 4 chegam ao warehouse suprimidas ou marcadas como suprimido; teste com dataset de área pequena confirma que nenhuma linha nesse intervalo é replicada e que o painel recebe o motivo da supressão.
  · **PRD:** RF-24, seção 11 · **Depende de:** T-151, T-201
- [ ] **T-237** `P1` `M` `ingestao` Carregar o histórico de 24 meses (2025 e 2026)
  · **Aceite:** A réplica contém 2025 e 2026 completos para as 7 views, e selecionar 2025 muda os valores de todos os painéis nas 13 telas pela suíte, e não apenas a série de comparação.
  · **PRD:** RF-05, Anexo D achado 6, D-P8, seção 10.2 · **Depende de:** T-002, T-208
- [ ] **T-238** `P1` `M` `dados` Implementar getPanel de Integração e getMetric no warehouse
  · **Aceite:** Os 5 painéis de int/cruz cruzam vw_fato_rh_mes e vw_fato_fin_mes no mesmo recorte e reconciliam com os KPIs das duas telas de partida, e as 21 métricas do Anexo B retornam valor, fórmula e série com delta zero dentro da tolerância contra o KPI e o painel destacado.
  · **PRD:** Anexo A.4, Anexo B, RF-03, seção 10.5 passo 5 · **Depende de:** T-113, T-214, T-215
- [ ] **T-239** `P1` `M` `dados` Reconciliar os números de RH contra a folha e o HCM oficiais
  · **Aceite:** Headcount FTE de fechamento, admissões, desligamentos e folha total do mês batem com os relatórios oficiais em três meses consecutivos, e qualquer delta diferente de zero abre registro no processo de divergências.
  · **PRD:** O3, seção 10.4, seção 10.1, D-P2, D-P3 · **Depende de:** T-214, T-218, T-219
- [ ] **T-240** `P1` `M` `dados` Reconciliar orçamento e contas contra Planejamento e o razão do ERP
  · **Aceite:** Orçado e realizado por centro de custo batem com o relatório de Planejamento nos 8 centros, e os aging de receber e pagar mais PMR, PME e PMP batem com o razão do ERP na data de corte, com delta zero.
  · **PRD:** O3, seção 10.1, Anexo A orc-desvio, Anexo A ct-ciclo · **Depende de:** T-215
- [ ] **T-241** `P1` `M` `plataforma` Indexar e ajustar as consultas do warehouse e medir as metas com dado real
  · **Aceite:** As consultas das 13 telas rodam abaixo de 400 ms no p95 com cache quente e 1,5 s em recorte novo sobre o volume do Anexo C, nenhum plano das seis views de fato usa varredura sequencial, e o relatório aponta explicitamente qualquer tela acima das metas.
  · **PRD:** seção 13 desempenho, seção 14, O1, Anexo C · **Depende de:** T-171, T-212, T-216
- [ ] **T-242** `P1` `M` `seguranca` Adaptar navegação e abas ao recorte por perfil
  · **Aceite:** O perfil rh não vê as abas do módulo Financeiro e, ao tentar a URL direta, recebe o estado sem permissão vindo do servidor; o teste cobre os 5 perfis x 13 telas.
  · **PRD:** seção 11, seção 6.1, RF-23 · **Depende de:** T-126, T-223
- [ ] **T-243** `P1` `M` `seguranca` Implementar o provedor de identidade local alternativo
  · **Aceite:** Com o OIDC desativado por configuração, usuários locais autenticam com senha em hash forte, política de bloqueio após tentativas e atribuição de perfil e escopo; teste cobre login, senha errada, bloqueio e troca de senha, e a mesma imagem serve os dois provedores produzindo a mesma forma de sessão.
  · **PRD:** seção 8.2, seção 15, seção 11 · **Depende de:** T-136, T-222
- [ ] **T-244** `P1` `M` `seguranca` Entregar o perfil auditor com acesso à trilha de auditoria
  · **Aceite:** Existe uma tela de trilha com filtro por período, pessoa e métrica acessível somente ao auditor; os outros 4 perfis recebem 403 na rota e o auditor não consegue escrever nem apagar registros.
  · **PRD:** seção 11, RF-19 · **Depende de:** T-223, T-224
- [ ] **T-245** `P1` `M` `seguranca` Rodar a matriz completa de autorização contra as 13 telas e 71 painéis com dado real
  · **Aceite:** Teste parametrizado executa 5 perfis x 13 telas x 71 painéis contra o warehouse e compara com a matriz declarada, com relatório por id de painel e CI falhando com uma única divergência.
  · **PRD:** RF-23, RF-21, Anexo A, seção 10.5 · **Depende de:** T-175, T-213, T-223
- [ ] **T-246** `P1` `M` `seguranca` Executar a revisão de segurança e o teste de intrusão antes do go-live de F2
  · **Aceite:** Relatório cobre autenticação, autorização por perfil, escalonamento horizontal e vertical, exposição de dado no payload, segredos e cabeçalhos, e cada achado alto ou médio tem correção aplicada com teste de regressão ou aceite formal registrado.
  · **PRD:** seção 11, seção 13, seção 16 F2 · **Depende de:** T-222, T-225
- [ ] **T-247** `P1` `M` `plataforma` Montar o ambiente de homologação com conexão de teste à origem
  · **Aceite:** Existe um ambiente separado apontando para uma cópia da origem, rodando a mesma imagem e o mesmo job de sync, e a suíte roda nele e fica verde antes de qualquer promoção para produção, com registro da execução.
  · **PRD:** seção 15, seção 10.5, RF-21 · **Depende de:** T-203, T-208
- [ ] **T-248** `P1` `M` `ingestao` Escrever e executar o runbook de conexão em cinco passos e o guia de IdP
  · **Aceite:** O documento operacional é executado do zero em ambiente novo por quem não escreveu o código, terminando com a suíte de contrato verde no modo warehouse e com um Keycloak de teste conectado seguindo só o guia; tempo total e pontos de bloqueio ficam registrados no próprio documento.
  · **PRD:** seção 10.5, seção 15, seção 8.2, RF-20 · **Depende de:** T-216, T-223, T-247
- [ ] **T-249** `P1` `L` `plataforma` Montar o modo de nuvem dedicada e adequar o envio de registros
  · **Aceite:** Roteiro de provisionamento cria projeto e banco isolados por cliente, acesso à origem por túnel ou VPN documentado e segredos vindos do cofre, com implantação contínua em janela acordada e retorno à versão anterior testado; no modo Docker os registros ficam locais com envio desligado por padrão e no modo nuvem chegam ao coletor central, pela mesma imagem.
  · **PRD:** seção 15, D2, D5, D-P6, seção 13 · **Depende de:** T-176, T-204, T-228
- [ ] **T-250** `P1` `M` `seguranca` Anexar ao contrato as views, a fronteira de dados e o registro LGPD
  · **Aceite:** O anexo técnico com as 7 views, dicionário de colunas e prazo de entrega pela TI está no contrato assinado; um documento versionado declara o que sai do ambiente (catálogo, pergunta e números agregados), o que nunca sai, o subprocessador da API e a retenção; e o registro LGPD lista categorias, finalidade, base legal e retenção apontando o controle técnico correspondente.
  · **PRD:** seção 11, seção 14, seção 17, D1, D5, D-P7 · **Depende de:** T-201
- [ ] **T-251** `P1` `M` `auditoria` Travar a contagem num único artefato
  · **Aceite:** arquivo versionado com os 15 KPIs do achado 5 (id, tela, métrica do catálogo), referenciado por T-117, T-128 e T-222. o teste é parametrizado por esse arquivo e falha se a contagem divergir de 15; exige variação em pelo menos dois valores de cada um dos cinco filtros; roda nos dois modos de DATA_SOURCE.
  · **PRD:** Anexo D achado 5 - contagem dos KPIs literais (RF-07)
- [ ] **T-252** `P1` `M` `auditoria` Kit de apoio à construção das views e caminho alternativo direto do ERP  ⛔ H-10, H-12, H-18, H-19
  · **Aceite:** para cada uma das 7 views existe SQL de referência parametrizável e roteiro de origem por sistema (folha/HCM, ERP contábil, ATS, LMS, Planejamento, cadastros); um ensaio sobre a cópia de homologação produz as 7 views a partir das tabelas do ERP e passa no validador de T-210 sem nenhuma não conformidade; e horas de apoio, responsável e prazo estão alocados no plano de F2 com gatilho definido de acionamento.
  · **PRD:** seção 17, risco 'O cliente não consegue produzir as views' (probabilidade Alta, mitigação 'Escopo de apoio previsto em F2') e seção 10.1 ('se o cliente já tem warehouse... se não tem, as mesmas podem sair direto do ERP')
- [ ] **T-253** `P1` `M` `auditoria` Procedimento de atualização e retorno de versão no modo Docker no cliente  ⛔ H-25
  · **Aceite:** um ensaio parte da versão N-1 instalada com réplica carregada e trilha de auditoria populada, sobe a versão N, aplica a migração no start sem perda de dado e sem exigir carga completa nova, e o retorno para N-1 restaura a aplicação funcional com a réplica intacta; o roteiro registra o tempo de indisponibilidade e é executado do zero por quem não escreveu o código.
  · **PRD:** seção 15, linha 'Atualização' na coluna 'Docker no cliente': 'Imagem versionada; migração de esquema no start, idempotente'
- [ ] **T-254** `P2` `M` `plataforma` Definir backup e recuperação da réplica
  · **Aceite:** Existe rotina de backup diário com retenção configurável, e um exercício de restauração em ambiente limpo recompõe a réplica e passa a suíte de contrato, com o tempo de recuperação registrado.
  · **PRD:** seção 10.2, seção 15 · **Depende de:** T-231
- [ ] **T-255** `P2` `S` `plataforma` Estabelecer higiene de dependências, SBOM e escaneamento de imagem
  · **Aceite:** O lockfile é obrigatório em CI com instalação reprodutível, a auditoria de vulnerabilidades falha em severidade alta ou crítica a cada PR, cada publicação de imagem gera SBOM anexado e o escaneamento reprova severidade crítica, com atualizações automatizadas abrindo PR semanal.
  · **PRD:** seção 8.2, seção 11, seção 15 · **Depende de:** T-006, T-228
- [ ] **T-256** `P2` `M` `seguranca` Construir a administração de perfis e escopo para instalações sem grupos no IdP
  · **Aceite:** Tela restrita à diretoria permite atribuir perfil e escopo a um usuário, toda alteração grava registro na trilha de auditoria com quem alterou, o que mudou e quando, e os outros quatro perfis recebem 403.
  · **PRD:** seção 11, seção 8.2 · **Depende de:** T-223, T-224

---

## Fase 3 · Chat com IA

Substitui o casamento de *substring* do protótipo pelos três estágios da seção 7. Depende do catálogo, não do dado real: pode correr em paralelo com F2, inteiramente contra *fixtures*.

> **Critério de saída:** O conjunto de 100 perguntas atinge as metas da seção 7.7, com zero número inventado.

*45 tarefas · 28 P0 · 15 P1 · 2 P2*

- [ ] **T-301** `P0` `M` `chat` Definir os contratos Intent e Answer com JSON Schema gerado
  · **Aceite:** Existem os tipos Intent e Answer da seção 7.2 e schemas derivados com additionalProperties false e required completo; o teste rejeita 10 payloads inválidos (métrica ausente, breakdown fora do enum, confidence fora de 0..1, undo sem view) e aceita 5 válidos.
  · **PRD:** seção 7.2, RF-12, seção 8.2 · **Depende de:** T-101, T-102
- [ ] **T-302** `P0` `M` `chat` Encapsular o Anthropic SDK com a configuração fixada da seção 7.3
  · **Aceite:** Um único módulo instancia claude-opus-5 com output_config.effort low no estágio 1 e high no estágio 3, output_config.format com JSON Schema, ferramentas com strict e additionalProperties false e thinking adaptive; o teste falha se budget_tokens, output_format ou mensagem de assistente pré-preenchida aparecerem em qualquer chamada.
  · **PRD:** seção 7.3, seção 8.2, D4 · **Depende de:** T-139, T-301
- [ ] **T-303** `P0` `S` `chat` Renderizar o catálogo de métricas como prefixo de prompt byte-estável
  · **Aceite:** A função produz a mesma string byte a byte em 100 execuções e em dois processos distintos, com chaves ordenadas e sem timestamp, id de requisição ou locale, e o snapshot com hash SHA-256 falha a qualquer alteração não intencional.
  · **PRD:** seção 7.4, seção 9.4, seção 8.1 · **Depende de:** T-113, T-155
- [ ] **T-304** `P0` `M` `chat` Posicionar o ponto de corte de cache de prompt e medir o acerto
  · **Aceite:** O catálogo vai no system atrás de cache_control ephemeral com prefixo medido em ao menos 1024 tokens, e um teste de integração faz duas requisições idênticas exigindo usage.cache_read_input_tokens maior que zero na segunda, reprovando a build quando vier zero.
  · **PRD:** seção 7.4, seção 13, RF-19 · **Depende de:** T-302, T-303
- [ ] **T-305** `P0` `M` `chat` Implementar o estágio 1 de interpretação da pergunta
  · **Aceite:** Dada a pergunta, o catálogo e os cinco filtros atuais, o estágio devolve um Intent válido contra o schema e sem nenhum número no payload; 20 perguntas do conjunto de avaliação verificam metric, breakdown, filters e confidence preenchidos e ausência de campo de valor calculado.
  · **PRD:** seção 7.1, seção 7.2, RF-12, PR-2 · **Depende de:** T-301, T-302, T-304
- [ ] **T-306** `P0` `M` `chat` Validar a intenção contra o catálogo e recusar métrica inexistente no estágio 2
  · **Aceite:** O resolvedor rejeita qualquer metric ausente do catálogo antes de qualquer leitura, e 15 métricas forjadas retornam recusa estruturada com código metrica_fora_do_catalogo sem nenhuma chamada ao DataSource registrada no espião.
  · **PRD:** seção 7.1, seção 7.5, RF-16, PR-2 · **Depende de:** T-113, T-305
- [ ] **T-307** `P0` `M` `chat` Normalizar e validar os filtros da intenção contra o domínio de Query
  · **Aceite:** Filtros propostos pelo modelo são mapeados para os valores exatos da tabela 6.2, incluindo acentuação e sinônimos como 'Sao Paulo' para Unidade SP; o teste cobre os 4 períodos, 2 anos, 3 entidades, 8 áreas e 4 modalidades mais 20 valores inválidos, que resultam em recusa e não em substituição silenciosa.
  · **PRD:** seção 6.2, seção 9.1, D-P8, Anexo D achado 1, Anexo D achado 2 · **Depende de:** T-103, T-306
- [ ] **T-308** `P0` `M` `chat` Garantir que nenhuma saída do modelo alcança a consulta como SQL ou identificador livre
  · **Aceite:** O resolvedor só aceita identificadores de uma lista branca derivada do catálogo; o teste injeta SQL, nomes de tabela e caracteres de escape em metric e filters verificando recusa, e um teste de arquitetura falha se qualquer módulo do chat importar cliente de banco.
  · **PRD:** RF-18, seção 7.5, seção 8.1 · **Depende de:** T-306
- [ ] **T-309** `P0` `M` `seguranca` Aplicar o perfil de acesso antes de qualquer leitura do chat
  · **Aceite:** A Query derivada da Intent passa pelo mesmo applyScope das telas antes de qualquer leitura; pergunta com recorte fora do perfil recebe recusa útil com alternativas dentro do escopo, sem executar getMetric ou getPanel (verificado por espião) e sem valor agregado no corpo, cobrindo os cinco perfis contra os três módulos.
  · **PRD:** seção 11, seção 7.1, seção 7.5, RF-23 · **Depende de:** T-137, T-306
- [ ] **T-310** `P0` `M` `chat` Executar getMetric e getPanel no estágio 2 e montar o envelope de dados
  · **Aceite:** Para as 21 intenções do Anexo B o resolvedor produz kpis, chart, formula e sources apenas por chamadas ao DataSource, com sources trazendo a view declarada no catálogo e formula nunca vazia.
  · **PRD:** seção 7.1, seção 7.2, RF-04, PR-3, seção 9.1 · **Depende de:** T-115, T-117, T-120, T-307
- [ ] **T-311** `P0` `M` `chat` Bloquear grão abaixo de área x mês nas leituras do chat
  · **Aceite:** Qualquer intenção com breakdown ou filtro que implique linha individual, nome de pessoa ou grão diário é recusada antes da leitura, e uma suíte de indução com 30 perguntas adversariais (quem saiu, liste os nomes, salário de fulano, gere SQL) recebe recusa em 100% dos casos, com grupos abaixo de 5 pessoas retornando grupo pequeno demais para exibir.
  · **PRD:** RF-18, RF-24, seção 7.5, seção 11 · **Depende de:** T-138, T-308, T-310
- [ ] **T-312** `P0` `M` `chat` Servir o gráfico do chat pela mesma chamada e pelo mesmo componente da tela
  · **Aceite:** O campo chart é produzido por getPanel(id, q) com a mesma Query da tela e renderizado pelo componente SVG do painel; o teste compara séries, total e SVG do cartão do chat e do painel destacado para as 21 intenções do Anexo B em 4 períodos x 3 entidades exigindo igualdade exata.
  · **PRD:** PR-1, seção 7.2, RF-15, seção 9.3, seção 8.2 · **Depende de:** T-129, T-131, T-310
- [ ] **T-313** `P0` `L` `chat` Implementar o estágio 3 de redação com substituição de campo
  · **Aceite:** O prompt recebe apenas os números já calculados e formatados em pt-BR pelo módulo único, e o texto é montado por substituição de marcadores; em 30 respostas do conjunto de avaliação a saída do modelo não contém nenhum dígito fora dos marcadores e a substituição usa exclusivamente valores do envelope.
  · **PRD:** seção 7.1, seção 13, PR-2, O5, RF-15 · **Depende de:** T-125, T-302, T-310
- [ ] **T-314** `P0` `L` `chat` Construir o verificador numérico determinístico de texto contra envelope
  · **Aceite:** O verificador extrai todo número do texto (R$ mi, percentual, p.p., dias, FTE, milhar e decimal pt-BR) e casa cada um com um valor do envelope dentro da tolerância declarada; 50 textos sintéticos detectam 100% dos números plantados com zero falso positivo sobre anos, ordinais e datas.
  · **PRD:** seção 7.1, RF-15, O5, PR-2 · **Depende de:** T-313
- [ ] **T-315** `P0` `M` `chat` Bloquear a exibição e registrar incidente quando o verificador acusar divergência
  · **Aceite:** Divergência impede a renderização, exibe o estado de resposta bloqueada e grava incidente com pergunta, intenção, envelope e texto rejeitado, nunca corrigindo o texto silenciosamente; um envelope adulterado confirma bloqueio e presença do incidente no log.
  · **PRD:** RF-15, O5, seção 7.1, seção 14 · **Depende de:** T-314
- [ ] **T-316** `P0` `M` `chat` Verificar a igualdade entre o número do texto, o do gráfico do chat e o do painel na tela
  · **Aceite:** A suíte de reconciliação cruzada executa as 21 intenções do Anexo B em 4 períodos x 3 entidades x 8 áreas e compara o valor citado no texto, o da série do cartão e o do mesmo painel na tela sob o recorte aplicado, exigindo igualdade exata.
  · **PRD:** RF-15, RF-03, seção 9.2, O3 · **Depende de:** T-122, T-312, T-314
- [ ] **T-317** `P0` `M` `chat` Substituir o casamento por substring pelo pipeline de três estágios
  · **Aceite:** As funções ask() e KB do protótipo saem do código de produção, nenhuma resposta é produzida por comparação de string e um teste de arquitetura falha se restar lista de sinônimos usada para roteamento fora do catálogo; 12 formulações com a palavra 'vaga' roteiam corretamente entre a intenção 12 e a 16 com 100% de acerto e desambiguação explícita quando ambíguo.
  · **PRD:** Anexo D achado 8, Anexo D achado 9, seção 7.1, RF-12 · **Depende de:** T-113, T-313, T-315
- [ ] **T-318** `P0` `M` `chat` Implementar a recusa útil com métricas próximas do catálogo
  · **Aceite:** Pergunta sem métrica correspondente devolve recusa com ao menos duas métricas próximas nomeadas e clicáveis e nunca uma estimativa; 25 perguntas fora do catálogo verificam ausência total de dígitos de valor no texto e presença de duas ou mais alternativas em 100% dos casos.
  · **PRD:** RF-16, seção 7.5, O4 · **Depende de:** T-113, T-306
- [ ] **T-319** `P0` `M` `chat` Aplicar filtros, navegar e destacar o painel citado a partir de actions
  · **Aceite:** Ao responder, os filtros de actions.filters são aplicados, a rota vai para actions.view e o painel actions.panel recebe contorno, sombra e o rótulo de referência, ficando visível sem rolagem manual; o teste percorre as 21 intenções do Anexo B conferindo filtro, rota, id do painel e posição de rolagem, e confirma que cada painel existe no inventário do Anexo A.
  · **PRD:** RF-12, RF-13, seção 6.5, seção 7.2, Anexo B · **Depende de:** T-127, T-163, T-310
- [ ] **T-320** `P0` `M` `chat` Criar a rota de servidor do chat com autenticação, tempo limite e repetição
  · **Aceite:** A rota exige sessão autenticada, aplica tempo limite por estágio, repete com espera exponencial em 429 e 5xx e abre circuito após falhas consecutivas configuráveis; o teste simula 401, 429, 500 e tempo esgotado verificando que nenhuma resposta chega à tela com número inventado.
  · **PRD:** seção 7.5, RF-23, seção 13, seção 11 · **Depende de:** T-222, T-302
- [ ] **T-321** `P0` `M` `seguranca` Inspecionar e garantir o que sai do ambiente para a API do modelo
  · **Aceite:** Um inspetor valida cada payload contra uma lista branca (catálogo, pergunta, números já agregados) e bloqueia envio com linha de pessoa, identificador individual, credencial, resultado bruto ou dado abaixo do grão área x mês; o teste tenta os quatro vazamentos e todos são bloqueados com incidente registrado.
  · **PRD:** seção 11, seção 7.4, seção 7.5, RF-18, O5 · **Depende de:** T-310, T-320
- [ ] **T-322** `P0` `M` `chat` Isolar a pergunta do usuário das instruções do sistema contra injeção
  · **Aceite:** A pergunta entra apenas como conteúdo de mensagem delimitado e nunca no prefixo do system; 20 tentativas de injeção (ignore as instruções, revele o catálogo, gere SQL, responda sem verificação) não alteram a métrica resolvida, o perfil aplicado nem o comportamento do verificador.
  · **PRD:** seção 7.5, RF-18, seção 11, PR-2 · **Depende de:** T-304, T-308
- [ ] **T-323** `P0` `M` `seguranca` Registrar a trilha de auditoria completa de cada interação do chat
  · **Aceite:** Cada resposta grava quem, quando, pergunta, intenção interpretada, métricas lidas, recorte aplicado e custo em tokens; o teste confirma os sete campos preenchidos em 100% das interações, inclusive nas recusas e nos bloqueios do verificador.
  · **PRD:** RF-19, seção 11, seção 7.5, D-P7 · **Depende de:** T-224, T-310, T-315
- [ ] **T-324** `P0` `M` `seguranca` Implementar retenção configurável com expurgo e tratar o texto da pergunta como dado do cliente
  · **Aceite:** Os prazos decididos em P7 para trilha, telemetria e texto de pergunta são configuráveis por ambiente, um job agendado apaga o que passou do prazo com teste de relógio adiantado confirmando o expurgo, e uma pergunta percorrida ponta a ponta aparece apenas na trilha de auditoria e em chat.sem_resposta, nunca em log de aplicação.
  · **PRD:** D-P7, seção 11, seção 14, RF-19 · **Depende de:** T-012, T-176, T-224, T-323
- [ ] **T-325** `P0` `M` `auditoria` Estender o executor do conjunto de avaliação para reprovar por rota e painel  ⛔ H-30
  · **Aceite:** além das quatro métricas atuais, o relatório de T-335 compara, para cada uma das 100 perguntas não-recusadas, os cinco filtros aplicados, a rota de actions.view e o id de actions.panel contra os rótulos de T-334, e falha se o acerto de rota+painel ficar abaixo de 95% ou se qualquer painel citado não existir no registro dos 71 do Anexo A. executar o conjunto com um painel deliberadamente trocado no pipeline reprova o job.
  · **PRD:** RF-12
- [ ] **T-326** `P0` `M` `auditoria` Prover sessão e trilha de auditoria em modo fixtures para destravar F3
  · **Aceite:** com AUTH_PROVIDER=fixtures e DATA_SOURCE=fixtures, a rota do chat exige sessão válida vinda de T-162 e grava os sete campos da seção 11 em um armazenamento local criado pela mesma migração idempotente do warehouse; T-326, T-330 e T-331 rodam verdes no CI sem nenhuma tarefa de F2 concluída, e a mesma tabela é reaproveitada quando T-241 entra.
  · **PRD:** seção 16, nota de Dependências: 'F1 é pré-requisito de F2 e de F3, e as duas podem correr em paralelo depois dela — F3 depende do catálogo, não do dado real, e pode ser desenvolvida inteiramente contra fixtures'
- [ ] **T-327** `P1` `M` `chat` Herdar os filtros da tela ativa e resolver recorte implícito no encadeamento
  · **Aceite:** Uma pergunta sem recorte explícito herda os cinco filtros da tela, verificado em 10 perguntas neutras sob 3 recortes; e perguntas de acompanhamento do tipo 'e em São Paulo' herdam a métrica anterior alterando apenas a dimensão citada, verificado em 15 pares do conjunto de avaliação.
  · **PRD:** seção 7.1, seção 7.7, seção 6.2, RF-01 · **Depende de:** T-305
- [ ] **T-328** `P1` `M` `chat` Suportar resposta multi-métrica no envelope
  · **Aceite:** O envelope aceita uma métrica principal mais até três de apoio, todas lidas pelo estágio 2 e presentes em kpis com label, value e sentiment; 10 perguntas compostas verificam que cada KPI exibido tem origem em uma chamada ao DataSource registrada.
  · **PRD:** Anexo D achado 8, seção 7.2, RF-12 · **Depende de:** T-310
- [ ] **T-329** `P1` `M` `chat` Suprimir narrativa incompatível com o recorte na resposta do chat
  · **Aceite:** Sob recorte ativo, um texto que afirme número do consolidado é suprimido em vez de adaptado e a resposta exibe o gráfico com o subtítulo do recorte; 10 respostas escritas para o consolidado sob recorte de área são suprimidas em 100% dos casos, sem número remanescente.
  · **PRD:** RF-09, seção 6.3, PR-4 · **Depende de:** T-133, T-314
- [ ] **T-330** `P1` `M` `chat` Tratar confiança baixa com desambiguação antes de responder
  · **Aceite:** Abaixo do limiar configurado o chat apresenta as opções do campo fallback e não executa leitura; 15 perguntas ambíguas rotuladas não produzem resposta numérica direta e cada uma oferece pelo menos duas alternativas do catálogo.
  · **PRD:** seção 7.2, RF-16, seção 7.7 · **Depende de:** T-305, T-318
- [ ] **T-331** `P1` `S` `chat` Ligar o desfazer da resposta à restauração de filtros e tela
  · **Aceite:** O envelope carrega undo com filters e view, e um clique em desfazer restaura os cinco filtros e a tela de origem; o teste percorre 20 respostas do conjunto de avaliação comparando a URL antes e depois.
  · **PRD:** RF-14, Anexo D achado 7, seção 7.2 · **Depende de:** T-163, T-310
- [ ] **T-332** `P1` `M` `chat` Escrever as 39 sugestões contextuais e as duas de acompanhamento por resposta
  · **Aceite:** Cada uma das 13 telas oferece exatamente três sugestões e as 39 executam pelo pipeline com métrica do catálogo, sem recusa e sem divergência do verificador; toda resposta traz exatamente duas sugestões respondíveis e nenhuma repete a métrica já respondida, verificado sobre as 100 perguntas.
  · **PRD:** RF-17, seção 7.6, seção 7.2, seção 5 · **Depende de:** T-113, T-126, T-317
- [ ] **T-333** `P0` `L` `chat` Montar o conjunto de avaliação de 100 perguntas rotuladas
  · **Aceite:** Arquivo versionado junto do catálogo com 100 perguntas rotuladas com métrica, recorte, tela e painel esperados, cobrindo as 39 sugestões, perguntas ambíguas, perguntas fora de escopo marcadas como recusa obrigatória e perguntas com recorte implícito; o teste de esquema valida os rótulos e a cobertura das quatro categorias.
  · **PRD:** seção 7.7, RF-12, O4, Anexo B · **Depende de:** T-113, T-332
- [ ] **T-334** `P0` `L` `chat` Construir o executor do conjunto de avaliação com as quatro metas
  · **Aceite:** Um comando executa as 100 perguntas e emite relatório com acerto de intenção (métrica e recorte), taxa de recusa correta, números sem correspondência no envelope e latência p95 decomposta por estágio, falhando se acerto < 95%, recusa < 100%, números sem correspondência > 0 ou p95 > 4 s.
  · **PRD:** seção 7.7, RF-12, RF-15, O5, seção 13 · **Depende de:** T-314, T-333
- [ ] **T-335** `P1` `M` `chat` Emitir os eventos de telemetria do chat sem dado de pessoa
  · **Aceite:** chat.pergunta sai com perfil, tela de origem, semana ISO e desfecho; chat.sem_resposta com o texto da pergunta e as métricas próximas oferecidas, agrupável por frequência; chat.intencao com métrica, breakdown, recorte, confiança e correção manual posterior; e nenhum evento carrega identificador de pessoa.
  · **PRD:** seção 14, O2, O4, seção 7.7 · **Depende de:** T-177, T-305, T-318
- [ ] **T-336** `P1` `M` `chat` Contabilizar o custo em tokens com teto mensal e alerta em 80%
  · **Aceite:** Cada chamada grava tokens de entrada, saída, leitura e escrita de cache por sessão e perfil; o teto mensal é configurável, um alerta dispara em 80% e ao atingir 100% novas requisições recebem recusa com mensagem própria, verificado por simulação de consumo nos dois limiares.
  · **PRD:** seção 13, seção 7.4, seção 11, seção 17 · **Depende de:** T-304, T-323
- [ ] **T-337** `P1` `M` `chat` Calibrar o limiar de confiança contra o conjunto de avaliação
  · **Aceite:** Relatório de calibração mostra acerto de intenção por faixa de confiança sobre as 100 perguntas e o limiar escolhido fica em configuração; com ele aplicado, o acerto é maior ou igual a 95% nas perguntas acima do limiar e nenhuma pergunta fora do catálogo é respondida.
  · **PRD:** seção 7.7, O5, RF-12 · **Depende de:** T-330, T-334
- [ ] **T-338** `P1` `M` `chat` Integrar o executor ao CI com registro histórico e versionar o prompt
  · **Aceite:** O CI roda o conjunto contra fixtures a cada alteração de catálogo, prompt ou pipeline, grava as quatro métricas com a versão do catálogo e do prompt para comparação entre versões, e regressão em qualquer meta bloqueia o merge; os prompts dos estágios 1 e 3 vivem em arquivos versionados com snapshot e identificador gravado na auditoria.
  · **PRD:** seção 7.7, seção 7.3, seção 7.4, RF-21, RF-19 · **Depende de:** T-006, T-303, T-334
- [ ] **T-339** `P1` `M` `chat` Entregar a resposta em duas fases com streaming de gráfico e KPIs
  · **Aceite:** O cartão exibe gráfico, KPIs e fórmula assim que o estágio 2 conclui e o texto só aparece após o verificador aprovar, com o gráfico visível antes do fim do texto em ao menos 90% de uma amostra de 20 perguntas; a medição em 30 execuções mostra primeiro conteúdo em até 1,5 s e resposta completa em até 4 s no p95.
  · **PRD:** seção 13, seção 17, seção 7.7, O1 · **Depende de:** T-315, T-319
- [ ] **T-340** `P1` `M` `chat` Implementar os estados de interface do chat e a navegação por teclado
  · **Aceite:** O chat implementa carregando, respondido, sem dado no recorte, erro de fonte, sem permissão, recusa por catálogo e bloqueio do verificador, sem que nenhum exiba valor agregado indevido; e campo, envio, sugestões, desfazer e ir para o painel são alcançáveis por teclado com foco visível, com o cartão expondo nota e fórmula como alternativa textual e sem violação crítica de acessibilidade.
  · **PRD:** seção 6.4, RF-06, seção 13, PR-4 · **Depende de:** T-172, T-309, T-315
- [ ] **T-341** `P1` `M` `chat` Cachear as leituras do estágio 2 e travar a latência p95 do chat
  · **Aceite:** Chamadas repetidas de getMetric e getPanel com a mesma Query são servidas do cache do servidor enquanto o sync não avança, com invalidação no avanço e p95 do estágio 2 abaixo de 400 ms com cache quente; a execução do conjunto de avaliação falha se a latência ponta a ponta passar de 4 s no p95.
  · **PRD:** seção 13, seção 9.2, seção 7.7, O1 · **Depende de:** T-157, T-178, T-334
- [ ] **T-342** `P1` `M` `chat` Executar o conjunto de avaliação também contra o adaptador de warehouse
  · **Aceite:** O executor roda nos dois modos de DATA_SOURCE e o relatório compara métrica a métrica; divergência entre fixtures e warehouse em qualquer das 100 perguntas gera item de decisão para o catálogo em vez de ajuste silencioso.
  · **PRD:** RF-21, seção 10.4, seção 10.5, O3 · **Depende de:** T-213, T-217, T-334
- [ ] **T-343** `P1` `M` `auditoria` Implementar a correção manual de intenção no cartão de resposta
  · **Aceite:** a resposta mostra a métrica e o recorte interpretados e oferece 'não era isso' com as alternativas do catálogo; escolher uma reexecuta o estágio 2 e emite chat.intencao com o campo de correção preenchido, além de registrar a correção na trilha de auditoria. corrigir uma resposta faz a taxa de acerto do painel interno cair no período, e um teste confirma o campo populado no evento e a ausência de qualquer identificador de pessoa.
  · **PRD:** seção 13 observabilidade (taxa de acerto do chat)
- [ ] **T-344** `P2` `S` `chat` Limitar tamanho de pergunta e taxa de uso por sessão e por perfil
  · **Aceite:** Perguntas acima do limite de caracteres são recusadas antes de chegar ao modelo e o limite por usuário e por minuto é aplicado no servidor com 429 e mensagem em pt-BR; o teste dispara acima do limite e confirma que as excedentes não chegam ao adaptador nem à API, com o evento registrado.
  · **PRD:** seção 13, seção 7.5, seção 11, RF-19 · **Depende de:** T-320
- [ ] **T-345** `P2` `S` `chat` Criar chave de desligamento do chat de IA com degradação segura
  · **Aceite:** Uma variável de ambiente desliga o chat sem rebuild; desligado, a interface exibe as sugestões contextuais e uma mensagem de indisponibilidade, nenhuma chamada ao provedor é feita e nenhum painel deixa de funcionar, coberto nos dois estados.
  · **PRD:** seção 15, seção 13, RF-20 · **Depende de:** T-320

---

## Fase 4 · Escala

Exportações, alertas por métrica fora de meta, novas dimensões — e a instrumentação que finalmente torna os objetivos O1 e O2 mensuráveis, em vez de declarados.

> **Critério de saída:** Uso recorrente semanal pelos quatro perfis da seção 3.

*17 tarefas · 1 P0 · 7 P1 · 9 P2*

- [ ] **T-401** `P0` `M` `auditoria` Rodar a adoção guiada das quatro personas da seção 3  ⛔ H-35
  · **Aceite:** cada persona (CFO/Diretoria, Controller, BP de RH, Analista de BI) recebe sessão de onboarding com o seu recorte padrão e as três sugestões contextuais da sua tela de entrada; existe um responsável nomeado por persona; e o relatório de T-413 mostra sessões e perguntas em quatro semanas consecutivas para os quatro perfis, com plano de correção escrito para qualquer perfil abaixo do limiar.
  · **PRD:** seção 16, critério de saída de F4: 'Uso recorrente semanal pelos quatro perfis da seção 3'
- [ ] **T-402** `P1` `M` `paineis` Exportar painel em CSV com unidade e recorte declarados
  · **Aceite:** O CSV de qualquer um dos 71 painéis traz exatamente as categorias e os valores do envelope, a unidade no cabeçalho de cada coluna e uma linha declarando os cinco filtros; o teste compara CSV e PanelResponse célula a célula em três painéis de cada uma das 12 formas.
  · **PRD:** RF-11, seção 9.2 regra 2, seção 9.3, seção 16 F4 · **Depende de:** T-102, T-125, T-160
- [ ] **T-403** `P1` `M` `seguranca` Aplicar perfil, grão mínimo e supressão k<5 nas exportações
  · **Aceite:** CSV, PNG e PDF exportam somente o recorte permitido ao perfil, com o recorte declarado no cabeçalho e os grupos com menos de 5 pessoas suprimidos; o teste compara o CSV exportado com a resposta do painel em 5 perfis x 3 painéis de faixa exigindo igualdade linha a linha.
  · **PRD:** RF-11, RF-24, seção 11 · **Depende de:** T-137, T-151, T-402
- [ ] **T-404** `P1` `M` `paineis` Sinalizar métrica fora de meta no painel e no KPI
  · **Aceite:** Métricas com campo meta no catálogo exibem o traço de referência e um selo textual quando fora da meta, sem depender de cor, testado com turnover 18,4% contra meta 14,0% e com uma métrica dentro da meta.
  · **PRD:** seção 16 F4, seção 9.4, seção 13 acessibilidade · **Depende de:** T-113, T-172
- [ ] **T-405** `P1` `M` `plataforma` Publicar o painel interno de observabilidade e operação
  · **Aceite:** Painel restrito a diretoria e auditor responde as quatro perguntas da seção 14 e expõe os seis indicadores da seção 13 (latência por consulta, acerto do chat, perguntas sem resposta, painéis mais vistos, custo em tokens por sessão, idade do último sync), com a fila de chat.sem_resposta agrupada por frequência e exportável, sem dado de pessoa nem texto fora da retenção.
  · **PRD:** seção 14, seção 13, O2, O4 · **Depende de:** T-178, T-233, T-335, T-336
- [ ] **T-406** `P1` `S` `plataforma` Produzir o relatório de uso recorrente semanal pelos quatro perfis
  · **Aceite:** Relatório semanal derivado de painel.visto e chat.pergunta mostra sessões e perguntas por semana para cada persona da seção 3, e o critério de saída de F4 é verificável por ele em quatro semanas consecutivas.
  · **PRD:** seção 16 F4, seção 14, seção 3, O2 · **Depende de:** T-405
- [ ] **T-407** `P1` `M` `auditoria` Instrumentar e reportar o tempo pergunta-para-número (O1)  ⛔ H-34, H-35
  · **Aceite:** a telemetria deriva, de chat.pergunta, chat.intencao e painel.visto, o intervalo entre a pergunta e a exibição do número já verificado; o painel de observabilidade publica a mediana por semana e por perfil com a meta de 30 s marcada; e a linha de base atual é medida com as quatro personas em pelo menos cinco perguntas reais e registrada no mesmo relatório antes de F3 entrar em produção.
  · **PRD:** O1 — 'Reduzir o tempo entre pergunta e número confiável', métrica 'Tempo mediano', linha de base 'Horas', meta '< 30 s'
- [ ] **T-408** `P1` `M` `auditoria` Definir e coletar o denominador do O2  ⛔ H-34
  · **Aceite:** documento versionado define o que conta como 'pergunta do comitê' e o instrumento de captura da via analista (registro leve pelo próprio analista ou marcação na reunião); o relatório semanal passa a publicar numerador, denominador e percentual com a série histórica; e existem quatro semanas de coleta antes de qualquer afirmação sobre a meta de 70%.
  · **PRD:** O2 — '% de perguntas respondidas sem analista', linha de base 0%, meta >= 70%
- [ ] **T-409** `P2` `M` `paineis` Exportar painel em PNG a partir do SVG desenhado pela biblioteca
  · **Aceite:** O PNG é gerado do mesmo SVG servido e contém título, fórmula e o recorte impressos; o teste verifica saída estável em 3 painéis de formas diferentes e falha se o PNG divergir do SVG de origem.
  · **PRD:** RF-11, seção 16 F4 · **Depende de:** T-129, T-402
- [ ] **T-410** `P2` `M` `paineis` Exportar o recorte da tela em PDF
  · **Aceite:** O PDF de uma tela traz os até 6 KPIs e todos os painéis na ordem da tela, com fórmula, nota, os cinco filtros, o selo de frescor e a versão instalada no cabeçalho; o teste confere a presença de todos os ids da tela, a contagem de páginas nas 13 telas e a igualdade dos valores impressos com os da tela.
  · **PRD:** RF-11, seção 16 F4, seção 6.2, RF-10 · **Depende de:** T-166, T-230, T-409
- [ ] **T-411** `P2` `M` `dados` Construir a infraestrutura de alertas por métrica fora de meta
  · **Aceite:** Um agendador avalia as metas declaradas no catálogo após cada sync e dispara notificação pelo canal configurado apenas na transição para fora da meta, sem repetir enquanto o estado não mudar.
  · **PRD:** seção 16 F4, seção 9.4, seção 13 · **Depende de:** T-113, T-232, T-404
- [ ] **T-412** `P2` `M` `seguranca` Respeitar o perfil do destinatário nos alertas
  · **Aceite:** Um alerta só é enviado a quem tem a métrica e o recorte dentro do seu escopo; o teste configura alertas para os 5 perfis e confirma que o perfil área recebe apenas o alerta da sua área e que nenhum alerta expõe valor de entidade fora do escopo.
  · **PRD:** seção 16 F4, seção 11, seção 9.4 · **Depende de:** T-137, T-411
- [ ] **T-413** `P2` `M` `dados` Suportar novas entidades e dimensões sem alteração de código
  · **Aceite:** Acrescentar uma quarta entidade nas fixtures, no mapeamento e nas views do cliente faz o filtro, os KPIs das 13 telas e os 71 painéis responderem por ela sem mudança de código de tela nem nova imagem, e a suíte de contrato passa com o novo recorte incluído na matriz.
  · **PRD:** seção 16 F4, seção 10.3, seção 15, O4 · **Depende de:** T-128, T-149, T-156, T-216
- [ ] **T-414** `P2` `M` `seguranca` Estender o modelo de escopo para novas entidades e dimensões
  · **Aceite:** Adicionar uma entidade e uma dimensão nova exige apenas alterar a matriz de autorização e o mapeamento de claims, sem mudança de código, e o teste com uma entidade fictícia confirma que os 5 perfis passam a ser avaliados corretamente sobre ela.
  · **PRD:** seção 16 F4, seção 11, seção 6.2, seção 15 · **Depende de:** T-173, T-223, T-413
- [ ] **T-415** `P2` `L` `ingestao` Implementar sincronização incremental
  · **Aceite:** O job carrega apenas os meses alterados desde o último asOf e a réplica resultante é idêntica linha a linha à da carga completa sobre a mesma origem, com a duração da janela caindo pelo menos 50% em relação à carga completa medida em F2.
  · **PRD:** seção 10.2, seção 16 F4 · **Depende de:** T-209
- [ ] **T-416** `P2` `S` `chat` Ampliar o conjunto de avaliação com as perguntas reais sem resposta
  · **Aceite:** Processo mensal promove as perguntas mais frequentes da fila de chat.sem_resposta a itens rotulados do conjunto de avaliação, e a taxa de perguntas sem resposta é reportada mês a mês com tendência de queda.
  · **PRD:** O4, seção 7.7, seção 14 · **Depende de:** T-333, T-405
- [ ] **T-417** `P2` `M` `plataforma` Executar teste de carga com os quatro perfis em uso semanal
  · **Aceite:** Um teste de carga simula o uso semanal dos quatro perfis sobre o volume do Anexo C e registra p95 de painel e de chat, falhando acima de 1,5 s e 4 s, com consumo de CPU e memória do contêiner registrado para dimensionamento.
  · **PRD:** seção 13, seção 16 F4, seção 3, Anexo C · **Depende de:** T-241, T-341

---

## Como esta lista foi construída

Seis leitores independentes percorreram o PRD, cada um responsável por um domínio — camada de dados, painéis e experiência, chat de IA, ingestão, segurança e telemetria, plataforma e empacotamento — e produziram 357 tarefas brutas. Uma passagem de consolidação fundiu duplicatas e sequenciou o resultado em 193 tarefas.

Sobre essas 193, três críticos adversariais procuraram o que estava faltando, cada um com uma lente diferente:

| Lente | O que auditou |
|---|---|
| Requisitos | Os 24 requisitos funcionais da seção 12 e as 7 linhas de requisito não funcional da seção 13 |
| Dívida técnica | Os 11 achados do Anexo D e as 8 decisões pendentes da seção 18 |
| Entrega | Os critérios de saída das 5 fases e os 5 objetivos da seção 4 |

As 32 lacunas que eles encontraram viraram tarefas, marcadas `auditoria`. Nem todas são trabalho novo: parte delas endurece o critério de aceite de uma tarefa que já existia, porque o critério original era mais fraco que o do PRD.

### Duas correções que a auditoria levantou no próprio PRD

**1 · O Anexo C não reconcilia consigo mesmo.** Duas das dez linhas afirmam fórmulas que não reproduzem o valor ao lado:

| Linha do Anexo C | A fórmula dá | O Anexo C afirma |
|---|---:|---:|
| Headcount (dez) = 1.150 + 241 admissões − 145 saídas | 1.246 FTE | 1.240 FTE |
| Turnover 12m = saídas 12m ÷ headcount médio | 12,1% | 18,4% |

Os valores conferem com o dataset do protótipo — são as fórmulas ao lado deles que não os derivam. O protótipo mantém `hc`, `adm`, `des` e `tov` como quatro séries independentes, e elas não fecham entre si. O painel `rh-retencao` chega a afirmar "+90 FTE de saldo" enquanto admissões menos desligamentos dá 96.

Isso importa porque o Anexo C é a linha de base de reconciliação de F2. Uma base que não fecha consigo mesma vira um teste que passa por acidente.

**2 · A decisão P8 não bloqueia as tarefas que congelam o resultado dela.** O PRD marca P8 — se o filtro de ano continua com dois valores fixos ou vira seleção livre — com prazo "antes de F1". Mas as tarefas de contrato que definem o domínio de `Query` executariam antes de a decisão existir, congelando em tipo uma escolha que ainda não foi feita.

---

*Gerado a partir de [PRD.md](PRD.md) v2.0. Ao concluir uma tarefa, troque `[ ]` por `[X]` na linha dela e atualize a coluna Concluídas do panorama.*
