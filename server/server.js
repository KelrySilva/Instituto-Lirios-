'use strict';

const app = require('./app');
const { config } = require('./db');

const porta = Number(process.env.PORT || 3000);

const servidor = app.listen(porta, () => {
  console.log('');
  console.log('  Instituto Lírios — API');
  console.log('  http://localhost:' + porta + '/api');
  console.log('  banco: ' + config.user + '@' + config.host + ':' + config.port + '/' + config.database);
  console.log('  saúde: http://localhost:' + porta + '/api/health');
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
