'use strict';

/**
 * Backup do banco do Instituto Lírios.
 *
 *   node backup.js            -> gera backups/lirios-AAAA-MM-DD_HHMMSS.sql.gz
 *   npm run backup            -> o mesmo
 *
 * Lê a conexão do .env (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME).
 * Opcionais no .env:
 *   MYSQLDUMP_PATH   caminho do mysqldump, se não estiver no PATH
 *   BACKUP_PASTA     onde guardar (padrão: server/backups)
 *   BACKUP_COPIAR_PARA  segunda pasta que recebe uma cópia (pen drive, OneDrive...)
 *   BACKUP_MANTER    quantos backups antigos guardar (padrão 30)
 *
 * A senha do banco vai para o mysqldump por variável de ambiente, nunca na linha
 * de comando (que apareceria na lista de processos).
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawn } = require('child_process');
const { pipeline } = require('stream/promises');

const PASTA = path.resolve(process.env.BACKUP_PASTA || path.join(__dirname, 'backups'));
const COPIAR_PARA = process.env.BACKUP_COPIAR_PARA ? path.resolve(process.env.BACKUP_COPIAR_PARA) : '';
const MANTER = Math.max(1, Number(process.env.BACKUP_MANTER || 30));
const PREFIXO = 'lirios-';

function carimbo(d) {
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}

/** Procura o mysqldump: variável do .env, depois o PATH, depois as pastas comuns do Windows. */
function acharMysqldump() {
  if (process.env.MYSQLDUMP_PATH) return process.env.MYSQLDUMP_PATH;
  const nome = process.platform === 'win32' ? 'mysqldump.exe' : 'mysqldump';
  const candidatos = (process.env.PATH || '').split(path.delimiter).map((d) => path.join(d, nome));
  if (process.platform === 'win32') {
    for (const base of ['C:\\Program Files\\MySQL', 'C:\\Program Files (x86)\\MySQL', 'C:\\xampp\\mysql\\bin', 'C:\\wamp64\\bin\\mysql']) {
      try {
        if (base.endsWith('MySQL')) {
          for (const pasta of fs.readdirSync(base)) candidatos.push(path.join(base, pasta, 'bin', nome));
        } else candidatos.push(path.join(base, nome));
      } catch (e) { /* pasta não existe */ }
    }
  }
  return candidatos.find((c) => { try { return fs.statSync(c).isFile(); } catch (e) { return false; } }) || '';
}

async function fazerBackup(prefixo) {
  const mysqldump = acharMysqldump();
  if (!mysqldump) {
    throw new Error('Não achei o mysqldump. Ele vem junto com o MySQL. Coloque o caminho dele em MYSQLDUMP_PATH no arquivo .env ' +
      '(ex.: MYSQLDUMP_PATH=C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe).');
  }

  fs.mkdirSync(PASTA, { recursive: true });
  const nomeFinal = (prefixo || PREFIXO) + carimbo(new Date()) + '.sql.gz';
  const destino = path.join(PASTA, nomeFinal);
  const parcial = destino + '.parcial';
  if (fs.existsSync(destino)) throw new Error('Já existe um backup com este nome: ' + destino);

  const args = [
    '--host=' + (process.env.DB_HOST || '127.0.0.1'),
    '--port=' + (process.env.DB_PORT || '3306'),
    '--user=' + (process.env.DB_USER || 'root'),
    '--single-transaction', '--routines', '--triggers', '--events',
    '--default-character-set=utf8mb4',
    '--databases', process.env.DB_NAME || 'instituto_lirios'
  ];

  const filho = spawn(mysqldump, args, {
    env: Object.assign({}, process.env, { MYSQL_PWD: process.env.DB_PASSWORD || '' }),
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let erroTexto = '';
  filho.stderr.on('data', (d) => { erroTexto += d.toString(); });
  const terminou = new Promise((resolve, reject) => {
    filho.on('error', reject);
    filho.on('close', (codigo) => (codigo === 0 ? resolve() : reject(new Error('mysqldump falhou (código ' + codigo + '): ' + erroTexto.trim()))));
  });

  try {
    await Promise.all([pipeline(filho.stdout, zlib.createGzip(), fs.createWriteStream(parcial)), terminou]);
    verificar(parcial);
    fs.renameSync(parcial, destino);
  } catch (erro) {
    try { fs.unlinkSync(parcial); } catch (e) { /* não chegou a existir */ }
    throw erro;
  }

  return destino;
}

/** Confere que o arquivo é um dump completo (e não um arquivo vazio ou cortado). */
function verificar(arquivo) {
  const texto = zlib.gunzipSync(fs.readFileSync(arquivo)).toString('utf8');
  if (!/CREATE TABLE/i.test(texto)) throw new Error('O backup não tem nenhuma tabela. Arquivo descartado.');
  if (!/Dump completed/i.test(texto)) throw new Error('O backup parece incompleto (faltou o final do arquivo). Arquivo descartado.');
}

/** Mantém só os MANTER backups mais recentes em uma pasta. */
function limparAntigos(pasta) {
  const arquivos = fs.readdirSync(pasta)
    .filter((n) => n.startsWith(PREFIXO) && n.endsWith('.sql.gz'))
    .sort(); // o nome tem a data, então ordem alfabética = ordem de data
  const sobrando = arquivos.slice(0, Math.max(0, arquivos.length - MANTER));
  sobrando.forEach((n) => fs.unlinkSync(path.join(pasta, n)));
  return sobrando.length;
}

async function principal() {
  const inicio = Date.now();
  const arquivo = await fazerBackup();
  const kb = Math.max(1, Math.round(fs.statSync(arquivo).size / 1024));
  console.log('Backup criado: ' + arquivo + ' (' + kb + ' KB, ' + Math.round((Date.now() - inicio) / 1000) + 's)');

  if (COPIAR_PARA) {
    try {
      fs.mkdirSync(COPIAR_PARA, { recursive: true });
      fs.copyFileSync(arquivo, path.join(COPIAR_PARA, path.basename(arquivo)));
      const apagados = limparAntigos(COPIAR_PARA);
      console.log('Cópia salva em ' + COPIAR_PARA + (apagados ? ' (' + apagados + ' antigo(s) removido(s))' : ''));
    } catch (erro) {
      // O backup principal já está salvo; avisa mas não falha.
      console.error('ATENÇÃO: não consegui copiar para ' + COPIAR_PARA + ': ' + erro.message);
      process.exitCode = 2;
    }
  }

  const apagados = limparAntigos(PASTA);
  if (apagados) console.log(apagados + ' backup(s) antigo(s) removido(s) (guardando os ' + MANTER + ' mais recentes).');
}

if (require.main === module) {
  principal().catch((erro) => {
    console.error('ERRO NO BACKUP: ' + erro.message);
    process.exit(1);
  });
}

/** Idade (em dias) do backup mais recente na pasta, ou null se não houver nenhum. */
function idadeDoUltimoBackupEmDias() {
  try {
    const mais = fs.readdirSync(PASTA)
      .filter((n) => n.startsWith(PREFIXO) && n.endsWith('.sql.gz'))
      .map((n) => fs.statSync(path.join(PASTA, n)).mtimeMs)
      .sort((a, b) => b - a)[0];
    return mais ? (Date.now() - mais) / 86400000 : null;
  } catch (e) { return null; }
}

module.exports = { fazerBackup, limparAntigos, verificar, acharMysqldump, idadeDoUltimoBackupEmDias };
