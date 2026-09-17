-- O registro de cada carga: de onde `getMeta` tira o frescor.
--
-- Uma linha por tabela ou view carregada, por versão da rodada. `as_of` é o
-- último fechamento que o dado carrega; `concluida_em` é o instante do sync
-- bem-sucedido. Rodada que falha no meio não registra versão — a réplica
-- anterior continua valendo (RF-22).

CREATE TABLE IF NOT EXISTS amanna.carga (
  versao text NOT NULL,
  alvo text NOT NULL,
  linhas bigint NOT NULL,
  iniciada_em timestamptz NOT NULL,
  concluida_em timestamptz,
  as_of date,
  arquivo text,
  PRIMARY KEY (versao, alvo)
);
