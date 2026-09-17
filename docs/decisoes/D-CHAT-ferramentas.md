# D-CHAT-ferramentas — o chat compõe leituras por ferramentas fechadas, e vê a tela

|                  |                                                                                                                                                                                                                                                                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Decisão**      | O modelo passa a **pedir** leituras por um vocabulário fechado de oito ferramentas — métrica, série, comparação, variação, ranking, decomposição, gráfico, catálogo — que o nosso código executa pela fronteira de perfil. O chat recebe o contexto da tela (rota, filtros, painel em foco) e desenha o gráfico na conversa. |
| **Responde**     | PRD seção 7.1 (três estágios), 7.2, 7.5, RF-12 a RF-16, RF-18 · seção 11 (o que sai do ambiente) · T-272 (a porta de ranking) · o pedido de Produto: "a IA precisa responder tudo sobre os dados e os gráficos"                                                                                                              |
| **Quem decidiu** | Rafael Lang, por Produto (o chat conversa sobre os dados reais, 2026-09-17); Engenharia, pelo desenho de ferramentas fechadas em vez de SQL gerado                                                                                                                                                                           |
| **Data**         | 2026-09-17                                                                                                                                                                                                                                                                                                                   |
| **Altera**       | A seção 7.1 ganha um estágio 0 (classificar) e um caminho composto. Nada do que a 7.1 garante muda: o número nasce no estágio 2, o verificador de RF-15 confere cada número, e o modelo nunca escreve consulta.                                                                                                              |

---

## O que Produto pediu

Que o chat responda "tudo sobre os dados e os gráficos": os cinco maiores
clientes, o pior mês de receita, o que um gráfico mostra, se a receita cresceu
sobre o ano anterior, uma métrica ao lado da outra. Sem preferência de
desenho, com uma exigência: conversar sobre os **dados reais**.

## As três opções, e por que esta

1. **SQL gerado pelo modelo** sobre as views. Responde qualquer pergunta e
   quebra as três garantias do produto de uma vez: o número nasceria no modelo,
   o grão mínimo dependeria de um prompt, e o verificador não teria envelope
   para conferir.
2. **Só o caminho de sempre**, uma métrica por pergunta. Seguro e insuficiente:
   ranking, série, comparação e "o que esse gráfico mostra" ficam sem resposta.
3. **Ferramentas fechadas.** O modelo escolhe **o que ler** dentro de um
   vocabulário que nós declaramos; o nosso código lê pelas mesmas portas das
   telas; o modelo escreve com o que voltou; o verificador confere. É a
   arquitetura da 7.1 com um grau de liberdade a mais — o modelo pede — e
   nenhum a menos.

## O que muda

### Um estágio 0: classificar, antes do gateway

Sinais na pergunta — "top", "maiores", "por cliente", "mês a mês", "cresceu",
"compare", "esse gráfico", "quais métricas" — decidem se ela vai ao laço. É
determinístico e é nosso: mandar tudo pelo laço dobraria latência e custo no
caso comum. Um sinal que está no **nome da métrica** ("engajamento por área",
"concentração nos 10 maiores clientes") é descontado quando o interpretador
local a escolhe com confiança: as 39 sugestões das telas continuam no caminho
simples, por teste. "Por que" fica simples de propósito: não há ferramenta de
causa, e ninguém deve fingir que há.

### Oito ferramentas, todas fechadas

`ler_metrica`, `serie_da_metrica`, `comparar_metricas`, `variacao`, `ranking`,
`decompor`, `explicar_grafico`, `listar_metricas`. Cada uma é um JSON Schema
com `additionalProperties: false` e enums derivados do que o produto já
declara: os ids do catálogo, os códigos dos filtros, as oito dimensões de
ranking, os anos que a fonte tem. Não há campo de texto que vire consulta.

O validador é a segunda conferência, a que **nós** fazemos: nome na lista,
nenhuma chave extra, métrica no catálogo (senão as próximas), filtro no
vocabulário, ano carregado, dimensão entre as oito (pessoa, CPF e matrícula
nunca chegam à fronteira), painel do registro. Uma chamada recusada não toca
porta nenhuma — o teste prova com um espião.

O executor lê por `lerMetrica`, `lerPainel` e `lerRanking`: sessão, escopo e
fronteira antes de tocar a fonte, como a tela. A série mensal sai do painel de
linha que detalha a métrica, e não de uma consulta nova. Ranking e decomposição
usam a quinta porta de D-DADOS. O modelo recebe **só o formatado**: os brutos
ficam de fora, para não haver o que arredondar de outro jeito.

