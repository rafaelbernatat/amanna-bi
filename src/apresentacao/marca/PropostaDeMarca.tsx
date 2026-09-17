import {
  formatarQuilobytes,
  formatarRazao,
} from "@/apresentacao/formato/formato";
import { NOME_DO_PAPEL, PARA_QUE_SERVE } from "@/apresentacao/marca/papeis";
import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";
import type { CoresDaMarca } from "@/apresentacao/tema/tema";
import type { AjusteDeContraste } from "@/apresentacao/tema/contraste";
import type { Proposta } from "@/marca/documento";
import { ROTA_DO_LOGO } from "@/marca/tela";

/** Como a extração descreve de onde veio a escolha. */
const COMO_ESCOLHEU: Readonly<Record<string, string>> = {
  modelo: "escolhidas pelo modelo entre as cores que o site declara",
  deterministica: "escolhidas por ordem de prioridade, sem o modelo",
  "modelo-recusado":
    "a escolha do modelo apontou para fora da lista e foi descartada; valeu a ordem de prioridade",
  "gateway-indisponivel": "o modelo não respondeu; valeu a ordem de prioridade",
  manual: "informadas à mão",
};

/**
 * A proposta, antes de alguém aplicar.
 *
 * Mostra as cinco cores, o logo, e — quando houve ajuste de contraste — a cor
 * original ao lado da cor aplicada, com as duas razões. É o que impede o
 * ajuste de ser silencioso: quem aplica vê exatamente o que vai mudar e por
 * quê. Vale igual para a proposta que veio do site e para a que a pessoa
 * digitou; muda só como a tela nomeia a origem.
 */
