'use strict';

/**
 * Resumo inteligente (RF21).
 *
 * Fluxo: monta o histórico da cliente -> ANONIMIZA -> envia ao modelo de
 * linguagem -> devolve linhas de texto. Se não houver chave configurada (ou a
 * chamada falhar) devolve um resumo básico, montado só com regras, para o
 * sistema nunca ficar sem resposta.
 *
 * Provedores aceitos (variáveis do server/.env; NUNCA colocar chaves no código):
 *   Gemini (gratuito):  GEMINI_API_KEY  e, se quiser, GEMINI_MODEL (padrão: gemini-3.8-flash)
 *   Claude (pago):      ANTHROPIC_API_KEY, ANTHROPIC_MODEL (padrão: claude-haiku-5-5),
 *                       ANTHROPIC_VERSION (padrão: 2026-10-21)
 * Se as duas existirem, vale a escolha em AI_PROVIDER=gemini|anthropic (padrão: gemini).
 */

const URL_ANTHROPIC = 'https://api.anthropic.com/v1/messages';
const URL_GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models/';

const INSTRUCOES = [
  'Você ajuda uma enfermeira obstetra a retomar rapidamente o histórico de uma cliente.',
  'Resuma SOMENTE o que está nos dados recebidos. Não invente informações.',
  'Não faça diagnóstico, não sugira tratamento e não interprete exames: apenas organize o que foi registrado.',
  'Quando uma informação não estiver registrada, escreva "não registrado".',
  'Responda em português, com 4 a 6 linhas, cada uma começando com "- " e seguindo este roteiro:',
  '- Situação atual: ...',
  '- Pontos de atenção: ...',
  '- Pendências: ...',
  '- Últimos atendimentos: ...',
  'Não escreva mais nada além dessas linhas.'
].join('\n');

/* ------------------------------ anonimização ------------------------------ */

/** Remove do texto o nome da cliente e dados de contato (CPF, telefone, e-mail). */
function anonimizarTexto(texto, nomeCliente) {
  let saida = String(texto || '');
  String(nomeCliente || '')
    .split(/\s+/)
    .filter((parte) => parte.length >= 3)
    .forEach((parte) => {
      const re = new RegExp('\\b' + parte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
      saida = saida.replace(re, '[cliente]');
    });
  return saida
    .replace(/\[cliente\](\s+\[cliente\])+/g, '[cliente]')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[e-mail removido]')
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF removido]')
    .replace(/(\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g, '[telefone removido]');
}

function idadeEmAnos(dataNascimento) {
  if (!dataNascimento) return null;
  const nasc = new Date(String(dataNascimento).slice(0, 10) + 'T00:00:00');
  if (isNaN(nasc)) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const fezAniversario = hoje.getMonth() > nasc.getMonth() ||
    (hoje.getMonth() === nasc.getMonth() && hoje.getDate() >= nasc.getDate());
  return fezAniversario ? idade : idade - 1;
}

function semanasDeGestacao(dum) {
  if (!dum) return null;
  const dias = Math.floor((Date.now() - new Date(String(dum).slice(0, 10) + 'T00:00:00')) / 86400000);
  return dias >= 0 ? Math.floor(dias / 7) : null;
}

/**
 * Transforma os dados do banco em um objeto SEM identificadores:
 * sem nome, CPF, telefone, e-mail, endereço e sem o nome do bebê.
 */
function montarHistoricoAnonimo({ cliente, gestacao, atendimentos, contratos, pendencias }) {
  const limpar = (t) => anonimizarTexto(t, cliente.nome);
  return {
    cliente: {
      idade: idadeEmAnos(cliente.data_nascimento),
      status: cliente.status
    },
    gestacao: gestacao ? {
      semanas_de_gestacao: semanasDeGestacao(gestacao.dum),
      data_prevista_parto: gestacao.dpp,
      tipo_parto_desejado: gestacao.tipo_parto,
      movimentacoes_fetais: gestacao.movimentacoes,
      observacoes: limpar(gestacao.observacoes)
    } : null,
    atendimentos: atendimentos.map((a) => ({
      data: a.data_atendimento,
      servico: a.servico,
      anotacoes: limpar(a.anotacoes),
      batimentos_bebe_bpm: a.bpm,
      estado_emocional: limpar(a.estado_emocional),
      exames: a.exames
    })),
    contratos: contratos.map((c) => ({ servico: c.servico, status: c.status })),
    pendencias_abertas: pendencias.map((p) => ({ tipo: p.tipo, descricao: limpar(p.descricao) }))
  };
}

/* ------------------------- resumo básico (sem IA) ------------------------- */

function resumoBasico(h) {
  const linhas = [];
  if (h.gestacao) {
    const g = h.gestacao;
    linhas.push('Situação atual: gestação de ' + (g.semanas_de_gestacao ?? 'não registrado') +
      ' semanas, parto previsto para ' + (g.data_prevista_parto || 'não registrado') +
      ', movimentos fetais: ' + (g.movimentacoes_fetais || 'não registrado') + '.');
  } else {
    linhas.push('Situação atual: sem gestação em acompanhamento registrada.');
  }
  const abertas = h.pendencias_abertas;
  const pend = h.contratos.filter((c) => c.status === 'pendente').length;
  linhas.push('Pendências: ' + (abertas.length
    ? abertas.map((p) => p.descricao).join('; ')
    : 'nenhuma aberta') + (pend ? ' | ' + pend + ' contrato(s) sem assinatura' : '') + '.');
  if (h.atendimentos.length) {
    const u = h.atendimentos[0];
    linhas.push('Último atendimento: ' + u.data + ' (' + (u.servico || 'serviço não registrado') + ')' +
      (u.anotacoes ? ' — ' + u.anotacoes.replace(/[.\s]+$/, '') : '') + '.');
    const semNota = h.atendimentos.filter((a) => !a.anotacoes).length;
    if (semNota) linhas.push('Pontos de atenção: ' + semNota + ' atendimento(s) sem anotação.');
  } else {
    linhas.push('Últimos atendimentos: nenhum registrado.');
  }
  return linhas;
}

/* --------------------------------- modelo --------------------------------- */

function extrairLinhas(texto) {
  return String(texto || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('-'))
    .map((l) => l.replace(/^-+\s*/, ''))
    .filter(Boolean);
}

function escolherProvedor() {
  const pedido = (process.env.AI_PROVIDER || '').toLowerCase();
  const temGemini = !!process.env.GEMINI_API_KEY;
  const temClaude = !!process.env.ANTHROPIC_API_KEY;
  if (pedido === 'anthropic' && temClaude) return 'anthropic';
  if (pedido === 'gemini' && temGemini) return 'gemini';
  if (temGemini) return 'gemini';
  if (temClaude) return 'anthropic';
  return null;
}

function mensagemUsuario(historico) {
  return 'Histórico da cliente (dados anonimizados):\n' + JSON.stringify(historico, null, 2);
}

async function chamarAnthropic(historico) {
  const resposta = await fetch(URL_ANTHROPIC, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': process.env.ANTHROPIC_VERSION || '2026-10-21'
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
      max_tokens: 600,
      system: INSTRUCOES,
      messages: [{ role: 'user', content: mensagemUsuario(historico) }]
    }),
    signal: AbortSignal.timeout(20000)
  });

  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new Error((corpo && corpo.error && corpo.error.message) || 'erro ' + resposta.status);
  }
  return (corpo.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}