### As derivações são nossas, com fórmula escrita

Diferença (em ponto percentual quando é de taxa), variação percentual (só do
que se soma), participação no total, "outros" de uma decomposição cortada. O
modelo é instruído a não calcular nada — e o verificador barra o que ele
calcular mesmo assim.

### O verificador ganha a regra do rótulo

Todo número do texto continua tendo de existir no envelope. O que entra no
envelope agora inclui as leituras do laço e o resumo do gráfico destacado —
com uma distinção: valor de métrica, total, destaque (pico, vale, último) e
derivação nossa são **livres**; ponto de série, de gráfico ou de ranking só
passa **com o rótulo por perto** (até 80 caracteres): "em mar/2026, 5,2%",
"Cliente Alfa, R$ 12,0 mi". Sem o rótulo, "5,2%" é um valor solto que pode ser
de qualquer mês. Divergiu → o texto montado entra, e o incidente é registrado.

### O contexto da tela viaja com a pergunta

O chat manda a rota aberta e a busca da URL; a rota valida contra o inventário
e monta o contexto: tela, título, filtros e painel em foco. O modelo vê o
recorte por rótulo, e "esse gráfico" tem referente. A prévia passa a carregar
o envelope do painel destacado, e a conversa o desenha — o mesmo
`DesenhoDePainel` da tela, numa caixa própria (`chat-grafico`), sem se
confundir com a moldura da tela.

### Sem gateway, ainda responde o que é determinístico

"O que esse gráfico mostra?" com painel em foco, e um ranking cuja métrica e
dimensão a pergunta nomeia, respondem sem modelo: as mesmas ferramentas, texto
montado. O resto recebe a recusa útil de RF-16 — "sem o modelo configurado,
respondo uma métrica por vez" — com as métricas próximas como atalho.

### Limites nomeados

Quatro leituras por pergunta, três rodadas, 20 s por rodada, 1.600 tokens de
saída, cinco itens por ranking (dez no máximo), doze categorias por
decomposição, 48 pontos por resumo (acima, só destaques e total). O modelo do
laço pode ser outro (`OPENROUTER_MODEL_FERRAMENTAS`), porque seguir protocolo
de ferramenta é outra habilidade que redigir — H-68 decide.

### Inspetor e incidente

Antes de cada ida ao gateway, o inspetor confere que a instrução de sistema é
a nossa e que nenhum resultado de ferramenta parece pessoa: CPF, e-mail,
campo com nome de gente. Bloqueou → o laço não sai, o incidente é registrado,
o caminho simples responde. Os incidentes — verificador recusou, inspetor
bloqueou, laço falhou ou degradou — saem como log estruturado, sem a pergunta
e sem o sujeito; a tabela `amanna.chat_incidente` (migração 010) os recebe
quando T-324 decidir a retenção.

## O que não muda

- O número nasce no estágio 2. Nenhuma ferramenta recebe expressão, SQL ou
  campo aberto que vire consulta.
- O grão mínimo (área × mês) e as oito dimensões de ranking. Nenhuma linha de
  pessoa atravessa a fronteira.
- O que sai do ambiente (seção 11): a pergunta, o catálogo, os agregados
  formatados. Agora também o resumo do gráfico e o contexto da tela por rótulo.
- O verificador bloqueia; nunca corrige.
- O caminho simples é idêntico ao de antes para toda pergunta simples.

## O que fica pendente

- **H-68**: o modelo do laço. A recomendação é um modelo que siga protocolo de
  ferramentas com disciplina (Claude Sonnet via OpenRouter); o `gpt-4o` já
  errou escala e inventou benchmark no caminho simples.
- `variacao` só contra o ano anterior: o vocabulário de período não tem "mês
  anterior". Com 2025 carregado (D-DADOS), a variação anual funciona; em
  fixtures, recusa dizendo que o ano não está carregado.
- Contagem e pontos (`contagem`, `pontos`) saem sem sufixo e o verificador não
  os captura — lacuna anterior a esta decisão, que um ranking por contagem
  amplia. Fica em T-353.
- Latência: uma pergunta composta faz duas ou três idas ao gateway. A meta
  própria — prévia em até 3 s, resposta em até 15 s — é medida com o modelo de
  H-68 antes de qualquer afrouxamento do verificador.
