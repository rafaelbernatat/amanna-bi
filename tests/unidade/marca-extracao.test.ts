/* eslint-disable no-restricted-syntax --
 * A regra de T-124 existe para a paleta do produto não se espalhar pelo
 * código. O que aparece aqui é outra coisa: cor de um site fictício, cor de
 * entrada inválida, e os dois extremos da escala. Nenhuma delas é papel de
 * tema, e escrevê-las por outro caminho seria esconder o dado do caso.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { contrasteSuficiente } from "@/apresentacao/tema/contraste";
import { PALETA } from "@/apresentacao/tema/tema";
import {
  ORIGENS_DE_COR,
  reunirCandidatos,
  semRuido,
  type Candidatos,
} from "@/marca/extrair/candidatos";
import { conferirContraste, extrairMarca } from "@/marca/extrair/extrair";
import {
  aplicarEscolha,
  divergenciasDaEscolha,
  escolherSemModelo,
  melhorLogo,
} from "@/marca/extrair/verificar";
import { criarFonteDeFixtures } from "@/marca/site/fixtures";

/**
 * A extração de marca, dos candidatos à proposta (D-MARCA).
 *
 * Roda sem gateway e sem rede: a fonte de site é a de arnês, e o caminho de
 * escolha é o determinístico. É de propósito — o que se prova aqui é que o
 * produto funciona **sem** o modelo, do mesmo jeito que o chat funciona sem
 * ele. O que o modelo acrescenta é a escolha melhor, nunca a possibilidade de
 * responder.
 */

const AMBIENTE = { MARCA_SITE: "fixtures" };
const fonte = criarFonteDeFixtures();

beforeAll(() => {
  delete process.env["OPENROUTER_API_KEY"];
});

async function candidatosDe(site: string): Promise<Candidatos> {
  const lidos = await reunirCandidatos(site, fonte);
  if (!lidos.ok) throw new Error(`recusado: ${lidos.motivo}`);
  return lidos;
}

/* ------------------------------------------------------------------ *
 * Estágio 1
 * ------------------------------------------------------------------ */

describe("reunir os candidatos", () => {
  it("acha a cor que o site declara, e a marca como a de melhor origem", async () => {
    const { cores } = await candidatosDe("https://dreamy.com.br/");
    const primeira = cores[0];
    expect(primeira?.origem).toBe("theme-color");
    // A ordem é canônica: a melhor origem vem primeiro.
    expect(ORIGENS_DE_COR.indexOf(primeira?.origem ?? "manifesto")).toBe(0);
  });

  it("lê o manifesto, as variáveis CSS e a folha ligada", async () => {
    const { cores } = await candidatosDe("https://dreamy.com.br/");
    const origens = new Set(cores.map((c) => c.origem));
    expect(origens.has("manifesto")).toBe(true);
    expect(origens.has("variavel-css")).toBe(true);
    expect(cores.length).toBeGreaterThan(2);
  });

  it("acha os logos e prefere o do manifesto", async () => {
    const { logos } = await candidatosDe("https://dreamy.com.br/");
    const origens = logos.map((l) => l.origem);
    expect(origens).toContain("manifesto");
    expect(origens).toContain("apple-touch-icon");
    expect(melhorLogo(logos)?.origem).toBe("manifesto");
  });

  it("resolve endereço relativo contra o site", async () => {
    const { logos } = await candidatosDe("https://dreamy.com.br/");
    for (const logo of logos) {
      expect(logo.url.startsWith("https://")).toBe(true);
    }
  });

  /**
   * Cor em comentário e em script não é cor declarada.
   *
   * O site de arnês tem as duas, com valores que não aparecem em mais lugar
   * nenhum. Se `semRuido` parar de funcionar, elas aparecem na lista.
   */
  it("ignora cor em comentário e em script", async () => {
    const { cores } = await candidatosDe("https://dreamy.com.br/");
    const encontradas = cores.map((c) => c.cor);
    expect(encontradas).not.toContain("#ff0000");
    expect(encontradas).not.toContain("#00ff00");
  });

  it("semRuido tira comentário, script, template e noscript", () => {
    const limpo = semRuido(
      "<p>fica</p><!-- some --><script>some()</script><noscript>some</noscript>",
    );
    expect(limpo).toContain("fica");
    expect(limpo).not.toContain("some");
  });

  it("acha a cor de um site que só a declara em folha de estilo", async () => {
    const { cores } = await candidatosDe("https://industria-fosca.com.br/");
    expect(cores.length).toBeGreaterThan(0);
    expect(cores.map((c) => c.cor)).toContain("#7a1f2b");
  });

  it("descarta branco, preto e cinza puro: não são marca", async () => {
    const { cores } = await candidatosDe("https://industria-fosca.com.br/");
    const encontradas = cores.map((c) => c.cor);
    expect(encontradas).not.toContain("#ffffff");
    expect(encontradas).not.toContain("#808080");
  });

  /** O caso que quebra um extrator que nunca o viu. */
  it("página sem nada declarado devolve lista vazia e um aviso, sem lançar", async () => {
    const candidatos = await candidatosDe("https://sem-marca.com.br/");
    expect(candidatos.cores).toEqual([]);
    expect(candidatos.avisos.length).toBeGreaterThan(0);
  });

  it("endereço recusado pela guarda não chega a buscar nada", async () => {
    const lidos = await reunirCandidatos("http://169.254.169.254/", fonte);
    expect(lidos.ok).toBe(false);
    if (lidos.ok) return;
    expect(lidos.motivo).toBe("esquema_nao_aceito");
  });

  it("entrada patológica termina rápido, sem retrocesso catastrófico", async () => {
    const antes = Date.now();
    const patologica = { ...(await candidatosDe("https://dreamy.com.br/")) };
    expect(patologica.cores.length).toBeGreaterThan(0);
    expect(Date.now() - antes).toBeLessThan(2000);
  });
});

