'use strict';

const express = require('express');
const { pool } = require('../db');
const { rota } = require('../http');

const router = express.Router();

/**
 * GET /api/dashboard
 * Indicadores da página inicial (uma ida ao banco por bloco, em paralelo).
 */
router.get('/', rota(async (req, res) => {
  const [indicadores] = await pool.query(
    `SELECT (SELECT COUNT(*) FROM agendamentos
              WHERE DATE(inicio) = CURDATE() AND status = 'agendado') AS consultas_hoje,
            (SELECT COUNT(*) FROM vw_gestacao_atual WHERE dpp >= CURDATE()) AS partos_previstos,
            (SELECT COUNT(*) FROM pendencias WHERE status = 'aberta') AS pendencias_abertas
    `
  );

  const [agendaHoje] = await pool.query(
    `SELECT ag.id, ag.inicio, ag.status, c.nome AS cliente, s.nome AS servico
       FROM agendamentos ag
       JOIN clientes c ON c.id = ag.cliente_id
       JOIN servicos s ON s.id = ag.servico_id
      WHERE DATE(ag.inicio) = CURDATE()
        AND ag.status <> 'cancelado'
      ORDER BY ag.inicio`
  );

  const [proximosPartos] = await pool.query(
    `SELECT c.nome AS cliente, g.dpp,
            DATEDIFF(g.dpp, CURDATE()) AS dias_restantes
       FROM vw_gestacao_atual g
       JOIN clientes c ON c.id = g.cliente_id
      WHERE g.dpp >= DATE_SUB(CURDATE(), INTERVAL 15 DAY)
      ORDER BY g.dpp
      LIMIT 5`
  );

  const [pendencias] = await pool.query(
    `SELECT p.id, p.tipo, p.descricao, c.nome AS cliente
       FROM pendencias p
       JOIN clientes c ON c.id = p.cliente_id
      WHERE p.status = 'aberta'
      ORDER BY p.criado_em
      LIMIT 5`
  );

  res.json({
    ...indicadores[0],
    agenda_hoje: agendaHoje,
    proximos_partos: proximosPartos,
    pendencias
  });
}));

module.exports = router;
