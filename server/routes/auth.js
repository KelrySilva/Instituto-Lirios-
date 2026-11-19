'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { rota, texto, HttpError } = require('../http');
const { criarToken } = require('../auth-token');

const router = express.Router();

/**
 * POST /api/auth/login
 * Valida e-mail e senha (hash bcrypt gravado em usuarios.senha_hash) e devolve
 * os dados do usuário junto com um token, que as demais rotas exigem.
 */
router.post('/login', rota(async (req, res) => {
  const corpo = req.body || {};
  const email = texto(corpo.email, 'email', { max: 160 }).toLowerCase();
  const senha = texto(corpo.senha, 'senha', { max: 100 });

  const [linhas] = await pool.execute(
    'SELECT id, nome, email, senha_hash, perfil, ativo FROM usuarios WHERE email = ?',
    [email]
  );

  const usuario = linhas[0];
  const confere = usuario ? await bcrypt.compare(senha, usuario.senha_hash) : false;

  if (!usuario || !usuario.ativo || !confere) {
    throw new HttpError(401, 'E-mail ou senha inválidos.');
  }

  const dados = { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil };
  res.json({ ...dados, token: criarToken(dados) });
}));

module.exports = router;
