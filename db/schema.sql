-- ============================================================================
--  INSTITUTO LÍRIOS — Sistema de Gestão
--  Esquema do banco de dados
--  Compatível com: MySQL 8.0+ / MariaDB 10.5+ (XAMPP)
-- ============================================================================
--  COMO USAR (MySQL Workbench)
--    1. File > Open SQL Script...  e abra este arquivo
--    2. Clique no raio (Execute) — ele cria o banco e todas as tabelas
--    3. Depois execute db/seed.sql para carregar os dados iniciais
--
--  CONVENÇÕES
--    - Tabelas e colunas em português, minúsculas, no plural.
--    - Chave primária: id INT UNSIGNED AUTO_INCREMENT.
--    - DATE para data sem hora; DATETIME para data + hora.
--    - Valores derivados (idade, idade gestacional, dias até o parto) NÃO são
--      gravados: são calculados na consulta ou na aplicação, para não ficarem
--      desatualizados com o passar do tempo.
--    - Toda tabela tem criado_em; as mutáveis têm também atualizado_em.
-- ============================================================================

CREATE DATABASE IF NOT EXISTS instituto_lirios
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE instituto_lirios;

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- Recriação limpa (a ordem respeita as dependências)
-- ---------------------------------------------------------------------------
SET FOREIGN_KEY_CHECKS = 0;

DROP VIEW IF EXISTS vw_resumo_cliente;
DROP VIEW IF EXISTS vw_atendimentos_detalhados;
DROP VIEW IF EXISTS vw_gestacao_atual;

DROP TABLE IF EXISTS pendencias;
DROP TABLE IF EXISTS agendamentos;
DROP TABLE IF EXISTS contratos;
DROP TABLE IF EXISTS atendimento_exames;
DROP TABLE IF EXISTS atendimentos;
DROP TABLE IF EXISTS gestacoes;
DROP TABLE IF EXISTS clientes;
DROP TABLE IF EXISTS servicos;
DROP TABLE IF EXISTS usuarios;

SET FOREIGN_KEY_CHECKS = 1;


