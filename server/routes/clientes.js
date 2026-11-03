'use strict';

const express = require('express');
const { pool } = require('../db');
const { rota, texto, id, data, opcao, HttpError } = require('../http');

const router = express.Router();

const STATUS = ['ativa', 'pendente', 'inativa'];

const CAMPOS = `
  c.id, c.nome, c.cpf, c.data_nascimento, c.telefone, c.email, c.cidade,
  c.status, c.observacoes, c.servico_principal_id,
  s.nome AS servico_principal,
  c.criado_em, c.atualizado_em
`;

async function buscarCliente(idCliente) {
  const [linhas] = await pool.execute(
    `SELECT ${CAMPOS}
       FROM clientes c
       LEFT JOIN servicos s ON s.id = c.servico_principal_id
      WHERE c.id = ?`,
    [idCliente]
  );
  if (!linhas.length) throw new HttpError(404, 'Cliente não encontrada.');
  return linhas[0];
}

// GET /api/clientes?busca=&status=
router.get('/', rota(async (req, res) => {
  const busca = String(req.query.busca || '').trim();
  const status = String(req.query.status || '').trim();

  const condicoes = [];
  const valores = [];

  if (busca) {
    const like = '%' + busca + '%';
    condicoes.push('(c.nome LIKE ? OR s.nome LIKE ? OR c.email LIKE ? OR c.telefone LIKE ?)');
    valores.push(like, like, like, like);
  }

  if (status) {
    if (!STATUS.includes(status)) {
      throw new HttpError(400, '"status" deve ser: ' + STATUS.join(', ') + '.');
    }
    condicoes.push('c.status = ?');
    valores.push(status);
  }

  const onde = condicoes.length ? 'WHERE ' + condicoes.join(' AND ') : '';

  const [linhas] = await pool.execute(
    `SELECT ${CAMPOS}
       FROM clientes c
       LEFT JOIN servicos s ON s.id = c.servico_principal_id
       ${onde}
      ORDER BY c.nome`,
    valores
  );

  res.json(linhas);
}));

// GET /api/clientes/:id — ficha completa (dados + gestação atual + contratos + atendimentos)
router.get('/:id', rota(async (req, res) => {
  const idCliente = id(req.params.id);
  const cliente = await buscarCliente(idCliente);

  const [gestacao] = await pool.execute(
    'SELECT * FROM vw_gestacao_atual WHERE cliente_id = ?',
    [idCliente]
  );

  const [contratos] = await pool.execute(
    `SELECT ct.id, ct.status, ct.valor, ct.assinado_em, s.nome AS servico
       FROM contratos ct
       JOIN servicos s ON s.id = ct.servico_id
      WHERE ct.cliente_id = ?
      ORDER BY s.nome`,
    [idCliente]
  );

  const [atendimentos] = await pool.execute(
    `SELECT id, data_atendimento, servico, profissional, total_exames
       FROM vw_atendimentos_detalhados
      WHERE cliente_id = ?
      ORDER BY data_atendimento DESC, id DESC`,
    [idCliente]
  );

  res.json({
    ...cliente,
    gestacao_atual: gestacao[0] || null,
    contratos,
    atendimentos
  });
}));

// GET /api/clientes/:id/resumo — linha da view de resumo
router.get('/:id/resumo', rota(async (req, res) => {
  const [linhas] = await pool.execute(
    'SELECT * FROM vw_resumo_cliente WHERE id = ?',
    [id(req.params.id)]
  );
  if (!linhas.length) throw new HttpError(404, 'Cliente não encontrada.');
  res.json(linhas[0]);
}));

// POST /api/clientes
router.post('/', rota(async (req, res) => {
  const corpo = req.body || {};

  const [resultado] = await pool.execute(
    `INSERT INTO clientes
       (nome, cpf, data_nascimento, telefone, email, cidade, servico_principal_id, status, observacoes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      texto(corpo.nome, 'nome', { max: 140 }),
      texto(corpo.cpf, 'cpf', { obrigatorio: false, max: 14 }),
      data(corpo.data_nascimento, 'data_nascimento'),
      texto(corpo.telefone, 'telefone', { obrigatorio: false, max: 20 }),
      texto(corpo.email, 'email', { obrigatorio: false, max: 160 }),
      texto(corpo.cidade, 'cidade', { obrigatorio: false, max: 120 }),
      corpo.servico_principal_id ? id(corpo.servico_principal_id, 'servico_principal_id') : null,
      opcao(corpo.status, 'status', STATUS, 'ativa'),
      texto(corpo.observacoes, 'observacoes', { obrigatorio: false, max: 2000 })
    ]
  );

  res.status(201).json(await buscarCliente(resultado.insertId));
}));

// PATCH e PUT /api/clientes/:id — atualização parcial
async function atualizarCliente(req, res) {
  const idCliente = id(req.params.id);
  await buscarCliente(idCliente);

  const corpo = req.body || {};
  const campos = [];
  const valores = [];

  if ('nome' in corpo) { campos.push('nome = ?'); valores.push(texto(corpo.nome, 'nome', { max: 140 })); }
  if ('cpf' in corpo) { campos.push('cpf = ?'); valores.push(texto(corpo.cpf, 'cpf', { obrigatorio: false, max: 14 })); }
  if ('data_nascimento' in corpo) { campos.push('data_nascimento = ?'); valores.push(data(corpo.data_nascimento, 'data_nascimento')); }
  if ('telefone' in corpo) { campos.push('telefone = ?'); valores.push(texto(corpo.telefone, 'telefone', { obrigatorio: false, max: 20 })); }
  if ('email' in corpo) { campos.push('email = ?'); valores.push(texto(corpo.email, 'email', { obrigatorio: false, max: 160 })); }
  if ('cidade' in corpo) { campos.push('cidade = ?'); valores.push(texto(corpo.cidade, 'cidade', { obrigatorio: false, max: 120 })); }
  if ('observacoes' in corpo) { campos.push('observacoes = ?'); valores.push(texto(corpo.observacoes, 'observacoes', { obrigatorio: false, max: 2000 })); }
  if ('servico_principal_id' in corpo) {
    campos.push('servico_principal_id = ?');
    valores.push(corpo.servico_principal_id ? id(corpo.servico_principal_id, 'servico_principal_id') : null);
  }
  if ('status' in corpo) { campos.push('status = ?'); valores.push(opcao(corpo.status, 'status', STATUS, 'ativa')); }

  if (!campos.length) throw new HttpError(400, 'Informe ao menos um campo para atualizar.');

  valores.push(idCliente);
  await pool.execute(`UPDATE clientes SET ${campos.join(', ')} WHERE id = ?`, valores);

  res.json(await buscarCliente(idCliente));
}

router.patch('/:id', rota(atualizarCliente));
router.put('/:id', rota(atualizarCliente));

// DELETE /api/clientes/:id — remove em cascata gestações, atendimentos, contratos...
router.delete('/:id', rota(async (req, res) => {
  const [resultado] = await pool.execute('DELETE FROM clientes WHERE id = ?', [id(req.params.id)]);
  if (!resultado.affectedRows) throw new HttpError(404, 'Cliente não encontrada.');
  res.status(204).end();
}));

module.exports = router;
