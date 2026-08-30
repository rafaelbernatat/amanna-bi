/**
 * Regra de AST: a tela não deriva o número que exibe (T-134).
 *
 * Achado 3 do Anexo D do PRD: no protótipo, `fctx()` devolve multiplicadores —
 * `ent` 0,62 para Unidade SP, `hc`, `money`, `rev`, `trein` pela participação da
 * área no total — e a tela **multiplica** o valor por eles antes de mostrar.
 * Filtrar virou escalar. O achado 4 é a consequência: a reconciliação entre KPI
 * e painel *parecia* correta porque os dois escalavam pelo mesmo fator, e não
 * porque somavam o mesmo dado.
 *
 * O adaptador de T-114 já recorta de verdade — escolhe linhas em vez de
 * multiplicar. Esta regra é o que impede o fator de voltar pela camada de cima:
 * enquanto a apresentação puder fazer conta com o valor lido, nada garante que
 * o número na tela é o número que a fonte devolveu.
 *
 * ## O que ela reprova, e por que aqui
 *
 * Um argumento de formatador que contenha aritmética. `formatarValor(v * f)`,
 * `formatarValor(a - b)`, `formatarValor(soma / n)` — em todos, o número
 * exibido nasceu na tela.
 *
 * O formatador é o portão certo porque é o **único** caminho até o texto que a
 * pessoa lê (regra 2 da seção 9.2: a formatação pt-BR acontece só na
 * apresentação, e só por ele). Conta que não chega ao formatador não vira
 * número na tela — vira largura de barra, posição de ponto, altura de degrau.
 * Isso é geometria, é trabalho legítimo da apresentação, e proibir seria
 * proibir desenhar.
 *
 * ## A brecha que T-141 declarou aberta
 *
 * `sem-literal-numerico` diz, no próprio cabeçalho, que **não desce por
 * aritmética**: para ela, `formatarValor(lido * 100)` não tem literal chegando
 * ao formatador, porque o `100` é fator e não o valor exibido. Estava certa no
 * seu escopo — e é exatamente essa a fresta que o achado 3 usa. As duas juntas
 * fecham: T-141 pega o número digitado, esta pega o número calculado.
 *
 * ## Derivação legítima existe, e por isso tem nome
 *
 * Dois números do produto **não vêm** no envelope e são derivados de propósito:
 * a conversão entre passos do funil e a duração de uma faixa da régua de ciclo.
 * Nos dois casos o envelope guarda os operandos e não o resultado — guardar o
 * resultado criaria a segunda fonte que o princípio PR-1 existe para impedir.
 *
 * A liberação é por **nome de função**, não por arquivo: quem deriva precisa de
 * uma função com nome próprio, e o nome entra numa lista com o motivo escrito.
 * Uma terceira derivação não aparece por descuido — aparece num diff, com uma
 * linha dizendo por quê.
 */

/** Operadores que produzem um número novo a partir de outros. */
const ARITMETICOS = new Set(["+", "-", "*", "/", "%", "**"]);

