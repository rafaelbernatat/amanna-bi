import {
  CHAVES_DE_MARCA,
  variavelDaMarca,
  type CoresDaMarca,
} from "@/apresentacao/tema/tema";
import { corCanonica } from "@/apresentacao/tema/contraste";

/**
 * As cinco cores da empresa, como propriedades CSS na raiz do documento.
 *
 * Sem marca configurada não emite nada, e o valor de recuo de cada `var()`
 * mantém a tela exatamente como é hoje. Isso é o que faz a personalização ser
 * aditiva: uma instalação que nunca configurou nada não tem como notar que
 * este componente existe.
 *
 * ## A conferência de forma acontece aqui de novo
 *
 * A cor já foi conferida na extração e de novo na leitura do documento. Aqui é
 * a terceira, e não é excesso: este é o ponto onde o valor **entra numa folha
 * de estilo**, e a política de segurança do produto tem `unsafe-inline` em
 * estilo por dívida antiga (H-46) — ou seja, a política não protege esta
 * folha. Um valor como `#fff}html{display:none}` fecharia a regra e escreveria
 * CSS arbitrário na página.
 *
 * O que se faz com o que não casa é descartar, não escapar: uma cor que não é
 * `#rrggbb` não é uma cor, e o papel fica com o recuo.
 *
 * ## Sem `precedence`, de propósito
 *
 * Com `precedence`, o React move a regra para a própria fila de estilos e
 * descarta o `nonce` no caminho. Sem ele, o elemento sai exatamente onde foi
 * escrito. Como `style-src` já traz `unsafe-inline`, o nonce nem é necessário
 * hoje — mas o dia em que H-46 for pago e a política ganhar um nonce de
 * estilo, esta folha precisa continuar saindo com ele.
 */
export function EstiloDaMarca({
  cores,
  nonce,
}: {
  readonly cores: CoresDaMarca | null;
  readonly nonce?: string;
}) {
  if (cores === null) return null;

  const regras = CHAVES_DE_MARCA.filter((chave) => corCanonica(cores[chave]))
    .map((chave) => `${variavelDaMarca(chave)}:${cores[chave]}`)
    .join(";");

  if (regras === "") return null;

  return (
    <style
      data-teste="estilo-da-marca"
      {...(nonce === undefined ? {} : { nonce })}
    >{`:root{${regras}}`}</style>
  );
}
