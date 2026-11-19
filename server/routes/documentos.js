'use strict';

const express = require('express');
const { pool } = require('../db');
const { rota, id, texto, HttpError } = require('../http');

const router = express.Router();

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB por arquivo

// Tipos aceitos (extensão -> tipo). Nada executável.
const TIPOS = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  txt: 'text/plain',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};

const CAMPOS = 'id, cliente_id, nome, tipo_mime, tamanho, criado_em';

// GET /api/documentos?cliente_id=  (sem o conteúdo do arquivo)
router.get('/', rota(async (req, res) => {
  const idCliente = id(req.query.cliente_id, 'cliente_id');
  const [linhas] = await pool.execute(
    `SELECT ${CAMPOS} FROM documentos WHERE cliente_id = ? ORDER BY criado_em DESC, id DESC`,
    [idCliente]
  );
  res.json(linhas);
}));

// POST /api/documentos  { cliente_id, nome, conteudo_base64 }
router.post('/', rota(async (req, res) => {
  const corpo = req.body || {};
  const idCliente = id(corpo.cliente_id, 'cliente_id');
  const nome = texto(corpo.nome, 'nome', { max: 160 });

  const extensao = (nome.split('.').pop() || '').toLowerCase();
  if (!TIPOS[extensao]) {
    throw new HttpError(400, 'Tipo de arquivo não aceito. Use PDF, imagem (PNG/JPG/WEBP), TXT ou Word.');
  }

  const base64 = String(corpo.conteudo_base64 || '').replace(/^data:[^,]*,/, '');
  if (!base64) throw new HttpError(400, 'O arquivo está vazio.');
  const conteudo = Buffer.from(base64, 'base64');
  if (!conteudo.length) throw new HttpError(400, 'O arquivo está vazio.');
  if (conteudo.length > MAX_BYTES) throw new HttpError(413, 'O arquivo passa de 5 MB.');

  const [existe] = await pool.execute('SELECT id FROM clientes WHERE id = ?', [idCliente]);
  if (!existe.length) throw new HttpError(404, 'Cliente não encontrada.');

  const [resultado] = await pool.execute(
    'INSERT INTO documentos (cliente_id, nome, tipo_mime, tamanho, conteudo) VALUES (?, ?, ?, ?, ?)',
    [idCliente, nome, TIPOS[extensao], conteudo.length, conteudo]
  );

  const [linhas] = await pool.execute(
    `SELECT ${CAMPOS} FROM documentos WHERE id = ?`, [resultado.insertId]
  );
  res.status(201).json(linhas[0]);
}));

// GET /api/documentos/:id/arquivo — baixa o arquivo
router.get('/:id/arquivo', rota(async (req, res) => {
  const [linhas] = await pool.execute(
    'SELECT nome, tipo_mime, conteudo FROM documentos WHERE id = ?', [id(req.params.id)]
  );
  if (!linhas.length) throw new HttpError(404, 'Documento não encontrado.');

  const doc = linhas[0];
  res.setHeader('Content-Type', doc.tipo_mime);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition',
    'inline; filename*=UTF-8\'\'' + encodeURIComponent(doc.nome));
  res.send(doc.conteudo);
}));

// DELETE /api/documentos/:id
router.delete('/:id', rota(async (req, res) => {
  const [resultado] = await pool.execute('DELETE FROM documentos WHERE id = ?', [id(req.params.id)]);
  if (!resultado.affectedRows) throw new HttpError(404, 'Documento não encontrado.');
  res.status(204).end();
}));

module.exports = router;
