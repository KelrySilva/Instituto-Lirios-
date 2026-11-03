-- ============================================================================
--  INSTITUTO LÍRIOS — Consultas que a aplicação usa
-- ============================================================================
--  Cada bloco corresponde a uma tela. Os "?" são parâmetros (no MySQL
--  Workbench ele pergunta o valor; na aplicação vêm do driver).
--  A linha "-- params:" logo acima de cada consulta serve de documentação e
--  de teste automatizado (db/validar.py executa todas).
-- ============================================================================

USE instituto_lirios;


-- ---------------------------------------------------------------------------
-- 1. Lista de clientes (tela Clientes)
-- params: (nenhum)
-- ---------------------------------------------------------------------------
SELECT c.id,
       c.nome,
       c.telefone,
       c.email,
       c.status,
       s.nome AS servico_principal
FROM clientes c
LEFT JOIN servicos s ON s.id = c.servico_principal_id
ORDER BY c.nome;


-- ---------------------------------------------------------------------------
-- 2. Busca de clientes por nome ou serviço (campo de pesquisa)
-- params: '%maria%', '%maria%'
-- ---------------------------------------------------------------------------
SELECT c.id, c.nome, c.telefone, c.email, c.status, s.nome AS servico_principal
FROM clientes c
LEFT JOIN servicos s ON s.id = c.servico_principal_id
WHERE c.nome LIKE ?
   OR s.nome LIKE ?
ORDER BY c.nome;


-- ---------------------------------------------------------------------------
-- 3. Ficha da cliente — dados cadastrais + gestação em acompanhamento
-- params: 1
-- ---------------------------------------------------------------------------
SELECT c.id, c.nome, c.cpf, c.data_nascimento, c.telefone, c.email, c.cidade,
       c.status, s.nome AS servico_principal,
       g.dum, g.dpp, g.tipo_parto, g.bebe_nome, g.bebe_sexo, g.movimentacoes,
       g.observacoes AS observacoes_gestacao,
       DATEDIFF(g.dpp, CURDATE()) AS dias_para_o_parto
FROM clientes c
LEFT JOIN servicos s          ON s.id = c.servico_principal_id
LEFT JOIN vw_gestacao_atual g ON g.cliente_id = c.id
WHERE c.id = ?;


-- ---------------------------------------------------------------------------
-- 4. Atendimentos de uma cliente (aba Atendimentos) — mais recente primeiro
-- params: 1
-- ---------------------------------------------------------------------------
SELECT a.id, a.data_atendimento, a.servico, a.profissional, a.total_exames,
       a.anotacoes, a.bpm, a.movimentacoes, a.estado_emocional
FROM vw_atendimentos_detalhados a
WHERE a.cliente_id = ?
ORDER BY a.data_atendimento DESC, a.id DESC;


-- ---------------------------------------------------------------------------
-- 5. Exames de um atendimento (aba Exames / detalhes)
-- params: 1
-- ---------------------------------------------------------------------------
SELECT e.id, e.nome, e.resultado, a.data_atendimento
FROM atendimento_exames e
JOIN atendimentos a ON a.id = e.atendimento_id
WHERE a.cliente_id = ?
ORDER BY a.data_atendimento DESC, e.nome;


-- ---------------------------------------------------------------------------
-- 6. Contratos com cliente e serviço (tela Contratos)
-- params: (nenhum)
-- ---------------------------------------------------------------------------
SELECT ct.id, c.nome AS cliente, s.nome AS servico, ct.status, ct.valor,
       ct.assinado_em
FROM contratos ct
JOIN clientes c ON c.id = ct.cliente_id
JOIN servicos s ON s.id = ct.servico_id
ORDER BY (ct.status = 'pendente') DESC, c.nome;


