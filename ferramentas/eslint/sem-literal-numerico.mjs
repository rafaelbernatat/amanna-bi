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
 * ## O literal não precisa estar escrito no argumento
 *
 * A primeira versão só olhava o argumento direto, e por isso deixou passar o
 * caso que apareceu no primeiro cartão de verdade:
 *
 * ```tsx
 * formatarValor(kpi.value ?? 0, kpi.unit)   // o `0` chega, e a tela mostra
 * ```
 *
 * Quando `value` é nulo o número escrito à mão é exatamente o que o formatador
 * recebe — que é o que o aceite chama de "alcançar o módulo de formatação". O
 * mesmo vale para `a || 40` e para `vazio ? 0 : lido`.
 *
 * Então a regra desce por `??`, `||`, `&&` e ternário: são as formas em que o
 * número escrito é **um dos valores que a expressão entrega**. Ela não desce
 * por aritmética (`lido * 100`) nem por comparação (`lido > 0 ? …`): ali o
 * literal é fator de escala ou limiar, não o valor exibido, e reprovar isso
 * empurraria quem programa a escondê-lo numa constante sem sentido.
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

    /**
     * Os literais que este nó pode entregar como valor.
     *
     * Devolve vetor porque `a ?? 0` tem um, `x ? 12 : 40` tem dois, e um
     * ternário aninhado tem mais. Cada um vira um erro próprio: quem lê a
     * saída do lint precisa ver qual número apontar.
     */
    function literaisEntregues(no) {
      if (no === null || no === undefined) return [];
      if (ehLiteralNumerico(no)) return [no];

      // `a ?? 0`, `a || 40`, `a && 12`: o literal é um dos lados.
      if (no.type === "LogicalExpression") {
        return [...literaisEntregues(no.left), ...literaisEntregues(no.right)];
      }

      // `cond ? 0 : lido`: os ramos entregam, o teste não.
      if (no.type === "ConditionalExpression") {
        return [
          ...literaisEntregues(no.consequent),
          ...literaisEntregues(no.alternate),
        ];
      }

      // `(0 as number)`, `valor!`, `0 satisfies number`: o TypeScript embrulha
      // o nó e o literal continua sendo o que chega.
      if (
        no.type === "TSAsExpression" ||
        no.type === "TSNonNullExpression" ||
        no.type === "TSSatisfiesExpression" ||
        no.type === "TSTypeAssertion"
      ) {
        return literaisEntregues(no.expression);
      }

      return [];
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
          for (const literal of literaisEntregues(argumento)) {
            if (liberadoPorNome(literal)) continue;
            context.report({
              node: literal,
              messageId: "noFormatador",
              data: { valor: textoDo(literal), alvo: nome },
            });
          }
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

        for (const literal of literaisEntregues(no.value)) {
          if (liberadoPorNome(literal)) continue;
          context.report({
            node: literal,
            messageId: "noCampoDeKpi",
            data: { valor: textoDo(literal), alvo: nome },
          });
        }
      },
    };
  },
};

/** Plugin local do painel. */
const plugin = {
  rules: { "sem-literal-numerico": regra },
};

export default plugin;
