# Base Amanna — dicionário de dados

Massa fictícia de uma empresa industrial e de serviços com três unidades, 1.235 FTE e receita líquida de R$ 1,2 bi/ano, cobrindo **janeiro/2025 a dezembro/2026**.

Todos os arquivos são **CSV com separador `;`, codificação UTF-8, decimal com ponto e datas em AAAA-MM-DD**. Valores monetários em reais, sem símbolo.

> Dados inteiramente sintéticos. Nomes, CNPJs, CPFs e chaves de NF-e foram gerados apenas com formato e dígito verificador válidos, para permitir teste de validação — não correspondem a pessoas ou empresas reais.

## Como as tabelas se ligam

```
dim_entidade ──┐
dim_centro_custo ──┼── colaboradores ── folha_pagamento
dim_cargo ─────┘        │                ├── ponto_ausencias
                        │                ├── treinamento_participacoes ── treinamento_turmas
                        │                ├── pesquisa_engajamento
                        │                └── apontamento_horas ── projetos
                        └── movimentacao_pessoal

dim_cliente ── notas_fiscais_saida ── itens_nota_saida
                     └── contas_receber ──┐
dim_fornecedor ── notas_fiscais_entrada ──┤
                     └── contas_pagar ────┼── razao_contabil_AAAA ── vw_dre_mes ── vw_fato_fin_mes
                                          └── movimento_caixa
dim_conta_contabil ───────────────────────┘
```

Chaves de junção principais: `competencia` (AAAA-MM), `id_entidade`, `id_centro_custo`, `matricula`, `id_cliente`, `id_fornecedor`, `conta`.

## Onde começar

Se o objetivo é só alimentar o painel, use as sete tabelas `vw_*` — elas já estão no grão de competência e nos mesmos filtros das telas. O detalhe (razão, folha, notas, títulos) está aí para auditar qualquer número e para montar cortes que a view não previu.

---

# Dimensões

## `dim_calendario.csv`

Dimensão de tempo, dia a dia, de 01/01/2025 a 31/12/2026.

- **Grão:** data
- **Linhas:** 730 · **Tamanho:** 0.0 MB
- **Colunas (13):** `data`, `ano`, `mes`, `competencia`, `mes_abrev`, `mes_extenso`, `trimestre`, `semestre`, `semana_ano`, `dia`, `dia_semana`, `dia_util`, `feriado`

Use `competencia` (AAAA-MM) para amarrar com todas as tabelas de fato. `dia_util` já desconta sábados, domingos e feriados nacionais.

## `dim_entidade.csv`

As três empresas do grupo. `grupo_filtro` é o valor que o filtro Entidade do painel usa.

- **Grão:** id_entidade
- **Linhas:** 3 · **Tamanho:** 0.0 MB
- **Colunas (8):** `id_entidade`, `entidade`, `grupo_filtro`, `razao_social`, `cidade`, `uf`, `regime_tributario`, `tipo`

consolidado = todas; unidade-sp = E01; demais-unidades = E02 e E03.

## `dim_centro_custo.csv`

Centros de custo, ligados a uma área e a uma linha de rateio da DRE.

- **Grão:** id_centro_custo
- **Linhas:** 31 · **Tamanho:** 0.0 MB
- **Colunas (7):** `id_centro_custo`, `centro_custo`, `area`, `area_slug`, `tipo`, `rateio_dre`, `responsavel`

`tipo` Produtivo joga a folha no CMV; Comercial e Administrativo jogam em despesa operacional.

## `dim_conta_contabil.csv`

Plano de contas em 4 níveis, com natureza, demonstrativo e a linha da DRE.

- **Grão:** conta
- **Linhas:** 63 · **Tamanho:** 0.0 MB
- **Colunas (7):** `conta`, `conta_descricao`, `classe`, `grupo`, `natureza`, `demonstrativo`, `linha_dre`

`linha_dre` é o que monta a DRE: Receita bruta, Deduções, CMV, Despesas operacionais, Depreciação e amortização, Resultado financeiro, IRPJ e CSLL.

