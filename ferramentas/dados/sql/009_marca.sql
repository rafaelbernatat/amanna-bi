-- A marca da instalação (D-MARCA), no mesmo banco da réplica.
--
-- Uma linha só, com o documento inteiro em jsonb: marca aplicada e proposta
-- pendente vão juntas, numa escrita só, para não haver gravação rasgada. O
-- mesmo DDL vive em src/marca/armazens/postgres.ts, que o aplica na primeira
-- gravação se esta migração ainda não tiver rodado.
--
-- RLS ligada sem política: pela conexão de servidor (dono) tudo funciona; pela
-- Data API do Supabase, nada aparece — e o documento carrega o logo em base64
-- e o sujeito de quem aplicou.

CREATE TABLE IF NOT EXISTS amanna.marca_da_instalacao (
  id smallint PRIMARY KEY CHECK (id = 1),
  documento jsonb NOT NULL,
  atualizada_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE amanna.marca_da_instalacao ENABLE ROW LEVEL SECURITY;
