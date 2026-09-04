# D-CHAT-conversa-flutuante — o chat como conversa, e os módulos como abas

|                  |                                                                                                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Decisão**      | O chat é um botão flutuante que abre uma **conversa** encostada à direita da tela; a conversa continua entre perguntas e entre telas; cada resposta filtra a tela e destaca o gráfico; os três módulos viram abas no cabeçalho |
| **Responde**     | PRD seção 6.1 (navegação), 6.5 (destaque), 6.6 (URL), 7.2 (`actions`, `undo`), 7.6 (sugestões), 7.7 (recorte implícito) · RF-13, RF-14, RF-17 · T-319, T-327, T-331, T-332, T-339, T-340                                       |
| **Quem decidiu** | Rafael Lang, por Produto                                                                                                                                                                                                       |
| **Data**         | 2026-09-03                                                                                                                                                                                                                     |
| **Altera**       | Seção 6.1 do PRD, que descreve uma barra lateral fixa. O protótipo já traz o chat como botão flutuante com log de conversa; a tela passa a segui-lo.                                                                           |

---

## O que Produto pediu

Quatro coisas, ditas de uma vez:

1. o chat num **botão flutuante**, e funcionando **como um chat** — as conversas
   seguem e continuam;
2. **atalhos** para perguntas sobre o tema do que está sendo conversado;
3. o painel **filtrado e destacado** conforme o que se pergunta, para a pessoa
   ver o gráfico certo;
4. os três módulos (RH, Financeiro, Integração) como **abas centralizadas na
   mesma tela**, e não num menu lateral.

## O que muda

### O chat vive no navegador; o recorte continua na URL

Até aqui a pergunta ia na URL (`?pergunta=`), o servidor respondia dentro da
página e a "conversa" era uma pergunta de cada vez. Uma conversa de dez turnos
não cabe num link legível, e a seção 6.6 nunca pediu isso: o que ela põe na URL
é **filtros, tela e painel destacado**. É exatamente o que a resposta continua
escrevendo na URL. A conversa em si fica no navegador — em memória, com cópia
em `sessionStorage` — e sobrevive a recarregar e a trocar de tela.

Consequência de arquitetura: `src/apresentacao/chat/` passa a ser fronteira de
cliente (`"use client"`), a segunda depois dos gráficos. O teste de
arquitetura que confinava a fronteira aos gráficos passa a admitir as duas
pastas. O que vale para os gráficos vale para o chat: **não lê dado, não
calcula, não formata além de `formatarValor`**. O número nasce na rota
`/api/chat`, no estágio 2, pelo mesmo caminho de sessão e fronteira de perfil
da tela (seção 11); o verificador confere o texto antes de ele sair do
servidor (RF-15).

### A conversa encosta, não sobrepõe

Aberta, a conversa é uma coluna própria à direita, e a tela encolhe para
caber ao lado. O protótipo a desenha sobreposta, e esta decisão diverge dele de
propósito: sobreposta, ela cobre o painel que a resposta acabou de destacar —
o gráfico fica atrás da conversa que fala dele, e o pedido 3 deixa de ser
verdade. O botão flutuante, fechado, é o do protótipo.

### A resposta chega em duas fases

A rota escreve uma linha de JSON por fase (NDJSON): a **prévia** assim que o
número existe — rótulo, valor, e as ações de tela —, e a **resposta** quando o
texto passa pelo verificador. A tela reage à prévia: filtros e painel
destacado vão para a URL, o painel rola até a vista, e a pessoa vê o gráfico
enquanto o modelo ainda escreve. É a primeira metade de T-339 (o gráfico antes
do texto), sem o gráfico dentro do chat — ele está na tela, ao lado.

### "E em dezembro?" herda a métrica anterior

Os turnos anteriores (pergunta e métrica, nada mais) viajam com cada pergunta.
O modelo os recebe junto da pergunta, no `user`, para o `system` continuar
sendo o prefixo estável do cache (7.4). O caminho local aplica uma regra
determinística: continuação herda a métrica anterior quando a pergunta troca
ao menos um filtro e, tirado o recorte, não nomeia métrica nenhuma. "E a
margem em dezembro?" **não** herda — a pessoa nomeou outra métrica, e o chat
pergunta qual. É T-327 pela metade que dá para provar com o conjunto de hoje.

### As sugestões são respondíveis por construção

As 39 sugestões de tela (RF-17) estão escritas, e um teste passa cada uma pelo
interpretador local: precisa cair numa métrica do catálogo, com confiança, e a
métrica precisa morar na tela que a sugere. As de acompanhamento saem do
**apoio** da resposta ("E lucro líquido?" depois do ROE) e do **recorte** ("E
só em dezembro?", "E na Unidade SP?"), e cada frase passa pelo mesmo
interpretador antes de ir para a tela. A sugestão fixa de antes — "como isso se
compara com o ano anterior?" — saiu: a fixture só tem 2026, e ela levava
sempre a "sem dado".

### Desfazer volta à URL de origem

Cada turno guarda a URL em que a pergunta foi feita. "Desfazer" é um link para
ela: restaura os cinco filtros **e** a tela, como o Anexo D achado 7 pede
(RF-14). "Ver o gráfico" é o link para o destino, útil quando a pessoa já
navegou para longe.

### Os módulos são abas no cabeçalho

A barra lateral saiu. Os três módulos são uma tira de abas centralizada na
primeira linha do cabeçalho, com a marca à esquerda; a tira de telas do módulo
fica abaixo do título, como antes. Trocar de módulo continua levando à primeira
tela dele, no mesmo recorte (6.1 e 6.2). A tela ganhou a largura da barra.

## O que não muda

- Os três estágios da seção 7.1 e o verificador de RF-15. A rota é uma porta a
  mais para a mesma orquestração; `perguntar` continua sendo a função.
- O recorte por perfil no servidor (seção 11). A rota lê pela mesma
  `leitura.ts` da tela; fora do perfil vira `sem_permissao`, sem agregado.
- A URL como estado compartilhável (6.6). `?pergunta=` continua aceito como
  entrada — um link que chega perguntando —, mas a tela não o escreve mais.

## O que fica pendente

- **A revisão da seção 6.1 do PRD** ("barra lateral fixa"). Este documento
  registra a decisão; editar o PRD é da próxima versão do documento.
- **T-320 por inteiro**: a rota ainda não tem limite de taxa por sessão nem
  circuito aberto por falhas seguidas. Hoje tem sessão pelo mesmo caminho da
  tela, teto de tamanho de pergunta e teto de turnos lembrados.
- **A avaliação do encadeamento (7.7)**: os 15 pares de acompanhamento do
  aceite de T-327 dependem do conjunto de 100 perguntas de T-333.
- **O gráfico dentro da conversa** (segunda metade de T-339): hoje a resposta
  aponta para o painel na tela; um gráfico próprio no chat seria o mesmo
  componente e a mesma chamada (T-312), e fica para quando houver telefone.
