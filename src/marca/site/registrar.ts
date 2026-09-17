/**
 * Registra as duas fontes de site.
 *
 * As duas entram aqui, e nenhuma traz dependencia: sao `node:https` e um
 * objeto literal. A separacao que importa nesta feature nao e de peso, e sim
 * de politica — e a politica nao mora em nenhum dos dois adaptadores, mora em
 * `guarda.ts`, que os dois chamam.
 */

import { criarFonteDeFixtures } from "@/marca/site/fixtures";
import { registrarFonteDeSite } from "@/marca/site/fonte";
import { criarFonteDeRede } from "@/marca/site/rede";

registrarFonteDeSite("rede", async () => criarFonteDeRede());
registrarFonteDeSite("fixtures", async () => criarFonteDeFixtures());
