/**
 * O registro dos KPIs das 13 telas (T-145) e o mapa KPI → painel (T-108).
 *
 * Mesmo padrão do registro de painéis: os dados vêm do protótipo e do Anexo A,
 * e o teste confere contra o **PRD lido do arquivo**. O que este registro
 * acrescenta é a ligação que a regra 1 da seção 9.2 exige — *"o KPI e o painel
 * que o detalha somam o mesmo total"* — e que sem um mapa não tem como ser
 * cobrada.
 *
 * ## De onde vem cada campo
 *
 * | Campo | Origem | Confiança |
 * |---|---|---|
 * | `id`, `tela`, `rotulo`, `rodape` | `kpisRaw` do protótipo | alta — extraídos |
 * | `unidade` | formatador usado no protótipo | alta, mas 13 ficam fora do enum |
 * | `sentido` | convenção de leitura do indicador | **a confirmar em H-08** |
 * | `detalhadoPor` | leitura do inventário da tela | **a confirmar em H-08** |
 * | `constanteNoPrototipo` | valor cravado no código | alta — medido |
 *
 * `sentido` e `detalhadoPor` são os dois campos de julgamento. Estão escritos
 * porque um registro sem eles não serve para nada, e porque errar aqui é
 * **visível**: um sentido trocado pinta a seta da cor errada, e alguém vê. É
 * diferente de uma fórmula errada, que produz um número errado em silêncio —
 * por isso fórmula não está aqui, e sim no catálogo (seção 9.4).
 *
 * ## `constanteNoPrototipo`: o achado 5 do Anexo D, contado
 *
 * Catorze dos setenta KPIs têm o valor **cravado** no protótipo: não respondem
 * a filtro nenhum. `Idade média` é sempre `'34,2 anos'`, o `Ciclo de conversão`
 * é sempre `'76 dias'`. Marcá-los aqui transforma o achado numa lista de
 * verificação: quando o adaptador entrar, são exatamente estes que precisam
 * passar a mudar com o recorte, e o teste segura a linha.
 */

import type { Sentido, Unidade } from "@/semantica/contrato";

/** Uma linha do registro de KPIs. */
export type RegistroDeKpi = {
  readonly id: string;
  /** `modulo/tela`, como no Anexo A. */
  readonly tela: string;
  readonly rotulo: string;
  /** `null` quando o enum fechado da seção 9.2 não nomeia a medida (H-45). */
  readonly unidade: Unidade | null;
  readonly sentido: Sentido;
  /** A linha de contexto sob o número. `null` quando o protótipo não traz. */
  readonly rodape: string | null;
  /** O painel desta tela que abre o número. `null` quando não há (T-108). */
  readonly detalhadoPor: string | null;
  /** Obrigatória quando `detalhadoPor` é nulo: por que não há detalhamento. */
  readonly semDetalhamentoPorque?: string;
  /**
   * O protótipo mostra este número cravado, sem responder a filtro.
   *
   * Anexo D achado 5. É lista de verificação para a Fase 2: quando o adaptador
   * entrar, estes precisam passar a mudar com o recorte.
   */
  readonly constanteNoPrototipo: boolean;
};

