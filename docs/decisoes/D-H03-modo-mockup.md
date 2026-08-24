# Modo mockup — dado fictício libera a construção das telas

|                       |                                                                                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Decisão**           | O dado pode ser **fictício e escolhido pela Engenharia** enquanto o objetivo for aprovar gráficos e telas. A cadeia de fixtures, adaptador, KPIs e painéis deixa de esperar a errata do Anexo C. |
| **Responde**          | INSTRUCOES.md H-03 (parcial) e H-08 (parcial) · PRD Anexo C · T-110, T-111, T-113, T-114, T-119                                                                                                  |
| **Quem decidiu**      | Rafael Lang, por Produto                                                                                                                                                                         |
| **Data**              | 2026-08-24                                                                                                                                                                                       |
| **Como foi decidido** | Produto abriu a aplicação, viu as 13 telas vazias, e respondeu por escrito: _"Os dados podem ser fictícios por enquanto, apenas para aprovação dos gráficos e telas. Considere como um mockup."_ |

---

## O que estava travado

As 13 telas subiam com barra lateral, cabeçalho, cinco filtros e banner de
recorte — e **nenhum dos 71 painéis**. A cadeia inteira parava num item humano:

```
painel na tela  ←  T-131 componente  ←  T-115 getKpis  ←  T-114 adaptador
                                                        ←  T-110/T-111 fixtures  ⛔ H-03
```

**H-03** existe porque os números do Anexo C do PRD não fecham entre si, e
modelar fixtures contra números contraditórios produz uma base de teste que
nasce errada. O item pede que Produto e Controladoria assinem a errata primeiro.

## A decisão

Enquanto o objetivo for **aprovar a aparência e o comportamento das telas**, o
valor exibido não precisa ser o valor certo — precisa ser um valor coerente. A
Engenharia escolhe os números, e a escolha fica registrada.

## O que isto autoriza, e o que não autoriza

|     |                                                                                        |
| --- | -------------------------------------------------------------------------------------- |
| ✅  | Modelar fixtures com números escolhidos pela Engenharia                                |
| ✅  | Preencher o catálogo de métricas com fórmula, unidade, agregação e sentido provisórios |
| ✅  | Construir adaptador, KPIs, painéis e as 13 telas sobre esses números                   |
| ❌  | Escrever que uma métrica foi **aprovada** por Controladoria ou por RH                  |
| ❌  | Fechar o dataset de referência (T-146) ou a sessão de catálogo (T-189)                 |
| ❌  | Declarar zero divergência com o fechamento contábil (objetivo O3)                      |
| ❌  | Substituir credencial, chave de API ou acesso de rede por valor de exemplo             |

A linha que separa as duas colunas é simples: **inventar um número é permitido;
inventar uma assinatura não.** Um número fictício declarado como fictício é um
mockup. Uma aprovação inventada é uma mentira sobre quem se responsabiliza pelo
número — e é o defeito que este produto existe para eliminar.

## A regra que os números fictícios obedecem

Serem inventados não os deixa livres. Eles precisam **fechar entre si**, porque
é isso que a suíte de contrato verifica e é isso que faz a tela ser um teste
honesto da tela:

1. `soma(Unidade SP) + soma(Demais unidades) = soma(Consolidado)` para toda
   medida aditiva;
2. a soma das 7 áreas é igual a `Todas`;
3. toda identidade contábil do Anexo C fecha — headcount de dezembro é saldo
   inicial mais admissões menos desligamentos, ciclo é PMR mais PME menos PMP,
   desvio é realizado menos orçado;
4. taxas são recalculadas do numerador e do denominador, nunca somadas.

Um mockup que não fecha não serve nem de mockup: o painel some com o KPI e a
divergência aparece na reunião de aprovação, que é justamente onde ela não pode
aparecer.

## O que já se sabe que não fecha no Anexo C

Medido antes de escrever qualquer fixture. Estas três divergências passam a ser
escolha registrada da Engenharia, e **a lista de baixo é o material pronto da
reunião de H-03** — o trabalho de reconciliação foi feito, falta a assinatura.

| Linha do Anexo C | O que o texto diz                                | O que a conta dá              | Escolha para o mockup                                                       |
| ---------------- | ------------------------------------------------ | ----------------------------- | --------------------------------------------------------------------------- |
| Headcount (dez)  | `1.240 FTE = 1.150 + 241 admissões - 145 saídas` | 1.150 + 241 - 145 = **1.246** | Manter 1.240 em dezembro e derivar o saldo inicial: **1.144**               |
| Turnover 12m     | `18,4% = saídas 12m / headcount médio`           | 145 / ~1.192 = **12,2%**      | Manter as 145 saídas e derivar a taxa: o 18,4% do texto exigiria 219 saídas |
| Demais linhas    | —                                                | fecham                        | Reproduzidas como estão                                                     |

As linhas que fecham foram conferidas: receita líquida 1.412 - 212 = 1.200;
ciclo 52 + 75 - 51 = 76; desvio 1.196 - 1.140 = 56.

## Onde isto aparece no código

Todo artefato construído sob esta decisão diz que foi construído sob ela. O
catálogo traz o campo `decisao` marcado como provisório em vez de citar uma
aprovação; as fixtures trazem no cabeçalho o vínculo com este documento.

Quando H-03 e H-08 forem resolvidos de verdade, o que muda são **valores**, não
estrutura: as telas, os painéis e a suíte já estarão de pé, e a troca é de
números — que é exatamente o que a seção 8.1 do PRD promete ao separar as três
camadas.

## Efeito nos itens humanos

| Item     | Como fica                                                                                                                                            |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **H-03** | Continua aberto, e continua segurando **T-146** — o dataset de referência fechado e a errata assinada. Deixa de segurar T-110, T-111, T-114 e T-119. |
| **H-08** | Continua aberto, e continua segurando **T-189** — a sessão de aprovação do catálogo. Deixa de segurar T-113.                                         |
| Demais   | Inalterados. Nenhum valor fictício substitui chave de API (H-28), acesso de rede (H-15) ou view de cliente (H-18).                                   |
