# D-CONVITE-apresentacao — cinquenta pessoas entram por um QR, cada uma com a própria conversa

|                  |                                                                                                                                                                                                                                                                                                                            |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Decisão**      | Um terceiro provedor de sessão, `convite`: um link assinado (HMAC) vira QR na tela do apresentador, cada celular que escaneia recebe um cookie de sessão com dispositivo próprio, perfil de leitura e o prazo do link. A conversa abre em `/conversa`, em tela cheia, com o gráfico na bolha.                              |
| **Responde**     | O pedido de Produto: _"quero apresentar isso para umas 50 pessoas, e em algum local da tela quero abrir um QR code que ao escanear abre o chat no celular de cada um... cada pessoa deve ter uma instância separada pra não dar conflito nas conversas"_ · PRD seção 11 (quem é a sessão), RF-23 · T-344 em forma reduzida |
| **Quem decidiu** | Rafael Lang, por Produto (2026-09-17); Engenharia, pelo desenho do envelope e pelos limites                                                                                                                                                                                                                                |
| **Altera**       | `AUTH_PROVIDER` ganha um terceiro valor. A trava que recusa `fixtures` na frente de dado real **não** muda: ela mira o modo que escolhe perfil por variável de ambiente, e não este.                                                                                                                                       |
| **Data**         | 2026-09-17                                                                                                                                                                                                                                                                                                                 |

---

## O problema

O produto tinha dois provedores de sessão: `fixtures`, que escolhe o perfil por
variável de ambiente e é recusado na frente de dado real, e `oidc`, que não
existe (T-221). Para apresentar com a base Amanna carregada, nenhum dos dois
serve — e cadastrar cinquenta pessoas numa reunião de uma hora não é uma opção
que alguém aceite.

## A decisão

**Autenticação de apresentação**, e o nome importa. Quem tem o link entra; o
link vence em horas; o perfil é de leitura. Não é identidade: um portador de
link não é uma pessoa identificada, e o produto não finge que é — o sujeito da
sessão se chama `convite:<sala>:<dispositivo>`, e quem ler a trilha vê isso.

Isto **não substitui o OIDC** para um cliente de verdade. É o que permite uma
demonstração com dado real sem inventar um cadastro.

### Duas portas, uma sessão

Quem apresenta digita uma senha; a plateia aponta a câmera. As duas portas
emitem **o mesmo envelope** de sessão, e daí para a frente o produto não sabe
por qual delas a pessoa entrou.

A porta por senha nasceu depois, de um problema concreto. Enquanto a única
entrada era o link assinado, quem apresenta precisava de um terminal para
gerar o link, o token viajava na barra de endereços — que a entrada tinha que
apagar em seguida — e, o pior, `CONVITE_SEGREDO` tinha que ser **idêntico** na
máquina que assinava e no servidor que conferia. Essa igualdade entre dois
lugares foi a origem de todo erro de configuração da primeira publicação:
segredo gravado vazio, segredo diferente, segredo certo mas sem novo build.

Com a senha, o segredo volta a ser o que deveria ter sido desde o começo: uma
chave que o servidor usa **consigo mesmo**. Ninguém de fora precisa conhecê-la,
e o que uma pessoa precisa saber é algo que ela mesma escolheu.

`SENHA_DO_PAINEL` liga a porta. Sem ela, a tela de entrada volta a ser só o
cartão do QR.

**A comparação é de tempo constante.** `===` vaza o tamanho do prefixo
acertado pelo tempo de resposta, e com pedidos suficientes isso reconstrói a
senha caractere a caractere. As duas entram em SHA-256 e a comparação soma as
diferenças de todos os bytes antes de decidir.

**Seis tentativas por endereço por minuto**, o que transforma "oito
caracteres" em algo defensável. Não cobre um adversário com muitos endereços,
e não pretende: contra isso valem o tamanho da senha e o prazo da
apresentação. Acertar zera a contagem, senão quem digita errado cinco vezes
fica trancado do lado de dentro.

**Senha errada e senha vazia saem com o mesmo motivo.** Distinguir as duas
entrega um oráculo de graça a quem está chutando.

**O que isto não é.** Não é identidade: uma senha compartilhada diz que alguém
a conhece, não quem é. Não há trilha por pessoa, não há revogação individual, e
quem sai da empresa continua sabendo a senha. Para um cliente de verdade o
provedor é o OIDC (T-221).

### Apresentar não é entrar

O painel abre do jeito que a instalação escolheu. O QR é um botão dentro dele.

A primeira versão amarrou as duas coisas: o botão só existia com
`AUTH_PROVIDER=convite`, e por isso quem ia apresentar tinha de entrar por link
no próprio painel antes de poder gerar o QR da plateia. Produto pediu o
contrário, e com razão: _"abra o dashboard e tenha um botão para as pessoas
escanearem"_. Duas perguntas diferentes tinham virado uma.

