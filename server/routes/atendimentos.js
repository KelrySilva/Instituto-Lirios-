'use strict';

const express = require('express');
const { pool, transacao } = require('../db');
const { rota, texto, id, data, inteiro, HttpError } = require('../http');

const router = express.Router();

async function buscarAtendimento(idAtendimento) {
  const [linhas] = await pool.execute(
    `SELECT *
       FROM vw_atendimentos_detalhados
      WHERE id = ?`,
    [idAtendimento]
  );
  if (!linhas.length) throw new HttpError(404, 'Atendimento não encontrado.');

  const [exames] = await pool.execute(
    'SELECT id, nome, resultado FROM atendimento_exames WHERE atendimento_id = ? ORDER BY nome',
    [idAtendimento]
  );

  return { ...linhas[0], exames };
}

/** Normaliza o array de exames aceito no corpo: ['Hemograma'] ou [{nome, resultado}]. */
function lerExames(valor) {
  if (valor === undefined || valor === null) return null;
  if (!Array.isArray(valor)) {
    throw new HttpError(400, '"exames" deve ser uma lista.');
  }

  return valor.map((item) => {
    if (typeof item === 'string') {
      return { nome: texto(item, 'exames[].nome', { max: 120 }), resultado: null };
    }
    if (!item || typeof item !== 'object') {
      throw new HttpError(400, 'Cada exame deve ser texto ou objeto { nome, resultado }.');
    }
    return {
      nome: texto(item.nome, 'exames[].nome', { max: 120 }),
      resultado: texto(item.resultado, 'exames[].resultado', { obrigatorio: false, max: 255 })
    };
  });
}

// GET /api/atendimentos?cliente_id=&de=&ate=
router.get('/', rota(async (req, res) => {
  const condicoes = [];
  const valores = [];

  if (req.query.cliente_id) {
    condicoes.push('cliente_id = ?');
    valores.push(id(req.query.cliente_id, 'cliente_id'));
  }
  if (req.query.de) {
    condicoes.push('data_atendimento >= ?');
    valores.push(data(req.query.de, 'de'));
  }
  if (req.query.ate) {
    condicoes.push('data_atendimento <= ?');
    valores.push(data(req.query.ate, 'ate'));
  }

  const onde = condicoes.length ? 'WHERE ' + condicoes.join(' AND ') + ' ' : '';

  const [linhas] = await pool.execute(
    `SELECT id, data_atendimento, cliente_id, cliente, servico, profissional,
            total_exames, bpm, movimentacoes
       FROM vw_atendimentos_detalhados
       ${onde}
      ORDER BY data_atendimento DESC, id DESC`,
    valores
  );

  res.json(linhas);
}));

// GET /api/atendimentos/exames?cliente_id= — exames com a data do atendimento
router.get('/exames', rota(async (req, res) => {
  const condicoes = [];
  const valores = [];

  if (req.query.cliente_id) {
    condicoes.push('a.cliente_id = ?');
    valores.push(id(req.query.cliente_id, 'cliente_id'));
  }

  const onde = condicoes.length ? 'WHERE ' + condicoes.join(' AND ') + ' ' : '';

  const [linhas] = await pool.execute(
    `SELECT e.id, e.nome, e.resultado, a.data_atendimento AS data, a.cliente_id
       FROM atendimento_exames e
       JOIN atendimentos a ON a.id = e.atendimento_id
       ${onde}
      ORDER BY a.data_atendimento DESC, e.nome`,
    valores
  );

  res.json(linhas);
}));

// GET /api/atendimentos/:id
router.get('/:id', rota(async (req, res) => {
  res.json(await buscarAtendimento(id(req.params.id)));
}));

