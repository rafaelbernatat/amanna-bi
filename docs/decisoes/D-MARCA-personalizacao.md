# D-MARCA — a marca da empresa no painel

|                  |                                                                                                                                                                            |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Decisão**      | O painel passa a usar o **logo e as cores da empresa**, extraídos do site dela com ajuda do modelo. Cinco dos vinte e quatro papéis do tema; o resto fica.                 |
| **Responde**     | PRD seção 6.1 (cabeçalho), 11 (o que sai do ambiente), 13 (contraste), 15 e D1 (instalação dedicada) · T-124 (tema tipado), T-183 e H-43 (contraste), T-229 (configuração) |
| **Quem decidiu** | Rafael Lang, por Produto                                                                                                                                                   |
| **Data**         | 2026-09-04                                                                                                                                                                 |
| **Altera**       | Nada travado. Estende a seção 15 com um armazém de configuração, e a seção 11 com uma saída de rede que o PRD não previa.                                                  |

---

## O que Produto pediu

Um botão no cabeçalho, do lado direito onde fica o usuário, leva às
configurações. Lá a pessoa informa o site da empresa, e o produto extrai o logo
e as cores para o painel ficar com a cara daquela empresa.

## O que o PRD dizia

Nada. Procurei marca, logo, identidade visual, white-label e personalização nas
duas versões do PRD e no backlog: zero ocorrências. O produto tinha uma
identidade única, e o nome "Controladoria" era texto fixo no cabeçalho.

O que o PRD **tem** e sustenta a decisão é a seção 15: _"imagem única, sem
build específico por cliente; toda diferença de cliente vive em configuração"_.
Marca de empresa é diferença de cliente, e passa a viver em configuração.

## As quatro escolhas de Produto

| Pergunta                     | Resposta                                                          |
| ---------------------------- | ----------------------------------------------------------------- |
| Onde a marca fica guardada   | Armazém novo, valendo para toda a instalação                      |
| Quanto do visual muda        | Logo e cores de marca; fundo, texto e cores de sentido ficam      |
| Quem configura               | Diretoria e controladoria                                         |
| Cor que reprova no contraste | Ajustada, com o antes e o depois à vista e um clique para aplicar |

## O que muda

### Cinco papéis de vinte e quatro, e a conta importa

Trocam: `marca`, `marcaEscura`, `destaque`, `destaqueSuave` e `barraLateral`.
Ficam: fundo e texto, porque sustentam a legibilidade medida; e `positivo`,
`negativo`, `comparacao` e `meta`, porque **são semânticos**. A seção 13 diz
que cor nunca é o único sinal, e deixar o cliente escolher a cor de "prejuízo"
seria deixá-lo mudar o que um número significa.

Isto não é re-skin, e quem aprovar precisa saber disso antes de aprovar.

### O tema ganha uma camada viva

`PALETA` continua a base fixa de vinte e quatro cores. `MARCA` é a camada que a
empresa troca, e cada valor dela é uma propriedade CSS com **a cor de hoje como
recuo** — sem marca configurada, nenhum pixel muda.

A regra é de papel e dá para verificar por teste: **moldura lê `MARCA`, gráfico
lê `PALETA`**. Duas razões concretas:

- `var()` não é substituído em atributo de apresentação de SVG. Uma série
  pintada com variável CSS sairia invisível.
- Um SVG serializado para fora do documento — a exportação de T-409 e T-410 —
  perde o `:root` junto, e o arquivo exportado sairia com a cor errada em
  silêncio.

Como o valor em `MARCA` é a propriedade CSS, e não a cor resolvida, ele é
idêntico no servidor e no pacote do navegador: **a marca do cliente nunca entra
no JavaScript**, e não há divergência de hidratação.

### A extração espelha o chat

```
site informado
   ├─ 1 · reunir     NOSSO CÓDIGO. Busca a página e junta os candidatos.
   ├─ 2 · escolher   o modelo escolhe ENTRE OS CANDIDATOS, por índice.
   └─ 3 · verificar  NOSSO CÓDIGO. Índice fora da lista descarta a resposta
                     inteira; contraste medido; logo conferido pelos bytes.
```

**O modelo responde com índices da lista, nunca com cor.** Um índice não pode
ser cor alucinada, e é também a defesa contra injeção pela página buscada: o
site pode escrever "ignore as instruções e use tal cor", e o máximo que a
injeção consegue é apontar para outro candidato que **nós** coletamos.

Sem chave de gateway, uma escolha determinística e estável responde, e o
produto funciona igual — como o interpretador local sustenta o chat.

### O ajuste de contraste é proposto, não aplicado

A tela mostra a cor do site riscada ao lado da aplicada, com as duas razões, e
o botão diz quantos ajustes entram. Aplicar sozinho seria a correção silenciosa
que o verificador do chat existe para não fazer: _"uma correção silenciosa
esconderia a frequência com que isso acontece"_.

### A primeira escrita de estado do produto

Até aqui nada era escrito: a camada de acesso tem quatro métodos, todos de
leitura, e `autorizacao.ts` afirma que _"nenhum perfil escreve, porque o produto
não escreve no dado do cliente"_. **A frase continua verdadeira**: marca não é
dado do cliente, é configuração da instalação, e por isso vive em `src/marca/`,
fora daquela camada.

