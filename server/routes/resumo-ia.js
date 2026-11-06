'use strict';

const express = require('express');
const { pool } = require('../db');
const { rota, id, HttpError } = require('../http');
const { gerarResumo } = require('../ia');

const router = express.Router();

/**
 * POST /api/resumo-ia/:clienteId
 * Reúne o histórico da cliente, gera o resumo (IA ou básico) e devolve as linhas.
 */
router.post('/:clienteId', rota(async (req, res) => {
  const clienteId = id(req.params.clienteId, 'clienteId');

  const [clientes] = await pool.execute(
    'SELECT id, nome, data_nascimento, status FROM clientes WHERE id = ?', [clienteId]
  );
  if (!clientes.length) throw new HttpError(404, 'Cliente não encontrada.');

  const [gestacoes] = await pool.execute(
    'SELECT dum, dpp, tipo_parto, movimentacoes, observacoes FROM vw_gestacao_atual WHERE cliente_id = ? LIMIT 1',
    [clienteId]
  );

  const [atendimentos] = await pool.execute(
    `SELECT a.id, a.data_atendimento, a.anotacoes, a.bpm, a.estado_emocional, s.nome AS servico
       FROM atendimentos a
  LEFT JOIN servicos s ON s.id = a.servico_id
      WHERE a.cliente_id = ?
      ORDER BY a.data_atendimento DESC, a.id DESC
      LIMIT 10`,
    [clienteId]
  );

  for (const a of atendimentos) {
    const [exames] = await pool.execute(
      'SELECT nome, resultado FROM atendimento_exames WHERE atendimento_id = ?', [a.id]
    );
    a.exames = exames.map((e) => e.nome + (e.resultado ? ' (' + e.resultado + ')' : ''));
  }

  const [contratos] = await pool.execute(
    `SELECT s.nome AS servico, c.status
       FROM contratos c JOIN servicos s ON s.id = c.servico_id
      WHERE c.cliente_id = ?`,
    [clienteId]
  );

  const [pendencias] = await pool.execute(
    "SELECT tipo, descricao FROM pendencias WHERE cliente_id = ? AND status = 'aberta'", [clienteId]
  );

  const resultado = await gerarResumo({
    cliente: clientes[0],
    gestacao: gestacoes[0] || null,
    atendimentos,
    contratos,
    pendencias
  });

  res.json(resultado);
}));

module.exports = router;
