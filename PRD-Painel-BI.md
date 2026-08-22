# PRD — Painel BI de Controladoria com chat de IA

| | |
|---|---|
| **Versão** | 1.0 — proposta para aprovação |
| **Data** | 21 de agosto de 2026 |
| **Protótipos** | `Dashboard BI` (v1, editorial) e `Dashboard BI v2` (visual moderno) — ambos funcionais, com chat e filtros |
| **Decisão pedida** | Aprovar o contrato de dados (seções 5 e 6) antes do início da implementação |

Um painel executivo de RH e Financeiro que responde por escrito — e que aplica o filtro e abre o gráfico exato de cada resposta. A demonstração roda sobre dados fictícios; o produto troca a fonte de dados sem tocar na interface.

---

## 1 · Resumo

Controladoria e RH hoje respondem perguntas de diretoria montando planilhas sob demanda. A pergunta chega em linguagem natural ("a folha está crescendo mais que a receita?") e a resposta leva horas, sai sem fórmula declarada e não sobrevive à próxima reunião.

Este produto entrega um painel único com três módulos — Recursos Humanos, Financeiro e Integração RH × Financeiro — e um chat que, além de responder com o número, **aplica os filtros correspondentes e destaca o gráfico exato que sustenta a resposta**. Cada resposta carrega a fórmula usada, então o número é auditável na hora.

A demonstração usa um conjunto de dados fictício, internamente reconciliado. O requisito de arquitetura mais importante deste documento é que **a troca desses dados por um banco real seja uma mudança de configuração, não de produto**: uma única camada de acesso a dados serve painéis e chat, e é a única peça que muda.

---

## 2 · Problema, objetivo e público

O problema não é falta de dados — é o custo de cada pergunta. Os dados existem em ERP, folha e planilhas de orçamento, mas cada cruzamento exige um analista. O objetivo é reduzir o tempo entre a pergunta e o número confiável de horas para segundos, sem abrir mão da rastreabilidade.

| Público | Pergunta típica | O que o painel entrega |
|---|---|---|
| CFO / Diretoria | "Crescemos 12% e o lucro ficou negativo. Onde está o dinheiro?" | Resposta com fórmula e o gráfico da cascata de margens |
| Controller | "Quais centros de custo estouraram o orçamento?" | Desvio por centro, já filtrado no recorte da pergunta |
| Business partner de RH | "Qual área tem o pior turnover e quanto isso custa?" | Turnover por área e custo de reposição em reais |
| Analista de BI | "De onde vem esse número?" | Fórmula declarada em cada painel e em cada resposta |

---

## 3 · Escopo

### Na demonstração (já construído)

- **Módulo RH** — 7 telas: visão geral, colaboradores, turnover, recrutamento, treinamento, engajamento e salários.
- **Módulo Financeiro** — 5 telas: visão financeira, fluxo de caixa, orçamentário, contas a pagar/receber e faturamento.
- **Módulo Integração** — cruzamentos RH × Financeiro: receita e EBITDA por FTE, folha sobre receita, custo do turnover.
- **Cinco filtros globais** — período, ano, entidade, área e modalidade, com banner de recorte ativo e retorno ao consolidado.
- **Chat de dados** — responde com texto, KPIs, gráfico e fórmula; aplica filtros, navega até a tela e destaca o painel citado; oferece desfazer.

### No produto (esta fase)

- Camada de dados com adaptadores plugáveis (fixtures, SQL/warehouse, API REST).
- Autenticação, perfis de acesso e recorte de dados por entidade/área.
- Chat sobre modelo de linguagem com uso de ferramentas restritas ao catálogo de métricas.
- Exportação de qualquer painel (PNG e CSV) e do recorte inteiro (PDF).

### Fora de escopo

Escrita de volta nos sistemas de origem; construtor de gráficos livre pelo usuário final; SQL aberto pelo chat; previsões e cenários; app móvel nativo; ETL — o produto lê de um modelo já consolidado.

---

## 4 · Princípio de arquitetura

> Nenhum componente de interface lê dado diretamente. Painéis, KPIs e chat consomem **a mesma** camada de dados, com **a mesma** assinatura de consulta. Trocar dado fictício por banco real é substituir um adaptador.

Isso resolve dois problemas de uma vez. Primeiro, a demonstração e a produção não divergem: se o painel funciona com fixtures, funciona com o banco. Segundo, o chat nunca inventa número — ele lê pelo mesmo caminho que o painel, então o valor citado no texto e o valor desenhado no gráfico são obrigatoriamente iguais.

| Camada | Responsabilidade | Muda ao conectar banco? |
|---|---|---|
| **Apresentação** | Telas, painéis, filtros, chat. Recebe números já calculados e formatados. | Não |
| **Semântica** | Catálogo de métricas: nome, fórmula, unidade, grão, sinal de "bom/ruim", sinônimos para o chat. | Só o mapeamento |
| **Acesso** | Adaptador: recebe uma consulta, devolve séries e agregados. Fixtures, SQL ou API. | Sim — só ela |

