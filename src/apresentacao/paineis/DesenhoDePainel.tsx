import type { ReactNode } from "react";

import { rotuloDeCategoria } from "@/apresentacao/formato/categoria";
import { formatarValor } from "@/apresentacao/formato/formato";
import { alturaDaForma } from "@/apresentacao/graficos/altura";
import { CaixaDeGrafico } from "@/apresentacao/graficos/CaixaDeGrafico";
import { GraficoDeBarras } from "@/apresentacao/graficos/GraficoDeBarras";
import { GraficoDeBarrasEmpilhadas } from "@/apresentacao/graficos/GraficoDeBarrasEmpilhadas";
import { GraficoDeBarrasHorizontais } from "@/apresentacao/graficos/GraficoDeBarrasHorizontais";
import { GraficoDeCascata } from "@/apresentacao/graficos/GraficoDeCascata";
import { GraficoDeDispersao } from "@/apresentacao/graficos/GraficoDeDispersao";
import { GraficoDeDivisao } from "@/apresentacao/graficos/GraficoDeDivisao";
import { GraficoDeEstatisticas } from "@/apresentacao/graficos/GraficoDeEstatisticas";
import { GraficoDeFunil } from "@/apresentacao/graficos/GraficoDeFunil";
import { GraficoDeLinha } from "@/apresentacao/graficos/GraficoDeLinha";
import { GraficoDeReguaDeCiclo } from "@/apresentacao/graficos/GraficoDeReguaDeCiclo";
import { GraficoDeRosca } from "@/apresentacao/graficos/GraficoDeRosca";
import { MosaicoGeografico } from "@/apresentacao/graficos/MosaicoGeografico";
import {
  configuracaoDeEixo,
  larguraDoSpan,
} from "@/apresentacao/graficos/nucleo";
import { SemDado } from "@/apresentacao/graficos/SemDado";
import { corDaCategoria, COR_DO_SENTIDO } from "@/apresentacao/tema/sequencia";
import { PALETA } from "@/apresentacao/tema/tema";
import type { PanelResponse, Serie, Unidade } from "@/semantica/contrato";
import type { Forma } from "@/semantica/painel";

/**
 * Do envelope ao desenho: a única ponte entre `getPanel` e as doze primitivas.
 *
 * ## Por que existe um lugar só
 *
 * A união de `PanelResponse` tem doze variantes, e cada tela que quisesse
 * desenhar um painel precisaria estreitar a união por conta própria. Treze
 * telas fazendo isso dariam treze respostas para "o que é uma barra sem dado" —
 * e a diferença entre elas apareceria como bug de uma tela só, meses depois.
 * Aqui o `switch` é exaustivo sobre `forma`: acrescentar uma décima terceira
 * forma ao Anexo A.1 **para de compilar** até alguém decidir como ela desenha.
 *
 * ## O que este módulo decide, e o que ele não decide
 *
 * **Decide** o que é apresentação: qual primitiva, qual cor da paleta, quantas
 * colunas de estatística cabem, se a série de escala destoante vai para o eixo
 * secundário. Nada disso está no dado, e nada disso pode estar — cor no
 * envelope faria trocar a paleta virar migração de dado (T-102).
 *
 * **Não decide** nenhum número. Todo valor exibido vem do envelope, e a
 * formatação passa por `formatarValor` — o módulo único de T-125.
 *
 * ## Onde cai a divisão com os componentes de gráfico
 *
 * Os componentes de `graficos/` não formatam e não calculam (T-129, princípio
 * PR-1) — o teste de arquitetura reprova `toFixed`, `Intl` e `toLocaleString`
 * lá dentro. Então a fração de cada barra, a conversão de cada passo do funil e
 * o texto de cada valor são resolvidos **aqui**, e chegam lá prontos. Este
 * arquivo é onde o dado vira geometria.
 */

/** O que se mostra onde não há número: nunca zero (princípio PR-4). */
const TRACO = "—";

/** Fração convertida em porcentagem, para os textos de conversão. */
const PERCENTUAL = 100;

/** Nenhuma medida — o valor neutro de uma soma ou de um máximo. */
const ZERO = 0;

