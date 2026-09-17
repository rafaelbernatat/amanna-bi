/**
 * A forma das linhas de cada view de fato (D-DADOS).
 *
 * Os tipos moravam junto das fixtures que os geravam. Saíram de lá porque
 * passaram a ter **dois** produtores — a fixture, em memória, e o adaptador de
 * warehouse, que lê as mesmas views do Postgres — e um tipo que mora num dos
 * dois produtores faz o outro parecer derivado dele. Aqui os dois são iguais
 * diante do motor de cálculo, que é o único consumidor.
 *
 * ## O que é `number | null`, e por quê
 *
 * A base Amanna não traz tudo. Não há saldo de abertura no razão, então o
 * balanço patrimonial não fecha; não há estoque modelado; ramp-up e
 * produtividade perdida dependem de um parâmetro que ninguém aprovou (H-52).
 * Nesses campos a view devolve NULL, e o tipo diz isso. Inventar zero seria
 * afirmar "o patrimônio líquido é zero" — o princípio PR-4 proíbe. O motor
 * propaga o `null` até a tela, que mostra "sem dado neste recorte".
 *
 * A fixture continua entregando números em todos os campos, e cabe no tipo.
 *
 * Toda linha tem `mes` (AAAA-MM). As dimensões `entidade`, `area` e
 * `modalidade` aparecem conforme o grão da view, sempre em **código** — o
 * mesmo do vocabulário da seção 6.2.
 */

/**
 * A mesma linha, sem nulo em campo nenhum.
 *
 * É o tipo que a fixture declara: ela gera todos os campos, e os testes que
 * conferem as identidades contábeis dela precisam somar sem tratar ausência.
 * `Completa<LinhaX>` cabe em `LinhaX` — o motor aceita as duas —, e a fixture
 * continua não podendo entregar `null` por descuido.
 */
export type Completa<T> = {
  readonly [K in keyof T]: Exclude<T[K], null>;
};

/** As quebras do quadro que `vw_fato_rh_perfil` materializa. */
export const NOMES_DE_QUEBRA = [
  "faixa_etaria",
  "tempo_de_casa",
  "escolaridade",
  "uf",
  "faixa_salarial",
  "genero",
] as const;
export type NomeDeQuebra = (typeof NOMES_DE_QUEBRA)[number];

/* ------------------------------------------------------------------ *
 * Recursos Humanos
 * ------------------------------------------------------------------ */

export type LinhaRhMes = {
  readonly mes: string;
  readonly entidade: string;
  readonly area: string;
  readonly modalidade: string;
  /** Estoque no fechamento do mês. Agrega por `last` no tempo. */
  readonly headcountFte: number;
  readonly admissoes: number;
  readonly desligamentos: number;
  /** Em reais. A soma das quatro parcelas abaixo, nunca uma coluna à parte. */
  readonly folhaReais: number;
  readonly salarios: number;
  readonly encargos: number;
  readonly beneficios: number;
  readonly variavel: number;
  /** Quem pode responder à pesquisa de clima. Denominador de "Cobertura". */
  readonly elegiveis: number;
  /** Soma das idades. A média é `somaDeIdade / headcountFte`. */
  readonly somaDeIdade: number;
  /** Soma dos tempos de casa, em anos. */
  readonly somaDeTempoDeCasa: number;
  /** Soma do tempo de casa **de quem saiu**. Denominador: `desligamentos`. */
  readonly somaDeTempoAteASaida: number;
  /** Quantas pessoas do quadro iniciaram ao menos uma trilha no mês. Estoque. */
  readonly participantesDeTreinamento: number;
  /** Ramp-up e produtividade perdida, em reais. Custo modelado: nulo sem parâmetro (H-52). */
  readonly custoDeReposicao: number | null;
  /** Rescisão e recrutamento de reposição, em reais. */
  readonly custoDeDesligamento: number | null;
  /** Denominador do absenteísmo. */
  readonly horasPrevistas: number;
  /** Numerador do absenteísmo. */
  readonly horasAusentes: number;
  /** Denominador do eNPS e do engajamento. */
  readonly respondentes: number;
  readonly promotores: number;
  readonly neutros: number;
  readonly detratores: number;
  /** Soma dos pontos. A média é `pontosDeEngajamento / respondentes`. */
  readonly pontosDeEngajamento: number;
};

