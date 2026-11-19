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
  return dados;
}

/** Middleware: bloqueia a rota (401) se não vier "Authorization: Bearer <token>" válido. */
function exigirLogin(req, res, next) {
  const cabecalho = req.headers.authorization || '';
  const encontrado = /^Bearer (.+)$/.exec(cabecalho);
  const dados = encontrado ? verificarToken(encontrado[1]) : null;
  if (!dados) return next(new HttpError(401, 'Faça login para continuar.'));
  req.usuario = dados;
  return next();
}

module.exports = { criarToken, verificarToken, exigirLogin, segredoTemporario };
