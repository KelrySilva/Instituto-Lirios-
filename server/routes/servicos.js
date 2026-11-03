'use strict';

const express = require('express');
const { pool } = require('../db');
const { rota, texto, id, inteiro, decimal, HttpError } = require('../http');

const router = express.Router();

// GET /api/servicos
router.get('/', rota(async (req, res) => {
  const [linhas] = await pool.query(
    'SELECT id, nome, descricao, duracao_min, valor, ativo FROM servicos ORDER BY nome'
  );
  res.json(linhas);
}));

// GET /api/servicos/:id
router.get('/:id', rota(async (req, res) => {
  const [linhas] = await pool.execute(
    'SELECT id, nome, descricao, duracao_min, valor, ativo FROM servicos WHERE id = ?',
    [id(req.params.id)]
  );
  if (!linhas.length) throw new HttpError(404, 'Serviço não encontrado.');
  res.json(linhas[0]);
}));

// POST /api/servicos
router.post('/', rota(async (req, res) => {
  const corpo = req.body || {};

  const [resultado] = await pool.execute(
    'INSERT INTO servicos (nome, descricao, duracao_min, valor) VALUES (?, ?, ?, ?)',
    [
      texto(corpo.nome, 'nome', { max: 100 }),
      texto(corpo.descricao, 'descricao', { obrigatorio: false, max: 255 }),
      inteiro(corpo.duracao_min, 'duracao_min', { min: 1, max: 600, padrao: 60 }),
      decimal(corpo.valor, 'valor')
    ]
  );

  const [linhas] = await pool.execute('SELECT * FROM servicos WHERE id = ?', [resultado.insertId]);
  res.status(201).json(linhas[0]);
}));

// PUT /api/servicos/:id
router.put('/:id', rota(async (req, res) => {
  const idServico = id(req.params.id);
  const corpo = req.body || {};

  const [resultado] = await pool.execute(
    'UPDATE servicos SET nome = ?, descricao = ?, duracao_min = ?, valor = ?, ativo = ? WHERE id = ?',
    [
      texto(corpo.nome, 'nome', { max: 100 }),
      texto(corpo.descricao, 'descricao', { obrigatorio: false, max: 255 }),
      inteiro(corpo.duracao_min, 'duracao_min', { min: 1, max: 600, padrao: 60 }),
      decimal(corpo.valor, 'valor'),
      corpo.ativo === false || corpo.ativo === 0 ? 0 : 1,
      idServico
    ]
  );

  if (!resultado.affectedRows) throw new HttpError(404, 'Serviço não encontrado.');

  const [linhas] = await pool.execute('SELECT * FROM servicos WHERE id = ?', [idServico]);
  res.json(linhas[0]);
}));

// DELETE /api/servicos/:id
router.delete('/:id', rota(async (req, res) => {
  const [resultado] = await pool.execute('DELETE FROM servicos WHERE id = ?', [id(req.params.id)]);
  if (!resultado.affectedRows) throw new HttpError(404, 'Serviço não encontrado.');
  res.status(204).end();
}));

module.exports = router;
