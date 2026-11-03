'use strict';

const express = require('express');
const { HttpError } = require('./http');
const { verificarConexao } = require('./db');

const app = express();
app.disable('x-powered-by');

app.use(express.json({ limit: '1mb' }));

// CORS — em desenvolvimento o site pode ser aberto por file:// ou em outra porta.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});

// Verificação de saúde: útil para saber se o MySQL respondeu.
app.get('/api/health', async (req, res) => {
  try {
    await verificarConexao();
    res.json({ ok: true, banco: 'conectado' });
  } catch (erro) {
    res.status(503).json({
      ok: false,
      banco: 'indisponivel',
      dica: 'Confira se o MySQL está ligado e se o .env aponta para o banco correto.'
    });
  }
});

app.use('/api', require('./routes'));

// 404
app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada: ' + req.method + ' ' + req.originalUrl });
});

// Tratador central de erros
// eslint-disable-next-line no-unused-vars
app.use((erro, req, res, next) => {
  if (erro instanceof HttpError) {
    return res.status(erro.status).json({ erro: erro.message, detalhes: erro.detalhes });
  }

  switch (erro && erro.code) {
    case 'ER_DUP_ENTRY':
      return res.status(409).json({
        erro: 'Já existe um registro com esses dados.',
        detalhes: erro.sqlMessage
      });
    case 'ER_NO_REFERENCED_ROW_2':
      return res.status(400).json({
        erro: 'O registro referenciado não existe.',
        detalhes: erro.sqlMessage
      });
    case 'ER_ROW_IS_REFERENCED_2':
      return res.status(409).json({
        erro: 'Este registro está em uso e não pode ser excluído.',
        detalhes: erro.sqlMessage
      });
    case 'ECONNREFUSED':
    case 'PROTOCOL_CONNECTION_LOST':
      return res.status(503).json({
        erro: 'Banco de dados indisponível. O MySQL está rodando?'
      });
    case 'ER_NO_SUCH_TABLE':
      return res.status(500).json({
        erro: 'Tabela não encontrada. Rode db/schema.sql e db/seed.sql.',
        detalhes: erro.sqlMessage
      });
    case 'ER_BAD_FIELD_ERROR':
      return res.status(500).json({
        erro: 'Coluna inexistente na consulta — o banco está com o schema atualizado?',
        detalhes: erro.sqlMessage
      });
    default:
      console.error('[erro]', erro);
      return res.status(500).json({ erro: 'Erro interno no servidor.' });
  }
});

module.exports = app;
