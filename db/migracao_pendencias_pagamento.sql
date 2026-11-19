-- ============================================================================
--  Migração: adiciona o tipo "pagamento" às pendências (RF18)
--  Para quem JÁ criou o banco com o schema antigo.
--  Quem criar o banco agora com db/schema.sql já recebe o tipo novo.
--  Pode ser executada mais de uma vez sem problema.
-- ============================================================================
USE instituto_lirios;

ALTER TABLE pendencias
  MODIFY tipo ENUM('contrato','exame','confirmacao','anotacao','pagamento','outro')
  NOT NULL DEFAULT 'outro';
