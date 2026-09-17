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

```
docs/dados/*.csv ── ferramentas/dados/carregar.mts ──▶ Postgres (esquema amanna)
                                                          │ 17 views na forma Linha*
src/acesso/postgres/cliente.ts ◀──────────────────────────┘  (único import de `pg`)
        │
src/acesso/warehouse/   → Base { views, cadastros }  lida do banco
src/acesso/fixtures/    → Base { views, cadastros }  gerada em memória
        │                              │
        └──── src/acesso/calculo/ ─────┘   o motor: recebe a Base, devolve envelopes
                        │
              DataSource (fábrica) → fronteira → telas e chat
```

`postgres/cliente.ts` é **conexão**, não porta de leitura. `src/marca` escreve
por ele porque marca é configuração da instalação, e a frase "o produto não
escreve no dado do cliente" continua literalmente verdadeira.

Ocupada por T-106, T-114 (fixtures), T-266 a T-272 (warehouse sobre a base
Amanna, D-DADOS).
