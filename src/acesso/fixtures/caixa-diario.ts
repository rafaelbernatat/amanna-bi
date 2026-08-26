/**
 * `vw_fato_caixa_diario` — o caixa com resolução de dia (T-117.1).
 *
 * ## Por que existe uma view de grão dia
 *
 * O painel `cx-diario` do Anexo A.1 mostra "movimentação diária de caixa —
 * últimos 30 dias": uma barra por dia útil, com os dias negativos concentrados
 * nas datas de vencimento. As outras nove views da seção 10.1 são todas de grão
 * mês, então esse painel não tinha de onde sair — e a falta não aparecia,
 * porque o levantamento de T-143 percorreu as medidas dos KPIs do achado 5 e
 * não os painéis.
 *
 * ## A amarra que impede duas verdades
 *
 * Esta view **não** é uma segunda opinião sobre o caixa. É a mesma, com mais
 * resolução, e a igualdade é por construção: os dias de um mês são a repartição
 * exata das colunas mensais de `vw_fato_fin_mes`, pelo mesmo algoritmo de maior
 * resto que o resto da fixture usa. Somar os dias de janeiro devolve janeiro,
 * ao centavo.
 *
 * Isso importa mais do que parece. Se a série diária fosse gerada por conta
 * própria, o produto teria dois números de caixa que discordariam em silêncio —
 * e o princípio PR-1 ("uma leitura, uma fonte") existe exatamente para impedir
 * isso. Um teste fixa a reconciliação nos dois sentidos.
 *
 * ## O formato do mês, e por que ele não é aleatório
 *
 * A nota do protótipo diz "9 dos 30 dias fecharam negativos, concentrados nas
 * datas de vencimento". Um mês de caixa real tem forma: saída pesada nos dias
 * de pagamento a fornecedor, folha e imposto; entrada mais espalhada, com
 * concentração alguns dias depois do faturamento. Distribuir por igual daria
 * trinta barras iguais, que desenham um retângulo e não ensinam nada sobre o
 * painel que se quer aprovar.
 *
 * Os pesos abaixo são **perfil declarado**, não sorteio: a fixture precisa dar
 * o mesmo resultado em toda execução, senão o teste que reconcilia hoje passa e
 * amanhã não.
 */

import { ENTIDADES_ARMAZENADAS, mesesDe } from "@/acesso/fixtures/eixos";
import { VW_FATO_FIN_MES } from "@/acesso/fixtures/fin";
import { repartir } from "@/acesso/fixtures/reparticao";

/** Uma linha da view: um dia útil, uma entidade. */
export type LinhaCaixaDiario = {
  /** Dia no formato `AAAA-MM-DD`. */
  readonly dia: string;
  readonly mes: string;
  readonly entidade: string;
  readonly entradas: number;
  readonly saidas: number;
};

/** Dias de cada mês em ano comum. Fevereiro trata bissexto à parte. */
const DIAS_NO_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

const SABADO = 6;
const DOMINGO = 0;

/**
 * O dia da semana, em UTC.
 *
 * `Date.UTC` e não `new Date("2026-01-05")`: a segunda forma depende do fuso da
 * máquina para datas sem hora em alguns motores, e uma fixture que muda de
 * conteúdo conforme o relógio de quem roda o teste não é fixture.
 */
function diaDaSemana(ano: number, mes: number, dia: number): number {
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
}

function ehBissexto(ano: number): boolean {
  const QUATRO = 4;
  const CEM = 100;
  const QUATROCENTOS = 400;
  return (ano % QUATRO === 0 && ano % CEM !== 0) || ano % QUATROCENTOS === 0;
}

/** Os dias úteis de um mês `AAAA-MM`, em ordem. Feriado não entra na fixture. */
export function diasUteisDoMes(mes: string): readonly string[] {
  const [anoTexto, mesTexto] = mes.split("-");
  const ano = Number(anoTexto);
  const numeroDoMes = Number(mesTexto);
  const FEVEREIRO = 2;
  const quantos =
    numeroDoMes === FEVEREIRO && ehBissexto(ano)
      ? (DIAS_NO_MES[1] ?? 0) + 1
      : (DIAS_NO_MES[numeroDoMes - 1] ?? 0);

  const dias: string[] = [];
  for (let dia = 1; dia <= quantos; dia += 1) {
    const semana = diaDaSemana(ano, numeroDoMes, dia);
    if (semana === SABADO || semana === DOMINGO) continue;
    dias.push(`${mes}-${dia < 10 ? `0${String(dia)}` : String(dia)}`);
  }
  return dias;
}

