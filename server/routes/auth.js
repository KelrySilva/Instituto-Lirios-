'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { rota, texto, HttpError } = require('../http');
const {
  criarToken, exigirLoginSemBloqueio, criarTokenRedefinicao, verificarTokenRedefinicao, marcaDaSenha
} = require('../auth-token');
const email = require('../email');
const limite = require('../limite');
const { ehSenhaPadrao, validarNovaSenha } = require('../senha');

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

  // Entrou com a senha de demonstração (publicada no GitHub): precisa trocá-la.
  const trocar = ehSenhaPadrao(senha);
  res.json({ ...dados, token: criarToken({ ...dados, trocar }), precisa_trocar_senha: trocar });
}));

/**
 * POST /api/auth/trocar-senha   { senha_atual, nova_senha }
 * Exige estar logado. Devolve um token novo (já sem a marca de senha de demonstração).
 */
router.post('/trocar-senha', exigirLoginSemBloqueio, rota(async (req, res) => {
  const corpo = req.body || {};
  const atual = texto(corpo.senha_atual, 'senha_atual', { max: 100 });
  const nova = texto(corpo.nova_senha, 'nova_senha', { max: 100 });

  const [linhas] = await pool.execute(
    'SELECT id, nome, email, senha_hash, perfil, ativo FROM usuarios WHERE id = ?',
    [req.usuario.id]
  );
  const usuario = linhas[0];
  if (!usuario || !usuario.ativo) throw new HttpError(401, 'Faça login para continuar.');

  // 400 (e não 401) para não confundir com sessão vencida: a pessoa só errou a senha atual.
  if (!(await bcrypt.compare(atual, usuario.senha_hash))) {
    throw new HttpError(400, 'A senha atual não confere.');
  }

  const problema = validarNovaSenha(nova, { email: usuario.email, atual });
  if (problema) throw new HttpError(400, problema);

  await pool.execute('UPDATE usuarios SET senha_hash = ? WHERE id = ?', [await bcrypt.hash(nova, 12), usuario.id]);

  const dados = { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil };
  res.json({ ...dados, token: criarToken(dados), precisa_trocar_senha: false });
}));


/**
 * POST /api/auth/esqueci-senha   { email }
 * Público. Manda por e-mail um link (vale 30 min, uso único) para criar nova senha.
 * A resposta é sempre a mesma, exista ou não o e-mail, para não revelar quem é cadastrado.
 */
router.post('/esqueci-senha', rota(async (req, res) => {
  const endereco = texto((req.body || {}).email, 'email', { max: 160 }).toLowerCase();
  const resposta = {
    ok: true,
    mensagem: 'Se este e-mail estiver cadastrado, enviamos um link para criar uma nova senha. Confira também a caixa de spam.'
  };

  // Limites: poucos pedidos por e-mail e por origem, para ninguém usar isto para incomodar terceiros.
  const dentroDoLimite = limite.permitir('esqueci-ip:' + req.ip, 10, 15 * 60 * 1000) &&
    limite.permitir('esqueci-mail:' + endereco, 3, 15 * 60 * 1000);
  if (!dentroDoLimite) return res.json(resposta);

  const [linhas] = await pool.execute(
    'SELECT id, nome, email, senha_hash, perfil, ativo FROM usuarios WHERE email = ?',
    [endereco]
  );
  const usuario = linhas[0];
  if (!usuario || !usuario.ativo) return res.json(resposta);

  const link = email.enderecoDoSistema() + '/redefinir-senha.html?token=' +
    encodeURIComponent(criarTokenRedefinicao(usuario));

  // Sem esperar o envio: a resposta demora igual para e-mails cadastrados e não cadastrados.
  email.enviarRecuperacao({ para: usuario.email, nome: usuario.nome, link })
    .catch((erro) => console.error('[e-mail] falha ao enviar a recuperação de senha:', erro.message));

  return res.json(resposta);
}));

/**
 * POST /api/auth/redefinir-senha   { token, nova_senha }
 * Público (o token do e-mail é a prova). O link deixa de valer assim que a senha muda.
 */
router.post('/redefinir-senha', rota(async (req, res) => {
  const corpo = req.body || {};
  const invalido = () => new HttpError(400, 'Este link não é mais válido. Peça um novo em "Esqueci minha senha".');

  if (!limite.permitir('redefinir-ip:' + req.ip, 20, 15 * 60 * 1000)) {
    throw new HttpError(429, 'Muitas tentativas. Aguarde alguns minutos e tente de novo.');
  }

  const dados = verificarTokenRedefinicao(String(corpo.token || ''));
  if (!dados) throw invalido();

  const nova = texto(corpo.nova_senha, 'nova_senha', { max: 100 });

  const [linhas] = await pool.execute(
    'SELECT id, nome, email, senha_hash, perfil, ativo FROM usuarios WHERE id = ?',
    [dados.u]
  );
  const usuario = linhas[0];
  // A marca da senha muda quando a senha muda: link já usado (ou senha trocada depois) não vale.
  if (!usuario || !usuario.ativo || marcaDaSenha(usuario.senha_hash) !== dados.f) throw invalido();

  const problema = validarNovaSenha(nova, { email: usuario.email });
  if (problema) throw new HttpError(400, problema);

  await pool.execute('UPDATE usuarios SET senha_hash = ? WHERE id = ?', [await bcrypt.hash(nova, 12), usuario.id]);
  res.json({ ok: true, mensagem: 'Senha alterada. Entre com a nova senha.' });
}));

module.exports = router;