/**
 * A partir de que razão duas séries deixam de caber no mesmo eixo.
 *
 * `rh-headcount` traz admissões (dezenas) e headcount (milhares) na mesma
 * resposta: no mesmo eixo, as barras de admissão viram uma linha de um pixel
 * colada no chão. O protótipo resolveu isso à mão, painel a painel; aqui a
 * decisão sai do dado — se a maior série é cinco vezes maior que a segunda,
 * elas não compartilham escala, e a maior vai para o eixo da direita como
 * linha.
 *
 * Cinco, e não dez, porque `rh-retencao` mistura retenção em porcentagem com
 * saldo de pessoas numa razão de sete: são grandezas diferentes, e o eixo
 * também precisa ser.
 */
const SEPARACAO_DE_ESCALA = 5;

/** Diâmetro do ponto de dispersão, do menor ao maior (T-165). */
const DIAMETRO_MINIMO = 8;
const DIAMETRO_MAXIMO = 26;

/** Folga em torno da nuvem de pontos, para nenhum encostar na borda. */
const FOLGA_DA_DISPERSAO = 0.12;

/**
 * Colunas de estatística que cabem num painel estreito.
 *
 * Duas, e não três. Um painel de 4 colunas da grade tem ~346 px de referência:
 * repartido em três, cada número fica com 93 px e "R$ 0,6 mi" sai cortado.
 * Repartido em dois, fica com 173 px, e o número cabe inteiro — que é a única
 * razão de o número estar ali.
 */
const COLUNAS_EM_PAINEL_ESTREITO = 2;

/** A partir deste `span` cabe uma coluna por número. */
const SPAN_LARGO = 8;

/* ------------------------------------------------------------------ *
 * Auxiliares
 * ------------------------------------------------------------------ */

/** O valor formatado, ou o travessão quando não há dado. */
function texto(valor: number | null, unidade: Unidade): string {
  return valor === null ? TRACO : formatarValor(valor, unidade);
}

/** Os valores finitos de uma lista — o que o eixo e o máximo podem usar. */
function finitos(valores: readonly (number | null)[]): number[] {
  return valores.filter((v): v is number => v !== null && Number.isFinite(v));
}

/** O maior valor absoluto de uma série. Zero quando não há nenhum. */
function maiorAbsoluto(valores: readonly (number | null)[]): number {
  const nums = finitos(valores).map((v) => Math.abs(v));
  return nums.length === 0 ? ZERO : Math.max(...nums);
}

/** As séries de medida, na ordem do envelope. */
function deValor(series: readonly Serie[]): readonly Serie[] {
  return series.filter((s) => s.papel === "valor");
}

/** A série de meta, orçado ou benchmark, quando o painel tem uma. */
function deReferencia(series: readonly Serie[]): Serie | undefined {
  return series.find((s) => s.papel === "referencia");
}

/**
 * O índice da série que não cabe no eixo das outras, ou `null`.
 *
 * Só considera a **maior**: duas séries fora de escala pediriam dois eixos
 * secundários, e um painel com três escalas não é um painel — é três painéis
 * que alguém juntou.
 */
function foraDeEscala(series: readonly Serie[]): number | null {
  if (series.length < SEGUNDA_SERIE) return null;
  const maximos = series.map((s) => maiorAbsoluto(s.values));
  const maior = Math.max(...maximos);
  const indice = maximos.indexOf(maior);
  const outros = maximos.filter((_, i) => i !== indice);
  const segundo = Math.max(...outros);
  if (segundo === ZERO) return null;
  return maior >= segundo * SEPARACAO_DE_ESCALA ? indice : null;
}

/** Quantas séries um painel precisa ter para haver o que comparar. */
const SEGUNDA_SERIE = 2;

/** O painel não tem número nenhum para desenhar. */
function semNumero(valores: readonly (number | null)[]): boolean {
  return finitos(valores).length === ZERO;
}

/** O estado "sem dado neste recorte", na altura da forma (seção 6.4). */
function Vazio({ forma }: { readonly forma: Forma }) {
  return <SemDado motivo="sem_dado_no_recorte" altura={alturaDaForma(forma)} />;
}

/**
 * A alternativa textual do desenho (PRD seção 13).
 *
 * Vale para as formas que saem como SVG: ali o gráfico é uma imagem, e sem
 * `aria-label` não há o que ler. As formas que desenham com texto — ranking,
 * estatísticas, funil, mosaico — não passam por aqui de propósito: o número
 * delas já é texto na página, e embrulhá-las em `role="img"` esconderia de um
 * leitor de tela exatamente o que ele conseguiria ler.
 */