/** @type {import("eslint").Rule.RuleModule} */
const regra = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Proíbe aritmética em argumento de formatador: o número exibido vem da fonte, não de uma conta na tela (T-134, achado 3 do Anexo D, RF-07, princípio PR-1).",
    },
    schema: [
      {
        type: "object",
        properties: {
          formatadores: { type: "array", items: { type: "string" } },
          derivacoes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                funcao: { type: "string" },
                motivo: { type: "string" },
              },
              required: ["funcao", "motivo"],
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      derivado:
        "A expressão '{{expressao}}' faz conta antes de chegar a '{{alvo}}'. O número exibido vem de getKpis, getPanel ou getMetric — a tela não deriva nem escala (achado 3 do Anexo D, RF-07, princípio PR-1). Se a derivação é legítima, dê nome a uma função e declare o motivo na lista de derivações.",
    },
  },

  create(context) {
    const opcoes = context.options[0] ?? {};
    const formatadores = new Set(
      opcoes.formatadores ?? ["formatarValor", "formatarMesAno"],
    );
    const derivacoes = new Set((opcoes.derivacoes ?? []).map((d) => d.funcao));

    /**
     * A primeira conta dentro de uma expressão, se houver.
     *
     * Desce por tudo que **embrulha** um valor sem deixar de entregá-lo:
     * parênteses o parser já resolve, mas `??`, `||`, ternário e as anotações
     * do TypeScript continuam sendo caminhos por onde o resultado de uma conta
     * chega ao formatador. `valor ?? total - outro` esconde uma subtração de
     * quem só olha o nó de cima.
     *
     * **Não** desce por chamada de função: `Math.abs(v)` e `soma(partes)` são
     * o resultado de outra coisa, e ali a fronteira é a função chamada — que,
     * se derivar, precisa estar na lista pelo nome dela.
     */
    function contaEm(no) {
      if (no === null || no === undefined) return null;

      if (no.type === "BinaryExpression" && ARITMETICOS.has(no.operator)) {
        return no;
      }
      if (
        no.type === "UnaryExpression" &&
        (no.operator === "-" || no.operator === "+")
      ) {
        // `-valor` inverte o sinal do que a fonte deu; não cria número novo.
        return contaEm(no.argument);
      }
      if (no.type === "LogicalExpression") {
        return contaEm(no.left) ?? contaEm(no.right);
      }
      if (no.type === "ConditionalExpression") {
        return contaEm(no.consequent) ?? contaEm(no.alternate);
      }
      if (
        no.type === "TSAsExpression" ||
        no.type === "TSNonNullExpression" ||
        no.type === "TSSatisfiesExpression" ||
        no.type === "TSTypeAssertion"
      ) {
        return contaEm(no.expression);
      }
      return null;
    }

    /**
     * O nome da função que envolve este nó, subindo até a primeira nomeada.
     *
     * Função anônima não conta: uma seta dentro de `map` herda o nome de quem a
     * contém, porque é ali que a decisão de derivar foi tomada. Sem isso,
     * bastaria embrulhar a conta num `map` para escapar da regra.
     */
    function funcaoQueEnvolve(no) {
      let atual = no.parent;
      while (atual !== undefined && atual !== null) {
        if (
          atual.type === "FunctionDeclaration" &&
          atual.id?.type === "Identifier"
        ) {
          return atual.id.name;
        }
        if (
          (atual.type === "FunctionExpression" ||
            atual.type === "ArrowFunctionExpression") &&
          atual.parent?.type === "VariableDeclarator" &&
          atual.parent.id?.type === "Identifier"
        ) {
          return atual.parent.id.name;
        }
        atual = atual.parent;
      }
      return null;
    }

    /** O nome chamado, seja `f()` ou `obj.f()`. */
    function nomeChamado(no) {
      const chamado = no.callee;
      if (chamado.type === "Identifier") return chamado.name;
      if (
        chamado.type === "MemberExpression" &&
        chamado.property.type === "Identifier"
      ) {
        return chamado.property.name;
      }
      return "";
    }

    /* ------------------------------------------------------------------ *
     * O embrulho local também é formatador
     *
     * A apresentação não chama `formatarValor` de todo lugar: ela declara um
     * atalho — `function texto(v, u) { return v === null ? "—" : formatarValor(v, u) }`
     * — e chama o atalho. Uma regra que olhasse só o nome configurado deixaria
     * `texto(valor * 0.62, unidade)` passar inteira, e o achado 3 voltaria pela
     * porta de um helper de três linhas.
     *
     * Então quem chama um formatador **vira** formatador, e a propagação
     * repete até estabilizar: um atalho do atalho também conta. É a fronteira
     * seguindo o caminho real do número até o texto, em vez de uma lista de
     * nomes que alguém precisa lembrar de atualizar.
     * ------------------------------------------------------------------ */

    /** Toda chamada do arquivo, para decidir depois de conhecer os atalhos. */
    const chamadas = [];

    /** Nome da função declarada → nomes que ela chama. */
    const chamadasPorFuncao = new Map();

    return {
      CallExpression(no) {
        chamadas.push(no);
        const dono = funcaoQueEnvolve(no);
        if (dono === null) return;
        const lista = chamadasPorFuncao.get(dono) ?? new Set();
        lista.add(nomeChamado(no));
        chamadasPorFuncao.set(dono, lista);
      },

      "Program:exit"() {
        // Propaga "é formatador" até o conjunto parar de crescer.
        const alcanca = new Set(formatadores);
        let cresceu = true;
        while (cresceu) {
          cresceu = false;
          for (const [funcao, chamados] of chamadasPorFuncao) {
            if (alcanca.has(funcao)) continue;
            for (const chamado of chamados) {
              if (!alcanca.has(chamado)) continue;
              alcanca.add(funcao);
              cresceu = true;
              break;
            }
          }
        }

        for (const no of chamadas) {
          const nome = nomeChamado(no);
          if (!alcanca.has(nome)) continue;

          for (const argumento of no.arguments) {
            const conta = contaEm(argumento);
            if (conta === null) continue;
            if (derivacoes.has(funcaoQueEnvolve(conta) ?? "")) continue;

            context.report({
              node: conta,
              messageId: "derivado",
              data: {
                expressao: context.sourceCode.getText(conta),
                alvo: nome,
              },
            });
          }
        }
      },
    };
  },
};

/** Plugin local do painel. */
const plugin = {
  rules: { "sem-derivacao-exibida": regra },
};

export default plugin;