## `dim_cliente.csv`

Carteira de clientes, com rating de crédito, limite e prazo contratado.

- **Grão:** id_cliente
- **Linhas:** 180 · **Tamanho:** 0.0 MB
- **Colunas (13):** `id_cliente`, `cliente`, `cnpj`, `segmento`, `porte`, `uf`, `cidade`, `rating_credito`, `limite_credito`, `prazo_medio_contratado`, `cliente_desde`, `canal`, `status`

`rating_credito` governa a probabilidade de atraso e de inadimplência nos títulos a receber.

## `dim_fornecedor.csv`

Cadastro de fornecedores, com categoria, prazo e condição de pagamento.

- **Grão:** id_fornecedor
- **Linhas:** 220 · **Tamanho:** 0.0 MB
- **Colunas (10):** `id_fornecedor`, `fornecedor`, `cnpj`, `categoria`, `uf`, `cidade`, `prazo_pagamento`, `condicao`, `critico`, `status`

`prazo_pagamento` é o que forma o PMP.

## `dim_cargo.csv`

Estrutura de cargos por família e nível, com faixa salarial mín./méd./máx.

- **Grão:** id_cargo
- **Linhas:** 230 · **Tamanho:** 0.0 MB
- **Colunas (11):** `id_cargo`, `cargo`, `familia`, `area`, `nivel`, `salario_min`, `salario_medio`, `salario_max`, `cbo`, `elegivel_bonus`, `elegivel_comissao`

Serve de referência para análise de equidade e de posicionamento na faixa.

## `dim_produto_servico.csv`

Portfólio de produtos e serviços, com preço de tabela, custo padrão e margem-alvo.

- **Grão:** id_produto
- **Linhas:** 40 · **Tamanho:** 0.0 MB
- **Colunas (11):** `id_produto`, `produto`, `familia`, `tipo`, `unidade`, `preco_tabela`, `custo_padrao`, `margem_alvo_pct`, `ncm`, `cfop_padrao`, `status`

Usado nos itens da nota de saída para calcular margem de contribuição.

---

# Recursos Humanos

## `colaboradores.csv`

Cadastro completo — um registro por pessoa que passou pela empresa no período (ativos e desligados).

- **Grão:** matricula
- **Linhas:** 1.518 · **Tamanho:** 0.4 MB
- **Colunas (29):** `matricula`, `nome`, `cpf_ficticio`, `data_nascimento`, `faixa_etaria`, `genero`, `escolaridade`, `uf`, `cidade`, `id_entidade`, `area`, `id_centro_custo`, `centro_custo`, `id_cargo`, `cargo`, `nivel`, `modalidade`, `tipo_contrato`, `jornada_semanal`, `fte`, `salario_base`, `data_admissao`, `data_desligamento`, `motivo_desligamento`, `tipo_desligamento`, `status`, `gestor_matricula`, `sindicato`, `banco`

Filtre `status = Ativo` para o quadro atual. `data_desligamento` vazia = ativo. Alimenta headcount, turnover, perfil, tempo de casa, faixa etária e escolaridade.

## `movimentacao_pessoal.csv`

Livro de admissões e desligamentos, um evento por linha.

- **Grão:** matricula + data
- **Linhas:** 726 · **Tamanho:** 0.0 MB
- **Colunas (6):** `competencia`, `data`, `matricula`, `evento`, `motivo`, `tipo`

É a origem de admissões e desligamentos do mês; `tipo` separa voluntário de involuntário.

## `folha_pagamento.csv`

Folha aberta por colaborador e por competência, com todas as rubricas.

