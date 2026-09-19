# D-CHAT-pergunta-primeiro — a pergunta manda no caminho e na forma

|                  |                                                                                                                                                                                                                                                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Decisão**      | O roteamento inverte: com gateway, o laço de ferramentas é o padrão, e o atalho de uma métrica fica com a continuação da conversa, com "por que" e com a pergunta que não pede nada além de nomear a métrica. A redação deixa de ter estrutura fixa. Uma checagem determinística confere se a resposta responde. |
| **Responde**     | Os três prints de Produto (2026-09-19) e o pedido: _"quero que responda qualquer pergunta sobre os assuntos relacionados aos dados"_ · PRD seção 7.1, 7.3, 7.7 · RF-15, RF-16 · D-CHAT-ferramentas · D-CHAT-resposta-completa                                                                                    |
| **Quem decidiu** | Rafael Lang, por Produto (forma livre, dado de pessoa, híbrido); Engenharia, pelo diagnóstico medido e pelo desenho                                                                                                                                                                                              |
| **Data**         | 2026-09-19                                                                                                                                                                                                                                                                                                       |
| **Altera**       | `classificar.ts` deixa de ser o roteador e vira insumo de `rota.ts`; a invariante "a classificação é a mesma com ou sem chave" é quebrada de propósito. T-436 (laço na dúvida) é absorvido. `REGRAS_DE_NUMERO` perde a regra de forma. Os dois prompts deixam de prescrever estrutura.                           |

---

## O problema, medido

Produto mandou três prints. As três respostas tinham a mesma forma e nenhuma
entrava no assunto perguntado:

| Pergunta                                                                   | O que saiu                                 | O que era para sair                   |
| -------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------- |
| "Qual foi a maior despesa de junho?"                                       | "Despesa de pessoal em jun/2026: 16,5%"    | a maior despesa de junho, por conta   |
| "Fora a despesa com pessoal, o que mais eu gastei que foi fora do normal?" | a contagem de lançamentos fora do padrão   | as contas fora do normal, sem pessoal |
| "E esses lançamentos são o que?"                                           | a mesma contagem, e uma definição genérica | quais lançamentos                     |

Não era o prompt. Rodando os padrões reais de `classificar.ts` contra sete
perguntas naturais sobre os dados, **seis não acendem sinal nenhum** e caem no
caminho de uma métrica, respondido pela mais próxima do catálogo. Só "Quem são
nossos maiores clientes?" — que diz literalmente "maiores" — chegava ao laço. O
padrão de ranking tem `maiores`, e não `maior`.

Uma lista de frases nunca cobre uma língua. O que ela media era a **forma** da
pergunta; o que decide é outra coisa.

## O roteamento: o que sobra da pergunta

O atalho responde uma métrica, um recorte. Ele serve — e só serve — quando a
pergunta não pede nada além de nomear a métrica. Então tira-se da pergunta o
vocabulário da própria métrica, o mês, o recorte e as palavras que não pedem
nada, e o que sobra é o que a pessoa perguntou a mais. Sobrou → o laço.

Com gateway, o atalho exige **todas** estas: há continuação determinística
(`herdar`, T-443); ou o palpite local é confiante **e por termo inteiro**, a
pergunta não carrega sinal composto, e o resto é vazio. "Por que" continua no
atalho: não há ferramenta de causa, e o laço responderia pior que o estágio 2,
que já lê o apoio.

**Sem gateway vale o `classificar` de hoje, byte a byte.** É quebra deliberada
da invariante que `classificar.ts` declara, e a razão é concreta: sem chave o
laço só responde duas formas, e mandar tudo para ele transformaria o produto —
e toda resposta do arnês de e2e, que roda sem chave de propósito — em "sem o
modelo configurado". `CHAT_ROTA=sinais` restaura o roteamento anterior.

O ramo "laço na dúvida" (T-436) **some**, absorvido por "não casou": uma ida a
menos ao modelo por pergunta sem métrica, e uma decisão em vez de duas.

### O custo, e por que ele cai

Dos ≈25 mil tokens de entrada de uma composta, ≈23 mil são o prefixo estável —
a instrução mais os esquemas de ferramenta, cada um com o enum dos 145 ids.
Leitura de cache da Anthropic é cobrada a 0,1×.