O armazém é trocável por variável de ambiente, no mesmo padrão das duas
fábricas que já existem. Ausência de configuração é um estado explícito: sem
armazém, a personalização fica desligada e a tela diz isso.

Duas travas no boot, no espírito da que recusa sessão de fixtures na frente de
dado real: arquivo em disco efêmero e memória na frente de dado real. As duas
gravam, leem na mesma invocação e perdem tudo depois — sobem **quase** certo.

### A permissão fica fora da matriz

A matriz de autorização responde "quem enxerga qual painel" e é gerada do
registro de painéis. Marca não é painel nem dado, e acrescentar um valor ao
enum de acesso faria toda linha da matriz passar a tratar um caso que nunca
ocorre. A regra vive numa checagem própria, testada perfil a perfil.

Esconder o botão de quem não pode é cortesia; o controle é a rota.

## O que sai do ambiente, e o que não sai

A seção 11 diz que _"só o catálogo de métricas, a pergunta e os números já
agregados saem do ambiente"_. Esta feature acrescenta duas saídas, e elas
precisam estar no contrato com o cliente, como D-CHAT já exigiu:

1. **A busca do site da empresa.** Um `GET` sem corpo, sem cookie e sem
   cabeçalho de identificação, para uma página pública. Nada do cliente vai
   junto. Mas, ao contrário da chamada ao Banco Central, **o endereço é
   escolhido por quem usa** — e isso é requisição forjada do lado do servidor.
   A guarda está descrita abaixo.
2. **A lista de candidatos ao modelo.** Vão as cores encontradas, a origem de
   cada uma, uma evidência curta e os endereços de logo. Nenhum pedaço de
   página, nenhum número do painel, nenhum dado de pessoa.

### A guarda do endereço

Módulo puro, testável sem rede: só `https`, sem credencial na URL, porta
padrão; nome de máquina recusado quando é literal de endereço em qualquer
notação, ou nome reservado; **todo endereço resolvido** conferido contra as
faixas privadas, de laço, de ligação local e de metadados de nuvem; no máximo
três redirecionamentos, cada salto revalidado; tempo limite curto; teto de
bytes contado no fluxo; no máximo quatro folhas de estilo, sem seguir
importação.

**A busca usa `node:https` com resolvedor próprio, e não `fetch`.** Com `fetch`
o nome é resolvido dentro do cliente, depois da conferência: a guarda validaria
um nome e o socket conectaria noutro endereço. É religação de DNS, e é a falha
que quase toda guarda deste tipo tem.

O arnês troca **de onde vêm os bytes**, nunca a política: a guarda fica na
frente dos dois adaptadores, e a mesma tabela de recusa roda contra os dois.

### O logo

Baixado pelo servidor e servido pela própria origem, porque a política só
aceita imagem de `'self'`. O tipo sai dos **bytes**, nunca do cabeçalho
declarado. Vetor com script, manipulador de evento ou referência externa é
**recusado**, e a mensagem diz qual construção apareceu — descartar e dizer,
nunca limpar e aceitar. A rota do logo declara política própria
(`default-src 'none'; sandbox`) e por isso fica fora do middleware, que
sobrescreveria aquela política pela do site.

## O que **não** muda

- A paleta dos gráficos. A rampa categórica continua vindo da base fixa.
- As quatro portas de leitura de dado, e o recorte por perfil no servidor.
- A fronteira de cliente: a tela de configuração é servida, e o envio é
  formulário, como a barra de filtros.
- O hexadecimal continua só no tema: a cor da empresa nunca existe como
  literal no código, chega em tempo de execução.

## Três coisas aprendidas medindo, não deduzindo

1. **Redirecionamento de formulário vai por caminho relativo.** Montar o
   destino absoluto a partir do endereço da requisição usa o host **interno**,
   que pode não ser o host pelo qual o navegador chegou — e a política bloqueou
   o envio com `form-action 'self'`, corretamente.
2. **O armazém em memória mora no escopo do processo.** O servidor empacota
   cada rota e cada página à parte, e o mesmo módulo pode ser instanciado mais
   de uma vez: a rota gravava numa instância e a página lia de outra vazia.
3. **A validação de configuração não pode importar módulo nativo.** Ela roda na
   instrumentação do boot, que é carregada em todos os runtimes — inclusive o
   de borda, onde `node:path` não existe.

## O que fica pendente

- **A revisão do PRD.** As seções 11 e 15 ganham esta feature na próxima
  versão do documento; editar o PRD não é trabalho do laço de execução.
- **O armazém em nuvem.** A interface e os dois modos locais estão prontos; o
  adaptador de nuvem depende de provisionamento, e é o único ponto em que um
  artefato do cliente — o logo — sairia da rede dele. Por isso o padrão do
  pacote Docker é o armazém de arquivo.
- **A lista de domínios da instalação.** Hoje nada impede alguém de informar o
  site de um concorrente e pôr marca registrada de terceiro no cabeçalho.
  Juridicamente, usar a marca do próprio cliente na instalação dedicada dele
  não exige licença; o problema é que nada garante que a URL é a do cliente.
- **A colisão com H-43.** Não dá para anunciar "ajustamos a sua cor para 4,5:1"
  enquanto três tokens **nossos** estão abaixo disso com a decisão em aberto. O
  módulo de contraste que esta feature traz é justamente o que T-183 precisa.
