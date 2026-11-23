'use strict';

/**
 * Envio de e-mail (SMTP). Configurado pelo .env:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM (opcional)
 * Sem SMTP_HOST o sistema continua funcionando, só não envia e-mails.
 */

const MINUTOS_DO_LINK = 30;

let transporte = null;

function configurado() {
  return !!(transporte || (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS));
}

function obterTransporte() {
  if (transporte) return transporte;
  const nodemailer = require('nodemailer');
  const porta = Number(process.env.SMTP_PORT || 465);
  transporte = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: porta,
    secure: porta === 465, // 465 = SSL direto; 587 = STARTTLS
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });
  return transporte;
}

/** Usado pelos testes: troca o transporte por um dublê. */
function definirTransporte(novo) { transporte = novo; }

function escapar(texto) {
  return String(texto == null ? '' : texto).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function remetente() {
  return process.env.SMTP_FROM || ('Instituto Lírios <' + process.env.SMTP_USER + '>');
}

/** Endereço do sistema para montar o link. Só vem do .env (nunca do pedido recebido). */
function enderecoDoSistema() {
  return String(process.env.APP_URL || 'http://localhost:8080').replace(/\/+$/, '');
}

function montarRecuperacao({ nome, link }) {
  const primeiro = String(nome || '').trim().split(/\s+/)[0] || 'olá';
  const texto =
    'Olá, ' + primeiro + '!\n\n' +
    'Recebemos um pedido para criar uma nova senha de acesso ao sistema do Instituto Lírios.\n\n' +
    'Para continuar, abra o link abaixo. Ele vale por ' + MINUTOS_DO_LINK + ' minutos e só pode ser usado uma vez:\n' +
    link + '\n\n' +
    'Se você não fez esse pedido, pode ignorar esta mensagem: sua senha continua a mesma.\n\n' +
    'Instituto Lírios';
  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;color:#3A2C22;max-width:520px;margin:0 auto;line-height:1.5;">' +
    '<h2 style="color:#4A2C1B;font-weight:600;">Criar nova senha</h2>' +
    '<p>Olá, ' + escapar(primeiro) + '!</p>' +
    '<p>Recebemos um pedido para criar uma nova senha de acesso ao sistema do Instituto Lírios.</p>' +
    '<p style="margin:26px 0;"><a href="' + escapar(link) + '" style="background:#8F6E4F;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;display:inline-block;">Criar nova senha</a></p>' +
    '<p style="font-size:13px;color:#8A7663;">O link vale por ' + MINUTOS_DO_LINK + ' minutos e só pode ser usado uma vez. Se o botão não abrir, copie e cole este endereço no navegador:<br>' + escapar(link) + '</p>' +
    '<p style="font-size:13px;color:#8A7663;">Se você não fez esse pedido, ignore esta mensagem: sua senha continua a mesma.</p>' +
    '</div>';
  return { assunto: 'Instituto Lírios — criar nova senha', texto, html };
}

/** Envia o e-mail de recuperação. Sem SMTP, escreve o link no terminal da API (modo de teste). */
async function enviarRecuperacao({ para, nome, link }) {
  if (!configurado()) {
    console.log('[e-mail] SMTP não configurado. Link de recuperação para ' + para + ':\n  ' + link);
    return { enviado: false };
  }
  const { assunto, texto, html } = montarRecuperacao({ nome, link });
  await obterTransporte().sendMail({ from: remetente(), to: para, subject: assunto, text: texto, html });
  return { enviado: true };
}

module.exports = { configurado, definirTransporte, enviarRecuperacao, enderecoDoSistema, remetente, MINUTOS_DO_LINK };
