'use strict';

const express = require('express');
const router = express.Router();

router.use('/auth', require('./auth'));
router.use('/clientes', require('./clientes'));
router.use('/gestacoes', require('./gestacoes'));
router.use('/atendimentos', require('./atendimentos'));
router.use('/contratos', require('./contratos'));
router.use('/agenda', require('./agenda'));
router.use('/pendencias', require('./pendencias'));
router.use('/servicos', require('./servicos'));
router.use('/dashboard', require('./dashboard'));

module.exports = router;
