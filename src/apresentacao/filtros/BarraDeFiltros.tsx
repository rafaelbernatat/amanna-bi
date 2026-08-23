import Link from "next/link";

import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";
import type { Query } from "@/semantica/contrato";
import { QUERY_PADRAO } from "@/semantica/contrato";
import {
  FILTROS,
  ROTULO_DO_FILTRO,
  rotuloDe,
  type NomeDeFiltro,
} from "@/semantica/dimensoes";
import type { Dimensoes } from "@/semantica/recortes";
import { rotaCom } from "@/semantica/url";

/**
 * Os cinco controles da tabela 6.2 (T-128, PRD seção 6.2 e RF-01).
 *
 * ## Por que é um formulário, e não estado de cliente
 *
 * O recorte vive na URL e é resolvido no servidor (T-127). Guardar uma cópia
 * dele em estado de componente criaria uma segunda fonte para o mesmo fato — e
 * a segunda fonte é sempre a que fica errada, porque só uma das duas está no
 * link que a pessoa compartilha. Aqui o `<form method="get">` é o mecanismo:
 * enviar troca a URL, e a URL é o recorte.
 *
 * Consequência boa e não acidental: a barra funciona sem JavaScript. Isso não é
 * nostalgia — é o que mantém o comportamento igual antes e depois da
 * hidratação, e a CSP com nonce (T-139) proíbe script embutido de qualquer
 * forma.
 *
 * ## Por que enviar num botão, e não a cada troca
 *
 * O protótipo navega no `onChange` do `<select>`, e isso não sobrevive ao
 * teclado: com um `<select>` fechado e em foco, cada seta dispara `change`
 * imediatamente. Ir de "12 meses" a "Dezembro" seriam três navegações, e o foco
 * se perde em cada uma. É também mudança de contexto na entrada, que a seção 13
 * pede para evitar quando fala em "navegação por teclado completa".
 *
 * Com botão de envio, o caminho é o do critério de aceite: **Tab** chega ao
 * controle, **setas** percorrem os valores, **Tab** chega ao botão e **Enter**
 * aplica. Nenhum manipulador de tecla escrito à mão.
 *
 * O Enter precisa ser dado no botão, e isso foi medido: o envio implícito do
 * HTML — Enter dentro de um campo envia o formulário — vale para campo de
 * texto, e o Chromium não o dispara a partir de um `<select>`. Por isso o botão
 * vem logo depois dos cinco controles na ordem do documento, que é a ordem de
 * foco: quem chegou ao último filtro está a um Tab de aplicar.
 *
 * ## Nada aqui lê dado (PR-1)
 *
 * Os valores oferecidos chegam por `dimensoes`, que é a forma de
 * `getMeta().dimensoes` — já filtrada pelo perfil na fronteira (seção 11), para
 * que a lista não revele uma entidade que a pessoa não pode ver.
 */
export function BarraDeFiltros({
  rota,
  query,
  dimensoes,
  painelDestacado,
}: {
  /** A rota da tela ativa, com barra inicial: `/rh/turnover`. */
  readonly rota: string;
  readonly query: Query;
  /** O que `getMeta` oferece, já recortado pelo perfil. */
  readonly dimensoes: Dimensoes;
  /** Preservado no envio: trocar de filtro não desfaz o destaque da IA. */
  readonly painelDestacado: string | null;
}) {
  return (
    <form
      method="get"
      action={rota}
      data-teste="barra-de-filtros"
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 9,
        flexWrap: "wrap",
        margin: "14px 0 0",
      }}
    >
      {FILTROS.map((campo) => (
        <Controle
          key={campo}
          campo={campo}
          valor={query[campo]}
          opcoes={opcoesDe(campo, dimensoes)}
        />
      ))}

      {/*
        O painel destacado atravessa o envio.
        Um formulário GET reescreve a busca inteira; sem este campo, mudar de
        área apagaria o destaque que o chat acabou de aplicar (seção 6.5).
      */}
      {painelDestacado === null ? null : (
        <input type="hidden" name="painel" value={painelDestacado} />
      )}

      <button
        type="submit"
        data-teste="aplicar-filtros"
        style={{
          height: 33,
          border: `1px solid ${PALETA.marca}`,
          background: PALETA.marca,
          color: PALETA.superficie,
          borderRadius: 999,
          padding: "0 16px",
          font: `500 10.5px ${TIPOGRAFIA.texto}`,
          cursor: "pointer",
        }}
      >
        Aplicar
      </button>

      <Link
        href={rotaCom(rota, QUERY_PADRAO, painelDestacado ?? undefined)}
        data-teste="limpar-filtros"
        style={{
          height: 33,
          display: "inline-flex",
          alignItems: "center",
          border: `1px solid ${PALETA.bordaForte}`,
          background: PALETA.superficie,
          color: PALETA.textoTerciario,
          borderRadius: 999,
          padding: "0 14px",
          font: `500 10.5px ${TIPOGRAFIA.texto}`,
          textDecoration: "none",
        }}
      >
        Limpar
      </Link>
    </form>
  );
}

/** Uma opção do controle: o código que viaja e o rótulo que se lê (T-186). */
type Opcao = { readonly codigo: string; readonly rotulo: string };

/**
 * Os valores que um filtro oferece.
 *
 * Vêm de `dimensoes` — nunca do registro completo. A diferença aparece no
 * perfil `area`, cuja fronteira devolve só a área dele: o controle precisa
 * oferecer o que ele pode ver, e não a lista inteira com as outras acinzentadas.
 */
function opcoesDe(campo: NomeDeFiltro, dimensoes: Dimensoes): readonly Opcao[] {
  const codigos = campo === "ano" ? (dimensoes.ano ?? []) : dimensoes[campo];
  return codigos.map((codigo) => ({ codigo, rotulo: rotuloDe(campo, codigo) }));
}

function Controle({
  campo,
  valor,
  opcoes,
}: {
  readonly campo: NomeDeFiltro;
  readonly valor: string;
  readonly opcoes: readonly Opcao[];
}) {
  const foraDoPadrao = valor !== QUERY_PADRAO[campo];
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          font: `500 8px/1.2 ${TIPOGRAFIA.mono}`,
          color: PALETA.textoFraco,
          textTransform: "uppercase",
          letterSpacing: ".1em",
        }}
      >
        {ROTULO_DO_FILTRO[campo]}
      </span>
      <select
        /*
          A chave carrega o valor de propósito.
          O `<select>` é não controlado — `defaultValue` só vale na montagem.
          Sem isto, uma navegação de cliente (clicar em "Limpar", trocar de aba)
          reaproveitaria o nó e deixaria na tela a seleção antiga, enquanto a
          URL já mostra outro recorte. Trocar a chave remonta o controle.
        */
        key={`${campo}-${valor}`}
        name={campo}
        defaultValue={valor}
        data-teste={`filtro-${campo}`}
        style={{
          appearance: "none",
          background: foraDoPadrao
            ? PALETA.superficieSuave
            : PALETA.superficieAlta,
          border: `1px solid ${foraDoPadrao ? PALETA.destaque : PALETA.bordaForte}`,
          borderRadius: 999,
          padding: "7px 14px",
          font: `500 11.5px/1.2 ${TIPOGRAFIA.texto}`,
          color: foraDoPadrao ? PALETA.marca : PALETA.texto,
          cursor: "pointer",
          minWidth: 114,
        }}
      >
        {opcoes.map((o) => (
          <option key={o.codigo} value={o.codigo}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </label>
  );
}
