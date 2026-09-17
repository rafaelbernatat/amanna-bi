/**
 * A origem de um envio é esta mesma instalação?
 *
 * Uma ação de servidor do Next compara a origem com o anfitrião sozinha; uma
 * rota não ganha isso. Toda rota de escrita do produto — aplicar a marca,
 * enviar o formulário manual, perguntar ao chat — precisa da conferência, e
 * por isso ela mora aqui, e não dentro de um dos módulos que a usam.
 *
 * Sem cabeçalho de origem, o envio não é de navegador moderno e não passa:
 * preferimos recusar um caso legítimo raro a aceitar o caso hostil comum.
 *
 * O anfitrião encaminhado prevalece sobre o interno. Atrás de proxy reverso —
 * que é como o produto roda —, o `host` que o servidor enxerga é o de dentro,
 * e comparar contra ele recusaria todo envio legítimo.
 */

export function origemPropria(pedido: Request): boolean {
  const origem = pedido.headers.get("origin");
  if (origem === null) return false;
  const anfitriao =
    pedido.headers.get("x-forwarded-host") ?? pedido.headers.get("host");
  if (anfitriao === null) return false;
  try {
    return new URL(origem).host === anfitriao;
  } catch {
    return false;
  }
}
