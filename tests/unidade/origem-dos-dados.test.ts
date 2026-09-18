import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OrigemDosDados } from "@/apresentacao/shell/OrigemDosDados";

/**
 * A linha sob o breadcrumb que diz de onde os numeros vieram (T-419).
 *
 * Tres estados, e o texto de cada um e o que a pessoa le para responder "isto
 * e o banco ou a demonstracao?" — a pergunta que o selo de frescor nao
 * respondia, porque a fixture se carimba como recem-sincronizada.
 */
describe("A linha de origem dos dados (T-419)", () => {
  it("nomeia a base carregada com a data e a hora da carga", () => {
    const html = renderToStaticMarkup(
      createElement(OrigemDosDados, {
        origem: {
          fonte: "warehouse",
          versao: "2026-09-17T13-32",
          sincronizadoEm: "2026-09-17T10:32:41-03:00",
        },
      }),
    );
    expect(html).toContain("Base Amanna · carga de 17/09/2026 às 10:32");
    expect(html).toContain('data-fonte="warehouse"');
    expect(html).toContain('data-versao="2026-09-17T13-32"');
  });

  it("diz que sao dados de demonstracao nas fixtures, sem data", () => {
    const html = renderToStaticMarkup(
      createElement(OrigemDosDados, {
        origem: {
          fonte: "fixtures",
          versao: null,
          sincronizadoEm: "2026-09-17T10:32:41-03:00",
        },
      }),
    );
    expect(html).toContain("Dados de demonstração");
    expect(html).not.toContain("carga de");
    expect(html).toContain('data-fonte="fixtures"');
    expect(html).toContain('data-versao=""');
  });

  it("diz que a fonte esta indisponivel quando ela nao respondeu", () => {
    const html = renderToStaticMarkup(
      createElement(OrigemDosDados, { origem: null }),
    );
    expect(html).toContain("Fonte indisponível");
    expect(html).toContain('data-fonte="indisponivel"');
  });
});
