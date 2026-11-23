'use strict';

/**
 * Define (ou redefine) a senha de um usuário direto no banco.
 * Serve para o primeiro acesso e para quem esqueceu a senha.
 *
 *   node definir-senha.js katlhen@lirios.com.br
 *   node definir-senha.js nova@lirios.com.br --nome "Nome da Pessoa"   (cria o usuário)
 *
 * A senha é digitada no terminal (não aparece na tela e não fica no histórico).
 */

require('dotenv').config();
const readline = require('node:readline');
const bcrypt = require('bcryptjs');
const { pool } = require('./db');
const { validarNovaSenha } = require('./senha');

function perguntar(texto) {
  return new Promise((resolver) => {
    const interface_ = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let mudo = false;
    const escreverOriginal = interface_._writeToOutput;
    interface_._writeToOutput = function (conteudo) {
      if (!mudo) escreverOriginal.call(interface_, conteudo);
    };
    interface_.question(texto, (resposta) => {
      interface_.close();
      process.stdout.write('\n');
      resolver(resposta);
    });
    mudo = true;
  });
}

async function principal() {
  const argumentos = process.argv.slice(2);
  const email = (argumentos[0] || '').trim().toLowerCase();
  const indiceNome = argumentos.indexOf('--nome');
  const nome = indiceNome >= 0 ? (argumentos[indiceNome + 1] || '').trim() : '';

  if (!email || email.startsWith('--')) {
    console.log('Uso: node definir-senha.js <email> [--nome "Nome"]');
    process.exit(1);
  }

  const [linhas] = await pool.execute('SELECT id, nome FROM usuarios WHERE email = ?', [email]);
  const existe = linhas[0];

  if (!existe && !nome) {
    console.log('Não existe usuário com o e-mail ' + email + '.');
    console.log('Para criar um novo, rode:  node definir-senha.js ' + email + ' --nome "Nome da Pessoa"');
    process.exit(1);
  }

  const senha = await perguntar('Nova senha (mín. 8, com letras e números): ');
  const confirmacao = await perguntar('Repita a senha: ');

  if (senha !== confirmacao) { console.log('As senhas não são iguais. Nada foi alterado.'); process.exit(1); }
  const problema = validarNovaSenha(senha, { email });
  if (problema) { console.log(problema + ' Nada foi alterado.'); process.exit(1); }

  const hash = await bcrypt.hash(senha, 12);

  if (existe) {
    await pool.execute('UPDATE usuarios SET senha_hash = ?, ativo = 1 WHERE id = ?', [hash, existe.id]);
    console.log('Senha de ' + existe.nome + ' atualizada.');
  } else {
    await pool.execute(
      "INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?, ?, ?, 'admin')",
      [nome, email, hash]
    );
    console.log('Usuário ' + nome + ' criado.');
  }
}

principal()
  .catch((erro) => { console.error('Erro:', erro.code === 'ECONNREFUSED' ? 'o MySQL não está ligado.' : erro.message); process.exitCode = 1; })
  .finally(() => pool.end());
