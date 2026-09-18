import {
  PALETA_ESCURA,
  seletorDoAlvoDoTema,
  seletorDoTema,
  variavelDoTema,
  type ChaveDePaletaClara,
} from "@/apresentacao/tema/tema";

/**
 * A pele escura, como propriedades CSS na raiz do documento (T-372, T-418).
 *
 * ## Por que a moldura troca sozinha e o gráfico não
 *
 * Cada valor de `PALETA` é um `var()` cujo segundo degrau é a variável de tema
 * emitida aqui. Trocar o tema é redefinir vinte e quatro propriedades: os 369
 * pontos que pintam tela não sabem que isso aconteceu, e não precisam saber.
 *
 * O gráfico fica de fora porque `var()` **não é substituído em atributo de
 * apresentação de SVG** — um `stroke="var(--bi-t-grade)"` não pinta, a linha
 * some — e porque um SVG serializado para fora do documento perde o `:root`
 * junto. Ele recebe a pele resolvida em valor literal, por propriedade.
 *
 * ## Os dois seletores, e por que são dois
 *
 * O primeiro segue o sistema operacional: quem tem o computador em escuro abre
 * o painel em escuro, sem pedir. O segundo deixa a pessoa discordar, e tem de
 * vir depois para vencer. `:root:not([data-tema="claro"])` é o que permite
 * voltar ao claro dentro de um sistema escuro — sem essa negação, a escolha
 * manual só funcionaria numa direção.
 *
 * Os dois nascem de `seletorDoTema`, e isso é a correção de T-418. O painel de
 * referência escrevia `light` e `dark`; o documento escrevia `claro` e
 * `escuro`; a folha nunca casava com o atributo, e o botão de tema não fazia
 * nada em nenhuma direção. Nome e valor do atributo têm uma origem só, e um
 * teste reprova o valor escrito à mão.
 *
 * ## `color-scheme`
 *
 * Diz ao navegador em que pele estamos. É o que faz `<select>`, barra de
 * rolagem e caixa de diálogo nativos escurecerem junto — sem isso, os cinco
 * filtros abriam uma lista branca no meio de uma tela escura.
 *
 * ## Os dois botões
 *
 * O servidor não enxerga `prefers-color-scheme`, então não sabe qual troca
 * oferecer. Ele emite os dois formulários, e esta folha esconde o que propõe
 * a pele já em vigor. Antes, num sistema escuro sem escolha, o botão oferecia
 * "usar tema escuro" a uma tela já escura, e o primeiro clique parecia não
 * fazer nada.
 *
 * ## Estático, e por isso sem dado
 *
 * Nada aqui depende de requisição: são duas tabelas fixas. O nonce vem junto
 * porque a política de segurança exige, como em `EstiloDaMarca`.
 */
export function EstiloDoTema({ nonce }: { readonly nonce?: string }) {
  const tokens = Object.entries(PALETA_ESCURA)
    .map(
      ([chave, cor]) =>
        `${variavelDoTema(chave as ChaveDePaletaClara)}:${String(cor)}`,
    )
    .join(";");

  const claro = seletorDoTema("claro");
  const escuro = seletorDoTema("escuro");
  const propoeClaro = seletorDoAlvoDoTema("claro");
  const propoeEscuro = seletorDoAlvoDoTema("escuro");

  /**
   * O que segue a raiz vale na pele escura, pelos dois caminhos: o sistema
   * pede escuro e ninguém discordou, ou a pessoa escolheu escuro.
   */
  const naPeleEscura = (resto: string): string =>
    `@media (prefers-color-scheme:dark){:root:not(${claro})${resto}}` +
    `:root${escuro}${resto}`;

  const folha = [
    `:root{color-scheme:light}`,
    `${propoeClaro},${propoeEscuro}{display:flex}`,
    `${propoeClaro}{display:none}`,
    naPeleEscura(`{color-scheme:dark;${tokens}}`),
    naPeleEscura(` ${propoeEscuro}{display:none}`),
    naPeleEscura(` ${propoeClaro}{display:flex}`),
  ].join("");

  return (
    <style
      data-teste="estilo-do-tema"
      {...(nonce === undefined ? {} : { nonce })}
    >
      {folha}
    </style>
  );
}
