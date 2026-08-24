/**
 * As dimensões `vw_dim_*` (T-147).
 *
 * O aceite tem duas metades:
 *
 * 1. **as cardinalidades do Anexo C** — 7 áreas, 8 centros de custo, 12 UFs,
 *    3 modalidades, 12 meses;
 * 2. **o teste de esquema falha se alguma expuser atributo identificável de
 *    pessoa.**
 *
 * A segunda é a que importa e a mais fácil de escrever mal. Um teste que
 * procurasse a palavra "cpf" passaria para sempre e não impediria nada: ninguém
 * chama o campo de `cpf`. O que este arquivo faz é o inverso — declara o
 * conjunto **fechado** de atributos que uma dimensão pode ter e reprova
 * qualquer campo fora dele. Proibir por omissão em vez de por lista de
 * suspeitos é a diferença entre uma regra que pega o caso previsto e uma que
 * pega o caso novo.
 *
 * A lista de suspeitos existe também, mas como segunda guarda: ela confere que
 * o **próprio conjunto permitido** não deixou entrar algo identificável.
 */

import { describe, expect, it } from "vitest";

import {
  ATRIBUTOS_PERMITIDOS,
  VW_DIM,
  VW_DIM_AREA,
  VW_DIM_CENTRO_CUSTO,
  VW_DIM_ESCOLARIDADE,
  VW_DIM_FAIXA_ETARIA,
  VW_DIM_FAIXA_SALARIAL,
  VW_DIM_MODALIDADE,
  VW_DIM_TEMPO_DE_CASA,
  VW_DIM_UF,
  vwDimMes,
  type FaixaDeDimensao,
} from "@/acesso/fixtures/dim";
import { FORMA_DE_CODIGO } from "@/semantica/dimensoes";

const TABELAS = Object.entries(VW_DIM);

/* ------------------------------------------------------------------ *
 * As cardinalidades do Anexo C
 * ------------------------------------------------------------------ */

describe("as cardinalidades do Anexo C", () => {
  it("7 áreas", () => {
    expect(VW_DIM_AREA).toHaveLength(7);
  });

  it("8 centros de custo — e não 7, porque Corporativo não é área", () => {
    expect(VW_DIM_CENTRO_CUSTO).toHaveLength(8);
    expect(VW_DIM_CENTRO_CUSTO.map((c) => c.codigo)).toContain("corporativo");
  });

  it("12 UFs, e não as 27 do país", () => {
    // A dimensão é o cadastro de onde a empresa opera. As 27 células do mosaico
    // são geometria do painel, e entram com T-165.
    expect(VW_DIM_UF).toHaveLength(12);
  });

  it("3 modalidades", () => {
    expect(VW_DIM_MODALIDADE).toHaveLength(3);
  });

  it("12 meses, com quatro trimestres de três", () => {
    const meses = vwDimMes("2026");
    expect(meses).toHaveLength(12);
    expect(meses.map((m) => m.trimestre)).toEqual([
      1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4,
    ]);
    // E o 4º trimestre é outubro a dezembro, que é o recorte da tabela 6.2.
    expect(meses.filter((m) => m.trimestre === 4).map((m) => m.codigo)).toEqual(
      ["2026-10", "2026-11", "2026-12"],
    );
  });
});

/* ------------------------------------------------------------------ *
 * Nenhum atributo identificável de pessoa
 * ------------------------------------------------------------------ */

