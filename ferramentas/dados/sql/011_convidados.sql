-- Quem entrou pelo QR e se cadastrou (D-CONVIDADO-cadastro, T-424).
--
-- Uma linha por celular: a sala e o dispositivo da sessão de convite são a
-- chave, e nome e e-mail são o que a pessoa informou antes de conversar. A
-- cota de perguntas e o clique no convite da Dreamy ficam na mesma linha,
-- porque são contados no banco — na nuvem há mais de uma instância.
--
-- `nome` e `email` são dado pessoal novo: guardado pela Dreamy para contato,
-- com consentimento escrito no formulário (H-71). A retenção entra com T-324.
--
-- O mesmo DDL vive em `src/convidados/armazens/postgres.ts`, que o aplica na
-- primeira gravação quando esta migração ainda não rodou; um teste compara os
-- dois textos.

CREATE TABLE IF NOT EXISTS amanna.convidado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sala text NOT NULL,
  dispositivo text NOT NULL,
  nome text NOT NULL,
  email text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz NOT NULL,
  perguntas smallint NOT NULL DEFAULT 0,
  interesse_em timestamptz,
  interesse_origem text
    CHECK (interesse_origem IS NULL OR interesse_origem IN ('limite', 'expiracao')),
  cliques_de_interesse smallint NOT NULL DEFAULT 0,
  UNIQUE (sala, dispositivo)
);
CREATE INDEX IF NOT EXISTS convidado_email ON amanna.convidado (email);
ALTER TABLE amanna.convidado ENABLE ROW LEVEL SECURITY;
