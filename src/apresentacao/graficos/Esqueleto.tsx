import { alturaDaForma } from "@/apresentacao/graficos/altura";
import { PALETA } from "@/apresentacao/tema/tema";
import type { Forma } from "@/semantica/painel";

/**
 * O esqueleto do estado "carregando" (T-132, PRD seção 6.4).
 *
 * > "Esqueleto com a forma do painel, sem número piscando"
 *
 * ## Não há número aqui, e não é por disciplina
 *
 * O componente **não recebe** carga. A variante `carregando` de `EstadoDe<T>`
 * não tem campo de dado, então não existe valor para piscar — nem antigo, nem
 * placeholder, nem zero. O defeito que a 6.4 nomeia é o de mostrar um número
 * enquanto o certo ainda vem, e ele some quando o número não chega ao
 * componente.
 *
 * ## A forma importa
 *
 * Um retângulo cinza para as doze formas seria mais simples e mentiria sobre o
 * que vem: quem espera uma rosca e vê uma barra reajusta o olhar duas vezes. O
 * esqueleto desenha a silhueta da forma — barras de alturas diferentes, um arco
 * para a rosca, degraus para a cascata — com a mesma geometria que o desenho
 * final vai ocupar.
 *
 * ## A altura vem da tabela, não daqui
 *
 * `alturaDaForma` é a mesma linha que o gráfico final lê. Por isso a diferença
 * entre esqueleto e desenho é zero, e não "dentro de 4 px": os 4 px do aceite
 * são folga que este arquivo não usa.
 *
 * Server Component: o esqueleto é o **primeiro** quadro servido, e um esqueleto
 * que precisasse de JavaScript para existir chegaria depois do problema que ele
 * resolve.
 */

/** As barras da silhueta, em fração da altura útil. Silhueta, não dado. */
const PERFIL_DE_BARRAS = [0.45, 0.68, 0.52, 0.81, 0.6, 0.92, 0.74];

/** Quantas faixas o esqueleto de estatísticas mostra. */
const BLOCOS_DE_ESTATISTICA = 4;

/** Quantos degraus a silhueta da cascata sugere. */
const DEGRAUS = 7;

/** Quantas etapas o funil sugere. */
const ETAPAS = 5;

/** A caixa cheia, em porcento — serve de largura e de altura. */
const LARGURA_CHEIA = 100;

/** Quanto a ultima faixa estreita em relacao a primeira, em porcento. */
const ESTREITAMENTO = 60;

/** As colunas da malha do mosaico. */
const COLUNAS_DA_MALHA = 5;

/** As linhas da malha do mosaico: o mapa e mais alto que largo. */
const LINHAS_DA_MALHA = 4;

export function Esqueleto({
  forma,
  rotulo,
}: {
  readonly forma: Forma;
  /** O que está carregando, para quem usa leitor de tela. */
  readonly rotulo: string;
}) {
  const altura = alturaDaForma(forma);

  return (
    <div
      data-teste="esqueleto"
      data-forma={forma}
      role="status"
      aria-busy="true"
      aria-label={`Carregando ${rotulo}`}
      style={{
        width: "100%",
        height: altura,
        minHeight: altura,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "flex-end",
        gap: 6,
        overflow: "hidden",
      }}
    >
      <Silhueta forma={forma} />
    </div>
  );
}

/**
 * A silhueta por família de forma.
 *
 * Agrupada por como a forma ocupa a caixa, e não por nome: quatro cartesianas
 * viram colunas, e as outras oito têm cada uma o seu jeito de preencher.
 */
function Silhueta({ forma }: { readonly forma: Forma }) {
  switch (forma) {
    case "barras":
    case "linha":
    case "barras-empilhadas":
    case "dispersao":
      return <Colunas />;

    case "barras-horizontais":
    case "funil":
      return <Faixas quantas={forma === "funil" ? ETAPAS : DEGRAUS} />;

    case "cascata":
      return <Faixas quantas={DEGRAUS} />;

    case "rosca":
      return <Anel />;

    case "divisao":
    case "regua-de-ciclo":
      return <Barra />;

    case "estatisticas":
      return <Blocos />;

    case "mosaico-geografico":
      return <Malha />;
  }
}

/** Colunas de alturas diferentes: a silhueta de um gráfico com eixo de tempo. */
function Colunas() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 6,
        width: "100%",
        height: "100%",
      }}
    >
      {PERFIL_DE_BARRAS.map((fracao, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${String(fracao * LARGURA_CHEIA)}%`,
            borderRadius: 4,
            background: PALETA.superficieSuave,
            border: `1px solid ${PALETA.grade}`,
          }}
        />
      ))}
    </div>
  );
}

/** Faixas horizontais decrescentes: barras horizontais, funil, cascata. */
function Faixas({ quantas }: { readonly quantas: number }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: 4,
        width: "100%",
        height: "100%",
      }}
    >
      {Array.from({ length: quantas }, (_, i) => (
        <div
          key={i}
          style={{
            width: `${String(LARGURA_CHEIA - i * (ESTREITAMENTO / quantas))}%`,
            flex: 1,
            borderRadius: 4,
            background: PALETA.superficieSuave,
            border: `1px solid ${PALETA.grade}`,
          }}
        />
      ))}
    </div>
  );
}

/** Um anel: a silhueta da rosca, quadrada e centrada. */
function Anel() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          aspectRatio: "1",
          height: "100%",
          borderRadius: "50%",
          border: `18px solid ${PALETA.superficieSuave}`,
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

/** Uma barra repartida: divisão e régua de ciclo. */
function Barra() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "48%",
          borderRadius: 6,
          background: PALETA.superficieSuave,
          border: `1px solid ${PALETA.grade}`,
        }}
      />
    </div>
  );
}

/** Blocos lado a lado: o painel de estatísticas, sem os números. */
function Blocos() {
  return (
    <div style={{ display: "flex", gap: 10, width: "100%", height: "100%" }}>
      {Array.from({ length: BLOCOS_DE_ESTATISTICA }, (_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: "100%",
            borderRadius: 8,
            background: PALETA.superficieSuave,
            border: `1px solid ${PALETA.grade}`,
          }}
        />
      ))}
    </div>
  );
}

/** Uma malha: a silhueta do mosaico geográfico. */
function Malha() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        gridTemplateColumns: `repeat(${String(COLUNAS_DA_MALHA)}, 1fr)`,
        gridAutoRows: "1fr",
        gap: 4,
      }}
    >
      {Array.from({ length: COLUNAS_DA_MALHA * LINHAS_DA_MALHA }, (_, i) => (
        <div
          key={i}
          style={{
            borderRadius: 3,
            background: PALETA.superficieSuave,
            border: `1px solid ${PALETA.grade}`,
          }}
        />
      ))}
    </div>
  );
}
