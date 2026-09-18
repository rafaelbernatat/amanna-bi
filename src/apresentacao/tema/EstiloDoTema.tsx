import {
  PALETA_ESCURA,
  variavelDoTema,
  type ChaveDePaletaClara,
} from "@/apresentacao/tema/tema";

/**
 * A pele escura, como propriedades CSS na raiz do documento (T-372).
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
 * vir depois para vencer. `:root:not([data-theme="light"])` é o que permite
 * voltar ao claro dentro de um sistema escuro — sem essa negação, a escolha
 * manual só funcionaria numa direção.
 *
 * É o mesmo par de seletores do painel de referência que Produto entregou.
 *
 * ## Estático, e por isso sem dado
 *
 * Nada aqui depende de requisição: são duas tabelas fixas. O nonce vem junto
 * porque a política de segurança exige, como em `EstiloDaMarca`.
 */
export function EstiloDoTema({ nonce }: { readonly nonce?: string }) {
  const regras = Object.entries(PALETA_ESCURA)
    .map(
      ([chave, cor]) =>
        `${variavelDoTema(chave as ChaveDePaletaClara)}:${String(cor)}`,
    )
    .join(";");

  const folha = [
    `@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${regras}}}`,
    `:root[data-theme="dark"]{${regras}}`,
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