-- ============================================================================
-- 1. USUÁRIOS — quem acessa o sistema
-- ============================================================================
CREATE TABLE usuarios (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NOT NULL,
  senha_hash    VARCHAR(255) NOT NULL COMMENT 'bcrypt — nunca a senha em texto puro',
  perfil        ENUM('admin','profissional') NOT NULL DEFAULT 'profissional',
  ativo         TINYINT(1) NOT NULL DEFAULT 1,
  criado_em     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uk_usuarios_email UNIQUE (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Usuários do sistema (login)';


-- ============================================================================
-- 2. SERVIÇOS — catálogo do Instituto
-- ============================================================================
CREATE TABLE servicos (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome        VARCHAR(100) NOT NULL,
  descricao   VARCHAR(255) NULL,
  duracao_min SMALLINT UNSIGNED NOT NULL DEFAULT 60,
  valor       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  ativo       TINYINT(1) NOT NULL DEFAULT 1,
  criado_em   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uk_servicos_nome UNIQUE (nome),
  CONSTRAINT ck_servicos_duracao CHECK (duracao_min > 0),
  CONSTRAINT ck_servicos_valor   CHECK (valor >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Serviços oferecidos (pré-natal, puericultura, etc.)';


-- ============================================================================
-- 3. CLIENTES — cadastro das clientes atendidas
-- ============================================================================
CREATE TABLE clientes (
  id                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome                 VARCHAR(140) NOT NULL,
  cpf                  VARCHAR(14) NULL COMMENT 'único quando informado',
  data_nascimento      DATE NULL,
  telefone             VARCHAR(20) NULL,
  email                VARCHAR(160) NULL,
  cidade               VARCHAR(120) NULL,
  servico_principal_id INT UNSIGNED NULL,
  status               ENUM('ativa','pendente','inativa') NOT NULL DEFAULT 'ativa',
  observacoes          TEXT NULL,
  criado_em            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uk_clientes_cpf UNIQUE (cpf),
  CONSTRAINT fk_clientes_servico
    FOREIGN KEY (servico_principal_id) REFERENCES servicos (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT ck_clientes_nascimento
    CHECK (data_nascimento IS NULL OR data_nascimento >= '1900-01-01')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Cadastro das clientes';

CREATE INDEX idx_clientes_nome   ON clientes (nome);
CREATE INDEX idx_clientes_status ON clientes (status);
CREATE INDEX idx_clientes_servico ON clientes (servico_principal_id);


-- ============================================================================
-- 4. GESTAÇÕES — uma cliente pode ter mais de uma ao longo do tempo
--    A gestação em acompanhamento é a que tem encerrada_em IS NULL
--    (regra: no máximo uma aberta por cliente, garantida pela aplicação).
-- ============================================================================
CREATE TABLE gestacoes (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  cliente_id    INT UNSIGNED NOT NULL,
  dum           DATE NOT NULL COMMENT 'data da última menstruação',
  dpp           DATE NOT NULL COMMENT 'data prevista do parto (DUM + 280 dias)',
  tipo_parto    ENUM('normal','cesarea','a_definir') NOT NULL DEFAULT 'a_definir',
  bebe_nome     VARCHAR(80) NULL,
  bebe_sexo     ENUM('feminino','masculino','nao_informado') NOT NULL DEFAULT 'nao_informado',
  movimentacoes ENUM('ativas','pouco_ativas','ainda_nao_sente') NOT NULL DEFAULT 'ativas',
  observacoes   TEXT NULL,
  encerrada_em  DATE NULL COMMENT 'NULL = gestação em acompanhamento',
  criado_em     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_gestacoes_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT ck_gestacoes_datas CHECK (dpp > dum),
  CONSTRAINT ck_gestacoes_dum   CHECK (dum >= '1900-01-01')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Gestações acompanhadas';

CREATE INDEX idx_gestacoes_cliente ON gestacoes (cliente_id, dum);
CREATE INDEX idx_gestacoes_dpp     ON gestacoes (dpp);


-- ============================================================================
-- 5. ATENDIMENTOS — cada consulta realizada
-- ============================================================================
CREATE TABLE atendimentos (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  cliente_id       INT UNSIGNED NOT NULL,
  servico_id       INT UNSIGNED NULL,
  profissional_id  INT UNSIGNED NULL,
  data_atendimento DATE NOT NULL,
  anotacoes        TEXT NULL,
  bpm              SMALLINT UNSIGNED NULL COMMENT 'batimentos cardíacos do bebê',
  movimentacoes    VARCHAR(40) NULL,
  estado_emocional TEXT NULL,
  criado_em        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_atend_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_atend_servico
    FOREIGN KEY (servico_id) REFERENCES servicos (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_atend_profissional
    FOREIGN KEY (profissional_id) REFERENCES usuarios (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT ck_atend_bpm CHECK (bpm IS NULL OR bpm BETWEEN 30 AND 250)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Atendimentos realizados';

CREATE INDEX idx_atend_cliente ON atendimentos (cliente_id, data_atendimento);
CREATE INDEX idx_atend_data    ON atendimentos (data_atendimento);
CREATE INDEX idx_atend_servico ON atendimentos (servico_id);


-- ============================================================================
-- 6. ATENDIMENTO_EXAMES — exames solicitados em um atendimento (1:N)
-- ============================================================================
CREATE TABLE atendimento_exames (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  atendimento_id INT UNSIGNED NOT NULL,
  nome           VARCHAR(120) NOT NULL,
  resultado      VARCHAR(255) NULL,
  criado_em      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_exames_atendimento
    FOREIGN KEY (atendimento_id) REFERENCES atendimentos (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Exames solicitados por atendimento';

CREATE INDEX idx_exames_atendimento ON atendimento_exames (atendimento_id);


-- ============================================================================
-- 7. CONTRATOS — um contrato por cliente/serviço
-- ============================================================================
CREATE TABLE contratos (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  cliente_id    INT UNSIGNED NOT NULL,
  servico_id    INT UNSIGNED NOT NULL,
  status        ENUM('pendente','assinado','cancelado') NOT NULL DEFAULT 'pendente',
  valor         DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  assinado_em   DATETIME NULL,
  criado_em     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uk_contratos_cliente_servico UNIQUE (cliente_id, servico_id),
  CONSTRAINT fk_contratos_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_contratos_servico
    FOREIGN KEY (servico_id) REFERENCES servicos (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT ck_contratos_valor CHECK (valor >= 0),
  CONSTRAINT ck_contratos_assinatura
    CHECK (status <> 'assinado' OR assinado_em IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Contratos das clientes';

CREATE INDEX idx_contratos_status  ON contratos (status);
CREATE INDEX idx_contratos_cliente ON contratos (cliente_id);


-- ============================================================================
-- 8. AGENDAMENTOS — a agenda do Instituto
-- ============================================================================
CREATE TABLE agendamentos (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  cliente_id      INT UNSIGNED NOT NULL,
  servico_id      INT UNSIGNED NOT NULL,
  profissional_id INT UNSIGNED NULL,
  inicio          DATETIME NOT NULL,
  duracao_min     SMALLINT UNSIGNED NOT NULL DEFAULT 60,
  status          ENUM('agendado','concluido','cancelado','faltou') NOT NULL DEFAULT 'agendado',
  observacao      VARCHAR(255) NULL,
  criado_em       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_agenda_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_agenda_servico
    FOREIGN KEY (servico_id) REFERENCES servicos (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_agenda_profissional
    FOREIGN KEY (profissional_id) REFERENCES usuarios (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT ck_agenda_duracao CHECK (duracao_min > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Agendamentos (Agenda)';

CREATE INDEX idx_agenda_inicio  ON agendamentos (inicio);
CREATE INDEX idx_agenda_cliente ON agendamentos (cliente_id, inicio);
CREATE INDEX idx_agenda_status  ON agendamentos (status);


-- ============================================================================
-- 9. PENDÊNCIAS — o que precisa de atenção
-- ============================================================================
CREATE TABLE pendencias (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  cliente_id    INT UNSIGNED NOT NULL,
  tipo          ENUM('contrato','exame','confirmacao','anotacao','outro') NOT NULL DEFAULT 'outro',
  descricao     VARCHAR(255) NOT NULL,
  status        ENUM('aberta','resolvida') NOT NULL DEFAULT 'aberta',
  resolvido_em  DATETIME NULL,
  criado_em     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_pendencias_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT ck_pendencias_resolucao
    CHECK (status <> 'resolvida' OR resolvido_em IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Pendências abertas por cliente';

CREATE INDEX idx_pendencias_status  ON pendencias (status);
CREATE INDEX idx_pendencias_cliente ON pendencias (cliente_id, status);


-- ============================================================================
-- VIEWS — consultas prontas que as telas reaproveitam
-- ============================================================================

-- Gestação em acompanhamento de cada cliente (a mais recente ainda aberta).
CREATE VIEW vw_gestacao_atual AS
SELECT g.id, g.cliente_id, g.dum, g.dpp, g.tipo_parto,
       g.bebe_nome, g.bebe_sexo, g.movimentacoes, g.observacoes
FROM gestacoes g
WHERE g.encerrada_em IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM gestacoes g2
    WHERE g2.cliente_id = g.cliente_id
      AND g2.encerrada_em IS NULL
      AND (g2.dum > g.dum OR (g2.dum = g.dum AND g2.id > g.id))
  );

-- Atendimentos com os nomes já resolvidos (evita JOIN em cada tela).
CREATE VIEW vw_atendimentos_detalhados AS
SELECT a.id,
       a.data_atendimento,
       a.servico_id,
       a.profissional_id,
       a.anotacoes,
       a.bpm,
       a.movimentacoes,
       a.estado_emocional,
       c.id   AS cliente_id,
       c.nome AS cliente,
       s.nome AS servico,
       u.nome AS profissional,
       (SELECT COUNT(*) FROM atendimento_exames e WHERE e.atendimento_id = a.id) AS total_exames
FROM atendimentos a
JOIN clientes c      ON c.id = a.cliente_id
LEFT JOIN servicos s ON s.id = a.servico_id
LEFT JOIN usuarios u ON u.id = a.profissional_id;

-- Ficha resumida: é o que o Dashboard e a lista de Clientes precisam.
CREATE VIEW vw_resumo_cliente AS
SELECT c.id,
       c.nome,
       c.status,
       c.data_nascimento,
       c.telefone,
       c.email,
       c.cidade,
       s.nome AS servico_principal,
       (SELECT COUNT(*) FROM atendimentos a WHERE a.cliente_id = c.id) AS total_atendimentos,
       (SELECT MAX(a.data_atendimento) FROM atendimentos a WHERE a.cliente_id = c.id) AS ultimo_atendimento,
       (SELECT COUNT(*) FROM contratos ct WHERE ct.cliente_id = c.id AND ct.status = 'pendente') AS contratos_pendentes,
       g.dpp AS parto_previsto
FROM clientes c
LEFT JOIN servicos s          ON s.id = c.servico_principal_id
LEFT JOIN vw_gestacao_atual g ON g.cliente_id = c.id;
