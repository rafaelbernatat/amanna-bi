# Camada de acesso

_PRD seção 8.1 · seção 8.3 · RF-20_

O adaptador. Recebe uma `Query` e devolve séries e agregados. **É a única
camada que muda ao conectar o banco.**

```
DATA_SOURCE=fixtures    # desenvolvimento e demonstração
DATA_SOURCE=warehouse   # produção
```

| Responsabilidade          |                                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------------------- |
| Faz                       | `getMeta`, `getKpis`, `getPanel`, `getMetric` — as quatro únicas portas de leitura (seção 9.1) |
| Não faz                   | Formata para exibição, arredonda, conhece tela; devolve zero no lugar de vazio (princípio P4)  |
| Muda ao conectar o banco? | **Sim — só ela**                                                                               |

Uma variável de ambiente troca a implementação por uma fábrica única, e nenhuma
tela muda. A suíte de contrato roda idêntica nos dois modos: é isso que prova
que o princípio P1 está de pé, e não apenas escrito.

Ocupada por T-106, T-114 (fixtures) e pelo adaptador de warehouse em F2.
