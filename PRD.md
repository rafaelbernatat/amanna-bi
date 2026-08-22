# PRD — Painel BI de Controladoria com chat de IA

| | |
|---|---|
| **Versão** | 2.0 |
| **Data** | 21 de agosto de 2026 |
| **Status** | Pronto para implementação — decisões de produto travadas na seção 0 |
| **Substitui** | `PRD-Painel-BI.md` (v1.0), que permanece no repositório como registro da proposta original |
| **Protótipo de referência** | `public/design/Dashboard BI v2.dc.html` — fonte da verdade para comportamento de tela |
| **Decisão pedida** | Aprovar o catálogo de métricas (seção 9) e o mapeamento das *views* (seção 10) antes de F2 |

Um painel executivo de RH e Financeiro que responde por escrito — e que aplica o filtro e abre o gráfico exato de cada resposta. O protótipo roda sobre dados fictícios; o produto troca a fonte de dados sem tocar na interface.

Este documento reconcilia dois artefatos que até agora nunca foram comparados linha a linha: a proposta de arquitetura (v1.0) e o protótipo funcional. Onde os dois divergem, **o protótipo vence** — ele é código que roda. As divergências encontradas estão todas no [Anexo D](#anexo-d--divergências-protótipo--produto), com o tratamento decidido para cada uma.

---

## 0 · Decisões travadas

Estas decisões estão fechadas. Reabri-las exige nova versão deste documento.

| # | Decisão | Escolha | Consequência principal |
|---|---|---|---|
| D1 | Modelo de produto | **Instalação dedicada por cliente** (single-tenant) | Sem multi-tenancy no código. Isolamento vem da infraestrutura, não de uma coluna `tenant_id`. |
| D2 | Acesso ao dado do cliente | **Réplica sincronizada em warehouse próprio** | Nenhuma consulta do produto toca o ERP produtivo. Latência previsível; dado defasado até o próximo *sync*, e essa defasagem é visível na tela. |
| D3 | Escopo da v1 | **RH + Financeiro + Integração** | Espelha exatamente as 13 telas do protótipo. Comercial e Operações ficam fora. |
| D4 | Stack | **Next.js + TypeScript + Postgres + Claude** | Detalhada na seção 8. **Revisada em 2026-08-22:** os gráficos passam a usar recharts — ver [D-D4](docs/decisoes/D-D4-biblioteca-de-graficos.md). |
| D5 | Hospedagem | **Docker no cliente *ou* nuvem dedicada**, definido por contrato | O empacotamento precisa ser portátil desde o primeiro dia (seção 15). |

---

## 1 · Contexto e problema

O problema não é falta de dado. Os dados existem — no ERP, na folha, no ATS, nas planilhas de orçamento. O problema é o **custo unitário de cada pergunta**.

Hoje o ciclo é: um diretor pergunta em linguagem natural ("a folha está crescendo mais que a receita?"), um analista monta uma planilha, o número chega horas depois, sem a fórmula declarada, e não sobrevive à próxima reunião — porque ninguém consegue reproduzir como foi calculado.

Três consequências, todas caras:

1. **Perguntas não são feitas.** Se cada pergunta custa meio dia de analista, só as perguntas "importantes" são feitas — e a exploração, que é onde os problemas aparecem, não acontece.
2. **Números divergem entre áreas.** RH e Controladoria calculam turnover de formas diferentes, e a divergência só aparece na reunião.
3. **A resposta não é auditável.** Sem fórmula declarada, "de onde vem esse número?" vira uma segunda investigação.

O objetivo é levar o tempo entre a pergunta e o número confiável de horas para segundos, **sem abrir mão da rastreabilidade** — que é o que distingue este produto de um chatbot que chuta.

---

## 2 · Visão e princípios

> Um painel único, com três módulos, e um chat que responde com o número, a fórmula e o gráfico — e que aplica na tela o recorte da própria resposta.

Quatro princípios governam todas as decisões abaixo. Quando uma escolha de implementação conflitar com um deles, o princípio vence.

### P1 · Uma leitura, uma fonte

Nenhum componente de interface lê dado diretamente. Painéis, KPIs e chat consomem **a mesma** camada de dados, com **a mesma** assinatura de consulta. Trocar dado fictício por banco real é substituir um adaptador.

Isso resolve dois problemas de uma vez. A demonstração e a produção não divergem: se o painel funciona com *fixtures*, funciona com o banco. E o valor citado no texto do chat e o valor desenhado no gráfico são obrigatoriamente iguais, porque vieram da mesma chamada.

### P2 · O chat não calcula; o chat lê

O modelo de linguagem interpreta a pergunta e redige a resposta. **Ele nunca produz um número.** Entre interpretar e redigir existe uma fronteira: a aplicação — não o modelo — executa a consulta. Números entram no texto por substituição de campo, e são conferidos contra o envelope antes de a resposta aparecer na tela.

### P3 · Todo número declara sua fórmula

Todo painel de indicador derivado mostra a fórmula que usou. Toda resposta do chat carrega a fórmula junto. Isso não é enfeite de transparência: é o que transforma "esse número está errado" de uma discussão em uma verificação.

### P4 · Recorte vazio é estado, não zero

Um recorte sem dado devolve "sem dado neste recorte", com o motivo. Nunca zero, nunca um número herdado do recorte anterior, nunca uma média silenciosa. Vale também para a narrativa: um texto escrito para o consolidado não pode aparecer sob um recorte de uma área.

---

## 3 · Personas e o que cada uma precisa

| Persona | Frequência de uso | Pergunta típica | O que custa hoje | O que o painel entrega |
|---|---|---|---|---|
| **CFO / Diretoria** | Mensal, no comitê; semanal em fechamento | "Crescemos 12% e o lucro ficou negativo. Onde está o dinheiro?" | Uma reunião inteira para chegar ao número | Ponte da DRE com a fórmula, e o gráfico já aberto |
| **Controller** | Diária | "Quais centros de custo estouraram o orçamento?" | Planilha refeita todo mês | Desvio por centro, já filtrado no recorte da pergunta |
| **Business partner de RH** | Semanal | "Qual área tem o pior turnover e quanto isso custa?" | Cruzamento manual entre folha e HCM | Turnover por área e custo de reposição em reais |
| **Analista de BI** | Sob demanda | "De onde vem esse número?" | Engenharia reversa da planilha de outra pessoa | Fórmula declarada no painel e na resposta, e a *view* de origem |

**Job to be done comum:** *"Quando alguém questiona um número na reunião, quero conseguir mostrar de onde ele veio antes que o assunto mude."*

---

## 4 · Objetivos, não-objetivos e métricas de sucesso

### Objetivos

| # | Objetivo | Métrica | Linha de base | Meta |
|---|---|---|---|---|
| O1 | Reduzir o tempo entre pergunta e número confiável | Tempo mediano | Horas | < 30 s |
| O2 | Reduzir a dependência de analista no comitê mensal | % de perguntas respondidas sem analista | 0% | ≥ 70% |
| O3 | Eliminar divergência entre painel e fechamento contábil | Nº de divergências no fechamento | — | 0 |
| O4 | Aumentar a cobertura do catálogo | Taxa de perguntas sem resposta | — | Queda mês a mês |
| O5 | Garantir que o chat nunca invente número | Nº de números no texto sem correspondência no envelope | — | 0, bloqueado em produção |

### Não-objetivos (fora de escopo nesta versão)

- Escrita de volta nos sistemas de origem — o produto é somente leitura, sempre.
- Construtor de gráficos livre pelo usuário final. O vocabulário visual é fechado ([Anexo A](#anexo-a--inventário-de-telas-painéis-e-formas)).
- SQL aberto pelo chat, em qualquer forma.
- Previsões, cenários e simulações.
- Aplicativo móvel nativo (o painel é responsivo, mas não é um app).
- ETL. O produto lê de um modelo já consolidado; a construção das *views* é responsabilidade do cliente, com nosso apoio (seção 10).
- Módulos Comercial e Operações (decisão D3).

---

## 5 · Escopo funcional

Três módulos, treze telas, setenta e um painéis. O inventário completo está no [Anexo A](#anexo-a--inventário-de-telas-painéis-e-formas); aqui fica só a estrutura.

| Módulo | Telas | Painéis |
|---|---|---|
| **1 · Recursos Humanos** | Visão geral, Colaboradores, Turnover, Recrutamento, Treinamento, Engajamento, Salários | 44 |
| **2 · Financeiro e controladoria** | Visão financeira, Fluxo de caixa, Orçamentário, Contas a pagar/receber, Faturamento | 22 |
| **3 · Integração** | RH × Financeiro | 5 |

Cada tela carrega **até 6 KPIs no topo** e seu conjunto de painéis abaixo, em uma grade de 12 colunas.

> **Nota de escopo.** O protótipo tem duas telas com **sete** painéis (`rh/colab` e `rh/recrut`), o que viola o limite de seis que a v1.0 estabeleceu como regra de legibilidade. Decisão: **o limite passa a ser sete**, e continua valendo a regra de que incluir um painel novo exige remover outro ou justificar por escrito.

---

## 6 · Experiência

### 6.1 · Navegação

Barra lateral fixa com os três módulos; dentro do módulo, uma tira de abas com as telas. Trocar de módulo leva à primeira tela dele. A tela ativa aparece no título, e o *breadcrumb* mostra módulo + ano do recorte.

### 6.2 · Os cinco filtros globais

Os filtros valem para **todos** os KPIs e painéis da tela ativa, e persistem ao trocar de tela.

| Filtro | Valores | Padrão |
|---|---|---|
| Período | `12 meses`, `6 meses`, `4º trimestre`, `Dezembro` | `12 meses` |
| Ano | `2026`, `2025` | `2026` |
| Entidade | `Consolidado`, `Unidade SP`, `Demais unidades` | `Consolidado` |
| Área | `Todas` + as 7 áreas | `Todas` |
| Modalidade | `Todas`, `Presencial`, `Híbrido`, `Remoto` | `Todas` |

Os valores acima são os do protótipo e substituem os da v1.0, que listava opções inexistentes (`3 meses`, `mês atual`, `Matriz`, `Filial SP`) — ver [Anexo D](#anexo-d--divergências-protótipo--produto), achados 1 e 2.

Quando qualquer filtro sai do padrão, um **banner de recorte ativo** aparece acima dos KPIs, listando o que está fora do padrão, com um botão "Voltar ao consolidado" que restaura os cinco de uma vez.

### 6.3 · Recorte e narrativa

Cada painel pode trazer uma **nota** (leitura em prosa do gráfico) e uma **fórmula**. Sob recorte ativo, uma nota escrita para o consolidado é falsa. O protótipo já trata isso: detecta valores absolutos no texto e suprime a nota, trocando o subtítulo por "No recorte ativo · área".

Isso vira requisito formal (RF-09): **nenhum texto narrativo pode afirmar um número que não corresponde ao recorte em tela.** Um painel que não tem narrativa para o recorte mostra o gráfico sem narrativa — nunca a narrativa errada.

### 6.4 · Estados obrigatórios

Todo painel e todo KPI implementam os seis estados abaixo. Isso não é tratamento de exceção: com dado real, metade deles ocorre na primeira semana.

| Estado | Quando | O que a tela mostra |
|---|---|---|
| Carregando | Consulta em curso | Esqueleto com a forma do painel, sem número piscando |
| Com dado | Caminho normal | O painel |
| Vazio no recorte | Consulta válida, zero linhas | "Sem dado neste recorte", com o motivo e um atalho para ampliar o recorte |
| Erro de fonte | Adaptador falhou | "Não foi possível ler a fonte", com o horário da última leitura bem-sucedida |
| Sem permissão | Recorte fora do perfil | "Você não tem acesso a este recorte" — **sem** revelar o valor agregado |
| Dado defasado | Último *sync* acima do limite | O painel, com selo de frescor em destaque |

### 6.5 · Destaque de painel pela IA

Quando o chat responde, ele navega até a tela citada, rola até o painel e o marca com contorno, sombra e o rótulo "Gráfico referenciado pela IA". O destaque permanece até a próxima navegação.

### 6.6 · Compartilhamento

Filtros, tela e painel destacado vivem na URL. Colar a URL reproduz a mesma tela para outra pessoa **com o mesmo perfil de acesso** — se o perfil for menor, a tela abre no estado "sem permissão", nunca com dado a mais.

---

## 7 · O chat de IA

O capítulo mais reescrito em relação à v1.0, porque a stack agora está decidida.

### 7.1 · Arquitetura de três estágios

A fronteira de segurança está no meio. O modelo entra nas pontas; o número nasce no centro.

| Estágio | Quem executa | O que acontece |
|---|---|---|
| **1 · Interpretar** | Claude | Recebe a pergunta, o catálogo de métricas e os filtros atuais. Devolve **apenas** uma intenção estruturada — métrica, recorte, nível de detalhe, confiança. Nenhum número. |
| **2 · Resolver** | **A aplicação** | Valida a intenção contra o catálogo e executa `getMetric` / `getPanel`. Métrica fora do catálogo é recusada **aqui**. O modelo não participa. |
| **3 · Redigir** | Claude | Recebe os números já calculados e escreve o texto. Números entram por substituição de campo. |

Depois do estágio 3, um **verificador determinístico** extrai todo número do texto e confere contra o envelope. Divergência bloqueia a resposta e registra o incidente — não corrige silenciosamente. É isso que torna O5 e RF-15 executáveis em vez de aspiracionais.

### 7.2 · Contratos

```ts
// Estágio 1 devolve exatamente isto — validado por JSON Schema, não por parsing de texto.
type Intent = {
  metric:     string;              // precisa existir no catálogo
  breakdown:  "none" | "area" | "mes" | "centro_custo" | "faixa";
  filters:    Partial<Query>;      // o recorte que a pergunta pede
  confidence: number;              // 0..1
  fallback:   string[];            // métricas próximas, quando a confiança é baixa
};
```

```ts
// O envelope de resposta. É ele que faz o painel reagir.
type Answer = {
  text:    string;              // "A empresa cresceu 12,4% este ano: ..."
  kpis:    { label: string; value: string; sentiment: "good" | "bad" | "neutral" }[];
  chart:   PanelResponse;       // mesmo formato do painel da tela
  formula: string;              // "crescimento = 1.200 / 1.068 - 1"
  actions: {
    filters: Partial<Query>;    // { periodo: "12 meses", ano: "2026" }
    view:    string;            // "fin/fat"
    panel:   string;            // "fat-evolucao" - painel a destacar
  };
  undo:    { filters: Query; view: string };  // recorte E tela anteriores
  sources: string[];            // ["vw_fato_fin_mes"]
  suggest: string[];            // ["Por que a margem liquida e negativa?"]
};
```

O campo `actions` é o que cumpre o pedido central do produto: ao responder, o chat aplica os filtros, navega até a tela certa e marca o painel citado.

O campo `undo` restaura **filtros e tela**. O protótipo hoje restaura só os filtros, o que deixa a pessoa numa tela que ela não escolheu ([Anexo D](#anexo-d--divergências-protótipo--produto), achado 7).

### 7.3 · Configuração do modelo

| Parâmetro | Valor | Por quê |
|---|---|---|
| Modelo | `claude-opus-5` | 1M de contexto, US$ 5 / US$ 25 por MTok. Padrão nos dois estágios. |
| Esforço | `output_config.effort`: `low` no estágio 1, `high` no estágio 3 | **A alavanca de custo e latência é o esforço, não o modelo.** Rebaixar de modelo degrada a interpretação, que é onde erro vira número errado. |
| Saída estruturada | `output_config.format` com JSON Schema | O parâmetro `output_format` está depreciado. A validação acontece na camada da API, então o modelo tenta de novo sozinho quando erra o formato. |
| Ferramentas | `strict: true` + `additionalProperties: false` + `required` | Garante que a entrada da ferramenta valida exatamente. |
| Raciocínio | `thinking: { type: "adaptive" }` | `budget_tokens` é rejeitado com HTTP 400 nesta família de modelos. |
| Prefill | Não usar | Retorna 400 nesta família. Formato se controla por saída estruturada. |

### 7.4 · Cache de prompt é requisito de arquitetura

O catálogo de métricas é um prefixo estável e grande; a pergunta do usuário é o sufixo volátil. A ordem de renderização é `tools`, depois `system`, depois `messages` — e **qualquer byte alterado no prefixo invalida tudo depois dele**.

Regras:

- O catálogo vai no `system`, atrás de um ponto de corte `cache_control: { type: "ephemeral" }`.
- Nada volátil antes desse ponto: sem *timestamp*, sem ID de requisição, sem JSON com chaves em ordem variável.
- Prefixo mínimo de aproximadamente 1024 *tokens* para haver cache; abaixo disso ele silenciosamente não acontece.
- **Critério de aceite:** `usage.cache_read_input_tokens` maior que zero em requisições repetidas. Se vier zero, existe um invalidador silencioso — isso é defeito, não variação de custo.

### 7.5 · Limites de segurança

- Sem SQL gerado por modelo, em nenhuma circunstância.
- Sem acesso a linha individual. O menor grão exposto é **área × mês**.
- A consulta herda o perfil de acesso de quem perguntou. O modelo nunca vê dado fora do escopo dessa pessoa.
- Pergunta sem métrica correspondente recebe recusa útil — "não tenho essa métrica; tenho estas três próximas" — nunca uma estimativa.
- Toda resposta é registrada com pergunta, intenção, métricas lidas, recorte e custo em *tokens*.

### 7.6 · Sugestões contextuais

Cada tela oferece três perguntas sugeridas, todas respondíveis pelo catálogo (13 telas × 3 = 39 sugestões). Cada resposta oferece mais duas, escolhidas para levar ao próximo passo natural da investigação — não para repetir o que já foi respondido.

### 7.7 · Avaliação

Conjunto de 100 perguntas rotuladas, versionado junto do catálogo, cobrindo: as 39 sugestões contextuais, perguntas ambíguas, perguntas fora de escopo (que **devem** ser recusadas) e perguntas com recorte implícito ("e em São Paulo?").

| Métrica | Meta |
|---|---|
| Acerto de intenção (métrica + recorte) | maior ou igual a 95% |
| Recusa correta em pergunta fora do catálogo | 100% |
| Número no texto sem correspondência no envelope | 0 |
| Latência p95 da resposta completa | até 4 s |

---

## 8 · Arquitetura e stack

### 8.1 · Camadas

| Camada | Responsabilidade | Muda ao conectar o banco? |
|---|---|---|
| **Apresentação** | Telas, painéis, filtros, chat. Recebe números já calculados e formatados. | Não |
| **Semântica** | Catálogo de métricas: nome, fórmula, unidade, grão, sentido de "bom/ruim", sinônimos. | Só o mapeamento |
| **Acesso** | Adaptador: recebe uma consulta, devolve séries e agregados. | **Sim — só ela** |

### 8.2 · Stack fixada (decisão D4)

| Peça | Escolha | Justificativa |
|---|---|---|
| Framework | **Next.js 16**, App Router, Server Components | O trabalho pesado (consulta, agregação, formatação) fica no servidor; o cliente recebe painel pronto. Atende o alvo de primeira carga e mantém o dado longe do navegador. |
| Linguagem | **TypeScript**, modo estrito | O contrato de dados da seção 9 só tem valor se for verificado em tempo de compilação. |
| Warehouse | **PostgreSQL 16** | Réplica das *views* do cliente (D2). Suficiente para o volume (grão mensal, 13 telas) e trivial de empacotar em Docker. |
| Gráficos | **recharts** no cliente, sobre séries já calculadas no servidor | Revisto em 2026-08-22 por Produto ([D-D4](docs/decisoes/D-D4-biblioteca-de-graficos.md)); a v2.0 fixava SVG no servidor sem biblioteca. O vocabulário segue fechado em 12 formas, e recharts cobre 7 delas — `cascata`, `mosaico geográfico`, `régua de ciclo`, `divisão` e `estatísticas` continuam desenhadas à mão. O painel reserva a caixa antes de montar, para o *layout shift* seguir em zero. |
| IA | **Anthropic SDK** (`@anthropic-ai/sdk`), modelo `claude-opus-5` | Seção 7.3. |
| Autenticação | Provedor de identidade do cliente via OIDC, com alternativa local | Em instalação dedicada, quase sempre já existe um IdP. |
| Testes | Suíte de contrato executando contra *fixtures* **e** contra o banco | Seção 10.4. É o teste que impede a divergência de definição. |

### 8.3 · O adaptador

```
DATA_SOURCE=fixtures    # desenvolvimento e demonstração
DATA_SOURCE=warehouse   # produção
```

Uma variável de ambiente troca a implementação. Nenhuma tela muda. A suíte de contrato roda idêntica nos dois modos — é isso que prova que o princípio P1 está de pé, e não apenas escrito.

---

## 9 · Contrato de dados e catálogo de métricas

### 9.1 · A consulta

Toda leitura passa por quatro funções. A consulta é sempre o mesmo objeto — os cinco filtros da tela, mais o recorte pedido. Nenhuma outra forma de acesso é permitida.

```ts
type Query = {
  periodo:    "12 meses" | "6 meses" | "4o trimestre" | "Dezembro";
  ano:        "2026" | "2025";
  entidade:   "Consolidado" | "Unidade SP" | "Demais unidades";
  area:       "Todas" | "Operacoes" | "Comercial" | "Tecnologia"
            | "Logistica" | "Financeiro" | "Marketing" | "RH";
  modalidade: "Todas" | "Presencial" | "Hibrido" | "Remoto";
};

interface DataSource {
  getMeta():                        Promise<Meta>;           // dimensoes, catalogo, frescor
  getKpis(view: string, q: Query):  Promise<Kpi[]>;          // KPIs da tela
  getPanel(id: string, q: Query):   Promise<PanelResponse>;  // series, categorias, nota
  getMetric(id: string, q: Query):  Promise<MetricValue>;    // um numero + formula + serie
}
```

> Os valores de `Query` acima estão sem acentuação apenas nesta transcrição de tipo; os rótulos reais são os da tabela em 6.2.

### 9.2 · Regras de contrato

Todas verificáveis em teste automatizado. Uma regra que não é testável não entra aqui.

1. **Reconciliação.** Para a mesma `Query`, o KPI e o painel que o detalha somam o mesmo total. Um painel que quebra por área, sob recorte de uma área, mostra só aquela área — nunca a lista inteira com o total de outro recorte.
2. **Unidade declarada.** Todo valor volta com unidade (`BRL_mi`, `pct`, `pp`, `dias`, `FTE`), e a formatação pt-BR acontece **só** na apresentação.
3. **Vazio explícito.** Recorte sem dado devolve `null` com motivo (princípio P4).
4. **Agregação correta por tipo.** Todo fato é mensal e aditivo, **exceto** taxas (turnover, margens, PMR) e estoques (headcount, saldo de caixa). O catálogo marca cada métrica como `agg: sum | last | ratio`, para que um recorte de 3 meses nunca some percentuais.
5. **Idempotência.** A mesma `Query` devolve o mesmo resultado enquanto o *sync* não avançar.

### 9.3 · Resposta de painel

```json
{
  "id": "orc-desvio",
  "title": "Desvio por centro de custo",
  "unit": "BRL_mi",
  "formula": "desvio = realizado - orcado",
  "categories": ["Operacoes", "Comercial", "Tecnologia", "Logistica", "Financeiro", "Marketing", "RH"],
  "series": [{ "name": "Desvio", "values": [26, 14, 9, 7, -3, -4, -4] }],
  "total": 56,
  "note": "Operacoes e Comercial respondem por 71% do estouro.",
  "asOf": "2026-12-31"
}
```

### 9.4 · O catálogo de métricas

Um arquivo versionado, revisado por Controladoria e RH em conjunto. É aqui que a divergência de definição entre áreas vira uma decisão registrada em vez de um ajuste silencioso.

```yaml
turnover_12m:
  rotulo:      Turnover 12 meses
  fonte:       vw_fato_rh_mes
  formula:     soma(desligamentos, 12m) / media(headcount_fte, 12m)
  unidade:     pct
  agg:         ratio
  sentido:     menor_melhor
  meta:        14.0
  grao_minimo: [area, mes]
  sinonimos:   [turnover, rotatividade, saidas, atrito, quem sai]
  decisao:     "Transferencia interna NAO conta como desligamento. Aprovado por RH e Controladoria em 2026-08."
```

O campo `decisao` é obrigatório em toda métrica cuja definição tenha sido discutida. É o que impede que a discussão volte do zero em seis meses.

---

## 10 · Conexão ao banco do cliente

Decisão D2: o produto lê de uma **réplica em warehouse próprio**, alimentada por sincronização agendada a partir das *views* do cliente. Nenhuma consulta do produto toca o ERP produtivo.

### 10.1 · As views esperadas

O adaptador espera um modelo estrela simples, com grão mensal. Se o cliente já tem warehouse, o trabalho é escrever seis *views* de fato mais as dimensões; se não tem, as mesmas podem sair direto do ERP.

| View | Chaves e medidas | Origem típica |
|---|---|---|
| `vw_fato_rh_mes` | mês, entidade, área, modalidade · headcount FTE, admissões, desligamentos, folha, absenteísmo, eNPS, engajamento | Folha / HCM |
| `vw_fato_fin_mes` | mês, entidade · receita bruta e líquida, CMV, despesas, EBITDA, resultado financeiro, lucro líquido, FCO, capex, saldo de caixa | ERP / contábil |
| `vw_fato_orcamento` | mês, entidade, centro de custo · orçado, realizado | Planejamento |
| `vw_fato_vagas` | mês, área · abertas, em andamento, fechadas, canceladas, dias para fechar, etapas do funil, fonte do candidato | ATS |
| `vw_fato_treinamento` | mês, área, trilha, modalidade · horas, investimento, participação, conclusão | LMS |
| `vw_fato_contas` | mês, entidade, faixa de aging · a receber, a pagar, PMR, PME, PMP | ERP |
| `vw_dim_*` | entidade, área, centro de custo, modalidade, UF, faixa etária, faixa de tempo de casa, escolaridade | Cadastros |

### 10.2 · Sincronização

| Item | Definição |
|---|---|
| Cadência padrão | Diária, de madrugada, na janela acordada com o cliente |
| Modo | Carga completa do grão mensal (o volume permite; incremental é otimização futura) |
| Conexão | Somente leitura, credencial dedicada, escopo restrito às *views* acima |
| Falha | Mantém a réplica anterior e marca o selo de frescor como defasado. **Nunca serve dado parcial.** |
| Selo de frescor | `getMeta()` devolve a data do último fechamento carregado; a tela sempre mostra. Acima do limite acordado, o selo vira aviso. |

### 10.3 · Mapeamento

Para cada métrica do catálogo: a *view*, a coluna e a regra de agregação. É um arquivo de configuração, não código — e é a única peça que muda de cliente para cliente.

### 10.4 · A suíte de contrato é onde o projeto dá certo ou errado

Os mesmos testes de reconciliação que passam nas *fixtures* precisam passar no banco. **É aqui que aparecem as divergências de definição** — turnover que conta transferência interna, folha que inclui rescisão, receita que soma antes ou depois de devolução.

Isso não é um risco do projeto; é a entrega mais valiosa dele. Cada divergência encontrada vira uma linha `decisao:` no catálogo.

A suíte roda também com **dados deliberadamente incompletos** (área nula, mês faltando, centro de custo novo), porque o estado "sem dado no recorte" é requisito de interface e precisa ser exercitado.

### 10.5 · Roteiro de conexão

1. Criar as *views* no grão mês × entidade × área.
2. Preencher o mapeamento do catálogo.
3. Apontar o adaptador: `DATA_SOURCE=warehouse`.
4. Rodar a suíte de contrato e resolver cada divergência com Controladoria e RH.
5. Ligar o chat — **nenhuma mudança**. Ele já lê pelo adaptador; o catálogo agora aponta para colunas reais.

---

## 11 · Segurança, perfis e LGPD

| Tema | Requisito |
|---|---|
| **Recorte por perfil** | Aplicado **no servidor**, nunca no cliente. O perfil define entidades e áreas visíveis; a `Query` é interceptada e restringida antes de chegar ao adaptador. |
| **Grão mínimo** | Área × mês. Nenhuma superfície do produto — painel, chat, exportação — expõe linha individual de pessoa. |
| **Dado de pessoa** | Sempre agregado. Faixas etárias, faixas salariais e faixas de tempo de casa nunca descem a um grupo com menos de 5 pessoas; abaixo disso o painel mostra "grupo pequeno demais para exibir". |
| **Chat** | Herda o perfil de quem pergunta. Um recorte fora do perfil é recusado no estágio 2, antes de qualquer leitura. |
| **Auditoria** | Toda consulta do chat registra: quem, quando, pergunta, intenção interpretada, métricas lidas, recorte aplicado, custo em *tokens*. Retenção acordada com o cliente. |
| **Segredos** | Credencial do banco e chave da API nunca no código nem na imagem. Injetadas por ambiente; rotacionáveis sem *rebuild*. |
| **Trânsito para a API** | Só o **catálogo de métricas, a pergunta e os números já agregados** saem do ambiente. Nunca dado bruto, nunca linha de pessoa, nunca credencial. Isso precisa estar escrito no contrato com o cliente, não só no código. |
| **Perfis previstos** | `diretoria` (tudo) · `controller` (Financeiro + Integração) · `rh` (RH + Integração) · `area` (recorte fixo à sua área) · `auditor` (leitura + trilha de auditoria) |

---

## 12 · Requisitos funcionais

### Painel e filtros

| ID | Requisito | Critério de aceite |
|---|---|---|
| RF-01 | Os cinco filtros globais valem para todos os painéis e KPIs da tela ativa. | Trocar de área altera KPI e painéis no mesmo render, sem valor remanescente. |
| RF-02 | Recorte ativo é sinalizado com banner e retorno ao consolidado em um clique. | Banner lista os filtros fora do padrão; o botão restaura os cinco. |
| RF-03 | Painel que detalha um KPI reconcilia com ele no mesmo recorte. | Teste automatizado compara soma do painel e valor do KPI em **todos** os recortes possíveis. |
| RF-04 | Todo painel de indicador derivado declara a fórmula ou a definição da métrica. | Nenhum painel derivado sem linha de fórmula. A fórmula **não** pode ser desligada por configuração. |
| RF-05 | O filtro de ano produz recorte real sobre o dado do ano selecionado. | Selecionar `2025` muda os valores de todos os painéis, e não apenas a série de comparação. |
| RF-06 | Os seis estados da seção 6.4 estão implementados em todo painel e KPI. | Teste de interface exercita cada estado com dado forjado. |
| RF-07 | Nenhum KPI exibe valor constante que ignore o recorte. | Nenhum literal de valor no código de KPI; todos vêm de `getKpis`. |
| RF-08 | O recorte é compartilhável: filtros, tela e painel destacado vivem na URL. | Colar a URL reproduz a mesma tela para quem tem o mesmo perfil. |
| RF-09 | Nenhum texto narrativo afirma número que não corresponde ao recorte em tela. | Sob recorte, notas escritas para o consolidado são suprimidas, não adaptadas. |
| RF-10 | Selo de frescor visível, com a data do último fechamento carregado. | Vem de `getMeta`; dado defasado exibe aviso. |
| RF-11 | Exportação de painel (PNG, CSV) e do recorte (PDF). | O CSV traz os mesmos valores do painel, com unidade no cabeçalho e o recorte declarado. |

### Chat

| ID | Requisito | Critério de aceite |
|---|---|---|
| RF-12 | O chat responde com número, gráfico e fórmula, e aplica o recorte da resposta. | Nas 100 perguntas do conjunto de avaliação, filtro, tela e painel destacado conferem. |
| RF-13 | O chat aplica os filtros, navega até a tela e destaca o painel citado. | O painel citado fica visível sem rolagem manual, com o rótulo de referência. |
| RF-14 | Desfazer devolve **o recorte e a tela** anteriores à resposta. | Um clique restaura os cinco filtros e a tela de origem. |
| RF-15 | Número citado no texto é igual ao do gráfico e ao do painel na tela. | Verificador determinístico compara texto e envelope; divergência **bloqueia** a exibição. |
| RF-16 | Pergunta sem métrica no catálogo recebe recusa útil com alternativas. | Nunca uma estimativa. Sempre ao menos duas métricas próximas. |
| RF-17 | O chat sugere três perguntas contextuais por tela. | 39 sugestões, todas respondíveis pelo catálogo. |
| RF-18 | O chat nunca gera SQL nem acessa grão abaixo de área × mês. | Revisão de código mais teste que tenta induzir grão individual. |
| RF-19 | Toda interação é registrada para auditoria e avaliação. | Registro completo conforme seção 11. |

### Dados e operação

| ID | Requisito | Critério de aceite |
|---|---|---|
| RF-20 | Fonte de dados selecionável por ambiente. | Uma variável troca o adaptador, sem alteração de tela. |
| RF-21 | A suíte de contrato passa idêntica em *fixtures* e no warehouse. | Execução em CI nos dois modos. |
| RF-22 | A sincronização falha de forma segura. | Falha mantém a réplica anterior e marca defasagem; nunca serve dado parcial. |
| RF-23 | O recorte por perfil é aplicado no servidor. | Requisição forjada com recorte fora do perfil é recusada pela API, não pela interface. |
| RF-24 | Grupos com menos de 5 pessoas não são exibidos. | Teste com dataset de área pequena. |

---

## 13 · Requisitos não funcionais

| Tema | Requisito |
|---|---|
| **Desempenho** | Troca de filtro repinta em até **400 ms** com dado em cache; primeira carga de um recorte novo em até **1,5 s**; resposta completa do chat em até **4 s** (p95). |
| **Precisão** | Arredondamento só na apresentação. Nunca há divisão por zero visível. Percentual nunca é somado ao longo do período. |
| **Segurança** | Seção 11, integralmente. |
| **Acessibilidade** | Contraste mínimo 4.5:1 em texto. **Cor nunca é o único sinal** — todo indicador crítico traz rótulo ou seta. Navegação por teclado completa no chat e nos filtros. Gráficos têm alternativa textual (a nota e a fórmula cumprem esse papel). |
| **Idioma e formato** | pt-BR: vírgula decimal, ponto de milhar, R$ em milhões com uma casa, datas em mês/ano abreviado. A formatação acontece só na apresentação (regra de contrato 2). |
| **Observabilidade** | Latência por consulta, taxa de acerto do chat, perguntas sem resposta, painéis mais vistos, custo em *tokens* por sessão, idade do último *sync*. |
| **Custo** | Teto mensal de gasto com a API configurável, com alerta em 80%. O cache de prompt (7.4) é o principal controle. |

---

## 14 · Telemetria

O que medimos determina o que melhora. Quatro perguntas, e o evento que responde cada uma:

| Pergunta | Evento | Uso |
|---|---|---|
| O que as pessoas querem saber e nós não respondemos? | `chat.sem_resposta`, com o texto da pergunta | Fila de priorização do catálogo da próxima fase |
| O produto está sendo usado, ou só demonstrado? | `painel.visto`, `chat.pergunta`, por perfil e por semana | Métrica O2 |
| O chat está acertando? | `chat.intencao`, com confiança e correção manual posterior | Métrica de acerto de intenção |
| Onde dói a latência? | `consulta.duracao`, por *view* e por recorte | Metas da seção 13 |

Nenhum evento carrega dado de pessoa. O texto de pergunta é tratado como dado do cliente e obedece à retenção acordada.

---

## 15 · Empacotamento, instalação e atualização

Decisão D5: o produto precisa rodar nos dois modos, e a diferença entre eles não pode existir no código.

| Aspecto | Docker no cliente | Nuvem dedicada |
|---|---|---|
| Entrega | `docker compose` com aplicação mais Postgres | Projeto e banco isolados por cliente |
| Acesso ao banco de origem | Rede interna do cliente | Túnel ou VPN até a origem |
| Segredos | Variáveis de ambiente do cliente | Cofre da nossa infraestrutura |
| Atualização | Imagem versionada; migração de esquema no *start*, idempotente | Implantação contínua com janela acordada |
| Observabilidade | Registros locais; envio opcional | Centralizada |
| Argumento comercial | **O dado nunca sai da rede do cliente** — decisivo em controladoria | Operação e suporte mais simples |

Regras que valem nos dois modos: imagem única, sem *build* específico por cliente; toda diferença de cliente vive em configuração (catálogo, mapeamento e variáveis); migração de banco é idempotente e reversível; a versão instalada aparece na interface, para que suporte e cliente falem do mesmo artefato.

---

## 16 · Plano de entrega

| Fase | Entrega | Critério de saída |
|---|---|---|
| **F0 · Protótipo** | **Concluída.** 13 telas, 71 painéis, 5 filtros, chat determinístico sobre dados fictícios. | Roteiro de perguntas responde com filtro e gráfico corretos. |
| **F1 · Contrato** | Camada de dados extraída para o adaptador; catálogo de métricas versionado; suíte de reconciliação; os seis estados de tela; correção dos achados 3, 5, 6, 7 e 10 do Anexo D. | A mesma tela roda com dois adaptadores distintos, e a suíte passa nos dois. |
| **F2 · Dado real** | *Views* do cliente, sincronização, adaptador de warehouse, autenticação e perfis de acesso. | O fechamento do mês confere com o relatório contábil oficial — **zero divergência** (métrica O3). |
| **F3 · Chat com IA** | Os três estágios da seção 7 sobre o catálogo, com recusa segura, verificador numérico, cache de prompt e auditoria. | Conjunto de 100 perguntas atinge as metas de 7.7. |
| **F4 · Escala** | Exportações, alertas por métrica fora de meta, novas entidades e dimensões. | Uso recorrente semanal pelos quatro perfis da seção 3. |

**Dependências.** F1 é pré-requisito de F2 **e** de F3, e as duas podem correr em paralelo depois dela — F3 depende do catálogo, não do dado real, e pode ser desenvolvida inteiramente contra *fixtures*.

---

## 17 · Riscos

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Definições divergentes entre áreas (o que é turnover, o que entra na folha) | **Alta** | Catálogo versionado com fórmula visível na tela e campo `decisao` obrigatório. A suíte de contrato (10.4) força a discussão cedo, não na primeira reunião de diretoria. |
| O cliente não consegue produzir as *views* | **Alta** | Escopo de apoio previsto em F2. As *views* são o contrato de entrada e precisam estar no contrato comercial, não só neste PRD. |
| Modelo de linguagem citar número que não existe | Média | O modelo nunca calcula (P2); números entram por substituição de campo; verificador determinístico bloqueia a exibição em caso de divergência. |
| Dado real mais sujo que a *fixture* | **Alta** | Os seis estados são requisito (RF-06); a suíte roda com dados incompletos de propósito. |
| Custo da API acima do previsto | Média | Cache de prompt como requisito (7.4), esforço baixo no estágio de interpretação, teto configurável com alerta. |
| Excesso de painéis diluindo a leitura | Média | Máximo de 6 KPIs e 7 painéis por tela; incluir um novo exige remover outro ou justificar. |
| Latência do chat acima de 4 s frustrar o uso | Média | Estágio 1 com esforço baixo; consulta em cache; resposta em *streaming*, com o gráfico aparecendo antes de o texto terminar. |

---

## 18 · Decisões pendentes

Nada aqui bloqueia F1. Tudo aqui bloqueia F2.

| # | Pergunta | Quem decide | Prazo |
|---|---|---|---|
| P1 | Qual é o sistema de origem de cada uma das *views*? | TI do cliente | Antes de F2 |
| P2 | Transferência interna conta como desligamento? | RH e Controladoria | Antes de F2 |
| P3 | Rescisão entra na folha do mês de competência ou de pagamento? | Controladoria | Antes de F2 |
| P4 | Qual a janela e a cadência de sincronização aceitáveis? | TI do cliente | Antes de F2 |
| P5 | Qual o limite de defasagem que dispara o aviso no selo de frescor? | Controladoria | Antes de F2 |
| P6 | Docker no cliente ou nuvem dedicada, para este contrato? | Comercial | Antes de F2 |
| P7 | Retenção do registro de auditoria e das perguntas do chat? | Jurídico do cliente | Antes de F3 |
| P8 | O filtro de ano continua com dois valores fixos ou vira seleção livre? | Produto | Antes de F1 |

---

## Anexo A · Inventário de telas, painéis e formas

### A.1 · Vocabulário visual

Doze formas fechadas. **Não existe construtor de gráfico livre** — um painel novo usa uma destas ou justifica uma décima terceira.

`barras` · `linha` · `barras horizontais` · `barras empilhadas` · `divisão` · `estatísticas` · `funil` · `mosaico geográfico` · `rosca` · `cascata` · `dispersão` · `régua de ciclo`

### A.2 · Módulo 1 — Recursos Humanos (7 telas, 44 painéis)

| Tela | Painéis |
|---|---|
| **Visão geral** (`rh/visao`) | `rh-headcount` Headcount nos últimos 12 meses · `rh-turnover` Turnover (12 meses) · `rh-retencao` Retenção e saldo líquido de pessoas · `rh-flash` Leitura rápida do período · `rh-folha` Folha total e custo por colaborador · `rh-areas` Distribuição por área |
| **Colaboradores** (`rh/colab`) | `col-area` Por área · `col-perfil` Perfil do quadro · `col-idade` Por faixa etária · `col-tempo` Tempo de empresa · `col-escol` Escolaridade · `col-mapa` Distribuição geográfica por estado · `col-geo` Concentração geográfica |
| **Turnover** (`rh/turnover`) | `tov-12m` Taxa de turnover — 12 meses · `tov-tipos` Tipos de desligamento · `tov-area` Turnover por área · `tov-corte` Turnover por gênero e faixa etária · `tov-resumo` Custo do turnover em reais · `tov-custo` Custo financeiro do turnover |
| **Recrutamento** (`rh/recrut`) | `rec-dias` Tempo médio de fechamento por mês · `rec-status` Status das vagas no ano · `rec-funil` Pipeline de recrutamento · `rec-fontes` Fontes de aquisição de talentos · `rec-tempo` Tempo médio de fechamento por área · `rec-vagas` Vagas por status e área · `rec-resumo` Resumo do funil |
| **Treinamento** (`rh/trein`) | `tre-horas` Horas de treinamento e participação · `tre-conclusao` Conclusão das trilhas · `tre-modal` Horas por modalidade · `tre-conclmod` Conclusão por modalidade · `tre-invest` Investimento em desenvolvimento · `tre-area` Horas por área e investimento por trilha |
| **Engajamento** (`rh/engaj`) | `eng-area` Engajamento por área · `eng-cat` Categorias do eNPS · `eng-enps` eNPS (12 meses) · `eng-eng` Engajamento (12 meses) · `eng-abs` Absenteísmo (12 meses) · `eng-clima` Resumo de clima |
| **Salários** (`rh/sal`) | `sal-medio` Salário médio por área · `sal-comp` Composição da folha · `sal-folha` Folha por área · `sal-faixas` Faixas salariais · `sal-benef` Benefícios e encargos · `sal-resumo` Indicadores de salário |

### A.3 · Módulo 2 — Financeiro e controladoria (5 telas, 22 painéis)

| Tela | Painéis |
|---|---|
| **Visão financeira** (`fin/visao`) | `fin-receita` Receita líquida — ano atual vs. ano anterior · `fin-margens` Margens (12 meses) · `fin-ebitda` EBITDA mensal e conversão em caixa · `fin-dre` Ponte da DRE — receita líquida ao lucro líquido |
| **Fluxo de caixa** (`fin/caixa`) | `cx-diario` Movimentação diária — últimos 30 dias · `cx-ponte` Ponte do fluxo de caixa · `cx-saldo` Saldo de caixa consolidado · `cx-fluxo` Entradas × saídas por mês · `cx-cat` Principais categorias de saída |
| **Orçamentário** (`fin/orc`) | `orc-vs` Orçado × Realizado por mês · `orc-desvio` Desvio por centro de custo · `orc-gastos` Gastos por centro de custo · `orc-acum` Orçamento acumulado × realizado |
| **Contas a pagar/receber** (`fin/contas`) | `ct-ciclo` Ciclo de conversão de caixa · `cr-aging` Aging de contas a receber · `cp-aging` Aging de contas a pagar · `cr-inadim` Top clientes inadimplentes · `cp-fornec` Top fornecedores por saldo |
| **Faturamento** (`fin/fat`) | `fat-evolucao` Evolução do faturamento · `fat-segm` Carteira por segmento · `fat-margem` Margem de contribuição por cliente · `fat-risco` Risco de crédito da carteira |

### A.4 · Módulo 3 — Integração (1 tela, 5 painéis)

| Tela | Painéis |
|---|---|
| **RH × Financeiro** (`int/cruz`) | `int-rpc` Receita por colaborador · `int-ebitda-pc` EBITDA per capita · `int-hc-desp` Headcount versus despesa de pessoal · `int-scatter` Custo de pessoal × retorno por área · `int-pct` Despesa de pessoal sobre a receita |

**Total: 71 painéis.** Este inventário é a lista de verificação de F1 — cada painel precisa passar pelo adaptador.

---

## Anexo B · Intenções do chat (base do catálogo)

As 21 intenções do protótipo, que se tornam as primeiras entradas do catálogo de métricas em F3.

| # | Intenção | Métrica principal | Destino | Painel destacado |
|---|---|---|---|---|
| 1 | Crescimento / YoY | `crescimento_yoy` | `fin/fat` | `fat-evolucao` |
| 2 | Turnover / rotatividade | `turnover_12m` | `rh/turnover` | `tov-area` |
| 3 | EBITDA / margens | `margem_ebitda` | `fin/visao` | `fin-margens` |
| 4 | Caixa / FCO / conversão | `saldo_caixa` | `fin/caixa` | `cx-ponte` |
| 5 | Orçamento / desvio / centro de custo | `desvio_orcamentario` | `fin/orc` | `orc-desvio` |
| 6 | Headcount / quadro / FTE | `headcount_fte` | `rh/visao` | `rh-headcount` |
| 7 | Receita por colaborador / produtividade | `receita_por_fte` | `int/cruz` | `int-hc-desp` |
| 8 | Inadimplência / aging / recebíveis | `inadimplencia` | `fin/contas` | `cr-aging` |
| 9 | Ciclo financeiro / PMR / PME / PMP | `ciclo_financeiro` | `fin/contas` | `ct-ciclo` |
| 10 | Treinamento / horas / capacitação | `horas_treinamento` | `rh/trein` | `tre-conclusao` |
| 11 | Folha / custo de pessoal / encargos | `folha_total` | `rh/sal` | `sal-comp` |
| 12 | Recrutamento / pipeline / fechamento | `tempo_fechamento` | `rh/recrut` | `rec-tempo` |
| 13 | Absenteísmo | `absenteismo` | `rh/engaj` | `eng-abs` |
| 14 | eNPS / engajamento / clima | `enps` | `rh/engaj` | `eng-enps` |
| 15 | Retenção | `retencao_12m` | `rh/visao` | `rh-retencao` |
| 16 | Status das vagas | `vagas_status` | `rh/recrut` | `rec-status` |
| 17 | Salário médio / faixa salarial | `salario_medio` | `rh/sal` | `sal-medio` |
| 18 | Engajamento por área | `engajamento_area` | `rh/engaj` | `eng-area` |
| 19 | Perfil / gênero / modalidade | `perfil_quadro` | `rh/colab` | `col-perfil` |
| 20 | Idade / tempo de casa / escolaridade | `distribuicao_etaria` | `rh/colab` | `col-idade` |
| 21 | Distribuição por estado | `distribuicao_uf` | `rh/colab` | `col-mapa` |

---

## Anexo C · Dados da demonstração

Valores fictícios, coerentes entre si. A narrativa é de uma empresa que **cresce em receita e perde no resultado**, com pressão de pessoal e de capital de giro — escolhida de propósito, porque um dataset onde tudo vai bem não exercita o produto.

Servem de referência para validar o adaptador real: ao ligar o banco, os mesmos painéis devem continuar reconciliando.

| Métrica | Valor 2026 | Fórmula |
|---|---:|---|
| Receita líquida | R$ 1.200 mi | bruta 1.412 menos deduções 212 |
| Crescimento anual | +12,4% | 1.200 / 1.068 - 1 |
| EBITDA · margem | R$ 200 mi · 16,7% | EBITDA / receita líquida |
| Lucro líquido | -R$ 8 mi | EBIT 140 - juros 140 - IR |
| Desvio orçamentário | +R$ 56 mi | realizado 1.196 - orçado 1.140 |
| Ciclo financeiro | 76 dias | PMR 52 + PME 75 - PMP 51 |
| Headcount (dez) | 1.240 FTE | 1.150 + 241 admissões - 145 saídas |
| Turnover 12m | 18,4% | saídas 12m / headcount médio |
| Folha / receita | 15,5% | folha 186 / receita 1.200 |
| Receita por FTE | R$ 968 mil | 1.200 mi / 1.240 FTE |

**Dimensões:** 7 áreas · 8 centros de custo · 12 UFs · 3 modalidades · 12 meses.

---

## Anexo D · Divergências protótipo ↔ produto

Todas verificadas no código de `public/design/Dashboard BI v2.dc.html`. Este anexo é a diferença entre um PRD que descreve o que se imagina ter e um que descreve o que existe.

| # | Achado | Onde | Tratamento | Fase |
|---|---|---|---|---|
| 1 | Opções de **período** divergem: a v1.0 lista `3 meses` e `mês atual`; o protótipo usa `4º trimestre` e `Dezembro`. | `renderVals()` → `FD` | Adotados os valores do protótipo (seção 6.2). | Resolvido |
| 2 | Opções de **entidade** divergem: a v1.0 lista `Matriz` e `Filial SP`; o protótipo usa `Unidade SP` e `Demais unidades`. | `renderVals()` → `FD` | Adotados os valores do protótipo (seção 6.2). | Resolvido |
| 3 | **Filtros são fatores de escala, não recorte dimensional.** `entidade: 'Unidade SP'` multiplica todos os valores por `0.62`; `área` multiplica pela participação daquela área no total. | `fctx()` | Dívida conhecida do protótipo. O adaptador substitui por consulta real com filtro no banco. | F1 |
| 4 | **RF-03 não é satisfeito hoje.** A reconciliação *parece* correta porque KPI e painel escalam pelo mesmo fator — não porque somam o mesmo dado. | consequência de 3 | O requisito permanece; passa a ser verdadeiramente testável quando 3 for resolvido. | F1 |
| 5 | **KPIs com valor fixo em texto**, que não reagem a nenhum filtro: idade média `34,2 anos`, tempo de casa `3,1 anos`, tempo de fechamento `42 dias`, custo por contratação `R$ 8,6 mil`, encargos `37,5%`, mediana salarial `R$ 6.240`, participação em treinamento `78,0%`, conclusão média `64,0%`, cobertura da pesquisa `74%`, ticket médio `R$ 65,2 mil`, concentração top 10 `54,3%`, PMR / PME / PMP e inadimplência. | `kpisRaw()` | Todos precisam vir de `getKpis`. RF-07 proíbe literais. | F1 |
| 6 | **O filtro de ano não faz nada.** `fctx()` ignora `f.ano`; o dataset tem uma série só, e `receitaLY` é série de comparação, não recorte de 2025. | `fctx()` | RF-05: ou o ano vira recorte real, ou sai do filtro. Decisão pendente P8. | F1 |
| 7 | **Desfazer não restaura a tela.** O botão restaura só `filters`, deixando a pessoa numa tela que ela não escolheu — enquanto a v1.0 promete restaurar "os cinco filtros e a tela de origem". | `msgs[].undo` | Corrigido o comportamento, não o requisito: `undo` passa a carregar `{ filters, view }` (7.2, RF-14). | F1 |
| 8 | **O chat é casamento de *substring*** sobre uma lista de sinônimos, com desempate por "maior string vence". Sem confiança, sem desambiguação, sem resposta multi-métrica. | `ask()` e `KB` | Substituído pela arquitetura de três estágios (seção 7). O `KB` vira a base do catálogo (Anexo B). | F3 |
| 9 | **Colisão de palavra-chave.** `vaga` existe nas intenções 12 (recrutamento) e 16 (status das vagas). O desempate usa comparação estrita, então em empate de comprimento a **primeira** vence — e a intenção 16 fica inalcançável por essa chave. | `ask()` | Some com a reescrita do achado 8. Fica registrado como exemplo de por que casamento por *substring* não escala. | F3 |
| 10 | **A fórmula pode ser desligada.** A propriedade `mostrarMemoria` esconde a linha de fórmula de todos os painéis, o que conflita com "todo painel declara a fórmula". | `base()` | A fórmula é obrigatória e não configurável (RF-04, princípio P3). A propriedade sai, ou vira preferência de densidade visual sem afetar auditabilidade. | F1 |
| 11 | **Duas telas têm sete painéis**, contra o limite de seis que a v1.0 fixou como regra de legibilidade (`rh/colab` e `rh/recrut`). | `panelsFor()` | Limite revisado para sete (seção 5). A regra de "remover ou justificar" permanece. | Resolvido |

---

*Documento de origem: `PRD-Painel-BI.md` v1.0. Protótipo de referência: `public/design/Dashboard BI v2.dc.html`.*