/** Os 70 KPIs, na ordem das telas do Anexo A. */
export const REGISTRO_DE_KPIS: readonly RegistroDeKpi[] = [
  {
    id: "rh-visao-headcount",
    tela: "rh/visao",
    rotulo: "Headcount",
    unidade: "FTE",
    sentido: "neutro",
    rodape: "FTE no período",
    detalhadoPor: "rh-headcount",
    constanteNoPrototipo: false,
  },
  {
    id: "rh-visao-turnover-12m",
    tela: "rh/visao",
    rotulo: "Turnover 12m",
    unidade: "pct",
    sentido: "menor_melhor",
    rodape: "vs. meta 14%",
    detalhadoPor: "rh-turnover",
    constanteNoPrototipo: false,
  },
  {
    id: "rh-visao-retencao-12m",
    tela: "rh/visao",
    rotulo: "Retenção 12m",
    unidade: "pct",
    sentido: "maior_melhor",
    rodape: "meta 86%",
    detalhadoPor: "rh-retencao",
    constanteNoPrototipo: false,
  },
  {
    id: "rh-visao-enps",
    tela: "rh/visao",
    rotulo: "eNPS",
    unidade: null,
    sentido: "maior_melhor",
    rodape: "zona favorável",
    detalhadoPor: null,
    semDetalhamentoPorque:
      "O painel que detalha eNPS mora em rh/engaj (eng-enps). Aqui o numero e resumo de outra tela, e nenhum dos 6 paineis desta quebra eNPS.",
    constanteNoPrototipo: false,
  },
  {
    id: "rh-visao-custo-por-fte",
    tela: "rh/visao",
    rotulo: "Custo por FTE",
    unidade: "BRL_mi",
    sentido: "menor_melhor",
    rodape: "folha ÷ FTE",
    detalhadoPor: "rh-folha",
    constanteNoPrototipo: false,
  },
  {
    id: "rh-visao-folha-total",
    tela: "rh/visao",
    rotulo: "Folha total",
    unidade: "BRL_mi",
    sentido: "neutro",
    rodape: "da receita",
    detalhadoPor: "rh-folha",
    constanteNoPrototipo: false,
  },
  {
    id: "rh-colab-colaboradores",
    tela: "rh/colab",
    rotulo: "Colaboradores",
    unidade: "FTE",
    sentido: "neutro",
    rodape: "7 áreas",
    detalhadoPor: "col-area",
    constanteNoPrototipo: false,
  },
  {
    id: "rh-colab-idade-media",
    tela: "rh/colab",
    rotulo: "Idade média",
    unidade: null,
    sentido: "neutro",
    rodape: "faixa predominante",
    detalhadoPor: "col-idade",
    constanteNoPrototipo: true,
  },
  {
    id: "rh-colab-tempo-medio-de-casa",
    tela: "rh/colab",
    rotulo: "Tempo médio de casa",
    unidade: null,
    sentido: "maior_melhor",
    rodape: "base jovem de contrato",
    detalhadoPor: "col-tempo",
    constanteNoPrototipo: true,
  },
  {
    id: "rh-colab-trabalho-flexivel",
    tela: "rh/colab",
    rotulo: "Trabalho flexível",
    unidade: "pct",
    sentido: "neutro",
    rodape: null,
    detalhadoPor: "col-perfil",
    constanteNoPrototipo: false,
  },
  {
    id: "rh-colab-estados-atendidos",
    tela: "rh/colab",
    rotulo: "Estados atendidos",
    unidade: null,
    sentido: "neutro",
    rodape: "concentração geográfica",
    detalhadoPor: "col-mapa",
    constanteNoPrototipo: true,
  },
  {
    id: "rh-colab-superior-ou-mais",
    tela: "rh/colab",
    rotulo: "Superior ou mais",
    unidade: "pct",
    sentido: "neutro",
    rodape: "maior titulação declarada",
    detalhadoPor: "col-escol",
    constanteNoPrototipo: false,
  },
  {
    id: "rh-turnover-turnover-12m",
    tela: "rh/turnover",
    rotulo: "Turnover 12m",
    unidade: "pct",
    sentido: "menor_melhor",
    rodape: "vs. meta de 14,0%",
    detalhadoPor: "tov-12m",
    constanteNoPrototipo: false,
  },
  {
    id: "rh-turnover-retencao-12m",
    tela: "rh/turnover",
    rotulo: "Retenção 12m",
    unidade: "pct",
    sentido: "maior_melhor",
    rodape: "100% − turnover",
    detalhadoPor: "tov-12m",
    constanteNoPrototipo: false,
  },
  {
    id: "rh-turnover-desligamentos",
    tela: "rh/turnover",
    rotulo: "Desligamentos",
    unidade: null,
    sentido: "menor_melhor",
    rodape: "no período de 12 meses",
    detalhadoPor: "tov-tipos",
    constanteNoPrototipo: false,
  },
  {
    id: "rh-turnover-custo-do-turnover",
    tela: "rh/turnover",
    rotulo: "Custo do turnover",
    unidade: "BRL_mi",
    sentido: "menor_melhor",
    rodape: "da folha anual",
    detalhadoPor: "tov-custo",
    constanteNoPrototipo: false,
  },
  {
    id: "rh-turnover-custo-de-reposicao",
    tela: "rh/turnover",
    rotulo: "Custo de reposição",
    unidade: "BRL_mi",
    sentido: "menor_melhor",
    rodape: "ramp-up + produtividade",
    detalhadoPor: "tov-custo",
    constanteNoPrototipo: false,
  },
  {
    id: "rh-turnover-tempo-ate-a-saida",
    tela: "rh/turnover",
    rotulo: "Tempo até a saída",
    unidade: null,
    sentido: "maior_melhor",
    rodape: "faixa mais volátil",
    detalhadoPor: "tov-corte",
    constanteNoPrototipo: true,
  },
  {
    id: "rh-recrut-vagas-abertas",
    tela: "rh/recrut",
    rotulo: "Vagas abertas",
    unidade: null,
    sentido: "neutro",
    rodape: "sem candidato em etapa final",
    detalhadoPor: "rec-status",
    constanteNoPrototipo: false,
  },
  {
    id: "rh-recrut-em-andamento",
    tela: "rh/recrut",
    rotulo: "Em andamento",
    unidade: null,
    sentido: "neutro",
    rodape: "triagem a proposta",
    detalhadoPor: "rec-funil",
    constanteNoPrototipo: false,
  },
  {
    id: "rh-recrut-fechadas-12m",
    tela: "rh/recrut",
    rotulo: "Fechadas (12m)",
    unidade: null,
    sentido: "maior_melhor",
    rodape: "contratações efetivadas",
    detalhadoPor: "rec-status",
    constanteNoPrototipo: false,
  },
  {
    id: "rh-recrut-tempo-de-fechamento",
    tela: "rh/recrut",
    rotulo: "Tempo de fechamento",
    unidade: "dias",
    sentido: "menor_melhor",
    rodape: "meta de 40 dias",
    detalhadoPor: "rec-tempo",
    constanteNoPrototipo: true,
  },
  {
    id: "rh-recrut-custo-por-contratacao",
    tela: "rh/recrut",
    rotulo: "Custo por contratação",
    unidade: "BRL_mi",
    sentido: "menor_melhor",
    rodape: "vs. ano anterior",
    detalhadoPor: null,
    semDetalhamentoPorque:
      "Nenhum dos 7 paineis de rh/recrut quebra custo: o funil e o status mostram volume de vaga e de candidato, nao reais gastos por contratacao.",
    constanteNoPrototipo: true,
  },
  {
    id: "rh-recrut-canceladas",
    tela: "rh/recrut",
    rotulo: "Canceladas",
    unidade: null,
    sentido: "menor_melhor",
    rodape: "do total movimentado no ano",
    detalhadoPor: "rec-status",
    constanteNoPrototipo: false,
  },
  {
    id: "rh-trein-horas-de-treinamento",
    tela: "rh/trein",
    rotulo: "Horas de treinamento",
    unidade: null,
    sentido: "maior_melhor",
    rodape: "no período",
    detalhadoPor: "tre-horas",
    constanteNoPrototipo: false,
  },
  {
    id: "rh-trein-participacao",
    tela: "rh/trein",
    rotulo: "Participação",
    unidade: "pct",
    sentido: "maior_melhor",
    rodape: "dos FTE com ao menos 1 trilha",
    detalhadoPor: "tre-horas",
    constanteNoPrototipo: true,
  },
  {
    id: "rh-trein-conclusao-media",
    tela: "rh/trein",
    rotulo: "Conclusão média",
    unidade: "pct",
    sentido: "maior_melhor",
    rodape: "gargalo no autoinstrucional",
    detalhadoPor: "tre-conclusao",
    constanteNoPrototipo: true,
  },
  {
    id: "rh-trein-investimento",
    tela: "rh/trein",
    rotulo: "Investimento",
    unidade: "BRL_mi",
    sentido: "neutro",
    rodape: "da folha anual",
    detalhadoPor: "tre-area",
    constanteNoPrototipo: false,
  },
  {
    id: "rh-trein-custo-por-hora",
    tela: "rh/trein",
    rotulo: "Custo por hora",
    unidade: "BRL_mi",
    sentido: "menor_melhor",
    rodape: "investimento ÷ horas",
    detalhadoPor: null,
    semDetalhamentoPorque:
      "E razao entre investimento e horas, e os dois lados aparecem em paineis diferentes desta tela (tre-area e tre-horas). Nenhum quebra a razao, e apontar para um dos lados sozinho reconciliaria contra o numero errado.",
    constanteNoPrototipo: false,
  },
  {
    id: "rh-trein-horas-por-fte",
    tela: "rh/trein",
    rotulo: "Horas por FTE",
    unidade: null,
    sentido: "maior_melhor",
    rodape: "no período",
    detalhadoPor: "tre-horas",
    constanteNoPrototipo: false,
  },
  {
    id: "rh-engaj-enps",
    tela: "rh/engaj",
    rotulo: "eNPS",
    unidade: null,
    sentido: "maior_melhor",
    rodape: "histórico de 12 meses",
    detalhadoPor: "eng-enps",
    constanteNoPrototipo: false,
  },
  {
    id: "rh-engaj-engajamento",
    tela: "rh/engaj",
    rotulo: "Engajamento",
    unidade: "pct",
    sentido: "maior_melhor",
    rodape: "pesquisa trimestral",
    detalhadoPor: "eng-eng",
    constanteNoPrototipo: false,
  },
  {
    id: "rh-engaj-absenteismo",
    tela: "rh/engaj",
    rotulo: "Absenteísmo",
    unidade: "pct",
    sentido: "menor_melhor",
    rodape: "horas não trabalhadas",
    detalhadoPor: "eng-abs",
    constanteNoPrototipo: false,
  },
  {
    id: "rh-engaj-promotores",
    tela: "rh/engaj",
    rotulo: "Promotores",
    unidade: "pct",
    sentido: "maior_melhor",
    rodape: "da última pesquisa",
    detalhadoPor: "eng-cat",
    constanteNoPrototipo: false,
  },
  {
    id: "rh-engaj-cobertura-da-pesquisa",
    tela: "rh/engaj",
    rotulo: "Cobertura da pesquisa",
    unidade: "pct",
    sentido: "maior_melhor",
    rodape: "do quadro elegível",
    detalhadoPor: null,
    semDetalhamentoPorque:
      "Nenhum dos 6 paineis quebra cobertura: e metadado da pesquisa (quantos responderam), nao medida do quadro.",
    constanteNoPrototipo: false,
  },
  {
    id: "rh-engaj-area-mais-critica",
    tela: "rh/engaj",
    rotulo: "Área mais crítica",
    unidade: "pct",
    sentido: "maior_melhor",
    rodape: "menor engajamento",
    detalhadoPor: "eng-area",
    constanteNoPrototipo: false,
  },
  {
    id: "rh-sal-folha-total",
    tela: "rh/sal",
    rotulo: "Folha total",
    unidade: "BRL_mi",
    sentido: "neutro",
    rodape: "da receita líquida",
    detalhadoPor: "sal-folha",
    constanteNoPrototipo: false,
  },
  {
    id: "rh-sal-salario-medio",
    tela: "rh/sal",
    rotulo: "Salário médio",
    unidade: "BRL_mi",
    sentido: "neutro",
    rodape: "base mensal, sem encargos",
    detalhadoPor: "sal-medio",
    constanteNoPrototipo: false,
  },
  {
    id: "rh-sal-custo-por-colaborador",
    tela: "rh/sal",
    rotulo: "Custo por colaborador",
    unidade: "BRL_mi",
    sentido: "menor_melhor",
    rodape: "folha ÷ FTE anualizado",
    detalhadoPor: "sal-folha",
    constanteNoPrototipo: false,
  },
  {
    id: "rh-sal-encargos",
    tela: "rh/sal",
    rotulo: "Encargos",
    unidade: "pct",
    sentido: "menor_melhor",
    rodape: "R$ 42 mi sobre R$ 112 mi",
    detalhadoPor: "sal-comp",
    constanteNoPrototipo: true,
  },
  {
    id: "rh-sal-beneficios",
    tela: "rh/sal",
    rotulo: "Benefícios",
    unidade: "BRL_mi",
    sentido: "neutro",
    rodape: "saúde = 47% do pacote",
    detalhadoPor: "sal-benef",
    constanteNoPrototipo: false,
  },
  {
    id: "rh-sal-variavel",
    tela: "rh/sal",
    rotulo: "Variável",
    unidade: "BRL_mi",
    sentido: "neutro",
    rodape: "bônus e horas extras",
    detalhadoPor: "sal-comp",
    constanteNoPrototipo: false,
  },
  {
    id: "fin-visao-receita-bruta",
    tela: "fin/visao",
    rotulo: "Receita bruta",
    unidade: "BRL_mi",
    sentido: "maior_melhor",
    rodape: "vs. mesmo período do ano anterior",
    detalhadoPor: "fin-receita",
    constanteNoPrototipo: false,
  },
  {
    id: "fin-visao-receita-liquida",
    tela: "fin/visao",
    rotulo: "Receita líquida",
    unidade: "BRL_mi",
    sentido: "maior_melhor",
    rodape: "após deduções de 15%",
    detalhadoPor: "fin-receita",
    constanteNoPrototipo: false,
  },
  {
    id: "fin-visao-ebitda",
    tela: "fin/visao",
    rotulo: "EBITDA",
    unidade: "BRL_mi",
    sentido: "maior_melhor",
    rodape: "margem EBITDA",
    detalhadoPor: "fin-ebitda",
    constanteNoPrototipo: false,
  },
  {
    id: "fin-visao-margem-bruta",
    tela: "fin/visao",
    rotulo: "Margem bruta",
    unidade: "pct",
    sentido: "maior_melhor",
    rodape: "CMV em 60% da receita",
    detalhadoPor: "fin-margens",
    constanteNoPrototipo: false,
  },
  {
    id: "fin-visao-margem-liquida",
    tela: "fin/visao",
    rotulo: "Margem líquida",
    unidade: "pct",
    sentido: "maior_melhor",
    rodape: "juros consomem todo o EBIT",
    detalhadoPor: "fin-margens",
    constanteNoPrototipo: false,
  },
  {
    id: "fin-visao-lucro-liquido",
    tela: "fin/visao",
    rotulo: "Lucro líquido",
    unidade: "BRL_mi",
    sentido: "maior_melhor",
    rodape: "cobertura de juros 1,0x",
    detalhadoPor: "fin-dre",
    constanteNoPrototipo: false,
  },
  {
    id: "fin-caixa-saldo-de-caixa",
    tela: "fin/caixa",
    rotulo: "Saldo de caixa",
    unidade: "BRL_mi",
    sentido: "maior_melhor",
    rodape: "vs. saldo inicial de ",
    detalhadoPor: "cx-saldo",
    constanteNoPrototipo: false,
  },
  {
    id: "fin-caixa-geracao-operacional",
    tela: "fin/caixa",
    rotulo: "Geração operacional",
    unidade: "BRL_mi",
    sentido: "maior_melhor",
    rodape: "FCO ÷ EBITDA no ano",
    detalhadoPor: "cx-ponte",
    constanteNoPrototipo: false,
  },
  {
    id: "fin-caixa-investimento-fci",
    tela: "fin/caixa",
    rotulo: "Investimento (FCI)",
    unidade: "BRL_mi",
    sentido: "neutro",
    rodape: "manutenção e expansão",
    detalhadoPor: "cx-ponte",
    constanteNoPrototipo: false,
  },
  {
    id: "fin-caixa-financiamento-fcf",
    tela: "fin/caixa",
    rotulo: "Financiamento (FCF)",
    unidade: "BRL_mi",
    sentido: "neutro",
    rodape: "amortização ",
    detalhadoPor: "cx-ponte",
    constanteNoPrototipo: false,
  },
  {
    id: "fin-caixa-conversao-de-dez",
    tela: "fin/caixa",
    rotulo: "Conversão de Dez",
    unidade: "pct",
    sentido: "maior_melhor",
    rodape: "abaixo do gatilho de 80%",
    detalhadoPor: "cx-ponte",
    constanteNoPrototipo: false,
  },
  {
    id: "fin-orc-orcado",
    tela: "fin/orc",
    rotulo: "Orçado",
    unidade: "BRL_mi",
    sentido: "neutro",
    rodape: "todos os centros de custo",
    detalhadoPor: "orc-vs",
    constanteNoPrototipo: false,
  },
  {
    id: "fin-orc-realizado",
    tela: "fin/orc",
    rotulo: "Realizado",
    unidade: "BRL_mi",
    sentido: "neutro",
    rodape: "vs. orçado do período",
    detalhadoPor: "orc-vs",
    constanteNoPrototipo: false,
  },
  {
    id: "fin-orc-desvio",
    tela: "fin/orc",
    rotulo: "Desvio",
    unidade: "BRL_mi",
    sentido: "menor_melhor",
    rodape: "estouro acumulado",
    detalhadoPor: "orc-desvio",
    constanteNoPrototipo: false,
  },
  {
    id: "fin-orc-economia-obtida",
    tela: "fin/orc",
    rotulo: "Economia obtida",
    unidade: "BRL_mi",
    sentido: "maior_melhor",
    rodape: null,
    detalhadoPor: "orc-desvio",
    constanteNoPrototipo: false,
  },
  {
    id: "fin-contas-pmr",
    tela: "fin/contas",
    rotulo: "PMR",
    unidade: "dias",
    sentido: "menor_melhor",
    rodape: "contas a receber R$ 171 mi",
    detalhadoPor: "ct-ciclo",
    constanteNoPrototipo: true,
  },
  {
    id: "fin-contas-pme",
    tela: "fin/contas",
    rotulo: "PME",
    unidade: "dias",
    sentido: "menor_melhor",
    rodape: "estoques R$ 148 mi",
    detalhadoPor: "ct-ciclo",
    constanteNoPrototipo: true,
  },
  {
    id: "fin-contas-pmp",
    tela: "fin/contas",
    rotulo: "PMP",
    unidade: "dias",
    sentido: "maior_melhor",
    rodape: "fornecedores R$ 101 mi",
    detalhadoPor: "ct-ciclo",
    constanteNoPrototipo: true,
  },
  {
    id: "fin-contas-ciclo-de-conversao",
    tela: "fin/contas",
    rotulo: "Ciclo de conversão",
    unidade: "dias",
    sentido: "menor_melhor",
    rodape: "PMR + PME − PMP",
    detalhadoPor: "ct-ciclo",
    constanteNoPrototipo: true,
  },
  {
    id: "fin-contas-inadimplencia",
    tela: "fin/contas",
    rotulo: "Inadimplência",
    unidade: "pct",
    sentido: "menor_melhor",
    rodape: "R$ 7 mi sobre R$ 171 mi",
    detalhadoPor: "cr-inadim",
    constanteNoPrototipo: false,
  },
  {
    id: "fin-fat-faturamento",
    tela: "fin/fat",
    rotulo: "Faturamento",
    unidade: "BRL_mi",
    sentido: "maior_melhor",
    rodape: "receita líquida do período",
    detalhadoPor: "fat-evolucao",
    constanteNoPrototipo: false,
  },
  {
    id: "fin-fat-crescimento-yoy",
    tela: "fin/fat",
    rotulo: "Crescimento YoY",
    unidade: "pct",
    sentido: "maior_melhor",
    rodape: "base do ano anterior: ",
    detalhadoPor: "fat-evolucao",
    constanteNoPrototipo: false,
  },
  {
    id: "fin-fat-ticket-medio",
    tela: "fin/fat",
    rotulo: "Ticket médio",
    unidade: "BRL_mi",
    sentido: "maior_melhor",
    rodape: "18.400 notas emitidas",
    detalhadoPor: null,
    semDetalhamentoPorque:
      "Nenhum dos 4 paineis desta tela quebra por nota emitida; o ticket sai de faturamento sobre contagem de notas.",
    constanteNoPrototipo: true,
  },
  {
    id: "fin-fat-concentracao-top-10",
    tela: "fin/fat",
    rotulo: "Concentração top 10",
    unidade: "pct",
    sentido: "menor_melhor",
    rodape: "risco moderado de dependência",
    detalhadoPor: "fat-risco",
    constanteNoPrototipo: false,
  },
  {
    id: "int-cruz-receita-por-colaborador",
    tela: "int/cruz",
    rotulo: "Receita por colaborador",
    unidade: "BRL_mi",
    sentido: "maior_melhor",
    rodape: "anualizado por FTE",
    detalhadoPor: "int-rpc",
    constanteNoPrototipo: false,
  },
  {
    id: "int-cruz-ebitda-per-capita",
    tela: "int/cruz",
    rotulo: "EBITDA per capita",
    unidade: "BRL_mi",
    sentido: "maior_melhor",
    rodape: "anualizado por FTE",
    detalhadoPor: "int-ebitda-pc",
    constanteNoPrototipo: false,
  },
  {
    id: "int-cruz-despesa-de-pessoal",
    tela: "int/cruz",
    rotulo: "Despesa de pessoal",
    unidade: "pct",
    sentido: "menor_melhor",
    rodape: "sobre a receita líquida",
    detalhadoPor: "int-pct",
    constanteNoPrototipo: false,
  },
  {
    id: "int-cruz-headcount",
    tela: "int/cruz",
    rotulo: "Headcount",
    unidade: "FTE",
    sentido: "neutro",
    rodape: "FTE no fim do período",
    detalhadoPor: "int-hc-desp",
    constanteNoPrototipo: false,
  },
];

