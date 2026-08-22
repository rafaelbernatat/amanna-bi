/**
 * Regra de AST: literal numérico não chega ao formatador nem ao cartão de KPI.
 *
 * T-141, a partir do achado 5 do Anexo D do PRD. O protótipo tem quatorze KPIs
 * escritos à mão que não reagem a filtro nenhum — cobertura da pesquisa `74%`,
 * concentração top 10 `54,3%`, inadimplência `4,1%`. Enquanto o número puder
 * ser digitado no componente, RF-07 é uma promessa, não uma garantia.
 *
 * A busca por texto não resolve: `74` aparece em `span`, `width`, `fontSize` e
 * em índice de vetor. Só o AST distingue "o número que vai virar o valor
 * exibido" de "o número que é geometria".
 *
 * O que a regra reprova:
 *   1. literal numérico como argumento de uma função de formatação;
 *   2. literal numérico no valor de um campo de KPI (`value`, `delta`, `rodape`).
 *
 * A única saída é a allowlist nomeada — pensada para meta vinda do catálogo,
 * que é número de negócio legítimo declarado em configuração (PRD seção 9.4).
 */

/** @type {import("eslint").Rule.RuleModule} */
const regra = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Proíbe literal numérico em argumento de formatador ou em campo de KPI (T-141, RF-07).",
    },
    schema: [
      {
        type: "object",
        properties: {
          formatadores: { type: "array", items: { type: "string" } },
          camposDeKpi: { type: "array", items: { type: "string" } },
          allowlist: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noFormatador:
        "Literal numérico {{valor}} chega ao formatador '{{alvo}}'. O valor precisa vir de getKpis, getPanel ou getMetric (RF-07, princípio PR-1).",
      noCampoDeKpi:
        "Literal numérico {{valor}} no campo '{{alvo}}' de um KPI. Achado 5 do Anexo D: KPI com valor fixo não reage a filtro nenhum (RF-07).",
    },
  },

  create(context) {
    const opcoes = context.options[0] ?? {};
    const formatadores = new Set(
      opcoes.formatadores ?? ["formatarValor", "formatarMesAno"],
    );
    const camposDeKpi = new Set(
      opcoes.camposDeKpi ?? ["value", "valor", "delta", "rodape", "rodapé"],
    );
    const allowlist = new Set(opcoes.allowlist ?? []);

    /** O nó é um número escrito à mão, inclusive negativo. */
    function ehLiteralNumerico(no) {
      if (no === null || no === undefined) return false;
      if (no.type === "Literal") return typeof no.value === "number";
      if (
        no.type === "UnaryExpression" &&
        (no.operator === "-" || no.operator === "+")
      ) {
        return ehLiteralNumerico(no.argument);
      }
      return false;
    }

    function textoDo(no) {
      return context.sourceCode.getText(no);
    }

    /**
     * O literal está sob um nome que a allowlist libera?
     *
     * Cobre `const META_DE_TURNOVER = 14` e `{ meta: 14 }` — o número de
     * negócio que vem do catálogo e não da imaginação de quem programou.
     */
    function liberadoPorNome(no) {
      if (allowlist.size === 0) return false;
      let atual = no;
      while (atual !== undefined && atual !== null) {
        if (
          atual.type === "VariableDeclarator" &&
          atual.id.type === "Identifier"
        ) {
          return allowlist.has(atual.id.name);
        }
        if (atual.type === "Property") {
          const chave = atual.key;
          const nome =
            chave.type === "Identifier"
              ? chave.name
              : chave.type === "Literal"
                ? String(chave.value)
                : "";
          if (allowlist.has(nome)) return true;
        }
        atual = atual.parent;
      }
      return false;
    }

    return {
      CallExpression(no) {
        const chamado = no.callee;
        const nome =
          chamado.type === "Identifier"
            ? chamado.name
            : chamado.type === "MemberExpression" &&
                chamado.property.type === "Identifier"
              ? chamado.property.name
              : "";
        if (!formatadores.has(nome)) return;

        for (const argumento of no.arguments) {
          if (!ehLiteralNumerico(argumento)) continue;
          if (liberadoPorNome(argumento)) continue;
          context.report({
            node: argumento,
            messageId: "noFormatador",
            data: { valor: textoDo(argumento), alvo: nome },
          });
        }
      },

      Property(no) {
        const chave = no.key;
        const nome =
          chave.type === "Identifier"
            ? chave.name
            : chave.type === "Literal"
              ? String(chave.value)
              : "";
        if (!camposDeKpi.has(nome)) return;
        if (!ehLiteralNumerico(no.value)) return;
        if (liberadoPorNome(no.value)) return;

        context.report({
          node: no.value,
          messageId: "noCampoDeKpi",
          data: { valor: textoDo(no.value), alvo: nome },
        });
      },
    };
  },
};

/** Plugin local do painel. */
const plugin = {
  rules: { "sem-literal-numerico": regra },
};

export default plugin;
