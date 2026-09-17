/**
 * O link da apresentação, para quem vai apresentar (D-CONVITE-apresentacao).
 *
 *   npm run convite -- --sala=demo --horas=4 --url=https://amanna-bi.vercel.app
 *
 * Imprime **uma linha**: a URL. É o que se abre no navegador do apresentador
 * para entrar na sala; de dentro dela, o botão do cabeçalho abre a tela com o
 * QR que a plateia escaneia.
 *
 * ## Por que existe um comando, e não uma tela
 *
 * A primeira sessão da sala tem de vir de fora: quem apresenta também precisa
 * de um convite, e não há como emiti-lo de dentro de uma instalação em que
 * ninguém entrou ainda. O comando lê `CONVITE_SEGREDO` do ambiente de quem o
 * roda — o mesmo segredo do servidor — e assina.
 *
 * O segredo nunca é impresso, nem em erro: o que sai é o nome da variável.
 */

import {
  assinarConvite,
  HORAS_MAXIMAS,
  PARAMETRO_DE_DESTINO,
  PARAMETRO_DO_CONVITE,
  PERFIS_QUE_APRESENTAM,
  salaValida,
  VERSAO_DO_ENVELOPE,
} from "../../src/seguranca/convite.ts";
import { perfilValido } from "../../src/seguranca/identidade.ts";

function argumento(nome: string): string | null {
  const achado = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return achado === undefined ? null : achado.slice(nome.length + 3);
}

function abortar(mensagem: string): never {
  console.error(mensagem);
  process.exit(1);
}

const segredo = process.env["CONVITE_SEGREDO"];
if (segredo === undefined || segredo.trim() === "") {
  abortar(
    "CONVITE_SEGREDO não está no ambiente.\n\n" +
      "É o segredo que assina o convite e o cookie, o mesmo do servidor (H-66).\n" +
      "Exporte-o nesta sessão do terminal antes de gerar o link.",
  );
}

const sala = argumento("sala") ?? "demo";
if (!salaValida(sala)) {
  abortar(
    `--sala='${sala}' fora da forma: minúsculas, dígitos e hífen, até 32 caracteres.`,
  );
}

const perfilBruto = argumento("perfil") ?? "diretoria";
if (!perfilValido(perfilBruto)) {
  abortar(`--perfil='${perfilBruto}' não é um perfil do produto.`);
}
// `perfilValido` é uma guarda de tipo: daqui em diante o tipo é `Perfil`.
const perfil = perfilBruto;
if (!PERFIS_QUE_APRESENTAM.includes(perfil)) {
  console.error(
    `Aviso: o perfil '${perfil}' não abre a tela de apresentação. ` +
      `Quem apresenta usa: ${PERFIS_QUE_APRESENTAM.join(", ")}.`,
  );
}

const horas = Number(argumento("horas") ?? "4");
if (!Number.isFinite(horas) || horas <= 0 || horas > HORAS_MAXIMAS) {
  abortar(`--horas precisa ser um número de 1 a ${String(HORAS_MAXIMAS)}.`);
}

const base = argumento("url") ?? "http://localhost:3000";
let anfitriao: URL;
try {
  anfitriao = new URL(base);
} catch {
  abortar(`--url='${base}' não é uma URL.`);
}

const SEGUNDOS_POR_HORA = 3600;
const expira =
  Math.floor(Date.now() / 1000) + Math.round(horas * SEGUNDOS_POR_HORA);

const token = await assinarConvite(
  { v: VERSAO_DO_ENVELOPE, tipo: "convite", sala, perfil, expira },
  segredo,
);

const destino = new URL("/entrar", anfitriao);
destino.searchParams.set(PARAMETRO_DO_CONVITE, token);
const ir = argumento("ir");
if (ir !== null && ir !== "")
  destino.searchParams.set(PARAMETRO_DE_DESTINO, ir);

console.log(destino.toString());
