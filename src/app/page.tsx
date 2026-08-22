import { redirect } from "next/navigation";

import { TELA_PADRAO } from "@/apresentacao/navegacao/telas";

/** A raiz abre a primeira tela do primeiro modulo (T-126). */
export default function Raiz() {
  redirect(TELA_PADRAO);
}
