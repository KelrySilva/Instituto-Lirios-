'use strict';

/**
 * Lista os modelos do Gemini que a SUA chave pode usar para gerar texto.
 * Como rodar (na pasta server):   node listar-modelos.js
 */

require('dotenv').config();

(async () => {
  if (!process.env.GEMINI_API_KEY) {
    console.log('GEMINI_API_KEY não encontrada no .env');
    return;
  }
  const resposta = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {
    headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY }
  });
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    console.log('Erro:', (corpo.error && corpo.error.message) || resposta.status);
    return;
  }
  const modelos = (corpo.models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => m.name.replace('models/', ''))
    .filter((nome) => /flash|lite/i.test(nome));

  console.log('Modelos "flash/lite" disponíveis para a sua chave:\n');
  modelos.forEach((nome) => console.log('  ' + nome));
  console.log('\nCopie 2 ou 3 nomes para o .env, separados por vírgula, por exemplo:');
  console.log('GEMINI_MODEL=' + modelos.slice(0, 3).join(','));
})();