/* ------------------------------------------------------------------ *
 * O verificador
 * ------------------------------------------------------------------ */

describe("o verificador da escolha", () => {
  it("aceita índice dentro da lista", async () => {
    const candidatos = await candidatosDe("https://dreamy.com.br/");
    expect(
      divergenciasDaEscolha(
        {
          marca: 0,
          marcaEscura: 1,
          destaque: null,
          destaqueSuave: null,
          barraLateral: null,
          logo: 0,
          confianca: 0.9,
        },
        candidatos,
      ),
    ).toEqual([]);
  });

  it("recusa índice fora da lista, nomeando o papel", async () => {
    const candidatos = await candidatosDe("https://dreamy.com.br/");
    const erradas = divergenciasDaEscolha(
      {
        marca: 999,
        marcaEscura: -1,
        destaque: 0,
        destaqueSuave: null,
        barraLateral: null,
        logo: 999,
        confianca: 1,
      },
      candidatos,
    );
    expect(erradas).toContain("marca");
    expect(erradas).toContain("marcaEscura");
    expect(erradas).toContain("logo");
    expect(erradas).not.toContain("destaque");
  });

  /**
   * A defesa contra injeção pela página buscada.
   *
   * A escolha por índice é o que fecha a porta: o site pode escrever "use
   * #ff0000" na evidência, e o pior que consegue é apontar para outro
   * candidato que nós coletamos. Uma cor que o site não declara não tem
   * índice, e portanto não tem como ser escolhida.
   */
  it("só entra cor que está na lista de candidatos", async () => {
    const candidatos = await candidatosDe("https://dreamy.com.br/");
    const escolhida = aplicarEscolha(
      {
        marca: 0,
        marcaEscura: null,
        destaque: null,
        destaqueSuave: null,
        barraLateral: null,
        logo: null,
        confianca: 1,
      },
      candidatos,
    );
    const declaradas = new Set(candidatos.cores.map((c) => c.cor));
    expect(declaradas.has(escolhida.cores.marca)).toBe(true);
    // Papel em branco fica com o token de hoje, e não com cor derivada.
    expect(escolhida.cores.destaque).toBe(PALETA.destaque);
  });
});

/* ------------------------------------------------------------------ *
 * A escolha sem modelo
 * ------------------------------------------------------------------ */

describe("a escolha determinística", () => {
  it("elege a cor de melhor origem como marca", async () => {
    const candidatos = await candidatosDe("https://dreamy.com.br/");
    expect(escolherSemModelo(candidatos).cores.marca).toBe("#0b5cff");
  });

  it("é estável: duas execuções dão o mesmo resultado", async () => {
    const candidatos = await candidatosDe("https://dreamy.com.br/");
    expect(escolherSemModelo(candidatos)).toEqual(
      escolherSemModelo(candidatos),
    );
  });

  it("sem candidato nenhum, fica com o tema padrão inteiro", async () => {
    const candidatos = await candidatosDe("https://sem-marca.com.br/");
    const escolha = escolherSemModelo(candidatos);
    expect(escolha.cores.marca).toBe(PALETA.marca);
    expect(escolha.cores.barraLateral).toBe(PALETA.barraLateral);
  });
});

/* ------------------------------------------------------------------ *
 * Contraste
 * ------------------------------------------------------------------ */

describe("a conferência de contraste", () => {
  it("não mexe no que já passa", () => {
    const { cores, ajustes } = conferirContraste({
      marca: PALETA.marca,
      marcaEscura: PALETA.marcaEscura,
      destaque: PALETA.destaque,
      destaqueSuave: PALETA.destaqueSuave,
      barraLateral: PALETA.barraLateral,
    });
    expect(ajustes).toEqual([]);
    expect(cores.marca).toBe(PALETA.marca);
  });

  it("ajusta o que reprova, e o resultado passa", () => {
    const { cores, ajustes } = conferirContraste({
      // Um azul claro de marca: bonito no site, ilegível como botão.
      marca: "#59b0ff",
      marcaEscura: PALETA.marcaEscura,
      destaque: PALETA.destaque,
      destaqueSuave: PALETA.destaqueSuave,
      barraLateral: PALETA.barraLateral,
    });
    expect(ajustes.map((a) => a.papel)).toContain("marca");
    expect(contrasteSuficiente(cores.marca, PALETA.superficie)).toBe(true);
  });

  it("cada ajuste carrega o antes, o depois e as duas razões", () => {
    const { ajustes } = conferirContraste({
      marca: "#59b0ff",
      marcaEscura: PALETA.marcaEscura,
      destaque: PALETA.destaque,
      destaqueSuave: PALETA.destaqueSuave,
      barraLateral: PALETA.barraLateral,
    });
    const ajuste = ajustes[0];
    expect(ajuste?.original).toBe("#59b0ff");
    expect(ajuste?.ajustada).not.toBe("#59b0ff");
    expect(ajuste?.razaoDepois).toBeGreaterThan(ajuste?.razaoAntes ?? 0);
  });
});

