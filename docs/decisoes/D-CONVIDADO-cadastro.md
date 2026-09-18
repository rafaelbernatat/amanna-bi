# D-CONVIDADO-cadastro — quem escaneia o QR diz quem é, faz cinco perguntas em cinco horas, e o interesse fica gravado

|                  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Decisão**      | Quem entra pelo QR informa **nome e e-mail** antes da primeira pergunta; os dois ficam em `amanna.convidado`, chaveados pela sala e pelo dispositivo da sessão. A conversa dá **cinco perguntas**, contadas no banco; na sexta, e quando a sessão vence — **cinco horas** depois de entrar —, abre o convite da Dreamy, e o clique fica gravado. O público fica **no chat**: tela do painel leva de volta à conversa. O primeiro nome vai ao modelo; o e-mail nunca. |
| **Responde**     | O pedido de Produto (2026-09-18): _"ao ler o QR code o usuário precisa preencher nome e email… registre todos… trava de no máximo 5 perguntas… popup 'Gostou desta solução? Clique aqui e saiba como aplicar na sua empresa'… quem clicar deve registrar… utilize o nome do usuário… remova 'Nova conversa'… timer para expirar em 5 horas"_ · PRD seção 11 · D-CONVITE-apresentacao · T-324 (retenção de dado pessoal)                                              |
| **Quem decidiu** | Rafael Lang, por Produto (o pedido; o público só no chat); Engenharia, pelo desenho sem cookie novo e pela cota no banco                                                                                                                                                                                                                                                                                                                                             |
| **Altera**       | D-CONVITE-apresentacao: "nenhum nome, nenhum identificador de pessoa" passa a valer **no envelope** — a pessoa mora no cadastro; `CAMINHOS_PUBLICOS` ganha `/api/interesse`; o público entra por cinco horas, e não pelo prazo inteiro do convite; `auditor` pelo QR não navega pelas telas                                                                                                                                                                          |
| **Data**         | 2026-09-18                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

---

## O problema

A apresentação por QR foi desenhada para uma plateia anônima: sala, perfil e
prazo no envelope, e **de propósito** nenhum nome. Produto agora quer o
contrário em três pontos — saber quem entrou, limitar o quanto cada pessoa
usa, e transformar o fim da conversa num convite comercial. É uma mudança de
política, e por isso é uma decisão escrita, não um ajuste.

## A decisão

### O passe é o aparelho; o cadastro é a pessoa

Nenhum cookie novo. A sessão de convite continua sendo `{sala, perfil,
dispositivo, expira}`, sem nome — o QR fica projetado numa parede. O cadastro
é uma linha em `amanna.convidado` chaveada por `(sala, dispositivo)`: quem tem
o passe tem o cadastro, e a página de `/conversa` lê os dois na mesma
requisição. O nome existe em `src/acesso/sessao.ts` (`registrarConvidado`) com
outro sentido — o leitor do passe —; aqui "convidado" é a pessoa cadastrada, e
o módulo próprio (`src/convidados/`) deixa isso separado.

### Onde mora, e por que fora de `src/acesso`

`src/convidados/` é estado que o produto grava, como `src/marca/`: a camada de
acesso não escreve. O adaptador de Postgres recebe um `ClientePostgres`, aplica
o DDL uma vez por instância na primeira gravação (a migração
`011_convidados.sql` é o mesmo texto, conferido por teste), e nunca põe o
e-mail no texto da consulta. A escolha é **Postgres quando há `DATABASE_URL`**,
memória quando não há — sem variável nova: a lista vai para onde o banco está,
e o arnês zera a variável para ficar em memória.

### Cinco perguntas, contadas no banco

`UPDATE … SET perguntas = perguntas + 1 WHERE … AND perguntas < $3 RETURNING`:
uma instrução, atômica entre instâncias — a memória do processo contaria cinco
por instância. A cota é conferida **depois** do corpo do pedido, para um
pedido malformado não custar uma pergunta. Toda resposta admitida leva
`x-perguntas-restantes`; a sexta responde 429 com `motivo:
"limite_de_perguntas"` e sem `retry-after`. Uma pergunta cujo fluxo termina em
falha conta — limitação escrita, sem estorno.

Quem apresenta, e o modo `fixtures` sem convite, não têm cota: `lerVisitante`
só devolve o público do QR, **pelo perfil**, nunca só pelo prefixo do sujeito
— a sessão por senha também é `convite:<sala>:<dispositivo>`.

### Cinco horas

`decidirEntrada` limita a sessão do público a `min(prazo do convite, agora +
5 h)`. Um só prazo, aplicado por `verificarSessao` em toda leitura: `/api/chat`
responde 401, e a conversa abre o mesmo convite. O relógio do celular abre o
convite no instante certo sem esperar um pedido.

### O convite da Dreamy e o clique

Um diálogo modal na conversa, com as palavras de Produto, na sexta tentativa
(antes de enviar: a pessoa vê o convite, não uma recusa) e ao vencer. O link é
um `<a>` para `https://www.dreamy.app.br` — navegação não é regida pela
política de segurança —, e o clique sai por `fetch` para `/api/interesse`, na
própria origem, com `keepalive`. A rota é **pública**: o clique após vencer não
tem sessão, e identifica o convidado pelo id sorteado do cadastro, com a origem
conferida. Responde 204 sempre que o pedido tem forma: id desconhecido não
vira oráculo. Fechar o diálogo tranca a conversa, com o mesmo link no rodapé.

### O público fica no chat

Decisão de Produto. `decidirAcesso` manda tela do painel de volta à conversa e
nega `/api/*` fora da lista; o layout do painel confere de novo, porque o
prefetch pula o proxy e o arnês `fixtures` o deixa seguir. "Nova conversa" sai
do modo `cheio`: no celular a conversa é a apresentação.

### O primeiro nome vai ao modelo; o e-mail nunca

Na mensagem de **usuário**, como "Quem pergunta: Ana". A instrução de sistema
do laço continua exata, e o inspetor continua exigindo isso. É dado pessoal
saindo para o provedor do modelo, e por isso é o mínimo: o primeiro nome, uma
vez. O e-mail não chega nem ao navegador.

### LGPD

Consentimento escrito sob o formulário — _"Ao entrar, você autoriza a Dreamy a
guardar seu nome e e-mail para falar com você sobre esta solução."_ —, com a
finalidade dita. Aprovação e migração em H-71; retenção em T-324.

## O que não muda

- O envelope da sessão e o proxy como negação cedo, não como controle.
- O perfil `auditor` para o público, e o que ele não pode (marca, apresentar).
- O verificador, o número nascendo no estágio 2, o que sai do ambiente.
- Quem apresenta: entra por senha ou por link, navega por tudo, sem cota.
- O arnês de ponta a ponta continua em `fixtures`; escanear o QR ali já
  produz uma sessão de convite, e é assim que a porta do cadastro é testada.

## O que fica pendente

- **H-71**: aprovar o consentimento e rodar `011_convidados.sql` em produção.
- **T-324**: retenção e expurgo dos convidados; até lá nada é apagado.
- Exportar a lista de interessados para Produto (hoje é `SELECT` no Supabase).
- Em memória (Preview sem banco), a cota é por instância e o cadastro pode
  sumir num reinício: a tela mostra a porta de novo. Produção é Postgres.
- A pergunta que termina em falha conta uma das cinco.
