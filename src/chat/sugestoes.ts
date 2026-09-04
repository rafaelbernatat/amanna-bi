/**
 * As três perguntas sugeridas de cada tela (seção 7.6, RF-17).
 *
 * *"Cada tela oferece três perguntas sugeridas, todas respondíveis pelo
 * catálogo (13 telas × 3 = 39 sugestões)."* Elas aparecem no chat como o guia
 * da tela ativa: quem abre a conversa em `fin/caixa` vê três perguntas sobre
 * caixa, e não três sobre turnover.
 *
 * ## Escritas à mão, conferidas por teste
 *
 * A frase é editorial — "Em quantos dias recebemos dos clientes?" lê melhor
 * que "PMR: quanto é?" — e por isso está escrita aqui, e não derivada do
 * catálogo. O que é derivado é a **garantia**: um teste passa cada uma das 39
 * pelo interpretador local e exige que ela caia numa métrica do catálogo, com
 * confiança acima do limiar, e que essa métrica more na tela que a sugere.
 * Uma sugestão que o chat recusaria, ou que levaria a pessoa para outra tela,
 * reprova a suíte.
 *
 * ## Sem importar nada, de propósito
 *
 * Este arquivo vai para o navegador, dentro do componente de chat. Importar o
 * catálogo aqui levaria junto as 145 definições, com fórmula e decisão, para o
 * cliente — e a seção 11 diz que o que sai do servidor é o número agregado,
 * não o catálogo. A conferência contra o catálogo fica no teste, que roda no
 * servidor.
 */

/** Três por tela, na ordem em que aparecem. */
export const SUGESTOES_DA_TELA: Readonly<
  Record<string, readonly [string, string, string]>
> = {
  "rh/visao": [
    "Qual o headcount hoje?",
    "Como está o turnover?",
    "Quanto é a folha total?",
  ],
  "rh/colab": [
    "Qual a idade média do quadro?",
    "Qual o tempo médio de casa?",
    "Quantos têm ensino superior?",
  ],
  "rh/turnover": [
    "Qual o custo de reposição?",
    "Quantos desligamentos tivemos?",
    "Qual o custo do turnover?",
  ],
  "rh/recrut": [
    "Quantas vagas abertas?",
    "Qual o tempo de fechamento das vagas?",
    "Qual o custo por contratação?",
  ],
  "rh/trein": [
    "Quantas horas de treinamento demos?",
    "Qual a conclusão média dos treinamentos?",
    "Qual o investimento em treinamento?",
  ],
  "rh/engaj": [
    "Como está o engajamento por área?",
    "Como está o absenteísmo?",
    "Quantos promotores temos?",
  ],
  "rh/sal": [
    "Qual o salário médio?",
    "Quanto pagamos de encargos?",
    "Quanto gastamos com benefícios?",
  ],
  "fin/visao": [
    "Qual a receita líquida do ano?",
    "Qual é o nosso EBITDA?",
    "Qual o lucro apurado do ano?",
  ],
  "fin/caixa": [
    "Qual o saldo de caixa?",
    "Qual a geração de caixa operacional?",
    "Quanto investimos em capex?",
  ],
  "fin/orc": [
    "Qual o desvio orçamentário?",
    "Quanto foi orçado no ano?",
    "Qual a economia obtida?",
  ],
  "fin/contas": [
    "Em quantos dias recebemos dos clientes?",
    "Em quantos dias pagamos os fornecedores?",
    "Como está a inadimplência?",
  ],
  "fin/fat": [
    "Qual a concentração nos 10 maiores clientes?",
    "Quanto crescemos sobre o ano anterior?",
    "Qual o ticket médio?",
  ],
  "int/cruz": [
    "Qual a receita por colaborador?",
    "Qual o EBITDA per capita?",
    "Qual o peso da folha?",
  ],
};

/**
 * As sugestões de uma tela, dada a rota como `modulo/tela`.
 *
 * Vazio para rota fora do inventário: o chat abre sem guia, e não com o guia
 * de outra tela.
 */
export function sugestoesDaTela(tela: string): readonly string[] {
  return SUGESTOES_DA_TELA[tela] ?? [];
}