function Desenhado({
  painel,
  forma,
  children,
}: {
  readonly painel: PanelResponse;
  readonly forma: Forma;
  readonly children: ReactNode;
}) {
  return (
    <CaixaDeGrafico
      altura={alturaDaForma(forma)}
      rotulo={`${painel.title}. ${painel.formula}`}
    >
      {children}
    </CaixaDeGrafico>
  );
}

/**
 * O intervalo de um eixo de dispersão, com folga nas duas pontas.
 *
 * Sem folga, o ponto extremo fica metade fora da caixa. `amplitude` nunca é
 * zero: uma nuvem de pontos idênticos abriria a divisão por zero que colocaria
 * `NaN%` na posição de cada ponto.
 */
function comFolga(
  minimo: number,
  maximo: number,
): {
  readonly minimo: number;
  readonly maximo: number;
  readonly amplitude: number;
} {
  const bruta = maximo - minimo;
  const folga =
    bruta === ZERO
      ? Math.abs(maximo) || FOLGA_MINIMA
      : bruta * FOLGA_DA_DISPERSAO;
  const de = minimo - folga;
  const ate = maximo + folga;
  return { minimo: de, maximo: ate, amplitude: ate - de };
}

/** Folga de uma nuvem degenerada — todos os pontos no mesmo lugar. */
const FOLGA_MINIMA = 1;

/* ------------------------------------------------------------------ *
 * A ponte
 * ------------------------------------------------------------------ */

