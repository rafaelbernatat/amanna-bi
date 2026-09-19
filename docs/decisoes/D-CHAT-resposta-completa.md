# D-CHAT-resposta-completa — o chat lê o dado real, desenha um gráfico em toda resposta e explica no nível do painel

|                  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Decisão**      | O laço de ferramentas passa a funcionar de fato — com `anthropic/claude-sonnet-5` e sem `parallel_tool_calls` no corpo — e continua **por sinal**, não por padrão. Toda resposta traz um gráfico: o painel da tela, a série de doze meses da própria métrica, ou o ranking que o laço leu. A redação ganha dois ou três parágrafos e uma **única** rodada de correção, conferida pelo mesmo verificador. O laço conta o andamento e entrega a prévia na primeira leitura. |
| **Responde**     | O pedido de Produto (2026-09-18): _"o chat está retornando respostas genéricas e não com base nos dados reais; precisa coletar as informações reais do banco, responder no nível de informação do painel, explicando e mostrando o gráfico"_ · PRD seção 7.1, 7.2, 7.5, 7.7 · RF-13, RF-15 · H-68 (o modelo do laço)                                                                                                                                                      |
| **Quem decidiu** | Rafael Lang, por Produto (Sonnet no laço); Engenharia, pelo diagnóstico com evidência e pelo desenho                                                                                                                                                                                                                                                                                                                                                                      |
| **Altera**       | D-CHAT-ferramentas: H-68 resolvido; `parallel_tool_calls` sai do corpo do laço; "o verificador bloqueia, nunca corrige" vira "bloqueia, reescreve uma vez, e confere de novo"; a série sintética muda a regra "métrica sem cartão responde sem gráfico"                                                                                                                                                                                                                   |
| **Data**         | 2026-09-18                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

---

## O problema, medido antes de mexer

Seis perguntas contra o servidor de desenvolvimento em warehouse, com a chave
real, antes de qualquer mudança de desenho. O que se via na tela era "resposta
genérica"; o que o registro mostrou foram **dois defeitos** que ninguém tinha
como ver, porque nenhum dos dois deixava rastro:

1. **O laço falhava em silêncio em toda pergunta composta.** `chamarGateway`
   engolia status e corpo. Instrumentado, o registro disse: `404`, _"No
   endpoints found that can handle the requested parameters"_. O OpenRouter não
   lista `parallel_tool_calls` para modelo nenhum — nem `gpt-4o`, nem Sonnet —
   e, com `provider.require_parameters`, recusa a chamada inteira. Ranking,
   série, comparação e "explique este gráfico" degradavam para uma métrica com
   o aviso de degradação. Era isto o "genérico".
2. **A fábrica de fonte lia `FONTES` indefinido no chunk do servidor de
   desenvolvimento.** Um `export const FONTES = ORIGENS_DE_DADO` (T-419)
   compilava, passava na suíte inteira e no build de produção, e no Turbopack
   avaliava antes de o contrato expor a lista: cada pedido do chat caía em
   "erro de fonte" sem tocar o banco. O registro de incidente da rota não
   existia para exceção; a rota só emitia o motivo. Existe agora, com nome,
   mensagem curta e três quadros da pilha.

Corrigidos os dois, seis de seis responderam com dado real e autoria "modelo",
ainda com `gpt-4o`. O que restava era o que o plano previa: sem gráfico para
77 métricas sem cartão (o ranking também saía sem gráfico), parágrafo único
de oito frases, "como evoluiu" caindo no caminho simples por falta de sinal,
e a prévia da composta chegando só no fim do laço.

## O que se mediu depois

| Pergunta                                     | Caminho  | Leituras            | Gráfico                           | gpt-4o | Sonnet 5 |
| -------------------------------------------- | -------- | ------------------- | --------------------------------- | -----: | -------: |
| Como está o turnover?                        | simples  | —                   | `rh-turnover` (tela)              |  2,2 s |    3,9 s |
| Explique este gráfico (`fin-dre`)            | composto | `explicar_grafico`  | `fin-dre` (em foco)               |  2,9 s |    8,7 s |
| Top 5 clientes por receita                   | composto | `ranking`           | `chat-ranking-…-cliente` (barras) |  3,3 s |    8,3 s |
| Como a receita evoluiu nos últimos 12 meses? | composto | `serie_da_metrica`  | série de doze meses               |  3,3 s |    3,9 s |
| Compare a margem líquida com o turnover      | composto | `comparar_metricas` | `fin-margens` (métrica principal) |  2,8 s |    7,1 s |
| Por que o EBITDA caiu?                       | simples  | —                   | `fin-ebitda` (tela)               |  3,8 s |    3,9 s |

