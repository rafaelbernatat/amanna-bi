# D-NAVEGACAO-menu-lateral-e-filtros-vivos — as telas do módulo num menu lateral recolhível, e filtros que aplicam sozinhos

|                  |                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Decisão**      | Os módulos continuam abas no cabeçalho. As **telas** do módulo ativo saem da tira abaixo dos filtros e vão para um **menu lateral** à esquerda, que recolhe a uma faixa de 44 px e lembra a escolha num cookie lido no servidor. Os cinco filtros **aplicam ao trocar**, depois de 300 ms de silêncio, sem botão "Aplicar". Para isso, dois arquivos da apresentação passam a ser componentes de cliente, nomeados um a um. |
| **Responde**     | O pedido de Produto (2026-09-18): _"o menu (Recursos Humanos, Financeiro e Integração) pode ficar onde está, mas o submenu (Visão Geral, Colaboradores, etc) pode virar um side menu recolhível"_ e _"os filtros devem ser dinâmicos, sem botão de aplicar… ao trocar para período de 6 meses, automaticamente os gráficos refletem esta alteração"_ · PRD seções 6.1, 6.2 e 6.6 · T-126, T-128 · T-420, T-421              |
| **Quem decidiu** | Rafael Lang, por Produto (o pedido; a faixa fina de 44 px só com o botão, aberta por padrão, lembrada no navegador); Engenharia, pelo cookie lido no servidor, pela consulta de contêiner e pelo atraso de 300 ms                                                                                                                                                                                                           |
| **Altera**       | T-126 (a tira de telas sai do cabeçalho); T-128 (o botão Aplicar sai; o argumento contra `onChange` é respondido, não ignorado); o teste de arquitetura passa a admitir dois arquivos de cliente fora de `graficos/` e `chat/`; `shell.spec` afirmava "não há barra lateral" e agora afirma a geometria nova; `marca.spec` lê a cor da marca no avatar do perfil                                                            |
| **Data**         | 2026-09-18                                                                                                                                                                                                                                                                                                                                                                                                                  |

---

## O problema

Produto viu o produto em produção e pediu duas coisas de navegação. A tira de
telas abaixo dos filtros ocupa uma linha inteira do cabeçalho para listar até
sete itens, e some no meio do resto; e o botão "Aplicar" dos filtros é um
passo a mais que ninguém espera num painel — muda o período, olha os
gráficos, e eles não mudaram.

Os dois pedidos esbarram na mesma regra da apresentação: fora de `graficos/`
e `chat/`, nada é componente de cliente (teste `graficos-arquitetura`). Um
menu que recolhe num clique e um filtro que navega ao trocar precisam de
JavaScript no navegador. A decisão é **onde** e **como** abrir essa exceção
sem abrir a porta.

## A decisão

### O menu lateral: estado no cookie, largura no CSS

- **Onde mora.** `src/apresentacao/navegacao/`: `menu.ts` (o que é puro —
  nomes, larguras, o texto do cookie), `menu-ativo.ts` (a leitura do cookie
  no servidor), `MenuLateral.tsx` (o componente de cliente) e
  `EstiloDoMenu.tsx` (a única regra de folha).
- **O que lista.** As telas do módulo ativo, com `aria-current` na atual e
  `data-teste="tela-<slug>"`. Cada link leva o recorte (seção 6.2) e descarta
  o painel destacado, exatamente como a tira fazia: `painel=orc-desvio` nomeia
  um painel de outra tela.
- **Recolhido** é uma faixa de 44 px com o botão e os **ícones das telas**,
  clicáveis, com o título no `aria-label` e no `title`; **aberto** são 220 px
  com o número e o nome do módulo e a lista com ícone e título. Começa
  aberto. (A primeira versão, do mesmo dia, deixava só o botão; Produto pediu
  os ícones à tarde — T-442.)
- **O estado vive num cookie** (`amanna-bi.menu`), gravado pelo navegador no
  clique e **lido pelo servidor** na página da tela. É isso que faz o
  primeiro quadro já sair com a largura certa: nada de menu aberto que fecha
  depois de hidratar, e o deslocamento de layout continua zero com e sem
  cookie (`cls.spec`).
- **Quando não cabe, recolhe sozinho — em CSS.** Menu e tela ficam num
  contêiner (`container-type: inline-size`); abaixo de 900 px de largura
  para a tela, uma consulta de contêiner força os 44 px e esconde lista e
  botão. É o caso da conversa aberta em 1280 px: sobram 860 para a tela, e
  um cabeçalho de três colunas não cabe com 220 a menos. Consulta de
  **contêiner**, e não de viewport, porque é a coluna que encolhe, não a
  janela. Nenhum JavaScript mede nada — o teste de arquitetura proíbe
  `offsetWidth` e companhia, e continua proibindo.
