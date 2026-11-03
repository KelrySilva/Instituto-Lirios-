'use strict';

require('dotenv').config();
const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'instituto_lirios',
  charset: 'utf8mb4_unicode_ci',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL || 10),
  queueLimit: 0,
  // Datas como texto ('2026-10-27') evitam o deslocamento de fuso que o driver
  // aplica ao converter DATE/DATETIME em objeto Date.
  dateStrings: true,
  decimalNumbers: true
};

const pool = mysql.createPool(config);

/** Executa um bloco dentro de uma transação (commit no fim, rollback no erro). */
async function transacao(executar) {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();
    const resultado = await executar(conexao);
    await conexao.commit();
    return resultado;
  } catch (erro) {
    await conexao.rollback();
    throw erro;
  } finally {
    conexao.release();
  }
}

async function verificarConexao() {
  const [linhas] = await pool.query('SELECT 1 AS ok');
  return linhas[0].ok === 1;
}

module.exports = { pool, transacao, verificarConexao, config };
