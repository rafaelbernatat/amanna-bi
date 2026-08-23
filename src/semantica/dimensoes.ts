/**
 * Código canônico e rótulo de exibição de cada valor de dimensão (T-186).
 *
 * O arquivo único que a tarefa pede. Antes dele, o valor de dimensão era as
 * duas coisas ao mesmo tempo — e, como precisava servir de chave, era ASCII sem
 * acento. O resultado seria a barra de filtros mostrando **"Operacoes"** e
 * **"Hibrido"** onde o protótipo mostra "Operações" e "Híbrido", e a seção 6.2
 * do PRD escreve `Híbrido` e `4º trimestre`.
 *
 * A partir daqui são dois campos com dois trabalhos:
 *
 * | | Onde aparece | Como é |
 * |---|---|---|
 * | **código** | URL, chave de cache, catálogo, matriz de autorização, CSV | ASCII, minúsculo, hífen |
 * | **rótulo** | barra de filtros, banner de recorte, notas em prosa | como se lê em português |
 *
 * ## O código é o valor de domínio
 *
 * Não há um terceiro nome. `Area` **é** `"operacoes"` — o tipo carrega o
 * código, e o rótulo se busca aqui. A alternativa (valor, código e rótulo
 * separados) põe duas coisas quase iguais lado a lado, e "quase igual" é onde
 * alguém escolhe a errada.
 *
 * Os códigos são exatamente os apelidos que a URL já usava, então **nenhuma URL
 * muda** com esta tarefa: `?periodo=4-trimestre` continua sendo `?periodo=4-trimestre`.
 * Isso não é sorte — é o motivo de terem sido escolhidos assim.
 *
 * ## Por que o código não é gerado do rótulo em tempo de execução
 *
 * Gerar é tentador e é a origem do problema: um rótulo que muda ("Operações"
 * vira "Operações e Logística") mudaria o código junto, e toda URL
 * compartilhada, toda chave de cache e toda linha de CSV exportada apontariam
 * para lugar nenhum. O código é **estável por contrato**; o rótulo é texto que
 * Produto pode reescrever numa quinta-feira.
 */

/** Um valor de dimensão: o código estável e o texto que a pessoa lê. */
export type ValorDeDimensao<C extends string = string> = {
  /** ASCII, minúsculo, hífen. Estável — não muda quando o rótulo muda. */
  readonly codigo: C;
  /** Como se escreve em português, com acento e maiúscula. */
  readonly rotulo: string;
};

/* ------------------------------------------------------------------ *
 * As cinco dimensões da seção 6.2
 * ------------------------------------------------------------------ */

export const PERIODOS_DIM = [
  { codigo: "12-meses", rotulo: "12 meses" },
  { codigo: "6-meses", rotulo: "6 meses" },
  { codigo: "4-trimestre", rotulo: "4º trimestre" },
  { codigo: "dezembro", rotulo: "Dezembro" },
] as const satisfies readonly ValorDeDimensao[];

export const ENTIDADES_DIM = [
  { codigo: "consolidado", rotulo: "Consolidado" },
  { codigo: "unidade-sp", rotulo: "Unidade SP" },
  { codigo: "demais-unidades", rotulo: "Demais unidades" },
] as const satisfies readonly ValorDeDimensao[];

/**
 * `Todas` mais as sete áreas.
 *
 * Os rótulos acentuados vêm do protótipo, que é a fonte da verdade de tela
 * (EXECUTE, tabela de entradas). "Operações" e "Logística" apareciam sem acento
 * no contrato justamente porque o valor precisava ser chave.
 */
export const AREAS_DIM = [
  { codigo: "todas", rotulo: "Todas" },
  { codigo: "operacoes", rotulo: "Operações" },
  { codigo: "comercial", rotulo: "Comercial" },
  { codigo: "tecnologia", rotulo: "Tecnologia" },
  { codigo: "logistica", rotulo: "Logística" },
  { codigo: "financeiro", rotulo: "Financeiro" },
  { codigo: "marketing", rotulo: "Marketing" },
  { codigo: "rh", rotulo: "RH" },
] as const satisfies readonly ValorDeDimensao[];

export const MODALIDADES_DIM = [
  { codigo: "todas", rotulo: "Todas" },
  { codigo: "presencial", rotulo: "Presencial" },
  { codigo: "hibrido", rotulo: "Híbrido" },
  { codigo: "remoto", rotulo: "Remoto" },
] as const satisfies readonly ValorDeDimensao[];

