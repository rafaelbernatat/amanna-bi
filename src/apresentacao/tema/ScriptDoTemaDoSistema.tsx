import {
  DURACAO_DO_TEMA,
  NOME_DO_COOKIE_DO_TEMA_DO_SISTEMA,
} from "@/apresentacao/tema/ativo";
import type { Tema } from "@/apresentacao/tema/tema";

/**
 * Três linhas que contam ao servidor o que o sistema da pessoa pede (T-422).
 *
 * ## O problema que resolve
 *
 * A moldura segue `prefers-color-scheme` por CSS. O gráfico não pode: recebe a
 * cor resolvida no servidor, e o servidor não enxerga a preferência. Numa
 * primeira visita em sistema escuro, a moldura abria escura e os gráficos
 * saíam claros até a pessoa clicar.
 *
 * ## O que faz
 *
 * A cada página, grava num cookie próprio o que `matchMedia` responde. Na
 * página seguinte o servidor lê o cookie e resolve o gráfico na pele certa.
 * Não toca o DOM, não repinta nada, não conta como hidratação: é um registro.
 *
 * ## Por que um cookie separado da escolha
 *
 * O cookie de escolha é o que a pessoa pediu pelo botão, e vence sempre. Este
 * é observação, e é reescrito toda vez — um sistema que muda de pele à noite
 * continua sendo seguido. Ver `ativo.ts`.
 *
 * ## Segurança
 *
 * O script sai com o nonce da requisição, como a folha de `EstiloDoTema`, e
 * a política de `script-src` o admite por isso. Não lê nada da página, não
 * envia nada: escreve um cookie de valor fechado (`claro` ou `escuro`).
 */
export function ScriptDoTemaDoSistema({ nonce }: { readonly nonce?: string }) {
  const escuro: Tema = "escuro";
  const claro: Tema = "claro";
  const codigo =
    "(function(){try{" +
    `var t=matchMedia("(prefers-color-scheme: dark)").matches?"${escuro}":"${claro}";` +
    `document.cookie="${NOME_DO_COOKIE_DO_TEMA_DO_SISTEMA}="+t+";path=/;max-age=${String(DURACAO_DO_TEMA)};samesite=lax"+(location.protocol==="https:"?";secure":"");` +
    "}catch(e){}})();";

  return (
    <script
      data-teste="script-do-tema-do-sistema"
      {...(nonce === undefined ? {} : { nonce })}
      dangerouslySetInnerHTML={{ __html: codigo }}
    />
  );
}
