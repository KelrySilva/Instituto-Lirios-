'use strict';

const express = require('express');
const { pool } = require('../db');
const { rota, id, decimal, opcao, HttpError } = require('../http');

const router = express.Router();

const STATUS = ['pendente', 'assinado', 'cancelado'];

const CAMPOS = `
  ct.id, ct.cliente_id, ct.servico_id, ct.status, ct.valor,
  ct.assinado_em, ct.criado_em, ct.atualizado_em,
  c.nome AS cliente, s.nome AS servico
`;

async function buscarContrato(idContrato) {
  const [linhas] = await pool.execute(
    `SELECT ${CAMPOS}
       FROM contratos ct
       JOIN clientes c ON c.id = ct.cliente_id
       JOIN servicos s ON s.id = ct.servico_id
      WHERE ct.id = ?`,
    [idContrato]
  );
  if (!linhas.length) throw new HttpError(404, 'Contrato não encontrado.');
  return linhas[0];
}

// GET /api/contratos?status=&cliente_id=
router.get('/', rota(async (req, res) => {
  const condicoes = [];
  const valores = [];

  if (req.query.status) {
    condicoes.push('ct.status = ?');
    valores.push(opcao(req.query.status, 'status', STATUS));
  }
  if (req.query.cliente_id) {
    condicoes.push('ct.cliente_id = ?');
    valores.push(id(req.query.cliente_id, 'cliente_id'));
  }

  const onde = condicoes.length ? 'WHERE ' + condicoes.join(' AND ') + ' ' : '';

  const [linhas] = await pool.execute(
    `SELECT ${CAMPOS}
       FROM contratos ct
       JOIN clientes c ON c.id = ct.cliente_id
       JOIN servicos s ON s.id = ct.servico_id
       ${onde}
      ORDER BY (ct.status = 'pendente') DESC, c.nome`,
    valores
  );

  res.json(linhas);
}));

// GET /api/contratos/totais — cartões do topo da tela
router.get('/totais', rota(async (req, res) => {
  const [linhas] = await pool.query(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN status = 'assinado' THEN 1 ELSE 0 END) AS assinados,
            SUM(CASE WHEN status = 'pendente' THEN 1 ELSE 0 END) AS pendentes,
            SUM(CASE WHEN status = 'cancelado' THEN 1 ELSE 0 END) AS cancelados
       FROM contratos`
  );
  res.json(linhas[0]);
}));

// GET /api/contratos/:id
router.get('/:id', rota(async (req, res) => {
  res.json(await buscarContrato(id(req.params.id)));
}));

// POST /api/contratos
router.post('/', rota(async (req, res) => {
  const corpo = req.body || {};

  const status = opcao(corpo.status, 'status', STATUS, 'pendente');
  const assinadoEm = status === 'assinado' ? new Date() : null;

  const [resultado] = await pool.execute(
    `INSERT INTO contratos (cliente_id, servico_id, status, valor, assinado_em)
     VALUES (?, ?, ?, ?, ?)`,
    [
      id(corpo.cliente_id, 'cliente_id'),
      id(corpo.servico_id, 'servico_id'),
      status,
      decimal(corpo.valor, 'valor'),
      assinadoEm
    ]
  );

  res.status(201).json(await buscarContrato(resultado.insertId));
}));

// PATCH /api/contratos/:id/assinar — idempotente
router.patch('/:id/assinar', rota(async (req, res) => {
  const idContrato = id(req.params.id);
  await buscarContrato(idContrato);

  await pool.execute(
    `UPDATE contratos
        SET status = 'assinado', assinado_em = COALESCE(assinado_em, NOW())
      WHERE id = ?`,
    [idContrato]
  );

  res.json(await buscarContrato(idContrato));
}));

// PUT /api/contratos/:id
router.put('/:id', rota(async (req, res) => {
  const idContrato = id(req.params.id);
  const atual = await buscarContrato(idContrato);
  const corpo = req.body || {};

  const status = opcao(corpo.status, 'status', STATUS, atual.status);

  await pool.execute(
    `UPDATE contratos
        SET status = ?, valor = ?, assinado_em = ?
      WHERE id = ?`,
    [
      status,
      'valor' in corpo ? decimal(corpo.valor, 'valor') : atual.valor,
      status === 'assinado' ? (atual.assinado_em || new Date()) : null,
      idContrato
    ]
  );

  res.json(await buscarContrato(idContrato));
}));

// DELETE /api/contratos/:id
router.delete('/:id', rota(async (req, res) => {
  const [resultado] = await pool.execute('DELETE FROM contratos WHERE id = ?', [id(req.params.id)]);
  if (!resultado.affectedRows) throw new HttpError(404, 'Contrato não encontrado.');
  res.status(204).end();
}));

module.exports = router;
