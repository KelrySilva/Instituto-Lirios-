'use strict';

/** Erro com status HTTP, capturado pelo tratador central. */
class HttpError extends Error {
  constructor(status, mensagem, detalhes) {
    super(mensagem);
    this.name = 'HttpError';
    this.status = status;
    this.detalhes = detalhes;
  }
}

/** Envolve um handler async para que qualquer rejeição caia no tratador. */
function rota(tratador) {
  return function (req, res, next) {
    Promise.resolve(tratador(req, res, next)).catch(next);
  };
}

const falha = (mensagem, detalhes) => {
  throw new HttpError(400, mensagem, detalhes);
};

/** Texto obrigatório (ou opcional) com limite de tamanho. */
function texto(valor, campo, { obrigatorio = true, max = 160 } = {}) {
  const bruto = valor === undefined || valor === null ? '' : String(valor).trim();
  if (!bruto) {
    if (obrigatorio) falha('O campo "' + campo + '" é obrigatório.');
    return null;
  }
  if (bruto.length > max) falha('O campo "' + campo + '" deve ter até ' + max + ' caracteres.');
  return bruto;
}

/** Inteiro positivo (ids). */
function id(valor, campo = 'id') {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) {
    falha('"' + campo + '" deve ser um número inteiro positivo.');
  }
  return numero;
}

/** Inteiro com faixa e valor padrão (duração, batimentos). */
function inteiro(valor, campo, { min = 1, max = 100000, padrao = null } = {}) {
  if (valor === undefined || valor === null || valor === '') return padrao;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < min || numero > max) {
    falha('"' + campo + '" deve ser um número inteiro entre ' + min + ' e ' + max + '.');
  }
  return numero;
}

/** Número decimal (valores em reais). */
function decimal(valor, campo, { padrao = 0 } = {}) {
  if (valor === undefined || valor === null || valor === '') return padrao;
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 0) falha('"' + campo + '" deve ser um número maior ou igual a zero.');
  return Number(numero.toFixed(2));
}

/** Data no formato AAAA-MM-DD. */
function data(valor, campo, { obrigatorio = false } = {}) {
  if (valor === undefined || valor === null || valor === '') {
    if (obrigatorio) falha('A data "' + campo + '" é obrigatória.');
    return null;
  }
  const textoValor = String(valor);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(textoValor)) {
    falha('"' + campo + '" deve estar no formato AAAA-MM-DD.');
  }

  const [ano, mes, dia] = textoValor.split('-').map(Number);
  const teste = new Date(Date.UTC(ano, mes - 1, dia));
  if (teste.getUTCFullYear() !== ano || teste.getUTCMonth() !== mes - 1 || teste.getUTCDate() !== dia) {
    falha('"' + campo + '" não é uma data válida no calendário.');
  }

  return textoValor;
}

/** Data e hora no formato AAAA-MM-DD HH:MM[:SS] (aceita 'T' do input datetime-local). */
function dataHora(valor, campo, { obrigatorio = true } = {}) {
  if (valor === undefined || valor === null || valor === '') {
    if (obrigatorio) falha('"' + campo + '" é obrigatório.');
    return null;
  }
  const textoValor = String(valor).replace('T', ' ');
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(textoValor)) {
    falha('"' + campo + '" deve estar no formato AAAA-MM-DD HH:MM.');
  }

  const [parteData, parteHora] = textoValor.split(' ');
  data(parteData, campo, { obrigatorio: true });

  const [hora, minuto, segundo] = parteHora.split(':').map(Number);
  if (hora > 23 || minuto > 59 || (segundo !== undefined && segundo > 59)) {
    falha('"' + campo + '" tem um horário inválido.');
  }

  return parteHora.length === 5 ? textoValor + ':00' : textoValor;
}

/** Só os números de um texto. */
const soDigitos = (valor) => String(valor === undefined || valor === null ? '' : valor).replace(/\D/g, '');