---

## 5 · Contrato de dados

Toda leitura passa por quatro funções. A consulta é sempre o mesmo objeto — os cinco filtros da tela, mais o recorte pedido. Nenhuma outra forma de acesso é permitida.

```ts
type Query = {
  periodo:    "12 meses" | "6 meses" | "3 meses" | "mês atual";
  ano:        "2026" | "2025";
  entidade:   "Consolidado" | "Matriz" | "Filial SP" | string;
  area:       "Todas" | "Comercial" | "Operações" | string;
  modalidade: "Todas" | "Presencial" | "Híbrido" | "Remoto";
};

interface DataSource {
  getMeta():                      Promise<Meta>;          // dimensões + catálogo de métricas
  getKpis(view: string, q: Query): Promise<Kpi[]>;         // KPIs da tela (valor, delta, sparkline)
  getPanel(id: string, q: Query):  Promise<PanelResponse>; // séries, categorias, linhas, nota
  getMetric(id: string, q: Query): Promise<MetricValue>;   // um número + fórmula + série (chat)
}
```

### Regras de contrato (todas verificáveis em teste automatizado)

1. **Reconciliação.** Para a mesma `Query`, o KPI e o painel que o detalha somam o mesmo total. Um painel que quebra por área sob recorte de uma área mostra só aquela área — nunca a lista inteira com o total de outro recorte.
2. **Unidade declarada.** Todo valor volta com unidade (`BRL_mi`, `pct`, `pp`, `dias`, `FTE`) e a formatação pt-BR acontece só na apresentação.
3. **Vazio explícito.** Recorte sem dado devolve `null` com motivo, e a interface mostra "sem dado no recorte" — nunca zero, nunca um número herdado do recorte anterior.

### Resposta de painel (exemplo)

```json
{
  "id": "orc-desvio",
  "title": "Desvio por centro de custo",
  "unit": "BRL_mi",
  "formula": "desvio = realizado − orçado",
  "categories": ["Operações", "Comercial", "Tecnologia", "Logística", "Financeiro", "Marketing", "RH"],
  "series": [{ "name": "Desvio", "values": [26, 14, 9, 7, -3, -4, -4] }],
  "total": 56,
  "note": "Operações e Comercial respondem por 71% do estouro."
}
```

---

## 6 · Modelo de dados

O adaptador espera um modelo estrela simples, com grão mensal. Se o cliente já tem warehouse, o trabalho é escrever seis *views*; se não tem, as mesmas seis podem sair direto do ERP.

| View esperada | Chaves e medidas | Origem típica |
|---|---|---|
| `vw_fato_rh_mes` | mês, entidade, área, modalidade · headcount FTE, admissões, desligamentos, folha, absenteísmo, eNPS, engajamento | Folha / HCM |
| `vw_fato_fin_mes` | mês, entidade · receita bruta e líquida, CMV, despesas, EBITDA, resultado financeiro, lucro líquido, FCO, capex, saldo de caixa | ERP / contábil |
| `vw_fato_orcamento` | mês, entidade, centro de custo · orçado, realizado | Planejamento |
| `vw_fato_vagas` | mês, área · abertas, em andamento, fechadas, canceladas, dias para fechar, etapas do funil, fonte do candidato | ATS |
| `vw_fato_treinamento` | mês, área, trilha, modalidade · horas, investimento, participação, conclusão | LMS |
| `vw_fato_contas` | mês, entidade, faixa de aging · a receber, a pagar, PMR, PME, PMP | ERP |
| `vw_dim_*` | entidade, área, centro de custo, modalidade, UF, faixa etária, faixa de tempo de casa, escolaridade | Cadastros |

**Regras de grão:** todo fato é mensal e aditivo, exceto taxas (turnover, margens, PMR) e estoques (headcount, saldo de caixa) — que o catálogo marca como `agg: "last"` ou `agg: "ratio"`, para que o período de 3 meses nunca some percentuais.

---

## 7 · Chat de IA

O chat não gera dado, nem SQL. Ele interpreta a pergunta, escolhe uma métrica do catálogo, chama a mesma camada de dados dos painéis e monta a resposta. São três passos, com a fronteira de segurança no meio:

1. **Interpretar.** O modelo recebe a pergunta, o catálogo de métricas e os filtros atuais da tela. Devolve apenas uma intenção estruturada: métrica, recorte e nível de detalhe. Na demonstração isso é resolvido por correspondência de sinônimos — o formato de saída é idêntico, então a troca por modelo é local.
2. **Resolver.** O aplicativo — não o modelo — executa `getMetric` e `getPanel` com a intenção validada. Métrica fora do catálogo é recusada aqui.
3. **Redigir.** Com os números já em mão, o modelo escreve o texto. Números no texto vêm sempre por substituição de campo, nunca por geração livre.

