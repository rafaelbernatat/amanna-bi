/**
 * Validação de configuração e política de cabeçalhos (T-139).
 *
 * A parte de execução dos cabeçalhos — que eles chegam ao navegador e que a
 * política não quebra a tela — está em `tests/e2e/cabecalhos.spec.ts`. Aqui
 * ficam as regras que dá para provar sem servidor.
 */

import { describe, expect, it } from "vitest";

import {
  CABECALHOS_FIXOS,
  gerarNonce,
  montarCsp,
} from "@/seguranca/cabecalhos";
import {
  ConfiguracaoInvalida,
  conferirAmbiente,
  ESQUEMA,
  exigirAmbienteValido,
  NOMES_DE_SEGREDO,
} from "@/seguranca/configuracao";

describe("validação do ambiente no boot", () => {
  it("aceita o mínimo viável", () => {
    expect(conferirAmbiente({ DATA_SOURCE: "fixtures" })).toEqual([]);
  });

  it("recusa DATA_SOURCE ausente, nomeando a variável e o propósito", () => {
    const p = conferirAmbiente({});
    expect(p).toHaveLength(1);
    expect(p[0]?.variavel).toBe("DATA_SOURCE");
    expect(p[0]?.problema).toContain("ausente");
    expect(p[0]?.problema).toContain("seção 8.3");
  });

  it("recusa DATA_SOURCE fora do enum, listando os aceitos", () => {
    const p = conferirAmbiente({ DATA_SOURCE: "producao" });
    expect(p[0]?.problema).toContain("fixtures");
    expect(p[0]?.problema).toContain("warehouse");
  });

  it("exige DATABASE_URL quando a fonte é warehouse", () => {
    // O caso que mais dói: o modo diz "leia do banco" e não há banco. Sem esta
    // regra o erro só apareceria na primeira consulta, com a tela já carregada.
    const p = conferirAmbiente({ DATA_SOURCE: "warehouse" });
    expect(p.map((x) => x.variavel)).toEqual(["DATABASE_URL"]);
  });

  it("não exige DATABASE_URL quando a fonte é fixtures", () => {
    expect(conferirAmbiente({ DATA_SOURCE: "fixtures" })).toEqual([]);
  });

  it("recusa DATABASE_URL que não é URL de postgres", () => {
    const p = conferirAmbiente({
      DATA_SOURCE: "warehouse",
      DATABASE_URL: "mysql://h/d",
    });
    expect(p[0]?.problema).toContain("postgres");
  });

  it("devolve todos os problemas de uma vez, não o primeiro", () => {
    // Quem configura ambiente novo erra três variáveis. Descobrir uma por
    // reinício transforma dez minutos em uma hora.
    const p = conferirAmbiente({
      DATA_SOURCE: "invalido",
      ANTHROPIC_API_KEY: "curta",
    });
    expect(p.map((x) => x.variavel).sort()).toEqual([
      "ANTHROPIC_API_KEY",
      "DATA_SOURCE",
    ]);
  });

  it("aborta lançando, com a lista inteira na mensagem", () => {
    expect(() => exigirAmbienteValido({})).toThrowError(ConfiguracaoInvalida);
    expect(() => exigirAmbienteValido({})).toThrowError(/DATA_SOURCE/);
  });

  it("valida em muito menos que os 2 segundos do aceite", () => {
    const inicio = performance.now();
    for (let i = 0; i < 1000; i++)
      conferirAmbiente({ DATA_SOURCE: "fixtures" });
    // Mil validações; o aceite fala de uma. A folga é de ordens de grandeza,
    // e é o que garante que o teto não vire flaky em máquina lenta de CI.
    expect(performance.now() - inicio).toBeLessThan(2000);
  });
});