-- ---------------------------------------------------------------------------
-- 7. Totais de contrato (cartões do topo da tela Contratos)
-- params: (nenhum)
-- ---------------------------------------------------------------------------
SELECT COUNT(*)                                                  AS total,
       SUM(CASE WHEN status = 'assinado' THEN 1 ELSE 0 END)      AS assinados,
       SUM(CASE WHEN status = 'pendente' THEN 1 ELSE 0 END)      AS pendentes
FROM contratos;


-- ---------------------------------------------------------------------------
-- 8. Agenda de um período (visualizações Dia / Semana / Mês)
-- params: '2020-01-01 00:00:00', '2100-01-01 00:00:00'
-- ---------------------------------------------------------------------------
SELECT ag.id, ag.inicio, ag.duracao_min, ag.status, ag.observacao,
       c.nome AS cliente, s.nome AS servico, u.nome AS profissional
FROM agendamentos ag
JOIN clientes c      ON c.id = ag.cliente_id
JOIN servicos s      ON s.id = ag.servico_id
LEFT JOIN usuarios u ON u.id = ag.profissional_id
WHERE ag.inicio >= ? AND ag.inicio < ?
ORDER BY ag.inicio;


-- ---------------------------------------------------------------------------
-- 9. Agenda de hoje (Dashboard)
-- params: (nenhum)
-- ---------------------------------------------------------------------------
SELECT ag.id, ag.inicio, c.nome AS cliente, s.nome AS servico
FROM agendamentos ag
JOIN clientes c ON c.id = ag.cliente_id
JOIN servicos s ON s.id = ag.servico_id
WHERE DATE(ag.inicio) = CURDATE()
  AND ag.status = 'agendado'
ORDER BY ag.inicio;


-- ---------------------------------------------------------------------------
-- 10. Pendências abertas (tela Pendências)
-- params: (nenhum)
-- ---------------------------------------------------------------------------
SELECT p.id, c.nome AS cliente, p.tipo, p.descricao, p.criado_em
FROM pendencias p
JOIN clientes c ON c.id = p.cliente_id
WHERE p.status = 'aberta'
ORDER BY p.criado_em;


-- ---------------------------------------------------------------------------
-- 11. Indicadores do Dashboard
-- params: (nenhum)
-- ---------------------------------------------------------------------------
SELECT (SELECT COUNT(*) FROM agendamentos
         WHERE DATE(inicio) = CURDATE() AND status = 'agendado')  AS consultas_hoje,
       (SELECT COUNT(*) FROM vw_gestacao_atual
         WHERE dpp >= CURDATE())                                  AS partos_previstos,
       (SELECT COUNT(*) FROM pendencias WHERE status = 'aberta')   AS pendencias_abertas;


-- ---------------------------------------------------------------------------
-- 12. Relatório — atendimentos por serviço
-- params: (nenhum)
-- ---------------------------------------------------------------------------
SELECT s.nome AS servico,
       COUNT(a.id) AS atendimentos
FROM servicos s
LEFT JOIN atendimentos a ON a.servico_id = s.id
GROUP BY s.id, s.nome
ORDER BY atendimentos DESC, s.nome;


-- ---------------------------------------------------------------------------
-- 13. Relatório — atendimentos por mês
-- params: (nenhum)
-- ---------------------------------------------------------------------------
SELECT SUBSTR(a.data_atendimento, 1, 7) AS mes,
       COUNT(*) AS atendimentos
FROM atendimentos a
GROUP BY SUBSTR(a.data_atendimento, 1, 7)
ORDER BY mes;


-- ---------------------------------------------------------------------------
-- 14. Próximos partos (Dashboard, lista lateral)
-- params: (nenhum)
-- ---------------------------------------------------------------------------
SELECT c.nome AS cliente, g.dpp, DATEDIFF(g.dpp, CURDATE()) AS dias
FROM vw_gestacao_atual g
JOIN clientes c ON c.id = g.cliente_id
WHERE g.dpp >= DATE_SUB(CURDATE(), INTERVAL 15 DAY)
ORDER BY g.dpp
LIMIT 5;
