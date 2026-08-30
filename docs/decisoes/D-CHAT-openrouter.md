# D-CHAT — o gateway do chat, e a taxa de referência externa

|                  |                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------- |
| **Decisão**      | O chat fala com o modelo pelo **OpenRouter**, e a Selic vem da **API do Banco Central**     |
| **Responde**     | PRD seção 8.2 (stack), seção 7.3 (configuração do modelo), seção 11 (o que sai do ambiente) |
| **Quem decidiu** | Rafael Lang, por Produto                                                                    |
| **Data**         | 2026-08-30                                                                                  |
| **Altera**       | Decisão travada **D4**, que fixa o SDK da Anthropic                                         |

---

## O que o PRD dizia

Duas coisas que esta decisão muda:

1. **Seção 8.2**: _"IA — Anthropic SDK (`@anthropic-ai/sdk`), modelo
   `claude-opus-5`"_. É parte da decisão D4, que a seção 0 marca como travada.
2. **Seção 11**: _"só o catálogo de métricas, a pergunta e os números já
   agregados saem do ambiente"_. Uma chamada ao Banco Central é saída de rede
   que o PRD não previa.

## A decisão

**O gateway é o OpenRouter.** A chave vai em `OPENROUTER_API_KEY` e o modelo em
`OPENROUTER_MODEL`. O gateway fala o protocolo da OpenAI e roteia para o modelo
escolhido.

**A Selic vem da série 432 do SGS**, a meta definida pelo Copom, em % ao ano.

## O que **não** muda

A arquitetura de três estágios da seção 7.1 fica idêntica, e é ela que carrega
as garantias do produto:

- o modelo entra só nas pontas — interpretar e redigir;
- o número nasce no estágio 2, que é código nosso, lendo pela mesma camada de
  dados que as telas usam;
- o verificador determinístico de RF-15 continua conferindo cada número do texto
  contra o envelope, e bloqueando a exibição quando diverge.

Trocar a porta não move a fronteira. É por isso que a mudança cabe numa decisão
registrada em vez de numa revisão do PRD: o que a seção 7 protege continua
protegido.

## Por que o OpenRouter

Pedido de Produto, com uma razão operacional: uma conta só atende vários
modelos, o que deixa a escolha do modelo virar configuração — `OPENROUTER_MODEL`
— em vez de troca de dependência. Para uma instalação dedicada por cliente (D1),
isso é o mesmo princípio da seção 15: _imagem única, e toda diferença de cliente
vive em configuração_.

**O custo:** um intermediário a mais entre o produto e o modelo. A pergunta e os
números agregados passam por ele. Isso precisa estar no contrato com o cliente,
como a seção 11 já exige para o trânsito à API — e agora com um nome a mais.

## Por que a Selic, e o que sai do ambiente

A comparação com o custo do dinheiro é o que transforma um resultado em leitura:
um lucro de -R$ 8 mi diz uma coisa; o mesmo lucro num ano de Selic a 14% diz
outra, e a segunda é a que muda decisão.

**Na chamada ao BCB não vai nada do cliente.** É um `GET` sem corpo, sem
cabeçalho de identificação, para uma série pública. O que sai do ambiente é a
existência da chamada, e nada mais.

A taxa não entra no catálogo de métricas de propósito: o catálogo descreve as
métricas **da empresa**, com view de origem e fórmula. A Selic não tem nem uma
nem outra — é referência externa, e fica declarada como tal, com fonte e data de
vigência visíveis na resposta.

Falha do BCB não derruba a resposta: o chat responde sem a comparação e diz por
quê. Trocar uma resposta boa por nenhuma, porque um dado de contexto não veio,
seria o pior dos dois mundos.

## O que fica pendente

- **A revisão de D4 no PRD.** Este documento registra a decisão; atualizar a
  seção 8.2 é edição do PRD, que o laço de execução não faz sozinho
  (EXECUTE seção 11). Fica para a próxima versão do documento.
- **O contrato com o cliente.** A seção 11 exige que o trânsito para a API esteja
  escrito no contrato, não só no código. Com o OpenRouter no caminho, o nome dele
  precisa estar lá.
