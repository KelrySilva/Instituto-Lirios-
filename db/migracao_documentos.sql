-- Rode no MySQL Workbench (com o banco instituto_lirios selecionado) se você
-- já tem o banco criado e não quer recriar tudo.
CREATE TABLE IF NOT EXISTS documentos (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  cliente_id    INT UNSIGNED NOT NULL,
  nome          VARCHAR(160) NOT NULL,
  tipo_mime     VARCHAR(100) NOT NULL,
  tamanho       INT UNSIGNED NOT NULL,
  conteudo      LONGBLOB NOT NULL,
  criado_em     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_documentos_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Arquivos anexados à ficha da cliente (PDF, imagens, Word)';

-- (índice abaixo; se já existir, ignore o erro)
CREATE INDEX idx_documentos_cliente ON documentos (cliente_id, criado_em);
