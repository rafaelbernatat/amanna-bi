# D-CHAT-sql — o chat consulta o banco, por um papel que só enxerga um esquema

|                  |                                                                                                                                                                                                                                                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Decisão**      | O chat ganha uma nona ferramenta que recebe SQL de leitura. Ela roda por uma **conexão própria**, autenticada como `amanna_chat_ro`, cujo GRANT existe só no esquema `amanna_chat` — views sobre o detalhe, com as colunas proibidas projetadas fora. O verificador de RF-15 fica; o resultado vira o envelope.        |
| **Responde**     | O pedido de Produto (2026-09-19): _"que o modelo de IA seja capaz de responder qualquer pergunta em relação aos dados, consultando o banco de dados — inclusive listar os nomes dos colaboradores mais caros"_ · PRD seção 7.5, seção 11 · D-CHAT-ferramentas · D-CHAT-perguntas-cfo                                   |
| **Quem decidiu** | Rafael Lang, por Produto (as quatro escolhas abaixo); Engenharia, pelo desenho da tranca                                                                                                                                                                                                                               |
| **Data**         | 2026-09-19                                                                                                                                                                                                                                                                                                             |
| **Altera**       | PRD seção 7.5: "sem SQL gerado por modelo, em nenhuma circunstância" e "sem acesso a linha individual, o menor grão exposto é área × mês" deixam de valer **para esta porta**. D-CHAT-ferramentas, cujo cabeçalho dizia "não há SQL". D-CHAT-perguntas-cfo, que mandava responder qualidade do razão só por contagens. |

---

## As quatro escolhas de Produto

| Questão                                | Decisão                                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Dado de pessoa                         | Nome, cargo, área, centro de custo, salário e custo total. CPF, nascimento, banco e sindicato continuam bloqueados. |
| Como o chat alcança o dado sem métrica | Híbrido: as oito ferramentas fechadas para as métricas conhecidas, SQL somente-leitura para o resto.                |
| Verificador                            | Mantém. O resultado da consulta vira o envelope.                                                                    |
| Formato da resposta                    | Livre, guiado pela pergunta (ver D-CHAT-pergunta-primeiro).                                                         |

## Adendo do mesmo dia: no protótipo, sem provisionar papel

Produto, depois de ler o roteiro de provisionamento: _"não precisa disso, pode
deixar todos consultarem os dados do banco, é só um protótipo e os dados são
falsos de mockup. Apenas garanta que o chat responda tudo sobre os dados, da
forma que o usuário quiser perguntar."_

Duas consequências, e as duas estão no código:

1. **`DATABASE_URL_CHAT` vira opcional.** Sem ela, a consulta usa a
   `DATABASE_URL` de sempre, e a capacidade liga sozinha com
   `DATA_SOURCE=warehouse`. O que se perde é a contenção: pela conexão de
   sempre, uma consulta que escreva `FROM amanna.…` alcança as tabelas cruas.
   O que **permanece** é o que impede estrago — só SELECT, transação
   somente-leitura, teto de linhas e de colunas, e o recorte por perfil.
2. **O esquema abre o resto do dado.** Ausências (com CID), engajamento (com o
   comentário aberto), vagas, candidaturas (com pretensão salarial),
   treinamento, horas por projeto, movimentação, notas de saída, orçamento,
   projetos, empréstimos, metas e as dimensões de cliente, fornecedor e cargo.
   O cadastro de pessoa passa a levar nascimento, gênero, escolaridade,
   sindicato, banco e motivo de desligamento.

**Uma exclusão ficou, e ela é funcional antes de ser política:** o
`cpf_ficticio` não sai em view nenhuma porque o inspetor de saída barra
qualquer resultado com forma de CPF — expor a coluna mataria o laço em
silêncio na primeira pergunta que a tocasse. CNPJ e chave de NF-e também
ficam fora, por serem identificadores longos que nenhuma pergunta de painel
quer e que só gastariam coluna e token.

**Quando o banco for de cliente real, isto se reverte preenchendo uma
variável**, e não mexendo em código: provisiona-se o papel (a migração já o
cria) e monta-se `DATABASE_URL_CHAT`. O desenho abaixo continua valendo
inteiro, e é por isso que ele foi mantido.

## A defesa é o papel, e isso foi medido

`SET LOCAL ROLE` na conexão do produto **não** serve, e a razão não é teórica.
Em PGlite 0.5.8 / PG 18.3, dentro de uma transação somente-leitura, esta única
instrução escapa:

```sql
SELECT set_config('role','postgres',false) AS a,
       query_to_xml('SELECT cpf FROM amanna.segredo',false,false,'')::text AS x
```

`set_config('role', <session_user>, false)` é incondicionalmente permitido — é
o caminho de volta à role autenticada —, e `query_to_xml` planeja a consulta
interna em **tempo de execução**, depois da escalada. Referência direta à
tabela continua barrada (o executor confere a permissão no InitPlan), mas as
funções que planejam em execução passam por cima disso.

Por isso:

1. **Uma conexão separada** (`DATABASE_URL_CHAT`), autenticada como
   `amanna_chat_ro`. Uma role que a conexão nunca teve não se recupera por
   `set_config`.
2. **`REVOKE EXECUTE`** de `set_config`, da família `query_to_*` e de
   `pg_sleep` em `PUBLIC`, com os GRANTs **devolvidos** às roles do Supabase
   dentro de um bloco `DO` guardado por `pg_roles`. A devolução é obrigatória:
   o PostgREST usa `set_config` a cada pedido, e sem ela a Data API para de
   funcionar de um jeito que parecerá não ter relação com este arquivo.
