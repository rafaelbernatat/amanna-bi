/**
 * Provas em tempo de compilação para identidade e escopo (T-135).
 *
 * Este arquivo **não roda**. Ele é conferido por `tsc --noEmit`, que é o único
 * lugar onde "isto não deveria compilar" pode ser verificado.
 *
 * O mecanismo é `@ts-expect-error`: a linha seguinte **precisa** ter erro de
 * tipo. Se alguém afrouxar um enum e o erro sumir, o próprio `@ts-expect-error`
 * vira erro ("directive não usada") e o typecheck reprova. É a única forma de
 * um teste negativo não passar por engano.
 *
 * O que se prova aqui não dá para provar em teste de execução: um valor fora do
 * enum nunca chega ao runtime se o compilador o barra antes.
 */

import type { Query } from "@/semantica/contrato";
import type {
  AccessScope,
  ModuloDoProduto,
  Perfil,
  QueryRestrita,
  Session,
} from "@/seguranca/identidade";
import { escopoDaSessao, restringir } from "@/seguranca/identidade";

/* ------------------------------------------------------------------ *
 * Perfil: os cinco da seção 11, e nenhum outro
 * ------------------------------------------------------------------ */

const diretoria: Perfil = "diretoria";
const controller: Perfil = "controller";
const rh: Perfil = "rh";
const area: Perfil = "area";
const auditor: Perfil = "auditor";
void [diretoria, controller, rh, area, auditor];

// @ts-expect-error perfil inventado não é Perfil
const inventado: Perfil = "superusuario";
void inventado;

// @ts-expect-error maiúscula não é o mesmo valor
const caixaErrada: Perfil = "Diretoria";
void caixaErrada;

// @ts-expect-error string genérica não estreita para Perfil
const qualquerTexto: Perfil = String(1);
void qualquerTexto;

/* ------------------------------------------------------------------ *
 * Sessão: entidade e área vêm dos enums de Query
 * ------------------------------------------------------------------ */

const sessaoValida: Session = {
  sujeito: "u-1",
  perfil: "controller",
  entidades: ["consolidado", "unidade-sp"],
  areas: ["financeiro"],
};

const entidadeInvalida: Session = {
  sujeito: "u-2",
  perfil: "diretoria",
  // @ts-expect-error 'Matriz' não é uma das três entidades da seção 6.2
  entidades: ["Matriz"],
  areas: ["financeiro"],
};
void entidadeInvalida;

const areaInvalida: Session = {
  sujeito: "u-3",
  perfil: "rh",
  entidades: ["consolidado"],
  // @ts-expect-error 'Juridico' não é uma das oito áreas da seção 6.2
  areas: ["Juridico"],
};
void areaInvalida;

// @ts-expect-error sessão sem perfil não é sessão
const semPerfil: Session = {
  sujeito: "u-4",
  entidades: ["consolidado"],
  areas: ["rh"],
};
void semPerfil;

/* ------------------------------------------------------------------ *
 * QueryRestrita: só sai de restringir()
 * ------------------------------------------------------------------ */

const consulta: Query = {
  periodo: "12-meses",
  ano: "2026",
  entidade: "consolidado",
  area: "financeiro",
  modalidade: "todas",
};

const escopo: AccessScope = escopoDaSessao(sessaoValida);
const restrita: QueryRestrita = restringir(consulta, escopo);
void restrita;

/**
 * A prova que sustenta a seção 11 inteira.
 *
 * Se uma `Query` crua pudesse ser usada onde se espera `QueryRestrita`, esquecer
 * de aplicar o escopo compilaria — e o adaptador serviria dado de uma entidade
 * que a pessoa não pode ver, sem erro em lugar nenhum.
 */
// @ts-expect-error Query crua não é QueryRestrita: falta passar por restringir()
const semRestricao: QueryRestrita = consulta;
void semRestricao;

// @ts-expect-error nem montada à mão com a marca, que não é exportada
const forjada: QueryRestrita = { ...consulta, restrita: true };
void forjada;

/* ------------------------------------------------------------------ *
 * Módulo
 * ------------------------------------------------------------------ */

const modulos: readonly ModuloDoProduto[] = ["rh", "fin", "int"];
void modulos;

// @ts-expect-error 'admin' não é módulo do produto
const moduloInvalido: ModuloDoProduto = "admin";
void moduloInvalido;
