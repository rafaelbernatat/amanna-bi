import Link from "next/link";

import { TELA_PADRAO } from "@/apresentacao/navegacao/telas";
import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";

/** 404 para qualquer par modulo/tela fora das 13 (T-126). */
export default function NaoEncontrada() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: PALETA.fundo,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 10,
        padding: "0 28px",
      }}
    >
      <h1
        style={{
          margin: 0,
          font: `500 32px/1.08 ${TIPOGRAFIA.titulo}`,
          color: PALETA.texto,
        }}
      >
        Tela não encontrada
      </h1>
      <p
        style={{
          margin: 0,
          font: `400 12px/1.6 ${TIPOGRAFIA.texto}`,
          color: PALETA.textoSecundario,
        }}
      >
        O produto tem treze telas, em três módulos. Este endereço não é uma
        delas.
      </p>
      <Link
        href={TELA_PADRAO}
        style={{
          font: `500 11.5px/1.2 ${TIPOGRAFIA.texto}`,
          color: PALETA.marca,
        }}
      >
        Voltar para a visão geral de RH
      </Link>
    </main>
  );
}
