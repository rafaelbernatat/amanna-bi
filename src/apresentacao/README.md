# Camada de apresentação

_PRD seção 8.1 · princípio P1 · princípio P3_

Telas, painéis, filtros e chat. **Recebe números já calculados e formatados** —
não lê dado, não deriva valor, não escala número.

| Responsabilidade          |                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------- |
| Faz                       | Renderiza o que a camada de acesso devolveu, no vocabulário visual fechado do Anexo A.1 |
| Não faz                   | Consulta a fonte, calcula, arredonda, aplica fator de escala ou esconde a fórmula       |
| Muda ao conectar o banco? | **Não.** Essa é a prova do princípio P1                                                 |

A regra que essa pasta existe para tornar verificável: nenhum componente daqui
importa uma implementação concreta de fonte de dado. O acesso chega pela
interface `DataSource`, resolvida pela fábrica da camada de acesso.

## A fronteira de cliente

Duas pastas, e só duas, declaram `"use client"`: `graficos/`, porque a
biblioteca de gráficos desenha no navegador (D-D4), e `chat/`, porque uma
conversa é estado que muda a cada tecla e sobrevive à navegação
(D-CHAT-conversa-flutuante). Um teste de arquitetura confere que a fronteira
não vaza para o resto. O chat manda a pergunta para `/api/chat` e desenha o
que volta; o número nasce no servidor, no estágio 2, e o verificador confere o
texto antes de ele sair de lá.

Ocupada por T-124 a T-134 (tema, shell, filtros, núcleo SVG, painéis e estados)
e pela conversa do chat.