3. **Atributos no papel** — `default_transaction_read_only`,
   `statement_timeout` de 5 s, `idle_in_transaction_session_timeout` e
   `search_path` sem `amanna` —, que valem mesmo se o nosso código esquecer o
   `SET LOCAL`.
4. **O embrulho**: `SELECT * FROM (\n<sql>\n) AS resultado LIMIT $1`. O
   parâmetro obriga o protocolo estendido, em que o Postgres recusa mais de um
   comando; e `;`, `SET`, `COPY` e todo DDL são erro de sintaxe dentro de uma
   subconsulta. A quebra de linha antes do `)` impede que um `-- comentário`
   final comente o fecho.
5. **Um lint** (`sql-guarda.ts`), cujo cabeçalho abre dizendo que **não é a
   defesa**: ele existe para devolver ao modelo uma mensagem com que ele se
   corrija, antes de o banco recusar.

`LIMIT` limita o envelope, não o trabalho: uma auto-junção de 128 mil linhas
queima CPU até o `statement_timeout`, que é o único teto de verdade.

## O que o modelo enxerga

Views em `amanna_chat` sobre as tabelas cruas: o razão lançamento a lançamento,
as marcas de qualidade por lançamento, a folha e o cadastro por pessoa, títulos
a pagar e receber, caixa e as dimensões. As colunas proibidas são
**inalcançáveis** porque o papel não tem GRANT em `amanna` — e um teste sobre
`information_schema` prova que nenhuma delas aparece no esquema, sem carregar
um CSV.

**Fora, e não por esquecimento:** `ponto_ausencias` carrega `cid`, diagnóstico
por pessoa nomeada; `pesquisa_engajamento` carrega eNPS e comentário aberto por
matrícula, numa pesquisa prometida como anônima; `candidaturas` carrega
pretensão salarial e motivo de reprova de quem nem é empregado. Nenhum dos três
cabe em "nome e custo".

`lancamento_qualidade` é a CTE `marcados` de `007_views_cfo.sql` parada antes do
`GROUP BY` final, mas **reescrita**: a CTE `historico` de 007 é uma junção
cruzada com subconsultas correlacionadas, que paga por lançamento estoura o
tempo. `fora_do_padrao` virou função de janela, e um teste concilia as marcas
contra `vw_fato_qualidade_mes` mês a mês — duas definições da mesma marca que
divergem são pior que uma.

## O escopo de perfil viaja como GUC

Embrulhar o resultado não funciona: a consulta agrega, e a coluna de recorte
pode nem estar na saída. Desligar a ferramenta fora do escopo total entregaria
o recurso quebrado justamente para os perfis `area` e `rh`, que são o público.

Então `SET LOCAL amanna.escopo_entidades / escopo_areas / escopo_modulos` — o
**comando**, que a revogação de função não alcança e que é erro de sintaxe
dentro do embrulho —, e toda view termina em `WHERE amanna_chat.no_escopo(...)`,
função `STABLE` e **fail-closed**: GUC ausente, nenhuma linha. Um teste percorre
`pg_get_viewdef` de cada view e exige a chamada.

O predicado de módulo fecha um buraco que o pedido não mencionava: o perfil
`controller` tem `modulos: ['fin','int']` e não pode alcançar `amanna_chat.folha`.

## O resultado vira envelope

- **A formatação é nossa.** O verificador compara texto; um número que o modelo
  formatasse sozinho não estaria na lista de permitidos e toda resposta cairia.
  Entram `formatarReais` e `formatarNumero` em `formato.ts`, e a unidade de
  cada coluna sai do dicionário semeado — não de `information_schema`, que
  reordena e derrubaria o cache de prompt da seção 7.4 em silêncio.
- **O rótulo por perto.** Resultado 1×1 é livre, como `ler_metrica`. Qualquer
  outro é tabela, e a célula só passa com o rótulo da linha por perto — a mesma
  regra que D-CHAT-ferramentas fixou para ponto de série e item de ranking.
- **Não calculamos nada.** Sem total de coluna, sem "os cinco juntos somam X".

## O que não muda

- As oito ferramentas continuam fechadas, continuam mantendo o piso de área ×
  mês, e continuam sendo o caminho preferido — mais rápidas, já conferidas, e
  são elas que acendem o painel na conversa. **`src/seguranca/grao.ts` não foi
  afrouxado.** Duas portas com duas trancas se defende; uma porta com a tranca
  frouxa, não.
- O verificador confere cada número, e a correção passa por ele.
- Em `fixtures` não há motor de SQL e não deve haver: a nona ferramenta só é
  oferecida com `DATA_SOURCE=warehouse` **e** `DATABASE_URL_CHAT` presente. O
  arnês de e2e, que roda sem chave de modelo, nunca a alcança.

## O que fica pendente

- **A senha do papel.** `012_chat_sql.sql` cria `amanna_chat_ro` como `NOLOGIN`
  de propósito: uma senha no repositório seria pega pelo gitleaks do CI, e com
  razão. Quem provisiona põe a senha e monta `DATABASE_URL_CHAT`.
- **PGlite não autentica**, e por isso não exercita a defesa primária. Os
  testes simulam com `SET LOCAL ROLE`, que é escapável; o cabeçalho do arquivo
  de teste diz isso por extenso, e a suíte também afirma as três revogações,
  que ali são o que de fato segura.
- **O SQL do modelo é dado de cliente no registro.** Junta-se à `pergunta` em
  `amanna.chat_incidente`, sob a decisão de retenção de T-324.
- **A latência.** Uma consulta pode queimar os 5 s do `statement_timeout`
  dentro de uma rodada de 20 s. Medir em produção antes de baixar o teto.
