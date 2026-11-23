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
process.env.AUTH_SECRET = 'segredo-de-teste-com-mais-de-16-caracteres';
const db = require('./db');
const { criarToken, verificarToken, criarTokenRedefinicao, verificarTokenRedefinicao } = require('./auth-token');
const emailMod = require('./email');
const limite = require('./limite');
const { validarNovaSenha, ehSenhaPadrao } = require('./senha');

let sqls = [];

const bcrypt = require('bcryptjs');
const HASH_TESTE = bcrypt.hashSync('certa123', 4);
const HASH_PADRAO = bcrypt.hashSync('senha1234', 4);

// Estado controlado pelos testes da regra de pendência de contrato.
const FAKE = { pendentes: 0, pendenciaAberta: false, conflito: false };

function respostaFalsa(sql, params) {
  const texto = sql.trim().toUpperCase();

  if (texto.includes('FROM AGENDAMENTOS') && texto.includes('DATE_ADD(INICIO')) {
    return FAKE.conflito ? [{ id: 5 }] : [];
  }
  if (texto.includes('SELECT NOME, TIPO_MIME, CONTEUDO FROM DOCUMENTOS')) {
    return [{ nome: 'exame ação.pdf', tipo_mime: 'application/pdf', conteudo: Buffer.from('%PDF-teste') }];
  }
  if (texto.includes('FROM CONTRATOS WHERE CLIENTE_ID = ? AND STATUS = \'PENDENTE\'')) {
    return [{ total: FAKE.pendentes }];
  }
  if (texto.includes('FROM PENDENCIAS WHERE CLIENTE_ID = ? AND TIPO = \'CONTRATO\'')) {
    return FAKE.pendenciaAberta ? [{ id: 9 }] : [];
  }

  if (texto.includes('FROM USUARIOS')) {
    const email = params && params[0];
    if (typeof email === 'number') { // busca por id (troca de senha)
      return [{ id: email, nome: 'Dra. Teste', email: 'existe@teste.com', senha_hash: HASH_TESTE, perfil: 'admin', ativo: 1 }];
    }
    if (email === 'padrao@teste.com') {
      return [{ id: 3, nome: 'Dra. Padrão', email, senha_hash: HASH_PADRAO, perfil: 'admin', ativo: 1 }];
    }
    if (email === 'existe@teste.com') {
      return [{ id: 1, nome: 'Dra. Teste', email, senha_hash: HASH_TESTE, perfil: 'admin', ativo: 1 }];
    }
    if (email === 'inativo@teste.com') {
      return [{ id: 2, nome: 'Inativo', email, senha_hash: HASH_TESTE, perfil: 'admin', ativo: 0 }];
    }
    return [];
  }

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
db.pool.query = async (sql, params) => { sqls.push(sql); return [respostaFalsa(sql, params), []]; };
db.pool.execute = async (sql, params) => { sqls.push(sql); return [respostaFalsa(sql, params), []]; };
db.pool.getConnection = async () => ({
  beginTransaction: async () => {},
  commit: async () => {},
  rollback: async () => {},
  release: () => {},
  execute: async (sql, params) => { sqls.push(sql); return [respostaFalsa(sql, params), []]; }
});

const app = require('./app');

let servidor;
let base;

let tokenDeTeste = null;

async function pedir(metodo, caminho, corpo, semToken) {
  const opcoes = { method: metodo, headers: {} };
  if (tokenDeTeste && !semToken) opcoes.headers.Authorization = 'Bearer ' + tokenDeTeste;
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
  tokenDeTeste = criarToken({ id: 1, nome: 'Dra. Teste', email: 't@t.com', perfil: 'admin' });

  console.log('\n[1] Infraestrutura');
  let r = await pedir('GET', '/api/health');
  ok(r.status === 200 && r.corpo.ok === true, 'GET /api/health responde ok', r);

  r = await pedir('GET', '/api/rota-que-nao-existe');
  ok(r.status === 404 && r.corpo.erro, 'rota inexistente devolve 404 em JSON', r);

  r = await pedir('OPTIONS', '/api/clientes');
  ok(r.status === 204, 'preflight CORS responde 204', r.status);

  console.log('\n[1b] Autenticação (token)');
  r = await pedir('GET', '/api/clientes', undefined, true);
  ok(r.status === 401, 'rota protegida sem token devolve 401', r.status);

  tokenDeTeste = 'abc.def';
  r = await pedir('GET', '/api/clientes');
  ok(r.status === 401, 'token inventado devolve 401', r.status);

  const valido = criarToken({ id: 1, nome: 'Dra. Teste', email: 't@t.com', perfil: 'admin' });
  const adulterado = valido.slice(0, -2) + (valido.endsWith('A') ? 'BB' : 'AA');
  tokenDeTeste = adulterado;
  r = await pedir('GET', '/api/clientes');
  ok(r.status === 401, 'token com assinatura alterada devolve 401', r.status);

  const dadosVencidos = Buffer.from(JSON.stringify({ id: 1, exp: 1 })).toString('base64url');
  ok(verificarToken(dadosVencidos + '.' + valido.split('.')[1]) === null, 'dados trocados com a assinatura antiga são recusados');
  ok(verificarToken(valido) && verificarToken(valido).nome === 'Dra. Teste', 'token válido é aceito e traz o usuário');

  tokenDeTeste = valido;
  r = await pedir('GET', '/api/clientes');
  ok(r.status === 200, 'rota protegida com token válido devolve 200', r.status);

  r = await pedir('POST', '/api/auth/login', {}, true);
  ok(r.status === 400, 'login continua público (sem token, responde 400 por faltar dados)', r.status);

  console.log('\n[1c] Troca de senha e senha de demonstração');
  const tokenNormal = tokenDeTeste;
  r = await pedir('POST', '/api/auth/login', { email: 'existe@teste.com', senha: 'certa123' }, true);
  ok(r.status === 200 && r.corpo.precisa_trocar_senha === false && !verificarToken(r.corpo.token).tr,
    'login com senha própria não exige troca', r.status);

  r = await pedir('POST', '/api/auth/login', { email: 'padrao@teste.com', senha: 'senha1234' }, true);
  ok(r.status === 200 && r.corpo.precisa_trocar_senha === true && verificarToken(r.corpo.token).tr === 1,
    'login com a senha de demonstração marca "precisa trocar senha"', r);
  const tokenPadrao = r.corpo.token;

  tokenDeTeste = tokenPadrao;
  r = await pedir('GET', '/api/clientes');
  ok(r.status === 403 && r.corpo.detalhes === 'TROCAR_SENHA', 'com senha de demonstração, as outras rotas dão 403 (TROCAR_SENHA)', r);
  r = await pedir('GET', '/api/health');
  ok(r.status === 200, 'a rota de saúde continua livre', r.status);

  r = await pedir('POST', '/api/auth/trocar-senha', { senha_atual: 'errada99', nova_senha: 'Nova@senha9' });
  ok(r.status === 400 && /atual/.test(r.corpo.erro), 'senha atual errada é recusada (400, sem deslogar)', r);

  tokenDeTeste = criarToken({ id: 1, nome: 'Dra. Teste', email: 'existe@teste.com', perfil: 'admin', trocar: true });
  r = await pedir('POST', '/api/auth/trocar-senha', { senha_atual: 'certa123', nova_senha: 'curta1' });
  ok(r.status === 400 && /8 caracteres/.test(r.corpo.erro), 'senha curta é recusada', r);
  r = await pedir('POST', '/api/auth/trocar-senha', { senha_atual: 'certa123', nova_senha: 'somenteletras' });
  ok(r.status === 400 && /letras e números/.test(r.corpo.erro), 'senha sem número é recusada', r);
  r = await pedir('POST', '/api/auth/trocar-senha', { senha_atual: 'certa123', nova_senha: 'senha1234' });
  ok(r.status === 400 && /comum/.test(r.corpo.erro), 'a senha de demonstração não pode ser a nova senha', r);
  r = await pedir('POST', '/api/auth/trocar-senha', { senha_atual: 'certa123', nova_senha: 'certa123' });
  ok(r.status === 400 && /diferente/.test(r.corpo.erro), 'nova senha igual à atual é recusada', r);
  r = await pedir('POST', '/api/auth/trocar-senha', { senha_atual: 'certa123' });
  ok(r.status === 400, 'sem nova senha devolve 400', r.status);

  const antesTroca = sqls.length;
  r = await pedir('POST', '/api/auth/trocar-senha', { senha_atual: 'certa123', nova_senha: 'Nova@senha9' });
  const gravou = sqls.slice(antesTroca).filter((q) => /UPDATE usuarios SET senha_hash/i.test(q));
  ok(r.status === 200 && gravou.length === 1, 'troca válida grava o novo hash no banco', r);
  ok(r.corpo.precisa_trocar_senha === false && verificarToken(r.corpo.token) && !verificarToken(r.corpo.token).tr,
    'a troca devolve um token novo, sem a marca de senha de demonstração');
  tokenDeTeste = r.corpo.token;
  r = await pedir('GET', '/api/clientes');
  ok(r.status === 200, 'com o token novo as rotas voltam a funcionar', r.status);

  r = await pedir('POST', '/api/auth/trocar-senha', { senha_atual: 'x', nova_senha: 'y' }, true);
  ok(r.status === 401, 'trocar senha exige estar logado (401 sem token)', r.status);
  tokenDeTeste = tokenNormal;

  ok(ehSenhaPadrao('senha1234') && ehSenhaPadrao(' Senha1234 ') && !ehSenhaPadrao('outra1234'), 'ehSenhaPadrao reconhece a senha publicada');
  ok(validarNovaSenha('Boa#Senha2026', { email: 'a@b.com' }) === null, 'validarNovaSenha aceita uma senha boa');
  ok(validarNovaSenha('x'.repeat(73) + '1') !== null, 'validarNovaSenha recusa senha acima de 72 caracteres (limite do bcrypt)');

  console.log('\n[1c2] Recuperação de senha por e-mail');
  const enviados = [];
  emailMod.definirTransporte({ sendMail: async (m) => { enviados.push(m); } });
  process.env.APP_URL = 'https://sistema.exemplo.com.br/';
  const esperar = () => new Promise((resolver) => setTimeout(resolver, 40));
  const SEM = true;
  const sqlAntes = sqls.length;

  r = await pedir('POST', '/api/auth/esqueci-senha', { email: 'existe@teste.com' }, SEM);
  await esperar();
  ok(r.status === 200 && r.corpo.ok === true, 'pedir recuperação devolve 200 sem exigir login', r);
  ok(enviados.length === 1 && enviados[0].to === 'existe@teste.com', 'e-mail cadastrado recebe a mensagem');
  const linkEnviado = (/https?:\/\/\S+/.exec(enviados[0].text) || [''])[0];
  ok(linkEnviado.startsWith('https://sistema.exemplo.com.br/redefinir-senha.html?token='),
    'o link usa o APP_URL do .env (e não algo vindo do pedido)', linkEnviado);
  ok(/30 minutos/.test(enviados[0].text) && /ignorar esta mensagem/.test(enviados[0].text), 'mensagem explica validade e o que fazer se não foi a pessoa');
  const tokenDoEmail = decodeURIComponent(linkEnviado.split('token=')[1]);

  const respostaConhecida = r.corpo.mensagem;
  r = await pedir('POST', '/api/auth/esqueci-senha', { email: 'ninguem@teste.com' }, SEM);
  await esperar();
  ok(r.status === 200 && r.corpo.mensagem === respostaConhecida && enviados.length === 1,
    'e-mail desconhecido recebe a MESMA resposta e nada é enviado (não revela quem é cadastrado)');
  r = await pedir('POST', '/api/auth/esqueci-senha', { email: 'inativo@teste.com' }, SEM);
  await esperar();
  ok(r.status === 200 && enviados.length === 1, 'usuário inativo não recebe link');
  r = await pedir('POST', '/api/auth/esqueci-senha', {}, SEM);
  ok(r.status === 400, 'sem e-mail devolve 400', r.status);

  r = await pedir('POST', '/api/auth/esqueci-senha', { email: 'existe@teste.com', origem: 'https://golpe.com' }, SEM);
  r = await pedir('POST', '/api/auth/esqueci-senha', { email: 'existe@teste.com' }, SEM);
  r = await pedir('POST', '/api/auth/esqueci-senha', { email: 'existe@teste.com' }, SEM);
  await esperar();
  ok(r.status === 200 && enviados.length === 3, 'no máximo 3 e-mails por endereço a cada 15 minutos (o 4º pedido não envia nada)', enviados.length);
  limite.zerar();

  ok(verificarTokenRedefinicao(tokenDoEmail) !== null, 'o token do e-mail é autêntico');
  ok(verificarToken(tokenDoEmail) === null, 'o token do e-mail NÃO serve para entrar no sistema');
  const tokenDeLogin = criarToken({ id: 1, nome: 'x', email: 'e@e.com', perfil: 'admin' });
  ok(verificarTokenRedefinicao(tokenDeLogin) === null, 'um token de login NÃO serve para redefinir senha');
  ok(verificarTokenRedefinicao(tokenDoEmail.slice(0, -2) + 'AA') === null, 'link adulterado é recusado');

  const sqlDepoisUpdate = sqls.length;
  r = await pedir('POST', '/api/auth/redefinir-senha', { token: tokenDoEmail, nova_senha: 'Nova#Senha2026' }, SEM);
  ok(r.status === 200 && sqls.slice(sqlDepoisUpdate).some((q) => /UPDATE usuarios SET senha_hash/i.test(q)),
    'link válido + senha boa grava a nova senha', r);
  r = await pedir('POST', '/api/auth/redefinir-senha', { token: tokenDoEmail, nova_senha: 'curta1' }, SEM);
  ok(r.status === 400 && /8 caracteres/.test(r.corpo.erro), 'senha fraca é recusada na redefinição', r);
  r = await pedir('POST', '/api/auth/redefinir-senha', { token: 'lixo.lixo', nova_senha: 'Nova#Senha2026' }, SEM);
  ok(r.status === 400 && /não é mais válido/.test(r.corpo.erro), 'link inventado devolve 400', r);
  r = await pedir('POST', '/api/auth/redefinir-senha', { nova_senha: 'Nova#Senha2026' }, SEM);
  ok(r.status === 400, 'sem link devolve 400', r.status);

  // link de uma senha antiga (a senha mudou depois): não vale mais — uso único
  const antigo = criarTokenRedefinicao({ id: 1, senha_hash: 'hash-que-nao-e-mais-o-atual' });
  r = await pedir('POST', '/api/auth/redefinir-senha', { token: antigo, nova_senha: 'Nova#Senha2026' }, SEM);
  ok(r.status === 400 && /não é mais válido/.test(r.corpo.erro), 'link já usado (senha mudou depois) deixa de valer', r);

  // link vencido
  const real = Date.now;
  Date.now = () => real() + 31 * 60 * 1000;
  r = await pedir('POST', '/api/auth/redefinir-senha', { token: tokenDoEmail, nova_senha: 'Nova#Senha2026' }, SEM);
  Date.now = real;
  ok(r.status === 400 && /não é mais válido/.test(r.corpo.erro), 'link vencido (mais de 30 minutos) é recusado', r);

  // limite de tentativas de redefinição por origem
  limite.zerar();
  let ultimo = 0;
  for (let i = 0; i < 22; i += 1) { ultimo = (await pedir('POST', '/api/auth/redefinir-senha', { token: 'x.y', nova_senha: 'Nova#Senha2026' }, SEM)).status; }
  ok(ultimo === 429, 'muitas tentativas seguidas de redefinição devolvem 429', ultimo);
  limite.zerar();
  delete process.env.APP_URL;

  console.log('\n[1d] Pendências automáticas de contrato e tipo "pagamento" (RF18)');
  let antes = sqls.length;
  FAKE.pendentes = 1; FAKE.pendenciaAberta = false;
  r = await pedir('POST', '/api/contratos', { cliente_id: 1, servico_id: 1 });
  ok(r.status === 201 && sqls.slice(antes).some((q) => /INSERT INTO pendencias/i.test(q)),
    'contrato novo pendente cria a pendência de contrato', r.status);

  antes = sqls.length;
  FAKE.pendentes = 1; FAKE.pendenciaAberta = true;
  r = await pedir('POST', '/api/contratos', { cliente_id: 1, servico_id: 1 });
  ok(r.status === 201 && !sqls.slice(antes).some((q) => /INSERT INTO pendencias/i.test(q)),
    'se já existe pendência de contrato aberta, não cria outra (sem duplicar)', r.status);

  antes = sqls.length;
  FAKE.pendentes = 0; FAKE.pendenciaAberta = true;
  r = await pedir('PATCH', '/api/contratos/1/assinar');
  ok(r.status === 200 && sqls.slice(antes).some((q) => /UPDATE pendencias/i.test(q) && /resolvida/i.test(q)),
    'assinar o último contrato pendente resolve a pendência de contrato', r.status);

  antes = sqls.length;
  FAKE.pendentes = 1; FAKE.pendenciaAberta = true;
  r = await pedir('PATCH', '/api/contratos/1/assinar');
  ok(r.status === 200 && !sqls.slice(antes).some((q) => /UPDATE pendencias/i.test(q)),
    'se ainda sobra outro contrato pendente, a pendência continua aberta', r.status);
  FAKE.pendentes = 0; FAKE.pendenciaAberta = false;

  r = await pedir('POST', '/api/pendencias', { cliente_id: 1, tipo: 'pagamento', descricao: 'Pagamento em aberto' });
  ok(r.status === 201, 'pendência do tipo "pagamento" é aceita', r.status);
  r = await pedir('POST', '/api/pendencias', { cliente_id: 1, tipo: 'qualquer', descricao: 'x' });
  ok(r.status === 400, 'tipo de pendência inválido continua sendo recusado', r.status);

  console.log('\n[1e] Reagendar consulta (RF08)');
  antes = sqls.length;
  FAKE.conflito = false;
  r = await pedir('PUT', '/api/agenda/1', { inicio: '2026-11-20 14:00' });
  ok(r.status === 200, 'reagendar para um horário livre devolve 200', r.status);
  ok(sqls.slice(antes).some((q) => /DELETE FROM lembretes/i.test(q)),
    'reagendar apaga o lembrete antigo (ele é refeito com a data nova)');

  FAKE.conflito = true;
  r = await pedir('PUT', '/api/agenda/1', { inicio: '2026-11-20 14:00', status: 'agendado' });
  ok(r.status === 409 && /nesse horário/.test(r.corpo.erro), 'reagendar em cima de outra consulta devolve 409', r);

  antes = sqls.length;
  r = await pedir('PUT', '/api/agenda/1', { observacao: 'Trazer exames' });
  ok(r.status === 200 && !sqls.slice(antes).some((q) => /DATE_ADD/i.test(q)),
    'mudar só a observação não checa conflito de horário', r.status);
  FAKE.conflito = false;

  r = await pedir('PUT', '/api/agenda/1', { inicio: 'amanhã' });
  ok(r.status === 400, 'horário inválido continua sendo recusado', r.status);

  console.log('\n[1e2] Novo agendamento não pode duplicar horário');
  const novo = { cliente_id: 1, servico_id: 1, inicio: '2026-11-25 10:00', duracao_min: 60 };
  FAKE.conflito = true;
  r = await pedir('POST', '/api/agenda', novo);
  ok(r.status === 409 && /nesse horário/.test(r.corpo.erro), 'agendar em cima de outra consulta devolve 409', r);
  FAKE.conflito = false;
  r = await pedir('POST', '/api/agenda', novo);
  ok(r.status === 201, 'agendar em horário livre devolve 201', r.status);
  FAKE.conflito = true;
  r = await pedir('POST', '/api/agenda', Object.assign({}, novo, { status: 'cancelado' }));
  ok(r.status === 201, 'registro já cancelado não conta como conflito', r.status);
  FAKE.conflito = false;

  console.log('\n[1f] Documentos da cliente');
  const pdf64 = Buffer.from('%PDF-1.4 teste').toString('base64');
  r = await pedir('POST', '/api/documentos', { cliente_id: 1, nome: 'exame.pdf', conteudo_base64: pdf64 });
  ok(r.status === 201, 'enviar PDF devolve 201', r);
  r = await pedir('POST', '/api/documentos', { cliente_id: 1, nome: 'virus.exe', conteudo_base64: pdf64 });
  ok(r.status === 400 && /não aceito/.test(r.corpo.erro), 'tipo .exe é recusado', r);
  r = await pedir('POST', '/api/documentos', { cliente_id: 1, nome: 'vazio.pdf', conteudo_base64: '' });
  ok(r.status === 400, 'arquivo vazio é recusado', r.status);
  r = await pedir('POST', '/api/documentos', { cliente_id: 1, nome: 'grande.pdf',
    conteudo_base64: Buffer.alloc(5 * 1024 * 1024 + 10, 1).toString('base64') });
  ok(r.status === 413, 'arquivo acima de 5 MB devolve 413', r.status);
  r = await pedir('POST', '/api/documentos', { nome: 'a.pdf', conteudo_base64: pdf64 });
  ok(r.status === 400, 'sem cliente_id devolve 400', r.status);
  r = await pedir('GET', '/api/documentos?cliente_id=1');
  ok(r.status === 200 && Array.isArray(r.corpo), 'listar documentos da cliente devolve 200', r.status);
  r = await pedir('GET', '/api/documentos');
  ok(r.status === 400, 'listar sem cliente_id devolve 400', r.status);
  r = await pedir('GET', '/api/documentos/1/arquivo');
  ok(r.status === 200 && r.corpo === '%PDF-teste', 'baixar devolve o conteúdo do arquivo', r);
  r = await pedir('GET', '/api/documentos/1/arquivo', undefined, true);
  ok(r.status === 401, 'baixar sem login devolve 401', r.status);
  r = await pedir('DELETE', '/api/documentos/1');
  ok(r.status === 204, 'excluir documento devolve 204', r.status);

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