/** As quatro dimensões de vocabulário fechado, por nome. */
export const DIMENSOES = {
  periodo: PERIODOS_DIM,
  entidade: ENTIDADES_DIM,
  area: AREAS_DIM,
  modalidade: MODALIDADES_DIM,
} as const;

export type NomeDeDimensao = keyof typeof DIMENSOES;

/* ------------------------------------------------------------------ *
 * Os cinco filtros da tabela 6.2
 * ------------------------------------------------------------------ */

/**
 * Os cinco filtros globais, na ordem em que a tabela 6.2 os lista.
 *
 * São quatro dimensões fechadas mais o ano, que é aberto (D-P8) e por isso não
 * aparece em `DIMENSOES`. A ordem é a da tabela, e é a mesma de `PARAMETROS`
 * em `url.ts`: a barra de filtros, a URL e o banner listam os cinco na mesma
 * sequência, e quem lê os três vê a mesma coisa em três lugares.
 */
export const FILTROS = [
  "periodo",
  "ano",
  "entidade",
  "area",
  "modalidade",
] as const;

export type NomeDeFiltro = (typeof FILTROS)[number];

/**
 * O rótulo de cada filtro, como a coluna "Filtro" da tabela 6.2 escreve.
 *
 * Acentuado, porque é texto de tela — o código do filtro é a chave. Um teste
 * lê a tabela do PRD e confere os cinco: se Produto renomear "Área" para
 * "Área de negócio", a suíte avisa em vez de a barra ficar desatualizada.
 */
export const ROTULO_DO_FILTRO: Readonly<Record<NomeDeFiltro, string>> = {
  periodo: "Período",
  ano: "Ano",
  entidade: "Entidade",
  area: "Área",
  modalidade: "Modalidade",
};

/* ------------------------------------------------------------------ *
 * Buscar
 * ------------------------------------------------------------------ */

/**
 * O rótulo de um código.
 *
 * Devolve o próprio código quando não conhece — e isso é decisão, não descuido.
 * O ano é dimensão aberta (D-P8): `rotuloDe("ano", "2027")` precisa devolver
 * "2027" sem que ninguém cadastre 2027 em lugar nenhum. Para as quatro fechadas,
 * o teste garante que todo valor tem rótulo, então o caminho de fallback não é
 * alcançável por elas.
 */
export function rotuloDe(
  dimensao: NomeDeDimensao | "ano",
  codigo: string,
): string {
  if (dimensao === "ano") return codigo;
  const achado = DIMENSOES[dimensao].find((v) => v.codigo === codigo);
  return achado?.rotulo ?? codigo;
}

/** O código de um rótulo, ou `undefined`. Usado ao ler entrada de pessoa. */
export function codigoDe(
  dimensao: NomeDeDimensao,
  rotulo: string,
): string | undefined {
  return DIMENSOES[dimensao].find((v) => v.rotulo === rotulo)?.codigo;
}

/** Os códigos de uma dimensão, na ordem da seção 6.2. */
export function codigosDe(dimensao: NomeDeDimensao): readonly string[] {
  return DIMENSOES[dimensao].map((v) => v.codigo);
}

/* ------------------------------------------------------------------ *
 * A forma de um código
 * ------------------------------------------------------------------ */

/**
 * Um código bem formado: ASCII minúsculo, dígitos e hífen.
 *
 * Sem acento, sem espaço, sem maiúscula, sem `º`. É a regra que faz o código
 * atravessar URL, nome de arquivo e chave de cache sem escape — e é conferida
 * em teste sobre as quatro dimensões.
 */
export const FORMA_DE_CODIGO = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function codigoBemFormado(codigo: string): boolean {
  return FORMA_DE_CODIGO.test(codigo);
}

/**
 * Deriva um código a partir de um texto qualquer.
 *
 * Existe para **propor** o código de um valor novo, não para resolvê-lo em
 * tempo de execução: a tabela acima é a fonte. Ver o cabeçalho — código gerado
 * do rótulo muda quando o rótulo muda, e aí URL compartilhada aponta para nada.
 */
export function derivarCodigo(texto: string): string {
  return (
    texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      // Tudo que não for letra ou dígito vira hífen, e sequências colapsam numa
      // só: cobre o ordinal de "4º trimestre", onde 'º' e o espaço viram um hífen.
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  );
}
