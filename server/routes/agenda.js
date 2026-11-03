'use strict';

const express = require('express');
const { pool } = require('../db');
const { rota, id, dataHora, inteiro, texto, opcao, HttpError } = require('../http');

const router = express.Router();

const STATUS = ['agendado', 'concluido', 'cancelado', 'faltou'];

const CAMPOS = `
  ag.id, ag.cliente_id, ag.servico_id, ag.profissional_id, ag.inicio,
  ag.duracao_min, ag.status, ag.observacao, ag.criado_em,
  c.nome AS cliente, s.nome AS servico, u.nome AS profissional
`;

async function buscarAgendamento(idAgendamento) {
  const [linhas] = await pool.execute(
    `SELECT ${CAMPOS}
       FROM agendamentos ag
       JOIN clientes c ON c.id = ag.cliente_id
       JOIN servicos s ON s.id = ag.servico_id
       LEFT JOIN usuarios u ON u.id = ag.profissional_id
      WHERE ag.id = ?`,
    [idAgendamento]
  );
  if (!linhas.length) throw new HttpError(404, 'Agendamento não encontrado.');
  return linhas[0];
}

/** Aceita 'AAAA-MM-DD' (completa com a hora padrão) ou 'AAAA-MM-DD HH:MM'. */
function limite(valor, campo, horaPadrao) {
  if (!valor) return null;
  const textoValor = String(valor).replace('T', ' ');
  if (/^\d{4}-\d{2}-\d{2}$/.test(textoValor)) return textoValor + ' ' + horaPadrao;
  return dataHora(textoValor, campo);
}

// GET /api/agenda?de=&ate=&cliente_id=
router.get('/', rota(async (req, res) => {
  const de = limite(req.query.de, 'de', '00:00:00');
  const ate = limite(req.query.ate, 'ate', '23:59:59');

  const condicoes = [];
  const valores = [];

  if (de) { condicoes.push('ag.inicio >= ?'); valores.push(de); }
  if (ate) { condicoes.push('ag.inicio <= ?'); valores.push(ate); }
  if (req.query.cliente_id) {
    condicoes.push('ag.cliente_id = ?');
    valores.push(id(req.query.cliente_id, 'cliente_id'));
  }
  if (req.query.status) {
    condicoes.push('ag.status = ?');
    valores.push(opcao(req.query.status, 'status', STATUS));
  }

  const onde = condicoes.length ? 'WHERE ' + condicoes.join(' AND ') + ' ' : '';

  const [linhas] = await pool.execute(
    `SELECT ${CAMPOS}
       FROM agendamentos ag
       JOIN clientes c ON c.id = ag.cliente_id
       JOIN servicos s ON s.id = ag.servico_id
       LEFT JOIN usuarios u ON u.id = ag.profissional_id
       ${onde}
      ORDER BY ag.inicio`,
    valores
  );

  res.json(linhas);
}));

// GET /api/agenda/hoje
router.get('/hoje', rota(async (req, res) => {
  const [linhas] = await pool.query(
    `SELECT ${CAMPOS}
       FROM agendamentos ag
       JOIN clientes c ON c.id = ag.cliente_id
       JOIN servicos s ON s.id = ag.servico_id
       LEFT JOIN usuarios u ON u.id = ag.profissional_id
      WHERE DATE(ag.inicio) = CURDATE()
        AND ag.status <> 'cancelado'
      ORDER BY ag.inicio`
  );
  res.json(linhas);
}));

// POST /api/agenda
router.post('/', rota(async (req, res) => {
  const corpo = req.body || {};
  const servicoId = id(corpo.servico_id, 'servico_id');
  const inicio = dataHora(corpo.inicio, 'inicio');

  // Se a duração não vier, usa a do serviço.
  let duracao = inteiro(corpo.duracao_min, 'duracao_min', { min: 1, max: 600 });

  if (!duracao) {
    const [servico] = await pool.execute('SELECT duracao_min FROM servicos WHERE id = ?', [servicoId]);
    if (!servico.length) throw new HttpError(400, 'Serviço inexistente.');
    duracao = servico[0].duracao_min;
  }

  const [resultado] = await pool.execute(
    `INSERT INTO agendamentos
       (cliente_id, servico_id, profissional_id, inicio, duracao_min, status, observacao)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id(corpo.cliente_id, 'cliente_id'),
      servicoId,
      corpo.profissional_id ? id(corpo.profissional_id, 'profissional_id') : null,
      inicio,
      duracao,
      opcao(corpo.status, 'status', STATUS, 'agendado'),
      texto(corpo.observacao, 'observacao', { obrigatorio: false, max: 255 })
    ]
  );

  res.status(201).json(await buscarAgendamento(resultado.insertId));
}));

// PUT /api/agenda/:id
router.put('/:id', rota(async (req, res) => {
  const idAgendamento = id(req.params.id);
  const atual = await buscarAgendamento(idAgendamento);
  const corpo = req.body || {};

  await pool.execute(
    `UPDATE agendamentos
        SET cliente_id = ?, servico_id = ?, profissional_id = ?, inicio = ?,
            duracao_min = ?, status = ?, observacao = ?
      WHERE id = ?`,
    [
      'cliente_id' in corpo ? id(corpo.cliente_id, 'cliente_id') : atual.cliente_id,
      'servico_id' in corpo ? id(corpo.servico_id, 'servico_id') : atual.servico_id,
      'profissional_id' in corpo
        ? (corpo.profissional_id ? id(corpo.profissional_id, 'profissional_id') : null)
        : atual.profissional_id,
      'inicio' in corpo ? dataHora(corpo.inicio, 'inicio') : atual.inicio,
      'duracao_min' in corpo
        ? inteiro(corpo.duracao_min, 'duracao_min', { min: 1, max: 600, padrao: atual.duracao_min })
        : atual.duracao_min,
      opcao(corpo.status, 'status', STATUS, atual.status),
      'observacao' in corpo
        ? texto(corpo.observacao, 'observacao', { obrigatorio: false, max: 255 })
        : atual.observacao,
      idAgendamento
    ]
  );

  res.json(await buscarAgendamento(idAgendamento));
}));

// PATCH /api/agenda/:id/status
router.patch('/:id/status', rota(async (req, res) => {
  const idAgendamento = id(req.params.id);
  const status = opcao(req.body && req.body.status, 'status', STATUS);
  if (!status) throw new HttpError(400, '"status" é obrigatório.');

  const [resultado] = await pool.execute(
    'UPDATE agendamentos SET status = ? WHERE id = ?',
    [status, idAgendamento]
  );
  if (!resultado.affectedRows) throw new HttpError(404, 'Agendamento não encontrado.');

  res.json(await buscarAgendamento(idAgendamento));
}));

// DELETE /api/agenda/:id
router.delete('/:id', rota(async (req, res) => {
  const [resultado] = await pool.execute('DELETE FROM agendamentos WHERE id = ?', [id(req.params.id)]);
  if (!resultado.affectedRows) throw new HttpError(404, 'Agendamento não encontrado.');
  res.status(204).end();
}));

module.exports = router;
