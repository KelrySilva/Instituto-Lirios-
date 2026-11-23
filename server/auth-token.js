'use strict';

/**
 * Token de login (assinado com HMAC-SHA256, sem biblioteca extra).
 *
 * Formato:  <dados em base64url>.<assinatura>
 * Os dados levam id, nome, e-mail, perfil e a hora de expiração. Quem não
 * tem o segredo (AUTH_SECRET) não consegue fabricar nem alterar um token.
 */

const crypto = require('node:crypto');
const { HttpError } = require('./http');

let segredoCache = null;
let usandoSegredoTemporario = false;

function obterSegredo() {
  if (segredoCache) return segredoCache;
  const doEnv = process.env.AUTH_SECRET;
  if (doEnv && doEnv.length >= 16) {
    segredoCache = doEnv;
  } else {
    // Sem AUTH_SECRET no .env: segredo aleatório que vale até reiniciar a API.
    segredoCache = crypto.randomBytes(32).toString('hex');
    usandoSegredoTemporario = true;
  }
  return segredoCache;
}

function segredoTemporario() {
  obterSegredo();
  return usandoSegredoTemporario;
}

function horasDeValidade() {
  const horas = Number(process.env.TOKEN_HORAS || 8);
  return Number.isFinite(horas) && horas > 0 ? horas : 8;
}

function assinar(corpo) {
  return crypto.createHmac('sha256', obterSegredo()).update(corpo).digest('base64url');
}

function criarToken(usuario) {
  const dados = {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    perfil: usuario.perfil,
    // 1 = entrou com a senha de demonstração: só pode trocar a senha até corrigir isso
    tr: usuario.trocar ? 1 : 0,
    exp: Math.floor(Date.now() / 1000) + Math.round(horasDeValidade() * 3600)
  };
  const corpo = Buffer.from(JSON.stringify(dados)).toString('base64url');
  return corpo + '.' + assinar(corpo);
}

/** Devolve os dados do usuário se o token for válido e não tiver vencido; senão, null. */
function verificarToken(token) {
  if (typeof token !== 'string') return null;
  const partes = token.split('.');
  if (partes.length !== 2 || !partes[0] || !partes[1]) return null;

  const recebida = Buffer.from(partes[1]);
  const esperada = Buffer.from(assinar(partes[0]));
  if (recebida.length !== esperada.length || !crypto.timingSafeEqual(recebida, esperada)) return null;

  let dados;
  try {
    dados = JSON.parse(Buffer.from(partes[0], 'base64url').toString('utf8'));
  } catch (erro) {
    return null;
  }
  if (!dados || !dados.exp || dados.exp < Date.now() / 1000) return null;
  if (dados.t) return null; // token de outra finalidade (ex.: link de redefinição) não serve para entrar
  return dados;
}

/* ----------------- link de redefinição de senha (e-mail) ----------------- */

const MINUTOS_REDEFINICAO = 30;

/** Marca do hash atual: se a senha mudar, o link antigo para de valer (uso único). */
function marcaDaSenha(senhaHash) {
  return crypto.createHash('sha256').update(String(senhaHash)).digest('hex').slice(0, 16);
}

function assinarRedefinicao(corpo) {
  // contexto diferente do login: a assinatura de um nunca vale para o outro
  return crypto.createHmac('sha256', obterSegredo()).update('redefinir-senha:' + corpo).digest('base64url');
}

function criarTokenRedefinicao(usuario) {
  const dados = {
    t: 'rs',
    u: usuario.id,
    f: marcaDaSenha(usuario.senha_hash),
    e: Math.floor(Date.now() / 1000) + MINUTOS_REDEFINICAO * 60
  };
  const corpo = Buffer.from(JSON.stringify(dados)).toString('base64url');
  return corpo + '.' + assinarRedefinicao(corpo);
}

/** Devolve { u, f } se o link for autêntico e não tiver vencido; senão, null. */
function verificarTokenRedefinicao(token) {
  if (typeof token !== 'string') return null;
  const partes = token.split('.');
  if (partes.length !== 2 || !partes[0] || !partes[1]) return null;

  const recebida = Buffer.from(partes[1]);
  const esperada = Buffer.from(assinarRedefinicao(partes[0]));
  if (recebida.length !== esperada.length || !crypto.timingSafeEqual(recebida, esperada)) return null;

  let dados;
  try {
    dados = JSON.parse(Buffer.from(partes[0], 'base64url').toString('utf8'));
  } catch (erro) {
    return null;
  }
  if (!dados || dados.t !== 'rs' || !dados.u || !dados.e || dados.e < Date.now() / 1000) return null;
  return dados;
}

/**
 * Cria o middleware de login.
 * Sem token válido: 401. Com token de "senha de demonstração": 403 (código
 * TROCAR_SENHA), a não ser que a rota aceite esse caso (a própria troca de senha).
 */
function autenticar(bloquearSenhaPadrao) {
  return function (req, res, next) {
    const cabecalho = req.headers.authorization || '';
    const encontrado = /^Bearer (.+)$/.exec(cabecalho);
    const dados = encontrado ? verificarToken(encontrado[1]) : null;
    if (!dados) return next(new HttpError(401, 'Faça login para continuar.'));
    if (bloquearSenhaPadrao && dados.tr) {
      return next(new HttpError(403, 'Troque a senha de demonstração para continuar.', 'TROCAR_SENHA'));
    }
    req.usuario = dados;
    return next();
  };
}

/** Middleware: bloqueia a rota (401) se não vier "Authorization: Bearer <token>" válido. */
const exigirLogin = autenticar(true);

/** Igual ao anterior, mas aceita quem ainda está com a senha de demonstração. */
const exigirLoginSemBloqueio = autenticar(false);

module.exports = {
  criarToken, verificarToken, exigirLogin, exigirLoginSemBloqueio, segredoTemporario,
  criarTokenRedefinicao, verificarTokenRedefinicao, marcaDaSenha
};
