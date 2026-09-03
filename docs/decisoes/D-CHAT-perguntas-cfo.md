# D-CHAT-perguntas-cfo — as 33 perguntas de CFO da Dreamy no chat

|                  |                                                                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Decisão**      | O chat responde as 33 perguntas do documento da Dreamy. O dado de demonstração cresce com balanço, dívida por linha, natureza das contas e qualidade do razão, fictícios e coerentes. |
| **Responde**     | `docs/Dreamy_Perguntas_Respostas_CFO.docx` · PRD seção 7 (chat), seção 9.4 (catálogo), seção 10.1 (views) · T-328 (envelope multi-métrica) · H-30 (conjunto de avaliação)             |
| **Quem decidiu** | Rafael Lang, por Produto                                                                                                                                                              |
| **Data**         | 2026-09-03                                                                                                                                                                            |
| **Altera**       | Nada travado. Estende a seção 10.1 com views novas e a seção 9.2 com a unidade `vezes` ([D-H60](D-H60-unidade-vezes.md)).                                                             |

---

## O que o documento pede

Trinta e três perguntas de CFO, com a resposta como ela deve sair: o número com
o período, "Traduzindo:", a comparação com CDI, Selic e IPCA, o que explica, e
a oferta do próximo passo. A premissa do documento é "IA conectada ao razão
contábil".

Cruzadas com o catálogo de 3 de setembro: **7** tinham métrica, **7** eram
parciais, **14** pediam balanço ou natureza das contas, **5** pediam o razão
lançamento a lançamento. "Qual o ROE da empresa?" era recusado — corretamente,
pelo desenho: não havia patrimônio líquido em view nenhuma.

## A decisão

**Responder todas.** Engenharia levantou que 26 não tinham dado; Produto
reafirmou o pedido. A decisão é de escopo, e vem com três escolhas:

1. **O dado de demonstração cresce.** [D-H03](D-H03-modo-mockup.md) autoriza
   dado fictício enquanto o objetivo for aprovar telas e conversas, e o Anexo C
   já é uma narrativa inventada e coerente. Balanço, dívida por linha, natureza
   das contas e qualidade do razão entram como views novas, **derivadas das que
   existem** para reconciliar por construção. Cada métrica nova nasce
   `PROVISORIO (D-H03, 2026-09-03)` e nomeia H-08.
2. **O chat não inventa número.** Continua P2 e RF-15: cada resposta sai de uma
   métrica com fórmula, lida pela fronteira de perfil; o verificador barra número
   fora do envelope. O que muda é o envelope, que passa a carregar apoio,
   referências externas e leituras — todos calculados no estágio 2.
3. **A premissa "razão contábil" vira agregados.** O grão mínimo continua área ×
   mês (seção 7.5). As perguntas de qualidade do razão (lançamentos fora do
   padrão, competência, partes relacionadas) serão respondidas por contagens e
   valores de uma view de qualidade, nunca por linha individual.

## Decisões de implementação, registradas para não voltarem

- **Ganho real pela equação de Fisher**, e não por subtração: é a conta do
  documento (Selic 14,00% e IPCA 4,44% dão "cerca de 9,1%"). A diferença aparece
  na tela.
- **Até quatro métricas de apoio** por resposta. O aceite de T-328 diz "até
  três"; a liquidez corrente do documento cita quatro números. O texto da tarefa
  acompanha.
- **"A cada R$ 100 … devolveu R$ 8,3"**: o verificador aceita a reescrita do
  valor principal em reais por base, de forma determinística, e só ela.
- **CDI líquido de IR a 15%** para o ROIC (renda fixa acima de 720 dias) e
  **benefício fiscal da dívida a 34%** (IR e CSLL do lucro real): alíquotas
  nominais, escritas como constantes. Precisam de Controladoria em H-08.
- **Sem período anterior.** A fixture só tem 2026 (2025 é T-152). As frases do
  documento que comparam com o ano anterior saem como "sem base de comparação".

## Entrega em duas etapas

| Etapa | O que entra                                                                                                                | Perguntas       |
| ----- | -------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 1     | Unidade `vezes`, referências CDI e IPCA, leituras, apoio, prompt, `vw_fato_balanco_mes`, `vw_fato_divida_mes`, 46 métricas | A, C, D1–D4: 22 |
| 2     | `vw_fato_natureza_mes`, `vw_fato_qualidade_mes`, as métricas de margem de contribuição, ponto de equilíbrio e qualidade    | B, D5–D8: 11    |

## O que fica pendente

- **H-08.** O que entra no capital investido; o corte de dias do estoque sem
  giro; juros por caixa ou competência (H-56); as alíquotas.
- **A revisão do PRD.** O Anexo B ganha as métricas de CFO na próxima versão;
  até lá, `src/chat/so-no-chat.ts` nomeia as que só o chat alcança, e um teste
  confere que cada uma é alvo de pelo menos uma pergunta.
- **O contrato com o cliente.** Quando o banco real chegar, as views novas são
  exigidas dele (seção 10.1). A conexão de F2 precisa saber disso antes de
  escrever o mapeamento.
