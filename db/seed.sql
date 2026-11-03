-- ============================================================================
--  INSTITUTO LÍRIOS — Dados iniciais (seed)
--  Execute DEPOIS de db/schema.sql
-- ============================================================================
--  As datas que representam "rotina" (agenda, atendimentos, gestação) são
--  calculadas a partir de CURDATE(), então a demonstração continua coerente
--  em qualquer dia em que o script for executado.
-- ============================================================================

USE instituto_lirios;

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- Usuário de acesso
--   e-mail: katlhen@lirios.com.br
--   senha : senha1234      (hash bcrypt abaixo — troque em produção)
-- ---------------------------------------------------------------------------
INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES
  ('Dra. Katlhen Carvalho', 'katlhen@lirios.com.br',
   '$2b$10$ZkoeCGyMEUdkyQj7UlNQkuvqKk3Mmu.9V4QDRP.r82p9UZup11kju', 'admin');


-- ---------------------------------------------------------------------------
-- Serviços
-- ---------------------------------------------------------------------------
INSERT INTO servicos (nome, descricao, duracao_min, valor) VALUES
  ('Pré-natal', 'Consultas de acompanhamento da gestação, com orientações e solicitação de exames.', 60, 250.00),
  ('Puericultura', 'Acompanhamento do crescimento e desenvolvimento do bebê.', 45, 180.00),
  ('Consultoria de Amamentação', 'Apoio na pega, posições e dificuldades durante a amamentação.', 60, 200.00),
  ('Auriculoterapia', 'Sessões de auriculoterapia para alívio de desconfortos da gestação.', 50, 120.00),
  ('Perfuração Humanizada', 'Perfuração de orelha com técnica humanizada.', 40, 80.00);


-- ---------------------------------------------------------------------------
-- Clientes (as mesmas sete da interface)
-- ---------------------------------------------------------------------------
INSERT INTO clientes
  (nome, cpf, data_nascimento, telefone, email, cidade, servico_principal_id, status) VALUES
  ('Maria Silva',   '000.000.000-00', '1995-05-15', '(99) 99999-0001', 'maria@email.com',
   'Balsas - MA', (SELECT id FROM servicos WHERE nome = 'Pré-natal'), 'ativa'),
  ('Ana Sousa',     NULL, '1998-03-22', '(99) 99999-0002', 'ana@email.com',
   'Balsas - MA', (SELECT id FROM servicos WHERE nome = 'Puericultura'), 'ativa'),
  ('Carla Lima',    NULL, '1992-11-07', '(99) 99999-0003', 'carla@email.com',
   'Balsas - MA', (SELECT id FROM servicos WHERE nome = 'Consultoria de Amamentação'), 'ativa'),
  ('Júlia Alves',   NULL, '2001-06-14', '(99) 99999-0004', 'julia@email.com',
   'Balsas - MA', (SELECT id FROM servicos WHERE nome = 'Auriculoterapia'), 'ativa'),
  ('Fernanda Rocha', NULL, '1996-09-30', '(99) 99999-0005', 'fernanda@email.com',
   'Balsas - MA', (SELECT id FROM servicos WHERE nome = 'Perfuração Humanizada'), 'ativa'),
  ('Mariana Costa', NULL, '1999-01-18', '(99) 99999-0006', 'mariana@email.com',
   'Balsas - MA', (SELECT id FROM servicos WHERE nome = 'Pré-natal'), 'ativa'),
  ('Carla Rocha',   NULL, '1994-07-02', '(99) 99999-0007', 'carla.rocha@email.com',
   'Balsas - MA', (SELECT id FROM servicos WHERE nome = 'Pré-natal'), 'pendente');


-- ---------------------------------------------------------------------------
-- Gestação em acompanhamento (Maria — 37 semanas hoje, parto em 21 dias)
-- ---------------------------------------------------------------------------
INSERT INTO gestacoes
  (cliente_id, dum, dpp, tipo_parto, bebe_nome, bebe_sexo, movimentacoes, observacoes) VALUES
  ((SELECT id FROM clientes WHERE nome = 'Maria Silva'),
   DATE_SUB(CURDATE(), INTERVAL 259 DAY),
   DATE_ADD(CURDATE(), INTERVAL 21 DAY),
   'normal', 'Helena', 'feminino', 'ativas',
   'Cliente relata desconforto lombar leve. Acompanhamento dentro do esperado.');


-- ---------------------------------------------------------------------------
-- Atendimentos da Maria (o mais recente primeiro)
-- ---------------------------------------------------------------------------
INSERT INTO atendimentos
  (cliente_id, servico_id, profissional_id, data_atendimento, anotacoes, bpm, movimentacoes, estado_emocional) VALUES
  ((SELECT id FROM clientes WHERE nome = 'Maria Silva'),
   (SELECT id FROM servicos WHERE nome = 'Pré-natal'),
   (SELECT id FROM usuarios WHERE email = 'katlhen@lirios.com.br'),
   DATE_SUB(CURDATE(), INTERVAL 17 DAY),
   'Consulta de rotina. Gestação evoluindo sem intercorrências.',
   145, 'Ativas', 'Tranquila com o acompanhamento.'),

  ((SELECT id FROM clientes WHERE nome = 'Maria Silva'),
   (SELECT id FROM servicos WHERE nome = 'Consultoria de Amamentação'),
   (SELECT id FROM usuarios WHERE email = 'katlhen@lirios.com.br'),
   DATE_SUB(CURDATE(), INTERVAL 31 DAY),
   'Orientações sobre pega e posicionamento.',
   142, 'Ativas', 'Relata ansiedade leve.'),

  ((SELECT id FROM clientes WHERE nome = 'Maria Silva'),
   (SELECT id FROM servicos WHERE nome = 'Pré-natal'),
   (SELECT id FROM usuarios WHERE email = 'katlhen@lirios.com.br'),
   DATE_SUB(CURDATE(), INTERVAL 45 DAY),
   'Avaliação inicial do pré-natal.',
   148, 'Ativas', 'Bem adaptada às orientações.');