export type LinhaPerfil = {
  readonly mes: string;
  readonly entidade: string;
  readonly area: string;
  readonly modalidade: string;
  readonly dimensao: NomeDeQuebra;
  /** O código do valor dentro daquela dimensão. */
  readonly valor: string;
  readonly headcountFte: number;
};

export type LinhaVagas = {
  readonly mes: string;
  readonly area: string;
  readonly abertas: number;
  readonly emAndamento: number;
  readonly fechadas: number;
  readonly canceladas: number;
  /** Custo de recrutamento do mês, em reais. */
  readonly custoDeRecrutamento: number;
  /** Soma dos dias de todas as vagas fechadas no mês. */
  readonly diasSomados: number;
  readonly candidaturas: number;
  readonly triagem: number;
  readonly entrevistas: number;
  readonly propostas: number;
  readonly contratados: number;
};

export type LinhaFonteDeCandidato = {
  readonly mes: string;
  readonly area: string;
  readonly fonte: string;
  readonly contratados: number;
};

export type LinhaTreinamento = {
  readonly mes: string;
  readonly area: string;
  readonly trilha: string;
  /** A modalidade **da trilha**, em código. */
  readonly modalidadeDeTrilha: string;
  readonly horas: number;
  readonly investimentoReais: number;
  readonly trilhasIniciadas: number;
  readonly trilhasConcluidas: number;
  readonly participantes: number;
};

export type LinhaDesligamento = {
  readonly mes: string;
  readonly entidade: string;
  readonly area: string;
  readonly modalidade: string;
  /** `tipo`, `genero` ou `faixa_etaria`. */
  readonly dimensao: string;
  readonly valor: string;
  readonly desligamentos: number;
};

export type LinhaTurnoverCusto = {
  readonly mes: string;
  readonly entidade: string;
  readonly area: string;
  /** `rescisao`, `recrutamento`, `ramp-up` ou `produtividade`. */
  readonly componente: string;
  /** Valor em reais. Nulo nos componentes modelados sem parâmetro (H-52). */
  readonly valor: number | null;
};

/* ------------------------------------------------------------------ *
 * Financeiro
 * ------------------------------------------------------------------ */

export type LinhaFinMes = {
  readonly mes: string;
  readonly entidade: string;
  /** Todos os valores em reais. `BRL_mi` é unidade de apresentação. */
  readonly receitaBruta: number;
  readonly deducoes: number;
  readonly receitaLiquida: number;
  readonly cmv: number;
  readonly despesasOperacionais: number;
  readonly depreciacaoEAmortizacao: number;
  /** Positivo é despesa: entra na ponte como dedução. */
  readonly resultadoFinanceiro: number;
  readonly naoOperacional: number;
  readonly fco: number;
  /** Investimento do mês. Positivo é saída de caixa. */
  readonly capex: number;
  /** Financiamento líquido. Positivo é saída de caixa. */
  readonly financiamento: number;
  readonly entradasDeCaixa: number;
  readonly saidasDeCaixa: number;
  /** Estoque no fechamento. Denominador do PME. Nulo quando a base não o modela. */
  readonly estoque: number | null;
  /** Receita líquida do mesmo mês do ano anterior. Nula no primeiro ano carregado. */
  readonly receitaLiquidaAnoAnterior: number | null;
  /** Notas fiscais emitidas no mês. */
  readonly notasEmitidas: number;
  /** Saldo no fechamento do mês. */
  readonly saldoDeCaixa: number;
};

export type LinhaCaixaDiario = {
  /** Dia no formato `AAAA-MM-DD`. */
  readonly dia: string;
  readonly mes: string;
  readonly entidade: string;
  readonly entradas: number;
  readonly saidas: number;
};

export type LinhaOrcamento = {
  readonly mes: string;
  readonly entidade: string;
  readonly centroDeCusto: string;
  readonly orcado: number;
  readonly realizado: number;
};

export type LinhaContas = {
  readonly mes: string;
  readonly entidade: string;
  readonly faixaDeAging: string;
  /** Um cliente **ou** um fornecedor, nunca os dois. */
  readonly contraparte: string;
  readonly aReceber: number;
  readonly aPagar: number;
};

export type LinhaSaidaCategoria = {
  readonly mes: string;
  readonly entidade: string;
  readonly categoria: string;
  /** Desembolso do mês naquela natureza, em reais. */
  readonly valor: number;
};

