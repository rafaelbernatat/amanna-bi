/**
 * A matriz de autorização contra a seção 11 e o Anexo A (T-173).
 *
 * Como em T-107, o Anexo A é lido **do PRD.md**, não copiado para dentro do
 * teste. Um painel que Produto acrescente ao documento sem entrada na matriz
 * reprova aqui — que é a única forma de "todo painel tem regra de acesso" ser
 * uma afirmação verificável em vez de uma intenção.
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ACESSOS,
  acessoAoPainel,
  EXCECOES,
  matrizExpandida,
  moduloDaTela,
  paineisVisiveis,
  podeVerPainel,
  podeVerTela,
} from "@/seguranca/autorizacao";
import { PERFIS, type Perfil } from "@/seguranca/identidade";
import { REGISTRO_DE_PAINEIS } from "@/semantica/paineis";

const RAIZ = process.cwd();

/** Os ids do Anexo A, lidos do documento. */
function idsDoAnexoA(): readonly { id: string; tela: string }[] {
  const prd = readFileSync(resolve(RAIZ, "PRD.md"), "utf8");
  const linhaDeTela = /^\| \*\*.+\*\* \(`([a-z]+\/[a-z]+)`\) \|(.+)\|$/;
  const saida: { id: string; tela: string }[] = [];
  for (const linha of prd.split("\n")) {
    const m = linhaDeTela.exec(linha);
    if (m === null) continue;
    for (const bruto of (m[2] ?? "").split("·")) {
      const i = /^`([\w-]+)`/.exec(bruto.trim());
      if (i !== null) saida.push({ id: i[1] ?? "", tela: m[1] ?? "" });
    }
  }
  return saida;
}

const anexo = idsDoAnexoA();

describe("cobertura", () => {
  it("o Anexo A rendeu os 71 — senão o resto não prova nada", () => {
    expect(anexo.length).toBe(71);
  });

  it("nenhum id do Anexo A fica sem entrada, para nenhum perfil", () => {
    /*
     * A pergunta do aceite: existe painel sem regra?
     *
     * `acessoAoPainel` devolve `'nenhum'` para id desconhecido — que é o padrão
     * seguro, mas seria também o jeito de um painel novo passar despercebido
     * como "ninguém vê". Por isso a conferência é contra o registro: se o id
     * está no Anexo A e não está no registro, resolve para 'nenhum' e reprova.
     */
    const registrados = new Set(REGISTRO_DE_PAINEIS.map((p) => p.id));
    const semEntrada: string[] = [];
    for (const { id } of anexo) {
      if (!registrados.has(id)) {
        semEntrada.push(`${id}: fora do registro`);
        continue;
      }
      for (const perfil of PERFIS) {
        const a = acessoAoPainel(perfil, id);
        if (!(ACESSOS as readonly string[]).includes(a)) {
          semEntrada.push(`${id}/${perfil}: acesso inválido`);
        }
      }
    }
    expect(semEntrada).toEqual([]);
  });

  it("a matriz expandida tem 5 × 71 pares", () => {
    expect(matrizExpandida().length).toBe(PERFIS.length * 71);
  });
});