/**
 * Os dias do mês em que a saída de caixa se concentra.
 *
 * Vencimento de fornecedor no 5 e no 20, adiantamento de folha no 5, imposto no
 * 20, fechamento de folha no 30. É o calendário que a maioria das empresas
 * segue, e é o que produz a leitura que o painel quer mostrar: alguns dias
 * muito negativos no meio de muitos dias pequenos.
 *
 * Exportado porque o teste do perfil precisa citá-los por nome. Um teste que
 * repete `5` e `20` escritos à mão passa a afirmar o que ele mesmo escreveu, e
 * deixa de conferir o módulo.
 */
export const DIAS_DE_CONCENTRACAO_DE_SAIDA = [5, 20, 30] as const;

/**
 * O peso de um dia do mês nas saídas.
 *
 * O dia 5 é o mais pesado dos três, e não por acaso: ele acumula vencimento de
 * fornecedor **e** adiantamento de folha. O 30 fecha a folha e o 20 junta
 * fornecedor com imposto.
 */
function pesoDeSaida(dia: number): number {
  const BASE = 4;
  const FORNECEDOR_E_ADIANTAMENTO = 26;
  const FORNECEDOR_E_IMPOSTO = 21;
  const FECHAMENTO_DE_FOLHA = 17;
  const VIZINHO = 9;

  if (dia === 5) return FORNECEDOR_E_ADIANTAMENTO;
  if (dia === 20) return FORNECEDOR_E_IMPOSTO;
  if (dia === 30) return FECHAMENTO_DE_FOLHA;
  if (DIAS_DE_CONCENTRACAO_DE_SAIDA.some((d) => Math.abs(d - dia) === 1)) {
    return VIZINHO;
  }
  return BASE;
}

/**
 * O peso de um dia do mês nas entradas.
 *
 * Recebimento é mais espalhado que pagamento — o cliente paga quando paga — com
 * concentração na primeira quinzena, quando vencem as notas do mês anterior.
 */
function pesoDeEntrada(dia: number): number {
  const BASE = 6;
  const QUINZENA = 11;
  const FIM_DE_MES = 8;
  const PRIMEIRA_QUINZENA = 15;
  const ULTIMOS = 25;

  if (dia <= PRIMEIRA_QUINZENA) return QUINZENA;
  if (dia >= ULTIMOS) return FIM_DE_MES;
  return BASE;
}

function numeroDoDia(dia: string): number {
  const partes = dia.split("-");
  return Number(partes[2]);
}

/**
 * A view.
 *
 * Um `repartir` por mês, por entidade e por medida. Como `repartir` distribui
 * pelo maior resto, a soma dos dias é **exatamente** o total do mês — sem
 * arredondamento sobrando, que é o que faria a reconciliação falhar por um
 * centavo e mandar quem investiga procurar um erro de negócio que não existe.
 */
export const VW_FATO_CAIXA_DIARIO: readonly LinhaCaixaDiario[] = (() => {
  const porMesEEntidade = new Map<
    string,
    { entradas: number; saidas: number }
  >();
  for (const linha of VW_FATO_FIN_MES) {
    porMesEEntidade.set(`${linha.mes}|${linha.entidade}`, {
      entradas: linha.entradasDeCaixa,
      saidas: linha.saidasDeCaixa,
    });
  }

  const anos = [...new Set(VW_FATO_FIN_MES.map((l) => l.mes.slice(0, 4)))];
  const saida: LinhaCaixaDiario[] = [];

  for (const ano of anos) {
    for (const mes of mesesDe(ano)) {
      const dias = diasUteisDoMes(mes);
      const numeros = dias.map(numeroDoDia);
      const pesosDeEntrada = numeros.map(pesoDeEntrada);
      const pesosDeSaida = numeros.map(pesoDeSaida);

      for (const entidade of ENTIDADES_ARMAZENADAS) {
        const total = porMesEEntidade.get(`${mes}|${entidade}`);
        if (total === undefined) continue;

        const entradas = repartir(total.entradas, pesosDeEntrada);
        const saidas = repartir(total.saidas, pesosDeSaida);

        dias.forEach((dia, i) => {
          saida.push({
            dia,
            mes,
            entidade,
            entradas: entradas[i] ?? 0,
            saidas: saidas[i] ?? 0,
          });
        });
      }
    }
  }

  return saida;
})();
