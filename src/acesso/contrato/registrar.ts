/**
 * Registra as regras da suíte de contrato (T-122).
 *
 * Existe pelo mesmo motivo de `src/acesso/registrar.ts`: o arnês não conhece as
 * regras, e as regras não se auto-registram. Um módulo só faz a ligação, e quem
 * roda a suíte o importa — assim a lista do que a suíte verifica cabe numa
 * tela, em vez de estar espalhada por arquivos que se importam em cadeia.
 *
 * As regras 2 a 5 entram aqui com T-159.
 */

import { REGRA_1 } from "@/acesso/contrato/regra-1";
import { registrarRegra, regrasRegistradas } from "@/acesso/contrato/suite";

if (regrasRegistradas().length === 0) registrarRegra(REGRA_1);