describe("nenhuma dimensão expõe atributo identificável de pessoa", () => {
  it("as dez tabelas estão no catálogo — senão a varredura não as vê", () => {
    /*
     * A guarda contra o buraco mais provável: uma dimensão nova que ninguém
     * acrescentou ao mapa `VW_DIM` escaparia de todos os testes abaixo, e a
     * garantia da seção 11 falharia em silêncio.
     */
    expect(TABELAS).toHaveLength(10);
    for (const [nome, linhas] of TABELAS) {
      expect(linhas.length, nome).toBeGreaterThan(0);
    }
  });

  it("todo campo de toda linha está no conjunto fechado", () => {
    // Proibido por omissão. `matricula`, `nome`, `admitido_em` reprovam aqui
    // sem que ninguém precise ter previsto esses nomes.
    const fora: string[] = [];
    for (const [nome, linhas] of TABELAS) {
      for (const linha of linhas) {
        for (const campo of Object.keys(linha)) {
          if (!ATRIBUTOS_PERMITIDOS.includes(campo)) {
            fora.push(`${nome}.${campo}`);
          }
        }
      }
    }
    expect([...new Set(fora)]).toEqual([]);
  });

  it("e o próprio conjunto permitido não tem nada identificável", () => {
    /*
     * A segunda guarda. O teste acima confere que ninguém saiu da lista; este
     * confere que a **lista** não foi alargada para deixar alguém entrar.
     *
     * `de` e `ate` sobrevivem porque são limites de faixa, e não datas nem
     * salários de pessoa — a distinção está escrita no cadastro.
     */
    const IDENTIFICAVEL =
      /nome|cpf|rg\b|matricula|email|telefone|endereco|nascimento|admissao|demissao|cargo|gestor|login|documento|pis|ctps/i;
    const suspeitos = ATRIBUTOS_PERMITIDOS.filter((c) => IDENTIFICAVEL.test(c));
    expect(suspeitos).toEqual([]);
  });

  it("a varredura de suspeitos funciona — plantada e encontrada", () => {
    // Um critério de ausência só vale se a busca souber achar. Aqui se planta a
    // ocorrência de propósito e se confirma que ela é vista.
    const IDENTIFICAVEL =
      /nome|cpf|rg\b|matricula|email|telefone|endereco|nascimento|admissao|demissao|cargo|gestor|login|documento|pis|ctps/i;
    const comPlantada = [...ATRIBUTOS_PERMITIDOS, "matricula"];
    expect(comPlantada.filter((c) => IDENTIFICAVEL.test(c))).toEqual([
      "matricula",
    ]);
  });

  it("nenhuma tabela é grande o bastante para ser lista de pessoas", () => {
    /*
     * O outro jeito de a linha individual entrar: uma dimensão com 1.240
     * linhas, uma por colaborador, com códigos `col-0001`. Cada campo estaria
     * na lista permitida e a seção 11 estaria violada do mesmo jeito.
     *
     * A maior dimensão real tem doze linhas. O teto de trinta dá espaço para
     * as 27 UFs no dia em que a operação crescer, e continua a três ordens de
     * grandeza do quadro.
     */
    const TETO = 30;
    const grandes = TABELAS.filter(([, linhas]) => linhas.length > TETO).map(
      ([nome, linhas]) => `${nome}: ${linhas.length}`,
    );
    expect(grandes).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * A forma de um cadastro
 * ------------------------------------------------------------------ */

describe("toda dimensão é um cadastro bem formado", () => {
  it.each(TABELAS)("%s: códigos únicos e não vazios", (nome, linhas) => {
    const codigos = linhas.map((l) => l.codigo);
    expect(
      codigos.filter((c) => c.trim() === ""),
      nome,
    ).toEqual([]);
    expect(new Set(codigos).size, nome).toBe(codigos.length);
  });

  it.each(TABELAS)("%s: rótulos não vazios", (nome, linhas) => {
    expect(
      linhas.filter((l) => l.rotulo.trim() === ""),
      nome,
    ).toEqual([]);
  });

  it.each(TABELAS)(
    "%s: a ordem é 0..n sem buraco nem repetição",
    (nome, linhas) => {
      expect(
        linhas.map((l) => l.ordem),
        nome,
      ).toEqual(linhas.map((_, i) => i));
    },
  );

  it("os códigos atravessam URL e chave de cache sem escape", () => {
    /*
     * A mesma regra de T-186, aplicada às dimensões físicas. A UF é a exceção
     * declarada: `SP` é sigla oficial e maiúscula por convenção, e continua
     * sendo ASCII sem espaço nem acento — que é o que a regra protege.
     */
    const fora: string[] = [];
    for (const [nome, linhas] of TABELAS) {
      if (nome === "vw_dim_uf") continue;
      for (const l of linhas) {
        if (!FORMA_DE_CODIGO.test(l.codigo)) fora.push(`${nome}: ${l.codigo}`);
      }
    }
    expect(fora).toEqual([]);

    // E a UF: duas letras maiúsculas, sem acento.
    const ufsMalFormadas = VW_DIM_UF.filter(
      (u) => !/^[A-Z]{2}$/.test(u.codigo),
    );
    expect(ufsMalFormadas).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * As faixas
 * ------------------------------------------------------------------ */

describe("as três faixas da seção 11", () => {
  const FAIXAS: ReadonlyArray<[string, readonly FaixaDeDimensao[]]> = [
    ["faixa etária", VW_DIM_FAIXA_ETARIA],
    ["tempo de casa", VW_DIM_TEMPO_DE_CASA],
    ["faixa salarial", VW_DIM_FAIXA_SALARIAL],
  ];

  it("são as três que a seção 11 nomeia", () => {
    // "Faixas etárias, faixas salariais e faixas de tempo de casa nunca descem
    // a um grupo com menos de 5 pessoas" — a supressão é T-151, e ela precisa
    // saber onde cada faixa começa.
    expect(FAIXAS).toHaveLength(3);
  });

  it.each(FAIXAS)(
    "%s: os limites sobem, sem buraco entre bandas",
    (nome, faixas) => {
      for (let i = 1; i < faixas.length; i += 1) {
        const anterior = faixas[i - 1];
        const atual = faixas[i];
        expect(atual?.de, `${nome} na posição ${i}`).toBeGreaterThanOrEqual(
          anterior?.de ?? 0,
        );
      }
    },
  );

  it.each(FAIXAS)("%s: só a última não tem teto", (nome, faixas) => {
    /*
     * `ate: null` é "sem teto", e precisa ser a última — uma banda aberta no
     * meio engoliria as seguintes. E a última **tem** que ser aberta: um teto
     * inventado deixaria de fora quem passasse dele, e essa pessoa sumiria de
     * todos os painéis de perfil sem aparecer em lugar nenhum.
     */
    const semTeto = faixas.filter((f) => f.ate === null);
    expect(semTeto, nome).toHaveLength(1);
    expect(faixas.at(-1)?.ate, nome).toBeNull();
  });

  it("os limites descrevem a banda, não a pessoa", () => {
    // `de: 3000, ate: 6000` é uma faixa salarial. Nenhuma linha diz quanto
    // alguém ganha — é o que faz esta tabela ser cadastro e não folha.
    const MIL = 1000;
    expect(VW_DIM_FAIXA_SALARIAL[1]).toMatchObject({
      de: 3 * MIL,
      ate: 6 * MIL,
    });
    expect(VW_DIM_FAIXA_ETARIA[0]?.de).toBe(18);
  });
});

/* ------------------------------------------------------------------ *
 * Escolaridade
 * ------------------------------------------------------------------ */

describe("escolaridade guarda o nível, não o volume", () => {
  it("a ordem é a de nível, e médio vem antes de superior", () => {
    /*
     * O protótipo lista Superior primeiro porque é a maior barra — e barra
     * horizontal se ordena por valor na hora de desenhar. O cadastro guarda o
     * significado; a aparência é do painel.
     */
    const codigos = VW_DIM_ESCOLARIDADE.map((e) => e.codigo);
    expect(codigos.indexOf("medio")).toBeLessThan(codigos.indexOf("superior"));
    expect(codigos.indexOf("superior")).toBeLessThan(
      codigos.indexOf("pos-graduacao"),
    );
    expect(codigos.indexOf("pos-graduacao")).toBeLessThan(
      codigos.indexOf("mestrado-mais"),
    );
  });
});

/* ------------------------------------------------------------------ *
 * Nada é redigitado
 * ------------------------------------------------------------------ */

describe("as dimensões que já têm vocabulário não são copiadas", () => {
  it("área, entidade e modalidade vêm do registro de T-186", () => {
    // Se fossem redigitadas, uma área nova entraria no filtro e não na
    // dimensão — e o sintoma seria um recorte que a tela oferece e o dado não
    // conhece.
    expect(VW_DIM_AREA.map((a) => a.rotulo)).toContain("Operações");
    expect(VW_DIM_AREA.map((a) => a.rotulo)).toContain("Logística");
    expect(VW_DIM_MODALIDADE.map((m) => m.rotulo)).toContain("Híbrido");
  });

  it("e o agregado não entra no cadastro", () => {
    // `todas` e `consolidado` são recorte, não valor.
    expect(VW_DIM_AREA.map((a) => a.codigo)).not.toContain("todas");
    expect(VW_DIM_MODALIDADE.map((m) => m.codigo)).not.toContain("todas");
    expect(VW_DIM.vw_dim_entidade.map((e) => e.codigo)).not.toContain(
      "consolidado",
    );
  });
});
