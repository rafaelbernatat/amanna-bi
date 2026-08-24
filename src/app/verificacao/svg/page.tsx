import type { Metadata } from "next";
import type { ReactNode } from "react";

import { formatarValor } from "@/apresentacao/formato/formato";
import { CaixaDeGrafico } from "@/apresentacao/graficos/CaixaDeGrafico";
import { GraficoDeBarras } from "@/apresentacao/graficos/GraficoDeBarras";
import { GraficoDeBarrasEmpilhadas } from "@/apresentacao/graficos/GraficoDeBarrasEmpilhadas";
import { GraficoDeLinha } from "@/apresentacao/graficos/GraficoDeLinha";
import { SemDado } from "@/apresentacao/graficos/SemDado";
import { configuracaoDeEixo } from "@/apresentacao/graficos/nucleo";
import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";

/**
 * Galeria de verificacao das primitivas (T-129 e T-130).
 *
 * Nao e tela de produto — nao esta no Anexo A e nao aparece na navegacao.
 * Existe porque CLS e estabilidade de desenho so se medem sobre algo desenhado.
 * T-183 volta aqui para medir contraste sobre o SVG.
 *
 * As series sao **formas, nao dados de negocio**: existem para exercitar a
 * geometria. Os numeros do Anexo C entram com as fixtures de T-110 e T-111,
 * que esperam a errata de H-03 — modelar contra numeros que ninguem confirmou
 * faria o teste passar por acidente.
 */

export const metadata: Metadata = {
  title: "Verificação · primitivas de gráfico",
  robots: { index: false, follow: false },
};

const MESES = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

const AREAS = [
  "Operações",
  "Comercial",
  "Tecnologia",
  "Logística",
  "Financeiro",
  "Marketing",
  "RH",
];

const CASOS_DE_EIXO = [
  {
    nome: "faixa comum",
    valores: [12, 40, 33, 61, 58, 74, 69, 88, 81, 96, 92, 110],
  },
  {
    nome: "minimo negativo",
    valores: [-40, -22, -8, 5, 18, 30, 12, -6, -18, 22, 41, 60],
  },
  { nome: "faixa nula", valores: Array.from({ length: 12 }, () => 75) },
  { nome: "tudo zero", valores: Array.from({ length: 12 }, () => 0) },
  {
    nome: "valores grandes",
    valores: [
      120000, 340000, 512000, 733000, 690000, 880000, 910000, 1020000, 998000,
      1180000, 1204000, 1234567,
    ],
  },
  { nome: "ponto unico", valores: [42] },
] as const;

/** Forma de `rh-headcount`: barras no eixo esquerdo, linha no direito. */
const ADMISSOES = [18, 22, 19, 25, 21, 17, 24, 20, 23, 19, 16, 17];
const DESLIGAMENTOS = [11, 13, 10, 15, 12, 14, 11, 13, 12, 10, 12, 12];
const HEADCOUNT = [
  1150, 1159, 1168, 1178, 1184, 1187, 1200, 1207, 1217, 1226, 1230, 1240,
];

/** Forma de `rec-vagas`: pilha de tres status por area. */
const ABERTAS = [12, 9, 14, 6, 4, 5, 3];
const EM_ANDAMENTO = [8, 11, 9, 5, 6, 3, 4];
const FECHADAS = [21, 18, 24, 11, 9, 8, 7];

/** Forma de `tov-12m`: linha com traco de meta. */
const TURNOVER = [
  14.2, 14.8, 15.3, 15.1, 15.9, 16.4, 16.8, 17.1, 17.6, 17.9, 18.1, 18.4,
];
const META_DE_TURNOVER = 14;

function Cartao({
  caso,
  titulo,
  legenda,
  children,
}: {
  readonly caso: string;
  readonly titulo: string;
  readonly legenda?: string;
  readonly children: ReactNode;
}) {
  return (
    <figure
      data-caso={caso}
      style={{
        margin: 0,
        minWidth: 0,
        background: PALETA.superficie,
        border: `1px solid ${PALETA.borda}`,
        borderRadius: 14,
        padding: "12px 14px",
      }}
    >
      <figcaption
        style={{
          font: `500 9px/1.2 ${TIPOGRAFIA.mono}`,
          color: PALETA.textoTerciario,
          textTransform: "uppercase",
          letterSpacing: ".12em",
          marginBottom: 8,
        }}
      >
        {titulo}
        {legenda === undefined ? "" : ` · ${legenda}`}
      </figcaption>
      {children}
    </figure>
  );
}

function Secao({
  titulo,
  children,
}: {
  readonly titulo: string;
  readonly children: ReactNode;
}) {
  return (
    <section style={{ marginBottom: 26 }}>
      <h2
        style={{
          margin: "0 0 12px",
          font: `500 15px/1.2 ${TIPOGRAFIA.titulo}`,
          color: PALETA.texto,
        }}
      >
        {titulo}
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
        }}
      >
        {children}
      </div>
    </section>
  );
}

