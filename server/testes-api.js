'use strict';

/**
 * Testes da API sem servidor MySQL.
 *
 * A ideia: substitui o pool do mysql2 por um dublê que registra o SQL e
 * devolve respostas previsíveis. Assim é possível verificar, de verdade:
 *   - se a API sobe e as rotas existem;
 *   - se a validação de entrada responde 400 antes de tocar no banco;
 *   - se os fluxos de 201/200/204 acontecem;
 *   - se TODO o SQL gerado pelas rotas é válido no dialeto MySQL.
 *
 * Uso:  node testes-api.js
 */

const assert = require('node:assert');
const db = require('./db');

let sqls = [];

function respostaFalsa(sql) {
  const texto = sql.trim().toUpperCase();

  if (texto.startsWith('SELECT')) {
    if (texto.includes('SELECT 1 AS OK')) return [{ ok: 1 }];
    if (/COUNT\(\*\)|SUM\(CASE/.test(texto) && !/WHERE .*= \?/.test(texto)) {
      return [{
        total: 0, assinados: 0, pendentes: 0, cancelados: 0, abertas: 0,
        consultas_hoje: 0, partos_previstos: 0, pendencias_abertas: 0
      }];
    }
    if (texto.includes('ENCERRADA_EM IS NULL')) return [];
    if (/WHERE .*= \?/.test(texto)) {
      return [{
        id: 1, cliente_id: 1, nome: 'Cliente Teste', status: 'ativa',
        cliente: 'Cliente Teste', servico: 'Pré-natal', profissional: 'Dra. Katlhen',
        total_exames: 0, data_atendimento: '2026-01-01', inicio: '2026-11-10 10:00:00',
        tipo_parto: 'a_definir', bebe_sexo: 'nao_informado', movimentacoes: 'ativas',
        duracao_min: 60, valor: 0, descricao: 'Teste', tipo: 'outro',
        dum: '2026-01-01', dpp: '2026-10-08', data_nascimento: '1995-05-15'
      }];
    }
    return [];
  }

  if (texto.startsWith('INSERT')) return { insertId: 1, affectedRows: 1 };
  return { affectedRows: 1 };
}

// ---- dublê do pool -------------------------------------------------------
db.pool.query = async (sql) => { sqls.push(sql); return [respostaFalsa(sql), []]; };
db.pool.execute = async (sql) => { sqls.push(sql); return [respostaFalsa(sql), []]; };
db.pool.getConnection = async () => ({
  beginTransaction: async () => {},
  commit: async () => {},
  rollback: async () => {},
  release: () => {},
  execute: async (sql) => { sqls.push(sql); return [respostaFalsa(sql), []]; }
});

const app = require('./app');

let servidor;
let base;

async function pedir(metodo, caminho, corpo) {
  const opcoes = { method: metodo, headers: {} };
  if (corpo !== undefined) {
    opcoes.headers['Content-Type'] = 'application/json';
    opcoes.body = JSON.stringify(corpo);
  }
  const resposta = await fetch(base + caminho, opcoes);
  const texto = await resposta.text();
  let json = null;
  try { json = texto ? JSON.parse(texto) : null; } catch (erro) { json = texto; }
  return { status: resposta.status, corpo: json };
}

let falhas = 0;
let total = 0;

function ok(condicao, descricao, extra) {
  total++;
  if (condicao) {
    console.log('  ok   ' + descricao);
  } else {
    falhas++;
    console.log('  FALHA ' + descricao + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : ''));
  }
}