export function DesenhoDePainel({
  painel,
  span,
}: {
  readonly painel: PanelResponse;
  /**
   * Colunas da grade de 12 que o painel ocupa (seção 5).
   *
   * Entra em duas decisões de leitura: quantos rótulos cabem no eixo, e quantos
   * números de estatística cabem lado a lado. Vem do registro de T-107, e não
   * de uma medição no cliente — medir custaria a segunda pintura que T-129
   * zerou.
   */
  readonly span: number;
}) {
  const largura = larguraDoSpan(span);

  switch (painel.forma) {
    case "barras": {
      const series = deValor(painel.series);
      const referencia = deReferencia(painel.series);
      if (semNumero(series.flatMap((s) => [...s.values]))) {
        return <Vazio forma={painel.forma} />;
      }

      /*
       * A série fora de escala vira linha no eixo da direita — mas só quando
       * não há meta. Com meta, a linha é dela: uma meta desenhada como barra
       * entre as medidas afirmaria que ela é mais uma medida do período.
       */
      const destoante = referencia === undefined ? foraDeEscala(series) : null;
      const barras = series.filter((_, i) => i !== destoante);
      const secundaria = destoante === null ? undefined : series[destoante];
      const linha = secundaria ?? referencia;
      const categorias = painel.categories.map(rotuloDeCategoria);

      return (
        <Desenhado painel={painel} forma={painel.forma}>
          <GraficoDeBarras
            categorias={categorias}
            eixo={configuracaoDeEixo({
              valores: finitos(barras.flatMap((s) => [...s.values])),
              categorias,
              ancoradoNoZero: true,
              larguraDisponivel: largura,
            })}
            comLegenda={barras.length > 1 || linha !== undefined}
            barras={barras.map((s, i) => ({
              nome: s.name,
              cor: corDaCategoria(i),
              valores: s.values,
            }))}
            {...(linha === undefined
              ? {}
              : {
                  linhaSecundaria: {
                    nome: linha.name,
                    cor:
                      linha.papel === "referencia"
                        ? PALETA.comparacao
                        : PALETA.marcaEscura,
                    valores: linha.values,
                  },
                })}
            {...(secundaria === undefined
              ? {}
              : {
                  eixoSecundario: configuracaoDeEixo({
                    valores: finitos([...secundaria.values]),
                    categorias,
                    larguraDisponivel: largura,
                  }),
                })}
          />
        </Desenhado>
      );
    }

    case "linha": {
      const series = deValor(painel.series);
      const principal = series[0];
      const referencia = deReferencia(painel.series);
      if (principal === undefined || semNumero(principal.values)) {
        return <Vazio forma={painel.forma} />;
      }

      const adicionais = series.slice(1);
      const meta =
        referencia === undefined ? undefined : finitos(referencia.values)[0];

      /*
       * A série manda, e a categoria acompanha — a mesma nota de
       * `/verificacao/svg`: percorrer as categorias exigiria um `?? 0` para o
       * valor, e um zero escrito à mão a um passo do formatador é o achado 5
       * do Anexo D voltando pela porta dos fundos.
       */
      const categorias = painel.categories.map(rotuloDeCategoria);
      const pontos = principal.values.flatMap((valor, i) =>
        valor === null
          ? []
          : [
              {
                categoria: categorias[i] ?? "",
                valor,
                rotulo: formatarValor(valor, painel.unit),
              },
            ],
      );

      return (
        <Desenhado painel={painel} forma={painel.forma}>
          <GraficoDeLinha
            pontos={pontos}
            nome={principal.name}
            eixo={configuracaoDeEixo({
              valores: finitos([
                ...series.flatMap((s) => [...s.values]),
                ...(meta === undefined ? [] : [meta]),
              ]),
              categorias,
              larguraDisponivel: largura,
            })}
            {...(adicionais.length === ZERO
              ? {}
              : {
                  linhas: adicionais.map((s, i) => ({
                    nome: s.name,
                    cor: corDaCategoria(i + 1),
                    valores: s.values,
                  })),
                })}
            {...(meta === undefined || referencia === undefined
              ? {}
              : {
                  referencia: {
                    valor: meta,
                    rotulo: `${referencia.name} ${formatarValor(meta, painel.unit)}`,
                  },
                })}
          />
        </Desenhado>
      );
    }

    case "barras-horizontais": {
      const principal = deValor(painel.series)[0];
      const referencia = deReferencia(painel.series);
      if (principal === undefined || semNumero(principal.values)) {
        return <Vazio forma={painel.forma} />;
      }

      const maximo = Math.max(
        maiorAbsoluto(principal.values),
        referencia === undefined ? ZERO : maiorAbsoluto(referencia.values),
      );

      return (
        <GraficoDeBarrasHorizontais
          linhas={painel.categories.map((categoria, i) => {
            const valor = principal.values[i] ?? null;
            const referida = referencia?.values[i] ?? null;
            return {
              rotulo: rotuloDeCategoria(categoria),
              fracao: valor === null ? null : Math.abs(valor) / maximo,
              texto: texto(valor, painel.unit),
              cor: PALETA.marca,
              ...(referida === null
                ? {}
                : { marca: Math.abs(referida) / maximo }),
            };
          })}
        />
      );
    }

    case "barras-empilhadas": {
      const faixas = deValor(painel.series);
      if (semNumero(faixas.flatMap((s) => [...s.values]))) {
        return <Vazio forma={painel.forma} />;
      }

      /*
       * Deitada quando a categoria não é um mês.
       *
       * Área e faixa de rating têm nome longo, e nome longo num eixo vertical
       * vira rótulo girado — que é o que faz a tela deixar de ser lida numa
       * passada (seção 5). Série temporal fica em pé, porque o tempo se lê da
       * esquerda para a direita.
       */
      const temporal = painel.categories.every((c) => MES.test(c));
      const categorias = painel.categories.map(rotuloDeCategoria);

      return (
        <Desenhado painel={painel} forma={painel.forma}>
          <GraficoDeBarrasEmpilhadas
            categorias={categorias}
            horizontal={!temporal}
            eixo={configuracaoDeEixo({
              valores: categorias.map((_, i) =>
                faixas.reduce((soma, s) => soma + (s.values[i] ?? ZERO), ZERO),
              ),
              categorias,
              ancoradoNoZero: true,
              larguraDisponivel: largura,
            })}
            faixas={faixas.map((s, i) => ({
              nome: s.name,
              cor: corDaCategoria(i),
              valores: s.values,
            }))}
          />
        </Desenhado>
      );
    }

    case "divisao": {
      if (painel.grupos.length === ZERO) return <Vazio forma={painel.forma} />;
      return (
        <GraficoDeDivisao
          grupos={painel.grupos.map((grupo) => {
            const soma = grupo.partes.reduce((s, p) => s + p.valor, ZERO);
            return {
              nome: grupo.nome,
              /*
               * O total do grupo não é exibido, e a omissão é deliberada.
               *
               * `EnvelopeBase.unit` é a unidade das **partes** — em `col-perfil`
               * elas somam 100 %. O `total` do grupo é o denominador delas:
               * 1.240 pessoas, 21.400 horas, 10.658 respostas. Formatá-lo com a
               * unidade do painel escrevia "1.240,0 %" no cabeçalho do grupo,
               * que é um número real com uma unidade falsa — o pior dos dois
               * mundos, porque parece conferido.
               *
               * `PainelDivisao` não declara unidade por grupo, e inventar uma
               * aqui ("deve ser contagem") erraria em `tre-modal`, onde são
               * horas. A base volta a aparecer quando o envelope disser em que
               * ela está; até lá, a repartição percentual é o que o painel
               * afirma, e é o que ele mostra.
               */
              total: null,
              partes: grupo.partes.map((parte, i) => ({
                nome: rotuloDeCategoria(parte.nome),
                fracao: soma === ZERO ? ZERO : parte.valor / soma,
                texto: texto(parte.valor, painel.unit),
                cor: corDaCategoria(i),
              })),
            };
          })}
        />
      );
    }

    case "estatisticas": {
      if (painel.estatisticas.length === ZERO) {
        return <Vazio forma={painel.forma} />;
      }
      return (
        <GraficoDeEstatisticas
          colunas={
            span >= SPAN_LARGO
              ? painel.estatisticas.length
              : Math.min(painel.estatisticas.length, COLUNAS_EM_PAINEL_ESTREITO)
          }
          estatisticas={painel.estatisticas.map((e) => ({
            rotulo: e.rotulo,
            texto: texto(e.valor, e.unidade),
            rodape: e.rodape === null ? null : rotuloDeCategoria(e.rodape),
            cor: COR_DO_SENTIDO[e.sentido],
          }))}
        />
      );
    }

    case "funil": {
      const base = painel.passos[0]?.valor ?? null;
      if (base === null || base === ZERO) return <Vazio forma={painel.forma} />;

      return (
        <GraficoDeFunil
          passos={painel.passos.map((passo, i) => ({
            nome: rotuloDeCategoria(passo.nome),
            fracao: passo.valor === null ? ZERO : passo.valor / base,
            texto: texto(passo.valor, painel.unit),
            conversao: conversaoDoPasso(
              passo.valor,
              painel.passos[i - 1]?.valor ?? null,
              i === ZERO,
            ),
            cor: corDaCategoria(i),
          }))}
        />
      );
    }

    case "mosaico-geografico": {
      const maximo = maiorAbsoluto(painel.celulas.map((c) => c.valor));
      if (maximo === ZERO) return <Vazio forma={painel.forma} />;
      return (
        <MosaicoGeografico
          celulas={painel.celulas.map((c) => ({
            uf: c.uf,
            intensidade: c.valor === null ? null : Math.abs(c.valor) / maximo,
            texto: texto(c.valor, painel.unit),
          }))}
        />
      );
    }

    case "rosca": {
      const soma = painel.fatias.reduce((s, f) => s + f.valor, ZERO);
      if (soma === ZERO) return <Vazio forma={painel.forma} />;
      return (
        <Desenhado painel={painel} forma={painel.forma}>
          <GraficoDeRosca
            centro={{
              texto: texto(painel.centro.valor, painel.unit),
              rotulo: painel.centro.rotulo,
            }}
            fatias={painel.fatias.map((fatia, i) => ({
              nome: rotuloDeCategoria(fatia.nome),
              fracao: fatia.valor / soma,
              texto: texto(fatia.valor, painel.unit),
              cor: corDaCategoria(i),
            }))}
          />
        </Desenhado>
      );
    }

    case "cascata": {
      if (painel.passos.length === ZERO) return <Vazio forma={painel.forma} />;

      /*
       * O acumulado, degrau a degrau. `ehTotal` assenta no eixo; o resto
       * empilha sobre o que veio antes. Sem essa distinção a ponte da DRE fecha
       * no dobro do valor — e fecha de um jeito plausível, que é pior.
       */
      const degraus: {
        readonly nome: string;
        readonly de: number;
        readonly ate: number;
        readonly texto: string;
        readonly cor: string;
      }[] = [];
      let acumulado = ZERO;
      for (const passo of painel.passos) {
        const de = passo.ehTotal ? ZERO : acumulado;
        const ate = passo.ehTotal ? passo.valor : acumulado + passo.valor;
        acumulado = ate;
        degraus.push({
          nome: passo.nome,
          de,
          ate,
          texto: formatarValor(passo.valor, painel.unit),
          cor: passo.ehTotal
            ? PALETA.marca
            : passo.valor >= ZERO
              ? PALETA.positivo
              : PALETA.negativo,
        });
      }

      return (
        <GraficoDeCascata
          degraus={degraus}
          dominio={
            configuracaoDeEixo({
              valores: degraus.flatMap((d) => [d.de, d.ate]),
              ancoradoNoZero: true,
              larguraDisponivel: largura,
            }).dominio
          }
        />
      );
    }

    case "dispersao": {
      if (painel.pontos.length === ZERO) return <Vazio forma={painel.forma} />;

      const faixaX = comFolga(
        Math.min(...painel.pontos.map((p) => p.x)),
        Math.max(...painel.pontos.map((p) => p.x)),
      );
      const faixaY = comFolga(
        Math.min(...painel.pontos.map((p) => p.y)),
        Math.max(...painel.pontos.map((p) => p.y)),
      );
      const maiorTamanho = maiorAbsoluto(painel.pontos.map((p) => p.tamanho));

      return (
        <GraficoDeDispersao
          eixoX={{
            rotulo: painel.eixoX.rotulo,
            minimo: formatarValor(faixaX.minimo, painel.eixoX.unidade),
            maximo: formatarValor(faixaX.maximo, painel.eixoX.unidade),
          }}
          eixoY={{
            rotulo: painel.eixoY.rotulo,
            minimo: formatarValor(faixaY.minimo, painel.eixoY.unidade),
            maximo: formatarValor(faixaY.maximo, painel.eixoY.unidade),
          }}
          pontos={painel.pontos.map((ponto, i) => ({
            rotulo: rotuloDeCategoria(ponto.rotulo),
            fracaoX: (ponto.x - faixaX.minimo) / faixaX.amplitude,
            fracaoY: (ponto.y - faixaY.minimo) / faixaY.amplitude,
            diametro:
              ponto.tamanho === null || maiorTamanho === ZERO
                ? DIAMETRO_MINIMO
                : DIAMETRO_MINIMO +
                  (Math.abs(ponto.tamanho) / maiorTamanho) *
                    (DIAMETRO_MAXIMO - DIAMETRO_MINIMO),
            cor: corDaCategoria(i),
          }))}
        />
      );
    }

    case "regua-de-ciclo": {
      const limite = Math.max(
        ...painel.marcos.map((m) => m.dia),
        ...painel.faixas.map((f) => f.ate),
      );
      if (!Number.isFinite(limite) || limite === ZERO) {
        return <Vazio forma={painel.forma} />;
      }
      return (
        <GraficoDeReguaDeCiclo
          faixas={painel.faixas.map((faixa) => ({
            rotulo: faixa.rotulo,
            inicio: faixa.de / limite,
            fim: faixa.ate / limite,
            texto: formatarValor(faixa.ate - faixa.de, painel.unit),
            cor: COR_DO_SENTIDO[faixa.sentido],
          }))}
          marcos={painel.marcos.map((marco) => ({
            rotulo: marco.rotulo,
            posicao: marco.dia / limite,
            texto: formatarValor(marco.dia, painel.unit),
          }))}
        />
      );
    }
  }
}

/** Um mês fechado, como o envelope escreve a categoria temporal. */
const MES = /^\d{4}-\d{2}$/;

/**
 * A conversão de um passo do funil contra o anterior, em texto.
 *
 * Derivada aqui, e não no envelope, porque o envelope não guarda derivada
 * (T-102) — e não dentro do componente de desenho, porque uma divisão e uma
 * formatação não são desenho (T-129).
 */
function conversaoDoPasso(
  valor: number | null,
  anterior: number | null,
  ehPrimeiro: boolean,
): string {
  if (ehPrimeiro) return "início do funil";
  if (valor === null || anterior === null || anterior === ZERO) return TRACO;
  return `↳ ${formatarValor((valor / anterior) * PERCENTUAL, "pct")} do passo anterior`;
}
