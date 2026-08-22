import Link from "next/link";

import {
  MODULOS,
  primeiraTelaDe,
  type IdDeModulo,
} from "@/apresentacao/navegacao/telas";
import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";

/**
 * Barra lateral fixa com os tres modulos (T-126, PRD secao 6.1).
 *
 * Clicar num modulo leva a primeira tela dele. E Server Component: nao ha
 * estado nem efeito aqui, so a rota ativa recebida por propriedade.
 */
export function BarraLateral({ ativo }: { readonly ativo: IdDeModulo }) {
  return (
    <nav
      aria-label="Módulos"
      style={{
        background: PALETA.barraLateral,
        minHeight: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        padding: "26px 0 22px",
      }}
    >
      <div style={{ padding: "0 24px 22px" }}>
        <div
          style={{
            font: `500 18px/1.1 ${TIPOGRAFIA.titulo}`,
            color: PALETA.textoEmBarra,
            letterSpacing: ".005em",
          }}
        >
          Controladoria
        </div>
        <div
          style={{
            font: `500 8.5px/1.2 ${TIPOGRAFIA.mono}`,
            color: PALETA.textoEmBarraFraco,
            textTransform: "uppercase",
            letterSpacing: ".14em",
            marginTop: 4,
          }}
        >
          Painel executivo · BI
        </div>
      </div>

      <div
        style={{
          padding: "0 24px 8px",
          font: `500 8.5px/1.2 ${TIPOGRAFIA.mono}`,
          color: PALETA.neutro,
          textTransform: "uppercase",
          letterSpacing: ".13em",
        }}
      >
        Módulos
      </div>

      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: "0 12px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {MODULOS.map((modulo) => {
          const ligado = modulo.id === ativo;
          return (
            <li key={modulo.id}>
              <Link
                href={primeiraTelaDe(modulo)}
                aria-current={ligado ? "page" : undefined}
                style={{
                  display: "block",
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: ligado ? PALETA.marcaEscura : "transparent",
                  color: ligado ? PALETA.textoEmBarra : PALETA.textoFraco,
                  font: `${ligado ? "600" : "500"} 12px/1.3 ${TIPOGRAFIA.texto}`,
                  textDecoration: "none",
                }}
              >
                <span
                  style={{
                    font: `500 8.5px/1.2 ${TIPOGRAFIA.mono}`,
                    color: ligado ? PALETA.destaqueSuave : PALETA.neutro,
                    letterSpacing: ".12em",
                    display: "block",
                  }}
                >
                  {modulo.numero}
                </span>
                {modulo.nome}
                <span
                  style={{
                    display: "block",
                    font: `400 10px/1.4 ${TIPOGRAFIA.texto}`,
                    color: ligado ? PALETA.textoTerciario : PALETA.neutro,
                    marginTop: 2,
                  }}
                >
                  {modulo.descricao}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div
        style={{
          marginTop: "auto",
          padding: "18px 24px 0",
          borderTop: `1px solid ${PALETA.barraLateralBorda}`,
          font: `400 10px/1.5 ${TIPOGRAFIA.texto}`,
          color: PALETA.textoEmBarraFraco,
        }}
      >
        Fonte de dados e selo de frescor entram com T-149.
      </div>
    </nav>
  );
}