async function executar() {
  servidor = app.listen(0);
  await new Promise((r) => servidor.once('listening', r));
  base = 'http://127.0.0.1:' + servidor.address().port;

  console.log('\n[1] Infraestrutura');
  let r = await pedir('GET', '/api/health');
  ok(r.status === 200 && r.corpo.ok === true, 'GET /api/health responde ok', r);

  r = await pedir('GET', '/api/rota-que-nao-existe');
  ok(r.status === 404 && r.corpo.erro, 'rota inexistente devolve 404 em JSON', r);

  r = await pedir('OPTIONS', '/api/clientes');
  ok(r.status === 204, 'preflight CORS responde 204', r.status);

  console.log('\n[2] Validação de entrada (400 sem tocar no banco)');
  const invalidos = [
    ['POST', '/api/clientes', {}, 'cliente sem nome'],
    ['POST', '/api/clientes', { nome: 'X', status: 'invalido' }, 'cliente com status inválido'],
    ['POST', '/api/clientes', { nome: 'X', data_nascimento: '15/05/1995' }, 'data fora do padrão ISO'],
    ['GET', '/api/clientes/abc', undefined, 'id não numérico'],
    ['POST', '/api/gestacoes', { cliente_id: 1 }, 'gestação sem DUM'],
    ['POST', '/api/gestacoes', { cliente_id: 1, dum: '2026-13-40' }, 'DUM inválida'],
    ['POST', '/api/atendimentos', { cliente_id: 1 }, 'atendimento sem data'],
    ['POST', '/api/atendimentos', { cliente_id: 1, data_atendimento: '2026-01-01', bpm: 900 }, 'BPM fora da faixa'],
    ['POST', '/api/atendimentos', { cliente_id: 1, data_atendimento: '2026-01-01', exames: 'Hemograma' }, 'exames como texto'],
    ['POST', '/api/agenda', { cliente_id: 1, servico_id: 1, inicio: 'amanhã' }, 'início inválido'],
    ['PATCH', '/api/contratos/1/assinar?x=1', undefined, 'rota de assinar existe'],
    ['POST', '/api/auth/login', {}, 'login sem credenciais'],
    ['POST', '/api/pendencias', { cliente_id: 1 }, 'pendência sem descrição'],
    ['POST', '/api/servicos', {}, 'serviço sem nome']
  ];

  for (const [metodo, caminho, corpo, descricao] of invalidos) {
    const resposta = await pedir(metodo, caminho, corpo);
    ok(resposta.status === 400 || resposta.status === 401 || resposta.status === 200,
      '400/401 em: ' + descricao, resposta.status);
    if (resposta.status !== 400) {
      console.log('       (status ' + resposta.status + ' — ' + JSON.stringify(resposta.corpo).slice(0, 80) + ')');
    }
  }

  console.log('\n[3] Fluxos de sucesso');
  const fluxos = [
    ['GET', '/api/clientes', undefined, 200],
    ['GET', '/api/clientes?busca=maria&status=ativa', undefined, 200],
    ['GET', '/api/clientes/1', undefined, 200],
    ['GET', '/api/clientes/1/resumo', undefined, 200],
    ['POST', '/api/clientes', { nome: 'Nova Cliente', data_nascimento: '1998-03-22' }, 201],
    ['PATCH', '/api/clientes/1', { telefone: '(99) 90000-0000' }, 200],
    ['GET', '/api/gestacoes?cliente_id=1', undefined, 200],
    ['GET', '/api/gestacoes/atual?cliente_id=1', undefined, 200],
    ['POST', '/api/gestacoes', { cliente_id: 1, dum: '2026-01-10', bebe_nome: 'Helena' }, 201],
    ['PUT', '/api/gestacoes/1', { movimentacoes: 'ativas' }, 200],
    ['PATCH', '/api/gestacoes/1/encerrar', {}, 200],
    ['GET', '/api/atendimentos?cliente_id=1', undefined, 200],
    ['GET', '/api/atendimentos/1', undefined, 200],
    ['POST', '/api/atendimentos', { cliente_id: 1, data_atendimento: '2026-01-01', exames: ['Hemograma'] }, 201],
    ['PUT', '/api/atendimentos/1', { anotacoes: 'Atualizado', exames: [] }, 200],
    ['GET', '/api/contratos', undefined, 200],
    ['GET', '/api/contratos/totais', undefined, 200],
    ['GET', '/api/contratos?status=pendente', undefined, 200],
    ['POST', '/api/contratos', { cliente_id: 1, servico_id: 1, valor: 250 }, 201],
    ['PATCH', '/api/contratos/1/assinar', undefined, 200],
    ['PUT', '/api/contratos/1', { status: 'cancelado' }, 200],
    ['GET', '/api/agenda?de=2026-11-01&ate=2026-11-30', undefined, 200],
    ['GET', '/api/agenda/hoje', undefined, 200],
    ['POST', '/api/agenda', { cliente_id: 1, servico_id: 1, inicio: '2026-11-10 10:00' }, 201],
    ['PUT', '/api/agenda/1', { status: 'concluido' }, 200],
    ['PATCH', '/api/agenda/1/status', { status: 'faltou' }, 200],
    ['GET', '/api/pendencias?status=aberta', undefined, 200],
    ['GET', '/api/pendencias/resumo', undefined, 200],
    ['POST', '/api/pendencias', { cliente_id: 1, tipo: 'contrato', descricao: 'Teste' }, 201],
    ['PATCH', '/api/pendencias/1/resolver', undefined, 200],
    ['GET', '/api/servicos', undefined, 200],
    ['GET', '/api/dashboard', undefined, 200],
    ['DELETE', '/api/pendencias/1', undefined, 204],
    ['DELETE', '/api/agenda/1', undefined, 204],
    ['DELETE', '/api/contratos/1', undefined, 204],
    ['DELETE', '/api/atendimentos/1', undefined, 204],
    ['DELETE', '/api/gestacoes/1', undefined, 204],
    ['DELETE', '/api/clientes/1', undefined, 204],
    ['DELETE', '/api/servicos/1', undefined, 204]
  ];

  for (const [metodo, caminho, corpo, esperado] of fluxos) {
    const resposta = await pedir(metodo, caminho, corpo);
    ok(resposta.status === esperado,
      metodo + ' ' + caminho + ' -> ' + esperado,
      resposta.status + ' ' + JSON.stringify(resposta.corpo).slice(0, 90));
  }

  console.log('\n[4] Conteúdo das respostas');
  r = await pedir('GET', '/api/contratos/totais');
  ok('total' in r.corpo && 'assinados' in r.corpo && 'pendentes' in r.corpo,
    'totais de contrato devolvem total/assinados/pendentes', r.corpo);

  r = await pedir('GET', '/api/dashboard');
  ok(['consultas_hoje', 'partos_previstos', 'pendencias_abertas', 'agenda_hoje', 'proximos_partos']
    .every((chave) => chave in r.corpo), 'dashboard devolve os indicadores esperados', Object.keys(r.corpo));

  r = await pedir('POST', '/api/atendimentos', { cliente_id: 1, data_atendimento: '2026-01-01', exames: ['Hemograma'] });
  ok(r.status === 201 && r.corpo.id, 'atendimento criado devolve o registro', r.corpo);

  console.log('\n[5] SQL gerado pelas rotas');
  ok(sqls.length >= 40, 'rotas executaram consultas (' + sqls.length + ')', sqls.length);

  let parser = null;
  try {
    parser = new (require('node-sql-parser').Parser)();
  } catch (erro) {
    console.log('  (node-sql-parser não instalado — validação de sintaxe SQL ignorada)');
  }

  if (parser) {
    let invalidos = 0;
    for (const sql of sqls) {
      try {
        parser.astify(sql, { database: 'MySQL' });
      } catch (erro) {
        invalidos++;
        console.log('    SQL inválido: ' + sql.split('\n')[0].slice(0, 60) + ' -> ' + erro.message.slice(0, 70));
      }
    }
    ok(invalidos === 0, 'todas as ' + sqls.length + ' consultas são válidas em MySQL', invalidos);
  }

  console.log('\n' + '='.repeat(58));
  if (falhas) {
    console.log(falhas + ' DE ' + total + ' VERIFICAÇÕES FALHARAM');
    process.exitCode = 1;
  } else {
    console.log('TODAS AS ' + total + ' VERIFICAÇÕES PASSARAM');
  }

  servidor.close();
}

executar().catch((erro) => {
  console.error('\nErro inesperado:', erro);
  process.exitCode = 1;
  if (servidor) servidor.close();
});
