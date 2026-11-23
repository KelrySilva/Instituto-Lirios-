'use strict';

/**
 * Regras de senha do sistema.
 *
 * A senha de demonstração (a que já foi publicada no GitHub) é tratada como
 * "senha padrão": quem entra com ela é obrigado a trocar antes de usar o sistema.
 */

const SENHAS_PADRAO_PUBLICAS = ['senha1234'];

const SENHAS_FRACAS = [
  'senha1234', 'senha123', 'senha12345', '12345678', '123456789', '1234567890',
  'password', 'password1', 'password123', 'qwerty123', 'abc12345', 'abcd1234',
  'lirios123', 'lirios1234', 'instituto123', 'katlhen123', 'katlhen1234'
];

const TAMANHO_MINIMO = 8;
const TAMANHO_MAXIMO = 72; // limite do bcrypt: o que passa disso seria ignorado

/** A senha digitada no login é uma das senhas padrão publicadas? */
function ehSenhaPadrao(senha) {
  return SENHAS_PADRAO_PUBLICAS.includes(String(senha || '').trim().toLowerCase());
}

/** Devolve o texto do problema, ou null se a nova senha é aceitável. */
function validarNovaSenha(nova, { email = '', atual = '' } = {}) {
  const senha = String(nova || '');
  if (senha.length < TAMANHO_MINIMO) return 'A nova senha precisa ter pelo menos ' + TAMANHO_MINIMO + ' caracteres.';
  if (senha.length > TAMANHO_MAXIMO) return 'A nova senha pode ter no máximo ' + TAMANHO_MAXIMO + ' caracteres.';
  if (!/[A-Za-zÀ-ÿ]/.test(senha) || !/\d/.test(senha)) return 'A nova senha precisa ter letras e números.';
  if (SENHAS_FRACAS.includes(senha.toLowerCase())) return 'Essa senha é muito comum. Escolha outra.';
  if (email && senha.toLowerCase() === String(email).toLowerCase()) return 'A senha não pode ser igual ao e-mail.';
  if (atual && senha === atual) return 'A nova senha precisa ser diferente da atual.';
  return null;
}

module.exports = { ehSenhaPadrao, validarNovaSenha, TAMANHO_MINIMO, TAMANHO_MAXIMO };
