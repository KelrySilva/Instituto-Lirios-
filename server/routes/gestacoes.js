'use strict';

const express = require('express');
const { pool } = require('../db');
const { rota, texto, id, data, opcao, inteiro, somarDias, HttpError } = require('../http');

const router = express.Router();

const TIPOS_PARTO = ['normal', 'cesarea', 'a_definir'];
const SEXOS = ['feminino', 'masculino', 'nao_informado'];
const MOVIMENTACOES = ['ativas', 'pouco_ativas', 'ainda_nao_sente'];

const CAMPOS = `
  id, cliente_id, dum, dpp, tipo_parto, bebe_nome, bebe_sexo,
  movimentacoes, observacoes, encerrada_em, criado_em, atualizado_em
`;

async function buscarGestacao(idGestacao) {
  const [linhas] = await pool.execute(
    `SELECT ${CAMPOS} FROM gestacoes WHERE id = ?`,
    [idGestacao]
  );
  if (!linhas.length) throw new HttpError(404, 'Gestação não encontrada.');
  return linhas[0];
}

// GET /api/gestacoes?cliente_id=
router.get('/', rota(async (req, res) => {
  const clienteId = req.query.cliente_id ? id(req.query.cliente_id, 'cliente_id') : null;

  const [linhas] = clienteId
    ? await pool.execute(
        `SELECT ${CAMPOS} FROM gestacoes WHERE cliente_id = ? ORDER BY dum DESC`,
        [clienteId]
      )
    : await pool.query(`SELECT ${CAMPOS} FROM gestacoes ORDER BY dum DESC`);

  res.json(linhas);
}));

// GET /api/gestacoes/atual?cliente_id=1
router.get('/atual', rota(async (req, res) => {
  const clienteId = id(req.query.cliente_id, 'cliente_id');
  const [linhas] = await pool.execute(
    'SELECT * FROM vw_gestacao_atual WHERE cliente_id = ?',
    [clienteId]
  );
  if (!linhas.length) throw new HttpError(404, 'Esta cliente não tem gestação em acompanhamento.');
  res.json(linhas[0]);
}));

// POST /api/gestacoes
router.post('/', rota(async (req, res) => {
  const corpo = req.body || {};
  const clienteId = id(corpo.cliente_id, 'cliente_id');
  const dum = data(corpo.dum, 'dum', { obrigatorio: true });
  // A DPP é sempre DUM + 280 dias; o valor informado é ignorado de propósito.
  const dpp = somarDias(dum, 280);

  const [abertas] = await pool.execute(
    'SELECT id FROM gestacoes WHERE cliente_id = ? AND encerrada_em IS NULL',
    [clienteId]
  );
  if (abertas.length) {
    throw new HttpError(409,
      'Esta cliente já tem uma gestação em acompanhamento. Encerre a anterior antes de abrir outra.');
  }

  const [resultado] = await pool.execute(
    `INSERT INTO gestacoes
       (cliente_id, dum, dpp, tipo_parto, bebe_nome, bebe_sexo, movimentacoes, observacoes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      clienteId,
      dum,
      dpp,
      opcao(corpo.tipo_parto, 'tipo_parto', TIPOS_PARTO, 'a_definir'),
      texto(corpo.bebe_nome, 'bebe_nome', { obrigatorio: false, max: 80 }),
      opcao(corpo.bebe_sexo, 'bebe_sexo', SEXOS, 'nao_informado'),
      opcao(corpo.movimentacoes, 'movimentacoes', MOVIMENTACOES, 'ativas'),
      texto(corpo.observacoes, 'observacoes', { obrigatorio: false, max: 2000 })
    ]
  );

  res.status(201).json(await buscarGestacao(resultado.insertId));
}));

// PUT /api/gestacoes/:id
router.put('/:id', rota(async (req, res) => {
  const idGestacao = id(req.params.id);
  const atual = await buscarGestacao(idGestacao);
  const corpo = req.body || {};

  const dum = 'dum' in corpo ? data(corpo.dum, 'dum', { obrigatorio: true }) : atual.dum;
  const dpp = somarDias(dum, 280);

  await pool.execute(
    `UPDATE gestacoes
        SET dum = ?, dpp = ?, tipo_parto = ?, bebe_nome = ?, bebe_sexo = ?,
            movimentacoes = ?, observacoes = ?
      WHERE id = ?`,
    [
      dum,
      dpp,
      opcao(corpo.tipo_parto, 'tipo_parto', TIPOS_PARTO, atual.tipo_parto),
      'bebe_nome' in corpo
        ? texto(corpo.bebe_nome, 'bebe_nome', { obrigatorio: false, max: 80 })
        : atual.bebe_nome,
      opcao(corpo.bebe_sexo, 'bebe_sexo', SEXOS, atual.bebe_sexo),
      opcao(corpo.movimentacoes, 'movimentacoes', MOVIMENTACOES, atual.movimentacoes),
      'observacoes' in corpo
        ? texto(corpo.observacoes, 'observacoes', { obrigatorio: false, max: 2000 })
        : atual.observacoes,
      idGestacao
    ]
  );

  res.json(await buscarGestacao(idGestacao));
}));

// PATCH /api/gestacoes/:id/encerrar
router.patch('/:id/encerrar', rota(async (req, res) => {
  const idGestacao = id(req.params.id);
  await buscarGestacao(idGestacao);

  const encerradaEm = data(req.body && req.body.encerrada_em, 'encerrada_em') || null;

  await pool.execute(
    'UPDATE gestacoes SET encerrada_em = COALESCE(?, CURDATE()) WHERE id = ?',
    [encerradaEm, idGestacao]
  );

  res.json(await buscarGestacao(idGestacao));
}));

// DELETE /api/gestacoes/:id
router.delete('/:id', rota(async (req, res) => {
  const [resultado] = await pool.execute('DELETE FROM gestacoes WHERE id = ?', [id(req.params.id)]);
  if (!resultado.affectedRows) throw new HttpError(404, 'Gestação não encontrada.');
  res.status(204).end();
}));

module.exports = router;