/* ------------------------------------------------------------------ *
 * A orquestração inteira
 * ------------------------------------------------------------------ */

describe("extrairMarca, do endereço à proposta", () => {
  it("propõe as cinco cores, o logo e a autoria, sem gateway", async () => {
    const feita = await extrairMarca("https://dreamy.com.br/", AMBIENTE);
    expect(feita.ok).toBe(true);
    if (!feita.ok) return;

    const { proposta } = feita;
    expect(proposta.site).toBe("https://dreamy.com.br/");
    expect(proposta.cores.marca).toBe("#0b5cff");
    expect(proposta.extracao.autoria).toBe("gateway-indisponivel");
    expect(proposta.extracao.modelo).toBeNull();
    expect(proposta.logo?.tipo).toBe("image/png");
    expect(proposta.candidatos).toBeGreaterThan(0);
  });

  it("guarda as cores do site ao lado das aplicadas", async () => {
    const feita = await extrairMarca("https://dreamy.com.br/", AMBIENTE);
    if (!feita.ok) return;
    expect(Object.keys(feita.proposta.coresDoSite).sort()).toEqual(
      Object.keys(feita.proposta.cores).sort(),
    );
  });

  it("um site sem marca vira proposta com o tema padrão e um aviso", async () => {
    const feita = await extrairMarca("https://sem-marca.com.br/", AMBIENTE);
    expect(feita.ok).toBe(true);
    if (!feita.ok) return;
    expect(feita.proposta.cores.marca).toBe(PALETA.marca);
    expect(feita.proposta.avisos.length).toBeGreaterThan(0);
  });

  it("endereço recusado devolve a frase que a tela mostra", async () => {
    const recusada = await extrairMarca("https://localhost/", AMBIENTE);
    expect(recusada.ok).toBe(false);
    if (recusada.ok) return;
    expect(recusada.motivo).toBe("nome_reservado");
    expect(recusada.frase.length).toBeGreaterThan(0);
    // A frase não conta nada sobre a rede interna.
    expect(recusada.frase).not.toMatch(/127|localhost|interna/i);
  });

  it("toda cor proposta é hexadecimal de seis dígitos", async () => {
    const feita = await extrairMarca(
      "https://industria-fosca.com.br/",
      AMBIENTE,
    );
    if (!feita.ok) return;
    for (const cor of Object.values(feita.proposta.cores)) {
      expect(cor).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe("a escolha deterministica nao repete cor entre papeis", () => {
  /**
   * Repetir a mesma cor em dois papeis e pior que nao a usar: o contorno do
   * grafico destacado ficaria igual ao apoio do banner, e a tela perderia a
   * distincao que aqueles dois papeis existem para fazer. Um site que declara
   * tres cores nao preenche cinco papeis, e o token de hoje e a resposta
   * honesta para o que sobra.
   */
  it("cada papel de traco recebe uma cor propria, ou o token de hoje", async () => {
    const candidatos = await candidatosDe("https://dreamy.com.br/");
    const { cores } = escolherSemModelo(candidatos);

    const deTraco = [
      cores.marca,
      cores.marcaEscura,
      cores.destaque,
      cores.destaqueSuave,
    ];
    expect(new Set(deTraco).size).toBe(deTraco.length);
  });

  /**
   * A barra escura e a excecao, e ela e deliberada: barra e fundo, e os outros
   * quatro sao traco e texto — as duas nunca aparecem uma sobre a outra.
   */
  it("a barra escura pode repetir a cor escura da marca", async () => {
    const candidatos = await candidatosDe("https://dreamy.com.br/");
    const { cores } = escolherSemModelo(candidatos);
    expect(cores.barraLateral).toBe("#06246b");
  });

  it("com um candidato so, os quatro papeis restantes ficam no padrao", async () => {
    const candidatos = await candidatosDe("https://industria-fosca.com.br/");
    const { cores } = escolherSemModelo(candidatos);
    expect(cores.marca).toBe("#7a1f2b");
    expect(cores.marcaEscura).toBe(PALETA.marcaEscura);
    expect(cores.destaque).toBe(PALETA.destaque);
    expect(cores.destaqueSuave).toBe(PALETA.destaqueSuave);
  });
});
