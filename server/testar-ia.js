'use strict';

/**
 * Teste rápido da IA, SEM precisar do MySQL.
 * Usa a chave do server/.env e uma cliente FICTÍCIA.
 *
 * Como rodar (na pasta server):   node testar-ia.js
 */

require('dotenv').config();
const { gerarResumo } = require('./ia');

const dados = {
  cliente: { nome: 'Maria Teste da Silva', data_nascimento: '1995-05-15', status: 'ativa' },
  gestacao: {
    dum: new Date(Date.now() - 37 * 7 * 86400000).toISOString().slice(0, 10),
    dpp: '2026-12-06',
    tipo_parto: 'normal',
    movimentacoes: 'ativas',
    observacoes: 'Maria relata desconforto lombar leve. Contato: (99) 99999-0001'
  },
  atendimentos: [
    { data_atendimento: '2026-10-20', servico: 'Pré-natal', anotacoes: 'Consulta de rotina, sem intercorrências.', bpm: 145, estado_emocional: 'Ansiedade controlada', exames: ['Hemograma completo'] },
    { data_atendimento: '2026-09-22', servico: 'Pré-natal', anotacoes: null, bpm: 150, estado_emocional: null, exames: [] }
  ],
  contratos: [{ servico: 'Pré-natal', status: 'pendente' }],
  pendencias: [{ tipo: 'exame', descricao: 'Exame de glicemia pendente' }]
};

(async () => {
  console.log('Chave Gemini lida do .env:    ', process.env.GEMINI_API_KEY ? 'SIM' : 'NÃO');
  console.log('Chave Anthropic lida do .env: ', process.env.ANTHROPIC_API_KEY ? 'SIM' : 'NÃO');
  console.log('\nGerando resumo...\n');

  const r = await gerarResumo(dados);

  console.log('Origem:   ', r.origem === 'ia' ? 'IA DE VERDADE (' + r.provedor + ')' : 'resumo básico (sem IA)');
  if (r.aviso) console.log('Aviso:    ', r.aviso);
  console.log('\nResumo:');
  r.linhas.forEach((l) => console.log(' -', l));
})();
