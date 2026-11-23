'use strict';

/**
 * Confere se o envio de e-mail está certo, mandando uma mensagem de teste.
 *   node testar-email.js seu@email.com
 */

require('dotenv').config();
const email = require('./email');

async function principal() {
  const para = (process.argv[2] || '').trim();
  if (!para) { console.log('Uso: node testar-email.js seu@email.com'); process.exit(1); }

  if (!email.configurado()) {
    console.log('O e-mail ainda não está configurado no arquivo .env.');
    console.log('Preencha SMTP_HOST, SMTP_PORT, SMTP_USER e SMTP_PASS (veja o .env.example).');
    process.exit(1);
  }

  console.log('Enviando de ' + email.remetente() + ' para ' + para + '...');
  const link = email.enderecoDoSistema() + '/redefinir-senha.html?token=EXEMPLO-DE-TESTE';
  const resultado = await email.enviarRecuperacao({ para, nome: 'Teste', link });
  console.log(resultado.enviado
    ? 'Pronto! Confira a caixa de entrada (e o spam). O link dessa mensagem é só um exemplo.'
    : 'Não foi enviado.');
}

principal().catch((erro) => {
  console.error('Não foi possível enviar:', erro.message);
  if (/Invalid login|535|Username and Password/i.test(erro.message)) {
    console.error('Dica: no Gmail use a "senha de app" de 16 letras, não a senha normal.');
  }
  process.exitCode = 1;
});
