import Link from "next/link";

import { filtrosForaDoPadrao } from "@/apresentacao/filtros/recorte-ativo";
import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";
import type { Query } from "@/semantica/contrato";
import { QUERY_PADRAO } from "@/semantica/contrato";
import { rotaCom } from "@/semantica/url";

/**
 * O banner de recorte ativo (T-128, PRD seção 6.2 e RF-02).
 *
 * "Quando qualquer filtro sai do padrão, um banner de recorte ativo aparece
 * acima dos KPIs, listando o que está fora do padrão, com um botão 'Voltar ao
 * consolidado' que restaura os cinco de uma vez."
 *
 * ## Devolve `null` quando não há recorte
 *
 * É a forma exata do "se e somente se" do aceite: sem filtro fora do padrão não
 * existe nó nenhum na página, e não um nó escondido por CSS. Um banner com
 * `display:none` passaria num teste de visibilidade e continuaria sendo lido em
 * voz alta por um leitor de tela.
 *
 * ## Cada item nomeia o seu filtro
 *
 * O protótipo escreve a lista como valores soltos separados por ponto —
 * `Dezembro · Unidade SP` — e prefixa só dois deles (`ano 2025`, `área RH`). A
 * inconsistência é a pista: o próprio autor sentiu que o valor sozinho não diz
 * qual filtro está em jogo. Aqui todos são `Filtro: Valor`, o que também é o
 * que a seção 6.2 pede ao dizer "listando o que está fora do padrão".
 *
 * ## Voltar ao consolidado é um link, não um botão de formulário
 *
 * O destino é conhecido antes do clique: a rota da tela no recorte padrão. Um
 * link mostra o destino na barra de estado, pode ser aberto em outra aba e
 * funciona sem JavaScript — e restaura os cinco de uma vez porque é para lá que
 * ele aponta, não porque alguém lembrou de limpar cinco campos.
 */
export function BannerDeRecorte({
  rota,
  query,
  painelDestacado,
}: {
  readonly rota: string;
  readonly query: Query;
  readonly painelDestacado: string | null;
}) {
  const fora = filtrosForaDoPadrao(query);
  if (fora.length === 0) return null;

  return (
    <div
      data-teste="banner-de-recorte"
      data-filtros={fora.map((f) => f.campo).join(",")}
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
        background: PALETA.superficie,
        border: `1px solid ${PALETA.grade}`,
        borderLeft: `3px solid ${PALETA.destaqueSuave}`,
        borderRadius: 15,
        padding: "11px 15px",
        marginBottom: 16,
      }}
    >
      <span
        style={{
          font: `500 9px ${TIPOGRAFIA.mono}`,
          color: PALETA.destaque,
          textTransform: "uppercase",
          letterSpacing: ".1em",
        }}
      >
        Recorte ativo
      </span>

      <span
        data-teste="recorte-ativo-lista"
        style={{
          font: `400 11.5px ${TIPOGRAFIA.texto}`,
          color: PALETA.textoSecundario,
        }}
      >
        {fora.map((f) => `${f.rotuloDoCampo}: ${f.rotuloDoValor}`).join(" · ")}
      </span>

      <Link
        href={rotaCom(rota, QUERY_PADRAO, painelDestacado ?? undefined)}
        data-teste="voltar-ao-consolidado"
        style={{
          marginLeft: "auto",
          border: `1px solid ${PALETA.bordaForte}`,
          background: PALETA.superficie,
          color: PALETA.marca,
          borderRadius: 999,
          padding: "5px 12px",
          font: `500 10px ${TIPOGRAFIA.texto}`,
          textDecoration: "none",
        }}
      >
        Voltar ao consolidado
      </Link>
    </div>
  );
}
