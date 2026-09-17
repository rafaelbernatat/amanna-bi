# D-DADOS-base-amanna — a base Amanna vira a réplica, num Postgres do Supabase

|                  |                                                                                                                                                                                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Decisão**      | Os 38 CSVs de `docs/dados` são carregados num Postgres (Supabase, esquema `amanna`); dezoito views SQL derivam do **detalhe** as views que o motor espera; o adaptador `warehouse` lê essas views e reaproveita o mesmo motor de cálculo das fixtures. O motor passa a receber a `Base` por parâmetro. |
| **Responde**     | PRD seção 8.3 e 10 (réplica), RF-20, RF-21, RF-22 · Anexo D achados 3 e 5 · T-204, T-210 a T-216, T-237 em forma reduzida · D-H03 (o mockup deixa de ser a única fonte) · D-P8 (o ano vem do dado)                                                                                                     |
| **Quem decidiu** | Rafael Lang, por Produto (Supabase como banco, 2026-09-17); Engenharia, pelas derivações e pelo que fica em NULL                                                                                                                                                                                       |
| **Data**         | 2026-09-17                                                                                                                                                                                                                                                                                             |
| **Altera**       | A seção 10.1 do PRD, que lista sete views entregues pelo cliente: aqui as views são **derivadas por nós**, do detalhe, e as oito `vw_*.csv` que vieram com a base viram gabarito. A Fase 2 do backlog, escrita para um warehouse do cliente, ganha uma trilha própria (T-266 a T-273).                 |

---

## O que Produto pediu

Que os gráficos carreguem a base Amanna (`docs/dados`, 82 MB, jan/2025 a dez/2026), e
que o banco seja o Postgres do Supabase — também para a marca da instalação
(D-MARCA) e, adiante, para o chat conversar sobre os dados reais.

## O que muda

### O motor recebe a `Base`, e não importa mais a fixture

Os ~4.000 linhas de cálculo (`kpis`, `paineis`, `metricas`, `meta`) importavam
as views sintéticas por constante. Agora moram em `src/acesso/calculo/` e
recebem `Base = { views, cadastros }` dentro do `Recorte`. Dois produtores a
montam: `src/acesso/fixtures/base.ts` (as constantes de sempre) e
`src/acesso/warehouse/` (as views do Postgres). Nenhuma tela mudou, e a suíte
de contrato roda **idêntica nos dois modos** — foi assim, com 768 recortes e
nenhuma divergência sobre a base real, que o RF-21 foi provado pela primeira
vez.

Registro global ou `AsyncLocalStorage` foram descartados: dois adaptadores
convivem no mesmo processo (a suíte de contrato roda fixtures e o mutante lado
a lado), e um `run()` esquecido leria a base errada sem erro. Parâmetro é o
único desenho em que ler a base errada não compila.

### As oito `vw_*.csv` são gabarito, não fonte

A regra 4 da seção 9.2 diz: taxa nenhuma é armazenada. Os arquivos prontos
trazem `turnover_mes_pct`, `margem_ebitda_pct`, `custo_por_fte`, `ticket_medio`
— e não trazem `elegiveis`, horas previstas, promotores e detratores, que as
fórmulas do catálogo exigem. Por isso tudo é derivado do detalhe (razão, folha,
títulos, notas, movimentação, pesquisa, caixa), e os arquivos prontos entram
como `gabarito_*` para `npm run dados:conferir` provar que a derivação fecha.
Fecha: em dez/2026, as 504 células da Unidade SP batem em headcount, admissões,
desligamentos e folha; a DRE de 2026 dá R$ 1.198,3 mi de receita líquida,
R$ 198,3 mi de EBITDA e R$ −12,3 mi de lucro, como o dicionário.

### O que a base sustenta, e o que fica NULL

A base é sintética e tem lacunas que nenhuma view esconde. Onde não há dado, a
view devolve NULL, o tipo `Linha*` admite `number | null`, e `somar` propaga a
ausência até a tela mostrar "sem dado neste recorte" (PR-4). Nunca zero.

| O quê                                                             | Situação                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Balanço patrimonial (PL, ativo, passivo, imobilizado, aplicações) | **NULL.** O razão não tem saldo de abertura e só doze contas patrimoniais se movimentam. ROE, ROA, ROIC, liquidez e multiplicador ficam sem dado. Um `param_balanco_abertura` futuro destrava sem mudar código.                                                              |
| Estoque                                                           | Derivado da **convenção que a própria base declara**: PME de 75 dias (`param_estoque`), como `PME × CMV anualizado ÷ 365`. Apagar a linha devolve NULL a PME, ciclo e NCG. Trocar o número é da Controladoria (H-08).                                                        |
| Saldo mensal da dívida                                            | **Modelado**: a base traz um snapshot (dez/2026); `ancora-linear` recompõe os meses anteriores somando uma parcela linear. Juros mensais vêm do razão (6.1.1.001), repartidos pelo saldo. Três contratos vencidos ainda carregam saldo — inconsistência da base, registrada. |
| Ramp-up e produtividade perdida                                   | **NULL até H-52.** `param_turnover` tem as linhas sem valor; o custo do turnover fica sem dado, e o painel `tov-custo` só mostra total quando todo componente existe.                                                                                                        |
| Fixo × variável                                                   | Semente da Engenharia em `param_natureza_conta`, conta a conta; pendente de H-08. Conta sem classe deixa o mês em NULL.                                                                                                                                                      |
| Amortização e captação                                            | O caixa de financiamento só tem juros, tarifas e rendimento: amortização fica NULL; captação é zero de verdade.                                                                                                                                                              |
| Conta genérica (qualidade do razão)                               | NULL: exige lista que ninguém declarou.                                                                                                                                                                                                                                      |
| Receita do ano anterior em 2025                                   | NULL: não há 2024 carregado.                                                                                                                                                                                                                                                 |