export function PropostaDeMarca({ proposta }: { readonly proposta: Proposta }) {
  const ajustePor = new Map(proposta.extracao.ajustes.map((a) => [a.papel, a]));
  const doSite = proposta.origem === "site";

  return (
    <section
      data-teste="proposta"
      data-origem={proposta.origem}
      aria-label="Proposta de marca"
      style={{
        background: PALETA.superficie,
        border: `1px solid ${PALETA.bordaForte}`,
        borderRadius: 17,
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <header style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h2
          style={{
            margin: 0,
            font: `500 18px/1.2 ${TIPOGRAFIA.titulo}`,
            color: PALETA.texto,
          }}
        >
          {doSite
            ? `O que encontramos em ${proposta.site ?? ""}`
            : "O que você informou"}
        </h2>
        <p
          data-teste="autoria-da-extracao"
          style={{
            margin: 0,
            font: `400 11.5px/1.5 ${TIPOGRAFIA.texto}`,
            color: PALETA.textoSecundario,
          }}
        >
          {doSite
            ? `${String(proposta.candidatos)} cores declaradas pelo site, `
            : "Cinco cores "}
          {COMO_ESCOLHEU[proposta.extracao.autoria] ?? "escolhidas"}
          {proposta.extracao.modelo === null
            ? ""
            : ` (${proposta.extracao.modelo})`}
          {proposta.nome === null
            ? ""
            : `, com o nome “${proposta.nome}” no cabeçalho`}
          .
        </p>
      </header>

      {proposta.logoRecusado === null ? null : (
        <p
          data-teste="logo-recusado"
          role="status"
          style={{
            margin: 0,
            padding: "10px 12px",
            borderRadius: 10,
            border: `1px solid ${PALETA.bordaForte}`,
            borderLeft: `3px solid ${PALETA.negativo}`,
            background: PALETA.superficie,
            font: `400 11.5px/1.55 ${TIPOGRAFIA.texto}`,
            color: PALETA.textoSecundario,
          }}
        >
          {doSite ? "O logo do site" : "O arquivo enviado"} não serviu:{" "}
          {FRASE_DO_LOGO[proposta.logoRecusado] ?? proposta.logoRecusado}.
          {proposta.logo === null
            ? " O cabeçalho continua com o nome escrito."
            : " O logo em uso continua."}
        </p>
      )}

      {proposta.logo === null ? (
        proposta.logoRecusado === null ? (
          <p
            data-teste="logo-da-proposta"
            data-tem-logo="0"
            style={{
              margin: 0,
              font: `400 11.5px/1.5 ${TIPOGRAFIA.texto}`,
              color: PALETA.textoSecundario,
            }}
          >
            {doSite ? "Nenhum logo utilizável foi encontrado." : "Sem logo."} O
            cabeçalho continua com o nome escrito.
          </p>
        ) : (
          <p data-teste="logo-da-proposta" data-tem-logo="0" hidden />
        )
      ) : (
        <div
          data-teste="logo-da-proposta"
          data-tem-logo="1"
          style={{ display: "flex", alignItems: "center", gap: 12 }}
        >
          {/*
            Uma tag simples, e nao o componente de imagem do Next: ver a nota
            no cabecalho. A excecao da regra esta em `eslint.config.mjs`, e nao
            num comentario aqui — comentario que desliga regra some do arquivo
            e reaparece como erro num verificador que nao conhece aquela regra.
          */}
          <img
            src={`${ROTA_DO_LOGO}?de=proposta&v=${proposta.logo.impressao.slice(0, 12)}`}
            alt={
              doSite
                ? `Logo encontrado em ${proposta.site ?? ""}`
                : proposta.logoRecusado === null
                  ? "Logo enviado"
                  : "Logo em uso, mantido"
            }
            height={40}
            style={{ height: 40, width: "auto", maxWidth: 200 }}
          />
          <span
            style={{
              font: `400 10.5px/1.4 ${TIPOGRAFIA.mono}`,
              color: PALETA.textoTerciario,
            }}
          >
            {proposta.logo.tipo} · {formatarQuilobytes(proposta.logo.bytes)}
          </span>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: 10,
        }}
      >
        {(Object.keys(NOME_DO_PAPEL) as (keyof CoresDaMarca)[]).map((papel) => (
          <Amostra
            key={papel}
            papel={papel}
            aplicada={proposta.cores[papel]}
            original={proposta.coresOriginais[papel]}
            ajuste={ajustePor.get(papel) ?? null}
          />
        ))}
      </div>

      {proposta.extracao.ajustes.length === 0 ? null : (
        <p
          data-teste="aviso-de-ajuste"
          role="status"
          style={{
            margin: 0,
            padding: "10px 12px",
            borderRadius: 10,
            border: `1px solid ${PALETA.bordaForte}`,
            background: PALETA.superficieSuave,
            font: `400 11.5px/1.6 ${TIPOGRAFIA.texto}`,
            color: PALETA.textoSecundario,
          }}
        >
          {proposta.extracao.ajustes.length === 1
            ? "Uma cor foi escurecida ou clareada"
            : `${String(proposta.extracao.ajustes.length)} cores foram escurecidas ou clareadas`}{" "}
          para o texto em cima delas continuar legível. O painel exige contraste
          mínimo de 4,5 para 1 em texto. A cor original aparece riscada ao lado
          da aplicada.
        </p>
      )}

      {proposta.avisos.length === 0 ? null : (
        <ul
          data-teste="avisos-da-proposta"
          style={{
            margin: 0,
            paddingLeft: 18,
            font: `400 11px/1.6 ${TIPOGRAFIA.texto}`,
            color: PALETA.textoTerciario,
          }}
        >
          {proposta.avisos.map((aviso) => (
            <li key={aviso}>{aviso}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Por que um logo não serviu, em português. */
const FRASE_DO_LOGO: Readonly<Record<string, string>> = {
  nao_baixou: "não foi possível baixar",
  grande_demais: "arquivo grande demais",
  tipo_nao_reconhecido: "o arquivo não é uma imagem reconhecida",
  dimensao_demais: "imagem grande demais",
  vetor_perigoso: "o vetor traz script ou referência externa",
};

function Amostra({
  papel,
  aplicada,
  original,
  ajuste,
}: {
  readonly papel: keyof CoresDaMarca;
  readonly aplicada: string;
  readonly original: string;
  readonly ajuste: AjusteDeContraste | null;
}) {
  return (
    <div
      data-teste="amostra-de-cor"
      data-papel={papel}
      data-cor={aplicada}
      style={{
        border: `1px solid ${PALETA.borda}`,
        borderRadius: 12,
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 7,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span
          aria-hidden="true"
          style={{
            width: 30,
            height: 30,
            flex: "none",
            borderRadius: 8,
            background: aplicada,
            border: `1px solid ${PALETA.bordaForte}`,
          }}
        />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              font: `500 11.5px/1.2 ${TIPOGRAFIA.texto}`,
              color: PALETA.texto,
            }}
          >
            {NOME_DO_PAPEL[papel]}
          </div>
          <div
            style={{
              font: `400 10px/1.4 ${TIPOGRAFIA.mono}`,
              color: PALETA.textoTerciario,
            }}
          >
            {aplicada}
            {ajuste === null ? null : (
              <>
                {" · "}
                <s data-teste="cor-original">{original}</s>
              </>
            )}
          </div>
        </div>
      </div>

      <p
        style={{
          margin: 0,
          font: `400 10px/1.45 ${TIPOGRAFIA.texto}`,
          color: PALETA.textoTerciario,
        }}
      >
        {PARA_QUE_SERVE[papel]}
      </p>

      {ajuste === null ? null : (
        <p
          data-teste="detalhe-do-ajuste"
          style={{
            margin: 0,
            font: `400 10px/1.45 ${TIPOGRAFIA.mono}`,
            color: PALETA.textoSecundario,
          }}
        >
          contraste {formatarRazao(ajuste.razaoAntes)} →{" "}
          {formatarRazao(ajuste.razaoDepois)}
          {ajuste.alcancou ? "" : " · não alcança o mínimo nem no extremo"}
        </p>
      )}
    </div>
  );
}