- **Grão:** competencia + matricula
- **Linhas:** 28.041 · **Tamanho:** 10.4 MB
- **Colunas (50):** `competencia`, `ano`, `mes`, `matricula`, `nome`, `id_entidade`, `area`, `id_centro_custo`, `centro_custo`, `cargo`, `nivel`, `modalidade`, `fte`, `dias_trabalhados`, `salario_base`, `horas_extras_qtd`, `horas_extras`, `adicional_noturno`, `periculosidade`, `comissao`, `bonus`, `plr`, `verbas_rescisorias`, `provisao_ferias`, `provisao_decimo`, `inss_patronal`, `rat`, `terceiros`, `fgts`, `vale_refeicao`, `vale_alimentacao`, `vale_transporte`, `plano_saude`, `plano_odontologico`, `seguro_vida`, `auxilio_creche`, `auxilio_home_office`, `inss_empregado`, `irrf`, `desconto_vt`, `coparticipacao_saude`, `desconto_faltas`, `adiantamento`, `total_proventos`, `total_descontos`, `liquido_a_pagar`, `total_encargos`, `total_beneficios`, `total_provisoes`, `custo_total_empresa`

Proventos, encargos, benefícios, provisões e descontos separados. `custo_total_empresa` é o custo cheio, que é o que entra na conta de folha do painel.

## `ponto_ausencias.csv`

Eventos de ausência: atestado, falta, férias, licença, folga.

- **Grão:** id_ausencia
- **Linhas:** 5.770 · **Tamanho:** 0.8 MB
- **Colunas (16):** `id_ausencia`, `competencia`, `matricula`, `nome`, `area`, `id_centro_custo`, `id_entidade`, `modalidade`, `tipo`, `data_inicio`, `data_fim`, `dias`, `horas_perdidas`, `abonado`, `cid`, `observacao`

`horas_perdidas` só conta ausência não programada — férias e folga entram com zero, para o absenteísmo não ficar inflado.

## `vagas_recrutamento.csv`

Uma linha por vaga, com o funil consolidado e o custo do processo.

- **Grão:** id_vaga
- **Linhas:** 586 · **Tamanho:** 0.1 MB
- **Colunas (27):** `id_vaga`, `competencia_abertura`, `data_abertura`, `data_fechamento`, `status`, `area`, `id_cargo`, `cargo`, `nivel`, `id_centro_custo`, `id_entidade`, `modalidade`, `motivo`, `salario_ofertado`, `recrutador`, `fonte_principal`, `candidaturas`, `triagem`, `entrevistas`, `propostas`, `contratacoes`, `dias_para_fechar`, `sla_dias`, `custo_anuncio`, `custo_headhunter`, `custo_exames`, `custo_total`

`dias_para_fechar` alimenta o tempo médio de fechamento; `custo_total` dividido por `contratacoes` dá o custo por contratação.

## `candidaturas.csv`

Funil detalhado: uma linha por candidato por vaga, com a etapa em que parou.

- **Grão:** id_candidatura
- **Linhas:** 26.433 · **Tamanho:** 3.7 MB
- **Colunas (13):** `id_candidatura`, `id_vaga`, `competencia`, `data_candidatura`, `candidato`, `genero`, `uf`, `fonte`, `etapa_final`, `pretensao_salarial`, `nota_triagem`, `reprovado_em`, `motivo_reprova`

`etapa_final` reproduz o funil Candidatura → Triagem → Entrevista → Proposta → Contratado.

## `treinamento_turmas.csv`

Turmas de treinamento realizadas, com carga horária, fornecedor e custo por hora-aluno.

- **Grão:** id_turma
- **Linhas:** 304 · **Tamanho:** 0.0 MB
- **Colunas (14):** `id_turma`, `competencia`, `treinamento`, `categoria`, `carga_horaria`, `modalidade`, `fornecedor`, `instrutor`, `data_inicio`, `data_fim`, `vagas`, `custo_hora_aluno`, `id_centro_custo`, `obrigatorio`

## `treinamento_participacoes.csv`

Participação individual em cada turma, com horas realizadas, conclusão e nota.

