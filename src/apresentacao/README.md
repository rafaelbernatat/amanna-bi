# Camada de apresentação

*PRD seção 8.1 · princípio P1 · princípio P3*

Telas, painéis, filtros e chat. **Recebe números já calculados e formatados** —
não lê dado, não deriva valor, não escala número.

| Responsabilidade | |
|---|---|
| Faz | Renderiza o que a camada de acesso devolveu, no vocabulário visual fechado do Anexo A.1 |
| Não faz | Consulta a fonte, calcula, arredonda, aplica fator de escala ou esconde a fórmula |
| Muda ao conectar o banco? | **Não.** Essa é a prova do princípio P1 |

A regra que essa pasta existe para tornar verificável: nenhum componente daqui
importa uma implementação concreta de fonte de dado. O acesso chega pela
interface `DataSource`, resolvida pela fábrica da camada de acesso.

Ocupada por T-124 a T-134 (tema, shell, filtros, núcleo SVG, painéis e estados).
