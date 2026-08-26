import type { ReactNode } from "react";

import { alturaDaForma } from "@/apresentacao/graficos/altura";
import { CorpoEmEstado } from "@/apresentacao/graficos/CorpoEmEstado";
import { MolduraDePainel, Painel } from "@/apresentacao/paineis/Painel";
import type { PanelResponse } from "@/semantica/contrato";
import { type EstadoDe, temCarga } from "@/semantica/estado";
import type { Forma } from "@/semantica/painel";

/**
 * Um painel nos seis estados da seção 6.4 (T-132).
 *
 * ## Onde a decisão mora
 *
 * Aqui, e em nenhum outro lugar. Treze telas decidindo cada uma o que fazer
 * quando a fonte falha dariam treze respostas — e a diferença entre elas
 * apareceria como bug de uma tela só, meses depois, sem ninguém entender por
 * que aquela tela é diferente.
 *
 * ## Os dois estados que desenham, e os quatro que não
 *
 * `com_dado` e `defasado` desenham o gráfico; o segundo com o selo de frescor
 * em destaque. Defasado **não** esconde o painel: o número existe, só é mais
 * velho que o acordado, e esconder mandaria quem lê buscá-lo numa planilha.
 *
 * Os outros quatro entregam a caixa a `CorpoEmEstado`. A altura é a mesma nos
 * seis — `alturaDaForma` — para a tela não saltar quando o estado muda.
 *
 * ## O gráfico chega por função, e não por elemento
 *
 * `desenhar` recebe a carga e devolve o desenho. Se `children` fosse um
 * elemento pronto, quem chama teria de construí-lo **antes** de saber se há
 * carga — e para isso precisaria de um `carga?.series ?? []` que compila,
 * desenha um gráfico vazio e não avisa ninguém. Com função, o desenho só existe
 * onde existe dado.
 */
export function PainelEmEstado({
  identidade,
  forma,
  estado,
  destacado = false,
  desenhar,
}: {
  readonly identidade: {
    readonly id: string;
    readonly titulo: string;
    readonly unidade?: string;
  };
  readonly forma: Forma;
  readonly estado: EstadoDe<PanelResponse>;
  readonly destacado?: boolean;
  readonly desenhar: (carga: PanelResponse) => ReactNode;
}) {
  if (temCarga(estado)) {
    return (
      <Painel
        painel={estado.carga}
        altura={alturaDaForma(forma)}
        destacado={destacado}
        {...(estado.estado === "defasado" ? { frescor: estado.frescor } : {})}
      >
        {desenhar(estado.carga)}
      </Painel>
    );
  }

  return (
    <MolduraDePainel
      id={identidade.id}
      titulo={identidade.titulo}
      destacado={destacado}
      {...(identidade.unidade === undefined
        ? {}
        : { unidade: identidade.unidade })}
    >
      <div
        data-teste="caixa-do-painel"
        style={{
          height: alturaDaForma(forma),
          minHeight: alturaDaForma(forma),
          minWidth: 0,
        }}
      >
        <CorpoEmEstado
          estado={estado}
          forma={forma}
          rotulo={identidade.titulo}
        />
      </div>
    </MolduraDePainel>
  );
}
