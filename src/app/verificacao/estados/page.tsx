import type { Metadata } from "next";

import { lerKpisDaTela, lerPainel } from "@/acesso/leitura";
import { CaixaDeGrafico } from "@/apresentacao/graficos/CaixaDeGrafico";
import { alturaDaForma } from "@/apresentacao/graficos/altura";
import { Esqueleto } from "@/apresentacao/graficos/Esqueleto";
import { CartaoEmEstado } from "@/apresentacao/paineis/CartaoEmEstado";
import { PainelEmEstado } from "@/apresentacao/paineis/PainelEmEstado";
import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";
import { QUERY_PADRAO } from "@/semantica/contrato";
import type { Frescor, Kpi, PanelResponse } from "@/semantica/contrato";
import { type EstadoDe, ESTADOS } from "@/semantica/estado";
import { FORMAS, type Forma } from "@/semantica/painel";

/**
 * Galeria de verificação dos seis estados (T-132, PRD seção 6.4).
 *
 * Não é tela de produto — não está no Anexo A e não aparece na navegação.
 * Existe porque duas coisas do aceite **só se medem sobre algo desenhado**:
 *
 * 1. o esqueleto de cada uma das doze formas tem a altura do gráfico final,
 *    dentro de 4 px;
 * 2. o estado "sem permissão" não traz agregado no HTML servido.
 *
 * A segunda também se prova sem navegador, e está em `tests/unidade`. A
 * primeira exige altura resolvida, e é `tests/e2e/estados.spec.ts` que a mede.
 *
 * ## O dado é forjado, e isso é o ponto
 *
 * A tabela 6.4 descreve o que acontece quando a consulta **não** dá certo. Com
 * fixtures normais, cinco dos seis estados nunca apareceriam — e um estado que
 * não aparece não é testado. Aqui cada estado é construído à mão.
 */

export const metadata: Metadata = {
  title: "Verificação · os seis estados",
  robots: { index: false, follow: false },
};

/* ------------------------------------------------------------------ *
 * O dado forjado
 * ------------------------------------------------------------------ */

const FRESCOR_EM_DIA: Frescor = {
  asOf: "2026-12-31",
  sincronizadoEm: "2026-08-26T06:15",
  defasado: false,
};

const FRESCOR_DEFASADO: Frescor = {
  asOf: "2026-11-30",
  sincronizadoEm: "2026-08-19T23:40",
  defasado: true,
};

/**
 * A carga vem das fixtures, pela mesma fronteira que o produto usa.
 *
 * A primeira versão desta página **digitava** o envelope e o KPI, com valor e
 * delta escritos à mão. A regra de T-141 reprovou, e estava certa: é o achado 5
 * do Anexo D — cartão com número fixo, que não reage a filtro nenhum. Que a
 * página seja de verificação não muda o que o arquivo ensina a quem o copiar.
 *
 * Aqui o que é forjado são os **estados**, não os números. É a divisão certa:
 * a tabela 6.4 fala sobre o que acontece quando a consulta não dá certo, e para
 * isso não é preciso inventar quanto é o headcount.
 */
async function casos(): Promise<{
  readonly painel: Readonly<Record<string, EstadoDe<PanelResponse>>>;
  readonly cartao: Readonly<Record<string, EstadoDe<Kpi>>>;
}> {
  const envelope = await lerPainel("rh-headcount", QUERY_PADRAO);
  const kpis = await lerKpisDaTela("rh/visao", QUERY_PADRAO);
  const kpi = kpis[0];

  const semCarga = {
    carregando: { estado: "carregando" },
    vazio_no_recorte: {
      estado: "vazio_no_recorte",
      motivo: "sem_dado_no_recorte",
      ampliarPara: "12 meses, consolidado",
    },
    erro_de_fonte: { estado: "erro_de_fonte", ultimoFrescor: FRESCOR_EM_DIA },
    sem_permissao: { estado: "sem_permissao" },
  } as const;

  return {
    painel: {
      ...semCarga,
      com_dado: { estado: "com_dado", carga: envelope },
      defasado: {
        estado: "defasado",
        carga: envelope,
        frescor: FRESCOR_DEFASADO,
      },
    },
    cartao: {
      ...semCarga,
      ...(kpi === undefined
        ? {}
        : {
            com_dado: { estado: "com_dado", carga: kpi },
            defasado: {
              estado: "defasado",
              carga: kpi,
              frescor: FRESCOR_DEFASADO,
            },
          }),
    },
  };
}