### Definições que a derivação fixou

- **Quadro** = soma de `fte` de quem **recebeu folha na competência** (1.235,4
  FTE em dez/2026, o número do dicionário). A alternativa — ativos em 31/12 —
  dá 1.223,4 e vai à pauta de H-08.
- **Folha** = salários (base, extras, adicionais, rescisões e provisões) +
  encargos + benefícios líquidos do desconto de VT e da coparticipação +
  variável. A soma dá `custo_total_empresa` (R$ 189,4 mi em 2026).
- **Absenteísmo** = horas perdidas ÷ (jornada semanal ÷ 5 × dias úteis do
  calendário). **eNPS** = promotores (nota ≥ 9) e detratores (≤ 6) sobre
  respondentes; **engajamento** = média simples das dez dimensões. Só quatro
  ondas: 20 dos 24 meses ficam NULL, e o KPI de 12 meses funciona.
- **Aging** recalculado no fechamento de **cada** mês, por vencimento e baixa;
  a coluna `faixa_aging` da base é o estado final do título.
- **Faturamento por cliente** = valor líquido das notas autorizadas (fecha com
  a receita líquida do razão), carteira inteira, com os dez maiores marcados
  como `principal` — concentração lê só eles; mix por segmento e ranking leem
  todos.
- **Taxonomias** da base (escolaridade, gênero, rating, segmento, tipo de
  desligamento, fonte de candidato, trilha) viram códigos do produto por
  `map_codigo`, com a origem de cada linha. H-53, H-54 e H-57 trocam ali.
- O dicionário diz 128.513 lançamentos no razão; os dois arquivos têm 128.507.
  A contagem do dicionário é a que está errada.

### O que a suíte de contrato pegou

Sobre a base real, dois pares reprovaram nos 768 recortes, e os dois eram
defeito nosso, não do dado: o cartão do ciclo financeiro tratava PME
desconhecido como **zero** (dizia "67 dias" enquanto a régua dizia "sem
dado"), e o painel do custo do turnover somava só os componentes conhecidos.
Os dois passaram a propagar a ausência. É o processo de divergências de T-217
funcionando antes de existir cliente.

### A quinta porta: ranking

`getRanking(pedido, q)` abre uma métrica do catálogo por uma de oito dimensões
fechadas — área, centro de custo, cliente, fornecedor, conta, linha da DRE,
UF, segmento —, nenhuma delas pessoa. O número nasce no motor; `total` é o
mesmo de `getMetric`, por construção. Métrica que não abre por uma dimensão
responde `abre: false`, e não uma lista de consolidados repetidos. É a porta
que o chat usa em D-CHAT-ferramentas.

### Como se prova sem o Supabase existir

Não há Docker nem `psql` na máquina de quem desenvolve, e o projeto Supabase
depende de uma pessoa (H-65). `npm run dados:ensaio` carrega os 82 MB num
Postgres **em processo** (PGlite), com a mesma migração e as mesmas views, em
pouco mais de um minuto; `ENSAIO_PGLITE=.ensaio/pglite npx vitest run
tests/dados` prova os números pelo `DataSource`; `CONTRATO_PGLITE=.ensaio/pglite
npm run contrato -- --source=warehouse` roda a suíte de contrato. O produto
nunca importa o PGlite.

## O que não muda

- O motor não sabe de onde a base vem. Nenhum arquivo de `src/acesso/calculo/`
  importa fixture nem banco.
- `pg` entra por um módulo só, `src/acesso/postgres/cliente.ts`; o teste de
  arquitetura nomeia os dois arquivos que podem importá-lo.
- O grão mínimo continua área × mês. Nenhuma view desce a pessoa; o esquema
  `amanna` fica fora da Data API do Supabase.
- As fixtures continuam existindo, completas e sem nulo (`Completa<Linha*>`):
  são o oráculo da suíte de contrato e do controle negativo.

## O que fica pendente

- **H-65**: criar o projeto Supabase e entregar `DATABASE_URL` e
  `DATABASE_URL_CARGA`; rodar `npm run dados:carregar`.
- **H-08** ganha pauta: definição de quadro (pago × ativo), classificação fixo ×
  variável, a convenção de PME.
- O selo de frescor vira aviso um dia depois da carga (D-P5). Correto, e vai
  aparecer na demonstração: a base é estática.
- Com 2025 carregado, o delta de 12 meses contra o ano anterior passa a ser
  possível (T-273).
- Painéis categóricos passam a enumerar o que a base tem: 31 centros de custo,
  dez segmentos, sete fontes de candidato. Barras horizontais com 31 itens é
  desenho a decidir com Produto.