async function chamarGemini(historico, modelo) {
  const resposta = await fetch(URL_GEMINI + encodeURIComponent(modelo) + ':generateContent', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': process.env.GEMINI_API_KEY
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: INSTRUCOES }] },
      contents: [{ role: 'user', parts: [{ text: mensagemUsuario(historico) }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 2000 }
    }),
    signal: AbortSignal.timeout(20000)
  });

  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    const erro = new Error((corpo && corpo.error && corpo.error.message) || 'erro ' + resposta.status);
    erro.status = resposta.status;
    throw erro;
  }
  const partes = (corpo.candidates && corpo.candidates[0] && corpo.candidates[0].content &&
    corpo.candidates[0].content.parts) || [];
  return partes.map((p) => p.text || '').join('\n');
}

const espera = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Erros temporários (sobrecarga, limite por minuto) valem uma nova tentativa. */
function eTemporario(erro) {
  return [429, 500, 503, 504].includes(erro.status) || /high demand|overloaded|try again/i.test(erro.message);
}

/** Chama o modelo até 3 vezes, esperando um pouco entre as tentativas. */
async function comTentativas(chamar) {
  const pausas = [2000, 4000];
  for (let i = 0; ; i++) {
    try {
      return await chamar();
    } catch (erro) {
      if (i >= pausas.length || !eTemporario(erro)) throw erro;
      console.warn('[ia] modelo ocupado, nova tentativa em ' + pausas[i] / 1000 + 's...');
      await espera(pausas[i]);
    }
  }
}

/**
 * GEMINI_MODEL aceita vários nomes separados por vírgula. Se um modelo estiver
 * ocupado ou indisponível, tenta o próximo da lista.
 */
async function tentarModelosGemini(historico) {
  const modelos = (process.env.GEMINI_MODEL || 'gemini-3.8-flash')
    .split(',').map((m) => m.trim()).filter(Boolean);
  let ultimoErro = null;
  for (const modelo of modelos) {
    try {
      return await comTentativas(() => chamarGemini(historico, modelo));
    } catch (erro) {
      ultimoErro = erro;
      console.warn('[ia] modelo "' + modelo + '" falhou (' + erro.message.slice(0, 80) + ').' +
        (modelo !== modelos[modelos.length - 1] ? ' Tentando o próximo...' : ''));
    }
  }
  throw ultimoErro;
}

/** Devolve { linhas, origem: 'ia' | 'basico', provedor?, aviso? } */
async function gerarResumo(dados) {
  const historico = montarHistoricoAnonimo(dados);
  const provedor = escolherProvedor();

  if (!provedor) {
    return { linhas: resumoBasico(historico), origem: 'basico', aviso: 'Chave da IA não configurada: resumo básico, sem modelo de linguagem.' };
  }
  try {
    const texto = provedor === 'gemini'
      ? await tentarModelosGemini(historico)
      : await comTentativas(() => chamarAnthropic(historico));
    const linhas = extrairLinhas(texto);
    if (!linhas.length) throw new Error('resposta do modelo sem conteúdo utilizável');
    return { linhas, origem: 'ia', provedor };
  } catch (erro) {
    console.error('[ia] falha ao chamar o modelo (' + provedor + '):', erro.message);
    return { linhas: resumoBasico(historico), origem: 'basico', aviso: 'A IA não respondeu (' + erro.message + '). Exibindo resumo básico.' };
  }
}

module.exports = { gerarResumo, anonimizarTexto, montarHistoricoAnonimo, resumoBasico, extrairLinhas };
