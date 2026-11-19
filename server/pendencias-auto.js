'use strict';

/**
 * Pendência de contrato automática (RF18).
 *
 * Regra: enquanto a cliente tiver algum contrato "pendente", existe UMA
 * pendência aberta do tipo "contrato" para ela. Quando o último contrato
 * pendente é assinado, cancelado ou excluído, essa pendência é resolvida.
 */

const { pool } = require('./db');

const DESCRICAO = 'Contrato aguardando assinatura';

async function sincronizarPendenciaContrato(clienteId) {
  const [contagem] = await pool.execute(
    "SELECT COUNT(*) AS total FROM contratos WHERE cliente_id = ? AND status = 'pendente'",
    [clienteId]
  );
  const pendentes = Number(contagem[0] && contagem[0].total) || 0;

  if (pendentes > 0) {
    const [abertas] = await pool.execute(
      "SELECT id FROM pendencias WHERE cliente_id = ? AND tipo = 'contrato' AND status = 'aberta' LIMIT 1",
      [clienteId]
    );
    if (abertas.length) return 'mantida';
    await pool.execute(
      "INSERT INTO pendencias (cliente_id, tipo, descricao) VALUES (?, 'contrato', ?)",
      [clienteId, DESCRICAO]
    );
    return 'criada';
  }

  await pool.execute(
    `UPDATE pendencias
        SET status = 'resolvida', resolvido_em = COALESCE(resolvido_em, NOW())
      WHERE cliente_id = ? AND tipo = 'contrato' AND status = 'aberta'`,
    [clienteId]
  );
  return 'resolvida';
}

module.exports = { sincronizarPendenciaContrato, DESCRICAO };
