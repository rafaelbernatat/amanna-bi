"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import { MARCA, PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";
import type { Query } from "@/semantica/contrato";
import { QUERY_PADRAO } from "@/semantica/contrato";
import {
  FILTROS,
  ROTULO_DO_FILTRO,
  rotuloDe,
  type NomeDeFiltro,
} from "@/semantica/dimensoes";
import type { Dimensoes } from "@/semantica/recortes";
import { buscaParaQuery, queryParaBusca, rotaCom } from "@/semantica/url";

/**
 * Os cinco controles da tabela 6.2 (T-128, T-420; PRD seção 6.2 e RF-01;
 * decisão D-NAVEGACAO-menu-lateral-e-filtros-vivos).
 *
 * ## O recorte continua sendo a URL
 *
 * O recorte vive na URL e é resolvido no servidor (T-127). Trocar um controle
 * **navega** para a URL canônica do novo recorte — `rotaCom`, o mesmo leitor
 * e o mesmo escritor da página —, e a tela inteira se refaz no servidor com
 * ele. Não existe uma segunda fonte para o mesmo fato: a escolha pendente
 * vive aqui por trezentos milissegundos, e morre quando a navegação chega.
 *
 * ## Por que vivo, e não num botão (T-420)
 *
 * Produto pediu que trocar o período mudasse os gráficos sem "Aplicar". A
 * objeção de T-128 continua verdadeira — com um `<select>` fechado e em foco,
 * cada seta dispara `change` — e é respondida de outro jeito: o controle é
 * **controlado** (o foco não se perde, porque nada é remontado) e a navegação
 * espera um silêncio de `ATRASO_DE_APLICACAO_MS`. Ir de "12 meses" a
 * "Dezembro" por setas é uma navegação, não três. Sair do controle aplica na
 * hora.
 *
 * ## A escolha pendente, e quando ela deixa de valer
 *
 * A pendência guarda a URL em que foi feita. Ela vale enquanto a tela está
 * nessa URL, ou na que a própria barra acabou de empurrar; qualquer outra
 * navegação — "Limpar", uma aba de módulo, a resposta do chat — a invalida,
 * e o controle volta a mostrar o que a URL diz. A pendência some **dentro da
 * transição** que navega: os dois commits são um só, e o controle nunca
 * mostra o valor antigo entre a escolha e a chegada.
 *
 * ## Sem JavaScript, ainda funciona
 *
 * O formulário GET continua sendo o mecanismo de fundo: um botão em
 * `<noscript>` envia os cinco campos e a canonização da rota faz o resto. É o
 * que mantém o comportamento igual antes e depois da hidratação.
 *
 * ## É componente de cliente, e por quê
 *
 * Navegar a cada troca exige o roteador no navegador. É um dos dois arquivos
 * de cliente fora de `graficos/` e `chat/`, nomeado no teste de arquitetura.
 * O que continua valendo: não lê dado, não calcula, não formata, não mede.
 *
 * ## Nada aqui lê dado (PR-1)
 *
 * Os valores oferecidos chegam por `dimensoes`, que é a forma de
 * `getMeta().dimensoes` — já filtrada pelo perfil na fronteira (seção 11).
 */

/** Quanto silêncio, em milissegundos, antes de navegar. */
export const ATRASO_DE_APLICACAO_MS = 300;