describe("a tabela de perfis da seção 11", () => {
  /** As contagens do Anexo A, para conferir a aritmética da matriz. */
  const porModulo = (mod: string) =>
    anexo.filter((l) => l.tela.startsWith(`${mod}/`)).length;

  it("o Anexo A rende 44 painéis de RH, 22 financeiros e 5 de integração", () => {
    expect(porModulo("rh")).toBe(44);
    expect(porModulo("fin")).toBe(22);
    expect(porModulo("int")).toBe(5);
  });

  const esperado: readonly [Perfil, number, string][] = [
    ["diretoria", 71, "tudo"],
    ["controller", 27, "Financeiro (22) + Integração (5)"],
    ["rh", 49, "RH (44) + Integração (5)"],
    ["area", 71, "tudo, com recorte fixo à sua área"],
    ["auditor", 71, "tudo, com trilha"],
  ];

  it.each(esperado)("%s vê %i painéis — %s", (perfil, quantos) => {
    expect(paineisVisiveis(perfil).length).toBe(quantos);
  });

  it("controller não vê nenhum painel de RH", () => {
    const vazando = REGISTRO_DE_PAINEIS.filter(
      (p) => p.tela.startsWith("rh/") && podeVerPainel("controller", p.id),
    ).map((p) => p.id);
    expect(vazando).toEqual([]);
  });

  it("rh não vê nenhum painel financeiro", () => {
    const vazando = REGISTRO_DE_PAINEIS.filter(
      (p) => p.tela.startsWith("fin/") && podeVerPainel("rh", p.id),
    ).map((p) => p.id);
    expect(vazando).toEqual([]);
  });

  it("os dois se encontram na Integração, que é o ponto dela", () => {
    const integracao = REGISTRO_DE_PAINEIS.filter((p) =>
      p.tela.startsWith("int/"),
    );
    expect(integracao.length).toBe(5);
    for (const p of integracao) {
      expect(podeVerPainel("controller", p.id)).toBe(true);
      expect(podeVerPainel("rh", p.id)).toBe(true);
    }
  });

  it("só o auditor recebe a trilha, entre quem enxerga o painel", () => {
    // `controller` não enxerga RH, então o acesso dele a `rh-headcount` é
    // 'nenhum' — e não 'leitura'. A primeira versão deste teste supunha que
    // todo perfil via o painel, e caiu por isso.
    for (const perfil of PERFIS) {
      const a = acessoAoPainel(perfil, "rh-headcount");
      if (perfil === "controller") {
        expect(a).toBe("nenhum");
      } else {
        expect(a).toBe(perfil === "auditor" ? "leitura_e_trilha" : "leitura");
      }
    }
  });
});

describe("o padrão é negar", () => {
  it("tela fora dos três módulos não abre para ninguém", () => {
    // Id digitado errado não deve abrir nada. O contrário — cair em "permitido"
    // por não reconhecer o módulo — é como uma rota nova nasce sem proteção.
    for (const perfil of PERFIS) {
      expect(podeVerTela(perfil, "adm/config")).toBe(false);
      expect(podeVerTela(perfil, "")).toBe(false);
      expect(podeVerTela(perfil, "rh")).toBe(false);
    }
  });

  it("painel desconhecido resolve para 'nenhum'", () => {
    expect(acessoAoPainel("diretoria", "painel-que-nao-existe")).toBe("nenhum");
  });

  it("moduloDaTela reconhece os três e recusa o resto", () => {
    expect(moduloDaTela("rh/visao")).toBe("rh");
    expect(moduloDaTela("fin/caixa")).toBe("fin");
    expect(moduloDaTela("int/cruz")).toBe("int");
    expect(moduloDaTela("adm/x")).toBeUndefined();
  });
});

describe("as exceções", () => {
  it("hoje não há nenhuma, e isso é informação", () => {
    // Nenhum painel foge da regra do módulo. Quando o primeiro fugir, chega
    // com motivo escrito e passa por revisão — em vez de aparecer como
    // comportamento diferente que ninguém sabe explicar.
    expect(EXCECOES).toEqual([]);
  });

  it("toda exceção que existir carrega motivo escrito", () => {
    for (const e of EXCECOES) {
      expect(e.motivo.trim().length).toBeGreaterThan(20);
      expect(REGISTRO_DE_PAINEIS.some((p) => p.id === e.painel)).toBe(true);
    }
  });
});

describe("o arquivo versionado", () => {
  const doc = JSON.parse(
    readFileSync(join(RAIZ, "contratos", "autorizacao.json"), "utf8"),
  ) as {
    totais: Record<string, number>;
    excecoes: unknown[];
    matriz: Record<string, Record<string, Record<string, string>>>;
  };

  it("traz os mesmos totais que o código resolve", () => {
    // Se o gerador e o módulo divergirem, a matriz publicada descreve um
    // produto que não é este. A conferência byte a byte roda no CI
    // (`npm run autorizacao:check`); aqui fica a leitura de sentido.
    for (const perfil of PERFIS) {
      expect(doc.totais[perfil]).toBe(paineisVisiveis(perfil).length);
    }
  });

  it("cobre os 5 perfis e as 13 telas", () => {
    expect(Object.keys(doc.matriz).sort()).toEqual([...PERFIS].sort());
    for (const perfil of PERFIS) {
      expect(Object.keys(doc.matriz[perfil] ?? {}).length).toBe(13);
    }
  });
});
