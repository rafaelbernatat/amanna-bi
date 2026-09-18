import { ATRIBUTO_DO_ALVO_DO_TEMA, PALETA } from "@/apresentacao/tema/tema";
import type { Tema } from "@/apresentacao/tema/tema";

/**
 * Um dos dois formularios de troca de tema: este propoe `alvo`.
 *
 * Os dois sao emitidos sempre, e a folha de `EstiloDoTema` esconde o que
 * propoe a pele ja em vigor. E o que deixa o botao certo sem JavaScript e sem
 * o servidor saber a preferencia do sistema (T-418). O `display` nao vai
 * inline de proposito: e a folha que decide, e um estilo inline venceria a
 * folha.
 */
export function FormularioDeTema({
  alvo,
  de,
}: {
  readonly alvo: Tema;
  readonly de: string;
}) {
  const rotulo = alvo === "escuro" ? "Usar tema escuro" : "Usar tema claro";
  return (
    <form
      method="post"
      action="/api/tema"
      {...{ [ATRIBUTO_DO_ALVO_DO_TEMA]: alvo }}
    >
      <input type="hidden" name="tema" value={alvo} />
      <input type="hidden" name="de" value={de} />
      <button
        type="submit"
        data-teste={`trocar-tema-para-${alvo}`}
        aria-label={rotulo}
        title={rotulo}
        style={{
          flex: "none",
          width: 30,
          height: 30,
          display: "grid",
          placeItems: "center",
          borderRadius: 999,
          border: `1px solid ${PALETA.bordaForte}`,
          background: PALETA.superficie,
          color: PALETA.textoSecundario,
          cursor: "pointer",
        }}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          {alvo === "claro" ? (
            <>
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
            </>
          ) : (
            <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
          )}
        </svg>
      </button>
    </form>
  );
}