- **Por que é componente de cliente.** Recolher é um clique, e um clique não
  pode custar uma ida ao servidor. O componente não lê dado, não formata, não
  mede: recebe do servidor se começa recolhido, inverte no clique e regrava o
  cookie.
- **Tudo chega por propriedade da página, e nada por gancho de navegação.**
  A primeira versão lia `useSearchParams` sob um `Suspense`, no layout. O
  servidor mandava o menu **depois** do shell, num pedaço à parte do fluxo, e
  a tela inteira se deslocava 220 px quando ele chegava: CLS de 0,15 em 1440
  px no CI (= 220/1440), e zero na estação, porque ali os pedaços chegam
  antes da primeira pintura. Módulo, tela ativa e recorte vêm da página, que
  já os resolveu no servidor; o menu está no HTML inicial, com os links
  certos mesmo sem JavaScript. O e2e confere que ele vem antes do cabeçalho e
  de qualquer boundary pendente no HTML servido.

### Os filtros vivos: controlado, com atraso, e a URL continua o estado

- **O recorte continua sendo a URL.** Trocar um controle **navega** para a
  URL canônica do novo recorte — `rotaCom`, o mesmo escritor da página — e a
  tela inteira se refaz no servidor. Não há uma segunda fonte para o mesmo
  fato; a escolha pendente vive no componente por 300 ms e morre quando a
  navegação chega.
- **O argumento de T-128 contra `onChange`** — com um `<select>` fechado e
  em foco, cada seta dispara `change`, e cada `change` seria uma navegação e
  uma entrada de histórico — continua verdadeiro e é respondido de outro
  jeito: o controle é **controlado**, então nada é remontado e o foco fica; e
  a navegação espera um silêncio de `ATRASO_DE_APLICACAO_MS`. Ir de "12
  meses" a "Dezembro" por três setas é uma navegação, não três (medido no
  e2e). Sair do controle aplica na hora.
- **A pendência guarda a URL em que foi feita.** Vale enquanto a tela está
  nessa URL ou na que a própria barra empurrou; qualquer outra navegação —
  "Limpar", uma aba de módulo, a resposta do chat — a invalida, e o controle
  volta ao que a URL diz. Ela some **dentro da transição** que navega, junto
  com a chegada da nova URL, para o controle nunca mostrar o valor antigo
  entre a escolha e a chegada.
- **Sem rolar.** A navegação vai com `scroll: false`: o recorte mudou, a tela
  não. O tratamento de rolagem do Next também move o foco para o segmento,
  e isso tiraria o foco do controle que a pessoa está usando.
- **Sem JavaScript, ainda funciona.** O `<form method="get">` continua sendo o
  mecanismo de fundo, com um botão em `<noscript>`. O e2e roda um contexto
  com script desligado e prova o envio.
- **A barra avisa que está aplicando** por `aria-busy` e por um aviso que
  muda de visibilidade, não de presença — o deslocamento de layout aqui é
  zero (T-129).

### Dois arquivos de cliente, e não duas pastas

O teste de arquitetura passa a ter uma lista nomeada, `ARQUIVOS_DE_CLIENTE`,
com `filtros/BarraDeFiltros.tsx` e `navegacao/MenuLateral.tsx`. Cada um deve
declarar `"use client"` e **não pode** importar `next/headers`. A lista é a
fronteira: crescer nela é decisão escrita, não conveniência. O README da
apresentação diz o mesmo em prosa.

### A sonda de cor da marca

`marca.spec` media a cor da marca no botão Aplicar, em sete pontos. O botão
saiu; a sonda passa a ser o avatar do perfil no cabeçalho (`avatar-do-perfil`),
um círculo pintado com `MARCA.marca`, que existe em toda tela e não depende
de nenhum estado.

## O que não muda

- A URL como único estado do recorte, a canonização e os avisos de T-127.
- Os módulos como abas no centro do cabeçalho, levando a primeira tela do
  módulo no mesmo recorte (T-126).
- Nenhum arquivo da apresentação lê dado, calcula, formata ou mede largura.
- O chat, a conversa em coluna e a apresentação por QR.

## O que fica pendente

- **PRD seção 6.1** descreve as telas como tira de abas; esta decisão
  registra a mudança e pede a revisão do texto.
- Dois controles trocados em sequência **durante** uma navegação em voo
  podem mostrar, por um round-trip, o valor anterior — a pendência foi
  invalidada pela chegada da primeira navegação e reaplicada pela segunda.
  Sair do controle aplica na hora e reduz o caso; se aparecer na prática,
  o remédio é enfileirar as pendências, não tirar o atraso.
- No contêiner estreito o menu recolhe e o botão some, mas os ícones ficam:
  expandir num espaço que não cabe seria um botão que não faz nada. Se
  Produto quiser abrir sobre a tela nesse caso, é outra decisão.