- **Grão:** id_participacao
- **Linhas:** 8.628 · **Tamanho:** 1.3 MB
- **Colunas (18):** `id_participacao`, `id_turma`, `competencia`, `treinamento`, `categoria`, `matricula`, `nome`, `area`, `id_centro_custo`, `id_entidade`, `modalidade_colaborador`, `horas_previstas`, `horas_realizadas`, `conclusao_pct`, `status`, `nota_avaliacao`, `custo`, `certificado`

`conclusao_pct` = horas realizadas ÷ horas previstas.

## `pesquisa_engajamento.csv`

Pesquisa de clima em quatro ondas, com eNPS e dez dimensões avaliadas de 1 a 10.

- **Grão:** id_resposta
- **Linhas:** 3.406 · **Tamanho:** 0.5 MB
- **Colunas (25):** `id_resposta`, `onda`, `competencia`, `data_resposta`, `matricula`, `area`, `id_centro_custo`, `id_entidade`, `modalidade`, `genero`, `faixa_etaria`, `tempo_casa_meses`, `enps_nota`, `enps_classificacao`, `dim_lideranca`, `dim_reconhecimento`, `dim_carreira`, `dim_remuneracao`, `dim_ambiente`, `dim_carga`, `dim_comunicacao`, `dim_autonomia`, `dim_proposito`, `dim_ferramentas`, `comentario_aberto`

eNPS = % de promotores (nota 9-10) − % de detratores (nota 0-6).

---

# Financeiro e fiscal

## `notas_fiscais_saida.csv`

Faturamento: uma NF-e por linha, com chave de acesso, CFOP, impostos e condição de pagamento.

- **Grão:** id_nf
- **Linhas:** 10.227 · **Tamanho:** 3.7 MB
- **Colunas (33):** `id_nf`, `numero`, `serie`, `chave_acesso`, `competencia`, `data_emissao`, `id_entidade`, `uf_origem`, `id_cliente`, `cliente`, `cnpj_cliente`, `uf_destino`, `segmento`, `canal`, `rating_credito`, `cfop`, `natureza_operacao`, `valor_produtos`, `desconto`, `valor_total`, `icms`, `pis`, `cofins`, `iss`, `valor_liquido`, `condicao_pagamento`, `prazo_dias`, `vendedor`, `comissao_pct`, `comissao_valor`, `id_centro_custo`, `status`, `transportadora`

`valor_total` é a receita bruta do documento; `valor_liquido` já desconta ICMS, PIS, COFINS e ISS.

## `itens_nota_saida.csv`

Itens das notas de saída, com quantidade, preço, custo padrão e margem de contribuição.

- **Grão:** id_nf + item
- **Linhas:** 25.652 · **Tamanho:** 3.5 MB
- **Colunas (14):** `id_nf`, `item`, `id_produto`, `produto`, `familia`, `tipo`, `unidade`, `ncm`, `quantidade`, `preco_unitario`, `valor_total`, `custo_unitario_padrao`, `custo_total`, `margem_contribuicao`

## `notas_fiscais_entrada.csv`

Compras e despesas: uma NF de entrada por linha, já classificada em conta contábil e centro de custo.

- **Grão:** id_nf_entrada
- **Linhas:** 13.464 · **Tamanho:** 4.5 MB
- **Colunas (30):** `id_nf_entrada`, `numero`, `serie`, `chave_acesso`, `competencia`, `data_emissao`, `id_entidade`, `id_fornecedor`, `fornecedor`, `cnpj_fornecedor`, `uf_fornecedor`, `categoria_fornecedor`, `bloco_dre`, `conta`, `conta_descricao`, `area`, `id_centro_custo`, `centro_custo`, `cfop`, `valor_total`, `icms_creditado`, `pis_creditado`, `cofins_creditado`, `valor_liquido_custo`, `condicao_pagamento`, `prazo_dias`, `aprovador`, `pedido_compra`, `rateio`, `observacao`

`bloco_dre` separa o que vai para CMV do que vai para despesa operacional. `valor_liquido_custo` é o valor já líquido dos créditos de ICMS/PIS/COFINS.

## `contas_receber.csv`

