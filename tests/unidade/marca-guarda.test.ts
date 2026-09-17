import { describe, expect, it } from "vitest";

import { criarFonteDeFixtures } from "@/marca/site/fixtures";
import {
  conferirEndereco,
  enderecoPermitido,
  FRASE_DA_RECUSA,
  MOTIVOS_DE_RECUSA,
  pareceEnderecoLiteral,
} from "@/marca/site/guarda";

/**
 * A guarda de endereço (D-MARCA).
 *
 * A URL vem de quem usa: sem esta guarda, "busque o site da minha empresa" é
 * um pedido para o servidor buscar qualquer coisa alcançável de dentro da
 * rede. O módulo é puro, e é por isso que dá para cobrir as vinte formas de
 * escrever o mesmo endereço sem levantar nada.
 *
 * A parte que este arquivo **não** consegue provar sozinho está dita no
 * cabeçalho de `rede.ts`: conferir o nome e conectar pelo nome seria guarda
 * que não guarda, e é por isso que a busca fixa o endereço resolvido.
 */

const ACEITOS = [
  "https://empresa.com.br/",
  "https://www.empresa.com.br",
  "https://empresa.com.br:443/pagina?x=1",
  "empresa.com.br",
] as const;

/** Cada caso nomeia o motivo esperado: recusar pelo motivo errado é defeito. */
const RECUSADOS = [
  ["http://empresa.com.br/", "esquema_nao_aceito"],
  ["ftp://empresa.com.br/", "esquema_nao_aceito"],
  ["file:///etc/passwd", "esquema_nao_aceito"],
  ["javascript:alert(1)", "esquema_nao_aceito"],
  ["data:text/html,x", "esquema_nao_aceito"],
  ["https://usuario:senha@empresa.com.br/", "credencial_na_url"],
  ["https://empresa.com.br:8080/", "porta_nao_aceita"],
  ["https://empresa.com.br:22/", "porta_nao_aceita"],
  ["https://localhost/", "nome_reservado"],
  ["https://painel.localhost/", "nome_reservado"],
  ["https://servidor.local/", "nome_reservado"],
  ["https://api.internal/", "nome_reservado"],
  ["https://metadata.google.internal/", "nome_reservado"],
  ["https://intranet/", "nome_reservado"],
  ["https://127.0.0.1/", "endereco_literal"],
  ["https://10.0.0.1/", "endereco_literal"],
  ["https://169.254.169.254/", "endereco_literal"],
  ["https://[::1]/", "endereco_literal"],
  ["https://[fd00:ec2::254]/", "endereco_literal"],
  // O mesmo laço local, escrito de quatro jeitos que enganam guarda ingênua.
  ["https://2130706433/", "endereco_literal"],
  ["https://0177.0.0.1/", "endereco_literal"],
  ["https://0x7f000001/", "endereco_literal"],
  ["https://127.1/", "endereco_literal"],
] as const;

describe("conferir o endereço informado", () => {
  it.each(ACEITOS)("aceita %s", (bruto) => {
    const conferido = conferirEndereco(bruto);
    expect(conferido.ok, bruto).toBe(true);
  });

  it.each(RECUSADOS)("recusa %s por %s", (bruto, motivo) => {
    const conferido = conferirEndereco(bruto);
    expect(conferido.ok, bruto).toBe(false);
    if (conferido.ok) return;
    expect(conferido.motivo).toBe(motivo);
  });

  it("um domínio digitado a seco vira https", () => {
    const conferido = conferirEndereco("empresa.com.br");
    expect(conferido.ok).toBe(true);
    if (!conferido.ok) return;
    expect(conferido.url.startsWith("https://")).toBe(true);
  });

  it("todo motivo tem frase, e nenhuma conta da rede interna", () => {
    for (const motivo of MOTIVOS_DE_RECUSA) {
      const frase = FRASE_DA_RECUSA[motivo];
      expect(frase.length, motivo).toBeGreaterThan(0);
      expect(frase).not.toMatch(/127\.|10\.0|169\.254|localhost/);
    }
  });
});