// POST /api/atendimentos  (grava atendimento + exames na mesma transação)
router.post('/', rota(async (req, res) => {
  const corpo = req.body || {};
  const clienteId = id(corpo.cliente_id, 'cliente_id');
  const dataAtendimento = data(corpo.data_atendimento, 'data_atendimento', { obrigatorio: true });
  const exames = lerExames(corpo.exames) || [];

  const idAtendimento = await transacao(async (conexao) => {
    const [resultado] = await conexao.execute(
      `INSERT INTO atendimentos
         (cliente_id, servico_id, profissional_id, data_atendimento, anotacoes,
          bpm, movimentacoes, estado_emocional)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clienteId,
        corpo.servico_id ? id(corpo.servico_id, 'servico_id') : null,
        corpo.profissional_id ? id(corpo.profissional_id, 'profissional_id') : null,
        dataAtendimento,
        texto(corpo.anotacoes, 'anotacoes', { obrigatorio: false, max: 5000 }),
        inteiro(corpo.bpm, 'bpm', { min: 30, max: 250 }),
        texto(corpo.movimentacoes, 'movimentacoes', { obrigatorio: false, max: 40 }),
        texto(corpo.estado_emocional, 'estado_emocional', { obrigatorio: false, max: 2000 })
      ]
    );

    for (const exame of exames) {
      await conexao.execute(
        'INSERT INTO atendimento_exames (atendimento_id, nome, resultado) VALUES (?, ?, ?)',
        [resultado.insertId, exame.nome, exame.resultado]
      );
    }

    return resultado.insertId;
  });

  res.status(201).json(await buscarAtendimento(idAtendimento));
}));

// PUT /api/atendimentos/:id  (se "exames" vier, substitui a lista)
router.put('/:id', rota(async (req, res) => {
  const idAtendimento = id(req.params.id);
  const atual = await buscarAtendimento(idAtendimento);
  const corpo = req.body || {};
  const exames = lerExames(corpo.exames);

  await transacao(async (conexao) => {
    await conexao.execute(
      `UPDATE atendimentos
          SET servico_id = ?, profissional_id = ?, data_atendimento = ?, anotacoes = ?,
              bpm = ?, movimentacoes = ?, estado_emocional = ?
        WHERE id = ?`,
      [
        'servico_id' in corpo
          ? (corpo.servico_id ? id(corpo.servico_id, 'servico_id') : null)
          : atual.servico_id,
        'profissional_id' in corpo
          ? (corpo.profissional_id ? id(corpo.profissional_id, 'profissional_id') : null)
          : atual.profissional_id,
        'data_atendimento' in corpo
          ? data(corpo.data_atendimento, 'data_atendimento', { obrigatorio: true })
          : atual.data_atendimento,
        'anotacoes' in corpo
          ? texto(corpo.anotacoes, 'anotacoes', { obrigatorio: false, max: 5000 })
          : atual.anotacoes,
        'bpm' in corpo ? inteiro(corpo.bpm, 'bpm', { min: 30, max: 250 }) : atual.bpm,
        'movimentacoes' in corpo
          ? texto(corpo.movimentacoes, 'movimentacoes', { obrigatorio: false, max: 40 })
          : atual.movimentacoes,
        'estado_emocional' in corpo
          ? texto(corpo.estado_emocional, 'estado_emocional', { obrigatorio: false, max: 2000 })
          : atual.estado_emocional,
        idAtendimento
      ]
    );

    if (exames) {
      await conexao.execute('DELETE FROM atendimento_exames WHERE atendimento_id = ?', [idAtendimento]);
      for (const exame of exames) {
        await conexao.execute(
          'INSERT INTO atendimento_exames (atendimento_id, nome, resultado) VALUES (?, ?, ?)',
          [idAtendimento, exame.nome, exame.resultado]
        );
      }
    }
  });

  res.json(await buscarAtendimento(idAtendimento));
}));

// DELETE /api/atendimentos/:id
router.delete('/:id', rota(async (req, res) => {
  const [resultado] = await pool.execute('DELETE FROM atendimentos WHERE id = ?', [id(req.params.id)]);
  if (!resultado.affectedRows) throw new HttpError(404, 'Atendimento não encontrado.');
  res.status(204).end();
}));

module.exports = router;