| cenário                                | % composta | apresentação de 250 perguntas |
| -------------------------------------- | ---------: | ----------------------------: |
| por sinais (antes)                     |       ~30% |                        ≈US$ 8 |
| laço por padrão, sem cache             |       ~85% |                     ≈US$ 13,5 |
| **laço por padrão, com cache (T-438)** |       ~85% |                    **≈US$ 4** |

Por isso T-438 subiu para P0 e entrou **antes** da virada. A latência continua
sendo o custo real (~7 s contra ~3 s), e as mitigações já existem: a prévia põe
número e gráfico na tela na primeira leitura, o andamento narra cada uma, e o
atalho continua cobrindo o que uma plateia clica — os botões do guia.

Três das 39 sugestões passaram a ir ao laço, cada uma por uma palavra de
conteúdo que o catálogo não declara ("quadro", "ensino", "maiores"). Estão
nomeadas em `chat-roteamento.test.ts` para a lista não crescer sem alguém ver;
encurtá-la é declarar o sinônimo no catálogo.

## A forma segue a pergunta

Três achados obrigaram a mexer em coisas dadas como intocáveis:

1. **`REGRAS_DE_NUMERO` proibia lista.** O último item dizia "sem título, sem
   lista com marcadores", e os dois prompts o embutiam: nenhum podia autorizar
   uma lista. As quatro regras de número ficam byte a byte; a regra de forma
   saiu para `REGRAS_DE_FORMA`.
2. **`inspetor.ts` barrava `"colaborador":`.** Uma consulta com coluna de
   pessoa mataria o laço em silêncio — inclusive a que Produto pediu por
   escrito. Agora barra CPF, matrícula, nascimento, banco, PIX e sindicato por
   nome de campo, e CPF e e-mail por forma em qualquer campo.
3. **`recusaUtil` mentia.** Uma resposta vinda só da consulta não tem métrica
   do catálogo, e o código caía em "Sem o modelo configurado, respondo uma
   métrica por vez" — numa resposta bem-sucedida, com o modelo presente.

A instrução nova manda responder a pergunta **na primeira frase, com as
palavras dela**, e escolher o tamanho pelo que se pediu: um número em uma a
três frases; uma lista quando pediram lista, um item por linha; causa em dois
parágrafos; continuação em uma frase. "Traduzindo", a comparação com juros e o
parágrafo do gráfico viram **opcionais**, e entra uma proibição explícita:
nenhuma frase que anuncie o que falta — "não há comparação disponível com taxas
de juros" —, salvo quando o dado que falta **é** a resposta.

O texto montado perde três linhas pela mesma razão: `Fórmula:` e `Referências:`
já estão no rodapé da bolha, e `Sem comparação com juros:` é a versão montada
do que se está proibindo.

## A checagem de pertinência

O verificador de RF-15 prova que todo número existe no envelope. Nada provava a
outra metade: que o envelope tem a ver com o que se perguntou.

`relevancia.ts` é determinístico, sem chamada de modelo, e tem três camadas. A
primeira sozinha reprova as três respostas do print: **a forma da pergunta
exige um tipo de evidência** — quem pergunta "a maior", "quais" ou "o que são
esses" pede itens, e uma métrica solta não é resposta por mais certo que o
número esteja. A segunda pega valor em reais respondido com taxa. A terceira,
cobertura de termos.

Um juiz de modelo custaria uma chamada, traria não-determinismo e seria uma
segunda coisa a explicar a quem acabou de ouvir que o verificador é
determinístico — e a versão determinística já pega os casos reais.

**No atalho, reprovar escala a pergunta ao laço**: é correção de rota, e a rede
de segurança para a regra do resto errar. **No laço, reprovar não bloqueia o
texto**: RF-15 já é quem bloqueia, e um segundo bloqueador só produziria mais
recusa. Fica `resposta_irrelevante` no registro, e a frequência medida diz se o
vocabulário de leitura precisa crescer.

## O que não muda

- O número nasce no estágio 2, e o verificador confere cada um.
- As oito ferramentas continuam fechadas e continuam preferidas.
- O caminho sem gateway é idêntico ao de antes, caso a caso — os 308 testes de
  ponta a ponta passaram sem uma única alteração de expectativa.

## O que fica pendente

- A taxa de `resposta_irrelevante` em produção: é ela que diz se a camada 1
  está calibrada, e se as três sugestões que foram ao laço devem virar sinônimo
  no catálogo.
- A latência da composta por padrão, medida na sala, com o cache ligado.
- "Por que" continua sem ferramenta. Se um dia houver decomposição de variação,
  a regra de `causa` no atalho é a primeira a rever.