Títulos a receber, com vencimento, baixa, atraso, juros e provisão para devedores duvidosos.

- **Grão:** id_titulo
- **Linhas:** 10.227 · **Tamanho:** 1.8 MB
- **Colunas (19):** `id_titulo`, `id_nf`, `competencia`, `id_cliente`, `cliente`, `rating_credito`, `id_entidade`, `data_emissao`, `data_vencimento`, `valor_titulo`, `valor_recebido`, `data_recebimento`, `dias_atraso`, `status`, `juros_multa`, `provisao_pdd`, `faixa_aging`, `forma_cobranca`, `condicao`

`faixa_aging` classifica em Em dia, 1-30, 31-60, 61-90 e 90+. `status` Inadimplente = título vencido e provisionado.

## `contas_pagar.csv`

Títulos a pagar, com vencimento, pagamento, desconto por antecipação e juros de mora.

- **Grão:** id_titulo
- **Linhas:** 13.464 · **Tamanho:** 3.0 MB
- **Colunas (21):** `id_titulo`, `id_nf_entrada`, `competencia`, `id_fornecedor`, `fornecedor`, `categoria`, `id_entidade`, `id_centro_custo`, `conta`, `conta_descricao`, `data_emissao`, `data_vencimento`, `valor_titulo`, `valor_pago`, `data_pagamento`, `desconto_antecipacao`, `juros_mora`, `dias_para_pagar`, `status`, `forma_pagamento`, `aprovado_por`

`dias_para_pagar` é a base do PMP realizado (diferente do prazo contratado).

## `razao_contabil_2025.csv`

Razão contábil de 2025 em partida dobrada.

- **Grão:** id_lancamento
- **Linhas:** 62.587 · **Tamanho:** 17.0 MB
- **Colunas (24):** `id_lancamento`, `lote`, `data`, `competencia`, `id_entidade`, `conta`, `conta_descricao`, `linha_dre`, `id_centro_custo`, `centro_custo`, `area`, `historico`, `debito`, `credito`, `documento_tipo`, `documento_numero`, `nf_numero`, `parceiro_tipo`, `id_parceiro`, `parceiro_nome`, `id_projeto`, `origem`, `usuario`, `status`

Débitos e créditos fecham exatamente. `lote` agrupa as pernas do mesmo documento.

## `razao_contabil_2026.csv`

Razão contábil de 2026 em partida dobrada.

- **Grão:** id_lancamento
- **Linhas:** 65.920 · **Tamanho:** 17.9 MB
- **Colunas (24):** `id_lancamento`, `lote`, `data`, `competencia`, `id_entidade`, `conta`, `conta_descricao`, `linha_dre`, `id_centro_custo`, `centro_custo`, `area`, `historico`, `debito`, `credito`, `documento_tipo`, `documento_numero`, `nf_numero`, `parceiro_tipo`, `id_parceiro`, `parceiro_nome`, `id_projeto`, `origem`, `usuario`, `status`

Mesma estrutura de 2025.

## `movimento_caixa.csv`

Extrato bancário lançamento a lançamento, com saldo corrente por entidade.

- **Grão:** data + id_entidade
- **Linhas:** 22.396 · **Tamanho:** 4.6 MB
- **Colunas (14):** `data`, `competencia`, `id_entidade`, `banco_conta`, `classe_fluxo`, `natureza`, `historico`, `documento`, `parceiro`, `entrada`, `saida`, `saldo_apos`, `id_lancamento`, `forma`

`classe_fluxo` separa Operacional, Investimento e Financiamento — é a base da DFC indireta simplificada.

## `orcamento.csv`

Orçamento por competência, entidade, centro de custo e conta, com realizado e desvio.

- **Grão:** competencia + id_centro_custo + conta
- **Linhas:** 19.175 · **Tamanho:** 3.2 MB
- **Colunas (17):** `competencia`, `ano`, `mes`, `id_entidade`, `id_centro_custo`, `centro_custo`, `area`, `conta`, `conta_descricao`, `linha_dre`, `versao`, `valor_orcado`, `valor_realizado`, `desvio_valor`, `desvio_pct`, `responsavel`, `justificativa`