-- ---------------------------------------------------------------------------
-- Exames solicitados nos atendimentos
-- ---------------------------------------------------------------------------
INSERT INTO atendimento_exames (atendimento_id, nome, resultado) VALUES
  ((SELECT id FROM atendimentos
     WHERE cliente_id = (SELECT id FROM clientes WHERE nome = 'Maria Silva')
     ORDER BY data_atendimento DESC LIMIT 1),
   'Hemograma completo', 'Resultado normal'),

  ((SELECT id FROM atendimentos
     WHERE cliente_id = (SELECT id FROM clientes WHERE nome = 'Maria Silva')
     ORDER BY data_atendimento ASC LIMIT 1),
   'Ultrassom obstétrico', 'Dentro do esperado para a idade gestacional');


-- ---------------------------------------------------------------------------
-- Contratos (3 assinados, 2 pendentes — os mesmos da tela)
-- ---------------------------------------------------------------------------
INSERT INTO contratos (cliente_id, servico_id, status, valor, assinado_em) VALUES
  ((SELECT id FROM clientes WHERE nome = 'Maria Silva'),
   (SELECT id FROM servicos WHERE nome = 'Pré-natal'), 'assinado', 250.00, DATE_SUB(NOW(), INTERVAL 60 DAY)),

  ((SELECT id FROM clientes WHERE nome = 'Ana Sousa'),
   (SELECT id FROM servicos WHERE nome = 'Puericultura'), 'pendente', 180.00, NULL),

  ((SELECT id FROM clientes WHERE nome = 'Carla Lima'),
   (SELECT id FROM servicos WHERE nome = 'Consultoria de Amamentação'), 'assinado', 200.00, DATE_SUB(NOW(), INTERVAL 45 DAY)),

  ((SELECT id FROM clientes WHERE nome = 'Júlia Alves'),
   (SELECT id FROM servicos WHERE nome = 'Auriculoterapia'), 'pendente', 120.00, NULL),

  ((SELECT id FROM clientes WHERE nome = 'Fernanda Rocha'),
   (SELECT id FROM servicos WHERE nome = 'Pré-natal'), 'assinado', 250.00, DATE_SUB(NOW(), INTERVAL 30 DAY));


-- ---------------------------------------------------------------------------
-- Agenda (mesmos compromissos da interface, relativos a hoje)
-- ---------------------------------------------------------------------------
INSERT INTO agendamentos
  (cliente_id, servico_id, profissional_id, inicio, duracao_min, status) VALUES
  ((SELECT id FROM clientes WHERE nome = 'Maria Silva'),
   (SELECT id FROM servicos WHERE nome = 'Pré-natal'),
   (SELECT id FROM usuarios WHERE email = 'katlhen@lirios.com.br'),
   TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 0 DAY), '09:30:00'), 60, 'agendado'),

  ((SELECT id FROM clientes WHERE nome = 'Ana Sousa'),
   (SELECT id FROM servicos WHERE nome = 'Puericultura'),
   (SELECT id FROM usuarios WHERE email = 'katlhen@lirios.com.br'),
   TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 4 DAY), '10:30:00'), 45, 'agendado'),

  ((SELECT id FROM clientes WHERE nome = 'Carla Lima'),
   (SELECT id FROM servicos WHERE nome = 'Consultoria de Amamentação'),
   (SELECT id FROM usuarios WHERE email = 'katlhen@lirios.com.br'),
   TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 9 DAY), '14:00:00'), 60, 'agendado'),

  ((SELECT id FROM clientes WHERE nome = 'Júlia Alves'),
   (SELECT id FROM servicos WHERE nome = 'Auriculoterapia'),
   (SELECT id FROM usuarios WHERE email = 'katlhen@lirios.com.br'),
   TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 16 DAY), '16:00:00'), 50, 'agendado');


-- ---------------------------------------------------------------------------
-- Pendências abertas
-- ---------------------------------------------------------------------------
INSERT INTO pendencias (cliente_id, tipo, descricao, status) VALUES
  ((SELECT id FROM clientes WHERE nome = 'Maria Silva'),   'contrato',    'Contrato aguardando assinatura', 'aberta'),
  ((SELECT id FROM clientes WHERE nome = 'Ana Sousa'),     'exame',       'Exame pendente',                 'aberta'),
  ((SELECT id FROM clientes WHERE nome = 'Carla Lima'),    'confirmacao', 'Confirmar consulta',             'aberta'),
  ((SELECT id FROM clientes WHERE nome = 'Júlia Alves'),   'anotacao',    'Anotação do atendimento',        'aberta');
