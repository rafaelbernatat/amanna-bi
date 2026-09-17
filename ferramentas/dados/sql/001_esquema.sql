-- A réplica da base Amanna (D-DADOS).
--
-- Tudo mora no esquema `amanna`, e não em `public`, por uma razão que é de
-- segurança e não de organização: no Supabase, `public` é exposto pela Data
-- API com a chave pública do projeto. Um esquema próprio fica fora dela, e o
-- produto continua lendo pela conexão de servidor (DATABASE_URL), que é a
-- única porta prevista.
--
-- Cada arquivo desta pasta é idempotente: `IF NOT EXISTS`, `OR REPLACE`,
-- `ON CONFLICT DO NOTHING`. Rodar a migração duas vezes não muda nada.

CREATE SCHEMA IF NOT EXISTS amanna;