`valor_realizado` vem do razão; `valor_orcado` foi construído em cima dele com desvio controlado, então o confronto orçado × realizado fecha.

## `projetos.csv`

Projetos e ordens de serviço, com receita contratada, custo e margem bruta.

- **Grão:** id_projeto
- **Linhas:** 320 · **Tamanho:** 0.1 MB
- **Colunas (17):** `id_projeto`, `projeto`, `id_cliente`, `cliente`, `id_entidade`, `gerente`, `data_inicio`, `data_fim_prevista`, `data_fim_real`, `status`, `receita_contratada`, `custo_material`, `custo_mao_de_obra`, `horas_previstas`, `horas_realizadas`, `margem_bruta`, `margem_bruta_pct`

## `apontamento_horas.csv`

Horas apontadas por colaborador, projeto e competência, com custo-hora.

- **Grão:** competencia + matricula + id_projeto
- **Linhas:** 10.022 · **Tamanho:** 1.2 MB
- **Colunas (12):** `competencia`, `matricula`, `nome`, `area`, `id_centro_custo`, `id_projeto`, `projeto`, `id_cliente`, `horas_apontadas`, `horas_faturaveis`, `custo_hora`, `custo_apontado`

`horas_faturaveis` sobre `horas_apontadas` dá a taxa de ocupação faturável.

## `emprestimos.csv`

Contratos de dívida, com indexador, taxa efetiva, saldo devedor e covenant.

- **Grão:** id_contrato
- **Linhas:** 8 · **Tamanho:** 0.0 MB
- **Colunas (14):** `id_contrato`, `banco`, `modalidade`, `indexador`, `taxa_efetiva_aa`, `principal`, `saldo_devedor_2026_12`, `data_contratacao`, `data_vencimento`, `carencia_meses`, `parcelas`, `garantia`, `id_entidade`, `covenant`

É o que explica o resultado financeiro de R$ 140 mi por ano.

## `metas.csv`

Metas oficiais por indicador, com sentido (mínimo/máximo) e responsável.

- **Grão:** indicador
- **Linhas:** 16 · **Tamanho:** 0.0 MB
- **Colunas (7):** `modulo`, `indicador`, `unidade`, `meta`, `sentido`, `periodicidade`, `responsavel`

É a tabela que o painel usa para desenhar as linhas de meta nos gráficos.

---

# Views prontas para o painel

## `vw_fato_rh_mes.csv`

VIEW pronta para o painel: fatos de RH por competência × entidade × área × modalidade.

- **Grão:** competencia + id_entidade + area + modalidade
- **Linhas:** 1.507 · **Tamanho:** 0.3 MB
- **Colunas (36):** `competencia`, `ano`, `mes`, `id_entidade`, `entidade`, `grupo_entidade`, `area`, `area_slug`, `modalidade`, `modalidade_slug`, `headcount_fte`, `colaboradores`, `admissoes`, `desligamentos`, `desligamentos_voluntarios`, `turnover_mes_pct`, `folha_salarios`, `folha_encargos`, `folha_beneficios`, `folha_variavel`, `folha_total`, `custo_por_fte`, `salario_medio`, `horas_extras_qtd`, `eventos_ausencia`, `dias_ausencia`, `horas_ausencia`, `absenteismo_pct`, `participacoes_treinamento`, `horas_treinamento`, `horas_treinamento_por_fte`, `custo_treinamento`, `conclusao_media_pct`, `respostas_pesquisa`, `enps`, `engajamento_medio`

Headcount, movimentação, folha aberta em quatro blocos, absenteísmo, treinamento e engajamento. É o `vw_fato_rh_mes` que o painel consome.

## `vw_fato_recrutamento_mes.csv`

VIEW de recrutamento por competência × entidade × área.