/** CPF: 11 números com dígitos verificadores corretos. Devolve 000.000.000-00 (ou null se vazio e opcional). */
function cpf(valor, campo = 'cpf', { obrigatorio = false } = {}) {
  const numeros = soDigitos(valor);
  if (!numeros) {
    if (obrigatorio) falha('O campo "' + campo + '" é obrigatório.');
    return null;
  }
  if (numeros.length !== 11) falha('O CPF deve ter 11 números.');
  if (/^(\d)\1{10}$/.test(numeros)) falha('CPF inválido.');
  for (const tamanho of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < tamanho; i += 1) soma += Number(numeros[i]) * (tamanho + 1 - i);
    const digito = ((soma * 10) % 11) % 10;
    if (digito !== Number(numeros[tamanho])) falha('CPF inválido.');
  }
  return numeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/** Telefone brasileiro: DDD + 8 ou 9 números (aceita +55). Devolve (99) 99999-9999. */
function telefone(valor, campo = 'telefone', { obrigatorio = false } = {}) {
  let numeros = soDigitos(valor);
  if (!numeros) {
    if (obrigatorio) falha('O campo "' + campo + '" é obrigatório.');
    return null;
  }
  if ((numeros.length === 12 || numeros.length === 13) && numeros.startsWith('55')) numeros = numeros.slice(2);
  if (numeros.length !== 10 && numeros.length !== 11) {
    falha('O telefone deve ter DDD + 8 ou 9 números, por exemplo (99) 99999-9999.');
  }
  if (Number(numeros.slice(0, 2)) < 11) falha('O DDD do telefone é inválido.');
  if (numeros.length === 11 && numeros[2] !== '9') falha('Celular com 9 dígitos deve começar com 9 depois do DDD.');
  return numeros.length === 11
    ? numeros.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
    : numeros.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
}

/** E-mail com formato válido e até 160 caracteres. */
function email(valor, campo = 'email', { obrigatorio = false } = {}) {
  const bruto = valor === undefined || valor === null ? '' : String(valor).trim();
  if (!bruto) {
    if (obrigatorio) falha('O campo "' + campo + '" é obrigatório.');
    return null;
  }
  if (bruto.length > 160) falha('O e-mail deve ter até 160 caracteres.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(bruto)) falha('O e-mail informado não é válido.');
  return bruto;
}

/** Data e hora de agora (horário do servidor) no formato AAAA-MM-DD HH:MM. */
function agoraTexto() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

/** Data de nascimento: não pode ser no futuro nem antes de 1900. */
function nascimento(valor, campo = 'data_nascimento') {
  const dataNasc = data(valor, campo);
  if (!dataNasc) return null;
  if (dataNasc < '1900-01-01') falha('A data de nascimento não pode ser anterior a 1900.');
  if (dataNasc > agoraTexto().slice(0, 10)) falha('A data de nascimento não pode ser no futuro.');
  return dataNasc;
}

/** Recusa data/hora que já passou (compara até o minuto). */
function naoPassado(valorDataHora, mensagem) {
  if (String(valorDataHora).slice(0, 16) < agoraTexto()) {
    falha(mensagem || 'Não é possível agendar em data ou horário que já passou.');
  }
  return valorDataHora;
}

/** Valor de uma lista fechada (status, tipo...). */
function opcao(valor, campo, permitidos, padrao = null) {
  if (valor === undefined || valor === null || valor === '') return padrao;
  if (!permitidos.includes(valor)) {
    falha('"' + campo + '" deve ser um destes valores: ' + permitidos.join(', ') + '.');
  }
  return valor;
}

/** Soma dias a uma data ISO (usado para calcular a DPP a partir da DUM). */
function somarDias(isoOuData, dias) {
  let base;

  if (isoOuData instanceof Date) {
    base = new Date(isoOuData.getTime());
  } else {
    const textoData = String(isoOuData || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(textoData)) {
      falha('Data inválida para cálculo de dias.');
    }
    base = new Date(textoData + 'T00:00:00Z');
  }

  if (Number.isNaN(base.getTime())) falha('Data inválida para cálculo de dias.');

  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

module.exports = {
  HttpError, rota, texto, id, inteiro, decimal,
  data, dataHora, opcao, cpf, telefone, email, nascimento, naoPassado, soDigitos, somarDias
};
