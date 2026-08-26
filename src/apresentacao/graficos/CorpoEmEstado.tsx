import { formatarInstante } from "@/apresentacao/formato/formato";
import { alturaDaForma } from "@/apresentacao/graficos/altura";
import { Esqueleto } from "@/apresentacao/graficos/Esqueleto";
import { SemDado } from "@/apresentacao/graficos/SemDado";
import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";
import type { EstadoDe } from "@/semantica/estado";
import type { Forma } from "@/semantica/painel";

/**
 * O corpo de um painel nos estados que **não** desenham o gráfico (T-132).
 *
 * Quatro dos seis: carregando, vazio no recorte, erro de fonte e sem permissão.
 * Os outros dois — com dado e defasado — desenham o gráfico, e quem sabe
 * desenhar cada forma são os componentes de T-130, T-164 e T-165. Por isso este
 * componente recebe um estado **sem carga**: se houvesse carga, ele teria de
 * saber desenhar, e viraria um segundo lugar onde as doze formas são tratadas.
 *
 * ## Todos ocupam exatamente a caixa do gráfico
 *
 * Os quatro leem `alturaDaForma`, a mesma linha que o desenho final lê. Sem
 * isso a tela salta quando o estado muda — o esqueleto some, o gráfico entra
 * com outra altura, e o que veio depois na página desce. É o mesmo CLS que
 * T-129 zerou, voltando pela porta dos estados.
 */

/** Os estados que este componente sabe desenhar. */
export type EstadoSemDesenho = Exclude<
  EstadoDe<never>,
  { readonly estado: "com_dado" } | { readonly estado: "defasado" }
>;

export function CorpoEmEstado({
  estado,
  forma,
  rotulo,
}: {
  readonly estado: EstadoSemDesenho;
  readonly forma: Forma;
  /** O que está sendo mostrado — título do painel, para leitor de tela. */
  readonly rotulo: string;
}) {
  switch (estado.estado) {
    case "carregando":
      return <Esqueleto forma={forma} rotulo={rotulo} />;

    case "vazio_no_recorte":
      return (
        <SemDado
          motivo={estado.motivo}
          altura={alturaDaForma(forma)}
          {...(estado.ampliarPara === undefined
            ? {}
            : { ampliarPara: estado.ampliarPara })}
        />
      );

    case "erro_de_fonte":
      return (
        <ErroDeFonte
          altura={alturaDaForma(forma)}
          ultimaLeitura={estado.ultimoFrescor?.sincronizadoEm ?? null}
        />
      );

    case "sem_permissao":
      return <SemPermissao altura={alturaDaForma(forma)} />;
  }
}

/* ------------------------------------------------------------------ *
 * Erro de fonte
 * ------------------------------------------------------------------ */

/**
 * "Não foi possível ler a fonte", com o horário da última leitura boa.
 *
 * O horário é a diferença entre um erro que informa e um que só assusta. Com
 * ele, quem lê sabe se está olhando um problema de agora ou um que já dura o
 * dia — e decide se espera ou se avisa alguém.
 *
 * Quando não há leitura anterior conhecida, o componente **diz isso**, em vez
 * de esconder a linha. Uma ausência silenciosa se lê como "acabou de
 * acontecer", que é a leitura mais otimista e nem sempre a verdadeira.
 */
function ErroDeFonte({
  altura,
  ultimaLeitura,
}: {
  readonly altura: number;
  readonly ultimaLeitura: string | null;
}) {
  return (
    <Aviso
      altura={altura}
      marca="erro_de_fonte"
      titulo="Não foi possível ler a fonte"
      porque="O adaptador de dados falhou nesta consulta."
      rodape={
        ultimaLeitura === null
          ? "Sem leitura bem-sucedida registrada nesta sessão."
          : `Última leitura bem-sucedida: ${formatarInstante(ultimaLeitura)}`
      }
      cor={PALETA.negativo}
    />
  );
}

/* ------------------------------------------------------------------ *
 * Sem permissão
 * ------------------------------------------------------------------ */

/**
 * "Você não tem acesso a este recorte" — e nada além disso.
 *
 * A seção 6.4 diz **sem** revelar o valor agregado, e a seção 11 explica por
 * quê: um total é uma resposta parcial à pergunta que o perfil não pode fazer.
 * Duas telas com recortes vizinhos e dois totais permitem subtrair.
 *
 * A garantia não está neste componente: está no tipo. A variante
 * `sem_permissao` de `EstadoDe<T>` não tem campo de carga, então não existe
 * número para vazar daqui — nem por descuido, nem por um `??` bem-intencionado.
 * Este componente só desenha a caixa.
 */
function SemPermissao({ altura }: { readonly altura: number }) {
  return (
    <Aviso
      altura={altura}
      marca="sem_permissao"
      titulo="Você não tem acesso a este recorte"
      porque="O recorte está fora do seu perfil de acesso."
      rodape="Peça acesso a quem administra os perfis."
      cor={PALETA.textoTerciario}
    />
  );
}

/* ------------------------------------------------------------------ *
 * A caixa comum
 * ------------------------------------------------------------------ */

/**
 * A moldura dos dois avisos.
 *
 * Mesma geometria do `SemDado`, de propósito: os quatro estados sem desenho
 * ocupam a caixa do mesmo jeito, e trocar de um para outro não mexe um pixel do
 * resto da página.
 */
function Aviso({
  altura,
  marca,
  titulo,
  porque,
  rodape,
  cor,
}: {
  readonly altura: number;
  readonly marca: string;
  readonly titulo: string;
  readonly porque: string;
  readonly rodape: string;
  readonly cor: string;
}) {
  return (
    <div
      data-teste="aviso-de-estado"
      data-estado={marca}
      role="status"
      style={{
        width: "100%",
        height: altura,
        minHeight: altura,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        padding: "0 18px",
        textAlign: "center",
        border: `1px dashed ${PALETA.bordaForte}`,
        borderRadius: 12,
        background: PALETA.superficieSuave,
      }}
    >
      <span
        style={{
          font: `600 11.5px/1.3 ${TIPOGRAFIA.texto}`,
          color: cor,
        }}
      >
        {titulo}
      </span>
      <span
        style={{
          font: `400 10.5px/1.5 ${TIPOGRAFIA.texto}`,
          color: PALETA.textoTerciario,
          maxWidth: "42ch",
        }}
      >
        {porque}
      </span>
      <span
        data-teste="rodape-do-aviso"
        style={{
          font: `500 9px/1.2 ${TIPOGRAFIA.mono}`,
          color: PALETA.textoFraco,
          marginTop: 2,
        }}
      >
        {rodape}
      </span>
    </div>
  );
}
