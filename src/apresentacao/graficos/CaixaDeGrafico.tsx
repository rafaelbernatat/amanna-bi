import type { ReactNode } from "react";

/**
 * A caixa que reserva o espaco do grafico antes de ele montar (T-129).
 *
 * Server Component. Existe por um motivo unico e verificavel: o recharts monta
 * no cliente e mede a propria largura, e um grafico que so sabe seu tamanho
 * depois de medir empurra o que veio antes dele. Aqui a altura e fixa e a
 * largura e 100%, entao o espaco ja esta ocupado no primeiro quadro servido e
 * o deslocamento de layout fica em zero.
 *
 * Nada aqui mede nada: a altura vem por propriedade, do registro do painel.
 */
export function CaixaDeGrafico({
  altura,
  rotulo,
  children,
}: {
  readonly altura: number;
  /** Alternativa textual do grafico (PRD secao 13, acessibilidade). */
  readonly rotulo: string;
  readonly children: ReactNode;
}) {
  return (
    <div
      role="img"
      aria-label={rotulo}
      data-grafico=""
      style={{
        width: "100%",
        height: altura,
        // Reserva a caixa tambem antes de o CSS de layout resolver.
        minHeight: altura,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}