/** A escolha que ainda não virou URL, e a URL da tela em que foi feita. */
type Pendente = { readonly chave: string; readonly query: Query };

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
  /** Preservado na navegação: trocar de filtro não desfaz o destaque da IA. */
  readonly painelDestacado: string | null;
}) {
  const roteador = useRouter();
  const [aplicando, iniciarTransicao] = useTransition();

  /** A URL desta tela com o recorte atual: a chave do que está na tela. */
  const chave = rotaCom(rota, query, painelDestacado ?? undefined);
  const [pendente, setPendente] = useState<Pendente | null>(null);
  /** A última URL que a barra empurrou, para reconhecer a própria navegação. */
  const [alvoEmVoo, setAlvoEmVoo] = useState<string | null>(null);

  const escolhaPendente =
    pendente !== null && (pendente.chave === chave || chave === alvoEmVoo)
      ? pendente.query
      : null;
  const efetiva = escolhaPendente ?? query;

  const aplicar = useCallback(
    (escolha: Query) => {
      const destino = rotaCom(rota, escolha, painelDestacado ?? undefined);
      if (destino === chave) {
        // Trocou e destrocou dentro do atraso: não há para onde navegar.
        setPendente(null);
        return;
      }
      // Já está a caminho: o atraso venceu depois de sair do controle.
      if (destino === alvoEmVoo && aplicando) return;
      setPendente({ chave, query: escolha });
      setAlvoEmVoo(destino);
      iniciarTransicao(() => {
        setPendente(null);
        // Sem rolar: o recorte mudou, a tela não. Rolar (e focar o segmento,
        // que vem junto) tiraria o foco do controle que a pessoa está usando.
        roteador.push(destino, { scroll: false });
      });
    },
    [
      rota,
      painelDestacado,
      chave,
      alvoEmVoo,
      aplicando,
      iniciarTransicao,
      roteador,
    ],
  );

  /*
   * O atraso. Cada `change` reagenda; só o silêncio navega. Uma navegação que
   * invalida a pendência desarma o cronômetro pela limpeza do próprio efeito.
   */
  useEffect(() => {
    if (escolhaPendente === null) return;
    const cronometro = setTimeout(() => {
      aplicar(escolhaPendente);
    }, ATRASO_DE_APLICACAO_MS);
    return () => {
      clearTimeout(cronometro);
    };
  }, [escolhaPendente, aplicar]);

  const trocar = (campo: NomeDeFiltro, valor: string) => {
    // O mesmo leitor da página: um valor fora do vocabulário cai no padrão.
    const busca = queryParaBusca(efetiva);
    busca.set(campo, valor);
    setPendente({ chave, query: buscaParaQuery(busca, dimensoes.ano).query });
  };

  const aplicarAgora = () => {
    if (escolhaPendente !== null) aplicar(escolhaPendente);
  };

  return (
    <form
      method="get"
      action={rota}
      data-teste="barra-de-filtros"
      data-carregando={aplicando ? "1" : "0"}
      aria-busy={aplicando}
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
          valor={efetiva[campo]}
          opcoes={opcoesDe(campo, dimensoes)}
          aoTrocar={(valor) => {
            trocar(campo, valor);
          }}
          aoSair={aplicarAgora}
        />
      ))}

      {/*
        O painel destacado atravessa o envio sem JavaScript.
        Um formulário GET reescreve a busca inteira; sem este campo, mudar de
        área apagaria o destaque que o chat acabou de aplicar (seção 6.5).
      */}
      {painelDestacado === null ? null : (
        <input type="hidden" name="painel" value={painelDestacado} />
      )}

      <noscript>
        <button
          type="submit"
          data-teste="aplicar-sem-script"
          style={{
            height: 33,
            border: `1px solid ${MARCA.marca}`,
            background: MARCA.marca,
            color: PALETA.superficie,
            borderRadius: 999,
            padding: "0 16px",
            font: `500 10.5px ${TIPOGRAFIA.texto}`,
            cursor: "pointer",
          }}
        >
          Aplicar
        </button>
      </noscript>

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

      {/*
        Por visibilidade, e não por presença: um aviso que entra e sai
        deslocaria a barra, e o deslocamento de layout aqui é zero (T-129).
      */}
      <span
        role="status"
        data-teste="filtros-aplicando"
        style={{
          visibility: aplicando ? "visible" : "hidden",
          alignSelf: "center",
          font: `500 10px/1.2 ${TIPOGRAFIA.texto}`,
          color: MARCA.destaque,
        }}
      >
        Aplicando…
      </span>
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
  aoTrocar,
  aoSair,
}: {
  readonly campo: NomeDeFiltro;
  readonly valor: string;
  readonly opcoes: readonly Opcao[];
  readonly aoTrocar: (valor: string) => void;
  readonly aoSair: () => void;
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
          Controlado, e sem chave que remonte: o valor vem da URL (ou da
          escolha pendente), e o nó sobrevive à navegação — é o que mantém o
          foco no controle depois de aplicar.
        */
        name={campo}
        value={valor}
        onChange={(evento) => {
          aoTrocar(evento.target.value);
        }}
        onBlur={aoSair}
        data-teste={`filtro-${campo}`}
        style={{
          appearance: "none",
          background: foraDoPadrao
            ? PALETA.superficieSuave
            : PALETA.superficieAlta,
          border: `1px solid ${foraDoPadrao ? MARCA.destaque : PALETA.bordaForte}`,
          borderRadius: 999,
          padding: "7px 14px",
          font: `500 11.5px/1.2 ${TIPOGRAFIA.texto}`,
          color: foraDoPadrao ? MARCA.marca : PALETA.texto,
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