Seis de seis com autoria "modelo" nos dois modelos. O Sonnet escreve com mais
cuidado — nomeia o recorte, distingue naturezas ("rentabilidade versus
rotatividade"), não traduz turnover em reais — e leva o dobro do tempo na
composta. Produto escolheu o Sonnet; a prévia cedo é o que torna os oito
segundos toleráveis numa plateia: número e gráfico aparecem na primeira
leitura, e o texto chega depois.

Custo por pergunta composta com `claude-sonnet-5` (US$ 2/M de entrada, US$ 10/M
de saída, catálogo de 2026-09-18): ≈ 25 mil tokens de entrada em duas ou três
rodadas e ≈ 800 de saída, **≈ US$ 0,06**. Cinquenta pessoas com cinco
perguntas cada, todas compostas, ≈ US$ 15 por apresentação no pior caso. A
simples continua no `gpt-4o` (≈ US$ 0,02).

## A decisão

### Laço por sinal, não por padrão

Mandar toda pergunta pelo laço custaria três a quatro vezes mais e dobraria a
latência das 39 sugestões das telas e das 33 perguntas de CFO — que **já leem
dado real** pelo estágio 2: valor, painel, apoio e a comparação com juros. O
que faltava a elas era gráfico e profundidade, não leitura. O classificador
ganha sinais (decomposição, concentração, "evoluiu", "histórico"), e "E por
área?" depois de uma resposta vai ao laço com a conversa, que é como ele
descobre a métrica. "Laço na dúvida" fica atrás de variável (T-436), decidido
por evidência.

### O modelo do laço

`anthropic/claude-sonnet-5` em `OPENROUTER_MODEL_FERRAMENTAS`, Production. O
`gpt-4o` continua nos estágios 1 e 3. O corpo do laço não manda
`parallel_tool_calls`: os dois provedores já executam chamadas em paralelo por
padrão, e o parâmetro só servia para derrubar a chamada.

### Um gráfico para toda resposta

`MetricValue.serie` já traz a série mensal de qualquer métrica, calculada sobre
os mesmos meses do recorte, nas fixtures e no warehouse. Sem cartão na tela, a
resposta monta um painel de linha dessa série — **montagem, não leitura**: as
categorias saem de `mesesDoRecorte`, e um teste fixa que eixo e valores
alinham. Com o período fora dos doze meses, a métrica é lida de novo na janela
de doze só para o desenho; o valor da resposta é o do recorte pedido. Série
toda nula não vira gráfico.

No laço, a precedência é: o gráfico que a pergunta pediu para explicar; senão a
série lida; senão o ranking ou a decomposição, em barras horizontais montadas
dos mesmos itens que o modelo leu; senão o painel da métrica principal. É a
leitura que a pessoa pediu que aparece na bolha, não a métrica de que ela
deriva.

### Profundidade e a única rodada de correção

A instrução de redação pede dois ou três parágrafos e até doze frases: o
número e o recorte; o que o gráfico mostra (pico e vale pelos destaques, com
rótulo na mesma frase, último ponto, tendência em palavras); o que explica; uma
comparação quando houver. Os tetos sobem para 2.000 e 2.400 tokens.

RF-15 continua bloqueando: nada com número fora do envelope vai para a tela. O
que muda é que, antes de cair no texto montado, o modelo recebe o próprio
texto, os números recusados e a lista do que pode citar — só as chaves do mapa
de permitidos, nada que o envelope já não tenha levado — e reescreve **uma**
vez. A reescrita passa pelo mesmo verificador. Passou: autoria
`modelo-corrigido`, escrita na tela. Falhou: fica o montado, `modelo-recusado`.
Os dois incidentes ficam registrados com `tentativa`: a frequência que a seção
7.7 mede não diminui por causa da correção.

A tradução em reais ("a cada R$ 100…") passa a sair só para métrica com família
de leitura. Turnover de 12,1% "a cada R$ 100 de salário" era número certo e
frase sem sentido.

### Andamento e prévia cedo

A rota emite `{fase: "andamento", passo}` por leitura do laço — uma frase
determinística, sem número: "Lendo Receita líquida por cliente…", "Redigindo
com o que foi lido…" — e a prévia na primeira leitura que nomeia uma métrica.
A prévia sai de novo no fim só se o painel mudou (o ranking venceu a métrica).
Sem gateway nada disso existe: as fases continuam sendo prévia e resposta, e o
arnês de ponta a ponta não muda.

### O que a falha registra

`gateway_falhou` com estágio, modelo, rodada, status e os primeiros 200
caracteres do corpo — nunca cabeçalho, nunca a chave. `fonte_falhou` com o
nome da exceção, a mensagem curta e três quadros da pilha. `laco_degradou` e
`laco_falhou` dizem o modelo. A linha de auditoria da bolha mostra o caminho
(simples, composto, degradado). A rota declara `maxDuration = 120`.

## O que não muda

- O número nasce no estágio 2. Nenhuma ferramenta recebe expressão, SQL ou
  campo aberto; o gráfico sintético é montado do que já foi lido.
- O verificador confere cada número; a correção passa por ele, e não o
  contorna.
- O que sai do ambiente (seção 11): a pergunta, o catálogo, os agregados
  formatados, o resumo do gráfico e o contexto da tela por rótulo. A rodada de
  correção manda de volta o texto do próprio modelo e as chaves do mapa de
  permitidos.
- O caminho simples continua idêntico para pergunta simples, salvo o gráfico
  sintético e a tradução por família.
- Só tipos atravessam de `semantica` para a fábrica de fonte em tempo de
  execução (teste de arquitetura em `camada-de-dados`).

## O que fica pendente

- **T-436** — laço na dúvida atrás de `CHAT_LACO_NA_DUVIDA`, decidido com o
  conjunto de avaliação.
- **T-438** — cache de prompt para a instrução e as ferramentas quando o modelo
  é Anthropic; é o que reduz os 25 mil tokens de entrada por composta.
- Preview na Vercel não recebe `OPENROUTER_MODEL_FERRAMENTAS` pelo CLI
  não-interativo (o comando pede a branch e não aceita "todas"); Preview também
  não sobe sem `DATA_SOURCE` e `AUTH_PROVIDER` (H-69). Fica com H-68.
- A taxa de `verificador_recusou` com o texto mais longo é medida em produção
  antes de qualquer afrouxamento; a rodada de correção é a resposta prevista.

## Ajustes depois do primeiro uso em produção (2026-09-18, tarde)

Produto mandou o print de "Quanto faturamos em abril?": a resposta abria com o
total de doze meses, dizia abril só no parágrafo do gráfico e fechava com
"retorno sobre a receita líquida de 100,0%, 86,3 p.p. acima da Selic". Três
correções, cada uma com tarefa:

- **O mês perguntado abre a resposta (T-439).** `mesDaPergunta` reconhece o
  mês no texto; a resolução carrega a série mensal da própria métrica e o
  ponto pedido; a instrução manda abrir com ele e o texto montado faz o mesmo.
  O recorte da URL continua sem "abril" — o gráfico e a tela seguem no período
  da seção 6.2 —, mas a conversa responde o que foi perguntado.
- **A comparação com juros só para resultado de verdade (T-440).** A família
  `resultado` era "reais e maior é melhor", o que incluía a receita — e
  receita dividida por receita é 100%. Virou lista fechada: lucro, EBITDA,
  resultado operacional, margem de contribuição em reais. Receita, saldo,
  patrimônio e caixa gerado ficam sem comparação, com o motivo dito.
- **O laço na dúvida, ligado por padrão (T-436).** "A IA precisa responder
  qualquer pergunta relacionada aos dados com números reais": a pergunta que o
  catálogo não casa de primeira vai ao laço de ferramentas, que busca a métrica
  e lê, antes de qualquer recusa. Custa uma ida ao modelo do laço por pergunta
  sem métrica; `CHAT_LACO_NA_DUVIDA=0` desliga. A recusa útil continua sendo o
  que sai quando nem o laço conclui.
- **A resposta em parágrafos curtos, e a recusa que sugere (T-441).** O
  texto chegava num bloco corrido: a instrução pedia parágrafos, e a bolha
  os colava num `<p>` só. Agora a instrução pede até três parágrafos
  separados por linha em branco e no máximo oito frases, o "Traduzindo:" abre
  o próprio parágrafo, e a bolha desenha cada um — o "Traduzindo" com rótulo
  e barra de destaque. A pergunta que nada tem a ver com os dados recebe "não
  consigo responder a isso com os dados do painel" e o guia da tela como
  atalhos, em vez de uma lista vazia.
- **A conversa herda o contexto (T-443).** Produto: "se pergunto o
  faturamento de abril e depois 'e a receita bruta?', é sobre abril". O turno
  anterior passa a levar o mês respondido e o recorte lido; a pergunta sem mês
  nem período herda o mês da resposta anterior e o texto diz "como na pergunta
  anterior"; "e em maio?" e "e no ano todo?" viram continuação determinística
  da métrica anterior; o modelo, no interpretador e no laço, vê cada linha da
  conversa com métrica, mês e recorte.