export default function Pagina() {
  const eixoHeadcount = configuracaoDeEixo({
    valores: [...ADMISSOES, ...DESLIGAMENTOS],
    categorias: MESES,
    ancoradoNoZero: true,
  });
  const eixoFte = configuracaoDeEixo({
    valores: HEADCOUNT,
    categorias: MESES,
  });
  const eixoVagas = configuracaoDeEixo({
    valores: AREAS.map(
      (_, i) => (ABERTAS[i] ?? 0) + (EM_ANDAMENTO[i] ?? 0) + (FECHADAS[i] ?? 0),
    ),
    categorias: AREAS,
    ancoradoNoZero: true,
  });
  const eixoTurnover = configuracaoDeEixo({
    valores: [...TURNOVER, META_DE_TURNOVER],
    categorias: MESES,
  });

  return (
    <main style={{ padding: 28, background: PALETA.fundo, minHeight: "100vh" }}>
      <h1
        style={{
          margin: "0 0 6px",
          font: `500 26px/1.1 ${TIPOGRAFIA.titulo}`,
          color: PALETA.texto,
        }}
      >
        Verificação das primitivas de gráfico
      </h1>
      <p
        style={{
          margin: "0 0 22px",
          font: `400 11.5px/1.6 ${TIPOGRAFIA.texto}`,
          color: PALETA.textoSecundario,
          maxWidth: "78ch",
        }}
      >
        Séries de forma, não de negócio: os números do Anexo C entram com as
        fixtures de T-110 e T-111. A caixa de cada gráfico é reservada pelo
        servidor antes de o desenho montar.
      </p>

      <Secao titulo="As três primitivas de série">
        <Cartao
          caso="rh-headcount"
          titulo="rh-headcount"
          legenda="barras + eixo secundário"
        >
          <CaixaDeGrafico
            altura={216}
            rotulo="Headcount nos últimos 12 meses. Barras: admissões e desligamentos do mês, eixo esquerdo. Linha: headcount FTE, eixo direito."
          >
            <GraficoDeBarras
              categorias={MESES}
              eixo={eixoHeadcount}
              eixoSecundario={eixoFte}
              comLegenda
              barras={[
                {
                  nome: "Admissões",
                  cor: PALETA.positivo,
                  valores: ADMISSOES,
                },
                {
                  nome: "Desligamentos",
                  cor: PALETA.negativo,
                  valores: DESLIGAMENTOS,
                },
              ]}
              linhaSecundaria={{
                nome: "Headcount FTE",
                cor: PALETA.marca,
                valores: HEADCOUNT,
              }}
            />
          </CaixaDeGrafico>
        </Cartao>

        <Cartao
          caso="rec-vagas"
          titulo="rec-vagas"
          legenda="empilhada com legenda"
        >
          <CaixaDeGrafico
            altura={216}
            rotulo="Vagas por status e área: abertas, em andamento e fechadas."
          >
            <GraficoDeBarrasEmpilhadas
              categorias={AREAS}
              eixo={eixoVagas}
              horizontal
              faixas={[
                {
                  nome: "Abertas",
                  cor: PALETA.destaqueSuave,
                  valores: ABERTAS,
                },
                {
                  nome: "Em andamento",
                  cor: PALETA.comparacao,
                  valores: EM_ANDAMENTO,
                },
                { nome: "Fechadas", cor: PALETA.positivo, valores: FECHADAS },
              ]}
            />
          </CaixaDeGrafico>
        </Cartao>

        <Cartao
          caso="tov-12m"
          titulo="tov-12m"
          legenda="linha com traço de meta"
        >
          <CaixaDeGrafico
            altura={216}
            rotulo="Taxa de turnover de 12 meses contra a meta anual de 14,0%."
          >
            <GraficoDeLinha
              eixo={eixoTurnover}
              referencia={{ valor: META_DE_TURNOVER, rotulo: "meta 14,0%" }}
              /*
               * A série manda, e o mês acompanha.
               *
               * Estava ao contrário — `MESES.map` com `TURNOVER[i] ?? 0` — e o
               * `?? 0` que o `noUncheckedIndexedAccess` obriga era um número
               * escrito à mão a um passo do formatador: bastava a série ficar
               * mais curta que os meses para a tela desenhar "0,0%" como se
               * fosse medida. Percorrendo o número, ele existe por construção.
               */
              pontos={TURNOVER.map((valor, i) => ({
                categoria: MESES[i] ?? "",
                valor,
                rotulo: formatarValor(valor, "pct"),
              }))}
            />
          </CaixaDeGrafico>
        </Cartao>
      </Secao>

      <Secao titulo="Série vazia é estado, não gráfico em branco">
        {(
          [
            "sem_dado_no_recorte",
            "grupo_pequeno",
            "fora_do_perfil",
            "fonte_indisponivel",
          ] as const
        ).map((motivo) => (
          <Cartao key={motivo} caso={`vazio-${motivo}`} titulo={motivo}>
            <SemDado
              motivo={motivo}
              altura={216}
              {...(motivo === "sem_dado_no_recorte"
                ? { ampliarPara: "todas as áreas" }
                : {})}
            />
          </Cartao>
        ))}
      </Secao>

      <Secao titulo="Casos de geometria do eixo">
        {CASOS_DE_EIXO.map((caso) => {
          const categorias = MESES.slice(0, caso.valores.length);
          const eixo = configuracaoDeEixo({
            valores: [...caso.valores],
            categorias,
          });
          return (
            <Cartao
              key={caso.nome}
              caso={caso.nome}
              titulo={caso.nome}
              {...(eixo.degenerada ? { legenda: "faixa aberta" } : {})}
            >
              <CaixaDeGrafico altura={200} rotulo={`Caso ${caso.nome}`}>
                <GraficoDeLinha
                  eixo={eixo}
                  pontos={caso.valores.map((valor, i) => ({
                    categoria: categorias[i] ?? "",
                    valor,
                    rotulo: formatarValor(valor, "FTE"),
                  }))}
                />
              </CaixaDeGrafico>
            </Cartao>
          );
        })}
      </Secao>
    </main>
  );
}
