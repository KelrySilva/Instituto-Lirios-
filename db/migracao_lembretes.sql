USE instituto_lirios;

-- ============================================================================
-- 10. LEMBRETES — mensagem de lembrete de cada consulta (RF09)
-- ============================================================================
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
  CONSTRAINT fk_lembrete_agendamento
    FOREIGN KEY (agendamento_id) REFERENCES agendamentos (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Lembretes de consulta (um por agendamento)';

CREATE INDEX idx_lembretes_status ON lembretes (status);