Agora são duas de novo:

- **`AUTH_PROVIDER`** responde _"como esta instalação sabe quem entrou"_.
  Continua com três valores, `convite` inclusive — é a porta que segura dado
  real enquanto o OIDC não existe (T-221).
- **`CONVITE_SEGREDO`** responde _"esta instalação abre uma sala?"_. Havendo
  segredo para assinar, o botão do QR aparece para quem apresenta, em qualquer
  modo de sessão, e quem escaneia entra em qualquer um deles.

Quem entrou por convite apresenta dentro da **própria sala**, com o próprio
prazo: o QR não sobrevive ao acesso de quem o gerou. Quem abriu o painel direto
apresenta na sala padrão, com prazo contado de agora. A sala tem nome fixo
porque é a unidade do teto de tokens do chat — sorteá-la a cada recarga zeraria
o teto que existe para não deixar a conta crescer.

### O passe do convidado vem antes do provedor

`getSession` tenta o cookie do QR **antes** do provedor da instalação. A ordem
é a decisão: sem ela, cinquenta pessoas entrariam com o perfil de quem
apresenta — permissão de configurar a marca e um sujeito só para a sala
inteira, que é exatamente o conflito que Produto pediu para não haver. Com ela,
cada celular lê como `auditor`, com identificador próprio, mesmo numa
instalação que para todo o resto entra por outro caminho.

Quem apresenta não tem esse cookie: ele nasce do outro lado do QR. Quem
escanear o próprio código no navegador do painel vira plateia até o passe
vencer — o desenho funcionando, não um defeito.

**O que isto não resolve.** Numa instalação aberta, o painel é aberto: quem
tiver o endereço entra. Para dado real em produção isso continua sendo
`AUTH_PROVIDER=convite` ou o OIDC, e a trava que recusa `fixtures` na frente de
`warehouse` continua de pé.

### Dois envelopes, um segredo

O **convite** vai no QR; a **sessão** é o cookie. Os dois são
`base64url(JSON).base64url(HMAC-SHA256)`, com o mesmo segredo, e cada um
declara o próprio `tipo`. Sem esse campo, colar o token do QR no lugar do
cookie daria uma sessão sem dispositivo — e a plateia inteira compartilharia
uma conversa, que é exatamente o conflito que Produto pediu para não haver.

O dispositivo é sorteado **no servidor**, na entrada: dois celulares com o
mesmo QR recebem cookies diferentes. É isso, e só isso, que separa as
conversas — o resto do produto continua sem estado de sessão.

O cookie herda o **prazo do convite**: quando o link vence, todos os celulares
vencem juntos, e ninguém fica com acesso por ter entrado cedo.

Só Web Crypto (`crypto.subtle`), porque o módulo roda no middleware, que é
runtime de borda, e no servidor. A chave HMAC é importada uma vez por segredo
e memorizada no escopo do processo.

### O middleware nega cedo, mas não é o controle

O matcher do middleware pula requisições de prefetch — está escrito na
configuração desde T-139. Uma verificação que morasse só ali serviria dado a
quem chegasse por esse caminho. Quem verifica o cookie a cada leitura é o
**provedor** (`src/acesso/convite.ts`), junto com o escopo, como qualquer
outra sessão. O middleware existe para poupar render e pôr a tela certa na
frente de quem chegou sem QR: página vai para `/entrar`, `/api/*` recebe 401.

Em `fixtures` e `oidc` o middleware não nega nada — o arnês de ponta a ponta
continua como sempre.

### Onde o arquivo do proxy mora

`src/proxy.ts`, e o lugar e parte da decisao.

O Next so carrega esta convencao quando o arquivo esta **ao lado de `app`**.
Como o produto poe `app` dentro de `src`, a raiz do repositorio nao serve — e
a forma como ela nao serve e o problema: `next build` compilava o arquivo da
raiz e `next dev` o ignorava, sem aviso, sem erro e sem uma linha de log. O
resultado era um desenvolvimento em que ninguem era barrado e nenhuma
resposta levava politica de seguranca, enquanto a suite de ponta a ponta —
que sobe um build de producao — passava verde. Os testes de unidade chamavam a
funcao direto, e por isso tambem nao viam nada.

Quem guarda isto agora e um teste de unidade sobre o disco: o arquivo existe
em `src/`, nao existe homonimo na raiz, e o export se chama `proxy`. Em 16 o
nome `middleware` esta descontinuado e virou `proxy`; a funcao e a mesma.

### O token sai da URL na entrada