describe("reconhecer endereço numérico em qualquer notação", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "2130706433",
    "0x7f000001",
    "0177.0.0.1",
    "127.1",
    "::1",
    "[::ffff:127.0.0.1]",
  ])("%s é literal", (bruto) => {
    expect(pareceEnderecoLiteral(bruto)).toBe(true);
  });

  it.each(["empresa.com.br", "www.empresa.com", "a1.b2.com"])(
    "%s não é literal",
    (bruto) => {
      expect(pareceEnderecoLiteral(bruto)).toBe(false);
    },
  );
});

describe("o endereço resolvido", () => {
  /**
   * As faixas que não são internet pública.
   *
   * Provocar a falha é parte do aceite: tirar uma linha da tabela de faixas
   * deixa o caso correspondente vermelho, e foi assim que cada uma entrou.
   */
  it.each([
    ["127.0.0.1", "endereco_privado"],
    ["0.0.0.0", "endereco_privado"],
    ["10.1.2.3", "endereco_privado"],
    ["172.16.0.1", "endereco_privado"],
    ["172.31.255.255", "endereco_privado"],
    ["192.168.1.1", "endereco_privado"],
    ["100.64.0.1", "endereco_privado"],
    ["198.18.0.1", "endereco_privado"],
    ["224.0.0.1", "endereco_privado"],
    ["255.255.255.255", "endereco_privado"],
    ["169.254.1.1", "endereco_privado"],
    // Nomeados à parte porque é neles que o ataque pensa primeiro.
    ["169.254.169.254", "metadados_de_nuvem"],
    ["169.254.170.2", "metadados_de_nuvem"],
    ["100.100.100.200", "metadados_de_nuvem"],
    ["fd00:ec2::254", "metadados_de_nuvem"],
    ["::1", "endereco_privado"],
    ["fe80::1", "endereco_privado"],
    ["fc00::1", "endereco_privado"],
    ["::ffff:127.0.0.1", "endereco_privado"],
    ["64:ff9b::a9fe:a9fe", "endereco_privado"],
  ] as const)("recusa %s por %s", (ip, motivo) => {
    expect(enderecoPermitido(ip)).toBe(motivo);
  });

  /**
   * Uma guarda que só recusa não prova nada: precisa deixar passar o que é
   * público, senão "recusa tudo" passaria em todos os casos acima.
   */
  it.each(["93.184.216.34", "8.8.8.8", "200.147.67.142", "2606:2800:220:1::"])(
    "deixa passar %s",
    (ip) => {
      expect(enderecoPermitido(ip)).toBeNull();
    },
  );
});

describe("a fonte de arnês obedece à mesma guarda", () => {
  /**
   * A invariante que faz o verde do arnês significar alguma coisa.
   *
   * Trocar para fixtures muda **de onde vêm os bytes**, nunca **qual é a
   * política**. Se a guarda morasse dentro do adaptador de rede, o arnês a
   * contornaria e ninguém a testaria de verdade.
   */
  const fonte = criarFonteDeFixtures();

  it.each(RECUSADOS)(
    "recusa %s com o mesmo motivo, sem buscar",
    async (bruto, motivo) => {
      const lido = await fonte.buscarTexto(bruto, ["text/html"], 1000);
      expect(lido.ok).toBe(false);
      if (lido.ok) return;
      expect(lido.motivo).toBe(motivo);
    },
  );

  it("serve o que a guarda aceita", async () => {
    const lido = await fonte.buscarTexto(
      "https://dreamy.com.br/",
      ["text/html"],
      1024 * 1024,
    );
    expect(lido.ok).toBe(true);
  });

  it("respeita o teto de bytes", async () => {
    const lido = await fonte.buscarTexto(
      "https://dreamy.com.br/",
      ["text/html"],
      10,
    );
    expect(lido.ok).toBe(false);
    if (lido.ok) return;
    expect(lido.motivo).toBe("corpo_grande_demais");
  });
});
