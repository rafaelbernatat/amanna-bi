# Camada semântica

*PRD seção 8.1 · seção 9.4 · princípio P3*

O catálogo de métricas: rótulo, fonte, fórmula, unidade, grão, sentido de
"bom/ruim", meta e sinônimos. É onde a definição de cada número vive — e onde a
divergência entre áreas vira uma decisão registrada em vez de um ajuste
silencioso.

| Responsabilidade | |
|---|---|
| Faz | Declara o que cada métrica significa e como se calcula; valida o catálogo no build |
| Não faz | Executa consulta, formata para pt-BR, conhece React ou Next |
| Muda ao conectar o banco? | **Só o mapeamento** (seção 10.3) |

Toda métrica cuja definição tenha sido discutida carrega o campo `decisao`
obrigatório (seção 9.4). Fórmula não é configurável: princípio P3 e RF-04.

Ocupada por T-112, T-113 e pelo mapeamento de F2.