/** Quantos KPIs o registro tem. Contado, nunca escrito. */
export const QUANTIDADE_DE_KPIS = REGISTRO_DE_KPIS.length;

const POR_ID: ReadonlyMap<string, RegistroDeKpi> = new Map(
  REGISTRO_DE_KPIS.map((k) => [k.id, k]),
);

export function kpiPorId(id: string): RegistroDeKpi | undefined {
  return POR_ID.get(id);
}

/** Os KPIs de uma tela, na ordem em que aparecem. */
export function kpisDaTela(tela: string): readonly RegistroDeKpi[] {
  return REGISTRO_DE_KPIS.filter((k) => k.tela === tela);
}

/**
 * Os KPIs sem painel que os detalhe (T-108).
 *
 * Cada um carrega justificativa escrita. Não é lacuna: é a afirmação de que
 * aquele número não se abre nesta tela — e a afirmação fica registrada para
 * que a próxima pessoa não gaste meia hora procurando o painel que falta.
 */
export const SEM_DETALHAMENTO: readonly RegistroDeKpi[] =
  REGISTRO_DE_KPIS.filter((k) => k.detalhadoPor === null);

/**
 * Os KPIs cravados no protótipo (Anexo D achado 5).
 *
 * Fixado em teste para **só encolher**: cada um que passar a responder ao
 * recorte sai desta lista, e a lista só cresce por decisão.
 */
export const CONSTANTES_NO_PROTOTIPO: readonly RegistroDeKpi[] =
  REGISTRO_DE_KPIS.filter((k) => k.constanteNoPrototipo);

/** Os KPIs cuja medida o enum fechado da seção 9.2 não nomeia (H-45). */
export const KPIS_SEM_UNIDADE_NO_ENUM: readonly RegistroDeKpi[] =
  REGISTRO_DE_KPIS.filter((k) => k.unidade === null);