export type LinhaFaturamentoCliente = {
  readonly mes: string;
  readonly entidade: string;
  readonly cliente: string;
  /** Faixa de rating interno do cliente, em código (H-53). */
  readonly rating: string;
  /** Segmento comercial do cliente, em código (H-57). */
  readonly segmento: string;
  /**
   * É um dos dez maiores clientes da base?
   *
   * A fixture só carrega os dez, então todas as linhas dela são principais.
   * A base Amanna carrega os 180 — para o mix por segmento e o ranking
   * enxergarem a carteira inteira — e marca os dez maiores por receita
   * acumulada. "Concentração top 10" e "receita dos principais clientes" leem
   * só as linhas marcadas; guardar um subconjunto à parte seria duas views
   * para o mesmo cliente.
   */
  readonly principal: boolean;
  /** Receita do mês, em reais. */
  readonly receita: number;
  /** Margem de contribuição em reais, para somar sem perder casa. */
  readonly margemBase: number;
};

/** Uma linha do razão agregada no grão área × mês, para o ranking do chat. */
export type LinhaDreConta = {
  readonly mes: string;
  readonly entidade: string;
  readonly area: string;
  readonly centroDeCusto: string;
  readonly conta: string;
  readonly contaDescricao: string;
  readonly linhaDre: string;
  /** Valor com o sinal do efeito sobre o resultado, em reais. */
  readonly valor: number;
};

/* ------------------------------------------------------------------ *
 * Balanço, dívida, natureza e qualidade (perguntas de CFO)
 * ------------------------------------------------------------------ */

export type LinhaBalancoMes = {
  readonly mes: string;
  readonly entidade: string;
  /** Saldos no fechamento do mês, em reais. Nulos quando não há saldo de abertura. */
  readonly patrimonioLiquido: number | null;
  readonly ativoTotal: number | null;
  readonly ativoCirculante: number | null;
  readonly passivoCirculante: number | null;
  readonly imobilizado: number | null;
  /** A parte do caixa que está aplicada: entra no capital investido pelo sinal negativo. */
  readonly aplicacoesFinanceiras: number | null;
  readonly dividaCurtoPrazo: number | null;
  readonly dividaLongoPrazo: number | null;
  readonly estoqueSemGiro: number | null;
  readonly aReceberVencido: number | null;
  readonly aPagarVencido: number | null;
  readonly mutuoComSocios: number | null;
  /** Fluxos do mês, em reais. */
  readonly jurosPagos: number | null;
  readonly impostosSobreLucro: number | null;
  readonly amortizacaoDeDivida: number | null;
  readonly captacao: number | null;
  readonly distribuicaoASocios: number | null;
};

export type LinhaDividaMes = {
  readonly mes: string;
  readonly entidade: string;
  /** `capital-de-giro`, `financiamento-longo-prazo` ou `antecipacao-de-recebiveis`. */
  readonly linha: string;
  readonly prazo: "curto" | "longo";
  /** Saldo devedor no fechamento do mês, em reais. */
  readonly saldo: number | null;
  /** Juros pagos no mês, em reais. */
  readonly jurosPagos: number | null;
};

export type LinhaNaturezaMes = {
  readonly mes: string;
  readonly entidade: string;
  /** Custos que variam com a venda, em reais. Nulo sem classificação por conta. */
  readonly custosVariaveis: number | null;
  /** A estrutura, em reais. Sem a depreciação. */
  readonly custosFixos: number | null;
};

export type LinhaQualidadeMes = {
  readonly mes: string;
  readonly entidade: string;
  readonly lancamentos: number;
  readonly lancamentosForaDoPadrao: number;
  readonly lancamentosEmContaParada: number;
  readonly paresDeEstorno: number;
  readonly lancamentosDeCompetenciaAnterior: number;
  readonly lancamentosDuplicados: number;
  readonly contasRecorrentesSemLancamento: number;
  readonly contasComClassificacaoInconsistente: number;
  /** Valores, em reais. `valorTotal` é o movimento do mês. */
  readonly valorTotal: number;
  readonly valorForaDoPadrao: number;
  readonly valorDeEstornos: number;
  readonly valorDeCompetenciaAnterior: number;
  readonly valorDuplicado: number;
  readonly valorSemCentroDeCusto: number;
  /** Nulo enquanto não há lista de contas genéricas declarada. */
  readonly valorEmContaGenerica: number | null;
  readonly valorSemNatureza: number;
  readonly valorEmClassificacaoInconsistente: number;
  readonly movimentacaoComPartesRelacionadas: number;
};
