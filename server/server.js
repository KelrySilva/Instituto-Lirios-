'use strict';

const app = require('./app');
const { config } = require('./db');
const { segredoTemporario } = require('./auth-token');
const email = require('./email');

const porta = Number(process.env.PORT || 3000);

const servidor = app.listen(porta, () => {
  console.log('');
  console.log('  Instituto Lírios — API');
  console.log('  http://localhost:' + porta + '/api');
  console.log('  banco: ' + config.user + '@' + config.host + ':' + config.port + '/' + config.database);
  console.log('  saúde: http://localhost:' + porta + '/api/health');
  if (segredoTemporario()) {
    console.log('  AVISO: AUTH_SECRET não definido no .env; os logins valem só até reiniciar a API.');
  }
  if (!email.configurado()) {
    console.log('  AVISO: e-mail (SMTP) não configurado no .env; "esqueci minha senha" só mostra o link aqui no terminal.');
  }
  const idadeBackup = require('./backup').idadeDoUltimoBackupEmDias();
  if (idadeBackup === null) {
    console.log('  AVISO: nenhum backup encontrado. Rode "npm run backup" e agende o backup diário (veja o README).');
  } else if (idadeBackup > 2) {
    console.log('  AVISO: o último backup tem ' + Math.floor(idadeBackup) + ' dias. Confira o agendamento do backup diário.');
  }
  console.log('');
});

function encerrar() {
  servidor.close(() => {
    console.log('\nAPI encerrada.');
    process.exit(0);
  });
}

process.on('SIGINT', encerrar);
process.on('SIGTERM', encerrar);
