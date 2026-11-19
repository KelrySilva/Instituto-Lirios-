'use strict';

const express = require('express');
const { exigirLogin } = require('../auth-token');
const router = express.Router();

// Pública: só o login. Tudo abaixo exige token.
router.use('/auth', require('./auth'));
router.use(exigirLogin);

router.use('/clientes', require('./clientes'));
router.use('/gestacoes', require('./gestacoes'));
router.use('/atendimentos', require('./atendimentos'));
router.use('/contratos', require('./contratos'));
router.use('/agenda', require('./agenda'));
router.use('/pendencias', require('./pendencias'));
router.use('/documentos', require('./documentos'));
router.use('/servicos', require('./servicos'));
router.use('/dashboard', require('./dashboard'));
router.use('/lembretes', require('./lembretes'));
router.use('/resumo-ia', require('./resumo-ia'));

module.exports = router;