Toda resposta devolve o mesmo envelope, e é ele que faz o painel reagir:

```ts
type Answer = {
  text:    string;              // "A empresa cresceu 12,4% este ano: ..."
  kpis:    { label: string; value: string; sentiment: "good" | "bad" | "neutral" }[];
  chart:   PanelResponse;       // mesmo formato do painel da tela
  formula: string;              // "crescimento = 1.200 ÷ 1.068 − 1"
  actions: {
    filters: Partial<Query>;    // { periodo: "12 meses", ano: "2026" }
    view:    string;            // "fin/faturamento"
    panel:   string;            // "fat-evolucao" — painel a destacar
  };
  undo:    Query;               // recorte anterior
  sources: string[];            // ["vw_fato_fin_mes"]
  suggest: string[];            // ["Por que a margem líquida é negativa?"]
};
```

O campo `actions` é o que cumpre o pedido central do produto: ao responder, o chat aplica os filtros, navega até a tela certa e marca o painel citado — e o botão de desfazer devolve o recorte anterior em um clique.

### Limites de segurança

- Sem SQL gerado por modelo e sem acesso a linha individual — o menor grão exposto é área × mês.
- A consulta herda o perfil de acesso do usuário; o modelo nunca vê dado fora do escopo dele.
- Pergunta sem métrica correspondente recebe recusa útil ("não tenho essa métrica; tenho estas três próximas"), nunca uma estimativa.
- Toda resposta é registrada com pergunta, intenção, métricas lidas e recorte — auditoria e avaliação de qualidade.

---

## 8 · Requisitos funcionais

| ID | Requisito | Critério de aceite |
|---|---|---|
| RF-01 | Os cinco filtros globais valem para todos os painéis e KPIs da tela ativa. | Trocar de área altera KPI e painéis no mesmo render, sem valor remanescente. |
| RF-02 | Recorte ativo é sinalizado com banner e retorno ao consolidado em um clique. | Banner lista os filtros fora do padrão; botão restaura tudo. |
| RF-03 | Painel que detalha um KPI reconcilia com ele no mesmo recorte. | Teste automatizado compara soma do painel e valor do KPI em todos os recortes. |
| RF-04 | Todo painel declara a fórmula ou a definição da métrica que apresenta. | Nenhum painel de indicador derivado sem linha de fórmula. |
| RF-05 | O chat responde com número, gráfico e fórmula, e aplica o recorte da resposta. | Nas 20 perguntas do roteiro de demonstração, filtro, tela e painel destacados conferem. |
| RF-06 | Número citado no texto do chat é igual ao número do gráfico e ao do painel na tela. | Comparação automática entre campo do envelope e valor renderizado. |
| RF-07 | Desfazer devolve o recorte anterior à resposta do chat. | Um clique restaura os cinco filtros e a tela de origem. |
| RF-08 | O chat sugere perguntas contextuais da tela ativa. | Três sugestões por tela, todas respondíveis pelo catálogo. |
| RF-09 | O recorte é compartilhável: filtros, tela e painel destacado vivem na URL. | Colar a URL reproduz a mesma tela para outro usuário com o mesmo acesso. |
| RF-10 | Exportação de painel (PNG, CSV) e do recorte (PDF). | CSV traz os mesmos valores do painel, com unidade no cabeçalho. |
| RF-11 | Fonte de dados selecionável por ambiente: fixtures, warehouse ou API. | Uma variável de ambiente troca o adaptador, sem alteração de tela. |
| RF-12 | Selo de frescor: data do último fechamento carregado, visível na tela. | Vem de `getMeta`; dado defasado exibe aviso. |

---

## 9 · Requisitos não funcionais

| Tema | Requisito |
|---|---|
| **Desempenho** | Troca de filtro repinta a tela em até 400 ms com dado em cache; primeira carga de um recorte novo em até 1,5 s. Resposta do chat em até 4 s. |
| **Precisão** | Arredondamento só na apresentação; nunca há divisão por zero visível (recorte vazio devolve estado "sem dado"). |
| **Segurança** | Recorte por perfil aplicado no servidor (nunca no cliente); dado de pessoa apenas agregado; registro de auditoria de toda consulta do chat. |
| **Acessibilidade** | Contraste mínimo 4.5:1 em texto; cor nunca é o único sinal (todo indicador crítico traz rótulo ou seta); navegação por teclado no chat e nos filtros. |
| **Idioma e formato** | pt-BR: vírgula decimal, ponto de milhar, R$ em milhões com uma casa; datas em mês/ano abreviado. |
| **Observabilidade** | Telemetria de perguntas sem resposta, painéis mais vistos e tempo por consulta — insumo do catálogo da próxima fase. |