- **Grão:** competencia + id_entidade + area
- **Linhas:** 289 · **Tamanho:** 0.0 MB
- **Colunas (17):** `competencia`, `id_entidade`, `area`, `vagas_abertas`, `vagas_fechadas`, `candidaturas`, `triagem`, `entrevistas`, `propostas`, `contratacoes`, `dias_medio_fechamento`, `custo_recrutamento`, `custo_por_contratacao`, `entidade`, `area_slug`, `ano`, `mes`

Funil, tempo de fechamento e custo por contratação. Separada porque recrutamento não tem grão de modalidade.

## `vw_dre_mes.csv`

Cubo da DRE: valor por competência, entidade, linha da DRE, conta, área e centro de custo.

- **Grão:** competencia + conta + id_centro_custo
- **Linhas:** 19.175 · **Tamanho:** 2.7 MB
- **Colunas (13):** `competencia`, `id_entidade`, `linha_dre`, `conta`, `conta_descricao`, `area`, `id_centro_custo`, `valor`, `ano`, `mes`, `entidade`, `grupo_entidade`, `centro_custo`

É o nível mais flexível — dá para reconstruir qualquer corte da DRE a partir daqui.

## `vw_fato_fin_mes.csv`

VIEW da DRE fechada por competência × entidade, da receita bruta ao lucro líquido, com margens e cobertura de juros.

- **Grão:** competencia + id_entidade
- **Linhas:** 72 · **Tamanho:** 0.0 MB
- **Colunas (23):** `competencia`, `ano`, `mes`, `id_entidade`, `entidade`, `grupo_entidade`, `receita_bruta`, `deducoes`, `receita_liquida`, `cmv`, `lucro_bruto`, `despesas_operacionais`, `ebitda`, `depreciacao_amortizacao`, `ebit`, `resultado_financeiro`, `lair`, `ir_csll`, `lucro_liquido`, `margem_bruta_pct`, `margem_ebitda_pct`, `margem_liquida_pct`, `cobertura_juros_vezes`

É o `vw_fato_fin_mes` que o painel consome.

## `vw_fato_faturamento_mes.csv`

VIEW de faturamento por competência × entidade × cliente, com segmento, canal, rating e ticket médio.

- **Grão:** competencia + id_cliente
- **Linhas:** 5.739 · **Tamanho:** 0.8 MB
- **Colunas (16):** `competencia`, `id_entidade`, `id_cliente`, `cliente`, `segmento`, `canal`, `rating_credito`, `uf_destino`, `notas`, `faturamento_bruto`, `faturamento_liquido`, `desconto`, `comissao`, `ticket_medio`, `ano`, `mes`

Alimenta concentração nos maiores clientes, mix por segmento e risco de crédito.

## `vw_fato_contas_mes.csv`

VIEW de contas a pagar e a receber por competência × entidade: PMR, PMP, ciclo financeiro, inadimplência e PDD.

- **Grão:** competencia + id_entidade
- **Linhas:** 72 · **Tamanho:** 0.0 MB
- **Colunas (21):** `competencia`, `id_entidade`, `titulos_receber`, `valor_receber`, `valor_recebido`, `pmr_dias`, `atraso_medio_dias`, `pdd`, `juros_recebidos`, `inadimplencia_pct`, `titulos_pagar`, `valor_pagar`, `valor_pago`, `pmp_dias`, `desconto_antecipacao`, `juros_mora`, `ano`, `mes`, `entidade`, `pme_dias`, `ciclo_financeiro_dias`

ATENÇÃO: `pme_dias` está fixo em 75 dias — o estoque não foi modelado em detalhe nesta base. Se você quiser o ciclo financeiro totalmente calculado, é o único número a trocar.

## `vw_fato_caixa_mes.csv`

VIEW de fluxo de caixa por competência × entidade × classe (Operacional, Investimento, Financiamento).