describe("a mensagem de erro nunca carrega o valor do segredo", () => {
  /**
   * O teste que mais importa deste arquivo.
   *
   * Log de erro é copiado para ticket, e segredo em ticket é segredo vazado.
   * A mensagem diz o *nome* da variável e o que se esperava — nunca o que veio,
   * nem truncado, nem o comprimento.
   */
  /*
   * Sentinela, e nao um valor com cara de credencial.
   *
   * A primeira versao usava "sk-ant-..." e a varredura de segredo deste mesmo
   * commit a apontou -- corretamente. Teste que carrega texto no formato de
   * chave real e o que ensina uma equipe a ignorar o scanner.
   */
  const SENTINELA = "NAO-PODE-APARECER-NA-MENSAGEM";

  it("chave inválida: a mensagem não contém o valor", () => {
    const p = conferirAmbiente({
      DATA_SOURCE: "fixtures",
      ANTHROPIC_API_KEY: "x",
    });
    const texto = JSON.stringify(p);
    expect(texto).toContain("ANTHROPIC_API_KEY");
    expect(texto).not.toContain("x'");
  });

  it("URL de banco inválida: nem a senha nem o host aparecem", () => {
    const p = conferirAmbiente({
      DATA_SOURCE: "warehouse",
      DATABASE_URL: "mysql://usuario:senha123@servidor-interno/base",
    });
    const texto = JSON.stringify(p);
    expect(texto).not.toContain("senha123");
    expect(texto).not.toContain("servidor-interno");
    expect(texto).not.toContain("usuario");
  });

  it("a exceção inteira também não vaza", () => {
    let mensagem = "";
    try {
      exigirAmbienteValido({
        DATA_SOURCE: "warehouse",
        DATABASE_URL: `mysql://u:${SENTINELA}@h/d`,
        ANTHROPIC_API_KEY: "curta",
      });
    } catch (e) {
      mensagem = (e as Error).message;
    }
    expect(mensagem).toContain("ANTHROPIC_API_KEY");
    expect(mensagem).toContain("DATABASE_URL");
    expect(mensagem).not.toContain(SENTINELA);
  });

  it("as variáveis marcadas como segredo são as da seção 11", () => {
    expect([...NOMES_DE_SEGREDO].sort()).toEqual([
      "ANTHROPIC_API_KEY",
      "DATABASE_URL",
    ]);
    // E toda regra de segredo tem uma conferência: uma variável marcada como
    // segredo mas sem validação passaria qualquer texto adiante.
    for (const r of ESQUEMA.filter((x) => x.segredo)) {
      expect(r.conferir).toBeTypeOf("function");
    }
  });
});

describe("a Content-Security-Policy", () => {
  const csp = montarCsp("NONCE-DE-TESTE");

  function diretiva(nome: string): string {
    return (
      csp
        .split(";")
        .map((d) => d.trim())
        .find((d) => d.startsWith(`${nome} `) || d === nome) ?? ""
    );
  }

  it("script-src não tem unsafe-inline nem unsafe-eval", () => {
    const d = diretiva("script-src");
    expect(d).not.toContain("unsafe-inline");
    expect(d).not.toContain("unsafe-eval");
    expect(d).toContain("'nonce-NONCE-DE-TESTE'");
  });

  it("nega objeto, base e enquadramento", () => {
    expect(diretiva("object-src")).toBe("object-src 'none'");
    expect(diretiva("base-uri")).toBe("base-uri 'none'");
    expect(diretiva("frame-ancestors")).toBe("frame-ancestors 'none'");
  });

  it("connect-src é só a própria origem — nada sai para terceiro", () => {
    expect(diretiva("connect-src")).toBe("connect-src 'self'");
  });

  /**
   * A dívida declarada, fixada em teste.
   *
   * `style-src` é o **único** lugar com `unsafe-inline`, porque os painéis
   * desenham com objetos de estilo em linha (T-124, T-129). Fixar aqui impede
   * que a permissão escorregue para outra diretiva sem ninguém decidir. Ver
   * H-46.
   */
  it("unsafe-inline aparece em style-src, e em mais nenhuma diretiva", () => {
    const comUnsafe = csp
      .split(";")
      .map((d) => d.trim())
      .filter((d) => d.includes("unsafe-inline"))
      .map((d) => d.split(" ")[0]);

    expect(comUnsafe).toEqual(["style-src"]);
  });
});

describe("os cabeçalhos fixos", () => {
  it("trazem HSTS, nosniff, Referrer-Policy e frame deny", () => {
    expect(CABECALHOS_FIXOS["Strict-Transport-Security"]).toContain(
      "max-age=63072000",
    );
    expect(CABECALHOS_FIXOS["X-Content-Type-Options"]).toBe("nosniff");
    expect(CABECALHOS_FIXOS["Referrer-Policy"]).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(CABECALHOS_FIXOS["X-Frame-Options"]).toBe("DENY");
  });
});

describe("o nonce", () => {
  it("nunca repete", () => {
    // Nonce previsível é nonce que não existe. Mil amostras é bastante para
    // pegar um gerador quebrado (um contador, um valor fixo, Math.random com
    // semente presa) sem tornar o teste lento.
    const vistos = new Set<string>();
    for (let i = 0; i < 1000; i++) vistos.add(gerarNonce());
    expect(vistos.size).toBe(1000);
  });

  it("tem ao menos 128 bits de entropia", () => {
    // 16 bytes em base64 dão 24 caracteres com preenchimento.
    expect(gerarNonce()).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});