---

## 10 · Como conectar um banco real

O caminho de migração é a prova do princípio da seção 4. Cinco passos, sem tocar em tela:

1. **Criar as seis views** do modelo da seção 6, no grão mês × entidade × área.
2. **Preencher o mapeamento** do catálogo: para cada métrica, a view, a coluna e a regra de agregação. É um arquivo de configuração, não código.
3. **Apontar o adaptador** — variável de ambiente `DATA_SOURCE=warehouse` em vez de `fixtures`.
4. **Rodar a suíte de contrato**: os mesmos testes de reconciliação que passam nas fixtures precisam passar no banco. É aqui que aparecem divergências de definição — turnover que conta transferência interna, folha que inclui rescisão.
5. **Ligar o chat**: nenhuma mudança. Ele já lê pelo adaptador; o catálogo agora aponta para colunas reais.

### Exemplo de mapeamento

```yaml
turnover_12m:
  fonte:     vw_fato_rh_mes
  formula:   soma(desligamentos, 12m) / media(headcount_fte, 12m)
  unidade:   pct
  agg:       ratio
  sentido:   menor_melhor
  meta:      14.0
  sinonimos: [turnover, rotatividade, saídas, atrito]
```

---

## 11 · Fases de entrega

| Fase | Entrega | Critério de saída |
|---|---|---|
| **F0 · Demonstração** | Concluída: painel completo com dados fictícios, filtros e chat determinístico. | Roteiro de 20 perguntas responde com filtro e gráfico corretos. |
| **F1 · Contrato** | Camada de dados extraída, catálogo de métricas versionado, suíte de reconciliação. | Mesma tela roda com dois adaptadores distintos. |
| **F2 · Dado real** | Views do cliente, adaptador de warehouse, autenticação e perfis de acesso. | Fechamento do mês confere com o relatório contábil oficial. |
| **F3 · Chat com IA** | Interpretação por modelo de linguagem sobre o catálogo, com recusa segura e auditoria. | Conjunto de avaliação com 100 perguntas: acerto de intenção e zero número inventado. |
| **F4 · Escala** | Exportações, alertas por métrica fora de meta, novas entidades e mais dimensões. | Uso recorrente semanal pelos três perfis da seção 2. |

---

## 12 · Métricas de sucesso e riscos

**Sucesso:** tempo médio entre pergunta e número confiável abaixo de 30 segundos; ao menos 70% das perguntas do comitê mensal respondidas sem analista; taxa de perguntas sem resposta caindo mês a mês; zero divergência entre painel e fechamento contábil.

| Risco | Mitigação |
|---|---|
| Definições divergentes entre áreas (o que é turnover, o que entra na folha) | Catálogo versionado com fórmula visível na tela; divergência vira decisão registrada, não ajuste silencioso. |
| Modelo de linguagem citar número que não existe | O modelo nunca calcula: números entram por substituição de campo, e o texto é comparado ao envelope antes de exibir. |
| Dado real mais sujo que a fixture (área nula, mês faltando) | Estado "sem dado no recorte" é requisito de interface, não exceção; suíte de contrato roda com dados incompletos de propósito. |
| Excesso de painéis diluindo a leitura | Cada tela tem no máximo seis KPIs e seis painéis; incluir um novo exige remover ou justificar. |

---

## Anexo · Dados da demonstração

Valores fictícios, coerentes entre si — a narrativa é de uma empresa que cresce em receita e perde no resultado, com pressão de pessoal e de capital de giro. Servem de referência para validar o adaptador real: ao ligar o banco, os mesmos painéis devem continuar reconciliando.

| Métrica | Valor 2026 | Fórmula |
|---|---:|---|
| Receita líquida | R$ 1.200 mi | bruta 1.412 − deduções 212 |
| Crescimento anual | +12,4% | 1.200 ÷ 1.068 − 1 |
| EBITDA · margem | R$ 200 mi · 16,7% | EBITDA ÷ receita líquida |
| Lucro líquido | −R$ 8 mi | EBIT 140 − juros 140 − IR |
| Desvio orçamentário | +R$ 56 mi | realizado 1.196 − orçado 1.140 |
| Ciclo financeiro | 76 dias | PMR 52 + PME 75 − PMP 51 |
| Headcount (dez) | 1.240 FTE | 1.150 + 241 admissões − 145 saídas |
| Turnover 12m | 18,4% | saídas 12m ÷ headcount médio |
| Folha ÷ receita | 15,5% | folha 186 ÷ receita 1.200 |
| Receita por FTE | R$ 968 mil | 1.200 mi ÷ 1.240 FTE |

Dimensões da demonstração — 7 áreas, 8 centros de custo, 12 UFs, 3 modalidades, 12 meses de 2026 e 2025.
