/**
 * Regra de AST: nenhum número solto nos módulos de KPI e painel (T-181).
 *
 * T-141 já proibia literal numérico em argumento de formatador e em campo de
 * KPI. Isso pega o caso direto — `formatarValor(34.2)` — e deixa passar o
 * caminho de duas etapas, que é o que de fato aparece em código:
 *
 * ```ts
 * const idadeMedia = 34.2;        // ninguém reclama
 * formatarValor(idadeMedia, "anos");  // e T-141 não vê literal nenhum
 * ```
 *
 * Esta regra fecha isso invertendo o padrão: nos arquivos configurados, **todo
 * literal numérico é erro**, e o que é legítimo sai pela lista branca — que é
 * nomeada, comentada, e conferida em teste quando cresce.
 *
 * ## Por que lista branca por nome, não por valor
 *
 * Permitir "o número 4" não quer dizer nada: `span: 4` é grade e `valor: 4` é
 * dado. O que distingue não é o número, é **onde ele está**. Por isso a lista
 * branca é de nomes de propriedade e atributo — `span`, `fontSize`, `top` — e
 * de constantes de módulo com nome em maiúsculas, que é a convenção do projeto
 * para limiar declarado.
 *
 * ## O que continua proibido
 *
 * Um número em qualquer outro lugar: dentro de um objeto de dado, numa
 * expressão que vira valor, num campo que o painel exibe. É onde RF-07 mora —
 * "o número exibido vem de getKpis, getPanel ou getMetric", e não de alguém
 * digitando.
 */

/** Nomes cujo valor numérico é geometria, não dado. */
const ESTRUTURAIS_PADRAO = [
  // Grade da seção 5 do PRD
  "span",
  // Caixa e espaçamento
  "width",
  "height",
  "minHeight",
  "maxWidth",
  "top",
  "right",
  "bottom",
  "left",
  "gap",
  "padding",
  "margin",
  "marginTop",
  "marginBottom",
  "borderRadius",
  "radius",
  // Traço e tipografia
  "strokeWidth",
  "fontSize",
  "iconSize",
  "tickMargin",
  "barSize",
  "dy",
  "dx",
  "x",
  "y",
  "cx",
  "cy",
  "r",
  "opacity",
  "flex",
  "zIndex",
  "tabIndex",
];

/** @type {import("eslint").Rule.RuleModule} */
const regra = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Proíbe literal numérico fora da lista branca estrutural, nos módulos de KPI e painel (T-181, RF-07).",
    },
    schema: [
      {
        type: "object",
        properties: {
          estruturais: { type: "array", items: { type: "string" } },
          permiteConstanteNomeada: { type: "boolean" },
          permiteIndice: { type: "boolean" },
          allowlist: {
            type: "array",
            items: {
              type: "object",
              properties: {
                arquivo: { type: "string" },
                valor: { type: "number" },
                motivo: { type: "string" },
              },
              required: ["arquivo", "valor", "motivo"],
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      solto:
        "Número {{valor}} solto. Nos módulos de KPI e painel todo número vem de getKpis, getPanel ou getMetric (RF-07). Se for estrutural, use um nome da lista branca ou declare uma constante MAIÚSCULA com o porquê.",
    },
  },

  create(context) {
    const o = context.options[0] ?? {};
    const estruturais = new Set(o.estruturais ?? ESTRUTURAIS_PADRAO);
    const permiteConstanteNomeada = o.permiteConstanteNomeada ?? true;
    const permiteIndice = o.permiteIndice ?? true;
    const allowlist = o.allowlist ?? [];

    const arquivo = context.filename.replace(/\\/g, "/");

    function dispensadoPelaLista(valor) {
      return allowlist.some(
        (e) => arquivo.endsWith(e.arquivo) && e.valor === valor,
      );
    }

    /**
     * O nome sob o qual o literal está, se houver.
     *
     * Sobe por nós que só embrulham o valor sem mudar o seu papel: sinal
     * (`top: -4`), ternário (`right: aberto ? 12 : 4`) e vetor
     * (`radius={[2, 2, 0, 0]}`). As três apareceram no primeiro uso da regra e
     * eram falso positivo — o número continuava sendo geometria, só não estava
     * encostado no nome.
     */
    const EMBRULHOS = new Set([
      "UnaryExpression",
      "ConditionalExpression",
      "ArrayExpression",
      "TSAsExpression",
    ]);

    function nomeDoPai(no) {
      let atual = no;
      let pai = atual.parent;

      while (pai !== undefined && pai !== null && EMBRULHOS.has(pai.type)) {
        atual = pai;
        pai = atual.parent;
      }
      if (pai === undefined || pai === null) return null;

      // { span: 4 }
      if (pai.type === "Property" && pai.value === atual) {
        return pai.key.name ?? String(pai.key.value ?? "");
      }
      // <XAxis fontSize={11} /> e <Bar radius={[2, 2, 0, 0]} />
      if (pai.type === "JSXExpressionContainer") {
        const avo = pai.parent;
        if (avo?.type === "JSXAttribute") return avo.name?.name ?? null;
      }
      return null;
    }

    /** `const COLUNAS_DA_GRADE = 12` — limiar declarado, com nome. */
    function ehConstanteNomeada(no) {
      let alvo = no;
      while (EMBRULHOS.has(alvo.parent?.type ?? "")) alvo = alvo.parent;
      const pai = alvo.parent;
      if (pai?.type !== "VariableDeclarator" || pai.init !== alvo) return false;
      const nome = pai.id?.name ?? "";
      return /^[A-Z][A-Z0-9_]*$/.test(nome);
    }

    /**
     * `vetor[0]` — índice, não dado.
     *
     * Inclui a aritmética sobre `.length`: `faixas.length - 1` é o índice do
     * último, e o `1` ali é posição, não medida.
     */
    function ehIndice(no) {
      const pai = no.parent;
      if (
        pai?.type === "MemberExpression" &&
        pai.computed &&
        pai.property === no
      ) {
        return true;
      }
      if (pai?.type === "BinaryExpression") {
        const outro = pai.left === no ? pai.right : pai.left;
        return (
          outro?.type === "MemberExpression" &&
          outro.property?.name === "length"
        );
      }
      return false;
    }

    return {
      Literal(no) {
        if (typeof no.value !== "number") return;
        if (dispensadoPelaLista(no.value)) return;
        if (permiteIndice && ehIndice(no)) return;
        if (permiteConstanteNomeada && ehConstanteNomeada(no)) return;

        const nome = nomeDoPai(no);
        if (nome !== null && estruturais.has(nome)) return;

        context.report({
          node: no,
          messageId: "solto",
          data: { valor: String(no.value) },
        });
      },
    };
  },
};

export default regra;
export { ESTRUTURAIS_PADRAO };
