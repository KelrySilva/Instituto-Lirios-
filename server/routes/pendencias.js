'use strict';

const express = require('express');
const { pool } = require('../db');
const { rota, id, texto, opcao, HttpError } = require('../http');

const router = express.Router();

const TIPOS = ['contrato', 'exame', 'confirmacao', 'anotacao', 'outro'];
const STATUS = ['aberta', 'resolvida'];

const CAMPOS = `
  p.id, p.cliente_id, p.tipo, p.descricao, p.status, p.resolvido_em,
  p.criado_em, c.nome AS cliente
`;

async function buscarPendencia(idPendencia) {
  const [linhas] = await pool.execute(
    `SELECT ${CAMPOS}
       FROM pendencias p
       JOIN clientes c ON c.id = p.cliente_id
      WHERE p.id = ?`,
    [idPendencia]
  );
  if (!linhas.length) throw new HttpError(404, 'Pendência não encontrada.');
  return linhas[0];
}

// GET /api/pendencias?status=aberta&cliente_id=
router.get('/', rota(async (req, res) => {
  const condicoes = [];
  const valores = [];

  if (req.query.status) {
    condicoes.push('p.status = ?');
    valores.push(opcao(req.query.status, 'status', STATUS));
  }
  if (req.query.cliente_id) {
    condicoes.push('p.cliente_id = ?');
    valores.push(id(req.query.cliente_id, 'cliente_id'));
  }

  const onde = condicoes.length ? 'WHERE ' + condicoes.join(' AND ') + ' ' : '';

  const [linhas] = await pool.execute(
    `SELECT ${CAMPOS}
       FROM pendencias p
       JOIN clientes c ON c.id = p.cliente_id
       ${onde}
      ORDER BY p.status, p.criado_em`,
    valores
  );

  res.json(linhas);
}));

// GET /api/pendencias/resumo — contagem por tipo (cartões do topo)
router.get('/resumo', rota(async (req, res) => {
  const [porTipo] = await pool.query(
    `SELECT tipo, COUNT(*) AS total
       FROM pendencias
      WHERE status = 'aberta'
      GROUP BY tipo`
  );
  const [total] = await pool.query(
    "SELECT COUNT(*) AS abertas FROM pendencias WHERE status = 'aberta'"
  );
  res.json({ abertas: total[0].abertas, por_tipo: porTipo });
}));

// POST /api/pendencias
router.post('/', rota(async (req, res) => {
  const corpo = req.body || {};

  const [resultado] = await pool.execute(
    `INSERT INTO pendencias (cliente_id, tipo, descricao)
     VALUES (?, ?, ?)`,
    [
      id(corpo.cliente_id, 'cliente_id'),
      opcao(corpo.tipo, 'tipo', TIPOS, 'outro'),
      texto(corpo.descricao, 'descricao', { max: 255 })
    ]
  );

  res.status(201).json(await buscarPendencia(resultado.insertId));
}));

// PATCH /api/pendencias/:id/resolver — idempotente
router.patch('/:id/resolver', rota(async (req, res) => {
  const idPendencia = id(req.params.id);
  await buscarPendencia(idPendencia);

  await pool.execute(
    `UPDATE pendencias
        SET status = 'resolvida', resolvido_em = COALESCE(resolvido_em, NOW())
      WHERE id = ?`,
    [idPendencia]
  );

  res.json(await buscarPendencia(idPendencia));
}));

// DELETE /api/pendencias/:id
router.delete('/:id', rota(async (req, res) => {
  const [resultado] = await pool.execute('DELETE FROM pendencias WHERE id = ?', [id(req.params.id)]);
  if (!resultado.affectedRows) throw new HttpError(404, 'Pendência não encontrada.');
  res.status(204).end();
}));

module.exports = router;
