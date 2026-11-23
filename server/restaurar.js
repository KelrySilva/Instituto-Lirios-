'use strict';

/**
 * Restaura um backup gerado por backup.js.
 *
 *   node restaurar.js backups/lirios-2026-11-22_170000.sql.gz --sim
 *
 * ATENÇÃO: isto SUBSTITUI os dados atuais pelos do backup. Por segurança, só roda
 * com a palavra --sim, e antes disso faz um backup do estado atual
 * (arquivo "antes-de-restaurar-...").
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawn } = require('child_process');
const { pipeline } = require('stream/promises');

function acharMysql() {
  if (process.env.MYSQL_PATH) return process.env.MYSQL_PATH;
  const dump = require('./backup').acharMysqldump();
  if (!dump) return '';
  const candidato = path.join(path.dirname(dump), path.basename(dump).replace('mysqldump', 'mysql'));
  return fs.existsSync(candidato) ? candidato : '';
}

async function principal() {
  const arquivo = process.argv[2];
  const confirmou = process.argv.includes('--sim');

  if (!arquivo || arquivo.startsWith('--')) {
    console.error('Uso: node restaurar.js <arquivo.sql.gz> --sim');
    process.exit(1);
  }
  if (!fs.existsSync(arquivo)) { console.error('Arquivo não encontrado: ' + arquivo); process.exit(1); }
  if (!confirmou) {
    console.error('Isto vai SUBSTITUIR os dados atuais pelos do backup.\nSe é isso mesmo, rode de novo acrescentando --sim no final.');
    process.exit(1);
  }

  const mysql = acharMysql();
  if (!mysql) {
    console.error('Não achei o programa "mysql". Coloque o caminho em MYSQL_PATH no .env.');
    process.exit(1);
  }

  // Confere o arquivo antes de mexer no banco.
  require('./backup').verificar(arquivo);

  // Guarda o estado atual, caso o backup escolhido não seja o certo.
  const { fazerBackup } = require('./backup');
  const seguranca = await fazerBackup('antes-de-restaurar-');
  console.log('Estado atual guardado em: ' + seguranca);

  const filho = spawn(mysql, [
    '--host=' + (process.env.DB_HOST || '127.0.0.1'),
    '--port=' + (process.env.DB_PORT || '3306'),
    '--user=' + (process.env.DB_USER || 'root'),
    '--default-character-set=utf8mb4'
  ], { env: Object.assign({}, process.env, { MYSQL_PWD: process.env.DB_PASSWORD || '' }), stdio: ['pipe', 'inherit', 'pipe'] });

  let erroTexto = '';
  filho.stderr.on('data', (d) => { erroTexto += d.toString(); });
  const terminou = new Promise((resolve, reject) => {
    filho.on('error', reject);
    filho.on('close', (c) => (c === 0 ? resolve() : reject(new Error('mysql falhou (código ' + c + '): ' + erroTexto.trim()))));
  });

  await Promise.all([pipeline(fs.createReadStream(arquivo), zlib.createGunzip(), filho.stdin), terminou]);
  console.log('Restauração concluída a partir de ' + arquivo);
}

principal().catch((erro) => { console.error('ERRO NA RESTAURAÇÃO: ' + erro.message); process.exit(1); });
