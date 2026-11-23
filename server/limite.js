'use strict';

/**
 * Limite simples de pedidos por chave (em memória, zera quando a API reinicia).
 * Serve para impedir que alguém use "esqueci minha senha" para encher a caixa
 * de e-mail de outra pessoa ou para testar e-mails em massa.
 */

const registros = new Map();

/** Devolve true se ainda pode (e já conta este pedido); false se passou do limite. */
function permitir(chave, maximo, janelaMs) {
  const agora = Date.now();
  const recentes = (registros.get(chave) || []).filter((momento) => agora - momento < janelaMs);
  if (recentes.length >= maximo) {
    registros.set(chave, recentes);
    return false;
  }
  recentes.push(agora);
  registros.set(chave, recentes);

  // Limpeza para a memória não crescer sem fim.
  if (registros.size > 5000) {
    for (const [k, v] of registros) {
      if (!v.some((momento) => agora - momento < janelaMs)) registros.delete(k);
    }
  }
  return true;
}

function zerar() { registros.clear(); }

module.exports = { permitir, zerar };
