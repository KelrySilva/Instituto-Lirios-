'use strict';

const express = require('express');
const { pool } = require('../db');
const { rota, id, data, opcao, HttpError } = require('../http');

const router = express.Router();

const STATUS = ['pendente', 'enviado', 'confirmado'];
const NOME_PROFISSIONAL = 'Dra. Katlhen Carvalho';

/** Data de hoje (+dias) no fuso de Balsas, no formato AAAA-MM-DD. */
function dataLocal(somarDias = 0) {
  const base = new Date(Date.now() + somarDias * 86400000);
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(base);
}

/** Telefone brasileiro -> só dígitos com DDI 55. Devolve null se for inválido. */
function telefoneWhatsApp(telefone) {
  let digitos = String(telefone || '').replace(/\D/g, '');
  if (digitos.length === 10 || digitos.length === 11) digitos = '55' + digitos;
  return /^55\d{10,11}$/.test(digitos) ? digitos : null;
}

function montarMensagem({ cliente, servico, inicio }) {
  const [dia, hora] = String(inicio).split(' ');
  const [ano, mes, d] = dia.split('-');
  const primeiroNome = String(cliente).trim().split(' ')[0];
  return 'Olá, ' + primeiroNome + '! Passando para lembrar da sua consulta de ' + servico +
    ' no Instituto Lírios, no dia ' + d + '/' + mes + '/' + ano + ', às ' + hora.slice(0, 5) +
    '. Pode confirmar sua presença? ' + NOME_PROFISSIONAL + '.';
}

/** Linha do banco -> objeto devolvido à interface (com o link do WhatsApp). */
function formatar(linha) {
  const numero = telefoneWhatsApp(linha.telefone);
  return {
    id: linha.id,
    agendamento_id: linha.agendamento_id,
    cliente: linha.cliente,
    servico: linha.servico,
    inicio: linha.inicio,
    telefone: linha.telefone,
    mensagem: linha.mensagem,
    status: linha.status,
    enviado_em: linha.enviado_em,
    link_whatsapp: numero ? 'https://wa.me/' + numero + '?text=' + encodeURIComponent(linha.mensagem) : null
  };
}

const SELECT = `
  SELECT l.id, l.agendamento_id, l.mensagem, l.status, l.enviado_em,
         ag.inicio, c.nome AS cliente, c.telefone, s.nome AS servico
    FROM lembretes l
    JOIN agendamentos ag ON ag.id = l.agendamento_id
    JOIN clientes c ON c.id = ag.cliente_id
    JOIN servicos s ON s.id = ag.servico_id
`;

/**
 * GET /api/lembretes?data=AAAA-MM-DD   (padrão: amanhã)
 * Gera o lembrete de cada consulta agendada do dia que ainda não tem um
 * e devolve a lista pronta para a tela.
 */
router.get('/', rota(async (req, res) => {
  const dia = data(req.query.data, 'data') || dataLocal(1);

  // 1) cria o que falta (o UNIQUE evita duplicar se a tela for aberta várias vezes)
  const [novos] = await pool.execute(
    `SELECT ag.id, ag.inicio, c.nome AS cliente, s.nome AS servico
       FROM agendamentos ag
       JOIN clientes c ON c.id = ag.cliente_id
       JOIN servicos s ON s.id = ag.servico_id
  LEFT JOIN lembretes l ON l.agendamento_id = ag.id
      WHERE DATE(ag.inicio) = ? AND ag.status = 'agendado' AND l.id IS NULL`,
    [dia]
  );
  for (const ag of novos) {
    await pool.execute(
      'INSERT IGNORE INTO lembretes (agendamento_id, mensagem) VALUES (?, ?)',
      [ag.id, montarMensagem(ag)]
    );
  }

  // 2) devolve a lista do dia (consultas canceladas não entram)
  const [linhas] = await pool.execute(
    SELECT + " WHERE DATE(ag.inicio) = ? AND ag.status = 'agendado' ORDER BY ag.inicio",
    [dia]
  );
  res.json({ data: dia, lembretes: linhas.map(formatar) });
}));

/** PATCH /api/lembretes/:id/status  { "status": "enviado" | "confirmado" | "pendente" } */
router.patch('/:id/status', rota(async (req, res) => {
  const idLembrete = id(req.params.id);
  const status = opcao((req.body || {}).status, 'status', STATUS);
  if (!status) throw new HttpError(400, 'Informe o status.');

  const [resultado] = await pool.execute(
    `UPDATE lembretes
        SET status = ?, enviado_em = CASE WHEN ? = 'pendente' THEN NULL ELSE COALESCE(enviado_em, NOW()) END
      WHERE id = ?`,
    [status, status, idLembrete]
  );
  if (!resultado.affectedRows) throw new HttpError(404, 'Lembrete não encontrado.');

  const [linhas] = await pool.execute(SELECT + ' WHERE l.id = ?', [idLembrete]);
  res.json(formatar(linhas[0]));
}));

module.exports = router;
module.exports.telefoneWhatsApp = telefoneWhatsApp;
module.exports.montarMensagem = montarMensagem;
