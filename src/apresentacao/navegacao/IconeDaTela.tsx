import type { IconeDeTela } from "@/apresentacao/navegacao/telas";

/**
 * O ícone de cada tela, para o menu lateral (T-442).
 *
 * Traço em `currentColor`, sem cor própria: quem pinta é o texto do menu,
 * claro sobre a barra escura, ativo ou não. Vetores simples, desenhados à
 * mão numa grade de 24, para o menu recolhido continuar dizendo o que é
 * cada tela só pela forma — e o título vai no `aria-label` do link.
 */
export function IconeDaTela({
  icone,
  tamanho = 16,
}: {
  readonly icone: IconeDeTela;
  readonly tamanho?: number;
}) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-icone={icone}
      style={{ flex: "none" }}
    >
      {TRACOS[icone]}
    </svg>
  );
}

const TRACOS: Readonly<Record<IconeDeTela, React.ReactNode>> = {
  visao: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" />
      <rect x="13" y="10" width="8" height="11" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
    </>
  ),
  pessoas: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15.5 14.5a5 5 0 0 1 6 5.5" />
    </>
  ),
  giro: (
    <>
      <path d="M4 12a8 8 0 0 1 14-5.3" />
      <path d="M18 3v4h-4" />
      <path d="M20 12a8 8 0 0 1-14 5.3" />
      <path d="M6 21v-4h4" />
    </>
  ),
  recrutamento: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M12 11v6M9 14h6" />
    </>
  ),
  treinamento: (
    <>
      <path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z" />
      <path d="M20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z" />
    </>
  ),
  engajamento: (
    <>
      <path d="M20.8 8.6a5 5 0 0 0-8.8-3 5 5 0 0 0-8.8 3c0 5 8.8 11 8.8 11s8.8-6 8.8-11z" />
      <path d="M5 12h4l2-3 3 6 2-3h3" />
    </>
  ),
  salarios: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
      <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
    </>
  ),
  financeiro: (
    <>
      <path d="M3 20h18" />
      <path d="M4 16l5-5 4 4 7-8" />
      <path d="M16 7h4v4" />
    </>
  ),
  caixa: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <path d="M16 14h2" />
    </>
  ),
  orcamento: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
    </>
  ),
  contas: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  faturamento: (
    <>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5" />
      <path d="M12 10.5v8M10.5 12h2.5a1.25 1.25 0 0 1 0 2.5h-2a1.25 1.25 0 0 0 0 2.5h2.5" />
    </>
  ),
  cruzamento: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5" />
    </>
  ),
};