- **Grão:** competencia + id_entidade + classe_fluxo
- **Linhas:** 180 · **Tamanho:** 0.0 MB
- **Colunas (9):** `competencia`, `id_entidade`, `classe_fluxo`, `entradas`, `saidas`, `fluxo_liquido`, `ano`, `mes`, `entidade`

## `vw_fato_int_mes.csv`

VIEW de cruzamento RH × Financeiro: receita por colaborador, EBITDA per capita e peso da folha.

- **Grão:** competencia + id_entidade
- **Linhas:** 72 · **Tamanho:** 0.0 MB
- **Colunas (16):** `competencia`, `id_entidade`, `receita_liquida`, `ebitda`, `lucro_liquido`, `cmv`, `headcount_fte`, `folha_total`, `horas_treinamento`, `ano`, `mes`, `entidade`, `receita_por_colaborador`, `ebitda_per_capita`, `peso_folha_receita_pct`, `folha_sobre_cmv_pct`

É o `vw_fato_int_mes` que a tela de Integração consome.

---

# Conferência

| Verificação                        | Resultado         |
| ---------------------------------- | ----------------- |
| Razão — soma de débitos            | R$ 11002381685.32 |
| Razão — soma de créditos           | R$ 11002381685.32 |
| Razão — diferença                  | R$ 0.00           |
| Lançamentos no razão               | 128513            |
| DRE 2026 — receita_bruta           | R$ 1594.0 mi      |
| DRE 2026 — deducoes                | R$ 395.7 mi       |
| DRE 2026 — receita_liquida         | R$ 1198.3 mi      |
| DRE 2026 — cmv                     | R$ 720.0 mi       |
| DRE 2026 — lucro_bruto             | R$ 478.3 mi       |
| DRE 2026 — despesas_operacionais   | R$ 280.0 mi       |
| DRE 2026 — ebitda                  | R$ 198.3 mi       |
| DRE 2026 — depreciacao_amortizacao | R$ 60.0 mi        |
| DRE 2026 — ebit                    | R$ 138.3 mi       |
| DRE 2026 — resultado_financeiro    | R$ -142.6 mi      |
| DRE 2026 — lair                    | R$ -4.3 mi        |
| DRE 2026 — ir_csll                 | R$ 8.0 mi         |
| DRE 2026 — lucro_liquido           | R$ -12.3 mi       |
| Headcount FTE em dez/2026          | 1235              |
| Turnover 12m 2026                  | 12.1%             |
| Folha total 2026                   | R$ 189.4 mi       |

O razão fecha em zero: a soma dos débitos é exatamente igual à soma dos créditos, e a DRE do cubo `vw_dre_mes` é gerada a partir dele, não de um número solto. O orçamento também foi construído em cima do realizado, então o confronto orçado × realizado fecha por conta e por centro de custo.

## Parâmetros usados na geração

| Parâmetro                  | Valor                                                     |
| -------------------------- | --------------------------------------------------------- |
| Período                    | jan/2025 a dez/2026 (24 competências)                     |
| Entidades                  | 3 (SP, RJ, PR), regime Lucro Real                         |
| Quadro em dez/2026         | 1.240 pessoas · 1.235 FTE                                 |
| Áreas                      | 7 · 31 centros de custo                                   |
| Receita líquida 2026       | R$ 1.198,3 mi                                             |
| CMV 2026                   | R$ 720,0 mi (60,1% da receita líquida)                    |
| Despesas operacionais 2026 | R$ 280,0 mi                                               |
| Folha total 2026           | R$ 189,1 mi (custo cheio)                                 |
| Dívida bruta               | R$ 980 mi em 8 contratos, taxa efetiva 13,2% a 16,8% a.a. |
| ICMS                       | 18% dentro do estado, 12% interestadual                   |
| PIS/COFINS                 | 1,65% e 7,6% (não cumulativo)                             |
| Encargos sobre a folha     | INSS 20% + RAT 2% + terceiros 5,8% + FGTS 8%              |
| Provisões                  | férias 1/12 × 1,3333 e 13º 1/12                           |

**Total da base: 82 MB em 38 arquivos.**