`/entrar?convite=<token>` responde 303 para o destino **sem o token**. A URL
fica no histórico do navegador e vaza pelo cabeçalho de referência; o cookie é
`httpOnly`, `SameSite=Lax` (o QR é navegação de topo vinda da câmera) e
`Secure` quando há TLS.

O destino pedido passa por `destinoSeguro`: só caminho relativo de uma barra.
`//evil.example` e `https://evil.example` viram a tela padrão — um
redirecionamento aberto num link projetado numa parede é convite para outra
coisa.

### O QR é gerado aqui

A biblioteca calcula os módulos localmente e o produto desenha o `<path>`:
mandar o token a um gerador de QR de terceiro seria entregar o acesso a quem
hospeda a imagem. O que sai da função é só o atributo `d` — nenhuma marcação
de terceiro entra na página, e a política de segurança não muda.

Preto no branco, e não a cor da empresa: leitura de QR depende de contraste, e
um código na cor da marca é um código que metade da sala não escaneia. É o
mesmo princípio dos papéis que ficam fora do alcance da marca em D-MARCA.

### A conversa no celular

`/conversa?tela=rh/visao&periodo=dezembro` é uma rota só para as treze telas: a
tela vai por parâmetro. O componente de chat é o **mesmo** da coluna, em modo
`cheio` — a conversa ocupa a tela, não há botão flutuante nem Fechar, e o
gráfico que a resposta cita aparece dentro da bolha (é o mesmo envelope que a
tela grande desenha). Uma resposta que cita outra tela reescreve a URL da
própria conversa, e não navega para fora: no celular não há painel ao lado.

Um componente, e não dois: o fluxo em duas fases, a prévia com o gráfico e o
verificador são os mesmos. Moldura duplicada diverge na primeira correção.

### Limites de uso, por instância

Seis perguntas por dispositivo por minuto, trinta e duas ao mesmo tempo por
instância, e um teto de tokens por sala por dia.

A janela por minuto vale **só para quem entrou pelo QR**, e a razão é o que o
sujeito significa em cada modo: num convite ele **é** um celular, um por
pessoa; em `oidc` é uma pessoa da empresa; em `fixtures` todo mundo
compartilha o mesmo sujeito — uma janela ali mediria a suíte de testes, e foi
exatamente o que ela fez na primeira rodada, derrubando vinte e um casos de
ponta a ponta. O limite por usuário identificado é outra decisão, e continua
em T-344. Concorrência e teto de tokens valem para todos.

Os três são **por instância**:
na Vercel, cinquenta pessoas cabem em uma a três, e cada uma conta o seu — o
limite efetivo é até o triplo do escrito. Contar no Postgres acrescentaria uma
escrita por pergunta ao caminho mais quente, e o que se protege é custo de
modelo, não correção de número. `amanna.chat_uso` fica registrada como opção
(T-363).

Os tokens são contados pelo **total do processo**, lido antes e depois de cada
pergunta: somando as diferenças, o que a sala registra fecha com o que o
gateway gastou, mesmo com perguntas concorrentes. Com duas salas na mesma
instância ao mesmo tempo, o gasto vai para a sala da pergunta que terminou —
limitação conhecida, e aceitável para um teto de custo.

A rota do chat passou a conferir a origem, como as rotas de marca: um `POST`
montado por outro site gastaria a cota da apresentação alheia.

## O que não muda

- O recorte por perfil. Quem entra pelo QR é `auditor`: lê os três módulos e a
  trilha, **não** configura a marca e **não** abre a tela de apresentação.
- O número. O chat responde pelo mesmo caminho, com o mesmo verificador.
- A trava de `fixtures` na frente de `warehouse`.
- O arnês de ponta a ponta, que continua em `fixtures` e não passa por nada
  disto — exceto a tela `/conversa`, que é o que ele cobre.

## O que fica pendente

- **H-66**: gerar `CONVITE_SEGREDO` e ligar `AUTH_PROVIDER=convite` na Vercel.
- **H-67**: a proteção de implantação da Vercel precisa estar desligada em
  produção, ou o QR cai no login da plataforma antes de chegar ao produto.
  Estado não verificado — a integração desta máquina responde 403.
- **Sem revogação por dispositivo.** Rotacionar o segredo derruba todos os
  cookies de uma vez; é o botão de pânico, e é grosso de propósito. Uma lista
  de revogação exigiria estado compartilhado, que é o que este desenho evita.
- **O QR fotografado.** Quem fotografar a tela entra até o link vencer. O
  prazo curto, o perfil de leitura e o dado da apresentação são o que limita o
  dano; para dado de cliente de verdade, o provedor é o OIDC.
- **Latência do caminho composto** numa sala cheia: a prévia com o gráfico
  chega antes do texto, e é o que a plateia vê. Medir com o modelo de H-68.