/* ------------------------------------------------------------------ *
 * A página
 * ------------------------------------------------------------------ */

export default async function Page() {
  const CASOS = await casos();

  return (
    <main
      style={{
        padding: 28,
        background: PALETA.fundo,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        gap: 30,
      }}
    >
      <Titulo texto="Os seis estados de painel" />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))",
          gap: 16,
        }}
      >
        {ESTADOS.map((nome) => (
          <div key={nome} data-caso-de-painel={nome}>
            <Legenda texto={nome} />
            <PainelEmEstado
              identidade={{
                id: `painel-${nome}`,
                titulo: "Painel de verificação",
                unidade: "FTE",
              }}
              forma="barras"
              estado={CASOS.painel[nome] ?? { estado: "carregando" }}
              desenhar={(carga) => (
                <CaixaDeGrafico
                  altura={alturaDaForma("barras")}
                  rotulo={carga.title}
                >
                  {/*
                    A caixa reservada basta para o que esta página mede: altura
                    e estado. Desenhar as barras de verdade exigiria narrowing
                    da união de doze formas aqui, e este arquivo viraria um
                    segundo lugar onde as doze são tratadas — a galeria de
                    primitivas em /verificacao/svg já é o primeiro.
                  */}
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      border: `1px solid ${PALETA.grade}`,
                      borderRadius: 4,
                    }}
                  />
                </CaixaDeGrafico>
              )}
            />
          </div>
        ))}
      </div>

      <Titulo texto="Os seis estados de cartão" />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 13,
          alignItems: "start",
        }}
      >
        {ESTADOS.map((nome) => (
          <div key={nome} data-caso-de-cartao={nome}>
            <Legenda texto={nome} />
            <CartaoEmEstado
              identidade={{ id: `cartao-${nome}`, rotulo: "Headcount total" }}
              estado={CASOS.cartao[nome] ?? { estado: "carregando" }}
            />
          </div>
        ))}
      </div>

      <Titulo texto="Esqueleto e caixa final, forma a forma" />
      <p
        style={{
          margin: 0,
          maxWidth: "72ch",
          font: `400 12px/1.6 ${TIPOGRAFIA.texto}`,
          color: PALETA.textoSecundario,
        }}
      >
        Os dois lêem a mesma linha de <code>ALTURA_DA_FORMA</code>. O aceite
        pede diferença menor que 4 px; a diferença medida é zero, e os 4 px
        viram folga que ninguém usa. O teste que os mede existe para reprovar
        quem voltar a escrever a altura à mão nos dois lugares.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        {FORMAS.map((forma) => (
          <ParDeAltura key={forma} forma={forma} />
        ))}
      </div>
    </main>
  );
}

function ParDeAltura({ forma }: { readonly forma: Forma }) {
  return (
    <div data-forma-medida={forma}>
      <Legenda texto={`${forma} · ${String(alturaDaForma(forma))} px`} />
      <div
        style={{
          background: PALETA.superficie,
          border: `1px solid ${PALETA.borda}`,
          borderRadius: 12,
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div data-medida="esqueleto">
          <Esqueleto forma={forma} rotulo={forma} />
        </div>
        <div data-medida="final">
          <CaixaDeGrafico
            altura={alturaDaForma(forma)}
            rotulo={`Caixa final de ${forma}`}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                border: `1px solid ${PALETA.grade}`,
                borderRadius: 4,
              }}
            />
          </CaixaDeGrafico>
        </div>
      </div>
    </div>
  );
}

function Titulo({ texto }: { readonly texto: string }) {
  return (
    <h1
      style={{
        margin: 0,
        font: `500 20px/1.2 ${TIPOGRAFIA.titulo}`,
        color: PALETA.texto,
      }}
    >
      {texto}
    </h1>
  );
}

function Legenda({ texto }: { readonly texto: string }) {
  return (
    <span
      style={{
        display: "block",
        marginBottom: 6,
        font: `500 9px/1.2 ${TIPOGRAFIA.mono}`,
        color: PALETA.textoTerciario,
        textTransform: "uppercase",
        letterSpacing: ".1em",
      }}
    >
      {texto}
    </span>
  );
}
