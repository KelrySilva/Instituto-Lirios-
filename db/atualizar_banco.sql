-- ============================================================================
--  Atualiza um banco JÁ CRIADO com as versões antigas do schema.sql.
--  Cria o que estiver faltando e não apaga nenhum dado.
--  Pode ser executado mais de uma vez sem problema.
--
--  Como rodar (MySQL Workbench):
--    1. File > Open SQL Script... > escolha este arquivo
--    2. Clique no raio (Execute)
--    3. Confira no final: a consulta SHOW TABLES deve listar "documentos" e "lembretes"
-- ============================================================================
USE instituto_lirios;

-- Arquivos anexados à ficha da cliente (aba Documentos)
CREATE TABLE IF NOT EXISTS documentos (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  cliente_id    INT UNSIGNED NOT NULL,
  nome          VARCHAR(160) NOT NULL,
  tipo_mime     VARCHAR(100) NOT NULL,
  tamanho       INT UNSIGNED NOT NULL,
  conteudo      LONGBLOB NOT NULL,
  criado_em     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_documentos_cliente (cliente_id, criado_em),
  CONSTRAINT fk_documentos_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Arquivos anexados à ficha da cliente (PDF, imagens, Word)';

-- Lembretes de consulta (um por agendamento)
CREATE TABLE IF NOT EXISTS lembretes (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  agendamento_id INT UNSIGNED NOT NULL,
  mensagem       VARCHAR(500) NOT NULL,
  status         ENUM('pendente','enviado','confirmado') NOT NULL DEFAULT 'pendente',
  enviado_em     DATETIME NULL,
  criado_em      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_lembrete_agendamento (agendamento_id),
  KEY idx_lembretes_status (status),
  CONSTRAINT fk_lembrete_agendamento
    FOREIGN KEY (agendamento_id) REFERENCES agendamentos (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Lembretes de consulta (um por agendamento)';

-- Pendências: tipo "pagamento"
ALTER TABLE pendencias
  MODIFY tipo ENUM('contrato','exame','confirmacao','anotacao','pagamento','outro')
  NOT NULL DEFAULT 'outro';

-- Clientes: status "inativa" (além de ativa e pendente)
ALTER TABLE clientes
  MODIFY status ENUM('ativa','pendente','inativa') NOT NULL DEFAULT 'ativa';

-- Conferência: deve listar, entre outras, "documentos" e "lembretes"
SHOW TABLES;
