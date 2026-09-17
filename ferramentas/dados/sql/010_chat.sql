-- Os incidentes do verificador do chat (T-315, D-CHAT-ferramentas).
--
-- Quando o verificador recusa a redação do modelo, o texto recusado, o
-- envelope e a pergunta ficam aqui — nunca corrigidos em silêncio. `pergunta`
-- é dado do cliente (D-P7): a retenção entra com T-324.

CREATE TABLE IF NOT EXISTS amanna.chat_incidente (
  id bigserial PRIMARY KEY,
  instante timestamptz NOT NULL DEFAULT now(),
  perfil text NOT NULL,
  caminho text NOT NULL,
  pergunta text NOT NULL,
  tela text,
  filtros jsonb NOT NULL,
  metrica text NOT NULL,
  chamadas jsonb NOT NULL,
  numeros_recusados text[] NOT NULL,
  texto_recusado text NOT NULL,
  envelope jsonb NOT NULL,
  modelo text NOT NULL
);

ALTER TABLE amanna.chat_incidente ENABLE ROW LEVEL SECURITY;
